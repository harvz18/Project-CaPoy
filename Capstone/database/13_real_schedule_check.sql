-- MULTIVENT private, real provider schedule check and payment-method default.
-- Run after 12_provider_instruction_visibility.sql in the Supabase SQL Editor.
-- The function exposes only availability results for an event owned by the
-- signed-in client; it does not expose another client's booking information.

begin;

alter table public.payments
  alter column provider set default 'eWallet';

create or replace function public.get_event_schedule_availability(target_event_id uuid)
returns table (
  selection_id uuid,
  provider_id uuid,
  service_id uuid,
  provider_name text,
  service_name text,
  category_name text,
  requested_start_at timestamptz,
  is_available boolean,
  conflict_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  with selected_services as (
    select
      selections.id as selection_id,
      selections.provider_id,
      selections.service_id,
      coalesce(providers.business_name, selections.service_name, 'Service provider') as provider_name,
      coalesce(selections.service_name, services.name, 'Selected service') as service_name,
      coalesce(selections.category_name, categories.name, 'Service') as category_name,
      events.event_date,
      events.event_time,
      events.timezone as event_timezone
    from public.events
    join public.event_service_selections as selections
      on selections.event_id = events.id
    left join public.provider_profiles as providers
      on providers.id = selections.provider_id
    left join public.services
      on services.id = selections.service_id
    left join public.service_categories as categories
      on categories.id = services.category_id
    where events.id = target_event_id
      and events.client_id = auth.uid()
      and selections.status not in ('declined', 'cancelled')
  )
  select
    selected.selection_id,
    selected.provider_id,
    selected.service_id,
    selected.provider_name,
    selected.service_name,
    selected.category_name,
    case
      when selected.event_date is null or selected.event_time is null then null
      else (
        selected.event_date::text || ' ' ||
        coalesce(selected.event_time, time '00:00:00')::text
      )::timestamp at time zone coalesce(selected.event_timezone, 'Asia/Manila')
    end as requested_start_at,
    selected.event_date is not null
      and selected.event_time is not null
      and selected.provider_id is not null
      and not exists (
        select 1
        from public.provider_availability as availability
        where availability.provider_id = selected.provider_id
          and availability.available_date = selected.event_date
          and (
            availability.service_id is null
            or selected.service_id is null
            or availability.service_id = selected.service_id
          )
          and (
            availability.is_available = false
            or (
              selected.event_time is not null
              and availability.start_time is not null
              and selected.event_time < availability.start_time
            )
            or (
              selected.event_time is not null
              and availability.end_time is not null
              and selected.event_time > availability.end_time
            )
          )
      )
      and not exists (
        select 1
        from public.provider_operating_hours as operating_hours
        where operating_hours.provider_id = selected.provider_id
          and operating_hours.day_of_week = lower(trim(to_char(selected.event_date, 'Day')))
          and (
            operating_hours.is_open = false
            or selected.event_time < operating_hours.open_time
            or selected.event_time > operating_hours.close_time
          )
      )
      and not exists (
        select 1
        from public.bookings
        where bookings.provider_id = selected.provider_id
          and bookings.event_id <> target_event_id
          and bookings.requested_date = selected.event_date
          and bookings.status not in ('rejected', 'cancelled', 'expired')
      ) as is_available,
    case
      when selected.event_date is null then 'Add an event date before checking availability.'
      when selected.event_time is null then 'Add an event time before checking availability.'
      when selected.provider_id is null then 'This selection is not connected to a provider account.'
      when exists (
        select 1
        from public.bookings
        where bookings.provider_id = selected.provider_id
          and bookings.event_id <> target_event_id
          and bookings.requested_date = selected.event_date
          and bookings.status not in ('rejected', 'cancelled', 'expired')
      ) then 'Provider already has an active booking on this date.'
      when exists (
        select 1
        from public.provider_availability as availability
        where availability.provider_id = selected.provider_id
          and availability.available_date = selected.event_date
          and (
            availability.service_id is null
            or selected.service_id is null
            or availability.service_id = selected.service_id
          )
          and (
            availability.is_available = false
            or (
              selected.event_time is not null
              and availability.start_time is not null
              and selected.event_time < availability.start_time
            )
            or (
              selected.event_time is not null
              and availability.end_time is not null
              and selected.event_time > availability.end_time
            )
          )
      ) then coalesce(
        (
          select availability.notes
          from public.provider_availability as availability
          where availability.provider_id = selected.provider_id
            and availability.available_date = selected.event_date
            and (
              availability.service_id is null
              or selected.service_id is null
              or availability.service_id = selected.service_id
            )
            and availability.notes is not null
          limit 1
        ),
        'Provider is unavailable at the requested date or time.'
      )
      when exists (
        select 1
        from public.provider_operating_hours as operating_hours
        where operating_hours.provider_id = selected.provider_id
          and operating_hours.day_of_week = lower(trim(to_char(selected.event_date, 'Day')))
          and (
            operating_hours.is_open = false
            or selected.event_time < operating_hours.open_time
            or selected.event_time > operating_hours.close_time
          )
      ) then 'The requested time is outside this provider''s operating hours.'
      else null
    end as conflict_reason
  from selected_services as selected
  order by selected.service_name;
$$;

revoke all on function public.get_event_schedule_availability(uuid) from public;
grant execute on function public.get_event_schedule_availability(uuid) to authenticated;

commit;
