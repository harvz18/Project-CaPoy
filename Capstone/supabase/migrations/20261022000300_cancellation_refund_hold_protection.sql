-- MULTIVENT Revision V11, Phase 4: cancellation refund hold protection.
-- Apply after 81_receivable_wallet_views.sql.
--
-- The current system has no stored cancellation-refund schedule or provider
-- policy that can authoritatively calculate a refundable amount. This migration
-- therefore protects funds and records a policy-review hold; it never invents
-- a refund percentage, changes a recognized client payment, or creates a
-- refund transfer.

begin;

-- A single authoritative metadata predicate is shared by wallet and payout
-- queries. It blocks a cancellation/refund review before any withdrawable
-- balance is derived, including for historic balances that must not be
-- rewritten automatically.
create or replace function public.phase11_has_refund_or_financial_hold(target_metadata jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(target_metadata ->> 'financial_hold', 'false'))
      in ('true', 'pending', 'open', 'held')
    or lower(coalesce(target_metadata ->> 'refund_pending', 'false'))
      in ('true', 'pending', 'open', 'held')
    or lower(coalesce(target_metadata ->> 'refund_status', ''))
      in (
        'pending', 'requested', 'open', 'approved', 'processing',
        'review_required', 'policy_review_required',
        'manual_reconciliation_required'
      );
$$;

-- Whenever an allocation enters the rejected-held state, preserve the ledger
-- amount but prevent any release while replacement/refund policy is reviewed.
-- This covers provider declines as well as a booking cancelled by the client.
create or replace function public.phase11_flag_rejected_receivable_refund_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_funds_status = 'rejected_held'
    and new.provider_funds_status is distinct from old.provider_funds_status
    and new.transaction_type = 'booking_payment'
    and new.status in ('paid', 'verified')
    and (
      new.metadata ->> 'accounting_version' = 'phase5-v1'
      or new.metadata ->> 'accountingVersion' = 'phase5-v1'
    )
  then
    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'financial_hold', true,
      'financial_hold_reason', 'booking_rejected_or_cancelled',
      'refund_status', case
        when lower(coalesce(new.metadata ->> 'refund_status', '')) in (
          'pending', 'requested', 'open', 'approved', 'processing', 'completed'
        ) then new.metadata ->> 'refund_status'
        else 'policy_review_required'
      end,
      'refund_policy_review_required', true,
      'refund_review_started_at', coalesce(new.metadata ->> 'refund_review_started_at', now()::text),
      'provider_release', false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists phase11_flag_rejected_receivable_refund_review_trigger
  on public.financial_transactions;
create trigger phase11_flag_rejected_receivable_refund_review_trigger
before update of provider_funds_status on public.financial_transactions
for each row execute function public.phase11_flag_rejected_receivable_refund_review();

-- A client event cancellation must protect provider and coordinator allocations
-- independently. Only the affected event's ledger rows are held; unrelated
-- providers and bookings remain unchanged. Existing released payouts are never
-- clawed back automatically and are instead flagged for reconciliation.
create or replace function public.phase11_hold_cancelled_event_receivables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status or new.status::text <> 'cancelled' then
    return new;
  end if;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);

  update public.financial_transactions ledger
  set provider_net_amount = case
        when ledger.provider_funds_status in ('legacy', 'initial_share_credited')
          or ledger.amount_released > 0
          or ledger.provider_funds_status = 'payout_pending'
          or (
            ledger.provider_id is not null and exists (
              select 1
              from public.provider_payout_requests request
              where request.provider_id = ledger.provider_id
                and request.status in ('requested', 'processing', 'paid')
            )
          )
          then ledger.provider_net_amount
        else 0
      end,
      held_provider_amount = case
        when ledger.provider_funds_status in ('legacy', 'initial_share_credited')
          or ledger.amount_released > 0
          or ledger.provider_funds_status = 'payout_pending'
          or (
            ledger.provider_id is not null and exists (
              select 1
              from public.provider_payout_requests request
              where request.provider_id = ledger.provider_id
                and request.status in ('requested', 'processing', 'paid')
            )
          )
          then ledger.held_provider_amount
        else ledger.held_provider_amount + ledger.provider_net_amount
      end,
      provider_funds_status = case
        when ledger.provider_funds_status in ('legacy', 'initial_share_credited', 'paid_out')
          then ledger.provider_funds_status
        when ledger.amount_released > 0
          or ledger.provider_funds_status = 'payout_pending'
          or (
            ledger.provider_id is not null and exists (
              select 1
              from public.provider_payout_requests request
              where request.provider_id = ledger.provider_id
                and request.status in ('requested', 'processing', 'paid')
            )
          )
          then 'disputed_on_hold'
        else 'rejected_held'
      end,
      receivable_reconciliation_required = coalesce(ledger.receivable_reconciliation_required, false)
        or ledger.provider_funds_status in ('legacy', 'initial_share_credited', 'payout_pending', 'paid_out')
        or ledger.amount_released > 0
        or (
          ledger.provider_id is not null and exists (
            select 1
            from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          )
        ),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_hold', true,
        'financial_hold_reason', 'event_cancelled',
        'refund_status', case
          when ledger.amount_released > 0
            or ledger.provider_funds_status in ('legacy', 'initial_share_credited', 'payout_pending', 'paid_out')
            or (
              ledger.provider_id is not null and exists (
                select 1
                from public.provider_payout_requests request
                where request.provider_id = ledger.provider_id
                  and request.status in ('requested', 'processing', 'paid')
              )
            )
            then 'manual_reconciliation_required'
          else 'policy_review_required'
        end,
        'refund_policy_review_required', true,
        'refund_review_started_at', coalesce(ledger.metadata ->> 'refund_review_started_at', now()::text),
        'provider_release', false,
        'receivable_state', case
          when ledger.provider_funds_status in ('legacy', 'initial_share_credited', 'paid_out')
            then ledger.provider_funds_status
          when ledger.amount_released > 0
            or ledger.provider_funds_status = 'payout_pending'
            or (
              ledger.provider_id is not null and exists (
                select 1
                from public.provider_payout_requests request
                where request.provider_id = ledger.provider_id
                  and request.status in ('requested', 'processing', 'paid')
              )
            )
            then 'disputed_on_hold'
          else 'rejected_held'
        end
      ),
      updated_at = now()
  where ledger.event_id = new.id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status <> 'refunded'
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  return new;
end;
$$;

drop trigger if exists phase11_hold_cancelled_event_receivables_trigger on public.events;
create trigger phase11_hold_cancelled_event_receivables_trigger
after update of status on public.events
for each row execute function public.phase11_hold_cancelled_event_receivables();

-- Backfill the policy-review marker only for existing V11 rejected allocations.
-- No historic amount, payment status, booking record, or payout is rewritten.
update public.financial_transactions ledger
set metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
      'financial_hold', true,
      'financial_hold_reason', 'replacement_or_refund_review',
      'refund_status', coalesce(nullif(ledger.metadata ->> 'refund_status', ''), 'policy_review_required'),
      'refund_policy_review_required', true,
      'refund_review_started_at', coalesce(ledger.metadata ->> 'refund_review_started_at', now()::text),
      'provider_release', false
    ),
    updated_at = now()
where ledger.transaction_type = 'booking_payment'
  and ledger.status in ('paid', 'verified')
  and ledger.provider_funds_status in ('rejected_held', 'disputed_on_hold')
  and (
    ledger.metadata ->> 'accounting_version' = 'phase5-v1'
    or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
  )
  and not public.phase11_has_refund_or_financial_hold(ledger.metadata);

-- Existing provider payout requests continue to use the authoritative server
-- calculation, now excluding all cancellation/refund review holds across every
-- eligible state. The client-provided amount is still validated against it.
create or replace function public.request_my_provider_payout(requested_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  available_balance numeric(12,2);
  payout_id uuid;
begin
  if requested_amount is null or requested_amount <= 0
    or requested_amount <> round(requested_amount, 2)
  then
    raise exception 'Enter a valid payout amount with no fractions smaller than one centavo.';
  end if;

  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and provider.verification_status = 'verified'
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1
  for update of provider;

  if provider_id_value is null then
    raise exception 'A verified service-provider account is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.provider_payout_accounts account
    where account.provider_id = provider_id_value
      and account.ownership_confirmed
  ) then
    raise exception 'Add and confirm a payout account before requesting a payout.';
  end if;

  perform public.process_phase11_payout_eligibility(null);

  select greatest(
    coalesce((
      select sum(greatest(ledger.provider_net_amount - ledger.amount_released, 0))
      from public.financial_transactions ledger
      where ledger.provider_id = provider_id_value
        and ledger.transaction_type = 'booking_payment'
        and ledger.status in ('paid', 'verified')
        and ledger.provider_funds_status in (
          'legacy', 'initial_share_credited', 'available_for_payout'
        )
        and not public.phase11_has_refund_or_financial_hold(ledger.metadata)
        and (
          ledger.provider_funds_status <> 'available_for_payout'
          or not coalesce(ledger.receivable_reconciliation_required, false)
        )
    ), 0) - coalesce((
      select sum(request.amount)
      from public.provider_payout_requests request
      where request.provider_id = provider_id_value
        and request.status in ('requested', 'processing', 'paid')
    ), 0),
    0
  ) into available_balance;

  if requested_amount > available_balance then
    raise exception 'The payout request exceeds the available balance (%).', available_balance;
  end if;

  insert into public.provider_payout_requests (
    provider_id, amount, currency, status, requested_at, created_at, updated_at
  ) values (
    provider_id_value, requested_amount, 'PHP', 'requested', now(), now(), now()
  ) returning id into payout_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    auth.uid(), 'Payout request received',
    format('Your payout request for PHP %s is awaiting processing.',
      to_char(requested_amount, 'FM999,999,999,990.00')),
    'provider_payout_request', payout_id
  );

  return payout_id;
end;
$$;

-- The Phase 3 provider wallet is re-projected here so its displayed available
-- amount uses the same refund-hold predicate as the protected payout endpoint.
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
      ledger.metadata, ledger.transaction_at, ledger.updated_at,
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
        and not public.phase11_has_refund_or_financial_hold(row.metadata)
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
        when 'rejected_held' then 'Held for Replacement or Refund Review'
        when 'disputed_on_hold' then 'Financial Hold - Review Required'
        else replace(row.provider_funds_status, '_', ' ')
      end,
      'isReconciliationRequired', coalesce(row.receivable_reconciliation_required, false)
        or public.phase11_has_refund_or_financial_hold(row.metadata)
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

-- Coordinators do not have a payout-request control in the current product,
-- but their read-only summary must still exclude allocations under refund hold.
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
      ledger.metadata, ledger.updated_at, event.name as event_name, event.event_date
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
          and not public.phase11_has_refund_or_financial_hold(row.metadata)
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
        when 'rejected_held' then 'Held for Replacement or Refund Review'
        when 'disputed_on_hold' then 'Financial Hold - Review Required'
        else replace(row.provider_funds_status, '_', ' ')
      end,
      'isReconciliationRequired', coalesce(row.receivable_reconciliation_required, false)
        or public.phase11_has_refund_or_financial_hold(row.metadata)
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

revoke all on function public.phase11_has_refund_or_financial_hold(jsonb) from public;
revoke all on function public.phase11_flag_rejected_receivable_refund_review() from public;
revoke all on function public.phase11_hold_cancelled_event_receivables() from public;
revoke all on function public.request_my_provider_payout(numeric) from public;
revoke all on function public.get_my_provider_receivable_wallet() from public;
revoke all on function public.get_my_coordinator_receivable_wallet() from public;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;
grant execute on function public.get_my_provider_receivable_wallet() to authenticated;
grant execute on function public.get_my_coordinator_receivable_wallet() to authenticated;

comment on function public.phase11_has_refund_or_financial_hold(jsonb) is
  'Returns whether ledger metadata represents a cancellation, refund, dispute, or other financial hold that must not be withdrawable.';
comment on function public.phase11_hold_cancelled_event_receivables() is
  'Protects only the cancelled event''s unreleased allocations and flags historic or payout-linked allocations for reconciliation without creating a refund.';
comment on function public.request_my_provider_payout(numeric) is
  'Creates a balance-validated payout request only from authoritative, non-held provider balances.';

commit;
