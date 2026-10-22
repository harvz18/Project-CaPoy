-- MULTIVENT V11 follow-up: automatic refund credits to the client wallet.
--
-- Confirmed policy:
--   * Client cancellation more than 14 local-calendar days before the event:
--     credit the full, item-specific initial payment (30% recipient allocation
--     plus the attributable 5% MULTIVENT fee) to the client wallet.
--   * Client cancellation on or within the 14-day window: no automatic credit.
--   * Provider or coordinator decline: credit that affected item's full
--     initial payment, regardless of the event-date window.
--
-- The wallet credit is an internal MULTIVENT liability, not a claimed bank,
-- card, or e-wallet transfer. Payment snapshots remain historical records.

begin;

create table if not exists public.client_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  financial_transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  transaction_type text not null check (transaction_type in ('refund_credit')),
  status text not null default 'available' check (status in ('available')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_wallet_refund_credit_ledger_uidx
  on public.client_wallet_transactions (financial_transaction_id)
  where transaction_type = 'refund_credit';

create index if not exists client_wallet_transactions_client_idx
  on public.client_wallet_transactions (client_id, created_at desc);

alter table public.client_wallet_transactions enable row level security;

revoke all on table public.client_wallet_transactions from anon, authenticated;
grant select on table public.client_wallet_transactions to authenticated;

drop policy if exists "Clients view their own wallet transactions"
  on public.client_wallet_transactions;
create policy "Clients view their own wallet transactions"
  on public.client_wallet_transactions
  for select to authenticated
  using (client_id = auth.uid());

-- Keep the original V11 custody guard, but allow the dedicated secured refund
-- routine to close an unreleased receivable after it has atomically created
-- the matching client-wallet credit. No authenticated caller can set this
-- transaction-local authorization flag through an exposed RPC.
create or replace function public.enforce_phase11_receivable_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_authorized boolean := coalesce(
    current_setting('app.phase11_receivable_release_authorized', true), ''
  ) = 'true';
  refund_authorized boolean := coalesce(
    current_setting('app.phase11_client_wallet_refund_authorized', true), ''
  ) = 'true';
begin
  if old.provider_funds_status in (
    'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
    'available_for_payout', 'payout_pending', 'paid_out', 'rejected_held',
    'disputed_on_hold'
  ) then
    if new.status = 'refunded' or new.transaction_type = 'refund' then
      return new;
    end if;

    if (
      new.provider_net_amount is distinct from old.provider_net_amount
      or new.held_provider_amount is distinct from old.held_provider_amount
      or new.amount_released is distinct from old.amount_released
    ) and not release_authorized and not refund_authorized then
      raise exception 'Receivable amounts can be changed only by the secured payout eligibility or refund workflow.'
        using errcode = '42501';
    end if;

    if new.provider_funds_status is distinct from old.provider_funds_status
      and not release_authorized
      and not refund_authorized
      and new.provider_funds_status not in ('rejected_held', 'refunded', 'disputed_on_hold')
    then
      raise exception 'Receivables can move to a payout state only through the secured eligibility process.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Credits exactly one immutable wallet entry per original booking/coordinator
-- ledger allocation. It refuses to manufacture a credit when the allocation
-- was already linked to a payout: that legacy/liquidity case remains held for
-- reconciliation instead of silently making MULTIVENT liable twice.
create or replace function public.credit_phase11_client_wallet_refund(
  target_ledger_id uuid,
  refund_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_row public.financial_transactions%rowtype;
  payment_row public.payments%rowtype;
  event_row public.events%rowtype;
  local_today date;
  refund_amount numeric(12,2);
  wallet_transaction_id uuid;
  recipient_payout_linked boolean := false;
begin
  if refund_reason not in ('client_cancellation', 'recipient_declined') then
    raise exception 'Unsupported automatic refund reason.' using errcode = '22023';
  end if;

  select ledger.* into ledger_row
  from public.financial_transactions ledger
  where ledger.id = target_ledger_id
  for update;

  if ledger_row.id is null
    or ledger_row.transaction_type <> 'booking_payment'
    or ledger_row.status not in ('paid', 'verified')
    or (
      ledger_row.metadata ->> 'accounting_version' <> 'phase5-v1'
      and ledger_row.metadata ->> 'accountingVersion' <> 'phase5-v1'
    )
  then
    return null;
  end if;

  select payment.* into payment_row
  from public.payments payment
  where payment.id = ledger_row.payment_id
  for update;

  select event.* into event_row
  from public.events event
  where event.id = ledger_row.event_id
  for update;

  if payment_row.id is null
    or event_row.id is null
    or payment_row.payer_id is distinct from event_row.client_id
    or payment_row.status not in ('paid', 'verified')
  then
    return null;
  end if;

  if refund_reason = 'client_cancellation' then
    local_today := public.phase11_event_local_date(event_row.timezone);
    if event_row.status::text <> 'cancelled'
      or event_row.event_date is null
      or local_today is null
      or event_row.event_date <= local_today + 14
    then
      return null;
    end if;
  elsif not (
    ledger_row.metadata ? 'provider_rejected_at'
    or ledger_row.metadata ? 'coordinator_rejected_at'
  ) then
    return null;
  end if;

  select exists (
    select 1
    from public.provider_payout_requests request
    where ledger_row.provider_id is not null
      and request.provider_id = ledger_row.provider_id
      and request.status in ('requested', 'processing', 'paid')
  ) into recipient_payout_linked;

  if ledger_row.amount_released > 0
    or ledger_row.provider_funds_status in ('legacy', 'initial_share_credited', 'payout_pending', 'paid_out')
    or recipient_payout_linked
  then
    perform set_config('app.phase11_receivable_release_authorized', 'true', true);
    update public.financial_transactions ledger
    set provider_funds_status = 'disputed_on_hold',
        receivable_reconciliation_required = true,
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'financial_hold', true,
          'financial_hold_reason', 'refund_requires_reconciliation',
          'refund_status', 'manual_reconciliation_required',
          'refund_reason', refund_reason,
          'provider_release', false
        ),
        updated_at = now()
    where ledger.id = ledger_row.id;
    return null;
  end if;

  refund_amount := round(coalesce(payment_row.amount, 0), 2);
  if refund_amount <= 0 then
    return null;
  end if;

  insert into public.client_wallet_transactions (
    client_id,
    financial_transaction_id,
    payment_id,
    event_id,
    booking_id,
    transaction_type,
    status,
    amount,
    currency,
    metadata
  ) values (
    event_row.client_id,
    ledger_row.id,
    payment_row.id,
    event_row.id,
    ledger_row.booking_id,
    'refund_credit',
    'available',
    refund_amount,
    coalesce(nullif(payment_row.currency, ''), 'PHP'),
    jsonb_build_object(
      'refundReason', refund_reason,
      'paymentScope', payment_row.payment_scope,
      'originalInitialPayment', refund_amount,
      'providerInitialAllocation', coalesce(payment_row.provider_initial_allocation, 0),
      'platformFeeAmount', coalesce(payment_row.platform_fee_amount, 0)
    )
  ) on conflict (financial_transaction_id) where transaction_type = 'refund_credit'
    do nothing
  returning id into wallet_transaction_id;

  if wallet_transaction_id is null then
    select wallet.id into wallet_transaction_id
    from public.client_wallet_transactions wallet
    where wallet.financial_transaction_id = ledger_row.id
      and wallet.transaction_type = 'refund_credit';
    return wallet_transaction_id;
  end if;

  perform set_config('app.phase11_client_wallet_refund_authorized', 'true', true);
  update public.financial_transactions ledger
  set provider_net_amount = 0,
      held_provider_amount = 0,
      provider_funds_status = 'refunded',
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_hold', false,
        'provider_release', false,
        'receivable_state', 'refunded',
        'refund_status', 'wallet_credited',
        'refund_reason', refund_reason,
        'refund_amount', refund_amount,
        'refund_wallet_transaction_id', wallet_transaction_id,
        'refund_completed_at', now(),
        'refunded_provider_allocation', coalesce(ledger.provider_net_amount, 0)
          + coalesce(ledger.held_provider_amount, 0)
      ),
      updated_at = now()
  where ledger.id = ledger_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Refund added to your MULTIVENT Wallet',
    format('PHP %s is now available in your wallet for the affected booking.',
      to_char(refund_amount, 'FM999,999,999,990.00')),
    'wallet_refund',
    wallet_transaction_id
  );

  return wallet_transaction_id;
end;
$$;

-- Client event cancellations are processed only after the existing V11 hold
-- trigger has frozen each allocation. The date comparison deliberately uses
-- the same authoritative event-local calendar date as payout eligibility.
create or replace function public.phase11_credit_cancelled_event_wallet_refunds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_row record;
begin
  if new.status is not distinct from old.status or new.status::text <> 'cancelled' then
    return new;
  end if;

  for ledger_row in
    select ledger.id
    from public.financial_transactions ledger
    where ledger.event_id = new.id
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.provider_funds_status <> 'refunded'
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      )
    order by ledger.id
  loop
    perform public.credit_phase11_client_wallet_refund(
      ledger_row.id,
      'client_cancellation'
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists phase11_wallet_refund_cancelled_event_trigger on public.events;
create trigger phase11_wallet_refund_cancelled_event_trigger
after update of status on public.events
for each row execute function public.phase11_credit_cancelled_event_wallet_refunds();

-- Provider and coordinator decline paths already mark only their own ledger
-- row as rejected-held. Hooking this state keeps refunds item-specific even
-- when an event retains other active bookings.
create or replace function public.phase11_credit_declined_recipient_wallet_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_funds_status = 'rejected_held'
    and new.transaction_type = 'booking_payment'
    and new.status in ('paid', 'verified')
    and (
      new.metadata ? 'provider_rejected_at'
      or new.metadata ? 'coordinator_rejected_at'
    )
  then
    perform public.credit_phase11_client_wallet_refund(new.id, 'recipient_declined');
  end if;
  return new;
end;
$$;

drop trigger if exists phase11_wallet_refund_declined_recipient_trigger
  on public.financial_transactions;
create trigger phase11_wallet_refund_declined_recipient_trigger
after update of provider_funds_status, metadata on public.financial_transactions
for each row execute function public.phase11_credit_declined_recipient_wallet_refund();

create or replace function public.get_my_client_wallet()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with wallet_rows as (
    select wallet.*, event.name as event_name, event.event_date,
      service.name as service_name
    from public.client_wallet_transactions wallet
    join public.events event on event.id = wallet.event_id
    left join public.bookings booking on booking.id = wallet.booking_id
    left join public.services service on service.id = booking.service_id
    where wallet.client_id = auth.uid()
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP',
      'availableBalance', round(coalesce(sum(row.amount) filter (
        where row.status = 'available'
      ), 0), 2),
      'totalRefunded', round(coalesce(sum(row.amount) filter (
        where row.transaction_type = 'refund_credit'
      ), 0), 2)
    ),
    'transactions', coalesce(jsonb_agg(jsonb_build_object(
      'id', row.id,
      'amount', round(row.amount, 2),
      'currency', row.currency,
      'status', row.status,
      'type', row.transaction_type,
      'reference', 'RF-' || upper(substr(row.id::text, 1, 8)),
      'eventId', row.event_id,
      'eventName', coalesce(nullif(trim(row.event_name), ''), 'Event'),
      'eventDate', row.event_date,
      'serviceName', coalesce(nullif(trim(row.service_name), ''), 'Coordinator booking'),
      'reason', coalesce(row.metadata ->> 'refundReason', 'refund'),
      'createdAt', row.created_at
    ) order by row.created_at desc, row.id desc), '[]'::jsonb)
  )
  from wallet_rows row;
$$;

revoke all on function public.credit_phase11_client_wallet_refund(uuid, text) from public;
revoke all on function public.phase11_credit_cancelled_event_wallet_refunds() from public;
revoke all on function public.phase11_credit_declined_recipient_wallet_refund() from public;
revoke all on function public.get_my_client_wallet() from public;
grant execute on function public.get_my_client_wallet() to authenticated;

comment on table public.client_wallet_transactions is
  'Immutable client wallet credits. V11 refunds credit this wallet; they do not represent external disbursements.';
comment on function public.credit_phase11_client_wallet_refund(uuid, text) is
  'Secured idempotent V11 wallet credit for eligible client cancellations and recipient declines.';
comment on function public.get_my_client_wallet() is
  'Returns only the authenticated client''s available MULTIVENT wallet credits.';

commit;
