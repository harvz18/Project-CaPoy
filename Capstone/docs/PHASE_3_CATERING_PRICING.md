# Phase 3: Catering Pricing Revision

Phase 3 replaces manually entered catering attendee/budget values with provider-defined menu
options calculated from the event's **Expected / Anticipated Guests**.

## Delivered behavior

- Catering providers can create multiple options. Each option has a stable ID, name, per-head
  provider price, minimum/maximum guests, and menu sections/items.
- The lowest option price remains the service's catalog starting price; the selected option is
  the price used for an event.
- Clients see every configured menu option, its guest range, per-head client price, menu, and
  calculated event subtotal.
- Options outside the event guest range are visibly unavailable. Matching services are ranked
  before non-matching services in catering results, and catering filters use option prices.
- Manual selections and coordinator packages use the same database pricing function,
  `calculate_event_service_price`.
- The selected option, menu, per-head price, guest count, provider subtotal, and client amount
  are snapshotted on the event selection and copied to the booking.
- The Outside Food control is removed from provider/client UI. The legacy `outside_food` column
  is retained and new selections write `false`, avoiding a destructive data migration.

## Database installation

Apply migrations in this order:

1. `53_coordinator_marketplace.sql`
2. `54_coordinator_packages.sql`
3. `55_catering_pricing_revision.sql`

Migration 55 is additive. Existing per-person catering listings remain readable through the
legacy single-option adapter. Editing and republishing a catering service requires converting it
to at least one Phase 3 menu/pricing option.

## Pricing example

For a 100-guest event and a provider option priced at PHP 400 per head:

```text
Provider subtotal = 100 × PHP 400 = PHP 40,000
Client total       = provider subtotal + current MULTIVENT commission
```

Currency values are rounded to two decimal places by the central database function.
