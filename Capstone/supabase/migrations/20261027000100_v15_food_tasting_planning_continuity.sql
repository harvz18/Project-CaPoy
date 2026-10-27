-- Keep an in-progress event plan editable after its first provisional V15
-- food-tasting request. The request remains a real provider-facing booking;
-- this only defers the event lifecycle transition until the client submits
-- the rest of the selected services through the established V14 flow.

begin;

create or replace function public.continue_my_event_planning_after_v15_food_tasting_request(
  target_event_id uuid,
  target_booking_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
  for update;

  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  -- Only the newly-created tasting request may keep this plan open. Once any
  -- non-tasting provider request exists, the normal V14 booking lifecycle is
  -- authoritative and must never be moved back to planning.
  if not exists (
    select 1
    from public.catering_food_tasting_workflows workflow
    join public.bookings booking on booking.id = workflow.booking_id
    where workflow.booking_id = target_booking_id
      and workflow.event_id = event_row.id
      and workflow.client_id = auth.uid()
      and booking.status not in ('rejected', 'cancelled', 'expired')
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.bookings booking
    where booking.event_id = event_row.id
      and booking.client_id = auth.uid()
      and booking.status not in ('rejected', 'cancelled', 'expired')
      and not exists (
        select 1
        from public.catering_food_tasting_workflows workflow
        where workflow.booking_id = booking.id
      )
  ) then
    return false;
  end if;

  update public.events
  set status = 'planning', updated_at = now()
  where id = event_row.id
    and status = 'booking';

  return true;
end;
$$;

revoke all on function public.continue_my_event_planning_after_v15_food_tasting_request(uuid, uuid) from public;
grant execute on function public.continue_my_event_planning_after_v15_food_tasting_request(uuid, uuid) to authenticated;

comment on function public.continue_my_event_planning_after_v15_food_tasting_request(uuid, uuid) is
  'Restores planning only after a newly-created provisional V15 tasting request and never after another active provider request exists.';

commit;
