-- MULTIVENT Revision V14, Phase 3: providers and coordinators accept their
-- own requests before the client can make a payment. This is intentionally
-- additive: existing paid bookings retain the held-receivable behaviour.

begin;

-- This internal helper is the single source of truth for the pre-payment
-- acceptance gate. It deliberately derives state from the existing booking,
-- selection, and coordinator assignment records instead of adding duplicate
-- status columns.
create or replace function public.event_payment_eligibility_v14(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  provider_count integer := 0;
  accepted_provider_count integer := 0;
  declined_provider_count integer := 0;
  cancelled_provider_count integer := 0;
  selected_without_request_count integer := 0;
  coordinator_required boolean := false;
  coordinator_accepted boolean := true;
  event_valid boolean := false;
  payment_eligible boolean := false;
  waiting_for text := null;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id;

  if event_row.id is null then
    return jsonb_build_object(
      'event_found', false,
      'payment_eligible', false,
      'reason', 'Event not found.'
    );
  end if;

  event_valid := event_row.status not in ('completed', 'cancelled');

  select
    count(*)::integer,
    count(*) filter (where booking.status in ('approved', 'paid', 'confirmed', 'completed'))::integer,
    count(*) filter (where booking.status = 'rejected')::integer,
    count(*) filter (where booking.status = 'cancelled')::integer
  into provider_count, accepted_provider_count, declined_provider_count, cancelled_provider_count
  from public.bookings booking
  where booking.event_id = event_row.id
    and booking.status <> 'expired';

  select count(*)::integer
  into selected_without_request_count
  from public.event_service_selections selection
  where selection.event_id = event_row.id
    and selection.status = 'selected';

  coordinator_required := coalesce(event_row.wants_coordinator, false)
    or event_row.pending_coordinator_id is not null
    or event_row.coordinator_id is not null;
  coordinator_accepted := not coordinator_required
    or (
      event_row.coordinator_assignment_status = 'accepted'
      and event_row.coordinator_id is not null
    );

  if not event_valid then
    waiting_for := 'This event is no longer available for payment.';
  elsif provider_count = 0 and not coordinator_accepted then
    waiting_for := 'Add a required service provider or receive coordinator acceptance before payment.';
  elsif provider_count = 0 then
    waiting_for := 'Add at least one required bookable service before payment.';
  elsif declined_provider_count > 0 then
    waiting_for := 'Replace every declined provider request before payment.';
  elsif cancelled_provider_count > 0 then
    waiting_for := 'Resolve cancelled provider requests before payment.';
  elsif selected_without_request_count > 0 then
    waiting_for := 'Submit every selected service provider request before payment.';
  elsif accepted_provider_count < provider_count then
    waiting_for := format(
      'Waiting for %s provider confirmation%s.',
      provider_count - accepted_provider_count,
      case when provider_count - accepted_provider_count = 1 then '' else 's' end
    );
  elsif not coordinator_accepted then
    waiting_for := 'Waiting for coordinator confirmation.';
  else
    payment_eligible := true;
  end if;

  return jsonb_build_object(
    'event_found', true,
    'event_valid', event_valid,
    'provider_count', provider_count,
    'accepted_provider_count', accepted_provider_count,
    'pending_provider_count', greatest(provider_count - accepted_provider_count - declined_provider_count, 0),
    'declined_provider_count', declined_provider_count,
    'cancelled_provider_count', cancelled_provider_count,
    'selected_without_request_count', selected_without_request_count,
    'coordinator_required', coordinator_required,
    'coordinator_accepted', coordinator_accepted,
    'payment_eligible', payment_eligible,
    'reason', waiting_for
  );
end;
$$;

-- This function is called only from the secured decision procedures below.
-- It changes no financial record and emits the final readiness notification
-- once, when the last required acceptance arrives.
create or replace function public.refresh_event_payment_eligibility_v14(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  eligibility jsonb;
  has_recorded_payment boolean := false;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then
    return jsonb_build_object('event_found', false, 'payment_eligible', false);
  end if;

  select exists (
    select 1
    from public.payments payment
    where payment.event_id = event_row.id
      and payment.status in ('paid', 'verified')
  ) into has_recorded_payment;

  eligibility := public.event_payment_eligibility_v14(event_row.id);

  -- Historical paid events keep their current lifecycle and ledger state.
  if has_recorded_payment then
    return eligibility || jsonb_build_object('payment_already_recorded', true);
  end if;

  if coalesce((eligibility ->> 'payment_eligible')::boolean, false) then
    if event_row.status <> 'payment_required' then
      update public.events
      set status = 'payment_required', updated_at = now()
      where id = event_row.id;

      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.client_id,
        'All booking requests accepted',
        format('All required providers accepted %s. Your downpayment is now available.', event_row.name),
        'event',
        event_row.id
      );
    end if;
  elsif event_row.status = 'payment_required' then
    update public.events
    set status = 'booking', updated_at = now()
    where id = event_row.id;
  end if;

  return eligibility || jsonb_build_object('payment_already_recorded', false);
end;
$$;

-- The prior payment trigger safely derives all monetary values. This earlier
-- trigger only authorizes a new payment after the acceptance gate succeeds.
create or replace function public.enforce_v14_payment_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  eligibility jsonb;
begin
  if tg_op = 'UPDATE' and old.status in ('paid', 'verified', 'refunded') then
    return new;
  end if;

  if new.event_id is null then
    return new;
  end if;

  select * into event_row
  from public.events event
  where event.id = new.event_id;

  if event_row.id is null or event_row.client_id is distinct from new.payer_id then
    raise exception 'A valid client event is required before payment.' using errcode = '42501';
  end if;

  eligibility := public.event_payment_eligibility_v14(new.event_id);
  if not coalesce((eligibility ->> 'payment_eligible')::boolean, false) then
    raise exception '%', coalesce(
      eligibility ->> 'reason',
      'Payment is unavailable until all required booking requests are accepted.'
    ) using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_enforce_v14_payment_eligibility_trigger on public.payments;
create trigger aaa_enforce_v14_payment_eligibility_trigger
before insert or update of event_id, booking_id, coordinator_id, payer_id, status
on public.payments
for each row execute function public.enforce_v14_payment_eligibility();

-- Providers can now respond to the request they own before any payment is
-- collected. The existing paid path still holds receivables exactly as before.
create or replace function public.respond_to_provider_booking(
  target_booking_id uuid,
  accept_booking boolean,
  response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  service_name text;
  event_name text;
  is_phase5_payment boolean;
  held_now numeric(12,2) := 0;
  next_status public.booking_status;
  replacement_id uuid;
  eligibility jsonb := '{}'::jsonb;
begin
  select booking.*
  into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id and provider.user_id = auth.uid()
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking request not found for this service-provider account.'
      using errcode = '42501';
  end if;

  next_status := case when accept_booking then 'confirmed'::public.booking_status
    else 'rejected'::public.booking_status end;
  if booking_row.status = next_status then
    return jsonb_build_object(
      'booking_id', booking_row.id,
      'status', next_status,
      'accepted', accept_booking,
      'initial_share_credited', 0,
      'already_processed', true
    );
  end if;
  if booking_row.status <> 'requested' then
    raise exception 'This booking request can no longer be answered.';
  end if;
  if char_length(coalesce(response_note, '')) > 2000 then
    raise exception 'The response note cannot exceed 2,000 characters.';
  end if;

  select exists (
    select 1
    from public.payments payment
    where payment.booking_id = booking_row.id
      and payment.status in ('paid', 'verified')
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into is_phase5_payment;

  perform set_config('app.phase6_booking_response_authorized', 'true', true);
  update public.bookings
  set status = next_status,
      provider_notes = nullif(trim(coalesce(response_note, '')), ''),
      updated_at = now()
  where id = booking_row.id;

  if accept_booking then
    update public.event_service_selections selection
    set status = 'confirmed', updated_at = now()
    where selection.event_id = booking_row.event_id
      and selection.client_id = booking_row.client_id
      and selection.provider_id = booking_row.provider_id
      and selection.service_id = booking_row.service_id
      and selection.status in ('selected', 'requested');
  else
    update public.event_service_selections selection
    set status = 'declined', updated_at = now()
    where selection.event_id = booking_row.event_id
      and selection.client_id = booking_row.client_id
      and selection.provider_id = booking_row.provider_id
      and selection.service_id = booking_row.service_id
      and selection.status in ('selected', 'requested');

    insert into public.booking_replacements (
      rejected_booking_id, event_id, client_id, category_id,
      rejected_service_id, rejected_provider_id, rejected_amount
    )
    select booking_row.id, booking_row.event_id, booking_row.client_id,
      service.category_id, booking_row.service_id, booking_row.provider_id,
      greatest(coalesce(booking_row.amount, 0), 0)
    from public.services service
    where service.id = booking_row.service_id
    on conflict (rejected_booking_id) do nothing
    returning id into replacement_id;
  end if;

  if is_phase5_payment and accept_booking then
    held_now := public.hold_phase11_provider_receivable(booking_row.id);
  elsif is_phase5_payment then
    update public.financial_transactions ledger
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'receivable_state', 'rejected_held',
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'provider_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where ledger.booking_id = booking_row.id
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      );
  end if;

  select coalesce(service.name, 'Service'), coalesce(event.name, 'Event')
  into service_name, event_name
  from public.services service
  join public.events event on event.id = booking_row.event_id
  where service.id = booking_row.service_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    booking_row.client_id,
    case when accept_booking then 'Booking accepted' else 'Booking declined' end,
    case when accept_booking
      then format('%s accepted your booking request for %s.', service_name, event_name)
      else format('%s could not accept your booking request for %s. Choose a replacement before payment.', service_name, event_name)
    end,
    case when accept_booking then 'booking' else 'booking_replacement' end,
    case when accept_booking then booking_row.id else coalesce(replacement_id, booking_row.id) end
  );

  if not is_phase5_payment then
    eligibility := public.refresh_event_payment_eligibility_v14(booking_row.event_id);
  end if;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'status', next_status,
    'accepted', accept_booking,
    'initial_share_credited', 0,
    'held_receivable', held_now,
    'replacement_id', replacement_id,
    'payment_eligibility', eligibility,
    'already_processed', false
  );
end;
$$;

-- Coordinator invitations follow the same request-first policy. Paid legacy
-- invitations retain their receipt/receivable handling without recalculation.
create or replace function public.respond_event_coordinator_assignment(
  target_event_id uuid,
  accept_assignment boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  is_phase5_payment boolean;
  held_now numeric(12,2) := 0;
  eligibility jsonb := '{}'::jsonb;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.pending_coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This coordinator booking request is no longer available.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.payments payment
    where payment.event_id = event_row.id
      and payment.coordinator_id = auth.uid()
      and payment.payment_scope = 'coordinator_service'
      and payment.status in ('paid', 'verified')
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into is_phase5_payment;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when accept_assignment then 'accepted' else 'declined' end,
      responded_at = now(),
      updated_at = now(),
      note = case when accept_assignment then note
        else 'Coordinator declined the client booking request.' end
  where event_id = event_row.id
    and coordinator_id = auth.uid()
    and status = 'invited';

  if accept_assignment then
    update public.events
    set coordinator_id = auth.uid(),
        pending_coordinator_id = null,
        coordinator_assignment_status = 'accepted',
        coordinator_assignment_responded_at = now(),
        coordinator_assignment_note = null,
        updated_at = now()
    where id = event_row.id;

    if is_phase5_payment then
      held_now := public.hold_phase11_coordinator_receivable(event_row.id, auth.uid());
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Coordinator booking accepted',
      format('Your coordinator booking for %s was accepted.', event_row.name),
      'event',
      event_row.id
    );
  else
    if is_phase5_payment then
      update public.financial_transactions ledger
      set provider_funds_status = 'rejected_held',
          metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
            'receivable_state', 'rejected_held',
            'provider_release', false,
            'release_condition', 'replacement_or_refund',
            'coordinator_rejected_at', now(),
            'rejected_allocation_recognized_as_revenue', false
          ),
          updated_at = now()
      where ledger.event_id = event_row.id
        and ledger.coordinator_id = auth.uid()
        and ledger.transaction_type = 'booking_payment'
        and ledger.status in ('paid', 'verified')
        and (
          ledger.metadata ->> 'accounting_version' = 'phase5-v1'
          or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
        );
    end if;

    update public.events
    set coordinator_id = null,
        pending_coordinator_id = null,
        coordinator_assignment_status = null,
        coordinator_assignment_responded_at = now(),
        coordinator_assignment_note = 'The coordinator declined the client booking request.',
        coordinator_preference = 'undecided',
        coordinator_fee_amount = null,
        coordinator_fee_currency = null,
        coordinator_pricing_snapshot = null,
        updated_at = now()
    where id = event_row.id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Coordinator booking declined',
      format('Your coordinator request for %s was declined. Choose another coordinator or continue without one before payment.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  if not is_phase5_payment then
    eligibility := public.refresh_event_payment_eligibility_v14(event_row.id);
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'accepted', accept_assignment,
    'assignment_status', case when accept_assignment then 'accepted' else null end,
    'initial_share_credited', 0,
    'held_receivable', held_now,
    'payment_eligibility', eligibility
  );
end;
$$;

-- Coordinators must be able to accept an unpaid booking request. Existing paid
-- rows still show their immutable payment breakdown; unpaid rows truthfully
-- explain that payment follows all required acceptances.
create or replace function public.get_my_coordinator_booking_details()
returns table (
  event_id uuid,
  client_notes text,
  package_name text,
  selected_services jsonb,
  payment_confirmed boolean,
  can_accept boolean,
  payment_status text,
  downpayment_amount numeric,
  coordination_fee numeric,
  platform_fee_paid numeric,
  initial_coordinator_share numeric,
  remaining_coordinator_balance numeric,
  paid_at timestamptz,
  balance_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id,
    nullif(trim(event.notes), '') as client_notes,
    package_selection.package_name,
    coalesce(service_selection.items, '[]'::jsonb) as selected_services,
    payment.id is not null as payment_confirmed,
    true as can_accept,
    case
      when payment.id is null then 'Awaiting booking confirmation'
      when coalesce(payment.metadata ->> 'paymentType', 'full') = 'deposit'
        then 'Downpayment confirmed'
      else 'Full payment confirmed'
    end as payment_status,
    round(coalesce(payment.amount, 0), 2) as downpayment_amount,
    round(coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0), 2)
      as coordination_fee,
    round(coalesce(payment.platform_fee_amount, 0), 2) as platform_fee_paid,
    round(coalesce(payment.provider_initial_allocation, 0), 2)
      as initial_coordinator_share,
    round(greatest(
      coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0)
        - coalesce(payment.provider_initial_allocation, 0),
      0
    ), 2) as remaining_coordinator_balance,
    coalesce(payment.verified_at, payment.paid_at, payment.created_at) as paid_at,
    case
      when payment.id is null
        then 'You can accept this request now. The client pays only after every required provider and coordinator has accepted.'
      when event.coordinator_assignment_status = 'pending'
        then 'Accepting records the initial coordinator allocation as a held receivable; it is not withdrawable yet.'
      when event.coordinator_assignment_status = 'accepted'
        then 'The initial coordinator allocation is held by MULTIVENT and becomes eligible for payout 14 days before the event, subject to validation.'
      when event.status = 'completed'
        then 'The remaining coordination balance is due through the completion workflow.'
      else 'The remaining coordination balance becomes due after event completion.'
    end as balance_status
  from public.events event
  left join lateral (
    select selection.package_name
    from public.event_coordinator_package_selections selection
    where selection.event_id = event.id
      and selection.coordinator_id = auth.uid()
    order by selection.selected_at desc
    limit 1
  ) package_selection on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', selection.id,
      'serviceName', selection.service_name,
      'categoryName', coalesce(selection.category_name, 'Service'),
      'providerName', coalesce(provider.business_name, 'Provider'),
      'status', selection.status,
      'notes', selection.notes,
      'cateringOptionName', selection.catering_option_name,
      'venueOptionName', selection.venue_option_name,
      'venueBookedHours', selection.venue_booked_hours
    ) order by selection.created_at, selection.id) as items
    from public.event_service_selections selection
    left join public.provider_profiles provider on provider.id = selection.provider_id
    where selection.event_id = event.id
      and selection.status not in ('declined', 'cancelled')
  ) service_selection on true
  left join lateral (
    select paid_payment.*
    from public.payments paid_payment
    where paid_payment.event_id = event.id
      and paid_payment.coordinator_id = auth.uid()
      and paid_payment.payment_scope = 'coordinator_service'
      and paid_payment.status in ('paid', 'verified')
      and (
        paid_payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or paid_payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
    order by coalesce(paid_payment.verified_at, paid_payment.paid_at,
      paid_payment.created_at) desc, paid_payment.id desc
    limit 1
  ) payment on true
  where auth.uid() is not null
    and (
      (event.pending_coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'pending')
      or (event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted')
    )
  order by event.coordinator_assignment_requested_at desc nulls last,
    event.updated_at desc;
$$;

revoke all on function public.event_payment_eligibility_v14(uuid) from public;
revoke all on function public.refresh_event_payment_eligibility_v14(uuid) from public;
revoke all on function public.enforce_v14_payment_eligibility() from public;
revoke all on function public.respond_to_provider_booking(uuid, boolean, text) from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
revoke all on function public.get_my_coordinator_booking_details() from public;
grant execute on function public.respond_to_provider_booking(uuid, boolean, text) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.get_my_coordinator_booking_details() to authenticated;

comment on function public.event_payment_eligibility_v14(uuid) is
  'V14 Phase 3 authoritative all-provider and coordinator acceptance calculation.';
comment on function public.enforce_v14_payment_eligibility() is
  'Blocks payment creation until every required booking request is accepted.';

commit;
