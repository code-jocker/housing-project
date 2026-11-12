import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const authRouter = Router();
const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, 'Enter a valid phone number with country code.'),
  email: z.email().optional(),
  password: z.string().min(8).max(72),
  role: z.enum(['TENANT', 'LANDLORD']).default('TENANT'),
});
const loginSchema = z.object({ phone: z.string().trim().min(9).max(16), password: z.string().min(8).max(72) });

function issueToken(user: { id: string; role: UserRole }) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
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
  if (env.NODE_ENV === 'production' && !user.phoneVerifiedAt) { res.status(201).json({ message: 'Account created. Phone verification is required before sign-in.', verificationRequired: true }); return; }
  res.status(201).json({ message: 'Account created.', token: issueToken(user), user: publicUser(user) });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Enter a valid phone number and password.' }); return; }
  const user = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
  if (!user || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ message: 'Incorrect phone number or password.' }); return;
  }
  if (env.NODE_ENV === 'production' && !user.phoneVerifiedAt) { res.status(403).json({ message: 'Verify your phone number before signing in.' }); return; }
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || !user.isActive) { res.status(401).json({ message: 'Account not available.' }); return; }
  res.json({ user: publicUser(user) });
}));
