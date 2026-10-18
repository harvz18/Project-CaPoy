-- V7 Phase 2 follow-up: make already-confirmed provider bookings visible in
-- the coordinator's event-grouped inbox immediately. The ensure function is
-- advisory-locked and backed by a unique partial index, so this is idempotent.

begin;

do $$
declare
  booking_row record;
begin
  for booking_row in
    select booking.id
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    where booking.status::text in ('confirmed', 'completed')
      and event.status <> 'cancelled'
      and event.coordinator_assignment_status = 'accepted'
      and event.coordinator_id is not null
  loop
    perform public.ensure_coordinator_provider_conversation(booking_row.id);
  end loop;
end;
$$;

commit;
