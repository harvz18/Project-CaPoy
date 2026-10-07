# Phase 10: Regression and Integration Check

Phase 10 adds no business feature and no database migration. It verifies that the Phase 1–9
contracts remain connected, preserves existing behavior, and identifies the tests that still need
authenticated staging accounts or deployed infrastructure.

## Automated regression coverage

Run:

```bash
npm run test:phase10
npm run typecheck
npm run lint
npm run build:web
```

`npm run test:phase10` uses Node's built-in test runner and introduces no test-framework
dependency. The suite covers:

- the canonical 5% platform fee, 40% initial payment, and 30% provider allocation;
- cent-safe rounding, multiple providers, invalid rate fallback, and non-negative amounts;
- ordered, transactional, additive migrations 53–60 with no `DROP TABLE` or `TRUNCATE`;
- coordinator skip, booking, accept/reject, package references, and independent provider review;
- catering option, per-head, minimum guest, maximum guest, and snapshot contracts;
- category allocation, over-allocation protection, selection lock/unlock, replacement, and checkout
  validation contracts;
- package duplicate-category, manual-selection conflict, dynamic catering/venue, and event-budget
  contracts;
- venue option, duration, capacity, operating-hour, overlap, and immutable booking snapshots;
- payment, held funds, provider/coordinator response, balances, payout requests, and historical
  snapshot protection;
- presence of authentication, account, listing, image, availability, booking, review, notification,
  staff, and sentiment-integration modules; and
- the explicit demo-payment boundary so the repository cannot be reported as a confirmed live
  PayMongo integration.

## Automated result recorded on October 8, 2026

| Check | Result | Evidence |
| --- | --- | --- |
| Phase 10 regression tests | Passed: 16/16 | `tests/phase10/*.test.ts` |
| TypeScript strict type check | Passed | `npm run typecheck` |
| ESLint, zero warnings permitted | Passed | `npm run lint` |
| Expo production web export | Passed | `npm run build:web` |
| Web bundle generated | Passed | Expo exported `dist`; main JavaScript bundle approximately 2.5 MB |

The generated `dist` directory is ignored by Git and is not part of this phase's source changes.

## Required staging integration matrix

The following checks intentionally remain manual. They require isolated authenticated accounts,
provider listings, event records, and controlled payment/availability states. Run them against a
staging Supabase project after applying migrations 53–60 in order. Do not run destructive scenarios
against production data.

Use at least these accounts:

- one Client;
- two independent Service Providers;
- one Event Coordinator;
- one Admin;
- one Superadmin; and
- the staff roles used by the deployed permission configuration.

Record the tester, date/time, build identifier, account role, test data IDs, expected result, actual
result, and pass/fail evidence for every case.

### Coordinator

| Scenario | Expected result | Staging status |
| --- | --- | --- |
| Client skips coordinator | Planning proceeds without an assignment or coordinator fee | Pending staging execution |
| Client books coordinator | One paid pending request is created; coordinator does not gain accepted-event access yet | Pending staging execution |
| Coordinator accepts | Assignment becomes accepted and only that coordinator's eligible initial share is credited | Pending staging execution |
| Coordinator rejects | Assignment is cleared; allocation remains held for replacement/refund and is not revenue | Pending staging execution |
| Coordinator creates package | Package stores ordered references to valid provider-owned services | Pending staging execution |
| Client chooses package | Services enter the event selection and each provider retains accept/reject authority | Pending staging execution |
| Package has multiple providers | Independent requests and financial allocations remain provider-scoped | Pending staging execution |

### Catering

| Scenario | Expected result | Staging status |
| --- | --- | --- |
| Guest-based calculation | Provider per-head price is multiplied by the event guest count, then the client fee is added | Pending staging execution |
| Minimum guest validation | A guest count below the option minimum is rejected | Pending staging execution |
| Maximum guest validation | A guest count above the option maximum is rejected | Pending staging execution |
| Different menu options | Re-selecting an option recalculates and snapshots the chosen menu and amount | Pending staging execution |

### Budget and service selection

| Scenario | Expected result | Staging status |
| --- | --- | --- |
| Create allocations / move controls | Saved values reload consistently in Budget and Category Browse | Pending staging execution |
| Prevent over-allocation | Total allocations above the event budget are rejected server-side | Pending staging execution |
| Adjust from service-selection screen | The same category allocation record changes | Pending staging execution |
| Select service | The authoritative calculated customer amount is stored | Pending staging execution |
| Lock category | Allocation is replaced by the selected amount and cannot be edited directly | Pending staging execution |
| Remove service | Only an unsubmitted selection can be removed; its category unlocks | Pending staging execution |
| Replace service | Explicit confirmation replaces one unsubmitted selection without creating a duplicate | Pending staging execution |

### Packages

| Scenario | Expected result | Staging status |
| --- | --- | --- |
| Package fits budget | Every line is selected and each category locks to its calculated amount | Pending staging execution |
| Package exceeds category/event budget | Transaction fails and leaves the previous event state unchanged | Pending staging execution |
| Package conflicts with manual selection | Conflict list is returned before replacement; active requests cannot be replaced | Pending staging execution |
| Dynamic catering/venue in package | Client supplies every required menu and venue option/hour choice | Pending staging execution |

### Payment, acceptance, and payout

| Scenario | Expected result | Staging status |
| --- | --- | --- |
| 5% / 40% / 30% calculation | Platform, initial, provider, held, and remaining values reconcile exactly | Pending staging execution |
| Pending provider | Eligible provider allocation remains held and not withdrawable | Pending staging execution |
| Accepted provider | Only that provider's eligible 30% share moves to internal earned/withdrawable balance | Pending staging execution |
| Rejected provider | No provider credit occurs; funds remain held for replacement/refund | Pending staging execution |
| Provider balance | Earned, held, withdrawable, paid out, and remaining receivable are distinct | Pending staging execution |
| Payout request | Validated amount is reserved once and cannot be requested twice | Pending staging execution |

### Existing-system regression

| Area | Required check | Staging status |
| --- | --- | --- |
| Authentication/accounts | Registration, verification, login, recovery, Client and Provider routing | Pending staging execution |
| Admin/Superadmin | Permission-based navigation and allowed/denied actions | Pending staging execution |
| Services | Create, edit, category details, packages, moderation, and historical deletion protection | Pending staging execution |
| Images | Cover/gallery upload and retrieval under current storage policies | Pending staging execution |
| Availability/dates | Calendar, operating hours, service/date/time conflicts, venue resource overlap | Pending staging execution |
| Reviews/ratings | Eligible submission, rating persistence, optional sentiment job, summaries | Pending staging execution |
| Notifications/messages | Correct participants, resources, role scope, and navigation | Pending staging execution |
| Historical records | Old completed bookings/payments retain their captured rates and amounts | Pending staging execution |

## PayMongo / external payment boundary

The reviewed implementation records internal payments with a generated `demo-...` reference. No
confirmed live PayMongo API call, webhook verification, or external settlement integration exists
in the runtime code. Therefore Phase 10 can verify the internal payment, ledger, hold, acceptance,
balance, and payout-request workflow, but it cannot truthfully mark PayMongo regression testing as
passed. Live gateway implementation would require a separate approved phase, credentials, webhook
security, idempotency, reconciliation, failure handling, and sandbox evidence.

## Database and historical-data safety

- Phase 10 creates no migration `61`; migrations 53–60 remain the complete Revision 2 schema chain.
- The automated audit rejects `DROP TABLE` and `TRUNCATE` in the Revision 2 migrations.
- Historical financial rows are not backfilled to Phase 5 terms.
- Paid, verified, and refunded financial snapshots remain protected from mutation.
- Selected catering/venue/provider data is copied into selection and booking snapshots.
- Package selections reference real service records and retain event-time package snapshots.

## Phase 10 completion rule

The repository-level phase is complete when all four automated commands pass. Deployment acceptance
is complete only after the staging matrix is executed and its evidence is attached. A pending manual
row must never be reported as a passed test.
