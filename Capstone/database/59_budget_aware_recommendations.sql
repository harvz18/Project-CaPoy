-- MULTIVENT Revision 2, Phase 8: budget-aware service recommendations.
-- Apply after 58_budget_allocation_revision.sql.

begin;

-- Read-only, event-aware recommendation data. This function never changes a
-- listing, selection, booking, allocation, or financial snapshot.
create or replace function public.list_my_budget_aware_service_recommendations(
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
  with requested_event as (
    select event.*
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc
    limit 1
  ), rate as (
    select public.get_public_commission_rate()::numeric as value
  ), allocations as (
    select item.event_id, item.category_key,
      round(coalesce(item.allocated_amount, 0), 2) as category_budget
    from public.event_budget_items item
    join requested_event event on event.id = item.event_id
    where item.allocation_version = 'phase7-v1'
  ), service_base as (
    select service.id as service_id, service.provider_id, service.base_price,
      service.pricing_model, service.pricing_unit, service.category_details,
      event.id as event_id, event.event_date, event.event_time,
      greatest(coalesce(event.guest_count, 0), 0) as guest_count,
      case
        when lower(category.name) like '%photo%' then 'photoVideo'
        when lower(category.name) like '%venue%'
          or lower(category.name) like '%estate%' then 'venue'
        when lower(category.name) like '%flor%' then 'floral'
        when lower(category.name) like '%attire%'
          or lower(category.name) like '%gown%' then 'gownRental'
        when lower(category.name) like '%organizer%'
          or lower(category.name) like '%coordinator%' then 'eventOrganizer'
        when lower(category.name) like '%host%'
          or lower(category.name) like '%emcee%' then 'hostEmcee'
        when lower(category.name) like '%sound%'
          or lower(category.name) like '%light%' then 'soundLights'
        else 'catering'
      end as category_key,
      lower(category.name) like '%cater%' as is_catering,
      rate.value as commission_rate
    from requested_event event
    cross join rate
    join public.services service on service.status = 'active'
      and service.is_available = true
    join public.service_categories category on category.id = service.category_id
      and category.is_active = true
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
      and owner.account_status in ('active', 'verified')
  ), priced_services as (
    select base.*,
      coalesce(allocation.category_budget, 0)::numeric(12,2) as category_budget,
      catering_option.value as catering_option,
      case
        when base.is_catering and catering_option.value is not null then
          round(
            (catering_option.value ->> 'pricePerHead')::numeric
            * base.guest_count
            * (1 + base.commission_rate),
            2
          )
        when not base.is_catering
          and coalesce(base.pricing_model, 'fixed') <> 'customQuote'
          and coalesce(base.base_price, 0) > 0 then
          round(
            base.base_price
            * case when base.pricing_unit = 'person'
              then greatest(base.guest_count, 1) else 1 end
            * (1 + base.commission_rate),
            2
          )
        else null
      end::numeric(12,2) as calculated_amount,
      case
        when base.event_date is null or base.event_time is null then 'schedule_required'
        when exists (
          select 1
          from public.provider_availability availability
          where availability.provider_id = base.provider_id
            and availability.available_date = base.event_date
            and (availability.service_id is null
              or availability.service_id = base.service_id)
            and (
              availability.is_available = false
              or (availability.start_time is not null
                and base.event_time < availability.start_time)
              or (availability.end_time is not null
                and base.event_time > availability.end_time)
            )
        ) then 'unavailable'
        when exists (
          select 1
          from public.provider_operating_hours operating_hours
          where operating_hours.provider_id = base.provider_id
            and operating_hours.day_of_week = lower(trim(to_char(base.event_date, 'Day')))
            and (
              operating_hours.is_open = false
              or base.event_time < operating_hours.open_time
              or base.event_time > operating_hours.close_time
            )
        ) then 'unavailable'
        when exists (
          select 1
          from public.bookings booking
          where booking.provider_id = base.provider_id
            and booking.event_id <> base.event_id
            and booking.requested_date = base.event_date
            and booking.status in (
              'requested', 'approved', 'payment_required', 'paid', 'confirmed'
            )
        ) then 'unavailable'
        else 'available'
      end as availability_status
    from service_base base
    left join allocations allocation
      on allocation.event_id = base.event_id
      and allocation.category_key = base.category_key
    left join lateral (
      select option.value
      from jsonb_array_elements(
        case
          when jsonb_typeof(base.category_details -> 'pricingOptions') = 'array'
            then base.category_details -> 'pricingOptions'
          when base.category_details ->> 'pricingBasis' = 'per_person'
            and coalesce(base.base_price, 0) > 0
            then jsonb_build_array(jsonb_build_object(
              'id', 'legacy-default',
              'name', coalesce(nullif(base.category_details ->> 'optionName', ''), 'Catering menu'),
              'pricePerHead', base.base_price,
              'minimumGuests', base.category_details -> 'minimumGuests',
              'maximumGuests', base.category_details -> 'maximumGuests'
            ))
          else '[]'::jsonb
        end
      ) option(value)
      where base.is_catering
        and base.guest_count > 0
        and base.guest_count between
          case when coalesce(option.value ->> 'minimumGuests', '') ~ '^[0-9]+$'
            then (option.value ->> 'minimumGuests')::integer else 0 end
          and case when coalesce(option.value ->> 'maximumGuests', '') ~ '^[0-9]+$'
            then (option.value ->> 'maximumGuests')::integer else 0 end
        and case when coalesce(option.value ->> 'pricePerHead', '')
          ~ '^[0-9]+([.][0-9]+)?$'
          then (option.value ->> 'pricePerHead')::numeric else 0 end > 0
      order by case when coalesce(option.value ->> 'pricePerHead', '')
          ~ '^[0-9]+([.][0-9]+)?$'
          then (option.value ->> 'pricePerHead')::numeric else 0 end,
        option.value ->> 'name'
      limit 1
    ) catering_option on true
  ), evaluated_services as (
    select priced.*,
      (not priced.is_catering or priced.catering_option is not null)
        as guest_requirement_met,
      (priced.category_budget > 0
        and priced.calculated_amount is not null
        and priced.calculated_amount <= priced.category_budget)
        as is_within_budget
    from priced_services priced
  ), coordinator_candidates as (
    select coordinator.*,
      event.id as event_id,
      coalesce(allocation.category_budget, 0)::numeric(12,2) as category_budget,
      round(coordinator.coordination_fee * (1 + rate.value), 2)::numeric(12,2)
        as calculated_amount,
      case
        when coordinator.is_available then 'available'
        when coordinator.unavailable_reason =
          'Complete the event date and time to check availability.' then 'schedule_required'
        else 'unavailable'
      end as availability_status
    from requested_event event
    cross join rate
    cross join lateral public.list_bookable_event_coordinators(event.id) coordinator
    left join allocations allocation
      on allocation.event_id = event.id
      and allocation.category_key = 'eventOrganizer'
  ), combined as (
    select
      evaluated.service_id::text as item_id,
      evaluated.service_id,
      evaluated.category_key,
      evaluated.category_budget,
      evaluated.calculated_amount,
      evaluated.is_within_budget,
      evaluated.guest_requirement_met,
      evaluated.availability_status,
      evaluated.is_within_budget
        and evaluated.guest_requirement_met
        and evaluated.availability_status <> 'unavailable' as is_recommended,
      case
        when evaluated.is_catering and evaluated.guest_count <= 0
          then 'Set the event guest count to calculate catering.'
        when evaluated.is_catering and evaluated.catering_option is null
          then 'No catering option supports the event guest count.'
        when evaluated.category_budget <= 0
          then 'No budget is allocated to this category.'
        when evaluated.calculated_amount is null
          then 'A provider quote is required before checking the category budget.'
        when not evaluated.is_within_budget
          then format('Estimated total is PHP %s over the category budget.',
            to_char(evaluated.calculated_amount - evaluated.category_budget,
              'FM999,999,999,990.00'))
        when evaluated.availability_status = 'unavailable'
          then 'The provider is unavailable for the current event schedule.'
        when evaluated.availability_status = 'schedule_required'
          then 'Fits the category budget; complete the event schedule to verify availability.'
        else 'Fits the category budget and current event requirements.'
      end as recommendation_reason,
      case
        when evaluated.is_catering and evaluated.catering_option is not null
          then format('PHP %s per guest x %s guests',
          to_char((evaluated.catering_option ->> 'pricePerHead')::numeric,
            'FM999,999,999,990.00'), evaluated.guest_count)
        when evaluated.is_catering then 'No guest-compatible option'
        when evaluated.pricing_unit = 'person' then format('Per person x %s guests',
          greatest(evaluated.guest_count, 1))
        else coalesce(evaluated.pricing_unit, 'event')
      end as pricing_basis,
      evaluated.catering_option ->> 'id' as recommended_option_id,
      evaluated.catering_option ->> 'name' as recommended_option_name
    from evaluated_services evaluated

    union all

    select
      'coordinator:' || coordinator.id::text,
      null::uuid,
      'eventOrganizer',
      coordinator.category_budget,
      coordinator.calculated_amount,
      coordinator.category_budget > 0
        and coordinator.calculated_amount <= coordinator.category_budget,
      true,
      coordinator.availability_status,
      coordinator.category_budget > 0
        and coordinator.calculated_amount <= coordinator.category_budget
        and coordinator.availability_status <> 'unavailable',
      case
        when coordinator.category_budget <= 0
          then 'No budget is allocated to Event Coordinator.'
        when coordinator.calculated_amount > coordinator.category_budget
          then format('Coordination fee is PHP %s over the category budget.',
            to_char(coordinator.calculated_amount - coordinator.category_budget,
              'FM999,999,999,990.00'))
        when coordinator.availability_status = 'unavailable'
          then coalesce(coordinator.unavailable_reason,
            'The coordinator is unavailable for the current event schedule.')
        when coordinator.availability_status = 'schedule_required'
          then 'Fits the category budget; complete the event schedule to verify availability.'
        else 'Fits the Event Coordinator budget and current event schedule.'
      end,
      'event',
      null::text,
      null::text
    from coordinator_candidates coordinator
  )
  select combined.item_id, combined.service_id, combined.category_key,
    combined.category_budget, combined.calculated_amount,
    combined.is_within_budget, combined.guest_requirement_met,
    combined.availability_status, combined.is_recommended,
    combined.recommendation_reason, combined.pricing_basis,
    combined.recommended_option_id, combined.recommended_option_name
  from combined
  order by combined.is_recommended desc,
    combined.is_within_budget desc,
    (combined.availability_status = 'available') desc,
    combined.calculated_amount nulls last,
    combined.item_id;
$$;

revoke all on function public.list_my_budget_aware_service_recommendations(uuid)
  from public;
grant execute on function public.list_my_budget_aware_service_recommendations(uuid)
  to authenticated;

comment on function public.list_my_budget_aware_service_recommendations(uuid) is
  'Read-only Phase 8 ranking inputs using event allocations, calculated customer prices, guest requirements, and current schedule availability.';

commit;
