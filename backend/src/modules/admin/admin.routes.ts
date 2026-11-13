import { Router } from 'express';
import { z } from 'zod';
import { PropertyStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { notifyUserSafely } from '../notifications/notifications.service.js';
import { recordAuditLogSafely } from '../audit/audit.service.js';
import { VerificationStatus } from '@prisma/client';
import { createVerificationDownloadUrl, isPrivateStorageConfigured } from '../verification/private-storage.service.js';

export const adminRouter = Router();
adminRouter.use(authenticate, allowRoles(UserRole.ADMIN));

const paginationSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).optional() });

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  const [users, properties, pending, reports, openViewings, pendingIdentity, pendingProperty] = await Promise.all([
    prisma.user.count(), prisma.property.count(),
    prisma.property.count({ where: { status: PropertyStatus.PENDING_REVIEW } }),
    prisma.propertyReport.count({ where: { resolved: false } }),
    prisma.viewingRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.userVerification.count({ where: { status: VerificationStatus.PENDING } }),
    prisma.propertyVerification.count({ where: { status: VerificationStatus.PENDING } }),
  ]);
  res.json({ data: { users, properties, pendingListings: pending, openReports: reports, pendingViewings: openViewings, pendingIdentityVerifications: pendingIdentity, pendingPropertyVerifications: pendingProperty } });
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
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_REVIEWED', 'Property', current.id, JSON.stringify({ decision: parsed.data.decision, reason: parsed.data.reason || null }));
  await notifyUserSafely(current.ownerId, 'LISTING_REVIEWED', parsed.data.decision === 'PUBLISHED' ? 'Your listing was approved' : 'Your listing was rejected', parsed.data.decision === 'PUBLISHED' ? 'Your listing is now visible to renters.' : `Reason: ${parsed.data.reason}`);
  res.json({ message: parsed.data.decision === 'PUBLISHED' ? 'Listing published after moderation. This is not proof of ownership or authority to rent.' : 'Listing rejected.', data });
}));

adminRouter.get('/verifications/identity', asyncHandler(async (_req, res) => {
  const data = await prisma.userVerification.findMany({
    where: { status: VerificationStatus.PENDING },
    include: { user: { select: { id: true, fullName: true, phone: true, email: true, phoneVerifiedAt: true, role: true } } },
    orderBy: { submittedAt: 'asc' },
  });
  res.json({ data });
}));

adminRouter.get('/verifications/properties', asyncHandler(async (_req, res) => {
  const data = await prisma.propertyVerification.findMany({
    where: { status: VerificationStatus.PENDING },
    include: {
      property: { select: { id: true, title: true, district: true, sector: true, monthlyRentRwf: true, status: true } },
      owner: { select: { id: true, fullName: true, phone: true, role: true, identityVerification: { select: { status: true } } } },
    },
    orderBy: { submittedAt: 'asc' },
  });
  res.json({ data });
}));

adminRouter.get('/verifications/:kind/:id/document', asyncHandler(async (req, res) => {
  if (!isPrivateStorageConfigured()) { res.status(503).json({ message: 'Private document storage is not configured.' }); return; }
  let objectKey: string | undefined;
  if (req.params.kind === 'identity') {
    const item = await prisma.userVerification.findUnique({ where: { id: req.params.id }, select: { evidenceObjectKey: true } });
    objectKey = item?.evidenceObjectKey;
  } else if (req.params.kind === 'property') {
    const item = await prisma.propertyVerification.findUnique({ where: { id: req.params.id }, select: { evidenceObjectKey: true } });
    objectKey = item?.evidenceObjectKey;
  } else {
    res.status(400).json({ message: 'Unknown verification document type.' }); return;
  }
  if (!objectKey) { res.status(404).json({ message: 'Verification document not found.' }); return; }
  await recordAuditLogSafely(req.auth!.userId, 'VERIFICATION_DOCUMENT_ACCESSED', req.params.kind === 'identity' ? 'UserVerification' : 'PropertyVerification', req.params.id);
  res.json({ url: createVerificationDownloadUrl(objectKey), expiresInSeconds: 120 });
}));

const verificationDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(1000).optional(),
});

adminRouter.patch('/verifications/identity/:id', asyncHandler(async (req, res) => {
  const parsed = verificationDecisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose APPROVED or REJECTED.' }); return; }
  if (parsed.data.decision === 'REJECTED' && !parsed.data.reason) { res.status(400).json({ message: 'A rejection reason is required.' }); return; }
  const current = await prisma.userVerification.findUnique({ where: { id: req.params.id } });
  if (!current) { res.status(404).json({ message: 'Identity verification not found.' }); return; }
  if (current.status !== VerificationStatus.PENDING) { res.status(409).json({ message: 'Only pending identity submissions can be reviewed.' }); return; }
  const data = await prisma.userVerification.update({
    where: { id: current.id },
    data: { status: parsed.data.decision, rejectionReason: parsed.data.decision === 'REJECTED' ? parsed.data.reason : null, reviewedAt: new Date(), reviewedById: req.auth!.userId },
    select: { id: true, status: true, rejectionReason: true, reviewedAt: true },
  });
  await recordAuditLogSafely(req.auth!.userId, 'IDENTITY_VERIFICATION_REVIEWED', 'UserVerification', current.id, JSON.stringify({ decision: parsed.data.decision, reason: parsed.data.reason || null }));
  await notifyUserSafely(current.userId, 'IDENTITY_VERIFICATION_REVIEWED', 'Identity verification reviewed', parsed.data.decision === 'APPROVED' ? 'Your identity documents were approved.' : `Your identity documents were rejected: ${parsed.data.reason}`);
  res.json({ message: 'Identity verification decision saved.', data });
}));

adminRouter.patch('/verifications/properties/:id', asyncHandler(async (req, res) => {
  const parsed = verificationDecisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose APPROVED or REJECTED.' }); return; }
  if (parsed.data.decision === 'REJECTED' && !parsed.data.reason) { res.status(400).json({ message: 'A rejection reason is required.' }); return; }
  const current = await prisma.propertyVerification.findUnique({ where: { id: req.params.id }, include: { property: { select: { id: true, title: true } } } });
  if (!current) { res.status(404).json({ message: 'Property verification not found.' }); return; }
  if (current.status !== VerificationStatus.PENDING) { res.status(409).json({ message: 'Only pending property submissions can be reviewed.' }); return; }
  if (parsed.data.decision === 'APPROVED') {
    const identity = await prisma.userVerification.findUnique({ where: { userId: current.ownerId }, select: { status: true } });
    if (identity?.status !== VerificationStatus.APPROVED) {
      res.status(409).json({ message: 'Approve the landlord or agent identity before verifying this property.' }); return;
    }
  }
  const reviewedAt = new Date();
  const [data] = await prisma.$transaction([
    prisma.propertyVerification.update({
      where: { id: current.id },
      data: { status: parsed.data.decision, rejectionReason: parsed.data.decision === 'REJECTED' ? parsed.data.reason : null, reviewedAt, reviewedById: req.auth!.userId },
      select: { id: true, status: true, rejectionReason: true, reviewedAt: true },
    }),
    prisma.property.update({ where: { id: current.propertyId }, data: { verifiedAt: parsed.data.decision === 'APPROVED' ? reviewedAt : null } }),
  ]);
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_VERIFICATION_REVIEWED', 'PropertyVerification', current.id, JSON.stringify({ decision: parsed.data.decision, reason: parsed.data.reason || null }));
  await notifyUserSafely(current.ownerId, 'PROPERTY_VERIFICATION_REVIEWED', 'Property verification reviewed', parsed.data.decision === 'APPROVED' ? `${current.property.title} has been verified after document review.` : `Documents for ${current.property.title} were rejected: ${parsed.data.reason}`);
  res.json({ message: 'Property verification decision saved.', data });
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
  await recordAuditLogSafely(req.auth!.userId, 'REPORT_RESOLUTION_CHANGED', 'PropertyReport', req.params.id, JSON.stringify({ resolved: parsed.data.resolved }));
  res.json({ message: 'Report updated.' });
}));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid pagination parameters.' }); return; }
  const page = parsed.data.page;
  const limit = parsed.data.limit ?? 30;
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
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.user.updateMany({
      where: { id: req.params.id, role: { not: UserRole.ADMIN } },
      data: { isActive: parsed.data.isActive, ...(!parsed.data.isActive ? { tokenVersion: { increment: 1 } } : {}) },
    });
    if (updated.count && !parsed.data.isActive) {
      await tx.property.updateMany({ where: { ownerId: req.params.id }, data: { status: PropertyStatus.PENDING_REVIEW, verifiedAt: null } });
      await tx.userVerification.updateMany({
        where: { userId: req.params.id, status: VerificationStatus.APPROVED },
        data: { status: VerificationStatus.PENDING, rejectionReason: null, reviewedAt: null, reviewedById: null, submittedAt: new Date() },
      });
      await tx.propertyVerification.updateMany({
        where: { ownerId: req.params.id, status: VerificationStatus.APPROVED },
        data: { status: VerificationStatus.PENDING, rejectionReason: null, reviewedAt: null, reviewedById: null, submittedAt: new Date() },
      });
    }
    return updated;
  });
  if (!result.count) { res.status(404).json({ message: 'Non-admin account not found.' }); return; }
  await recordAuditLogSafely(req.auth!.userId, 'USER_STATUS_CHANGED', 'User', req.params.id, JSON.stringify({ isActive: parsed.data.isActive }));
  res.json({ message: parsed.data.isActive ? 'Account activated.' : 'Account deactivated.' });
}));

const roleSchema = z.object({ role: z.enum(['TENANT', 'LANDLORD', 'AGENT']) });
adminRouter.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose TENANT, LANDLORD or AGENT.' }); return; }
  const result = await prisma.user.updateMany({ where: { id: req.params.id, role: { not: UserRole.ADMIN } }, data: { role: parsed.data.role } });
  if (!result.count) { res.status(404).json({ message: 'Non-admin account not found.' }); return; }
  await recordAuditLogSafely(req.auth!.userId, 'USER_ROLE_CHANGED', 'User', req.params.id, JSON.stringify({ role: parsed.data.role }));
  res.json({ message: 'User role updated. Updated permissions are checked from the database on each authenticated request.' });
}));

adminRouter.get('/audit-logs', asyncHandler(async (req, res) => {
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid pagination parameters.' }); return; }
  const page = parsed.data.page;
  const limit = parsed.data.limit ?? 50;
  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count(),
  ]);
  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
