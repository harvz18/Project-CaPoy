begin;

-- V8 Phase 3 calculates a real starting configuration for option-priced venue
-- services. It is deliberately read-only: selections and historic booking
-- snapshots continue to be priced only by the authoritative checkout flow.
create or replace function public.calculate_venue_starting_quote_v8(
  target_service_id uuid,
  target_guest_count integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  service_row record;
  has_option_pricing boolean := false;
  dynamic_quote jsonb;
  legacy_option_count integer := 0;
  legacy_option_id text;
  legacy_option_name text;
  legacy_provider_amount numeric;
  legacy_minimum_hours numeric;
begin
  select service.id, service.base_price, service.pricing_model,
    service.pricing_unit, service.category_details,
    public.get_public_commission_rate()::numeric as commission_rate
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and owner.account_status in ('active', 'verified')
    and public.phase9_category_key(category.name) = 'venue';

  if service_row.id is null then
    return null;
  end if;

  select exists (
    select 1
    from (
      select item.value
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) item(value)
      union all
      select item.value
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) item(value)
    ) option_rows
    where option_rows.value ? 'pricingUnit' or option_rows.value ? 'baseRate'
  ) into has_option_pricing;

  if has_option_pricing then
    with recursive venue_options as (
      select
        nullif(trim(space.value ->> 'id'), '') as option_id,
        space.value as raw,
        jsonb_build_array(space.value ->> 'id') as resource_ids,
        case when coalesce(space.value ->> 'capacity', '') ~ '^[0-9]+$'
          then (space.value ->> 'capacity')::integer else 0 end as capacity,
        space.value ->> 'pricingUnit' as pricing_unit,
        case when coalesce(space.value ->> 'baseRate', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (space.value ->> 'baseRate')::numeric else 0 end as unit_rate,
        greatest(
          case when coalesce(space.value ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (space.value ->> 'minimumBookingHours')::numeric
            when coalesce(service_row.category_details ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
              then (service_row.category_details ->> 'minimumBookingHours')::numeric
            else 1 end,
          1
        ) as minimum_hours,
        greatest(
          case when coalesce(service_row.category_details ->> 'bookingDurationIncrementHours', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (service_row.category_details ->> 'bookingDurationIncrementHours')::numeric
            else 1 end,
          0.25
        ) as duration_increment
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) space(value)

      union all

      select
        nullif(trim(combination.value ->> 'id'), ''),
        combination.value,
        case when jsonb_typeof(combination.value -> 'spaceIds') = 'array'
          then combination.value -> 'spaceIds' else '[]'::jsonb end,
        case when coalesce(combination.value ->> 'combinedCapacity', '') ~ '^[0-9]+$'
          then (combination.value ->> 'combinedCapacity')::integer
          when coalesce(combination.value ->> 'capacity', '') ~ '^[0-9]+$'
            then (combination.value ->> 'capacity')::integer else 0 end,
        combination.value ->> 'pricingUnit',
        case when coalesce(combination.value ->> 'baseRate', '') ~ '^[0-9]+([.][0-9]+)?$'
          then (combination.value ->> 'baseRate')::numeric else 0 end,
        greatest(
          case when coalesce(combination.value ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (combination.value ->> 'minimumBookingHours')::numeric
            when coalesce(service_row.category_details ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
              then (service_row.category_details ->> 'minimumBookingHours')::numeric
            else 1 end,
          1
        ),
        greatest(
          case when coalesce(service_row.category_details ->> 'bookingDurationIncrementHours', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (service_row.category_details ->> 'bookingDurationIncrementHours')::numeric
            else 1 end,
          0.25
        )
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) combination(value)
    ), required_options(candidate_id, option_id) as (
      select option_row.option_id, option_row.option_id
      from venue_options option_row
      where option_row.option_id is not null

      union

      select required.candidate_id, nullif(trim(required_id.value), '')
      from required_options required
      join venue_options source on source.option_id = required.option_id
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(source.raw -> 'requiredOptionIds') = 'array'
          then source.raw -> 'requiredOptionIds' else '[]'::jsonb end
      ) required_id(value)
      where nullif(trim(required_id.value), '') is not null
    ), option_components as (
      select required.candidate_id,
        count(*) as requested_component_count,
        count(option_row.option_id) as resolved_component_count,
        coalesce(bool_and(
          option_row.option_id is not null
          and coalesce(option_row.raw ->> 'isActive', 'true') <> 'false'
          and coalesce(option_row.raw ->> 'isBookableIndividually', 'true') <> 'false'
          and option_row.pricing_unit in ('hour', 'event')
          and option_row.unit_rate > 0
        ), false) as all_components_bookable,
        coalesce(bool_and(jsonb_array_length(option_row.resource_ids) > 0), false)
          as all_components_have_resources,
        coalesce(bool_and(coalesce(option_row.raw ->> 'allowsCombination', 'false') = 'true'), false)
          as all_components_allow_combination,
        coalesce(sum(greatest(option_row.capacity, 0)), 0) as combined_capacity,
        coalesce(sum(case when option_row.pricing_unit = 'hour'
          then option_row.unit_rate * (
            ceil(option_row.minimum_hours / option_row.duration_increment)
              * option_row.duration_increment
          )
          when option_row.pricing_unit = 'event' then option_row.unit_rate
          else 0 end), 0) as provider_amount,
        array_agg(option_row.option_id order by option_row.option_id) as selected_option_ids,
        string_agg(coalesce(nullif(option_row.raw ->> 'name', ''), option_row.option_id), ' + '
          order by option_row.option_id) as selected_option_names,
        string_agg(
          case when option_row.pricing_unit = 'hour' then
            format('%s: PHP %s/hour x %s-hour minimum',
              coalesce(nullif(option_row.raw ->> 'name', ''), option_row.option_id),
              to_char(option_row.unit_rate, 'FM999,999,999,990.00'),
              to_char(
                ceil(option_row.minimum_hours / option_row.duration_increment)
                  * option_row.duration_increment,
                'FM999,999,999,990.00'
              ))
          else format('%s: PHP %s/event',
            coalesce(nullif(option_row.raw ->> 'name', ''), option_row.option_id),
            to_char(option_row.unit_rate, 'FM999,999,999,990.00'))
          end,
          ' + ' order by option_row.option_id
        ) as pricing_basis
      from required_options required
      left join venue_options option_row on option_row.option_id = required.option_id
      group by required.candidate_id
    ), resource_counts as (
      select required.candidate_id, resource.value as resource_id, count(*) as use_count
      from required_options required
      join venue_options option_row on option_row.option_id = required.option_id
      cross join lateral jsonb_array_elements_text(option_row.resource_ids) resource(value)
      group by required.candidate_id, resource.value
    ), valid_configurations as (
      select component.*
      from option_components component
      where component.resolved_component_count = component.requested_component_count
        and component.all_components_bookable
        and component.all_components_have_resources
        and component.provider_amount > 0
        and component.combined_capacity >= greatest(coalesce(target_guest_count, 0), 1)
        and (
          component.requested_component_count = 1
          or component.all_components_allow_combination
        )
        and not exists (
          select 1 from resource_counts resource
          where resource.candidate_id = component.candidate_id
            and resource.use_count > 1
        )
        and not exists (
          select 1
          from required_options required
          join venue_options option_row on option_row.option_id = required.option_id
          cross join lateral jsonb_array_elements_text(
            case when jsonb_typeof(option_row.raw -> 'mutuallyExclusiveOptionIds') = 'array'
              then option_row.raw -> 'mutuallyExclusiveOptionIds' else '[]'::jsonb end
          ) excluded_option(value)
          where required.candidate_id = component.candidate_id
            and excluded_option.value = any(component.selected_option_ids)
        )
    )
    select jsonb_build_object(
      'providerAmount', round(configuration.provider_amount, 2),
      'customerAmount', round(configuration.provider_amount * (1 + service_row.commission_rate), 2),
      'optionId', configuration.candidate_id,
      'optionName', configuration.selected_option_names,
      'pricingBasis', configuration.pricing_basis
    )
    into dynamic_quote
    from valid_configurations configuration
    order by round(configuration.provider_amount * (1 + service_row.commission_rate), 2),
      configuration.selected_option_names
    limit 1;

    -- A provider who has configured option-level pricing must have one complete,
    -- compatible option configuration. Never fall back to the parent price here.
    return dynamic_quote;
  end if;

  if coalesce(service_row.pricing_model, 'fixed') = 'customQuote'
    or coalesce(service_row.base_price, 0) <= 0 then
    return null;
  end if;

  select count(*),
    (array_agg(option_row.option_id order by option_row.option_name)
      filter (where option_row.capacity >= greatest(coalesce(target_guest_count, 0), 1)
        and coalesce(option_row.raw ->> 'isActive', 'true') <> 'false'
        and coalesce(option_row.raw ->> 'isBookableIndividually', 'true') <> 'false'))[1],
    (array_agg(option_row.option_name order by option_row.option_name)
      filter (where option_row.capacity >= greatest(coalesce(target_guest_count, 0), 1)
        and coalesce(option_row.raw ->> 'isActive', 'true') <> 'false'
        and coalesce(option_row.raw ->> 'isBookableIndividually', 'true') <> 'false'))[1]
  into legacy_option_count, legacy_option_id, legacy_option_name
  from (
    select nullif(trim(space.value ->> 'id'), '') as option_id,
      nullif(trim(space.value ->> 'name'), '') as option_name,
      space.value as raw,
      case when coalesce(space.value ->> 'capacity', '') ~ '^[0-9]+$'
        then (space.value ->> 'capacity')::integer else 0 end as capacity
    from jsonb_array_elements(
      case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
        then service_row.category_details -> 'spaces' else '[]'::jsonb end
    ) space(value)
    union all
    select nullif(trim(combination.value ->> 'id'), ''),
      nullif(trim(combination.value ->> 'name'), ''),
      combination.value,
      case when coalesce(combination.value ->> 'combinedCapacity', '') ~ '^[0-9]+$'
        then (combination.value ->> 'combinedCapacity')::integer
        when coalesce(combination.value ->> 'capacity', '') ~ '^[0-9]+$'
          then (combination.value ->> 'capacity')::integer else 0 end
    from jsonb_array_elements(
      case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
        then service_row.category_details -> 'combinations' else '[]'::jsonb end
    ) combination(value)
  ) option_row;

  -- Listings created before venue options existed retain their parent price.
  -- If options do exist, at least one must still support the event guest count.
  if legacy_option_count > 0 and legacy_option_id is null then
    return null;
  end if;

  legacy_minimum_hours := greatest(
    case when coalesce(service_row.category_details ->> 'minimumBookingHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (service_row.category_details ->> 'minimumBookingHours')::numeric else 1 end,
    1
  );
  legacy_provider_amount := round(service_row.base_price * case
    when service_row.pricing_unit = 'hour' then legacy_minimum_hours else 1 end, 2);

  return jsonb_build_object(
    'providerAmount', legacy_provider_amount,
    'customerAmount', round(legacy_provider_amount * (1 + service_row.commission_rate), 2),
    'optionId', legacy_option_id,
    'optionName', coalesce(legacy_option_name, 'Legacy venue rate'),
    'pricingBasis', case when service_row.pricing_unit = 'hour'
      then format('Legacy hourly rate x %s-hour minimum',
        to_char(legacy_minimum_hours, 'FM999,999,999,990.00'))
      else 'Legacy per-event rate' end
  );
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
    select event.id, event.event_date, event.event_time,
      greatest(coalesce(event.guest_count, 0), 0) as guest_count
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc limit 1
  ), base as (
    select recommendation.*
    from public.list_my_budget_aware_service_recommendations(target_event_id) recommendation
  ), service_schedule as (
    -- Keep the established schedule behaviour: unavailable services stay
    -- searchable and are labelled/disabled by the client marketplace.
    select base.service_id,
      case
        when event.event_date is null or event.event_time is null then 'schedule_required'
        when exists (
          select 1
          from public.provider_availability availability
          join public.services service on service.id = base.service_id
          where availability.provider_id = service.provider_id
            and availability.available_date = event.event_date
            and (availability.service_id is null or availability.service_id = service.id)
            and (
              availability.is_available = false
              or (availability.start_time is not null and event.event_time < availability.start_time)
              or (availability.end_time is not null and event.event_time > availability.end_time)
            )
        ) then 'unavailable'
        when exists (
          select 1
          from public.provider_operating_hours operating_hours
          join public.services service on service.id = base.service_id
          where operating_hours.provider_id = service.provider_id
            and operating_hours.day_of_week = lower(trim(to_char(event.event_date, 'Day')))
            and (
              operating_hours.is_open = false
              or event.event_time < operating_hours.open_time
              or event.event_time > operating_hours.close_time
            )
        ) then 'unavailable'
        when exists (
          select 1
          from public.bookings booking
          join public.services service on service.id = base.service_id
          where booking.provider_id = service.provider_id
            and booking.event_id <> event.id
            and booking.requested_date = event.event_date
            and booking.requested_time = event.event_time
            and booking.status in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
        ) then 'unavailable'
        else 'available'
      end as availability_status
    from base
    join selected_event event on true
    where base.service_id is not null
  ), repriced as (
    select base.*, venue_quote.value as venue_quote,
      coalesce(service_schedule.availability_status, base.availability_status)
        as current_availability_status,
      case
        when base.category_key = 'venue' and venue_quote.value is not null
          then (venue_quote.value ->> 'customerAmount')::numeric
        when base.category_key = 'venue' then null::numeric
        when quote.value is not null then (quote.value ->> 'customerAmount')::numeric
        else base.calculated_amount
      end as phase9_amount
    from base
    left join selected_event event on true
    left join service_schedule on service_schedule.service_id = base.service_id
    left join lateral (
      select public.calculate_venue_starting_quote_v8(base.service_id, event.guest_count) as value
    ) venue_quote on base.service_id is not null and base.category_key = 'venue'
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
    repriced.guest_requirement_met, repriced.current_availability_status,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget
      and repriced.guest_requirement_met
      and repriced.current_availability_status <> 'unavailable',
    case
      when repriced.category_key = 'venue' and repriced.venue_quote is null
        then 'No bookable venue option configuration fits the event requirements.'
      when repriced.phase9_amount is null then repriced.recommendation_reason
      when repriced.category_budget <= 0 then 'No budget is allocated to this category.'
      when repriced.phase9_amount > repriced.category_budget
        then format('Starting price is PHP %s over the category budget.',
          to_char(repriced.phase9_amount - repriced.category_budget, 'FM999,999,999,990.00'))
      when repriced.current_availability_status = 'unavailable'
        then 'The provider is unavailable for the current event schedule.'
      when repriced.current_availability_status = 'schedule_required'
        then 'Starting price fits the category budget; complete the event schedule to verify availability.'
      when repriced.category_key = 'venue'
        then 'A valid venue starting configuration fits the category budget.'
      else 'Fits the category budget and current event requirements.'
    end,
    case when repriced.category_key = 'venue'
      then coalesce(repriced.venue_quote ->> 'pricingBasis', 'Venue option configuration')
      else repriced.pricing_basis end,
    case when repriced.category_key = 'venue'
      then repriced.venue_quote ->> 'optionId' else repriced.recommended_option_id end,
    case when repriced.category_key = 'venue'
      then repriced.venue_quote ->> 'optionName' else repriced.recommended_option_name end
  from repriced
  order by 9 desc, 6 desc, (repriced.current_availability_status = 'available') desc,
    repriced.phase9_amount nulls last, repriced.item_id;
$$;

revoke all on function public.calculate_venue_starting_quote_v8(uuid, integer) from public;

comment on function public.calculate_venue_starting_quote_v8(uuid, integer) is
  'Finds the least expensive valid V8 venue option configuration for marketplace budget filtering without changing booking prices.';
comment on function public.list_my_budget_aware_service_recommendations_phase9(uuid) is
  'Budget-aware marketplace recommendations using eligible V8 venue starting configurations and existing schedule checks.';

commit;
