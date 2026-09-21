-- MULTIVENT Auth -> application profile repair.
-- Run after 09_booking_lifecycle.sql in the Supabase SQL Editor.
--
-- This restores the server-side signup trigger, restores owner RLS policies,
-- and backfills Auth users whose public profile rows were not created.

begin;

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Profiles can be inserted by owner" on public.profiles;
create policy "Profiles can be inserted by owner"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Profiles can be updated by owner" on public.profiles;
create policy "Profiles can be updated by owner"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Provider profiles are viewable by owner" on public.provider_profiles;
create policy "Provider profiles are viewable by owner"
  on public.provider_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Provider profiles can be inserted by owner" on public.provider_profiles;
create policy "Provider profiles can be inserted by owner"
  on public.provider_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Provider profiles can be updated by owner" on public.provider_profiles;
create policy "Provider profiles can be updated by owner"
  on public.provider_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "User roles are viewable by owner" on public.user_roles;
create policy "User roles are viewable by owner"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

-- Earlier client-side repair attempts could create more than one provider row
-- for the same Auth user when the unique index was missing. Pick the strongest
-- existing row as canonical, move all dependent records to it, and only then
-- restore the one-provider-per-user guarantee.
create temporary table provider_profile_identity on commit drop as
select
  id,
  first_value(id) over (
    partition by user_id
    order by
      case verification_status
        when 'verified' then 5
        when 'active' then 4
        when 'pending' then 3
        when 'suspended' then 2
        else 1
      end desc,
      created_at asc,
      id asc
  ) as keep_id
from public.provider_profiles
where user_id in (
  select user_id
  from public.provider_profiles
  group by user_id
  having count(*) > 1
);

-- Preserve missing contact/details fields on the canonical provider row.
update public.provider_profiles as keep
set
  description = coalesce(
    keep.description,
    (
      select duplicate.description
      from provider_profile_identity as identity
      join public.provider_profiles as duplicate on duplicate.id = identity.id
      where identity.keep_id = keep.id
        and identity.id <> identity.keep_id
        and duplicate.description is not null
      order by duplicate.updated_at desc
      limit 1
    )
  ),
  contact_email = coalesce(
    keep.contact_email,
    (
      select duplicate.contact_email
      from provider_profile_identity as identity
      join public.provider_profiles as duplicate on duplicate.id = identity.id
      where identity.keep_id = keep.id
        and identity.id <> identity.keep_id
        and duplicate.contact_email is not null
      order by duplicate.updated_at desc
      limit 1
    )
  ),
  contact_phone = coalesce(
    keep.contact_phone,
    (
      select duplicate.contact_phone
      from provider_profile_identity as identity
      join public.provider_profiles as duplicate on duplicate.id = identity.id
      where identity.keep_id = keep.id
        and identity.id <> identity.keep_id
        and duplicate.contact_phone is not null
      order by duplicate.updated_at desc
      limit 1
    )
  ),
  location = coalesce(
    keep.location,
    (
      select duplicate.location
      from provider_profile_identity as identity
      join public.provider_profiles as duplicate on duplicate.id = identity.id
      where identity.keep_id = keep.id
        and identity.id <> identity.keep_id
        and duplicate.location is not null
      order by duplicate.updated_at desc
      limit 1
    )
  ),
  updated_at = now()
where exists (
  select 1
  from provider_profile_identity as identity
  where identity.keep_id = keep.id
);

-- Tables with a provider-scoped unique key must be reduced to the newest row
-- for that key before their provider_id values can be consolidated.
with ranked as (
  select
    operating_hours.id,
    row_number() over (
      partition by identity.keep_id, operating_hours.day_of_week
      order by operating_hours.updated_at desc, operating_hours.id desc
    ) as row_rank
  from public.provider_operating_hours as operating_hours
  join provider_profile_identity as identity on identity.id = operating_hours.provider_id
)
delete from public.provider_operating_hours as operating_hours
using ranked
where operating_hours.id = ranked.id
  and ranked.row_rank > 1;

update public.provider_operating_hours as operating_hours
set provider_id = identity.keep_id
from provider_profile_identity as identity
where operating_hours.provider_id = identity.id
  and identity.id <> identity.keep_id;

with ranked as (
  select
    preferences.id,
    row_number() over (
      partition by identity.keep_id
      order by preferences.updated_at desc, preferences.id desc
    ) as row_rank
  from public.provider_notification_preferences as preferences
  join provider_profile_identity as identity on identity.id = preferences.provider_id
)
delete from public.provider_notification_preferences as preferences
using ranked
where preferences.id = ranked.id
  and ranked.row_rank > 1;

update public.provider_notification_preferences as preferences
set provider_id = identity.keep_id
from provider_profile_identity as identity
where preferences.provider_id = identity.id
  and identity.id <> identity.keep_id;

with ranked as (
  select
    drafts.id,
    row_number() over (
      partition by identity.keep_id
      order by drafts.updated_at desc, drafts.id desc
    ) as row_rank
  from public.provider_service_listing_drafts as drafts
  join provider_profile_identity as identity on identity.id = drafts.provider_id
)
delete from public.provider_service_listing_drafts as drafts
using ranked
where drafts.id = ranked.id
  and ranked.row_rank > 1;

update public.provider_service_listing_drafts as drafts
set provider_id = identity.keep_id
from provider_profile_identity as identity
where drafts.provider_id = identity.id
  and identity.id <> identity.keep_id;

with ranked as (
  select
    availability.id,
    row_number() over (
      partition by
        identity.keep_id,
        availability.available_date,
        coalesce(availability.service_id, '00000000-0000-0000-0000-000000000000'::uuid)
      order by availability.created_at desc, availability.id desc
    ) as row_rank
  from public.provider_availability as availability
  join provider_profile_identity as identity on identity.id = availability.provider_id
)
delete from public.provider_availability as availability
using ranked
where availability.id = ranked.id
  and ranked.row_rank > 1;

update public.provider_availability as availability
set provider_id = identity.keep_id
from provider_profile_identity as identity
where availability.provider_id = identity.id
  and identity.id <> identity.keep_id;

-- Move every non-unique dependent record without removing business data.
update public.services as services
set provider_id = identity.keep_id
from provider_profile_identity as identity
where services.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.bookings as bookings
set provider_id = identity.keep_id
from provider_profile_identity as identity
where bookings.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.reviews as reviews
set provider_id = identity.keep_id
from provider_profile_identity as identity
where reviews.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.event_service_selections as selections
set provider_id = identity.keep_id
from provider_profile_identity as identity
where selections.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.event_provider_instructions as instructions
set provider_id = identity.keep_id
from provider_profile_identity as identity
where instructions.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.event_schedule_check_results as results
set provider_id = identity.keep_id
from provider_profile_identity as identity
where results.provider_id = identity.id
  and identity.id <> identity.keep_id;

update public.provider_payout_requests as payouts
set provider_id = identity.keep_id
from provider_profile_identity as identity
where payouts.provider_id = identity.id
  and identity.id <> identity.keep_id;

-- Keep an admin-only JSON snapshot of every redundant row before removing it.
-- This makes the consolidation auditable and recoverable without exposing the
-- archived contact data through the client API.
create table if not exists public.provider_profile_merge_archive (
  original_provider_id uuid primary key,
  user_id uuid not null,
  kept_provider_id uuid not null,
  profile_data jsonb not null,
  archived_at timestamptz not null default now()
);

alter table public.provider_profile_merge_archive enable row level security;

insert into public.provider_profile_merge_archive (
  original_provider_id,
  user_id,
  kept_provider_id,
  profile_data
)
select
  duplicate.id,
  duplicate.user_id,
  identity.keep_id,
  to_jsonb(duplicate)
from public.provider_profiles as duplicate
join provider_profile_identity as identity on identity.id = duplicate.id
where identity.id <> identity.keep_id
on conflict (original_provider_id) do update
set
  kept_provider_id = excluded.kept_provider_id,
  profile_data = excluded.profile_data,
  archived_at = now();

delete from public.provider_profiles as duplicate
using provider_profile_identity as identity
where duplicate.id = identity.id
  and identity.id <> identity.keep_id;

drop index if exists public.provider_profiles_user_id_key;
create unique index provider_profiles_user_id_key
  on public.provider_profiles (user_id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.user_role;
begin
  selected_role := case new.raw_user_meta_data ->> 'default_role'
    when 'service_provider' then 'service_provider'::public.user_role
    when 'event_coordinator' then 'event_coordinator'::public.user_role
    when 'admin' then 'admin'::public.user_role
    when 'superadmin' then 'superadmin'::public.user_role
    else 'client'::public.user_role
  end;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    default_role,
    account_status
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    selected_role,
    case
      when selected_role = 'service_provider' then 'pending'::public.account_status
      else 'active'::public.account_status
    end
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = coalesce(excluded.email, profiles.email),
    phone = coalesce(excluded.phone, profiles.phone),
    default_role = excluded.default_role,
    updated_at = now();

  insert into public.user_roles (user_id, role_id)
  select new.id, roles.id
  from public.roles
  where roles.name = selected_role
  on conflict (user_id, role_id) do nothing;

  if selected_role = 'service_provider' then
    insert into public.provider_profiles (
      user_id,
      business_name,
      description,
      contact_email,
      contact_phone,
      verification_status
    )
    values (
      new.id,
      coalesce(
        nullif(new.raw_user_meta_data ->> 'business_name', ''),
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        'Business profile'
      ),
      nullif(new.raw_user_meta_data ->> 'service_category', ''),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      'pending'::public.account_status
    )
    on conflict (user_id) do update
    set
      business_name = excluded.business_name,
      description = coalesce(excluded.description, provider_profiles.description),
      contact_email = coalesce(excluded.contact_email, provider_profiles.contact_email),
      contact_phone = coalesce(excluded.contact_phone, provider_profiles.contact_phone),
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Repair all Auth users that are missing application profile rows. Existing
-- approval statuses are preserved by the conflict-update clauses.
insert into public.profiles (
  id,
  full_name,
  email,
  phone,
  default_role,
  account_status
)
select
  auth_users.id,
  coalesce(
    nullif(auth_users.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(auth_users.email, ''), '@', 1), ''),
    'User'
  ),
  auth_users.email,
  nullif(auth_users.raw_user_meta_data ->> 'phone', ''),
  case auth_users.raw_user_meta_data ->> 'default_role'
    when 'service_provider' then 'service_provider'::public.user_role
    when 'event_coordinator' then 'event_coordinator'::public.user_role
    when 'admin' then 'admin'::public.user_role
    when 'superadmin' then 'superadmin'::public.user_role
    else 'client'::public.user_role
  end,
  case auth_users.raw_user_meta_data ->> 'default_role'
    when 'service_provider' then 'pending'::public.account_status
    else 'active'::public.account_status
  end
from auth.users as auth_users
on conflict (id) do update
set
  full_name = coalesce(excluded.full_name, profiles.full_name),
  email = coalesce(excluded.email, profiles.email),
  phone = coalesce(excluded.phone, profiles.phone),
  default_role = excluded.default_role,
  updated_at = now();

insert into public.user_roles (user_id, role_id)
select profiles.id, roles.id
from public.profiles
join public.roles on roles.name = profiles.default_role
on conflict (user_id, role_id) do nothing;

insert into public.provider_profiles (
  user_id,
  business_name,
  description,
  contact_email,
  contact_phone,
  verification_status
)
select
  auth_users.id,
  coalesce(
    nullif(auth_users.raw_user_meta_data ->> 'business_name', ''),
    nullif(auth_users.raw_user_meta_data ->> 'full_name', ''),
    'Business profile'
  ),
  nullif(auth_users.raw_user_meta_data ->> 'service_category', ''),
  auth_users.email,
  nullif(auth_users.raw_user_meta_data ->> 'phone', ''),
  'pending'::public.account_status
from auth.users as auth_users
join public.profiles on profiles.id = auth_users.id
where profiles.default_role = 'service_provider'
on conflict (user_id) do update
set
  business_name = excluded.business_name,
  description = coalesce(excluded.description, provider_profiles.description),
  contact_email = coalesce(excluded.contact_email, provider_profiles.contact_email),
  contact_phone = coalesce(excluded.contact_phone, provider_profiles.contact_phone),
  updated_at = now();

commit;
