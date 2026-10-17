-- Canonical database-script counterpart of the Phase 1 Supabase migration.
-- Apply after 70_booking_restricted_messaging.sql.

begin;

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
      join public.provider_profiles provider on provider.id = booking.provider_id
      join public.events event on event.id = booking.event_id
      where booking.id = target_booking_id
        and (not require_active_booking or booking.status::text in ('confirmed', 'completed'))
        and (
          booking.client_id = auth.uid()
          or provider.user_id = auth.uid()
          or (event.coordinator_id = auth.uid() and event.coordinator_assignment_status = 'accepted')
        )
    );
$$;

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
    provider.user_id as provider_user_id, event.coordinator_id as coordinator_user_id,
    event.coordinator_assignment_status, coalesce(nullif(event.name, ''), 'Event') as event_name,
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
  order by conversation.created_at, conversation.id
  limit 1;

  if resolved_conversation_id is null then
    insert into public.conversations (event_id, booking_id, title)
    values (booking_row.event_id, booking_row.id, format('%s: %s', booking_row.event_name, booking_row.service_name))
    returning id into resolved_conversation_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  select resolved_conversation_id, participant.user_id
  from unnest(array[
    booking_row.client_id,
    booking_row.provider_user_id,
    case when booking_row.coordinator_assignment_status = 'accepted' then booking_row.coordinator_user_id else null end
  ]) as participant(user_id)
  where participant.user_id is not null
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
declare
  booking_row record;
begin
  if new.coordinator_id is not null and new.coordinator_assignment_status = 'accepted' then
    for booking_row in
      select booking.id from public.bookings booking
      where booking.event_id = new.id
        and booking.status::text in ('confirmed', 'completed')
    loop
      perform public.ensure_booking_conversation(booking_row.id);
    end loop;
  end if;
  return new;
end;
$$;

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
    raise exception 'Messaging is available only after the provider confirms the booking.' using errcode = '42501';
  end if;
  resolved_conversation_id := public.ensure_booking_conversation(target_booking_id);
  if resolved_conversation_id is null or not public.can_view_booking_conversation(resolved_conversation_id) then
    raise exception 'This booking conversation is not available to your account.' using errcode = '42501';
  end if;
  return jsonb_build_object('conversation_id', resolved_conversation_id, 'booking_id', target_booking_id);
end;
$$;

revoke all on function public.is_valid_booking_message_member(uuid, boolean) from public;
revoke all on function public.ensure_booking_conversation(uuid) from public;
revoke all on function public.sync_booking_conversation_after_booking_change() from public;
revoke all on function public.sync_event_coordinator_booking_conversations() from public;
revoke all on function public.open_booking_conversation(uuid) from public;
grant execute on function public.open_booking_conversation(uuid) to authenticated;

comment on function public.open_booking_conversation(uuid) is
  'Creates or returns the single server-managed conversation after provider confirmation.';
comment on function public.send_booking_message(uuid, text) is
  'Sends a message only for a confirmed or completed booking. Historical conversations remain readable.';

commit;
