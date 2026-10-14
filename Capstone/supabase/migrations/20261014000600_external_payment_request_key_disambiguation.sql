-- Fix the provider external-payment RPC without changing its client-facing
-- argument names. The `request_key` RPC argument intentionally remains named
-- for PostgREST callers, while `$3` prevents a collision with the table column.

begin;

create or replace function public.confirm_provider_external_payment(
  target_booking_id uuid,
  received_amount numeric,
  request_key text,
  provider_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row public.bookings%rowtype;
  event_row public.events%rowtype;
  existing_confirmation public.provider_external_payment_confirmations%rowtype;
  balance_row record;
  remaining_after numeric(12,2);
  confirmation_id uuid;
  completion_result jsonb;
begin
  if nullif(trim($3), '') is null or char_length(trim($3)) < 8 then
    raise exception 'A valid payment confirmation request key is required.';
  end if;
  if received_amount is null or round(received_amount, 2) <= 0 then
    raise exception 'Enter a payment amount greater than zero.';
  end if;

  select booking.* into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id
    and provider.user_id = auth.uid()
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking not found for this service-provider account.' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.cash_remittances remittance
    where remittance.booking_id = booking_row.id
      and remittance.status <> 'disputed'
      and remittance.amount_received > 0
  ) then
    raise exception 'A coordinator remittance already covers this booking. Use staff reconciliation instead.';
  end if;

  select confirmation.* into existing_confirmation
  from public.provider_external_payment_confirmations confirmation
  where confirmation.booking_id = booking_row.id
    and confirmation.provider_id = booking_row.provider_id
    and confirmation.request_key = trim($3)
  limit 1;
  if existing_confirmation.id is not null then
    select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
    return jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_id', existing_confirmation.id,
      'duplicate_request', true,
      'recorded_external_amount', coalesce(balance_row.recorded_external_amount, 0),
      'remaining_balance', coalesce(balance_row.remaining_balance, 0),
      'booking_completed', booking_row.status = 'completed'
    );
  end if;

  if booking_row.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can record an external remaining payment.';
  end if;
  select event.* into event_row from public.events event where event.id = booking_row.event_id;
  if event_row.event_date is null
    or event_row.event_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This payment confirmation is available on or after the event date.';
  end if;

  select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
  if coalesce(balance_row.remaining_balance, 0) <= 0 then
    raise exception 'The remaining provider balance is already fully recorded.';
  end if;
  if round(received_amount, 2) > balance_row.remaining_balance then
    raise exception 'The confirmed amount cannot exceed the remaining service balance.';
  end if;

  insert into public.provider_external_payment_confirmations (
    booking_id, event_id, provider_id, amount, request_key, notes, confirmed_by
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id,
    round(received_amount, 2), trim($3), nullif(trim(provider_note), ''), auth.uid()
  ) returning id into confirmation_id;

  insert into public.financial_transactions (
    booking_id, event_id, provider_id, external_confirmation_id,
    transaction_type, payment_method, gross_amount, commission_rate,
    commission_amount, provider_net_amount, amount_received, amount_released,
    status, transaction_at, metadata
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id, confirmation_id,
    'provider_external_confirmation', 'external_direct', round(received_amount, 2),
    coalesce(booking_row.commission_rate, public.get_public_commission_rate()),
    0, round(received_amount, 2), 0, 0,
    'provider_confirmed_unverified', now(),
    jsonb_build_object(
      'source', 'provider_confirmed_external',
      'gateway_verified', false,
      'external_payment_confirmation_id', confirmation_id,
      'cash_custody', 'direct_to_provider'
    )
  );

  select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
  remaining_after := coalesce(balance_row.remaining_balance, 0);
  update public.bookings
  set completion_payment_status = case
        when remaining_after = 0 then 'fully_confirmed'
        else 'partially_confirmed'
      end,
      completion_payment_updated_at = now(),
      updated_at = now()
  where id = booking_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    booking_row.client_id,
    'Provider reported a remaining payment',
    format(
      'Your provider reported receiving PHP %s directly. This is provider-confirmed and not a verified gateway transaction.',
      to_char(round(received_amount, 2), 'FM999,999,999,990.00')
    ),
    'booking',
    booking_row.id
  );

  if remaining_after = 0 then
    select public.mark_provider_booking_completed(booking_row.id) into completion_result;
  else
    completion_result := jsonb_build_object('booking_id', booking_row.id, 'event_completed', false);
  end if;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'confirmation_id', confirmation_id,
    'recorded_external_amount', coalesce(balance_row.recorded_external_amount, 0),
    'remaining_balance', remaining_after,
    'booking_completed', remaining_after = 0,
    'event_completed', coalesce((completion_result ->> 'event_completed')::boolean, false),
    'confirmation_status', 'provider_confirmed_unverified'
  );
end;
$$;

revoke all on function public.confirm_provider_external_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.confirm_provider_external_payment(uuid, numeric, text, text) to authenticated;

commit;
