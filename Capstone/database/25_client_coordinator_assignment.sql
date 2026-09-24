-- Client-selected event coordinators and booked-service visibility.
-- Apply after 19_event_coordinator_workspace.sql.

begin;

create or replace function public.list_available_event_coordinators()
returns table (
  id uuid,
  full_name text,
  avatar_url text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    profile.id,
    coalesce(nullif(trim(profile.full_name), ''), 'Event Coordinator') as full_name,
    profile.avatar_url
  from public.profiles profile
  where auth.uid() is not null
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
  order by full_name;
$$;

create or replace function public.assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events;
  coordinator_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = current_user_id
    and event.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This event is not available for coordinator assignment.' using errcode = '42501';
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
    );

  if coordinator_name is null then
    raise exception 'The selected coordinator is not available.';
  end if;

  update public.events
  set coordinator_id = target_coordinator_id, updated_at = now()
  where id = event_row.id;

  if event_row.coordinator_id is distinct from target_coordinator_id then
    if event_row.coordinator_id is not null then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.coordinator_id,
        'Event assignment updated',
        format('You are no longer assigned to coordinate %s.', event_row.name),
        'event',
        event_row.id
      );
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      target_coordinator_id,
      'New event assignment',
      format('You were selected to coordinate %s.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name
  );
end;
$$;

create or replace function public.remove_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = current_user_id
    and event.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This event is not available for coordinator changes.' using errcode = '42501';
  end if;

  update public.events
  set coordinator_id = null, updated_at = now()
  where id = event_row.id;

  if event_row.coordinator_id is not null then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.coordinator_id,
      'Event assignment updated',
      format('You are no longer assigned to coordinate %s.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  return jsonb_build_object('event_id', event_row.id, 'coordinator_id', null);
end;
$$;

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
      and profiles.account_status = 'active'
  ) and not exists (
    select 1
    from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    join public.profiles on profiles.id = user_roles.user_id
    where user_roles.user_id = current_user_id
      and roles.name = 'event_coordinator'
      and profiles.account_status = 'active'
  ) then
    raise exception 'An active event coordinator account is required.' using errcode = '42501';
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
            'completed_task_count', coalesce(task_summary.completed_task_count, 0),
            'services', coalesce(service_summary.services, '[]'::jsonb)
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
        left join lateral (
          select jsonb_agg(service_row.payload order by service_row.created_at) as services
          from (
            select
              selection.created_at,
              jsonb_build_object(
                'id', selection.id,
                'service_name', selection.service_name,
                'category_name', coalesce(selection.category_name, 'Service'),
                'provider_name', coalesce(provider.business_name, 'Provider'),
                'amount', selection.estimated_amount,
                'status', coalesce(latest_booking.status::text, selection.status),
                'booked', latest_booking.id is not null
              ) as payload
            from public.event_service_selections selection
            left join public.provider_profiles provider on provider.id = selection.provider_id
            left join lateral (
              select booking.id, booking.status
              from public.bookings booking
              where booking.event_id = selection.event_id
                and booking.provider_id = selection.provider_id
                and booking.service_id = selection.service_id
                and booking.status not in ('rejected', 'cancelled', 'expired')
              order by booking.updated_at desc
              limit 1
            ) latest_booking on true
            where selection.event_id = event.id
              and selection.status not in ('declined', 'cancelled')
          ) service_row
        ) service_summary on true
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

revoke all on function public.list_available_event_coordinators() from public;
revoke all on function public.assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.remove_event_coordinator(uuid) from public;
revoke all on function public.get_coordinator_dashboard() from public;

grant execute on function public.list_available_event_coordinators() to authenticated;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.remove_event_coordinator(uuid) to authenticated;
grant execute on function public.get_coordinator_dashboard() to authenticated;

commit;
