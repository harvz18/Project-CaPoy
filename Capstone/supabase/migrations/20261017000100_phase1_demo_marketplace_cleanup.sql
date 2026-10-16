-- Phase 1: retire excess demo marketplace listings without altering
-- historical bookings, payments, financial records, reviews, or Auth users.
--
-- The affected accounts retain access only because the live database contains
-- protected booking and coordinator history. Their public listings are retired
-- and equivalent demo listings are recreated under the retained providers.

begin;

-- The existing moderation triggers recognise service-role maintenance work.
-- This does not disable RLS, foreign keys, or any integrity checks.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  target_count integer;
  retained_count integer;
begin
  select count(*) into target_count
  from public.profiles
  where (id, lower(email), default_role::text) in (
    ('a1100000-0000-4000-8000-000000000004'::uuid, 'provider4@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000005'::uuid, 'provider5@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000006'::uuid, 'provider6@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000007'::uuid, 'provider7@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000008'::uuid, 'provider8@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000009'::uuid, 'provider9@multivent.com', 'service_provider'),
    ('a1100000-0000-4000-8000-000000000103'::uuid, 'coordinator3@multivent.com', 'event_coordinator'),
    ('a1100000-0000-4000-8000-000000000104'::uuid, 'coordinator4@multivent.com', 'event_coordinator')
  );

  if target_count <> 8 then
    raise exception 'Phase 1 stopped: expected exactly 8 verified demo targets, found %.', target_count;
  end if;

  select count(*) into retained_count
  from public.profiles profile
  join public.provider_profiles provider on provider.user_id = profile.id
  where (profile.id, lower(profile.email), profile.default_role::text, profile.account_status::text) in (
    ('a1100000-0000-4000-8000-000000000001'::uuid, 'provider1@multivent.com', 'service_provider', 'active'),
    ('a1100000-0000-4000-8000-000000000002'::uuid, 'provider2@multivent.com', 'service_provider', 'active'),
    ('a1100000-0000-4000-8000-000000000003'::uuid, 'provider3@multivent.com', 'service_provider', 'active')
  )
    and provider.verification_status in ('active', 'verified');

  if retained_count <> 3 then
    raise exception 'Phase 1 stopped: the three retained provider accounts are not active and verified.';
  end if;
end;
$$;

create temporary table phase1_provider_map (
  source_user_id uuid primary key,
  target_user_id uuid not null
) on commit drop;

insert into phase1_provider_map (source_user_id, target_user_id) values
  ('a1100000-0000-4000-8000-000000000004', 'a1100000-0000-4000-8000-000000000001'), -- Catering -> Provider 1
  ('a1100000-0000-4000-8000-000000000005', 'a1100000-0000-4000-8000-000000000002'), -- Venues -> Provider 2
  ('a1100000-0000-4000-8000-000000000006', 'a1100000-0000-4000-8000-000000000001'), -- Venues -> Provider 1
  ('a1100000-0000-4000-8000-000000000007', 'a1100000-0000-4000-8000-000000000003'), -- Sound & Lights -> Provider 3
  ('a1100000-0000-4000-8000-000000000008', 'a1100000-0000-4000-8000-000000000003'), -- Photography -> Provider 3
  ('a1100000-0000-4000-8000-000000000009', 'a1100000-0000-4000-8000-000000000002'); -- Host/Emcee -> Provider 2

-- Recreate equivalent listings under the retained accounts. The original
-- records are never reassigned: their ownership remains historically correct.
insert into public.services (
  provider_id, category_id, name, description, base_price, location,
  cover_image_url, status, gallery_urls, pricing_model, pricing_unit,
  pricing_details, moderation_note, moderated_at, moderated_by,
  submission_kind, last_approved_snapshot, is_available,
  catering_service_types, category_details
)
select
  target_provider.id,
  source.category_id,
  source.name || ' — ' || target_profile.full_name || ' Edition',
  concat_ws(E'\n\n', source.description,
    'This demo listing is now managed by ' || target_provider.business_name || '.'),
  source.base_price,
  source.location,
  source.cover_image_url,
  'active',
  source.gallery_urls,
  source.pricing_model,
  source.pricing_unit,
  source.pricing_details,
  'Created during Phase 1 demo marketplace redistribution.',
  now(),
  null,
  'new',
  jsonb_build_object('phase1_source_service_id', source.id::text),
  true,
  source.catering_service_types,
  source.category_details
from public.services source
join public.provider_profiles source_provider on source_provider.id = source.provider_id
join phase1_provider_map mapping on mapping.source_user_id = source_provider.user_id
join public.provider_profiles target_provider on target_provider.user_id = mapping.target_user_id
join public.profiles target_profile on target_profile.id = target_provider.user_id
where source.status = 'active'
  and source.is_available = true
  and not exists (
    select 1
    from public.services prior_clone
    where prior_clone.provider_id = target_provider.id
      and prior_clone.last_approved_snapshot ->> 'phase1_source_service_id' = source.id::text
  );

-- Preserve package functionality for the redistributed marketplace listings.
insert into public.service_packages (
  service_id, name, description, price, inclusions, is_active, pricing_unit,
  pricing_mode, subtotal, discount_type, discount_value, discount_amount,
  is_deleted
)
select
  cloned_host.id,
  source_package.name || ' — ' || target_profile.full_name || ' Edition',
  concat_ws(E'\n\n', source_package.description,
    'This demo package is now managed by ' || target_provider.business_name || '.'),
  source_package.price,
  source_package.inclusions,
  true,
  source_package.pricing_unit,
  source_package.pricing_mode,
  source_package.subtotal,
  source_package.discount_type,
  source_package.discount_value,
  source_package.discount_amount,
  false
from public.service_packages source_package
join public.services source_host on source_host.id = source_package.service_id
join public.provider_profiles source_provider on source_provider.id = source_host.provider_id
join phase1_provider_map mapping on mapping.source_user_id = source_provider.user_id
join public.provider_profiles target_provider on target_provider.user_id = mapping.target_user_id
join public.profiles target_profile on target_profile.id = target_provider.user_id
join public.services cloned_host
  on cloned_host.provider_id = target_provider.id
 and cloned_host.last_approved_snapshot ->> 'phase1_source_service_id' = source_host.id::text
where source_package.is_active = true
  and source_package.is_deleted = false
  and not exists (
    select 1
    from public.service_packages prior_clone
    where prior_clone.service_id = cloned_host.id
      and prior_clone.name = source_package.name || ' — ' || target_profile.full_name || ' Edition'
  );

insert into public.service_package_items (
  package_id, service_id, quantity, unit_price, position
)
select
  cloned_package.id,
  cloned_item_service.id,
  source_item.quantity,
  source_item.unit_price,
  source_item.position
from public.service_package_items source_item
join public.service_packages source_package on source_package.id = source_item.package_id
join public.services source_host on source_host.id = source_package.service_id
join public.provider_profiles source_provider on source_provider.id = source_host.provider_id
join phase1_provider_map mapping on mapping.source_user_id = source_provider.user_id
join public.provider_profiles target_provider on target_provider.user_id = mapping.target_user_id
join public.profiles target_profile on target_profile.id = target_provider.user_id
join public.services cloned_host
  on cloned_host.provider_id = target_provider.id
 and cloned_host.last_approved_snapshot ->> 'phase1_source_service_id' = source_host.id::text
join public.service_packages cloned_package
  on cloned_package.service_id = cloned_host.id
 and cloned_package.name = source_package.name || ' — ' || target_profile.full_name || ' Edition'
join public.services cloned_item_service
  on cloned_item_service.provider_id = target_provider.id
 and cloned_item_service.last_approved_snapshot ->> 'phase1_source_service_id' = source_item.service_id::text
on conflict (package_id, service_id) do nothing;

-- Remove the old accounts' listings from all new marketplace discovery while
-- preserving the source services, their booked packages, and every reference.
update public.services source
set status = 'deleted',
    is_available = false,
    moderation_note = 'Archived from new marketplace bookings during Phase 1 demo cleanup; historical records retained.',
    moderated_at = now(),
    moderated_by = null,
    updated_at = now()
from public.provider_profiles source_provider
where source.provider_id = source_provider.id
  and source_provider.user_id in (
    'a1100000-0000-4000-8000-000000000004'::uuid,
    'a1100000-0000-4000-8000-000000000005'::uuid,
    'a1100000-0000-4000-8000-000000000006'::uuid,
    'a1100000-0000-4000-8000-000000000007'::uuid,
    'a1100000-0000-4000-8000-000000000008'::uuid,
    'a1100000-0000-4000-8000-000000000009'::uuid,
    'a1100000-0000-4000-8000-000000000103'::uuid,
    'a1100000-0000-4000-8000-000000000104'::uuid
  )
  and source.status <> 'deleted';

-- A package hosted by, or composed from, an archived listing cannot be sold
-- again. It remains intact for booked-package and financial history.
update public.service_packages package
set is_active = false,
    is_deleted = true,
    deleted_at = coalesce(package.deleted_at, now()),
    deleted_by = null,
    updated_at = now()
where package.id in (
  select distinct package_to_archive.id
  from public.service_packages package_to_archive
  left join public.service_package_items item on item.package_id = package_to_archive.id
  where package_to_archive.service_id in (
    select service.id
    from public.services service
    join public.provider_profiles provider on provider.id = service.provider_id
    where provider.user_id in (
      'a1100000-0000-4000-8000-000000000004'::uuid,
      'a1100000-0000-4000-8000-000000000005'::uuid,
      'a1100000-0000-4000-8000-000000000006'::uuid,
      'a1100000-0000-4000-8000-000000000007'::uuid,
      'a1100000-0000-4000-8000-000000000008'::uuid,
      'a1100000-0000-4000-8000-000000000009'::uuid,
      'a1100000-0000-4000-8000-000000000103'::uuid,
      'a1100000-0000-4000-8000-000000000104'::uuid
    )
  )
     or item.service_id in (
       select service.id
       from public.services service
       join public.provider_profiles provider on provider.id = service.provider_id
       where provider.user_id in (
         'a1100000-0000-4000-8000-000000000004'::uuid,
         'a1100000-0000-4000-8000-000000000005'::uuid,
         'a1100000-0000-4000-8000-000000000006'::uuid,
         'a1100000-0000-4000-8000-000000000007'::uuid,
         'a1100000-0000-4000-8000-000000000008'::uuid,
         'a1100000-0000-4000-8000-000000000009'::uuid,
         'a1100000-0000-4000-8000-000000000103'::uuid,
         'a1100000-0000-4000-8000-000000000104'::uuid
       )
     )
);

-- Coordinators 3 and 4 retain access for their assigned events but are no
-- longer available for new coordinator bookings.
update public.coordinator_service_profiles
set is_accepting_bookings = false,
    updated_at = now()
where coordinator_id in (
  'a1100000-0000-4000-8000-000000000103'::uuid,
  'a1100000-0000-4000-8000-000000000104'::uuid
);

insert into public.audit_logs (
  actor_id, actor_role, action, resource_type, resource_id,
  previous_state, new_state, result, metadata
)
select
  null,
  null,
  'phase1_demo_marketplace_archival',
  'profile',
  target.id,
  jsonb_build_object('account_status', target.account_status, 'default_role', target.default_role),
  jsonb_build_object('account_status', target.account_status, 'marketplace_state', 'archived_for_new_bookings'),
  'completed',
  jsonb_build_object('source', '20261017000100_phase1_demo_marketplace_cleanup')
from public.profiles target
where target.id in (
  'a1100000-0000-4000-8000-000000000004'::uuid,
  'a1100000-0000-4000-8000-000000000005'::uuid,
  'a1100000-0000-4000-8000-000000000006'::uuid,
  'a1100000-0000-4000-8000-000000000007'::uuid,
  'a1100000-0000-4000-8000-000000000008'::uuid,
  'a1100000-0000-4000-8000-000000000009'::uuid,
  'a1100000-0000-4000-8000-000000000103'::uuid,
  'a1100000-0000-4000-8000-000000000104'::uuid
)
  and not exists (
    select 1
    from public.audit_logs existing
    where existing.action = 'phase1_demo_marketplace_archival'
      and existing.resource_type = 'profile'
      and existing.resource_id = target.id
      and existing.metadata ->> 'source' = '20261017000100_phase1_demo_marketplace_cleanup'
  );

commit;
