# Phase 5 — Four-Digit Cash Payment Confirmation

## Delivered

The previous direct Cash receipt-confirmation path has been replaced with a server-owned, in-app four-digit mutual-confirmation PIN flow. The existing worker GCash flow was retained unchanged.

1. After work is in `Pending Approval`, the employer taps **I Have Paid**.
2. The worker sees the Cash acknowledgement prompt and confirms only after receiving and counting the full amount.
3. A trusted backend generates a cryptographically random four-digit PIN and returns it only to the authenticated assigned worker.
4. The worker sees the PIN with a five-minute countdown and shares it in person.
5. The employer enters the PIN. Trusted backend verification marks the worker payment as `Verified` only when the PIN matches.
6. The existing Finished transition remains separately gated by verified worker payment and the Phase 4 verified platform-fee requirement.

## Security controls

- PINs support leading zeroes and use Node's cryptographic random generator.
- No plaintext PIN is stored in Firestore, emitted in notifications, placed on the task document, or shown to the employer.
- The payment record contains only encrypted recovery material and a server-secret HMAC. The worker can safely reopen the app and retrieve an active PIN from the authenticated backend without generating a different code.
- PINs are bound to task, employer, assigned worker, agreed amount, and issue timestamp.
- A PIN expires after five minutes, is single-use, and accepts at most three incorrect attempts.
- Regeneration is server-controlled, has a post-expiry cooldown, and is capped at three issues per Cash payment.
- Task cancellation, dispute, or any state change away from `Pending Approval` makes validation fail immediately; the Firebase trigger also clears stored encrypted PIN material when deployed.
- Cash payment state changes are now denied to direct Firestore clients. The Render API and Firebase callable mirrors are the only trusted writers.
- Existing Payment-category violation reporting remains available from Task Status and is explicitly linked from the Cash panel. PIN entry records mutual acknowledgement; it does not resolve a payment dispute or independently prove cash exchange.

## Preserved

- GCash worker receiving details, direct GCash payment confirmation, optional evidence, and reporting behavior were not changed.
- Task posting, worker selection, matching, task progression, messaging, reviews, and Phase 1–4 revenue behavior were retained.
- No SMS, Firebase Phone Auth, Twilio, payment gateway, paid service, deployment, or data migration was introduced.

## Configuration required before deployment

Set a unique, random server-only value of at least 32 characters for `CASH_PAYMENT_PIN_SECRET`:

- In Render for `tasklink-admin-api`.
- In the Firebase Functions environment if the callable mirror is deployed.

It must never be added to the Expo environment, committed to Git, logged, or shared with clients. Until the Render API is deployed with that secret, the UI safely reports that Cash confirmation is not configured rather than falling back to the retired direct-confirmation workflow.

## Verification

- `node --check admin-api/server.js` — passed
- `node --check functions/index.js` — passed
- `npm.cmd run typecheck` — passed
- `npm.cmd --prefix functions test` — passed (38 tests, including Cash PIN cryptography/binding/expiry coverage)
- `npm.cmd --prefix admin-api test` — passed (4 tests, including protection of all Cash PIN routes)
- `npm.cmd run test:workflow` — passed (100 tests)
- `npm.cmd run build:web` — passed
- `firebase emulators:exec --only auth,firestore,storage "npm.cmd run test:rules"` — passed (53 tests)
- `git diff --check` — passed

The emulator tests verify that direct Cash payment submission and direct worker verification are denied, so a client cannot bypass the PIN backend. Cryptography tests verify leading-zero preservation, task/party/amount binding, invalid-code rejection, and expiry/use/lock invalidation semantics. Full HTTP transaction testing requires a Firebase Admin test project and a non-production Render deployment with a test-only PIN secret; no external deployment was performed in this phase.

## Main files changed for this phase

- `functions/cashPin.js`
- `functions/cashPin.test.js`
- `admin-api/server.js`
- `admin-api/test/server.test.js`
- `functions/index.js`
- `firestore.rules`
- `src/services/cashPaymentService.ts`
- `src/context/AppContext.tsx`
- `src/types.ts`
- `app/task-status/[id].tsx`
- `tests/firestore.rules.test.cjs`
- `admin-api/.env.example`
- `render.yaml`
