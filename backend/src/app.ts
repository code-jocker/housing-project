import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { propertiesRouter } from './modules/properties/properties.routes.js';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { healthRouter } from './modules/health/health.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN === '*' ? true : env.CLIENT_ORIGIN.split(',').map(value => value.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false }));
app.get('/', (_req, res) => res.json({ name: 'HousingConnect API', version: '1.0.0', docs: 'See README.md for endpoints.' }));
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/properties', propertiesRouter);
app.use('/api/v1/marketplace', marketplaceRouter);
app.use('/api/v1/admin', adminRouter);
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});
