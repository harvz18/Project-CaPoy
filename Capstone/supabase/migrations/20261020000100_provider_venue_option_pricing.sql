begin;

-- Phase 1 / V8: option-level venue configuration stays in the established
-- category_details.spaces and category_details.combinations collections. This
-- deliberately does not reprice services, selections, payments, or bookings.
-- Existing flat-price venue services have none of these keys and continue to
-- pass through unchanged.
create or replace function public.validate_venue_option_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  option_row jsonb;
  combination_row jsonb;
  option_id text;
  option_ids text[] := '{}'::text[];
  space_ids text[] := '{}'::text[];
  referenced_ids text[];
  field_name text;
  is_active boolean;
  is_bookable boolean;
  minimum_hours numeric := 0;
  maximum_hours numeric := 0;
  configured boolean := false;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%venue%' and category_name not like '%estate%' then
    return new;
  end if;

  -- Legacy venue records retain their existing single service-level price and
  -- must never be forced into the new per-option configuration.
  if new.category_details = '{}'::jsonb
    or new.status::text not in ('pending_review', 'active') then
    return new;
  end if;

  select exists (
    select 1
    from (
      select item.value
      from jsonb_array_elements(
        case when jsonb_typeof(new.category_details -> 'spaces') = 'array'
          then new.category_details -> 'spaces' else '[]'::jsonb end
      ) item(value)
      union all
      select item.value
      from jsonb_array_elements(
        case when jsonb_typeof(new.category_details -> 'combinations') = 'array'
          then new.category_details -> 'combinations' else '[]'::jsonb end
      ) item(value)
    ) option_rows
    where option_rows.value ? 'pricingUnit' or option_rows.value ? 'baseRate'
  ) into configured;

  if not configured then
    return new;
  end if;

  if jsonb_typeof(new.category_details -> 'spaces') <> 'array' then
    raise exception 'Venue options require a spaces array.';
  end if;
  if new.category_details ? 'combinations'
    and jsonb_typeof(new.category_details -> 'combinations') <> 'array' then
    raise exception 'Venue combinations must be an array.';
  end if;

  -- Existing service RLS policies still restrict all writes to the owning provider.
  for option_row in
    select item.value
    from jsonb_array_elements(new.category_details -> 'spaces') item(value)
    union all
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(new.category_details -> 'combinations') = 'array'
        then new.category_details -> 'combinations' else '[]'::jsonb end
    ) item(value)
  loop
    option_id := nullif(trim(option_row ->> 'id'), '');
    if option_id is null then
      raise exception 'Every venue option needs a unique ID.';
    end if;
    option_ids := option_ids || option_id;
  end loop;

  if cardinality(option_ids) <> cardinality(array(select distinct unnest(option_ids))) then
    raise exception 'Venue option IDs must be unique within a service.';
  end if;

  select coalesce(array_agg(item.value ->> 'id'), '{}'::text[])
  into space_ids
  from jsonb_array_elements(new.category_details -> 'spaces') item(value);

  for option_row in
    select item.value
    from jsonb_array_elements(new.category_details -> 'spaces') item(value)
    union all
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(new.category_details -> 'combinations') = 'array'
        then new.category_details -> 'combinations' else '[]'::jsonb end
    ) item(value)
  loop
    option_id := option_row ->> 'id';

    foreach field_name in array array['isActive', 'isBookableIndividually'] loop
      if option_row ? field_name
        and option_row ->> field_name not in ('true', 'false') then
        raise exception 'Venue option % has an invalid % value.', option_id, field_name;
      end if;
    end loop;
    if option_row ? 'allowsCombination'
      and option_row ->> 'allowsCombination' not in ('true', 'false') then
      raise exception 'Venue option % has an invalid allowsCombination value.', option_id;
    end if;

    is_active := coalesce((option_row ->> 'isActive')::boolean, true);
    is_bookable := coalesce((option_row ->> 'isBookableIndividually')::boolean, true);
    if is_active and is_bookable then
      if option_row ->> 'pricingUnit' not in ('event', 'hour') then
        raise exception 'Active venue option % needs an hourly or per-event price type.', option_id;
      end if;
      if coalesce(option_row ->> 'baseRate', '') !~ '^[0-9]+([.][0-9]+)?$'
        or (option_row ->> 'baseRate')::numeric <= 0 then
        raise exception 'Active venue option % needs a positive base rate.', option_id;
      end if;
    end if;

    foreach field_name in array array[
      'minimumBookingHours', 'maximumBookingHours', 'includedDurationHours',
      'setupAllowanceHours', 'cleanupAllowanceHours'
    ] loop
      if option_row ? field_name and coalesce(option_row ->> field_name, '') <> '' then
        if option_row ->> field_name !~ '^[0-9]+([.][0-9]+)?$' then
          raise exception 'Venue option % has an invalid % value.', option_id, field_name;
        end if;
      end if;
    end loop;
    minimum_hours := coalesce(nullif(option_row ->> 'minimumBookingHours', '')::numeric, 0);
    maximum_hours := coalesce(nullif(option_row ->> 'maximumBookingHours', '')::numeric, 0);
    if maximum_hours > 0 and maximum_hours < greatest(minimum_hours, 1) then
      raise exception 'Venue option % has a maximum duration below its minimum duration.', option_id;
    end if;

    foreach field_name in array array['photoUrls', 'amenities', 'inclusions', 'restrictions'] loop
      if option_row ? field_name and jsonb_typeof(option_row -> field_name) <> 'array' then
        raise exception 'Venue option % has an invalid % list.', option_id, field_name;
      end if;
    end loop;
    foreach field_name in array array['requiredOptionIds', 'mutuallyExclusiveOptionIds'] loop
      if option_row ? field_name and jsonb_typeof(option_row -> field_name) <> 'array' then
        raise exception 'Venue option % has an invalid % list.', option_id, field_name;
      end if;
      select coalesce(array_agg(reference.value), '{}'::text[])
      into referenced_ids
      from jsonb_array_elements_text(
        case when jsonb_typeof(option_row -> field_name) = 'array'
          then option_row -> field_name else '[]'::jsonb end
      ) reference(value);
      if cardinality(referenced_ids)
        <> cardinality(array(select distinct unnest(referenced_ids))) then
        raise exception 'Venue option % has duplicate % entries.', option_id, field_name;
      end if;
      if exists (
        select 1 from unnest(referenced_ids) reference_id
        where reference_id = option_id or not (reference_id = any(option_ids))
      ) then
        raise exception 'Venue option % references an unavailable venue option.', option_id;
      end if;
    end loop;
  end loop;

  -- Combinations can only use existing, explicitly combinable spaces.
  for combination_row in
    select item.value
    from jsonb_array_elements(
      case when jsonb_typeof(new.category_details -> 'combinations') = 'array'
        then new.category_details -> 'combinations' else '[]'::jsonb end
    ) item(value)
  loop
    if jsonb_typeof(combination_row -> 'spaceIds') <> 'array' then
      raise exception 'Venue combination % needs at least two spaces.', combination_row ->> 'id';
    end if;
    select coalesce(array_agg(reference.value), '{}'::text[])
    into referenced_ids
    from jsonb_array_elements_text(combination_row -> 'spaceIds') reference(value);
    if cardinality(referenced_ids) < 2
      or cardinality(referenced_ids) <> cardinality(array(select distinct unnest(referenced_ids)))
      or exists (
        select 1 from unnest(referenced_ids) reference_id
        where not (reference_id = any(space_ids))
      ) then
      raise exception 'Venue combination % needs at least two different existing spaces.', combination_row ->> 'id';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(new.category_details -> 'spaces') space(value)
      where space.value ->> 'id' = any(referenced_ids)
        and coalesce((space.value ->> 'allowsCombination')::boolean, true) = false
    ) then
      raise exception 'Venue combination % includes a space that cannot be combined.', combination_row ->> 'id';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists validate_venue_option_pricing_trigger on public.services;
create trigger validate_venue_option_pricing_trigger
before insert or update of category_id, category_details, status
on public.services
for each row execute function public.validate_venue_option_pricing();

revoke all on function public.validate_venue_option_pricing() from public;

comment on function public.validate_venue_option_pricing() is
  'Validates provider-owned, per-option venue pricing while preserving legacy flat-price services and historic bookings.';

commit;
