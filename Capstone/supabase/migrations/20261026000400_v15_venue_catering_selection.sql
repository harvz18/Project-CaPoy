-- V15 Phase 7 client selection paths. A combined package is represented by
-- one venue-hosted selection and one provider request, never two bookings.

begin;

alter table public.catering_food_tasting_workflows
  add column if not exists combined_package_id uuid references public.service_packages(id) on delete restrict;

create or replace function public.v15_combined_package_context(
  target_event_id uuid,
  target_package_id uuid
)
returns table (
  venue_service_id uuid,
  catering_service_id uuid,
  provider_id uuid,
  client_id uuid,
  guest_count integer,
  package_quote jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  detail_row public.venue_catering_package_details%rowtype;
  quote jsonb;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;
  select * into detail_row from public.venue_catering_package_details detail
  join public.service_packages package on package.id = detail.package_id
  where detail.package_id = target_package_id and package.is_active = true
    and coalesce(package.is_deleted, false) = false;
  if detail_row.package_id is null then raise exception 'Venue + Catering package not found.' using errcode = '22023'; end if;
  select public.calculate_event_service_quote(
    detail_row.venue_service_id, target_event_id, null, null, target_package_id
  ) into quote;
  venue_service_id := detail_row.venue_service_id;
  catering_service_id := detail_row.catering_service_id;
  select venue.provider_id into provider_id from public.services venue where venue.id = detail_row.venue_service_id;
  client_id := event_row.client_id;
  guest_count := greatest(coalesce(event_row.guest_count, 0), 1);
  package_quote := quote;
  return next;
end;
$$;

create or replace function public.save_my_v15_venue_catering_package_selection(
  target_event_id uuid,
  target_package_id uuid,
  target_guest_count integer,
  target_option_id text default null,
  target_menu_item_ids jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_row record;
  menu_quote jsonb;
  selection_result jsonb;
  selection_id uuid;
  final_menu jsonb;
begin
  select * into context_row from public.v15_combined_package_context(target_event_id, target_package_id);
  if context_row.venue_service_id is null then raise exception 'Venue + Catering package not found.'; end if;
  if target_guest_count <> context_row.guest_count then
    raise exception 'Use the event guest count for this Venue + Catering package.' using errcode = '22023';
  end if;
  menu_quote := case when target_menu_item_ids is not null
    then public.calculate_catering_menu_quote_v10(context_row.catering_service_id, target_event_id, target_menu_item_ids, target_guest_count)
    else public.calculate_catering_service_quote_v10(context_row.catering_service_id, target_event_id, target_guest_count, target_option_id, null)
  end;
  selection_result := public.save_my_event_service_selection(
    target_event_id, context_row.venue_service_id, target_package_id, null, null, null, null, true
  );
  selection_id := nullif(selection_result ->> 'selectionId', '')::uuid;
  if selection_id is null then raise exception 'The Venue + Catering package could not be saved.'; end if;
  final_menu := public.v15_direct_catering_final_menu_snapshot(
    menu_quote -> 'cateringOption', menu_quote -> 'cateringOption' ->> 'name', target_guest_count
  ) || jsonb_build_object('source', 'venue_catering_package', 'packageId', target_package_id);
  update public.event_service_selections selection set
    attendee_count = target_guest_count,
    catering_option_id = menu_quote -> 'cateringOption' ->> 'id',
    catering_option_name = menu_quote -> 'cateringOption' ->> 'name',
    catering_option_snapshot = menu_quote -> 'cateringOption',
    final_menu_snapshot = final_menu,
    package_snapshot = coalesce(selection.package_snapshot, '{}'::jsonb)
      || jsonb_build_object('venueCateringPackage', true, 'cateringServiceId', context_row.catering_service_id),
    updated_at = now()
  where selection.id = selection_id and selection.client_id = auth.uid();
  return selection_result || jsonb_build_object(
    'selectionId', selection_id,
    'customerAmount', context_row.package_quote -> 'customerAmount',
    'providerAmount', context_row.package_quote -> 'providerAmount'
  );
end;
$$;

create or replace function public.submit_my_v15_venue_catering_food_tasting_request(
  target_event_id uuid,
  target_package_id uuid,
  target_guest_count integer,
  target_menu_item_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  context_row record;
  preliminary jsonb;
  selection_result jsonb;
  selection_id uuid;
  booking_id uuid;
  provider_user_id uuid;
begin
  select * into context_row from public.v15_combined_package_context(target_event_id, target_package_id);
  if context_row.venue_service_id is null then raise exception 'Venue + Catering package not found.'; end if;
  if target_guest_count <> context_row.guest_count then
    raise exception 'Use the event guest count for this Venue + Catering package.' using errcode = '22023';
  end if;
  preliminary := public.build_v15_preliminary_tasting_menu(
    target_event_id, context_row.catering_service_id, target_guest_count, target_menu_item_ids
  );
  if not coalesce((preliminary ->> 'isComplete')::boolean, false) then
    raise exception 'Complete every food tasting course before sending this request.' using errcode = '22023';
  end if;
  selection_result := public.save_my_event_service_selection(
    target_event_id, context_row.venue_service_id, target_package_id, null, null, null, null, true
  );
  selection_id := nullif(selection_result ->> 'selectionId', '')::uuid;
  if selection_id is null then raise exception 'The Venue + Catering package could not be saved.'; end if;
  update public.event_service_selections selection set
    estimated_amount = 0, budget_per_head = null, attendee_count = target_guest_count,
    food_tasting_preference = true, catering_option_id = 'food-tasting-pending',
    catering_option_name = 'Food tasting menu pending',
    catering_option_snapshot = jsonb_build_object('foodTastingPreference', true, 'finalPricePending', true, 'preliminaryTastingMenu', preliminary, 'combinedPackageId', target_package_id),
    final_menu_snapshot = null,
    selected_provider_snapshot = coalesce(selection.selected_provider_snapshot, '{}'::jsonb)
      || jsonb_build_object('providerAmount', 0, 'finalPricePending', true, 'venueCateringPackage', true),
    package_snapshot = coalesce(selection.package_snapshot, '{}'::jsonb)
      || jsonb_build_object('venueCateringPackage', true, 'cateringServiceId', context_row.catering_service_id),
    status = 'requested', updated_at = now()
  where selection.id = selection_id;
  insert into public.bookings (
    amount, provider_amount, commission_amount, commission_model, commission_rate,
    event_id, client_id, provider_id, service_id, package_id, requested_date, requested_time,
    status, food_tasting_preference, catering_option_id, catering_option_name, catering_option_snapshot
  )
  select 0, 0, 0, 'added_to_customer', public.get_public_commission_rate(),
    target_event_id, context_row.client_id, context_row.provider_id, context_row.venue_service_id,
    target_package_id, event.event_date, event.event_time, 'requested', true,
    'food-tasting-pending', 'Food tasting menu pending',
    jsonb_build_object('foodTastingPreference', true, 'finalPricePending', true, 'preliminaryTastingMenu', preliminary, 'combinedPackageId', target_package_id)
  from public.events event where event.id = target_event_id
  returning id into booking_id;
  insert into public.catering_food_tasting_workflows (
    booking_id, event_id, client_id, provider_id, service_id, combined_package_id,
    preliminary_menu, guest_count, status
  ) values (
    booking_id, target_event_id, context_row.client_id, context_row.provider_id,
    context_row.venue_service_id, target_package_id, preliminary, target_guest_count,
    'awaiting_provider_acceptance'
  );
  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = context_row.provider_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (provider_user_id, 'Venue + Catering food tasting request',
    'Review the combined package and the client''s preliminary tasting menu.', 'booking', booking_id);
  return jsonb_build_object('bookingId', booking_id, 'selectionId', selection_id);
end;
$$;

-- Phase 5 normally prices final tasting dishes. A combined package is fixed
-- inclusive: keep its one captured package total while preserving the chosen
-- final dishes and revision history for what will be served.
create or replace function public.sync_v15_combined_package_final_menu_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  provider_amount_value numeric(12,2);
  customer_amount_value numeric(12,2);
begin
  if new.status <> 'client_confirmation_required' or new.combined_package_id is null then return new; end if;
  select selection.package_snapshot, coalesce(selection.selected_provider_snapshot ->> 'providerAmount', '0')::numeric,
    selection.estimated_amount into snapshot, provider_amount_value, customer_amount_value
  from public.event_service_selections selection
  where selection.event_id = new.event_id and selection.service_id = new.service_id
    and selection.client_id = new.client_id and selection.package_id = new.combined_package_id
  order by selection.updated_at desc limit 1;
  if snapshot is null then return new; end if;
  provider_amount_value := coalesce(nullif(snapshot ->> 'providerAmount', '')::numeric, provider_amount_value, 0);
  customer_amount_value := coalesce(nullif(snapshot ->> 'customerAmount', '')::numeric, customer_amount_value, 0);
  if provider_amount_value <= 0 or customer_amount_value <= 0 then return new; end if;
  update public.catering_food_tasting_menu_revisions set
    provider_unit_price = provider_amount_value, provider_amount = provider_amount_value,
    customer_amount = customer_amount_value, commission_rate = public.get_public_commission_rate()
  where booking_id = new.booking_id and revision = new.final_menu_revision;
  update public.bookings set amount = customer_amount_value, provider_amount = provider_amount_value,
    commission_amount = round(customer_amount_value - provider_amount_value, 2), updated_at = now()
  where id = new.booking_id;
  update public.event_service_selections set estimated_amount = customer_amount_value,
    budget_per_head = round(customer_amount_value / greatest(new.guest_count, 1), 2),
    selected_provider_snapshot = coalesce(selected_provider_snapshot, '{}'::jsonb)
      || jsonb_build_object('providerAmount', provider_amount_value, 'finalPricePending', false), updated_at = now()
  where event_id = new.event_id and service_id = new.service_id and client_id = new.client_id
    and package_id = new.combined_package_id and status not in ('declined', 'cancelled');
  new.final_menu_provider_unit_price := provider_amount_value;
  new.final_menu_provider_amount := provider_amount_value;
  new.final_menu_customer_amount := customer_amount_value;
  return new;
end;
$$;

drop trigger if exists sync_v15_combined_package_final_menu_price_trigger on public.catering_food_tasting_workflows;
create trigger sync_v15_combined_package_final_menu_price_trigger
before update of status, final_menu, final_menu_revision on public.catering_food_tasting_workflows
for each row execute function public.sync_v15_combined_package_final_menu_price();

revoke all on function public.v15_combined_package_context(uuid, uuid) from public;
revoke all on function public.save_my_v15_venue_catering_package_selection(uuid, uuid, integer, text, jsonb) from public;
revoke all on function public.submit_my_v15_venue_catering_food_tasting_request(uuid, uuid, integer, jsonb) from public;
revoke all on function public.sync_v15_combined_package_final_menu_price() from public;
grant execute on function public.save_my_v15_venue_catering_package_selection(uuid, uuid, integer, text, jsonb) to authenticated;
grant execute on function public.submit_my_v15_venue_catering_food_tasting_request(uuid, uuid, integer, jsonb) to authenticated;

comment on function public.save_my_v15_venue_catering_package_selection(uuid, uuid, integer, text, jsonb) is
  'Saves a direct-menu Venue + Catering package as one fixed-inclusive venue-hosted selection.';
commit;
