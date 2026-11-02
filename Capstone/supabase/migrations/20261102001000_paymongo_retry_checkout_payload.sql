-- A retry reuses its original protected payment records.  Return the same
-- server-authoritative amount fields expected by checkout creation.

begin;

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
      update public.payments payment
      set status = 'pending',
          provider_reference = null,
          metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
            'paymongoRetryAt', now(), 'paymongoRetryCount', coalesce((payment.metadata ->> 'paymongoRetryCount')::integer, 0) + 1
          ),
          updated_at = now()
      where payment.id in (
        select item.payment_id from public.paymongo_payment_attempt_items item
        where item.attempt_id = existing_attempt.id
      ) and payment.status in ('failed', 'cancelled');

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
      'amountCentavos', existing_attempt.amount_centavos,
      'currency', existing_attempt.currency,
      'eventName', event_row.name,
      'reused', true
    );
  end if;

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
  where payment.event_id = event_row.id and payment.payer_id = event_row.client_id
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

revoke all on function public.prepare_my_paymongo_checkout_v16(uuid, text, boolean, text) from public, anon;
grant execute on function public.prepare_my_paymongo_checkout_v16(uuid, text, boolean, text) to authenticated;

commit;
