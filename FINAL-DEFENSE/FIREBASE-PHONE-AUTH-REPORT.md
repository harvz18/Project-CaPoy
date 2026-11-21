# Firebase Phone Authentication Report

## Status

Implemented in the source tree on the `tasklink` branch. The trusted server implementation uses the existing Render Admin API so this feature does not require deploying Firebase Functions or enabling Firebase billing.

## Existing authentication architecture

- TaskLink uses the Firebase JavaScript SDK for Email/Password authentication, Firestore, Storage, and Functions.
- Mobile-password accounts retain their existing Firebase users and UIDs by using their current internal `@tasklink.local` aliases only as the Email/Password sign-in identifier.
- The app continues to accept those existing mobile-password accounts for login. Phone verification is an additive credential-linking flow; it does not replace Email/Password login, roles, Firestore profiles, tasks, payments, chats, notifications, or identity-document review.
- The Android package is `com.tasklink.app`, matching the committed `google-services.json` Firebase Android client for project `tasklink-fb027`.

## Changes implemented

- Added strict Philippine-phone normalization for `09XXXXXXXXX` and `+639XXXXXXXXX`, producing `+639XXXXXXXXX`.
- New registrations now store the supported number in canonical E.164 format. Existing login normalization was left intact for existing accounts.
- Added the signed-in **Verify Mobile Number** flow from Profile with phone input, Send OTP, six-digit entry, Verify, resend cooldown, loading states, success state, and specific invalid/expired/network/duplicate-number feedback.
- The web build uses Firebase's `RecaptchaVerifier` and `PhoneAuthProvider`.
- Android uses official React Native Firebase Auth with its Expo config plugins and native Android app verification/fallback reCAPTCHA handling.
- The credential is linked to the current Firebase UID. It never signs in a new phone-only account and never merges accounts.
- Added two trusted Render Admin API routes:
  - `POST /api/phone-verification/native-session` lets the native Firebase SDK temporarily authenticate only as the already-signed-in UID for the linking operation.
  - `POST /api/phone-verification/sync` reads Firebase Admin Auth, confirms the linked number is exactly the private TaskLink profile number, and then writes `phoneVerified`, `verifiedPhoneNumber`, and `phoneVerifiedAt`.
- Firestore Rules prohibit a client from initially claiming a verified phone state, and user profile updates do not allow clients to set the trusted phone fields.
- Phone verification remains entirely separate from administrator identity-document approval and marketplace eligibility.

## Files changed

- `app/phone-verification.tsx`, `app/profile.tsx`, `app/_layout.tsx`
- `src/domain/phoneVerification.ts`
- `src/services/phoneVerificationService.web.ts`, `src/services/phoneVerificationService.native.ts`
- `src/context/AppContext.tsx`, `src/types.ts`
- `admin-api/server.js`, `admin-api/phoneAuth.js`
- `firestore.rules`, `app.json`, `package.json`, `package-lock.json`
- OTP, Admin API, and Firestore Rules tests

## Firebase and Android configuration

- Firebase project inferred from committed configuration: `tasklink-fb027`.
- Phone Authentication was stated as enabled by the project owner; this implementation does not enable it itself.
- `google-services.json` is configured for `com.tasklink.app`.
- Expo plugins added: `@react-native-firebase/app` and `@react-native-firebase/auth`.
- A new EAS Android development/preview/production build is required. Expo Go cannot include the added native Firebase Auth module.

## SHA fingerprint status

The supplied SHA-1 and SHA-256 values could not be verified against the active EAS signing certificate from this repository. No Firebase Console or EAS credentials-console access was available, and no fingerprint was claimed as registered.

To verify them manually:

1. Run `eas credentials -p android` while signed in to the TaskLink EAS account and inspect the Android keystore certificate fingerprints for `com.tasklink.app`.
2. In Firebase Console, open **Project settings → Your apps → TASKLINK-Android**.
3. Add the SHA-1 and SHA-256 only if they exactly match the active EAS certificate, then download the refreshed `google-services.json` only if Firebase changes it.
4. Build a new Android development or preview APK and test on a physical device.

## Required Console and release actions

1. Confirm Phone is enabled in **Authentication → Sign-in method**.
2. In **Authentication → Settings**, authorize the deployed web domain (for example, the TaskLink Firebase Hosting domain) and configure the Philippines SMS region policy if real SMS is approved.
3. Confirm the existing fictional test-number entry in **Authentication → Sign-in method → Phone**. The app does not contain a test number or test code.
4. Deploy the reviewed Render Admin API, static web application, and Firestore Rules before relying on the live feature.
5. Create a new EAS Android build after the native dependency/config-plugin change. Validate native verification on a physical Android device; automatic app verification needs an installed native build.

## Test results actually run

- `npm.cmd run typecheck` — passed.
- `npm.cmd --prefix admin-api test` — passed: 3 tests, including trusted phone-number matching.
- `npm.cmd --prefix functions test` — passed: 31 existing Functions tests.
- `npm.cmd run test:workflow` — passed: 100 tests, including Philippine number normalization, six-digit input, cooldown, and phone error handling.
- `npm.cmd run test:beta-preflight` — passed: 5 tests.
- `npm.cmd run build:web` — passed.
- `npx.cmd expo export --platform android --output-dir dist-android-otp` — passed; this validates the Android JavaScript bundle, not a signed native build.
- Firebase Emulator Rules suite — passed: 51 tests for Firestore and Storage Rules, including rejection of a client attempt to set `phoneVerified`.

No live Firebase fictional-number verification, SMS delivery, EAS build, or Console change was performed from this environment.

## Real SMS availability and remaining blockers

- The source flow supports Firebase fictional phone-number verification through Firebase's normal APIs; it does not fake an SMS or hardcode a number/code.
- No real SMS is claimed as available or tested. The project remains on Spark and this implementation does not enable Blaze or any paid product. Confirm Firebase's current Phone Auth billing, quota, and Philippines-region requirements with the project owner before representing real SMS delivery as available.
- Until the Render Admin API and Firestore Rules are deployed and a new native build is installed, the source changes alone cannot establish the trusted Firestore phone-verification state in production.
