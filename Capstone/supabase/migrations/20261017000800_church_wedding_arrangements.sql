-- Phase 5: church-wedding coordination records and the exact event-coordinator
-- conversation. This records coordination details only; it never reserves a
-- church, creates a marketplace listing, or creates a payment obligation.

begin;

create table if not exists public.event_church_arrangements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  preferred_church text,
  church_name text,
  church_address text,
  church_contact text,
  ceremony_date date,
  ceremony_time time,
  notes text,
  arrangement_status text not null default 'not_started'
    check (arrangement_status in (
      'not_started', 'looking_for_church', 'proposed',
      'awaiting_client_confirmation', 'confirmed'
    )),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.event_church_arrangements is
  'Coordinator-recorded church coordination details. A confirmed status is not a church reservation or payment confirmation.';

alter table public.event_church_arrangements enable row level security;

drop policy if exists "Church arrangement members can view" on public.event_church_arrangements;
create policy "Church arrangement members can view"
  on public.event_church_arrangements for select to authenticated
  using (
    exists (
      select 1 from public.events event
      where event.id = event_church_arrangements.event_id
        and event.is_church_wedding
        and event.status <> 'cancelled'
        and (
          event.client_id = auth.uid()
          or (event.coordinator_id = auth.uid() and event.coordinator_assignment_status = 'accepted')
        )
    )
  );

-- All writes are through the coordinator-authorized RPC below.
revoke insert, update, delete on table public.event_church_arrangements from public, anon, authenticated;
grant select on table public.event_church_arrangements to authenticated;

create or replace function public.get_my_church_wedding_arrangements()
returns table (
  event_id uuid,
  preferred_church text,
  church_name text,
  church_address text,
  church_contact text,
  ceremony_date date,
  ceremony_time time,
  notes text,
  arrangement_status text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.id,
    arrangement.preferred_church,
    arrangement.church_name,
    arrangement.church_address,
    arrangement.church_contact,
    arrangement.ceremony_date,
    arrangement.ceremony_time,
    arrangement.notes,
    coalesce(arrangement.arrangement_status, 'not_started'),
    arrangement.updated_at
  from public.events event
  left join public.event_church_arrangements arrangement on arrangement.event_id = event.id
  where auth.uid() is not null
    and event.is_church_wedding
    and event.status <> 'cancelled'
    and (
      event.client_id = auth.uid()
      or (event.coordinator_id = auth.uid() and event.coordinator_assignment_status = 'accepted')
    );
$$;

create or replace function public.save_my_church_wedding_arrangement(
  target_event_id uuid,
  target_preferred_church text,
  target_church_name text,
  target_church_address text,
  target_church_contact text,
  target_ceremony_date date,
  target_ceremony_time time,
  target_notes text,
  target_arrangement_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
  normalized_status text := lower(btrim(coalesce(target_arrangement_status, 'not_started')));
  arrangement_row public.event_church_arrangements%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if normalized_status not in ('not_started', 'looking_for_church', 'proposed', 'awaiting_client_confirmation', 'confirmed') then
    raise exception 'Choose a valid church arrangement status.' using errcode = '22023';
  end if;
  if char_length(coalesce(target_preferred_church, '')) > 200
    or char_length(coalesce(target_church_name, '')) > 200
    or char_length(coalesce(target_church_address, '')) > 500
    or char_length(coalesce(target_church_contact, '')) > 200
    or char_length(coalesce(target_notes, '')) > 2000 then
    raise exception 'One or more church arrangement fields are too long.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:' || target_event_id::text));
  select event.id, event.status, event.is_church_wedding, event.coordinator_id, event.coordinator_assignment_status
    into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null
    or not event_row.is_church_wedding
    or event_row.status = 'cancelled'
    or event_row.coordinator_id is distinct from auth.uid()
    or event_row.coordinator_assignment_status <> 'accepted' then
    raise exception 'Only the accepted coordinator for an active church wedding can update this arrangement.' using errcode = '42501';
  end if;

  insert into public.event_church_arrangements (
    event_id, preferred_church, church_name, church_address, church_contact,
    ceremony_date, ceremony_time, notes, arrangement_status, created_by, updated_by, updated_at
  ) values (
    target_event_id,
    nullif(btrim(coalesce(target_preferred_church, '')), ''),
    nullif(btrim(coalesce(target_church_name, '')), ''),
    nullif(btrim(coalesce(target_church_address, '')), ''),
    nullif(btrim(coalesce(target_church_contact, '')), ''),
    target_ceremony_date,
    target_ceremony_time,
    nullif(btrim(coalesce(target_notes, '')), ''),
    normalized_status,
    auth.uid(), auth.uid(), now()
  )
  on conflict (event_id) do update set
    preferred_church = excluded.preferred_church,
    church_name = excluded.church_name,
    church_address = excluded.church_address,
    church_contact = excluded.church_contact,
    ceremony_date = excluded.ceremony_date,
    ceremony_time = excluded.ceremony_time,
    notes = excluded.notes,
    arrangement_status = excluded.arrangement_status,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into arrangement_row;

  return jsonb_build_object('event_id', arrangement_row.event_id, 'arrangement_status', arrangement_row.arrangement_status, 'updated_at', arrangement_row.updated_at);
end;
$$;

-- This is intentionally an exact event-level conversation between the client
-- and accepted coordinator, not a church or provider marketplace conversation.
alter table public.conversations
  add column if not exists conversation_kind text not null default 'booking';
create unique index if not exists conversations_event_coordinator_unique
  on public.conversations(event_id)
  where conversation_kind = 'event_coordinator';

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
        and event.is_church_wedding
        and event.status <> 'cancelled'
        and event.coordinator_assignment_status = 'accepted'
        and event.coordinator_id is not null
        and auth.uid() in (event.client_id, event.coordinator_id)
    );
$$;

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
        (conversation.booking_id is not null and public.is_valid_booking_message_member(conversation.booking_id, false))
        or (conversation.conversation_kind = 'event_coordinator'
            and conversation.event_id is not null
            and public.is_valid_event_coordinator_message_member(conversation.event_id, false))
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
        (conversation.booking_id is not null and public.is_valid_booking_message_member(conversation.booking_id, true))
        or (conversation.conversation_kind = 'event_coordinator'
            and conversation.event_id is not null
            and public.is_valid_event_coordinator_message_member(conversation.event_id, true))
      )
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
    and event.is_church_wedding
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

create or replace function public.open_event_coordinator_conversation(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare resolved_conversation_id uuid;
begin
  if not public.is_valid_event_coordinator_message_member(target_event_id, true) then
    raise exception 'This event coordinator conversation is not available to your account.' using errcode = '42501';
  end if;
  resolved_conversation_id := public.ensure_event_coordinator_conversation(target_event_id);
  if resolved_conversation_id is null or not public.can_view_booking_conversation(resolved_conversation_id) then
    raise exception 'This event coordinator conversation is not available to your account.' using errcode = '42501';
  end if;
  return jsonb_build_object('conversation_id', resolved_conversation_id, 'event_id', target_event_id);
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
          and event.is_church_wedding
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

revoke all on function public.get_my_church_wedding_arrangements() from public;
revoke all on function public.save_my_church_wedding_arrangement(uuid, text, text, text, text, date, time, text, text) from public;
revoke all on function public.is_valid_event_coordinator_message_member(uuid, boolean) from public;
revoke all on function public.ensure_event_coordinator_conversation(uuid) from public;
revoke all on function public.open_event_coordinator_conversation(uuid) from public;
grant execute on function public.get_my_church_wedding_arrangements() to authenticated;
grant execute on function public.save_my_church_wedding_arrangement(uuid, text, text, text, text, date, time, text, text) to authenticated;
grant execute on function public.open_event_coordinator_conversation(uuid) to authenticated;

commit;
