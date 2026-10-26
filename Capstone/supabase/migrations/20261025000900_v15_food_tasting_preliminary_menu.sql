-- MULTIVENT Revision V15, Phase 2: provider-configured preliminary tasting
-- menus. These drafts are deliberately separate from final catering quotes,
-- booking requests, payment eligibility, and financial allocations.

begin;

create table if not exists public.catering_food_tasting_drafts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id),
  service_id uuid not null references public.services(id),
  guest_count integer not null check (guest_count > 0),
  preliminary_menu jsonb not null default '{"courses":[]}'::jsonb,
  is_complete boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catering_food_tasting_drafts_menu_object_check
    check (jsonb_typeof(preliminary_menu) = 'object'),
  constraint catering_food_tasting_drafts_event_service_key unique (event_id, service_id)
);

create index if not exists catering_food_tasting_drafts_client_event_idx
  on public.catering_food_tasting_drafts (client_id, event_id, updated_at desc);

alter table public.catering_food_tasting_drafts enable row level security;

-- Provider configuration is stored in the established customMenuSections
-- payload. Validate it independently, leaving existing direct-menu rules and
-- historic catering listings untouched until a provider enables tasting.
create or replace function public.validate_v15_catering_tasting_course_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  section_row jsonb;
  item_row jsonb;
  active_items integer;
  tasting_limit integer;
  final_limit integer;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%cater%'
    or not coalesce(new.category_details @> '{"tastingSettings":{"enabled":true}}'::jsonb, false) then
    return new;
  end if;

  if jsonb_typeof(new.category_details -> 'customMenuSections') <> 'array'
    or jsonb_array_length(new.category_details -> 'customMenuSections') = 0 then
    raise exception 'Food tasting requires an item-priced catering menu with course-level dish selections.';
  end if;

  for section_row in select value from jsonb_array_elements(new.category_details -> 'customMenuSections')
  loop
    if nullif(trim(section_row ->> 'id'), '') is null
      or nullif(trim(section_row ->> 'name'), '') is null
      or jsonb_typeof(section_row -> 'items') <> 'array' then
      raise exception 'Every food tasting course needs an ID, name, and food items.';
    end if;

    if coalesce(section_row ->> 'tastingSelectionLimit', '') !~ '^[1-9][0-9]*$'
      or coalesce(section_row ->> 'finalSelectionLimit', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Every food tasting course needs positive tasting and final-menu selection limits.';
    end if;
    tasting_limit := (section_row ->> 'tastingSelectionLimit')::integer;
    final_limit := (section_row ->> 'finalSelectionLimit')::integer;
    if final_limit > tasting_limit then
      raise exception 'Food tasting final-menu selections cannot exceed tasting selections.';
    end if;

    active_items := 0;
    for item_row in select value from jsonb_array_elements(section_row -> 'items')
    loop
      if nullif(trim(item_row ->> 'id'), '') is null
        or nullif(trim(item_row ->> 'name'), '') is null
        or coalesce(nullif(item_row ->> 'pricePerHead', '')::numeric, 0) <= 0 then
        raise exception 'Every food tasting dish needs an ID, name, and positive per-head price.';
      end if;
      if not coalesce(item_row @> '{"isActive":false}'::jsonb, false) then
        active_items := active_items + 1;
      end if;
    end loop;
    if active_items < tasting_limit then
      raise exception 'A food tasting course cannot require more dishes than are available.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists validate_v15_catering_tasting_course_rules_trigger on public.services;
create trigger validate_v15_catering_tasting_course_rules_trigger
before insert or update of category_id, category_details on public.services
for each row execute function public.validate_v15_catering_tasting_course_rules();

-- Rebuild the proposed tasting menu from the current provider-owned menu on
-- every save. The client supplies IDs only; prices, descriptions, limits, and
-- the provider identity always come from the server-side service record.
create or replace function public.build_v15_preliminary_tasting_menu(
  target_event_id uuid,
  target_service_id uuid,
  target_guest_count integer,
  target_menu_item_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  service_row record;
  section_row jsonb;
  item_row jsonb;
  selected_ids text[] := '{}'::text[];
  recognized_ids text[] := '{}'::text[];
  selected_items jsonb;
  courses jsonb := '[]'::jsonb;
  tasting_limit integer;
  final_limit integer;
  active_items integer;
  selected_count integer;
  minimum_guests integer;
  maximum_guests integer;
  complete boolean := true;
begin
  if jsonb_typeof(coalesce(target_menu_item_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'Selected food tasting dishes must be an array.' using errcode = '22023';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into selected_ids
  from jsonb_array_elements_text(target_menu_item_ids) item(value);
  if cardinality(selected_ids) <> cardinality(array(select distinct unnest(selected_ids))) then
    raise exception 'A food tasting dish can only be selected once.' using errcode = '22023';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled')
  for update;
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;
  if target_guest_count is null or target_guest_count < 1 then
    raise exception 'Set a valid catering guest count before choosing tasting dishes.' using errcode = '22023';
  end if;

  select service.id, service.provider_id, service.category_details, service.name,
    category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true;
  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'catering' then
    raise exception 'Catering service not found.';
  end if;
  if not coalesce(service_row.category_details @> '{"tastingSettings":{"enabled":true}}'::jsonb, false) then
    raise exception 'This caterer has not enabled food tasting appointments.' using errcode = '22023';
  end if;
  if jsonb_typeof(service_row.category_details -> 'customMenuSections') <> 'array'
    or jsonb_array_length(service_row.category_details -> 'customMenuSections') = 0 then
    raise exception 'This caterer has not configured a food tasting menu yet.' using errcode = '22023';
  end if;
  minimum_guests := greatest(coalesce(nullif(service_row.category_details ->> 'minimumGuests', '')::integer, 0), 1);
  maximum_guests := coalesce(nullif(service_row.category_details ->> 'maximumGuests', '')::integer, 0);
  if maximum_guests < minimum_guests
    or target_guest_count < minimum_guests
    or target_guest_count > maximum_guests then
    raise exception 'This catering menu does not support the selected guest count.' using errcode = '22023';
  end if;

  for section_row in select value from jsonb_array_elements(service_row.category_details -> 'customMenuSections')
  loop
    if nullif(trim(section_row ->> 'id'), '') is null
      or nullif(trim(section_row ->> 'name'), '') is null
      or jsonb_typeof(section_row -> 'items') <> 'array'
      or coalesce(section_row ->> 'tastingSelectionLimit', '') !~ '^[1-9][0-9]*$'
      or coalesce(section_row ->> 'finalSelectionLimit', '') !~ '^[1-9][0-9]*$' then
      raise exception 'This caterer needs to configure every food tasting course.';
    end if;
    tasting_limit := (section_row ->> 'tastingSelectionLimit')::integer;
    final_limit := (section_row ->> 'finalSelectionLimit')::integer;
    if final_limit > tasting_limit then
      raise exception 'This caterer has an invalid food tasting course configuration.';
    end if;

    active_items := 0;
    selected_count := 0;
    selected_items := '[]'::jsonb;
    for item_row in select value from jsonb_array_elements(section_row -> 'items')
    loop
      if not coalesce(item_row @> '{"isActive":false}'::jsonb, false) then
        active_items := active_items + 1;
      end if;
      if item_row ->> 'id' = any(selected_ids) then
        if coalesce(item_row @> '{"isActive":false}'::jsonb, false) then
          raise exception 'A selected food tasting dish is no longer available.' using errcode = '22023';
        end if;
        if nullif(trim(item_row ->> 'name'), '') is null
          or coalesce(nullif(item_row ->> 'pricePerHead', '')::numeric, 0) <= 0 then
          raise exception 'A selected food tasting dish is invalid.';
        end if;
        recognized_ids := recognized_ids || (item_row ->> 'id');
        selected_count := selected_count + 1;
        selected_items := selected_items || jsonb_build_array(jsonb_build_object(
          'id', item_row ->> 'id',
          'name', item_row ->> 'name',
          'description', nullif(item_row ->> 'description', ''),
          'pricePerHead', (item_row ->> 'pricePerHead')::numeric
        ));
      end if;
    end loop;
    if active_items < tasting_limit then
      raise exception 'This caterer has fewer tasting dishes than the configured course limit.';
    end if;
    if selected_count > tasting_limit then
      raise exception 'Choose up to % tasting dish(es) from %.', tasting_limit, section_row ->> 'name'
        using errcode = '22023';
    end if;
    if selected_count <> tasting_limit then complete := false; end if;
    courses := courses || jsonb_build_array(jsonb_build_object(
      'courseId', section_row ->> 'id',
      'courseName', section_row ->> 'name',
      'tastingSelectionLimit', tasting_limit,
      'finalSelectionLimit', final_limit,
      'selectedItems', selected_items
    ));
  end loop;

  if cardinality(recognized_ids) <> cardinality(selected_ids) then
    raise exception 'One or more selected tasting dishes are not offered by this caterer.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'courses', courses,
    'guestCount', target_guest_count,
    'isComplete', complete,
    'selectedItemIds', to_jsonb(selected_ids),
    'serviceId', service_row.id,
    'providerId', service_row.provider_id
  );
end;
$$;

create or replace function public.save_my_catering_tasting_draft_v15(
  target_event_id uuid,
  target_service_id uuid,
  target_guest_count integer,
  target_menu_item_ids jsonb,
  target_revision integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  preliminary jsonb;
  draft_row record;
begin
  preliminary := public.build_v15_preliminary_tasting_menu(
    target_event_id,
    target_service_id,
    target_guest_count,
    target_menu_item_ids
  );

  insert into public.catering_food_tasting_drafts (
    event_id, client_id, provider_id, service_id, guest_count,
    preliminary_menu, is_complete, revision, updated_at
  ) values (
    target_event_id, auth.uid(), (preliminary ->> 'providerId')::uuid,
    target_service_id, target_guest_count, preliminary,
    coalesce((preliminary ->> 'isComplete')::boolean, false),
    greatest(coalesce(target_revision, 0), 0), now()
  ) on conflict (event_id, service_id) do update set
    guest_count = excluded.guest_count,
    preliminary_menu = excluded.preliminary_menu,
    is_complete = excluded.is_complete,
    revision = excluded.revision,
    updated_at = now()
  where public.catering_food_tasting_drafts.client_id = auth.uid()
    and public.catering_food_tasting_drafts.revision <= excluded.revision
  returning id, is_complete, revision, updated_at into draft_row;

  if draft_row.id is null then
    return jsonb_build_object('isComplete', false, 'saved', false, 'stale', true);
  end if;
  return jsonb_build_object(
    'draftId', draft_row.id,
    'isComplete', draft_row.is_complete,
    'revision', draft_row.revision,
    'saved', true,
    'updatedAt', draft_row.updated_at
  );
end;
$$;

create or replace function public.load_my_catering_tasting_draft_v15(
  target_event_id uuid,
  target_service_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_row public.catering_food_tasting_drafts%rowtype;
begin
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id
      and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select * into draft_row
  from public.catering_food_tasting_drafts draft
  where draft.event_id = target_event_id
    and draft.service_id = target_service_id
    and draft.client_id = auth.uid();
  if draft_row.id is null then return null; end if;

  return jsonb_build_object(
    'guestCount', draft_row.guest_count,
    'isComplete', draft_row.is_complete,
    'revision', draft_row.revision,
    'selectedItemIds', coalesce(draft_row.preliminary_menu -> 'selectedItemIds', '[]'::jsonb),
    'updatedAt', draft_row.updated_at
  );
end;
$$;

revoke all on function public.validate_v15_catering_tasting_course_rules() from public;
revoke all on function public.build_v15_preliminary_tasting_menu(uuid, uuid, integer, jsonb) from public;
revoke all on function public.save_my_catering_tasting_draft_v15(uuid, uuid, integer, jsonb, integer) from public;
revoke all on function public.load_my_catering_tasting_draft_v15(uuid, uuid) from public;
grant execute on function public.save_my_catering_tasting_draft_v15(uuid, uuid, integer, jsonb, integer) to authenticated;
grant execute on function public.load_my_catering_tasting_draft_v15(uuid, uuid) to authenticated;

comment on table public.catering_food_tasting_drafts is
  'V15 Phase 2 client preliminary tasting choices. This table never represents a final menu, booking request, or payable price.';
comment on function public.save_my_catering_tasting_draft_v15(uuid, uuid, integer, jsonb, integer) is
  'Persists a client-owned preliminary tasting menu with provider-configured course limits and no final price.';

commit;
