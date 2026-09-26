-- MULTIVENT Phase 6: Customer Service ticket and complaint management.
-- Apply after 34_assistant_operations.sql.

begin;

insert into public.permissions (code, description)
values ('support.assign', 'Assign and reassign Customer Service tickets.')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
join public.permissions permission on permission.code = 'support.assign'
where role.name = 'customer_service'
on conflict (role_id, permission_id) do nothing;

alter table public.support_tickets
  add column if not exists first_responded_at timestamptz,
  add column if not exists last_message_at timestamptz,
  add column if not exists closed_at timestamptz;

create index if not exists support_tickets_assignee_queue_idx
  on public.support_tickets (assigned_to, status, priority, updated_at desc);
create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);

-- Authenticated users can only attach tickets to events and bookings in which
-- they participate as the client, provider, or accepted coordinator.
create or replace function public.can_reference_my_support_context(
  target_event_id uuid,
  target_booking_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    case
      when target_booking_id is not null then exists (
        select 1
        from public.bookings booking
        join public.events event on event.id = booking.event_id
        join public.provider_profiles provider on provider.id = booking.provider_id
        where booking.id = target_booking_id
          and (target_event_id is null or booking.event_id = target_event_id)
          and (
            booking.client_id = auth.uid()
            or provider.user_id = auth.uid()
            or event.coordinator_id = auth.uid()
          )
      )
      when target_event_id is not null then exists (
        select 1
        from public.events event
        where event.id = target_event_id
          and (
            event.client_id = auth.uid()
            or event.coordinator_id = auth.uid()
            or exists (
              select 1
              from public.bookings booking
              join public.provider_profiles provider on provider.id = booking.provider_id
              where booking.event_id = event.id
                and provider.user_id = auth.uid()
            )
          )
      )
      else true
    end
  );
$$;

revoke all on function public.can_reference_my_support_context(uuid, uuid) from public;
grant execute on function public.can_reference_my_support_context(uuid, uuid) to authenticated;

create or replace function public.list_my_support_context()
returns table (
  context_type text,
  id uuid,
  label text,
  event_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select context_row.context_type, context_row.id, context_row.label, context_row.event_id
  from (
    select
      'event'::text as context_type,
      event.id,
      coalesce(nullif(trim(event.name), ''), 'Untitled event') ||
        case when event.event_date is null then '' else ' - ' || event.event_date::text end as label,
      event.id as event_id,
      event.created_at as sort_at
    from public.events event
    where auth.uid() is not null
      and (
        event.client_id = auth.uid()
        or event.coordinator_id = auth.uid()
        or exists (
          select 1
          from public.bookings booking
          join public.provider_profiles provider on provider.id = booking.provider_id
          where booking.event_id = event.id and provider.user_id = auth.uid()
        )
      )

    union all

    select
      'booking'::text,
      booking.id,
      coalesce(nullif(trim(service.name), ''), 'Booking') || ' - ' ||
        coalesce(nullif(trim(event.name), ''), 'Event'),
      booking.event_id,
      booking.created_at
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join public.provider_profiles provider on provider.id = booking.provider_id
    left join public.services service on service.id = booking.service_id
    where auth.uid() is not null
      and (
        booking.client_id = auth.uid()
        or provider.user_id = auth.uid()
        or event.coordinator_id = auth.uid()
      )
  ) context_row
  order by context_row.sort_at desc
  limit 100;
$$;

revoke all on function public.list_my_support_context() from public;
grant execute on function public.list_my_support_context() to authenticated;

-- Public ticket creation is normalized server-side. All later ticket changes
-- must pass through the guarded Customer Service RPCs below.
create or replace function public.protect_support_ticket_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.subject := trim(new.subject);
    new.description := trim(new.description);
    new.category := lower(trim(new.category));

    if new.category not in ('account', 'booking', 'payment', 'system', 'technical', 'other') then
      raise exception 'Unsupported support category.';
    end if;
    if char_length(new.subject) not between 3 and 200 then
      raise exception 'The support subject must be between 3 and 200 characters.';
    end if;
    if char_length(new.description) not between 10 and 4000 then
      raise exception 'The support description must be between 10 and 4000 characters.';
    end if;

    if auth.role() <> 'service_role' then
      if auth.uid() is null or new.user_id is distinct from auth.uid() then
        raise exception 'Support tickets can only be created for the signed-in account.' using errcode = '42501';
      end if;
      if not public.can_reference_my_support_context(new.event_id, new.booking_id) then
        raise exception 'The selected event or booking is not available to this account.' using errcode = '42501';
      end if;
      new.status := 'open';
      new.priority := 'normal';
      new.assigned_to := null;
      new.resolved_at := null;
      new.first_responded_at := null;
      new.last_message_at := null;
      new.closed_at := null;
      new.created_at := now();
      new.updated_at := now();
    end if;
    return new;
  end if;

  if auth.role() = 'service_role'
    or current_setting('app.support_ticket_management_authorized', true) = 'true'
  then
    return new;
  end if;

  raise exception 'Support ticket changes must use the Customer Service workflow.' using errcode = '42501';
end;
$$;

drop trigger if exists protect_support_ticket_fields_trigger on public.support_tickets;
create trigger protect_support_ticket_fields_trigger
before insert or update on public.support_tickets
for each row execute function public.protect_support_ticket_fields();
revoke all on function public.protect_support_ticket_fields() from public;

drop policy if exists "Users create owned support tickets" on public.support_tickets;
create policy "Users create owned support tickets"
  on public.support_tickets for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_reference_my_support_context(event_id, booking_id)
  );

drop policy if exists "Support staff update tickets" on public.support_tickets;

drop policy if exists "Ticket participants view messages" on public.support_messages;
create policy "Ticket participants view messages"
  on public.support_messages for select to authenticated
  using (exists (
    select 1
    from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (ticket.user_id = auth.uid() or public.has_permission('support.view'))
      and (not support_messages.is_internal or public.has_permission('support.respond'))
  ));

drop policy if exists "Ticket participants send messages" on public.support_messages;
create policy "Ticket participants send messages"
  on public.support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and char_length(trim(body)) between 1 and 4000
    and exists (
      select 1
      from public.support_tickets ticket
      where ticket.id = support_messages.ticket_id
        and ticket.status <> 'closed'
        and (ticket.user_id = auth.uid() or public.has_permission('support.respond'))
        and (not support_messages.is_internal or public.has_permission('support.respond'))
    )
  );

-- Support personnel names are visible only to other authorized support staff.
drop policy if exists "Support staff view support agents" on public.profiles;
create policy "Support staff view support agents"
  on public.profiles for select to authenticated
  using (
    public.has_permission('support.view')
    and public.user_has_permission(profiles.id, 'support.respond')
  );

create or replace function public.list_support_agents()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id,
    coalesce(nullif(trim(profile.full_name), ''), 'Customer Service'),
    profile.email
  from public.profiles profile
  where public.has_permission('support.view')
    and profile.account_status = 'active'
    and public.user_has_permission(profile.id, 'support.respond')
  order by profile.full_name nulls last, profile.id;
$$;

revoke all on function public.list_support_agents() from public;
grant execute on function public.list_support_agents() to authenticated;

create or replace function public.update_support_ticket(
  target_ticket_id uuid,
  new_status text,
  new_priority text default null,
  assign_to_self boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_row public.support_tickets%rowtype;
  caller_role public.user_role;
begin
  if not public.has_permission('support.respond') then
    raise exception 'Support access is required.' using errcode = '42501';
  end if;
  if new_status not in ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed') then
    raise exception 'Unsupported support status.';
  end if;
  if new_priority is not null and new_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Unsupported ticket priority.';
  end if;
  if new_status in ('resolved', 'closed') and not public.has_permission('support.resolve') then
    raise exception 'Ticket-resolution access is required.' using errcode = '42501';
  end if;

  select ticket.* into previous_row
  from public.support_tickets ticket
  where ticket.id = target_ticket_id
  for update;
  if previous_row.id is null then raise exception 'Ticket not found.'; end if;

  if new_status = 'closed' and previous_row.status not in ('resolved', 'closed') then
    raise exception 'Resolve the ticket before closing it.';
  end if;
  if previous_row.status = 'closed' and new_status not in ('closed', 'in_progress') then
    raise exception 'A closed ticket can only be reopened to in progress.';
  end if;
  if previous_row.status = 'closed' and new_status = 'in_progress'
    and not public.has_permission('support.resolve')
  then
    raise exception 'Ticket-resolution access is required to reopen a closed ticket.' using errcode = '42501';
  end if;

  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  perform set_config('app.support_ticket_management_authorized', 'true', true);
  update public.support_tickets
  set status = new_status,
      priority = coalesce(new_priority, priority),
      assigned_to = case when assign_to_self then auth.uid() else assigned_to end,
      first_responded_at = case
        when first_responded_at is null and (assign_to_self or new_status <> 'open') then now()
        else first_responded_at
      end,
      resolved_at = case when new_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
      closed_at = case when new_status = 'closed' then now() else null end,
      updated_at = now()
  where id = target_ticket_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  ) values (
    auth.uid(), caller_role, 'support.ticket.update', 'support_ticket', target_ticket_id,
    jsonb_build_object(
      'status', previous_row.status,
      'priority', previous_row.priority,
      'assigned_to', previous_row.assigned_to
    ),
    jsonb_build_object(
      'status', new_status,
      'priority', coalesce(new_priority, previous_row.priority),
      'assigned_to', case when assign_to_self then auth.uid() else previous_row.assigned_to end
    ),
    'success'
  );

  if new_status is distinct from previous_row.status
    and new_status in ('resolved', 'closed', 'in_progress')
  then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      previous_row.user_id,
      case
        when new_status = 'resolved' then 'Support ticket resolved'
        when new_status = 'closed' then 'Support ticket closed'
        else 'Support ticket reopened'
      end,
      format('Ticket MV-%s is now %s.',
        lpad(previous_row.ticket_number::text, 6, '0'), replace(new_status, '_', ' ')),
      'support_ticket', target_ticket_id
    );
  end if;
end;
$$;

create or replace function public.assign_support_ticket(
  target_ticket_id uuid,
  target_assignee_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_row public.support_tickets%rowtype;
  caller_role public.user_role;
begin
  if not public.has_permission('support.assign') then
    raise exception 'Ticket-assignment access is required.' using errcode = '42501';
  end if;
  if target_assignee_id is not null
    and not public.user_has_permission(target_assignee_id, 'support.respond')
  then
    raise exception 'The selected account is not an active support agent.';
  end if;

  select ticket.* into previous_row
  from public.support_tickets ticket
  where ticket.id = target_ticket_id
  for update;
  if previous_row.id is null then raise exception 'Ticket not found.'; end if;

  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  perform set_config('app.support_ticket_management_authorized', 'true', true);
  update public.support_tickets
  set assigned_to = target_assignee_id,
      status = case when target_assignee_id is not null and status = 'open' then 'in_progress' else status end,
      first_responded_at = case
        when target_assignee_id is not null then coalesce(first_responded_at, now())
        else first_responded_at
      end,
      updated_at = now()
  where id = target_ticket_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  ) values (
    auth.uid(), caller_role, 'support.ticket.assign', 'support_ticket', target_ticket_id,
    jsonb_build_object('assigned_to', previous_row.assigned_to),
    jsonb_build_object('assigned_to', target_assignee_id),
    'success'
  );
end;
$$;

revoke all on function public.update_support_ticket(uuid, text, text, boolean) from public;
revoke all on function public.assign_support_ticket(uuid, uuid) from public;
grant execute on function public.update_support_ticket(uuid, text, text, boolean) to authenticated;
grant execute on function public.assign_support_ticket(uuid, uuid) to authenticated;

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket_row public.support_tickets%rowtype;
  next_status text;
  sender_role public.user_role;
begin
  select ticket.* into ticket_row
  from public.support_tickets ticket
  where ticket.id = new.ticket_id
  for update;
  if ticket_row.id is null then return new; end if;

  next_status := case
    when new.is_internal then ticket_row.status
    when new.sender_id = ticket_row.user_id then 'in_progress'
    when ticket_row.status in ('resolved', 'closed') then ticket_row.status
    else 'waiting_for_user'
  end;

  perform set_config('app.support_ticket_management_authorized', 'true', true);
  update public.support_tickets
  set status = next_status,
      assigned_to = case
        when new.sender_id <> ticket_row.user_id
          and public.user_has_permission(new.sender_id, 'support.respond')
          then coalesce(assigned_to, new.sender_id)
        else assigned_to
      end,
      first_responded_at = case
        when first_responded_at is null
          and new.sender_id <> ticket_row.user_id
          and not new.is_internal
          then now()
        else first_responded_at
      end,
      resolved_at = case when next_status in ('resolved', 'closed') then resolved_at else null end,
      closed_at = case when next_status = 'closed' then closed_at else null end,
      last_message_at = now(),
      updated_at = now()
  where id = new.ticket_id;

  if new.sender_id = ticket_row.user_id then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select recipient.user_id,
      'Support ticket reply',
      format('The user replied to ticket MV-%s.', lpad(ticket_row.ticket_number::text, 6, '0')),
      'support_ticket', ticket_row.id
    from (
      select ticket_row.assigned_to as user_id
      where ticket_row.assigned_to is not null
        and public.user_has_permission(ticket_row.assigned_to, 'support.respond')
      union
      select profile.id
      from public.profiles profile
      where (
          ticket_row.assigned_to is null
          or not public.user_has_permission(ticket_row.assigned_to, 'support.respond')
        )
        and public.user_has_permission(profile.id, 'support.respond')
    ) recipient
    where recipient.user_id is distinct from new.sender_id;
  elsif not new.is_internal then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      ticket_row.user_id,
      'New support reply',
      format('MULTIVENT Customer Service replied to ticket MV-%s.', lpad(ticket_row.ticket_number::text, 6, '0')),
      'support_ticket', ticket_row.id
    );
  end if;

  select profile.default_role into sender_role
  from public.profiles profile where profile.id = new.sender_id;
  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    new.sender_id, sender_role,
    case when new.sender_id = ticket_row.user_id
      then 'support.ticket.user_reply'
      when new.is_internal then 'support.ticket.internal_note'
      else 'support.ticket.staff_reply'
    end,
    'support_ticket', ticket_row.id,
    jsonb_build_object('status', ticket_row.status),
    jsonb_build_object('status', next_status),
    'success', jsonb_build_object('message_content_logged', false)
  );

  return new;
end;
$$;

drop trigger if exists touch_support_ticket_from_message_trigger on public.support_messages;
create trigger touch_support_ticket_from_message_trigger
after insert on public.support_messages
for each row execute function public.touch_support_ticket_from_message();
revoke all on function public.touch_support_ticket_from_message() from public;

create or replace function public.notify_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_role public.user_role;
begin
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select profile.id,
    'New support ticket',
    format('Ticket MV-%s requires Customer Service review.', lpad(new.ticket_number::text, 6, '0')),
    'support_ticket', new.id
  from public.profiles profile
  where public.user_has_permission(profile.id, 'support.respond');

  select profile.default_role into creator_role
  from public.profiles profile where profile.id = new.user_id;
  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    new_state, result, metadata
  ) values (
    new.user_id, creator_role, 'support.ticket.create', 'support_ticket', new.id,
    jsonb_build_object('status', new.status, 'category', new.category),
    'success', jsonb_build_object('description_logged', false)
  );
  return new;
end;
$$;

drop trigger if exists notify_support_ticket_created_trigger on public.support_tickets;
create trigger notify_support_ticket_created_trigger
after insert on public.support_tickets
for each row execute function public.notify_support_ticket_created();
revoke all on function public.notify_support_ticket_created() from public;

-- Ticket rows remain insertable by their owners, but only audited RPCs may
-- update staff-controlled lifecycle fields.
revoke update on table public.support_tickets from authenticated;
grant select, insert on table public.support_tickets to authenticated;
grant select, insert on table public.support_messages to authenticated;

comment on column public.support_tickets.first_responded_at is
  'Time of the first public Customer Service response or staff assignment.';
comment on column public.support_tickets.last_message_at is
  'Time of the most recent public reply or internal note.';
comment on column public.support_tickets.closed_at is
  'Time an already-resolved support ticket was formally closed.';

commit;
