-- MULTIVENT Revision V15, Phase 6: direct catering choices and food-tasting
-- finalizations share one immutable menu shape. This migration does not alter
-- payments, provider acceptance, historical booking values, or payout logic.

begin;

alter table public.event_service_selections
  add column if not exists final_menu_snapshot jsonb;
alter table public.bookings
  add column if not exists final_menu_snapshot jsonb;

-- Converts an established direct-menu or preset selection snapshot into the
-- same courses/selectedItems structure used by the Phase 5 food-tasting menu.
-- The source snapshot is already server-priced by the V10 quote functions.
create or replace function public.v15_direct_catering_final_menu_snapshot(
  option_snapshot jsonb,
  option_name text,
  guest_count integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  menu_items jsonb := coalesce(option_snapshot -> 'selectedItems', '[]'::jsonb);
  courses jsonb := '[]'::jsonb;
  item_row jsonb;
  section_id text;
  section_name text;
begin
  if jsonb_typeof(menu_items) = 'array' and jsonb_array_length(menu_items) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'courseId', grouped.section_id,
      'courseName', grouped.section_name,
      'selectedItems', grouped.items
    ) order by grouped.section_name), '[]'::jsonb)
    into courses
    from (
      select coalesce(nullif(item.value ->> 'sectionId', ''), 'direct-menu') as section_id,
        coalesce(nullif(item.value ->> 'sectionName', ''), 'Selected menu') as section_name,
        jsonb_agg(jsonb_build_object(
          'id', item.value ->> 'id',
          'name', item.value ->> 'name',
          'description', nullif(item.value ->> 'description', ''),
          'pricePerHead', coalesce(nullif(item.value ->> 'pricePerHead', '')::numeric, 0)
        ) order by item.value ->> 'name') as items
      from jsonb_array_elements(menu_items) item(value)
      group by 1, 2
    ) grouped;
  else
    -- A preset/package has no per-dish configuration. Preserve the accepted
    -- commercial option as one final-menu inclusion rather than inventing dishes.
    courses := jsonb_build_array(jsonb_build_object(
      'courseId', coalesce(nullif(option_snapshot ->> 'id', ''), 'preset-menu'),
      'courseName', 'Selected catering option',
      'selectedItems', jsonb_build_array(jsonb_build_object(
        'id', coalesce(nullif(option_snapshot ->> 'id', ''), 'preset-menu'),
        'name', coalesce(nullif(option_name, ''), nullif(option_snapshot ->> 'name', ''), 'Selected catering option'),
        'pricePerHead', coalesce(nullif(option_snapshot ->> 'pricePerHead', '')::numeric, 0)
      ))
    ));
  end if;
  return jsonb_build_object(
    'version', 'v15-final-menu-v1',
    'source', 'direct_selection',
    'guestCount', greatest(coalesce(guest_count, 0), 0),
    'courses', courses
  );
end;
$$;

create or replace function public.sync_v15_direct_catering_final_menu_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.food_tasting_preference, false) = false
    and new.catering_option_snapshot is not null
    and coalesce(new.catering_option_id, '') <> 'food-tasting-pending' then
    new.final_menu_snapshot := public.v15_direct_catering_final_menu_snapshot(
      new.catering_option_snapshot, new.catering_option_name,
      coalesce(nullif(new.catering_option_snapshot ->> 'guestCount', '')::integer, 0)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_v15_direct_selection_final_menu_trigger on public.event_service_selections;
create trigger sync_v15_direct_selection_final_menu_trigger
before insert or update of catering_option_id, catering_option_name, catering_option_snapshot,
  food_tasting_preference, attendee_count on public.event_service_selections
for each row execute function public.sync_v15_direct_catering_final_menu_snapshot();

drop trigger if exists sync_v15_direct_booking_final_menu_trigger on public.bookings;
create trigger sync_v15_direct_booking_final_menu_trigger
before insert or update of catering_option_id, catering_option_name, catering_option_snapshot,
  food_tasting_preference on public.bookings
for each row execute function public.sync_v15_direct_catering_final_menu_snapshot();

-- Phase 5 already holds the authoritative tasting final menu. Copy it only
-- after client confirmation; pending or historical requests remain untouched.
update public.event_service_selections selection
set final_menu_snapshot = workflow.final_menu || jsonb_build_object(
  'version', 'v15-final-menu-v1', 'source', 'food_tasting',
  'clientConfirmedAt', workflow.final_menu_client_confirmed_at
), updated_at = selection.updated_at
from public.catering_food_tasting_workflows workflow
where workflow.event_id = selection.event_id
  and workflow.service_id = selection.service_id
  and workflow.client_id = selection.client_id
  and workflow.status = 'finalized'
  and workflow.final_menu is not null;

update public.bookings booking
set final_menu_snapshot = workflow.final_menu || jsonb_build_object(
  'version', 'v15-final-menu-v1', 'source', 'food_tasting',
  'clientConfirmedAt', workflow.final_menu_client_confirmed_at
), updated_at = booking.updated_at
from public.catering_food_tasting_workflows workflow
where workflow.booking_id = booking.id
  and workflow.status = 'finalized'
  and workflow.final_menu is not null;

-- Keep future confirmed tasting menus aligned with the canonical field while
-- retaining the full provider/client revision history from Phase 5.
create or replace function public.sync_v15_confirmed_tasting_final_menu_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'finalized' and new.final_menu is not null then
    update public.event_service_selections set
      final_menu_snapshot = new.final_menu || jsonb_build_object(
        'version', 'v15-final-menu-v1', 'source', 'food_tasting',
        'clientConfirmedAt', new.final_menu_client_confirmed_at
      )
    where event_id = new.event_id and service_id = new.service_id
      and client_id = new.client_id and status not in ('declined', 'cancelled');
    update public.bookings set
      final_menu_snapshot = new.final_menu || jsonb_build_object(
        'version', 'v15-final-menu-v1', 'source', 'food_tasting',
        'clientConfirmedAt', new.final_menu_client_confirmed_at
      )
    where id = new.booking_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_v15_confirmed_tasting_final_menu_trigger on public.catering_food_tasting_workflows;
create trigger sync_v15_confirmed_tasting_final_menu_trigger
after update of status, final_menu, final_menu_client_confirmed_at on public.catering_food_tasting_workflows
for each row execute function public.sync_v15_confirmed_tasting_final_menu_snapshot();

revoke all on function public.v15_direct_catering_final_menu_snapshot(jsonb, text, integer) from public;
revoke all on function public.sync_v15_direct_catering_final_menu_snapshot() from public;
revoke all on function public.sync_v15_confirmed_tasting_final_menu_snapshot() from public;

comment on column public.event_service_selections.final_menu_snapshot is
  'V15 canonical final catering menu for direct selections or client-confirmed food tastings.';
comment on column public.bookings.final_menu_snapshot is
  'V15 immutable booking-time final catering menu snapshot; never used to reprice paid records.';

commit;
