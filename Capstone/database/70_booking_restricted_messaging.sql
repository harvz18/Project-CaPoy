-- Phase 6: booking-authorized conversations, secure message writes, and realtime.
--
-- Conversations remain tied to the existing conversation tables.  A message
-- relationship is created only from a submitted booking, and closed bookings
-- retain readable history while rejecting new messages.

begin;

create index if not exists conversations_booking_created_idx
  on public.conversations (booking_id, created_at)
  where booking_id is not null;

create index if not exists messages_conversation_unread_created_idx
  on public.messages (conversation_id, created_at desc)
  where read_at is null;

-- This is the authorization source of truth for all message operations. A
-- coordinator is eligible only after accepting the coordinator assignment for
-- the same event; viewing a service, a draft, or a package is not sufficient.
create or replace function public.is_valid_booking_message_member(
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
      join public.provider_profiles provider
        on provider.id = booking.provider_id
      join public.events event
        on event.id = booking.event_id
      where booking.id = target_booking_id
        and (
          not require_active_booking
          or booking.status::text in (
            'requested',
            'approved',
            'payment_required',
            'paid',
            'confirmed',
            'completed'
          )
        )
        and (
          booking.client_id = auth.uid()
          or provider.user_id = auth.uid()
          or (
            event.coordinator_id = auth.uid()
            and event.coordinator_assignment_status = 'accepted'
          )
        )
    );
$$;

create or replace function public.can_view_booking_conversation(
  target_conversation_id uuid
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
      from public.conversations conversation
      join public.conversation_participants participant
        on participant.conversation_id = conversation.id
       and participant.user_id = auth.uid()
      where conversation.id = target_conversation_id
        and conversation.booking_id is not null
        and public.is_valid_booking_message_member(conversation.booking_id, false)
    );
$$;

create or replace function public.can_send_booking_message(
  target_conversation_id uuid
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
      from public.conversations conversation
      join public.conversation_participants participant
        on participant.conversation_id = conversation.id
       and participant.user_id = auth.uid()
      where conversation.id = target_conversation_id
        and conversation.booking_id is not null
        and public.is_valid_booking_message_member(conversation.booking_id, true)
    );
$$;

-- Keep the public helper used by legacy policies, but narrow it to the same
-- booking relationship check instead of trusting a forged participant row.
create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_booking_conversation(target_conversation_id);
$$;

-- Creates at most one usable conversation per booking moving forward. The
-- advisory lock prevents concurrent request submission from creating a second
-- conversation without deleting or rewriting historical rows.
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

  select
    booking.id,
    booking.event_id,
    booking.client_id,
    booking.status,
    provider.user_id as provider_user_id,
    event.coordinator_id as coordinator_user_id,
    event.coordinator_assignment_status,
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
    or booking_row.status::text not in (
      'requested',
      'approved',
      'payment_required',
      'paid',
      'confirmed',
      'completed'
    )
  then
    return null;
  end if;

  select conversation.id
  into resolved_conversation_id
  from public.conversations conversation
  where conversation.booking_id = booking_row.id
  order by conversation.created_at, conversation.id
  limit 1;

  if resolved_conversation_id is null then
    insert into public.conversations (event_id, booking_id, title)
    values (
      booking_row.event_id,
      booking_row.id,
      format('%s: %s', booking_row.event_name, booking_row.service_name)
    )
    returning id into resolved_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  select resolved_conversation_id, participant.user_id
  from unnest(array[
    booking_row.client_id,
    booking_row.provider_user_id,
    case
      when booking_row.coordinator_assignment_status = 'accepted'
        then booking_row.coordinator_user_id
      else null
    end
  ]) as participant(user_id)
  where participant.user_id is not null
  on conflict (conversation_id, user_id) do nothing;

  return resolved_conversation_id;
end;
$$;

-- Submitted booking requests create the conversation on the server, including
-- for older clients that do not yet call open_booking_conversation().
create or replace function public.sync_booking_conversation_after_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text in (
    'requested',
    'approved',
    'payment_required',
    'paid',
    'confirmed',
    'completed'
  ) then
    perform public.ensure_booking_conversation(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_booking_conversation_after_booking_change_trigger
  on public.bookings;
create trigger sync_booking_conversation_after_booking_change_trigger
after insert or update of status, event_id, client_id, provider_id, service_id on public.bookings
for each row execute function public.sync_booking_conversation_after_booking_change();

-- An accepted coordinator becomes a participant only for active bookings on
-- that event. Removing an assignment never deletes messages; access is
-- evaluated again at read/send time by the functions above.
create or replace function public.sync_event_coordinator_booking_conversations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row record;
begin
  if new.coordinator_id is not null
    and new.coordinator_assignment_status = 'accepted'
  then
    for booking_row in
      select booking.id
      from public.bookings booking
      where booking.event_id = new.id
        and booking.status::text in (
          'requested',
          'approved',
          'payment_required',
          'paid',
          'confirmed',
          'completed'
        )
    loop
      perform public.ensure_booking_conversation(booking_row.id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_event_coordinator_booking_conversations_trigger
  on public.events;
create trigger sync_event_coordinator_booking_conversations_trigger
after update of coordinator_id, coordinator_assignment_status on public.events
for each row execute function public.sync_event_coordinator_booking_conversations();

create or replace function public.open_booking_conversation(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.is_valid_booking_message_member(target_booking_id, true) then
    raise exception 'Messaging is available only to active booking participants.' using errcode = '42501';
  end if;

  resolved_conversation_id := public.ensure_booking_conversation(target_booking_id);

  if resolved_conversation_id is null
    or not public.can_view_booking_conversation(resolved_conversation_id)
  then
    raise exception 'This booking conversation is not available to your account.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'conversation_id', resolved_conversation_id,
    'booking_id', target_booking_id
  );
end;
$$;

-- Preserve the existing coordinator RPC name while routing it through the
-- shared booking relationship authorization.
create or replace function public.open_coordinator_provider_conversation(target_booking_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.open_booking_conversation(target_booking_id);
$$;

create or replace function public.send_booking_message(
  target_conversation_id uuid,
  message_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_body text := btrim(coalesce(message_body, ''));
  message_row record;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if char_length(normalized_body) = 0 or char_length(normalized_body) > 2000 then
    raise exception 'Messages must contain between 1 and 2,000 characters.' using errcode = '22023';
  end if;

  if not public.can_send_booking_message(target_conversation_id) then
    raise exception 'This conversation is read-only because the booking is no longer active.' using errcode = '42501';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (target_conversation_id, auth.uid(), normalized_body)
  returning id, body, created_at into message_row;

  return jsonb_build_object(
    'id', message_row.id,
    'body', message_row.body,
    'created_at', message_row.created_at
  );
end;
$$;

-- Reading history remains available after cancellation or rejection. This is
-- the only benign state update allowed on a closed conversation.
create or replace function public.mark_booking_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if not public.can_view_booking_conversation(target_conversation_id) then
    raise exception 'This conversation is not available to your account.' using errcode = '42501';
  end if;

  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = target_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.touch_booking_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

create or replace function public.notify_booking_message_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient record;
begin
  for recipient in
    select distinct participant.user_id
    from public.conversation_participants participant
    join public.conversations conversation
      on conversation.id = participant.conversation_id
    join public.bookings booking
      on booking.id = conversation.booking_id
    join public.provider_profiles provider
      on provider.id = booking.provider_id
    join public.events event
      on event.id = booking.event_id
    where participant.conversation_id = new.conversation_id
      and participant.user_id <> new.sender_id
      and (
        participant.user_id = booking.client_id
        or participant.user_id = provider.user_id
        or (
          participant.user_id = event.coordinator_id
          and event.coordinator_assignment_status = 'accepted'
        )
      )
  loop
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      recipient.user_id,
      'New message',
      left(new.body, 180),
      'message',
      new.conversation_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists touch_booking_conversation_after_message_trigger on public.messages;
create trigger touch_booking_conversation_after_message_trigger
after insert on public.messages
for each row execute function public.touch_booking_conversation_after_message();

drop trigger if exists notify_booking_message_recipients_trigger on public.messages;
create trigger notify_booking_message_recipients_trigger
after insert on public.messages
for each row execute function public.notify_booking_message_recipients();

-- Membership alone is no longer authorization. These policies also keep the
-- current client, provider, and accepted coordinator from reading a forged
-- conversation through direct REST or Realtime calls.
drop policy if exists "Booking participants can view conversations" on public.conversations;
drop policy if exists "Booking participants can create conversations" on public.conversations;
drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Booking-authorized users view conversations"
  on public.conversations for select to authenticated
  using (public.can_view_booking_conversation(id));

drop policy if exists "Participants can view conversation memberships" on public.conversation_participants;
drop policy if exists "Booking participants can create conversation memberships" on public.conversation_participants;
create policy "Booking-authorized users view conversation memberships"
  on public.conversation_participants for select to authenticated
  using (public.can_view_booking_conversation(conversation_id));

drop policy if exists "Participants can read messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;
drop policy if exists "Participants can mark received messages read" on public.messages;
create policy "Booking-authorized users read messages"
  on public.messages for select to authenticated
  using (public.can_view_booking_conversation(conversation_id));

-- RPCs above are the only writable interface. This prevents caller-supplied
-- participant rows, sender IDs, body edits, and direct notification forgery.
revoke insert, update, delete on table public.conversations,
  public.conversation_participants,
  public.messages from public, anon, authenticated;
grant select on table public.conversations,
  public.conversation_participants,
  public.messages to authenticated;

drop policy if exists "Booking participants can create notifications" on public.notifications;
create policy "Booking participants can create non-message notifications"
  on public.notifications for insert to authenticated
  with check (
    resource_type <> 'message'
    and public.can_create_participant_notification(user_id, resource_type, resource_id)
  );

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

revoke all on function public.is_valid_booking_message_member(uuid, boolean) from public;
revoke all on function public.can_view_booking_conversation(uuid) from public;
revoke all on function public.can_send_booking_message(uuid) from public;
revoke all on function public.ensure_booking_conversation(uuid) from public;
revoke all on function public.sync_booking_conversation_after_booking_change() from public;
revoke all on function public.sync_event_coordinator_booking_conversations() from public;
revoke all on function public.touch_booking_conversation_after_message() from public;
revoke all on function public.notify_booking_message_recipients() from public;
revoke all on function public.open_booking_conversation(uuid) from public;
revoke all on function public.open_coordinator_provider_conversation(uuid) from public;
revoke all on function public.send_booking_message(uuid, text) from public;
revoke all on function public.mark_booking_conversation_read(uuid) from public;

grant execute on function public.open_booking_conversation(uuid) to authenticated;
grant execute on function public.open_coordinator_provider_conversation(uuid) to authenticated;
grant execute on function public.send_booking_message(uuid, text) to authenticated;
grant execute on function public.mark_booking_conversation_read(uuid) to authenticated;

comment on function public.open_booking_conversation(uuid) is
  'Creates or returns the single server-managed conversation for an active booking participant.';
comment on function public.send_booking_message(uuid, text) is
  'Sends a message only for a submitted, active booking. Rejected, cancelled, and expired conversations are read-only.';
comment on function public.mark_booking_conversation_read(uuid) is
  'Records read receipts for an authorized booking conversation, including closed conversation history.';

commit;
