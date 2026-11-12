# HousingConnect Rwanda API

Node.js, Express, TypeScript, Prisma and PostgreSQL API.

## Local setup
1. Install Node.js 20.19.4 or newer and PostgreSQL.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Run `npx prisma migrate dev` to apply the committed database migrations.
6. Run `npm run dev`. The API listens on port 8000 by default.
7. Run `npm run build` before deployment. For production, run `npx prisma migrate deploy` as a release step.

## Routes
- `GET /api/v1/health`
- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/otp/request`, `POST /api/v1/auth/otp/verify`, `GET /api/v1/auth/me`
- `GET /api/v1/properties`, `GET /api/v1/properties/:id`, `POST /api/v1/properties`, `PATCH /api/v1/properties/:id`, `PATCH /api/v1/properties/:id/availability`
- Authenticated marketplace: `GET /api/v1/marketplace/my-properties`, `GET /api/v1/marketplace/favorites`, `POST|DELETE /api/v1/marketplace/favorites/:propertyId`, `POST|GET /api/v1/marketplace/viewings`, `PATCH /api/v1/marketplace/viewings/:id`, `POST /api/v1/marketplace/properties/:propertyId/reports`
- Authenticated notifications: `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`.
- Admin only: `GET /api/v1/admin/overview`, `GET /api/v1/admin/properties/pending`, `PATCH /api/v1/admin/properties/:id/review`, `GET /api/v1/admin/reports`, `PATCH /api/v1/admin/reports/:id`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id/status`

All protected routes require `Authorization: Bearer <token>`.

## Important launch limitations
Phone verification/OTP, identity and property-authority document review, Cloudinary upload signing, push notifications, payment collection, Google Maps, automated test coverage, production hosting and a privacy/terms/legal review are not yet configured. Registration currently issues a session before phone verification; this must be changed before public production launch. Admin publishing is a workflow decision only and is not proof of property ownership. A listing's review badge must not be presented as a guarantee against fraud.

## Security
Never commit `.env`, credentials, private keys, OTPs or identity documents. Use HTTPS, managed secrets, database backups, monitoring and a restricted CORS origin in production.

## Phone OTP configuration
Set `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` and, if approved for your account, `AFRICASTALKING_SENDER_ID`. Apply the Prisma schema with `npx prisma migrate dev --name phone_otp`. In development only, `OTP_DEBUG=true` returns a debug code for local testing; set `OTP_DEBUG=false` in production. Production mode requires SMS credentials and does not issue a session until the phone is verified. OTPs expire after 10 minutes, are limited to five verification attempts and can be resent no more than once per minute per phone number.

## First administrator account
Public registration cannot create ADMIN accounts. After registering and verifying the designated administrator account, promote it through a controlled database session:
```sql
UPDATE "User" SET role = 'ADMIN'::"UserRole" WHERE phone = '+2507XXXXXXXX';
```
Replace the number with the actual verified administrator phone. Never expose database credentials or run this command from a public client.

## Deployment
See the repository-level `DEPLOYMENT.md` and `render.yaml` for the optional Render Blueprint. Review plan costs and configure all secrets before deploying. Do not expose the API publicly until OTP delivery has been tested on Rwanda networks and document verification, backups, monitoring and local legal review are complete.
