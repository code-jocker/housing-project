import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { UserRole, VerificationStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { notifyAdminsSafely } from '../notifications/notifications.service.js';
import { recordAuditLogSafely } from '../audit/audit.service.js';
import { createVerificationUploadUrl, inspectVerificationObject, isPrivateStorageConfigured } from './private-storage.service.js';

export const verificationRouter = Router();
verificationRouter.use(authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT));

const allowedContentTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const uploadSchema = z.object({
  purpose: z.enum(['IDENTITY', 'PROPERTY']),
  contentType: z.enum(allowedContentTypes),
});

verificationRouter.post('/documents/upload-url', asyncHandler(async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Choose a PDF, JPEG or PNG verification document.' }); return; }
  if (!isPrivateStorageConfigured()) { res.status(503).json({ message: 'Private document storage is not configured. Verification submissions are unavailable.' }); return; }
  const extension = parsed.data.contentType === 'application/pdf' ? 'pdf' : parsed.data.contentType === 'image/png' ? 'png' : 'jpg';
  const objectKey = `verification/${req.auth!.userId}/${parsed.data.purpose.toLowerCase()}/${randomUUID()}.${extension}`;
  const uploadUrl = createVerificationUploadUrl(objectKey, parsed.data.contentType);
  res.json({ uploadUrl, objectKey, method: 'PUT', expiresInSeconds: 300, requiredHeaders: { 'Content-Type': parsed.data.contentType }, maximumSizeBytes: 10 * 1024 * 1024 });
}));

verificationRouter.get('/me', asyncHandler(async (req, res) => {
  const [identity, properties] = await Promise.all([
    prisma.userVerification.findUnique({ where: { userId: req.auth!.userId }, select: { id: true, legalName: true, documentType: true, documentLast4: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true } }),
    prisma.propertyVerification.findMany({ where: { ownerId: req.auth!.userId }, include: { property: { select: { id: true, title: true, district: true, sector: true } } }, orderBy: { submittedAt: 'desc' } }),
  ]);
  res.json({ identity, properties: properties.map(item => ({ id: item.id, property: item.property, documentType: item.documentType, status: item.status, rejectionReason: item.rejectionReason, submittedAt: item.submittedAt, reviewedAt: item.reviewedAt })) });
}));

const identitySchema = z.object({
  legalName: z.string().trim().min(3).max(120),
  documentType: z.enum(['NATIONAL_ID', 'PASSPORT', 'RESIDENCE_PERMIT']),
  documentLast4: z.string().regex(/^[0-9]{4}$/),
  evidenceObjectKey: z.string().min(10).max(500),
});

verificationRouter.post('/identity', asyncHandler(async (req, res) => {
  const parsed = identitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter your legal name, document type, last four digits and upload your document.' }); return; }
  const prefix = `verification/${req.auth!.userId}/identity/`;
  if (!parsed.data.evidenceObjectKey.startsWith(prefix)) { res.status(400).json({ message: 'The uploaded document does not belong to your account.' }); return; }
  if (!isPrivateStorageConfigured()) { res.status(503).json({ message: 'Private document storage is not configured.' }); return; }
  const object = await inspectVerificationObject(parsed.data.evidenceObjectKey);
  if (!object) { res.status(400).json({ message: 'The uploaded document is missing, too large or has an unsupported file type. Maximum size is 10 MB.' }); return; }
  const data = await prisma.$transaction(async tx => {
    const verification = await tx.userVerification.upsert({
      where: { userId: req.auth!.userId },
      create: { userId: req.auth!.userId, ...parsed.data, status: VerificationStatus.PENDING },
      update: { ...parsed.data, status: VerificationStatus.PENDING, rejectionReason: null, submittedAt: new Date(), reviewedAt: null, reviewedById: null },
      select: { id: true, status: true, submittedAt: true },
    });
    await tx.property.updateMany({ where: { ownerId: req.auth!.userId }, data: { verifiedAt: null } });
    await tx.propertyVerification.updateMany({
      where: { ownerId: req.auth!.userId, status: VerificationStatus.APPROVED },
      data: { status: VerificationStatus.PENDING, rejectionReason: null, reviewedAt: null, reviewedById: null, submittedAt: new Date() },
    });
    return verification;
  });
  await recordAuditLogSafely(req.auth!.userId, 'IDENTITY_VERIFICATION_SUBMITTED', 'UserVerification', data.id);
  await notifyAdminsSafely('IDENTITY_VERIFICATION_SUBMITTED', 'Identity verification submitted', 'A landlord or agent submitted identity documents for review.');
  res.status(201).json({ message: 'Identity documents submitted securely for review.', data });
}));

const propertySchema = z.object({
  documentType: z.enum(['LAND_TITLE', 'LEASE_AUTHORIZATION', 'OWNER_CONSENT', 'AGENT_MANDATE']),
  authorizationConfirmed: z.literal(true),
  evidenceObjectKey: z.string().min(10).max(500),
});

verificationRouter.post('/properties/:propertyId', asyncHandler(async (req, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Confirm that you own the property or are authorized to rent it, and select a supporting document.' }); return; }
  const property = await prisma.property.findUnique({ where: { id: req.params.propertyId }, select: { id: true, ownerId: true, title: true } });
  if (!property) { res.status(404).json({ message: 'Property not found.' }); return; }
  if (property.ownerId !== req.auth!.userId) { res.status(403).json({ message: 'Only the listing owner can submit property verification.' }); return; }
  const prefix = `verification/${req.auth!.userId}/property/`;
  if (!parsed.data.evidenceObjectKey.startsWith(prefix)) { res.status(400).json({ message: 'The uploaded document does not belong to your account.' }); return; }
  if (!isPrivateStorageConfigured()) { res.status(503).json({ message: 'Private document storage is not configured.' }); return; }
  const object = await inspectVerificationObject(parsed.data.evidenceObjectKey);
  if (!object) { res.status(400).json({ message: 'The uploaded document is missing, too large or has an unsupported file type. Maximum size is 10 MB.' }); return; }
  const data = await prisma.propertyVerification.upsert({
    where: { propertyId: property.id },
    create: { propertyId: property.id, ownerId: req.auth!.userId, ...parsed.data, status: VerificationStatus.PENDING },
    update: { ownerId: req.auth!.userId, ...parsed.data, status: VerificationStatus.PENDING, rejectionReason: null, submittedAt: new Date(), reviewedAt: null, reviewedById: null },
    select: { id: true, status: true, submittedAt: true },
  });
  await prisma.property.update({ where: { id: property.id }, data: { verifiedAt: null } });
  await recordAuditLogSafely(req.auth!.userId, 'PROPERTY_VERIFICATION_SUBMITTED', 'PropertyVerification', data.id);
  await notifyAdminsSafely('PROPERTY_VERIFICATION_SUBMITTED', 'Property authority documents submitted', `${property.title} has supporting documents waiting for review.`);
  res.status(201).json({ message: 'Property documents submitted securely for review.', data });
}));
