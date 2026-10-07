# Phase 9: Service Selection Revision

Phase 9 makes service selection category-aware and moves selection pricing and replacement rules
into database transactions. It extends the Phase 8 catalog without changing historical bookings
or payment snapshots.

## Client selection behavior

- The catalog shows common filters for budget fit, availability, rating, and price.
- Venue, catering, photography, and host categories show only their relevant structured filters.
- The selected category allocation is adjustable above the results and remains synchronized with
  the Phase 7 allocation table.
- Selecting another service in an occupied category requires replacement confirmation.
- The database permits only one active service per category for an event.
- A selected service locks its category allocation to the authoritative customer amount. Removing
  it unlocks the category and returns that amount to the unallocated event budget.
- Coordinator packages detect category conflicts and require confirmation before replacing an
  unsubmitted selection. Packages containing duplicate categories are rejected.
- Coordinator-package line items recalculate chosen catering and venue amounts and show whether
  each item fits its synchronized category budget before confirmation.

## Venue options and duration

The venue details screen exposes only provider-defined spaces and expandable combinations. Each
option shows its capacity, area, and indoor/outdoor type alongside the listing's amenities,
quantities, inclusions, operating hours, and setup allowance.

Clients must choose one option and a valid duration. The server:

- validates minimum, maximum, and increment rules;
- derives the event end time;
- includes setup/ingress time in operating-hour and overlap checks;
- charges setup time only when the provider explicitly marks it billable;
- rejects insufficient capacity, removed options, unavailable windows, and overlapping resources;
- applies hourly pricing to billed hours and keeps fixed/event pricing fixed; and
- snapshots option resources, rules, booked hours, start/end times, and provider/customer amounts.

Provider listing fields now include minimum and optional maximum booking hours, duration
increments, and whether setup/ingress time is billable.

## Authoritative pricing and checkout

`calculate_event_service_quote` is the Phase 9 pricing contract. It returns provider subtotal,
platform fee, customer total, initial client payment, initial provider share, and remaining
provider balance using currency precision. Catering and venue selections use the same contract.

Checkout calls `validate_my_phase9_selections` before booking rows are created. This catches event
date/time changes, removed venue options, capacity changes, operating-hour overflow, and new
booking conflicts. Existing selection and booking snapshots are never silently repriced.

## Database migration

Apply [`60_service_selection_revision.sql`](../database/60_service_selection_revision.sql) after
migration 59. It is additive: it adds venue snapshot/window columns, category lock metadata,
transactional selection/budget/package RPCs, and integrity triggers.

## Safe verification

1. Apply migrations 53 through 60 in numeric order.
2. Adjust a category budget from the catalog and confirm the Budget Allocation screen reloads the
   same value.
3. Select a service, confirm its category budget locks to the calculated amount, then remove it and
   confirm the allocation unlocks.
4. Select a second service from the same category and verify the replacement prompt appears and no
   duplicate active selection is created.
5. For a venue, test a capacity mismatch, invalid duration increment, operating-hour overflow, and
   an overlapping confirmed booking.
6. Confirm hourly venue pricing uses booked hours and only bills setup time when configured.
7. Change the event date/time after selecting a venue and verify checkout revalidates the snapshot.
8. Choose a coordinator package with a category conflict and verify replacement requires explicit
   confirmation.
9. Confirm existing paid bookings and financial transactions remain unchanged.

