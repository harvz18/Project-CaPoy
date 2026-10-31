-- MULTIVENT Revision V16 follow-up: server-side reconciliation is an
-- authenticated fallback for a delayed or missed webhook.  The edge function
-- supplies data fetched directly from PayMongo using the protected secret;
-- clients can never provide an amount, payment ID, or paid state.

begin;

create or replace function public.reconcile_paymongo_checkout_v16(
  target_attempt_id uuid,
  external_payment_id text,
  paid_amount_centavos bigint,
  paid_currency text,
  reconciliation_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.paymongo_payment_attempts%rowtype;
  reconciliation_event_id text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Server-only PayMongo reconciliation is required.' using errcode = '42501';
  end if;

  select * into attempt_row
  from public.paymongo_payment_attempts attempt
  where attempt.id = target_attempt_id
  for update;
  if attempt_row.id is null then
    raise exception 'Unknown PayMongo checkout attempt.' using errcode = 'P0002';
  end if;
  if attempt_row.status = 'verified' then
    return jsonb_build_object('duplicate', true, 'processed', false, 'attemptId', attempt_row.id);
  end if;
  if attempt_row.status <> 'checkout_created' then
    raise exception 'Checkout attempt is not payable.' using errcode = '22023';
  end if;
  if nullif(trim(external_payment_id), '') is null
    or paid_amount_centavos <> attempt_row.amount_centavos
    or paid_currency <> attempt_row.currency then
    raise exception 'PayMongo reconciliation did not match the expected checkout.' using errcode = '22023';
  end if;

  update public.payments payment
  set status = 'verified', provider = 'eWallet', provider_reference = trim(external_payment_id),
      paid_at = coalesce(payment.paid_at, now()), verified_at = now(),
      metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
        'paymongoCheckoutSessionId', attempt_row.paymongo_checkout_session_id,
        'paymongoPaymentId', trim(external_payment_id),
        'paymongoVerifiedAt', now(),
        'settlementVerificationSource', 'paymongo_api_reconciliation'
      ), updated_at = now()
  where payment.id in (
    select item.payment_id from public.paymongo_payment_attempt_items item where item.attempt_id = attempt_row.id
  ) and payment.status in ('pending', 'processing');

  update public.paymongo_payment_attempts
  set status = 'verified', paymongo_payment_id = trim(external_payment_id), verified_at = now(), updated_at = now()
  where id = attempt_row.id;

  reconciliation_event_id := 'paymongo_api_reconciliation:' || attempt_row.id::text || ':' || trim(external_payment_id);
  insert into public.paymongo_webhook_events (
    external_event_id, event_type, livemode, checkout_session_id, signature_verified,
    processing_status, payload, processed_at
  ) values (
    reconciliation_event_id, 'checkout_session.payment.paid', attempt_row.environment = 'live',
    attempt_row.paymongo_checkout_session_id, false, 'processed',
    coalesce(reconciliation_payload, '{}'::jsonb) || jsonb_build_object('verificationSource', 'paymongo_api_reconciliation'), now()
  ) on conflict (external_event_id) do nothing;

  return jsonb_build_object('processed', true, 'attemptId', attempt_row.id);
end;
$$;

revoke all on function public.reconcile_paymongo_checkout_v16(uuid, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.reconcile_paymongo_checkout_v16(uuid, text, bigint, text, jsonb) to service_role;

comment on function public.reconcile_paymongo_checkout_v16(uuid, text, bigint, text, jsonb) is
  'Server-only V16 fallback: records a PayMongo API-confirmed checkout without trusting a browser redirect.';

commit;
