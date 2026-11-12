import { Router } from 'express';
import { z } from 'zod';
import { PropertyStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

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
  const where = {
    status: PropertyStatus.PUBLISHED,
    available: true,
    ...(typeof req.query.district === 'string' ? { district: { equals: req.query.district, mode: 'insensitive' as const } } : {}),
    ...(typeof req.query.sector === 'string' ? { sector: { equals: req.query.sector, mode: 'insensitive' as const } } : {}),
    ...(typeof req.query.type === 'string' ? { propertyType: req.query.type } : {}),
    ...(minRent !== undefined || maxRent !== undefined ? { monthlyRentRwf: { ...(minRent !== undefined && Number.isFinite(minRent) ? { gte: minRent } : {}), ...(maxRent !== undefined && Number.isFinite(maxRent) ? { lte: maxRent } : {}) } } : {}),
    ...(bedrooms !== undefined && Number.isInteger(bedrooms) ? { bedrooms: { gte: bedrooms } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.property.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.property.count({ where }),
  ]);
  res.json({ data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

propertiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, status: PropertyStatus.PUBLISHED }, include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, role: true, phone: true } } } });
  if (!property) { res.status(404).json({ message: 'Property not found.' }); return; }
  res.json({ data: property });
}));

propertiesRouter.post('/', authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid property details.', errors: parsed.error.flatten() }); return; }
  const { images, ...data } = parsed.data;
  const property = await prisma.property.create({ data: { ...data, ownerId: req.auth!.userId, status: PropertyStatus.PENDING_REVIEW, images: { create: images.map((url, sortOrder) => ({ url, sortOrder })) } }, include: { images: true } });
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
  res.json({ message: 'Property updated. Changes are pending review.', data: updated });
}));
