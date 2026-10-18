-- V7 Phase 3: optional church coordinates and schedule-safe church proposals.
-- Existing RPCs remain available so older clients keep working.

begin;

alter table public.event_church_arrangements
  add column if not exists church_latitude double precision,
  add column if not exists church_longitude double precision;

alter table public.event_church_arrangements
  drop constraint if exists event_church_arrangements_coordinates_check;
alter table public.event_church_arrangements
  add constraint event_church_arrangements_coordinates_check check (
    (church_latitude is null and church_longitude is null)
    or (
      church_latitude is not null and church_longitude is not null
      and church_latitude between -90 and 90
      and church_longitude between -180 and 180
    )
  );

alter table public.event_church_arrangement_proposals
  add column if not exists church_latitude double precision,
  add column if not exists church_longitude double precision;

alter table public.event_church_arrangement_proposals
  drop constraint if exists event_church_arrangement_proposals_coordinates_check;
alter table public.event_church_arrangement_proposals
  add constraint event_church_arrangement_proposals_coordinates_check check (
    (church_latitude is null and church_longitude is null)
    or (
      church_latitude is not null and church_longitude is not null
      and church_latitude between -90 and 90
      and church_longitude between -180 and 180
    )
  );

-- Keep the Phase 1 implementation as the proposal/workflow core. The original
-- public name is recreated below as a compatibility adapter for older clients.
alter function public.save_my_church_wedding_arrangement(
  uuid, text, text, text, text, date, time, text, text
) rename to save_my_church_wedding_arrangement_phase1_core;
revoke all on function public.save_my_church_wedding_arrangement_phase1_core(
  uuid, text, text, text, text, date, time, text, text
) from public, anon, authenticated;

create or replace function public.get_my_church_wedding_arrangements_v7()
returns table (
  event_id uuid,
  preferred_church text,
  church_name text,
  church_address text,
  church_contact text,
  church_latitude double precision,
  church_longitude double precision,
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
    arrangement.church_latitude,
    arrangement.church_longitude,
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

create or replace function public.save_my_church_wedding_arrangement_v7(
  target_event_id uuid,
  target_preferred_church text,
  target_church_name text,
  target_church_address text,
  target_church_contact text,
  target_church_latitude double precision,
  target_church_longitude double precision,
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
  saved_result jsonb;
  arrangement_before public.event_church_arrangements%rowtype;
  arrangement_after public.event_church_arrangements%rowtype;
  coordinates_changed boolean := false;
  next_version integer;
  proposal_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if (target_church_latitude is null) <> (target_church_longitude is null) then
    raise exception 'Church latitude and longitude must be saved together.' using errcode = '22023';
  end if;
  if target_church_latitude is not null and (
    target_church_latitude < -90 or target_church_latitude > 90
    or target_church_longitude < -180 or target_church_longitude > 180
  ) then
    raise exception 'Church coordinates are outside the valid range.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:' || target_event_id::text));
  select event.id, event.client_id, event.name, event.event_date, event.status,
    event.is_church_wedding, event.coordinator_id, event.coordinator_assignment_status
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
  if target_ceremony_date is not null
    and event_row.event_date is not null
    and target_ceremony_date <> event_row.event_date then
    raise exception 'The ceremony date must match the configured event date.' using errcode = '22023';
  end if;

  select * into arrangement_before
  from public.event_church_arrangements arrangement
  where arrangement.event_id = target_event_id
  for update;
  coordinates_changed := case
    when arrangement_before.id is null then target_church_latitude is not null
    else arrangement_before.church_latitude is distinct from target_church_latitude
      or arrangement_before.church_longitude is distinct from target_church_longitude
  end;

  select public.save_my_church_wedding_arrangement_phase1_core(
    target_event_id,
    target_preferred_church,
    target_church_name,
    target_church_address,
    target_church_contact,
    target_ceremony_date,
    target_ceremony_time,
    target_notes,
    target_arrangement_status
  ) into saved_result;

  update public.event_church_arrangements
  set church_latitude = target_church_latitude,
      church_longitude = target_church_longitude
  where event_id = target_event_id
  returning * into arrangement_after;

  if coalesce((saved_result ->> 'proposal_created')::boolean, false) then
    update public.event_church_arrangement_proposals
    set church_latitude = target_church_latitude,
        church_longitude = target_church_longitude
    where id = arrangement_after.active_proposal_id;
  elsif coordinates_changed
    and arrangement_after.active_proposal_id is not null
    and arrangement_after.arrangement_status = 'awaiting_client_confirmation'
    and arrangement_after.client_response_status = 'pending' then
    next_version := arrangement_after.proposal_version + 1;
    insert into public.event_church_arrangement_proposals (
      arrangement_id, event_id, proposal_version, preferred_church, church_name,
      church_address, church_contact, church_latitude, church_longitude,
      ceremony_date, ceremony_time, notes, proposed_by
    ) values (
      arrangement_after.id, target_event_id, next_version,
      arrangement_after.preferred_church, arrangement_after.church_name,
      arrangement_after.church_address, arrangement_after.church_contact,
      target_church_latitude, target_church_longitude, arrangement_after.ceremony_date,
      arrangement_after.ceremony_time, arrangement_after.notes, auth.uid()
    ) returning id into proposal_id;

    update public.event_church_arrangements
    set proposal_version = next_version,
        active_proposal_id = proposal_id,
        client_response_status = 'pending',
        client_response_reason = null,
        client_responded_at = null,
        client_responded_by = null,
        coordinator_confirmed_at = null,
        coordinator_confirmed_by = null,
        confirmation_method = null,
        confirmation_notes = null,
        updated_by = auth.uid(),
        updated_at = now()
    where id = arrangement_after.id
    returning * into arrangement_after;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Revised church proposal awaiting confirmation',
      format('Your coordinator updated the proposed church location for %s. Review the revised arrangement in your event booking.', event_row.name),
      'event', target_event_id
    );

    saved_result := saved_result || jsonb_build_object(
      'proposal_version', next_version,
      'proposal_created', true,
      'updated_at', arrangement_after.updated_at
    );
  end if;

  return saved_result || jsonb_build_object(
    'church_latitude', target_church_latitude,
    'church_longitude', target_church_longitude
  );
end;
$$;

-- Preserve the original RPC contract. Older clients keep the current pin when
-- saving fields that predate V7, while all authorization stays in the V7 path.
create function public.save_my_church_wedding_arrangement(
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
  existing_latitude double precision;
  existing_longitude double precision;
begin
  select arrangement.church_latitude, arrangement.church_longitude
  into existing_latitude, existing_longitude
  from public.event_church_arrangements arrangement
  where arrangement.event_id = target_event_id;

  return public.save_my_church_wedding_arrangement_v7(
    target_event_id,
    target_preferred_church,
    target_church_name,
    target_church_address,
    target_church_contact,
    existing_latitude,
    existing_longitude,
    target_ceremony_date,
    target_ceremony_time,
    target_notes,
    target_arrangement_status
  );
end;
$$;

revoke all on function public.get_my_church_wedding_arrangements_v7() from public;
revoke all on function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) from public;
grant execute on function public.get_my_church_wedding_arrangements_v7() to authenticated;
grant execute on function public.save_my_church_wedding_arrangement(
  uuid, text, text, text, text, date, time, text, text
) to authenticated;
grant execute on function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) to authenticated;

comment on column public.event_church_arrangements.church_latitude is
  'Optional coordinator-selected map coordinate. This does not verify a church or reservation.';
comment on column public.event_church_arrangements.church_longitude is
  'Optional coordinator-selected map coordinate. This does not verify a church or reservation.';

commit;
