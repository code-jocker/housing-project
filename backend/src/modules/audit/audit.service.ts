import { prisma } from '../../config/prisma.js';

export async function recordAuditLogSafely(actorId: string, action: string, entityType: string, entityId: string, details?: string) {
  try { await prisma.auditLog.create({ data: { actorId, action, entityType, entityId, details } }); }
  catch (error) { console.error('Audit log write failed:', error); }
}
