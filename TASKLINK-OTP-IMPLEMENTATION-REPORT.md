# TaskLink OTP and account-verification implementation

## Status summary

| Area | Status | Notes |
| --- | --- | --- |
| Firebase email-verification links | Implemented and tested | Uses Firebase Authentication's `sendEmailVerification`, then `reload` and a forced token refresh to read Firebase's authoritative `emailVerified` state. |
| Verification UI | Implemented and tested | `/verify-email` sends/resends an email link with a 60-second UI cooldown and lets the user check the Firebase state after opening the link. |
| Password recovery | Implemented and tested | `/recover-account` requests Firebase's standard reset link for real email-based accounts and does not disclose whether the address exists. |
| Numeric email OTP | Not applicable | No approved email-delivery provider or trusted backend challenge service exists. No client-side OTP was added. |
| Production SMS/phone OTP | Unavailable without configuration | Phone Authentication is not implemented or configured in this project. The app does not mark phone numbers as verified. |
| Email changes | Blocked by product migration | Existing public accounts authenticate with generated mobile aliases, so replacing the sign-in email would change their login identifier. Firebase's recent-login and `verifyBeforeUpdateEmail` flow should be used only during an approved account-identifier migration. |

## Existing authentication implementation

TaskLink currently creates Firebase Email/Password users using a generated address in the form `63…@tasklink.local`; users sign in with their mobile number and password. The private Firestore profile records the mobile number and starts with `phoneVerified: false`.

This means the generated Firebase email has no mailbox. Sending Firebase email verification or a password-reset link to it would not prove ownership, so the implementation explicitly rejects it. Existing accounts retain their current sign-in and task workflows.

## Selected methods

Firebase's built-in signed email-action links are the only enabled verification/recovery channel for accounts that have a real, deliverable Firebase email. The app does not generate, store, display, or validate a numeric code. Firebase remains the verification authority; the app refreshes the Firebase user record instead of trusting local state.

The resend button has a local 60-second UX cooldown. Firebase's own service-side throttling remains authoritative and errors are surfaced without logging secrets.

## Workflows covered

- An authenticated real-email account can request/resend its Firebase verification email and check verified status.
- A real-email account can request Firebase's standard password-reset link.
- A mobile-password account is told accurately that neither feature is available until a real verification channel is configured.
- Existing registration, login, profile, role, task, payment, geofence, chat, and administrative authorization paths are unchanged.
- Administrator and superadministrator claims are not derived from any verification state.

## Files modified

- `src/services/authService.ts`
- `app/verify-email.tsx`
- `app/recover-account.tsx`
- `app/_layout.tsx`
- `app/login.tsx`
- `app/profile.tsx`
- `tests/authService.test.ts`

## Firebase configuration and manual requirements

No Firebase project configuration was changed and nothing was deployed.

For Firebase email links to deliver for a real-email account, an owner must confirm in Firebase Console:

1. **Authentication → Sign-in method** has Email/Password enabled.
2. **Authentication → Templates** has a configured Email address verification and Password reset template.
3. The sending domain/template configuration is acceptable for the project.
4. **Authentication → Settings → User actions** has email-enumeration protection enabled where available.

The current code uses Firebase's default hosted action handler and intentionally does not claim automatic deep-link return. After opening the email link, the user returns to TaskLink and taps **I've verified my email**.

## Security controls

- No plaintext OTPs, OTP Firestore documents, or custom verification claims were added.
- Verification state comes from Firebase Authentication after `reload`, not from Firestore or a client-controlled profile field.
- Password-reset UI has a generic completion response to avoid account enumeration.
- Generated `@tasklink.local` aliases are rejected for email delivery rather than silently treated as verified.
- No Firestore rules, schemas, custom claims, or administrative permissions were weakened or changed.

## Tests executed

The implementation must be validated again after deployment/configuration changes. In the local codebase the following checks were run successfully:

- `npm.cmd test` — 87 workflow tests, 5 beta-preflight tests, and 29 Functions tests passed.
- `npm.cmd run build:web` — production web export passed.
- `npx.cmd expo export --platform android --output-dir dist-android` — Android JavaScript bundle export passed.
- `git diff --check` — passed.

The focused auth tests verify alias detection, eligibility for email links, and safe action-error messaging. Actual email delivery and Firebase Console template configuration were not tested because no real external emails were sent.

## Free-tier and device limitations

- Firebase email links can only reach an actual email address configured on the Firebase user.
- Firebase Phone Authentication/SMS setup, quotas, anti-abuse controls, and Android/web reCAPTCHA configuration require separate Firebase Console verification and were intentionally not enabled.
- The current mobile-number/password identity design cannot use email verification without an approved migration to real email credentials or a separately configured real Phone Authentication flow.
