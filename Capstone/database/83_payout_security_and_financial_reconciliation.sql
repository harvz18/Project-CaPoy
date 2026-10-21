-- MULTIVENT Revision V11, Phase 5: payout security and financial reconciliation.
-- Apply after 82_cancellation_refund_hold_protection.sql.
--
-- This is deliberately additive. It records which protected ledger allocations
-- fund a new payout request, closes the legacy direct-insert payout bypass, and
-- exposes read-only reconciliation data. It never debits a historic payout,
-- changes service prices, or creates a refund.

begin;

-- New payout requests must be backed by the precise ledger allocations used to
-- calculate them. Historic requests remain untouched and explicitly appear in
-- the reconciliation report when they predate this allocation-level record.
create table if not exists public.provider_payout_request_allocations (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null references public.provider_payout_requests(id) on delete restrict,
  financial_transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint provider_payout_request_allocations_request_ledger_uidx
    unique (payout_request_id, financial_transaction_id)
);

create index if not exists provider_payout_request_allocations_ledger_idx
  on public.provider_payout_request_allocations (financial_transaction_id);
create index if not exists provider_payout_request_allocations_request_idx
  on public.provider_payout_request_allocations (payout_request_id);

alter table public.provider_payout_requests
  add column if not exists allocation_reservations_required boolean not null default false;

alter table public.provider_payout_request_allocations enable row level security;
revoke all on table public.provider_payout_request_allocations from anon, authenticated;

-- Providers may still read their own payout history, but cannot insert a
-- request around the secured balance calculation. The RPC below is the sole
-- authenticated creation route; its trigger authorization is an additional
-- safeguard should table privileges ever be changed later.
drop policy if exists "Providers create owned payout requests" on public.provider_payout_requests;
revoke insert, update, delete on table public.provider_payout_requests from authenticated;
grant select on table public.provider_payout_requests to authenticated;

-- Returns the residual amount that can safely fund one payout request. The
-- request itself can be excluded while it is validated during processing.
create or replace function public.phase11_provider_allocation_available_amount(
  target_ledger_id uuid,
  target_provider_id uuid,
  excluded_payout_request_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ledger.id is null
      or ledger.provider_id is distinct from target_provider_id
      or ledger.transaction_type <> 'booking_payment'
      or ledger.status not in ('paid', 'verified')
      or ledger.provider_funds_status not in (
        'legacy', 'initial_share_credited', 'available_for_payout'
      )
      or public.phase11_has_refund_or_financial_hold(ledger.metadata)
      or (
        ledger.provider_funds_status = 'available_for_payout'
        and coalesce(ledger.receivable_reconciliation_required, false)
      )
    then 0::numeric
    else greatest(
      coalesce(ledger.provider_net_amount, 0) - coalesce(ledger.amount_released, 0)
        - coalesce((
          select sum(allocation.amount)
          from public.provider_payout_request_allocations allocation
          join public.provider_payout_requests request
            on request.id = allocation.payout_request_id
          where allocation.financial_transaction_id = ledger.id
            and request.status in ('requested', 'processing', 'paid')
            and (excluded_payout_request_id is null
              or allocation.payout_request_id <> excluded_payout_request_id)
        ), 0),
      0
    )
  end
  from public.financial_transactions ledger
  where ledger.id = target_ledger_id;
$$;

-- The older protection trigger allowed a provider-owned direct insert and
-- simply normalized its fields. Replacing it ensures every new request has a
-- server-authorized allocation reservation while still permitting the existing
-- service-role settlement workflow to update historic requests.
create or replace function public.protect_provider_payout_request_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorized_request boolean := coalesce(
    current_setting('app.phase11_payout_request_authorized', true), ''
  ) = 'true';
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and not authorized_request then
      raise exception 'Payout requests must be created through the secured payout workflow.'
        using errcode = '42501';
    end if;

    new.status := 'requested';
    new.processed_at := null;
    new.requested_at := now();
    new.created_at := now();
    new.updated_at := now();
    new.allocation_reservations_required := true;
    return new;
  end if;

  if auth.role() <> 'service_role' and not authorized_request then
    raise exception 'Payout request changes require an authorized financial workflow.'
      using errcode = '42501';
  end if;

  if new.provider_id is distinct from old.provider_id
    or new.amount is distinct from old.amount
    or new.currency is distinct from old.currency
    or new.allocation_reservations_required is distinct from old.allocation_reservations_required
  then
    raise exception 'A payout request allocation cannot be rewritten after submission.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- A mapped request cannot enter processing or be marked paid if a cancellation,
-- refund/dispute hold, reschedule, or another request has made an allocation
-- unavailable. Historic requests without mappings are preserved for manual
-- reconciliation rather than guessed or silently debited.
create or replace function public.phase11_validate_payout_request_allocations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_total numeric(12,2);
  mapped_count integer;
begin
  if not new.allocation_reservations_required
    or new.status not in ('requested', 'processing', 'paid')
  then
    return null;
  end if;

  select coalesce(sum(allocation.amount), 0), count(*)
  into mapped_total, mapped_count
  from public.provider_payout_request_allocations allocation
  where allocation.payout_request_id = new.id;

  if mapped_count = 0 or mapped_total <> new.amount then
    raise exception 'The payout request does not have a complete allocation reservation.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.provider_payout_request_allocations allocation
    where allocation.payout_request_id = new.id
      and allocation.amount > public.phase11_provider_allocation_available_amount(
        allocation.financial_transaction_id,
        new.provider_id,
        new.id
      )
  ) then
    raise exception 'A reserved allocation is no longer available for payout.'
      using errcode = '42501';
  end if;

  return null;
end;
$$;

drop trigger if exists phase11_require_payout_request_allocations_trigger
  on public.provider_payout_requests;
create constraint trigger phase11_require_payout_request_allocations_trigger
after insert or update of status, amount, provider_id, allocation_reservations_required
on public.provider_payout_requests
deferrable initially deferred
for each row execute function public.phase11_validate_payout_request_allocations();

-- Lock the provider and each source ledger row, calculate the residual balance
-- from server-side records, then persist one allocation row per source. This
-- makes concurrent taps or requests safe without trusting UI totals.
create or replace function public.request_my_provider_payout(requested_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  payout_id uuid;
  allocation_row record;
  allocation_amount numeric(12,2);
  remaining_amount numeric(12,2) := round(coalesce(requested_amount, 0), 2);
begin
  if requested_amount is null or requested_amount <= 0
    or requested_amount <> round(requested_amount, 2)
  then
    raise exception 'Enter a valid payout amount with no fractions smaller than one centavo.';
  end if;

  -- This row lock serializes every request created by the same provider.
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

  -- Refresh release eligibility inside the same protected transaction. It
  -- creates no external transfer and can safely run repeatedly.
  perform public.process_phase11_payout_eligibility(null);

  -- Also serialize against an existing payout status transition for this
  -- provider before assessing the residual allocation balance.
  perform 1
  from public.provider_payout_requests request
  where request.provider_id = provider_id_value
  for update;

  perform set_config('app.phase11_payout_request_authorized', 'true', true);
  insert into public.provider_payout_requests (
    provider_id, amount, currency, status, requested_at, created_at, updated_at
  ) values (
    provider_id_value, requested_amount, 'PHP', 'requested', now(), now(), now()
  ) returning id into payout_id;

  for allocation_row in
    select ledger.id,
      greatest(
        ledger.provider_net_amount - ledger.amount_released - coalesce((
          select sum(existing_allocation.amount)
          from public.provider_payout_request_allocations existing_allocation
          join public.provider_payout_requests existing_request
            on existing_request.id = existing_allocation.payout_request_id
          where existing_allocation.financial_transaction_id = ledger.id
            and existing_request.status in ('requested', 'processing', 'paid')
        ), 0),
        0
      )::numeric(12,2) as available_amount
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
      and ledger.provider_net_amount > ledger.amount_released
    order by ledger.payout_eligible_on nulls first, ledger.transaction_at, ledger.id
    for update of ledger
  loop
    exit when remaining_amount <= 0;
    if allocation_row.available_amount <= 0 then
      continue;
    end if;

    allocation_amount := least(remaining_amount, allocation_row.available_amount);
    insert into public.provider_payout_request_allocations (
      payout_request_id, financial_transaction_id, amount
    ) values (
      payout_id, allocation_row.id, allocation_amount
    );
    remaining_amount := round(remaining_amount - allocation_amount, 2);
  end loop;

  if remaining_amount > 0 then
    raise exception 'The payout request exceeds the available balance.';
  end if;

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

-- Preserve the existing earnings payload, but make its legacy available-balance
-- field agree with the protected receivable-wallet calculation as well.
alter function public.get_my_provider_earnings(text)
  rename to get_my_provider_earnings_phase11_legacy;

create or replace function public.get_my_provider_earnings(
  target_period text default '30d'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  earnings_payload jsonb;
  wallet_payload jsonb;
begin
  earnings_payload := public.get_my_provider_earnings_phase11_legacy(target_period);
  wallet_payload := public.get_my_provider_receivable_wallet();

  return jsonb_set(
    coalesce(earnings_payload, '{}'::jsonb),
    '{summary}',
    coalesce(earnings_payload -> 'summary', '{}'::jsonb) || jsonb_build_object(
      'availableBalance', coalesce(wallet_payload -> 'summary' -> 'availableBalance', '0'::jsonb)
    ),
    true
  );
end;
$$;

-- A read-only reconciliation projection for the authorized web admin finance
-- screen. It keeps collected client money, MULTIVENT fees, provider/coordinator
-- liabilities, refund-review exposure, and payout records distinct. Refund/hold
-- exposure is not represented as a completed refund because policy amounts are
-- intentionally still unresolved.
create or replace function public.get_admin_phase11_receivables_reconciliation()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reconciliation jsonb;
begin
  if not public.has_permission('cashflow.view') then
    raise exception 'Cash-flow access is required.' using errcode = '42501';
  end if;

  with ledger_rows as (
    select ledger.*, event.name as event_name, event.event_date,
      provider.business_name as provider_name,
      coordinator.full_name as coordinator_name
    from public.financial_transactions ledger
    left join public.events event on event.id = ledger.event_id
    left join public.provider_profiles provider on provider.id = ledger.provider_id
    left join public.profiles coordinator on coordinator.id = ledger.coordinator_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ), active_reservations as (
    select allocation.financial_transaction_id,
      coalesce(sum(allocation.amount) filter (
        where request.status in ('requested', 'processing', 'paid')
      ), 0) as reserved_or_paid,
      coalesce(sum(allocation.amount) filter (
        where request.status in ('requested', 'processing')
      ), 0) as pending_reservation
    from public.provider_payout_request_allocations allocation
    join public.provider_payout_requests request
      on request.id = allocation.payout_request_id
    group by allocation.financial_transaction_id
  ), ledger_with_reservations as (
    select ledger.*, coalesce(reservation.reserved_or_paid, 0) as reserved_or_paid,
      coalesce(reservation.pending_reservation, 0) as pending_reservation,
      public.phase11_has_refund_or_financial_hold(ledger.metadata) as has_financial_hold
    from ledger_rows ledger
    left join active_reservations reservation
      on reservation.financial_transaction_id = ledger.id
  ), payout_totals as (
    select
      coalesce(sum(request.amount) filter (
        where request.status in ('requested', 'processing')
      ), 0) as pending_payout_requests,
      coalesce(sum(request.amount) filter (
        where request.status = 'paid'
      ), 0) as completed_payout_requests,
      count(*) filter (
        where request.status in ('requested', 'processing')
      )::int as pending_payout_count,
      count(*) filter (
        where request.status = 'paid'
      )::int as completed_payout_count,
      count(*) filter (
        where request.allocation_reservations_required
          and request.status in ('requested', 'processing', 'paid')
      )::int as mapped_request_count,
      count(*) filter (
        where not request.allocation_reservations_required
          and request.status in ('requested', 'processing', 'paid')
      )::int as historic_unmapped_request_count,
      coalesce(sum(request.amount) filter (
        where not request.allocation_reservations_required
          and request.status in ('requested', 'processing', 'paid')
      ), 0) as historic_unmapped_request_amount
    from public.provider_payout_requests request
  ), legacy_rows as (
    select
      'ledger'::text as item_type,
      ledger.id,
      ledger.event_name,
      ledger.event_date,
      coalesce(nullif(trim(ledger.provider_name), ''), nullif(trim(ledger.coordinator_name), ''), 'Recipient') as recipient_name,
      coalesce(ledger.provider_funds_status, 'legacy') as financial_state,
      greatest(
        coalesce(ledger.held_provider_amount, 0)
          + coalesce(ledger.provider_net_amount, 0)
          - coalesce(ledger.amount_released, 0),
        0
      ) as amount,
      coalesce(
        nullif(ledger.metadata ->> 'phase11_reconciliation_reason', ''),
        nullif(ledger.metadata ->> 'financial_hold_reason', ''),
        'historical allocation review required'
      ) as reason,
      ledger.updated_at as reported_at
    from ledger_with_reservations ledger
    where ledger.event_date > current_date + 14
      and (
        coalesce(ledger.receivable_reconciliation_required, false)
        or ledger.provider_funds_status in ('legacy', 'initial_share_credited', 'paid_out')
        or ledger.amount_released > 0
      )
  ), historic_payout_rows as (
    select
      'historic_payout_request'::text as item_type,
      request.id,
      null::text as event_name,
      null::date as event_date,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as recipient_name,
      request.status as financial_state,
      request.amount,
      'historic payout request has no allocation-level ledger mapping'::text as reason,
      coalesce(request.processed_at, request.requested_at, request.updated_at) as reported_at
    from public.provider_payout_requests request
    left join public.provider_profiles provider on provider.id = request.provider_id
    where not request.allocation_reservations_required
      and request.status in ('requested', 'processing', 'paid')
  ), reconciliation_items as (
    select * from legacy_rows
    union all
    select * from historic_payout_rows
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'clientCollected', coalesce(sum(ledger.amount_received), 0),
      'platformFeesAttributed', coalesce(sum(ledger.commission_amount), 0),
      'heldAllocations', coalesce(sum(ledger.held_provider_amount), 0),
      'availableAllocations', coalesce(sum(greatest(
        ledger.provider_net_amount - ledger.amount_released - ledger.reserved_or_paid,
        0
      )) filter (
        where ledger.provider_funds_status in (
          'legacy', 'initial_share_credited', 'available_for_payout'
        )
          and not ledger.has_financial_hold
          and (
            ledger.provider_funds_status <> 'available_for_payout'
            or not coalesce(ledger.receivable_reconciliation_required, false)
          )
      ), 0),
      'pendingPayoutRequests', payout_totals.pending_payout_requests,
      'completedPayoutRequests', payout_totals.completed_payout_requests,
      'refundHoldExposure', coalesce(sum(greatest(
        ledger.held_provider_amount + ledger.provider_net_amount - ledger.amount_released,
        0
      )) filter (where ledger.has_financial_hold), 0),
      'recordedRefunds', coalesce((
        select sum(greatest(refund.amount_released, refund.gross_amount, 0))
        from public.financial_transactions refund
        where refund.transaction_type = 'refund'
          and refund.status = 'refunded'
      ), 0),
      'ledgerPaidOut', coalesce(sum(ledger.amount_released), 0),
      'remainingLedgerLiability', coalesce(sum(greatest(
        ledger.held_provider_amount + ledger.provider_net_amount - ledger.amount_released,
        0
      )), 0),
      'reconciliationRequiredCount', count(*) filter (
        where coalesce(ledger.receivable_reconciliation_required, false)
          or ledger.has_financial_hold
      )::int,
      'reconciliationRequiredAmount', coalesce(sum(greatest(
        ledger.held_provider_amount + ledger.provider_net_amount - ledger.amount_released,
        0
      )) filter (
        where coalesce(ledger.receivable_reconciliation_required, false)
          or ledger.has_financial_hold
      ), 0),
      'pendingPayoutCount', payout_totals.pending_payout_count,
      'completedPayoutCount', payout_totals.completed_payout_count,
      'mappedPayoutRequestCount', payout_totals.mapped_request_count,
      'historicUnmappedPayoutCount', payout_totals.historic_unmapped_request_count,
      'historicUnmappedPayoutAmount', payout_totals.historic_unmapped_request_amount
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'itemType', item.item_type,
        'eventName', item.event_name,
        'eventDate', item.event_date,
        'recipientName', item.recipient_name,
        'financialState', item.financial_state,
        'amount', item.amount,
        'reason', item.reason,
        'reportedAt', item.reported_at
      ) order by item.reported_at desc, item.id)
      from (
        select * from reconciliation_items
        order by reported_at desc, id
        limit 25
      ) item
    ), '[]'::jsonb)
  ) into reconciliation
  from ledger_with_reservations ledger
  cross join payout_totals
  group by
    payout_totals.pending_payout_requests,
    payout_totals.completed_payout_requests,
    payout_totals.pending_payout_count,
    payout_totals.completed_payout_count,
    payout_totals.mapped_request_count,
    payout_totals.historic_unmapped_request_count,
    payout_totals.historic_unmapped_request_amount;

  return reconciliation;
end;
$$;

revoke all on function public.phase11_provider_allocation_available_amount(uuid, uuid, uuid) from public;
revoke all on function public.protect_provider_payout_request_fields() from public;
revoke all on function public.phase11_validate_payout_request_allocations() from public;
revoke all on function public.request_my_provider_payout(numeric) from public;
revoke all on function public.get_my_provider_earnings_phase11_legacy(text) from public, anon, authenticated;
revoke all on function public.get_my_provider_earnings(text) from public;
revoke all on function public.get_admin_phase11_receivables_reconciliation() from public;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;
grant execute on function public.get_my_provider_earnings(text) to authenticated;
grant execute on function public.get_admin_phase11_receivables_reconciliation() to authenticated;

comment on table public.provider_payout_request_allocations is
  'Immutable allocation reservations that show exactly which protected ledger rows fund each Phase 11 payout request.';
comment on function public.request_my_provider_payout(numeric) is
  'Creates an allocation-mapped payout request only from locked, authoritative, non-held provider ledger balances.';
comment on function public.get_admin_phase11_receivables_reconciliation() is
  'Read-only, permission-scoped reconciliation of collected funds, recipient liabilities, payout reservations, refund-review exposure, and legacy records requiring review.';

commit;
