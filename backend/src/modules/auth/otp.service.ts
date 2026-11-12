import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

function hashCode(phone: string, code: string) {
  return createHmac('sha256', env.JWT_SECRET).update(`${phone}:${code}`).digest('hex');
}

async function sendAfricaTalkingSms(phone: string, code: string) {
  if (!env.AFRICASTALKING_USERNAME || !env.AFRICASTALKING_API_KEY) {
    throw new Error('SMS provider is not configured. Set AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY.');
  }
  const body = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to: phone,
    message: `Your HousingConnect verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });
  if (env.AFRICASTALKING_SENDER_ID) body.set('from', env.AFRICASTALKING_SENDER_ID);
  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: { apiKey: env.AFRICASTALKING_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`SMS provider rejected the request (HTTP ${response.status}).`);
}

export async function createAndSendPhoneOtp(phone: string) {
  const previous = await prisma.phoneOtp.findUnique({ where: { phone } });
  if (previous && Date.now() - previous.lastSentAt.getTime() < 60_000) {
    return { sent: false, waitSeconds: Math.ceil((60_000 - (Date.now() - previous.lastSentAt.getTime())) / 1000) };
  }
  const code = randomInt(100000, 1000000).toString();
  await prisma.phoneOtp.upsert({
    where: { phone },
    create: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0, lastSentAt: new Date() },
    update: { codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0, lastSentAt: new Date() },
  });
  try {
    if (!(env.OTP_DEBUG && env.NODE_ENV !== 'production')) await sendAfricaTalkingSms(phone, code);
  } catch (error) {
    await prisma.phoneOtp.deleteMany({ where: { phone } });
    throw error;
  }
  return { sent: true, ...(env.OTP_DEBUG && env.NODE_ENV !== 'production' ? { debugCode: code } : {}) };
}

export function verifyPhoneOtpHash(phone: string, code: string, expectedHash: string) {
  const actual = Buffer.from(hashCode(phone, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
}
