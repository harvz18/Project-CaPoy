-- Client cancellation and rescheduling for paid event bookings.
-- Apply after 26_catering_service_types.sql.

begin;

create or replace function public.cancel_client_event_bookings(
  target_event_id uuid,
  cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events%rowtype;
  booking_row record;
  cancelled_count integer := 0;
  clean_reason text := nullif(left(trim(cancellation_reason), 500), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select events.*
  into event_row
  from public.events
  where events.id = target_event_id
    and events.client_id = current_user_id
    and events.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This event is not available for cancellation.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.bookings
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status = 'completed'
  ) then
    raise exception 'A completed service cannot be cancelled.';
  end if;

  for booking_row in
    select
      bookings.id,
      coalesce(services.name, 'service') as service_name,
      provider_profiles.user_id as provider_user_id
    from public.bookings
    join public.provider_profiles on provider_profiles.id = bookings.provider_id
    left join public.services on services.id = bookings.service_id
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status in (
        'requested',
        'approved',
        'payment_required',
        'paid',
        'confirmed'
      )
    for update of bookings
  loop
    update public.bookings
    set status = 'cancelled', updated_at = now()
    where id = booking_row.id;

    cancelled_count := cancelled_count + 1;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      booking_row.provider_user_id,
      'Booking cancelled by client',
      format(
        'The client cancelled %s for %s.%s',
        booking_row.service_name,
        coalesce(nullif(trim(event_row.name), ''), 'their event'),
        case when clean_reason is null then '' else format(' Reason: %s', clean_reason) end
      ),
      'booking',
      booking_row.id
    );
  end loop;

  if cancelled_count = 0 then
    raise exception 'No active provider bookings are available to cancel.';
  end if;

  delete from public.event_schedule_checks
  where event_id = event_row.id;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    previous_state,
    new_state,
    result,
    metadata
  )
  values (
    current_user_id,
    'client',
    'booking.cancel',
    'event',
    event_row.id,
    jsonb_build_object('status', event_row.status),
    jsonb_build_object('cancelled_booking_count', cancelled_count),
    'success',
    jsonb_build_object('reason', clean_reason)
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'cancelled_booking_count', cancelled_count
  );
end;
$$;

create or replace function public.reschedule_client_event_bookings(
  target_event_id uuid,
  requested_event_date date,
  requested_event_time time without time zone
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events%rowtype;
  booking_row record;
  changed_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if requested_event_date is null or requested_event_time is null then
    raise exception 'Choose a valid event date and time.';
  end if;

  if requested_event_date < current_date then
    raise exception 'The new event date cannot be in the past.';
  end if;

  select events.*
  into event_row
  from public.events
  where events.id = target_event_id
    and events.client_id = current_user_id
    and events.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This event is not available for rescheduling.' using errcode = '42501';
  end if;

  if event_row.event_date = requested_event_date
    and event_row.event_time = requested_event_time
  then
    raise exception 'Choose a different date or time.';
  end if;

  if exists (
    select 1
    from public.bookings
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status = 'completed'
  ) then
    raise exception 'An event with a completed service cannot be rescheduled.';
  end if;

  for booking_row in
    select
      bookings.id,
      bookings.provider_id,
      bookings.service_id,
      coalesce(services.name, 'service') as service_name,
      coalesce(provider_profiles.business_name, 'This provider') as provider_name,
      provider_profiles.user_id as provider_user_id
    from public.bookings
    join public.provider_profiles on provider_profiles.id = bookings.provider_id
    left join public.services on services.id = bookings.service_id
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status in ('requested', 'approved', 'paid', 'confirmed')
    for update of bookings
  loop
    if exists (
      select 1
      from public.bookings as conflicting_booking
      where conflicting_booking.provider_id = booking_row.provider_id
        and conflicting_booking.event_id <> event_row.id
        and conflicting_booking.requested_date = requested_event_date
        and conflicting_booking.status in (
          'requested',
          'approved',
          'payment_required',
          'paid',
          'confirmed'
        )
    ) then
      raise exception '% is already booked on the selected date.', booking_row.provider_name;
    end if;

    if exists (
      select 1
      from public.provider_availability as availability
      where availability.provider_id = booking_row.provider_id
        and availability.available_date = requested_event_date
        and (
          availability.service_id is null
          or availability.service_id = booking_row.service_id
        )
        and (
          availability.is_available = false
          or (
            availability.start_time is not null
            and requested_event_time < availability.start_time
          )
          or (
            availability.end_time is not null
            and requested_event_time > availability.end_time
          )
        )
    ) then
      raise exception '% is unavailable at the selected date or time.', booking_row.provider_name;
    end if;

    if exists (
      select 1
      from public.provider_operating_hours as operating_hours
      where operating_hours.provider_id = booking_row.provider_id
        and operating_hours.day_of_week = lower(trim(to_char(requested_event_date, 'Day')))
        and (
          operating_hours.is_open = false
          or requested_event_time < operating_hours.open_time
          or requested_event_time > operating_hours.close_time
        )
    ) then
      raise exception 'The selected time is outside %''s operating hours.', booking_row.provider_name;
    end if;

    changed_count := changed_count + 1;
  end loop;

  if changed_count = 0 then
    raise exception 'No active provider bookings are available to reschedule.';
  end if;

  update public.events
  set
    event_date = requested_event_date,
    event_time = requested_event_time,
    updated_at = now()
  where id = event_row.id;

  update public.bookings
  set
    requested_date = requested_event_date,
    requested_time = requested_event_time,
    status = 'requested',
    updated_at = now()
  where event_id = event_row.id
    and client_id = current_user_id
    and status in ('requested', 'approved', 'paid', 'confirmed');

  delete from public.event_schedule_checks
  where event_id = event_row.id;

  for booking_row in
    select
      bookings.id,
      coalesce(services.name, 'service') as service_name,
      provider_profiles.user_id as provider_user_id
    from public.bookings
    join public.provider_profiles on provider_profiles.id = bookings.provider_id
    left join public.services on services.id = bookings.service_id
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status = 'requested'
  loop
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      booking_row.provider_user_id,
      'Client requested a new event schedule',
      format(
        '%s moved %s to %s at %s. Please review the updated request.',
        coalesce(nullif(trim(event_row.name), ''), 'The event'),
        booking_row.service_name,
        to_char(requested_event_date, 'Mon DD, YYYY'),
        to_char(requested_event_time, 'HH12:MI AM')
      ),
      'booking',
      booking_row.id
    );
  end loop;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    previous_state,
    new_state,
    result
  )
  values (
    current_user_id,
    'client',
    'booking.reschedule',
    'event',
    event_row.id,
    jsonb_build_object('event_date', event_row.event_date, 'event_time', event_row.event_time),
    jsonb_build_object('event_date', requested_event_date, 'event_time', requested_event_time),
    'success'
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'rescheduled_booking_count', changed_count,
    'event_date', requested_event_date,
    'event_time', requested_event_time
  );
end;
$$;

revoke all on function public.cancel_client_event_bookings(uuid, text) from public;
revoke all on function public.reschedule_client_event_bookings(uuid, date, time without time zone) from public;

grant execute on function public.cancel_client_event_bookings(uuid, text) to authenticated;
grant execute on function public.reschedule_client_event_bookings(uuid, date, time without time zone) to authenticated;

commit;
