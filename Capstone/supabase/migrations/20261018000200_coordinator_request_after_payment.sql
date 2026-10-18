-- A coordinator can be selected while the client prepares checkout, but that
-- selection is not an invitation. The invitation becomes pending only after
-- the coordinator downpayment is successfully recorded.

begin;

select set_config('app.coordinator_assignment_authorized', 'true', true);

-- Normalize only impossible mixed assignment states left by earlier schema
-- versions before strengthening the relationship constraint.
update public.events
set pending_coordinator_id = null
where coordinator_assignment_status = 'accepted'
  and coordinator_id is not null
  and pending_coordinator_id is not null;

update public.events
set coordinator_id = null
where coordinator_assignment_status = 'pending'
  and pending_coordinator_id is not null
  and coordinator_id is not null;

alter table public.events
  drop constraint if exists events_coordinator_assignment_status_check,
  add constraint events_coordinator_assignment_status_check
    check (
      coordinator_assignment_status is null
      or coordinator_assignment_status in ('awaiting_payment', 'pending', 'accepted')
    ) not valid,
  drop constraint if exists events_coordinator_assignment_consistency_check,
  add constraint events_coordinator_assignment_consistency_check
    check (
      (coordinator_assignment_status in ('awaiting_payment', 'pending')
        and pending_coordinator_id is not null
        and coordinator_id is null)
      or (coordinator_assignment_status = 'accepted'
        and coordinator_id is not null
        and pending_coordinator_id is null)
      or (
        coordinator_assignment_status is null
        and pending_coordinator_id is null
        and coordinator_id is null
      )
    ) not valid;

-- Do not expose a legacy unpaid pending selection as an invitation. Paid
-- requests and accepted assignments retain their original state and history.
update public.events event
set coordinator_assignment_status = 'awaiting_payment',
    coordinator_assignment_note = 'Coordinator selected; waiting for the client downpayment before sending the request.',
    updated_at = now()
where event.coordinator_assignment_status = 'pending'
  and event.pending_coordinator_id is not null
  and not exists (
    select 1
    from public.payments payment
    where payment.event_id = event.id
      and payment.coordinator_id = event.pending_coordinator_id
      and payment.payment_scope = 'coordinator_service'
      and payment.status in ('paid', 'verified')
  );

create or replace function public.assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  coordinator_name text;
  fee numeric(12,2);
  fee_currency text;
  profile_description text;
  profile_specializations text[];
  event_start timestamptz;
  event_end timestamptz;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled')
  for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select profile.full_name, service_profile.coordination_fee,
    service_profile.currency, service_profile.description, service_profile.specializations
  into coordinator_name, fee, fee_currency, profile_description, profile_specializations
  from public.coordinator_service_profiles service_profile
  join public.profiles profile on profile.id = service_profile.coordinator_id
  where service_profile.coordinator_id = target_coordinator_id
    and service_profile.is_accepting_bookings
    and service_profile.coordination_fee > 0
    and profile.account_status = 'active';
  if coordinator_name is null then raise exception 'This coordinator is not accepting bookings.'; end if;

  select event_window.starts_at, event_window.ends_at into event_start, event_end
  from public.coordinator_event_window(event_row) event_window;
  if event_start is null or event_end is null then
    raise exception 'Complete the event date and time before requesting a coordinator.';
  end if;
  if exists (
    select 1 from public.coordinator_availability availability
    where availability.coordinator_id = target_coordinator_id
      and availability.status in ('unavailable', 'on_leave')
      and event_start < availability.ends_at and event_end > availability.starts_at
  ) or exists (
    select 1
    from public.events conflict_event
    cross join lateral public.coordinator_event_window(conflict_event) conflict_window
    where conflict_event.id <> event_row.id
      and conflict_event.status not in ('completed', 'cancelled')
      and (conflict_event.coordinator_id = target_coordinator_id
        or conflict_event.pending_coordinator_id = target_coordinator_id)
      and event_start < conflict_window.ends_at and event_end > conflict_window.starts_at
  ) then
    raise exception 'This coordinator is unavailable for the event schedule.';
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()), updated_at = now(),
      note = coalesce(note, 'Client selected another coordinator.')
  where event_id = event_row.id and status in ('invited', 'accepted');

  update public.events
  set coordinator_id = null,
      pending_coordinator_id = target_coordinator_id,
      coordinator_assignment_status = 'awaiting_payment',
      coordinator_assignment_requested_at = null,
      coordinator_assignment_responded_at = null,
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'client',
      coordinator_assignment_note = 'Coordinator selected; waiting for the client downpayment before sending the request.',
      coordinator_preference = 'selected',
      coordinator_fee_amount = fee,
      coordinator_fee_currency = fee_currency,
      coordinator_pricing_snapshot = jsonb_build_object(
        'coordinator_id', target_coordinator_id, 'coordinator_name', coordinator_name,
        'description', profile_description, 'specializations', profile_specializations,
        'coordination_fee', fee, 'currency', fee_currency, 'captured_at', now()
      ),
      updated_at = now()
  where id = event_row.id;

  return jsonb_build_object(
    'event_id', event_row.id, 'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name, 'assignment_status', 'awaiting_payment',
    'coordination_fee', fee, 'currency', fee_currency,
    'request_status', 'awaiting_downpayment'
  );
end;
$$;

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
  if payment_type <> 'deposit' then
    raise exception 'MULTIVENT collects only the 35%% downpayment. The remaining 70%% is paid directly to the provider.';
  end if;
  if initial_rate_value <> provider_initial_rate_value + platform_fee_rate_value then
    raise exception 'Current downpayment terms must equal the provider allocation plus platform fee.';
  end if;

  client_total_value := service_subtotal_value + platform_fee_value;
  provider_initial_value := round(service_subtotal_value * provider_initial_rate_value, 2);
  initial_payment_value := provider_initial_value + platform_fee_value;
  new.amount := initial_payment_value;
  new.service_subtotal := service_subtotal_value;
  new.client_total := client_total_value;
  new.platform_fee_rate := platform_fee_rate_value;
  new.platform_fee_amount := platform_fee_value;
  new.initial_payment_rate := initial_rate_value;
  new.provider_initial_rate := provider_initial_rate_value;
  new.provider_initial_allocation := provider_initial_value;
  new.held_unallocated_amount := 0;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'accountingVersion', 'phase5-v1', 'paymentType', 'deposit',
    'serviceSubtotal', service_subtotal_value, 'platformFeeRate', platform_fee_rate_value,
    'platformFeeAmount', platform_fee_value, 'clientTotal', client_total_value,
    'initialPaymentRate', initial_rate_value, 'initialPaymentAmount', initial_payment_value,
    'providerInitialRate', provider_initial_rate_value,
    'providerInitialAllocation', provider_initial_value,
    'providerBalance', service_subtotal_value - provider_initial_value,
    'heldUnallocatedAmount', 0, 'remainingCollectionMethod', 'direct_to_provider'
  );
  return new;
end;
$$;

create or replace function public.notify_paid_coordinator_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row record;
  client_name text;
begin
  if new.payment_scope is distinct from 'coordinator_service'
    or new.coordinator_id is null or new.status not in ('paid', 'verified') then
    return new;
  end if;

  select event.id, event.name, event.coordinator_fee_amount
  into event_row
  from public.events event
  where event.id = new.event_id
    and event.pending_coordinator_id = new.coordinator_id
    and event.coordinator_assignment_status = 'awaiting_payment'
  for update;
  if event_row.id is null then return new; end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.events
  set coordinator_assignment_status = 'pending',
      coordinator_assignment_requested_at = now(),
      coordinator_assignment_note = 'Coordinator booking request sent after the client downpayment.',
      updated_at = now()
  where id = event_row.id;

  update public.coordinator_assignment_attempts
  set requested_at = now(), assigned_by = new.payer_id, updated_at = now(),
      note = 'Booking request sent after the client downpayment.'
  where event_id = event_row.id
    and coordinator_id = new.coordinator_id
    and status = 'invited';
  if not found then
    insert into public.coordinator_assignment_attempts (
      event_id, coordinator_id, assignment_source, status, requested_at, assigned_by, note
    ) values (
      event_row.id, new.coordinator_id, 'client', 'invited', now(), new.payer_id,
      'Booking request sent after the client downpayment.'
    );
  end if;

  select profile.full_name into client_name
  from public.profiles profile where profile.id = new.payer_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    new.coordinator_id, 'New coordinator booking request',
    format('%s requested your coordination service for %s at PHP %s.',
      coalesce(client_name, 'A client'), event_row.name,
      to_char(event_row.coordinator_fee_amount, 'FM999,999,990.00')),
    'event', event_row.id
  );
  return new;
end;
$$;

revoke all on function public.assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.enforce_phase5_payment_breakdown() from public;
revoke all on function public.notify_paid_coordinator_booking_request() from public;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;

commit;
