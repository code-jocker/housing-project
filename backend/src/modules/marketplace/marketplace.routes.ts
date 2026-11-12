import { Router } from 'express';
import { z } from 'zod';
import { PropertyStatus, UserRole, ViewingStatus } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { notifyAdminsSafely, notifyUserSafely } from '../notifications/notifications.service.js';

export const marketplaceRouter = Router();
marketplaceRouter.use(authenticate);

marketplaceRouter.get('/my-properties', allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN), asyncHandler(async (req, res) => {
  const where = req.auth!.role === UserRole.ADMIN ? {} : { ownerId: req.auth!.userId };
  const data = await prisma.property.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' } } }, orderBy: { updatedAt: 'desc' } });
  res.json({ data });
}));

marketplaceRouter.get('/favorites', allowRoles(UserRole.TENANT, UserRole.LANDLORD, UserRole.AGENT), asyncHandler(async (req, res) => {
  const data = await prisma.favorite.findMany({
    where: { userId: req.auth!.userId, property: { status: PropertyStatus.PUBLISHED, available: true } },
    include: { property: { include: { images: { orderBy: { sortOrder: 'asc' } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: data.map(item => item.property) });
}));

marketplaceRouter.post('/favorites/:propertyId', allowRoles(UserRole.TENANT, UserRole.LANDLORD, UserRole.AGENT), asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.propertyId, status: PropertyStatus.PUBLISHED, available: true }, select: { id: true } });
  if (!property) { res.status(404).json({ message: 'Available property not found.' }); return; }
  await prisma.favorite.upsert({
    where: { userId_propertyId: { userId: req.auth!.userId, propertyId: property.id } },
    create: { userId: req.auth!.userId, propertyId: property.id },
    update: {},
  });
  res.status(201).json({ message: 'Property saved.' });
}));

marketplaceRouter.delete('/favorites/:propertyId', allowRoles(UserRole.TENANT, UserRole.LANDLORD, UserRole.AGENT), asyncHandler(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.auth!.userId, propertyId: req.params.propertyId } });
  res.json({ message: 'Property removed from saved list.' });
}));

const viewingSchema = z.object({
  propertyId: z.string().min(1),
  preferredAt: z.iso.datetime(),
  message: z.string().trim().max(1000).optional(),
});
marketplaceRouter.post('/viewings', allowRoles(UserRole.TENANT), asyncHandler(async (req, res) => {
  const parsed = viewingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid viewing request.', errors: parsed.error.flatten() }); return; }
  const preferredAt = new Date(parsed.data.preferredAt);
  if (preferredAt <= new Date()) { res.status(400).json({ message: 'Choose a future viewing date and time.' }); return; }
  const property = await prisma.property.findFirst({ where: { id: parsed.data.propertyId, status: PropertyStatus.PUBLISHED, available: true }, select: { id: true, ownerId: true, title: true } });
  if (!property) { res.status(404).json({ message: 'This property is no longer available.' }); return; }
  if (property.ownerId === req.auth!.userId) { res.status(400).json({ message: 'You cannot request a viewing for your own property.' }); return; }
  const duplicate = await prisma.viewingRequest.findFirst({ where: { tenantId: req.auth!.userId, propertyId: property.id, status: { in: [ViewingStatus.REQUESTED, ViewingStatus.ACCEPTED] } } });
  if (duplicate) { res.status(409).json({ message: 'You already have an active viewing request for this property.' }); return; }
  const data = await prisma.viewingRequest.create({ data: { tenantId: req.auth!.userId, propertyId: property.id, preferredAt, message: parsed.data.message }, include: { property: { select: { id: true, title: true, district: true, sector: true } } } });
  await notifyUserSafely(property.ownerId, 'VIEWING_REQUEST', 'New viewing request', `A tenant requested a viewing for ${property.title}.`);
  res.status(201).json({ message: 'Viewing request sent to the listing owner.', data });
}));

marketplaceRouter.get('/viewings', asyncHandler(async (req, res) => {
  const where = req.auth!.role === UserRole.ADMIN
    ? {}
    : req.auth!.role === UserRole.TENANT
      ? { tenantId: req.auth!.userId }
      : { property: { ownerId: req.auth!.userId } };
  const data = await prisma.viewingRequest.findMany({
    where,
    include: {
      property: { select: { id: true, title: true, district: true, sector: true, ownerId: true, owner: { select: { id: true, fullName: true, phone: true } } } },
      tenant: { select: { id: true, fullName: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const safeData = data.map(item => req.auth!.role === UserRole.TENANT && item.status !== ViewingStatus.ACCEPTED
    ? { ...item, property: { ...item.property, owner: { ...item.property.owner, phone: '' } } }
    : item);
  res.json({ data: safeData });
}));

const viewingUpdateSchema = z.object({ status: z.enum(['ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED']) });
marketplaceRouter.patch('/viewings/:id', asyncHandler(async (req, res) => {
  const parsed = viewingUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid viewing status.' }); return; }
  const current = await prisma.viewingRequest.findUnique({ where: { id: req.params.id }, include: { property: { select: { ownerId: true } } } });
  if (!current) { res.status(404).json({ message: 'Viewing request not found.' }); return; }
  const isTenant = current.tenantId === req.auth!.userId;
  const isOwner = current.property.ownerId === req.auth!.userId;
  const isAdmin = req.auth!.role === UserRole.ADMIN;
  if (!isTenant && !isOwner && !isAdmin) { res.status(403).json({ message: 'You cannot update this viewing request.' }); return; }
  const next = parsed.data.status as ViewingStatus;
  const ownerTransitions: ViewingStatus[] = [ViewingStatus.ACCEPTED, ViewingStatus.DECLINED, ViewingStatus.COMPLETED];
  const tenantTransitions: ViewingStatus[] = [ViewingStatus.CANCELLED];
  if (!isAdmin && ((isOwner && !ownerTransitions.includes(next)) || (isTenant && !tenantTransitions.includes(next)))) {
    res.status(403).json({ message: 'Only the listing owner can accept, decline or complete a request. Tenants can cancel their own request.' }); return;
  }
  if (current.status !== ViewingStatus.REQUESTED && !(current.status === ViewingStatus.ACCEPTED && next === ViewingStatus.COMPLETED) && next !== ViewingStatus.CANCELLED) {
    res.status(409).json({ message: 'This viewing request can no longer be changed to that status.' }); return;
  }
  const data = await prisma.viewingRequest.update({ where: { id: current.id }, data: { status: next } });
  const recipientId = isTenant ? current.property.ownerId : current.tenantId;
  await notifyUserSafely(recipientId, 'VIEWING_UPDATE', 'Viewing request updated', `A viewing request was marked ${next.toLowerCase()}.`);
  res.json({ message: 'Viewing request updated.', data });
}));

const reportSchema = z.object({
  reason: z.enum(['SUSPECTED_SCAM', 'FALSE_INFORMATION', 'DUPLICATE_LISTING', 'UNAUTHORIZED_AGENT', 'OTHER']),
  details: z.string().trim().max(2000).optional(),
});
marketplaceRouter.post('/properties/:propertyId/reports', allowRoles(UserRole.TENANT, UserRole.LANDLORD, UserRole.AGENT), asyncHandler(async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose a valid report reason.', errors: parsed.error.flatten() }); return; }
  const property = await prisma.property.findUnique({ where: { id: req.params.propertyId }, select: { id: true, ownerId: true } });
  if (!property) { res.status(404).json({ message: 'Property not found.' }); return; }
  if (property.ownerId === req.auth!.userId) { res.status(400).json({ message: 'You cannot report your own listing.' }); return; }
  const existing = await prisma.propertyReport.findFirst({ where: { propertyId: property.id, reporterId: req.auth!.userId, resolved: false } });
  if (existing) { res.status(409).json({ message: 'You already have an open report for this listing.' }); return; }
  const data = await prisma.propertyReport.create({ data: { propertyId: property.id, reporterId: req.auth!.userId, reason: parsed.data.reason, details: parsed.data.details } });
  await notifyAdminsSafely('PROPERTY_REPORTED', 'Property reported', `A listing was reported for ${parsed.data.reason.toLowerCase().replaceAll('_', ' ')}.`);
  res.status(201).json({ message: 'Report submitted for review.', data: { id: data.id, createdAt: data.createdAt } });
}));
