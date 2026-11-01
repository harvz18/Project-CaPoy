-- MULTIVENT Revision V22, Phase 9
-- A saved plan is a reusable client-owned template. Starting a booking from
-- one must never convert that template into a live booking or copy financial
-- history into the new event.

begin;

create or replace function public.start_my_booking_from_saved_plan_v22(
  target_saved_plan_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_event public.events%rowtype;
  booking_event_id uuid;
  event_columns text;
  child_columns text;
  child_table text;
begin
  select * into source_event
  from public.events event
  where event.id = target_saved_plan_id
    and event.client_id = auth.uid()
    and event.status in ('draft', 'planning')
    and event.saved_plan_at is not null
  for update;

  if source_event.id is null then
    raise exception 'Saved plan not found.' using errcode = '42501';
  end if;

  -- Build the event copy from the installed schema. This deliberately omits
  -- the primary key so PostgreSQL assigns a new event identity, and supports
  -- additive event fields introduced by later revisions without a brittle
  -- column list.
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
  into event_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name <> 'id'
    and is_identity = 'NO'
    and is_generated = 'NEVER';

  if event_columns is null then
    raise exception 'Event configuration is unavailable.';
  end if;

  execute format(
    'insert into public.events (%1$s) select %1$s from public.events where id = $1 returning id',
    event_columns
  ) into booking_event_id using source_event.id;

  -- Clear template-only metadata. The clone is a new unbooked planning event;
  -- provider requests, payments, and acceptance records are only created by
  -- the existing booking-submission function after this point.
  update public.events
  set status = 'planning',
      saved_plan_at = null,
      saved_plan_estimated_total = null,
      saved_plan_selection_count = null,
      coordinator_assignment_requested_at = null,
      updated_at = now()
  where id = booking_event_id;

  -- Copy only editable planning configuration. These tables contain no
  -- payments, booking requests, reviews, notifications, or provider history.
  foreach child_table in array array[
    'event_service_selections',
    'event_budget_items',
    'event_provider_instructions',
    'catering_food_tasting_drafts',
    'event_church_arrangements'
  ] loop
    if to_regclass(format('public.%I', child_table)) is null then
      continue;
    end if;

    select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into child_columns
    from information_schema.columns
    where table_schema = 'public'
      and table_name = child_table
      and column_name not in ('id', 'event_id')
      and is_identity = 'NO'
      and is_generated = 'NEVER';

    if child_columns is not null then
      execute format(
        'insert into public.%1$I (event_id, %2$s) select $1, %2$s from public.%1$I where event_id = $2',
        child_table,
        child_columns
      ) using booking_event_id, source_event.id;
    end if;
  end loop;

  -- Saved plans never have requested selections, but setting this explicitly
  -- makes the cloned plan resilient to any legacy saved-plan data.
  update public.event_service_selections
  set status = 'selected', updated_at = now()
  where event_id = booking_event_id;

  return booking_event_id;
end;
$$;

revoke all on function public.start_my_booking_from_saved_plan_v22(uuid) from public;
grant execute on function public.start_my_booking_from_saved_plan_v22(uuid) to authenticated;

comment on function public.start_my_booking_from_saved_plan_v22(uuid) is
  'Creates a new planning event from a client saved plan without consuming the saved plan or copying bookings, payments, reviews, or history.';

commit;
