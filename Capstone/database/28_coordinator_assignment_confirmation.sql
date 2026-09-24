-- Coordinator invitations, acceptance, booked-service instructions, and provider contact.
-- Apply after 27_client_booking_changes.sql.

begin;

alter table public.events
  add column if not exists pending_coordinator_id uuid references public.profiles(id) on delete set null,
  add column if not exists coordinator_assignment_status text,
  add column if not exists coordinator_assignment_requested_at timestamptz,
  add column if not exists coordinator_assignment_responded_at timestamptz;

update public.events
set
  coordinator_assignment_status = 'accepted',
  coordinator_assignment_responded_at = coalesce(coordinator_assignment_responded_at, updated_at)
where coordinator_id is not null
  and coordinator_assignment_status is null;

alter table public.events
  drop constraint if exists events_coordinator_assignment_status_check,
  add constraint events_coordinator_assignment_status_check
    check (
      coordinator_assignment_status is null
      or coordinator_assignment_status in ('pending', 'accepted')
    ),
  drop constraint if exists events_coordinator_assignment_consistency_check,
  add constraint events_coordinator_assignment_consistency_check
    check (
      (coordinator_assignment_status = 'pending' and pending_coordinator_id is not null)
      or (coordinator_assignment_status = 'accepted' and coordinator_id is not null)
      or (
        coordinator_assignment_status is null
        and pending_coordinator_id is null
        and coordinator_id is null
      )
    );

create index if not exists events_pending_coordinator_idx
  on public.events (pending_coordinator_id, coordinator_assignment_requested_at)
  where pending_coordinator_id is not null;

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

  if event_row.coordinator_id = target_coordinator_id
    and event_row.coordinator_assignment_status = 'accepted'
  then
    return jsonb_build_object(
      'event_id', event_row.id,
      'coordinator_id', target_coordinator_id,
      'coordinator_name', coordinator_name,
      'assignment_status', 'accepted'
    );
  end if;

  if event_row.pending_coordinator_id is distinct from target_coordinator_id then
    if event_row.pending_coordinator_id is not null then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.pending_coordinator_id,
        'Event invitation withdrawn',
        format('The invitation to coordinate %s was withdrawn.', event_row.name),
        'event',
        event_row.id
      );
    end if;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      target_coordinator_id,
      'Event coordination invitation',
      format('You were invited to coordinate %s. Review and confirm the assignment in your workspace.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  update public.events
  set
    pending_coordinator_id = target_coordinator_id,
    coordinator_assignment_status = 'pending',
    coordinator_assignment_requested_at = case
      when pending_coordinator_id is distinct from target_coordinator_id then now()
      else coalesce(coordinator_assignment_requested_at, now())
    end,
    coordinator_assignment_responded_at = null,
    updated_at = now()
  where id = event_row.id;

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
    and event.pending_coordinator_id = current_user_id
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This coordinator invitation is no longer available.' using errcode = '42501';
  end if;

  if not exists (
    select 1
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
  ) then
    raise exception 'An active event coordinator account is required.' using errcode = '42501';
  end if;

  if accept_assignment then
    update public.events
    set
      coordinator_id = current_user_id,
      pending_coordinator_id = null,
      coordinator_assignment_status = 'accepted',
      coordinator_assignment_responded_at = now(),
      updated_at = now()
    where id = event_row.id;

    if event_row.coordinator_id is not null
      and event_row.coordinator_id is distinct from current_user_id
    then
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
      event_row.client_id,
      'Coordinator invitation accepted',
      format('Your coordinator accepted the invitation for %s.', event_row.name),
      'event',
      event_row.id
    );
  else
    update public.events
    set
      pending_coordinator_id = null,
      coordinator_assignment_status = case
        when coordinator_id is not null then 'accepted'
        else null
      end,
      coordinator_assignment_responded_at = now(),
      updated_at = now()
    where id = event_row.id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Coordinator invitation declined',
      format('The coordinator declined the invitation for %s. You can invite another coordinator.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'accepted', accept_assignment,
    'assignment_status', case when accept_assignment then 'accepted' else 'declined' end
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
  set
    coordinator_id = null,
    pending_coordinator_id = null,
    coordinator_assignment_status = null,
    coordinator_assignment_requested_at = null,
    coordinator_assignment_responded_at = null,
    updated_at = now()
  where id = event_row.id;

  if event_row.pending_coordinator_id is not null then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.pending_coordinator_id,
      'Event invitation withdrawn',
      format('The invitation to coordinate %s was withdrawn.', event_row.name),
      'event',
      event_row.id
    );
  end if;

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
  ) then
    raise exception 'An active event coordinator account is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'invitations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_id', event.id,
          'event_name', event.name,
          'event_type', event.event_type,
          'event_date', event.event_date,
          'event_time', event.event_time,
          'venue', event.venue,
          'location', event.location,
          'guest_count', event.guest_count,
          'client_name', coalesce(client.full_name, 'Client'),
          'requested_at', event.coordinator_assignment_requested_at
        )
        order by event.coordinator_assignment_requested_at desc
      )
      from public.events event
      join public.profiles client on client.id = event.client_id
      where event.pending_coordinator_id = current_user_id
        and event.coordinator_assignment_status = 'pending'
        and event.status not in ('completed', 'cancelled')
    ), '[]'::jsonb),
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
                'service_id', selection.service_id,
                'service_name', selection.service_name,
                'category_name', coalesce(selection.category_name, 'Service'),
                'provider_id', provider.id,
                'provider_user_id', provider.user_id,
                'provider_name', coalesce(provider.business_name, 'Provider'),
                'provider_email', provider.contact_email,
                'provider_phone', provider.contact_phone,
                'amount', selection.estimated_amount,
                'status', coalesce(latest_booking.status::text, selection.status),
                'booked', latest_booking.id is not null,
                'booking_id', latest_booking.id,
                'client_notes', coalesce(latest_booking.client_notes, selection.notes, selection.dietary_notes),
                'instructions', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', instruction.id,
                      'title', instruction.title,
                      'body', instruction.body,
                      'type', instruction.instruction_type,
                      'tags', instruction.tags,
                      'is_required', instruction.is_required,
                      'status', instruction.status
                    )
                    order by instruction.is_required desc, instruction.created_at
                  )
                  from public.event_provider_instructions instruction
                  where instruction.event_id = event.id
                    and instruction.status <> 'archived'
                    and (
                      instruction.selection_id = selection.id
                      or (
                        instruction.selection_id is null
                        and (instruction.provider_id is null or instruction.provider_id = selection.provider_id)
                        and (instruction.service_id is null or instruction.service_id = selection.service_id)
                      )
                    )
                ), '[]'::jsonb)
              ) as payload
            from public.event_service_selections selection
            left join public.provider_profiles provider on provider.id = selection.provider_id
            left join lateral (
              select booking.id, booking.status, booking.client_notes
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
          and event.coordinator_assignment_status = 'accepted'
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
          and event.coordinator_assignment_status = 'accepted'
      ) task_row
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.open_coordinator_provider_conversation(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  booking_row record;
  conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select
    booking.id,
    booking.event_id,
    booking.client_id,
    provider.user_id as provider_user_id,
    event.name as event_name,
    service.name as service_name
  into booking_row
  from public.bookings booking
  join public.events event on event.id = booking.event_id
  join public.provider_profiles provider on provider.id = booking.provider_id
  join public.services service on service.id = booking.service_id
  where booking.id = target_booking_id
    and booking.status not in ('rejected', 'cancelled', 'expired')
    and event.coordinator_id = current_user_id
    and event.coordinator_assignment_status = 'accepted';

  if booking_row.id is null then
    raise exception 'This provider conversation is not available to your coordinator account.' using errcode = '42501';
  end if;

  select conversation.id
  into conversation_id
  from public.conversations conversation
  where conversation.booking_id = booking_row.id
  order by conversation.created_at
  limit 1;

  if conversation_id is null then
    insert into public.conversations (event_id, booking_id, title)
    values (
      booking_row.event_id,
      booking_row.id,
      format('%s: %s', booking_row.event_name, booking_row.service_name)
    )
    returning id into conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (conversation_id, booking_row.client_id),
    (conversation_id, booking_row.provider_user_id),
    (conversation_id, current_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return jsonb_build_object(
    'conversation_id', conversation_id,
    'booking_id', booking_row.id,
    'provider_user_id', booking_row.provider_user_id
  );
end;
$$;

revoke all on function public.assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
revoke all on function public.remove_event_coordinator(uuid) from public;
revoke all on function public.get_coordinator_dashboard() from public;
revoke all on function public.open_coordinator_provider_conversation(uuid) from public;

grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.remove_event_coordinator(uuid) to authenticated;
grant execute on function public.get_coordinator_dashboard() to authenticated;
grant execute on function public.open_coordinator_provider_conversation(uuid) to authenticated;

comment on column public.events.pending_coordinator_id is
  'Coordinator invited by the client; receives no event access until acceptance.';
comment on column public.events.coordinator_assignment_status is
  'Pending invitations are separate from accepted coordinator access.';

commit;
