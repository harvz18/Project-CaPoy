-- MULTIVENT Revision V11, Phase 3: receivable wallet views.
-- Apply after 80_payout_eligibility_release.sql.
--
-- Read-only wallet projections. These functions do not move funds, create a
-- payout, alter a booking, or change the current pricing policy.

begin;

create or replace function public.get_my_provider_receivable_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  result_payload jsonb;
begin
  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1;

  if provider_id_value is null then
    raise exception 'A service-provider account is required.' using errcode = '42501';
  end if;

  with ledger_rows as (
    select ledger.id, ledger.booking_id, ledger.event_id, ledger.provider_funds_status,
      ledger.provider_net_amount, ledger.held_provider_amount, ledger.amount_released,
      ledger.payout_eligible_on, ledger.receivable_reconciliation_required,
      ledger.transaction_at, ledger.updated_at,
      event.name as event_name, event.event_date,
      service.name as service_name
    from public.financial_transactions ledger
    join public.events event on event.id = ledger.event_id
    left join public.bookings booking on booking.id = ledger.booking_id
    left join public.services service on service.id = booking.service_id
    where ledger.provider_id = provider_id_value
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ), payout_totals as (
    select
      coalesce(sum(request.amount) filter (
        where request.status in ('requested', 'processing')
      ), 0) as pending_payouts,
      coalesce(sum(request.amount) filter (
        where request.status = 'paid'
      ), 0) as total_paid_out,
      coalesce(sum(request.amount) filter (
        where request.status in ('requested', 'processing', 'paid')
      ), 0) as reserved_or_paid
    from public.provider_payout_requests request
    where request.provider_id = provider_id_value
  ), balances as (
    select
      coalesce(sum(row.held_provider_amount) filter (
        where row.provider_funds_status in (
          'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
          'rejected_held', 'disputed_on_hold'
        )
      ), 0) as receivables,
      coalesce(sum(greatest(row.provider_net_amount - row.amount_released, 0)) filter (
        where row.provider_funds_status in (
          'legacy', 'initial_share_credited', 'available_for_payout'
        )
        and (
          row.provider_funds_status <> 'available_for_payout'
          or not coalesce(row.receivable_reconciliation_required, false)
        )
      ), 0) as eligible_before_reservations
    from ledger_rows row
  ), receivables as (
    select jsonb_build_object(
      'id', row.id,
      'bookingReference', case when row.booking_id is null then null
        else 'BK-' || upper(substr(row.booking_id::text, 1, 8)) end,
      'eventId', row.event_id,
      'eventName', coalesce(nullif(trim(row.event_name), ''), 'Event'),
      'eventDate', row.event_date,
      'serviceName', coalesce(nullif(trim(row.service_name), ''), 'Service'),
      'allocationAmount', round(coalesce(row.held_provider_amount, 0), 2),
      'payoutEligibleOn', coalesce(row.payout_eligible_on, row.event_date - 14),
      'fundsStatus', case row.provider_funds_status
        when 'awaiting_provider_acceptance' then 'Pending Booking Acceptance'
        when 'held_receivable' then 'Held Receivable'
        when 'eligible_for_release' then 'Eligible for Release'
        when 'rejected_held' then 'Held for Replacement or Refund'
        when 'disputed_on_hold' then 'Financial Hold'
        else replace(row.provider_funds_status, '_', ' ')
      end,
      'isReconciliationRequired', coalesce(row.receivable_reconciliation_required, false)
    ) as payload, row.updated_at, row.id
    from ledger_rows row
    where row.provider_funds_status in (
      'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
      'rejected_held', 'disputed_on_hold'
    )
      and row.held_provider_amount > 0
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP',
      'receivables', round(coalesce(balances.receivables, 0), 2),
      'availableBalance', round(greatest(
        coalesce(balances.eligible_before_reservations, 0)
          - coalesce(payout_totals.reserved_or_paid, 0),
        0
      ), 2),
      'pendingPayouts', round(coalesce(payout_totals.pending_payouts, 0), 2),
      'totalPaidOut', round(coalesce(payout_totals.total_paid_out, 0), 2)
    ),
    'receivables', coalesce((
      select jsonb_agg(receivable.payload order by receivable.updated_at desc, receivable.id)
      from receivables receivable
    ), '[]'::jsonb)
  ) into result_payload
  from balances cross join payout_totals;

  return coalesce(result_payload, jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP', 'receivables', 0, 'availableBalance', 0,
      'pendingPayouts', 0, 'totalPaidOut', 0
    ),
    'receivables', '[]'::jsonb
  ));
end;
$$;

-- Coordinators do not yet share the provider payout-account workflow. Their
-- wallet remains read-only here, but uses the same held/available/pending/paid
-- categories so the client payment and internal receivable are never confused.
create or replace function public.get_my_coordinator_receivable_wallet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  with ledger_rows as (
    select ledger.id, ledger.event_id, ledger.provider_funds_status,
      ledger.provider_net_amount, ledger.held_provider_amount, ledger.amount_released,
      ledger.payout_eligible_on, ledger.receivable_reconciliation_required,
      ledger.updated_at, event.name as event_name, event.event_date
    from public.financial_transactions ledger
    join public.events event on event.id = ledger.event_id
    where ledger.coordinator_id = auth.uid()
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ), balances as (
    select
      coalesce(sum(row.held_provider_amount) filter (
        where row.provider_funds_status in (
          'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
          'rejected_held', 'disputed_on_hold'
        )
      ), 0) as receivables,
      coalesce(sum(greatest(row.provider_net_amount - row.amount_released, 0)) filter (
        where row.provider_funds_status = 'available_for_payout'
          and not coalesce(row.receivable_reconciliation_required, false)
      ), 0) as available_balance,
      coalesce(sum(greatest(row.provider_net_amount - row.amount_released, 0)) filter (
        where row.provider_funds_status = 'payout_pending'
      ), 0) as pending_payouts,
      coalesce(sum(row.amount_released), 0) as total_paid_out
    from ledger_rows row
  ), receivables as (
    select jsonb_build_object(
      'id', row.id,
      'eventId', row.event_id,
      'eventName', coalesce(nullif(trim(row.event_name), ''), 'Event'),
      'eventDate', row.event_date,
      'serviceName', 'Coordinator booking',
      'allocationAmount', round(coalesce(row.held_provider_amount, 0), 2),
      'payoutEligibleOn', coalesce(row.payout_eligible_on, row.event_date - 14),
      'fundsStatus', case row.provider_funds_status
        when 'awaiting_provider_acceptance' then 'Pending Booking Acceptance'
        when 'held_receivable' then 'Held Receivable'
        when 'eligible_for_release' then 'Eligible for Release'
        when 'rejected_held' then 'Held for Replacement or Refund'
        when 'disputed_on_hold' then 'Financial Hold'
        else replace(row.provider_funds_status, '_', ' ')
      end,
      'isReconciliationRequired', coalesce(row.receivable_reconciliation_required, false)
    ) as payload, row.updated_at, row.id
    from ledger_rows row
    where row.provider_funds_status in (
      'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
      'rejected_held', 'disputed_on_hold'
    )
      and row.held_provider_amount > 0
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP',
      'receivables', round(coalesce(balances.receivables, 0), 2),
      'availableBalance', round(coalesce(balances.available_balance, 0), 2),
      'pendingPayouts', round(coalesce(balances.pending_payouts, 0), 2),
      'totalPaidOut', round(coalesce(balances.total_paid_out, 0), 2)
    ),
    'receivables', coalesce((
      select jsonb_agg(receivable.payload order by receivable.updated_at desc, receivable.id)
      from receivables receivable
    ), '[]'::jsonb)
  ) into result_payload
  from balances;

  return coalesce(result_payload, jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP', 'receivables', 0, 'availableBalance', 0,
      'pendingPayouts', 0, 'totalPaidOut', 0
    ),
    'receivables', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.get_my_provider_receivable_wallet() from public;
revoke all on function public.get_my_coordinator_receivable_wallet() from public;
grant execute on function public.get_my_provider_receivable_wallet() to authenticated;
grant execute on function public.get_my_coordinator_receivable_wallet() to authenticated;

comment on function public.get_my_provider_receivable_wallet() is
  'Read-only provider wallet summary separating held receivables, validated available balance, pending payout requests, and paid payouts.';
comment on function public.get_my_coordinator_receivable_wallet() is
  'Read-only coordinator wallet summary separating held receivables, available balances, pending payouts, and paid-out ledger amounts.';

commit;
