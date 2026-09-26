-- MULTIVENT Phase 4: coordinator availability, conflict-safe assignment,
-- fair workload distribution, and the pending-assignment queue.
-- Apply after 32_superadmin_permission_management.sql.

begin;

insert into public.system_settings (key, value, description)
values (
  'coordinator_assignment_buffer_minutes',
  '{"value":0}'::jsonb,
  'Preparation or travel buffer added before and after coordinator event windows.'
)
on conflict (key) do nothing;

create table if not exists public.coordinator_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  assignment_source text not null default 'automatic',
  status text not null default 'invited',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coordinator_assignment_attempts_source_check
    check (assignment_source in ('automatic', 'manual', 'legacy')),
  constraint coordinator_assignment_attempts_status_check
    check (status in ('invited', 'accepted', 'declined', 'withdrawn', 'unavailable', 'reassigned')),
  constraint coordinator_assignment_attempts_note_check
    check (char_length(coalesce(note, '')) <= 1000)
);

create index if not exists coordinator_assignment_attempts_event_idx
  on public.coordinator_assignment_attempts (event_id, requested_at desc);
create index if not exists coordinator_assignment_attempts_coordinator_idx
  on public.coordinator_assignment_attempts (coordinator_id, requested_at desc);
create unique index if not exists coordinator_assignment_attempts_active_uidx
  on public.coordinator_assignment_attempts (event_id)
  where status = 'invited';

alter table public.coordinator_assignment_attempts enable row level security;

drop policy if exists "Staff and coordinators view assignment attempts"
  on public.coordinator_assignment_attempts;
create policy "Staff and coordinators view assignment attempts"
  on public.coordinator_assignment_attempts for select to authenticated
  using (
    public.has_permission('coordinators.view')
    or coordinator_id = auth.uid()
  );

grant select on public.coordinator_assignment_attempts to authenticated;

-- Preserve current assignment state when this migration is applied to an
-- existing project. Historical assignments that predate this table are
-- labelled as legacy records.
do $$
begin
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  update public.events
  set pending_coordinator_id = null,
      updated_at = now()
  where coordinator_assignment_status = 'accepted'
    and coordinator_id is not null
    and pending_coordinator_id is not null;

  update public.events
  set coordinator_id = null,
      updated_at = now()
  where coordinator_assignment_status = 'pending'
    and pending_coordinator_id is not null
    and coordinator_id is not null;
end;
$$;

insert into public.coordinator_assignment_attempts (
  event_id, coordinator_id, assignment_source, status,
  requested_at, responded_at, note
)
select
  event.id,
  event.pending_coordinator_id,
  'legacy',
  'invited',
  coalesce(event.coordinator_assignment_requested_at, event.updated_at, now()),
  null,
  'Pending invitation imported during the Phase 4 migration.'
from public.events event
where event.pending_coordinator_id is not null
  and event.coordinator_assignment_status = 'pending'
  and not exists (
    select 1
    from public.coordinator_assignment_attempts attempt
    where attempt.event_id = event.id
      and attempt.status = 'invited'
  );

insert into public.coordinator_assignment_attempts (
  event_id, coordinator_id, assignment_source, status,
  requested_at, responded_at, note
)
select
  event.id,
  event.coordinator_id,
  'legacy',
  'accepted',
  coalesce(event.coordinator_assignment_requested_at, event.updated_at, now()),
  coalesce(event.coordinator_assignment_responded_at, event.updated_at, now()),
  'Accepted assignment imported during the Phase 4 migration.'
from public.events event
where event.coordinator_id is not null
  and event.coordinator_assignment_status = 'accepted'
  and not exists (
    select 1
    from public.coordinator_assignment_attempts attempt
    where attempt.event_id = event.id
      and attempt.coordinator_id = event.coordinator_id
      and attempt.status = 'accepted'
  );

create or replace function public.validate_coordinator_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = new.coordinator_id
      and profile.account_status = 'active'
      and (
        profile.default_role = 'event_coordinator'
        or exists (
          select 1
          from public.user_roles user_role
          join public.roles role on role.id = user_role.role_id
          where user_role.user_id = profile.id
            and role.name = 'event_coordinator'
        )
      )
  ) then
    raise exception 'Availability can only be recorded for an active Event Coordinator.';
  end if;

  new.reason := nullif(trim(new.reason), '');
  if char_length(coalesce(new.reason, '')) > 500 then
    raise exception 'Availability reasons cannot exceed 500 characters.';
  end if;

  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' then
      new.created_by := auth.uid();
    end if;
  else
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();

  if exists (
    select 1
    from public.coordinator_availability existing
    where existing.coordinator_id = new.coordinator_id
      and existing.id <> new.id
      and new.starts_at < existing.ends_at
      and new.ends_at > existing.starts_at
  ) then
    raise exception 'This coordinator already has an overlapping availability record.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_coordinator_availability_trigger
  on public.coordinator_availability;
create trigger validate_coordinator_availability_trigger
before insert or update on public.coordinator_availability
for each row execute function public.validate_coordinator_availability();

revoke all on function public.validate_coordinator_availability() from public;

-- The assignment window includes a configurable buffer. It defaults to zero,
-- so current schedules do not change until MULTIVENT deliberately configures it.
create or replace function public.coordinator_event_window(target_event public.events)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with setting_values as (
    select
      greatest(coalesce((
        select nullif(setting.value ->> 'value', '')::integer
        from public.system_settings setting
        where setting.key = 'coordinator_default_event_hours'
      ), 4), 1) as default_hours,
      greatest(coalesce((
        select nullif(setting.value ->> 'value', '')::integer
        from public.system_settings setting
        where setting.key = 'coordinator_assignment_buffer_minutes'
      ), 0), 0) as buffer_minutes
  ), base_window as (
    select
      coalesce(
        target_event.preferred_start_at,
        case
          when target_event.event_date is not null and target_event.event_time is not null
          then (target_event.event_date + target_event.event_time)
            at time zone coalesce(target_event.timezone, 'Asia/Manila')
        end
      ) as base_start,
      target_event.preferred_end_at as configured_end,
      setting_values.default_hours,
      setting_values.buffer_minutes
    from setting_values
  )
  select
    base_window.base_start - make_interval(mins => base_window.buffer_minutes),
    coalesce(
      base_window.configured_end,
      base_window.base_start + make_interval(hours => base_window.default_hours)
    ) + make_interval(mins => base_window.buffer_minutes)
  from base_window;
$$;

create or replace function public.coordinator_active_workload(
  target_coordinator_id uuid,
  excluded_event_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.events assigned_event
  cross join lateral public.coordinator_event_window(assigned_event) assignment_window
  where (assigned_event.coordinator_id = target_coordinator_id
      or assigned_event.pending_coordinator_id = target_coordinator_id)
    and assigned_event.id is distinct from excluded_event_id
    and assigned_event.status not in ('completed', 'cancelled')
    and (
      assignment_window.ends_at is null
      or assignment_window.ends_at >= now()
    );
$$;

revoke all on function public.coordinator_active_workload(uuid, uuid) from public;

create or replace function public.auto_assign_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  event_start timestamptz;
  event_end timestamptz;
  workload_limit integer;
  selected_coordinator uuid;
  selected_name text;
  previous_assignment_status text;
begin
  select * into event_row
  from public.events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;
  if event_row.status not in ('booking', 'payment_required', 'confirmed', 'in_progress') then
    return jsonb_build_object(
      'event_id', event_row.id,
      'assignment_status', event_row.coordinator_assignment_status
    );
  end if;
  if event_row.coordinator_id is not null or event_row.pending_coordinator_id is not null then
    return jsonb_build_object(
      'event_id', event_row.id,
      'assignment_status', event_row.coordinator_assignment_status
    );
  end if;

  previous_assignment_status := event_row.coordinator_assignment_status;
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  select assignment_window.starts_at, assignment_window.ends_at
  into event_start, event_end
  from public.coordinator_event_window(event_row) as assignment_window;

  if event_start is null or event_end is null or event_end <= event_start then
    update public.events
    set coordinator_assignment_status = 'awaiting_assignment',
        coordinator_assignment_attempted_at = now(),
        coordinator_assignment_source = 'automatic',
        coordinator_assignment_note = 'Waiting for a complete event schedule.',
        updated_at = now()
    where id = event_row.id;

    if previous_assignment_status is distinct from 'awaiting_assignment' then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      select profile.id,
        'Coordinator assignment needs a schedule',
        format('%s is waiting for complete schedule information.', event_row.name),
        'event', event_row.id
      from public.profiles profile
      where public.user_has_permission(profile.id, 'coordinators.assign');
    end if;

    return jsonb_build_object(
      'event_id', event_row.id,
      'assignment_status', 'awaiting_assignment',
      'reason', 'incomplete_schedule'
    );
  end if;

  select greatest(coalesce(nullif(setting.value ->> 'value', '')::integer, 5), 1)
  into workload_limit
  from public.system_settings setting
  where setting.key = 'coordinator_workload_limit';
  workload_limit := coalesce(workload_limit, 5);

  -- Lock the chosen profile row. Concurrent assignments skip a coordinator
  -- already being evaluated and continue to the next eligible employee.
  select profile.id,
    coalesce(nullif(trim(profile.full_name), ''), 'Event Coordinator')
  into selected_coordinator, selected_name
  from public.profiles profile
  where profile.account_status = 'active'
    and (
      profile.default_role = 'event_coordinator'
      or exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id
          and role.name = 'event_coordinator'
      )
    )
    and public.coordinator_active_workload(profile.id, event_row.id) < workload_limit
    and not exists (
      select 1
      from public.coordinator_assignment_attempts declined_attempt
      where declined_attempt.event_id = event_row.id
        and declined_attempt.coordinator_id = profile.id
        and declined_attempt.status in ('declined', 'reassigned')
    )
    and not exists (
      select 1
      from public.coordinator_availability availability
      where availability.coordinator_id = profile.id
        and availability.status in ('unavailable', 'on_leave')
        and event_start < availability.ends_at
        and event_end > availability.starts_at
    )
    and not exists (
      select 1
      from public.events conflict_event
      cross join lateral public.coordinator_event_window(conflict_event) conflict_window
      where conflict_event.id <> event_row.id
        and conflict_event.status not in ('completed', 'cancelled')
        and (
          conflict_event.coordinator_id = profile.id
          or conflict_event.pending_coordinator_id = profile.id
        )
        and event_start < conflict_window.ends_at
        and event_end > conflict_window.starts_at
    )
  order by
    public.coordinator_active_workload(profile.id, event_row.id),
    (
      select max(attempt.requested_at)
      from public.coordinator_assignment_attempts attempt
      where attempt.coordinator_id = profile.id
    ) nulls first,
    profile.id
  limit 1
  for no key update of profile skip locked;

  if selected_coordinator is null then
    update public.events
    set coordinator_assignment_status = 'awaiting_assignment',
        coordinator_assignment_attempted_at = now(),
        coordinator_assignment_source = 'automatic',
        coordinator_assignment_note = 'No conflict-free coordinator is currently available.',
        updated_at = now()
    where id = event_row.id;

    if previous_assignment_status is distinct from 'awaiting_assignment' then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      select profile.id,
        'Coordinator assignment needed',
        format('%s is waiting for an available event coordinator.', event_row.name),
        'event', event_row.id
      from public.profiles profile
      where public.user_has_permission(profile.id, 'coordinators.assign');
    end if;

    return jsonb_build_object(
      'event_id', event_row.id,
      'assignment_status', 'awaiting_assignment',
      'reason', 'no_available_coordinator'
    );
  end if;

  update public.coordinator_assignment_attempts
  set status = 'withdrawn',
      responded_at = now(),
      updated_at = now(),
      note = coalesce(note, 'Superseded by a new automatic assignment.')
  where event_id = event_row.id
    and status = 'invited';

  update public.events
  set coordinator_id = null,
      pending_coordinator_id = selected_coordinator,
      coordinator_assignment_status = 'pending',
      coordinator_assignment_requested_at = now(),
      coordinator_assignment_responded_at = null,
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'automatic',
      coordinator_assignment_note = null,
      updated_at = now()
  where id = event_row.id;

  insert into public.coordinator_assignment_attempts (
    event_id, coordinator_id, assignment_source, status, requested_at
  ) values (
    event_row.id, selected_coordinator, 'automatic', 'invited', now()
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    selected_coordinator,
    'Event coordination invitation',
    format('MULTIVENT assigned %s to you based on availability. Review and confirm it in your workspace.', event_row.name),
    'event', event_row.id
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Coordinator assignment in progress',
    format('%s has been matched with %s. You will be notified after confirmation.', event_row.name, selected_name),
    'event', event_row.id
  );

  if previous_assignment_status = 'awaiting_assignment' then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select profile.id,
      'Coordinator match found',
      format('%s was matched with %s.', event_row.name, selected_name),
      'event', event_row.id
    from public.profiles profile
    where profile.id <> selected_coordinator
      and public.user_has_permission(profile.id, 'coordinators.assign');
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    new_state, result, metadata
  ) values (
    auth.uid(), null, 'coordinator.assignment.automatic', 'event', event_row.id,
    jsonb_build_object(
      'pending_coordinator_id', selected_coordinator,
      'status', 'pending'
    ),
    'success',
    jsonb_build_object(
      'strategy', 'least_workload_availability',
      'event_start', event_start,
      'event_end', event_end
    )
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'coordinator_id', selected_coordinator,
    'coordinator_name', selected_name,
    'assignment_status', 'pending'
  );
end;
$$;

create or replace function public.assign_coordinator_when_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_coordinator uuid;
  event_start timestamptz;
  event_end timestamptz;
  schedule_changed boolean;
begin
  schedule_changed := case
    when tg_op = 'UPDATE' then
      old.event_date is distinct from new.event_date
      or old.event_time is distinct from new.event_time
      or old.preferred_start_at is distinct from new.preferred_start_at
      or old.preferred_end_at is distinct from new.preferred_end_at
    else false
  end;
  assigned_coordinator := coalesce(new.coordinator_id, new.pending_coordinator_id);

  if new.status in ('booking', 'payment_required', 'confirmed', 'in_progress')
    and schedule_changed
    and assigned_coordinator is not null
  then
    select assignment_window.starts_at, assignment_window.ends_at
    into event_start, event_end
    from public.coordinator_event_window(new) as assignment_window;

    if event_start is null
      or event_end is null
      or event_end <= event_start
      or exists (
        select 1
        from public.coordinator_availability availability
        where availability.coordinator_id = assigned_coordinator
          and availability.status in ('unavailable', 'on_leave')
          and event_start < availability.ends_at
          and event_end > availability.starts_at
      )
      or exists (
        select 1
        from public.events conflict_event
        cross join lateral public.coordinator_event_window(conflict_event) conflict_window
        where conflict_event.id <> new.id
          and conflict_event.status not in ('completed', 'cancelled')
          and (
            conflict_event.coordinator_id = assigned_coordinator
            or conflict_event.pending_coordinator_id = assigned_coordinator
          )
          and event_start < conflict_window.ends_at
          and event_end > conflict_window.starts_at
      )
    then
      perform set_config('app.coordinator_assignment_authorized', 'true', true);

      update public.coordinator_assignment_attempts
      set status = 'unavailable',
          responded_at = coalesce(responded_at, now()),
          updated_at = now(),
          note = 'The event schedule changed and created an assignment conflict.'
      where event_id = new.id
        and coordinator_id = assigned_coordinator
        and status in ('invited', 'accepted');

      update public.events
      set coordinator_id = null,
          pending_coordinator_id = null,
          coordinator_assignment_status = 'awaiting_assignment',
          coordinator_assignment_requested_at = null,
          coordinator_assignment_responded_at = now(),
          coordinator_assignment_attempted_at = now(),
          coordinator_assignment_source = 'automatic',
          coordinator_assignment_note = 'The revised schedule requires coordinator reassignment.',
          updated_at = now()
      where id = new.id;

      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        assigned_coordinator,
        'Event schedule reassigned',
        format('%s changed schedule and requires a new availability match.', new.name),
        'event', new.id
      );

      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        new.client_id,
        'Coordinator assignment update',
        format('MULTIVENT is confirming an available coordinator for the revised schedule of %s.', new.name),
        'event', new.id
      );

      perform public.auto_assign_event_coordinator(new.id);
      return null;
    end if;
  end if;

  if new.status in ('booking', 'payment_required', 'confirmed', 'in_progress')
    and new.coordinator_id is null
    and new.pending_coordinator_id is null
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
      or schedule_changed
    )
  then
    perform public.auto_assign_event_coordinator(new.id);
  end if;

  return null;
end;
$$;

create or replace function public.staff_assign_event_coordinator(
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
  event_start timestamptz;
  event_end timestamptz;
  workload_limit integer;
begin
  if not public.has_permission('coordinators.assign') then
    raise exception 'Coordinator-assignment access is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;
  if event_row.status not in ('booking', 'payment_required', 'confirmed', 'in_progress') then
    raise exception 'This event is not ready for coordinator assignment.';
  end if;
  if event_row.pending_coordinator_id = target_coordinator_id
    and event_row.coordinator_assignment_status = 'pending'
  then
    return jsonb_build_object(
      'event_id', event_row.id,
      'coordinator_id', target_coordinator_id,
      'assignment_status', 'pending'
    );
  end if;
  if event_row.coordinator_id = target_coordinator_id
    and event_row.coordinator_assignment_status = 'accepted'
  then
    return jsonb_build_object(
      'event_id', event_row.id,
      'coordinator_id', target_coordinator_id,
      'assignment_status', 'accepted'
    );
  end if;
  if (event_row.coordinator_id is not null or event_row.pending_coordinator_id is not null)
    and not public.has_permission('coordinators.reassign')
  then
    raise exception 'Coordinator-reassignment access is required.' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(profile.full_name), ''), 'Event Coordinator')
  into coordinator_name
  from public.profiles profile
  where profile.id = target_coordinator_id
    and profile.account_status = 'active'
    and (
      profile.default_role = 'event_coordinator'
      or exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id
          and role.name = 'event_coordinator'
      )
    )
  for no key update of profile;
  if coordinator_name is null then
    raise exception 'The selected coordinator is unavailable.';
  end if;

  select assignment_window.starts_at, assignment_window.ends_at
  into event_start, event_end
  from public.coordinator_event_window(event_row) as assignment_window;
  if event_start is null or event_end is null or event_end <= event_start then
    raise exception 'Complete the event schedule before assigning a coordinator.';
  end if;

  if exists (
    select 1
    from public.coordinator_availability availability
    where availability.coordinator_id = target_coordinator_id
      and availability.status in ('unavailable', 'on_leave')
      and event_start < availability.ends_at
      and event_end > availability.starts_at
  ) or exists (
    select 1
    from public.events conflict_event
    cross join lateral public.coordinator_event_window(conflict_event) conflict_window
    where conflict_event.id <> event_row.id
      and conflict_event.status not in ('completed', 'cancelled')
      and (
        conflict_event.coordinator_id = target_coordinator_id
        or conflict_event.pending_coordinator_id = target_coordinator_id
      )
      and event_start < conflict_window.ends_at
      and event_end > conflict_window.starts_at
  ) then
    raise exception 'The selected coordinator has a schedule conflict or is unavailable.';
  end if;

  select greatest(coalesce(nullif(setting.value ->> 'value', '')::integer, 5), 1)
  into workload_limit
  from public.system_settings setting
  where setting.key = 'coordinator_workload_limit';
  workload_limit := coalesce(workload_limit, 5);
  if public.coordinator_active_workload(target_coordinator_id, event_row.id) >= workload_limit then
    raise exception 'The selected coordinator has reached the configured workload limit.';
  end if;

  if event_row.coordinator_id is not null
    and event_row.coordinator_id <> target_coordinator_id
  then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.coordinator_id,
      'Event assignment updated',
      format('You are no longer assigned to coordinate %s.', event_row.name),
      'event', event_row.id
    );
  end if;
  if event_row.pending_coordinator_id is not null
    and event_row.pending_coordinator_id <> target_coordinator_id
  then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.pending_coordinator_id,
      'Event invitation withdrawn',
      format('The invitation to coordinate %s was withdrawn.', event_row.name),
      'event', event_row.id
    );
  end if;

  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()),
      updated_at = now(),
      note = coalesce(note, 'Superseded by an authorized manual assignment.')
  where event_id = event_row.id
    and status in ('invited', 'accepted');

  update public.events
  set coordinator_id = null,
      pending_coordinator_id = target_coordinator_id,
      coordinator_assignment_status = 'pending',
      coordinator_assignment_requested_at = now(),
      coordinator_assignment_responded_at = null,
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'manual',
      coordinator_assignment_note = null,
      updated_at = now()
  where id = event_row.id;

  insert into public.coordinator_assignment_attempts (
    event_id, coordinator_id, assignment_source, status,
    requested_at, assigned_by
  ) values (
    event_row.id, target_coordinator_id, 'manual', 'invited',
    now(), auth.uid()
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    target_coordinator_id,
    'Event coordination invitation',
    format('MULTIVENT assigned %s to you. Review and confirm it in your workspace.', event_row.name),
    'event', event_row.id
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Coordinator assignment in progress',
    format('MULTIVENT is confirming %s as the coordinator for %s.', coordinator_name, event_row.name),
    'event', event_row.id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  )
  select auth.uid(), profile.default_role,
    'coordinator.assignment.manual', 'event', event_row.id,
    jsonb_build_object(
      'coordinator_id', event_row.coordinator_id,
      'pending_coordinator_id', event_row.pending_coordinator_id
    ),
    jsonb_build_object(
      'pending_coordinator_id', target_coordinator_id,
      'status', 'pending'
    ),
    'success'
  from public.profiles profile
  where profile.id = auth.uid();

  return jsonb_build_object(
    'event_id', event_row.id,
    'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name,
    'assignment_status', 'pending'
  );
end;
$$;

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
  current_user_id uuid := auth.uid();
  event_row public.events%rowtype;
  event_start timestamptz;
  event_end timestamptz;
  workload_limit integer;
  assignment_result jsonb;
  conflict_message text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.pending_coordinator_id = current_user_id
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled')
  for update;
  if event_row.id is null then
    raise exception 'This coordinator invitation is no longer available.' using errcode = '42501';
  end if;
  perform 1
    from public.profiles profile
    where profile.id = current_user_id
      and profile.account_status = 'active'
      and (
        profile.default_role = 'event_coordinator'
        or exists (
          select 1
          from public.user_roles user_role
          join public.roles role on role.id = user_role.role_id
          where user_role.user_id = profile.id
            and role.name = 'event_coordinator'
        )
      )
    for no key update of profile;
  if not found then
    raise exception 'An active Event Coordinator account is required.' using errcode = '42501';
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  if accept_assignment then
    select assignment_window.starts_at, assignment_window.ends_at
    into event_start, event_end
    from public.coordinator_event_window(event_row) as assignment_window;

    if event_start is null or event_end is null or event_end <= event_start then
      conflict_message := 'The event schedule is incomplete.';
    elsif exists (
      select 1
      from public.coordinator_availability availability
      where availability.coordinator_id = current_user_id
        and availability.status in ('unavailable', 'on_leave')
        and event_start < availability.ends_at
        and event_end > availability.starts_at
    ) or exists (
      select 1
      from public.events conflict_event
      cross join lateral public.coordinator_event_window(conflict_event) conflict_window
      where conflict_event.id <> event_row.id
        and conflict_event.status not in ('completed', 'cancelled')
        and (
          conflict_event.coordinator_id = current_user_id
          or conflict_event.pending_coordinator_id = current_user_id
        )
        and event_start < conflict_window.ends_at
        and event_end > conflict_window.starts_at
    ) then
      conflict_message := 'Your availability changed and now conflicts with this event.';
    else
      select greatest(coalesce(nullif(setting.value ->> 'value', '')::integer, 5), 1)
      into workload_limit
      from public.system_settings setting
      where setting.key = 'coordinator_workload_limit';
      workload_limit := coalesce(workload_limit, 5);
      if public.coordinator_active_workload(current_user_id, event_row.id) >= workload_limit then
        conflict_message := 'Your current workload has reached the configured limit.';
      end if;
    end if;

    if conflict_message is not null then
      update public.coordinator_assignment_attempts
      set status = 'unavailable',
          responded_at = now(),
          updated_at = now(),
          note = conflict_message
      where event_id = event_row.id
        and coordinator_id = current_user_id
        and status = 'invited';

      update public.events
      set coordinator_id = null,
          pending_coordinator_id = null,
          coordinator_assignment_status = 'awaiting_assignment',
          coordinator_assignment_responded_at = now(),
          coordinator_assignment_attempted_at = now(),
          coordinator_assignment_source = 'automatic',
          coordinator_assignment_note = 'The previous match became unavailable before confirmation.',
          updated_at = now()
      where id = event_row.id;

      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.client_id,
        'Coordinator assignment update',
        format('MULTIVENT is matching another available coordinator for %s.', event_row.name),
        'event', event_row.id
      );

      assignment_result := public.auto_assign_event_coordinator(event_row.id);
      return jsonb_build_object(
        'event_id', event_row.id,
        'accepted', false,
        'assignment_status', assignment_result ->> 'assignment_status',
        'reason', conflict_message
      );
    end if;

    update public.events
    set coordinator_id = current_user_id,
        pending_coordinator_id = null,
        coordinator_assignment_status = 'accepted',
        coordinator_assignment_responded_at = now(),
        coordinator_assignment_note = null,
        updated_at = now()
    where id = event_row.id;

    update public.coordinator_assignment_attempts
    set status = 'accepted',
        responded_at = now(),
        updated_at = now()
    where event_id = event_row.id
      and coordinator_id = current_user_id
      and status = 'invited';

    if event_row.coordinator_id is not null
      and event_row.coordinator_id is distinct from current_user_id
    then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.coordinator_id,
        'Event assignment updated',
        format('You are no longer assigned to coordinate %s.', event_row.name),
        'event', event_row.id
      );
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Coordinator assignment confirmed',
      format('Your Event Coordinator confirmed the assignment for %s.', event_row.name),
      'event', event_row.id
    );

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select profile.id,
      'Coordinator assignment confirmed',
      format('%s now has a confirmed Event Coordinator.', event_row.name),
      'event', event_row.id
    from public.profiles profile
    where profile.id <> current_user_id
      and public.user_has_permission(profile.id, 'coordinators.assign');

    return jsonb_build_object(
      'event_id', event_row.id,
      'accepted', true,
      'assignment_status', 'accepted'
    );
  end if;

  update public.events
  set pending_coordinator_id = null,
      coordinator_assignment_status = case
        when coordinator_id is not null then 'accepted'
        else null
      end,
      coordinator_assignment_responded_at = now(),
      updated_at = now()
  where id = event_row.id;

  update public.coordinator_assignment_attempts
  set status = 'declined',
      responded_at = now(),
      updated_at = now(),
      note = 'Coordinator declined the invitation.'
  where event_id = event_row.id
    and coordinator_id = current_user_id
    and status = 'invited';

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Coordinator assignment update',
    format('MULTIVENT is matching another available coordinator for %s.', event_row.name),
    'event', event_row.id
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select profile.id,
    'Coordinator invitation declined',
    format('The coordinator invitation for %s was declined.', event_row.name),
    'event', event_row.id
  from public.profiles profile
  where public.user_has_permission(profile.id, 'coordinators.assign');

  if event_row.coordinator_id is null then
    assignment_result := public.auto_assign_event_coordinator(event_row.id);
  else
    assignment_result := jsonb_build_object('assignment_status', 'accepted');
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'accepted', false,
    'assignment_status', assignment_result ->> 'assignment_status'
  );
end;
$$;

-- If leave or unavailability is recorded after an invitation/assignment, move
-- future overlapping events back through the same safe assignment process.
create or replace function public.reconcile_coordinator_unavailability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_event record;
  affected_coordinator uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.status not in ('unavailable', 'on_leave') then
    return new;
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  for affected_event in
    select scheduled_event.id, scheduled_event.name, scheduled_event.client_id
    from public.events scheduled_event
    cross join lateral public.coordinator_event_window(scheduled_event) assignment_window
    where scheduled_event.status in ('booking', 'payment_required', 'confirmed')
      and (
        scheduled_event.coordinator_id = new.coordinator_id
        or scheduled_event.pending_coordinator_id = new.coordinator_id
      )
      and assignment_window.ends_at > now()
      and new.starts_at < assignment_window.ends_at
      and new.ends_at > assignment_window.starts_at
    for update of scheduled_event
  loop
    affected_coordinator := new.coordinator_id;

    update public.coordinator_assignment_attempts
    set status = 'unavailable',
        responded_at = coalesce(responded_at, now()),
        updated_at = now(),
        note = 'Availability changed after this assignment was created.'
    where event_id = affected_event.id
      and coordinator_id = affected_coordinator
      and status in ('invited', 'accepted');

    update public.events
    set coordinator_id = null,
        pending_coordinator_id = null,
        coordinator_assignment_status = 'awaiting_assignment',
        coordinator_assignment_requested_at = null,
        coordinator_assignment_responded_at = now(),
        coordinator_assignment_attempted_at = now(),
        coordinator_assignment_source = 'automatic',
        coordinator_assignment_note = 'Coordinator availability changed and requires reassignment.',
        updated_at = now()
    where id = affected_event.id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      affected_coordinator,
      'Event assignment updated',
      format('%s requires a new coordinator because of an availability conflict.', affected_event.name),
      'event', affected_event.id
    );

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      affected_event.client_id,
      'Coordinator assignment update',
      format('MULTIVENT is confirming another available coordinator for %s.', affected_event.name),
      'event', affected_event.id
    );

    perform public.auto_assign_event_coordinator(affected_event.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists reconcile_coordinator_unavailability_trigger
  on public.coordinator_availability;
create trigger reconcile_coordinator_unavailability_trigger
after insert or update on public.coordinator_availability
for each row execute function public.reconcile_coordinator_unavailability();

revoke all on function public.reconcile_coordinator_unavailability() from public;

-- Account suspension/disablement must not leave future events attached to an
-- employee who can no longer access the coordinator workspace.
create or replace function public.reconcile_coordinator_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_event record;
begin
  if old.default_role <> 'event_coordinator'
    or (
      new.default_role = 'event_coordinator'
      and new.account_status = 'active'
    )
  then
    return new;
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  for affected_event in
    select scheduled_event.id, scheduled_event.name, scheduled_event.client_id
    from public.events scheduled_event
    cross join lateral public.coordinator_event_window(scheduled_event) assignment_window
    where scheduled_event.status in ('booking', 'payment_required', 'confirmed')
      and (
        scheduled_event.coordinator_id = new.id
        or scheduled_event.pending_coordinator_id = new.id
      )
      and (
        assignment_window.ends_at is null
        or assignment_window.ends_at > now()
      )
    for update of scheduled_event
  loop
    update public.coordinator_assignment_attempts
    set status = 'unavailable',
        responded_at = coalesce(responded_at, now()),
        updated_at = now(),
        note = 'The coordinator account became inactive.'
    where event_id = affected_event.id
      and coordinator_id = new.id
      and status in ('invited', 'accepted');

    update public.events
    set coordinator_id = null,
        pending_coordinator_id = null,
        coordinator_assignment_status = 'awaiting_assignment',
        coordinator_assignment_requested_at = null,
        coordinator_assignment_responded_at = now(),
        coordinator_assignment_attempted_at = now(),
        coordinator_assignment_source = 'automatic',
        coordinator_assignment_note = 'The previous coordinator account became unavailable.',
        updated_at = now()
    where id = affected_event.id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      affected_event.client_id,
      'Coordinator assignment update',
      format('MULTIVENT is confirming another available coordinator for %s.', affected_event.name),
      'event', affected_event.id
    );

    perform public.auto_assign_event_coordinator(affected_event.id);
  end loop;

  return new;
end;
$$;

drop trigger if exists reconcile_coordinator_account_status_trigger
  on public.profiles;
create trigger reconcile_coordinator_account_status_trigger
after update of account_status, default_role on public.profiles
for each row execute function public.reconcile_coordinator_account_status();

revoke all on function public.reconcile_coordinator_account_status() from public;

create or replace function public.remove_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  assignment_result jsonb;
begin
  if not public.has_permission('coordinators.reassign') then
    raise exception 'Coordinator-reassignment access is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events
  where id = target_event_id
  for update;
  if event_row.id is null
    or event_row.status not in ('booking', 'payment_required', 'confirmed', 'in_progress')
  then
    raise exception 'This event is not available for coordinator changes.';
  end if;
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()),
      updated_at = now(),
      note = coalesce(note, 'Removed by authorized MULTIVENT staff.')
  where event_id = event_row.id
    and status in ('invited', 'accepted');

  update public.events
  set coordinator_id = null,
      pending_coordinator_id = null,
      coordinator_assignment_status = 'awaiting_assignment',
      coordinator_assignment_requested_at = null,
      coordinator_assignment_responded_at = now(),
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'manual',
      coordinator_assignment_note = 'Coordinator removed by authorized MULTIVENT staff.',
      updated_at = now()
  where id = event_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select recipient.user_id,
    'Event assignment updated',
    format('You are no longer assigned to coordinate %s.', event_row.name),
    'event', event_row.id
  from (values (event_row.coordinator_id), (event_row.pending_coordinator_id)) recipient(user_id)
  where recipient.user_id is not null;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Coordinator assignment update',
    format('MULTIVENT is confirming another available coordinator for %s.', event_row.name),
    'event', event_row.id
  );

  assignment_result := public.auto_assign_event_coordinator(event_row.id);

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  )
  select auth.uid(), profile.default_role,
    'coordinator.assignment.removed', 'event', event_row.id,
    jsonb_build_object(
      'coordinator_id', event_row.coordinator_id,
      'pending_coordinator_id', event_row.pending_coordinator_id
    ),
    assignment_result,
    'success'
  from public.profiles profile
  where profile.id = auth.uid();

  return assignment_result;
end;
$$;

drop function if exists public.list_unassigned_events();
create function public.list_unassigned_events()
returns table (
  id uuid,
  name text,
  event_type text,
  event_date date,
  event_time time,
  venue text,
  location text,
  client_name text,
  assignment_note text,
  starts_at timestamptz,
  ends_at timestamptz,
  assignment_attempted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    event.name,
    event.event_type,
    event.event_date,
    event.event_time,
    event.venue,
    event.location,
    coalesce(client.full_name, 'Client'),
    event.coordinator_assignment_note,
    assignment_window.starts_at,
    assignment_window.ends_at,
    event.coordinator_assignment_attempted_at
  from public.events event
  join public.profiles client on client.id = event.client_id
  cross join lateral public.coordinator_event_window(event) assignment_window
  where public.has_permission('coordinators.view')
    and event.coordinator_assignment_status = 'awaiting_assignment'
    and event.status not in ('completed', 'cancelled')
  order by assignment_window.starts_at nulls last, event.created_at;
$$;

-- Apply automatic assignment to active legacy events that were already in a
-- bookable state before the assignment trigger was installed.
do $$
declare
  waiting_event record;
begin
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  for waiting_event in
    select event.id
    from public.events event
    where event.status in ('booking', 'payment_required', 'confirmed', 'in_progress')
      and event.coordinator_id is null
      and event.pending_coordinator_id is null
      and (
        event.coordinator_assignment_status is null
        or event.coordinator_assignment_status = 'awaiting_assignment'
      )
    order by event.event_date nulls last, event.created_at
  loop
    perform public.auto_assign_event_coordinator(waiting_event.id);
  end loop;
end;
$$;

drop trigger if exists capture_platform_audit_trigger
  on public.coordinator_assignment_attempts;
create trigger capture_platform_audit_trigger
after insert or update or delete on public.coordinator_assignment_attempts
for each row execute function public.capture_platform_audit();

revoke all on function public.coordinator_event_window(public.events) from public;
revoke all on function public.auto_assign_event_coordinator(uuid) from public;
revoke all on function public.assign_coordinator_when_booked() from public;
revoke all on function public.staff_assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
revoke all on function public.remove_event_coordinator(uuid) from public;
revoke all on function public.list_unassigned_events() from public;

grant execute on function public.staff_assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.remove_event_coordinator(uuid) to authenticated;
grant execute on function public.list_unassigned_events() to authenticated;

comment on table public.coordinator_assignment_attempts is
  'Coordinator invitation and response history used for fair assignment and decline exclusion.';
comment on function public.coordinator_event_window(public.events) is
  'Returns the conflict-checking event window including the configured scheduling buffer.';

commit;
