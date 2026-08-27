-- Run this after initial_supabase_schema.sql.
-- Supports the client planning flow from Budget Allocation through Selected Summary.

alter table public.events enable row level security;
alter table public.event_requirements enable row level security;
alter table public.event_budget_items enable row level security;
alter table public.bookings enable row level security;

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

alter table public.event_service_selections enable row level security;

drop policy if exists "Clients can view owned events" on public.events;
create policy "Clients can view owned events"
  on public.events for select
  using (auth.uid() = client_id or auth.uid() = coordinator_id);

drop policy if exists "Clients can insert owned events" on public.events;
create policy "Clients can insert owned events"
  on public.events for insert
  with check (auth.uid() = client_id);

drop policy if exists "Clients can update owned events" on public.events;
create policy "Clients can update owned events"
  on public.events for update
  using (auth.uid() = client_id or auth.uid() = coordinator_id)
  with check (auth.uid() = client_id or auth.uid() = coordinator_id);

drop policy if exists "Clients can delete owned draft events" on public.events;
create policy "Clients can delete owned draft events"
  on public.events for delete
  using (auth.uid() = client_id and status = 'draft');

drop policy if exists "Clients can view owned event requirements" on public.event_requirements;
create policy "Clients can view owned event requirements"
  on public.event_requirements for select
  using (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  );

drop policy if exists "Clients can insert owned event requirements" on public.event_requirements;
create policy "Clients can insert owned event requirements"
  on public.event_requirements for insert
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can update owned event requirements" on public.event_requirements;
create policy "Clients can update owned event requirements"
  on public.event_requirements for update
  using (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  );

drop policy if exists "Clients can delete owned event requirements" on public.event_requirements;
create policy "Clients can delete owned event requirements"
  on public.event_requirements for delete
  using (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can view owned budget items" on public.event_budget_items;
create policy "Clients can view owned budget items"
  on public.event_budget_items for select
  using (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  );

drop policy if exists "Clients can insert owned budget items" on public.event_budget_items;
create policy "Clients can insert owned budget items"
  on public.event_budget_items for insert
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can update owned budget items" on public.event_budget_items;
create policy "Clients can update owned budget items"
  on public.event_budget_items for update
  using (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and (events.client_id = auth.uid() or events.coordinator_id = auth.uid())
    )
  );

drop policy if exists "Clients can delete owned budget items" on public.event_budget_items;
create policy "Clients can delete owned budget items"
  on public.event_budget_items for delete
  using (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can view owned selections" on public.event_service_selections;
create policy "Clients can view owned selections"
  on public.event_service_selections for select
  using (
    auth.uid() = client_id
    or exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = event_service_selections.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Clients can insert owned selections" on public.event_service_selections;
create policy "Clients can insert owned selections"
  on public.event_service_selections for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.events
      where events.id = event_service_selections.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can update owned selections" on public.event_service_selections;
create policy "Clients can update owned selections"
  on public.event_service_selections for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

drop policy if exists "Clients can delete owned selections" on public.event_service_selections;
create policy "Clients can delete owned selections"
  on public.event_service_selections for delete
  using (auth.uid() = client_id);

drop policy if exists "Clients and providers can view bookings" on public.bookings;
create policy "Clients and providers can view bookings"
  on public.bookings for select
  using (
    auth.uid() = client_id
    or exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = bookings.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Clients can request bookings" on public.bookings;
create policy "Clients can request bookings"
  on public.bookings for insert
  with check (auth.uid() = client_id);

drop policy if exists "Clients and providers can update bookings" on public.bookings;
create policy "Clients and providers can update bookings"
  on public.bookings for update
  using (
    auth.uid() = client_id
    or exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = bookings.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = client_id
    or exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = bookings.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );
