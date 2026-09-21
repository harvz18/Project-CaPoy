-- MULTIVENT client planning and booking RLS repair.
-- Run after 06_booking_system_security.sql in the Supabase SQL Editor.
--
-- This is intentionally idempotent. It repairs projects where RLS was enabled by
-- the security migration but the policies from 02_event_planning_flow.sql were
-- not installed (for example, projects originally created with the no-RLS file).

begin;

alter table public.events enable row level security;
alter table public.event_requirements enable row level security;
alter table public.event_budget_items enable row level security;
alter table public.event_service_selections enable row level security;
alter table public.bookings enable row level security;

-- Event owners can create and manage their plan. Assigned coordinators may read
-- and update it, but cannot create or delete an event on a client's behalf.
drop policy if exists "Clients can view owned events" on public.events;
create policy "Clients can view owned events"
  on public.events for select to authenticated
  using (auth.uid() = client_id or auth.uid() = coordinator_id);

drop policy if exists "Clients can insert owned events" on public.events;
create policy "Clients can insert owned events"
  on public.events for insert to authenticated
  with check (auth.uid() = client_id);

drop policy if exists "Clients can update owned events" on public.events;
create policy "Clients can update owned events"
  on public.events for update to authenticated
  using (auth.uid() = client_id or auth.uid() = coordinator_id)
  with check (auth.uid() = client_id or auth.uid() = coordinator_id);

drop policy if exists "Clients can delete owned draft events" on public.events;
create policy "Clients can delete owned draft events"
  on public.events for delete to authenticated
  using (auth.uid() = client_id and status = 'draft');

-- Requirements inherit access from their parent event.
drop policy if exists "Clients can view owned event requirements" on public.event_requirements;
create policy "Clients can view owned event requirements"
  on public.event_requirements for select to authenticated
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
  on public.event_requirements for insert to authenticated
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
  on public.event_requirements for update to authenticated
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
  on public.event_requirements for delete to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_requirements.event_id
        and events.client_id = auth.uid()
    )
  );

-- Budget items inherit access from their parent event.
drop policy if exists "Clients can view owned budget items" on public.event_budget_items;
create policy "Clients can view owned budget items"
  on public.event_budget_items for select to authenticated
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
  on public.event_budget_items for insert to authenticated
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
  on public.event_budget_items for update to authenticated
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
  on public.event_budget_items for delete to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_budget_items.event_id
        and events.client_id = auth.uid()
    )
  );

-- Clients own selections; the selected service provider can read them.
drop policy if exists "Clients can view owned selections" on public.event_service_selections;
create policy "Clients can view owned selections"
  on public.event_service_selections for select to authenticated
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
  on public.event_service_selections for insert to authenticated
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
  on public.event_service_selections for update to authenticated
  using (auth.uid() = client_id)
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.events
      where events.id = event_service_selections.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients can delete owned selections" on public.event_service_selections;
create policy "Clients can delete owned selections"
  on public.event_service_selections for delete to authenticated
  using (auth.uid() = client_id);

-- Both sides may read and update a booking. A client may only create a booking
-- for their own event, and its service must belong to the selected provider.
drop policy if exists "Clients and providers can view bookings" on public.bookings;
create policy "Clients and providers can view bookings"
  on public.bookings for select to authenticated
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
  on public.bookings for insert to authenticated
  with check (
    auth.uid() = client_id
    and exists (
      select 1
      from public.events
      where events.id = bookings.event_id
        and events.client_id = auth.uid()
    )
    and exists (
      select 1
      from public.services
      where services.id = bookings.service_id
        and services.provider_id = bookings.provider_id
        and services.status = 'active'
    )
  );

drop policy if exists "Clients and providers can update bookings" on public.bookings;
create policy "Clients and providers can update bookings"
  on public.bookings for update to authenticated
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

commit;
