-- MULTIVENT Revision 9, Phase 9: completed plans saved before checkout.
-- A saved plan deliberately remains an unbooked planning event. Its existing
-- selections hold the exact catering and venue configuration; this migration
-- adds only save metadata and secure review/save operations.

begin;

alter table public.events
  add column if not exists saved_plan_at timestamptz,
  add column if not exists saved_plan_estimated_total numeric(12, 2),
  add column if not exists saved_plan_selection_count integer;

alter table public.events
  drop constraint if exists events_saved_plan_estimated_total_check,
  add constraint events_saved_plan_estimated_total_check
    check (saved_plan_estimated_total is null or saved_plan_estimated_total >= 0),
  drop constraint if exists events_saved_plan_selection_count_check,
  add constraint events_saved_plan_selection_count_check
    check (saved_plan_selection_count is null or saved_plan_selection_count >= 0);

create index if not exists events_client_saved_plan_idx
  on public.events (client_id, saved_plan_at desc)
  where saved_plan_at is not null and status in ('draft', 'planning');

-- Rechecks a saved plan without altering its persisted snapshots. This lets
-- the client see a provider's current price or availability before checkout,
-- while preserving the original saved estimate for comparison.
create or replace function public.review_my_saved_booking_plan(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  selection_row record;
  quote jsonb;
  custom_menu_item_ids jsonb;
  venue_inputs jsonb;
  review_items jsonb := '[]'::jsonb;
  saved_total numeric(12,2) := 0;
  current_total numeric(12,2) := 0;
  saved_amount numeric(12,2);
  current_amount numeric(12,2);
  has_price_changes boolean := false;
  has_unavailable_services boolean := false;
  coordinator_user_id uuid;
  coordinator_name text;
  coordinator_is_available boolean := true;
  coordinator_amount numeric(12,2) := 0;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status in ('draft', 'planning')
    and event.saved_plan_at is not null;
  if event_row.id is null then
    raise exception 'Saved plan not found.' using errcode = '42501';
  end if;

  saved_total := coalesce(event_row.saved_plan_estimated_total, 0);

  for selection_row in
    select selection.id, selection.service_id, selection.service_name,
      selection.category_name, selection.category_key,
      selection.estimated_amount, selection.package_id,
      selection.catering_option_id, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_booked_hours,
      selection.venue_options_snapshot
    from public.event_service_selections selection
    where selection.event_id = event_row.id
      and selection.client_id = auth.uid()
      and selection.status = 'selected'
  loop
    saved_amount := round(coalesce(selection_row.estimated_amount, 0), 2);
    begin
      if selection_row.category_key = 'catering'
        and selection_row.catering_option_id = 'custom-menu' then
        select coalesce(jsonb_agg(item.value ->> 'id'), '[]'::jsonb)
        into custom_menu_item_ids
        from jsonb_array_elements(
          coalesce(selection_row.catering_option_snapshot -> 'selectedItems', '[]'::jsonb)
        ) item(value);
        quote := public.calculate_catering_menu_quote(
          selection_row.service_id, event_row.id, custom_menu_item_ids
        );
      elsif selection_row.category_key = 'venue'
        and jsonb_typeof(selection_row.venue_options_snapshot) = 'array'
        and jsonb_array_length(selection_row.venue_options_snapshot) > 0 then
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'optionId', item.value ->> 'id',
          'bookedHours', case when coalesce(item.value ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (item.value ->> 'selectedDurationHours')::numeric else null end
        )))
        into venue_inputs
        from jsonb_array_elements(selection_row.venue_options_snapshot) item(value);
        quote := public.calculate_event_venue_quote_v8(
          selection_row.service_id, event_row.id, coalesce(venue_inputs, '[]'::jsonb)
        );
      else
        quote := public.calculate_event_service_quote(
          selection_row.service_id,
          event_row.id,
          case when selection_row.category_key = 'venue'
            then selection_row.venue_option_id else selection_row.catering_option_id end,
          selection_row.venue_booked_hours,
          selection_row.package_id
        );
      end if;

      current_amount := round(coalesce((quote ->> 'customerAmount')::numeric, 0), 2);
      current_total := current_total + current_amount;
      if abs(current_amount - saved_amount) > 0.01 then
        has_price_changes := true;
      end if;
      review_items := review_items || jsonb_build_array(jsonb_build_object(
        'available', true,
        'category', coalesce(selection_row.category_name, 'Service'),
        'currentAmount', current_amount,
        'savedAmount', saved_amount,
        'serviceId', selection_row.service_id,
        'serviceName', coalesce(selection_row.service_name, 'Selected service')
      ));
    exception when others then
      has_unavailable_services := true;
      review_items := review_items || jsonb_build_array(jsonb_build_object(
        'available', false,
        'category', coalesce(selection_row.category_name, 'Service'),
        'message', sqlerrm,
        'savedAmount', saved_amount,
        'serviceId', selection_row.service_id,
        'serviceName', coalesce(selection_row.service_name, 'Selected service')
      ));
    end;
  end loop;

  coordinator_user_id := coalesce(event_row.pending_coordinator_id, event_row.coordinator_id);
  if coordinator_user_id is not null and coalesce(event_row.coordinator_fee_amount, 0) > 0 then
    select profile.full_name, profile.account_status in ('active', 'verified')
    into coordinator_name, coordinator_is_available
    from public.profiles profile
    where profile.id = coordinator_user_id;
    coordinator_is_available := coalesce(coordinator_is_available, false);
    coordinator_amount := round(
      event_row.coordinator_fee_amount * (1 + public.get_public_commission_rate()), 2
    );
    current_total := current_total + coordinator_amount;
    if not coordinator_is_available then has_unavailable_services := true; end if;
    review_items := review_items || jsonb_build_array(jsonb_build_object(
      'available', coordinator_is_available,
      'category', 'Event Organizer',
      'currentAmount', coordinator_amount,
      'message', case when coordinator_is_available then null else 'This coordinator is no longer available.' end,
      'savedAmount', coordinator_amount,
      'serviceId', 'coordinator:' || coordinator_user_id::text,
      'serviceName', coalesce(coordinator_name, 'Event Coordinator')
    ));
  end if;

  -- Older saved records will not have an aggregate yet. In that case the
  -- selection-level snapshot remains the authoritative comparison baseline.
  if saved_total <= 0 then
    select coalesce(sum(selection.estimated_amount), 0) into saved_total
    from public.event_service_selections selection
    where selection.event_id = event_row.id and selection.status = 'selected';
    saved_total := saved_total + coordinator_amount;
  end if;

  return jsonb_build_object(
    'currentEstimatedTotal', round(current_total, 2),
    'eventId', event_row.id,
    'hasPriceChanges', has_price_changes or abs(current_total - saved_total) > 0.01,
    'hasUnavailableServices', has_unavailable_services,
    'items', review_items,
    'savedEstimatedTotal', round(saved_total, 2)
  );
end;
$$;

-- Saves only a complete, pre-payment plan. Existing selected-service records
-- already hold menu IDs, venue options/durations, coordinator preference, and
-- budget allocations, so nothing is copied into a second event or booking.
create or replace function public.save_my_booking_plan_for_later(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  selected_service_count integer := 0;
  selected_service_total numeric(12,2) := 0;
  coordinator_amount numeric(12,2) := 0;
  has_coordinator boolean := false;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status in ('draft', 'planning')
  for update;
  if event_row.id is null then
    raise exception 'Only an unbooked event plan can be saved for later.' using errcode = '42501';
  end if;
  if event_row.event_date is null or event_row.event_time is null
    or coalesce(event_row.guest_count, 0) <= 0 then
    raise exception 'Complete the event details before saving this plan.';
  end if;

  perform public.validate_my_phase9_selections(target_event_id);

  if exists (
    select 1
    from public.event_budget_items item
    where item.event_id = event_row.id
      and item.allocation_version = 'phase7-v1'
      and coalesce(item.allocated_amount, 0) > 0
      and item.category_key <> 'eventOrganizer'
      and not exists (
        select 1 from public.event_service_selections selection
        where selection.event_id = event_row.id
          and selection.category_key = item.category_key
          and selection.status = 'selected'
      )
  ) then
    raise exception 'Select a service for every allocated category before saving this plan.';
  end if;

  has_coordinator := coalesce(event_row.wants_coordinator, false)
    and exists (
      select 1 from public.event_budget_items item
      where item.event_id = event_row.id
        and item.allocation_version = 'phase7-v1'
        and item.category_key = 'eventOrganizer'
        and coalesce(item.allocated_amount, 0) > 0
    );
  if has_coordinator
    and coalesce(event_row.pending_coordinator_id, event_row.coordinator_id) is null then
    raise exception 'Select an event coordinator before saving this plan.';
  end if;

  select count(*), coalesce(sum(selection.estimated_amount), 0)
  into selected_service_count, selected_service_total
  from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.status = 'selected';
  if selected_service_count = 0 and not has_coordinator then
    raise exception 'Select at least one service before saving this plan.';
  end if;

  if has_coordinator then
    coordinator_amount := round(
      coalesce(event_row.coordinator_fee_amount, 0) * (1 + public.get_public_commission_rate()), 2
    );
  end if;

  update public.events
  set status = case when status = 'draft' then 'planning' else status end,
      planning_step = greatest(coalesce(planning_step, 1), 5),
      saved_plan_at = now(),
      saved_plan_estimated_total = round(selected_service_total + coordinator_amount, 2),
      saved_plan_selection_count = selected_service_count + case when has_coordinator then 1 else 0 end,
      updated_at = now()
  where id = event_row.id;

  return public.review_my_saved_booking_plan(event_row.id);
end;
$$;

revoke all on function public.review_my_saved_booking_plan(uuid) from public;
revoke all on function public.save_my_booking_plan_for_later(uuid) from public;
grant execute on function public.review_my_saved_booking_plan(uuid) to authenticated;
grant execute on function public.save_my_booking_plan_for_later(uuid) to authenticated;

comment on column public.events.saved_plan_at is
  'Timestamp when a complete, unpaid plan was intentionally saved for later.';
comment on column public.events.saved_plan_estimated_total is
  'Client-facing estimate recorded when the unpaid saved plan was last saved.';

commit;
