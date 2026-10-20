-- MULTIVENT Revision V9, Phase 7: coordinator-led marketplace profiles.
-- Existing package and booking records remain historical data; this migration
-- only adds optional profile fields and new profile-focused RPC contracts.

begin;

alter table public.coordinator_service_profiles
  add column if not exists years_experience integer,
  add column if not exists event_types_handled text[] not null default '{}',
  add column if not exists skills text[] not null default '{}',
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists certifications text[] not null default '{}',
  add column if not exists portfolio_summary text not null default '',
  add column if not exists service_inclusions text[] not null default '{}',
  add column if not exists availability_notes text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'coordinator_service_profiles_years_experience_v9_check'
      and conrelid = 'public.coordinator_service_profiles'::regclass
  ) then
    alter table public.coordinator_service_profiles
      add constraint coordinator_service_profiles_years_experience_v9_check
      check (years_experience is null or years_experience between 0 and 80);
  end if;
end;
$$;

create or replace function public.normalize_coordinator_profile_list_v9(
  target_values text[],
  maximum_items integer
)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(value order by value), '{}'::text[])
  from (
    select distinct left(trim(item), 120) as value
    from unnest(coalesce(target_values, '{}'::text[])) item
    where trim(item) <> ''
    order by value
    limit greatest(least(coalesce(maximum_items, 12), 20), 0)
  ) cleaned;
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
  select profile.id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.account_status = 'active'
    and (profile.default_role = 'event_coordinator' or exists (
      select 1
      from public.user_roles user_role
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
    'years_experience', service_profile.years_experience,
    'event_types_handled', service_profile.event_types_handled,
    'skills', service_profile.skills,
    'capabilities', service_profile.capabilities,
    'certifications', service_profile.certifications,
    'portfolio_summary', service_profile.portfolio_summary,
    'service_inclusions', service_profile.service_inclusions,
    'availability_notes', service_profile.availability_notes,
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

create or replace function public.save_my_coordinator_service_profile_v9(
  target_description text,
  target_coordination_fee numeric,
  target_specializations text[],
  target_years_experience integer,
  target_event_types_handled text[],
  target_skills text[],
  target_capabilities text[],
  target_certifications text[],
  target_portfolio_summary text,
  target_service_inclusions text[],
  target_availability_notes text,
  target_is_accepting_bookings boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if coalesce(target_years_experience, 0) < 0 or coalesce(target_years_experience, 0) > 80 then
    raise exception 'Years of experience must be between 0 and 80.';
  end if;
  if char_length(coalesce(trim(target_description), '')) > 2000 then
    raise exception 'Professional introduction cannot exceed 2,000 characters.';
  end if;
  if char_length(coalesce(trim(target_portfolio_summary), '')) > 3000 then
    raise exception 'Portfolio summary cannot exceed 3,000 characters.';
  end if;
  if char_length(coalesce(trim(target_availability_notes), '')) > 1000 then
    raise exception 'Availability notes cannot exceed 1,000 characters.';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
      and (profile.default_role = 'event_coordinator' or exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id and role.name = 'event_coordinator'
      ))
  ) then
    raise exception 'An active Event Coordinator account is required.' using errcode = '42501';
  end if;

  insert into public.coordinator_service_profiles (
    coordinator_id, description, coordination_fee, specializations,
    years_experience, event_types_handled, skills, capabilities, certifications,
    portfolio_summary, service_inclusions, availability_notes,
    is_accepting_bookings, updated_at
  ) values (
    auth.uid(), coalesce(trim(target_description), ''), round(coalesce(target_coordination_fee, 0), 2),
    public.normalize_coordinator_profile_list_v9(target_specializations, 12),
    nullif(target_years_experience, 0),
    public.normalize_coordinator_profile_list_v9(target_event_types_handled, 8),
    public.normalize_coordinator_profile_list_v9(target_skills, 16),
    public.normalize_coordinator_profile_list_v9(target_capabilities, 16),
    public.normalize_coordinator_profile_list_v9(target_certifications, 12),
    coalesce(trim(target_portfolio_summary), ''),
    public.normalize_coordinator_profile_list_v9(target_service_inclusions, 16),
    coalesce(trim(target_availability_notes), ''),
    coalesce(target_is_accepting_bookings, false), now()
  )
  on conflict (coordinator_id) do update set
    description = excluded.description,
    coordination_fee = excluded.coordination_fee,
    specializations = excluded.specializations,
    years_experience = excluded.years_experience,
    event_types_handled = excluded.event_types_handled,
    skills = excluded.skills,
    capabilities = excluded.capabilities,
    certifications = excluded.certifications,
    portfolio_summary = excluded.portfolio_summary,
    service_inclusions = excluded.service_inclusions,
    availability_notes = excluded.availability_notes,
    is_accepting_bookings = excluded.is_accepting_bookings,
    updated_at = now();

  return public.get_my_coordinator_service_profile();
end;
$$;

create or replace function public.list_bookable_event_coordinators_v9(
  target_event_id uuid default null
)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  description text,
  coordination_fee numeric,
  currency text,
  specializations text[],
  years_experience integer,
  event_types_handled text[],
  skills text[],
  capabilities text[],
  certifications text[],
  portfolio_summary text,
  service_inclusions text[],
  availability_notes text,
  is_available boolean,
  unavailable_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select legacy.id, legacy.full_name, legacy.avatar_url, legacy.description,
    legacy.coordination_fee, legacy.currency, legacy.specializations,
    service_profile.years_experience, service_profile.event_types_handled,
    service_profile.skills, service_profile.capabilities, service_profile.certifications,
    service_profile.portfolio_summary, service_profile.service_inclusions,
    service_profile.availability_notes, legacy.is_available, legacy.unavailable_reason
  from public.list_bookable_event_coordinators(target_event_id) legacy
  join public.coordinator_service_profiles service_profile
    on service_profile.coordinator_id = legacy.id;
$$;

revoke all on function public.normalize_coordinator_profile_list_v9(text[], integer) from public;
revoke all on function public.save_my_coordinator_service_profile_v9(text, numeric, text[], integer, text[], text[], text[], text[], text, text[], text, boolean) from public;
revoke all on function public.list_bookable_event_coordinators_v9(uuid) from public;
grant execute on function public.get_my_coordinator_service_profile() to authenticated;
grant execute on function public.save_my_coordinator_service_profile_v9(text, numeric, text[], integer, text[], text[], text[], text[], text, text[], text, boolean) to authenticated;
grant execute on function public.list_bookable_event_coordinators_v9(uuid) to authenticated;

comment on function public.save_my_coordinator_service_profile_v9(text, numeric, text[], integer, text[], text[], text[], text[], text, text[], text, boolean) is
  'Stores optional coordinator marketplace profile details without modifying package or booking history.';

commit;
