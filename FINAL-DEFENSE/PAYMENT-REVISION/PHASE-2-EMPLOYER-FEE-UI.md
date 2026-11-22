# PHASE 2 — EMPLOYER PAYMENT BREAKDOWN AND WORKER SELECTION

## Scope completed

Phase 2 is complete locally. It reuses the Phase 1 `platformFees/{taskId}` snapshot that is created transactionally when an employer accepts a tasker's application. No deployment, migration, fee collection change, or task-progression restriction was performed.

## Employer posting breakdown

`app/post-task.tsx` continues to show the fixed-price estimate using the configured rate (5% by default):

- Worker wage
- TASKLINK service fee
- Total employer obligation

The notice now states: “The TASKLINK service fee is payable after selecting a worker.” Bidding tasks continue to wait for the accepted offer before an exact amount is available.

## Selection handoff and fee panel

The established selection route remains unchanged:

1. Employer accepts an active applicant from Task Details.
2. The trusted API resolves the agreed wage and Phase 1 creates the single fee snapshot.
3. The app opens the existing task-status screen.
4. That screen now subscribes to the employer-readable fee snapshot and shows a compact TASKLINK Service Fee panel.

The panel displays:

- selected tasker;
- final agreed wage;
- exact service fee and applied percentage;
- total employer obligation;
- clear fee status; and
- **Pay TASKLINK Fee** while payment is required, or **View TASKLINK Fee** once it is no longer actionable.

The payment action opens the existing platform-fee screen. Worker wages remain explicitly separate from the platform fee.

## Preserved behavior and phase boundary

- Existing posting form, budget validation, bidding, applications, worker selection, matching, notifications, worker cash/GCash payment, and task-status UI remain in place.
- The fee summary is read-only from the client and uses the existing employer-only Firestore access rule.
- No direct client financial authorization was added.
- No active-work, completion, or new-task posting gate was added. Those restrictions belong to Phase 4 and were intentionally left unchanged.
- No deployment was performed.

## Validation

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run test:workflow` | Passed — 100 tests |
| `npm.cmd run build:web` | Passed |
| `git diff --check` | Passed (line-ending warnings only) |

## Files changed in this phase

- `app/post-task.tsx`
- `app/task-status/[id].tsx`
- `FINAL-DEFENSE/PAYMENT-REVISION/PHASE-2-EMPLOYER-FEE-UI.md`

## Next phase

Phase 3 may extend the existing platform-fee payment screen and authorized admin review flow only after explicit approval.
