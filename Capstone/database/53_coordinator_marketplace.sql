-- MULTIVENT Revision 2, Phase 1: coordinators are optional, paid service
-- providers selected by clients. Apply after 52_service_deletion_booking_history.sql.

begin;

create table if not exists public.coordinator_service_profiles (
  coordinator_id uuid primary key references public.profiles(id) on delete cascade,
  description text not null default '',
  coordination_fee numeric(12,2) not null default 0 check (coordination_fee >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  specializations text[] not null default '{}',
  is_accepting_bookings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coordinator_service_profiles_description_check
    check (char_length(description) <= 2000),
  constraint coordinator_service_profiles_specializations_check
    check (cardinality(specializations) <= 12)
);

alter table public.coordinator_service_profiles enable row level security;

drop policy if exists "Coordinators view own service profile"
  on public.coordinator_service_profiles;
create policy "Coordinators view own service profile"
  on public.coordinator_service_profiles for select to authenticated
  using (coordinator_id = auth.uid());

drop policy if exists "Coordinators update own service profile"
  on public.coordinator_service_profiles;
create policy "Coordinators update own service profile"
  on public.coordinator_service_profiles for update to authenticated
  using (coordinator_id = auth.uid())
  with check (coordinator_id = auth.uid());

grant select, update on public.coordinator_service_profiles to authenticated;

insert into public.coordinator_service_profiles (coordinator_id)
select profile.id
from public.profiles profile
where profile.default_role = 'event_coordinator'
   or exists (
     select 1
     from public.user_roles user_role
     join public.roles role on role.id = user_role.role_id
     where user_role.user_id = profile.id
       and role.name = 'event_coordinator'
   )
on conflict (coordinator_id) do nothing;

alter table public.events
  add column if not exists coordinator_preference text not null default 'undecided',
  add column if not exists coordinator_fee_amount numeric(12,2),
  add column if not exists coordinator_fee_currency text,
  add column if not exists coordinator_pricing_snapshot jsonb;

alter table public.events
  drop constraint if exists events_coordinator_preference_check,
  add constraint events_coordinator_preference_check
    check (coordinator_preference in ('undecided', 'skipped', 'selected')),
  drop constraint if exists events_coordinator_fee_amount_check,
  add constraint events_coordinator_fee_amount_check
    check (coordinator_fee_amount is null or coordinator_fee_amount >= 0),
  drop constraint if exists events_coordinator_fee_currency_check,
  add constraint events_coordinator_fee_currency_check
    check (coordinator_fee_currency is null or coordinator_fee_currency = 'PHP');

-- Preserve existing assignments. Existing events without a coordinator are
-- treated as having skipped the new optional step so no old journey is blocked.
update public.events
set coordinator_preference = case
  when coordinator_id is not null or pending_coordinator_id is not null then 'selected'
  else 'skipped'
end
where coordinator_preference = 'undecided'
  and created_at < now();

alter table public.coordinator_assignment_attempts
  drop constraint if exists coordinator_assignment_attempts_source_check;
alter table public.coordinator_assignment_attempts
  add constraint coordinator_assignment_attempts_source_check
  check (assignment_source in ('automatic', 'manual', 'legacy', 'client'));

-- Retire every automatic matching/rematching trigger. Historical records and
-- accepted assignments remain untouched.
drop trigger if exists assign_coordinator_when_booked_trigger on public.events;
drop trigger if exists mark_declined_coordinator_as_unassigned_trigger on public.events;
drop trigger if exists retry_waiting_events_after_availability_trigger on public.coordinator_availability;
drop trigger if exists reconcile_coordinator_unavailability_trigger on public.coordinator_availability;
drop trigger if exists reconcile_coordinator_account_status_trigger on public.profiles;

create or replace function public.auto_assign_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Automatic coordinator assignment has been retired. Clients must choose a coordinator.';
end;
$$;

create or replace function public.retry_event_coordinator_assignment(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Automatic coordinator reassignment has been retired. The client must choose another coordinator.';
end;
$$;

create or replace function public.staff_assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Staff coordinator assignment has been retired. Coordinators are selected by clients.';
end;
$$;

create or replace function public.get_my_coordinator_service_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  insert into public.coordinator_service_profiles (coordinator_id)
  select profile.id from public.profiles profile
  where profile.id = auth.uid()
    and profile.account_status = 'active'
    and (profile.default_role = 'event_coordinator' or exists (
      select 1 from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      where user_role.user_id = profile.id and role.name = 'event_coordinator'
    ))
  on conflict (coordinator_id) do nothing;

  select jsonb_build_object(
    'coordinator_id', service_profile.coordinator_id,
    'description', service_profile.description,
    'coordination_fee', service_profile.coordination_fee,
    'currency', service_profile.currency,
    'specializations', service_profile.specializations,
    'is_accepting_bookings', service_profile.is_accepting_bookings
  ) into result
  from public.coordinator_service_profiles service_profile
  where service_profile.coordinator_id = auth.uid();

  if result is null then
    raise exception 'An active Event Coordinator account is required.' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function public.save_my_coordinator_service_profile(
  target_description text,
  target_coordination_fee numeric,
  target_specializations text[],
  target_is_accepting_bookings boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare cleaned_specializations text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if coalesce(target_coordination_fee, 0) < 0 then
    raise exception 'Coordination fee cannot be negative.';
  end if;
  if coalesce(target_is_accepting_bookings, false) and coalesce(target_coordination_fee, 0) <= 0 then
    raise exception 'Set a coordination fee before accepting bookings.';
  end if;
  if char_length(coalesce(trim(target_description), '')) > 2000 then
    raise exception 'Description cannot exceed 2,000 characters.';
  end if;

  select coalesce(array_agg(value order by value), '{}') into cleaned_specializations
  from (
    select distinct trim(item) as value
    from unnest(coalesce(target_specializations, '{}')) item
    where trim(item) <> ''
    limit 12
  ) cleaned;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
      and (profile.default_role = 'event_coordinator' or exists (
        select 1 from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id and role.name = 'event_coordinator'
      ))
  ) then
    raise exception 'An active Event Coordinator account is required.' using errcode = '42501';
  end if;

  insert into public.coordinator_service_profiles (
    coordinator_id, description, coordination_fee, specializations,
    is_accepting_bookings, updated_at
  ) values (
    auth.uid(), coalesce(trim(target_description), ''),
    round(coalesce(target_coordination_fee, 0), 2), cleaned_specializations,
    coalesce(target_is_accepting_bookings, false), now()
  )
  on conflict (coordinator_id) do update set
    description = excluded.description,
    coordination_fee = excluded.coordination_fee,
    specializations = excluded.specializations,
    is_accepting_bookings = excluded.is_accepting_bookings,
    updated_at = now();

  return public.get_my_coordinator_service_profile();
end;
$$;

create or replace function public.list_bookable_event_coordinators(target_event_id uuid default null)
returns table (
  id uuid, full_name text, avatar_url text, description text,
  coordination_fee numeric, currency text, specializations text[],
  is_available boolean, unavailable_reason text
)
language sql
security definer
set search_path = ''
as $$
  with requested_event as (
    select event.*
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc
    limit 1
  ), requested_window as (
    select event.id as event_id, event_window.starts_at, event_window.ends_at
    from requested_event event
    cross join lateral public.coordinator_event_window(event) event_window
  )
  select profile.id, profile.full_name, profile.avatar_url,
    service_profile.description, service_profile.coordination_fee,
    service_profile.currency, service_profile.specializations,
    reason.value is null as is_available, reason.value as unavailable_reason
  from public.coordinator_service_profiles service_profile
  join public.profiles profile on profile.id = service_profile.coordinator_id
  left join requested_event event on true
  left join requested_window event_window on true
  left join lateral (
    select case
      when event.id is null then null
      when event_window.starts_at is null or event_window.ends_at is null then 'Complete the event date and time to check availability.'
      when exists (
        select 1 from public.coordinator_availability availability
        where availability.coordinator_id = profile.id
          and availability.status in ('unavailable', 'on_leave')
          and event_window.starts_at < availability.ends_at
          and event_window.ends_at > availability.starts_at
      ) then 'Unavailable for this event schedule.'
      when exists (
        select 1 from public.events conflict_event
        cross join lateral public.coordinator_event_window(conflict_event) conflict_window
        where conflict_event.id <> event.id
          and conflict_event.status not in ('completed', 'cancelled')
          and (conflict_event.coordinator_id = profile.id or conflict_event.pending_coordinator_id = profile.id)
          and event_window.starts_at < conflict_window.ends_at
          and event_window.ends_at > conflict_window.starts_at
      ) then 'Already requested or booked for an overlapping event.'
      else null
    end as value
  ) reason on true
  where auth.uid() is not null
    and profile.account_status = 'active'
    and (
      (service_profile.is_accepting_bookings and service_profile.coordination_fee > 0)
      or profile.id = event.coordinator_id
      or profile.id = event.pending_coordinator_id
    )
  order by reason.value nulls first, profile.full_name;
$$;

create or replace function public.set_event_coordinator_preference(
  target_event_id uuid,
  target_preference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_preference not in ('undecided', 'skipped') then
    raise exception 'Invalid coordinator preference.';
  end if;
  update public.events
  set coordinator_preference = target_preference, updated_at = now()
  where id = target_event_id and client_id = auth.uid()
    and status not in ('completed', 'cancelled');
  if not found then raise exception 'Event not found.' using errcode = '42501'; end if;
  return jsonb_build_object('event_id', target_event_id, 'coordinator_preference', target_preference);
end;
$$;

-- Keep the legacy RPC shape for older operations-console builds while
-- intentionally returning no staff-assignment queue.
create or replace function public.list_unassigned_events()
returns table (
  id uuid, name text, event_type text, event_date date, event_time time,
  venue text, location text, client_name text, assignment_note text,
  starts_at timestamptz, ends_at timestamptz, assignment_attempted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, event.name, event.event_type, event.event_date, event.event_time,
    event.venue, event.location, client.full_name, event.coordinator_assignment_note,
    null::timestamptz, null::timestamptz, event.coordinator_assignment_attempted_at
  from public.events event
  join public.profiles client on client.id = event.client_id
  where false;
$$;

create or replace function public.assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  coordinator_name text;
  fee numeric(12,2);
  fee_currency text;
  profile_description text;
  profile_specializations text[];
  event_start timestamptz;
  event_end timestamptz;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select profile.full_name, service_profile.coordination_fee,
    service_profile.currency, service_profile.description, service_profile.specializations
  into coordinator_name, fee, fee_currency, profile_description, profile_specializations
  from public.coordinator_service_profiles service_profile
  join public.profiles profile on profile.id = service_profile.coordinator_id
  where service_profile.coordinator_id = target_coordinator_id
    and service_profile.is_accepting_bookings
    and service_profile.coordination_fee > 0
    and profile.account_status = 'active';
  if coordinator_name is null then raise exception 'This coordinator is not accepting bookings.'; end if;

  select event_window.starts_at, event_window.ends_at into event_start, event_end
  from public.coordinator_event_window(event_row) event_window;
  if event_start is null or event_end is null then
    raise exception 'Complete the event date and time before requesting a coordinator.';
  end if;
  if exists (
    select 1 from public.coordinator_availability availability
    where availability.coordinator_id = target_coordinator_id
      and availability.status in ('unavailable', 'on_leave')
      and event_start < availability.ends_at and event_end > availability.starts_at
  ) or exists (
    select 1 from public.events conflict_event
    cross join lateral public.coordinator_event_window(conflict_event) conflict_window
    where conflict_event.id <> event_row.id
      and conflict_event.status not in ('completed', 'cancelled')
      and (conflict_event.coordinator_id = target_coordinator_id
        or conflict_event.pending_coordinator_id = target_coordinator_id)
      and event_start < conflict_window.ends_at and event_end > conflict_window.starts_at
  ) then raise exception 'This coordinator is unavailable for the event schedule.'; end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()), updated_at = now(),
      note = coalesce(note, 'Client selected another coordinator.')
  where event_id = event_row.id and status in ('invited', 'accepted');

  update public.events set
    coordinator_id = null,
    pending_coordinator_id = target_coordinator_id,
    coordinator_assignment_status = 'pending',
    coordinator_assignment_requested_at = now(),
    coordinator_assignment_responded_at = null,
    coordinator_assignment_attempted_at = now(),
    coordinator_assignment_source = 'client',
    coordinator_assignment_note = 'Requested directly by the client.',
    coordinator_preference = 'selected',
    coordinator_fee_amount = fee,
    coordinator_fee_currency = fee_currency,
    coordinator_pricing_snapshot = jsonb_build_object(
      'coordinator_id', target_coordinator_id, 'coordinator_name', coordinator_name,
      'description', profile_description, 'specializations', profile_specializations,
      'coordination_fee', fee, 'currency', fee_currency, 'captured_at', now()
    ), updated_at = now()
  where id = event_row.id;

  insert into public.coordinator_assignment_attempts (
    event_id, coordinator_id, assignment_source, status, requested_at, assigned_by, note
  ) values (
    event_row.id, target_coordinator_id, 'client', 'invited', now(), auth.uid(),
    'Booking request sent directly by the client.'
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (target_coordinator_id, 'New coordinator booking request',
    format('%s requested your coordination service for %s at PHP %s.',
      coalesce((select full_name from public.profiles where id = auth.uid()), 'A client'),
      event_row.name, to_char(fee, 'FM999,999,990.00')),
    'event', event_row.id);

  return jsonb_build_object('event_id', event_row.id, 'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name, 'assignment_status', 'pending',
    'coordination_fee', fee, 'currency', fee_currency);
end;
$$;

create or replace function public.respond_event_coordinator_assignment(
  target_event_id uuid,
  accept_assignment boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.pending_coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then
    raise exception 'This coordinator booking request is no longer available.' using errcode = '42501';
  end if;
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  update public.coordinator_assignment_attempts
  set status = case when accept_assignment then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now(),
      note = case when accept_assignment then note else 'Coordinator declined the client booking request.' end
  where event_id = event_row.id and coordinator_id = auth.uid() and status = 'invited';

  if accept_assignment then
    update public.events set coordinator_id = auth.uid(), pending_coordinator_id = null,
      coordinator_assignment_status = 'accepted', coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = null, updated_at = now() where id = event_row.id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking accepted',
      format('Your coordinator booking for %s was accepted.', event_row.name), 'event', event_row.id);
  else
    update public.events set coordinator_id = null, pending_coordinator_id = null,
      coordinator_assignment_status = null, coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = 'The coordinator declined the client booking request.',
      coordinator_preference = 'undecided', coordinator_fee_amount = null,
      coordinator_fee_currency = null, coordinator_pricing_snapshot = null,
      updated_at = now() where id = event_row.id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking declined',
      format('Your coordinator request for %s was declined. You can choose another coordinator or continue without one.', event_row.name),
      'event', event_row.id);
  end if;
  return jsonb_build_object('event_id', event_row.id, 'accepted', accept_assignment,
    'assignment_status', case when accept_assignment then 'accepted' else null end);
end;
$$;

create or replace function public.remove_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;
  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()), updated_at = now(),
      note = coalesce(note, 'Coordinator booking removed by client.')
  where event_id = event_row.id and status in ('invited', 'accepted');
  update public.events set coordinator_id = null, pending_coordinator_id = null,
    coordinator_assignment_status = null, coordinator_assignment_requested_at = null,
    coordinator_assignment_responded_at = now(), coordinator_assignment_source = 'client',
    coordinator_assignment_note = 'Coordinator booking removed by client.',
    coordinator_preference = 'undecided', coordinator_fee_amount = null,
    coordinator_fee_currency = null, coordinator_pricing_snapshot = null, updated_at = now()
  where id = event_row.id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select recipient, 'Coordinator booking removed',
    format('The coordinator booking for %s was removed by the client.', event_row.name),
    'event', event_row.id
  from (values (event_row.coordinator_id), (event_row.pending_coordinator_id)) recipients(recipient)
  where recipient is not null;
  return jsonb_build_object('event_id', event_row.id, 'coordinator_id', null);
end;
$$;

create or replace function public.get_my_coordinator_booking_fees()
returns table (event_id uuid, coordination_fee numeric, currency text)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, coalesce(event.coordinator_fee_amount, 0),
    coalesce(event.coordinator_fee_currency, 'PHP')
  from public.events event
  where event.status not in ('completed', 'cancelled')
    and (
      event.coordinator_id = auth.uid()
      or event.pending_coordinator_id = auth.uid()
    );
$$;

revoke all on function public.get_my_coordinator_service_profile() from public;
revoke all on function public.save_my_coordinator_service_profile(text, numeric, text[], boolean) from public;
revoke all on function public.list_bookable_event_coordinators(uuid) from public;
revoke all on function public.set_event_coordinator_preference(uuid, text) from public;
revoke all on function public.get_my_coordinator_booking_fees() from public;
grant execute on function public.get_my_coordinator_service_profile() to authenticated;
grant execute on function public.save_my_coordinator_service_profile(text, numeric, text[], boolean) to authenticated;
grant execute on function public.list_bookable_event_coordinators(uuid) to authenticated;
grant execute on function public.set_event_coordinator_preference(uuid, text) to authenticated;
grant execute on function public.get_my_coordinator_booking_fees() to authenticated;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.remove_event_coordinator(uuid) to authenticated;

commit;
