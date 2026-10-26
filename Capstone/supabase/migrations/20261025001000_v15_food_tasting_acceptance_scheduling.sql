-- MULTIVENT Revision V15, Phase 3: provider acceptance and the first
-- seven-calendar-day food-tasting scheduling window.  This is deliberately
-- additive to the pre-V15 optional tasting appointment flow.  A V15 tasting
-- request has no payable price until its menu is finalized in a later phase.

begin;

create table if not exists public.catering_food_tasting_workflows (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  preliminary_menu jsonb not null,
  guest_count integer not null check (guest_count > 0),
  status text not null default 'awaiting_provider_acceptance',
  provider_accepted_at timestamptz,
  scheduling_window_start_date date,
  scheduling_window_end_date date,
  scheduled_tasting_id uuid references public.catering_food_tastings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catering_food_tasting_workflows_menu_object_check
    check (jsonb_typeof(preliminary_menu) = 'object'),
  constraint catering_food_tasting_workflows_status_check
    check (status in (
      'awaiting_provider_acceptance', 'scheduling_required', 'scheduled',
      'completed', 'cancelled', 'final_menu_pending', 'final_menu_submitted',
      'client_confirmation_required', 'finalized'
    )),
  constraint catering_food_tasting_workflows_window_check
    check (
      (provider_accepted_at is null and scheduling_window_start_date is null and scheduling_window_end_date is null)
      or (
        provider_accepted_at is not null
        and scheduling_window_start_date is not null
        and scheduling_window_end_date is not null
        and scheduling_window_end_date >= scheduling_window_start_date
      )
    )
);

create index if not exists catering_food_tasting_workflows_client_updated_idx
  on public.catering_food_tasting_workflows (client_id, updated_at desc);
create index if not exists catering_food_tasting_workflows_provider_updated_idx
  on public.catering_food_tasting_workflows (provider_id, updated_at desc);
create index if not exists catering_food_tasting_workflows_event_idx
  on public.catering_food_tasting_workflows (event_id, status);

alter table public.catering_food_tasting_workflows enable row level security;

drop policy if exists "Booking participants can view V15 food tasting workflows"
  on public.catering_food_tasting_workflows;
create policy "Booking participants can view V15 food tasting workflows"
  on public.catering_food_tasting_workflows for select to authenticated
  using (
    client_id = auth.uid()
    or exists (
      select 1
      from public.provider_profiles provider
      where provider.id = catering_food_tasting_workflows.provider_id
        and provider.user_id = auth.uid()
    )
  );

-- A V15 request is an intentionally provisional booking request.  It captures
-- the authoritative preliminary menu and event/provider relationship without
-- fabricating a final menu or price.  The normal V14 booking request remains
-- untouched for every non-tasting service.
create or replace function public.submit_my_catering_food_tasting_request_v15(
  target_event_id uuid,
  target_service_id uuid,
  target_guest_count integer,
  target_menu_item_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  service_row record;
  existing_selection public.event_service_selections%rowtype;
  existing_booking public.bookings%rowtype;
  preliminary jsonb;
  selection_id uuid;
  booking_id uuid;
  provider_user_id uuid;
  next_revision integer;
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

  -- This reuses the Phase 2 server-owned menu builder, including every
  -- course-limit, dish-availability, guest-count, and ownership validation.
  preliminary := public.build_v15_preliminary_tasting_menu(
    target_event_id,
    target_service_id,
    target_guest_count,
    target_menu_item_ids
  );
  if not coalesce((preliminary ->> 'isComplete')::boolean, false) then
    raise exception 'Complete every food tasting course before sending this request.'
      using errcode = '22023';
  end if;

  select service.id, service.provider_id, service.category_id, service.name,
    category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true;
  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'catering'
    or service_row.provider_id is null then
    raise exception 'Catering service not found.' using errcode = '22023';
  end if;

  select * into existing_selection
  from public.event_service_selections selection
  where selection.event_id = event_row.id
    and selection.category_key = 'catering'
    and selection.status not in ('declined', 'cancelled')
  order by selection.created_at, selection.id
  limit 1
  for update;

  if existing_selection.id is not null
    and existing_selection.service_id is distinct from target_service_id then
    raise exception 'A catering service is already selected or requested for this event. Resolve it before requesting food tasting.'
      using errcode = '22023';
  end if;

  if existing_selection.id is not null and existing_selection.status <> 'selected' then
    select * into existing_booking
    from public.bookings booking
    where booking.event_id = event_row.id
      and booking.client_id = event_row.client_id
      and booking.provider_id = service_row.provider_id
      and booking.service_id = target_service_id
      and booking.status not in ('rejected', 'cancelled', 'expired')
    order by booking.updated_at desc, booking.id desc
    limit 1
    for update;

    if existing_booking.id is not null and exists (
      select 1 from public.catering_food_tasting_workflows workflow
      where workflow.booking_id = existing_booking.id
    ) then
      return jsonb_build_object(
        'alreadySubmitted', true,
        'bookingId', existing_booking.id,
        'selectionId', existing_selection.id
      );
    end if;

    raise exception 'This catering request can no longer be changed here.' using errcode = '22023';
  end if;

  select coalesce(max(draft.revision), 0) + 1 into next_revision
  from public.catering_food_tasting_drafts draft
  where draft.event_id = event_row.id
    and draft.client_id = auth.uid()
    and draft.service_id = target_service_id;

  insert into public.catering_food_tasting_drafts (
    event_id, client_id, provider_id, service_id, guest_count,
    preliminary_menu, is_complete, revision, updated_at
  ) values (
    event_row.id, event_row.client_id, service_row.provider_id, target_service_id,
    target_guest_count, preliminary, true, next_revision, now_at
  ) on conflict (event_id, service_id) do update set
    guest_count = excluded.guest_count,
    preliminary_menu = excluded.preliminary_menu,
    is_complete = true,
    revision = excluded.revision,
    updated_at = now_at
  where public.catering_food_tasting_drafts.client_id = auth.uid();

  if existing_selection.id is null then
    insert into public.event_service_selections (
      event_id, client_id, provider_id, service_id, category_id, category_key,
      service_name, category_name, estimated_amount, attendee_count,
      catering_option_id, catering_option_name, catering_option_snapshot,
      food_tasting_preference, notes, status, selected_provider_snapshot
    ) values (
      event_row.id, event_row.client_id, service_row.provider_id, target_service_id,
      service_row.category_id, 'catering', service_row.name, service_row.category_name,
      0, target_guest_count, 'food-tasting-pending', 'Food tasting menu pending',
      jsonb_build_object(
        'foodTastingPreference', true,
        'finalPricePending', true,
        'preliminaryTastingMenu', preliminary
      ),
      true, null, 'requested',
      jsonb_build_object(
        'finalPricePending', true,
        'providerAmount', 0,
        'providerName', coalesce((select provider.business_name
          from public.provider_profiles provider where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'v15-food-tasting-pending-v1'
      )
    ) returning id into selection_id;
  else
    selection_id := existing_selection.id;
    update public.event_service_selections set
      provider_id = service_row.provider_id,
      service_id = target_service_id,
      category_id = service_row.category_id,
      service_name = service_row.name,
      category_name = service_row.category_name,
      category_key = 'catering',
      estimated_amount = 0,
      attendee_count = target_guest_count,
      budget_per_head = null,
      catering_option_id = 'food-tasting-pending',
      catering_option_name = 'Food tasting menu pending',
      catering_option_snapshot = jsonb_build_object(
        'foodTastingPreference', true,
        'finalPricePending', true,
        'preliminaryTastingMenu', preliminary
      ),
      food_tasting_preference = true,
      notes = null,
      selected_provider_snapshot = jsonb_build_object(
        'finalPricePending', true,
        'providerAmount', 0,
        'providerName', coalesce((select provider.business_name
          from public.provider_profiles provider where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'v15-food-tasting-pending-v1'
      ),
      status = 'requested',
      updated_at = now_at
    where id = selection_id;
  end if;

  insert into public.bookings (
    amount, catering_option_id, catering_option_name, catering_option_snapshot,
    client_id, client_notes, commission_amount, commission_model, commission_rate,
    event_id, financial_terms_version, food_tasting_preference, provider_id,
    provider_amount, requested_date, requested_time, service_id, status, updated_at
  ) values (
    0, 'food-tasting-pending', 'Food tasting menu pending',
    jsonb_build_object(
      'foodTastingPreference', true,
      'finalPricePending', true,
      'preliminaryTastingMenu', preliminary
    ),
    event_row.client_id, null, 0, 'added_to_customer', public.get_public_commission_rate(),
    event_row.id, 'phase5-v1', true, service_row.provider_id,
    0, event_row.event_date, event_row.event_time, target_service_id, 'requested', now_at
  ) returning id into booking_id;

  insert into public.catering_food_tasting_workflows (
    booking_id, event_id, client_id, provider_id, service_id,
    preliminary_menu, guest_count, status
  ) values (
    booking_id, event_row.id, event_row.client_id, service_row.provider_id,
    target_service_id, preliminary, target_guest_count, 'awaiting_provider_acceptance'
  );

  select provider.user_id into provider_user_id
  from public.provider_profiles provider
  where provider.id = service_row.provider_id;
  if provider_user_id is null then
    raise exception 'The selected service provider is no longer available.';
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    'Food tasting booking request',
    format('%s requested food tasting for %s. Review the preliminary menu and event details.',
      service_row.name, event_row.name),
    'booking', booking_id
  );

  update public.events
  set status = case when status in ('draft', 'planning') then 'booking' else status end,
      updated_at = now_at
  where id = event_row.id;

  return jsonb_build_object(
    'alreadySubmitted', false,
    'bookingId', booking_id,
    'selectionId', selection_id
  );
exception when unique_violation then
  select booking.id into booking_id
  from public.bookings booking
  where booking.event_id = event_row.id
    and booking.client_id = event_row.client_id
    and booking.provider_id = service_row.provider_id
    and booking.service_id = target_service_id
    and booking.status not in ('rejected', 'cancelled', 'expired')
  order by booking.updated_at desc, booking.id desc
  limit 1;
  if booking_id is null then raise; end if;
  return jsonb_build_object('alreadySubmitted', true, 'bookingId', booking_id);
end;
$$;

-- Provider acceptance starts the one seven-calendar-day window in Manila.
-- It runs from the existing V14 provider-decision procedure through a booking
-- trigger so there is no second acceptance path and no duplicate notification.
create or replace function public.start_v15_food_tasting_scheduling_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_date date := (now() at time zone 'Asia/Manila')::date;
begin
  if new.status::text in ('confirmed', 'approved')
    and old.status::text is distinct from new.status::text then
    update public.catering_food_tasting_workflows workflow
    set status = 'scheduling_required',
        provider_accepted_at = now(),
        scheduling_window_start_date = accepted_date,
        scheduling_window_end_date = accepted_date + 7,
        updated_at = now()
    where workflow.booking_id = new.id
      and workflow.status = 'awaiting_provider_acceptance';

    if found then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      select workflow.client_id,
        'Your Food Tasting Request Was Accepted!',
        'Choose a food tasting schedule within the next 7 days.',
        'food_tasting', workflow.booking_id
      from public.catering_food_tasting_workflows workflow
      where workflow.booking_id = new.id;
    end if;
  elsif new.status::text in ('rejected', 'cancelled', 'expired')
    and old.status::text is distinct from new.status::text then
    update public.catering_food_tasting_workflows workflow
    set status = 'cancelled', updated_at = now()
    where workflow.booking_id = new.id
      and workflow.status in ('awaiting_provider_acceptance', 'scheduling_required', 'scheduled');
  end if;
  return new;
end;
$$;

drop trigger if exists start_v15_food_tasting_scheduling_window_trigger on public.bookings;
create trigger start_v15_food_tasting_scheduling_window_trigger
after update of status on public.bookings
for each row execute function public.start_v15_food_tasting_scheduling_window();

-- V15 appointments are scheduled by the client only after provider acceptance.
-- Existing legacy tasting requests continue through their original procedures.
create or replace function public.protect_v15_food_tasting_appointments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
begin
  target_booking_id := case when tg_op = 'INSERT' then new.booking_id else old.booking_id end;
  if exists (
    select 1 from public.catering_food_tasting_workflows workflow
    where workflow.booking_id = target_booking_id
  ) and coalesce(current_setting('app.v15_food_tasting_schedule_authorized', true), '') <> 'true' then
    raise exception 'This food tasting uses the V15 client scheduling workflow.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_v15_food_tasting_appointments_trigger on public.catering_food_tastings;
create trigger protect_v15_food_tasting_appointments_trigger
before insert or update of scheduled_date, start_time, end_time, status
on public.catering_food_tastings
for each row execute function public.protect_v15_food_tasting_appointments();

create or replace function public.list_my_v15_catering_food_tasting_slots(
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
  workflow_row public.catering_food_tasting_workflows%rowtype;
  candidate_date date;
  earliest_date date;
  slot_text text;
  slot_time time;
  resolved jsonb;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
  settings jsonb;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id
    and workflow.client_id = auth.uid();
  if workflow_row.booking_id is null then
    raise exception 'This V15 food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'scheduling_required' then
    return;
  end if;
  if workflow_row.scheduling_window_end_date < today_manila then
    return;
  end if;

  select service.category_details -> 'tastingSettings' into settings
  from public.services service where service.id = workflow_row.service_id;
  if jsonb_typeof(settings -> 'tastingTimeSlots') <> 'array' then return; end if;

  earliest_date := greatest(workflow_row.scheduling_window_start_date, today_manila);
  if earliest_date > workflow_row.scheduling_window_end_date then return; end if;

  for candidate_date in
    select day::date
    from generate_series(earliest_date, workflow_row.scheduling_window_end_date, interval '1 day') day
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
        -- The resolver remains the authoritative availability, calendar,
        -- operating-hours, event-date, and overlap guard.
        continue;
      end;
    end loop;
  end loop;
end;
$$;

create or replace function public.schedule_my_v15_catering_food_tasting(
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
  workflow_row public.catering_food_tasting_workflows%rowtype;
  resolved jsonb;
  tasting_id uuid;
  provider_user_id uuid;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id
    and workflow.client_id = auth.uid()
  for update;
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'scheduling_required' then
    raise exception 'Food tasting scheduling is not currently required for this booking.' using errcode = '22023';
  end if;
  if workflow_row.scheduling_window_end_date < today_manila
    or requested_date < greatest(workflow_row.scheduling_window_start_date, today_manila)
    or requested_date > workflow_row.scheduling_window_end_date then
    raise exception 'Choose a food tasting schedule within the seven-day window after provider acceptance.'
      using errcode = '22023';
  end if;

  resolved := public.resolve_catering_tasting_slot(
    target_booking_id, requested_date, requested_start_time
  );
  perform set_config('app.v15_food_tasting_schedule_authorized', 'true', true);

  begin
    insert into public.catering_food_tastings (
      booking_id, event_id, client_id, provider_id, service_id,
      scheduled_date, start_time, end_time, timezone, location, status,
      client_note, confirmed_at, schedule_history
    ) values (
      workflow_row.booking_id, workflow_row.event_id, workflow_row.client_id,
      workflow_row.provider_id, workflow_row.service_id,
      requested_date, requested_start_time, (resolved ->> 'endTime')::time,
      resolved ->> 'timezone', resolved ->> 'location', 'confirmed',
      nullif(left(trim(coalesce(requested_note, '')), 600), ''), now(),
      jsonb_build_array(jsonb_build_object(
        'action', 'scheduled_by_client_after_provider_acceptance',
        'at', now(), 'by', auth.uid(),
        'date', requested_date, 'startTime', to_char(requested_start_time, 'HH24:MI')
      ))
    ) returning id into tasting_id;
  exception when unique_violation then
    raise exception 'That food tasting slot was just reserved. Choose another available time.'
      using errcode = '23505';
  end;

  update public.catering_food_tasting_workflows
  set status = 'scheduled', scheduled_tasting_id = tasting_id, updated_at = now()
  where booking_id = workflow_row.booking_id;

  select provider.user_id into provider_user_id
  from public.provider_profiles provider where provider.id = workflow_row.provider_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values
    (provider_user_id, 'Food tasting scheduled',
      'Your client selected a confirmed food tasting appointment.', 'food_tasting', tasting_id),
    (workflow_row.client_id, 'Food tasting appointment confirmed',
      'Your food tasting schedule has been confirmed.', 'food_tasting', tasting_id);

  return jsonb_build_object('id', tasting_id, 'status', 'confirmed');
end;
$$;

create or replace function public.list_my_catering_food_tasting_workflows_v15(
  target_booking_ids uuid[] default null
)
returns table (
  booking_id uuid,
  preliminary_menu jsonb,
  guest_count integer,
  workflow_status text,
  provider_accepted_at timestamptz,
  scheduling_window_start_date date,
  scheduling_window_end_date date,
  scheduled_tasting_id uuid,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select workflow.booking_id, workflow.preliminary_menu, workflow.guest_count,
    workflow.status, workflow.provider_accepted_at,
    workflow.scheduling_window_start_date, workflow.scheduling_window_end_date,
    workflow.scheduled_tasting_id, workflow.updated_at
  from public.catering_food_tasting_workflows workflow
  join public.provider_profiles provider on provider.id = workflow.provider_id
  where auth.uid() is not null
    and (target_booking_ids is null or workflow.booking_id = any(target_booking_ids))
    and (workflow.client_id = auth.uid() or provider.user_id = auth.uid())
  order by workflow.updated_at desc, workflow.booking_id desc;
$$;

-- A food-tasting request deliberately has a zero, non-payable provisional
-- price.  Preserve V14 acceptance behavior while preventing payment until a
-- later final-menu phase replaces this guard with the completed-menu checks.
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
  unfinished_food_tasting_count integer := 0;
  coordinator_required boolean := false;
  coordinator_accepted boolean := true;
  event_valid boolean := false;
  payment_eligible boolean := false;
  waiting_for text := null;
begin
  select * into event_row from public.events event where event.id = target_event_id;
  if event_row.id is null then
    return jsonb_build_object('event_found', false, 'payment_eligible', false, 'reason', 'Event not found.');
  end if;

  event_valid := event_row.status not in ('completed', 'cancelled');
  select
    count(*)::integer,
    count(*) filter (where booking.status in ('approved', 'paid', 'confirmed', 'completed'))::integer,
    count(*) filter (where booking.status = 'rejected')::integer,
    count(*) filter (where booking.status = 'cancelled')::integer
  into provider_count, accepted_provider_count, declined_provider_count, cancelled_provider_count
  from public.bookings booking
  where booking.event_id = event_row.id and booking.status <> 'expired';

  select count(*)::integer into selected_without_request_count
  from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.status = 'selected';

  select count(*)::integer into unfinished_food_tasting_count
  from public.catering_food_tasting_workflows workflow
  join public.bookings booking on booking.id = workflow.booking_id
  where workflow.event_id = event_row.id
    and booking.status not in ('rejected', 'cancelled', 'expired')
    and workflow.status not in ('cancelled', 'finalized');

  coordinator_required := coalesce(event_row.wants_coordinator, false)
    or event_row.pending_coordinator_id is not null or event_row.coordinator_id is not null;
  coordinator_accepted := not coordinator_required or (
    event_row.coordinator_assignment_status = 'accepted' and event_row.coordinator_id is not null
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
    waiting_for := format('Waiting for %s provider confirmation%s.', provider_count - accepted_provider_count,
      case when provider_count - accepted_provider_count = 1 then '' else 's' end);
  elsif unfinished_food_tasting_count > 0 then
    waiting_for := 'Final food tasting menu confirmation is required before payment.';
  elsif not coordinator_accepted then
    waiting_for := 'Waiting for coordinator confirmation.';
  else
    payment_eligible := true;
  end if;

  return jsonb_build_object(
    'event_found', true, 'event_valid', event_valid,
    'provider_count', provider_count, 'accepted_provider_count', accepted_provider_count,
    'pending_provider_count', greatest(provider_count - accepted_provider_count - declined_provider_count, 0),
    'declined_provider_count', declined_provider_count, 'cancelled_provider_count', cancelled_provider_count,
    'selected_without_request_count', selected_without_request_count,
    'unfinished_food_tasting_count', unfinished_food_tasting_count,
    'coordinator_required', coordinator_required, 'coordinator_accepted', coordinator_accepted,
    'payment_eligible', payment_eligible, 'reason', waiting_for
  );
end;
$$;

revoke all on function public.submit_my_catering_food_tasting_request_v15(uuid, uuid, integer, jsonb) from public;
revoke all on function public.start_v15_food_tasting_scheduling_window() from public;
revoke all on function public.protect_v15_food_tasting_appointments() from public;
revoke all on function public.list_my_v15_catering_food_tasting_slots(uuid) from public;
revoke all on function public.schedule_my_v15_catering_food_tasting(uuid, date, time, text) from public;
revoke all on function public.list_my_catering_food_tasting_workflows_v15(uuid[]) from public;
grant execute on function public.submit_my_catering_food_tasting_request_v15(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.list_my_v15_catering_food_tasting_slots(uuid) to authenticated;
grant execute on function public.schedule_my_v15_catering_food_tasting(uuid, date, time, text) to authenticated;
grant execute on function public.list_my_catering_food_tasting_workflows_v15(uuid[]) to authenticated;

comment on table public.catering_food_tasting_workflows is
  'V15 food-tasting workflow snapshots. Preliminary dishes are historical and never a final payable menu.';
comment on function public.submit_my_catering_food_tasting_request_v15(uuid, uuid, integer, jsonb) is
  'Creates one provisional, non-payable catering request with a server-validated preliminary tasting menu.';
comment on function public.schedule_my_v15_catering_food_tasting(uuid, date, time, text) is
  'Schedules an accepted V15 food tasting only in the server-enforced seven-calendar-day window.';

commit;
