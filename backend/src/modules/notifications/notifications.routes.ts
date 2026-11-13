import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().min(1).max(50).default(30).safeParse(req.query.limit);
  if (!parsed.success) { res.status(400).json({ message: 'Notification limit must be between 1 and 50.' }); return; }
  const limit = parsed.data;
  const [data, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: limit }),
    prisma.notification.count({ where: { userId: req.auth!.userId, readAt: null } }),
  ]);
  res.json({ data, unread });
}));

notificationsRouter.patch('/read-all', asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { userId: req.auth!.userId, readAt: null }, data: { readAt: new Date() } });
  res.json({ message: 'Notifications marked as read.', updated: result.count });
}));

notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.auth!.userId, readAt: null }, data: { readAt: new Date() } });
  const exists = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.auth!.userId }, select: { id: true } });
  if (!exists) { res.status(404).json({ message: 'Notification not found.' }); return; }
  res.json({ message: 'Notification marked as read.', updated: result.count });
}));
