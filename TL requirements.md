# TASKLINK — REQUIREMENTS REQUIRING OWNER ASSISTANCE

This file lists the remaining fixes that cannot be completed safely from the repository alone. No secret, billing, deployed-resource, or production-data change has been made for these items.

## 1. Firebase Functions deployment authority — required for TLQA-001

**Status as of 5 November 2026:** Deployment was explicitly authorized and attempted against the beta project (`tasklink-fb027`) with a strictly non-payment scope: `reviewWorkerVerification`, `setUserAccountStatus`, `correctLockedFullName`, `submitViolationReport`, and `getSuperadminOverview`. Firebase stopped before upload because the project is on the free Spark plan and requires the Blaze pay-as-you-go plan to enable Cloud Build and Artifact Registry. A live Functions-list verification confirms that no Cloud Function is deployed.

**No billing or payment action was taken.** The project was not upgraded, no payment method was added, and no GCash, cash-confirmation, payment-review, task-payment, or payment-analytics Function was selected for deployment.

**Why assistance is still needed:** The code for trusted administration actions exists, but deploying Firebase Cloud Functions requires a Functions-capable/Blaze project. This capstone may remain fully no-payment by either keeping those server-authorized features out of the defense scope or by using an institution-provided, no-billing Functions-capable sandbox approved by the project owner.

Please provide one of the following:

1. An institution-provided **non-production Firebase project** with Functions already enabled and no student-owned billing requirement; or
2. Confirmation that these server-authorized administration actions are excluded from the final-defense demo.

Also required before deployment:

- A trusted machine/account with Firebase Admin deployment credentials.
- A decision on which non-payment functions are in scope first: verification review, account moderation, violation reports, or trusted overview data.
- Test admin and superadmin mobile numbers for custom-claim provisioning.

**Do not provide:** service-account JSON, private keys, or passwords in this repository or chat.

## 2. MapTiler public map key — recommended for TLQA-002

**Status as of 6 November 2026:** Native maps use MapLibre, not Google Maps. The approved MapTiler public key is configured locally and the web build recognizes it. The app retains an attributed OpenStreetMap fallback for controlled defense traffic.

Before wider testing, restrict the existing key in the MapTiler dashboard and configure the same `EXPO_PUBLIC_MAPTILER_API_KEY` value in the approved EAS preview environment. The key is intended for client-side map requests, but must still be protected with plan-appropriate restrictions.

Do not paste the key into this file or source control. After configuration, provide a preview APK/device for permission, map-pin, marker, zoom, and geofence testing.

**Build note:** MapLibre contains native code, so Expo Go cannot load it. Use an Expo development or preview build after rebuilding the app.

## 3. Project-owned support mailbox — required for TLQA-003

**Why assistance is needed:** The Help screen safely falls back to the project coordinator, but wider beta distribution needs a durable public support channel.

Please provide a project-owned mailbox and configure it as `EXPO_PUBLIC_SUPPORT_EMAIL` in the intended local/EAS/hosting environment. Do not use a personal mailbox unless the project owner explicitly approves it.

## 4. Firestore Rules release validation — completed locally

**Status as of 6 November 2026:** Using Firebase CLI 15.32.0, Java 21 LTS, and the isolated `demo-tasklink` Firestore/Storage Emulators, the current Rules source compiled and all 48 Rules tests passed. This includes both authorized and denied paths for task cancellation, worker availability release, private receipt uploads, task lifecycle, and storage access.

The multi-document evaluator blockers were removed without loosening access: cancellation records remain atomic while the authorized cleanup is performed sequentially, and receipt metadata/chunks are persisted in the Rules-required order. The app's TypeScript/workflow, beta-preflight, Functions, and web-export checks also pass.

No Firebase project, production data, deployed Rules, billing setting, or payment capability was changed. A deployment remains a separate owner-authorized action; rerun this suite immediately before any future Rules deployment.

## 5. Acceptance-test devices and accounts

To finish the release-validation portion safely, provide:

- One Android device or emulator with location services.
- Optional iOS device/simulator if iOS support is required.
- A modern browser for responsive admin-portal checks.
- Disposable accounts for client, worker, admin, and superadmin testing.
- Explicit authorization before sending any push notification or deploying backend resources.

## 6. Firebase Phone OTP authority and test setup — required for Phase 9

**Status as of 5 November 2026:** Real SMS OTP was not enabled. The current app safely retains its existing password-based Firebase Authentication flow, and does not set `phoneVerified` or pretend that a local code check is production verification.

**Why owner assistance is needed:** Firebase's current documented limits require a Blaze pay-as-you-go plan for real verification-code SMS. The existing React Native app uses the Firebase JavaScript SDK; on React Native, that SDK needs a compatible third-party `ApplicationVerifier` for phone sign-in. The necessary Firebase console settings and native verification provider have not been authorized or configured.

For a no-cost, development-only test, an authorized Firebase project owner may configure up to 10 fictional phone numbers and codes in **Firebase Console → Authentication → Sign-in method → Phone numbers for testing**. These codes do not send SMS or consume SMS quota, but must never be hardcoded in the app or used for real people.

Before any implementation beyond the current safe scaffolding, please provide:

1. Written approval to enable the Firebase **Phone** provider and configure an SMS region policy for the intended test environment.
2. Confirmation whether Phase 9 is limited to fictional test numbers only, or whether an institution-provided Blaze-capable project is approved for real SMS. Do not add billing to the current project without explicit owner approval.
3. A decision on the Android-native phone-auth approach (a maintained compatible verifier/native Firebase Auth integration) and authorization to add its native dependency and rebuild a development/preview APK.
4. Disposable fictional test numbers/codes configured by the project owner in Firebase Console; do not send the codes, production accounts, or Firebase credentials in chat or source control.

Reference: Firebase documents [fictional phone numbers](https://firebase.google.com/docs/auth/android/phone-auth#test-with-fictional-phone-numbers) as a no-SMS development path, while [real verification SMS is Blaze-only](https://firebase.google.com/docs/auth/limits#phone_number_sign-in_limits) under current limits. Re-check these policies immediately before configuration because pricing and quotas can change.

## Implemented locally

- Added `.nvmrc` pinning Node 20, matching the Cloud Functions runtime declaration.
- Re-ran the existing source/build suites after changes; no application behavior was changed.

## Security reminder

Never place API keys, Firebase Admin credentials, production passwords, signing keys, billing details, or payment credentials in Git, `TL requirements.md`, or ordinary chat messages.
