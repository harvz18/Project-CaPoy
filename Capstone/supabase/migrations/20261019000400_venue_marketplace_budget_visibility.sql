begin;

-- Venue booking remains authoritative only after a client chooses both a
-- space and a duration. The marketplace still needs a safe minimum amount to
-- decide whether a listing can fit the allocated category budget. Phase 9
-- previously returned NULL for every venue, which made the client correctly
-- (but unhelpfully) hide every venue whenever an allocation was present.
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
    order by event.updated_at desc
    limit 1
  ), rate as (
    select public.get_public_commission_rate()::numeric as commission_rate
  ), base as (
    select recommendation.*
    from public.list_my_budget_aware_service_recommendations(target_event_id) recommendation
  ), service_schedule as (
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
  ), venue_marketplace_fits as (
    select base.service_id,
      venue_option.option_id,
      venue_option.option_name,
      venue_option.minimum_booked_hours,
      venue_option.minimum_billed_hours,
      case
        when venue_option.option_id is null or coalesce(service.base_price, 0) <= 0
          then null::numeric
        else round(
          service.base_price
          * case when coalesce(service.pricing_unit, 'event') = 'hour'
            then venue_option.minimum_billed_hours else 1 end
          * (1 + rate.commission_rate),
          2
        )
      end as starting_amount,
      case
        when venue_option.option_id is null
          then 'No venue option supports the event guest count.'
        when coalesce(service.pricing_unit, 'event') = 'hour'
          then format(
            'Minimum %s-hour booking%s; choose a space and duration for the exact total.',
            to_char(venue_option.minimum_booked_hours, 'FM999,999,999,990.##'),
            case when venue_option.minimum_billed_hours > venue_option.minimum_booked_hours
              then ' plus billable setup' else '' end
          )
        else 'Base venue amount; choose a space and duration for the exact total.'
      end as starting_pricing_basis
    from base
    join selected_event event on true
    join public.services service on service.id = base.service_id
    cross join rate
    left join lateral (
      with venue_spaces as (
        select trim(space.value ->> 'id') as option_id,
          trim(space.value ->> 'name') as option_name,
          case when coalesce(space.value ->> 'capacity', '') ~ '^[0-9]+$'
            then (space.value ->> 'capacity')::integer else 0 end as capacity
        from jsonb_array_elements(
          case when jsonb_typeof(service.category_details -> 'spaces') = 'array'
            then service.category_details -> 'spaces' else '[]'::jsonb end
        ) space(value)
        where nullif(trim(space.value ->> 'id'), '') is not null
          and nullif(trim(space.value ->> 'name'), '') is not null
      ), venue_options as (
        select space.option_id, space.option_name, space.capacity
        from venue_spaces space

        union all

        select trim(combination.value ->> 'id'), trim(combination.value ->> 'name'),
          coalesce(
            case when coalesce(combination.value ->> 'combinedCapacity', '') ~ '^[0-9]+$'
              then (combination.value ->> 'combinedCapacity')::integer end,
            case when coalesce(combination.value ->> 'capacity', '') ~ '^[0-9]+$'
              then (combination.value ->> 'capacity')::integer end,
            0
          )
        from jsonb_array_elements(
          case when jsonb_typeof(service.category_details -> 'combinations') = 'array'
            then service.category_details -> 'combinations' else '[]'::jsonb end
        ) combination(value)
        where nullif(trim(combination.value ->> 'id'), '') is not null
          and nullif(trim(combination.value ->> 'name'), '') is not null
          and (
            select count(*)
            from (
              select distinct resource.value
              from jsonb_array_elements_text(
                case when jsonb_typeof(combination.value -> 'spaceIds') = 'array'
                  then combination.value -> 'spaceIds' else '[]'::jsonb end
              ) resource(value)
              join venue_spaces space on space.option_id = resource.value
            ) valid_resources
          ) >= 2
      ), booking_rules as (
        select
          greatest(
            case when coalesce(service.category_details ->> 'minimumBookingHours', '')
              ~ '^[0-9]+([.][0-9]+)?$'
              then (service.category_details ->> 'minimumBookingHours')::numeric
              else 1 end,
            0.25
          ) as minimum_hours,
          greatest(
            case when coalesce(service.category_details ->> 'bookingDurationIncrementHours', '')
              ~ '^[0-9]+([.][0-9]+)?$'
              then (service.category_details ->> 'bookingDurationIncrementHours')::numeric
              else 1 end,
            0.25
          ) as increment_hours,
          greatest(
            case when coalesce(service.category_details ->> 'setupAllowance', '')
              ~ '^[0-9]+([.][0-9]+)?$'
              then (service.category_details ->> 'setupAllowance')::numeric
              else 0 end,
            0
          ) * case when service.category_details ->> 'setupAllowanceUnit' = 'days'
            then 24 else 1 end as setup_hours,
          service.category_details ->> 'setupAllowanceBillable' = 'true' as setup_is_billable
      )
      select option_row.option_id, option_row.option_name,
        ceil(rules.minimum_hours / rules.increment_hours) * rules.increment_hours
          as minimum_booked_hours,
        ceil(rules.minimum_hours / rules.increment_hours) * rules.increment_hours
          + case when rules.setup_is_billable then rules.setup_hours else 0 end
          as minimum_billed_hours
      from venue_options option_row
      cross join booking_rules rules
      where option_row.capacity >= greatest(event.guest_count, 1)
      order by option_row.capacity, option_row.option_name
      limit 1
    ) venue_option on true
    where base.category_key = 'venue'
  ), repriced as (
    select base.*, venue_fit.option_id as venue_option_id,
      venue_fit.option_name as venue_option_name,
      venue_fit.starting_pricing_basis as venue_pricing_basis,
      case when base.category_key = 'venue' then venue_fit.option_id is not null
        else base.guest_requirement_met end as current_guest_requirement_met,
      coalesce(service_schedule.availability_status, base.availability_status)
        as current_availability_status,
      case
        when base.category_key = 'venue' then venue_fit.starting_amount
        when quote.value is not null then (quote.value ->> 'customerAmount')::numeric
        else base.calculated_amount
      end as phase9_amount
    from base
    left join venue_marketplace_fits venue_fit on venue_fit.service_id = base.service_id
    left join selected_event event on true
    left join service_schedule on service_schedule.service_id = base.service_id
    left join lateral (
      select public.try_calculate_event_service_quote(
        base.service_id, event.id, base.recommended_option_id, null
      ) as value
    ) quote on base.service_id is not null and base.category_key <> 'venue'
  )
  select repriced.item_id, repriced.service_id, repriced.category_key,
    repriced.category_budget, repriced.phase9_amount,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget
      and repriced.current_guest_requirement_met,
    repriced.current_guest_requirement_met, repriced.current_availability_status,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget
      and repriced.current_guest_requirement_met
      and repriced.current_availability_status <> 'unavailable',
    case
      when repriced.category_key = 'venue' and not repriced.current_guest_requirement_met
        then 'No venue space or valid combination supports the event guest count.'
      when repriced.category_budget <= 0 then 'No budget is allocated to this category.'
      when repriced.phase9_amount is null then repriced.recommendation_reason
      when repriced.phase9_amount > repriced.category_budget
        then format('Starting venue total is PHP %s over the category budget.',
          to_char(repriced.phase9_amount - repriced.category_budget, 'FM999,999,999,990.00'))
      when repriced.current_availability_status = 'unavailable'
        then 'The provider is unavailable for the current event schedule.'
      when repriced.current_availability_status = 'schedule_required'
        then 'The starting venue total fits the category budget; complete the event schedule to verify availability.'
      when repriced.category_key = 'venue'
        then 'A compatible venue option fits the category budget. Choose a space and duration for the authoritative total.'
      else 'Fits the category budget and current event requirements.'
    end,
    case when repriced.category_key = 'venue'
      then coalesce(repriced.venue_pricing_basis, 'Choose a venue option and booking duration.')
      else repriced.pricing_basis end,
    case when repriced.category_key = 'venue' then repriced.venue_option_id
      else repriced.recommended_option_id end,
    case when repriced.category_key = 'venue' then repriced.venue_option_name
      else repriced.recommended_option_name end
  from repriced
  order by 9 desc, 6 desc, (repriced.current_availability_status = 'available') desc,
    repriced.phase9_amount nulls last, repriced.item_id;
$$;

revoke all on function public.list_my_budget_aware_service_recommendations_phase9(uuid)
  from public;
grant execute on function public.list_my_budget_aware_service_recommendations_phase9(uuid)
  to authenticated;

comment on function public.list_my_budget_aware_service_recommendations_phase9(uuid) is
  'Option-aware marketplace recommendations. Venue results use the lowest capacity-compatible, rule-valid starting amount only for budget discovery; authoritative venue quotes still require the selected space and duration.';

commit;
