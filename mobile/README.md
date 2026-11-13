# HousingConnect Rwanda — Mobile App

Expo + React Native + TypeScript application for Android and iOS.

## Local development

1. Install Node.js 20.19.4 or newer.
2. From this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `EXPO_PUBLIC_API_URL` to your API address.
   - Android emulator: use the host address supported by your emulator.
   - Physical Android phone: use your computer's LAN IP, not `localhost`; both devices must be on the same Wi-Fi.
   - Deployed API: use its HTTPS URL.
5. Keep `EXPO_PUBLIC_DEMO_MODE=true` only for local demonstrations. Use `false` for production.
6. Run `npx expo start`.

## Implemented mobile workflows

- Tenant and landlord registration/login with secure token storage.
- Phone OTP verification and password-reset screens.
- Published property discovery with server-side search, category/verified filters, RWF rent and bedroom filters, pagination and saved-property retrieval.
- Approximate Google Maps neighbourhood handoff from listing details.
- Saved properties synced with the API.
- Property detail, viewing request and listing report.
- Signed Cloudinary property-photo uploads from the phone's photo library.
- Landlord workspace for submitted properties and viewing requests.
- Identity and property-authority verification centre with private evidence uploads (requires private S3-compatible storage configuration).
- Tenant workspace for viewing request status and owner contact after acceptance.
- Admin dashboard for moderation, reports, user management and identity/property evidence review.
- Account settings for personal-data export and phone-OTP-confirmed account deletion.
- In-app notifications.

## Android release builds

Install and sign in to EAS CLI:

```powershell
npm install -g eas-cli
eas login
eas build:configure
```

Create an internal testing APK:

```powershell
eas build --platform android --profile preview
```

Create a Play Store Android App Bundle:

```powershell
eas build --platform android --profile production
```

Before a public build, configure the production API URL, set demo mode to false, test OTP delivery on Rwanda mobile networks, add final app icon/splash assets, complete privacy/legal review and run real-device acceptance tests.

## Demo data safety

Demo properties are fictional examples, not real rental offers. When demo mode is false, the app shows an empty state if the API has no published listings or cannot be reached; it does not invent properties.
