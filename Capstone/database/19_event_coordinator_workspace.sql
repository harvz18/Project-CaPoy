-- Event coordinator workspace: assigned-event dashboard and secure task actions.
-- Run after the initial schema and booking security migrations.

begin;

create index if not exists events_coordinator_date_idx
  on public.events (coordinator_id, event_date)
  where coordinator_id is not null;

create index if not exists coordination_tasks_event_due_idx
  on public.coordination_tasks (event_id, status, due_at);

drop policy if exists "Coordinators can view assigned event tasks"
  on public.coordination_tasks;
create policy "Coordinators can view assigned event tasks"
  on public.coordination_tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = coordination_tasks.event_id
        and events.coordinator_id = auth.uid()
    )
  );

drop policy if exists "Coordinators can create assigned event tasks"
  on public.coordination_tasks;
create policy "Coordinators can create assigned event tasks"
  on public.coordination_tasks
  for insert
  to authenticated
  with check (
    (assigned_to is null or assigned_to = auth.uid())
    and exists (
      select 1
      from public.events
      where events.id = coordination_tasks.event_id
        and events.coordinator_id = auth.uid()
        and events.status not in ('completed', 'cancelled')
    )
  );

drop policy if exists "Coordinators can update assigned event tasks"
  on public.coordination_tasks;
create policy "Coordinators can update assigned event tasks"
  on public.coordination_tasks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = coordination_tasks.event_id
        and events.coordinator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events
      where events.id = coordination_tasks.event_id
        and events.coordinator_id = auth.uid()
    )
  );

grant select, insert, update on table public.coordination_tasks to authenticated;

create or replace function public.get_coordinator_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where profiles.id = current_user_id
      and profiles.default_role = 'event_coordinator'
  ) and not exists (
    select 1
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = current_user_id
      and roles.name = 'event_coordinator'
  ) then
    raise exception 'An event coordinator account is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(event_row.payload order by event_row.event_date nulls last, event_row.name)
      from (
        select
          event.event_date,
          event.name,
          jsonb_build_object(
            'id', event.id,
            'name', event.name,
            'event_type', event.event_type,
            'event_date', event.event_date,
            'event_time', event.event_time,
            'venue', event.venue,
            'location', event.location,
            'guest_count', event.guest_count,
            'total_budget', event.total_budget,
            'status', event.status,
            'client_name', coalesce(client.full_name, 'Client'),
            'booking_count', coalesce(booking_summary.booking_count, 0),
            'confirmed_booking_count', coalesce(booking_summary.confirmed_booking_count, 0),
            'task_count', coalesce(task_summary.task_count, 0),
            'completed_task_count', coalesce(task_summary.completed_task_count, 0)
          ) as payload
        from public.events event
        join public.profiles client on client.id = event.client_id
        left join lateral (
          select
            count(*) filter (
              where booking.status not in ('rejected', 'cancelled', 'expired')
            )::integer as booking_count,
            count(*) filter (
              where booking.status in ('paid', 'confirmed', 'completed')
            )::integer as confirmed_booking_count
          from public.bookings booking
          where booking.event_id = event.id
        ) booking_summary on true
        left join lateral (
          select
            count(*)::integer as task_count,
            count(*) filter (where task.status = 'completed')::integer as completed_task_count
          from public.coordination_tasks task
          where task.event_id = event.id
        ) task_summary on true
        where event.coordinator_id = current_user_id
      ) event_row
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
        task_row.payload
        order by task_row.is_completed, task_row.due_at nulls last, task_row.created_at
      )
      from (
        select
          task.created_at,
          task.due_at,
          task.status = 'completed' as is_completed,
          jsonb_build_object(
            'id', task.id,
            'event_id', task.event_id,
            'event_name', event.name,
            'title', task.title,
            'description', task.description,
            'due_at', task.due_at,
            'status', task.status,
            'assigned_to_name', coalesce(assignee.full_name, 'Unassigned')
          ) as payload
        from public.coordination_tasks task
        join public.events event on event.id = task.event_id
        left join public.profiles assignee on assignee.id = task.assigned_to
        where event.coordinator_id = current_user_id
      ) task_row
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.create_coordination_task(
  target_event_id uuid,
  task_title text,
  task_description text default null,
  target_due_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_task public.coordination_tasks;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(task_title, ''))) not between 3 and 160 then
    raise exception 'Task title must contain 3 to 160 characters.';
  end if;

  if char_length(trim(coalesce(task_description, ''))) > 1000 then
    raise exception 'Task description cannot exceed 1000 characters.';
  end if;

  if not exists (
    select 1
    from public.events
    where events.id = target_event_id
      and events.coordinator_id = current_user_id
      and events.status not in ('completed', 'cancelled')
      and (
        exists (
          select 1
          from public.profiles
          where profiles.id = current_user_id
            and profiles.default_role = 'event_coordinator'
        )
        or exists (
          select 1
          from public.user_roles
          join public.roles on roles.id = user_roles.role_id
          where user_roles.user_id = current_user_id
            and roles.name = 'event_coordinator'
        )
      )
  ) then
    raise exception 'The event is not available to this coordinator.' using errcode = '42501';
  end if;

  insert into public.coordination_tasks (
    event_id,
    assigned_to,
    title,
    description,
    due_at,
    status
  ) values (
    target_event_id,
    current_user_id,
    trim(task_title),
    nullif(trim(coalesce(task_description, '')), ''),
    target_due_at,
    'pending'
  )
  returning * into created_task;

  return jsonb_build_object(
    'id', created_task.id,
    'event_id', created_task.event_id,
    'status', created_task.status
  );
end;
$$;

create or replace function public.update_coordination_task_status(
  target_task_id uuid,
  new_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_task public.coordination_tasks;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if new_status not in ('pending', 'in_progress', 'blocked', 'completed') then
    raise exception 'Unsupported task status.';
  end if;

  update public.coordination_tasks task
  set
    status = new_status,
    updated_at = now()
  from public.events event
  where task.id = target_task_id
    and event.id = task.event_id
    and event.coordinator_id = current_user_id
    and (
      exists (
        select 1
        from public.profiles
        where profiles.id = current_user_id
          and profiles.default_role = 'event_coordinator'
      )
      or exists (
        select 1
        from public.user_roles
        join public.roles on roles.id = user_roles.role_id
        where user_roles.user_id = current_user_id
          and roles.name = 'event_coordinator'
      )
    )
  returning task.* into updated_task;

  if updated_task.id is null then
    raise exception 'Task was not found in your assigned events.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', updated_task.id,
    'status', updated_task.status,
    'updated_at', updated_task.updated_at
  );
end;
$$;

revoke all on function public.get_coordinator_dashboard() from public;
revoke all on function public.create_coordination_task(uuid, text, text, timestamptz) from public;
revoke all on function public.update_coordination_task_status(uuid, text) from public;

grant execute on function public.get_coordinator_dashboard() to authenticated;
grant execute on function public.create_coordination_task(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.update_coordination_task_status(uuid, text) to authenticated;

commit;
