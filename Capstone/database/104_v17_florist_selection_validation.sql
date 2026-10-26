-- MULTIVENT Revision V17, Phases 7-8: server-authoritative florist pricing
-- and persistence. The browser may describe a selection, but never its price.
begin;

create or replace function public.calculate_my_florist_service_quote_v17(
  target_event_id uuid,
  target_service_id uuid,
  target_selection jsonb
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
  package_row record;
  arrangement_row record;
  option_row record;
  group_row record;
  fulfillment_row record;
  selection_row jsonb;
  option_selection jsonb;
  selection_arrangements jsonb := coalesce(target_selection -> 'selectedArrangements', '[]'::jsonb);
  selection_add_ons jsonb := coalesce(target_selection -> 'packageAddOnIds', '[]'::jsonb);
  provider_total numeric(12,2) := 0;
  option_total numeric(12,2) := 0;
  fulfillment_total numeric(12,2) := 0;
  commission_rate numeric := public.get_public_commission_rate();
  arrangement_id uuid;
  package_id uuid;
  fulfillment_id uuid;
  option_id uuid;
  group_id uuid;
  selected_quantity integer;
  option_quantity integer;
  selected_group_ids uuid[] := '{}'::uuid[];
  selected_arrangement_ids uuid[] := '{}'::uuid[];
  selected_add_on_ids uuid[] := '{}'::uuid[];
  resolved_arrangements jsonb := '[]'::jsonb;
  resolved_options jsonb;
  resolved_add_ons jsonb := '[]'::jsonb;
  resolved_fulfillment jsonb := '{}'::jsonb;
  package_selected boolean := false;
begin
  if auth.uid() is null then raise exception 'You must be signed in to price a florist service.' using errcode = '42501'; end if;
  if jsonb_typeof(target_selection) <> 'object'
    or coalesce((target_selection ->> 'schemaVersion')::integer, 0) <> 1
    or jsonb_typeof(selection_arrangements) <> 'array'
    or jsonb_typeof(selection_add_ons) <> 'array'
  then raise exception 'The florist selection is invalid.'; end if;

  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select service.id, service.provider_id, service.name, service.category_id
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and lower(category.name) like '%flor%';
  if service_row.id is null then raise exception 'This florist service is no longer available.'; end if;

  if target_selection ? 'packageId' and nullif(target_selection ->> 'packageId', '') is not null then
    package_id := (target_selection ->> 'packageId')::uuid;
    select package.id, package.name, coalesce(package.price, 0) as price
    into package_row
    from public.service_packages package
    where package.id = package_id
      and package.service_id = service_row.id
      and package.is_active = true
      and package.is_deleted = false;
    if package_row.id is null then raise exception 'The selected florist package is unavailable.'; end if;
    if package_row.price <= 0 then raise exception 'The selected florist package needs a valid price.'; end if;
    package_selected := true;
    provider_total := package_row.price;
  elsif jsonb_array_length(selection_arrangements) = 0 then
    raise exception 'Choose a florist package or at least one floral arrangement.';
  end if;

  for selection_row in select value from jsonb_array_elements(selection_arrangements)
  loop
    if jsonb_typeof(selection_row) <> 'object' or nullif(selection_row ->> 'arrangementId', '') is null then
      raise exception 'Every selected florist arrangement must be identified.';
    end if;
    arrangement_id := (selection_row ->> 'arrangementId')::uuid;
    if arrangement_id = any(selected_arrangement_ids) then raise exception 'A florist arrangement can only be selected once.'; end if;
    selected_arrangement_ids := array_append(selected_arrangement_ids, arrangement_id);
    selected_quantity := coalesce(nullif(selection_row ->> 'quantity', '')::integer, 0);

    select arrangement.id, arrangement.name, arrangement.base_price, arrangement.pricing_unit,
      arrangement.minimum_quantity, arrangement.maximum_quantity
    into arrangement_row
    from public.florist_arrangements arrangement
    where arrangement.id = arrangement_id and arrangement.service_id = service_row.id and arrangement.is_active = true;
    if arrangement_row.id is null then raise exception 'A selected floral arrangement is unavailable.'; end if;
    if selected_quantity < arrangement_row.minimum_quantity
      or (arrangement_row.maximum_quantity is not null and selected_quantity > arrangement_row.maximum_quantity)
    then raise exception 'The quantity for % must stay within the provider limits.', arrangement_row.name; end if;

    if package_selected then
      if not exists (
        select 1 from public.florist_package_arrangements item
        where item.package_id = package_id and item.arrangement_id = arrangement_row.id
          and item.customization_allowed = true and selected_quantity <= item.included_quantity
      ) then raise exception 'This package does not allow that arrangement customization or quantity.'; end if;
    else
      provider_total := provider_total + round(arrangement_row.base_price * selected_quantity, 2);
    end if;

    resolved_options := '[]'::jsonb;
    if jsonb_typeof(coalesce(selection_row -> 'selectedOptions', '[]'::jsonb)) <> 'array' then
      raise exception 'Florist customization selections must be a list.';
    end if;
    for option_selection in select value from jsonb_array_elements(coalesce(selection_row -> 'selectedOptions', '[]'::jsonb))
    loop
      if jsonb_typeof(option_selection) <> 'object' then raise exception 'A florist customization is invalid.'; end if;
      option_id := nullif(option_selection ->> 'optionId', '')::uuid;
      group_id := nullif(option_selection ->> 'optionGroupId', '')::uuid;
      if option_id is not null then
        select option.id, option.name, option.price_modifier, option.price_modifier_type,
          option_group.id as option_group_id, option_group.selection_type
        into option_row
        from public.florist_arrangement_options option
        join public.florist_arrangement_option_groups option_group on option_group.id = option.option_group_id
        where option.id = option_id and option.is_active and option_group.is_active
          and option_group.arrangement_id = arrangement_row.id;
        if option_row.id is null then raise exception 'A selected florist customization is unavailable.'; end if;
        group_id := option_row.option_group_id;
        option_quantity := case when option_row.selection_type = 'quantity'
          then coalesce(nullif(option_selection ->> 'quantity', '')::integer, 0) else 1 end;
        if option_quantity < 1 then raise exception 'Choose a positive quantity for %.', option_row.name; end if;
        option_total := option_total + case option_row.price_modifier_type
          when 'per_unit' then round(option_row.price_modifier * option_quantity, 2)
          when 'included' then 0
          else round(option_row.price_modifier, 2) end;
        resolved_options := resolved_options || jsonb_build_array(jsonb_build_object(
          'optionId', option_row.id, 'optionGroupId', group_id, 'name', option_row.name,
          'quantity', option_quantity, 'priceModifier', option_row.price_modifier,
          'priceModifierType', option_row.price_modifier_type,
          'value', nullif(option_selection ->> 'value', '')
        ));
      else
        if group_id is null then raise exception 'A florist customization must identify an option or input group.'; end if;
        select option_group.id, option_group.name, option_group.selection_type
        into group_row from public.florist_arrangement_option_groups option_group
        where option_group.id = group_id and option_group.arrangement_id = arrangement_row.id
          and option_group.is_active and option_group.selection_type in ('text', 'image');
        if group_row.id is null or nullif(option_selection ->> 'value', '') is null then
          raise exception 'A florist special request is invalid.';
        end if;
        resolved_options := resolved_options || jsonb_build_array(jsonb_build_object(
          'optionGroupId', group_row.id, 'name', group_row.name,
          'selectionType', group_row.selection_type, 'value', nullif(option_selection ->> 'value', '')
        ));
      end if;
      selected_group_ids := array_append(selected_group_ids, group_id);
    end loop;

    for group_row in
      select option_group.id, option_group.name, option_group.is_required,
        option_group.minimum_selections, option_group.maximum_selections
      from public.florist_arrangement_option_groups option_group
      where option_group.arrangement_id = arrangement_row.id and option_group.is_active
    loop
      select count(*) into option_quantity
      from jsonb_array_elements(resolved_options) resolved(value)
      where resolved.value ->> 'optionGroupId' = group_row.id::text;
      if option_quantity < greatest(group_row.minimum_selections, case when group_row.is_required then 1 else 0 end) then
        raise exception 'Select the required % option for %.', group_row.name, arrangement_row.name;
      end if;
      if group_row.maximum_selections is not null and option_quantity > group_row.maximum_selections then
        raise exception 'The % option for % exceeds the provider selection limit.', group_row.name, arrangement_row.name;
      end if;
    end loop;

    resolved_arrangements := resolved_arrangements || jsonb_build_array(jsonb_build_object(
      'arrangementId', arrangement_row.id, 'name', arrangement_row.name,
      'pricingUnit', arrangement_row.pricing_unit, 'basePrice', arrangement_row.base_price,
      'quantity', selected_quantity, 'selectedOptions', resolved_options
    ));
  end loop;

  if package_selected then
    for selection_row in select value from jsonb_array_elements(selection_add_ons)
    loop
      package_id := (selection_row #>> '{}')::uuid;
      if package_id = any(selected_add_on_ids) then raise exception 'A florist package add-on can only be selected once.'; end if;
      selected_add_on_ids := array_append(selected_add_on_ids, package_id);
      select add_on.id, add_on.name, add_on.price, add_on.pricing_unit into option_row
      from public.florist_package_add_ons add_on
      where add_on.id = package_id and add_on.package_id = (target_selection ->> 'packageId')::uuid and add_on.is_active;
      if option_row.id is null then raise exception 'A selected florist package add-on is unavailable.'; end if;
      provider_total := provider_total + option_row.price;
      resolved_add_ons := resolved_add_ons || jsonb_build_array(jsonb_build_object(
        'addOnId', option_row.id, 'name', option_row.name, 'price', option_row.price,
        'pricingUnit', option_row.pricing_unit
      ));
    end loop;
  elsif jsonb_array_length(selection_add_ons) > 0 then
    raise exception 'Florist package add-ons require a selected package.';
  end if;

  if nullif(target_selection ->> 'fulfillmentOptionId', '') is not null then
    fulfillment_id := (target_selection ->> 'fulfillmentOptionId')::uuid;
    select option.id, option.fulfillment_kind, option.name, option.price, option.coverage_details
    into fulfillment_row
    from public.florist_service_fulfillment_options option
    where option.id = fulfillment_id and option.service_id = service_row.id and option.is_active;
    if fulfillment_row.id is null then raise exception 'The selected florist fulfillment option is unavailable.'; end if;
    fulfillment_total := fulfillment_row.price;
    resolved_fulfillment := jsonb_build_object('fulfillmentOptionId', fulfillment_row.id,
      'kind', fulfillment_row.fulfillment_kind, 'name', fulfillment_row.name,
      'price', fulfillment_row.price, 'coverageDetails', fulfillment_row.coverage_details);
  end if;

  provider_total := round(provider_total + option_total + fulfillment_total, 2);
  if provider_total <= 0 then raise exception 'The florist selection needs a positive provider total.'; end if;
  return jsonb_build_object(
    'providerAmount', provider_total,
    'customerAmount', round(provider_total * (1 + commission_rate), 2),
    'commissionRate', commission_rate,
    'platformFee', round(provider_total * commission_rate, 2),
    'selectionSnapshot', jsonb_build_object(
      'schemaVersion', 1, 'packageId', case when package_selected then target_selection ->> 'packageId' else null end,
      'packageName', case when package_selected then package_row.name else null end,
      'packageBasePrice', case when package_selected then package_row.price else null end,
      'packageAddOns', resolved_add_ons, 'selectedArrangements', resolved_arrangements,
      'fulfillment', resolved_fulfillment, 'providerBaseTotal', provider_total,
      'marketplaceTotal', round(provider_total * (1 + commission_rate), 2),
      'commissionRate', commission_rate
    )
  );
end;
$$;

create or replace function public.save_my_florist_service_selection_v17(
  target_event_id uuid,
  target_service_id uuid,
  target_selection jsonb,
  target_notes text default null,
  replace_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pricing jsonb;
  generic_result jsonb;
  selection_id uuid;
  package_id uuid;
  event_total numeric(12,2);
  other_allocations numeric(12,2);
begin
  pricing := public.calculate_my_florist_service_quote_v17(target_event_id, target_service_id, target_selection);
  package_id := nullif(target_selection ->> 'packageId', '')::uuid;
  generic_result := public.save_my_event_service_selection(
    target_event_id, target_service_id, package_id, null, null, null, target_notes, replace_existing
  );
  selection_id := (generic_result ->> 'selectionId')::uuid;

  select total_budget into event_total from public.events where id = target_event_id and client_id = auth.uid();
  if coalesce(event_total, 0) > 0 then
    select coalesce(sum(item.allocated_amount), 0) into other_allocations
    from public.event_budget_items item
    where item.event_id = target_event_id and item.allocation_version = 'phase7-v1'
      and item.category_key <> 'floral';
    if other_allocations + (pricing ->> 'customerAmount')::numeric > event_total then
      raise exception 'The selected florist service exceeds the remaining event budget.';
    end if;
  end if;

  update public.event_service_selections
  set estimated_amount = (pricing ->> 'customerAmount')::numeric,
      notes = coalesce(target_notes, notes),
      florist_selection_snapshot = pricing -> 'selectionSnapshot',
      selected_provider_snapshot = coalesce(selected_provider_snapshot, '{}'::jsonb) || jsonb_build_object(
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'pricingVersion', 'v17-florist-v1'
      ),
      updated_at = now()
  where id = selection_id;

  perform set_config('app.phase9_budget_lock_authorized', 'true', true);
  update public.event_budget_items
  set allocated_amount = (pricing ->> 'customerAmount')::numeric,
      estimated_amount = (pricing ->> 'customerAmount')::numeric
  where event_id = target_event_id and category_key = 'floral'
    and allocation_version = 'phase7-v1' and locked_selection_id = selection_id;

  return pricing || jsonb_build_object(
    'selectionId', selection_id,
    'replacedSelectionId', generic_result -> 'replacedSelectionId'
  );
end;
$$;

grant execute on function public.calculate_my_florist_service_quote_v17(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_my_florist_service_selection_v17(uuid, uuid, jsonb, text, boolean) to authenticated;

revoke all on function public.calculate_my_florist_service_quote_v17(uuid, uuid, jsonb) from anon;
revoke all on function public.save_my_florist_service_selection_v17(uuid, uuid, jsonb, text, boolean) from anon;

comment on function public.calculate_my_florist_service_quote_v17(uuid, uuid, jsonb) is
  'Validates provider-owned florist configuration and calculates the marketplace price once.';
comment on function public.save_my_florist_service_selection_v17(uuid, uuid, jsonb, text, boolean) is
  'Persists a validated florist configuration through the existing event selection flow.';

commit;
