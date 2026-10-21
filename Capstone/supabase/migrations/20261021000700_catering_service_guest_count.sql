-- V10 Phase 4: a catering order may serve a different number of guests from
-- the event-wide estimate. Keep that quantity on the service selection and
-- use it for every quote, budget check, and checkout validation.
begin;

create or replace function public.calculate_catering_service_quote_v10(
  target_service_id uuid,
  target_event_id uuid,
  target_guest_count integer,
  target_option_id text default null,
  target_package_id uuid default null
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
  selected_option jsonb;
  package_unit text;
  package_pricing_model text;
  provider_unit_price numeric(12,2);
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  commission_rate numeric := public.get_public_commission_rate();
  minimum_guests integer := 1;
  maximum_guests integer;
  package_snapshot jsonb := '{}'::jsonb;
begin
  if target_guest_count is null or target_guest_count <= 0 then
    raise exception 'Enter a valid whole-number catering guest count.';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select
    service.id as service_id,
    service.name as service_name,
    service.provider_id,
    service.category_details,
    service.base_price,
    service.pricing_unit as service_pricing_unit,
    category.name as category_name,
    package.id as package_id,
    package.name as package_name,
    package.description as package_description,
    package.price as package_price,
    package.pricing_unit as package_pricing_unit,
    package.pricing_mode as package_pricing_mode,
    package.inclusions as package_inclusions
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  left join public.service_packages package on package.id = target_package_id
    and package.service_id = service.id
    and package.is_active = true
    and coalesce(package.is_deleted, false) = false
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and owner.account_status in ('active', 'verified');
  if service_row.service_id is null then
    raise exception 'This catering service is no longer available.';
  end if;
  if public.phase9_category_key(service_row.category_name) <> 'catering' then
    raise exception 'This service does not use catering guest counts.';
  end if;
  if target_package_id is not null and service_row.package_id is null then
    raise exception 'The selected provider package is no longer available.';
  end if;

  if target_package_id is null then
    select option.value into selected_option
    from jsonb_array_elements(case
      when jsonb_typeof(service_row.category_details -> 'pricingOptions') = 'array'
        then service_row.category_details -> 'pricingOptions'
      when service_row.category_details ->> 'pricingBasis' = 'per_person'
        then jsonb_build_array(jsonb_build_object(
          'id', 'legacy-default',
          'name', coalesce(nullif(service_row.category_details ->> 'optionName', ''), 'Catering menu'),
          'pricePerHead', service_row.base_price,
          'minimumGuests', service_row.category_details -> 'minimumGuests',
          'maximumGuests', service_row.category_details -> 'maximumGuests',
          'menuSections', coalesce(service_row.category_details -> 'menuSections', '[]'::jsonb)
        ))
      else '[]'::jsonb end) option(value)
    where option.value ->> 'id' = target_option_id
    limit 1;
    if selected_option is null then
      raise exception 'Choose an available catering option.';
    end if;

    provider_unit_price := round(coalesce(nullif(selected_option ->> 'pricePerHead', '')::numeric, 0), 2);
    minimum_guests := greatest(coalesce(nullif(selected_option ->> 'minimumGuests', '')::integer, 1), 1);
    maximum_guests := nullif(selected_option ->> 'maximumGuests', '')::integer;
    if provider_unit_price <= 0
      or target_guest_count < minimum_guests
      or (maximum_guests is not null and target_guest_count > maximum_guests) then
      raise exception 'This catering option does not support the selected guest count.';
    end if;
    provider_amount := round(provider_unit_price * target_guest_count, 2);
  else
    -- A provider package has no manual catering-option requirement. Its
    -- configured unit determines whether the count affects its total.
    package_unit := coalesce(
      nullif(service_row.package_pricing_unit, ''),
      nullif(service_row.service_pricing_unit, ''),
      'event'
    );
    if package_unit not in ('event', 'person', 'hour', 'day') then
      raise exception 'The selected provider package has an unsupported pricing unit.';
    end if;
    provider_unit_price := round(coalesce(service_row.package_price, 0), 2);
    if provider_unit_price <= 0 then
      raise exception 'The selected provider package must have a price greater than zero.';
    end if;
    minimum_guests := greatest(coalesce(
      nullif(service_row.category_details ->> 'minimumGuests', '')::integer,
      1
    ), 1);
    maximum_guests := nullif(service_row.category_details ->> 'maximumGuests', '')::integer;
    if target_guest_count < minimum_guests
      or (maximum_guests is not null and target_guest_count > maximum_guests) then
      raise exception 'This catering package does not support the selected guest count.';
    end if;

    -- Preserve the package calendar and active-booking checks from V10 Phase 2.
    if event_row.event_date is not null and event_row.event_time is not null then
      if exists (
        select 1
        from public.provider_availability availability
        where availability.provider_id = service_row.provider_id
          and availability.available_date = event_row.event_date
          and (availability.service_id is null or availability.service_id = service_row.service_id)
          and (
            availability.is_available = false
            or (availability.start_time is not null and event_row.event_time < availability.start_time)
            or (availability.end_time is not null and event_row.event_time > availability.end_time)
          )
      ) then
        raise exception 'This provider package is unavailable for the requested event schedule.';
      end if;
      if exists (
        select 1
        from public.provider_operating_hours operating_hours
        where operating_hours.provider_id = service_row.provider_id
          and operating_hours.day_of_week = lower(trim(to_char(event_row.event_date, 'Day')))
          and (
            operating_hours.is_open = false
            or event_row.event_time < operating_hours.open_time
            or event_row.event_time > operating_hours.close_time
          )
      ) then
        raise exception 'This provider package is outside the provider operating hours.';
      end if;
      if exists (
        select 1
        from public.bookings booking
        where booking.provider_id = service_row.provider_id
          and booking.event_id <> event_row.id
          and booking.requested_date = event_row.event_date
          and booking.requested_time = event_row.event_time
          and booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
      ) then
        raise exception 'This provider package is already booked for the requested event schedule.';
      end if;
    end if;

    provider_amount := case
      when package_unit = 'person' then round(provider_unit_price * target_guest_count, 2)
      else provider_unit_price
    end;
    package_pricing_model := case when package_unit = 'person' then 'per_person' else 'fixed_event' end;
    package_snapshot := jsonb_build_object(
      'id', service_row.package_id,
      'name', service_row.package_name,
      'description', service_row.package_description,
      'pricingModel', package_pricing_model,
      'pricingMode', coalesce(service_row.package_pricing_mode, 'legacy'),
      'pricingUnit', package_unit,
      'basePrice', provider_unit_price,
      'inclusions', coalesce(service_row.package_inclusions, '[]'::jsonb),
      'guestCount', target_guest_count,
      'providerAmount', provider_amount,
      'capturedAt', now()
    );
    selected_option := jsonb_build_object(
      'id', 'provider-package:' || service_row.package_id::text,
      'name', service_row.package_name,
      'packageId', service_row.package_id,
      'pricingBasis', 'provider_package_' || package_pricing_model,
      'pricingUnit', package_unit,
      'minimumGuests', minimum_guests,
      'maximumGuests', maximum_guests,
      'providerUnitPrice', provider_unit_price,
      'inclusions', coalesce(service_row.package_inclusions, '[]'::jsonb)
    );
  end if;

  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  selected_option := coalesce(selected_option, '{}'::jsonb) || jsonb_build_object(
    'guestCount', target_guest_count,
    'providerAmount', provider_amount,
    'calculatedAmount', customer_amount
  );
  if target_package_id is not null then
    package_snapshot := package_snapshot || jsonb_build_object(
      'customerAmount', customer_amount,
      'commissionRate', commission_rate
    );
  end if;

  return jsonb_build_object(
    'serviceId', service_row.service_id,
    'serviceName', service_row.service_name,
    'categoryKey', 'catering',
    'isCatering', true,
    'guestCount', target_guest_count,
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * 0.35, 2),
    'providerInitialShare', round(provider_amount * 0.30, 2),
    'remainingProviderBalance', round(provider_amount * 0.70, 2),
    'cateringOption', selected_option,
    'packageSnapshot', package_snapshot
  );
end;
$$;

create or replace function public.calculate_catering_menu_quote_v10(
  target_service_id uuid,
  target_event_id uuid,
  target_menu_item_ids jsonb,
  target_guest_count integer
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
  if target_guest_count is null or target_guest_count <= 0 then
    raise exception 'Enter a valid whole-number catering guest count.';
  end if;
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
  maximum_guests := nullif(service_row.category_details ->> 'maximumGuests', '')::integer;
  if target_guest_count < minimum_guests
    or (maximum_guests is not null and target_guest_count > maximum_guests) then
    raise exception 'This catering menu does not support the selected guest count.';
  end if;

  for section_row in select value from jsonb_array_elements(service_row.category_details -> 'customMenuSections')
  loop
    if jsonb_typeof(section_row -> 'items') <> 'array' then raise exception 'This catering menu is invalid.'; end if;
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
        provider_unit_price := provider_unit_price + (item_row ->> 'pricePerHead')::numeric;
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
  provider_amount := round(provider_unit_price * target_guest_count, 2);
  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  return jsonb_build_object(
    'serviceId', service_row.id,
    'serviceName', service_row.name,
    'categoryKey', 'catering',
    'isCatering', true,
    'guestCount', target_guest_count,
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * 0.35, 2),
    'providerInitialShare', round(provider_amount * 0.30, 2),
    'remainingProviderBalance', round(provider_amount * 0.70, 2),
    'cateringOption', jsonb_build_object(
      'id', 'custom-menu', 'name', 'Custom menu',
      'pricePerHead', provider_unit_price,
      'minimumGuests', minimum_guests, 'maximumGuests', maximum_guests,
      'selectedItems', selected_items,
      'guestCount', target_guest_count,
      'providerAmount', provider_amount,
      'calculatedAmount', customer_amount,
      'pricingVersion', 'v10-service-guest-count'
    )
  );
end;
$$;

create or replace function public.save_my_catering_service_selection_v10(
  target_event_id uuid,
  target_service_id uuid,
  target_guest_count integer,
  target_option_id text default null,
  target_package_id uuid default null,
  target_menu_item_ids jsonb default null,
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

  pricing := case when target_menu_item_ids is not null
    then public.calculate_catering_menu_quote_v10(
      target_service_id, target_event_id, target_menu_item_ids, target_guest_count
    )
    else public.calculate_catering_service_quote_v10(
      target_service_id, target_event_id, target_guest_count, target_option_id, target_package_id
    ) end;

  if existing_row.id is null then
    insert into public.event_service_selections (
      event_id, client_id, provider_id, service_id, package_id, category_id, category_key,
      service_name, category_name, estimated_amount, attendee_count, budget_per_head,
      meal_type, outside_food, catering_option_id, catering_option_name,
      catering_option_snapshot, dietary_notes, notes, status, selected_provider_snapshot
    ) values (
      event_row.id, event_row.client_id, service_row.provider_id, service_row.id,
      target_package_id, service_row.category_id, 'catering', service_row.name, service_row.category_name,
      (pricing ->> 'customerAmount')::numeric, (pricing ->> 'guestCount')::integer,
      round((pricing ->> 'customerAmount')::numeric / greatest((pricing ->> 'guestCount')::integer, 1), 2),
      target_meal_type, false, pricing -> 'cateringOption' ->> 'id',
      pricing -> 'cateringOption' ->> 'name', pricing -> 'cateringOption',
      target_notes, target_notes, 'selected', jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'providerName', coalesce((select provider.business_name from public.provider_profiles provider
          where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'v10-service-guest-count', 'remainingBudgetCurrency', 'PHP'
      )
    ) returning id into selection_id;
  else
    selection_id := existing_row.id;
    update public.event_service_selections set
      package_id = target_package_id,
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = (pricing ->> 'guestCount')::integer,
      budget_per_head = round((pricing ->> 'customerAmount')::numeric
        / greatest((pricing ->> 'guestCount')::integer, 1), 2),
      meal_type = target_meal_type,
      catering_option_id = pricing -> 'cateringOption' ->> 'id',
      catering_option_name = pricing -> 'cateringOption' ->> 'name',
      catering_option_snapshot = pricing -> 'cateringOption',
      dietary_notes = target_notes, notes = target_notes,
      selected_provider_snapshot = jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'pricingVersion', 'v10-service-guest-count', 'remainingBudgetCurrency', 'PHP'
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

-- Checkout and saved-plan validation must reuse the persisted catering count,
-- never fall back to the event estimate after a client has configured food.
create or replace function public.validate_my_phase9_selections(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection_row record;
  custom_menu_item_ids jsonb;
  venue_inputs jsonb;
begin
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then raise exception 'Event not found.' using errcode = '42501'; end if;
  if exists (
    select 1 from public.event_service_selections selection
    where selection.event_id = target_event_id and selection.status not in ('declined', 'cancelled')
    group by selection.category_key having count(*) > 1
  ) then raise exception 'Only one service may be selected per category.'; end if;

  for selection_row in
    select selection.service_id, selection.package_id, selection.category_key,
      selection.attendee_count, selection.catering_option_id, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_booked_hours, selection.venue_options_snapshot
    from public.event_service_selections selection
    where selection.event_id = target_event_id and selection.client_id = auth.uid()
      and selection.status in ('selected', 'requested')
  loop
    if selection_row.category_key = 'catering'
      and selection_row.catering_option_id = 'custom-menu' then
      select coalesce(jsonb_agg(item.value ->> 'id'), '[]'::jsonb)
      into custom_menu_item_ids
      from jsonb_array_elements(coalesce(selection_row.catering_option_snapshot -> 'selectedItems', '[]'::jsonb)) item(value);
      perform public.calculate_catering_menu_quote_v10(
        selection_row.service_id, target_event_id, custom_menu_item_ids,
        greatest(coalesce(selection_row.attendee_count, 0), 1)
      );
    elsif selection_row.category_key = 'catering' then
      perform public.calculate_catering_service_quote_v10(
        selection_row.service_id, target_event_id,
        greatest(coalesce(selection_row.attendee_count, 0), 1),
        selection_row.catering_option_id, selection_row.package_id
      );
    elsif selection_row.category_key = 'venue'
      and jsonb_typeof(selection_row.venue_options_snapshot) = 'array'
      and jsonb_array_length(selection_row.venue_options_snapshot) > 0 then
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'optionId', item.value ->> 'id',
        'bookedHours', case when coalesce(item.value ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (item.value ->> 'selectedDurationHours')::numeric else null end
      ))) into venue_inputs from jsonb_array_elements(selection_row.venue_options_snapshot) item(value);
      perform public.calculate_event_venue_quote_v8(
        selection_row.service_id, target_event_id, coalesce(venue_inputs, '[]'::jsonb)
      );
    else
      perform public.calculate_event_service_quote(
        selection_row.service_id, target_event_id,
        case when selection_row.category_key = 'venue'
          then selection_row.venue_option_id else selection_row.catering_option_id end,
        selection_row.venue_booked_hours, selection_row.package_id
      );
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.calculate_catering_service_quote_v10(uuid, uuid, integer, text, uuid) from public;
revoke all on function public.calculate_catering_menu_quote_v10(uuid, uuid, jsonb, integer) from public;
revoke all on function public.save_my_catering_service_selection_v10(uuid, uuid, integer, text, uuid, jsonb, text, text, boolean) from public;
revoke all on function public.validate_my_phase9_selections(uuid) from public;
grant execute on function public.calculate_catering_service_quote_v10(uuid, uuid, integer, text, uuid) to authenticated;
grant execute on function public.calculate_catering_menu_quote_v10(uuid, uuid, jsonb, integer) to authenticated;
grant execute on function public.save_my_catering_service_selection_v10(uuid, uuid, integer, text, uuid, jsonb, text, text, boolean) to authenticated;
grant execute on function public.validate_my_phase9_selections(uuid) to authenticated;

comment on function public.save_my_catering_service_selection_v10(uuid, uuid, integer, text, uuid, jsonb, text, text, boolean) is
  'Saves a catering option, package, or item-priced menu with its service-specific guest count and immutable quote snapshot.';

commit;
