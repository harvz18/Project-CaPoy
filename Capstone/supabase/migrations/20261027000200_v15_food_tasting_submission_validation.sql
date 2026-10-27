-- A V15 food-tasting request is already an immutable provider request with a
-- pending final price. V14 must validate only selections that are still
-- editable, then preserve requested selections during its idempotent submit.

begin;

create or replace function public.validate_my_phase9_selections(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection_row record;
  custom_menu_item_ids jsonb;
begin
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id
      and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.status not in ('declined', 'cancelled')
    group by selection.category_key
    having count(*) > 1
  ) then
    raise exception 'Only one service may be selected per category.';
  end if;

  -- Requested rows already have a provider-facing booking snapshot. Repricing
  -- them here incorrectly treats the V15 food-tasting placeholder as a normal
  -- catering option and blocks submission of the remaining selected services.
  for selection_row in
    select selection.service_id, selection.package_id, selection.category_key,
      selection.catering_option_id, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_booked_hours
    from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.client_id = auth.uid()
      and selection.status = 'selected'
  loop
    if selection_row.category_key = 'catering'
      and selection_row.catering_option_id = 'custom-menu'
    then
      select coalesce(jsonb_agg(item.value ->> 'id'), '[]'::jsonb)
      into custom_menu_item_ids
      from jsonb_array_elements(
        coalesce(selection_row.catering_option_snapshot -> 'selectedItems', '[]'::jsonb)
      ) item(value);

      perform public.calculate_catering_menu_quote(
        selection_row.service_id,
        target_event_id,
        custom_menu_item_ids
      );
    else
      perform public.calculate_event_service_quote(
        selection_row.service_id,
        target_event_id,
        case when selection_row.category_key = 'venue'
          then selection_row.venue_option_id else selection_row.catering_option_id end,
        selection_row.venue_booked_hours,
        selection_row.package_id
      );
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.validate_my_phase9_selections(uuid) from public;
grant execute on function public.validate_my_phase9_selections(uuid) to authenticated;

comment on function public.validate_my_phase9_selections(uuid) is
  'Validates only editable selected rows; requested provider bookings retain their server-owned snapshots.';

commit;
