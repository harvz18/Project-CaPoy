# PHASE 0 — PAYMENT REVISION AUDIT AND BASELINE

Date: 2026-11-22
Branch inspected: `tasklink`
Scope: V2 revenue and payment-flow revision only. No application behavior was changed in this phase.

## 1. Current architecture

| Area | Current implementation |
| --- | --- |
| Mobile/web app | Expo Router / React Native application in `app/` and `src/`. |
| Primary data store | Firebase Firestore. Tasks, worker-payment records, applications, notifications, and audit logs are separate collections. |
| Current trusted API | Render-hosted `admin-api/server.js`, authenticated with Firebase ID tokens. The mobile app uses it for worker acceptance, verification review, and platform-revenue operations. |
| Firebase Functions | `functions/index.js` contains parallel trusted handlers, notifications, analytics, and an existing post-completion platform-fee trigger. |
| Staff UI | Mobile `app/admin.tsx` and `app/superadmin.tsx`; a separate `admin-portal/` also builds successfully. |
| Private payment evidence | `paymentProofFiles/{taskId}/uploads/{party}` stores metadata and chunked content in Firestore. Legacy Firebase Storage paths remain supported. |
| Authorization | Firebase custom claims distinguish admin and superadmin. Firestore rules prohibit direct writes to `platformFees` and `platformRevenue`. |

The app currently routes acceptance through `src/services/taskAcceptanceService.ts` to the Render API. Some older Firebase Function and direct-client repository paths remain in the codebase, so future financial changes must keep the Render API, Functions, and Firestore rules consistent.

## 2. Current task lifecycle

```text
Employer posts task
  → Finding Workers
Worker applies
  → Applied
Employer selects worker (trusted Render transaction)
  → Accepted; worker, agreed wage, payment record, availability, applications, and notifications update atomically
Worker checks in / starts work
  → In Progress
Worker submits work completion
  → Pending Approval
Employer and worker complete the selected worker-payment workflow
  → worker-payment status Verified
Employer confirms completion
  → Finished
Employer may archive
  → Archived
```

Other supported task outcomes are `Cancelled`, `Disputed`, and `Expired`. The current `Finished` transition requires the task to be `Pending Approval` and the worker-payment status to be `Verified`; it does **not** require a platform-fee record to be verified.

### Current authoritative writes and guards

- `admin-api/server.js` accepts an application in a Firestore transaction, fixes the agreed amount from either task wage or bid, selects only one worker, rejects other open applications, marks the worker busy, and writes notifications/audit history.
- `src/domain/taskWorkflow.ts` supplies client-side lifecycle checks; `src/services/taskRepository.ts` performs task and worker-payment transactions.
- Firestore rules constrain task, task-match, payment, receipt, and participant writes. `platformFees` and `platformRevenue` are server-write-only.
- Notifications are stored in `notifications`; both payment workflows write participant notifications.
- `auditLogs` records privileged administrative and platform-fee actions.

## 3. Current worker-payment workflows

### Cash / COD

1. Worker marks work complete; task reaches `Pending Approval`.
2. Employer submits a cash-payment confirmation. Optional evidence may be attached.
3. The task/payment status becomes `Submitted` and the worker is notified.
4. The assigned worker confirms receipt through `confirmCashPaymentReceived` / `confirmCashPaymentReceipt`.
5. The task/payment status becomes `Verified`.
6. The employer may mark the task `Finished`.

This is direct mutual acknowledgement. It does **not** have a four-digit, time-limited, server-generated PIN. The existing worker confirmation has no PIN expiry, attempt limit, replay protection specific to a code, or worker-only code display.

### Worker GCash

1. The worker supplies a Philippine GCash number and optional QR image while work is being completed.
2. The employer marks the direct GCash transfer as sent and may attach a reference/proof.
3. Payment status becomes `Awaiting Worker Confirmation`.
4. The worker confirms receipt, which marks the worker payment `Verified`; the worker can instead report non-receipt.
5. The employer can finish the task after worker payment is verified.

This is a direct employer-to-worker process and must remain separate from the platform fee. There is also a legacy/admin GCash-evidence review handler (`reviewPaymentEvidence`) that applies only to submitted `GCash link` worker-payment evidence; the active task-status screen uses the mutual-confirmation path above.

## 4. Existing platform-revenue implementation

The repository already has a partial 5% platform-fee foundation:

- `functions/revenue.js` and `src/domain/platformRevenue.ts` calculate in integer centavos using half-up rounding. PHP 500.00 produces PHP 25.00.
- A `platformFees/{taskId}` snapshot is separate from `payments/{taskId}`. It stores employer, worker, agreed wage, basis points, exact fee, total obligation, destination snapshot, status, receipt/reference fields, review fields, timestamps, and reviewer.
- `platformRevenue/config` is superadmin-controlled through the Render API and Firebase Function. It stores the destination name/number, basis points, instructions, activation time, and audit entry.
- `app/post-task.tsx` already shows a fixed-price estimate and explains that the worker receives the full wage. Bidding states that the final agreed wage determines the fee.
- `app/platform-fee/[id].tsx` has a fee-detail/payment screen that shows the wage, fee, total, GCash destination, receipt upload, transaction reference, and status.
- `admin-api/server.js` validates an uploaded private fee receipt, allows only the employer to submit it, requires an admin/superadmin to verify or reject it, requires a rejection reason, writes notification/audit events, and counts only verified fees as collected in the revenue overview.
- Firestore rules make `platformFees` and `platformRevenue` server-write-only; employers can read only their own fee.

### Critical timing conflict

The existing implementation creates or prepares a platform fee only **after** the task is `Finished` (or archived) and the worker payment is verified:

- Firebase Function: `createPlatformFeeOnCompletedTask` in `functions/index.js`.
- Render API: `ensurePlatformFee` in `admin-api/server.js`.
- Task-status UI exposes **Pay TASKLINK Service Fee** only after `Finished` with verified worker payment.

V2 requires the exact opposite collection point: create the fee after worker selection, require its administrative verification before active work, block new publishing while unresolved, and require the verified fee again before final completion. This timing must be migrated carefully; the existing post-completion trigger cannot remain the source of new obligations.

## 5. Reuse assessment

| V2 requirement | Current classification | Audit finding |
| --- | --- | --- |
| 5% fee calculation with safe rounding | Already implemented | Integer-centavo, half-up calculator and snapshot tests exist. |
| Final agreed wage / bid support | Already implemented | Acceptance derives `agreedAmount` from the fixed wage or selected bid. |
| Separate worker payment and platform fee records | Already implemented | `payments/{taskId}` and `platformFees/{taskId}` are distinct. |
| Fee status model and audit fields | Partially implemented | Pending, submitted, verified, rejected, overdue, and waived types exist; cancelled/refunded/credited semantics and review-history array do not. |
| Idempotent fee creation | Partially implemented | One document per task ID and transactions prevent duplicates, but timing is post-completion. |
| Historical compatibility | Already implemented | Configuration activation time prevents retrospective charges. |
| Fee due after selection / before active work | Missing and conflicting | Existing fee creation is after completion. |
| Fee verification gate before work | Missing | `Accepted → In Progress` has no platform-fee requirement. |
| Employer cannot post while a fee is unresolved | Missing | Task creation and Firestore rules do not check unresolved `platformFees`. |
| Final completion requires platform fee + worker payment | Partially implemented | Worker payment is required; platform-fee verification is not. |
| Fee-payment GCash destination and manual review | Partially implemented | Destination, proof, reference, submission, and trusted review exist. Optional QR configuration and a dedicated staff queue are absent. |
| Admin service-fee review section | Missing | `app/admin.tsx` reviews worker GCash payment records only and does not subscribe to `platformFees`. |
| Superadmin revenue overview | Partially implemented | Verified/pending/review/rejected aggregates, category, and month data exist; required day/month time filters and complete metrics are not exposed. |
| 4-digit cash mutual PIN | Missing | Current Cash flow is immediate employer submission followed by worker confirmation. |
| Existing worker GCash compatibility | Already implemented | Separate manual GCash direct-payment flow with receiving details and mutual acknowledgement exists. |
| Notifications | Partially implemented | Existing fee submission/review/due notifications exist but timing and new restriction/PIN notifications are missing. |

## 6. Collections, records, and security controls

| Data | Current purpose / access |
| --- | --- |
| `tasks/{taskId}` | Task lifecycle, selected worker, agreed wage, worker-payment status, completion fields. Participants and staff can read according to rules. |
| `payments/{taskId}` | Authoritative worker-wage payment record. Holds payment method, status, worker GCash details, and worker-payment evidence. |
| `platformFees/{taskId}` | Separate platform-fee snapshot. Direct client writes are denied; employer-only read, staff read. |
| `paymentProofFiles/{taskId}/uploads/{party}` | Chunked private proof data for client, worker, worker GCash QR, and platform fee. Metadata validates owner, MIME type, size, version, and chunks. |
| `platformRevenue/config` | Superadmin-configured GCash destination/rate. Direct client writes are denied. |
| `notifications` | Participant and fee-review alerts. |
| `auditLogs` | Privileged review/configuration audit records. |

Positive controls already present:

- Fee records cannot be forged from the client because their Firestore rule is `allow write: if false`.
- Fee receipt submission and staff decisions use authenticated trusted backend transactions.
- Only staff claims can review service fees; only superadmin can edit the destination/rate.
- Fee receipt data is private to payment participants/staff and has bounded upload metadata/chunk sizes.
- Worker GCash recipient details remain in the participant-only `payments` record, not in public task data.

## 7. Security concerns and migration risks

1. **Timing conflict is critical.** Creating fees at selection must replace the post-finish creation gate without charging historic tasks. The activation-date snapshot strategy should be retained.
2. **Multiple trusted implementations exist.** Render API and Firebase Functions each contain platform-fee handlers, while the mobile app currently uses the Render API. Future work must select one authoritative write path or ensure identical idempotent behavior; otherwise acceptance and fee creation can drift.
3. **Rules must enforce the new prerequisite.** A disabled UI is insufficient. Direct task updates must not bypass fee verification. Because clients cannot create `platformFees`, acceptance must be backend-owned or direct client acceptance must be denied once the new backend path is enabled.
4. **Existing tasks must remain manageable.** V2 restrictions must apply only to newly fee-eligible tasks after activation. Existing accepted/completed records cannot be retroactively blocked or charged.
5. **Cancellation must retain fee evidence.** The current status model has no finalized refund/credit workflow. A future cancellation state must preserve the obligation and evidence without counting it as collected revenue.
6. **Cash PIN cannot be client generated.** It needs a trusted server record with only a salted/hash representation, expiry, attempt count, one-time-use state, task/party/amount binding, and audit events. No SMS, push payload, or public Firestore field may expose the PIN.
7. **Admin queue gap.** The existing `payments` queue must not be repurposed to treat platform fees as worker wages. A separate compact `platformFees` section is required.
8. **Configuration gap.** Name, number, rate, and instructions exist. QR image support is absent; it should remain optional and must be privately stored/configured rather than hard-coded.

## 8. Proposed minimal implementation order

1. **Phase 1 — revenue foundation:** preserve the current centavo calculator and data shape; move the authoritative fee snapshot to trusted acceptance; retain activation-date compatibility; add explicit cancellation/refund-pending semantics and focused tests.
2. **Phase 2 — employer fee UI:** correct post-task wording, show the selected-worker fee breakdown immediately after acceptance, and route the existing fee screen to a newly due record.
3. **Phase 3 — fee verification:** retain private receipt upload and trusted review; add a dedicated `platformFees` staff queue and ensure rejection/resubmission keeps review history.
4. **Phase 4 — restrictions:** enforce unresolved-fee posting restriction and pre-start/completion gates in trusted backend and Firestore rules without blocking existing task access.
5. **Phase 5 — Cash PIN:** replace only the Cash worker-confirmation path with a trusted in-app PIN workflow. Preserve worker GCash unchanged.
6. **Phase 6 — GCash regression:** verify the direct worker GCash path remains separate.
7. **Phase 7 — reporting/notifications:** extend existing overview/notifications from actual `platformFees` only.
8. **Phase 8 — security and end-to-end tests:** exercise cash and GCash scenarios with emulator and deployed trusted API staging.

## 9. Baseline results

| Command | Result |
| --- | --- |
| `npm.cmd test` | Passed: TypeScript check; 100 workflow tests; 5 beta-preflight tests; 32 Functions tests. |
| `npm.cmd run build:web` | Passed: Expo web export completed. |
| `npm.cmd --prefix admin-api test` | Passed: 4 tests. |
| `npm.cmd --prefix admin-portal run build` | Passed: Vite production build completed. |
| `npm.cmd run test:rules` | Not executed successfully: every rule test stopped before assertions because `FIRESTORE_EMULATOR_HOST` / emulator host and port were not configured. This is an environment blocker, not a claimed rule pass or product regression. |
| `npx.cmd --yes firebase-tools@15.32.0 emulators:exec --project demo-tasklink --only firestore,storage "npm.cmd run test:rules"` | No conclusive completed result was returned in this audit run; no rule-test pass is claimed. |
| `git diff --check` | Passed. |

No lint script is defined in the root `package.json`.

## 10. Files inspected

- `src/types.ts`
- `src/domain/taskWorkflow.ts`
- `src/domain/platformRevenue.ts`
- `src/services/taskRepository.ts`
- `src/services/taskAcceptanceService.ts`
- `src/services/platformRevenueService.ts`
- `src/services/paymentService.ts`
- `src/services/fileUploadService.ts`
- `src/services/adminService.ts`
- `src/context/AppContext.tsx`
- `app/post-task.tsx`
- `app/task-status/[id].tsx`
- `app/platform-fee/[id].tsx`
- `app/admin.tsx`
- `app/superadmin.tsx`
- `admin-api/server.js`
- `functions/index.js`
- `functions/revenue.js`
- `functions/revenue.test.js`
- `firestore.rules`, `storage.rules`, and associated rule tests

## 11. Phase 0 conclusion

The project has safe, reusable foundations for exact 5% calculations, separated fee records, private receipt evidence, trusted review, configuration, audit logs, and manual worker GCash payments. It does **not** yet implement the finalized V2 timing, restriction, completion gate, staff queue, or Cash PIN.

The next safe step is **Phase 1 — Revenue Rules and Data Integrity**. It must change the authoritative fee-creation point from post-completion to worker selection, while preserving current records and preventing direct-client bypasses.
