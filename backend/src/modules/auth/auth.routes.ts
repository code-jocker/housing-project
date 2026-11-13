import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createAndSendPhoneOtp, verifyPhoneOtpHash } from './otp.service.js';
import { deletePrivateVerificationObject, isPrivateStorageConfigured } from '../verification/private-storage.service.js';

export const authRouter = Router();
const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/, 'Enter a valid phone number with country code.'),
  email: z.email().optional(),
  password: z.string().min(8).max(72),
  role: z.enum(['TENANT', 'LANDLORD']).default('TENANT'),
});
const loginSchema = z.object({ phone: z.string().trim().min(9).max(16), password: z.string().min(8).max(72) });

function issueToken(user: { id: string; role: UserRole; tokenVersion: number }) {
  return jwt.sign({ role: user.role, tokenVersion: user.tokenVersion }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}
function publicUser(user: { id: string; fullName: string; phone: string; email: string | null; role: UserRole; phoneVerifiedAt: Date | null }) {
  return { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, phoneVerified: Boolean(user.phoneVerifiedAt) };
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid registration details.', errors: parsed.error.flatten() }); return; }
  const { fullName, phone, email, password, role } = parsed.data;
  const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, ...(email ? [{ email }] : [])] }, select: { id: true } });
  if (existing) { res.status(409).json({ message: 'A user with that phone number or email already exists.' }); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { fullName, phone, email, passwordHash, role } });
  if ((env.NODE_ENV === 'production' || env.OTP_DEBUG) && !user.phoneVerifiedAt) {
    try {
      const otp = await createAndSendPhoneOtp(phone);
      res.status(201).json({ message: 'Account created. Enter the verification code sent to your phone.', verificationRequired: true, ...('debugCode' in otp ? { debugCode: otp.debugCode } : {}) });
      return;
    } catch {
      res.status(503).json({ message: 'Account created, but the verification SMS could not be sent. Retry the verification request shortly.' });
      return;
    }
  }
  res.status(201).json({ message: 'Account created.', token: issueToken(user), user: publicUser(user) });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid phone number and password.' }); return; }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ message: 'Incorrect phone number or password.' }); return;
  }
  if ((env.NODE_ENV === 'production' || env.OTP_DEBUG) && !user.phoneVerifiedAt) { res.status(403).json({ message: 'Verify your phone number before signing in.' }); return; }
  res.json({ token: issueToken(user), user: publicUser(user) });
}));


const passwordResetRequestSchema = z.object({ phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/) });
authRouter.post('/password-reset/request', asyncHandler(async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter your phone number with country code.' }); return; }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone }, select: { id: true } });
  if (!user) { res.status(202).json({ message: 'If an account exists for this number, a reset code will be sent.' }); return; }
  try {
    const result = await createAndSendPhoneOtp(parsed.data.phone, 'PASSWORD_RESET');
    res.status(202).json({ message: result.sent ? 'If an account exists for this number, a reset code will be sent.' : 'Please wait before requesting another code.', ...('waitSeconds' in result ? { waitSeconds: result.waitSeconds } : {}), ...('debugCode' in result ? { debugCode: result.debugCode } : {}) });
  } catch {
    res.status(503).json({ message: 'Password reset SMS is temporarily unavailable. Try again later.' });
  }
}));

const passwordResetConfirmSchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/),
  code: z.string().regex(/^[0-9]{6}$/),
  newPassword: z.string().min(8).max(72),
});
authRouter.post('/password-reset/confirm', asyncHandler(async (req, res) => {
  const parsed = passwordResetConfirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid phone number, 6-digit code and password of at least 8 characters.' }); return; }
  const { phone, code, newPassword } = parsed.data;
  const challenge = await prisma.phoneOtp.findUnique({ where: { phone } });
  if (!challenge || challenge.purpose !== 'PASSWORD_RESET' || challenge.expiresAt <= new Date()) {
    if (challenge && challenge.expiresAt <= new Date()) await prisma.phoneOtp.delete({ where: { phone } });
    res.status(400).json({ message: 'The reset code is invalid or expired. Request a new code.' }); return;
  }
  if (challenge.attempts >= 5) { res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' }); return; }
  if (!verifyPhoneOtpHash(phone, code, challenge.codeHash, 'PASSWORD_RESET')) {
    await prisma.phoneOtp.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    res.status(400).json({ message: 'Incorrect reset code.' }); return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { phone }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
    prisma.phoneOtp.delete({ where: { phone } }),
  ]);
  res.json({ message: 'Password reset successfully. Sign in using your new password.' });
}));

authRouter.get('/account/export', authenticate, asyncHandler(async (req, res) => {
  const userId = req.auth!.userId;
  const [user, properties, favorites, viewings, reports, notifications, identity, propertyVerifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, phone: true, email: true, role: true, phoneVerifiedAt: true, createdAt: true } }),
    prisma.property.findMany({ where: { ownerId: userId }, include: { images: { select: { url: true, sortOrder: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.favorite.findMany({ where: { userId }, include: { property: { select: { id: true, title: true, district: true, sector: true, monthlyRentRwf: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.viewingRequest.findMany({ where: { OR: [{ tenantId: userId }, { property: { ownerId: userId } }] }, select: { id: true, preferredAt: true, message: true, status: true, createdAt: true, property: { select: { title: true, district: true, sector: true } }, tenant: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.propertyReport.findMany({ where: { reporterId: userId }, select: { id: true, reason: true, details: true, resolved: true, createdAt: true, property: { select: { title: true, district: true, sector: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.notification.findMany({ where: { userId }, select: { type: true, title: true, body: true, readAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.userVerification.findUnique({ where: { userId }, select: { legalName: true, documentType: true, documentLast4: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true } }),
    prisma.propertyVerification.findMany({ where: { ownerId: userId }, select: { propertyId: true, documentType: true, authorizationConfirmed: true, status: true, rejectionReason: true, submittedAt: true, reviewedAt: true } }),
  ]);
  if (!user) { res.status(404).json({ message: 'Account not found.' }); return; }
  res.json({ exportedAt: new Date().toISOString(), user, properties, favorites, viewings, reports, notifications, verification: { identity, properties: propertyVerifications } });
}));

const accountDeletionRequestSchema = z.object({ phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/) });
authRouter.post('/account-deletion/request', asyncHandler(async (req, res) => {
  const parsed = accountDeletionRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter your phone number with country code.' }); return; }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone }, select: { id: true, role: true } });
  if (!user || user.role === UserRole.ADMIN) {
    res.status(202).json({ message: 'If the account is eligible, a deletion code will be sent.' });
    return;
  }
  try {
    const result = await createAndSendPhoneOtp(parsed.data.phone, 'ACCOUNT_DELETION');
    res.status(202).json({ message: 'If the account is eligible, a deletion code will be sent.', ...('waitSeconds' in result ? { waitSeconds: result.waitSeconds } : {}), ...('debugCode' in result ? { debugCode: result.debugCode } : {}) });
  } catch {
    res.status(503).json({ message: 'Account deletion verification is temporarily unavailable. Try again later.' });
  }
}));

const accountDeletionConfirmSchema = z.object({
  phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/),
  code: z.string().regex(/^[0-9]{6}$/),
});
authRouter.post('/account-deletion/confirm', asyncHandler(async (req, res) => {
  const parsed = accountDeletionConfirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid phone number and six-digit deletion code.' }); return; }
  const { phone, code } = parsed.data;
  const challenge = await prisma.phoneOtp.findUnique({ where: { phone } });
  if (!challenge || challenge.purpose !== 'ACCOUNT_DELETION' || challenge.expiresAt <= new Date()) {
    res.status(400).json({ message: 'The deletion code is invalid or expired. Request a new code.' }); return;
  }
  if (challenge.attempts >= 5) { res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' }); return; }
  if (!verifyPhoneOtpHash(phone, code, challenge.codeHash, 'ACCOUNT_DELETION')) {
    await prisma.phoneOtp.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    res.status(400).json({ message: 'Incorrect deletion code.' }); return;
  }
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true, role: true } });
  if (!user || user.role === UserRole.ADMIN) { res.status(400).json({ message: 'This account cannot be deleted through self-service.' }); return; }
  const [identityEvidence, propertyEvidence] = await Promise.all([
    prisma.userVerification.findUnique({ where: { userId: user.id }, select: { evidenceObjectKey: true } }),
    prisma.propertyVerification.findMany({ where: { ownerId: user.id }, select: { evidenceObjectKey: true } }),
  ]);
  const evidenceKeys = [identityEvidence?.evidenceObjectKey, ...propertyEvidence.map(item => item.evidenceObjectKey)].filter((key): key is string => Boolean(key));
  if (evidenceKeys.length && !isPrivateStorageConfigured()) {
    res.status(503).json({ message: 'Private document storage is unavailable. Account deletion cannot safely remove your verification evidence right now.' }); return;
  }
  try {
    await Promise.all(evidenceKeys.map(key => deletePrivateVerificationObject(key)));
  } catch {
    res.status(503).json({ message: 'Private verification evidence could not be deleted. Your account has not been removed; try again later.' }); return;
  }
  await prisma.$transaction([
    prisma.auditLog.create({ data: { actorId: user.id, action: 'ACCOUNT_DELETED', entityType: 'User', entityId: user.id, details: 'Self-service deletion confirmed by phone OTP.' } }),
    prisma.user.delete({ where: { id: user.id } }),
    prisma.phoneOtp.delete({ where: { phone } }),
  ]);
  res.json({ message: 'Your account and associated marketplace records have been deleted.' });
}));

const otpRequestSchema = z.object({ phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/) });
authRouter.post('/otp/request', asyncHandler(async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid phone number with country code.' }); return; }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone }, select: { id: true, phoneVerifiedAt: true } });
  if (!user || user.phoneVerifiedAt) { res.status(202).json({ message: 'If the account needs verification, a code will be sent.' }); return; }
  try {
    const result = await createAndSendPhoneOtp(parsed.data.phone);
    res.status(202).json({ message: result.sent ? 'Verification code sent if the phone can receive SMS.' : 'Please wait before requesting another code.', ...('waitSeconds' in result ? { waitSeconds: result.waitSeconds } : {}), ...('debugCode' in result ? { debugCode: result.debugCode } : {}) });
  } catch {
    res.status(503).json({ message: 'SMS delivery is temporarily unavailable. Try again later.' });
  }
}));

const otpVerifySchema = z.object({ phone: z.string().trim().regex(/^\+[1-9][0-9]{8,14}$/), code: z.string().regex(/^[0-9]{6}$/) });
authRouter.post('/otp/verify', asyncHandler(async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter your phone number and the 6-digit verification code.' }); return; }
  const { phone, code } = parsed.data;
  const challenge = await prisma.phoneOtp.findUnique({ where: { phone } });
  if (!challenge || challenge.purpose !== 'PHONE_VERIFICATION' || challenge.expiresAt <= new Date()) {
    if (challenge) await prisma.phoneOtp.delete({ where: { phone } });
    res.status(400).json({ message: 'The verification code is invalid or expired. Request a new code.' }); return;
  }
  if (challenge.attempts >= 5) { res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' }); return; }
  if (!verifyPhoneOtpHash(phone, code, challenge.codeHash)) {
    await prisma.phoneOtp.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    res.status(400).json({ message: 'Incorrect verification code.' }); return;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { phone }, data: { phoneVerifiedAt: new Date() } }),
    prisma.phoneOtp.delete({ where: { phone } }),
  ]);
  res.json({ message: 'Phone number verified. You can now sign in.' });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || !user.isActive) { res.status(401).json({ message: 'Account not available.' }); return; }
  res.json({ user: publicUser(user) });
}));
