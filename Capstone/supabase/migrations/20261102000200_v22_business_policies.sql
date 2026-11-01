-- V22 Phase 7: provider/coordinator policy text is informational. It is kept
-- separate from service pricing and platform cancellation/payment rules.

begin;

create table if not exists public.business_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in (
    'advance_booking', 'rescheduling', 'late_arrival', 'additional_charges',
    'cancellation', 'refunds', 'service_preparation', 'delivery_or_pickup',
    'fitting_appointments', 'overtime', 'service_conditions'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  version integer not null default 1 check (version >= 1),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_policies_owner_status_idx
  on public.business_policies (owner_id, status, created_at);

comment on table public.business_policies is
  'Informational provider/coordinator business policies. These cannot override MULTIVENT platform rules.';

create or replace function public.set_business_policy_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.text := btrim(new.text);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;

  if new.category is distinct from old.category
    or new.title is distinct from old.title
    or new.text is distinct from old.text
    or new.status is distinct from old.status then
    new.version := old.version + 1;
  end if;
  if new.status = 'published' and (old.status is distinct from 'published' or new.published_at is null) then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists business_policies_set_version on public.business_policies;
create trigger business_policies_set_version
before insert or update on public.business_policies
for each row execute function public.set_business_policy_version();

alter table public.business_policies enable row level security;

drop policy if exists "Business-policy owners manage their policies" on public.business_policies;
create policy "Business-policy owners manage their policies"
on public.business_policies
for all to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.default_role in ('service_provider', 'event_coordinator')
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.default_role in ('service_provider', 'event_coordinator')
  )
);

drop policy if exists "Authenticated users read published business policies" on public.business_policies;
create policy "Authenticated users read published business policies"
on public.business_policies
for select to authenticated
using (status = 'published');

grant select, insert, update, delete on public.business_policies to authenticated;

-- A request captures the exact published text that was visible at the time.
-- Later edits therefore cannot retroactively rewrite a booking's policy terms.
alter table public.bookings
  add column if not exists provider_policy_snapshot jsonb not null default '[]'::jsonb;

alter table public.events
  add column if not exists coordinator_policy_snapshot jsonb not null default '[]'::jsonb;

create or replace function public.published_business_policy_snapshot(target_owner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'policyId', policy.id,
    'category', policy.category,
    'title', policy.title,
    'text', policy.text,
    'version', policy.version,
    'publishedAt', policy.published_at
  ) order by policy.published_at, policy.created_at, policy.id), '[]'::jsonb)
  from public.business_policies policy
  where policy.owner_id = target_owner_id
    and policy.status = 'published';
$$;

create or replace function public.capture_provider_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_owner_id uuid;
begin
  if new.provider_policy_snapshot = '[]'::jsonb and new.provider_id is not null then
    select provider.user_id into provider_owner_id
    from public.provider_profiles provider
    where provider.id = new.provider_id;
    if provider_owner_id is not null then
      new.provider_policy_snapshot := public.published_business_policy_snapshot(provider_owner_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_capture_provider_policy_snapshot on public.bookings;
create trigger bookings_capture_provider_policy_snapshot
before insert on public.bookings
for each row execute function public.capture_provider_policy_snapshot();

create or replace function public.capture_coordinator_policy_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pending_coordinator_id is not null
    and new.coordinator_assignment_status = 'pending'
    and (
      old.pending_coordinator_id is distinct from new.pending_coordinator_id
      or old.coordinator_assignment_status is distinct from 'pending'
    ) then
    new.coordinator_policy_snapshot := public.published_business_policy_snapshot(new.pending_coordinator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists events_capture_coordinator_policy_snapshot on public.events;
create trigger events_capture_coordinator_policy_snapshot
before update on public.events
for each row execute function public.capture_coordinator_policy_snapshot();

revoke all on function public.published_business_policy_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.capture_provider_policy_snapshot() from public, anon, authenticated;
revoke all on function public.capture_coordinator_policy_snapshot() from public, anon, authenticated;

commit;
