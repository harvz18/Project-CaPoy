-- MULTIVENT Revision 2, Phase 9: authoritative service selection and venue booking.
-- Apply after 59_budget_aware_recommendations.sql.

begin;

alter table public.event_service_selections
  add column if not exists category_key text,
  add column if not exists venue_option_id text,
  add column if not exists venue_option_name text,
  add column if not exists venue_option_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists venue_booked_hours numeric(8,2),
  add column if not exists venue_setup_start_at timestamp,
  add column if not exists venue_start_at timestamp,
  add column if not exists venue_end_at timestamp;

alter table public.bookings
  add column if not exists venue_option_id text,
  add column if not exists venue_option_name text,
  add column if not exists venue_option_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists venue_booked_hours numeric(8,2),
  add column if not exists venue_setup_start_at timestamp,
  add column if not exists venue_start_at timestamp,
  add column if not exists venue_end_at timestamp;

alter table public.event_budget_items
  add column if not exists is_selection_locked boolean not null default false,
  add column if not exists locked_selection_id uuid
    references public.event_service_selections(id) on delete set null;

create or replace function public.protect_phase9_locked_budget_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and coalesce(current_setting('app.phase9_budget_lock_authorized', true), '') <> 'true'
  then
    if tg_op = 'DELETE' and old.is_selection_locked then
      raise exception 'Remove or replace the selected service before changing its category budget.';
    elsif tg_op = 'UPDATE' and old.is_selection_locked
      and (new.allocated_amount is distinct from old.allocated_amount
        or new.category_key is distinct from old.category_key
        or new.is_selection_locked is distinct from old.is_selection_locked
        or new.locked_selection_id is distinct from old.locked_selection_id)
    then
      raise exception 'Remove or replace the selected service before changing its category budget.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_phase9_locked_budget_item_trigger
  on public.event_budget_items;
create trigger protect_phase9_locked_budget_item_trigger
before update or delete on public.event_budget_items
for each row execute function public.protect_phase9_locked_budget_item();

alter table public.event_service_selections
  drop constraint if exists event_service_selections_phase9_category_key_check,
  add constraint event_service_selections_phase9_category_key_check check (
    category_key is null or category_key in (
      'venue', 'catering', 'eventOrganizer', 'photoVideo',
      'gownRental', 'hostEmcee', 'soundLights', 'floral'
    )
  ),
  drop constraint if exists event_service_selections_venue_hours_check,
  add constraint event_service_selections_venue_hours_check
    check (venue_booked_hours is null or venue_booked_hours > 0),
  drop constraint if exists event_service_selections_venue_snapshot_object_check,
  add constraint event_service_selections_venue_snapshot_object_check
    check (jsonb_typeof(venue_option_snapshot) = 'object');

alter table public.bookings
  drop constraint if exists bookings_venue_hours_check,
  add constraint bookings_venue_hours_check
    check (venue_booked_hours is null or venue_booked_hours > 0),
  drop constraint if exists bookings_venue_snapshot_object_check,
  add constraint bookings_venue_snapshot_object_check
    check (jsonb_typeof(venue_option_snapshot) = 'object');

create index if not exists event_service_selections_phase9_category_idx
  on public.event_service_selections (event_id, category_key, status);
create index if not exists bookings_phase9_venue_window_idx
  on public.bookings (service_id, venue_setup_start_at, venue_end_at)
  where venue_option_id is not null;

create or replace function public.phase9_category_key(category_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(category_name, '')) like '%photo%' then 'photoVideo'
    when lower(coalesce(category_name, '')) like '%venue%'
      or lower(coalesce(category_name, '')) like '%estate%' then 'venue'
    when lower(coalesce(category_name, '')) like '%flor%' then 'floral'
    when lower(coalesce(category_name, '')) like '%attire%'
      or lower(coalesce(category_name, '')) like '%gown%' then 'gownRental'
    when lower(coalesce(category_name, '')) like '%organizer%'
      or lower(coalesce(category_name, '')) like '%coordinator%' then 'eventOrganizer'
    when lower(coalesce(category_name, '')) like '%host%'
      or lower(coalesce(category_name, '')) like '%emcee%' then 'hostEmcee'
    when lower(coalesce(category_name, '')) like '%sound%'
      or lower(coalesce(category_name, '')) like '%light%' then 'soundLights'
    else 'catering'
  end;
$$;

update public.event_service_selections selection
set category_key = public.phase9_category_key(selection.category_name)
where selection.category_key is null and selection.category_name is not null;

create or replace function public.enforce_phase9_one_service_per_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_key is null then
    new.category_key := public.phase9_category_key(new.category_name);
  end if;
  -- Serialize checks for the same event/category without forcing a unique
  -- index onto potentially duplicated legacy history.
  perform pg_advisory_xact_lock(hashtextextended(
    new.event_id::text || ':' || coalesce(new.category_key, ''), 0
  ));
  if new.status not in ('declined', 'cancelled') and exists (
    select 1
    from public.event_service_selections existing
    where existing.event_id = new.event_id
      and existing.category_key = new.category_key
      and existing.id is distinct from new.id
      and existing.status not in ('declined', 'cancelled')
  ) then
    raise exception 'Only one service may be selected per category. Confirm a replacement first.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_phase9_one_service_per_category_trigger
  on public.event_service_selections;
create trigger enforce_phase9_one_service_per_category_trigger
before insert or update of event_id, category_id, category_name, category_key, status
on public.event_service_selections
for each row execute function public.enforce_phase9_one_service_per_category();

-- One server-side calculation contract is used by selection and checkout.
-- It returns both provider and customer amounts plus Phase 5/6 allocations.
create or replace function public.calculate_event_service_quote(
  target_service_id uuid,
  target_event_id uuid,
  target_option_id text default null,
  target_quantity numeric default null,
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
  option_resources jsonb := '[]'::jsonb;
  option_capacity integer := 0;
  option_area numeric := 0;
  provider_unit_price numeric(12,2);
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  commission_rate numeric := public.get_public_commission_rate();
  initial_payment_rate numeric := 0.40;
  provider_initial_rate numeric := 0.30;
  category_key text;
  is_catering boolean;
  is_venue boolean;
  minimum_guests integer;
  maximum_guests integer;
  booked_hours numeric;
  minimum_hours numeric;
  maximum_hours numeric;
  increment_hours numeric;
  setup_hours numeric;
  billed_hours numeric;
  requested_start timestamp;
  requested_end timestamp;
  setup_start timestamp;
  opening_at timestamp;
  closing_at timestamp;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select service.id, service.name, service.provider_id, service.base_price,
    service.pricing_model, service.pricing_unit, service.category_details,
    category.name as category_name,
    package.id as selected_package_id,
    coalesce(package.price, service.base_price) as selected_price,
    coalesce(package.pricing_unit, service.pricing_unit, 'event') as selected_pricing_unit
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  left join public.service_packages package on package.id = target_package_id
    and package.service_id = service.id and package.is_active = true
  where service.id = target_service_id and service.status = 'active'
    and service.is_available = true
    and owner.account_status in ('active', 'verified');
  if service_row.id is null then raise exception 'This service is no longer available.'; end if;
  if target_package_id is not null and service_row.selected_package_id is null then
    raise exception 'The selected provider package is no longer available.';
  end if;

  category_key := public.phase9_category_key(service_row.category_name);
  is_catering := category_key = 'catering';
  is_venue := category_key = 'venue';

  if is_catering then
    if coalesce(event_row.guest_count, 0) <= 0 then
      raise exception 'Set the event guest count before choosing catering.';
    end if;
    select option_row.value into selected_option
    from jsonb_array_elements(case
      when jsonb_typeof(service_row.category_details -> 'pricingOptions') = 'array'
        then service_row.category_details -> 'pricingOptions'
      when service_row.category_details ->> 'pricingBasis' = 'per_person'
        then jsonb_build_array(jsonb_build_object(
          'id', 'legacy-default',
          'name', coalesce(nullif(service_row.category_details ->> 'optionName', ''), 'Catering menu'),
          'pricePerHead', service_row.selected_price,
          'minimumGuests', service_row.category_details -> 'minimumGuests',
          'maximumGuests', service_row.category_details -> 'maximumGuests',
          'menuSections', coalesce(service_row.category_details -> 'menuSections', '[]'::jsonb)
        ))
      else '[]'::jsonb end) option_row(value)
    where option_row.value ->> 'id' = target_option_id limit 1;
    if selected_option is null then raise exception 'Choose an available catering option.'; end if;
    provider_unit_price := coalesce(nullif(selected_option ->> 'pricePerHead', '')::numeric, 0);
    minimum_guests := coalesce(nullif(selected_option ->> 'minimumGuests', '')::integer, 0);
    maximum_guests := coalesce(nullif(selected_option ->> 'maximumGuests', '')::integer, 0);
    if provider_unit_price <= 0 or event_row.guest_count < minimum_guests
      or event_row.guest_count > maximum_guests
    then raise exception 'This catering option does not support the event guest count.'; end if;
    provider_amount := round(provider_unit_price * event_row.guest_count, 2);

  elsif is_venue then
    if event_row.event_date is null or event_row.event_time is null then
      raise exception 'Set the event date and start time before choosing a venue.';
    end if;
    booked_hours := coalesce(target_quantity, 0);
    minimum_hours := greatest(coalesce(nullif(service_row.category_details ->> 'minimumBookingHours', '')::numeric, 1), 0.25);
    maximum_hours := nullif(service_row.category_details ->> 'maximumBookingHours', '')::numeric;
    increment_hours := greatest(coalesce(nullif(service_row.category_details ->> 'bookingDurationIncrementHours', '')::numeric, 1), 0.25);
    if booked_hours < minimum_hours
      or (maximum_hours is not null and booked_hours > maximum_hours)
      or abs((booked_hours / increment_hours) - round(booked_hours / increment_hours)) > 0.000001
    then raise exception 'Choose a venue duration that follows the provider booking rules.'; end if;

    with venue_options as (
      select space.value as raw, space.value ->> 'id' as id,
        'space'::text as option_kind,
        jsonb_build_array(space.value ->> 'id') as resource_ids,
        coalesce(nullif(space.value ->> 'capacity', '')::integer, 0) as capacity,
        coalesce(nullif(space.value ->> 'areaSqm', '')::numeric, 0) as area_sqm,
        coalesce(nullif(space.value ->> 'spaceType', ''), 'Indoor') as space_type
      from jsonb_array_elements(case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
        then service_row.category_details -> 'spaces' else '[]'::jsonb end) space(value)
      union all
      select combination.value, combination.value ->> 'id', 'combination',
        coalesce(combination.value -> 'spaceIds', '[]'::jsonb),
        coalesce(nullif(combination.value ->> 'combinedCapacity', '')::integer,
          nullif(combination.value ->> 'capacity', '')::integer, 0),
        coalesce(nullif(combination.value ->> 'combinedAreaSqm', '')::numeric, 0),
        'Combined'
      from jsonb_array_elements(case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
        then service_row.category_details -> 'combinations' else '[]'::jsonb end) combination(value)
    )
    select option_row.raw || jsonb_build_object(
        'kind', option_row.option_kind,
        'resourceIds', option_row.resource_ids,
        'capacity', option_row.capacity,
        'areaSqm', option_row.area_sqm,
        'spaceType', option_row.space_type
      ), option_row.resource_ids, option_row.capacity, option_row.area_sqm
    into selected_option, option_resources, option_capacity, option_area
    from venue_options option_row where option_row.id = target_option_id limit 1;
    if selected_option is null then raise exception 'Choose an available venue space or combination.'; end if;
    if option_capacity <= 0 or option_capacity < greatest(coalesce(event_row.guest_count, 0), 1) then
      raise exception 'This venue option does not have enough capacity for the event guest count.';
    end if;

    setup_hours := greatest(coalesce(nullif(service_row.category_details ->> 'setupAllowance', '')::numeric, 0), 0)
      * case when service_row.category_details ->> 'setupAllowanceUnit' = 'days' then 24 else 1 end;
    requested_start := event_row.event_date + event_row.event_time;
    requested_end := requested_start + make_interval(secs => (booked_hours * 3600)::double precision);
    setup_start := requested_start - make_interval(secs => (setup_hours * 3600)::double precision);
    if nullif(service_row.category_details ->> 'openingTime', '') is not null then
      opening_at := event_row.event_date::timestamp
        + (service_row.category_details ->> 'openingTime')::time;
    end if;
    if nullif(service_row.category_details ->> 'closingTime', '') is not null then
      closing_at := event_row.event_date::timestamp
        + (service_row.category_details ->> 'closingTime')::time;
    end if;
    if (opening_at is not null and setup_start < opening_at)
      or (closing_at is not null and requested_end > closing_at)
    then raise exception 'The booking duration plus setup allowance exceeds venue operating hours.'; end if;

    if exists (
      select 1 from public.provider_availability availability
      where availability.provider_id = service_row.provider_id
        and availability.available_date = event_row.event_date
        and (availability.service_id is null or availability.service_id = service_row.id)
        and (availability.is_available = false
          or (availability.start_time is not null and setup_start::time < availability.start_time)
          or (availability.end_time is not null and requested_end::time > availability.end_time))
    ) then raise exception 'The venue is unavailable for the requested time window.'; end if;

    if exists (
      select 1 from public.bookings existing_booking
      where existing_booking.service_id = service_row.id
        and existing_booking.event_id <> event_row.id
        and existing_booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
        and (
          (existing_booking.venue_setup_start_at is not null
            and existing_booking.venue_end_at is not null
            and setup_start < existing_booking.venue_end_at
            and requested_end > existing_booking.venue_setup_start_at
            and exists (
              select 1
              from jsonb_array_elements_text(option_resources) requested_resource(value)
              join jsonb_array_elements_text(coalesce(
                existing_booking.venue_option_snapshot -> 'resourceIds', '[]'::jsonb
              )) booked_resource(value) using (value)
            ))
          or (existing_booking.venue_start_at is null
            and existing_booking.requested_date = event_row.event_date)
        )
    ) then raise exception 'This venue option overlaps another active booking.'; end if;

    provider_unit_price := coalesce(service_row.selected_price, 0);
    billed_hours := booked_hours + case
      when service_row.category_details ->> 'setupAllowanceBillable' = 'true' then setup_hours
      else 0 end;
    provider_amount := round(provider_unit_price * case
      when service_row.selected_pricing_unit = 'hour' then billed_hours else 1 end, 2);
    selected_option := selected_option || jsonb_build_object(
      'amenities', jsonb_build_object(
        'airConditioning', service_row.category_details -> 'airConditioning',
        'chairs', service_row.category_details -> 'chairs',
        'chairsQuantity', service_row.category_details -> 'chairsQuantity',
        'tables', service_row.category_details -> 'tables',
        'tablesQuantity', service_row.category_details -> 'tablesQuantity',
        'parking', service_row.category_details -> 'parking',
        'parkingQuantity', service_row.category_details -> 'parkingQuantity',
        'restrooms', service_row.category_details -> 'restrooms',
        'restroomsQuantity', service_row.category_details -> 'restroomsQuantity',
        'dressingRoom', service_row.category_details -> 'dressingRoom',
        'kitchen', service_row.category_details -> 'kitchen',
        'wifi', service_row.category_details -> 'wifi',
        'stage', service_row.category_details -> 'stage',
        'pwdAccessibility', service_row.category_details -> 'pwdAccessibility'
      ),
      'otherInclusions', coalesce(service_row.category_details -> 'otherInclusions', '[]'::jsonb),
      'openingTime', service_row.category_details ->> 'openingTime',
      'closingTime', service_row.category_details ->> 'closingTime',
      'setupAllowanceHours', setup_hours,
      'setupAllowanceBillable', service_row.category_details ->> 'setupAllowanceBillable' = 'true',
      'bookedHours', booked_hours,
      'billedHours', billed_hours,
      'startAt', requested_start,
      'endAt', requested_end,
      'setupStartAt', setup_start,
      'pricingBasis', service_row.selected_pricing_unit,
      'providerUnitPrice', provider_unit_price,
      'providerAmount', provider_amount
    );
  else
    provider_unit_price := coalesce(service_row.selected_price, 0);
    if coalesce(service_row.pricing_model, 'fixed') = 'customQuote' or provider_unit_price <= 0 then
      raise exception 'A provider quote is required before this service can be selected.';
    end if;
    provider_amount := round(provider_unit_price * case
      when service_row.selected_pricing_unit = 'person' then greatest(coalesce(event_row.guest_count, 0), 1)
      else 1 end, 2);
  end if;

  if provider_amount <= 0 then raise exception 'The calculated service amount must be greater than zero.'; end if;
  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  return jsonb_build_object(
    'serviceId', service_row.id,
    'serviceName', service_row.name,
    'categoryKey', category_key,
    'isCatering', is_catering,
    'guestCount', greatest(coalesce(event_row.guest_count, 0), 0),
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * initial_payment_rate, 2),
    'providerInitialShare', round(provider_amount * provider_initial_rate, 2),
    'remainingProviderBalance', round(provider_amount * (1 - provider_initial_rate), 2),
    'cateringOption', case when is_catering then coalesce(selected_option, '{}'::jsonb) else '{}'::jsonb end,
    'venueOption', case when is_venue then coalesce(selected_option, '{}'::jsonb) else '{}'::jsonb end,
    'bookedHours', booked_hours,
    'setupStartAt', setup_start,
    'startAt', requested_start,
    'endAt', requested_end
  );
end;
$$;

-- Preserve the Phase 3 API while routing it through the Phase 9 engine.
create or replace function public.calculate_event_service_price(
  target_service_id uuid,
  target_event_id uuid,
  target_catering_option_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.calculate_event_service_quote(
    target_service_id, target_event_id, target_catering_option_id, null, null
  );
$$;

create or replace function public.try_calculate_event_service_quote(
  target_service_id uuid,
  target_event_id uuid,
  target_option_id text default null,
  target_quantity numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.calculate_event_service_quote(
    target_service_id, target_event_id, target_option_id, target_quantity, null
  );
exception when others then
  return null;
end;
$$;

create or replace function public.list_my_budget_aware_service_recommendations_phase9(
  target_event_id uuid default null
)
returns table (
  item_id text,
  service_id uuid,
  category_key text,
  category_budget numeric,
  calculated_amount numeric,
  is_within_budget boolean,
  guest_requirement_met boolean,
  availability_status text,
  is_recommended boolean,
  recommendation_reason text,
  pricing_basis text,
  recommended_option_id text,
  recommended_option_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_event as (
    select event.id from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc limit 1
  ), base as (
    select recommendation.*
    from public.list_my_budget_aware_service_recommendations(target_event_id) recommendation
  ), repriced as (
    select base.*, quote.value,
      case
        when base.category_key = 'venue' then null::numeric
        when quote.value is not null then (quote.value ->> 'customerAmount')::numeric
        else base.calculated_amount
      end as phase9_amount
    from base
    left join selected_event event on true
    left join lateral (
      select public.try_calculate_event_service_quote(
        base.service_id, event.id, base.recommended_option_id, null
      ) as value
    ) quote on base.service_id is not null and base.category_key <> 'venue'
  )
  select repriced.item_id, repriced.service_id, repriced.category_key,
    repriced.category_budget, repriced.phase9_amount,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget,
    repriced.guest_requirement_met, repriced.availability_status,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget
      and repriced.guest_requirement_met
      and repriced.availability_status <> 'unavailable',
    case
      when repriced.category_key = 'venue'
        then 'Choose a venue option and booking duration to calculate the authoritative amount.'
      when repriced.phase9_amount is null then repriced.recommendation_reason
      when repriced.category_budget <= 0 then 'No budget is allocated to this category.'
      when repriced.phase9_amount > repriced.category_budget
        then format('Estimated total is PHP %s over the category budget.',
          to_char(repriced.phase9_amount - repriced.category_budget, 'FM999,999,999,990.00'))
      when repriced.availability_status = 'unavailable'
        then 'The provider is unavailable for the current event schedule.'
      when repriced.availability_status = 'schedule_required'
        then 'Fits the category budget; complete the event schedule to verify availability.'
      else 'Fits the category budget and current event requirements.'
    end,
    case when repriced.category_key = 'venue' then 'Option and duration required'
      else repriced.pricing_basis end,
    repriced.recommended_option_id, repriced.recommended_option_name
  from repriced
  order by 9 desc, 6 desc, (repriced.availability_status = 'available') desc,
    repriced.phase9_amount nulls last, repriced.item_id;
$$;

create or replace function public.save_my_event_service_selection(
  target_event_id uuid,
  target_service_id uuid,
  target_package_id uuid default null,
  target_option_id text default null,
  target_quantity numeric default null,
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
  category_key_value text;
  category_label text;
  other_allocations numeric(12,2);
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select service.*, category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id;
  if service_row.id is null then raise exception 'Service not found.'; end if;
  category_key_value := public.phase9_category_key(service_row.category_name);

  select * into existing_row
  from public.event_service_selections selection
  where selection.event_id = event_row.id
    and selection.category_key = category_key_value
    and selection.status not in ('declined', 'cancelled')
  order by selection.created_at limit 1 for update;
  if existing_row.id is not null and existing_row.status <> 'selected' then
    raise exception 'This category already has an active provider request and cannot be changed here.';
  end if;
  if existing_row.id is not null and existing_row.service_id is distinct from target_service_id then
    if not replace_existing then
      raise exception 'A service is already selected for this category. Confirm replacement first.';
    end if;
    replaced_selection_id := existing_row.id;
    delete from public.event_service_selections where id = existing_row.id;
    existing_row.id := null;
  end if;

  pricing := public.calculate_event_service_quote(
    target_service_id, target_event_id, target_option_id, target_quantity, target_package_id
  );

  if existing_row.id is null then
    insert into public.event_service_selections (
      event_id, client_id, provider_id, service_id, package_id, category_id,
      category_key, service_name, category_name, estimated_amount, attendee_count,
      budget_per_head, meal_type, outside_food, catering_option_id,
      catering_option_name, catering_option_snapshot, venue_option_id,
      venue_option_name, venue_option_snapshot, venue_booked_hours,
      venue_setup_start_at, venue_start_at, venue_end_at, dietary_notes, notes,
      status, selected_provider_snapshot
    ) values (
      event_row.id, event_row.client_id, service_row.provider_id, service_row.id,
      target_package_id, service_row.category_id, category_key_value,
      service_row.name, service_row.category_name,
      (pricing ->> 'customerAmount')::numeric, greatest(coalesce(event_row.guest_count, 0), 0),
      case when category_key_value = 'catering' then
        round((pricing ->> 'customerAmount')::numeric / greatest(event_row.guest_count, 1), 2)
        else null end,
      target_meal_type, false,
      case when category_key_value = 'catering' then target_option_id else null end,
      case when category_key_value = 'catering' then pricing -> 'cateringOption' ->> 'name' else null end,
      case when category_key_value = 'catering' then pricing -> 'cateringOption' else '{}'::jsonb end,
      case when category_key_value = 'venue' then target_option_id else null end,
      case when category_key_value = 'venue' then pricing -> 'venueOption' ->> 'name' else null end,
      case when category_key_value = 'venue' then pricing -> 'venueOption' else '{}'::jsonb end,
      case when category_key_value = 'venue' then target_quantity else null end,
      case when category_key_value = 'venue' then (pricing ->> 'setupStartAt')::timestamp else null end,
      case when category_key_value = 'venue' then (pricing ->> 'startAt')::timestamp else null end,
      case when category_key_value = 'venue' then (pricing ->> 'endAt')::timestamp else null end,
      target_notes, target_notes, 'selected',
      jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'providerName', coalesce((select provider.business_name from public.provider_profiles provider
          where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'phase9-v1',
        'remainingBudgetCurrency', 'PHP'
      )
    ) returning id into selection_id;
  else
    selection_id := existing_row.id;
    update public.event_service_selections set
      package_id = target_package_id,
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = greatest(coalesce(event_row.guest_count, 0), 0),
      budget_per_head = case when category_key_value = 'catering' then
        round((pricing ->> 'customerAmount')::numeric / greatest(event_row.guest_count, 1), 2)
        else null end,
      meal_type = target_meal_type,
      catering_option_id = case when category_key_value = 'catering' then target_option_id else null end,
      catering_option_name = case when category_key_value = 'catering' then pricing -> 'cateringOption' ->> 'name' else null end,
      catering_option_snapshot = case when category_key_value = 'catering' then pricing -> 'cateringOption' else '{}'::jsonb end,
      venue_option_id = case when category_key_value = 'venue' then target_option_id else null end,
      venue_option_name = case when category_key_value = 'venue' then pricing -> 'venueOption' ->> 'name' else null end,
      venue_option_snapshot = case when category_key_value = 'venue' then pricing -> 'venueOption' else '{}'::jsonb end,
      venue_booked_hours = case when category_key_value = 'venue' then target_quantity else null end,
      venue_setup_start_at = case when category_key_value = 'venue' then (pricing ->> 'setupStartAt')::timestamp else null end,
      venue_start_at = case when category_key_value = 'venue' then (pricing ->> 'startAt')::timestamp else null end,
      venue_end_at = case when category_key_value = 'venue' then (pricing ->> 'endAt')::timestamp else null end,
      dietary_notes = target_notes, notes = target_notes,
      selected_provider_snapshot = jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'pricingVersion', 'phase9-v1',
        'remainingBudgetCurrency', 'PHP'
      ), updated_at = now()
    where id = selection_id;
  end if;

  if coalesce(event_row.total_budget, 0) > 0 then
    select coalesce(sum(item.allocated_amount), 0) into other_allocations
    from public.event_budget_items item
    where item.event_id = event_row.id and item.allocation_version = 'phase7-v1'
      and item.category_key <> category_key_value;
    if other_allocations + (pricing ->> 'customerAmount')::numeric > event_row.total_budget then
      raise exception 'The selected service exceeds the remaining event budget.';
    end if;
    category_label := case category_key_value
      when 'venue' then 'Venue' when 'catering' then 'Catering'
      when 'eventOrganizer' then 'Event Coordinator'
      when 'photoVideo' then 'Photography & Video'
      when 'gownRental' then 'Attire & Gown Rental'
      when 'hostEmcee' then 'Host / Emcee'
      when 'soundLights' then 'Sound & Lights' else 'Florist & Styling' end;
    perform set_config('app.phase9_budget_lock_authorized', 'true', true);
    insert into public.event_budget_items (
      event_id, category_key, label, allocated_amount, estimated_amount,
      priority_rank, is_priority, status, allocation_version,
      is_selection_locked, locked_selection_id
    ) values (
      event_row.id, category_key_value, category_label,
      (pricing ->> 'customerAmount')::numeric, (pricing ->> 'customerAmount')::numeric,
      99, true, 'planned', 'phase7-v1', true, selection_id
    ) on conflict (event_id, category_key) where allocation_version = 'phase7-v1'
    do update set allocated_amount = excluded.allocated_amount,
      estimated_amount = excluded.estimated_amount,
      is_selection_locked = true, locked_selection_id = excluded.locked_selection_id;
  end if;

  update public.events set status = case when status = 'draft' then 'planning' else status end,
    updated_at = now() where id = event_row.id;
  return pricing || jsonb_build_object(
    'selectionId', selection_id,
    'replacedSelectionId', replaced_selection_id
  );
end;
$$;

create or replace function public.unlock_phase9_category_budget()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.phase9_budget_lock_authorized', 'true', true);
  update public.event_budget_items set allocated_amount = 0, estimated_amount = 0,
    is_selection_locked = false, locked_selection_id = null
  where event_id = old.event_id
    and category_key = old.category_key
    and is_selection_locked = true
    and locked_selection_id = old.id
    and allocation_version = 'phase7-v1';
  return old;
end;
$$;

drop trigger if exists unlock_phase9_category_budget_trigger
  on public.event_service_selections;
create trigger unlock_phase9_category_budget_trigger
before delete on public.event_service_selections
for each row execute function public.unlock_phase9_category_budget();

create or replace function public.set_my_category_budget_allocation(
  target_event_id uuid,
  target_category_key text,
  target_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_budget numeric(12,2);
  coordinator_required numeric(12,2) := 0;
  other_allocations numeric(12,2);
  category_label text;
begin
  if target_category_key not in (
    'venue', 'catering', 'eventOrganizer', 'photoVideo',
    'gownRental', 'hostEmcee', 'soundLights', 'floral'
  ) or target_amount is null or target_amount < 0 then
    raise exception 'Choose a valid category allocation.';
  end if;
  select event.total_budget,
    case when (event.coordinator_id is not null or event.pending_coordinator_id is not null)
      and coalesce(event.coordinator_fee_amount, 0) > 0
      then round(event.coordinator_fee_amount * (1 + public.get_public_commission_rate()), 2)
      else 0 end
  into event_budget, coordinator_required from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if not found then raise exception 'Event not found.' using errcode = '42501'; end if;
  if exists (select 1 from public.event_budget_items item
    where item.event_id = target_event_id and item.category_key = target_category_key
      and item.allocation_version = 'phase7-v1' and item.is_selection_locked) then
    raise exception 'Remove or replace the selected service before changing this category budget.';
  end if;
  if target_category_key = 'eventOrganizer' and target_amount < coordinator_required then
    raise exception 'Reserve at least the committed coordinator cost in Event Coordinator.';
  end if;
  select coalesce(sum(item.allocated_amount), 0) into other_allocations
  from public.event_budget_items item where item.event_id = target_event_id
    and item.allocation_version = 'phase7-v1'
    and item.category_key <> target_category_key;
  if other_allocations + round(target_amount, 2) > coalesce(event_budget, 0) then
    raise exception 'Category allocations cannot exceed the total event budget.';
  end if;
  category_label := case target_category_key
    when 'venue' then 'Venue' when 'catering' then 'Catering'
    when 'eventOrganizer' then 'Event Coordinator'
    when 'photoVideo' then 'Photography & Video'
    when 'gownRental' then 'Attire & Gown Rental'
    when 'hostEmcee' then 'Host / Emcee'
    when 'soundLights' then 'Sound & Lights' else 'Florist & Styling' end;
  insert into public.event_budget_items (
    event_id, category_key, label, allocated_amount, estimated_amount,
    priority_rank, is_priority, status, allocation_version
  ) values (
    target_event_id, target_category_key, category_label, round(target_amount, 2),
    round(target_amount, 2), 99, target_amount > 0, 'planned', 'phase7-v1'
  ) on conflict (event_id, category_key) where allocation_version = 'phase7-v1'
  do update set allocated_amount = excluded.allocated_amount,
    estimated_amount = excluded.estimated_amount,
    is_priority = excluded.is_priority;
  return jsonb_build_object(
    'category_key', target_category_key,
    'allocated_amount', round(target_amount, 2),
    'remaining_budget', round(event_budget - other_allocations - target_amount, 2)
  );
end;
$$;

create or replace function public.save_my_event_budget_allocations_phase9(
  target_event_id uuid,
  target_budget numeric,
  target_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_item record;
  requested_amount numeric;
  result jsonb;
begin
  if jsonb_typeof(coalesce(target_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Category allocations must be an array.';
  end if;
  for locked_item in
    select item.category_key, item.allocated_amount
    from public.event_budget_items item
    where item.event_id = target_event_id and item.allocation_version = 'phase7-v1'
      and item.is_selection_locked
  loop
    select allocation.amount into requested_amount
    from jsonb_to_recordset(target_allocations) allocation(category_key text, amount numeric)
    where allocation.category_key = locked_item.category_key limit 1;
    if requested_amount is null
      or round(requested_amount, 2) <> round(locked_item.allocated_amount, 2)
    then
      raise exception 'A selected service locks the % category at its calculated amount.', locked_item.category_key;
    end if;
  end loop;

  perform set_config('app.phase9_budget_lock_authorized', 'true', true);
  result := public.save_my_event_budget_allocations(
    target_event_id, target_budget, target_allocations
  );
  update public.event_budget_items item set
    is_selection_locked = true,
    locked_selection_id = selection.id
  from public.event_service_selections selection
  where item.event_id = target_event_id
    and item.event_id = selection.event_id
    and item.category_key = selection.category_key
    and item.allocation_version = 'phase7-v1'
    and selection.status not in ('declined', 'cancelled');
  return result;
end;
$$;

create or replace function public.validate_my_phase9_selections(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare selection_row record;
begin
  if not exists (select 1 from public.events event
    where event.id = target_event_id and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.status not in ('declined', 'cancelled')
    group by selection.category_key having count(*) > 1
  ) then raise exception 'Only one service may be selected per category.'; end if;
  for selection_row in
    select selection.service_id, selection.package_id, selection.category_key,
      selection.catering_option_id, selection.venue_option_id,
      selection.venue_booked_hours
    from public.event_service_selections selection
    where selection.event_id = target_event_id and selection.client_id = auth.uid()
      and selection.status in ('selected', 'requested')
  loop
    perform public.calculate_event_service_quote(
      selection_row.service_id, target_event_id,
      case when selection_row.category_key = 'venue' then selection_row.venue_option_id
        else selection_row.catering_option_id end,
      selection_row.venue_booked_hours, selection_row.package_id
    );
  end loop;
  return true;
end;
$$;

create or replace function public.list_phase9_package_venue_requirements()
returns table (package_id uuid, service_id uuid, venue_details jsonb)
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
  join public.coordinator_service_profiles coordinator
    on coordinator.coordinator_id = package.coordinator_id
  join public.profiles profile on profile.id = package.coordinator_id
  where auth.uid() is not null and package.status = 'active'
    and service.status = 'active' and service.is_available = true
    and public.phase9_category_key(category.name) = 'venue'
    and coordinator.is_accepting_bookings = true
    and profile.account_status = 'active';
$$;

create or replace function public.choose_coordinator_package_phase9(
  target_event_id uuid,
  target_package_id uuid,
  catering_option_choices jsonb default '{}'::jsonb,
  replace_conflicts boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  conflicts jsonb;
  duplicate_categories text;
  result jsonb;
  package_service record;
  venue_service record;
  event_budget numeric(12,2);
  other_allocations numeric(12,2);
  package_subtotal numeric(12,2);
begin
  if not exists (select 1 from public.events event
    where event.id = target_event_id and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select string_agg(duplicate.category_key, ', ') into duplicate_categories
  from (
    select public.phase9_category_key(category.name) as category_key
    from public.coordinator_package_items item
    join public.services service on service.id = item.service_id
    join public.service_categories category on category.id = service.category_id
    where item.package_id = target_package_id
    group by public.phase9_category_key(category.name)
    having count(*) > 1
  ) duplicate;
  if duplicate_categories is not null then
    raise exception 'This package contains more than one service in: %. The coordinator must revise it first.', duplicate_categories;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'selectionId', selection.id,
    'categoryKey', selection.category_key,
    'currentService', selection.service_name,
    'replacementService', service.name,
    'status', selection.status
  ) order by selection.category_key), '[]'::jsonb)
  into conflicts
  from public.coordinator_package_items item
  join public.services service on service.id = item.service_id
  join public.service_categories category on category.id = service.category_id
  join public.event_service_selections selection
    on selection.event_id = target_event_id
    and selection.category_key = public.phase9_category_key(category.name)
    and selection.service_id is distinct from service.id
    and selection.status not in ('declined', 'cancelled')
  where item.package_id = target_package_id;

  if jsonb_array_length(conflicts) > 0 and not replace_conflicts then
    return jsonb_build_object(
      'requiresConfirmation', true,
      'conflicts', conflicts
    );
  end if;
  if exists (select 1 from jsonb_array_elements(conflicts) conflict(value)
    where conflict.value ->> 'status' <> 'selected') then
    raise exception 'A package cannot replace a category that already has an active provider request.';
  end if;
  if replace_conflicts then
    delete from public.event_service_selections selection
    where selection.id in (
      select (conflict.value ->> 'selectionId')::uuid
      from jsonb_array_elements(conflicts) conflict(value)
    );
  end if;

  result := public.choose_coordinator_package_with_options(
    target_event_id, target_package_id, catering_option_choices
  );
  for venue_service in
    select selection.id, selection.service_id
    from public.event_coordinator_package_selections package_selection
    join public.event_coordinator_package_services package_service_link
      on package_service_link.package_selection_id = package_selection.id
    join public.event_service_selections selection
      on selection.id = package_service_link.event_selection_id
    where package_selection.event_id = target_event_id
      and package_selection.package_id = target_package_id
      and selection.category_key = 'venue'
  loop
    if nullif(trim(catering_option_choices ->> ('venueOption:' || venue_service.service_id::text)), '') is null
      or nullif(trim(catering_option_choices ->> ('venueHours:' || venue_service.service_id::text)), '') is null
    then
      raise exception 'Choose a venue option and booking duration for every venue in this package.';
    end if;
    result := public.calculate_event_service_quote(
      venue_service.service_id,
      target_event_id,
      catering_option_choices ->> ('venueOption:' || venue_service.service_id::text),
      (catering_option_choices ->> ('venueHours:' || venue_service.service_id::text))::numeric,
      null
    );
    update public.event_service_selections set
      estimated_amount = (result ->> 'customerAmount')::numeric,
      venue_option_id = result -> 'venueOption' ->> 'id',
      venue_option_name = result -> 'venueOption' ->> 'name',
      venue_option_snapshot = result -> 'venueOption',
      venue_booked_hours = (result ->> 'bookedHours')::numeric,
      venue_setup_start_at = (result ->> 'setupStartAt')::timestamp,
      venue_start_at = (result ->> 'startAt')::timestamp,
      venue_end_at = (result ->> 'endAt')::timestamp,
      selected_provider_snapshot = selected_provider_snapshot || jsonb_build_object(
        'providerAmount', (result ->> 'providerAmount')::numeric,
        'commissionAmount', (result ->> 'platformFee')::numeric,
        'commissionRate', (result ->> 'commissionRate')::numeric,
        'pricingVersion', 'phase9-v1'
      ), updated_at = now()
    where id = venue_service.id;
  end loop;

  select round(coalesce(sum(selection.estimated_amount), 0), 2)
  into package_subtotal
  from public.event_coordinator_package_selections package_selection
  join public.event_coordinator_package_services package_service_link
    on package_service_link.package_selection_id = package_selection.id
  join public.event_service_selections selection
    on selection.id = package_service_link.event_selection_id
  where package_selection.event_id = target_event_id
    and package_selection.package_id = target_package_id;
  update public.event_coordinator_package_selections
  set service_subtotal = package_subtotal,
    package_snapshot = package_snapshot || jsonb_build_object('service_subtotal', package_subtotal),
    updated_at = now()
  where event_id = target_event_id and package_id = target_package_id;
  select event.total_budget into event_budget from public.events event
  where event.id = target_event_id;
  if coalesce(event_budget, 0) > 0 then
    perform set_config('app.phase9_budget_lock_authorized', 'true', true);
    for package_service in
      select selection.id, selection.category_key, selection.category_name,
        selection.estimated_amount
      from public.event_coordinator_package_selections package_selection
      join public.event_coordinator_package_services package_service_link
        on package_service_link.package_selection_id = package_selection.id
      join public.event_service_selections selection
        on selection.id = package_service_link.event_selection_id
      where package_selection.event_id = target_event_id
        and package_selection.package_id = target_package_id
    loop
      select coalesce(sum(item.allocated_amount), 0) into other_allocations
      from public.event_budget_items item
      where item.event_id = target_event_id and item.allocation_version = 'phase7-v1'
        and item.category_key <> package_service.category_key;
      if other_allocations + package_service.estimated_amount > event_budget then
        raise exception 'The package service % exceeds the remaining event budget.', package_service.category_name;
      end if;
      insert into public.event_budget_items (
        event_id, category_key, label, allocated_amount, estimated_amount,
        priority_rank, is_priority, status, allocation_version,
        is_selection_locked, locked_selection_id
      ) values (
        target_event_id, package_service.category_key,
        coalesce(package_service.category_name, 'Service'),
        package_service.estimated_amount, package_service.estimated_amount,
        99, true, 'planned', 'phase7-v1', true, package_service.id
      ) on conflict (event_id, category_key) where allocation_version = 'phase7-v1'
      do update set allocated_amount = excluded.allocated_amount,
        estimated_amount = excluded.estimated_amount,
        is_selection_locked = true, locked_selection_id = excluded.locked_selection_id;
    end loop;
  end if;
  return result || jsonb_build_object(
    'service_subtotal', package_subtotal,
    'requiresConfirmation', false,
    'replacedConflicts', case when replace_conflicts then conflicts else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.phase9_category_key(text) from public;
revoke all on function public.protect_phase9_locked_budget_item() from public;
revoke all on function public.enforce_phase9_one_service_per_category() from public;
revoke all on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) from public;
revoke all on function public.try_calculate_event_service_quote(uuid, uuid, text, numeric) from public;
revoke all on function public.list_my_budget_aware_service_recommendations_phase9(uuid) from public;
revoke all on function public.save_my_event_service_selection(uuid, uuid, uuid, text, numeric, text, text, boolean) from public;
revoke all on function public.unlock_phase9_category_budget() from public;
revoke all on function public.set_my_category_budget_allocation(uuid, text, numeric) from public;
revoke all on function public.save_my_event_budget_allocations_phase9(uuid, numeric, jsonb) from public;
revoke all on function public.validate_my_phase9_selections(uuid) from public;
revoke all on function public.list_phase9_package_venue_requirements() from public;
revoke all on function public.choose_coordinator_package_phase9(uuid, uuid, jsonb, boolean) from public;
grant execute on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) to authenticated;
grant execute on function public.list_my_budget_aware_service_recommendations_phase9(uuid) to authenticated;
grant execute on function public.save_my_event_service_selection(uuid, uuid, uuid, text, numeric, text, text, boolean) to authenticated;
grant execute on function public.set_my_category_budget_allocation(uuid, text, numeric) to authenticated;
grant execute on function public.save_my_event_budget_allocations_phase9(uuid, numeric, jsonb) to authenticated;
grant execute on function public.validate_my_phase9_selections(uuid) to authenticated;
grant execute on function public.list_phase9_package_venue_requirements() to authenticated;
grant execute on function public.choose_coordinator_package_phase9(uuid, uuid, jsonb, boolean) to authenticated;

comment on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) is
  'Authoritative Phase 9 service pricing, including catering guests and venue option/duration rules.';
comment on column public.event_service_selections.venue_option_snapshot is
  'Immutable venue option, resource, capacity, operating-rule, schedule, and pricing snapshot.';
comment on column public.event_budget_items.is_selection_locked is
  'True when the category allocation is committed to the calculated selected-service amount.';

commit;
