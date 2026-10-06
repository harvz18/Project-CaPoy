# Phase 5: Payment and Revenue Revision

Phase 5 changes the active MULTIVENT financial model without rewriting completed or in-progress transactions.

## Financial model

For a provider service subtotal `S`:

- Platform fee: `S × 5%`
- Client total: `S + platform fee`
- Initial client payment: `S × 40%`
- Initial provider allocation: `S × 30%`
- Held/unallocated remainder: `initial payment − provider allocation − platform fee`
- Provider service balance after an initial payment: `S − provider allocation`

For example, a `PHP 100,000` service subtotal produces a `PHP 5,000` platform fee, a `PHP 105,000` client total, and a `PHP 40,000` initial payment. That payment contains a `PHP 30,000` provider allocation, the `PHP 5,000` platform fee, and `PHP 5,000` held separately. The held remainder is not platform revenue.

## Implementation

Migration [`database/56_payment_revenue_revision.sql`](../database/56_payment_revenue_revision.sql):

- stores the 5%, 40%, and 30% rates in system settings;
- versions and snapshots the terms on new bookings and payments;
- recalculates Phase 5 payments from the booking snapshot in a database trigger;
- records provider-held and unallocated-held amounts separately in the financial ledger;
- applies the same versioned fee and hold model to the event coordinator's snapshotted fee without treating coordinators as provider-owned marketplace services;
- leaves the provider allocation unreleased until the provider-acceptance workflow is implemented in Phase 6;
- reprices only editable `selected` service selections, never requested, paid, completed, cancelled, or declined work; and
- does not backfill historical bookings, payments, or financial transactions.

The mobile client uses `src/lib/pricing.ts` as its central decimal-safe calculation module. The database trigger remains authoritative and replaces client-supplied financial fields before a Phase 5 payment is stored.

## Apply order

Apply the migrations in this order:

1. `53_coordinator_marketplace.sql`
2. `54_coordinator_packages.sql`
3. `55_catering_pricing_revision.sql`
4. `56_payment_revenue_revision.sql`

Run each file as a complete transaction. Do not rerun migration 40 after migration 56 because migration 40 installs the older payment-ledger trigger definition.

## Phase boundary

Phase 5 records the provider allocation as held and sets `amount_released` to zero. Provider acceptance, release, rejection, refund, payout, and earnings transitions belong to Phase 6 and are intentionally not implemented here.

