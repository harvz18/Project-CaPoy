-- Phase 6: event-based direct messaging. This deliberately keeps every
-- conversation one-to-one in intent: a client and provider share a confirmed
-- booking conversation, while the client and accepted event coordinator use a
-- separate event-level conversation. It does not create group chat access.

begin;

create or replace function public.is_valid_event_coordinator_message_member(
  target_event_id uuid,
  require_active_event boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.events event
      where event.id = target_event_id
        and event.status <> 'cancelled'
        and event.coordinator_assignment_status = 'accepted'
        and event.coordinator_id is not null
        and auth.uid() in (event.client_id, event.coordinator_id)
    );
$$;

create or replace function public.ensure_event_coordinator_conversation(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
  resolved_conversation_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('multivent-event-coordinator-conversation:' || target_event_id::text));
  select event.id, event.client_id, event.coordinator_id, coalesce(nullif(event.name, ''), 'Event') as name
    into event_row
  from public.events event
  where event.id = target_event_id
    and event.status <> 'cancelled'
    and event.coordinator_assignment_status = 'accepted'
    and event.coordinator_id is not null
  for update;
  if event_row.id is null then return null; end if;

  select conversation.id into resolved_conversation_id
  from public.conversations conversation
  where conversation.event_id = target_event_id and conversation.conversation_kind = 'event_coordinator'
  limit 1;
  if resolved_conversation_id is null then
    insert into public.conversations (event_id, title, conversation_kind)
    values (target_event_id, format('%s: Event coordinator', event_row.name), 'event_coordinator')
    returning id into resolved_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (resolved_conversation_id, event_row.client_id), (resolved_conversation_id, event_row.coordinator_id)
  on conflict (conversation_id, user_id) do nothing;
  return resolved_conversation_id;
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
        or (conversation.conversation_kind <> 'event_coordinator'
          and (participant.user_id = booking.client_id
            or participant.user_id = provider.user_id
            or (participant.user_id = event.coordinator_id and event.coordinator_assignment_status = 'accepted')))
      )
  loop
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (recipient.user_id, 'New message', left(new.body, 180), 'message', new.conversation_id);
  end loop;
  return new;
end;
$$;

revoke all on function public.is_valid_event_coordinator_message_member(uuid, boolean) from public;
revoke all on function public.ensure_event_coordinator_conversation(uuid) from public;
grant execute on function public.open_event_coordinator_conversation(uuid) to authenticated;

commit;
