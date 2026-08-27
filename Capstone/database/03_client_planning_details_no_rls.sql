-- Run this after initial_supabase_schema.sql and 02_event_planning_flow_no_rls.sql.
-- Adds the data needed by the client flow screens from service details through payment review.
-- This file intentionally does not enable RLS and does not create RLS policies.

alter table public.events
  add column if not exists event_time time,
  add column if not exists timezone text not null default 'Asia/Manila',
  add column if not exists preferred_start_at timestamptz,
  add column if not exists preferred_end_at timestamptz;

alter table public.event_service_selections
  add column if not exists attendee_count integer,
  add column if not exists budget_per_head numeric(12,2),
  add column if not exists meal_type text,
  add column if not exists outside_food boolean not null default false,
  add column if not exists dietary_notes text,
  add column if not exists favorite boolean not null default false,
  add column if not exists requested_start_at timestamptz,
  add column if not exists requested_end_at timestamptz,
  add column if not exists availability_status text not null default 'unchecked',
  add column if not exists selected_provider_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_meal_type_check,
  add constraint event_service_selections_meal_type_check
    check (meal_type is null or meal_type in ('plated', 'buffet', 'packed'));

alter table public.event_service_selections
  drop constraint if exists event_service_selections_availability_status_check,
  add constraint event_service_selections_availability_status_check
    check (availability_status in ('unchecked', 'available', 'conflict', 'resolved'));

create table if not exists public.event_provider_instructions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  selection_id uuid references public.event_service_selections(id) on delete cascade,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  category_name text not null,
  instruction_type text not null,
  title text not null,
  body text,
  tags jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_provider_instructions_status_check
    check (status in ('draft', 'saved', 'sent', 'archived'))
);

create index if not exists event_provider_instructions_event_id_idx
  on public.event_provider_instructions (event_id);

create index if not exists event_provider_instructions_selection_id_idx
  on public.event_provider_instructions (selection_id);

create table if not exists public.event_schedule_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  status text not null default 'unchecked',
  conflict_count integer not null default 0,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_schedule_checks_status_check
    check (status in ('unchecked', 'available', 'conflict', 'resolved'))
);

create index if not exists event_schedule_checks_event_id_idx
  on public.event_schedule_checks (event_id);

create table if not exists public.event_schedule_check_results (
  id uuid primary key default gen_random_uuid(),
  schedule_check_id uuid not null references public.event_schedule_checks(id) on delete cascade,
  selection_id uuid references public.event_service_selections(id) on delete cascade,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  provider_name text not null,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  is_available boolean not null default true,
  conflict_reason text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_schedule_check_results_schedule_check_id_idx
  on public.event_schedule_check_results (schedule_check_id);

create index if not exists event_schedule_check_results_selection_id_idx
  on public.event_schedule_check_results (selection_id);

alter table public.payments
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists checkout_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists payments_event_id_idx
  on public.payments (event_id);

insert into public.service_categories (name, description, icon_name, is_active)
values
  ('Venues & Estates', 'Wedding venues, estates, ballrooms, gardens, and ceremony spaces.', 'map-pin', true),
  ('Photography', 'Photo and video coverage for events.', 'camera', true),
  ('Catering', 'Plated, buffet, packed, and custom menu catering services.', 'utensils', true),
  ('Florists', 'Floral design, bouquets, ceremony styling, and reception arrangements.', 'flower', true),
  ('Attire', 'Gowns, suits, entourage attire, rental, and styling services.', 'shirt', true),
  ('Event Organizer', 'Full-service event planning, coordination, and supplier management.', 'clipboard-list', true),
  ('Sound & Lights', 'Audio, lighting, stage, and technical production providers.', 'music', true),
  ('Host/Emcee', 'Hosts, emcees, program directors, and entertainment presenters.', 'mic', true)
on conflict (name) do update
set
  description = excluded.description,
  icon_name = excluded.icon_name,
  is_active = excluded.is_active;
