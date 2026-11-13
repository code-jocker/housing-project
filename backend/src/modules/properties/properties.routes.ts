import { Router } from 'express';
import { z } from 'zod';
import { PropertyStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { env } from '../../config/env.js';
import { notifyAdminsSafely } from '../notifications/notifications.service.js';
import { recordAuditLogSafely } from '../audit/audit.service.js';

export const propertiesRouter = Router();
const propertySchema = z.object({
  title: z.string().trim().min(8).max(120),
  description: z.string().trim().min(20).max(5000),
  propertyType: z.enum(['Apartment', 'House', 'Studio', 'Room', 'Commercial']),
  district: z.string().trim().min(2).max(80),
  sector: z.string().trim().min(2).max(80),
  cell: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  monthlyRentRwf: z.number().int().positive().max(100000000),
  depositRwf: z.number().int().nonnegative().max(100000000).default(0),
  bedrooms: z.number().int().min(0).max(30),
  bathrooms: z.number().int().min(0).max(30),
  furnished: z.boolean().default(false), parking: z.boolean().default(false),
  waterAvailable: z.boolean().default(true), electricity: z.boolean().default(true), internet: z.boolean().default(false),
  images: z.array(z.url()).max(15).default([]),
});

propertiesRouter.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const minRent = req.query.minRent ? Number(req.query.minRent) : undefined;
  const maxRent = req.query.maxRent ? Number(req.query.maxRent) : undefined;
  const bedrooms = req.query.bedrooms ? Number(req.query.bedrooms) : undefined;
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const verifiedOnly = req.query.verified === 'true';

  if (search.length === 1 || search.length > 100) {
    res.status(400).json({ message: 'Search text must contain 2–100 characters.' });
    return;
  }
  if (minRent !== undefined && (!Number.isFinite(minRent) || minRent < 0)) {
    res.status(400).json({ message: 'Minimum rent must be a valid non-negative amount.' });
    return;
  }
  if (maxRent !== undefined && (!Number.isFinite(maxRent) || maxRent < 0)) {
    res.status(400).json({ message: 'Maximum rent must be a valid non-negative amount.' });
    return;
  }
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent) {
    res.status(400).json({ message: 'Minimum rent cannot exceed maximum rent.' });
    return;
  }

  const where = {
    status: PropertyStatus.PUBLISHED, available: true,
    ...(typeof req.query.district === 'string' ? { district: { equals: req.query.district, mode: 'insensitive' as const } } : {}),
    ...(typeof req.query.sector === 'string' ? { sector: { equals: req.query.sector, mode: 'insensitive' as const } } : {}),
    ...(typeof req.query.type === 'string' ? { propertyType: req.query.type } : {}),
    ...(verifiedOnly ? { verifiedAt: { not: null } } : {}),
    ...(search.length >= 2 ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { district: { contains: search, mode: 'insensitive' as const } },
        { sector: { contains: search, mode: 'insensitive' as const } },
        { cell: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(minRent !== undefined || maxRent !== undefined ? { monthlyRentRwf: { ...(minRent !== undefined ? { gte: minRent } : {}), ...(maxRent !== undefined ? { lte: maxRent } : {}) } } : {}),
    ...(bedrooms !== undefined && Number.isInteger(bedrooms) ? { bedrooms: { gte: bedrooms } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.property.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.property.count({ where }),
  ]);
  res.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

propertiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, status: PropertyStatus.PUBLISHED, available: true }, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true } } } });
  if (!property) { res.status(404).json({ message: 'Property not found.' }); return; }
  res.json({ data: property });
}));

propertiesRouter.post('/', authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid property details.', errors: parsed.error.flatten() }); return; }
  if (env.NODE_ENV === 'production') {
    if (!env.CLOUDINARY_CLOUD_NAME || parsed.data.images.length === 0) {
      res.status(400).json({ message: 'Upload at least one property photo before submitting a production listing.' }); return;
    }
    const invalidImage = parsed.data.images.some(value => {
      try {
        const imageUrl = new URL(value);
        return imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'res.cloudinary.com' || !imageUrl.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`);
      } catch { return true; }
    });
    if (invalidImage) { res.status(400).json({ message: 'Production property photos must be uploaded to the configured private HousingConnect Cloudinary account.' }); return; }
  }
  const { images, ...data } = parsed.data;
  const property = await prisma.property.create({ data: { ...data, ownerId: req.auth!.userId, status: PropertyStatus.PENDING_REVIEW, images: { create: images.map((url, sortOrder) => ({ url, sortOrder })) } }, include: { images: true } });
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_CREATED', 'Property', property.id);
  await notifyAdminsSafely('LISTING_SUBMITTED', 'New listing submitted', `${property.title} is waiting for moderation.`);
  res.status(201).json({ message: 'Property submitted for review.', data: property });
}));

propertiesRouter.patch('/:id', authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const current = await prisma.property.findUnique({ where: { id: req.params.id } });
  if (!current) { res.status(404).json({ message: 'Property not found.' }); return; }
  if (current.ownerId !== req.auth!.userId && req.auth!.role !== UserRole.ADMIN) { res.status(403).json({ message: 'You cannot edit this property.' }); return; }
  const parsed = propertySchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid property details.', errors: parsed.error.flatten() }); return; }
  const { images, ...data } = parsed.data;
  const updated = await prisma.property.update({ where: { id: current.id }, data: { ...data, status: req.auth!.role === UserRole.ADMIN ? current.status : PropertyStatus.PENDING_REVIEW, ...(images ? { images: { deleteMany: {}, create: images.map((url, sortOrder) => ({ url, sortOrder })) } } : {}) }, include: { images: true } });
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_UPDATED', 'Property', current.id);
  res.json({ message: 'Property updated. Changes are pending review.', data: updated });
}));

const availabilitySchema = z.object({ available: z.boolean() });
propertiesRouter.patch('/:id/availability', authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose whether the property is available.' }); return; }
  const current = await prisma.property.findUnique({ where: { id: req.params.id } });
  if (!current) { res.status(404).json({ message: 'Property not found.' }); return; }
  if (current.ownerId !== req.auth!.userId && req.auth!.role !== UserRole.ADMIN) { res.status(403).json({ message: 'You cannot update this property.' }); return; }
  const status = parsed.data.available ? PropertyStatus.PENDING_REVIEW : PropertyStatus.RENTED;
  const data = await prisma.property.update({ where: { id: current.id }, data: { available: parsed.data.available, status } });
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_AVAILABILITY_CHANGED', 'Property', current.id, JSON.stringify({ available: parsed.data.available }));
  if (parsed.data.available) await notifyAdminsSafely('LISTING_RELISTED', 'Listing submitted for review', `${data.title} was submitted for review again.`);
  res.json({ message: parsed.data.available ? 'Listing submitted for review before becoming available again.' : 'Listing marked as rented/unavailable.', data });
}));
