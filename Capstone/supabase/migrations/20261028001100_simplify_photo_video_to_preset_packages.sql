-- Photo/Video bookings now use provider preset packages only.  The existing
-- V18 snapshot and pricing contracts remain in place so package inclusions and
-- optional paid upgrades are still calculated server-side and visible to the
-- provider after a client books them.

begin;

-- Add a second fixed preset and the explicitly selectable inclusions needed by
-- the package-only client screen. Existing base coverage remains unchanged.
update public.services service
set category_details = service.category_details || jsonb_build_object(
  'coverageConfigurations', coalesce(service.category_details -> 'coverageConfigurations', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'id', 'extended-event-coverage',
      'name', 'Extended event coverage',
      'durationHours', coalesce(nullif(service.category_details ->> 'coverageDurationHours', '')::integer, 6) + 2,
      'price', round(service.base_price * 1.32, 2),
      'includedCrew', jsonb_build_array(jsonb_build_object('role', 'Photographer', 'quantity', 1))
    )),
  'deliverableConfigurations', coalesce(service.category_details -> 'deliverableConfigurations', '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object(
        'id', 'fine-art-album', 'name', 'Fine-art printed album', 'mediaType', 'photo',
        'pricingMode', 'fixed', 'price', greatest(2500, round(service.base_price * 0.12, 2)),
        'includedQuantity', 0, 'maximumQuantity', 1, 'turnaroundDays', 21,
        'requiredCrewRoles', jsonb_build_array('Photographer')
      ),
      jsonb_build_object(
        'id', 'same-day-teaser', 'name', 'Same-day teaser edit', 'mediaType', 'photo',
        'pricingMode', 'fixed', 'price', greatest(1800, round(service.base_price * 0.08, 2)),
        'includedQuantity', 0, 'maximumQuantity', 1, 'turnaroundDays', 1,
        'requiredCrewRoles', jsonb_build_array('Photographer')
      )
    ),
  'additionalServices', jsonb_build_array(jsonb_build_object(
    'id', 'priority-editing', 'name', 'Priority editing',
    'price', greatest(1500, round(service.base_price * 0.07, 2)),
    'pricingUnit', 'event', 'maximumQuantity', 1,
    'requiredCrewRoles', jsonb_build_array('Photographer')
  )),
  'additionalHoursAllowed', true,
  'maximumAdditionalHours', 2,
  'additionalHourRate', greatest(1200, round(service.base_price / greatest(coalesce(nullif(service.category_details ->> 'coverageDurationHours', '')::numeric, 6), 1) * 0.8, 2)),
  'photoVideoBookingMode', 'preset_packages',
  'photoVideoPresetPackagesVersion', '20261028'
), updated_at = now()
from public.service_categories category,
     public.provider_profiles provider,
     public.profiles owner
where category.id = service.category_id
  and provider.id = service.provider_id
  and owner.id = provider.user_id
  and category.name = 'Photography'
  and service.status = 'active'
  and service.is_available = true
  and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
  and service.category_details ->> 'photoVideoPresetPackagesVersion' is distinct from '20261028';

-- service_packages.inclusions is JSON in the live schema. The original V18
-- trigger writes a PostgreSQL text array, which makes otherwise valid package
-- inserts fail. Keep the same validation contract while storing the selected
-- deliverable IDs as JSON.
create or replace function public.validate_v18_photo_video_package_jsonb()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  service_details jsonb;
  package_event_type text;
  referenced_id text;
begin
  select lower(trim(category.name)), service.category_details
  into category_name, service_details
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = new.service_id;

  if category_name not like '%photo%'
    or coalesce(new.configuration ->> 'kind', '') <> 'photo_video'
  then
    return new;
  end if;
  if new.is_active is not true then return new; end if;

  if nullif(trim(new.configuration ->> 'name'), '') is null
    or coalesce(nullif(new.configuration ->> 'price', '')::numeric, 0) <= 0
    or nullif(trim(new.configuration ->> 'coverageConfigurationId'), '') is null
    or jsonb_typeof(new.configuration -> 'eventTypes') <> 'array'
    or jsonb_array_length(new.configuration -> 'eventTypes') = 0
    or jsonb_typeof(new.configuration -> 'deliverableIds') <> 'array'
    or jsonb_array_length(new.configuration -> 'deliverableIds') = 0
    or jsonb_typeof(new.configuration -> 'allowedAdditionalCrewOptionIds') <> 'array'
    or jsonb_typeof(new.configuration -> 'allowedAdditionalServiceIds') <> 'array'
    or coalesce(nullif(new.configuration ->> 'includedLocationCount', '')::numeric, 0) < 1
    or coalesce(nullif(new.configuration ->> 'maximumAdditionalCrew', '')::numeric, 0) < 0
    or coalesce(nullif(new.configuration ->> 'maximumCoverageExtensionHours', '')::numeric, 0) < 0
    or coalesce(nullif(new.configuration ->> 'maximumAdditionalDeliverables', '')::numeric, 0) < 0
  then
    raise exception 'A Photo/Video package needs valid coverage, inclusions, supported event types, and limits.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(coalesce(service_details -> 'coverageConfigurations', '[]'::jsonb)) coverage(value)
    where coverage.value ->> 'id' = new.configuration ->> 'coverageConfigurationId'
  ) then raise exception 'The Photo/Video package coverage configuration is unavailable.'; end if;

  for package_event_type in select value from jsonb_array_elements_text(new.configuration -> 'eventTypes')
  loop
    if not exists (
      select 1 from jsonb_array_elements_text(coalesce(service_details -> 'eventTypes', '[]'::jsonb)) event_type(value)
      where event_type.value = package_event_type
    ) then raise exception 'The Photo/Video package includes an unsupported event type.'; end if;
  end loop;

  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'deliverableIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'deliverableConfigurations', '[]'::jsonb)) deliverable(value)
      where deliverable.value ->> 'id' = referenced_id
    ) then raise exception 'The Photo/Video package includes an unavailable deliverable.'; end if;
  end loop;
  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'allowedAdditionalCrewOptionIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'additionalCrewOptions', '[]'::jsonb)) crew(value)
      where crew.value ->> 'id' = referenced_id
    ) then raise exception 'The Photo/Video package includes an unavailable additional crew option.'; end if;
  end loop;
  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'allowedAdditionalServiceIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'additionalServices', '[]'::jsonb)) additional_service(value)
      where additional_service.value ->> 'id' = referenced_id
    ) then raise exception 'The Photo/Video package includes an unavailable additional service.'; end if;
  end loop;

  new.name := new.configuration ->> 'name';
  new.description := nullif(trim(new.configuration ->> 'description'), '');
  new.price := (new.configuration ->> 'price')::numeric;
  new.inclusions := new.configuration -> 'deliverableIds';
  new.pricing_unit := 'event';
  new.is_active := new.is_active and coalesce((new.configuration ->> 'isActive')::boolean, true);
  return new;
end;
$$;

drop trigger if exists validate_v18_photo_video_package_trigger on public.service_packages;
create trigger validate_v18_photo_video_package_trigger
before insert or update of service_id, name, description, price, inclusions, pricing_unit, configuration, image_urls, is_active
on public.service_packages
for each row execute function public.validate_v18_photo_video_package_jsonb();

revoke all on function public.validate_v18_photo_video_package_jsonb() from public;

-- The existing Photo/Video package validator and quote endpoint protect these
-- records. They are ordinary service packages, selected once per booking.
insert into public.service_packages (
  service_id, name, description, price, inclusions, pricing_unit, pricing_mode,
  is_active, configuration
)
select
  service.id,
  'Essential coverage',
  concat(coalesce(nullif(service.category_details ->> 'coverageDurationHours', ''), '6'), '-hour preset coverage with an edited digital gallery.'),
  service.base_price,
  jsonb_build_array('digital-gallery'),
  'event',
  'legacy',
  true,
  jsonb_build_object(
    'kind', 'photo_video',
    'name', 'Essential coverage',
    'description', concat(coalesce(nullif(service.category_details ->> 'coverageDurationHours', ''), '6'), '-hour preset coverage with an edited digital gallery.'),
    'price', service.base_price,
    'isActive', true,
    'coverageConfigurationId', 'standard-photo-coverage',
    'deliverableIds', jsonb_build_array('digital-gallery'),
    'eventTypes', service.category_details -> 'eventTypes',
    'includedLocationCount', 1,
    'maximumAdditionalCrew', 0,
    'maximumAdditionalDeliverables', 2,
    'maximumCoverageExtensionHours', 2,
    'allowedAdditionalCrewOptionIds', '[]'::jsonb,
    'allowedAdditionalServiceIds', jsonb_build_array('priority-editing')
  )
from public.services service
join public.service_categories category on category.id = service.category_id
join public.provider_profiles provider on provider.id = service.provider_id
join public.profiles owner on owner.id = provider.user_id
where category.name = 'Photography'
  and service.status in ('active', 'pending_review')
  and service.is_available = true
  and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
  and service.category_details ->> 'photoVideoPresetPackagesVersion' = '20261028'
  and not exists (
    select 1 from public.service_packages package
    where package.service_id = service.id
      and package.configuration ->> 'kind' = 'photo_video'
  );

insert into public.service_packages (
  service_id, name, description, price, inclusions, pricing_unit, pricing_mode,
  is_active, configuration
)
select
  service.id,
  'Extended celebration coverage',
  concat((coalesce(nullif(service.category_details ->> 'coverageDurationHours', '')::integer, 6) + 2), '-hour preset coverage with an edited digital gallery.'),
  round(service.base_price * 1.32, 2),
  jsonb_build_array('digital-gallery'),
  'event',
  'legacy',
  true,
  jsonb_build_object(
    'kind', 'photo_video',
    'name', 'Extended celebration coverage',
    'description', concat((coalesce(nullif(service.category_details ->> 'coverageDurationHours', '')::integer, 6) + 2), '-hour preset coverage with an edited digital gallery.'),
    'price', round(service.base_price * 1.32, 2),
    'isActive', true,
    'coverageConfigurationId', 'extended-event-coverage',
    'deliverableIds', jsonb_build_array('digital-gallery'),
    'eventTypes', service.category_details -> 'eventTypes',
    'includedLocationCount', 1,
    'maximumAdditionalCrew', 0,
    'maximumAdditionalDeliverables', 2,
    'maximumCoverageExtensionHours', 2,
    'allowedAdditionalCrewOptionIds', '[]'::jsonb,
    'allowedAdditionalServiceIds', jsonb_build_array('priority-editing')
  )
from public.services service
join public.service_categories category on category.id = service.category_id
join public.provider_profiles provider on provider.id = service.provider_id
join public.profiles owner on owner.id = provider.user_id
where category.name = 'Photography'
  and service.status in ('active', 'pending_review')
  and service.is_available = true
  and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
  and service.category_details ->> 'photoVideoPresetPackagesVersion' = '20261028'
  and not exists (
    select 1 from public.service_packages package
    where package.service_id = service.id
      and package.configuration ->> 'kind' = 'photo_video'
      and package.configuration ->> 'coverageConfigurationId' = 'extended-event-coverage'
  );

-- The service-details update follows the normal moderation transition.
select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  target_service_id uuid;
begin
  for target_service_id in
    select service.id
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where service.status = 'pending_review'
      and category.name = 'Photography'
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and service.category_details ->> 'photoVideoPresetPackagesVersion' = '20261028'
  loop
    perform public.admin_review_service(target_service_id, 'approved', 'Preset Photo/Video packages verified for booking.');
  end loop;
end;
$$;

commit;
