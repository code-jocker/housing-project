# HousingConnect Rwanda API

Node.js, Express, TypeScript, Prisma and PostgreSQL API.

## Local setup

1. Install Node.js 20.19.4 or newer and PostgreSQL 16.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` and generate a unique `JWT_SECRET` of at least 32 characters.
4. Run `npm install`.
5. Run `npx prisma generate`.
6. Run `npx prisma migrate dev` to apply the committed migrations.
7. Run `npm run dev`; the API listens on port 8000 by default.
8. Run `npm run build` and `npm test` before releasing.

## API routes

- Health: `GET /api/v1/health`
- Authentication: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/otp/request`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/password-reset/request`, `POST /api/v1/auth/password-reset/confirm`, `GET /api/v1/auth/me`
- Properties: `GET /api/v1/properties`, `GET /api/v1/properties/:id`, `POST /api/v1/properties`, `PATCH /api/v1/properties/:id`, `PATCH /api/v1/properties/:id/availability`
- Marketplace: `GET /api/v1/marketplace/my-properties`, `GET /api/v1/marketplace/favorites`, `POST|DELETE /api/v1/marketplace/favorites/:propertyId`, `POST|GET /api/v1/marketplace/viewings`, `PATCH /api/v1/marketplace/viewings/:id`, `POST /api/v1/marketplace/properties/:propertyId/reports`
- Uploads: `POST /api/v1/uploads/property-image-signature` (landlord, agent or admin; requires Cloudinary configuration)
- Notifications: `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`
- Admin: `GET /api/v1/admin/overview`, `GET /api/v1/admin/properties/pending`, `PATCH /api/v1/admin/properties/:id/review`, `GET /api/v1/admin/reports`, `PATCH /api/v1/admin/reports/:id`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id/status`, `PATCH /api/v1/admin/users/:id/role`, `GET /api/v1/admin/audit-logs`

Protected routes require `Authorization: Bearer <token>`.

## Phone OTP and password recovery

Set `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` and an approved `AFRICASTALKING_SENDER_ID` if required by your account. Phone numbers must be in international format, for example `+2507XXXXXXXX`.

- OTPs expire after 10 minutes, allow at most five incorrect attempts and can be resent once per minute per phone number.
- In development, `OTP_DEBUG=true` returns a debug code so the flow can be tested without SMS credentials.
- In production, `NODE_ENV=production` and `OTP_DEBUG=false` must be set. Unverified users cannot sign in.
- Password reset uses a separate OTP purpose and increments the account token version, invalidating previously issued access tokens.
- Never enable OTP debug mode in a deployed environment.

## Property photos

Configure Cloudinary with a **signed upload preset**. Restrict the preset to JPG/JPEG/PNG/WebP and a maximum file size of 10 MB. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and `CLOUDINARY_UPLOAD_PRESET`. The API signs mobile uploads; the API secret is never sent to the app. Production listing submissions accept only HTTPS image URLs from the configured Cloudinary account and require at least one photo.

## First administrator account

Public registration cannot create ADMIN accounts. After registering and verifying the designated administrator account, promote it through a controlled database session:

```sql
UPDATE "User" SET role = 'ADMIN'::"UserRole" WHERE phone = '+2507XXXXXXXX';
```

Replace the phone number with the actual verified administrator number. Never expose database credentials or run this command from a public client.

## Testing and deployment

- `npm run build`: TypeScript production build.
- `npm test`: API integration test against PostgreSQL.
- CI runs Prisma validation, migrations, backend build, API integration tests and mobile TypeScript checks.
- Use `npx prisma migrate deploy` for production releases.
- See repository-level `DEPLOYMENT.md` and `render.yaml` for the optional Render Blueprint.

## Production limitations

This is a pre-production marketplace. Listing moderation does not prove property ownership or an agent's authority to rent. Secure identity and property-authority document verification, account deletion/data export/consent workflows, Rwanda privacy and consumer-protection review, production backups/restore drills, monitoring, penetration testing, mobile end-to-end testing and real-world provider validation are still required before public launch. Notifications currently appear in-app; push delivery is not configured.
