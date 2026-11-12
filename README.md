# HousingConnect Rwanda

Mobile-first rental marketplace for tenants, landlords and authorized agents in Rwanda.

## Repository structure
- `mobile/`: Expo + React Native + TypeScript Android/iOS application.
- `backend/`: Express + TypeScript API with Prisma and PostgreSQL.

## Current development status
The repository contains property discovery, API-backed listing data, account screens with secure local token storage, saved-property API, landlord property submission, viewing-request API, reporting API and administrator moderation endpoints.

This is an active development build, **not yet approved for public production use**. Phone OTP delivery/verification, identity checks, proof of ownership or authority to rent, secure document upload, push notifications, maps, end-to-end tests, deployment hardening and legal/privacy review remain launch blockers. Review of a listing is not proof of ownership. Sample mobile listings are demo data and must not be mistaken for real inventory.

## Getting started
See [backend setup](backend/README.md) and [mobile setup](mobile/README.md). CI runs backend Prisma validation/build and mobile TypeScript checks on pushes and pull requests.
