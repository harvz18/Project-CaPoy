-- Run this if row level security is enabled for merchant service tables.
-- Providers can manage their own service listings, while clients can browse
-- active listings and packages.

alter table public.services enable row level security;
alter table public.service_packages enable row level security;
alter table public.provider_service_listing_drafts enable row level security;

drop policy if exists "Active services are publicly readable" on public.services;
create policy "Active services are publicly readable"
  on public.services for select
  using (status = 'active');

drop policy if exists "Providers can view owned services" on public.services;
create policy "Providers can view owned services"
  on public.services for select
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = services.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can insert owned services" on public.services;
create policy "Providers can insert owned services"
  on public.services for insert
  with check (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = services.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can update owned services" on public.services;
create policy "Providers can update owned services"
  on public.services for update
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = services.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = services.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can delete owned services" on public.services;
create policy "Providers can delete owned services"
  on public.services for delete
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = services.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Active service packages are publicly readable" on public.service_packages;
create policy "Active service packages are publicly readable"
  on public.service_packages for select
  using (
    exists (
      select 1
      from public.services
      where services.id = service_packages.service_id
        and services.status = 'active'
    )
  );

drop policy if exists "Providers can view owned service packages" on public.service_packages;
create policy "Providers can view owned service packages"
  on public.service_packages for select
  using (
    exists (
      select 1
      from public.services
      join public.provider_profiles on provider_profiles.id = services.provider_id
      where services.id = service_packages.service_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can insert owned service packages" on public.service_packages;
create policy "Providers can insert owned service packages"
  on public.service_packages for insert
  with check (
    exists (
      select 1
      from public.services
      join public.provider_profiles on provider_profiles.id = services.provider_id
      where services.id = service_packages.service_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can update owned service packages" on public.service_packages;
create policy "Providers can update owned service packages"
  on public.service_packages for update
  using (
    exists (
      select 1
      from public.services
      join public.provider_profiles on provider_profiles.id = services.provider_id
      where services.id = service_packages.service_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.services
      join public.provider_profiles on provider_profiles.id = services.provider_id
      where services.id = service_packages.service_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can delete owned service packages" on public.service_packages;
create policy "Providers can delete owned service packages"
  on public.service_packages for delete
  using (
    exists (
      select 1
      from public.services
      join public.provider_profiles on provider_profiles.id = services.provider_id
      where services.id = service_packages.service_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can view owned service drafts" on public.provider_service_listing_drafts;
create policy "Providers can view owned service drafts"
  on public.provider_service_listing_drafts for select
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = provider_service_listing_drafts.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can insert owned service drafts" on public.provider_service_listing_drafts;
create policy "Providers can insert owned service drafts"
  on public.provider_service_listing_drafts for insert
  with check (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = provider_service_listing_drafts.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can update owned service drafts" on public.provider_service_listing_drafts;
create policy "Providers can update owned service drafts"
  on public.provider_service_listing_drafts for update
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = provider_service_listing_drafts.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = provider_service_listing_drafts.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers can delete owned service drafts" on public.provider_service_listing_drafts;
create policy "Providers can delete owned service drafts"
  on public.provider_service_listing_drafts for delete
  using (
    exists (
      select 1
      from public.provider_profiles
      where provider_profiles.id = provider_service_listing_drafts.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );
