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
- Configure private document storage and identity/property-authority verification. A published listing is currently moderated but not proof of ownership or an agent's authority.
- Configure Cloudinary or equivalent image storage and enforce image size/type limits.
- Configure Firebase Cloud Messaging if push notifications are required. Current notifications are stored in the database and shown in-app only.
- Add a map provider and validate Rwanda address/geocoding quality if map discovery is required.
- Add password reset, account deletion, data export, retention and consent workflows.
- Complete Rwanda data-protection/privacy, consumer-protection, terms-of-service and fraud-response review with qualified local counsel.
- Configure production database backups, restore drills, uptime/error monitoring, log redaction, alerting and incident response.
- Perform penetration testing, dependency/security scanning, load testing and Android real-device acceptance testing.
- Verify admin account bootstrap, role assignment and support procedures before opening registration.

## Operational release checks

- Confirm all CI jobs are green on the exact release commit.
- Run `npx prisma migrate deploy` against a production-like database before serving traffic.
- Confirm no demo properties are displayed.
- Verify public property endpoints never expose private user or verification data.
- Test account suspension, role changes, OTP throttling, listing moderation, viewing status transitions and notification ownership.
- Confirm backups can be restored before accepting real user data.
