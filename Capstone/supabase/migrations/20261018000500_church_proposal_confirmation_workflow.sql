-- V7 Phase 1: preserve church proposal history, let the event client respond,
-- and let the accepted coordinator document an arrangement confirmation.
-- A coordinator confirmation is coordination evidence only; it never verifies
-- that an external church accepted a reservation.

begin;

alter table public.event_church_arrangements
  drop constraint if exists event_church_arrangements_arrangement_status_check;

alter table public.event_church_arrangements
  add constraint event_church_arrangements_arrangement_status_check
  check (arrangement_status in (
    'not_started', 'looking_for_church', 'proposed',
    'awaiting_client_confirmation', 'declined', 'client_approved',
    'coordinator_confirmed', 'confirmed'
  ));

alter table public.event_church_arrangements
  add column if not exists proposal_version integer not null default 0,
  add column if not exists client_response_status text not null default 'not_requested',
  add column if not exists client_response_reason text,
  add column if not exists client_responded_at timestamptz,
  add column if not exists client_responded_by uuid references public.profiles(id),
  add column if not exists coordinator_confirmed_at timestamptz,
  add column if not exists coordinator_confirmed_by uuid references public.profiles(id),
  add column if not exists confirmation_method text,
  add column if not exists confirmation_notes text;

alter table public.event_church_arrangements
  drop constraint if exists event_church_arrangements_client_response_status_check;
alter table public.event_church_arrangements
  add constraint event_church_arrangements_client_response_status_check
  check (client_response_status in ('not_requested', 'pending', 'approved', 'declined'));

alter table public.event_church_arrangements
  drop constraint if exists event_church_arrangements_confirmation_method_check;
alter table public.event_church_arrangements
  add constraint event_church_arrangements_confirmation_method_check
  check (confirmation_method is null or confirmation_method in (
    'external_discussion', 'multivent', 'other'
  ));

create table if not exists public.event_church_arrangement_proposals (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.event_church_arrangements(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  proposal_version integer not null check (proposal_version > 0),
  preferred_church text,
  church_name text not null,
  church_address text,
  church_contact text,
  ceremony_date date,
  ceremony_time time,
  notes text,
  proposed_by uuid not null references public.profiles(id),
  proposed_at timestamptz not null default now(),
  client_response_status text not null default 'pending'
    check (client_response_status in ('pending', 'approved', 'declined')),
  client_response_reason text,
  client_responded_at timestamptz,
  client_responded_by uuid references public.profiles(id),
  coordinator_confirmed_at timestamptz,
  coordinator_confirmed_by uuid references public.profiles(id),
  confirmation_method text check (confirmation_method is null or confirmation_method in (
    'external_discussion', 'multivent', 'other'
  )),
  confirmation_notes text,
  unique (event_id, proposal_version)
);

alter table public.event_church_arrangements
  add column if not exists active_proposal_id uuid
  references public.event_church_arrangement_proposals(id) on delete restrict;

create index if not exists church_arrangement_proposals_event_idx
  on public.event_church_arrangement_proposals (event_id, proposal_version desc);

alter table public.event_church_arrangement_proposals enable row level security;
drop policy if exists "Church proposal members can view" on public.event_church_arrangement_proposals;
create policy "Church proposal members can view"
  on public.event_church_arrangement_proposals for select to authenticated
  using (
    exists (
      select 1 from public.events event
      where event.id = event_church_arrangement_proposals.event_id
        and event.is_church_wedding
        and event.status <> 'cancelled'
        and (
          event.client_id = auth.uid()
          or (event.coordinator_id = auth.uid() and event.coordinator_assignment_status = 'accepted')
        )
    )
  );
revoke insert, update, delete on table public.event_church_arrangement_proposals
  from public, anon, authenticated;
grant select on table public.event_church_arrangement_proposals to authenticated;

-- Preserve current proposal-like records as version 1 before the new workflow
-- starts. Existing confirmed rows remain confirmed and are not reclassified.
insert into public.event_church_arrangement_proposals (
  arrangement_id, event_id, proposal_version, preferred_church, church_name,
  church_address, church_contact, ceremony_date, ceremony_time, notes,
  proposed_by, proposed_at, client_response_status
)
select
  arrangement.id, arrangement.event_id, 1, arrangement.preferred_church,
  arrangement.church_name, arrangement.church_address, arrangement.church_contact,
  arrangement.ceremony_date, arrangement.ceremony_time, arrangement.notes,
  arrangement.created_by, arrangement.created_at,
  case when arrangement.arrangement_status in ('proposed', 'awaiting_client_confirmation')
    then 'pending' else 'approved' end
from public.event_church_arrangements arrangement
where arrangement.church_name is not null
  and arrangement.arrangement_status in ('proposed', 'awaiting_client_confirmation', 'confirmed')
on conflict (event_id, proposal_version) do nothing;

update public.event_church_arrangements arrangement
set proposal_version = greatest(arrangement.proposal_version, 1),
    active_proposal_id = proposal.id,
    arrangement_status = case
      when arrangement.arrangement_status = 'proposed' then 'awaiting_client_confirmation'
      else arrangement.arrangement_status end,
    client_response_status = case
      when arrangement.arrangement_status in ('proposed', 'awaiting_client_confirmation') then 'pending'
      else arrangement.client_response_status end
from public.event_church_arrangement_proposals proposal
where proposal.arrangement_id = arrangement.id
  and proposal.proposal_version = 1
  and arrangement.active_proposal_id is null;

drop function if exists public.get_my_church_wedding_arrangements();
create function public.get_my_church_wedding_arrangements()
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
  proposal_version integer,
  active_proposal_id uuid,
  client_response_status text,
  client_response_reason text,
  client_responded_at timestamptz,
  coordinator_confirmed_at timestamptz,
  coordinator_confirmed_by uuid,
  confirmation_method text,
  confirmation_notes text,
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
    coalesce(arrangement.proposal_version, 0),
    arrangement.active_proposal_id,
    coalesce(arrangement.client_response_status, 'not_requested'),
    arrangement.client_response_reason,
    arrangement.client_responded_at,
    arrangement.coordinator_confirmed_at,
    arrangement.coordinator_confirmed_by,
    arrangement.confirmation_method,
    arrangement.confirmation_notes,
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
  preferred_value text := nullif(btrim(coalesce(target_preferred_church, '')), '');
  church_name_value text := nullif(btrim(coalesce(target_church_name, '')), '');
  church_address_value text := nullif(btrim(coalesce(target_church_address, '')), '');
  church_contact_value text := nullif(btrim(coalesce(target_church_contact, '')), '');
  notes_value text := nullif(btrim(coalesce(target_notes, '')), '');
  arrangement_row public.event_church_arrangements%rowtype;
  proposal_id uuid;
  next_version integer;
  is_new_proposal boolean := false;
  proposal_requested boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if normalized_status not in ('not_started', 'looking_for_church', 'proposed', 'awaiting_client_confirmation') then
    raise exception 'Use the dedicated confirmation action to confirm a church arrangement.' using errcode = '22023';
  end if;
  if char_length(coalesce(target_preferred_church, '')) > 200
    or char_length(coalesce(target_church_name, '')) > 200
    or char_length(coalesce(target_church_address, '')) > 500
    or char_length(coalesce(target_church_contact, '')) > 200
    or char_length(coalesce(target_notes, '')) > 2000 then
    raise exception 'One or more church arrangement fields are too long.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:' || target_event_id::text));
  select event.id, event.client_id, event.status, event.is_church_wedding,
    event.coordinator_id, event.coordinator_assignment_status, event.name
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

  select * into arrangement_row
  from public.event_church_arrangements arrangement
  where arrangement.event_id = target_event_id
  for update;

  proposal_requested := normalized_status in ('proposed', 'awaiting_client_confirmation');
  if proposal_requested and church_name_value is null then
    raise exception 'Enter the proposed church name before submitting the proposal.' using errcode = '22023';
  end if;
  if not proposal_requested
    and arrangement_row.id is not null
    and arrangement_row.arrangement_status not in ('not_started', 'looking_for_church') then
    raise exception 'Submit a revised proposal instead of replacing the current proposal state.' using errcode = '22023';
  end if;

  if arrangement_row.id is null then
    insert into public.event_church_arrangements (
      event_id, preferred_church, church_name, church_address, church_contact,
      ceremony_date, ceremony_time, notes, arrangement_status,
      client_response_status, created_by, updated_by, updated_at
    ) values (
      target_event_id, preferred_value, church_name_value, church_address_value,
      church_contact_value, target_ceremony_date, target_ceremony_time, notes_value,
      case when proposal_requested then 'awaiting_client_confirmation' else normalized_status end,
      case when proposal_requested then 'pending' else 'not_requested' end,
      auth.uid(), auth.uid(), now()
    ) returning * into arrangement_row;
    is_new_proposal := proposal_requested;
  else
    is_new_proposal := proposal_requested and (
      arrangement_row.active_proposal_id is null
      or arrangement_row.arrangement_status <> 'awaiting_client_confirmation'
      or arrangement_row.client_response_status <> 'pending'
      or arrangement_row.preferred_church is distinct from preferred_value
      or arrangement_row.church_name is distinct from church_name_value
      or arrangement_row.church_address is distinct from church_address_value
      or arrangement_row.church_contact is distinct from church_contact_value
      or arrangement_row.ceremony_date is distinct from target_ceremony_date
      or arrangement_row.ceremony_time is distinct from target_ceremony_time
      or arrangement_row.notes is distinct from notes_value
    );

    update public.event_church_arrangements
    set preferred_church = preferred_value,
        church_name = church_name_value,
        church_address = church_address_value,
        church_contact = church_contact_value,
        ceremony_date = target_ceremony_date,
        ceremony_time = target_ceremony_time,
        notes = notes_value,
        arrangement_status = case when proposal_requested then 'awaiting_client_confirmation' else normalized_status end,
        client_response_status = case when is_new_proposal then 'pending' else client_response_status end,
        client_response_reason = case when is_new_proposal then null else client_response_reason end,
        client_responded_at = case when is_new_proposal then null else client_responded_at end,
        client_responded_by = case when is_new_proposal then null else client_responded_by end,
        coordinator_confirmed_at = case when is_new_proposal then null else coordinator_confirmed_at end,
        coordinator_confirmed_by = case when is_new_proposal then null else coordinator_confirmed_by end,
        confirmation_method = case when is_new_proposal then null else confirmation_method end,
        confirmation_notes = case when is_new_proposal then null else confirmation_notes end,
        updated_by = auth.uid(),
        updated_at = now()
    where event_id = target_event_id
    returning * into arrangement_row;
  end if;

  if is_new_proposal then
    next_version := arrangement_row.proposal_version + 1;
    insert into public.event_church_arrangement_proposals (
      arrangement_id, event_id, proposal_version, preferred_church, church_name,
      church_address, church_contact, ceremony_date, ceremony_time, notes, proposed_by
    ) values (
      arrangement_row.id, target_event_id, next_version, preferred_value, church_name_value,
      church_address_value, church_contact_value, target_ceremony_date,
      target_ceremony_time, notes_value, auth.uid()
    ) returning id into proposal_id;

    update public.event_church_arrangements
    set proposal_version = next_version,
        active_proposal_id = proposal_id,
        arrangement_status = 'awaiting_client_confirmation',
        client_response_status = 'pending',
        updated_at = now()
    where id = arrangement_row.id
    returning * into arrangement_row;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Church proposal awaiting confirmation',
      format('Your coordinator proposed %s for %s. Review the arrangement in your event booking.', church_name_value, event_row.name),
      'event', target_event_id
    );
  end if;

  return jsonb_build_object(
    'event_id', arrangement_row.event_id,
    'arrangement_status', arrangement_row.arrangement_status,
    'client_response_status', arrangement_row.client_response_status,
    'proposal_version', arrangement_row.proposal_version,
    'proposal_created', is_new_proposal,
    'updated_at', arrangement_row.updated_at
  );
end;
$$;

create or replace function public.respond_my_church_wedding_proposal(
  target_event_id uuid,
  approve_proposal boolean,
  decline_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
  arrangement_row public.event_church_arrangements%rowtype;
  reason_value text := nullif(btrim(coalesce(decline_reason, '')), '');
  response_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not approve_proposal and reason_value is null then
    raise exception 'Enter a reason for declining this church proposal.' using errcode = '22023';
  end if;
  if char_length(coalesce(decline_reason, '')) > 1000 then
    raise exception 'The decline reason must be 1,000 characters or fewer.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:' || target_event_id::text));
  select event.id, event.client_id, event.coordinator_id, event.name
  into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.is_church_wedding
    and event.status <> 'cancelled'
  for update;
  if event_row.id is null then
    raise exception 'Only the event client can respond to this church proposal.' using errcode = '42501';
  end if;

  select * into arrangement_row
  from public.event_church_arrangements arrangement
  where arrangement.event_id = target_event_id
  for update;
  if arrangement_row.id is null
    or arrangement_row.active_proposal_id is null
    or arrangement_row.arrangement_status <> 'awaiting_client_confirmation'
    or arrangement_row.client_response_status <> 'pending' then
    raise exception 'This church proposal is no longer awaiting your response.' using errcode = '40001';
  end if;

  response_status := case when approve_proposal then 'approved' else 'declined' end;
  update public.event_church_arrangement_proposals
  set client_response_status = response_status,
      client_response_reason = case when approve_proposal then null else reason_value end,
      client_responded_at = now(),
      client_responded_by = auth.uid()
  where id = arrangement_row.active_proposal_id
    and client_response_status = 'pending';
  if not found then
    raise exception 'This church proposal is no longer awaiting your response.' using errcode = '40001';
  end if;

  update public.event_church_arrangements
  set arrangement_status = case when approve_proposal then 'client_approved' else 'declined' end,
      client_response_status = response_status,
      client_response_reason = case when approve_proposal then null else reason_value end,
      client_responded_at = now(),
      client_responded_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = arrangement_row.id
  returning * into arrangement_row;

  if event_row.coordinator_id is not null then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.coordinator_id,
      case when approve_proposal then 'Church proposal approved' else 'Church proposal declined' end,
      case when approve_proposal
        then format('The client accepted the proposed church arrangement for %s. This does not verify an external church reservation.', event_row.name)
        else format('The client declined the proposed church arrangement for %s. Reason: %s', event_row.name, reason_value)
      end,
      'event', target_event_id
    );
  end if;

  return jsonb_build_object(
    'event_id', target_event_id,
    'arrangement_status', arrangement_row.arrangement_status,
    'client_response_status', arrangement_row.client_response_status,
    'client_response_reason', arrangement_row.client_response_reason,
    'client_responded_at', arrangement_row.client_responded_at
  );
end;
$$;

create or replace function public.confirm_my_church_wedding_arrangement(
  target_event_id uuid,
  target_confirmation_method text,
  target_confirmation_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row record;
  arrangement_row public.event_church_arrangements%rowtype;
  method_value text := lower(btrim(coalesce(target_confirmation_method, '')));
  notes_value text := nullif(btrim(coalesce(target_confirmation_notes, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if method_value not in ('external_discussion', 'multivent', 'other') then
    raise exception 'Choose how the church arrangement was confirmed.' using errcode = '22023';
  end if;
  if char_length(coalesce(target_confirmation_notes, '')) > 1000 then
    raise exception 'Confirmation notes must be 1,000 characters or fewer.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:' || target_event_id::text));
  select event.id, event.client_id, event.status, event.is_church_wedding,
    event.coordinator_id, event.coordinator_assignment_status, event.name
  into event_row
  from public.events event
  where event.id = target_event_id
  for update;
  if event_row.id is null
    or not event_row.is_church_wedding
    or event_row.status = 'cancelled'
    or event_row.coordinator_id is distinct from auth.uid()
    or event_row.coordinator_assignment_status <> 'accepted' then
    raise exception 'Only the accepted coordinator can confirm this church arrangement.' using errcode = '42501';
  end if;

  select * into arrangement_row
  from public.event_church_arrangements arrangement
  where arrangement.event_id = target_event_id
  for update;
  if arrangement_row.id is null or arrangement_row.church_name is null then
    raise exception 'Submit a church proposal before confirming the arrangement.' using errcode = '22023';
  end if;
  if arrangement_row.arrangement_status = 'declined' then
    raise exception 'The client declined this proposal. Submit a revised proposal before confirming an arrangement.' using errcode = '22023';
  end if;
  if arrangement_row.arrangement_status = 'coordinator_confirmed' then
    return jsonb_build_object(
      'event_id', target_event_id,
      'arrangement_status', arrangement_row.arrangement_status,
      'client_response_status', arrangement_row.client_response_status,
      'already_confirmed', true,
      'coordinator_confirmed_at', arrangement_row.coordinator_confirmed_at
    );
  end if;

  update public.event_church_arrangements
  set arrangement_status = 'coordinator_confirmed',
      coordinator_confirmed_at = now(),
      coordinator_confirmed_by = auth.uid(),
      confirmation_method = method_value,
      confirmation_notes = notes_value,
      updated_by = auth.uid(),
      updated_at = now()
  where id = arrangement_row.id
  returning * into arrangement_row;

  if arrangement_row.active_proposal_id is not null then
    update public.event_church_arrangement_proposals
    set coordinator_confirmed_at = arrangement_row.coordinator_confirmed_at,
        coordinator_confirmed_by = auth.uid(),
        confirmation_method = method_value,
        confirmation_notes = notes_value
    where id = arrangement_row.active_proposal_id;
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Church arrangement marked confirmed',
    format('Your coordinator marked the church arrangement for %s as confirmed through coordination. This does not independently verify the church reservation.', event_row.name),
    'event', target_event_id
  );

  return jsonb_build_object(
    'event_id', target_event_id,
    'arrangement_status', arrangement_row.arrangement_status,
    'client_response_status', arrangement_row.client_response_status,
    'confirmation_method', arrangement_row.confirmation_method,
    'confirmation_notes', arrangement_row.confirmation_notes,
    'coordinator_confirmed_at', arrangement_row.coordinator_confirmed_at
  );
end;
$$;

revoke all on function public.get_my_church_wedding_arrangements() from public;
revoke all on function public.save_my_church_wedding_arrangement(uuid, text, text, text, text, date, time, text, text) from public;
revoke all on function public.respond_my_church_wedding_proposal(uuid, boolean, text) from public;
revoke all on function public.confirm_my_church_wedding_arrangement(uuid, text, text) from public;
grant execute on function public.get_my_church_wedding_arrangements() to authenticated;
grant execute on function public.save_my_church_wedding_arrangement(uuid, text, text, text, text, date, time, text, text) to authenticated;
grant execute on function public.respond_my_church_wedding_proposal(uuid, boolean, text) to authenticated;
grant execute on function public.confirm_my_church_wedding_arrangement(uuid, text, text) to authenticated;

comment on table public.event_church_arrangement_proposals is
  'Immutable proposal versions with client responses and coordinator confirmation evidence.';
comment on column public.event_church_arrangements.coordinator_confirmed_at is
  'Coordinator-documented arrangement confirmation; not verification of an external church reservation.';

commit;
