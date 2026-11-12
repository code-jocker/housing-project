# HousingConnect API

Node.js + Express + TypeScript API using PostgreSQL and Prisma.

## Setup

1. Install Node.js 20.19.4 or newer and PostgreSQL.
2. Create a database named `housingconnect`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` and a random `JWT_SECRET` (minimum 32 characters).
4. Run:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

API defaults to `http://localhost:8000`.

## Endpoints

- `GET /api/v1/health` — API and database health.
- `POST /api/v1/auth/register` — create TENANT, LANDLORD or AGENT account.
- `POST /api/v1/auth/login` — phone/password login.
- `GET /api/v1/auth/me` — current authenticated user.
- `GET /api/v1/properties` — published listings; supports `district`, `sector`, `type`, `minRent`, `maxRent`, `bedrooms`, `page`, `limit`.
- `GET /api/v1/properties/:id` — published property detail.
- `POST /api/v1/properties` — submit listing for review (LANDLORD, AGENT, ADMIN).
- `PATCH /api/v1/properties/:id` — update own listing (or any listing as ADMIN); updates return to review.

Send authenticated requests with `Authorization: Bearer <token>`.

## Security and production notes

- Passwords are hashed with bcrypt; tokens are signed with a secret from the environment.
- Public listing queries only expose PUBLISHED properties.
- New/edited listings are PENDING_REVIEW by default. A verification/admin moderation workflow still needs to be implemented before accepting real listings.
- Phone OTP delivery and phone-verified enforcement are NOT implemented yet. Registration currently creates an unverified account; integrate a legitimate SMS provider and require verification before production.
- Cloudinary upload signing, appointment endpoints, favorites endpoints, admin moderation endpoints, automated tests, and deployment configuration are next milestones.
- Never commit `.env` or production credentials.
