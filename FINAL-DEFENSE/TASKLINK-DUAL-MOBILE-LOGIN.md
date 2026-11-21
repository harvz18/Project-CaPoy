# TaskLink Dual Mobile Number Login

## Existing authentication architecture

TaskLink's password login remains a mobile-number UI. Internally, the app
normalizes the entered number into its existing Firebase Email/Password alias
(`63...@tasklink.local`) and signs in to the same Firebase UID. This internal
alias is never shown to users or queried from Firestore.

Profiles live at `users/{uid}`. User role, account restrictions, marketplace
verification, and administrator custom-claim checks are applied after every
successful login method.

For compatibility with the former fixed-`+63` input, existing private profiles
that stored only the remaining ten digits are recognized during phone linking.
After Firebase confirms the matching number, that stored value is migrated to
canonical E.164 format.

## Implemented login methods

The existing login screen now has two in-place tabs:

1. **Verification Code Login** accepts `09XXXXXXXXX` or `+639XXXXXXXXX`,
   requests Firebase Phone Authentication, requires exactly six numeric digits,
   uses Firebase's invisible web anti-abuse verifier, and supplies a 60-second
   resend cooldown.
2. **Password Login** preserves the former Mobile Number + Password behavior,
   password visibility control, error handling, sessions, and password-recovery
   link.

Both methods load the same original profile and UID, then apply the normal
role, blocked-account, public-profile, admin, and superadmin restrictions.

## Account-linking safety

Verification-code login is available only when the number has already been
linked to the existing Firebase user from **Profile > Verify Mobile Number**.
The Render Admin API checks the Firebase phone provider against the private
profile's saved mobile number before Firebase begins login. This prevents an
unlinked password account from being replaced by a new phone-only Firebase
account.

Unknown and unlinked numbers return the same generic instruction to use
Password Login and verify the profile number. The preflight returns no profile,
UID, email, role, or account-status data and is rate-limited. OTP codes are
never stored or logged.

## Files changed

- `app/login.tsx` - dual-tab mobile login interface and OTP state.
- `src/context/AppContext.tsx` - OTP sign-in completes through the existing
  account restriction and navigation checks.
- `src/services/phoneLoginService.web.ts` - web Firebase Phone Auth and
  invisible reCAPTCHA.
- `src/services/phoneLoginService.native.ts` - native Firebase Phone Auth and
  session handoff to the established JavaScript Firebase client.
- `src/services/trustedApi.ts` - restricted anonymous phone-login preflight
  and native token-session calls.
- `admin-api/server.js`, `admin-api/phoneAuth.js` - generic eligibility check,
  rate limiting, and verified native-session handoff.
- `admin-api/phoneAuth.test.js` - phone/profile matching coverage.

## Firebase and Android requirements

- Firebase **Phone** and **Email/Password** providers must remain enabled.
- `tasklink-fb027.web.app` must remain an authorized Firebase Auth domain for
  the web login flow.
- Android package remains `com.tasklink.app`; `google-services.json` and the
  React Native Firebase Auth plugins are already configured.
- Before distributing an Android build, confirm the production EAS signing
  certificate's SHA-1 and SHA-256 are registered for that Android Firebase app,
  then produce a fresh EAS build. Expo Go does not include the native Firebase
  Auth module.
- Firebase fictional test phone numbers can be used for defense testing.
  Real SMS availability remains governed by the project's Firebase plan and
  authorized SMS configuration. This implementation does not enable billing or
  use another SMS provider.

## Tests executed

Executed locally after this change:

- `npm run typecheck` - passed.
- `npm test` - passed: 100 workflow tests, 5 preflight tests, 31 Function
  tests.
- `npm --prefix admin-api test` - passed: 3 Admin API tests.
- `npm run build:web` - passed.
- `npx expo export --platform android` - passed.

No live OTP was submitted during these checks, so no real SMS or Firebase
fictional test code is claimed as delivered or verified.

## Manual actions before release

1. Deploy the updated Render Admin API and app build through the normal
   release process; this revision deliberately performs no automatic deploy.
2. Use Password Login once for each existing account that has not yet linked
   its phone, then complete Profile > Verify Mobile Number.
3. Test one Firebase fictional phone number end-to-end on web and in a freshly
   built Android application.
