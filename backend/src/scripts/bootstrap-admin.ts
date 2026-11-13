import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

async function main() {
  const phone = env.INITIAL_ADMIN_PHONE?.trim();
  const fullName = env.INITIAL_ADMIN_NAME?.trim();
  const password = env.INITIAL_ADMIN_PASSWORD;

  if (!phone || !/^\+[1-9][0-9]{8,14}$/.test(phone)) {
    throw new Error('Set INITIAL_ADMIN_PHONE to an E.164 phone number, for example +2507XXXXXXXX.');
  }
  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    throw new Error('Set INITIAL_ADMIN_NAME to the administrator name.');
  }
  if (!password || password.length < 12 || password.length > 72) {
    throw new Error('Set INITIAL_ADMIN_PASSWORD to a unique password between 12 and 72 characters.');
  }

  const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (existing) {
    throw new Error('An account already exists for INITIAL_ADMIN_PHONE. Refusing to change or elevate an existing account.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      fullName,
      phone,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      phoneVerifiedAt: new Date(),
    },
    select: { id: true, fullName: true, phone: true, role: true },
  });

  console.log('Initial administrator created:', admin);
  console.log('Remove INITIAL_ADMIN_PASSWORD from the environment after this one-time operation.');
}

main()
  .catch(error => {
    console.error('Administrator bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
