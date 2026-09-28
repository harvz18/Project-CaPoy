-- MULTIVENT provider listings adjustment: recoverable service and package removal.
-- Apply after 48_service_moderation_status_compatibility.sql.

begin;

alter table public.service_packages
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists service_packages_provider_deleted_idx
  on public.service_packages (service_id, is_deleted, updated_at desc);

comment on column public.service_packages.is_deleted is
  'Soft-deletion marker. Removed packages remain available to their provider and historical bookings but are hidden from the marketplace.';

-- A removed package must never become visible again through a later service
-- approval or component price refresh.
create or replace function public.enforce_deleted_package_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_deleted then
    new.is_active := false;
    new.deleted_at := coalesce(new.deleted_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_deleted_package_visibility_trigger
  on public.service_packages;
create trigger enforce_deleted_package_visibility_trigger
before insert or update of is_deleted, is_active, deleted_at
on public.service_packages
for each row execute function public.enforce_deleted_package_visibility();

revoke all on function public.enforce_deleted_package_visibility() from public;

-- Marketplace reads exclude removed packages. The separate booked-package
-- policy remains unchanged so existing clients retain their booking history.
drop policy if exists "Active service packages are publicly readable"
  on public.service_packages;
create policy "Active service packages are publicly readable"
  on public.service_packages for select
  using (
    is_active = true
    and is_deleted = false
    and exists (
      select 1
      from public.services
      where services.id = service_packages.service_id
        and services.status = 'active'
        and services.is_available = true
    )
  );

drop policy if exists "Public view published package services"
  on public.service_package_items;
create policy "Public view published package services"
  on public.service_package_items for select to anon, authenticated
  using (
    exists (
      select 1
      from public.service_packages package
      join public.services host_service on host_service.id = package.service_id
      where package.id = service_package_items.package_id
        and package.is_active = true
        and package.is_deleted = false
        and host_service.status = 'active'
        and host_service.is_available = true
    )
  );

create or replace function public.provider_delete_package(target_package_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_package_id uuid;
begin
  select package.id into owned_package_id
  from public.service_packages package
  join public.services service on service.id = package.service_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  where package.id = target_package_id
    and provider.user_id = auth.uid()
    and profile.account_status in ('active', 'verified')
  for update of package;

  if owned_package_id is null then
    raise exception 'Package not found or does not belong to this provider.'
      using errcode = '42501';
  end if;

  perform set_config('app.service_delete_authorized', 'true', true);

  update public.service_packages
  set is_deleted = true,
      is_active = false,
      deleted_at = coalesce(deleted_at, now()),
      deleted_by = auth.uid(),
      updated_at = now()
  where id = owned_package_id;
end;
$$;

revoke all on function public.provider_delete_package(uuid) from public;
grant execute on function public.provider_delete_package(uuid) to authenticated;

-- Always preserve a removed service row. Older behavior hard-deleted services
-- with no bookings, which made a reliable Deleted tab impossible.
create or replace function public.provider_delete_service(target_service_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid;
  owned_service_id uuid;
begin
  select provider.id into current_provider_id
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1;

  if current_provider_id is null then
    raise exception 'An active service-provider account is required.'
      using errcode = '42501';
  end if;

  select service.id into owned_service_id
  from public.services service
  where service.id = target_service_id
    and service.provider_id = current_provider_id
  for update;

  if owned_service_id is null then
    raise exception 'Service not found or does not belong to this provider.';
  end if;

  perform set_config('app.service_delete_authorized', 'true', true);

  update public.services
  set status = 'deleted',
      is_available = false,
      moderation_note = 'Deleted by provider',
      moderated_at = now(),
      moderated_by = null,
      updated_at = now()
  where id = owned_service_id;

  -- Packages hosted by the removed service cannot be reassigned safely, so
  -- move them to Deleted too. Packages merely containing this service are
  -- hidden until the provider edits their composition.
  update public.service_packages
  set is_deleted = true,
      is_active = false,
      deleted_at = coalesce(deleted_at, now()),
      deleted_by = auth.uid(),
      updated_at = now()
  where service_id = owned_service_id;

  update public.service_packages package
  set is_active = false,
      updated_at = now()
  where package.is_deleted = false
    and package.id in (
      select item.package_id
      from public.service_package_items item
      where item.service_id = owned_service_id
    );
end;
$$;

revoke all on function public.provider_delete_service(uuid) from public;
grant execute on function public.provider_delete_service(uuid) to authenticated;

comment on function public.provider_delete_package(uuid) is
  'Soft-deletes a provider-owned package and immediately removes it from marketplace visibility.';
comment on function public.provider_delete_service(uuid) is
  'Soft-deletes a provider-owned service while preserving listing and booking history.';

commit;
