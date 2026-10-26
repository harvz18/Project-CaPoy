-- MULTIVENT Revision V18, Phase 4: provider-defined deliverables and
-- additional services. Existing listings remain untouched unless they opt in.

begin;

create or replace function public.validate_v18_photo_video_deliverables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  service_type text;
  deliverable_row jsonb;
  additional_service_row jsonb;
  required_crew_role text;
  deliverable_count integer;
  unique_deliverable_count integer;
  additional_service_count integer;
  unique_additional_service_count integer;
begin
  select lower(trim(category.name))
  into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%photo%'
    or not (new.category_details ? 'deliverableConfigurations')
    or new.status::text not in ('pending_review', 'active')
  then
    return new;
  end if;

  service_type := nullif(trim(new.category_details ->> 'photoVideoServiceType'), '');
  if service_type is null or service_type not in ('photography', 'videography', 'combined') then
    raise exception 'A valid Photo/Video service type is required for deliverables.';
  end if;
  if jsonb_typeof(new.category_details -> 'deliverableConfigurations') <> 'array'
    or jsonb_array_length(new.category_details -> 'deliverableConfigurations') = 0
  then
    raise exception 'Add at least one promised Photo/Video deliverable.';
  end if;

  select count(*), count(distinct deliverable.value ->> 'id')
  into deliverable_count, unique_deliverable_count
  from jsonb_array_elements(new.category_details -> 'deliverableConfigurations') deliverable(value);
  if deliverable_count <> unique_deliverable_count
    or exists (
      select 1 from jsonb_array_elements(new.category_details -> 'deliverableConfigurations') deliverable(value)
      where nullif(trim(deliverable.value ->> 'id'), '') is null
    )
  then
    raise exception 'Every Photo/Video deliverable needs a unique ID.';
  end if;

  for deliverable_row in select value from jsonb_array_elements(new.category_details -> 'deliverableConfigurations')
  loop
    if nullif(trim(deliverable_row ->> 'name'), '') is null
      or coalesce(deliverable_row ->> 'mediaType', '') not in ('photo', 'video', 'both')
      or coalesce(deliverable_row ->> 'pricingMode', '') not in ('included', 'fixed', 'per_unit', 'per_hour')
    then
      raise exception 'Every Photo/Video deliverable needs a name, supported media type, and valid pricing mode.';
    end if;
    if (service_type = 'photography' and deliverable_row ->> 'mediaType' <> 'photo')
      or (service_type = 'videography' and deliverable_row ->> 'mediaType' <> 'video')
    then
      raise exception 'A deliverable is not supported by this Photo/Video service type.';
    end if;
    if deliverable_row ->> 'pricingMode' <> 'included'
      and coalesce(nullif(deliverable_row ->> 'price', '')::numeric, 0) <= 0
    then
      raise exception 'Paid Photo/Video deliverables need a positive provider price.';
    end if;
    if coalesce(nullif(deliverable_row ->> 'includedQuantity', '')::numeric, 0) < 0
      or coalesce(nullif(deliverable_row ->> 'maximumQuantity', '')::numeric, 0) < 0
      or coalesce(nullif(deliverable_row ->> 'turnaroundDays', '')::numeric, 0) < 0
    then
      raise exception 'Photo/Video deliverable quantities and turnaround cannot be negative.';
    end if;
    if deliverable_row ->> 'pricingMode' = 'included'
      and coalesce(nullif(deliverable_row ->> 'includedQuantity', '')::numeric, 0) < 1
    then
      raise exception 'Included Photo/Video deliverables need an included quantity.';
    end if;
    if coalesce(nullif(deliverable_row ->> 'maximumQuantity', '')::numeric, 0) > 0
      and coalesce(nullif(deliverable_row ->> 'includedQuantity', '')::numeric, 0)
        > (deliverable_row ->> 'maximumQuantity')::numeric
    then
      raise exception 'A Photo/Video deliverable maximum quantity cannot be below its included quantity.';
    end if;
    if jsonb_typeof(deliverable_row -> 'requiredCrewRoles') <> 'array' then
      raise exception 'Photo/Video deliverable crew requirements must be a list.';
    end if;
    for required_crew_role in select value from jsonb_array_elements_text(deliverable_row -> 'requiredCrewRoles')
    loop
      if nullif(trim(required_crew_role), '') is null then
        raise exception 'Photo/Video deliverable crew requirements cannot be blank.';
      end if;
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(new.category_details -> 'coverageConfigurations', '[]'::jsonb)) coverage(value)
        cross join lateral jsonb_array_elements(coalesce(coverage.value -> 'includedCrew', '[]'::jsonb)) crew(value)
        where lower(trim(crew.value ->> 'role')) = lower(trim(required_crew_role))
      ) and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.category_details -> 'additionalCrewOptions', '[]'::jsonb)) crew(value)
        where lower(trim(crew.value ->> 'role')) = lower(trim(required_crew_role))
      ) then
        raise exception 'A Photo/Video deliverable requires a crew role that this provider has not configured.';
      end if;
    end loop;
  end loop;

  if new.category_details ? 'additionalServices' then
    if jsonb_typeof(new.category_details -> 'additionalServices') <> 'array' then
      raise exception 'Photo/Video additional services must be a list.';
    end if;
    select count(*), count(distinct service.value ->> 'id')
    into additional_service_count, unique_additional_service_count
    from jsonb_array_elements(new.category_details -> 'additionalServices') service(value);
    if additional_service_count <> unique_additional_service_count
      or exists (
        select 1 from jsonb_array_elements(new.category_details -> 'additionalServices') service(value)
        where nullif(trim(service.value ->> 'id'), '') is null
      )
    then
      raise exception 'Every Photo/Video additional service needs a unique ID.';
    end if;
    for additional_service_row in select value from jsonb_array_elements(new.category_details -> 'additionalServices')
    loop
      if nullif(trim(additional_service_row ->> 'name'), '') is null
        or coalesce(nullif(additional_service_row ->> 'price', '')::numeric, 0) <= 0
        or coalesce(additional_service_row ->> 'pricingUnit', '') not in ('event', 'hour', 'unit')
        or coalesce(nullif(additional_service_row ->> 'maximumQuantity', '')::numeric, 0) < 0
      then
        raise exception 'Every Photo/Video additional service needs a name, positive price, valid unit, and non-negative maximum quantity.';
      end if;
      if jsonb_typeof(additional_service_row -> 'requiredCrewRoles') <> 'array' then
        raise exception 'Photo/Video additional-service crew requirements must be a list.';
      end if;
      for required_crew_role in select value from jsonb_array_elements_text(additional_service_row -> 'requiredCrewRoles')
      loop
        if nullif(trim(required_crew_role), '') is null then
          raise exception 'Photo/Video additional-service crew requirements cannot be blank.';
        end if;
        if not exists (
          select 1
          from jsonb_array_elements(coalesce(new.category_details -> 'coverageConfigurations', '[]'::jsonb)) coverage(value)
          cross join lateral jsonb_array_elements(coalesce(coverage.value -> 'includedCrew', '[]'::jsonb)) crew(value)
          where lower(trim(crew.value ->> 'role')) = lower(trim(required_crew_role))
        ) and not exists (
          select 1
          from jsonb_array_elements(coalesce(new.category_details -> 'additionalCrewOptions', '[]'::jsonb)) crew(value)
          where lower(trim(crew.value ->> 'role')) = lower(trim(required_crew_role))
        ) then
          raise exception 'A Photo/Video additional service requires a crew role that this provider has not configured.';
        end if;
      end loop;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_v18_photo_video_deliverables_trigger on public.services;
create trigger validate_v18_photo_video_deliverables_trigger
before insert or update of category_id, category_details, status
on public.services
for each row execute function public.validate_v18_photo_video_deliverables();

revoke all on function public.validate_v18_photo_video_deliverables() from public;

commit;
