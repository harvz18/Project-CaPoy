-- A provider/coordinator acceptance records a paid allocation as a held
-- receivable. It must remain distinct from the later payout-eligibility
-- release, while still being permitted by the Phase 11 ledger guard.
--
-- The helpers are security-definer functions reached only by the protected
-- acceptance RPCs. The transaction-local flag authorizes this internal
-- awaiting-acceptance -> held-receivable transition; neither helper can make
-- money available for payout or alter the held amount.

begin;

create or replace function public.hold_phase11_provider_receivable(
  target_booking_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  event_date_value date;
  held_amount numeric(12,2);
begin
  perform set_config('app.phase11_receivable_release_authorized', 'true', true);

  select booking.* into booking_row
  from public.bookings booking
  where booking.id = target_booking_id
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking financial snapshot not found.';
  end if;

  select event.event_date into event_date_value
  from public.events event
  where event.id = booking_row.event_id;

  update public.financial_transactions ledger
  set provider_funds_status = 'held_receivable',
      receivable_accepted_at = coalesce(ledger.receivable_accepted_at, now()),
      payout_eligible_on = coalesce(ledger.payout_eligible_on, event_date_value - 14),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'receivable_state', 'held_receivable',
        'receivable_accepted_at', coalesce(ledger.receivable_accepted_at, now()),
        'payout_eligible_on', case when coalesce(ledger.payout_eligible_on, event_date_value - 14) is null
          then null else coalesce(ledger.payout_eligible_on, event_date_value - 14)::text end,
        'provider_release', false,
        'release_condition', '14_day_payout_window'
      ),
      updated_at = now()
  where ledger.booking_id = booking_row.id
    and ledger.provider_id = booking_row.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.held_provider_amount > 0
    and ledger.provider_net_amount = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  select coalesce(sum(ledger.held_provider_amount), 0)
  into held_amount
  from public.financial_transactions ledger
  where ledger.booking_id = booking_row.id
    and ledger.provider_id = booking_row.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status = 'held_receivable';

  return held_amount;
end;
$$;

create or replace function public.hold_phase11_coordinator_receivable(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  held_amount numeric(12,2);
begin
  perform set_config('app.phase11_receivable_release_authorized', 'true', true);

  select * into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Coordinator event financial snapshot not found.';
  end if;

  update public.financial_transactions ledger
  set provider_funds_status = 'held_receivable',
      receivable_accepted_at = coalesce(ledger.receivable_accepted_at, now()),
      payout_eligible_on = coalesce(ledger.payout_eligible_on, event_row.event_date - 14),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'receivable_state', 'held_receivable',
        'receivable_accepted_at', coalesce(ledger.receivable_accepted_at, now()),
        'payout_eligible_on', case when coalesce(ledger.payout_eligible_on, event_row.event_date - 14) is null
          then null else coalesce(ledger.payout_eligible_on, event_row.event_date - 14)::text end,
        'provider_release', false,
        'release_condition', '14_day_payout_window'
      ),
      updated_at = now()
  where ledger.event_id = event_row.id
    and ledger.coordinator_id = target_coordinator_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.held_provider_amount > 0
    and ledger.provider_net_amount = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  select coalesce(sum(ledger.held_provider_amount), 0)
  into held_amount
  from public.financial_transactions ledger
  where ledger.event_id = event_row.id
    and ledger.coordinator_id = target_coordinator_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status = 'held_receivable';

  return held_amount;
end;
$$;

revoke all on function public.hold_phase11_provider_receivable(uuid) from public;
revoke all on function public.hold_phase11_coordinator_receivable(uuid, uuid) from public;

commit;
