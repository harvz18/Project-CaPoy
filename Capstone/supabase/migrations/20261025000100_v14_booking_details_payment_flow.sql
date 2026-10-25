-- MULTIVENT Revision V14, Phase 4: payment starts only from Booking Details
-- after every required provider/coordinator acceptance.  Payment initiation is
-- deliberately separate from confirmation: a pending attempt holds no funds
-- and creates no provider receivable until its status is verified externally.

begin;

-- This is the client-safe projection used by Booking Details.  It reads the
-- immutable booking/coordinator price snapshots, not current listing prices,
-- so a provider cannot silently reprice an accepted request before payment.
create or replace function public.get_my_event_payment_quote_v14(
  target_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  eligibility jsonb;
  terms jsonb;
  provider_subtotal numeric(12,2) := 0;
  provider_fee numeric(12,2) := 0;
  provider_initial numeric(12,2) := 0;
  coordinator_subtotal numeric(12,2) := 0;
  coordinator_fee numeric(12,2) := 0;
  coordinator_initial numeric(12,2) := 0;
  coordinator_included boolean := false;
  payment_items jsonb := '[]'::jsonb;
  latest_payment_status text;
  latest_payment_type text;
  latest_payment_created_at timestamptz;
  service_subtotal_value numeric(12,2);
  platform_fee_value numeric(12,2);
  provider_initial_value numeric(12,2);
  downpayment_value numeric(12,2);
  client_total_value numeric(12,2);
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid();

  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  eligibility := public.event_payment_eligibility_v14(event_row.id);
  terms := public.get_public_payment_terms();

  select
    coalesce(sum(round(coalesce(booking.provider_amount, 0), 2)), 0),
    coalesce(sum(round(coalesce(booking.commission_amount,
      coalesce(booking.provider_amount, 0) * coalesce(booking.commission_rate,
        (terms ->> 'platformFeeRate')::numeric)), 2)), 0),
    coalesce(sum(round(coalesce(booking.provider_amount, 0)
      * coalesce(booking.provider_initial_rate,
        (terms ->> 'providerInitialRate')::numeric), 2)), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'bookingId', booking.id,
      'description', coalesce(service.name, 'Booked service'),
      'id', booking.id,
      'name', coalesce(service.name, 'Booked service'),
      'price', round(coalesce(booking.amount, 0), 2),
      'providerPrice', round(coalesce(booking.provider_amount, 0), 2),
      'commissionAmount', round(coalesce(booking.commission_amount,
        coalesce(booking.provider_amount, 0) * coalesce(booking.commission_rate,
          (terms ->> 'platformFeeRate')::numeric)), 2),
      'commissionRate', coalesce(booking.commission_rate,
        (terms ->> 'platformFeeRate')::numeric)
    ) order by booking.created_at, booking.id), '[]'::jsonb)
  into provider_subtotal, provider_fee, provider_initial, payment_items
  from public.bookings booking
  left join public.services service on service.id = booking.service_id
  where booking.event_id = event_row.id
    and booking.status not in ('rejected', 'cancelled', 'expired');

  coordinator_included := coalesce((eligibility ->> 'coordinator_required')::boolean, false)
    and event_row.coordinator_assignment_status = 'accepted'
    and event_row.coordinator_id is not null
    and coalesce(event_row.coordinator_fee_amount, 0) > 0;

  if coordinator_included then
    coordinator_subtotal := round(event_row.coordinator_fee_amount, 2);
    coordinator_fee := round(coordinator_subtotal
      * (terms ->> 'platformFeeRate')::numeric, 2);
    coordinator_initial := round(coordinator_subtotal
      * (terms ->> 'providerInitialRate')::numeric, 2);
    payment_items := payment_items || jsonb_build_array(jsonb_build_object(
      'bookingId', null,
      'description', 'Event coordination',
      'id', format('coordinator-%s', event_row.coordinator_id),
      'name', 'Event coordination',
      'price', coordinator_subtotal + coordinator_fee,
      'providerPrice', coordinator_subtotal,
      'commissionAmount', coordinator_fee,
      'commissionRate', (terms ->> 'platformFeeRate')::numeric,
      'paymentScope', 'coordinator_service'
    ));
  end if;

  service_subtotal_value := provider_subtotal + coordinator_subtotal;
  platform_fee_value := provider_fee + coordinator_fee;
  provider_initial_value := provider_initial + coordinator_initial;
  downpayment_value := provider_initial_value + platform_fee_value;
  client_total_value := service_subtotal_value + platform_fee_value;

  select payment.status::text,
    coalesce(payment.metadata ->> 'paymentType', 'deposit'),
    payment.created_at
  into latest_payment_status, latest_payment_type, latest_payment_created_at
  from public.payments payment
  where payment.event_id = event_row.id
    and payment.payer_id = event_row.client_id
  order by case payment.status
      when 'verified' then 6
      when 'paid' then 5
      when 'processing' then 4
      when 'pending' then 3
      when 'failed' then 2
      when 'cancelled' then 1
      else 0
    end desc,
    payment.created_at desc,
    payment.id desc
  limit 1;

  return jsonb_build_object(
    'eventId', event_row.id,
    'eventName', event_row.name,
    'paymentEligible', coalesce((eligibility ->> 'payment_eligible')::boolean, false),
    'reason', eligibility ->> 'reason',
    'acceptance', eligibility,
    'paymentState', case
      when latest_payment_status in ('paid', 'verified') then 'paid_or_verified'
      when latest_payment_status in ('pending', 'processing') then 'payment_initiated'
      when latest_payment_status in ('failed', 'cancelled') then 'payment_failed_or_cancelled'
      else 'not_initiated'
    end,
    'paymentStatus', latest_payment_status,
    'paymentType', latest_payment_type,
    'paymentInitiatedAt', latest_payment_created_at,
    'items', payment_items,
    'breakdown', jsonb_build_object(
      'clientTotal', client_total_value,
      'serviceSubtotal', service_subtotal_value,
      'platformFee', platform_fee_value,
      'providerInitialAllocation', provider_initial_value,
      'initialPayment', downpayment_value,
      'providerBalance', greatest(service_subtotal_value - provider_initial_value, 0),
      'remainingClientBalance', greatest(client_total_value - downpayment_value, 0),
      'initialPaymentRate', (terms ->> 'initialPaymentRate')::numeric,
      'providerInitialRate', (terms ->> 'providerInitialRate')::numeric,
      'platformFeeRate', (terms ->> 'platformFeeRate')::numeric
    )
  );
end;
$$;

-- A full payment remains a voluntary alternative to the required 35% start
-- payment.  It is permitted only for this V14 Booking Details flow; legacy
-- callers retain the established downpayment-only policy.  The exact 30% +
-- 5% split is still snapshotted, and the full path merely holds the remaining
-- provider balance too once external verification marks it paid.
create or replace function public.enforce_phase5_payment_breakdown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row record;
  coordinator_row record;
  terms jsonb;
  payment_type text;
  service_subtotal_value numeric(12,2);
  platform_fee_rate_value numeric(7,6);
  platform_fee_value numeric(12,2);
  client_total_value numeric(12,2);
  initial_rate_value numeric(7,6);
  provider_initial_rate_value numeric(7,6);
  initial_payment_value numeric(12,2);
  provider_initial_value numeric(12,2);
  amount_due_value numeric(12,2);
begin
  if tg_op = 'UPDATE' and old.status in ('paid', 'verified', 'refunded') then
    raise exception 'A recognized payment financial snapshot cannot be changed.' using errcode = '42501';
  end if;

  terms := public.get_public_payment_terms();
  if new.booking_id is not null then
    select booking.provider_amount, booking.amount, booking.commission_rate,
      booking.commission_amount, booking.commission_model,
      booking.financial_terms_version, booking.initial_payment_rate,
      booking.provider_initial_rate
    into booking_row
    from public.bookings booking where booking.id = new.booking_id;
    if not found or booking_row.financial_terms_version is distinct from 'phase5-v1' then return new; end if;
    if booking_row.commission_model is distinct from 'added_to_customer' then
      raise exception 'Phase 5 payments require added-to-customer pricing.';
    end if;
    service_subtotal_value := round(coalesce(booking_row.provider_amount, 0), 2);
    platform_fee_rate_value := coalesce(booking_row.commission_rate, (terms ->> 'platformFeeRate')::numeric);
    platform_fee_value := round(coalesce(booking_row.commission_amount,
      service_subtotal_value * platform_fee_rate_value), 2);
    initial_rate_value := coalesce(booking_row.initial_payment_rate, (terms ->> 'initialPaymentRate')::numeric);
    provider_initial_rate_value := coalesce(booking_row.provider_initial_rate, (terms ->> 'providerInitialRate')::numeric);
    new.payment_scope := 'provider_service';
    new.coordinator_id := null;
  elsif new.coordinator_id is not null
    or new.payment_scope = 'coordinator_service'
    or coalesce(new.metadata, '{}'::jsonb) ->> 'paymentScope' = 'coordinator_service'
  then
    select event.client_id,
      case when event.coordinator_assignment_status in ('awaiting_payment', 'pending')
        then event.pending_coordinator_id else event.coordinator_id end as coordinator_id,
      event.coordinator_fee_amount
    into coordinator_row
    from public.events event
    where event.id = new.event_id and event.status not in ('completed', 'cancelled');
    if not found or coordinator_row.client_id is distinct from new.payer_id
      or coordinator_row.coordinator_id is null
      or coordinator_row.coordinator_id is distinct from new.coordinator_id
      or coalesce(coordinator_row.coordinator_fee_amount, 0) <= 0
    then
      raise exception 'A valid event coordinator payment is required.' using errcode = '42501';
    end if;
    service_subtotal_value := round(coordinator_row.coordinator_fee_amount, 2);
    platform_fee_rate_value := (terms ->> 'platformFeeRate')::numeric;
    platform_fee_value := round(service_subtotal_value * platform_fee_rate_value, 2);
    initial_rate_value := (terms ->> 'initialPaymentRate')::numeric;
    provider_initial_rate_value := (terms ->> 'providerInitialRate')::numeric;
    new.booking_id := null;
    new.payment_scope := 'coordinator_service';
  else
    return new;
  end if;

  payment_type := coalesce(coalesce(new.metadata, '{}'::jsonb) ->> 'paymentType', 'deposit');
  if payment_type not in ('deposit', 'full') then
    raise exception 'Unknown MULTIVENT payment type.';
  end if;
  if payment_type = 'full'
    and coalesce(new.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4'
  then
    raise exception 'MULTIVENT collects only the 35%% downpayment. The remaining 70%% is paid directly to the provider.';
  end if;
  if initial_rate_value <> provider_initial_rate_value + platform_fee_rate_value then
    raise exception 'Current downpayment terms must equal the provider allocation plus platform fee.';
  end if;

  client_total_value := service_subtotal_value + platform_fee_value;
  provider_initial_value := round(service_subtotal_value * provider_initial_rate_value, 2);
  initial_payment_value := provider_initial_value + platform_fee_value;
  amount_due_value := case when payment_type = 'full' then client_total_value else initial_payment_value end;
  new.amount := amount_due_value;
  new.service_subtotal := service_subtotal_value;
  new.client_total := client_total_value;
  new.platform_fee_rate := platform_fee_rate_value;
  new.platform_fee_amount := platform_fee_value;
  new.initial_payment_rate := initial_rate_value;
  new.provider_initial_rate := provider_initial_rate_value;
  new.provider_initial_allocation := case
    when payment_type = 'full' then service_subtotal_value else provider_initial_value end;
  new.held_unallocated_amount := 0;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'accountingVersion', 'phase5-v1',
    'paymentType', payment_type,
    'serviceSubtotal', service_subtotal_value,
    'platformFeeRate', platform_fee_rate_value,
    'platformFeeAmount', platform_fee_value,
    'clientTotal', client_total_value,
    'initialPaymentRate', initial_rate_value,
    'initialPaymentAmount', initial_payment_value,
    'paymentAmount', amount_due_value,
    'providerInitialRate', provider_initial_rate_value,
    'providerInitialAllocation', case when payment_type = 'full' then service_subtotal_value else provider_initial_value end,
    'providerBalance', case when payment_type = 'full' then 0 else service_subtotal_value - provider_initial_value end,
    'heldUnallocatedAmount', 0,
    'remainingCollectionMethod', case when payment_type = 'full' then 'platform_collected' else 'direct_to_provider' end
  );
  return new;
end;
$$;

-- Initiation is server-authoritative and idempotent.  It intentionally saves
-- pending records only: financial ledgers/receivables continue to react only
-- after the existing verified/paid transition.
create or replace function public.initiate_my_event_payment_v14(
  target_event_id uuid,
  selected_payment_type text,
  selected_payment_method text,
  terms_accepted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  eligibility jsonb;
  booking_row record;
  payment_quote jsonb;
  checkout_key text;
  existing_active_payment boolean := false;
  existing_recorded_payment boolean := false;
  created_payment_count integer := 0;
  payment_status_value text;
begin
  if selected_payment_type not in ('deposit', 'full') then
    raise exception 'Choose either the required downpayment or payment in full.';
  end if;
  if selected_payment_method not in ('eWallet', 'bankTransfer') then
    raise exception 'Choose a supported payment method.';
  end if;
  if not terms_accepted then
    raise exception 'Accept the booking and cancellation terms first.';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
  for update;
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  eligibility := public.event_payment_eligibility_v14(event_row.id);
  if not coalesce((eligibility ->> 'payment_eligible')::boolean, false) then
    raise exception '%', coalesce(eligibility ->> 'reason',
      'Payment is unavailable until all required booking requests are accepted.') using errcode = '42501';
  end if;

  select exists (
    select 1 from public.payments payment
    where payment.event_id = event_row.id
      and payment.payer_id = event_row.client_id
      and payment.status in ('pending', 'processing')
  ) into existing_active_payment;
  select exists (
    select 1 from public.payments payment
    where payment.event_id = event_row.id
      and payment.payer_id = event_row.client_id
      and payment.status in ('paid', 'verified')
  ) into existing_recorded_payment;

  if existing_active_payment or existing_recorded_payment then
    payment_quote := public.get_my_event_payment_quote_v14(event_row.id);
    return payment_quote || jsonb_build_object(
      'initiated', false,
      'message', case when existing_recorded_payment
        then 'Payment has already been recorded for this event.'
        else 'A payment attempt is already awaiting completion or verification.' end
    );
  end if;

  for booking_row in
    select booking.id
    from public.bookings booking
    where booking.event_id = event_row.id
      and booking.status in ('approved', 'paid', 'confirmed', 'completed')
    order by booking.created_at, booking.id
  loop
    checkout_key := format('v14-payment-%s-%s-%s', event_row.id, booking_row.id, selected_payment_type);
    insert into public.payments (
      amount, booking_id, checkout_reference, currency, event_id, metadata,
      payer_id, provider, provider_reference, status
    ) values (
      0, booking_row.id, checkout_key, 'PHP', event_row.id,
      jsonb_build_object(
        'bookingFlowVersion', 'v14-phase4',
        'eventName', event_row.name,
        'paymentType', selected_payment_type,
        'termsAccepted', true
      ),
      event_row.client_id, selected_payment_method, null, 'pending'
    )
    on conflict (checkout_reference) do update
    set provider = excluded.provider,
        provider_reference = null,
        status = case when public.payments.status in ('failed', 'cancelled')
          then 'pending'::public.payment_status else public.payments.status end,
        updated_at = now()
    returning status::text into payment_status_value;
    created_payment_count := created_payment_count + 1;
  end loop;

  if coalesce((eligibility ->> 'coordinator_required')::boolean, false) then
    checkout_key := format('v14-payment-%s-coordinator-%s-%s',
      event_row.id, event_row.coordinator_id, selected_payment_type);
    insert into public.payments (
      amount, booking_id, checkout_reference, coordinator_id, currency, event_id,
      metadata, payer_id, payment_scope, provider, provider_reference, status
    ) values (
      0, null, checkout_key, event_row.coordinator_id, 'PHP', event_row.id,
      jsonb_build_object(
        'bookingFlowVersion', 'v14-phase4',
        'eventName', event_row.name,
        'paymentScope', 'coordinator_service',
        'paymentType', selected_payment_type,
        'termsAccepted', true
      ),
      event_row.client_id, 'coordinator_service', selected_payment_method, null, 'pending'
    )
    on conflict (checkout_reference) do update
    set provider = excluded.provider,
        provider_reference = null,
        status = case when public.payments.status in ('failed', 'cancelled')
          then 'pending'::public.payment_status else public.payments.status end,
        updated_at = now()
    returning status::text into payment_status_value;
    created_payment_count := created_payment_count + 1;
  end if;

  if created_payment_count = 0 then
    raise exception 'No accepted provider or coordinator payment could be created.';
  end if;

  payment_quote := public.get_my_event_payment_quote_v14(event_row.id);
  return payment_quote || jsonb_build_object(
    'initiated', true,
    'message', 'Payment initiated and awaiting completion or verification.',
    'paymentStatus', coalesce(payment_status_value, 'pending')
  );
end;
$$;

revoke all on function public.get_my_event_payment_quote_v14(uuid) from public;
revoke all on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) from public;
revoke all on function public.enforce_phase5_payment_breakdown() from public;
grant execute on function public.get_my_event_payment_quote_v14(uuid) to authenticated;
grant execute on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) to authenticated;

comment on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) is
  'V14 Phase 4 idempotent payment initiation after all required acceptances. Pending attempts create no verified funds or provider receivables.';

commit;
