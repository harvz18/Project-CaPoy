-- MULTIVENT Revision V18, Phase 5: structured Photo/Video packages reuse the
-- established service_packages lifecycle and preserve historical snapshots.

begin;

alter table public.service_packages
  add column if not exists configuration jsonb not null default '{}'::jsonb,
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

alter table public.service_packages
  drop constraint if exists service_packages_configuration_object_check,
  add constraint service_packages_configuration_object_check
    check (jsonb_typeof(configuration) = 'object'),
  drop constraint if exists service_packages_image_urls_array_check,
  add constraint service_packages_image_urls_array_check
    check (jsonb_typeof(image_urls) = 'array');

create or replace function public.validate_v18_photo_video_package()
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
  package_active boolean;
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

  -- Inactive package rows are provider drafts or deactivated history. They
  -- remain non-client-visible and become fully validated when activated.
  if new.is_active is not true then
    return new;
  end if;

  if nullif(trim(new.configuration ->> 'name'), '') is null
    or coalesce(nullif(new.configuration ->> 'price', '')::numeric, 0) <= 0
    or nullif(trim(new.configuration ->> 'coverageConfigurationId'), '') is null
  then
    raise exception 'A Photo/Video package needs a name, positive base price, and coverage configuration.';
  end if;
  if jsonb_typeof(new.configuration -> 'eventTypes') <> 'array'
    or jsonb_array_length(new.configuration -> 'eventTypes') = 0
    or jsonb_typeof(new.configuration -> 'deliverableIds') <> 'array'
    or jsonb_array_length(new.configuration -> 'deliverableIds') = 0
  then
    raise exception 'A Photo/Video package needs supported event types and included deliverables.';
  end if;
  if coalesce(nullif(new.configuration ->> 'includedLocationCount', '')::numeric, 0) < 1
    or coalesce(nullif(new.configuration ->> 'maximumAdditionalCrew', '')::numeric, 0) < 0
    or coalesce(nullif(new.configuration ->> 'maximumCoverageExtensionHours', '')::numeric, 0) < 0
    or coalesce(nullif(new.configuration ->> 'maximumAdditionalDeliverables', '')::numeric, 0) < 0
  then
    raise exception 'Photo/Video package limits must be non-negative and include at least one location.';
  end if;
  if jsonb_typeof(new.configuration -> 'allowedAdditionalCrewOptionIds') <> 'array'
    or jsonb_typeof(new.configuration -> 'allowedAdditionalServiceIds') <> 'array'
  then
    raise exception 'Photo/Video package allowed upgrades must be lists.';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(service_details -> 'coverageConfigurations', '[]'::jsonb)) coverage(value)
    where coverage.value ->> 'id' = new.configuration ->> 'coverageConfigurationId'
  ) then
    raise exception 'The Photo/Video package coverage configuration is unavailable.';
  end if;
  for package_event_type in select value from jsonb_array_elements_text(new.configuration -> 'eventTypes')
  loop
    if not exists (
      select 1 from jsonb_array_elements_text(coalesce(service_details -> 'eventTypes', '[]'::jsonb)) event_type(value)
      where event_type.value = package_event_type
    ) then
      raise exception 'The Photo/Video package includes an unsupported event type.';
    end if;
  end loop;
  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'deliverableIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'deliverableConfigurations', '[]'::jsonb)) deliverable(value)
      where deliverable.value ->> 'id' = referenced_id
    ) then
      raise exception 'The Photo/Video package includes an unavailable deliverable.';
    end if;
  end loop;
  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'allowedAdditionalCrewOptionIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'additionalCrewOptions', '[]'::jsonb)) crew(value)
      where crew.value ->> 'id' = referenced_id
    ) then
      raise exception 'The Photo/Video package includes an unavailable additional crew option.';
    end if;
  end loop;
  for referenced_id in select value from jsonb_array_elements_text(new.configuration -> 'allowedAdditionalServiceIds')
  loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(service_details -> 'additionalServices', '[]'::jsonb)) additional_service(value)
      where additional_service.value ->> 'id' = referenced_id
    ) then
      raise exception 'The Photo/Video package includes an unavailable additional service.';
    end if;
  end loop;

  package_active := coalesce((new.configuration ->> 'isActive')::boolean, true);
  new.name := new.configuration ->> 'name';
  new.description := nullif(trim(new.configuration ->> 'description'), '');
  new.price := (new.configuration ->> 'price')::numeric;
  new.inclusions := array(select value from jsonb_array_elements_text(new.configuration -> 'deliverableIds'));
  new.pricing_unit := 'event';
  new.is_active := new.is_active and package_active;
  return new;
end;
$$;

drop trigger if exists validate_v18_photo_video_package_trigger on public.service_packages;
create trigger validate_v18_photo_video_package_trigger
before insert or update of service_id, name, description, price, inclusions, pricing_unit, configuration, image_urls, is_active
on public.service_packages
for each row execute function public.validate_v18_photo_video_package();

revoke all on function public.validate_v18_photo_video_package() from public;

commit;
