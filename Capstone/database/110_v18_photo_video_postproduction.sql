-- MULTIVENT Revision V18, Phase 6: provider-owned post-production
-- commitments. Existing and pre-Phase-6 Photo/Video listings remain valid
-- until their provider opts into the structured configuration.
begin;

create or replace function public.validate_v18_photo_video_postproduction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  settings jsonb;
  deliverable_row jsonb;
  delivery_method jsonb;
  rush_option jsonb;
  revision_policy jsonb;
  deliverable_ids text[];
  method_count integer;
  unique_method_count integer;
  rush_count integer;
  unique_rush_count integer;
  revision_rounds integer;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%photo%'
    or not (new.category_details ? 'postProductionSettings')
    or new.status::text not in ('pending_review', 'active')
  then
    return new;
  end if;

  settings := new.category_details -> 'postProductionSettings';
  if jsonb_typeof(settings) <> 'object' then
    raise exception 'Photo/Video post-production settings must be an object.';
  end if;
  if coalesce(settings ->> 'deadlineStartingPoint', '') not in ('event_completion', 'agreed_custom_start') then
    raise exception 'Choose when Photo/Video post-production turnaround begins.';
  end if;
  if settings ->> 'deadlineStartingPoint' = 'agreed_custom_start'
    and nullif(trim(settings ->> 'startingPointDisclosure'), '') is null
  then
    raise exception 'Explain the agreed alternate post-production starting point.';
  end if;

  if jsonb_typeof(new.category_details -> 'deliverableConfigurations') <> 'array'
    or jsonb_array_length(new.category_details -> 'deliverableConfigurations') = 0
  then
    raise exception 'Photo/Video post-production requires configured deliverables.';
  end if;
  select array_agg(deliverable.value ->> 'id') into deliverable_ids
  from jsonb_array_elements(new.category_details -> 'deliverableConfigurations') deliverable(value);
  for deliverable_row in select value from jsonb_array_elements(new.category_details -> 'deliverableConfigurations')
  loop
    if coalesce(nullif(deliverable_row ->> 'turnaroundDays', '')::numeric, 0) <= 0
      or mod((deliverable_row ->> 'turnaroundDays')::numeric, 1) <> 0
    then
      raise exception 'Every Photo/Video deliverable needs a positive whole-day editing turnaround.';
    end if;
  end loop;

  if jsonb_typeof(settings -> 'deliveryMethods') <> 'array'
    or jsonb_array_length(settings -> 'deliveryMethods') = 0
  then
    raise exception 'Add at least one Photo/Video delivery method.';
  end if;
  select count(*), count(distinct method.value ->> 'id')
  into method_count, unique_method_count
  from jsonb_array_elements(settings -> 'deliveryMethods') method(value);
  if method_count <> unique_method_count then
    raise exception 'Every Photo/Video delivery method needs a unique ID.';
  end if;
  for delivery_method in select value from jsonb_array_elements(settings -> 'deliveryMethods')
  loop
    if nullif(trim(delivery_method ->> 'id'), '') is null
      or coalesce(delivery_method ->> 'kind', '') not in (
        'secure_download_link', 'online_gallery', 'cloud_delivery', 'usb',
        'physical_album_delivery', 'courier_delivery', 'client_pickup'
      )
    then
      raise exception 'A Photo/Video delivery method is incomplete or unsupported.';
    end if;
  end loop;

  if jsonb_typeof(settings -> 'rushEditingOptions') <> 'array' then
    raise exception 'Photo/Video rush editing options must be a list.';
  end if;
  select count(*), count(distinct option.value ->> 'id')
  into rush_count, unique_rush_count
  from jsonb_array_elements(settings -> 'rushEditingOptions') option(value);
  if rush_count <> unique_rush_count then
    raise exception 'Every Photo/Video rush editing option needs a unique ID.';
  end if;
  for rush_option in select value from jsonb_array_elements(settings -> 'rushEditingOptions')
  loop
    if nullif(trim(rush_option ->> 'id'), '') is null
      or jsonb_typeof(rush_option -> 'deliverableIds') <> 'array'
      or jsonb_array_length(rush_option -> 'deliverableIds') = 0
      or coalesce(nullif(rush_option ->> 'turnaroundDays', '')::numeric, 0) <= 0
      or mod((rush_option ->> 'turnaroundDays')::numeric, 1) <> 0
      or coalesce(nullif(rush_option ->> 'additionalCharge', '')::numeric, 0) <= 0
      or (rush_option ? 'capacityLimit' and coalesce(nullif(rush_option ->> 'capacityLimit', '')::numeric, 0) <= 0)
    then
      raise exception 'A Photo/Video rush editing option needs valid deliverables, whole-day turnaround, price, and capacity.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(rush_option -> 'deliverableIds') selected(id)
      where not (selected.id = any(coalesce(deliverable_ids, '{}'::text[])))
    ) then
      raise exception 'Rush editing can only apply to configured deliverables.';
    end if;
  end loop;

  revision_policy := settings -> 'revisionPolicy';
  if jsonb_typeof(revision_policy) <> 'object'
    or not (revision_policy ? 'includedRevisionRounds')
    or coalesce(nullif(revision_policy ->> 'includedRevisionRounds', '')::numeric, -1) < 0
    or mod((revision_policy ->> 'includedRevisionRounds')::numeric, 1) <> 0
  then
    raise exception 'Set a non-negative whole number of included revision rounds.';
  end if;
  revision_rounds := (revision_policy ->> 'includedRevisionRounds')::integer;
  if revision_policy ? 'additionalRevisionCharge'
    and coalesce(nullif(revision_policy ->> 'additionalRevisionCharge', '')::numeric, -1) < 0
  then
    raise exception 'Additional revision charges cannot be negative.';
  end if;
  if revision_rounds > 0 then
    if jsonb_typeof(revision_policy -> 'eligibleDeliverableIds') <> 'array'
      or jsonb_array_length(revision_policy -> 'eligibleDeliverableIds') = 0
      or coalesce(nullif(revision_policy ->> 'revisionRequestPeriodDays', '')::numeric, 0) <= 0
      or mod(coalesce(nullif(revision_policy ->> 'revisionRequestPeriodDays', '')::numeric, 0), 1) <> 0
      or coalesce(nullif(revision_policy ->> 'revisionTurnaroundDays', '')::numeric, 0) <= 0
      or mod(coalesce(nullif(revision_policy ->> 'revisionTurnaroundDays', '')::numeric, 0), 1) <> 0
    then
      raise exception 'Included revisions need eligible deliverables, a request period, and a revision turnaround.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(revision_policy -> 'eligibleDeliverableIds') selected(id)
      where not (selected.id = any(coalesce(deliverable_ids, '{}'::text[])))
    ) then
      raise exception 'Revision eligibility can only reference configured deliverables.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_v18_photo_video_postproduction_trigger on public.services;
create trigger validate_v18_photo_video_postproduction_trigger
before insert or update of category_id, category_details, status
on public.services
for each row execute function public.validate_v18_photo_video_postproduction();

-- Package snapshots are already copied into booking requests by the V14
-- workflow. This appends the provider's immutable delivery commitments at
-- booking creation, after the package snapshot trigger has run. No delivery
-- records, files, approvals, or payment behavior are changed here.
create or replace function public.capture_v18_photo_video_postproduction_booking_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  service_details jsonb;
  event_date_value date;
  settings jsonb;
  deliverables jsonb;
  snapshot jsonb;
begin
  if coalesce(new.package_snapshot, '{}'::jsonb) ? 'photoVideoPostProduction' then
    return new;
  end if;

  select lower(trim(category.name)), service.category_details, event.event_date
  into category_name, service_details, event_date_value
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.events event on event.id = new.event_id
  where service.id = new.service_id;

  if category_name not like '%photo%'
    or not (service_details ? 'postProductionSettings')
    or jsonb_typeof(service_details -> 'postProductionSettings') <> 'object'
  then
    return new;
  end if;

  settings := service_details -> 'postProductionSettings';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', deliverable.value ->> 'id',
    'name', deliverable.value ->> 'name',
    'deliveryFormat', deliverable.value ->> 'deliveryFormat',
    'turnaroundDays', (deliverable.value ->> 'turnaroundDays')::integer,
    'expectedDeadlineDate', case
      when settings ->> 'deadlineStartingPoint' = 'event_completion' and event_date_value is not null
        then to_char(event_date_value + (deliverable.value ->> 'turnaroundDays')::integer, 'YYYY-MM-DD')
      else null
    end
  ) order by deliverable.value ->> 'id'), '[]'::jsonb)
  into deliverables
  from jsonb_array_elements(coalesce(service_details -> 'deliverableConfigurations', '[]'::jsonb)) deliverable(value);

  snapshot := jsonb_build_object(
    'version', 1,
    'capturedAt', now(),
    'deadlineStartingPoint', settings ->> 'deadlineStartingPoint',
    'startingPointDisclosure', settings ->> 'startingPointDisclosure',
    'eventCompletionDate', event_date_value,
    'deliverables', deliverables,
    'rushEditingOptions', coalesce(settings -> 'rushEditingOptions', '[]'::jsonb),
    'deliveryMethods', coalesce(settings -> 'deliveryMethods', '[]'::jsonb),
    'revisionPolicy', coalesce(settings -> 'revisionPolicy', '{}'::jsonb)
  );
  new.package_snapshot := coalesce(new.package_snapshot, '{}'::jsonb)
    || jsonb_build_object('photoVideoPostProduction', snapshot);
  return new;
end;
$$;

drop trigger if exists z_capture_v18_photo_video_postproduction_booking_snapshot_trigger on public.bookings;
create trigger z_capture_v18_photo_video_postproduction_booking_snapshot_trigger
before insert on public.bookings
for each row execute function public.capture_v18_photo_video_postproduction_booking_snapshot();

comment on function public.capture_v18_photo_video_postproduction_booking_snapshot() is
  'Preserves Photo/Video delivery commitments and event-completion-based editing deadlines with the booking request.';

revoke all on function public.validate_v18_photo_video_postproduction() from public;
revoke all on function public.capture_v18_photo_video_postproduction_booking_snapshot() from public;

commit;
