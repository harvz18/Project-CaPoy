-- MULTIVENT Revision V18, Phase 8: server-owned Photo/Video selections.
-- This extends the established V14 request-before-payment flow; it neither
-- reserves availability nor creates a payment.
begin;

alter table public.event_service_selections
  add column if not exists photo_video_selection_snapshot jsonb not null default '{}'::jsonb;
alter table public.bookings
  add column if not exists photo_video_selection_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_photo_video_selection_snapshot_object_check,
  add constraint event_service_selections_photo_video_selection_snapshot_object_check
    check (jsonb_typeof(photo_video_selection_snapshot) = 'object');
alter table public.bookings
  drop constraint if exists bookings_photo_video_selection_snapshot_object_check,
  add constraint bookings_photo_video_selection_snapshot_object_check
    check (jsonb_typeof(photo_video_selection_snapshot) = 'object');

create or replace function public.calculate_my_photo_video_service_quote_v18(
  target_event_id uuid,
  target_service_id uuid,
  target_selection jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  service_row record;
  package_row record;
  details jsonb;
  package_config jsonb := '{}'::jsonb;
  coverage jsonb;
  config_item jsonb;
  selection_item jsonb;
  deliverable jsonb;
  rush_option jsonb;
  resolved_deliverables jsonb := '[]'::jsonb;
  resolved_crew jsonb := '[]'::jsonb;
  resolved_services jsonb := '[]'::jsonb;
  resolved_rush jsonb := '[]'::jsonb;
  selected_deliverable_ids text[] := '{}'::text[];
  package_deliverable_ids text[] := '{}'::text[];
  selected_crew_ids text[] := '{}'::text[];
  selected_service_ids text[] := '{}'::text[];
  selected_rush_ids text[] := '{}'::text[];
  coverage_hours numeric := 0;
  provider_total numeric(12,2) := 0;
  commission_rate numeric := public.get_public_commission_rate();
  quantity integer;
  additional_count integer := 0;
  crew_count integer := 0;
  selection_method text;
  requested_media_type text;
  selected_id text;
  schedule_summary text;
  location_summary text;
  event_type_supported boolean;
begin
  if auth.uid() is null then raise exception 'You must be signed in to price a Photo/Video service.' using errcode = '42501'; end if;
  if jsonb_typeof(target_selection) <> 'object'
    or coalesce((target_selection ->> 'schemaVersion')::integer, 0) <> 1
    or coalesce(target_selection ->> 'selectionMethod', '') not in ('custom', 'package')
    or jsonb_typeof(coalesce(target_selection -> 'additionalCrew', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(target_selection -> 'deliverables', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(target_selection -> 'additionalServices', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(target_selection -> 'coverageLocations', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(target_selection -> 'rushEditingOptionIds', '[]'::jsonb)) <> 'array'
  then raise exception 'The Photo/Video selection is invalid.'; end if;

  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select service.id, service.provider_id, service.name, service.category_details,
    lower(category.name) as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id and service.status = 'active' and service.is_available = true
    and lower(category.name) like '%photo%' and owner.account_status in ('active', 'verified');
  if service_row.id is null then raise exception 'This Photo/Video service is no longer available.'; end if;
  details := service_row.category_details;
  if jsonb_typeof(details -> 'coverageConfigurations') <> 'array'
    or jsonb_typeof(details -> 'deliverableConfigurations') <> 'array'
    or nullif(details ->> 'photoVideoServiceType', '') is null
  then raise exception 'This provider has not completed its Photo/Video configuration.'; end if;

  requested_media_type := nullif(target_selection ->> 'requestedMediaType', '');
  if requested_media_type is not null and requested_media_type not in ('photo', 'video', 'combined') then
    raise exception 'The requested Photo/Video media type is invalid.';
  end if;
  if (details ->> 'photoVideoServiceType' = 'photography' and requested_media_type in ('video', 'combined'))
    or (details ->> 'photoVideoServiceType' = 'videography' and requested_media_type in ('photo', 'combined'))
  then raise exception 'The requested media type is not offered by this provider.'; end if;

  selection_method := target_selection ->> 'selectionMethod';
  if selection_method = 'package' then
    if nullif(target_selection ->> 'packageId', '') is null then raise exception 'Choose an available Photo/Video package.'; end if;
    select package.id, package.name, package.price, package.configuration
    into package_row from public.service_packages package
    where package.id = (target_selection ->> 'packageId')::uuid and package.service_id = service_row.id
      and package.is_active and package.is_deleted = false
      and coalesce(package.configuration ->> 'kind', '') = 'photo_video';
    if package_row.id is null or package_row.price <= 0 then raise exception 'The selected Photo/Video package is unavailable.'; end if;
    package_config := package_row.configuration;
    select exists(select 1 from jsonb_array_elements_text(package_config -> 'eventTypes') item
      where lower(item) = lower(coalesce(event_row.event_type, ''))) into event_type_supported;
    if not event_type_supported then raise exception 'This Photo/Video package is not offered for this event type.'; end if;
    select item.value into coverage from jsonb_array_elements(details -> 'coverageConfigurations') item(value)
    where item.value ->> 'id' = package_config ->> 'coverageConfigurationId';
    if coverage is null then raise exception 'The selected package coverage is unavailable.'; end if;
    provider_total := package_row.price;
    select coalesce(array_agg(item), '{}'::text[]) into package_deliverable_ids
    from jsonb_array_elements_text(package_config -> 'deliverableIds') item;
  else
    select item.value into coverage from jsonb_array_elements(details -> 'coverageConfigurations') item(value)
    where item.value ->> 'id' = nullif(target_selection ->> 'coverageConfigurationId', '');
    if coverage is null then raise exception 'Choose an available Photo/Video coverage option.'; end if;
    if jsonb_array_length(target_selection -> 'deliverables') = 0 then
      raise exception 'Choose at least one promised Photo/Video deliverable.';
    end if;
    provider_total := coalesce((coverage ->> 'price')::numeric, 0);
  end if;
  coverage_hours := coalesce((coverage ->> 'durationHours')::numeric, 0);
  if coverage_hours <= 0 then raise exception 'The selected coverage has an invalid duration.'; end if;

  -- Package deliverables are captured even when the client selects no extras.
  foreach selected_id in array package_deliverable_ids loop
    select item.value into deliverable from jsonb_array_elements(details -> 'deliverableConfigurations') item(value)
    where item.value ->> 'id' = selected_id;
    if deliverable is null then raise exception 'A package deliverable is no longer available.'; end if;
    quantity := greatest(1, coalesce(nullif(deliverable ->> 'includedQuantity', '')::integer, 1));
    resolved_deliverables := resolved_deliverables || jsonb_build_array(deliverable || jsonb_build_object(
      'quantity', quantity, 'includedInPackage', true,
      'expectedDeadlineDate', case when details #>> '{postProductionSettings,deadlineStartingPoint}' = 'event_completion'
        and event_row.event_date is not null then to_char(event_row.event_date + coalesce((deliverable ->> 'turnaroundDays')::integer, 0), 'YYYY-MM-DD') else null end));
    selected_deliverable_ids := array_append(selected_deliverable_ids, selected_id);
  end loop;

  for selection_item in select value from jsonb_array_elements(target_selection -> 'deliverables') loop
    selected_id := nullif(selection_item ->> 'deliverableId', '');
    quantity := coalesce(nullif(selection_item ->> 'quantity', '')::integer, 0);
    if selected_id is null or quantity < 1 or selected_id = any(selected_deliverable_ids) then
      raise exception 'Every additional Photo/Video deliverable must be selected once with a positive quantity.';
    end if;
    select item.value into deliverable from jsonb_array_elements(details -> 'deliverableConfigurations') item(value)
    where item.value ->> 'id' = selected_id;
    if deliverable is null or (coalesce((deliverable ->> 'maximumQuantity')::integer, 0) > 0
      and quantity > (deliverable ->> 'maximumQuantity')::integer) then raise exception 'A selected Photo/Video deliverable is unavailable or exceeds its limit.'; end if;
    if selection_method = 'package' then
      additional_count := additional_count + 1;
      if additional_count > coalesce((package_config ->> 'maximumAdditionalDeliverables')::integer, 0) then
        raise exception 'This package allows fewer additional deliverables.';
      end if;
    end if;
    provider_total := provider_total + case deliverable ->> 'pricingMode'
      when 'per_hour' then coalesce((deliverable ->> 'price')::numeric, 0) * coverage_hours * quantity
      when 'included' then 0 else coalesce((deliverable ->> 'price')::numeric, 0) * quantity end;
    resolved_deliverables := resolved_deliverables || jsonb_build_array(deliverable || jsonb_build_object(
      'quantity', quantity, 'includedInPackage', false,
      'expectedDeadlineDate', case when details #>> '{postProductionSettings,deadlineStartingPoint}' = 'event_completion'
        and event_row.event_date is not null then to_char(event_row.event_date + coalesce((deliverable ->> 'turnaroundDays')::integer, 0), 'YYYY-MM-DD') else null end));
    selected_deliverable_ids := array_append(selected_deliverable_ids, selected_id);
  end loop;

  for selection_item in select value from jsonb_array_elements(target_selection -> 'additionalCrew') loop
    selected_id := nullif(selection_item ->> 'optionId', ''); quantity := coalesce(nullif(selection_item ->> 'quantity', '')::integer, 0);
    if selected_id is null or quantity < 1 or selected_id = any(selected_crew_ids) then raise exception 'Each additional crew option needs a positive quantity.'; end if;
    select item.value into config_item from jsonb_array_elements(coalesce(details -> 'additionalCrewOptions', '[]'::jsonb)) item(value)
    where item.value ->> 'id' = selected_id;
    if config_item is null or quantity > coalesce((config_item ->> 'maximumQuantity')::integer, 0)
      or (selection_method = 'package' and not selected_id = any(coalesce(array(select jsonb_array_elements_text(package_config -> 'allowedAdditionalCrewOptionIds')), '{}'::text[])))
    then raise exception 'A selected additional crew option is unavailable.'; end if;
    crew_count := crew_count + quantity;
    if selection_method = 'package' and crew_count > coalesce((package_config ->> 'maximumAdditionalCrew')::integer, 0) then raise exception 'This package allows fewer additional crew members.'; end if;
    provider_total := provider_total + coalesce((config_item ->> 'price')::numeric, 0) * quantity
      * case when config_item ->> 'pricingUnit' = 'hour' then coverage_hours else 1 end;
    resolved_crew := resolved_crew || jsonb_build_array(config_item || jsonb_build_object('quantity', quantity));
    selected_crew_ids := array_append(selected_crew_ids, selected_id);
  end loop;

  for selection_item in select value from jsonb_array_elements(target_selection -> 'additionalServices') loop
    selected_id := nullif(selection_item ->> 'serviceId', ''); quantity := coalesce(nullif(selection_item ->> 'quantity', '')::integer, 0);
    if selected_id is null or quantity < 1 or selected_id = any(selected_service_ids) then raise exception 'Each additional service needs a positive quantity.'; end if;
    select item.value into config_item from jsonb_array_elements(coalesce(details -> 'additionalServices', '[]'::jsonb)) item(value)
    where item.value ->> 'id' = selected_id;
    if config_item is null or (coalesce((config_item ->> 'maximumQuantity')::integer, 0) > 0 and quantity > (config_item ->> 'maximumQuantity')::integer)
      or (selection_method = 'package' and not selected_id = any(coalesce(array(select jsonb_array_elements_text(package_config -> 'allowedAdditionalServiceIds')), '{}'::text[])))
    then raise exception 'A selected additional service is unavailable.'; end if;
    provider_total := provider_total + coalesce((config_item ->> 'price')::numeric, 0)
      * case when config_item ->> 'pricingUnit' = 'hour' then coverage_hours else quantity end;
    resolved_services := resolved_services || jsonb_build_array(config_item || jsonb_build_object('quantity', quantity));
    selected_service_ids := array_append(selected_service_ids, selected_id);
  end loop;

  quantity := coalesce(nullif(target_selection ->> 'additionalHours', '')::integer, 0);
  if quantity < 0 or (quantity > 0 and (coalesce((details ->> 'additionalHoursAllowed')::boolean, false) is not true
    or quantity > coalesce((details ->> 'maximumAdditionalHours')::integer, 0)
    or (selection_method = 'package' and quantity > coalesce((package_config ->> 'maximumCoverageExtensionHours')::integer, 0)))) then
    raise exception 'The requested additional coverage hours are unavailable.';
  end if;
  provider_total := provider_total + quantity * coalesce((details ->> 'additionalHourRate')::numeric, 0);

  if exists(select 1 from jsonb_array_elements(target_selection -> 'coverageLocations') item where jsonb_typeof(item.value) <> 'string' or nullif(trim(item.value #>> '{}'), '') is null)
    or (jsonb_array_length(target_selection -> 'coverageLocations') > 1 and coalesce((details ->> 'allowsMultipleLocations')::boolean, false) is not true)
    or (selection_method = 'package' and jsonb_array_length(target_selection -> 'coverageLocations') > coalesce((package_config ->> 'includedLocationCount')::integer, 1) and coalesce((details ->> 'allowsMultipleLocations')::boolean, false) is not true)
  then raise exception 'The requested coverage locations are unavailable.'; end if;
  provider_total := provider_total + greatest(0, jsonb_array_length(target_selection -> 'coverageLocations') - 1) * coalesce((details ->> 'additionalLocationFee')::numeric, 0);
  select string_agg(trim(item #>> '{}'), ', ') into location_summary from jsonb_array_elements(target_selection -> 'coverageLocations') item;

  for selection_item in select value from jsonb_array_elements(target_selection -> 'rushEditingOptionIds') loop
    selected_id := trim(selection_item #>> '{}');
    if selected_id = '' or selected_id = any(selected_rush_ids) then raise exception 'Each rush editing option can only be selected once.'; end if;
    select item.value into rush_option from jsonb_array_elements(coalesce(details #> '{postProductionSettings,rushEditingOptions}', '[]'::jsonb)) item(value)
    where item.value ->> 'id' = selected_id and coalesce((item.value ->> 'isAvailable')::boolean, true);
    if rush_option is null or not exists(select 1 from jsonb_array_elements_text(rush_option -> 'deliverableIds') item where item = any(selected_deliverable_ids)) then
      raise exception 'A selected rush editing option is unavailable for these deliverables.';
    end if;
    provider_total := provider_total + coalesce((rush_option ->> 'additionalCharge')::numeric, 0);
    resolved_rush := resolved_rush || jsonb_build_array(rush_option);
    selected_rush_ids := array_append(selected_rush_ids, selected_id);
  end loop;

  schedule_summary := concat_ws(', ', nullif(target_selection #>> '{coverageSchedule,preparation}', '')::text,
    nullif(target_selection #>> '{coverageSchedule,ceremony}', '')::text,
    nullif(target_selection #>> '{coverageSchedule,reception}', '')::text,
    nullif(target_selection #>> '{coverageSchedule,coverageStart}', '')::text,
    nullif(target_selection #>> '{coverageSchedule,coverageEnd}', '')::text);
  provider_total := round(provider_total, 2);
  if provider_total <= 0 then raise exception 'The Photo/Video selection needs a positive provider total.'; end if;
  return jsonb_build_object('providerAmount', provider_total, 'customerAmount', round(provider_total * (1 + commission_rate), 2),
    'commissionRate', commission_rate, 'platformFee', round(provider_total * commission_rate, 2),
    'selectionSnapshot', jsonb_build_object('schemaVersion', 1, 'selectionMethod', selection_method,
      'packageId', case when selection_method = 'package' then package_row.id else null end,
      'packageName', case when selection_method = 'package' then package_row.name else null end,
      'requestedMediaType', requested_media_type, 'coverageId', coverage ->> 'id', 'coverageName', coverage ->> 'name',
      'coverageHours', coverage_hours, 'includedCrew', coalesce(coverage -> 'includedCrew', '[]'::jsonb),
      'additionalCrew', resolved_crew, 'deliverables', resolved_deliverables, 'additionalServices', resolved_services,
      'additionalHours', quantity, 'coverageLocations', target_selection -> 'coverageLocations', 'coverageLocationsSummary', coalesce(location_summary, ''),
      'coverageSchedule', coalesce(target_selection -> 'coverageSchedule', '{}'::jsonb), 'coverageScheduleSummary', coalesce(schedule_summary, ''),
      'rushEditing', resolved_rush, 'rushEditingSummary', coalesce((select string_agg(item.value ->> 'name', ', ') from jsonb_array_elements(resolved_rush) item(value)), ''),
      'deliveryMethods', coalesce(details #> '{postProductionSettings,deliveryMethods}', '[]'::jsonb),
      'deliverySummary', coalesce((select string_agg(item.value ->> 'kind', ', ') from jsonb_array_elements(coalesce(details #> '{postProductionSettings,deliveryMethods}', '[]'::jsonb)) item(value)), ''),
      'revisionPolicy', coalesce(details #> '{postProductionSettings,revisionPolicy}', '{}'::jsonb),
      'revisionSummary', coalesce(details #>> '{postProductionSettings,revisionPolicy,includedRevisionRounds}', '0') || ' included round(s)',
      'providerBaseTotal', provider_total, 'marketplaceTotal', round(provider_total * (1 + commission_rate), 2), 'commissionRate', commission_rate));
end;
$$;

create or replace function public.save_my_photo_video_service_selection_v18(
  target_event_id uuid, target_service_id uuid, target_selection jsonb,
  target_notes text default null, replace_existing boolean default false
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pricing jsonb; generic_result jsonb; selection_id uuid; package_id uuid; event_total numeric(12,2); other_allocations numeric(12,2);
begin
  pricing := public.calculate_my_photo_video_service_quote_v18(target_event_id, target_service_id, target_selection);
  package_id := case when target_selection ->> 'selectionMethod' = 'package' then nullif(target_selection ->> 'packageId', '')::uuid else null end;
  generic_result := public.save_my_event_service_selection(target_event_id, target_service_id, package_id, null, null, null, target_notes, replace_existing);
  selection_id := (generic_result ->> 'selectionId')::uuid;
  select total_budget into event_total from public.events where id = target_event_id and client_id = auth.uid();
  if coalesce(event_total, 0) > 0 then
    select coalesce(sum(item.allocated_amount), 0) into other_allocations from public.event_budget_items item
    where item.event_id = target_event_id and item.allocation_version = 'phase7-v1' and item.category_key <> 'photoVideo';
    if other_allocations + (pricing ->> 'customerAmount')::numeric > event_total then raise exception 'The selected Photo/Video service exceeds the remaining event budget.'; end if;
  end if;
  update public.event_service_selections set estimated_amount = (pricing ->> 'customerAmount')::numeric,
    notes = coalesce(target_notes, notes), photo_video_selection_snapshot = pricing -> 'selectionSnapshot',
    selected_provider_snapshot = coalesce(selected_provider_snapshot, '{}'::jsonb) || jsonb_build_object('providerAmount', (pricing ->> 'providerAmount')::numeric, 'commissionAmount', (pricing ->> 'platformFee')::numeric, 'commissionRate', (pricing ->> 'commissionRate')::numeric, 'pricingVersion', 'v18-photo-video-v1'), updated_at = now()
  where id = selection_id;
  perform set_config('app.phase9_budget_lock_authorized', 'true', true);
  update public.event_budget_items set allocated_amount = (pricing ->> 'customerAmount')::numeric, estimated_amount = (pricing ->> 'customerAmount')::numeric
  where event_id = target_event_id and category_key = 'photoVideo' and allocation_version = 'phase7-v1' and locked_selection_id = selection_id;
  return pricing || jsonb_build_object('selectionId', selection_id, 'replacedSelectionId', generic_result -> 'replacedSelectionId');
end;
$$;

create or replace function public.capture_v18_photo_video_booking_selection_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.photo_video_selection_snapshot, '{}'::jsonb) <> '{}'::jsonb then return new; end if;
  select selection.photo_video_selection_snapshot into new.photo_video_selection_snapshot
  from public.event_service_selections selection
  where selection.event_id = new.event_id and selection.service_id = new.service_id and selection.status not in ('declined', 'cancelled')
  order by selection.updated_at desc limit 1;
  new.photo_video_selection_snapshot := coalesce(new.photo_video_selection_snapshot, '{}'::jsonb);
  return new;
end;
$$;
drop trigger if exists zz_capture_v18_photo_video_booking_selection_snapshot_trigger on public.bookings;
create trigger zz_capture_v18_photo_video_booking_selection_snapshot_trigger before insert on public.bookings
for each row execute function public.capture_v18_photo_video_booking_selection_snapshot();

grant execute on function public.calculate_my_photo_video_service_quote_v18(uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_my_photo_video_service_selection_v18(uuid, uuid, jsonb, text, boolean) to authenticated;
revoke all on function public.calculate_my_photo_video_service_quote_v18(uuid, uuid, jsonb) from anon;
revoke all on function public.save_my_photo_video_service_selection_v18(uuid, uuid, jsonb, text, boolean) from anon;
revoke all on function public.capture_v18_photo_video_booking_selection_snapshot() from public;
commit;
