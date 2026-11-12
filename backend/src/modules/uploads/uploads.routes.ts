import { Router } from 'express';
import { createHash } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { env } from '../../config/env.js';
import { authenticate, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const uploadsRouter = Router();
uploadsRouter.use(authenticate, allowRoles(UserRole.LANDLORD, UserRole.AGENT, UserRole.ADMIN));

uploadsRouter.post('/property-image-signature', asyncHandler(async (_req, res) => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_PRESET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_UPLOAD_PRESET) {
    res.status(503).json({ message: 'Property photo storage is not configured yet.' }); return;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'housingconnect/property-images';
  const params = { folder, timestamp: String(timestamp), upload_preset: CLOUDINARY_UPLOAD_PRESET };
  const toSign = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  const signature = createHash('sha1').update(toSign + CLOUDINARY_API_SECRET).digest('hex');
  res.json({
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    timestamp,
    folder,
    uploadPreset: CLOUDINARY_UPLOAD_PRESET,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
  });
}));
