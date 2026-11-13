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
- Authentication: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/otp/request`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/password-reset/request`, `POST /api/v1/auth/password-reset/confirm`, `GET /api/v1/auth/me`, `GET /api/v1/auth/account/export`, `POST /api/v1/auth/account-deletion/request`, `POST /api/v1/auth/account-deletion/confirm`
- Properties: `GET /api/v1/properties`, `GET /api/v1/properties/:id`, `POST /api/v1/properties`, `PATCH /api/v1/properties/:id`, `PATCH /api/v1/properties/:id/availability`
- Marketplace: `GET /api/v1/marketplace/my-properties`, `GET /api/v1/marketplace/favorites`, `POST|DELETE /api/v1/marketplace/favorites/:propertyId`, `POST|GET /api/v1/marketplace/viewings`, `PATCH /api/v1/marketplace/viewings/:id`, `POST /api/v1/marketplace/properties/:propertyId/reports`
- Uploads: `POST /api/v1/uploads/property-image-signature` (landlord, agent or admin; requires Cloudinary configuration)
- Notifications: `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`
- Verification: `GET /api/v1/verification/me`, `POST /api/v1/verification/documents/upload-url`, `POST /api/v1/verification/identity`, `POST /api/v1/verification/properties/:propertyId`
- Admin verification: `GET /api/v1/admin/verifications/identity`, `GET /api/v1/admin/verifications/properties`, `GET /api/v1/admin/verifications/:kind/:id/document`, `PATCH /api/v1/admin/verifications/identity/:id`, `PATCH /api/v1/admin/verifications/properties/:id`
- Admin: `GET /api/v1/admin/overview`, `GET /api/v1/admin/properties/pending`, `PATCH /api/v1/admin/properties/:id/review`, `GET /api/v1/admin/reports`, `PATCH /api/v1/admin/reports/:id`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id/status`, `PATCH /api/v1/admin/users/:id/role`, `GET /api/v1/admin/audit-logs`

Protected routes require `Authorization: Bearer <token>`.

## Phone OTP and password recovery

Set `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` and an approved `AFRICASTALKING_SENDER_ID` if required by your account. Phone numbers must be in international format, for example `+2507XXXXXXXX`.

- OTPs expire after 10 minutes, allow at most five incorrect attempts and can be resent once per minute per phone number.
- In development, `OTP_DEBUG=true` returns a debug code so the flow can be tested without SMS credentials.
- In production, `NODE_ENV=production` and `OTP_DEBUG=false` must be set. Unverified users cannot sign in.
- Password reset uses a separate OTP purpose and increments the account token version, invalidating previously issued access tokens.
- Self-service account deletion uses a separate phone OTP purpose, removes the user's marketplace records and private verification evidence, and is unavailable for ADMIN accounts.
- Never enable OTP debug mode in a deployed environment.

## Property photos

Configure Cloudinary with a **signed upload preset**. Restrict the preset to JPG/JPEG/PNG/WebP and a maximum file size of 10 MB. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and `CLOUDINARY_UPLOAD_PRESET`. The API signs mobile uploads; the API secret is never sent to the app. Production listing submissions accept only HTTPS image URLs from the configured Cloudinary account and require at least one photo.

## Private verification document storage

Identity and property evidence must use a private S3-compatible bucket. Configure `PRIVATE_STORAGE_ENDPOINT`, `PRIVATE_STORAGE_REGION`, `PRIVATE_STORAGE_BUCKET`, `PRIVATE_STORAGE_ACCESS_KEY_ID` and `PRIVATE_STORAGE_SECRET_ACCESS_KEY`. Cloudflare R2 can be used with region `auto`. Keep public access disabled. The API creates short-lived signed upload URLs and administrator-only short-lived download URLs. Uploads accept PDF/JPEG/PNG; the API checks the stored object's size (maximum accepted size 10 MB) and media type before creating a verification case. An object uploaded but not submitted may remain orphaned; configure a bucket lifecycle rule for unreferenced temporary objects and a retention policy for submitted evidence.

## First administrator account

Public registration cannot create ADMIN accounts. Use the one-time bootstrap script described in repository-level `DEPLOYMENT.md`:

1. Set `INITIAL_ADMIN_PHONE`, `INITIAL_ADMIN_NAME` and a unique `INITIAL_ADMIN_PASSWORD` in the backend hosting environment.
2. Run `npm run seed:admin` from the backend service shell.
3. Remove the bootstrap environment values immediately after successful creation.

The script refuses to elevate or overwrite an existing account. Confirm control of the bootstrap phone number independently before using it. Never expose database credentials or the bootstrap password.

## Testing and deployment

- `npm run build`: TypeScript production build.
- `npm test`: API integration test against PostgreSQL.
- CI runs Prisma validation, migrations, backend build, API integration tests, mobile TypeScript checks and an Android Expo production bundle export.
- Use `npx prisma migrate deploy` for production releases.
- See repository-level `DEPLOYMENT.md` and `render.yaml` for the optional Render Blueprint.

## Production limitations

This is a pre-production marketplace. Identity and property-authority verification queues, phone-confirmed account deletion and authenticated JSON data export are implemented, but private storage credentials, reviewer operations, retention schedules, consent records and Rwanda privacy/consumer-protection review must be completed before launch. Listing moderation alone does not prove ownership or authority to rent. Production backups/restore drills, monitoring, penetration testing, mobile end-to-end testing and real-world SMS/storage provider validation are also required. Notifications currently appear in-app; push delivery is not configured.
