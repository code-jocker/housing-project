# HousingConnect Rwanda — Deployment and production checklist

## Render Blueprint

The repository includes `render.yaml` for a Frankfurt-region Node API and managed PostgreSQL database. Review the selected paid plans and region before applying the Blueprint. Render will ask for the Africa's Talking SMS credentials.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint and select this repository.
3. Review the database and web-service plan costs before confirming.
4. Configure `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY` and the approved sender ID.
5. Wait for deployment and verify `https://YOUR-API-DOMAIN/api/v1/health`.
6. Set the mobile app's `EXPO_PUBLIC_API_URL` to the deployed HTTPS API address.
7. Build a preview APK with the EAS instructions in `mobile/README.md`.

The Render blueprint creates a paid managed database and a paid web service. It does not configure a custom domain, Cloudinary, Firebase, monitoring or legal compliance.

## Required production environment

- `NODE_ENV=production`
- A unique, randomly generated `JWT_SECRET` (at least 32 characters)
- Managed PostgreSQL connection string
- Africa's Talking production credentials and an approved sender ID
- `OTP_DEBUG=false`
- Restrictive `CLIENT_ORIGIN` if browser-based clients are added
- HTTPS for all public API traffic

Never place server credentials in Expo variables or commit them to Git.

## Launch blockers that still require external setup or professional review

- Confirm Africa's Talking supports the intended Rwanda destination routes and obtain sender ID approval. Test OTP delivery, delays, retries and cost on MTN and Airtel Rwanda.
- Configure a **private S3-compatible object-storage bucket** for verification evidence. For Cloudflare R2, create a bucket with public access disabled and an API token limited to that bucket's read/write operations. Set `PRIVATE_STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `PRIVATE_STORAGE_REGION=auto`, `PRIVATE_STORAGE_BUCKET`, `PRIVATE_STORAGE_ACCESS_KEY_ID` and `PRIVATE_STORAGE_SECRET_ACCESS_KEY` in the backend environment. Never enable public bucket access. The API issues short-lived signed PUT/GET URLs; evidence is stored by opaque object key and only administrators can request a short-lived review URL. The app rejects files over 10 MB and accepts PDF/JPEG/PNG after upload inspection.
- Complete operational identity and property-authority verification: verify that reviewers are trained, document types are acceptable, rejected submissions can be resubmitted, private evidence is retained/deleted under an approved policy, and identity approval is completed before a property can receive a verified badge. A published listing remains distinct from a verified listing.
- Configure Cloudinary property image uploads: create a **signed** upload preset restricted to JPG/JPEG/PNG/WebP and a 10 MB maximum file size, then set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and `CLOUDINARY_UPLOAD_PRESET`. The API signs uploads; the mobile app never receives the API secret. Verify the preset restrictions in the Cloudinary console before launch.
- Configure Firebase Cloud Messaging if push notifications are required. Current notifications are stored in the database and shown in-app only.
- Add a map provider and validate Rwanda address/geocoding quality if map discovery is required.
- Phone-OTP-confirmed self-service account deletion is implemented for non-admin accounts; it removes associated marketplace records and private verification evidence. The authenticated JSON data-export endpoint is available in the mobile account settings. Complete data-retention schedules, consent records, export-size handling for very large accounts and local privacy review before launch. Password reset and account deletion use separate OTP purposes; password reset revokes previously issued sessions.
- Complete Rwanda data-protection/privacy, consumer-protection, terms-of-service and fraud-response review with qualified local counsel.
- Configure production database backups, restore drills, uptime/error monitoring, log redaction, alerting and incident response.
- Perform penetration testing, dependency/security scanning, load testing and Android real-device acceptance testing.
- Verify admin account bootstrap, role assignment and support procedures before opening registration.

## One-time administrator bootstrap

Before opening registration to the public:

1. In the backend hosting environment, temporarily set `INITIAL_ADMIN_PHONE` (E.164, e.g. `+2507XXXXXXXX`), `INITIAL_ADMIN_NAME` and a unique `INITIAL_ADMIN_PASSWORD` of at least 12 characters.
2. Open the backend service shell and run `npm run seed:admin` from the `backend` directory.
3. Confirm the script reports the new ADMIN account. It refuses to elevate or overwrite an existing account.
4. Remove all three `INITIAL_ADMIN_*` values from the hosting environment immediately after the one-time operation.
5. Sign in with that administrator account and confirm access to the verification queues and audit records.

Treat the bootstrap phone as verified only after confirming that you control the number through an independent process. Never place the bootstrap password in source control or a shared chat.

## Operational release checks

- Confirm all CI jobs are green on the exact release commit.
- Run `npx prisma migrate deploy` against a production-like database before serving traffic.
- Confirm no demo properties are displayed.
- Verify public property endpoints never expose private user or verification data.
- Test account suspension, role changes, OTP throttling, listing moderation, viewing status transitions and notification ownership.
- Confirm backups can be restored before accepting real user data.
