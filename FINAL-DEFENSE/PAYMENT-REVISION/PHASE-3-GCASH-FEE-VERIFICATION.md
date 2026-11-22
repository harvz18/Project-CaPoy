# PHASE 3 — TASKLINK GCASH FEE COLLECTION AND ADMIN VERIFICATION

## Scope completed

Phase 3 is complete locally. It extends the existing, separately classified TASKLINK fee flow created in Phases 1 and 2. No payment gateway, automatic GCash verification, paid service, deployment, migration, or Phase 4 task restriction was introduced.

## Superadmin-controlled destination

The existing Superadmin revenue configuration remains the only supported way to set the platform GCash destination. It now supports:

- account name;
- GCash number;
- 5% rate and instructions; and
- an optional HTTPS QR-image URL.

Both the Render Admin API and mirrored Firebase callable configuration endpoint validate the optional QR value as HTTPS only. When a tasker is selected, the resulting fee snapshot stores the destination details, including the optional QR URL, so later configuration changes do not rewrite an existing obligation.

No real GCash account or QR value is hardcoded.

## Employer service-fee payment screen

`app/platform-fee/[id].tsx` now presents the complete, compact employer payment flow:

- task title and selected tasker;
- final agreed wage, exact service fee, and total obligation;
- platform GCash account name and copyable GCash number;
- optional configured QR image;
- configuration instructions;
- clear fee status and rejection reason; and
- secure receipt upload and GCash-reference submission while payment is actionable.

The screen uses the existing private Firestore receipt-chunk path. The receipt is still required before submission; it is not shared publicly. The obsolete attempt to create a fee when this screen opened was removed because Phase 1 now creates it authoritatively at worker selection.

## Admin review and manual verification

The existing separate Admin Portal payment-review module already contains a clearly labeled **TASKLINK service-fee review** section. It lists the employer and task, worker wage, expected fee, submitted GCash reference, private receipt, submission time, and Verify/Reject actions.

The existing trusted `reviewPlatformFee` route is preserved:

- only an authenticated Admin or Superadmin can review;
- only `submitted_for_review` fee records can be decided;
- verification records the collected amount, reviewer, timestamp, audit event, and employer notification;
- rejection requires a reason and returns the obligation to a resubmittable state; and
- the employer and tasker cannot directly write or approve fee records.

Verification continues to mean an authorized staff member has manually checked the payment against TASKLINK's actual GCash records. A screenshot or reference never auto-verifies a payment.

## Security and compatibility

- `platformFees` remain read-only to the owning employer and administrators in Firestore; writes go through trusted backend logic only.
- Service-fee receipts remain restricted to the employer and authorized administrators.
- Worker cash and worker GCash payment paths were not changed.
- No real payment processor, automatic collection, or claim of external GCash confirmation was added.
- Phase 4 gates (new-task restriction, active-work prerequisite, and completion prerequisite) remain intentionally out of scope.

## Validation

| Check | Result |
| --- | --- |
| `node --check admin-api/server.js` | Passed |
| `node --check functions/index.js` | Passed |
| `npm.cmd --prefix functions test` | Passed — 34 tests |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd --prefix admin-portal run build` | Passed |

## Files changed in this phase

- `functions/revenue.js`
- `functions/revenue.test.js`
- `functions/index.js`
- `admin-api/server.js`
- `src/types.ts`
- `src/services/platformRevenueService.ts`
- `app/superadmin.tsx`
- `app/platform-fee/[id].tsx`
- `admin-portal/src/main.tsx`
- `FINAL-DEFENSE/PAYMENT-REVISION/PHASE-3-GCASH-FEE-VERIFICATION.md`

## Next phase

Phase 4 may add the server-enforced employer posting restriction and fee-verification progression gates only after explicit approval.
