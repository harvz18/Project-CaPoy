# Phase 5: Payment and Revenue Revision

Phase 5 changes the active MULTIVENT financial model without rewriting completed or in-progress transactions. Migration 65 corrects the active downpayment from 40% to 35% while retaining immutable historical payment snapshots.

## Financial model

For a provider service subtotal `S`:

- MULTIVENT platform fee: `round(S × 5%, 2)`
- Provider downpayment allocation: `round(S × 30%, 2)`
- Required client downpayment: `provider downpayment allocation + MULTIVENT platform fee`
- Client's complete quoted obligation: `S + platform fee`
- Held/unallocated remainder: `0` under the corrected model
- Provider's directly collectible balance: `S − provider downpayment allocation` (nominally 70%)

For example, a `PHP 100,000` service subtotal produces a `PHP 5,000` platform fee, a `PHP 105,000` complete client obligation, and a `PHP 35,000` downpayment. That downpayment contains the complete `PHP 30,000` provider allocation and `PHP 5,000` MULTIVENT fee. The provider collects the remaining `PHP 70,000` directly from the client before or after the event; MULTIVENT does not collect or recognize it as platform revenue.

## Implementation

Migration [`database/56_payment_revenue_revision.sql`](../database/56_payment_revenue_revision.sql), as corrected by [`database/65_downpayment_split_correction.sql`](../database/65_downpayment_split_correction.sql):

- stores the active 5%, 35%, and 30% rates in system settings;
- versions and snapshots the terms on new bookings and payments;
- calculates the downpayment as the sum of the independently rounded provider allocation and platform fee so neither share loses a cent;
- accepts only the required downpayment through the current application checkout;
- records the provider allocation as held while keeping the current unallocated hold at zero;
- applies the same model to the event coordinator's snapshotted fee without treating coordinators as provider-owned marketplace services;
- leaves the provider allocation unreleased until the individual provider or coordinator accepts;
- updates only unpaid `payment_required` booking drafts to the corrected rate; and
- does not rewrite paid, verified, refunded, confirmed, completed, or other historical financial snapshots.

The mobile client uses `src/lib/pricing.ts` as its central decimal-safe calculation module. The database trigger remains authoritative and replaces client-supplied financial fields before a payment is stored.

Client-facing marketplace listings show fee-inclusive prices without itemizing or announcing the internal platform markup. Checkout and authorized financial views retain the accounting breakdown needed to explain the 35% downpayment and the provider's remaining 70% balance.

## Apply order

Apply migrations 53 through 64 in numerical order, then apply `65_downpayment_split_correction.sql` as a complete transaction.

Do not rerun migration 40 after the later financial migrations because migration 40 installs the older payment-ledger trigger definition.

## Phase boundary

The provider's 30% allocation remains held with `amount_released = 0` until Phase 6 acceptance credits it to the provider's internal balance. The remaining 70% is an offline receivable between the client and provider and is never recorded as MULTIVENT revenue.
