-- MULTIVENT Revision V14, Phase 5: bank-settlement financial tracking.
-- See the following migration blocks for external payment and refund records.

begin;

-- One record per payment describes the external bank or processor settlement
-- route. It is accounting metadata, never stored-value wallet money.
create table if not exists public.payment_settlement_records (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  settlement_environment text not null default 'prototype'
    check (settlement_environment in ('prototype', 'sandbox', 'live')),
  settlement_channel text not null
    check (settlement_channel in ('manual_bank_transfer', 'e_wallet_checkout')),
  merchant_destination text not null default 'designated_multivent_settlement',
  verification_status text not null default 'pending_verification'
    check (verification_status in ('pending_verification', 'verified', 'failed', 'cancelled', 'refunded')),
  external_reference text,
  verification_source text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_settlement_records_status_idx
  on public.payment_settlement_records (verification_status, created_at desc);
alter table public.payment_settlement_records enable row level security;
revoke all on table public.payment_settlement_records from anon, authenticated;

-- New refunds are external obligations. They do not create a client wallet
-- balance and cannot be moved by the client inside the app.
create table if not exists public.client_refund_disbursements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  financial_transaction_id uuid not null unique
    references public.financial_transactions(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  disbursement_channel text not null default 'unassigned'
    check (disbursement_channel in ('unassigned', 'bank_transfer', 'e_wallet')),
  status text not null default 'pending_destination'
    check (status in ('pending_destination', 'pending_disbursement', 'processing',
      'completed', 'failed', 'requires_reconciliation', 'cancelled')),
  external_reference text,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_refund_disbursements_client_idx
  on public.client_refund_disbursements (client_id, created_at desc);
create index if not exists client_refund_disbursements_status_idx
  on public.client_refund_disbursements (status, created_at desc);
alter table public.client_refund_disbursements enable row level security;
revoke all on table public.client_refund_disbursements from anon, authenticated;

-- The existing system-settings table holds non-secret client-facing payment
-- instructions under `v14_payment_settlement`. Unconfigured deployments stay
-- explicitly in prototype mode rather than suggesting real bank collection.
create or replace function public.get_v14_payment_settlement_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  configuration jsonb := '{}'::jsonb;
  environment_value text := 'prototype';
  bank_enabled boolean := true;
  wallet_enabled boolean := true;
  bank_name_value text;
  account_name_value text;
  account_number_value text;
  bank_instructions_value text;
  wallet_provider_value text;
begin
  select coalesce(setting.value, '{}'::jsonb) into configuration
  from public.system_settings setting
  where setting.key = 'v14_payment_settlement'
  limit 1;

  environment_value := lower(coalesce(nullif(configuration ->> 'environment', ''), 'prototype'));
  if environment_value not in ('prototype', 'sandbox', 'live') then environment_value := 'prototype'; end if;
  bank_enabled := case lower(coalesce(configuration ->> 'manualBankTransferEnabled', 'true')) when 'false' then false else true end;
  wallet_enabled := case lower(coalesce(configuration ->> 'eWalletCheckoutEnabled', 'true')) when 'false' then false else true end;
  bank_name_value := nullif(trim(configuration ->> 'bankName'), '');
  account_name_value := nullif(trim(configuration ->> 'bankAccountName'), '');
  account_number_value := nullif(trim(configuration ->> 'bankAccountNumber'), '');
  bank_instructions_value := nullif(trim(configuration ->> 'manualBankInstructions'), '');
  wallet_provider_value := nullif(trim(configuration ->> 'eWalletCheckoutProvider'), '');

  return jsonb_build_object(
    'environment', environment_value,
    'merchantLabel', coalesce(nullif(trim(configuration ->> 'merchantLabel'), ''), 'MULTIVENT designated settlement'),
    'manualBankTransfer', jsonb_build_object(
      'enabled', bank_enabled,
      'configured', bank_name_value is not null and account_name_value is not null and account_number_value is not null,
      'bankName', bank_name_value,
      'accountName', account_name_value,
      'accountNumber', account_number_value,
      'instructions', coalesce(bank_instructions_value, case when environment_value = 'live'
        then 'Use only the designated MULTIVENT bank account shown here and include your booking reference.'
        else 'Prototype mode: no live bank account is configured. Starting payment records a pending verification request only.' end)
    ),
    'eWalletCheckout', jsonb_build_object(
      'enabled', wallet_enabled,
      'configured', wallet_provider_value is not null,
      'provider', wallet_provider_value,
      'instructions', case when wallet_provider_value is not null
        then 'Complete checkout with the supported e-wallet provider. Collection is recognized only after authoritative processor confirmation.'
        else 'Prototype mode: no e-wallet processor is connected. Starting payment records a pending verification request only.' end
    )
  );
end;
$$;

-- A mobile client can create only a pending V14 attempt. Neither a reference
-- nor frontend state can set a paid or verified status.
create or replace function public.enforce_v14_authoritative_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4' then return new; end if;
  if tg_op = 'INSERT' and new.status <> 'pending'
    and auth.role() <> 'service_role'
    and coalesce(current_setting('app.v14_payment_verification_authorized', true), '') <> 'true'
  then
    raise exception 'Client checkout can only create a pending payment. Payment verification requires an authorized settlement confirmation.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.status in ('paid', 'verified') and new.status is distinct from old.status
    and auth.role() <> 'service_role'
    and coalesce(current_setting('app.v14_payment_verification_authorized', true), '') <> 'true'
  then
    raise exception 'Payment verification requires an authorized settlement confirmation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists aab_enforce_v14_authoritative_payment_status_trigger on public.payments;
create trigger aab_enforce_v14_authoritative_payment_status_trigger
before insert or update of status on public.payments
for each row execute function public.enforce_v14_authoritative_payment_status();

-- This record tracks the designated settlement route only. The established
-- paid/verified ledger trigger remains the sole creator of receivables.
create or replace function public.track_v14_payment_settlement_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  context jsonb;
  environment_value text;
  channel_value text;
  status_value text;
begin
  if coalesce(new.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4' then return new; end if;
  context := public.get_v14_payment_settlement_context();
  environment_value := coalesce(context ->> 'environment', 'prototype');
  channel_value := case when new.provider = 'bankTransfer' then 'manual_bank_transfer' else 'e_wallet_checkout' end;
  status_value := case new.status
    when 'paid' then 'verified' when 'verified' then 'verified'
    when 'failed' then 'failed' when 'cancelled' then 'cancelled'
    when 'refunded' then 'refunded' else 'pending_verification' end;

  insert into public.payment_settlement_records (
    payment_id, amount, currency, settlement_environment, settlement_channel,
    merchant_destination, verification_status, external_reference, verification_source,
    verified_at, verified_by, metadata
  ) values (
    new.id, round(coalesce(new.amount, 0), 2), coalesce(nullif(new.currency, ''), 'PHP'),
    environment_value, channel_value, 'designated_multivent_settlement', status_value,
    nullif(trim(new.provider_reference), ''), case when status_value = 'verified' then 'authorized_payment_status' else null end,
    case when status_value = 'verified' then coalesce(new.verified_at, new.paid_at, now()) else null end,
    case when status_value = 'verified' then auth.uid() else null end,
    jsonb_build_object('accountingModel', 'external_settlement_tracking', 'bookingFlowVersion', 'v14-phase4',
      'paymentMethod', new.provider, 'paymentType', coalesce(new.metadata ->> 'paymentType', 'deposit'))
  ) on conflict (payment_id) do update set
    amount = excluded.amount, currency = excluded.currency,
    settlement_environment = excluded.settlement_environment, settlement_channel = excluded.settlement_channel,
    verification_status = excluded.verification_status,
    external_reference = coalesce(excluded.external_reference, public.payment_settlement_records.external_reference),
    verification_source = coalesce(excluded.verification_source, public.payment_settlement_records.verification_source),
    verified_at = coalesce(excluded.verified_at, public.payment_settlement_records.verified_at),
    verified_by = coalesce(excluded.verified_by, public.payment_settlement_records.verified_by),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists v14_track_payment_settlement_record_trigger on public.payments;
create trigger v14_track_payment_settlement_record_trigger
after insert or update of status, amount, provider, provider_reference on public.payments
for each row execute function public.track_v14_payment_settlement_record();

-- Staff reconciliation is the only authenticated route into the verified
-- lifecycle. A future verified payment-processor webhook may act as service
-- role, but a client proof/reference can never call this routine.
create or replace function public.verify_v14_payment_settlement(
  target_payment_id uuid,
  authoritative_reference text,
  verification_source_value text default 'manual_bank_reconciliation'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  reference_value text := nullif(trim(authoritative_reference), '');
  source_value text := nullif(trim(verification_source_value), '');
begin
  if not public.has_permission('remittance.verify') then raise exception 'Settlement-verification access is required.' using errcode = '42501'; end if;
  if reference_value is null or char_length(reference_value) < 4 then raise exception 'An authoritative bank or processor reference is required.' using errcode = '22023'; end if;
  select payment.* into payment_row from public.payments payment where payment.id = target_payment_id for update;
  if payment_row.id is null or coalesce(payment_row.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4' then raise exception 'V14 payment record not found.' using errcode = 'P0002'; end if;
  if payment_row.status in ('refunded', 'cancelled') then raise exception 'A cancelled or refunded payment cannot be verified.' using errcode = '22023'; end if;

  perform set_config('app.v14_payment_verification_authorized', 'true', true);
  update public.payments set status = 'verified', provider_reference = reference_value,
    paid_at = coalesce(paid_at, now()), verified_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('settlementVerificationSource', coalesce(source_value, 'authorized_reconciliation'), 'settlementVerifiedAt', now()),
    updated_at = now()
  where id = payment_row.id;
  update public.payment_settlement_records set verification_status = 'verified', external_reference = reference_value,
    verification_source = coalesce(source_value, 'authorized_reconciliation'), verified_at = now(), verified_by = auth.uid(), updated_at = now()
  where payment_id = payment_row.id;
  return jsonb_build_object('paymentId', payment_row.id, 'paymentStatus', 'verified', 'settlementStatus', 'verified', 'reference', reference_value);
end;
$$;

-- Retire only the old automatic-wallet triggers. Historical rows and helper
-- routines remain available for audit, but new refunds must be external
-- obligations until an actual bank/e-wallet disbursement is recorded.
drop trigger if exists phase11_wallet_refund_cancelled_event_trigger on public.events;
drop trigger if exists phase11_wallet_refund_declined_recipient_trigger on public.financial_transactions;

create or replace function public.create_v14_external_refund_obligation(
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
  refund_id uuid;
  local_today date;
  already_paid_out boolean := false;
  refund_amount numeric(12,2);
  refund_status_value text := 'pending_destination';
begin
  if refund_reason not in ('client_cancellation', 'recipient_declined') then
    raise exception 'Unsupported automatic refund reason.' using errcode = '22023';
  end if;
  select ledger.* into ledger_row from public.financial_transactions ledger where ledger.id = target_ledger_id for update;
  if ledger_row.id is null or ledger_row.transaction_type <> 'booking_payment'
    or ledger_row.status not in ('paid', 'verified')
    or (ledger_row.metadata ->> 'accounting_version' <> 'phase5-v1'
      and ledger_row.metadata ->> 'accountingVersion' <> 'phase5-v1')
  then return null; end if;

  -- Never automatically convert a historic wallet record into a bank refund.
  if exists (select 1 from public.client_wallet_transactions historic_wallet
    where historic_wallet.financial_transaction_id = ledger_row.id) then return null; end if;

  select payment.* into payment_row from public.payments payment where payment.id = ledger_row.payment_id for update;
  select event.* into event_row from public.events event where event.id = ledger_row.event_id for update;
  if payment_row.id is null or event_row.id is null or payment_row.payer_id is distinct from event_row.client_id
    or payment_row.status not in ('paid', 'verified') then return null; end if;

  if refund_reason = 'client_cancellation' then
    local_today := public.phase11_event_local_date(event_row.timezone);
    if event_row.status::text <> 'cancelled' or event_row.event_date is null
      or local_today is null or event_row.event_date <= local_today + 14 then return null; end if;
  elsif not (ledger_row.metadata ? 'provider_rejected_at' or ledger_row.metadata ? 'coordinator_rejected_at') then
    return null;
  end if;

  refund_amount := round(coalesce(payment_row.amount, 0), 2);
  if refund_amount <= 0 then return null; end if;
  select exists (
    select 1 from public.provider_payout_requests request
    where ledger_row.provider_id is not null and request.provider_id = ledger_row.provider_id
      and request.status in ('requested', 'processing', 'paid')
  ) or ledger_row.amount_released > 0
    or ledger_row.provider_funds_status in ('legacy', 'initial_share_credited', 'payout_pending', 'paid_out')
  into already_paid_out;
  if already_paid_out then refund_status_value := 'requires_reconciliation'; end if;

  insert into public.client_refund_disbursements (
    client_id, financial_transaction_id, payment_id, event_id, booking_id,
    amount, currency, status, metadata
  ) values (
    event_row.client_id, ledger_row.id, payment_row.id, event_row.id, ledger_row.booking_id,
    refund_amount, coalesce(nullif(payment_row.currency, ''), 'PHP'), refund_status_value,
    jsonb_build_object(
      'accountingModel', 'external_refund_obligation',
      'refundReason', refund_reason,
      'paymentScope', payment_row.payment_scope,
      'paymentSettlementEnvironment', coalesce((select settlement.settlement_environment
        from public.payment_settlement_records settlement where settlement.payment_id = payment_row.id), 'historical_unclassified'),
      'requiresManualDestination', refund_status_value = 'pending_destination',
      'requiresReconciliation', refund_status_value = 'requires_reconciliation'
    )
  ) on conflict (financial_transaction_id) do update
    set updated_at = public.client_refund_disbursements.updated_at
  returning id into refund_id;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);
  if refund_status_value = 'requires_reconciliation' then
    update public.financial_transactions ledger set
      provider_funds_status = 'disputed_on_hold', receivable_reconciliation_required = true,
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_hold', true, 'financial_hold_reason', 'external_refund_requires_reconciliation',
        'refund_status', 'requires_reconciliation', 'refund_reason', refund_reason,
        'refund_disbursement_id', refund_id, 'provider_release', false),
      updated_at = now()
    where ledger.id = ledger_row.id;
  else
    update public.financial_transactions ledger set
      provider_net_amount = 0, held_provider_amount = 0, provider_funds_status = 'disputed_on_hold',
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'financial_hold', true, 'financial_hold_reason', 'external_refund_pending_disbursement',
        'receivable_state', 'refund_pending_disbursement', 'refund_status', 'pending_destination',
        'refund_reason', refund_reason, 'refund_amount', refund_amount,
        'refund_disbursement_id', refund_id, 'provider_release', false),
      updated_at = now()
    where ledger.id = ledger_row.id;
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    case when refund_status_value = 'requires_reconciliation'
      then 'Refund requires reconciliation' else 'Refund queued for external disbursement' end,
    case when refund_status_value = 'requires_reconciliation'
      then 'Your refund is recorded and requires financial reconciliation before an external transfer can be completed.'
      else format('PHP %s is recorded as a refund obligation. It is not an in-app wallet balance.',
        to_char(refund_amount, 'FM999,999,999,990.00')) end,
    'refund_disbursement', refund_id
  );
  return refund_id;
end;
$$;

create or replace function public.phase14_queue_cancelled_event_refunds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare ledger_row record;
begin
  if new.status is not distinct from old.status or new.status::text <> 'cancelled' then return new; end if;
  for ledger_row in
    select ledger.id from public.financial_transactions ledger
    where ledger.event_id = new.id and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and not exists (select 1 from public.client_refund_disbursements refund where refund.financial_transaction_id = ledger.id)
    order by ledger.id
  loop
    perform public.create_v14_external_refund_obligation(ledger_row.id, 'client_cancellation');
  end loop;
  return new;
end;
$$;

drop trigger if exists phase14_queue_cancelled_event_refunds_trigger on public.events;
create trigger phase14_queue_cancelled_event_refunds_trigger
after update of status on public.events
for each row execute function public.phase14_queue_cancelled_event_refunds();

create or replace function public.phase14_queue_declined_recipient_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_funds_status = 'rejected_held' and new.transaction_type = 'booking_payment'
    and new.status in ('paid', 'verified')
    and (new.metadata ? 'provider_rejected_at' or new.metadata ? 'coordinator_rejected_at')
  then perform public.create_v14_external_refund_obligation(new.id, 'recipient_declined'); end if;
  return new;
end;
$$;

drop trigger if exists phase14_queue_declined_recipient_refund_trigger on public.financial_transactions;
create trigger phase14_queue_declined_recipient_refund_trigger
after update of provider_funds_status, metadata on public.financial_transactions
for each row execute function public.phase14_queue_declined_recipient_refund();

-- Client-safe external refund tracking. Historic wallet credits are separate
-- compatibility records, not a current balance and not a completed transfer.
create or replace function public.get_my_client_refund_overview_v14()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with external_rows as (
    select refund.*, event.name as event_name, event.event_date, service.name as service_name
    from public.client_refund_disbursements refund
    join public.events event on event.id = refund.event_id
    left join public.bookings booking on booking.id = refund.booking_id
    left join public.services service on service.id = booking.service_id
    where refund.client_id = auth.uid()
  ), legacy_rows as (
    select wallet.*, event.name as event_name, event.event_date, service.name as service_name
    from public.client_wallet_transactions wallet
    join public.events event on event.id = wallet.event_id
    left join public.bookings booking on booking.id = wallet.booking_id
    left join public.services service on service.id = booking.service_id
    where wallet.client_id = auth.uid()
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'currency', 'PHP',
      'pendingExternalDisbursements', round(coalesce((select sum(row.amount) from external_rows row
        where row.status in ('pending_destination', 'pending_disbursement', 'processing')), 0), 2),
      'completedRefunds', round(coalesce((select sum(row.amount) from external_rows row where row.status = 'completed'), 0), 2),
      'requiresReconciliation', round(coalesce((select sum(row.amount) from external_rows row where row.status = 'requires_reconciliation'), 0), 2),
      'historicalWalletCredits', round(coalesce((select sum(row.amount) from legacy_rows row), 0), 2)
    ),
    'refunds', coalesce((select jsonb_agg(jsonb_build_object(
      'id', row.id, 'amount', round(row.amount, 2), 'currency', row.currency,
      'status', row.status, 'channel', row.disbursement_channel, 'reference', row.external_reference,
      'eventId', row.event_id, 'eventName', coalesce(nullif(trim(row.event_name), ''), 'Event'),
      'eventDate', row.event_date, 'serviceName', coalesce(nullif(trim(row.service_name), ''), 'Coordinator booking'),
      'reason', coalesce(row.metadata ->> 'refundReason', 'refund'),
      'createdAt', row.created_at, 'processedAt', row.processed_at
    ) order by row.created_at desc, row.id desc) from external_rows row), '[]'::jsonb),
    'historicalRecords', coalesce((select jsonb_agg(jsonb_build_object(
      'id', row.id, 'amount', round(row.amount, 2), 'currency', row.currency,
      'eventId', row.event_id, 'eventName', coalesce(nullif(trim(row.event_name), ''), 'Event'),
      'eventDate', row.event_date, 'serviceName', coalesce(nullif(trim(row.service_name), ''), 'Coordinator booking'),
      'reason', coalesce(row.metadata ->> 'refundReason', 'refund'),
      'createdAt', row.created_at, 'reference', 'LEGACY-RF-' || upper(substr(row.id::text, 1, 8))
    ) order by row.created_at desc, row.id desc) from legacy_rows row), '[]'::jsonb)
  );
$$;

-- An authorized settlement operator records an actual external outcome. It
-- never rewrites the recognized original client payment into a simulated
-- refund; the disbursement record is the explicit refund evidence.
create or replace function public.record_v14_refund_disbursement(
  target_refund_id uuid,
  next_status text,
  external_reference_value text default null,
  channel_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.client_refund_disbursements%rowtype;
  reference_value text := nullif(trim(external_reference_value), '');
  normalized_channel text := lower(coalesce(nullif(trim(channel_value), ''), ''));
begin
  if not public.has_permission('remittance.verify') then raise exception 'Settlement-verification access is required.' using errcode = '42501'; end if;
  if next_status not in ('pending_disbursement', 'processing', 'completed', 'failed', 'cancelled') then raise exception 'Unsupported refund-disbursement status.' using errcode = '22023'; end if;
  if next_status = 'completed' and (reference_value is null or char_length(reference_value) < 4) then raise exception 'A bank or processor reference is required before completing a refund.' using errcode = '22023'; end if;
  if normalized_channel not in ('', 'bank_transfer', 'e_wallet') then raise exception 'Unsupported refund-disbursement channel.' using errcode = '22023'; end if;

  select refund.* into refund_row from public.client_refund_disbursements refund
  where refund.id = target_refund_id for update;
  if refund_row.id is null then raise exception 'Refund-disbursement record not found.' using errcode = 'P0002'; end if;
  if refund_row.status = 'completed' and next_status <> 'completed' then raise exception 'A completed refund-disbursement record is immutable.' using errcode = '42501'; end if;

  update public.client_refund_disbursements set
    status = next_status,
    disbursement_channel = case when normalized_channel = '' then disbursement_channel else normalized_channel end,
    external_reference = coalesce(reference_value, external_reference),
    processed_at = case when next_status = 'completed' then now() else processed_at end,
    processed_by = case when next_status = 'completed' then auth.uid() else processed_by end,
    metadata = metadata || jsonb_build_object('lastStatusChangedAt', now()), updated_at = now()
  where id = refund_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    refund_row.client_id,
    case next_status when 'completed' then 'Refund disbursement completed'
      when 'processing' then 'Refund disbursement is processing'
      when 'failed' then 'Refund disbursement needs attention'
      when 'cancelled' then 'Refund disbursement cancelled'
      else 'Refund ready for external disbursement' end,
    case next_status when 'completed' then 'Your external refund transfer has been recorded as completed.'
      when 'processing' then 'Your external refund transfer is being processed.'
      when 'failed' then 'Your external refund transfer could not be completed. MULTIVENT will review the payout details.'
      when 'cancelled' then 'Your external refund transfer was cancelled and requires review.'
      else 'Your refund is ready for authorized bank or e-wallet disbursement.' end,
    'refund_disbursement', refund_row.id
  );
  return jsonb_build_object('refundId', refund_row.id, 'status', next_status,
    'externalReference', coalesce(reference_value, refund_row.external_reference));
end;
$$;

revoke all on function public.get_v14_payment_settlement_context() from public;
revoke all on function public.enforce_v14_authoritative_payment_status() from public;
revoke all on function public.track_v14_payment_settlement_record() from public;
revoke all on function public.verify_v14_payment_settlement(uuid, text, text) from public;
revoke all on function public.create_v14_external_refund_obligation(uuid, text) from public;
revoke all on function public.phase14_queue_cancelled_event_refunds() from public;
revoke all on function public.phase14_queue_declined_recipient_refund() from public;
revoke all on function public.get_my_client_refund_overview_v14() from public;
revoke all on function public.record_v14_refund_disbursement(uuid, text, text, text) from public;
grant execute on function public.get_v14_payment_settlement_context() to authenticated;
grant execute on function public.get_my_client_refund_overview_v14() to authenticated;
grant execute on function public.verify_v14_payment_settlement(uuid, text, text) to authenticated;
grant execute on function public.record_v14_refund_disbursement(uuid, text, text, text) to authenticated;

comment on table public.payment_settlement_records is
  'External bank/processor settlement tracking for V14 payments; not an internal MULTIVENT cash wallet.';
comment on table public.client_refund_disbursements is
  'External refund obligations and outcomes. Pending rows are not client wallet balances or completed transfers.';
comment on function public.get_my_client_refund_overview_v14() is
  'Client-safe external refund tracking with separate read-only historical wallet-credit records.';

commit;
