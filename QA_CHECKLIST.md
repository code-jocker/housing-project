# HousingConnect Rwanda — Release QA checklist

Run this checklist against a staging database and real Android devices before accepting real users or payments. Use fictional test accounts and documents only.

## Marketplace discovery

- [ ] Search by property title, description, type, district, sector and cell.
- [ ] Filter by Apartment, House, Studio, Room and Commercial.
- [ ] Filter by verified-only, minimum/maximum monthly rent and minimum bedrooms.
- [ ] Confirm invalid ranges, malformed page values and unsupported categories return HTTP 400.
- [ ] Load multiple pages and confirm no duplicate property cards.
- [ ] Save a property, change search filters, open Saved, and confirm saved listings outside the current feed still appear.
- [ ] Confirm no unpublished, unavailable or deactivated-owner listing appears publicly.
- [ ] Confirm demo listings are not shown in production builds.

## Tenant journey

- [ ] Register with a Rwanda phone number and verify OTP on MTN and Airtel.
- [ ] Sign in, request a viewing for a future date, and see the request in My requests.
- [ ] Confirm the owner's phone number is hidden while REQUESTED and visible after ACCEPTED.
- [ ] Cancel a requested or accepted viewing and confirm terminal requests cannot be changed.
- [ ] Save/remove favorites and submit a listing report.
- [ ] Export personal data from Account settings & privacy and inspect the shared JSON for private fields such as password hashes or verification storage keys; none should be present.

## Landlord / agent journey

- [ ] Register, verify phone, and sign in.
- [ ] Upload property photos through the signed Cloudinary preset.
- [ ] Submit a listing and confirm it remains hidden until moderation.
- [ ] Open Verification centre and submit identity evidence.
- [ ] Upload a property-authority document and confirm the ownership/authorization declaration.
- [ ] Confirm PDF/JPEG/PNG files over 10 MB or unsupported file types are rejected at submission.
- [ ] Confirm only administrators can obtain short-lived private evidence download URLs.
- [ ] Confirm document access is written to the audit log.
- [ ] Confirm the admin cannot approve property verification until owner identity is approved.
- [ ] Confirm the Verified badge appears only after property evidence is approved.
- [ ] Edit a verified listing and confirm its badge/evidence is invalidated and the listing returns to review.
- [ ] Deactivate the owner account and confirm listings become hidden and prior badges are revoked.

## Administrator journey

- [ ] Create the first ADMIN account using the one-time bootstrap script and remove bootstrap secrets afterwards.
- [ ] Review listing submissions and require rejection reasons.
- [ ] Review identity documents, approve/reject with reasons, and verify audit events.
- [ ] Review property-authority documents and verify identity approval is required first.
- [ ] Confirm private evidence URLs expire and are not returned by public endpoints.
- [ ] Resolve reports, manage accounts and roles, and inspect audit logs.
- [ ] Confirm deactivation invalidates sessions and sends owned listings back to review.

## Account privacy

- [ ] Export a test account's data and verify it contains the user's own marketplace records but no password hashes, OTP hashes or private object keys.
- [ ] Request account deletion and confirm the OTP is delivered to the account phone.
- [ ] Confirm deletion removes the user, owned listings, favorites, viewing requests, notifications, reports and verification records.
- [ ] Confirm private identity/property evidence objects are deleted from the private bucket.
- [ ] Confirm admin accounts cannot use self-service deletion.
- [ ] Verify the documented retention of security audit records with local counsel.

## Production integrations and operations

- [ ] Configure private S3-compatible storage with public access disabled and verify signed PUT, HEAD, GET and DELETE against the real bucket.
- [ ] Configure a lifecycle rule for orphaned, unsubmitted verification uploads.
- [ ] Configure the Cloudinary signed preset with allowed formats and size restrictions.
- [ ] Validate Africa's Talking SMS delivery, sender ID approval, retries and cost for MTN and Airtel Rwanda.
- [ ] Verify production HTTPS, CORS policy, rate limits and secrets handling.
- [ ] Verify database backups and perform a restore drill.
- [ ] Configure uptime/error monitoring, alerting, log redaction and incident response.
- [ ] Run dependency scanning, penetration testing and load testing.
- [ ] Build and install an Android preview APK; test camera/photo access, secure token storage, share sheet, maps handoff and OTP entry on real devices.
- [ ] Complete Rwanda data protection, consumer protection, terms, privacy and consent review with qualified local counsel.

## Release gate

Do not launch publicly until all critical items above are verified, CI is green on the exact release commit, and the operational owner has accepted the fraud, privacy, support and incident-response procedures.
