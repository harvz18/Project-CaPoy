-- MULTIVENT service listings: structured details for each marketplace category.
-- Apply after 50_assistant_listing_approval_compatibility.sql.

begin;

alter table public.services
  add column if not exists category_details jsonb not null default '{}'::jsonb;

alter table public.services
  drop constraint if exists services_category_details_object_check,
  add constraint services_category_details_object_check
    check (jsonb_typeof(category_details) = 'object');

create index if not exists services_category_details_gin_idx
  on public.services using gin (category_details jsonb_path_ops);

-- Ordinary providers must not create coordinator marketplace listings. Event
-- coordinators remain employees managed through the existing coordinator flow.
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

  -- Empty objects are the backwards-compatible state for pre-migration
  -- listings. New and edited listings use schemaVersion/kind and are checked.
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
    if coalesce(nullif(new.category_details ->> 'photographerCount', '')::numeric, 0) < 1 then
      raise exception 'At least one photographer is required.';
    end if;
    if coalesce((new.category_details ->> 'videoCoverage')::boolean, false)
      and coalesce(nullif(new.category_details ->> 'videographerCount', '')::numeric, 0) < 1
    then
      raise exception 'At least one videographer is required when video coverage is included.';
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

drop trigger if exists validate_service_category_details_trigger on public.services;
create trigger validate_service_category_details_trigger
before insert or update of category_id, category_details, status
on public.services
for each row execute function public.validate_service_category_details();

revoke all on function public.validate_service_category_details() from public;

-- Include the structured details in the existing moderation lifecycle so an
-- edit is never published without staff review.
create or replace function public.enforce_service_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_material_change boolean;
begin
  if auth.role() = 'service_role'
    or public.is_platform_staff()
    or current_setting('app.service_delete_authorized', true) = 'true'
    or current_setting('app.service_snapshot_authorized', true) = 'true'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.submission_kind := 'new';
    new.last_approved_snapshot := null;
    if new.status <> 'draft' then
      new.status := 'pending_review';
      new.moderation_note := null;
      new.moderated_at := null;
      new.moderated_by := null;
    end if;
    return new;
  end if;

  new.submission_kind := old.submission_kind;
  new.last_approved_snapshot := old.last_approved_snapshot;

  has_material_change :=
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.base_price is distinct from old.base_price
    or new.category_id is distinct from old.category_id
    or new.category_details is distinct from old.category_details
    or new.location is distinct from old.location
    or new.cover_image_url is distinct from old.cover_image_url
    or new.gallery_urls is distinct from old.gallery_urls
    or new.pricing_model is distinct from old.pricing_model
    or new.pricing_unit is distinct from old.pricing_unit
    or new.pricing_details is distinct from old.pricing_details
    or new.catering_service_types is distinct from old.catering_service_types;

  if old.status = 'active' and has_material_change then
    new.last_approved_snapshot := public.build_service_snapshot(old.id);
    new.submission_kind := 'updated';
  elsif has_material_change and old.last_approved_snapshot is not null then
    new.submission_kind := 'updated';
  end if;

  if new.status <> 'draft' and (
    new.status is distinct from old.status or has_material_change
  ) then
    new.status := 'pending_review';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_service_review_status() from public;

comment on column public.services.category_details is
  'Versioned structured details for the selected service category; empty objects preserve legacy listings.';
comment on function public.validate_service_category_details() is
  'Validates category-specific listing data and prevents ordinary providers from creating coordinator listings.';

commit;
