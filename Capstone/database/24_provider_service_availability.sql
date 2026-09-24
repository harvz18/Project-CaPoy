-- MULTIVENT provider-controlled marketplace availability
-- Apply after 23_service_revision_comparison.sql.
-- Approval status and marketplace visibility are intentionally independent:
-- staff approve listing content, while providers may temporarily take an
-- approved service offline without deleting it or triggering re-approval.

begin;

alter table public.services
  add column if not exists is_available boolean not null default true;

comment on column public.services.is_available is
  'Provider-controlled availability. A service is client-visible only when approved (active) and available.';

create index if not exists services_marketplace_visibility_idx
  on public.services (status, is_available, updated_at desc);

drop policy if exists "Active services are publicly readable" on public.services;
create policy "Active services are publicly readable"
  on public.services for select
  using (status = 'active' and is_available = true);

drop policy if exists "Active service packages are publicly readable" on public.service_packages;
create policy "Active service packages are publicly readable"
  on public.service_packages for select
  using (
    exists (
      select 1
      from public.services
      where services.id = service_packages.service_id
        and services.status = 'active'
        and services.is_available = true
    )
  );

-- A service taken offline must remain readable inside an existing client's
-- booking history even though it is no longer discoverable in the catalog.
create or replace function public.can_view_booked_service(target_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where service_id = target_service_id
      and client_id = auth.uid()
  );
$$;

create or replace function public.can_view_booked_package(target_package_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where package_id = target_package_id
      and client_id = auth.uid()
  );
$$;

revoke all on function public.can_view_booked_service(uuid) from public;
revoke all on function public.can_view_booked_package(uuid) from public;
grant execute on function public.can_view_booked_service(uuid) to authenticated;
grant execute on function public.can_view_booked_package(uuid) to authenticated;

drop policy if exists "Booking clients can view booked services" on public.services;
create policy "Booking clients can view booked services"
  on public.services for select to authenticated
  using (public.can_view_booked_service(id));

drop policy if exists "Booking clients can view booked service packages" on public.service_packages;
create policy "Booking clients can view booked service packages"
  on public.service_packages for select to authenticated
  using (public.can_view_booked_package(id));

create or replace function public.can_view_provider_profile(target_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.provider_profiles
    where id = target_provider_id
      and user_id = auth.uid()
  )
  or exists (
    select 1
    from public.services
    where provider_id = target_provider_id
      and status = 'active'
      and is_available = true
  )
  or exists (
    select 1
    from public.bookings
    where provider_id = target_provider_id
      and client_id = auth.uid()
  );
$$;

revoke all on function public.can_view_provider_profile(uuid) from public;
grant execute on function public.can_view_provider_profile(uuid) to authenticated;

-- The latest booking policy must also reject a service that was taken offline
-- after a client loaded the catalog but before the booking request was saved.
drop policy if exists "Clients can request bookings" on public.bookings;
create policy "Clients can request bookings"
  on public.bookings for insert to authenticated
  with check (
    auth.uid() = client_id
    and public.is_event_owner(event_id)
    and exists (
      select 1
      from public.services
      where services.id = bookings.service_id
        and services.provider_id = bookings.provider_id
        and services.status = 'active'
        and services.is_available = true
    )
  );

create or replace function public.provider_set_service_availability(
  target_service_id uuid,
  available boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_status text;
  current_availability boolean;
begin
  if available is null then
    raise exception 'Availability is required';
  end if;

  select services.status, services.is_available
  into service_status, current_availability
  from public.services
  join public.provider_profiles on provider_profiles.id = services.provider_id
  where services.id = target_service_id
    and provider_profiles.user_id = auth.uid()
  for update of services;

  if service_status is null then
    raise exception 'Service not found or does not belong to this provider';
  end if;

  if service_status <> 'active' then
    raise exception 'Only an approved service can change live availability';
  end if;

  if current_availability is distinct from available then
    update public.services
    set is_available = available,
        updated_at = now()
    where id = target_service_id;
  end if;
end;
$$;

revoke all on function public.provider_set_service_availability(uuid, boolean) from public;
grant execute on function public.provider_set_service_availability(uuid, boolean) to authenticated;

commit;
