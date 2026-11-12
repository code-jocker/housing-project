import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

export async function notifyUserSafely(userId: string, type: string, title: string, body: string) {
  try { await prisma.notification.create({ data: { userId, type, title, body } }); }
  catch (error) { console.error('Notification creation failed:', error); }
}

export async function notifyAdminsSafely(type: string, title: string, body: string) {
  try {
    const admins = await prisma.user.findMany({ where: { role: UserRole.ADMIN, isActive: true }, select: { id: true } });
    if (admins.length) await prisma.notification.createMany({ data: admins.map(admin => ({ userId: admin.id, type, title, body })) });
  } catch (error) { console.error('Admin notification creation failed:', error); }
}
