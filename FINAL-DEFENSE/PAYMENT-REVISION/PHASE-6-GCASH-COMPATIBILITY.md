# Phase 6 — GCash Worker-Payment Compatibility

## Result

The existing direct GCash worker-payment workflow is preserved. The employer's full agreed task wage and TaskLink's separate 5% platform-fee record remain distinct throughout the UI, data model, and task-completion checks.

## Preserved workflow

- The assigned tasker saves a private GCash mobile number and optional GCash QR details when submitting an in-progress task for approval.
- The employer uses **Pay Now** to pay the full agreed wage directly to that tasker, then may provide a reference or receipt image before confirming payment sent.
- The assigned tasker can acknowledge receipt or report that the payment was not received.
- Existing participant notifications and payment-status transitions remain unchanged.
- The tasker's GCash recipient details and payment proof remain limited to the task participants under Firestore rules.

## Separation and completion controls

- The tasker-payment record is the direct GCash wage payment (`payments/{taskId}`); it is not the TaskLink service fee.
- The separate TaskLink fee is tracked as `platformFees/{taskId}` and is shown independently to the employer.
- The GCash payment section now explicitly tells the employer that it covers the tasker's full agreed wage and that any TaskLink 5% service fee is separate.
- A task cannot be marked **Finished** until the assigned tasker has verified the direct wage payment. When a platform fee applies, the existing verified-fee prerequisite also remains in force.

## Changes made in this phase

- Added the wage-versus-platform-fee clarification to the existing GCash payment UI.
- Added a workflow assertion confirming a verified GCash payment permits the normal final transition.
- Added Firestore emulator regression coverage for recipient-detail submission, employer confirmation, unauthorized confirmation rejection, and assigned-tasker receipt confirmation.
- The core GCash payment services and their established notification behavior were intentionally not rewritten.

## Validation completed

All checks passed locally:

- `npm.cmd run typecheck`
- `npm.cmd run test:workflow` — 100 passing
- `npm.cmd --prefix functions test` — 38 passing
- `npm.cmd --prefix admin-api test` — 4 passing
- `npm.cmd run build:web`
- Firebase Auth, Firestore, and Storage emulator rules — 54 passing
- `git diff --check`

No deployment, production data change, or payment-gateway transaction was performed in this phase.
