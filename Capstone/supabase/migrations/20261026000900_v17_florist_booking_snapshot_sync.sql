-- MULTIVENT Revision V17, Phase 8: preserve florist selection snapshots when
-- the established V14 booking-request flow creates a booking.
begin;

create or replace function public.sync_v17_florist_booking_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection_snapshot jsonb;
begin
  if coalesce(new.florist_selection_snapshot, '{}'::jsonb) <> '{}'::jsonb then
    return new;
  end if;
  select selection.florist_selection_snapshot into selection_snapshot
  from public.event_service_selections selection
  where selection.event_id = new.event_id
    and selection.client_id = new.client_id
    and selection.service_id = new.service_id
    and selection.status in ('selected', 'requested')
  order by selection.updated_at desc, selection.id desc
  limit 1;
  if jsonb_typeof(selection_snapshot) = 'object' and selection_snapshot <> '{}'::jsonb then
    new.florist_selection_snapshot := selection_snapshot;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_v17_florist_booking_snapshot_trigger on public.bookings;
create trigger sync_v17_florist_booking_snapshot_trigger
before insert on public.bookings
for each row execute function public.sync_v17_florist_booking_snapshot();

comment on function public.sync_v17_florist_booking_snapshot() is
  'Copies an existing florist plan snapshot into the booking created by the V14 request-first workflow.';

revoke all on function public.sync_v17_florist_booking_snapshot() from public;

commit;
