import { Router } from 'express';
import { z } from 'zod';
import { PropertyStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const adminRouter = Router();
adminRouter.use(authenticate, allowRoles(UserRole.ADMIN));

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  const [users, properties, pending, reports, openViewings] = await Promise.all([
    prisma.user.count(), prisma.property.count(),
    prisma.property.count({ where: { status: PropertyStatus.PENDING_REVIEW } }),
    prisma.propertyReport.count({ where: { resolved: false } }),
    prisma.viewingRequest.count({ where: { status: 'REQUESTED' } }),
  ]);
  res.json({ data: { users, properties, pendingListings: pending, openReports: reports, pendingViewings: openViewings } });
}));

adminRouter.get('/properties/pending', asyncHandler(async (_req, res) => {
  const data = await prisma.property.findMany({
    where: { status: PropertyStatus.PENDING_REVIEW },
    include: { images: { orderBy: { sortOrder: 'asc' } }, owner: { select: { id: true, fullName: true, phone: true, role: true, phoneVerifiedAt: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data });
}));

const decisionSchema = z.object({ decision: z.enum(['PUBLISHED', 'REJECTED']), reason: z.string().trim().max(1000).optional() });
adminRouter.patch('/properties/:id/review', asyncHandler(async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose PUBLISHED or REJECTED.' }); return; }
  const current = await prisma.property.findUnique({ where: { id: req.params.id } });
  if (!current) { res.status(404).json({ message: 'Property not found.' }); return; }
  if (current.status !== PropertyStatus.PENDING_REVIEW) { res.status(409).json({ message: 'Only pending listings can be reviewed.' }); return; }
  if (parsed.data.decision === 'REJECTED' && !parsed.data.reason) { res.status(400).json({ message: 'A rejection reason is required.' }); return; }
  const data = await prisma.property.update({ where: { id: current.id }, data: { status: parsed.data.decision } });
  res.json({ message: parsed.data.decision === 'PUBLISHED' ? 'Listing published after moderation. This is not proof of ownership or authority to rent.' : 'Listing rejected.', data });
}));

adminRouter.get('/reports', asyncHandler(async (_req, res) => {
  const data = await prisma.propertyReport.findMany({
    where: { resolved: false },
    include: { property: { select: { id: true, title: true, district: true, sector: true, status: true, ownerId: true } }, reporter: { select: { id: true, fullName: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data });
}));

const reportResolutionSchema = z.object({ resolved: z.boolean() });
adminRouter.patch('/reports/:id', asyncHandler(async (req, res) => {
  const parsed = reportResolutionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid report update.' }); return; }
  const report = await prisma.propertyReport.updateMany({ where: { id: req.params.id }, data: { resolved: parsed.data.resolved } });
  if (!report.count) { res.status(404).json({ message: 'Report not found.' }); return; }
  res.json({ message: 'Report updated.' });
}));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const [data, total] = await Promise.all([
    prisma.user.findMany({ select: { id: true, fullName: true, phone: true, email: true, role: true, isActive: true, phoneVerifiedAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.user.count(),
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

const accountSchema = z.object({ isActive: z.boolean() });
adminRouter.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid account status.' }); return; }
  if (req.params.id === req.auth!.userId && !parsed.data.isActive) { res.status(400).json({ message: 'You cannot deactivate your own admin account.' }); return; }
  const result = await prisma.user.updateMany({ where: { id: req.params.id, role: { not: UserRole.ADMIN } }, data: { isActive: parsed.data.isActive } });
  if (!result.count) { res.status(404).json({ message: 'Non-admin account not found.' }); return; }
  res.json({ message: parsed.data.isActive ? 'Account activated.' : 'Account deactivated.' });
}));
