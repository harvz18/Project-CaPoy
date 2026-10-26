-- MULTIVENT Revision V18, Phase 3: provider-defined coverage, crew, and
-- schedule rules. This is additive and validates only listings that opt into
-- the V18 coverageConfigurations structure.

begin;

create or replace function public.validate_v18_photo_video_coverage_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  coverage_row jsonb;
  crew_row jsonb;
  additional_crew_row jsonb;
  configuration_count integer;
  unique_configuration_count integer;
  additional_crew_count integer;
  unique_additional_crew_count integer;
  minimum_coverage_price numeric;
begin
  select lower(trim(category.name))
  into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%photo%'
    or not (new.category_details ? 'coverageConfigurations')
    or new.status::text not in ('pending_review', 'active')
  then
    return new;
  end if;

  if jsonb_typeof(new.category_details -> 'coverageConfigurations') <> 'array'
    or jsonb_array_length(new.category_details -> 'coverageConfigurations') = 0
  then
    raise exception 'Add at least one bookable Photo/Video coverage configuration.';
  end if;

  select count(*), count(distinct configuration.value ->> 'id')
  into configuration_count, unique_configuration_count
  from jsonb_array_elements(new.category_details -> 'coverageConfigurations') configuration(value);
  if configuration_count <> unique_configuration_count
    or exists (
      select 1
      from jsonb_array_elements(new.category_details -> 'coverageConfigurations') configuration(value)
      where nullif(trim(configuration.value ->> 'id'), '') is null
    )
  then
    raise exception 'Every Photo/Video coverage configuration needs a unique ID.';
  end if;

  for coverage_row in select value from jsonb_array_elements(new.category_details -> 'coverageConfigurations')
  loop
    if nullif(trim(coverage_row ->> 'name'), '') is null
      or coalesce(nullif(coverage_row ->> 'durationHours', '')::numeric, 0) <= 0
      or coalesce(nullif(coverage_row ->> 'price', '')::numeric, 0) <= 0
    then
      raise exception 'Every Photo/Video coverage configuration needs a name, positive duration, and positive provider price.';
    end if;
    if jsonb_typeof(coverage_row -> 'includedCrew') <> 'array'
      or jsonb_array_length(coverage_row -> 'includedCrew') = 0
    then
      raise exception 'Every Photo/Video coverage configuration needs at least one included crew role.';
    end if;
    for crew_row in select value from jsonb_array_elements(coverage_row -> 'includedCrew')
    loop
      if nullif(trim(crew_row ->> 'role'), '') is null
        or coalesce(nullif(crew_row ->> 'quantity', '')::numeric, 0) < 1
      then
        raise exception 'Every included Photo/Video crew record needs a role and positive quantity.';
      end if;
    end loop;
  end loop;

  -- The marketplace's existing base price is the provider-owned starting
  -- price: the lowest valid coverage configuration, never a browser value.
  select min((configuration.value ->> 'price')::numeric)
  into minimum_coverage_price
  from jsonb_array_elements(new.category_details -> 'coverageConfigurations') configuration(value);
  new.base_price := minimum_coverage_price;

  if jsonb_typeof(new.category_details -> 'additionalCrewOptions') = 'array' then
    select count(*), count(distinct option.value ->> 'id')
    into additional_crew_count, unique_additional_crew_count
    from jsonb_array_elements(new.category_details -> 'additionalCrewOptions') option(value);
    if additional_crew_count <> unique_additional_crew_count
      or exists (
        select 1
        from jsonb_array_elements(new.category_details -> 'additionalCrewOptions') option(value)
        where nullif(trim(option.value ->> 'id'), '') is null
      )
    then
      raise exception 'Every additional Photo/Video crew option needs a unique ID.';
    end if;
    for additional_crew_row in select value from jsonb_array_elements(new.category_details -> 'additionalCrewOptions')
    loop
      if nullif(trim(additional_crew_row ->> 'role'), '') is null
        or coalesce(nullif(additional_crew_row ->> 'maximumQuantity', '')::numeric, 0) < 1
        or coalesce(nullif(additional_crew_row ->> 'price', '')::numeric, 0) <= 0
        or coalesce(additional_crew_row ->> 'pricingUnit', '') not in ('event', 'hour')
      then
        raise exception 'Every additional Photo/Video crew option needs a role, positive limit and price, and event or hour pricing.';
      end if;
    end loop;
  end if;

  if coalesce(nullif(new.category_details ->> 'teamCapacity', '')::numeric, 0) < 1 then
    raise exception 'Set a positive Photo/Video team capacity.';
  end if;
  if coalesce(nullif(new.category_details ->> 'scheduleFlexibilityMinutes', '')::numeric, 0) < 0
    or coalesce(nullif(new.category_details ->> 'additionalLocationFee', '')::numeric, 0) < 0
  then
    raise exception 'Photo/Video schedule flexibility and additional-location fee cannot be negative.';
  end if;

  if coalesce((new.category_details ->> 'additionalHoursAllowed')::boolean, false) then
    if coalesce(nullif(new.category_details ->> 'additionalHourRate', '')::numeric, 0) <= 0
      or coalesce(nullif(new.category_details ->> 'maximumAdditionalHours', '')::numeric, 0) < 1
    then
      raise exception 'Prebooked additional hours need a positive rate and maximum duration.';
    end if;
  end if;

  if coalesce((new.category_details ->> 'overtimeAllowed')::boolean, false) then
    if coalesce(nullif(new.category_details ->> 'overtimeRate', '')::numeric, 0) <= 0
      or coalesce(nullif(new.category_details ->> 'overtimeMinimumIncrementHours', '')::numeric, 0) <= 0
      or coalesce((new.category_details ->> 'overtimeRequiresAuthorization')::boolean, false) is not true
    then
      raise exception 'Event-day overtime needs a positive rate, increment, and client authorization requirement.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_v18_photo_video_coverage_configuration_trigger on public.services;
create trigger validate_v18_photo_video_coverage_configuration_trigger
before insert or update of category_id, category_details, status
on public.services
for each row execute function public.validate_v18_photo_video_coverage_configuration();

revoke all on function public.validate_v18_photo_video_coverage_configuration() from public;

commit;
