-- Phase 8: booking-bound, optional catering food tastings.
--
-- Tasting times are provider-configured in the existing Catering
-- category_details JSON and are resolved against the existing availability
-- calendar and operating hours. Historical appointment records are retained.

begin;

create table if not exists public.catering_food_tastings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Manila',
  location text not null,
  status text not null default 'requested',
  client_note text,
  provider_note text,
  schedule_history jsonb not null default '[]'::jsonb,
  responded_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catering_food_tastings_status_check check (
    status in ('requested', 'confirmed', 'reschedule_proposed', 'rejected', 'cancelled', 'completed')
  ),
  constraint catering_food_tastings_time_check check (end_time > start_time),
  constraint catering_food_tastings_history_check check (jsonb_typeof(schedule_history) = 'array')
);

create index if not exists catering_food_tastings_client_updated_idx
  on public.catering_food_tastings (client_id, updated_at desc);
create index if not exists catering_food_tastings_provider_updated_idx
  on public.catering_food_tastings (provider_id, updated_at desc);
create index if not exists catering_food_tastings_booking_idx
  on public.catering_food_tastings (booking_id, created_at desc);

-- A booking has one active appointment at a time, and a provider cannot have
-- two active appointments at the same configured tasting slot.
create unique index if not exists catering_food_tastings_one_active_booking_idx
  on public.catering_food_tastings (booking_id)
  where status in ('requested', 'confirmed', 'reschedule_proposed');
create unique index if not exists catering_food_tastings_one_active_provider_slot_idx
  on public.catering_food_tastings (provider_id, scheduled_date, start_time)
  where status in ('requested', 'confirmed', 'reschedule_proposed');

alter table public.catering_food_tastings enable row level security;

drop policy if exists "Booking participants can view catering food tastings"
  on public.catering_food_tastings;
create policy "Booking participants can view catering food tastings"
  on public.catering_food_tastings for select to authenticated
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.provider_profiles provider
      where provider.id = catering_food_tastings.provider_id
        and provider.user_id = auth.uid()
    )
  );

-- Providers may only publish a valid optional tasting configuration on a
-- catering listing. The normal listing validator remains responsible for
-- menus and pricing; this validator intentionally owns only tasting fields.
create or replace function public.validate_catering_tasting_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  settings jsonb;
  slot_value text;
  slot_count integer;
  distinct_slot_count integer;
  duration_text text;
  lead_text text;
  latest_text text;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%cater%' or not (new.category_details ? 'tastingSettings') then
    return new;
  end if;

  settings := new.category_details -> 'tastingSettings';
  if jsonb_typeof(settings) <> 'object' then
    raise exception 'Food tasting settings must be an object.';
  end if;
  if coalesce(settings ->> 'enabled', 'false') not in ('true', 'false') then
    raise exception 'Food tasting enabled must be true or false.';
  end if;
  if coalesce((settings ->> 'enabled')::boolean, false) = false then
    return new;
  end if;

  if jsonb_typeof(settings -> 'tastingTimeSlots') <> 'array'
    or jsonb_array_length(settings -> 'tastingTimeSlots') = 0 then
    raise exception 'Configure at least one food tasting start time.';
  end if;
  select count(*), count(distinct value)
  into slot_count, distinct_slot_count
  from jsonb_array_elements_text(settings -> 'tastingTimeSlots') slot(value);
  if slot_count <> distinct_slot_count then
    raise exception 'Food tasting start times cannot be duplicated.';
  end if;
  for slot_value in select value from jsonb_array_elements_text(settings -> 'tastingTimeSlots') slot(value)
  loop
    if slot_value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Food tasting start times must use 24-hour HH:MM format.';
    end if;
  end loop;

  duration_text := coalesce(settings ->> 'durationMinutes', '');
  lead_text := coalesce(settings ->> 'minimumLeadDays', '');
  latest_text := coalesce(settings ->> 'latestDaysBeforeEvent', '');
  if duration_text !~ '^[0-9]+$' or duration_text::integer not between 15 and 480 then
    raise exception 'Food tasting duration must be between 15 and 480 minutes.';
  end if;
  if lead_text !~ '^[0-9]+$' or latest_text !~ '^[0-9]+$' then
    raise exception 'Food tasting scheduling windows must be whole, non-negative days.';
  end if;
  if nullif(trim(settings ->> 'location'), '') is null then
    raise exception 'Configure the food tasting location.';
  end if;
  if char_length(trim(settings ->> 'location')) > 500 then
    raise exception 'Food tasting location is too long.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_catering_tasting_settings_trigger on public.services;
create trigger validate_catering_tasting_settings_trigger
before insert or update of category_id, category_details on public.services
for each row execute function public.validate_catering_tasting_settings();

-- This resolver is deliberately private. All appointment writes call it so
-- client and provider actions apply the same booking, date, slot, calendar,
-- operating-hour, cancellation, and timezone rules.
create or replace function public.resolve_catering_tasting_slot(
  target_booking_id uuid,
  target_date date,
  target_start_time time,
  exclude_tasting_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row record;
  settings jsonb;
  duration_minutes integer;
  minimum_lead_days integer;
  latest_days_before_event integer;
  resolved_end_time time;
  resolved_timezone text := 'Asia/Manila';
  resolved_location text;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
  total_minutes integer;
  matching_availability_exists boolean;
begin
  if target_date is null or target_start_time is null then
    raise exception 'Choose a food tasting date and time.';
  end if;

  select booking.id, booking.event_id, booking.client_id, booking.provider_id,
    booking.service_id, booking.status::text as booking_status,
    event.event_date, service.category_details, service.location as service_location,
    category.name as category_name
  into booking_row
  from public.bookings booking
  join public.events event on event.id = booking.event_id
  join public.services service on service.id = booking.service_id
  join public.service_categories category on category.id = service.category_id
  where booking.id = target_booking_id;

  if booking_row.id is null then
    raise exception 'Catering booking not found.' using errcode = '42501';
  end if;
  if public.phase9_category_key(booking_row.category_name) <> 'catering' then
    raise exception 'Food tastings are available only for catering bookings.';
  end if;
  if booking_row.booking_status not in ('confirmed', 'approved') then
    raise exception 'Food tasting is available after the catering provider accepts the booking.';
  end if;
  if booking_row.event_date is null or booking_row.event_date <= today_manila then
    raise exception 'Food tastings cannot be scheduled after the event date.';
  end if;

  settings := booking_row.category_details -> 'tastingSettings';
  if jsonb_typeof(settings) <> 'object' or coalesce((settings ->> 'enabled')::boolean, false) = false then
    raise exception 'This catering provider has not enabled food tasting appointments.';
  end if;
  if jsonb_typeof(settings -> 'tastingTimeSlots') <> 'array'
    or not exists (
      select 1
      from jsonb_array_elements_text(settings -> 'tastingTimeSlots') slot(value)
      where slot.value = to_char(target_start_time, 'HH24:MI')
    ) then
    raise exception 'Choose one of this provider''s configured food tasting slots.';
  end if;

  begin
    duration_minutes := (settings ->> 'durationMinutes')::integer;
    minimum_lead_days := coalesce((settings ->> 'minimumLeadDays')::integer, 0);
    latest_days_before_event := coalesce((settings ->> 'latestDaysBeforeEvent')::integer, 0);
  exception when invalid_text_representation then
    raise exception 'This provider''s food tasting configuration is invalid.';
  end;
  if duration_minutes not between 15 and 480
    or minimum_lead_days < 0 or latest_days_before_event < 0 then
    raise exception 'This provider''s food tasting configuration is invalid.';
  end if;
  total_minutes := extract(hour from target_start_time)::integer * 60
    + extract(minute from target_start_time)::integer + duration_minutes;
  if total_minutes >= 1440 then
    raise exception 'Food tasting must finish on the same day.';
  end if;
  resolved_end_time := target_start_time + make_interval(mins => duration_minutes);
  resolved_location := nullif(trim(settings ->> 'location'), '');
  if resolved_location is null then
    raise exception 'This provider has not configured a food tasting location.';
  end if;

  if target_date < today_manila + minimum_lead_days then
    raise exception 'This food tasting needs at least % day(s) lead time.', minimum_lead_days;
  end if;
  if target_date >= booking_row.event_date
    or (latest_days_before_event > 0 and target_date > booking_row.event_date - latest_days_before_event) then
    raise exception 'Choose a food tasting date within the provider''s allowed window before the event.';
  end if;

  select coalesce(nullif(hours.timezone, ''), resolved_timezone)
  into resolved_timezone
  from public.provider_operating_hours hours
  where hours.provider_id = booking_row.provider_id
    and hours.day_of_week = lower(trim(to_char(target_date, 'Day')))
  order by hours.updated_at desc
  limit 1;

  if exists (
    select 1 from public.provider_availability availability
    where availability.provider_id = booking_row.provider_id
      and availability.available_date = target_date
      and (availability.service_id is null or availability.service_id = booking_row.service_id)
      and availability.is_available = false
  ) then
    raise exception 'The provider is unavailable on the selected food tasting date.';
  end if;

  select exists (
    select 1 from public.provider_availability availability
    where availability.provider_id = booking_row.provider_id
      and availability.available_date = target_date
      and (availability.service_id is null or availability.service_id = booking_row.service_id)
      and availability.is_available = true
      and availability.start_time is not null and availability.end_time is not null
  ) into matching_availability_exists;
  if matching_availability_exists and not exists (
    select 1 from public.provider_availability availability
    where availability.provider_id = booking_row.provider_id
      and availability.available_date = target_date
      and (availability.service_id is null or availability.service_id = booking_row.service_id)
      and availability.is_available = true
      and (availability.start_time is null or availability.start_time <= target_start_time)
      and (availability.end_time is null or availability.end_time >= resolved_end_time)
  ) then
    raise exception 'The selected food tasting slot is outside the provider''s date-specific availability.';
  end if;

  if exists (
    select 1 from public.provider_operating_hours hours
    where hours.provider_id = booking_row.provider_id
      and hours.day_of_week = lower(trim(to_char(target_date, 'Day')))
      and (
        hours.is_open = false
        or hours.open_time is null or hours.close_time is null
        or target_start_time < hours.open_time or resolved_end_time > hours.close_time
      )
  ) then
    raise exception 'The selected food tasting slot is outside the provider''s operating hours.';
  end if;

  -- Existing event bookings use the platform's day-level provider schedule.
  -- Where no duration is available, treating the date as unavailable avoids a
  -- fabricated free time window.
  if exists (
    select 1 from public.bookings other_booking
    where other_booking.provider_id = booking_row.provider_id
      and other_booking.id <> booking_row.id
      and other_booking.requested_date = target_date
      and other_booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed', 'in_progress')
  ) then
    raise exception 'The provider already has an active event booking on this date.';
  end if;

  if exists (
    select 1 from public.catering_food_tastings tasting
    where tasting.provider_id = booking_row.provider_id
      and tasting.scheduled_date = target_date
      and tasting.start_time = target_start_time
      and tasting.status in ('requested', 'confirmed', 'reschedule_proposed')
      and tasting.id is distinct from exclude_tasting_id
  ) then
    raise exception 'That food tasting slot was just reserved. Choose another available time.';
  end if;

  return jsonb_build_object(
    'date', target_date,
    'startTime', to_char(target_start_time, 'HH24:MI'),
    'endTime', to_char(resolved_end_time, 'HH24:MI'),
    'timezone', resolved_timezone,
    'location', resolved_location
  );
end;
$$;

create or replace function public.list_my_catering_food_tasting_slots(
  target_booking_id uuid
)
returns table (
  scheduled_date date,
  start_time time,
  end_time time,
  timezone text,
  location text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row record;
  settings jsonb;
  earliest_date date;
  latest_date date;
  candidate_date date;
  slot_text text;
  slot_time time;
  resolved jsonb;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
  lead_days integer;
  before_event_days integer;
begin
  select booking.id, booking.client_id, event.event_date, service.category_details
  into booking_row
  from public.bookings booking
  join public.events event on event.id = booking.event_id
  join public.services service on service.id = booking.service_id
  where booking.id = target_booking_id and booking.client_id = auth.uid();
  if booking_row.id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;

  settings := booking_row.category_details -> 'tastingSettings';
  if jsonb_typeof(settings) <> 'object' or coalesce((settings ->> 'enabled')::boolean, false) = false then
    return;
  end if;
  begin
    lead_days := coalesce((settings ->> 'minimumLeadDays')::integer, 0);
    before_event_days := coalesce((settings ->> 'latestDaysBeforeEvent')::integer, 0);
  exception when invalid_text_representation then
    return;
  end;
  if booking_row.event_date is null or booking_row.event_date <= today_manila
    or lead_days < 0 or before_event_days < 0 then
    return;
  end if;

  earliest_date := today_manila + lead_days;
  latest_date := least(
    booking_row.event_date - greatest(before_event_days, 1),
    today_manila + 90
  );
  if latest_date < earliest_date or jsonb_typeof(settings -> 'tastingTimeSlots') <> 'array' then
    return;
  end if;

  for candidate_date in
    select day::date
    from generate_series(earliest_date, latest_date, interval '1 day') day
  loop
    for slot_text in select value from jsonb_array_elements_text(settings -> 'tastingTimeSlots') slot(value)
    loop
      if slot_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then continue; end if;
      slot_time := slot_text::time;
      begin
        resolved := public.resolve_catering_tasting_slot(target_booking_id, candidate_date, slot_time);
        scheduled_date := candidate_date;
        start_time := slot_time;
        end_time := (resolved ->> 'endTime')::time;
        timezone := resolved ->> 'timezone';
        location := resolved ->> 'location';
        return next;
      exception when others then
        -- Unavailable dates and occupied slots are intentionally absent from
        -- the client calendar. The selected slot is rechecked on submission.
        continue;
      end;
    end loop;
  end loop;
end;
$$;

create or replace function public.list_my_catering_food_tastings(
  target_booking_ids uuid[] default null
)
returns table (
  id uuid,
  booking_id uuid,
  scheduled_date date,
  start_time time,
  end_time time,
  timezone text,
  location text,
  status text,
  client_note text,
  provider_note text,
  responded_at timestamptz,
  confirmed_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select tasting.id, tasting.booking_id, tasting.scheduled_date, tasting.start_time,
    tasting.end_time, tasting.timezone, tasting.location, tasting.status,
    tasting.client_note, tasting.provider_note, tasting.responded_at,
    tasting.confirmed_at, tasting.updated_at
  from public.catering_food_tastings tasting
  join public.provider_profiles provider on provider.id = tasting.provider_id
  where auth.uid() is not null
    and (target_booking_ids is null or tasting.booking_id = any(target_booking_ids))
    and (tasting.client_id = auth.uid() or provider.user_id = auth.uid())
  order by tasting.updated_at desc, tasting.id desc;
$$;

create or replace function public.request_my_catering_food_tasting(
  target_booking_id uuid,
  requested_date date,
  requested_start_time time,
  requested_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row record;
  resolved jsonb;
  tasting_id uuid;
  provider_user_id uuid;
begin
  select booking.id, booking.client_id, provider.user_id as provider_user_id
  into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id and booking.client_id = auth.uid()
  for update of booking;
  if booking_row.id is null then
    raise exception 'This catering booking is not available to your account.' using errcode = '42501';
  end if;

  resolved := public.resolve_catering_tasting_slot(
    target_booking_id, requested_date, requested_start_time
  );
  provider_user_id := booking_row.provider_user_id;
  begin
    insert into public.catering_food_tastings (
      booking_id, event_id, client_id, provider_id, service_id,
      scheduled_date, start_time, end_time, timezone, location, status,
      client_note, schedule_history
    )
    select booking.id, booking.event_id, booking.client_id, booking.provider_id, booking.service_id,
      requested_date, requested_start_time, (resolved ->> 'endTime')::time,
      resolved ->> 'timezone', resolved ->> 'location', 'requested',
      nullif(left(trim(coalesce(requested_note, '')), 600), ''),
      jsonb_build_array(jsonb_build_object(
        'action', 'requested', 'at', now(), 'by', auth.uid(),
        'date', requested_date, 'startTime', to_char(requested_start_time, 'HH24:MI')
      ))
    from public.bookings booking
    where booking.id = target_booking_id
    returning id into tasting_id;
  exception when unique_violation then
    raise exception 'An active food tasting request already exists for this booking or time slot.';
  end;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    'Food tasting request',
    'A client requested a food tasting appointment for an accepted catering booking.',
    'food_tasting',
    tasting_id
  );

  return jsonb_build_object('id', tasting_id, 'status', 'requested');
end;
$$;

create or replace function public.respond_to_catering_food_tasting(
  target_tasting_id uuid,
  response_action text,
  response_note text default null,
  proposed_date date default null,
  proposed_start_time time default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tasting_row public.catering_food_tastings%rowtype;
  resolved jsonb;
  normalized_action text := lower(trim(coalesce(response_action, '')));
begin
  select tasting.*
  into tasting_row
  from public.catering_food_tastings tasting
  join public.provider_profiles provider on provider.id = tasting.provider_id
  where tasting.id = target_tasting_id and provider.user_id = auth.uid()
  for update of tasting;
  if tasting_row.id is null then
    raise exception 'This food tasting request is not available to your provider account.' using errcode = '42501';
  end if;
  if normalized_action not in ('confirm', 'reject', 'propose') then
    raise exception 'Food tasting response must be confirm, reject, or propose.';
  end if;

  if normalized_action = 'confirm' then
    if tasting_row.status <> 'requested' then
      raise exception 'Only a pending food tasting request can be confirmed.';
    end if;
    update public.catering_food_tastings set
      status = 'confirmed', provider_note = nullif(left(trim(coalesce(response_note, '')), 600), ''),
      responded_at = now(), confirmed_at = now(), updated_at = now(),
      schedule_history = schedule_history || jsonb_build_array(jsonb_build_object(
        'action', 'confirmed', 'at', now(), 'by', auth.uid()
      ))
    where id = tasting_row.id;
  elsif normalized_action = 'reject' then
    if tasting_row.status not in ('requested', 'reschedule_proposed') then
      raise exception 'This food tasting request can no longer be rejected.';
    end if;
    update public.catering_food_tastings set
      status = 'rejected', provider_note = nullif(left(trim(coalesce(response_note, '')), 600), ''),
      responded_at = now(), updated_at = now(),
      schedule_history = schedule_history || jsonb_build_array(jsonb_build_object(
        'action', 'rejected', 'at', now(), 'by', auth.uid()
      ))
    where id = tasting_row.id;
  else
    if tasting_row.status not in ('requested', 'confirmed') then
      raise exception 'This food tasting request can no longer be rescheduled.';
    end if;
    resolved := public.resolve_catering_tasting_slot(
      tasting_row.booking_id, proposed_date, proposed_start_time, tasting_row.id
    );
    update public.catering_food_tastings set
      scheduled_date = proposed_date, start_time = proposed_start_time,
      end_time = (resolved ->> 'endTime')::time,
      timezone = resolved ->> 'timezone', location = resolved ->> 'location',
      status = 'reschedule_proposed', provider_note = nullif(left(trim(coalesce(response_note, '')), 600), ''),
      responded_at = now(), confirmed_at = null, updated_at = now(),
      schedule_history = schedule_history || jsonb_build_array(jsonb_build_object(
        'action', 'reschedule_proposed', 'at', now(), 'by', auth.uid(),
        'date', proposed_date, 'startTime', to_char(proposed_start_time, 'HH24:MI')
      ))
    where id = tasting_row.id;
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    tasting_row.client_id,
    case normalized_action
      when 'confirm' then 'Food tasting confirmed'
      when 'reject' then 'Food tasting request declined'
      else 'Food tasting alternative proposed'
    end,
    case normalized_action
      when 'confirm' then 'Your catering provider confirmed the food tasting appointment.'
      when 'reject' then 'Your catering provider could not accept the food tasting request.'
      else 'Your catering provider proposed another food tasting schedule.'
    end,
    'food_tasting',
    tasting_row.id
  );

  return jsonb_build_object('id', tasting_row.id, 'status', case normalized_action
    when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'reschedule_proposed' end);
end;
$$;

create or replace function public.respond_to_my_catering_food_tasting_proposal(
  target_tasting_id uuid,
  accept_proposal boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tasting_row public.catering_food_tastings%rowtype;
  provider_user_id uuid;
begin
  select tasting.*
  into tasting_row
  from public.catering_food_tastings tasting
  join public.provider_profiles provider on provider.id = tasting.provider_id
  where tasting.id = target_tasting_id and tasting.client_id = auth.uid()
  for update of tasting;
  if tasting_row.id is null or tasting_row.status <> 'reschedule_proposed' then
    raise exception 'There is no pending food tasting proposal for this booking.' using errcode = '42501';
  end if;
  select provider.user_id into provider_user_id
  from public.provider_profiles provider where provider.id = tasting_row.provider_id;

  update public.catering_food_tastings set
    status = case when accept_proposal then 'confirmed' else 'cancelled' end,
    confirmed_at = case when accept_proposal then now() else null end,
    cancelled_at = case when accept_proposal then null else now() end,
    responded_at = now(), updated_at = now(),
    schedule_history = schedule_history || jsonb_build_array(jsonb_build_object(
      'action', case when accept_proposal then 'proposal_accepted' else 'proposal_declined' end,
      'at', now(), 'by', auth.uid()
    ))
  where id = tasting_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when accept_proposal then 'Food tasting proposal accepted' else 'Food tasting proposal declined' end,
    case when accept_proposal then 'The client accepted your proposed food tasting schedule.'
      else 'The client declined your proposed food tasting schedule.' end,
    'food_tasting', tasting_row.id
  );

  return jsonb_build_object('id', tasting_row.id, 'status', case when accept_proposal then 'confirmed' else 'cancelled' end);
end;
$$;

-- A cancelled or rejected catering booking cannot retain an active tasting.
-- We close the appointment but never delete it, preserving appointment history.
create or replace function public.cancel_catering_food_tastings_after_booking_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text in ('cancelled', 'rejected', 'expired')
    and old.status::text is distinct from new.status::text then
    update public.catering_food_tastings set
      status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now(),
      schedule_history = schedule_history || jsonb_build_array(jsonb_build_object(
        'action', 'booking_cancelled', 'at', now(), 'bookingStatus', new.status::text
      ))
    where booking_id = new.id
      and status in ('requested', 'confirmed', 'reschedule_proposed');
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_catering_food_tastings_after_booking_change_trigger on public.bookings;
create trigger cancel_catering_food_tastings_after_booking_change_trigger
after update of status on public.bookings
for each row execute function public.cancel_catering_food_tastings_after_booking_change();

revoke all on function public.validate_catering_tasting_settings() from public;
revoke all on function public.resolve_catering_tasting_slot(uuid, date, time, uuid) from public;
revoke all on function public.list_my_catering_food_tasting_slots(uuid) from public;
revoke all on function public.list_my_catering_food_tastings(uuid[]) from public;
revoke all on function public.request_my_catering_food_tasting(uuid, date, time, text) from public;
revoke all on function public.respond_to_catering_food_tasting(uuid, text, text, date, time) from public;
revoke all on function public.respond_to_my_catering_food_tasting_proposal(uuid, boolean) from public;
revoke all on function public.cancel_catering_food_tastings_after_booking_change() from public;
grant execute on function public.list_my_catering_food_tasting_slots(uuid) to authenticated;
grant execute on function public.list_my_catering_food_tastings(uuid[]) to authenticated;
grant execute on function public.request_my_catering_food_tasting(uuid, date, time, text) to authenticated;
grant execute on function public.respond_to_catering_food_tasting(uuid, text, text, date, time) to authenticated;
grant execute on function public.respond_to_my_catering_food_tasting_proposal(uuid, boolean) to authenticated;

comment on table public.catering_food_tastings is
  'Optional, booking-bound catering tasting appointments with immutable schedule history.';
comment on function public.request_my_catering_food_tasting(uuid, date, time, text) is
  'Creates one optional catering food tasting request after authoritative availability validation.';

commit;
