# Phase 6: Payment Hold and Provider Acceptance

Phase 6 connects the Phase 5 payment snapshot to each provider's individual booking decision.
Apply `database/57_payment_hold_provider_acceptance.sql` after
`database/56_payment_revenue_revision.sql`.

## Financial behavior

- A paid or verified Phase 5 payment remains in MULTIVENT custody while its booking request is pending.
- A provider can respond only to a booking owned by that provider account.
- Acceptance and the ledger transition run in one database transaction.
- Acceptance credits at most the snapshotted 30% initial provider allocation to the provider's internal MULTIVENT balance.
- The transition does not update `amount_released`; an internal credit is not an external bank or e-wallet transfer.
- A rejection credits nothing. Its allocation stays held for the replacement or refund workflow and is not recognized as platform revenue.
- The coordinator acceptance flow applies the same held-to-internal-balance rule to a paid coordinator-service request.
- Multiple retries or recognized payment rows cannot credit the same booking's initial share twice.
- Phase 6 does not create a final payment or release the remaining 70%. That amount stays separately visible as held or receivable until a later, explicit final-payment workflow satisfies its conditions.

## Provider workflow

The provider app now answers booking requests through `respond_to_provider_booking`. Direct Phase 5 transitions from `requested` to `confirmed` or `rejected` are rejected so the booking and ledger cannot drift apart.

The Payouts & Earnings screen includes payment-confirmation cards showing:

- event and service;
- immutable service amount;
- initial provider share;
- amount held by MULTIVENT;
- amount credited to the internal balance;
- remaining service balance;
- payment, acceptance, balance, payout-eligibility, and event states.

The existing payout request workflow remains authoritative. Its balance validation reserves requested, processing, and paid requests so an internal balance cannot be requested twice.

## Ledger states

`financial_transactions.provider_funds_status` separates custody from payment and payout status:

- `awaiting_provider_acceptance`
- `initial_share_credited`
- `rejected_held`
- `refunded`
- `legacy` for records outside the versioned Phase 5/6 model

`provider_credited_at` records when the accepted initial share became an internal provider balance. The ledger metadata also preserves the service amount, initial share, remaining balance, release condition, and confirmation timestamp.

## Compatibility

- Existing historical ledger rows stay `legacy` and are not recalculated.
- Existing RPC signatures used by coordinator screens are preserved.
- Existing provider payout account and payout-request tables remain in use.
- Existing event progress triggers still determine whether an event is partially or fully confirmed.
- Marketplace price edits do not alter booking, payment, or ledger snapshots.

## Verification checklist

1. Pay the initial amount for an event with at least two services.
2. Confirm both provider allocations are held and neither is withdrawable.
3. Accept one provider request and verify only that booking's 30% share becomes available.
4. Confirm the other booking remains held and the event remains in booking/partially confirmed state.
5. Reject the other request and verify its allocation is not credited or counted as MULTIVENT revenue.
6. Request a payout and verify a second request cannot exceed the remaining available balance.
7. Confirm the payment cards continue to show the original price after editing the current service listing.
8. Confirm no final-payment ledger entry appears merely because a provider or event is marked completed.
