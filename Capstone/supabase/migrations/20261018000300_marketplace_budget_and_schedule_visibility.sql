begin;

-- Budget recommendations remain the source of truth for option-aware pricing.
-- This Phase 9 projection corrects schedule conflicts to the actual event
-- date and start time, rather than hiding a provider for every booking that
-- happens to share the same date.
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
    select event.id, event.event_date, event.event_time
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc limit 1
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
  ), repriced as (
    select base.*, quote.value,
      coalesce(service_schedule.availability_status, base.availability_status)
        as current_availability_status,
      case
        when base.category_key = 'venue' then null::numeric
        when quote.value is not null then (quote.value ->> 'customerAmount')::numeric
        else base.calculated_amount
      end as phase9_amount
    from base
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
      and repriced.phase9_amount <= repriced.category_budget,
    repriced.guest_requirement_met, repriced.current_availability_status,
    repriced.category_budget > 0 and repriced.phase9_amount is not null
      and repriced.phase9_amount <= repriced.category_budget
      and repriced.guest_requirement_met
      and repriced.current_availability_status <> 'unavailable',
    case
      when repriced.category_key = 'venue'
        then 'Choose a venue option and booking duration to calculate the authoritative amount.'
      when repriced.phase9_amount is null then repriced.recommendation_reason
      when repriced.category_budget <= 0 then 'No budget is allocated to this category.'
      when repriced.phase9_amount > repriced.category_budget
        then format('Estimated total is PHP %s over the category budget.',
          to_char(repriced.phase9_amount - repriced.category_budget, 'FM999,999,999,990.00'))
      when repriced.current_availability_status = 'unavailable'
        then 'The provider is unavailable for the current event schedule.'
      when repriced.current_availability_status = 'schedule_required'
        then 'Fits the category budget; complete the event schedule to verify availability.'
      else 'Fits the category budget and current event requirements.'
    end,
    case when repriced.category_key = 'venue' then 'Option and duration required'
      else repriced.pricing_basis end,
    repriced.recommended_option_id, repriced.recommended_option_name
  from repriced
  order by 9 desc, 6 desc, (repriced.current_availability_status = 'available') desc,
    repriced.phase9_amount nulls last, repriced.item_id;
$$;

comment on function public.list_my_budget_aware_service_recommendations_phase9(uuid) is
  'Option-aware marketplace recommendations. Services over an allocated category budget are excluded by the client; same-date-and-time conflicts remain visible as unavailable.';

commit;
