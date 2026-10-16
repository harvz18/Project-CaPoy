-- MULTIVENT Revision V4, Phase 4: coordinator booking-status visibility.
-- This is a read-only status feed. It grants no payment, provider-response,
-- or booking-write authority to coordinators.

begin;

create or replace function public.get_my_coordinator_booking_statuses()
returns table (
  event_id uuid,
  booking_id uuid,
  service_id uuid,
  provider_id uuid,
  service_name text,
  category_name text,
  provider_name text,
  amount numeric,
  status text,
  client_notes text,
  catering_option_name text,
  venue_option_name text,
  venue_booked_hours numeric,
  replacement_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    booking.event_id,
    booking.id,
    booking.service_id,
    booking.provider_id,
    coalesce(service.name, 'Service'),
    coalesce(category.name, 'Service'),
    coalesce(provider.business_name, 'Provider'),
    coalesce(booking.amount, 0),
    booking.status::text,
    booking.client_notes,
    booking.catering_option_name,
    booking.venue_option_name,
    booking.venue_booked_hours,
    replacement.status
  from public.bookings booking
  join public.events event on event.id = booking.event_id
  left join public.services service on service.id = booking.service_id
  left join public.service_categories category on category.id = service.category_id
  left join public.provider_profiles provider on provider.id = booking.provider_id
  left join public.booking_replacements replacement
    on replacement.rejected_booking_id = booking.id
  where auth.uid() is not null
    and event.coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'accepted'
    and event.status not in ('cancelled');
$$;

revoke all on function public.get_my_coordinator_booking_statuses() from public;
grant execute on function public.get_my_coordinator_booking_statuses() to authenticated;

comment on function public.get_my_coordinator_booking_statuses() is
  'Read-only booking status and replacement state for events assigned to the authenticated coordinator. No financial or provider-decision fields are returned.';

commit;
