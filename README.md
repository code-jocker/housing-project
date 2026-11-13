# HousingConnect Rwanda

A mobile-first rental marketplace connecting tenants with landlords and authorized agents in Rwanda. Initial rollout is designed for Kigali, with a path to expand nationwide.

## Technology
- Mobile: Expo, React Native and TypeScript
- API: Node.js, Express and TypeScript
- Database: PostgreSQL with Prisma
- Authentication: phone OTP, password login and OTP password recovery
- Media: signed Cloudinary property-photo uploads
- Deployment: Render Blueprint and Expo EAS build profiles

## Implemented workflows
- Public published-property discovery, search and property details
- Tenant and landlord registration/login with secure token storage
- Phone OTP verification and password reset; password reset revokes old access tokens
- Phone-OTP-confirmed self-service account deletion, including associated marketplace records and private verification evidence
- Saved properties synced with the API
- Landlord property submission, photo upload and listing status management
- Tenant viewing requests, landlord responses and owner contact after acceptance
- Listing reports, admin moderation, account activation/role management
- Private identity-document and property-authority verification submissions using short-lived S3-compatible upload/download URLs
- Administrator identity and property evidence queues; a property receives a verified badge only after both owner identity and property-authority checks are approved
- In-app notifications for viewing, report and listing-review events
- Application audit trail for important property, viewing and administrator actions
- PostgreSQL migrations and automated API integration tests

## Development status

**Status: Development / pre-production**

This repository is **not yet approved for public production launch**. Automated CI currently validates the Prisma schema, applies migrations to PostgreSQL, builds the backend, runs API integration tests and type-checks the mobile app. Passing CI does not replace a production security review or real-device testing.

Before opening the marketplace to the public, complete the launch blockers in [DEPLOYMENT.md](DEPLOYMENT.md), especially:
- Verify Africa's Talking OTP delivery, Rwanda routes, sender ID approval and message costs on MTN and Airtel.
- Configure a signed Cloudinary upload preset and verify file restrictions.
- Implement and operationally verify identity checks and proof that a landlord/agent is authorized to rent each property. Listing moderation is not proof of ownership.
- Complete account deletion, privacy/consent, data retention and local legal review.
- Configure backups, restore testing, monitoring, incident response and production domain/HTTPS.
- Run mobile end-to-end, Android real-device, abuse/security and load tests.
- Configure push notifications and maps if they are part of the launch scope.

Demo properties are fictional. Use `EXPO_PUBLIC_DEMO_MODE=true` only for local demonstrations; production builds must set it to `false`.

## Setup
- [Backend setup and API](backend/README.md)
- [Mobile development and Android builds](mobile/README.md)
- [Deployment and release checklist](DEPLOYMENT.md)
