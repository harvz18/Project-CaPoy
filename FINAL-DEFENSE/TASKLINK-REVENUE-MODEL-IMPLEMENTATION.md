# TASKLINK Revenue Model Implementation

Status: PARTIALLY COMPLETE — safe core workflow implemented; deployment and administrator dashboard validation remain required.

## Existing payment architecture

`payments/{taskId}` remains the authoritative worker-payment record. Cash and manual GCash still pay the worker directly and retain their existing statuses. The new `platformFees/{taskId}` record is separate, so neither a platform-fee receipt nor approval can prove worker payment.

## Approved model and implementation

- Employer pays the worker's full final `agreedAmount`.
- A separate employer-paid 5% fee uses integer centavos and half-up rounding.
- Fee snapshots retain wage, basis points, destination and amount; later rate changes cannot recalculate them.
- `createPlatformFeeOnCompletedTask` creates one record only when the task changes to `Finished`, worker payment is already `Verified`, revenue configuration is active, and the task was created after configuration activation. This isolates historical tasks.
- No overdue posting restriction is enabled because no approved deadline/grace policy has been configured.

## Files modified

`functions/revenue.js`, `functions/index.js`, `src/domain/platformRevenue.ts`, `src/services/platformRevenueService.ts`, `app/post-task.tsx`, `app/task-status/[id].tsx`, `app/platform-fee/[id].tsx`, receipt helpers, types and Firestore rules.

## Employer workflow

Posting shows an expected 5% fee breakdown for fixed prices. Bidding correctly states that the final agreed wage determines the fee. After eligible completion, the employer opens **Pay TASKLINK Service Fee**, uploads a private receipt, enters a reference, and submits it for review. Submission is not verification.

## Configuration and security

Superadmin mobile settings use the trusted `updatePlatformRevenueConfig` callable. It requires a destination and records an audit log. Fee records and configuration are server-write-only; employers can only read their own fee and upload the dedicated private receipt. `reviewPlatformFeePayment` is admin-only and atomically reviews only a submitted fee.

## Tests executed

- `npm test`: 95 workflow, 5 beta-preflight, 31 Function tests passed.
- `npm --prefix admin-portal run build`: passed.
- `git diff --check`: passed.

## Remaining blockers / manual work

- Deploy Firestore rules and Functions before enabling configuration; no deployment was performed.
- Firebase emulator rule tests and end-to-end device/admin verification remain required.
- The existing Admin portal has not yet been extended with a dedicated platform-fee queue or the Superadmin analytics revenue aggregates. The trusted review callable is present, but this UI/analytics work should not be claimed as demonstrated until added and tested.
- QR-image configuration and overdue enforcement remain disabled: neither can safely operate without an approved storage/deadline policy.

## Defense demonstration

1. As Superadmin, enter a non-real test GCash destination and 5% rate.
2. Complete a newly created task only after worker payment is verified.
3. Confirm one `platformFees/{taskId}` snapshot, its separate amount, and employer notification.
4. As employer, upload a receipt and submit it.
5. As Admin, invoke the protected review workflow and show that only `verified` contributes to future revenue reporting.
