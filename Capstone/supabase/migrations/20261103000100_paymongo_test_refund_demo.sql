-- Demo-only PayMongo refund execution.
--
-- This augments the existing external-refund obligation workflow. It never
-- stores a client bank, card, or e-wallet number, and it may only be executed
-- by a server function configured with a sk_test_ PayMongo key. The database
-- keeps the existing refund amount, permission, hold, and audit protections.

begin;

create table if not exists public.paymongo_test_refund_attempts (
  id uuid primary key default gen_random_uuid(),
  refund_disbursement_id uuid not null unique
    references public.client_refund_disbursements(id) on delete restrict,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  paymongo_payment_id text not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  status text not null default 'created'
    check (status in ('created', 'processing', 'succeeded', 'failed')),
  paymongo_refund_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists paymongo_test_refund_attempts_status_idx
  on public.paymongo_test_refund_attempts(status, created_at desc);

alter table public.paymongo_test_refund_attempts enable row level security;
revoke all on table public.paymongo_test_refund_attempts from public, anon, authenticated;

-- An authorized operations user can prepare exactly one test refund attempt
-- for an eligible refund record. This intentionally returns only processor
-- identifiers and the authoritative amount, never client payment details.
create or replace function public.prepare_v16_paymongo_test_refund(
  target_refund_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.client_refund_disbursements%rowtype;
  payment_row public.payments%rowtype;
  attempt_row public.paymongo_test_refund_attempts%rowtype;
  payment_attempt_row public.paymongo_payment_attempts%rowtype;
  payment_id_value text;
  amount_centavos_value bigint;
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;

  select refund.* into refund_row
  from public.client_refund_disbursements refund
  where refund.id = target_refund_id
  for update;
  if refund_row.id is null then
    raise exception 'Refund-disbursement record not found.' using errcode = 'P0002';
  end if;
  if refund_row.status not in ('pending_destination', 'failed') then
    raise exception 'This refund is not available for a PayMongo test refund.' using errcode = '42501';
  end if;

  select payment.* into payment_row
  from public.payments payment
  where payment.id = refund_row.payment_id
  for update;
  if payment_row.id is null or payment_row.status not in ('paid', 'verified') then
    raise exception 'The original verified payment is unavailable for refund.' using errcode = '42501';
  end if;

  payment_id_value := nullif(trim(payment_row.metadata ->> 'paymongoPaymentId'), '');
  if payment_id_value is null then
    payment_id_value := nullif(trim(payment_row.provider_reference), '');
  end if;
  if payment_id_value is null or payment_id_value !~ '^pay_' then
    raise exception 'This refund was not paid through a PayMongo checkout.' using errcode = '42501';
  end if;

  select attempt.* into payment_attempt_row
  from public.paymongo_payment_attempts attempt
  where attempt.paymongo_payment_id = payment_id_value
    and attempt.environment = 'test'
    and attempt.status = 'verified'
  order by attempt.verified_at desc nulls last, attempt.created_at desc
  limit 1;
  if payment_attempt_row.id is null then
    raise exception 'Only verified PayMongo test payments can be refunded from this demo action.' using errcode = '42501';
  end if;

  amount_centavos_value := round(refund_row.amount * 100)::bigint;
  if amount_centavos_value <= 0 then
    raise exception 'The authoritative refund amount is invalid.' using errcode = '22023';
  end if;

  select attempt.* into attempt_row
  from public.paymongo_test_refund_attempts attempt
  where attempt.refund_disbursement_id = refund_row.id
  for update;

  if attempt_row.id is not null and attempt_row.status in ('created', 'processing', 'succeeded') then
    return jsonb_build_object(
      'attemptId', attempt_row.id,
      'paymentId', attempt_row.paymongo_payment_id,
      'amountCentavos', attempt_row.amount_centavos,
      'currency', attempt_row.currency,
      'status', attempt_row.status,
      'refundId', attempt_row.paymongo_refund_id
    );
  end if;

  insert into public.paymongo_test_refund_attempts (
    refund_disbursement_id, initiated_by, paymongo_payment_id, amount_centavos,
    currency, status, failure_reason, paymongo_refund_id, completed_at
  ) values (
    refund_row.id, auth.uid(), payment_id_value, amount_centavos_value,
    coalesce(nullif(payment_row.currency, ''), 'PHP'), 'created', null, null, null
  ) on conflict (refund_disbursement_id) do update set
    initiated_by = excluded.initiated_by,
    paymongo_payment_id = excluded.paymongo_payment_id,
    amount_centavos = excluded.amount_centavos,
    currency = excluded.currency,
    status = 'created',
    failure_reason = null,
    paymongo_refund_id = null,
    completed_at = null,
    updated_at = now()
  returning * into attempt_row;

  -- A previous processor failure is retryable in the demo. It never releases
  -- provider funds or marks a payment refunded.
  update public.client_refund_disbursements refund
  set status = 'processing',
      disbursement_channel = 'e_wallet',
      external_reference = null,
      metadata = coalesce(refund.metadata, '{}'::jsonb) || jsonb_build_object(
        'paymongoTestRefundAttemptId', attempt_row.id,
        'paymongoTestRefundRequestedAt', now(),
        'paymongoTestOnly', true
      ),
      updated_at = now()
  where refund.id = refund_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, refund_disbursement_id, action, note, acted_by
  ) values (
    'client_refund', refund_row.id, 'paymongo_test_refund_requested',
    'Demo-only PayMongo test refund requested.', auth.uid()
  );

  return jsonb_build_object(
    'attemptId', attempt_row.id,
    'paymentId', attempt_row.paymongo_payment_id,
    'amountCentavos', attempt_row.amount_centavos,
    'currency', attempt_row.currency,
    'status', attempt_row.status
  );
end;
$$;

-- Service-role only: records the PayMongo API result after the edge function
-- has used the test-only secret. A result is never accepted from a browser.
create or replace function public.record_v16_paymongo_test_refund_result(
  target_attempt_id uuid,
  processor_status text,
  processor_refund_id text default null,
  processor_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.paymongo_test_refund_attempts%rowtype;
  refund_row public.client_refund_disbursements%rowtype;
  normalized_status text := lower(coalesce(nullif(trim(processor_status), ''), 'failed'));
  normalized_refund_id text := nullif(trim(processor_refund_id), '');
  normalized_failure text := left(coalesce(nullif(trim(processor_failure_reason), ''), 'PayMongo did not complete the test refund.'), 500);
  next_refund_status text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server-only PayMongo refund recording is required.' using errcode = '42501';
  end if;
  if normalized_status not in ('created', 'processing', 'succeeded', 'failed') then
    raise exception 'Unsupported PayMongo refund status.' using errcode = '22023';
  end if;

  select attempt.* into attempt_row
  from public.paymongo_test_refund_attempts attempt
  where attempt.id = target_attempt_id
  for update;
  if attempt_row.id is null then
    raise exception 'PayMongo test refund attempt not found.' using errcode = 'P0002';
  end if;
  select refund.* into refund_row
  from public.client_refund_disbursements refund
  where refund.id = attempt_row.refund_disbursement_id
  for update;

  if attempt_row.status = 'succeeded' then
    return jsonb_build_object('status', 'succeeded', 'refundId', attempt_row.paymongo_refund_id);
  end if;

  next_refund_status := case normalized_status
    when 'succeeded' then 'completed'
    when 'failed' then 'pending_destination'
    else 'processing'
  end;

  update public.paymongo_test_refund_attempts attempt
  set status = normalized_status,
      paymongo_refund_id = coalesce(normalized_refund_id, attempt.paymongo_refund_id),
      failure_reason = case when normalized_status = 'failed' then normalized_failure else null end,
      completed_at = case when normalized_status = 'succeeded' then now() else null end,
      updated_at = now()
  where attempt.id = attempt_row.id;

  update public.client_refund_disbursements refund
  set status = next_refund_status,
      external_reference = coalesce(normalized_refund_id, refund.external_reference),
      processed_at = case when normalized_status = 'succeeded' then now() else refund.processed_at end,
      processed_by = case when normalized_status = 'succeeded' then attempt_row.initiated_by else refund.processed_by end,
      metadata = coalesce(refund.metadata, '{}'::jsonb) || jsonb_build_object(
        'paymongoTestRefundStatus', normalized_status,
        'paymongoTestRefundUpdatedAt', now(),
        'paymongoTestOnly', true
      ),
      updated_at = now()
  where refund.id = refund_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, refund_disbursement_id, action, external_reference, note, acted_by
  ) values (
    'client_refund', refund_row.id,
    'paymongo_test_refund_' || normalized_status,
    normalized_refund_id,
    case when normalized_status = 'failed' then normalized_failure else 'Demo-only PayMongo test refund result recorded.' end,
    attempt_row.initiated_by
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    refund_row.client_id,
    case normalized_status
      when 'succeeded' then 'PayMongo test refund completed'
      when 'failed' then 'PayMongo test refund needs review'
      else 'PayMongo test refund processing'
    end,
    case normalized_status
      when 'succeeded' then 'Your demo refund was confirmed by PayMongo test mode. No real money was transferred.'
      when 'failed' then 'The PayMongo test refund was not completed. An authorized operator can retry it.'
      else 'Your demo refund request is being processed by PayMongo test mode.'
    end,
    'refund_disbursement', refund_row.id
  );

  return jsonb_build_object(
    'status', normalized_status,
    'refundId', normalized_refund_id,
    'refundDisbursementStatus', next_refund_status
  );
end;
$$;

revoke all on function public.prepare_v16_paymongo_test_refund(uuid) from public, anon;
revoke all on function public.record_v16_paymongo_test_refund_result(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.prepare_v16_paymongo_test_refund(uuid) to authenticated;
grant execute on function public.record_v16_paymongo_test_refund_result(uuid, text, text, text) to service_role;

comment on table public.paymongo_test_refund_attempts is
  'Demo-only PayMongo test refund attempts. Never used by live payments and never contains a client account number.';

commit;
