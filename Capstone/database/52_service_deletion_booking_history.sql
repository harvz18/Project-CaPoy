-- MULTIVENT provider listings: always preserve services referenced by bookings.
-- Apply after 51_category_specific_service_details.sql.

begin;

-- Reassert the recoverable deletion behavior as a new migration. Older
-- installations may still have migration 22's conditional hard-delete
-- function, which can race with or fail against bookings_service_id_fkey.
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

  -- Never physically delete a service. Bookings, payments, reviews, audit
  -- records, and package history must retain their original service reference.
  update public.services
  set status = 'deleted',
      is_available = false,
      moderation_note = 'Deleted by provider',
      moderated_at = now(),
      moderated_by = null,
      updated_at = now()
  where id = owned_service_id;

  -- Packages primarily hosted by this service move to Deleted as well.
  update public.service_packages
  set is_deleted = true,
      is_active = false,
      deleted_at = coalesce(deleted_at, now()),
      deleted_by = auth.uid(),
      updated_at = now()
  where service_id = owned_service_id;

  -- A bundle containing the removed service cannot stay purchasable. Preserve
  -- it for editing/history, but keep it hidden until its composition changes.
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

comment on function public.provider_delete_service(uuid) is
  'Soft-deletes a provider-owned service without deleting booking or package history.';

commit;
