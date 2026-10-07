# Phase 8: Budget-Aware Recommendations

Phase 8 uses the client’s Phase 7 category allocations to rank marketplace services for the
current event. It is a read-only recommendation layer: it does not change provider prices,
service selections, bookings, payments, or historical financial snapshots.

## Recommendation inputs

The database evaluates each active service using:

- its matching Phase 7 category allocation;
- the customer-facing amount after the configured platform commission;
- the event guest count for per-person services;
- the cheapest valid catering option that supports the event guest count;
- the provider’s date-specific availability and operating hours;
- active booking conflicts on the event date; and
- active service, category, provider, and account status.

If the event date or time is incomplete, a service may still be recommended for its budget fit,
but the result explicitly says that schedule availability still needs verification.

## Catering calculations

Catering is compared using the calculated event total, never only the displayed per-head rate:

```text
provider price per head × event guests × (1 + platform commission)
```

Only options whose minimum and maximum guest limits support the event are considered. The
lowest-priced supporting option is used for recommendation ranking and shown on the catalog card.
The client still makes the final explicit menu choice on the service details screen.

## Catalog behavior

When the selected category has a non-zero allocation, planning results are divided into:

1. **Recommended Within Budget**
2. **Over Budget or Needs Review**

Each card shows the category budget, calculated event estimate, recommendation explanation, and
the fitting catering option when relevant. Over-budget and currently unavailable services remain
visible so the client can compare them or revise the plan.

If no budget is allocated to a category, the existing rating and guest-fit ordering remains in
place and no misleading budget badge is displayed.

## Database migration

Apply [`59_budget_aware_recommendations.sql`](../database/59_budget_aware_recommendations.sql)
after migration 58. It installs the read-only
`list_my_budget_aware_service_recommendations` RPC. The RPC only returns recommendations for the
signed-in client’s requested or most recently updated active event.

## Safe verification

1. Apply migrations 53 through 59 in numeric order.
2. Allocate a category budget and browse that category from the planning flow.
3. Confirm fitting services appear first and over-budget services remain visible in the review
   section.
4. For catering, change the event guest count and confirm the displayed event estimate uses a
   supporting option’s per-head price multiplied by the new guest count.
5. Create an availability block or conflicting provider booking and confirm the service moves to
   Needs Review with an availability explanation.
6. Remove a category allocation and confirm normal catalog ordering returns without a budget-fit
   badge.
7. Confirm existing selections, booking amounts, payments, held balances, and earnings are
   unchanged.

