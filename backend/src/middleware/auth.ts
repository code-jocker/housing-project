import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import type { UserRole } from '@prisma/client';

type TokenPayload = { sub: string };

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
    if (!payload.sub) { res.status(401).json({ message: 'Invalid access token.' }); return; }
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true } });
    if (!user || !user.isActive) { res.status(401).json({ message: 'Account not available.' }); return; }
    req.auth = { userId: user.id, role: user.role as UserRole };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired access token.' });
  }
}

export function allowRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}
