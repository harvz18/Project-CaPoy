-- MULTIVENT Revision V15, Phase 1: retain an explicit client food-tasting
-- choice without changing existing catering prices, menus, requests, or
-- payment eligibility. Historic rows deliberately remain nullable.

begin;

alter table public.event_service_selections
  add column if not exists food_tasting_preference boolean;

alter table public.bookings
  add column if not exists food_tasting_preference boolean;

-- The V15 entry point makes the new client choice explicit while delegating
-- all quote, guest-count, menu, package, budget, and selection locking rules
-- to the established V10 server-side implementation.
create or replace function public.save_my_catering_service_selection_v15(
  target_event_id uuid,
  target_service_id uuid,
  target_guest_count integer,
  target_option_id text default null,
  target_package_id uuid default null,
  target_menu_item_ids jsonb default null,
  target_food_tasting_preference boolean default null,
  target_meal_type text default null,
  target_notes text default null,
  replace_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  selection_id uuid;
  service_row record;
begin
  if target_food_tasting_preference is null then
    raise exception 'Choose whether you would like a food tasting.' using errcode = '22023';
  end if;

  select service.id, service.category_details, category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id;

  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'catering' then
    raise exception 'Catering service not found.';
  end if;

  if target_food_tasting_preference
    and not coalesce(service_row.category_details @> '{"tastingSettings":{"enabled":true}}'::jsonb, false) then
    raise exception 'This caterer has not enabled food tasting appointments.' using errcode = '22023';
  end if;

  result := public.save_my_catering_service_selection_v10(
    target_event_id,
    target_service_id,
    target_guest_count,
    target_option_id,
    target_package_id,
    target_menu_item_ids,
    target_meal_type,
    target_notes,
    replace_existing
  );

  selection_id := nullif(result ->> 'selectionId', '')::uuid;
  if selection_id is null then
    raise exception 'The catering selection could not be saved.';
  end if;

  update public.event_service_selections selection
  set food_tasting_preference = target_food_tasting_preference,
      catering_option_snapshot = jsonb_set(
        coalesce(selection.catering_option_snapshot, '{}'::jsonb),
        '{foodTastingPreference}',
        to_jsonb(target_food_tasting_preference),
        true
      ),
      selected_provider_snapshot = coalesce(selection.selected_provider_snapshot, '{}'::jsonb)
        || jsonb_build_object('foodTastingPreference', target_food_tasting_preference),
      updated_at = now()
  where selection.id = selection_id
    and selection.client_id = auth.uid();

  if not found then
    raise exception 'The catering selection could not be updated.' using errcode = '42501';
  end if;

  return result || jsonb_build_object('foodTastingPreference', target_food_tasting_preference);
end;
$$;

-- V14 creates booking requests from selection snapshots. Copy only the new
-- preference during that existing insert path, keeping historic bookings and
-- all booking/payment calculations untouched.
create or replace function public.sync_v15_booking_food_tasting_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.food_tasting_preference is null
    and jsonb_typeof(new.catering_option_snapshot) = 'object'
    and jsonb_typeof(new.catering_option_snapshot -> 'foodTastingPreference') = 'boolean' then
    new.food_tasting_preference := (new.catering_option_snapshot ->> 'foodTastingPreference')::boolean;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_v15_booking_food_tasting_preference_trigger on public.bookings;
create trigger sync_v15_booking_food_tasting_preference_trigger
before insert or update of catering_option_snapshot on public.bookings
for each row execute function public.sync_v15_booking_food_tasting_preference();

revoke all on function public.save_my_catering_service_selection_v15(
  uuid, uuid, integer, text, uuid, jsonb, boolean, text, text, boolean
) from public;
grant execute on function public.save_my_catering_service_selection_v15(
  uuid, uuid, integer, text, uuid, jsonb, boolean, text, text, boolean
) to authenticated;
revoke all on function public.sync_v15_booking_food_tasting_preference() from public;

comment on column public.event_service_selections.food_tasting_preference is
  'Explicit V15 client choice. Null is retained only for historical selections.';
comment on column public.bookings.food_tasting_preference is
  'Snapshot of the V15 catering tasting choice for a booking request.';
comment on function public.save_my_catering_service_selection_v15(
  uuid, uuid, integer, text, uuid, jsonb, boolean, text, text, boolean
) is 'Saves an explicit client food-tasting preference while reusing the existing authoritative catering quote and selection flow.';

commit;
