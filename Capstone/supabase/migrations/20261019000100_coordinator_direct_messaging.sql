-- V7 Phase 2: coordinator messaging uses the existing conversation tables,
-- message RPCs, notifications, and Realtime stream. New coordinator-provider
-- conversations are direct rather than adding a coordinator to the client's
-- provider thread. Existing history remains readable.

begin;

create unique index if not exists conversations_coordinator_provider_unique
  on public.conversations (booking_id)
  where conversation_kind = 'coordinator_provider';

create or replace function public.is_valid_client_provider_message_member(
  target_booking_id uuid,
  require_active_booking boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.bookings booking
      join public.provider_profiles provider on provider.id = booking.provider_id
      where booking.id = target_booking_id
        and (not require_active_booking or booking.status::text in ('confirmed', 'completed'))
        and auth.uid() in (booking.client_id, provider.user_id)
    );
$$;

create or replace function public.is_valid_coordinator_provider_message_member(
  target_booking_id uuid,
  require_active_booking boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.bookings booking
      join public.provider_profiles provider on provider.id = booking.provider_id
      join public.events event on event.id = booking.event_id
      where booking.id = target_booking_id
        and (not require_active_booking or booking.status::text in ('confirmed', 'completed'))
        and event.status <> 'cancelled'
        and event.coordinator_assignment_status = 'accepted'
        and event.coordinator_id is not null
        and auth.uid() in (event.coordinator_id, provider.user_id)
    );
$$;

-- Existing booking threads that already contain an accepted coordinator stay
-- viewable as history. New sends are dispatched by conversation kind below.
create or replace function public.can_view_booking_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.conversations conversation
    join public.conversation_participants participant
      on participant.conversation_id = conversation.id
     and participant.user_id = auth.uid()
    where conversation.id = target_conversation_id
      and (
        (conversation.conversation_kind = 'event_coordinator'
          and conversation.event_id is not null
          and public.is_valid_event_coordinator_message_member(conversation.event_id, false))
        or (conversation.conversation_kind = 'coordinator_provider'
          and conversation.booking_id is not null
          and public.is_valid_coordinator_provider_message_member(conversation.booking_id, false))
        or (conversation.conversation_kind = 'booking'
          and conversation.booking_id is not null
          and public.is_valid_booking_message_member(conversation.booking_id, false))
      )
  );
$$;

create or replace function public.can_send_booking_message(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.conversations conversation
    join public.conversation_participants participant
      on participant.conversation_id = conversation.id
     and participant.user_id = auth.uid()
    where conversation.id = target_conversation_id
      and (
        (conversation.conversation_kind = 'event_coordinator'
          and conversation.event_id is not null
          and public.is_valid_event_coordinator_message_member(conversation.event_id, true))
        or (conversation.conversation_kind = 'coordinator_provider'
          and conversation.booking_id is not null
          and public.is_valid_coordinator_provider_message_member(conversation.booking_id, true))
        or (conversation.conversation_kind = 'booking'
          and conversation.booking_id is not null
          and public.is_valid_client_provider_message_member(conversation.booking_id, true))
      )
  );
$$;

-- Client-provider booking threads remain direct. A coordinator gets a separate
-- conversation through ensure_coordinator_provider_conversation().
create or replace function public.ensure_booking_conversation(target_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row record;
  resolved_conversation_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('multivent-booking-conversation:' || target_booking_id::text));
  select booking.id, booking.event_id, booking.client_id, booking.status,
    provider.user_id as provider_user_id,
    coalesce(nullif(event.name, ''), 'Event') as event_name,
    coalesce(nullif(service.name, ''), 'Service booking') as service_name
  into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  join public.events event on event.id = booking.event_id
  join public.services service on service.id = booking.service_id
  where booking.id = target_booking_id
  for update of booking;

  if booking_row.id is null or booking_row.status::text not in ('confirmed', 'completed') then
    return null;
  end if;

  select conversation.id into resolved_conversation_id
  from public.conversations conversation
  where conversation.booking_id = booking_row.id
    and conversation.conversation_kind = 'booking'
  order by conversation.created_at, conversation.id
  limit 1;
  if resolved_conversation_id is null then
    insert into public.conversations (event_id, booking_id, title, conversation_kind)
    values (
      booking_row.event_id,
      booking_row.id,
      format('%s: %s', booking_row.event_name, booking_row.service_name),
      'booking'
    ) returning id into resolved_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (resolved_conversation_id, booking_row.client_id),
    (resolved_conversation_id, booking_row.provider_user_id)
  on conflict (conversation_id, user_id) do nothing;
  return resolved_conversation_id;
end;
$$;

create or replace function public.ensure_coordinator_provider_conversation(target_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row record;
  resolved_conversation_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('multivent-coordinator-provider-conversation:' || target_booking_id::text));
  select booking.id, booking.event_id, booking.status,
    provider.user_id as provider_user_id,
    event.coordinator_id as coordinator_user_id,
    event.coordinator_assignment_status,
    event.status as event_status,
    coalesce(nullif(event.name, ''), 'Event') as event_name,
    coalesce(nullif(service.name, ''), 'Service booking') as service_name
  into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  join public.events event on event.id = booking.event_id
  join public.services service on service.id = booking.service_id
  where booking.id = target_booking_id
  for update of booking;

  if booking_row.id is null
    or booking_row.status::text not in ('confirmed', 'completed')
    or booking_row.event_status = 'cancelled'
    or booking_row.coordinator_assignment_status <> 'accepted'
    or booking_row.coordinator_user_id is null then
    return null;
  end if;

  select conversation.id into resolved_conversation_id
  from public.conversations conversation
  where conversation.booking_id = booking_row.id
    and conversation.conversation_kind = 'coordinator_provider'
  limit 1;
  if resolved_conversation_id is null then
    insert into public.conversations (event_id, booking_id, title, conversation_kind)
    values (
      booking_row.event_id,
      booking_row.id,
      format('%s: Coordinator and %s provider', booking_row.event_name, booking_row.service_name),
      'coordinator_provider'
    ) returning id into resolved_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (resolved_conversation_id, booking_row.coordinator_user_id),
    (resolved_conversation_id, booking_row.provider_user_id)
  on conflict (conversation_id, user_id) do nothing;
  return resolved_conversation_id;
end;
$$;

create or replace function public.sync_booking_conversation_after_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text in ('confirmed', 'completed') then
    perform public.ensure_booking_conversation(new.id);
    perform public.ensure_coordinator_provider_conversation(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.sync_event_coordinator_booking_conversations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare booking_row record;
begin
  if new.coordinator_id is not null and new.coordinator_assignment_status = 'accepted' then
    for booking_row in
      select booking.id from public.bookings booking
      where booking.event_id = new.id
        and booking.status::text in ('confirmed', 'completed')
    loop
      perform public.ensure_coordinator_provider_conversation(booking_row.id);
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.open_coordinator_provider_conversation(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare resolved_conversation_id uuid;
begin
  if not public.is_valid_coordinator_provider_message_member(target_booking_id, true) then
    raise exception 'Coordinator-provider messaging requires an accepted event assignment and confirmed provider booking.' using errcode = '42501';
  end if;
  resolved_conversation_id := public.ensure_coordinator_provider_conversation(target_booking_id);
  if resolved_conversation_id is null
    or not public.can_view_booking_conversation(resolved_conversation_id) then
    raise exception 'This coordinator-provider conversation is not available to your account.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'conversation_id', resolved_conversation_id,
    'booking_id', target_booking_id,
    'conversation_kind', 'coordinator_provider'
  );
end;
$$;

create or replace function public.notify_booking_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare recipient record;
begin
  for recipient in
    select distinct participant.user_id
    from public.conversation_participants participant
    join public.conversations conversation on conversation.id = participant.conversation_id
    left join public.bookings booking on booking.id = conversation.booking_id
    left join public.provider_profiles provider on provider.id = booking.provider_id
    join public.events event on event.id = conversation.event_id
    where participant.conversation_id = new.conversation_id
      and participant.user_id <> new.sender_id
      and (
        (conversation.conversation_kind = 'event_coordinator'
          and event.coordinator_assignment_status = 'accepted'
          and participant.user_id in (event.client_id, event.coordinator_id))
        or (conversation.conversation_kind = 'coordinator_provider'
          and booking.status::text in ('confirmed', 'completed')
          and event.coordinator_assignment_status = 'accepted'
          and participant.user_id in (provider.user_id, event.coordinator_id))
        or (conversation.conversation_kind = 'booking'
          and participant.user_id in (booking.client_id, provider.user_id))
      )
  loop
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (recipient.user_id, 'New message', left(new.body, 180), 'message', new.conversation_id);
  end loop;
  return new;
end;
$$;

revoke all on function public.is_valid_client_provider_message_member(uuid, boolean) from public;
revoke all on function public.is_valid_coordinator_provider_message_member(uuid, boolean) from public;
revoke all on function public.ensure_coordinator_provider_conversation(uuid) from public;
revoke all on function public.open_coordinator_provider_conversation(uuid) from public;
grant execute on function public.open_coordinator_provider_conversation(uuid) to authenticated;

comment on function public.open_coordinator_provider_conversation(uuid) is
  'Opens one direct coordinator-provider thread for an accepted event assignment and confirmed provider booking.';

commit;
