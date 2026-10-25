-- MULTIVENT Revision V14, Phase 2: create provider/coordinator booking requests
-- before payment. This is additive and leaves historic bookings and payments untouched.

begin;

create or replace function public.submit_my_event_booking_requests_v14(
  target_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  selection_row record;
  existing_booking_id uuid;
  first_booking_id uuid;
  provider_user_id uuid;
  snapshot jsonb;
  provider_amount_value numeric(12,2);
  commission_rate_value numeric(7,6);
  commission_amount_value numeric(12,2);
  booking_amount_value numeric(12,2);
  created_count integer := 0;
  request_count integer := 0;
  coordinator_request_submitted boolean := false;
  has_submission_target boolean := false;
  now_at timestamptz := now();
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  -- Quotes, schedules, venue options, packages, and category conflicts are
  -- still validated using the existing authoritative Phase 9 validation path.
  -- A retry with only already-requested selections bypasses repricing so it
  -- remains idempotent and does not re-evaluate its own active requests.
  if exists (
    select 1 from public.event_service_selections selection
    where selection.event_id = event_row.id
      and selection.client_id = auth.uid()
      and selection.status = 'selected'
  ) then
    perform public.validate_my_phase9_selections(target_event_id);
  end if;

  for selection_row in
    select selection.id, selection.provider_id, selection.service_id,
      selection.package_id, selection.package_snapshot, selection.estimated_amount,
      selection.notes, selection.service_name, selection.status,
      selection.selected_provider_snapshot, selection.catering_option_id,
      selection.catering_option_name, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_option_name,
      selection.venue_option_snapshot, selection.venue_options_snapshot,
      selection.venue_booking_snapshot, selection.venue_booked_hours,
      selection.venue_setup_start_at, selection.venue_start_at, selection.venue_end_at
    from public.event_service_selections selection
    where selection.event_id = event_row.id
      and selection.client_id = auth.uid()
      and selection.status in ('selected', 'requested')
    order by selection.created_at, selection.id
  loop
    if selection_row.provider_id is null or selection_row.service_id is null then
      raise exception 'Each selected service needs an available provider before booking.';
    end if;
    has_submission_target := true;

    select booking.id into existing_booking_id
    from public.bookings booking
    where booking.event_id = event_row.id
      and booking.client_id = event_row.client_id
      and booking.provider_id = selection_row.provider_id
      and booking.service_id = selection_row.service_id
      and booking.status not in ('rejected', 'cancelled', 'expired')
    order by booking.updated_at desc, booking.id desc
    limit 1
    for update;

    if existing_booking_id is not null then
      update public.event_service_selections
      set status = 'requested', updated_at = now_at
      where id = selection_row.id and status = 'selected';
      first_booking_id := coalesce(first_booking_id, existing_booking_id);
      request_count := request_count + 1;
      continue;
    end if;

    snapshot := coalesce(selection_row.selected_provider_snapshot, '{}'::jsonb);
    provider_amount_value := round(case
      when jsonb_typeof(snapshot -> 'providerAmount') = 'number'
        then (snapshot ->> 'providerAmount')::numeric
      else coalesce(selection_row.estimated_amount, 0)
    end, 2);
    commission_rate_value := public.get_public_commission_rate();
    commission_amount_value := round(provider_amount_value * commission_rate_value, 2);
    booking_amount_value := provider_amount_value + commission_amount_value;

    begin
      insert into public.bookings (
        amount,
        catering_option_id,
        catering_option_name,
        catering_option_snapshot,
        client_id,
        client_notes,
        commission_amount,
        commission_model,
        commission_rate,
        event_id,
        financial_terms_version,
        package_id,
        package_snapshot,
        provider_id,
        provider_amount,
        requested_date,
        requested_time,
        service_id,
        status,
        updated_at,
        venue_booked_hours,
        venue_end_at,
        venue_option_id,
        venue_option_name,
        venue_option_snapshot,
        venue_options_snapshot,
        venue_booking_snapshot,
        venue_setup_start_at,
        venue_start_at
      ) values (
        booking_amount_value,
        selection_row.catering_option_id,
        selection_row.catering_option_name,
        selection_row.catering_option_snapshot,
        event_row.client_id,
        selection_row.notes,
        commission_amount_value,
        'added_to_customer',
        commission_rate_value,
        event_row.id,
        'phase5-v1',
        selection_row.package_id,
        selection_row.package_snapshot,
        selection_row.provider_id,
        provider_amount_value,
        event_row.event_date,
        event_row.event_time,
        selection_row.service_id,
        'requested',
        now_at,
        selection_row.venue_booked_hours,
        selection_row.venue_end_at,
        selection_row.venue_option_id,
        selection_row.venue_option_name,
        selection_row.venue_option_snapshot,
        selection_row.venue_options_snapshot,
        selection_row.venue_booking_snapshot,
        selection_row.venue_setup_start_at,
        selection_row.venue_start_at
      )
      returning id into existing_booking_id;
    exception when unique_violation then
      -- The event row lock serializes normal retries. This fallback also keeps
      -- a response-lost retry idempotent if a legacy client submitted in parallel.
      select booking.id into existing_booking_id
      from public.bookings booking
      where booking.event_id = event_row.id
        and booking.client_id = event_row.client_id
        and booking.provider_id = selection_row.provider_id
        and booking.service_id = selection_row.service_id
        and booking.status not in ('rejected', 'cancelled', 'expired')
      order by booking.updated_at desc, booking.id desc
      limit 1;
      if existing_booking_id is null then
        raise;
      end if;
    end;

    update public.event_service_selections
    set status = 'requested', updated_at = now_at
    where id = selection_row.id;

    select provider.user_id into provider_user_id
    from public.provider_profiles provider
    where provider.id = selection_row.provider_id;
    if provider_user_id is null then
      raise exception 'The selected service provider is no longer available.';
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      provider_user_id,
      'New booking request',
      format('%s was requested for %s.', coalesce(selection_row.service_name, 'A service'), event_row.name),
      'booking',
      existing_booking_id
    );

    first_booking_id := coalesce(first_booking_id, existing_booking_id);
    created_count := created_count + 1;
    request_count := request_count + 1;
  end loop;

  -- A selected coordinator becomes an invitation only when the client submits
  -- the plan. No payment record is created or required by this transition.
  if event_row.pending_coordinator_id is not null
    and event_row.coordinator_assignment_status = 'awaiting_payment'
  then
    perform set_config('app.coordinator_assignment_authorized', 'true', true);
    update public.events
    set coordinator_assignment_status = 'pending',
        coordinator_assignment_requested_at = now_at,
        coordinator_assignment_note = 'Coordinator booking request submitted by the client.',
        status = case when status in ('draft', 'planning') then 'booking' else status end,
        updated_at = now_at
    where id = event_row.id;

    update public.coordinator_assignment_attempts
    set status = 'invited',
        requested_at = now_at,
        assigned_by = event_row.client_id,
        note = 'Booking request submitted by the client.',
        updated_at = now_at
    where event_id = event_row.id
      and coordinator_id = event_row.pending_coordinator_id
      and status in ('invited', 'withdrawn', 'reassigned', 'declined');

    if not found then
      insert into public.coordinator_assignment_attempts (
        event_id, coordinator_id, assignment_source, status, requested_at, assigned_by, note
      ) values (
        event_row.id, event_row.pending_coordinator_id, 'client', 'invited', now_at,
        event_row.client_id, 'Booking request submitted by the client.'
      );
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.pending_coordinator_id,
      'New coordinator booking request',
      format('You were requested to coordinate %s.', event_row.name),
      'event',
      event_row.id
    );
    coordinator_request_submitted := true;
    has_submission_target := true;
    request_count := request_count + 1;
  elsif event_row.pending_coordinator_id is not null
    and event_row.coordinator_assignment_status = 'pending'
  then
    has_submission_target := true;
    coordinator_request_submitted := true;
  elsif event_row.coordinator_id is not null
    and event_row.coordinator_assignment_status = 'accepted'
  then
    has_submission_target := true;
    coordinator_request_submitted := true;
  end if;

  if not has_submission_target then
    raise exception 'Add a provider service or coordinator before submitting booking requests.';
  end if;

  update public.events
  set status = case when status in ('draft', 'planning') then 'booking' else status end,
      updated_at = now_at
  where id = event_row.id;

  return jsonb_build_object(
    'booking_id', first_booking_id,
    'created_count', created_count,
    'request_count', request_count,
    'coordinator_request_submitted', coordinator_request_submitted
  );
end;
$$;

revoke all on function public.submit_my_event_booking_requests_v14(uuid) from public;
grant execute on function public.submit_my_event_booking_requests_v14(uuid) to authenticated;

comment on function public.submit_my_event_booking_requests_v14(uuid) is
  'V14 Phase 2 idempotent booking-request submission. It validates selected services and creates no payment records.';

commit;
