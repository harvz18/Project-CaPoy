# TASKLINK Revenue + Payment Revision — Final Implementation Report

## 1. Final architecture

TASKLINK keeps the worker's agreed wage separate from the TASKLINK platform service fee:

1. Employer posts a task.
2. Tasker applies and the employer selects one tasker through a trusted backend transaction.
3. The backend snapshots the accepted wage and creates one `platformFees/{taskId}` obligation when the active revenue configuration applies.
4. The employer pays the separate TASKLINK fee and submits a private receipt for administrator review.
5. An administrator verifies or rejects the fee. Only a verified fee releases the task's fee prerequisite and the employer's posting restriction.
6. The tasker completes the work and the employer pays the full agreed worker wage directly:
   - **Cash:** employer marks paid; tasker obtains a four-digit in-app PIN; employer submits it to the trusted backend.
   - **GCash:** the existing direct employer-to-tasker recipient-number/QR, receipt, and two-party confirmation flow remains in place.
7. The task can finish only after the worker payment is verified and any applicable TASKLINK fee is verified.

Trusted workflow logic is mirrored in Firebase callable Functions and the Render Admin API. Direct Firestore writes cannot create, approve, or modify platform-fee records, and direct Cash confirmation state changes are blocked.

## 2. Modified implementation areas

- `functions/revenue.js`, `functions/cashPin.js`, `functions/analytics.js`, and their tests: fee snapshots, exact centavo calculations, secure Cash PIN cryptography, and trusted analytics.
- `functions/index.js`: trusted acceptance, fee review, Cash PIN, analytics, audit, and notification callable workflows.
- `admin-api/server.js`: Render-backed mirror of the fee, restriction, Cash PIN, and review workflows.
- `firestore.rules` and `tests/firestore.rules.test.cjs`: server-owned fee/Cash protections and access-control regressions.
- `src/services/platformRevenueService.ts`, `src/services/cashPaymentService.ts`, `src/context/AppContext.tsx`, and `src/types.ts`: client contracts.
- `app/post-task.tsx`, `app/platform-fee/[id].tsx`, `app/task-status/[id].tsx`, `app/admin.tsx`, and `app/superadmin.tsx`: employer, tasker, admin, and superadmin UI.
- `admin-portal/src/main.tsx`, `admin-portal/src/services.ts`, and `admin-portal/src/types.ts`: compact superadmin revenue analytics and payment review support.

## 3. Revenue calculation

- Service fee is configured in basis points, defaulting to **5%**.
- Money is converted to integer centavos and rounded half-up, avoiding floating-point errors.
- PHP 500 worker wage produces PHP 25 fee.
- PHP 1,000 worker wage produces PHP 50 fee.
- The fee snapshot retains the accepted wage, configured rate, destination, and immutable task context at worker selection.

## 4. Fee collection and accounting

- `platformFees/{taskId}` is separate from `payments/{taskId}`.
- The worker's wage is never counted as TASKLINK revenue.
- Only administrator-verified service fees count as gross collected revenue.
- Pending, submitted, rejected, and unverified fees remain obligations, not revenue.
- Analytics show gross verified collections, refunds/credits when recorded, and net retained revenue separately.
- Duplicate fee records are prevented by the task-ID document key and trusted acceptance transaction.

## 5. Administrator verification

- The existing identity-verification and GCash worker-payment review flows remain available.
- Submitted TASKLINK fees appear in a compact, separate payment-review section.
- Only authorized administrators can verify or reject a submitted fee; a rejection requires a reason.
- Verification and rejection write audit logs and employer notifications.

## 6. Posting and progression restrictions

- A trusted unsettled-fee counter blocks another task post while a fee is pending, submitted for review, or rejected.
- The task cannot move into active work while its applicable fee is unverified.
- Verified fee review releases the restriction and notifies the employer.
- Direct Firestore task creation cannot bypass the counter.

## 7. Cash PIN mechanism

- The PIN is four digits, generated in TASKLINK with cryptographically secure randomness; it is not sent by SMS.
- The plaintext PIN is returned only to the assigned tasker after they acknowledge receipt.
- Firestore stores an encrypted record and HMAC, never a plaintext PIN.
- The PIN is bound to task, employer, tasker, wage, and issuance time; it expires after five minutes.
- It has a three-attempt limit, generation limits/cooldown, single-use semantics, and is invalidated if the task leaves the eligible state.
- The employer cannot read or obtain the tasker's PIN from the payment document.

## 8. GCash compatibility

- Existing tasker GCash number and optional QR setup were preserved.
- Existing employer **Pay Now**, optional proof/reference, tasker acknowledgement, and payment-dispute flow were preserved.
- GCash remains a direct employer-to-tasker wage payment.
- The UI explicitly distinguishes that direct wage from the separate TASKLINK service fee.

## 9. Analytics

Authorized admin/superadmin analytics use actual Firestore `platformFees` records and Asia/Manila calendar boundaries. The 1-day, 3-day, 1-week, and 1-month views show:

- Net retained and gross verified platform revenue.
- Refunds/credits, when they exist.
- Pending, submitted-for-review, rejected, and outstanding fees.
- Number of fee-bearing tasks.
- Verified revenue by day, month, and task category.

## 10. Security rules and backend controls

- Platform-fee documents are readable only by the employer or authorized staff and are write-protected from all Firestore clients, including staff clients.
- Fee creation, fee review, Cash PIN issuance, and Cash PIN verification require authenticated trusted backend routes.
- GCash state transitions remain limited to the assigned employer/tasker pair.
- Private receipt/document data is restricted to its permitted participants and staff.
- Admin API protected routes reject unauthenticated requests.

## 11. Automated test results

The following local checks passed:

| Check | Result |
| --- | --- |
| `npm.cmd test` | Passed: TypeScript, 100 workflow tests, 5 beta-preflight tests, 40 Functions tests |
| `npm.cmd --prefix admin-api test` | Passed: 4 API authentication/CORS tests |
| Firebase Auth + Firestore + Storage emulator (`npm.cmd run test:rules`) | Passed: 55 rules tests |
| `npm.cmd run build:web` | Passed |
| `npm.cmd --prefix admin-portal run typecheck` | Passed |
| `npm.cmd --prefix admin-portal run build` | Passed |
| `node --check` for Functions and Admin API | Passed |
| `git diff --check` | Passed |

Local coverage includes exact PHP 500/PHP 25 and PHP 1,000/PHP 50 fee arithmetic, Cash PIN binding/expiry/single-use guards, GCash two-party confirmation, fee-progression blocking, posting blocking, platform-fee immutability, and the canonical task lifecycle.

## 12. Known limitations

- This final audit did **not** deploy code, mutate production Firebase records, perform a real GCash transfer, send real SMS, or run the screens against live QA accounts.
- It therefore does not claim a live Render/Firebase end-to-end result. The automated end-to-end coverage uses local emulator rules and deterministic unit/workflow tests.
- Service-fee verification is intentionally manual administrator review; no bank/GCash payment gateway is introduced.
- Analytics are available after the updated `getAdminAnalytics` Function is deployed.

## 13. Required manual configuration before a live defense

1. Deploy the approved Functions and/or Render Admin API revision together with the mobile/web and Admin Portal builds. Do not deploy only one backend path.
2. Set a unique, 32+ character `CASH_PAYMENT_PIN_SECRET` as a server-side secret in the Render Admin API environment and in Firebase Functions if the callable mirror is deployed. Never place it in source control or an `EXPO_PUBLIC_*` variable.
3. Deploy the updated Firestore rules with the backend code.
4. In the superadmin settings, verify the TASKLINK GCash destination, optional HTTPS QR image, service-fee rate, and instructions.
5. Sign in with the prepared employer, tasker, admin, and superadmin QA accounts and perform the manual script below before the defense.

## 14. Final-defense demonstration script

### Cash task — PHP 500

1. Employer posts a PHP 500 Cash task; tasker applies; employer selects the tasker.
2. Show the created TASKLINK fee: PHP 25, separate from the PHP 500 worker wage.
3. Employer submits the PHP 25 platform-fee receipt; admin verifies it.
4. Show that the task can progress after fee verification.
5. Tasker completes work; employer marks the PHP 500 cash wage as paid.
6. Tasker taps **I Received the Cash** and shares the displayed four-digit PIN verbally for the demonstration.
7. Employer enters the PIN. Show mutually confirmed payment, task completion, and PHP 25 verified platform revenue.

### GCash task — PHP 1,000

1. Employer posts a PHP 1,000 GCash task; tasker applies; employer selects the tasker.
2. Show the separate PHP 50 TASKLINK fee; submit and verify it as above.
3. Tasker enters their direct GCash number/optional QR after work; employer uses **Pay Now** and confirms the direct PHP 1,000 wage transfer.
4. Tasker confirms receipt. Show the task is now eligible to finish and the PHP 50 appears in verified platform revenue.

### Restriction proof

1. Select a tasker on another employer task but do not verify its platform fee.
2. Attempt to create another task: show the posting restriction.
3. Submit the service fee: show it remains restricted while awaiting review.
4. Verify it as admin: show the restriction-removal notification and restored posting eligibility.

## Phase 8 result

The local source implementation, builds, security rules, and deterministic workflow coverage are complete. Deployment and live-QA execution remain a deliberate manual release step and were not performed automatically.
