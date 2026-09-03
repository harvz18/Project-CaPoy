-- Run this after initial_supabase_schema.sql and the client planning migrations.
-- Adds tables used by merchant service setup, availability, profile, notification,
-- payout, and booking-management screens. This version does not enable RLS.

create unique index if not exists provider_profiles_user_id_key
  on public.provider_profiles (user_id);

create table if not exists public.provider_operating_hours (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  day_of_week text not null,
  is_open boolean not null default true,
  open_time time,
  close_time time,
  timezone text not null default 'Asia/Manila (GMT+8)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_operating_hours_day_check
    check (day_of_week in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )),
  constraint provider_operating_hours_open_time_check
    check (
      is_open = false
      or (open_time is not null and close_time is not null and close_time > open_time)
    )
);

create unique index if not exists provider_operating_hours_provider_day_key
  on public.provider_operating_hours (provider_id, day_of_week);

create table if not exists public.provider_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists provider_notification_preferences_provider_id_key
  on public.provider_notification_preferences (provider_id);

create table if not exists public.provider_payout_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP',
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_payout_requests_status_check
    check (status in ('requested', 'processing', 'paid', 'rejected', 'cancelled'))
);

create index if not exists provider_payout_requests_provider_id_idx
  on public.provider_payout_requests (provider_id);

create table if not exists public.provider_service_listing_drafts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists provider_service_listing_drafts_provider_id_key
  on public.provider_service_listing_drafts (provider_id);

create unique index if not exists provider_availability_provider_date_service_key
  on public.provider_availability (
    provider_id,
    available_date,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

insert into storage.buckets (id, name, public)
values ('service-photos', 'service-photos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Service photos are publicly readable" on storage.objects;
create policy "Service photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'service-photos');

drop policy if exists "Authenticated providers can upload service photos" on storage.objects;
create policy "Authenticated providers can upload service photos"
  on storage.objects for insert
  with check (bucket_id = 'service-photos' and auth.role() = 'authenticated');
