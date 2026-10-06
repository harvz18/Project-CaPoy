# Phase 1 — Coordinator Marketplace

## Status

Implemented for MULTIVENT Revision 2.

Phase 1 changes Event Coordinators from automatically assigned MULTIVENT staff into optional, paid service providers selected by clients. Existing coordinator assignments and their history are preserved by the additive migration.

## Client flow

After saving the event budget and before choosing the first regular service, the client sees two explicit choices:

- **Browse coordinators** — opens Event Organizer listings with each coordinator's per-event fee, profile, specializations, reviews, and availability for the current event schedule.
- **Continue without coordinator** — saves the choice and continues to regular service selection.

Selecting a coordinator sends a booking request. Event access remains locked until the coordinator accepts. If the request is rejected or removed, the client may choose another coordinator or continue without one.

The snapshotted coordinator fee is included in the selected-services total and remaining-budget calculation. The later held-payment, platform-fee, provider-balance, and payout rules remain intentionally deferred to Revision 2 Phases 5 and 6.

## Coordinator flow

The coordinator workspace now includes a service-profile action. Coordinators configure:

- a positive per-event coordination fee;
- a public description;
- up to 12 specializations; and
- whether they are accepting booking requests.

Pending items are presented as paid booking requests with the agreed fee. Accepting a request unlocks the existing event, provider, instruction, conversation, and task tools. Rejecting a request does not trigger automatic rematching.

## Database migration

Apply [`database/53_coordinator_marketplace.sql`](../database/53_coordinator_marketplace.sql) after migration 52.

The migration:

- creates `coordinator_service_profiles`;
- adds coordinator preference and immutable pricing-snapshot fields to `events`;
- adds secure profile, catalog, preference, request, response, and removal RPCs;
- disables automatic assignment, retry, and availability/account-status rematching triggers;
- disables the legacy staff-assignment and retry RPC behavior;
- retains existing accepted and pending assignments; and
- keeps the old unassigned-events RPC shape as an empty compatibility endpoint for older web-console builds.

## Phase boundary

This phase does not change the current service-payment capture, commission percentage, provider balance, payout, or refund implementation. Those changes depend on the unified held-payment ledger specified in later phases and should not be partially introduced here.

## Verification

Run:

```bash
npm run typecheck
npm run lint
```

Manual checks after applying migration 53:

1. Configure a coordinator service profile and enable booking requests.
2. Create a client event, set a budget, and verify the coordinator choice appears first.
3. Verify skipping proceeds to regular services without a coordinator.
4. Verify browsing shows the fee and event-specific availability.
5. Send a request and verify its fee is included in the plan total.
6. Accept and reject requests from the coordinator workspace.
7. Confirm rejection does not automatically select another coordinator.
8. Confirm existing accepted coordinator events still open in the coordinator workspace.
