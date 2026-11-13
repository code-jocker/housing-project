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
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    minRent: z.coerce.number().int().min(0).optional(),
    maxRent: z.coerce.number().int().min(0).optional(),
    bedrooms: z.coerce.number().int().min(0).max(30).optional(),
    q: z.string().trim().min(2).max(100).optional(),
    district: z.string().trim().min(2).max(80).optional(),
    sector: z.string().trim().min(2).max(80).optional(),
    type: z.enum(['Apartment', 'House', 'Studio', 'Room', 'Commercial']).optional(),
    verified: z.enum(['true', 'false']).optional(),
  }).safeParse(req.query);

  if (!querySchema.success) {
    res.status(400).json({ message: 'Invalid property search filters.', errors: querySchema.error.flatten() });
    return;
  }

  const { page, limit, minRent, maxRent, bedrooms, q: search, district, sector, type, verified } = querySchema.data;
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent) {
    res.status(400).json({ message: 'Minimum rent cannot exceed maximum rent.' });
    return;
  }

  const where = {
    status: PropertyStatus.PUBLISHED,
    available: true,
    owner: { isActive: true },
    ...(district ? { district: { equals: district, mode: 'insensitive' as const } } : {}),
    ...(sector ? { sector: { equals: sector, mode: 'insensitive' as const } } : {}),
    ...(type ? { propertyType: type } : {}),
    ...(verified === 'true' ? { verifiedAt: { not: null } } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { propertyType: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
        { district: { contains: search, mode: 'insensitive' as const } },
        { sector: { contains: search, mode: 'insensitive' as const } },
        { cell: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
    ...(minRent !== undefined || maxRent !== undefined ? { monthlyRentRwf: { ...(minRent !== undefined ? { gte: minRent } : {}), ...(maxRent !== undefined ? { lte: maxRent } : {}) } } : {}),
    ...(bedrooms !== undefined ? { bedrooms: { gte: bedrooms } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.property.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.property.count({ where }),
  ]);
  res.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

propertiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, status: PropertyStatus.PUBLISHED, available: true, owner: { isActive: true } }, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true } } } });
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
  const updated = await prisma.$transaction(async tx => {
    const result = await tx.property.update({
      where: { id: current.id },
      data: { ...data, status: req.auth!.role === UserRole.ADMIN ? current.status : PropertyStatus.PENDING_REVIEW, ...(req.auth!.role === UserRole.ADMIN ? {} : { verifiedAt: null }), ...(images ? { images: { deleteMany: {}, create: images.map((url, sortOrder) => ({ url, sortOrder })) } } : {}) },
      include: { images: true },
    });
    if (req.auth!.role !== UserRole.ADMIN) {
      await tx.propertyVerification.deleteMany({ where: { propertyId: current.id } });
    }
    return result;
  });
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
