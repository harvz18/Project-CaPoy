-- Phase 7: configurable catering food items and authoritative event pricing.
-- This extends the established pricingOptions contract. Existing fixed-menu
-- listings and their historic option snapshots remain valid.

begin;

create or replace function public.validate_catering_pricing_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  option_row jsonb;
  section_row jsonb;
  item_row jsonb;
  option_count integer := 0;
  option_ids integer := 0;
  item_ids text[] := '{}'::text[];
  minimum_guests numeric;
  maximum_guests numeric;
  minimum_selections integer;
  maximum_selections integer;
  active_items integer;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category where category.id = new.category_id;

  if category_name not like '%cater%' then return new; end if;

  -- Item-priced menus take precedence over fixed options. Validation is kept
  -- server-side so a provider cannot publish invalid item prices through an API.
  if new.category_details ? 'customMenuSections' then
    if jsonb_typeof(new.category_details -> 'customMenuSections') <> 'array'
      or jsonb_array_length(new.category_details -> 'customMenuSections') = 0 then
      raise exception 'Add at least one custom catering menu section.';
    end if;
    minimum_guests := coalesce(nullif(new.category_details ->> 'minimumGuests', '')::numeric, 0);
    maximum_guests := coalesce(nullif(new.category_details ->> 'maximumGuests', '')::numeric, 0);
    if minimum_guests <= 0 or maximum_guests < minimum_guests then
      raise exception 'Custom catering menus need a valid minimum and maximum guest count.';
    end if;
    for section_row in select value from jsonb_array_elements(new.category_details -> 'customMenuSections')
    loop
      if nullif(trim(section_row ->> 'id'), '') is null
        or nullif(trim(section_row ->> 'name'), '') is null
        or jsonb_typeof(section_row -> 'items') <> 'array'
        or jsonb_array_length(section_row -> 'items') = 0 then
        raise exception 'Every custom menu section needs an ID, name, and at least one food item.';
      end if;
      minimum_selections := greatest(coalesce(nullif(section_row ->> 'minimumSelections', '')::integer, 0), 0);
      maximum_selections := nullif(section_row ->> 'maximumSelections', '')::integer;
      if maximum_selections is not null and (maximum_selections < minimum_selections or maximum_selections < 1) then
        raise exception 'Custom menu section selection limits are invalid.';
      end if;
      active_items := 0;
      for item_row in select value from jsonb_array_elements(section_row -> 'items')
      loop
        if nullif(trim(item_row ->> 'id'), '') is null
          or nullif(trim(item_row ->> 'name'), '') is null
          or coalesce(nullif(item_row ->> 'pricePerHead', '')::numeric, 0) <= 0 then
          raise exception 'Every custom menu food item needs an ID, name, and positive per-head price.';
        end if;
        if coalesce(nullif(item_row ->> 'isActive', '')::boolean, true) then
          active_items := active_items + 1;
        elsif coalesce(nullif(item_row ->> 'isRequired', '')::boolean, false) then
          raise exception 'A required food item cannot be inactive.';
        end if;
        item_ids := item_ids || (item_row ->> 'id');
      end loop;
      if active_items < minimum_selections then
        raise exception 'Custom menu section minimum selections exceed available food items.';
      end if;
    end loop;
    if cardinality(item_ids) <> cardinality(array(select distinct unnest(item_ids))) then
      raise exception 'Custom menu food item IDs must be unique within a service.';
    end if;
    return new;
  end if;

  -- Existing Phase 3/5 fixed-menu validation remains untouched for providers
  -- that have not migrated to item-priced menus.
  if not (new.category_details ? 'pricingOptions') then return new; end if;
  if jsonb_typeof(new.category_details -> 'pricingOptions') <> 'array' then
    raise exception 'Catering pricing options must be an array.';
  end if;
  option_count := jsonb_array_length(new.category_details -> 'pricingOptions');
  if new.status::text in ('pending_review', 'active') and option_count = 0 then
    raise exception 'Add at least one catering menu and pricing option.';
  end if;
  for option_row in select value from jsonb_array_elements(new.category_details -> 'pricingOptions')
  loop
    minimum_guests := coalesce(nullif(option_row ->> 'minimumGuests', '')::numeric, 0);
    maximum_guests := coalesce(nullif(option_row ->> 'maximumGuests', '')::numeric, 0);
    if nullif(trim(option_row ->> 'id'), '') is null
      or nullif(trim(option_row ->> 'name'), '') is null
      or coalesce(nullif(option_row ->> 'pricePerHead', '')::numeric, 0) <= 0
      or minimum_guests <= 0 or maximum_guests < minimum_guests then
      raise exception 'Every catering option needs an ID, name, positive per-head price, and valid guest range.';
    end if;
    if jsonb_typeof(option_row -> 'menuSections') <> 'array'
      or not exists (
        select 1 from jsonb_array_elements(option_row -> 'menuSections') section(value)
        where nullif(trim(section.value ->> 'name'), '') is not null
          and jsonb_typeof(section.value -> 'items') = 'array'
          and jsonb_array_length(section.value -> 'items') > 0
      ) then
      raise exception 'Every catering option needs at least one named menu section with an item.';
    end if;
  end loop;
  select count(distinct option.value ->> 'id') into option_ids
  from jsonb_array_elements(new.category_details -> 'pricingOptions') option(value);
  if option_ids <> option_count then
    raise exception 'Catering option IDs must be unique within a service.';
  end if;
  return new;
end;
$$;

create or replace function public.calculate_catering_menu_quote(
  target_service_id uuid,
  target_event_id uuid,
  target_menu_item_ids jsonb
)
returns jsonb
language plpgsql
stable
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
  selected_items jsonb := '[]'::jsonb;
  provider_unit_price numeric(12,2) := 0;
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  commission_rate numeric := public.get_public_commission_rate();
  minimum_guests integer;
  maximum_guests integer;
  minimum_selections integer;
  maximum_selections integer;
  selected_in_section integer;
  section_item_count integer;
  required_missing boolean;
  selected_item boolean;
begin
  if jsonb_typeof(coalesce(target_menu_item_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'Selected catering menu items must be an array.';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into selected_ids
  from jsonb_array_elements_text(target_menu_item_ids) item(value);
  if cardinality(selected_ids) = 0 then raise exception 'Select at least one food item.'; end if;
  if cardinality(selected_ids) <> cardinality(array(select distinct unnest(selected_ids))) then
    raise exception 'A food item can only be selected once.';
  end if;

  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;
  if coalesce(event_row.guest_count, 0) <= 0 then
    raise exception 'Set the event guest count before choosing catering.';
  end if;

  select service.id, service.name, service.provider_id, service.category_details,
    category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id and service.status = 'active'
    and service.is_available = true and owner.account_status in ('active', 'verified');
  if service_row.id is null then raise exception 'This service is no longer available.'; end if;
  if public.phase9_category_key(service_row.category_name) <> 'catering' then
    raise exception 'This service does not use a catering menu.';
  end if;
  if jsonb_typeof(service_row.category_details -> 'customMenuSections') <> 'array'
    or jsonb_array_length(service_row.category_details -> 'customMenuSections') = 0 then
    raise exception 'This provider has not configured an item-priced catering menu.';
  end if;
  minimum_guests := greatest(coalesce(nullif(service_row.category_details ->> 'minimumGuests', '')::integer, 0), 1);
  maximum_guests := coalesce(nullif(service_row.category_details ->> 'maximumGuests', '')::integer, 0);
  if maximum_guests < minimum_guests or event_row.guest_count < minimum_guests
    or event_row.guest_count > maximum_guests then
    raise exception 'This catering menu does not support the event guest count.';
  end if;

  for section_row in select value from jsonb_array_elements(service_row.category_details -> 'customMenuSections')
  loop
    if jsonb_typeof(section_row -> 'items') <> 'array' then
      raise exception 'This catering menu is invalid.';
    end if;
    minimum_selections := greatest(coalesce(nullif(section_row ->> 'minimumSelections', '')::integer, 0), 0);
    maximum_selections := nullif(section_row ->> 'maximumSelections', '')::integer;
    selected_in_section := 0;
    section_item_count := 0;
    required_missing := false;
    for item_row in select value from jsonb_array_elements(section_row -> 'items')
    loop
      selected_item := item_row ->> 'id' = any(selected_ids);
      if selected_item then
        if coalesce(nullif(item_row ->> 'isActive', '')::boolean, true) = false then
          raise exception 'A selected food item is no longer available.';
        end if;
        if coalesce(nullif(item_row ->> 'pricePerHead', '')::numeric, 0) <= 0
          or nullif(trim(item_row ->> 'name'), '') is null then
          raise exception 'A selected food item has invalid pricing.';
        end if;
        recognized_ids := recognized_ids || (item_row ->> 'id');
        selected_in_section := selected_in_section + 1;
        provider_unit_price := provider_unit_price
          + (item_row ->> 'pricePerHead')::numeric;
        selected_items := selected_items || jsonb_build_array(jsonb_build_object(
          'id', item_row ->> 'id',
          'name', item_row ->> 'name',
          'description', nullif(item_row ->> 'description', ''),
          'pricePerHead', (item_row ->> 'pricePerHead')::numeric,
          'sectionId', section_row ->> 'id',
          'sectionName', section_row ->> 'name'
        ));
      end if;
      if coalesce(nullif(item_row ->> 'isRequired', '')::boolean, false) and not selected_item then
        required_missing := true;
      end if;
      if coalesce(nullif(item_row ->> 'isActive', '')::boolean, true) then
        section_item_count := section_item_count + 1;
      end if;
    end loop;
    if section_item_count < minimum_selections then raise exception 'This catering menu is invalid.'; end if;
    if required_missing then raise exception 'Select all required food items in %.', coalesce(section_row ->> 'name', 'this section'); end if;
    if selected_in_section < minimum_selections then
      raise exception 'Choose at least % item(s) from %.', minimum_selections, coalesce(section_row ->> 'name', 'this section');
    end if;
    if maximum_selections is not null and maximum_selections > 0 and selected_in_section > maximum_selections then
      raise exception 'Choose up to % item(s) from %.', maximum_selections, coalesce(section_row ->> 'name', 'this section');
    end if;
  end loop;
  if cardinality(recognized_ids) <> cardinality(selected_ids) then
    raise exception 'One or more selected food items are not offered by this provider.';
  end if;
  if provider_unit_price <= 0 then raise exception 'The selected catering menu has no valid price.'; end if;

  provider_unit_price := round(provider_unit_price, 2);
  provider_amount := round(provider_unit_price * event_row.guest_count, 2);
  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  return jsonb_build_object(
    'serviceId', service_row.id,
    'serviceName', service_row.name,
    'categoryKey', 'catering',
    'isCatering', true,
    'guestCount', event_row.guest_count,
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * 0.40, 2),
    'providerInitialShare', round(provider_amount * 0.30, 2),
    'remainingProviderBalance', round(provider_amount * 0.70, 2),
    'cateringOption', jsonb_build_object(
      'id', 'custom-menu', 'name', 'Custom menu',
      'pricePerHead', provider_unit_price,
      'minimumGuests', minimum_guests, 'maximumGuests', maximum_guests,
      'selectedItems', selected_items,
      'guestCount', event_row.guest_count,
      'providerAmount', provider_amount,
      'calculatedAmount', customer_amount,
      'pricingVersion', 'phase11-item-menu-v1'
    )
  );
end;
$$;

create or replace function public.save_my_catering_menu_service_selection(
  target_event_id uuid,
  target_service_id uuid,
  target_menu_item_ids jsonb,
  target_meal_type text default null,
  target_notes text default null,
  replace_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  service_row record;
  existing_row public.event_service_selections%rowtype;
  pricing jsonb;
  selection_id uuid;
  replaced_selection_id uuid;
  other_allocations numeric(12,2);
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;
  select service.*, category.name as category_name into service_row
  from public.services service join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id;
  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'catering' then
    raise exception 'Catering service not found.';
  end if;
  select * into existing_row from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.category_key = 'catering'
    and selection.status not in ('declined', 'cancelled')
  order by selection.created_at limit 1 for update;
  if existing_row.id is not null and existing_row.status <> 'selected' then
    raise exception 'This category already has an active provider request and cannot be changed here.';
  end if;
  if existing_row.id is not null and existing_row.service_id is distinct from target_service_id then
    if not replace_existing then raise exception 'A catering service is already selected. Confirm replacement first.'; end if;
    replaced_selection_id := existing_row.id;
    delete from public.event_service_selections where id = existing_row.id;
    existing_row.id := null;
  end if;

  pricing := public.calculate_catering_menu_quote(target_service_id, target_event_id, target_menu_item_ids);
  if existing_row.id is null then
    insert into public.event_service_selections (
      event_id, client_id, provider_id, service_id, category_id, category_key,
      service_name, category_name, estimated_amount, attendee_count, budget_per_head,
      meal_type, outside_food, catering_option_id, catering_option_name,
      catering_option_snapshot, dietary_notes, notes, status, selected_provider_snapshot
    ) values (
      event_row.id, event_row.client_id, service_row.provider_id, service_row.id,
      service_row.category_id, 'catering', service_row.name, service_row.category_name,
      (pricing ->> 'customerAmount')::numeric, event_row.guest_count,
      round((pricing ->> 'customerAmount')::numeric / greatest(event_row.guest_count, 1), 2),
      target_meal_type, false, 'custom-menu', 'Custom menu', pricing -> 'cateringOption',
      target_notes, target_notes, 'selected', jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'providerName', coalesce((select provider.business_name from public.provider_profiles provider
          where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'phase11-item-menu-v1', 'remainingBudgetCurrency', 'PHP'
      )
    ) returning id into selection_id;
  else
    selection_id := existing_row.id;
    update public.event_service_selections set
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = event_row.guest_count,
      budget_per_head = round((pricing ->> 'customerAmount')::numeric / greatest(event_row.guest_count, 1), 2),
      meal_type = target_meal_type, catering_option_id = 'custom-menu',
      catering_option_name = 'Custom menu', catering_option_snapshot = pricing -> 'cateringOption',
      dietary_notes = target_notes, notes = target_notes,
      selected_provider_snapshot = selected_provider_snapshot || jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'pricingVersion', 'phase11-item-menu-v1', 'remainingBudgetCurrency', 'PHP'
      ), updated_at = now()
    where id = selection_id;
  end if;
  if coalesce(event_row.total_budget, 0) > 0 then
    select coalesce(sum(item.allocated_amount), 0) into other_allocations
    from public.event_budget_items item where item.event_id = event_row.id
      and item.allocation_version = 'phase7-v1' and item.category_key <> 'catering';
    if other_allocations + (pricing ->> 'customerAmount')::numeric > event_row.total_budget then
      raise exception 'The selected service exceeds the remaining event budget.';
    end if;
    perform set_config('app.phase9_budget_lock_authorized', 'true', true);
    insert into public.event_budget_items (
      event_id, category_key, label, allocated_amount, estimated_amount,
      priority_rank, is_priority, status, allocation_version, is_selection_locked, locked_selection_id
    ) values (
      event_row.id, 'catering', 'Catering', (pricing ->> 'customerAmount')::numeric,
      (pricing ->> 'customerAmount')::numeric, 99, true, 'planned', 'phase7-v1', true, selection_id
    ) on conflict (event_id, category_key) where allocation_version = 'phase7-v1'
    do update set allocated_amount = excluded.allocated_amount, estimated_amount = excluded.estimated_amount,
      is_selection_locked = true, locked_selection_id = excluded.locked_selection_id;
  end if;
  update public.events set status = case when status = 'draft' then 'planning' else status end,
    updated_at = now() where id = event_row.id;
  return pricing || jsonb_build_object('selectionId', selection_id, 'replacedSelectionId', replaced_selection_id);
end;
$$;

-- Package discovery loads structured custom menus separately from the existing
-- fixed-option package contract. This avoids changing package history or
-- inventing a base menu price.
create or replace function public.list_phase11_package_catering_menus()
returns table (package_id uuid, service_id uuid, menu_details jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select package.id, service.id, service.category_details
  from public.coordinator_packages package
  join public.coordinator_package_items item on item.package_id = package.id
  join public.services service on service.id = item.service_id
  join public.service_categories category on category.id = service.category_id
  join public.coordinator_service_profiles coordinator on coordinator.coordinator_id = package.coordinator_id
  join public.profiles profile on profile.id = package.coordinator_id
  where auth.uid() is not null and package.status = 'active'
    and service.status = 'active' and service.is_available = true
    and public.phase9_category_key(category.name) = 'catering'
    and jsonb_typeof(service.category_details -> 'customMenuSections') = 'array'
    and jsonb_array_length(service.category_details -> 'customMenuSections') > 0
    and coordinator.is_accepting_bookings = true and profile.account_status = 'active';
$$;

-- Phase 9 delegates package catering pricing to this function. Keeping its
-- signature means existing fixed-menu package clients continue to work while
-- an array choice selects the new item-priced menu path.
create or replace function public.choose_coordinator_package_with_options(
  target_event_id uuid,
  target_package_id uuid,
  catering_option_choices jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  package_selection_id uuid;
  catering_row record;
  chosen_option_id text;
  chosen_menu_item_ids jsonb;
  pricing jsonb;
  recalculated_subtotal numeric(12,2);
  selected_services jsonb;
begin
  if jsonb_typeof(coalesce(catering_option_choices, '{}'::jsonb)) <> 'object' then
    raise exception 'Catering choices must be an object.';
  end if;
  result := public.choose_coordinator_package(target_event_id, target_package_id);
  select selection.id into package_selection_id
  from public.event_coordinator_package_selections selection
  where selection.event_id = target_event_id and selection.package_id = target_package_id;
  if package_selection_id is null then raise exception 'Coordinator package selection was not created.'; end if;

  for catering_row in
    select event_selection.id as selection_id, event_selection.service_id
    from public.event_coordinator_package_services package_service
    join public.event_service_selections event_selection on event_selection.id = package_service.event_selection_id
    join public.services service on service.id = event_selection.service_id
    join public.service_categories category on category.id = service.category_id
    where package_service.package_selection_id = package_selection_id and package_service.created_by_package
      and public.phase9_category_key(category.name) = 'catering'
  loop
    chosen_menu_item_ids := catering_option_choices -> catering_row.service_id::text;
    if jsonb_typeof(chosen_menu_item_ids) = 'array' then
      pricing := public.calculate_catering_menu_quote(
        catering_row.service_id, target_event_id, chosen_menu_item_ids
      );
      chosen_option_id := 'custom-menu';
    else
      chosen_option_id := catering_option_choices ->> catering_row.service_id::text;
      if nullif(trim(chosen_option_id), '') is null then
        raise exception 'Choose a catering menu for every catering service in this package.';
      end if;
      pricing := public.calculate_event_service_price(
        catering_row.service_id, target_event_id, chosen_option_id
      );
    end if;
    update public.event_service_selections set
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = (pricing ->> 'guestCount')::integer,
      budget_per_head = round((pricing ->> 'customerAmount')::numeric
        / greatest((pricing ->> 'guestCount')::integer, 1), 2),
      catering_option_id = chosen_option_id,
      catering_option_name = pricing -> 'cateringOption' ->> 'name',
      catering_option_snapshot = pricing -> 'cateringOption',
      selected_provider_snapshot = selected_provider_snapshot || jsonb_build_object(
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'commissionAmount', (pricing ->> 'commissionAmount')::numeric,
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'pricingVersion', case when chosen_option_id = 'custom-menu'
          then 'phase11-item-menu-v1' else 'phase9-v1' end
      ), updated_at = now()
    where id = catering_row.selection_id;
  end loop;

  select coalesce(sum(event_selection.estimated_amount), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'selection_id', event_selection.id, 'service_id', event_selection.service_id,
      'service_name', event_selection.service_name, 'estimated_amount', event_selection.estimated_amount,
      'created_by_package', package_service.created_by_package,
      'catering_option_id', event_selection.catering_option_id,
      'catering_option_name', event_selection.catering_option_name
    ) order by event_selection.created_at), '[]'::jsonb)
  into recalculated_subtotal, selected_services
  from public.event_coordinator_package_services package_service
  join public.event_service_selections event_selection on event_selection.id = package_service.event_selection_id
  where package_service.package_selection_id = package_selection_id;
  update public.event_coordinator_package_selections set
    service_subtotal = recalculated_subtotal,
    package_snapshot = package_snapshot || jsonb_build_object(
      'service_subtotal', recalculated_subtotal, 'services', selected_services
    ), updated_at = now()
  where id = package_selection_id;
  return result || jsonb_build_object('service_subtotal', recalculated_subtotal, 'services', selected_services);
end;
$$;

revoke all on function public.validate_catering_pricing_options() from public;
revoke all on function public.calculate_catering_menu_quote(uuid, uuid, jsonb) from public;
revoke all on function public.save_my_catering_menu_service_selection(uuid, uuid, jsonb, text, text, boolean) from public;
revoke all on function public.list_phase11_package_catering_menus() from public;
grant execute on function public.calculate_catering_menu_quote(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_my_catering_menu_service_selection(uuid, uuid, jsonb, text, text, boolean) to authenticated;
grant execute on function public.list_phase11_package_catering_menus() to authenticated;
grant execute on function public.choose_coordinator_package_with_options(uuid, uuid, jsonb) to authenticated;

comment on function public.calculate_catering_menu_quote(uuid, uuid, jsonb) is
  'Authoritative custom catering calculation from provider-configured selected food items and event guest count.';
comment on function public.save_my_catering_menu_service_selection(uuid, uuid, jsonb, text, text, boolean) is
  'Saves one selected catering service with immutable selected-food and pricing snapshot.';

commit;
