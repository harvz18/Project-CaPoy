begin;

-- V8 Phase 2 stores the richer, multi-option venue selection beside the
-- established single-option snapshot. The original columns remain populated
-- with the first option so historic records and existing provider screens keep
-- working without a data rewrite.
alter table public.event_service_selections
  add column if not exists venue_options_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists venue_booking_snapshot jsonb not null default '{}'::jsonb;

alter table public.bookings
  add column if not exists venue_options_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists venue_booking_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_venue_options_snapshot_array_check,
  add constraint event_service_selections_venue_options_snapshot_array_check
    check (jsonb_typeof(venue_options_snapshot) = 'array'),
  drop constraint if exists event_service_selections_venue_booking_snapshot_object_check,
  add constraint event_service_selections_venue_booking_snapshot_object_check
    check (jsonb_typeof(venue_booking_snapshot) = 'object');

alter table public.bookings
  drop constraint if exists bookings_venue_options_snapshot_array_check,
  add constraint bookings_venue_options_snapshot_array_check
    check (jsonb_typeof(venue_options_snapshot) = 'array'),
  drop constraint if exists bookings_venue_booking_snapshot_object_check,
  add constraint bookings_venue_booking_snapshot_object_check
    check (jsonb_typeof(venue_booking_snapshot) = 'object');

create or replace function public.calculate_event_venue_quote_v8(
  target_service_id uuid,
  target_event_id uuid,
  target_option_selections jsonb
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
  input_selection jsonb;
  option_row record;
  option_id text;
  selected_ids text[] := '{}'::text[];
  option_resources jsonb;
  requested_start timestamp;
  requested_end timestamp;
  setup_start timestamp;
  opening_at timestamp;
  closing_at timestamp;
  access_start time;
  access_end time;
  booked_hours numeric;
  schedule_hours numeric;
  minimum_hours numeric;
  maximum_hours numeric;
  increment_hours numeric;
  setup_hours numeric;
  unit_rate numeric;
  option_subtotal numeric;
  total_capacity integer := 0;
  provider_amount numeric := 0;
  customer_amount numeric;
  commission_rate numeric := public.get_public_commission_rate();
  selected_options jsonb := '[]'::jsonb;
  option_snapshot jsonb;
  legacy_quote jsonb;
  has_option_pricing boolean := false;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select service.id, service.name, service.provider_id, service.base_price,
    service.pricing_model, service.pricing_unit, service.category_details,
    service.category_id, category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and owner.account_status in ('active', 'verified');
  if service_row.id is null then
    raise exception 'This service is no longer available.';
  end if;
  if public.phase9_category_key(service_row.category_name) <> 'venue' then
    raise exception 'This service is not a venue.';
  end if;
  if event_row.event_date is null or event_row.event_time is null then
    raise exception 'Set the event date and start time before choosing a venue.';
  end if;
  if jsonb_typeof(target_option_selections) <> 'array'
    or jsonb_array_length(target_option_selections) = 0 then
    raise exception 'Choose at least one available venue option.';
  end if;

  for input_selection in select value from jsonb_array_elements(target_option_selections)
  loop
    if jsonb_typeof(input_selection) <> 'object'
      or nullif(trim(input_selection ->> 'optionId'), '') is null then
      raise exception 'Each venue selection needs a valid option.';
    end if;
    selected_ids := selected_ids || trim(input_selection ->> 'optionId');
  end loop;
  if cardinality(selected_ids) <> cardinality(array(select distinct unnest(selected_ids))) then
    raise exception 'A venue option can only be selected once.';
  end if;

  select exists (
    select 1
    from (
      select item.value from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) item(value)
      union all
      select item.value from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) item(value)
    ) option_rows
    where option_rows.value ? 'pricingUnit' or option_rows.value ? 'baseRate'
  ) into has_option_pricing;

  -- A flat-price listing keeps the proven V6 calculation exactly as it was.
  -- It may choose one space/combination, while the resulting quote is wrapped
  -- in the new snapshot shape for consistent checkout persistence.
  if not has_option_pricing then
    if jsonb_array_length(target_option_selections) <> 1 then
      raise exception 'This legacy venue listing accepts one venue option at a time.';
    end if;
    input_selection := target_option_selections -> 0;
    legacy_quote := public.calculate_event_service_quote(
      target_service_id,
      target_event_id,
      input_selection ->> 'optionId',
      case when coalesce(input_selection ->> 'bookedHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (input_selection ->> 'bookedHours')::numeric else null end,
      null
    );
    return legacy_quote || jsonb_build_object(
      'selectedOptions', jsonb_build_array(
        (legacy_quote -> 'venueOption') || jsonb_build_object(
          'selectedDurationHours', legacy_quote -> 'bookedHours'
        )
      ),
      'venuePricingVersion', 'legacy-v6',
      'venueBookingSnapshot', jsonb_build_object(
        'capturedAt', now(),
        'eventDate', event_row.event_date,
        'eventTime', event_row.event_time,
        'selectedOptions', jsonb_build_array(
          (legacy_quote -> 'venueOption') || jsonb_build_object(
            'selectedDurationHours', legacy_quote -> 'bookedHours'
          )
        ),
        'providerBaseTotal', legacy_quote -> 'providerAmount',
        'clientFacingTotal', legacy_quote -> 'customerAmount'
      )
    );
  end if;

  if cardinality(selected_ids) > 1 and exists (
    select 1
    from (
      select item.value from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) item(value)
      union all
      select item.value from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) item(value)
    ) option_rows
    where option_rows.value ->> 'id' = any(selected_ids)
      and coalesce(option_rows.value ->> 'allowsCombination', 'false') <> 'true'
  ) then
    raise exception 'Every selected venue option must allow combination with other options.';
  end if;

  for input_selection in select value from jsonb_array_elements(target_option_selections)
  loop
    option_id := trim(input_selection ->> 'optionId');
    select candidate.* into option_row
    from (
      select space.value as raw,
        space.value ->> 'id' as id,
        'space'::text as option_kind,
        jsonb_build_array(space.value ->> 'id') as resource_ids,
        case when coalesce(space.value ->> 'capacity', '') ~ '^[0-9]+$'
          then (space.value ->> 'capacity')::integer else 0 end as capacity,
        case when coalesce(space.value ->> 'areaSqm', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (space.value ->> 'areaSqm')::numeric else 0 end as area_sqm,
        coalesce(nullif(space.value ->> 'spaceType', ''), 'Indoor') as space_type
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) space(value)
      union all
      select combination.value,
        combination.value ->> 'id',
        'combination',
        coalesce(combination.value -> 'spaceIds', '[]'::jsonb),
        case when coalesce(combination.value ->> 'combinedCapacity', '') ~ '^[0-9]+$'
          then (combination.value ->> 'combinedCapacity')::integer
          when coalesce(combination.value ->> 'capacity', '') ~ '^[0-9]+$'
            then (combination.value ->> 'capacity')::integer else 0 end,
        case when coalesce(combination.value ->> 'combinedAreaSqm', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (combination.value ->> 'combinedAreaSqm')::numeric else 0 end,
        'Combined'
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) combination(value)
    ) candidate
    where candidate.id = option_id
    limit 1;

    if option_row.id is null
      or option_row.raw ->> 'isActive' = 'false'
      or option_row.raw ->> 'isBookableIndividually' = 'false' then
      raise exception 'Choose an available venue option.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(option_row.raw -> 'requiredOptionIds') = 'array'
          then option_row.raw -> 'requiredOptionIds' else '[]'::jsonb end
      ) required_option(value)
      where not (required_option.value = any(selected_ids))
    ) then
      raise exception 'A selected venue option requires another option that is not selected.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(option_row.raw -> 'mutuallyExclusiveOptionIds') = 'array'
          then option_row.raw -> 'mutuallyExclusiveOptionIds' else '[]'::jsonb end
      ) excluded_option(value)
      where excluded_option.value = any(selected_ids)
    ) then
      raise exception 'Two selected venue options are mutually exclusive.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(option_row.resource_ids) selected_resource(value)
      join jsonb_array_elements(target_option_selections) other_selection(value)
        on other_selection.value ->> 'optionId' <> option_id
      join lateral (
        select candidate.resource_ids
        from (
          select space.value ->> 'id' as id, jsonb_build_array(space.value ->> 'id') as resource_ids
          from jsonb_array_elements(
            case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
              then service_row.category_details -> 'spaces' else '[]'::jsonb end
          ) space(value)
          union all
          select combination.value ->> 'id', coalesce(combination.value -> 'spaceIds', '[]'::jsonb)
          from jsonb_array_elements(
            case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
              then service_row.category_details -> 'combinations' else '[]'::jsonb end
          ) combination(value)
        ) candidate
        where candidate.id = other_selection.value ->> 'optionId'
      ) other_option on true
      join jsonb_array_elements_text(other_option.resource_ids) other_resource(value)
        on other_resource.value = selected_resource.value
    ) then
      raise exception 'Selected venue options cannot use the same space twice.';
    end if;

    unit_rate := case when coalesce(option_row.raw ->> 'baseRate', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (option_row.raw ->> 'baseRate')::numeric else 0 end;
    if option_row.raw ->> 'pricingUnit' not in ('hour', 'event') or unit_rate <= 0 then
      raise exception 'The selected venue option does not have valid pricing.';
    end if;
    minimum_hours := case when coalesce(option_row.raw ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (option_row.raw ->> 'minimumBookingHours')::numeric
      else greatest(case when coalesce(service_row.category_details ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (service_row.category_details ->> 'minimumBookingHours')::numeric else 1 end, 0.25) end;
    maximum_hours := case when coalesce(option_row.raw ->> 'maximumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (option_row.raw ->> 'maximumBookingHours')::numeric
      when coalesce(service_row.category_details ->> 'maximumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (service_row.category_details ->> 'maximumBookingHours')::numeric
      else null end;
    increment_hours := greatest(case when coalesce(service_row.category_details ->> 'bookingDurationIncrementHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (service_row.category_details ->> 'bookingDurationIncrementHours')::numeric else 1 end, 0.25);
    setup_hours := case when coalesce(option_row.raw ->> 'setupAllowanceHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (option_row.raw ->> 'setupAllowanceHours')::numeric
      else greatest(case when coalesce(service_row.category_details ->> 'setupAllowance', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (service_row.category_details ->> 'setupAllowance')::numeric else 0 end, 0)
        * case when service_row.category_details ->> 'setupAllowanceUnit' = 'days' then 24 else 1 end end;

    if option_row.raw ->> 'pricingUnit' = 'hour' then
      booked_hours := case when coalesce(input_selection ->> 'bookedHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (input_selection ->> 'bookedHours')::numeric else 0 end;
      if booked_hours < minimum_hours
        or (maximum_hours is not null and booked_hours > maximum_hours)
        or abs((booked_hours / increment_hours) - round(booked_hours / increment_hours)) > 0.000001 then
        raise exception 'Choose a venue duration that follows the provider rental rules.';
      end if;
      schedule_hours := booked_hours;
      option_subtotal := round(unit_rate * booked_hours, 2);
    else
      booked_hours := null;
      schedule_hours := case when coalesce(option_row.raw ->> 'includedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (option_row.raw ->> 'includedDurationHours')::numeric else null end;
      option_subtotal := round(unit_rate, 2);
    end if;

    requested_start := event_row.event_date + event_row.event_time;
    requested_end := case when schedule_hours is null then null
      else requested_start + make_interval(secs => (schedule_hours * 3600)::double precision) end;
    setup_start := requested_start - make_interval(secs => (setup_hours * 3600)::double precision);
    if coalesce(option_row.raw ->> 'accessStartTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      access_start := (option_row.raw ->> 'accessStartTime')::time;
    elsif coalesce(service_row.category_details ->> 'openingTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      access_start := (service_row.category_details ->> 'openingTime')::time;
    else access_start := null; end if;
    if coalesce(option_row.raw ->> 'accessEndTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      access_end := (option_row.raw ->> 'accessEndTime')::time;
    elsif coalesce(service_row.category_details ->> 'closingTime', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      access_end := (service_row.category_details ->> 'closingTime')::time;
    else access_end := null; end if;
    opening_at := case when access_start is null then null else event_row.event_date::timestamp + access_start end;
    closing_at := case when access_end is null then null else event_row.event_date::timestamp + access_end end;
    if (opening_at is not null and setup_start < opening_at)
      or (closing_at is not null and requested_end is not null and requested_end > closing_at) then
      raise exception 'The requested venue time falls outside the provider access hours.';
    end if;
    if exists (
      select 1 from public.provider_availability availability
      where availability.provider_id = service_row.provider_id
        and availability.available_date = event_row.event_date
        and (availability.service_id is null or availability.service_id = service_row.id)
        and (availability.is_available = false
          or (availability.start_time is not null and setup_start::time < availability.start_time)
          or (availability.end_time is not null and requested_end is not null
            and requested_end::time > availability.end_time))
    ) then
      raise exception 'The venue is unavailable for the requested time window.';
    end if;
    if exists (
      select 1
      from public.bookings existing_booking
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(existing_booking.venue_options_snapshot) = 'array'
          and jsonb_array_length(existing_booking.venue_options_snapshot) > 0
          then existing_booking.venue_options_snapshot
          else jsonb_build_array(existing_booking.venue_option_snapshot) end
      ) booked_option(value)
      where existing_booking.service_id = service_row.id
        and existing_booking.event_id <> event_row.id
        and existing_booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
        and exists (
          select 1
          from jsonb_array_elements_text(option_row.resource_ids) requested_resource(value)
          join jsonb_array_elements_text(coalesce(booked_option.value -> 'resourceIds', '[]'::jsonb)) booked_resource(value)
            using (value)
        )
        and case
          when requested_end is null
            or nullif(booked_option.value ->> 'setupStartAt', '') is null
            or nullif(booked_option.value ->> 'endAt', '') is null
            then existing_booking.requested_date = event_row.event_date
          else setup_start < (booked_option.value ->> 'endAt')::timestamp
            and requested_end > (booked_option.value ->> 'setupStartAt')::timestamp
        end
    ) then
      raise exception 'A selected venue option overlaps another active booking.';
    end if;

    total_capacity := total_capacity + greatest(option_row.capacity, 0);
    option_snapshot := option_row.raw || jsonb_build_object(
      'id', option_row.id,
      'name', option_row.raw ->> 'name',
      'kind', option_row.option_kind,
      'resourceIds', option_row.resource_ids,
      'capacity', option_row.capacity,
      'areaSqm', option_row.area_sqm,
      'spaceType', option_row.space_type,
      'pricingType', option_row.raw ->> 'pricingUnit',
      'unitRate', unit_rate,
      'selectedDurationHours', booked_hours,
      'pricingSubtotal', option_subtotal,
      'eventDate', event_row.event_date,
      'startAt', requested_start,
      'endAt', requested_end,
      'setupStartAt', setup_start,
      'rentalConditions', jsonb_build_object(
        'minimumBookingHours', minimum_hours,
        'maximumBookingHours', maximum_hours,
        'durationIncrementHours', increment_hours,
        'includedDurationHours', schedule_hours,
        'accessStartTime', coalesce(option_row.raw ->> 'accessStartTime', service_row.category_details ->> 'openingTime'),
        'accessEndTime', coalesce(option_row.raw ->> 'accessEndTime', service_row.category_details ->> 'closingTime'),
        'setupAllowanceHours', setup_hours,
        'overtimePolicy', option_row.raw ->> 'overtimePolicy'
      )
    );
    selected_options := selected_options || jsonb_build_array(option_snapshot);
    provider_amount := provider_amount + option_subtotal;
  end loop;

  if total_capacity < greatest(coalesce(event_row.guest_count, 0), 1) then
    raise exception 'The selected venue options do not have enough combined capacity for the event guest count.';
  end if;
  if provider_amount <= 0 then
    raise exception 'The calculated venue amount must be greater than zero.';
  end if;
  customer_amount := round(provider_amount * (1 + commission_rate), 2);

  return jsonb_build_object(
    'serviceId', service_row.id,
    'serviceName', service_row.name,
    'categoryKey', 'venue',
    'venuePricingVersion', 'v8-option-pricing',
    'selectedOptions', selected_options,
    'providerAmount', round(provider_amount, 2),
    'serviceSubtotal', round(provider_amount, 2),
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * 0.30 + (customer_amount - provider_amount), 2),
    'providerInitialShare', round(provider_amount * 0.30, 2),
    'remainingProviderBalance', round(provider_amount * 0.70, 2),
    'venueBookingSnapshot', jsonb_build_object(
      'capturedAt', now(),
      'eventDate', event_row.event_date,
      'eventTime', event_row.event_time,
      'selectedOptions', selected_options,
      'providerBaseTotal', round(provider_amount, 2),
      'clientFacingTotal', customer_amount,
      'commissionRate', commission_rate,
      'platformFee', round(customer_amount - provider_amount, 2)
    )
  );
end;
$$;

create or replace function public.save_my_venue_service_selection_v8(
  target_event_id uuid,
  target_service_id uuid,
  target_option_selections jsonb,
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
  first_option jsonb;
  other_allocations numeric(12,2);
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select service.id, service.provider_id, service.category_id, service.name,
    category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id;
  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'venue' then
    raise exception 'Venue service not found.';
  end if;

  select * into existing_row
  from public.event_service_selections selection
  where selection.event_id = event_row.id
    and selection.category_key = 'venue'
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

  pricing := public.calculate_event_venue_quote_v8(
    target_service_id, target_event_id, target_option_selections
  );
  first_option := pricing -> 'selectedOptions' -> 0;

  if existing_row.id is null then
    insert into public.event_service_selections (
      event_id, client_id, provider_id, service_id, category_id, category_key,
      service_name, category_name, estimated_amount, attendee_count, outside_food,
      venue_option_id, venue_option_name, venue_option_snapshot,
      venue_options_snapshot, venue_booking_snapshot, venue_booked_hours,
      venue_setup_start_at, venue_start_at, venue_end_at, dietary_notes, notes,
      status, selected_provider_snapshot
    ) values (
      event_row.id, event_row.client_id, service_row.provider_id, service_row.id,
      service_row.category_id, 'venue', service_row.name, service_row.category_name,
      (pricing ->> 'customerAmount')::numeric, greatest(coalesce(event_row.guest_count, 0), 0), false,
      first_option ->> 'id', first_option ->> 'name', coalesce(first_option, '{}'::jsonb),
      pricing -> 'selectedOptions', pricing -> 'venueBookingSnapshot',
      case when coalesce(first_option ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (first_option ->> 'selectedDurationHours')::numeric else null end,
      case when nullif(first_option ->> 'setupStartAt', '') is not null then (first_option ->> 'setupStartAt')::timestamp else null end,
      case when nullif(first_option ->> 'startAt', '') is not null then (first_option ->> 'startAt')::timestamp else null end,
      case when nullif(first_option ->> 'endAt', '') is not null then (first_option ->> 'endAt')::timestamp else null end,
      target_notes, target_notes, 'selected',
      jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'providerName', coalesce((select provider.business_name from public.provider_profiles provider
          where provider.id = service_row.provider_id), 'Provider'),
        'pricingVersion', 'v8-venue-options',
        'remainingBudgetCurrency', 'PHP'
      )
    ) returning id into selection_id;
  else
    selection_id := existing_row.id;
    update public.event_service_selections set
      estimated_amount = (pricing ->> 'customerAmount')::numeric,
      attendee_count = greatest(coalesce(event_row.guest_count, 0), 0),
      venue_option_id = first_option ->> 'id',
      venue_option_name = first_option ->> 'name',
      venue_option_snapshot = coalesce(first_option, '{}'::jsonb),
      venue_options_snapshot = pricing -> 'selectedOptions',
      venue_booking_snapshot = pricing -> 'venueBookingSnapshot',
      venue_booked_hours = case when coalesce(first_option ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (first_option ->> 'selectedDurationHours')::numeric else null end,
      venue_setup_start_at = case when nullif(first_option ->> 'setupStartAt', '') is not null then (first_option ->> 'setupStartAt')::timestamp else null end,
      venue_start_at = case when nullif(first_option ->> 'startAt', '') is not null then (first_option ->> 'startAt')::timestamp else null end,
      venue_end_at = case when nullif(first_option ->> 'endAt', '') is not null then (first_option ->> 'endAt')::timestamp else null end,
      dietary_notes = target_notes,
      notes = target_notes,
      selected_provider_snapshot = jsonb_build_object(
        'commissionAmount', (pricing ->> 'platformFee')::numeric,
        'commissionModel', 'added_to_customer',
        'commissionRate', (pricing ->> 'commissionRate')::numeric,
        'providerAmount', (pricing ->> 'providerAmount')::numeric,
        'pricingVersion', 'v8-venue-options',
        'remainingBudgetCurrency', 'PHP'
      ),
      updated_at = now()
    where id = selection_id;
  end if;

  if coalesce(event_row.total_budget, 0) > 0 then
    select coalesce(sum(item.allocated_amount), 0) into other_allocations
    from public.event_budget_items item
    where item.event_id = event_row.id
      and item.allocation_version = 'phase7-v1'
      and item.category_key <> 'venue';
    if other_allocations + (pricing ->> 'customerAmount')::numeric > event_row.total_budget then
      raise exception 'The selected service exceeds the remaining event budget.';
    end if;
    perform set_config('app.phase9_budget_lock_authorized', 'true', true);
    insert into public.event_budget_items (
      event_id, category_key, label, allocated_amount, estimated_amount,
      priority_rank, is_priority, status, allocation_version,
      is_selection_locked, locked_selection_id
    ) values (
      event_row.id, 'venue', 'Venue',
      (pricing ->> 'customerAmount')::numeric, (pricing ->> 'customerAmount')::numeric,
      99, true, 'planned', 'phase7-v1', true, selection_id
    ) on conflict (event_id, category_key) where allocation_version = 'phase7-v1'
    do update set allocated_amount = excluded.allocated_amount,
      estimated_amount = excluded.estimated_amount,
      is_selection_locked = true, locked_selection_id = excluded.locked_selection_id;
  end if;

  update public.events
  set status = case when status = 'draft' then 'planning' else status end,
      updated_at = now()
  where id = event_row.id;
  return pricing || jsonb_build_object(
    'selectionId', selection_id,
    'replacedSelectionId', replaced_selection_id
  );
end;
$$;

-- Checkout confirms current availability and configuration for a saved V8
-- selection, but deliberately does not use a provider's current price to
-- overwrite the immutable selection or booking snapshot.
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
    where event.id = target_event_id
      and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.status not in ('declined', 'cancelled')
    group by selection.category_key
    having count(*) > 1
  ) then
    raise exception 'Only one service may be selected per category.';
  end if;

  for selection_row in
    select selection.service_id, selection.package_id, selection.category_key,
      selection.catering_option_id, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_booked_hours,
      selection.venue_options_snapshot
    from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.client_id = auth.uid()
      and selection.status in ('selected', 'requested')
  loop
    if selection_row.category_key = 'catering'
      and selection_row.catering_option_id = 'custom-menu' then
      select coalesce(jsonb_agg(item.value ->> 'id'), '[]'::jsonb)
      into custom_menu_item_ids
      from jsonb_array_elements(
        coalesce(selection_row.catering_option_snapshot -> 'selectedItems', '[]'::jsonb)
      ) item(value);
      perform public.calculate_catering_menu_quote(
        selection_row.service_id, target_event_id, custom_menu_item_ids
      );
    elsif selection_row.category_key = 'venue'
      and jsonb_typeof(selection_row.venue_options_snapshot) = 'array'
      and jsonb_array_length(selection_row.venue_options_snapshot) > 0 then
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'optionId', item.value ->> 'id',
        'bookedHours', case when coalesce(item.value ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (item.value ->> 'selectedDurationHours')::numeric else null end
      )))
      into venue_inputs
      from jsonb_array_elements(selection_row.venue_options_snapshot) item(value);
      perform public.calculate_event_venue_quote_v8(
        selection_row.service_id, target_event_id, coalesce(venue_inputs, '[]'::jsonb)
      );
    else
      perform public.calculate_event_service_quote(
        selection_row.service_id,
        target_event_id,
        case when selection_row.category_key = 'venue'
          then selection_row.venue_option_id else selection_row.catering_option_id end,
        selection_row.venue_booked_hours,
        selection_row.package_id
      );
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.calculate_event_venue_quote_v8(uuid, uuid, jsonb) from public;
revoke all on function public.save_my_venue_service_selection_v8(uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.calculate_event_venue_quote_v8(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_my_venue_service_selection_v8(uuid, uuid, jsonb, text, boolean) to authenticated;

comment on column public.event_service_selections.venue_options_snapshot is
  'Immutable array of every client-selected venue option and its rental conditions.';
comment on column public.event_service_selections.venue_booking_snapshot is
  'Immutable combined venue provider total, one-time commission, client total, and selected-option details.';
comment on function public.calculate_event_venue_quote_v8(uuid, uuid, jsonb) is
  'Authoritative V8 venue option quote: validates resources and availability, sums provider subtotals, then applies commission once.';

commit;
