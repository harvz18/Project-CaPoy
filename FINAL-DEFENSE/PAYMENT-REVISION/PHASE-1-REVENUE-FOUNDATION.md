# PHASE 1 — REVENUE RULES AND DATA INTEGRITY

Date: 2026-11-22
Status: Complete locally. Not deployed.

## Implemented

### Centralized, decimal-safe fee snapshot

The existing integer-centavo, half-up 5% calculator in `functions/revenue.js` was retained and extended. `buildFeeSnapshot` now creates a versioned, immutable service-fee obligation that includes:

- task, employer, and selected-worker IDs
- final agreed worker wage in PHP and centavos
- applied basis points, exact fee, and total employer obligation
- PHP currency and the configured GCash destination snapshot
- `pending_payment` status and obligation creation timestamp
- an initial structured audit-history entry

No worker wage is deducted or merged into the platform-fee record. `payments/{taskId}` remains the worker-payment record; `platformFees/{taskId}` remains the separate platform-revenue obligation.

### Fee creation moved to trusted worker selection

The trusted worker-selection transactions in both `admin-api/server.js` and `functions/index.js` now:

1. Resolve the final agreed amount from the fixed wage or selected bid.
2. Read the platform-revenue configuration and fee document in the same transaction.
3. Create `platformFees/{taskId}` exactly once when configuration is active and the task was created on or after the configuration activation time.
4. Persist a privileged audit-log event for the obligation.

The task ID is the fee document ID and the transaction checks for an existing document before `create`, preventing duplicate obligations from retries or repeated actions.

Historical tasks remain compatible: tasks created before the revenue configuration activation timestamp do not receive a new fee. Unconfigured destinations also do not create an obligation, so users are not trapped in a payment process with no settlement path.

### Removed post-completion fee creation

The old post-completion `ensurePlatformFee` path can no longer create a fee for a finished task. It now returns the existing obligation when present and otherwise explains that historical tasks are not charged retroactively.

The deployed-named Firebase trigger `createPlatformFeeOnCompletedTask` was retained by name to avoid an unsafe function-removal deployment. Its behavior no longer creates a fee after completion. It now handles cancellation safety for an existing fee:

- `pending_payment` or rejected obligations become `cancelled`.
- submitted or verified obligations become `refund_pending` and retain all proof/audit history.
- no cancellation state is counted as collected revenue.

No refund or credit is fabricated; a later authorized policy/workflow is required to resolve `refund_pending`.

### Audit history and trusted review data

Platform-fee submission and review now append structured history entries to the fee record while retaining the existing immutable `auditLogs` records. The status type now supports `cancelled`, `refund_pending`, and `credited` states for safe future handling.

### Direct-client acceptance bypass removed

The Firestore rule that previously let an employer atomically write the `Applied → Accepted` transition from a client was removed. The live app already uses the authenticated Render acceptance endpoint; that trusted transaction is now the only path that can select a worker and create the fee snapshot together.

The corresponding Firestore rule test now asserts that a direct client-side selection attempt is denied.

## Files modified

- `functions/revenue.js`
- `functions/revenue.test.js`
- `functions/index.js`
- `admin-api/server.js`
- `src/types.ts`
- `firestore.rules`
- `tests/firestore.rules.test.cjs`
- `FINAL-DEFENSE/PAYMENT-REVISION/PHASE-1-REVENUE-FOUNDATION.md`

## Reused and preserved

- Existing 5% basis-point configuration and exact centavo rounding.
- Existing fixed-price and bidding final-wage selection.
- Separate worker Cash/GCash payment records and workflows.
- Existing private platform-fee receipt storage and trusted staff review interfaces.
- Existing Firebase custom-claim authorization, Firestore server-only fee writes, audit logs, notifications, task lifecycle, matching, chat, and verification features.
- Existing uncommitted user documents were not modified.

## Tests executed

| Command | Result |
| --- | --- |
| `node --check admin-api/server.js` | Passed. |
| `node --check functions/index.js` | Passed. |
| `npm.cmd --prefix functions test` | Passed: 33 tests, including new fee snapshot, historical-compatibility, and duplicate-guard cases. |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run test:workflow` | Passed: 100 tests. |
| `npm.cmd --prefix admin-api test` | Passed: 4 tests. |
| `npm.cmd run build:web` | Passed. |
| `npm.cmd run test:rules` | Blocked before assertions because no Firestore/Storage emulator host was configured. This is not reported as a rules pass. |

## Regressions

No application, worker-payment, OTP, matching, or UI regression was found in the executed checks.

The direct client Firestore acceptance path is intentionally no longer permitted. The supported app flow already uses the trusted API; this closes the financial-authority bypass required for the new service-fee obligation.

## Known limitation / blocker

The local Firestore/Storage emulator must be started to execute the changed rules test. The Phase 1 rule assertion has been updated but has not been emulator-validated in this environment.

## Deferred to later phases

- Employer fee breakdown and payment action immediately after selection (Phase 2).
- Dedicated admin platform-fee queue and payment-review UI (Phase 3).
- New-task posting restriction, pre-start gate, and final platform-fee completion gate (Phase 4).
- Four-digit Cash mutual-confirmation PIN (Phase 5).
- GCash regression flow, analytics, and final end-to-end verification (Phases 6–8).

## Approval required

Phase 1 is complete. Do not proceed automatically. The next phase is **Phase 2 — Employer Payment Breakdown and Worker Selection UI**.
