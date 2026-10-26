-- MULTIVENT Revision V15, Phase 4: attendance reminders, one client
-- reschedule, and a safe direct-menu fallback.  This augments the Phase 3
-- workflow without changing the existing booking, pricing, payment, or legacy
-- food-tasting flows.

begin;

alter table public.catering_food_tasting_workflows
  add column if not exists attendance_status text not null default 'not_required',
  add column if not exists attendance_reminder_sent_at timestamptz,
  add column if not exists attendance_confirmed_at timestamptz,
  add column if not exists reschedule_attempt_count integer not null default 0,
  add column if not exists reschedule_extension_end_date date,
  add column if not exists provider_no_response_notified_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists fallback_enabled_at timestamptz,
  add column if not exists fallback_activated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catering_food_tasting_workflows_attendance_status_check'
      and conrelid = 'public.catering_food_tasting_workflows'::regclass
  ) then
    alter table public.catering_food_tasting_workflows
      add constraint catering_food_tasting_workflows_attendance_status_check
      check (attendance_status in ('not_required', 'confirmation_required', 'confirmed', 'no_response'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'catering_food_tasting_workflows_reschedule_attempt_count_check'
      and conrelid = 'public.catering_food_tasting_workflows'::regclass
  ) then
    alter table public.catering_food_tasting_workflows
      add constraint catering_food_tasting_workflows_reschedule_attempt_count_check
      check (reschedule_attempt_count between 0 and 1);
  end if;
end;
$$;

update public.catering_food_tasting_workflows workflow
set attendance_status = case when workflow.status = 'scheduled' then 'confirmation_required' else 'not_required' end,
    reschedule_extension_end_date = coalesce(
      workflow.reschedule_extension_end_date,
      workflow.scheduling_window_end_date + 7
    )
where workflow.attendance_status = 'not_required'
   or workflow.reschedule_extension_end_date is null;

create index if not exists catering_food_tasting_workflows_deadline_idx
  on public.catering_food_tasting_workflows (
    status, scheduling_window_end_date, reschedule_extension_end_date
  );

-- Preserve the V15 appointment guard when an established booking-cancellation
-- trigger closes a tasting.  The trigger itself remains the only place that
-- authorizes this cancellation path.
create or replace function public.cancel_catering_food_tastings_after_booking_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status::text in ('cancelled', 'rejected', 'expired')
    and old.status::text is distinct from new.status::text then
    perform set_config('app.v15_food_tasting_schedule_authorized', 'true', true);
    update public.catering_food_tastings set
      status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now(),
      schedule_history = coalesce(schedule_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'action', 'booking_cancelled', 'at', now(), 'bookingStatus', new.status::text
      ))
    where booking_id = new.id
      and status in ('requested', 'confirmed', 'reschedule_proposed');
  end if;
  return new;
end;
$$;

-- Store an immutable extension ceiling when the provider accepts a V15
-- request.  The ordinary client scheduling window remains seven days; only a
-- scheduled client may use the one additional week through the reschedule RPC.
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
        reschedule_extension_end_date = accepted_date + 14,
        attendance_status = 'not_required',
        attendance_reminder_sent_at = null,
        attendance_confirmed_at = null,
        provider_no_response_notified_at = null,
        reschedule_attempt_count = 0,
        expired_at = null,
        fallback_enabled_at = null,
        fallback_activated_at = null,
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

drop function if exists public.list_my_catering_food_tasting_workflows_v15(uuid[]);
create function public.list_my_catering_food_tasting_workflows_v15(
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
  attendance_status text,
  attendance_reminder_sent_at timestamptz,
  attendance_confirmed_at timestamptz,
  reschedule_attempt_count integer,
  reschedule_extension_end_date date,
  provider_no_response_notified_at timestamptz,
  expired_at timestamptz,
  fallback_enabled_at timestamptz,
  fallback_activated_at timestamptz,
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
    workflow.scheduled_tasting_id, workflow.attendance_status,
    workflow.attendance_reminder_sent_at, workflow.attendance_confirmed_at,
    workflow.reschedule_attempt_count, workflow.reschedule_extension_end_date,
    workflow.provider_no_response_notified_at, workflow.expired_at,
    workflow.fallback_enabled_at, workflow.fallback_activated_at, workflow.updated_at
  from public.catering_food_tasting_workflows workflow
  join public.provider_profiles provider on provider.id = workflow.provider_id
  where auth.uid() is not null
    and (target_booking_ids is null or workflow.booking_id = any(target_booking_ids))
    and (workflow.client_id = auth.uid() or provider.user_id = auth.uid())
  order by workflow.updated_at desc, workflow.booking_id desc;
$$;

create or replace function public.list_my_v15_catering_food_tasting_reschedule_slots(
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
  tasting_row public.catering_food_tastings%rowtype;
  candidate_date date;
  earliest_date date;
  slot_text text;
  slot_time time;
  resolved jsonb;
  settings jsonb;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id and workflow.client_id = auth.uid();
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'scheduled'
    or workflow_row.attendance_status <> 'confirmation_required'
    or workflow_row.reschedule_attempt_count <> 0
    or workflow_row.reschedule_extension_end_date is null
    or workflow_row.reschedule_extension_end_date < today_manila then
    return;
  end if;
  select * into tasting_row
  from public.catering_food_tastings tasting
  where tasting.id = workflow_row.scheduled_tasting_id
    and tasting.status = 'confirmed';
  if tasting_row.id is null then return; end if;

  select service.category_details -> 'tastingSettings' into settings
  from public.services service where service.id = workflow_row.service_id;
  if jsonb_typeof(settings -> 'tastingTimeSlots') <> 'array' then return; end if;

  earliest_date := greatest(workflow_row.scheduling_window_start_date, today_manila);
  if earliest_date > workflow_row.reschedule_extension_end_date then return; end if;
  for candidate_date in
    select day::date
    from generate_series(earliest_date, workflow_row.reschedule_extension_end_date, interval '1 day') day
  loop
    for slot_text in select value from jsonb_array_elements_text(settings -> 'tastingTimeSlots') slot(value)
    loop
      if slot_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then continue; end if;
      slot_time := slot_text::time;
      if candidate_date = tasting_row.scheduled_date and slot_time = tasting_row.start_time then continue; end if;
      begin
        resolved := public.resolve_catering_tasting_slot(
          target_booking_id, candidate_date, slot_time, tasting_row.id
        );
        scheduled_date := candidate_date;
        start_time := slot_time;
        end_time := (resolved ->> 'endTime')::time;
        timezone := resolved ->> 'timezone';
        location := resolved ->> 'location';
        return next;
      exception when others then
        continue;
      end;
    end loop;
  end loop;
end;
$$;

create or replace function public.confirm_my_v15_food_tasting_attendance(
  target_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_row public.catering_food_tasting_workflows%rowtype;
  provider_user_id uuid;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id and workflow.client_id = auth.uid()
  for update;
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'scheduled' then
    raise exception 'There is no scheduled food tasting to confirm.' using errcode = '22023';
  end if;
  if workflow_row.attendance_status = 'confirmed' then
    return jsonb_build_object('alreadyConfirmed', true);
  end if;
  if workflow_row.attendance_status <> 'confirmation_required' then
    raise exception 'Attendance confirmation is no longer available for this appointment.' using errcode = '22023';
  end if;

  update public.catering_food_tasting_workflows
  set attendance_status = 'confirmed', attendance_confirmed_at = now(), updated_at = now()
  where booking_id = workflow_row.booking_id;
  select provider.user_id into provider_user_id
  from public.provider_profiles provider where provider.id = workflow_row.provider_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id, 'Client confirmed food tasting attendance',
    'Your client confirmed they will attend the scheduled food tasting.',
    'food_tasting', workflow_row.scheduled_tasting_id
  );
  return jsonb_build_object('confirmed', true);
end;
$$;

create or replace function public.reschedule_my_v15_catering_food_tasting(
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
  tasting_row public.catering_food_tastings%rowtype;
  resolved jsonb;
  provider_user_id uuid;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id and workflow.client_id = auth.uid()
  for update;
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'scheduled'
    or workflow_row.attendance_status <> 'confirmation_required'
    or workflow_row.reschedule_attempt_count <> 0
    or workflow_row.reschedule_extension_end_date is null then
    raise exception 'This food tasting cannot be rescheduled again.' using errcode = '22023';
  end if;
  if requested_date < greatest(workflow_row.scheduling_window_start_date, today_manila)
    or requested_date > workflow_row.reschedule_extension_end_date then
    raise exception 'Choose a new food tasting schedule within the one-week extension.' using errcode = '22023';
  end if;
  select * into tasting_row
  from public.catering_food_tastings tasting
  where tasting.id = workflow_row.scheduled_tasting_id and tasting.status = 'confirmed'
  for update;
  if tasting_row.id is null then
    raise exception 'The current food tasting appointment is no longer available.' using errcode = '22023';
  end if;
  if tasting_row.scheduled_date = requested_date and tasting_row.start_time = requested_start_time then
    raise exception 'Choose a different available food tasting slot.' using errcode = '22023';
  end if;

  resolved := public.resolve_catering_tasting_slot(
    target_booking_id, requested_date, requested_start_time, tasting_row.id
  );
  perform set_config('app.v15_food_tasting_schedule_authorized', 'true', true);
  update public.catering_food_tastings
  set scheduled_date = requested_date,
      start_time = requested_start_time,
      end_time = (resolved ->> 'endTime')::time,
      timezone = resolved ->> 'timezone',
      location = resolved ->> 'location',
      client_note = coalesce(nullif(left(trim(coalesce(requested_note, '')), 600), ''), client_note),
      updated_at = now(),
      schedule_history = coalesce(schedule_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'action', 'rescheduled_by_client', 'at', now(), 'by', auth.uid(),
        'date', requested_date, 'startTime', to_char(requested_start_time, 'HH24:MI')
      ))
  where id = tasting_row.id;
  update public.catering_food_tasting_workflows
  set reschedule_attempt_count = 1,
      attendance_status = 'confirmation_required',
      attendance_reminder_sent_at = null,
      attendance_confirmed_at = null,
      provider_no_response_notified_at = null,
      updated_at = now()
  where booking_id = workflow_row.booking_id;

  select provider.user_id into provider_user_id
  from public.provider_profiles provider where provider.id = workflow_row.provider_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values
    (provider_user_id, 'Food tasting rescheduled',
      'Your client selected a new food tasting appointment.', 'food_tasting', tasting_row.id),
    (workflow_row.client_id, 'Food tasting rescheduled',
      'Your new food tasting appointment has been confirmed.', 'food_tasting', tasting_row.id);
  return jsonb_build_object('id', tasting_row.id, 'status', 'confirmed', 'rescheduleAttemptsUsed', 1);
end;
$$;

-- The fallback is explicit client action only.  Expiration never cancels the
-- catering booking: it merely enables this controlled transition back to the
-- existing direct-menu selection flow.
create or replace function public.activate_my_v15_food_tasting_direct_menu_fallback(
  target_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_row public.catering_food_tasting_workflows%rowtype;
  paid_payment_exists boolean := false;
begin
  select * into workflow_row
  from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id and workflow.client_id = auth.uid()
  for update;
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status <> 'cancelled' or workflow_row.fallback_enabled_at is null then
    raise exception 'Direct menu selection is not available for this food tasting.' using errcode = '22023';
  end if;
  if workflow_row.fallback_activated_at is not null then
    return jsonb_build_object('alreadyActivated', true, 'serviceId', workflow_row.service_id);
  end if;
  select exists (
    select 1 from public.payments payment
    where payment.booking_id = workflow_row.booking_id
      and payment.status in ('paid', 'verified', 'processing')
  ) into paid_payment_exists;
  if paid_payment_exists then
    raise exception 'This fallback cannot change a booking with a recorded payment.' using errcode = '22023';
  end if;

  -- The provisional V15 request has a zero price and has never been payable.
  -- Cancelling only it prevents duplicate provider requests before the normal
  -- direct-menu flow creates the replacement request.
  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = workflow_row.booking_id and status not in ('cancelled', 'rejected', 'expired');
  update public.event_service_selections selection
  set status = 'selected',
      food_tasting_preference = false,
      catering_option_snapshot = (coalesce(selection.catering_option_snapshot, '{}'::jsonb)
        - 'preliminaryTastingMenu') || jsonb_build_object(
          'foodTastingPreference', false,
          'foodTastingFallbackActivatedAt', now()
        ),
      selected_provider_snapshot = coalesce(selection.selected_provider_snapshot, '{}'::jsonb)
        || jsonb_build_object('foodTastingPreference', false, 'finalPricePending', false),
      updated_at = now()
  where selection.event_id = workflow_row.event_id
    and selection.service_id = workflow_row.service_id
    and selection.client_id = workflow_row.client_id
    and selection.status not in ('cancelled', 'declined');
  update public.catering_food_tasting_workflows
  set fallback_activated_at = now(), updated_at = now()
  where booking_id = workflow_row.booking_id;
  return jsonb_build_object('activated', true, 'serviceId', workflow_row.service_id);
end;
$$;

-- This processor is designed for pg_cron: every notification and state change
-- has a persisted marker, so delayed or overlapping runs are safe.  Appointment
-- dates are compared in the provider-configured tasting timezone.
create or replace function public.process_v15_food_tasting_deadlines()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value record;
  reminder_count integer := 0;
  no_response_count integer := 0;
  expired_count integer := 0;
begin
  -- A scheduled appointment cancelled outside this workflow should not leave
  -- a client stranded.  Enable fallback without cancelling the booking.
  for row_value in
    select workflow.*, tasting.id as tasting_id, provider.user_id as provider_user_id
    from public.catering_food_tasting_workflows workflow
    join public.catering_food_tastings tasting on tasting.id = workflow.scheduled_tasting_id
    join public.provider_profiles provider on provider.id = workflow.provider_id
    where workflow.status = 'scheduled'
      and tasting.status in ('cancelled', 'rejected')
      and workflow.fallback_enabled_at is null
    for update of workflow skip locked
  loop
    update public.catering_food_tasting_workflows
    set status = 'cancelled', fallback_enabled_at = now(), updated_at = now()
    where booking_id = row_value.booking_id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (row_value.client_id, 'Food tasting cancelled',
      'Your food tasting appointment is no longer available. Choose your final menu instead.',
      'food_tasting', row_value.tasting_id);
    expired_count := expired_count + 1;
  end loop;

  for row_value in
    select workflow.*, tasting.id as tasting_id, tasting.scheduled_date, tasting.timezone
    from public.catering_food_tasting_workflows workflow
    join public.catering_food_tastings tasting on tasting.id = workflow.scheduled_tasting_id
    where workflow.status = 'scheduled'
      and workflow.attendance_status = 'confirmation_required'
      and workflow.attendance_reminder_sent_at is null
      and tasting.status = 'confirmed'
      and tasting.scheduled_date = ((now() at time zone coalesce(nullif(tasting.timezone, ''), 'Asia/Manila'))::date + 1)
    for update of workflow skip locked
  loop
    update public.catering_food_tasting_workflows
    set attendance_reminder_sent_at = now(), updated_at = now()
    where booking_id = row_value.booking_id and attendance_reminder_sent_at is null;
    if found then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (row_value.client_id, 'Food Tasting Tomorrow!',
        'Please confirm whether you can attend your scheduled food tasting.',
        'food_tasting', row_value.tasting_id);
      reminder_count := reminder_count + 1;
    end if;
  end loop;

  for row_value in
    select workflow.*, tasting.id as tasting_id, tasting.scheduled_date, tasting.timezone,
      provider.user_id as provider_user_id
    from public.catering_food_tasting_workflows workflow
    join public.catering_food_tastings tasting on tasting.id = workflow.scheduled_tasting_id
    join public.provider_profiles provider on provider.id = workflow.provider_id
    where workflow.status = 'scheduled'
      and workflow.attendance_status = 'confirmation_required'
      and workflow.provider_no_response_notified_at is null
      and tasting.status = 'confirmed'
      and tasting.scheduled_date <= (now() at time zone coalesce(nullif(tasting.timezone, ''), 'Asia/Manila'))::date
    for update of workflow skip locked
  loop
    update public.catering_food_tasting_workflows
    set attendance_status = 'no_response', provider_no_response_notified_at = now(), updated_at = now()
    where booking_id = row_value.booking_id
      and attendance_status = 'confirmation_required'
      and provider_no_response_notified_at is null;
    if found then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (row_value.provider_user_id, 'Client Has Not Confirmed Attendance',
        'The client has not responded to the food tasting reminder. Message the client for clarification.',
        'food_tasting', row_value.tasting_id);
      no_response_count := no_response_count + 1;
    end if;
  end loop;

  -- A client that never chose an initial slot expires at the original window.
  -- A scheduled no-show expires on the appointment date; confirmed attendance
  -- remains available for the provider finalization step in the next phase.
  for row_value in
    select workflow.*, tasting.id as tasting_id
    from public.catering_food_tasting_workflows workflow
    left join public.catering_food_tastings tasting on tasting.id = workflow.scheduled_tasting_id
    where (workflow.status = 'scheduling_required'
        and workflow.scheduling_window_end_date < (now() at time zone 'Asia/Manila')::date)
       or (workflow.status = 'scheduled'
        and workflow.attendance_status = 'no_response'
        and tasting.scheduled_date <= (now() at time zone coalesce(nullif(tasting.timezone, ''), 'Asia/Manila'))::date)
    for update of workflow skip locked
  loop
    perform set_config('app.v15_food_tasting_schedule_authorized', 'true', true);
    if row_value.tasting_id is not null then
      update public.catering_food_tastings
      set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now(),
          schedule_history = coalesce(schedule_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'action', 'v15_deadline_expired', 'at', now()
          ))
      where id = row_value.tasting_id and status in ('requested', 'confirmed', 'reschedule_proposed');
    end if;
    update public.catering_food_tasting_workflows
    set status = 'cancelled', expired_at = now(), fallback_enabled_at = coalesce(fallback_enabled_at, now()),
        updated_at = now()
    where booking_id = row_value.booking_id and status in ('scheduling_required', 'scheduled');
    if found then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (row_value.client_id, 'Food tasting scheduling expired',
        'The food tasting process has ended. Choose your final menu instead to continue your catering booking.',
        'food_tasting', coalesce(row_value.tasting_id, row_value.booking_id));
      expired_count := expired_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'remindersSent', reminder_count,
    'providerNoResponseNotifications', no_response_count,
    'expiredWorkflows', expired_count
  );
end;
$$;

-- Keep the event payment gate closed while an expired workflow is awaiting an
-- explicit direct-menu fallback.  Once the fallback is activated, the old
-- zero-price provisional booking is cancelled and the normal direct flow owns
-- eligibility again.
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
  select count(*)::integer,
    count(*) filter (where booking.status in ('approved', 'paid', 'confirmed', 'completed'))::integer,
    count(*) filter (where booking.status = 'rejected')::integer,
    count(*) filter (where booking.status = 'cancelled')::integer
  into provider_count, accepted_provider_count, declined_provider_count, cancelled_provider_count
  from public.bookings booking
  left join public.catering_food_tasting_workflows fallback_workflow
    on fallback_workflow.booking_id = booking.id
  where booking.event_id = event_row.id
    and booking.status <> 'expired'
    -- An explicit fallback retires only the zero-price provisional request.
    -- It must not count as a cancelled provider after its direct-menu
    -- replacement is submitted.
    and not (
      booking.status = 'cancelled'
      and fallback_workflow.fallback_activated_at is not null
    );
  select count(*)::integer into selected_without_request_count
  from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.status = 'selected';
  select count(*)::integer into unfinished_food_tasting_count
  from public.catering_food_tasting_workflows workflow
  join public.bookings booking on booking.id = workflow.booking_id
  where workflow.event_id = event_row.id
    and booking.status not in ('rejected', 'cancelled', 'expired')
    and (workflow.status not in ('cancelled', 'finalized')
      or (workflow.status = 'cancelled' and workflow.fallback_enabled_at is not null
        and workflow.fallback_activated_at is null));
  coordinator_required := coalesce(event_row.wants_coordinator, false)
    or event_row.pending_coordinator_id is not null or event_row.coordinator_id is not null;
  coordinator_accepted := not coordinator_required or (
    event_row.coordinator_assignment_status = 'accepted' and event_row.coordinator_id is not null
  );
  if not event_valid then waiting_for := 'This event is no longer available for payment.';
  elsif provider_count = 0 and not coordinator_accepted then
    waiting_for := 'Add a required service provider or receive coordinator acceptance before payment.';
  elsif provider_count = 0 then waiting_for := 'Add at least one required bookable service before payment.';
  elsif declined_provider_count > 0 then waiting_for := 'Replace every declined provider request before payment.';
  elsif cancelled_provider_count > 0 then waiting_for := 'Resolve cancelled provider requests before payment.';
  elsif selected_without_request_count > 0 then waiting_for := 'Submit every selected service provider request before payment.';
  elsif accepted_provider_count < provider_count then
    waiting_for := format('Waiting for %s provider confirmation%s.', provider_count - accepted_provider_count,
      case when provider_count - accepted_provider_count = 1 then '' else 's' end);
  elsif unfinished_food_tasting_count > 0 then
    waiting_for := 'Final food tasting menu confirmation is required before payment.';
  elsif not coordinator_accepted then waiting_for := 'Waiting for coordinator confirmation.';
  else payment_eligible := true;
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

create extension if not exists pg_cron;
do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job
  where jobname = 'multivent-v15-food-tasting-deadlines' limit 1;
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
  perform cron.schedule(
    'multivent-v15-food-tasting-deadlines',
    '11 * * * *',
    'select public.process_v15_food_tasting_deadlines();'
  );
end;
$$;

revoke all on function public.cancel_catering_food_tastings_after_booking_change() from public;
revoke all on function public.start_v15_food_tasting_scheduling_window() from public;
revoke all on function public.list_my_catering_food_tasting_workflows_v15(uuid[]) from public;
revoke all on function public.list_my_v15_catering_food_tasting_reschedule_slots(uuid) from public;
revoke all on function public.confirm_my_v15_food_tasting_attendance(uuid) from public;
revoke all on function public.reschedule_my_v15_catering_food_tasting(uuid, date, time, text) from public;
revoke all on function public.activate_my_v15_food_tasting_direct_menu_fallback(uuid) from public;
revoke all on function public.process_v15_food_tasting_deadlines() from public;
grant execute on function public.list_my_catering_food_tasting_workflows_v15(uuid[]) to authenticated;
grant execute on function public.list_my_v15_catering_food_tasting_reschedule_slots(uuid) to authenticated;
grant execute on function public.confirm_my_v15_food_tasting_attendance(uuid) to authenticated;
grant execute on function public.reschedule_my_v15_catering_food_tasting(uuid, date, time, text) to authenticated;
grant execute on function public.activate_my_v15_food_tasting_direct_menu_fallback(uuid) to authenticated;

comment on function public.process_v15_food_tasting_deadlines() is
  'Idempotent V15 Phase 4 backend scheduler for food-tasting reminders, non-response, and safe fallback expiration.';

commit;
