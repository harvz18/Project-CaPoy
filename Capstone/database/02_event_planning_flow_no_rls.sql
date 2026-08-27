-- Run this after initial_supabase_schema.sql if you do not want to enable RLS yet.
-- Supports the client planning flow from Budget Allocation through Selected Summary.
-- This version only adds planning columns/tables and does not create RLS policies.

alter table public.event_budget_items
  add column if not exists priority_rank integer,
  add column if not exists is_priority boolean not null default false;

create table if not exists public.event_service_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  package_id uuid references public.service_packages(id) on delete set null,
  category_id uuid references public.service_categories(id) on delete set null,
  service_name text not null,
  category_name text,
  estimated_amount numeric(12,2) not null default 0,
  status text not null default 'selected',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_service_selections_status_check
    check (status in ('selected', 'requested', 'confirmed', 'declined', 'cancelled'))
);

create index if not exists event_service_selections_event_id_idx
  on public.event_service_selections (event_id);

create index if not exists event_service_selections_client_id_idx
  on public.event_service_selections (client_id);
