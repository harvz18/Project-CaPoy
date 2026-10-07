# Phase 7: Category Budget Allocation

Phase 7 replaces the three-label budget-priority picker with monetary allocations for each
planning category. It does not change service quotes, bookings, payments, or the immutable
financial snapshots introduced in Phases 5 and 6.

## Client experience

- The client enters one total event budget.
- Venue, catering, photography/video, florist/styling, sound and lights, host/emcee,
  attire/gown rental, and event coordinator each have a slider and an exact amount input.
- Allocated Budget and Remaining Budget update immediately.
- A category can only use its current allocation plus the unallocated remainder, so the UI
  cannot overspend the event budget.
- The three largest non-zero allocations remain available as compatibility priorities for
  existing planning code.
- Existing label-only priorities are shown as legacy hints until the client saves monetary
  allocations.

## Coordinator handling

When an event already has a pending or accepted coordinator, the customer-facing coordinator
price is the minimum Event Coordinator allocation. The server calculates the same amount from
the snapshotted provider fee plus the configured platform commission.

A coordinator package does not add the coordinator fee again. Its marketplace services keep
their own category costs, while the Event Coordinator category reserves exactly one coordination
fee.

## Database behavior

Apply [`58_budget_allocation_revision.sql`](../database/58_budget_allocation_revision.sql) after
migration 57.

The migration adds the following nullable columns so historical rows remain valid:

- `category_key`
- `allocated_amount`
- `allocation_version`

New rows use `allocation_version = 'phase7-v1'`. The
`save_my_event_budget_allocations` RPC locks the owned event and atomically:

1. validates category keys, uniqueness, non-negative amounts, and the total;
2. validates the one required coordinator reservation, if applicable;
3. replaces only Phase 7 rows and obsolete label-only priority rows;
4. updates `events.total_budget`; and
5. inserts the new category allocations.

Database triggers also prevent a Phase 7 row from pushing allocations over the event total and
prevent direct event-budget reductions below already saved allocations.

## Safe verification

1. Apply migrations 53 through 58 in numeric order.
2. Open an existing client event without a coordinator and allocate several categories.
3. Confirm the live allocated amount never exceeds the total and reload the app to verify the
   amounts are restored.
4. Select a coordinator, return to Budget, and confirm Event Coordinator cannot be reduced below
   the committed customer-facing price.
5. Select a coordinator package and confirm the coordination fee appears only once; package
   services remain separate selections.
6. Try lowering the total below the saved allocations and confirm the app clamps discretionary
   categories or asks for a higher total when the coordinator commitment alone does not fit.
7. Confirm existing bookings, payment amounts, held balances, and provider earnings did not
   change.

