-- MULTIVENT Revision V16: PayMongo hosted checkout collection.
-- This migration is additive. V14 remains the authority for acceptance,
-- quote calculation, 35% terms, receivable creation, holds, and refunds.

begin;

create table if not exists public.paymongo_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  payment_type text not null check (payment_type in ('deposit', 'full')),
  checkout_reference text not null unique,
  amount numeric(12,2) not null check (amount > 0),
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  environment text not null default 'test' check (environment in ('test', 'live')),
  status text not null default 'created' check (status in (
    'created', 'creating_checkout', 'checkout_created', 'verified', 'failed', 'cancelled'
  )),
  paymongo_checkout_session_id text unique,
  paymongo_payment_id text unique,
  checkout_url text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create unique index if not exists paymongo_payment_attempts_one_active_event
  on public.paymongo_payment_attempts (event_id)
  where status in ('created', 'creating_checkout', 'checkout_created');
create index if not exists paymongo_payment_attempts_client_idx
  on public.paymongo_payment_attempts (client_id, created_at desc);

create table if not exists public.paymongo_payment_attempt_items (
  attempt_id uuid not null references public.paymongo_payment_attempts(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (attempt_id, payment_id),
  unique (payment_id)
);

create table if not exists public.paymongo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  external_event_id text not null unique,
  event_type text not null,
  livemode boolean not null,
  checkout_session_id text,
  signature_verified boolean not null default false,
  processing_status text not null check (processing_status in ('received', 'ignored', 'processed', 'failed', 'duplicate')),
  processing_error text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.paymongo_payment_attempts enable row level security;
alter table public.paymongo_payment_attempt_items enable row level security;
alter table public.paymongo_webhook_events enable row level security;
revoke all on public.paymongo_payment_attempts, public.paymongo_payment_attempt_items,
  public.paymongo_webhook_events from public, anon, authenticated;

-- The client may create an eligible server-authoritative attempt, but it may
-- never supply an amount, a recipient split, or a verified state.
create or replace function public.prepare_my_paymongo_checkout_v16(
  target_event_id uuid,
  selected_payment_type text,
  terms_accepted boolean,
  target_environment text default 'test'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  payment_quote jsonb;
  existing_attempt public.paymongo_payment_attempts%rowtype;
  created_attempt public.paymongo_payment_attempts%rowtype;
  collection_settings jsonb := '{}'::jsonb;
  collect_full_payment boolean := false;
  amount_value numeric(12,2);
begin
  if selected_payment_type not in ('deposit', 'full') then
    raise exception 'Choose either the required downpayment or payment in full.' using errcode = '22023';
  end if;
  if target_environment not in ('test', 'live') then
    raise exception 'Unknown payment environment.' using errcode = '22023';
  end if;
  if not terms_accepted then
    raise exception 'Accept the booking and cancellation terms first.' using errcode = '42501';
  end if;

  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
  for update;
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  -- Full platform collection is intentionally opt-in. Until a business owner
  -- explicitly enables it, sandbox/live V16 collects only the established 35%.
  select coalesce(setting.value, '{}'::jsonb) into collection_settings
  from public.system_settings setting where setting.key = 'v16_paymongo_collection' limit 1;
  collect_full_payment := coalesce((collection_settings ->> 'collectFullPayment')::boolean, false);
  if selected_payment_type = 'full' and not collect_full_payment then
    raise exception 'Full-payment collection is not enabled. MULTIVENT currently collects the required downpayment only.' using errcode = '42501';
  end if;

  select * into existing_attempt from public.paymongo_payment_attempts attempt
  where attempt.event_id = event_row.id
    and attempt.status in ('created', 'creating_checkout', 'checkout_created', 'failed')
  order by attempt.created_at desc
  limit 1
  for update;
  if existing_attempt.id is not null then
    if existing_attempt.status = 'failed' then
      update public.paymongo_payment_attempts attempt
      set status = 'created', failure_reason = null, checkout_url = null,
          paymongo_checkout_session_id = null, updated_at = now()
      where attempt.id = existing_attempt.id
      returning * into existing_attempt;
    end if;
    return jsonb_build_object(
      'attemptId', existing_attempt.id,
      'checkoutReference', existing_attempt.checkout_reference,
      'checkoutUrl', existing_attempt.checkout_url,
      'status', existing_attempt.status,
      'amount', existing_attempt.amount,
      'currency', existing_attempt.currency,
      'reused', true
    );
  end if;

  -- V14 writes pending, immutable per-recipient records only after all
  -- required acceptances. It never marks them paid or creates receivables.
  perform public.initiate_my_event_payment_v14(
    event_row.id, selected_payment_type, 'eWallet', terms_accepted
  );
  payment_quote := public.get_my_event_payment_quote_v14(event_row.id);
  amount_value := round(case when selected_payment_type = 'full'
    then coalesce((payment_quote -> 'breakdown' ->> 'clientTotal')::numeric, 0)
    else coalesce((payment_quote -> 'breakdown' ->> 'initialPayment')::numeric, 0)
  end, 2);
  if amount_value <= 0 then
    raise exception 'The authoritative payment amount is invalid.' using errcode = '22023';
  end if;

  insert into public.paymongo_payment_attempts (
    event_id, client_id, payment_type, checkout_reference, amount, amount_centavos,
    environment, metadata
  ) values (
    event_row.id, event_row.client_id, selected_payment_type,
    format('mv-v16-%s-%s-%s', event_row.id, selected_payment_type, gen_random_uuid()),
    amount_value, round(amount_value * 100)::bigint, target_environment,
    jsonb_build_object('eventName', event_row.name, 'termsAccepted', true, 'quote', payment_quote)
  ) returning * into created_attempt;

  insert into public.paymongo_payment_attempt_items (attempt_id, payment_id)
  select created_attempt.id, payment.id
  from public.payments payment
  where payment.event_id = event_row.id
    and payment.payer_id = event_row.client_id
    and payment.status in ('pending', 'processing')
    and coalesce(payment.metadata ->> 'bookingFlowVersion', '') = 'v14-phase4'
    and coalesce(payment.metadata ->> 'paymentType', 'deposit') = selected_payment_type;

  if not exists (select 1 from public.paymongo_payment_attempt_items item where item.attempt_id = created_attempt.id) then
    raise exception 'No pending payment records were created for this checkout.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'attemptId', created_attempt.id,
    'checkoutReference', created_attempt.checkout_reference,
    'status', created_attempt.status,
    'amount', created_attempt.amount,
    'amountCentavos', created_attempt.amount_centavos,
    'currency', created_attempt.currency,
    'eventName', event_row.name,
    'reused', false
  );
end;
$$;

create or replace function public.claim_my_paymongo_checkout_v16(target_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  update public.paymongo_payment_attempts attempt
  set status = 'creating_checkout', updated_at = now(), failure_reason = null
  where attempt.id = target_attempt_id
    and attempt.client_id = auth.uid()
    and attempt.status in ('created', 'failed')
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create or replace function public.record_paymongo_checkout_session_v16(
  target_attempt_id uuid,
  external_checkout_session_id text,
  external_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.paymongo_payment_attempts%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server-only checkout recording is required.' using errcode = '42501';
  end if;
  if nullif(trim(external_checkout_session_id), '') is null
    or nullif(trim(external_checkout_url), '') is null
    or external_checkout_url !~ '^https://'
  then raise exception 'Invalid PayMongo checkout response.' using errcode = '22023'; end if;

  update public.paymongo_payment_attempts attempt
  set status = 'checkout_created',
      paymongo_checkout_session_id = trim(external_checkout_session_id),
      checkout_url = trim(external_checkout_url),
      updated_at = now()
  where attempt.id = target_attempt_id and attempt.status = 'creating_checkout'
  returning * into attempt_row;
  if attempt_row.id is null then
    select * into attempt_row from public.paymongo_payment_attempts where id = target_attempt_id;
    if attempt_row.id is null or attempt_row.status <> 'checkout_created' then
      raise exception 'Checkout attempt is no longer available.' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('attemptId', attempt_row.id, 'checkoutUrl', attempt_row.checkout_url,
    'status', attempt_row.status);
end;
$$;

create or replace function public.fail_paymongo_checkout_attempt_v16(
  target_attempt_id uuid,
  failure_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Server-only checkout handling is required.' using errcode = '42501'; end if;
  update public.paymongo_payment_attempts
  set status = 'failed', failure_reason = left(coalesce(nullif(trim(failure_message), 'Checkout creation failed.'), 500)), updated_at = now()
  where id = target_attempt_id and status = 'creating_checkout';
end;
$$;

create or replace function public.process_paymongo_checkout_webhook_v16(
  external_event_id_value text,
  event_type_value text,
  is_livemode boolean,
  external_checkout_session_id text,
  external_payment_id text,
  paid_amount_centavos bigint,
  paid_currency text,
  webhook_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_row public.paymongo_webhook_events%rowtype;
  attempt_row public.paymongo_payment_attempts%rowtype;
  expected_livemode boolean;
begin
  if auth.role() <> 'service_role' then raise exception 'Server-only webhook processing is required.' using errcode = '42501'; end if;
  if nullif(trim(external_event_id_value), '') is null then raise exception 'Webhook event id is required.' using errcode = '22023'; end if;

  insert into public.paymongo_webhook_events (
    external_event_id, event_type, livemode, checkout_session_id, signature_verified,
    processing_status, payload
  ) values (
    trim(external_event_id_value), coalesce(nullif(trim(event_type_value), ''), 'unknown'), is_livemode,
    nullif(trim(external_checkout_session_id), ''), true, 'received', webhook_payload
  ) on conflict (external_event_id) do nothing returning * into webhook_row;
  if webhook_row.id is null then
    return jsonb_build_object('duplicate', true, 'processed', false);
  end if;

  if event_type_value <> 'checkout_session.payment.paid' then
    update public.paymongo_webhook_events set processing_status = 'ignored', processed_at = now()
    where id = webhook_row.id;
    return jsonb_build_object('ignored', true, 'processed', false);
  end if;

  select * into attempt_row from public.paymongo_payment_attempts attempt
  where attempt.paymongo_checkout_session_id = external_checkout_session_id for update;
  if attempt_row.id is null then
    update public.paymongo_webhook_events set processing_status = 'failed', processing_error = 'Unknown checkout session', processed_at = now()
    where id = webhook_row.id;
    raise exception 'Unknown PayMongo checkout session.' using errcode = 'P0002';
  end if;
  expected_livemode := attempt_row.environment = 'live';
  if is_livemode is distinct from expected_livemode
    or paid_currency <> attempt_row.currency
    or paid_amount_centavos <> attempt_row.amount_centavos
    or nullif(trim(external_payment_id), '') is null
  then
    update public.paymongo_webhook_events set processing_status = 'failed', processing_error = 'Payment verification mismatch', processed_at = now()
    where id = webhook_row.id;
    raise exception 'PayMongo webhook did not match the expected checkout.' using errcode = '22023';
  end if;

  if attempt_row.status = 'verified' then
    update public.paymongo_webhook_events set processing_status = 'duplicate', processed_at = now() where id = webhook_row.id;
    return jsonb_build_object('duplicate', true, 'processed', false);
  end if;
  if attempt_row.status <> 'checkout_created' then
    raise exception 'Checkout attempt is not payable.' using errcode = '22023';
  end if;

  -- Existing V14 triggers create immutable ledger and held-receivable records
  -- only here, after the signature-verified external payment has matched.
  update public.payments payment
  set status = 'verified', provider = 'eWallet', provider_reference = trim(external_payment_id),
      paid_at = coalesce(payment.paid_at, now()), verified_at = now(),
      metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
        'paymongoCheckoutSessionId', attempt_row.paymongo_checkout_session_id,
        'paymongoPaymentId', trim(external_payment_id),
        'paymongoVerifiedAt', now(), 'settlementVerificationSource', 'paymongo_webhook'
      ), updated_at = now()
  where payment.id in (
    select item.payment_id from public.paymongo_payment_attempt_items item where item.attempt_id = attempt_row.id
  ) and payment.status in ('pending', 'processing');

  update public.paymongo_payment_attempts
  set status = 'verified', paymongo_payment_id = trim(external_payment_id), verified_at = now(), updated_at = now()
  where id = attempt_row.id;
  update public.paymongo_webhook_events set processing_status = 'processed', processed_at = now() where id = webhook_row.id;
  return jsonb_build_object('processed', true, 'attemptId', attempt_row.id);
exception when others then
  if webhook_row.id is not null then
    update public.paymongo_webhook_events set processing_status = 'failed', processing_error = left(sqlerrm, 500), processed_at = now()
    where id = webhook_row.id and processing_status = 'received';
  end if;
  raise;
end;
$$;

revoke all on function public.prepare_my_paymongo_checkout_v16(uuid, text, boolean, text) from public, anon;
revoke all on function public.claim_my_paymongo_checkout_v16(uuid) from public, anon;
revoke all on function public.record_paymongo_checkout_session_v16(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fail_paymongo_checkout_attempt_v16(uuid, text) from public, anon, authenticated;
revoke all on function public.process_paymongo_checkout_webhook_v16(text, text, boolean, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_my_paymongo_checkout_v16(uuid, text, boolean, text) to authenticated;
grant execute on function public.claim_my_paymongo_checkout_v16(uuid) to authenticated;
grant execute on function public.record_paymongo_checkout_session_v16(uuid, text, text) to service_role;
grant execute on function public.fail_paymongo_checkout_attempt_v16(uuid, text) to service_role;
grant execute on function public.process_paymongo_checkout_webhook_v16(text, text, boolean, text, text, bigint, text, jsonb) to service_role;

comment on table public.paymongo_payment_attempts is
  'V16 hosted checkout attempts. A row is not evidence of payment; only the verified webhook can mark linked V14 payment records verified.';
comment on table public.paymongo_webhook_events is
  'Append-only PayMongo webhook audit and deduplication ledger. Never expose its payload through client reads.';

commit;
