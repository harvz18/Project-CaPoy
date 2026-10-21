-- V10 Phase 4 follow-up: saved-plan reviews must use the guest quantity
-- stored with each catering selection, not the event-wide planning estimate.
begin;

create or replace function public.review_my_saved_booking_plan_v9_initial(target_event_id uuid)
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
      selection.attendee_count, selection.catering_option_id,
      selection.catering_option_snapshot, selection.venue_option_id,
      selection.venue_booked_hours, selection.venue_options_snapshot
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
        quote := public.calculate_catering_menu_quote_v10(
          selection_row.service_id,
          event_row.id,
          custom_menu_item_ids,
          greatest(coalesce(selection_row.attendee_count, 0), 1)
        );
      elsif selection_row.category_key = 'catering' then
        quote := public.calculate_catering_service_quote_v10(
          selection_row.service_id,
          event_row.id,
          greatest(coalesce(selection_row.attendee_count, 0), 1),
          selection_row.catering_option_id,
          selection_row.package_id
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

comment on function public.review_my_saved_booking_plan_v9_initial(uuid) is
  'Saved-plan review implementation that preserves each saved catering selection''s service-specific guest count.';

commit;
