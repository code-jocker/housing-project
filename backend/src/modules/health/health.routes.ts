import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
export const healthRouter = Router();
healthRouter.get('/', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'connected', service: 'HousingConnect API' }); }
  catch { res.status(503).json({ status: 'degraded', database: 'unavailable' }); }
});
