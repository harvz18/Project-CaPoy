-- MULTIVENT Revision 2, Phase 3: guest-based catering options and snapshots.
-- Apply after 54_coordinator_packages.sql.

begin;

alter table public.event_service_selections
  add column if not exists catering_option_id text,
  add column if not exists catering_option_name text,
  add column if not exists catering_option_snapshot jsonb not null default '{}'::jsonb;

alter table public.bookings
  add column if not exists catering_option_id text,
  add column if not exists catering_option_name text,
  add column if not exists catering_option_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_catering_snapshot_object_check,
  add constraint event_service_selections_catering_snapshot_object_check
    check (jsonb_typeof(catering_option_snapshot) = 'object');

alter table public.bookings
  drop constraint if exists bookings_catering_snapshot_object_check,
  add constraint bookings_catering_snapshot_object_check
    check (jsonb_typeof(catering_option_snapshot) = 'object');

-- This additional validator only applies when the Phase 3 pricingOptions key is
-- present. Older catering records remain valid and can be upgraded by editing
-- them in the provider UI.
create or replace function public.validate_catering_pricing_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  option_row jsonb;
  option_count integer := 0;
  option_ids integer := 0;
  minimum_guests numeric;
  maximum_guests numeric;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category where category.id = new.category_id;

  if category_name not like '%cater%' or not (new.category_details ? 'pricingOptions') then
    return new;
  end if;
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
      or minimum_guests <= 0
      or maximum_guests < minimum_guests
    then
      raise exception 'Every catering option needs an ID, name, positive per-head price, and valid guest range.';
    end if;
    if jsonb_typeof(option_row -> 'menuSections') <> 'array'
      or not exists (
        select 1 from jsonb_array_elements(option_row -> 'menuSections') section(value)
        where nullif(trim(section.value ->> 'name'), '') is not null
          and jsonb_typeof(section.value -> 'items') = 'array'
          and jsonb_array_length(section.value -> 'items') > 0
      )
    then
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

drop trigger if exists validate_catering_pricing_options_trigger on public.services;
create trigger validate_catering_pricing_options_trigger
before insert or update of category_id, category_details, status on public.services
for each row execute function public.validate_catering_pricing_options();

-- Authoritative event-aware pricing. Catering always uses the event guest
-- count and a provider-defined option; other services retain existing rules.
create or replace function public.calculate_event_service_price(
  target_service_id uuid,
  target_event_id uuid,
  target_catering_option_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_guests integer;
  service_row record;
  selected_option jsonb;
  provider_unit_price numeric;
  provider_amount numeric;
  customer_amount numeric;
  commission_rate numeric := public.get_public_commission_rate();
  minimum_guests integer;
  maximum_guests integer;
  is_catering boolean;
begin
  select greatest(coalesce(event.guest_count, 0), 0) into event_guests
  from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if not found then raise exception 'Event not found.' using errcode = '42501'; end if;

  select service.id, service.name, service.base_price, service.pricing_unit,
    service.category_details, lower(category.name) as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id and service.status = 'active'
    and service.is_available = true and owner.account_status in ('active', 'verified');
  if service_row.id is null then raise exception 'This service is no longer available.'; end if;

  is_catering := service_row.category_name like '%cater%';
  if is_catering then
    if event_guests <= 0 then raise exception 'Set the event guest count before choosing catering.'; end if;
    if jsonb_typeof(service_row.category_details -> 'pricingOptions') = 'array' then
      select option.value into selected_option
      from jsonb_array_elements(service_row.category_details -> 'pricingOptions') option(value)
      where option.value ->> 'id' = target_catering_option_id
      limit 1;
    elsif target_catering_option_id = 'legacy-default'
      and service_row.category_details ->> 'pricingBasis' = 'per_person'
    then
      selected_option := jsonb_build_object(
        'id', 'legacy-default', 'name', coalesce(nullif(service_row.category_details ->> 'optionName', ''), 'Catering menu'),
        'pricePerHead', service_row.base_price,
        'minimumGuests', service_row.category_details -> 'minimumGuests',
        'maximumGuests', service_row.category_details -> 'maximumGuests',
        'menuSections', coalesce(service_row.category_details -> 'menuSections', '[]'::jsonb)
      );
    end if;
    if selected_option is null then raise exception 'Choose an available catering option.'; end if;

    provider_unit_price := coalesce(nullif(selected_option ->> 'pricePerHead', '')::numeric, 0);
    minimum_guests := coalesce(nullif(selected_option ->> 'minimumGuests', '')::integer, 0);
    maximum_guests := coalesce(nullif(selected_option ->> 'maximumGuests', '')::integer, 0);
    if provider_unit_price <= 0 or event_guests < minimum_guests or event_guests > maximum_guests then
      raise exception 'This catering option does not support the event guest count.';
    end if;
    provider_amount := round(provider_unit_price * event_guests, 2);
  else
    provider_unit_price := coalesce(service_row.base_price, 0);
    provider_amount := round(provider_unit_price
      * case when service_row.pricing_unit = 'person' then greatest(event_guests, 1) else 1 end, 2);
  end if;

  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  return jsonb_build_object(
    'serviceId', service_row.id,
    'serviceName', service_row.name,
    'isCatering', is_catering,
    'guestCount', event_guests,
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'commissionRate', commission_rate,
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'cateringOption', coalesce(selected_option, '{}'::jsonb)
  );
end;
$$;

-- Phase 2 package previews now use the same guest-aware option prices. The
-- subtotal uses the least expensive option that supports the event; the client
-- still has to make an explicit option choice before applying the package.
create or replace function public.list_bookable_coordinator_packages(
  target_coordinator_id uuid default null,
  target_event_id uuid default null
)
returns table (
  id uuid, coordinator_id uuid, name text, description text, event_type text,
  is_available boolean, unavailable_reason text, service_subtotal numeric,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested_event as (
    select event.id, event.event_type, greatest(coalesce(event.guest_count, 0), 0) as guest_count
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc limit 1
  ), rate as (
    select public.get_public_commission_rate()::numeric as value
  ), raw_items as (
    select item.package_id, item.position, item.id as item_id,
      service.id as service_id, service.name as service_name,
      service.base_price, service.pricing_unit, service.status as service_status,
      service.is_available as service_available, service.cover_image_url,
      service.category_details,
      coalesce(category.name, 'Service') as category_name,
      lower(coalesce(category.name, '')) like '%cater%' as is_catering,
      provider.id as provider_id, coalesce(provider.business_name, 'Provider') as provider_name,
      owner.account_status as owner_status,
      coalesce(event.guest_count, 0) as guest_count,
      rate.value as commission_rate
    from public.coordinator_package_items item
    join public.services service on service.id = item.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    left join public.service_categories category on category.id = service.category_id
    left join requested_event event on true
    cross join rate
  ), priced_items as (
    select raw.*,
      option_choice.value as catering_option,
      case when raw.is_catering
        then coalesce(nullif(option_choice.value ->> 'pricePerHead', '')::numeric, 0)
        else coalesce(raw.base_price, 0)
      end as provider_unit_price,
      case when raw.is_catering
        then round(coalesce(nullif(option_choice.value ->> 'pricePerHead', '')::numeric, 0) * raw.guest_count, 2)
        else round(coalesce(raw.base_price, 0)
          * case when raw.pricing_unit = 'person' then greatest(raw.guest_count, 1) else 1 end, 2)
      end as provider_amount,
      case when jsonb_typeof(raw.category_details -> 'pricingOptions') = 'array'
        then raw.category_details -> 'pricingOptions' else '[]'::jsonb end as catering_options
    from raw_items raw
    left join lateral (
      select option.value
      from jsonb_array_elements(
        case when jsonb_typeof(raw.category_details -> 'pricingOptions') = 'array'
          then raw.category_details -> 'pricingOptions' else '[]'::jsonb end
      ) option(value)
      where raw.is_catering
        and raw.guest_count between
          coalesce(nullif(option.value ->> 'minimumGuests', '')::integer, 0)
          and coalesce(nullif(option.value ->> 'maximumGuests', '')::integer, 0)
        and coalesce(nullif(option.value ->> 'pricePerHead', '')::numeric, 0) > 0
      order by (option.value ->> 'pricePerHead')::numeric, option.value ->> 'name'
      limit 1
    ) option_choice on true
  ), package_totals as (
    select priced.package_id,
      count(*)::integer as item_count,
      count(*) filter (where
        priced.service_status <> 'active' or priced.service_available = false
        or priced.owner_status not in ('active', 'verified')
        or priced.provider_unit_price <= 0
        or (priced.is_catering and priced.catering_option is null)
      )::integer as invalid_count,
      round(sum(priced.provider_amount * (1 + priced.commission_rate)), 2) as customer_subtotal,
      jsonb_agg(jsonb_build_object(
        'service_id', priced.service_id,
        'service_name', priced.service_name,
        'category_name', priced.category_name,
        'provider_id', priced.provider_id,
        'provider_name', priced.provider_name,
        'provider_price', priced.provider_unit_price,
        'customer_unit_price', round(priced.provider_unit_price * (1 + priced.commission_rate), 2),
        'pricing_unit', case when priced.is_catering then 'person' else coalesce(priced.pricing_unit, 'event') end,
        'estimated_amount', round(priced.provider_amount * (1 + priced.commission_rate), 2),
        'commission_rate', priced.commission_rate,
        'cover_image_url', priced.cover_image_url,
        'requires_catering_option', priced.is_catering,
        'catering_options', priced.catering_options,
        'preview_catering_option_id', priced.catering_option ->> 'id',
        'guest_count', priced.guest_count
      ) order by priced.position, priced.item_id) as items
    from priced_items priced
    group by priced.package_id
  )
  select package.id, package.coordinator_id, package.name, package.description,
    package.event_type,
    coalesce(total.invalid_count, 0) = 0 and coalesce(total.item_count, 0) > 0 as is_available,
    case
      when coalesce(total.item_count, 0) = 0 then 'This package has no services.'
      when coalesce(total.invalid_count, 0) > 0 then 'One or more services or catering options do not fit this event.'
      else null
    end as unavailable_reason,
    coalesce(total.customer_subtotal, 0) as service_subtotal,
    coalesce(total.items, '[]'::jsonb) as items
  from public.coordinator_packages package
  join public.coordinator_service_profiles coordinator_profile
    on coordinator_profile.coordinator_id = package.coordinator_id
  join public.profiles coordinator on coordinator.id = package.coordinator_id
  left join requested_event event on true
  left join package_totals total on total.package_id = package.id
  where auth.uid() is not null
    and package.status = 'active'
    and coordinator.account_status = 'active'
    and coordinator_profile.is_accepting_bookings
    and (target_coordinator_id is null or package.coordinator_id = target_coordinator_id)
    and (event.id is null or package.event_type = event.event_type)
  order by package.name;
$$;

-- Applies a coordinator package, then replaces every package-created catering
-- preview with the client's explicit option and authoritative event price. Any
-- failure rolls back the original package selection in the same transaction.
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
  pricing jsonb;
  recalculated_subtotal numeric(12,2);
  selected_services jsonb;
begin
  if jsonb_typeof(coalesce(catering_option_choices, '{}'::jsonb)) <> 'object' then
    raise exception 'Catering option choices must be an object.';
  end if;

  result := public.choose_coordinator_package(target_event_id, target_package_id);

  select selection.id into package_selection_id
  from public.event_coordinator_package_selections selection
  where selection.event_id = target_event_id and selection.package_id = target_package_id;
  if package_selection_id is null then raise exception 'Coordinator package selection was not created.'; end if;

  for catering_row in
    select event_selection.id as selection_id, event_selection.service_id
    from public.event_coordinator_package_services package_service
    join public.event_service_selections event_selection
      on event_selection.id = package_service.event_selection_id
    join public.services service on service.id = event_selection.service_id
    join public.service_categories category on category.id = service.category_id
    where package_service.package_selection_id = package_selection_id
      and package_service.created_by_package
      and lower(category.name) like '%cater%'
  loop
    chosen_option_id := catering_option_choices ->> catering_row.service_id::text;
    if nullif(trim(chosen_option_id), '') is null then
      raise exception 'Choose a catering option for every catering service in this package.';
    end if;
    pricing := public.calculate_event_service_price(
      catering_row.service_id, target_event_id, chosen_option_id
    );

    update public.event_service_selections set
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = (pricing ->> 'guestCount')::integer,
      budget_per_head = round(
        (pricing ->> 'providerUnitPrice')::numeric
        * (1 + (pricing ->> 'commissionRate')::numeric), 2
      ),
      catering_option_id = chosen_option_id,
      catering_option_name = pricing -> 'cateringOption' ->> 'name',
      catering_option_snapshot = (pricing -> 'cateringOption') || jsonb_build_object(
        'guestCount', (pricing ->> 'guestCount')::integer,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'calculatedAmount', (pricing ->> 'customerAmount')::numeric,
        'selectedAt', now()
      ),
      selected_provider_snapshot = selected_provider_snapshot || jsonb_build_object(
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'commissionAmount', (pricing ->> 'commissionAmount')::numeric,
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'cateringOption', jsonb_build_object(
          'id', chosen_option_id,
          'name', pricing -> 'cateringOption' ->> 'name',
          'pricePerHead', (pricing -> 'cateringOption' ->> 'pricePerHead')::numeric
        )
      ),
      updated_at = now()
    where id = catering_row.selection_id;
  end loop;

  select coalesce(sum(event_selection.estimated_amount), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'selection_id', event_selection.id,
      'service_id', event_selection.service_id,
      'service_name', event_selection.service_name,
      'estimated_amount', event_selection.estimated_amount,
      'created_by_package', package_service.created_by_package,
      'catering_option_id', event_selection.catering_option_id,
      'catering_option_name', event_selection.catering_option_name
    ) order by event_selection.created_at), '[]'::jsonb)
  into recalculated_subtotal, selected_services
  from public.event_coordinator_package_services package_service
  join public.event_service_selections event_selection
    on event_selection.id = package_service.event_selection_id
  where package_service.package_selection_id = package_selection_id;

  update public.event_coordinator_package_selections set
    service_subtotal = recalculated_subtotal,
    package_snapshot = package_snapshot || jsonb_build_object(
      'service_subtotal', recalculated_subtotal,
      'services', selected_services
    ),
    updated_at = now()
  where id = package_selection_id;

  return result || jsonb_build_object(
    'service_subtotal', recalculated_subtotal,
    'services', selected_services
  );
end;
$$;

revoke all on function public.validate_catering_pricing_options() from public;
revoke all on function public.calculate_event_service_price(uuid, uuid, text) from public;
revoke all on function public.list_bookable_coordinator_packages(uuid, uuid) from public;
revoke all on function public.choose_coordinator_package_with_options(uuid, uuid, jsonb) from public;
revoke execute on function public.choose_coordinator_package(uuid, uuid) from authenticated;
grant execute on function public.calculate_event_service_price(uuid, uuid, text) to authenticated;
grant execute on function public.list_bookable_coordinator_packages(uuid, uuid) to authenticated;
grant execute on function public.choose_coordinator_package_with_options(uuid, uuid, jsonb) to authenticated;

comment on column public.event_service_selections.catering_option_snapshot is
  'Immutable client selection snapshot: option/menu, per-head price, guest count, and calculated amount.';
comment on column public.bookings.catering_option_snapshot is
  'Catering option and calculated-price snapshot copied when the booking is created.';
comment on function public.calculate_event_service_price(uuid, uuid, text) is
  'Authoritative event-aware provider amount, commission, and client total calculation.';

commit;
