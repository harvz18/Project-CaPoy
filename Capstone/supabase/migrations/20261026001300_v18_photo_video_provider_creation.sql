-- MULTIVENT Revision V18, Phase 2: Photo/Video provider configuration.
-- This replaces only the validation function and keeps legacy photography
-- listings valid until a provider elects to use the V18 configuration keys.

begin;

create or replace function public.validate_service_category_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  expected_kind text;
  minimum_guests numeric;
  maximum_guests numeric;
  space_row jsonb;
  combination_row jsonb;
  selected_space_count integer;
  unique_space_count integer;
  caller_role public.user_role;
  photo_video_service_type text;
begin
  select lower(trim(category.name))
  into category_name
  from public.service_categories category
  where category.id = new.category_id;

  expected_kind := case
    when category_name like '%attire%' or category_name like '%gown%' then 'attire'
    when category_name like '%flor%' then 'florists'
    when category_name like '%venue%' or category_name like '%estate%' then 'venues'
    when category_name like '%organizer%' or category_name like '%coordinator%' then 'event_organizer'
    when category_name like '%sound%' or category_name like '%light%' then 'sound_lights'
    when category_name like '%photo%' then 'photography'
    when category_name like '%host%' or category_name like '%emcee%' then 'host_emcee'
    else 'catering'
  end;

  if expected_kind = 'event_organizer'
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_platform_staff()
  then
    select profile.default_role into caller_role
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status in ('active', 'verified');

    if caller_role is distinct from 'event_coordinator'::public.user_role then
      raise exception 'Event Organizer listings are restricted to authorized MULTIVENT coordinator accounts.'
        using errcode = '42501';
    end if;
  end if;

  -- Empty objects remain the backwards-compatible state for listings made
  -- before category-specific details existed.
  if new.category_details = '{}'::jsonb then
    return new;
  end if;

  if coalesce(new.category_details ->> 'kind', '') <> expected_kind then
    raise exception 'The saved service details do not match the selected category.';
  end if;

  if new.status::text not in ('pending_review', 'active') then
    return new;
  end if;

  if expected_kind = 'attire' then
    if jsonb_typeof(new.category_details -> 'serviceOptions') <> 'array'
      or jsonb_array_length(new.category_details -> 'serviceOptions') = 0
    then
      raise exception 'Select at least one attire service option.';
    end if;
    if coalesce(nullif(new.category_details ->> 'quantityAvailable', '')::numeric, 0) < 0 then
      raise exception 'Quantity available cannot be negative.';
    end if;
  elsif expected_kind = 'catering' then
    minimum_guests := coalesce(nullif(new.category_details ->> 'minimumGuests', '')::numeric, 0);
    maximum_guests := coalesce(nullif(new.category_details ->> 'maximumGuests', '')::numeric, 0);
    if minimum_guests <= 0 then
      raise exception 'Minimum guests must be greater than zero.';
    end if;
    if maximum_guests < minimum_guests then
      raise exception 'Maximum guests must be at least the minimum guests.';
    end if;
  elsif expected_kind = 'venues' then
    if jsonb_typeof(new.category_details -> 'spaces') <> 'array'
      or jsonb_array_length(new.category_details -> 'spaces') = 0
    then
      raise exception 'Add at least one venue space or hall.';
    end if;
    for space_row in select value from jsonb_array_elements(new.category_details -> 'spaces')
    loop
      if nullif(trim(space_row ->> 'name'), '') is null
        or coalesce(nullif(space_row ->> 'areaSqm', '')::numeric, 0) <= 0
        or coalesce(nullif(space_row ->> 'capacity', '')::numeric, 0) <= 0
      then
        raise exception 'Every venue space needs a name, positive area, and positive capacity.';
      end if;
    end loop;
    if jsonb_typeof(new.category_details -> 'combinations') = 'array' then
      for combination_row in
        select value from jsonb_array_elements(new.category_details -> 'combinations')
      loop
        if jsonb_typeof(combination_row -> 'spaceIds') <> 'array' then
          raise exception 'Every venue combination must contain at least two spaces.';
        end if;
        select count(*), count(distinct selected.value)
        into selected_space_count, unique_space_count
        from jsonb_array_elements_text(combination_row -> 'spaceIds') selected(value);
        if selected_space_count < 2 or unique_space_count <> selected_space_count then
          raise exception 'Every venue combination must contain at least two different spaces.';
        end if;
        if exists (
          select 1
          from jsonb_array_elements_text(combination_row -> 'spaceIds') selected(value)
          where not exists (
            select 1
            from jsonb_array_elements(new.category_details -> 'spaces') space(value)
            where space.value ->> 'id' = selected.value
          )
        ) then
          raise exception 'A venue combination contains a space that is not part of this venue.';
        end if;
      end loop;
    end if;
  elsif expected_kind = 'photography' then
    if coalesce(nullif(new.category_details ->> 'coverageDurationHours', '')::numeric, 0) <= 0 then
      raise exception 'Photography coverage duration must be greater than zero.';
    end if;

    -- V18 keys opt a listing into explicit Photo/Video publication checks.
    -- Listings created before V18 retain the original validation behaviour.
    if new.category_details ? 'photoVideoServiceType' then
      photo_video_service_type := nullif(trim(new.category_details ->> 'photoVideoServiceType'), '');
      if photo_video_service_type is null
        or photo_video_service_type not in ('photography', 'videography', 'combined') then
        raise exception 'Choose photography, videography, or combined coverage.';
      end if;
      if jsonb_typeof(new.category_details -> 'eventTypes') <> 'array'
        or jsonb_array_length(new.category_details -> 'eventTypes') = 0
      then
        raise exception 'Select at least one supported event type.';
      end if;
      if nullif(trim(new.category_details ->> 'operatingLocation'), '') is null then
        raise exception 'Enter the Photo/Video operating location.';
      end if;
      if jsonb_typeof(new.category_details -> 'coverageAreas') <> 'array'
        or jsonb_array_length(new.category_details -> 'coverageAreas') = 0
      then
        raise exception 'Add at least one Photo/Video coverage area.';
      end if;
      if coalesce(nullif(new.category_details ->> 'minimumBookingNoticeDays', '')::numeric, 0) < 0 then
        raise exception 'Minimum booking notice cannot be negative.';
      end if;
      if coalesce(new.base_price, 0) <= 0 then
        raise exception 'Set a positive, client-visible price before publishing this Photo/Video service.';
      end if;
      if photo_video_service_type in ('photography', 'combined')
        and coalesce((new.category_details ->> 'photoCoverage')::boolean, false) is not true
      then
        raise exception 'Photography services must include photo coverage.';
      end if;
      if photo_video_service_type in ('videography', 'combined')
        and coalesce((new.category_details ->> 'videoCoverage')::boolean, false) is not true
      then
        raise exception 'Videography services must include video coverage.';
      end if;
      if photo_video_service_type in ('photography', 'combined')
        and coalesce(nullif(new.category_details ->> 'photographerCount', '')::numeric, 0) < 1
      then
        raise exception 'At least one photographer is required when photography is included.';
      end if;
      if photo_video_service_type in ('videography', 'combined')
        and coalesce(nullif(new.category_details ->> 'videographerCount', '')::numeric, 0) < 1
      then
        raise exception 'At least one videographer is required when videography is included.';
      end if;
    else
      if coalesce(nullif(new.category_details ->> 'photographerCount', '')::numeric, 0) < 1 then
        raise exception 'At least one photographer is required.';
      end if;
      if coalesce((new.category_details ->> 'videoCoverage')::boolean, false)
        and coalesce(nullif(new.category_details ->> 'videographerCount', '')::numeric, 0) < 1
      then
        raise exception 'At least one videographer is required when video coverage is included.';
      end if;
    end if;
  elsif expected_kind = 'sound_lights' then
    if coalesce(nullif(new.category_details ->> 'recommendedGuestCapacity', '')::numeric, 0) <= 0 then
      raise exception 'Recommended guest capacity must be greater than zero.';
    end if;
    if coalesce(nullif(new.category_details ->> 'speakerCount', '')::numeric, 0) < 0
      or coalesce(nullif(new.category_details ->> 'microphoneCount', '')::numeric, 0) < 0
    then
      raise exception 'Equipment quantities cannot be negative.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_service_category_details() from public;

commit;
