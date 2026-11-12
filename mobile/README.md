# HousingConnect mobile app

Expo + React Native + TypeScript. The app loads published listings from the API when configured and falls back to sample listings when the API is unavailable.

## Setup

```bash
npm install
copy .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to your API base URL. For a physical phone, use your computer's LAN IP address, not `localhost`, and ensure both devices share the same Wi-Fi network. Example: `http://192.168.1.20:8000`.

Start Expo:

```bash
npx expo start
```

The API client currently includes public property listing, registration and login methods. The login/register UI, secure token storage and appointment/favorites screens are not yet wired into the app.

## Demo data safety
Set `EXPO_PUBLIC_DEMO_MODE=true` only for local demonstrations. Demo properties are fictional examples, not real rental offers. Set `EXPO_PUBLIC_DEMO_MODE=false` (or omit it) for production builds. Production mode displays an empty state instead of inventing listings when the API is empty or unavailable.
