-- Returns only the official location for a coordinator's own accepted event
-- or pending assignment. This avoids widening the dashboard projection.
begin;

create or replace function public.get_my_coordinator_event_location_v23(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row record;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select event.venue, event.location, event.venue_latitude, event.venue_longitude
  into event_row
  from public.events event
  where event.id = target_event_id
    and event.status not in ('cancelled', 'completed')
    and (
      (event.coordinator_id = auth.uid() and event.coordinator_assignment_status = 'accepted')
      or (event.pending_coordinator_id = auth.uid() and event.coordinator_assignment_status = 'pending')
    );

  if event_row is null then
    raise exception 'This event location is not available to your coordinator account.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'venue', event_row.venue,
    'location', event_row.location,
    'venue_latitude', event_row.venue_latitude,
    'venue_longitude', event_row.venue_longitude
  );
end;
$$;

revoke all on function public.get_my_coordinator_event_location_v23(uuid) from public;
grant execute on function public.get_my_coordinator_event_location_v23(uuid) to authenticated;

commit;
