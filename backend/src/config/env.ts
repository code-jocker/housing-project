import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('*'),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(),
  OTP_DEBUG: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  PRIVATE_STORAGE_ENDPOINT: z.string().url().optional(),
  PRIVATE_STORAGE_REGION: z.string().optional(),
  PRIVATE_STORAGE_BUCKET: z.string().optional(),
  PRIVATE_STORAGE_ACCESS_KEY_ID: z.string().optional(),
  PRIVATE_STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  INITIAL_ADMIN_PHONE: z.string().optional(),
  INITIAL_ADMIN_NAME: z.string().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
if (parsed.data.NODE_ENV === 'production') {
  if (parsed.data.CLIENT_ORIGIN === '*') {
    console.error('Invalid production configuration: CLIENT_ORIGIN must be an explicit comma-separated HTTPS origin allowlist.');
    process.exit(1);
  }
  const origins = parsed.data.CLIENT_ORIGIN.split(',').map(value => value.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some(value => {
    try { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value; }
    catch { return true; }
  })) {
    console.error('Invalid production configuration: every CLIENT_ORIGIN entry must be a valid HTTPS origin, e.g. https://housingconnect.example.com.');
    process.exit(1);
  }
}
export const env = parsed.data;
