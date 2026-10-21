-- V10 Phase 2: provider-created packages are authoritative service
-- configurations. They are quoted, saved, and carried into a booking without
-- requiring the client to repeat the package's included manual choices.
begin;

alter table public.event_service_selections
  add column if not exists package_snapshot jsonb not null default '{}'::jsonb;

alter table public.bookings
  add column if not exists package_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_package_snapshot_object_check,
  add constraint event_service_selections_package_snapshot_object_check
    check (jsonb_typeof(package_snapshot) = 'object');

alter table public.bookings
  drop constraint if exists bookings_package_snapshot_object_check,
  add constraint bookings_package_snapshot_object_check
    check (jsonb_typeof(package_snapshot) = 'object');

-- Keep every existing custom-menu and manual-venue calculation byte-for-byte
-- intact.  The replacement function delegates to this implementation unless
-- a provider package is explicitly selected.
alter function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid)
  rename to calculate_event_service_quote_v10_prepackage;

create function public.calculate_event_service_quote(
  target_service_id uuid,
  target_event_id uuid,
  target_option_id text default null,
  target_quantity numeric default null,
  target_package_id uuid default null
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
  category_key text;
  package_unit text;
  package_pricing_model text;
  provider_unit_price numeric(12,2);
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  commission_rate numeric := public.get_public_commission_rate();
  venue_capacity integer := 0;
  package_snapshot jsonb;
begin
  if target_package_id is null then
    return public.calculate_event_service_quote_v10_prepackage(
      target_service_id,
      target_event_id,
      target_option_id,
      target_quantity,
      null
    );
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  -- A package can only be sold through its host service. The client catalog
  -- routes package cards shown on included services back to this host service.
  select
    service.id as service_id,
    service.name as service_name,
    service.provider_id,
    service.category_details,
    service.pricing_unit as service_pricing_unit,
    category.name as category_name,
    package.id as package_id,
    package.name as package_name,
    package.description as package_description,
    package.price as package_price,
    package.pricing_unit as package_pricing_unit,
    package.pricing_mode as package_pricing_mode,
    package.inclusions as package_inclusions
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  join public.service_packages package on package.id = target_package_id
    and package.service_id = service.id
    and package.is_active = true
    and coalesce(package.is_deleted, false) = false
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and owner.account_status in ('active', 'verified');
  if service_row.service_id is null then
    raise exception 'The selected provider package is no longer available.';
  end if;

  category_key := public.phase9_category_key(service_row.category_name);
  package_unit := coalesce(
    nullif(service_row.package_pricing_unit, ''),
    nullif(service_row.service_pricing_unit, ''),
    'event'
  );
  if package_unit not in ('event', 'person', 'hour', 'day') then
    raise exception 'The selected provider package has an unsupported pricing unit.';
  end if;
  provider_unit_price := round(coalesce(service_row.package_price, 0), 2);
  if provider_unit_price <= 0 then
    raise exception 'The selected provider package must have a price greater than zero.';
  end if;

  -- A package removes redundant configuration, not the provider's calendar.
  -- Preserve the marketplace's same-date-and-time conflict and blackout rules
  -- for every package when a schedule is already present on the event.
  if event_row.event_date is not null and event_row.event_time is not null then
    if exists (
      select 1
      from public.provider_availability availability
      where availability.provider_id = service_row.provider_id
        and availability.available_date = event_row.event_date
        and (availability.service_id is null or availability.service_id = service_row.service_id)
        and (
          availability.is_available = false
          or (availability.start_time is not null and event_row.event_time < availability.start_time)
          or (availability.end_time is not null and event_row.event_time > availability.end_time)
        )
    ) then
      raise exception 'This provider package is unavailable for the requested event schedule.';
    end if;

    if exists (
      select 1
      from public.provider_operating_hours operating_hours
      where operating_hours.provider_id = service_row.provider_id
        and operating_hours.day_of_week = lower(trim(to_char(event_row.event_date, 'Day')))
        and (
          operating_hours.is_open = false
          or event_row.event_time < operating_hours.open_time
          or event_row.event_time > operating_hours.close_time
        )
    ) then
      raise exception 'This provider package is outside the provider operating hours.';
    end if;

    if exists (
      select 1
      from public.bookings booking
      where booking.provider_id = service_row.provider_id
        and booking.event_id <> event_row.id
        and booking.requested_date = event_row.event_date
        and booking.requested_time = event_row.event_time
        and booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
    ) then
      raise exception 'This provider package is already booked for the requested event schedule.';
    end if;
  end if;

  if category_key = 'venue' then
    if event_row.event_date is null or event_row.event_time is null then
      raise exception 'Set the event date and start time before choosing a venue package.';
    end if;

    -- Legacy packages do not carry a separate capacity column. Use the
    -- provider's configured venue capacity instead of asking the client to
    -- select and price a manual option that the package already includes.
    select greatest(
      case when coalesce(service_row.category_details ->> 'capacity', '') ~ '^[0-9]+$'
        then (service_row.category_details ->> 'capacity')::integer else 0 end,
      coalesce(max(capacity_row.capacity), 0)
    ) into venue_capacity
    from (
      select case when coalesce(space.value ->> 'capacity', '') ~ '^[0-9]+$'
        then (space.value ->> 'capacity')::integer else 0 end as capacity
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
          then service_row.category_details -> 'spaces' else '[]'::jsonb end
      ) space(value)
      where coalesce(space.value ->> 'isActive', 'true') <> 'false'
      union all
      select case
        when coalesce(combination.value ->> 'combinedCapacity', '') ~ '^[0-9]+$'
          then (combination.value ->> 'combinedCapacity')::integer
        when coalesce(combination.value ->> 'capacity', '') ~ '^[0-9]+$'
          then (combination.value ->> 'capacity')::integer
        else 0 end
      from jsonb_array_elements(
        case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
          then service_row.category_details -> 'combinations' else '[]'::jsonb end
      ) combination(value)
      where coalesce(combination.value ->> 'isActive', 'true') <> 'false'
    ) capacity_row;
    if venue_capacity <= 0
      or venue_capacity < greatest(coalesce(event_row.guest_count, 0), 1)
    then
      raise exception 'The selected venue package does not have enough configured capacity for the event guest count.';
    end if;
  end if;

  if package_unit = 'person' then
    if coalesce(event_row.guest_count, 0) <= 0 then
      raise exception 'Set the event guest count before choosing this per-guest package.';
    end if;
    provider_amount := round(provider_unit_price * event_row.guest_count, 2);
    package_pricing_model := 'per_person';
  else
    -- Package prices with an event/hour/day unit already represent the
    -- configured package terms. There is no separate manual quantity to add.
    provider_amount := provider_unit_price;
    package_pricing_model := 'fixed_event';
  end if;
  customer_amount := round(provider_amount * (1 + commission_rate), 2);

  package_snapshot := jsonb_build_object(
    'id', service_row.package_id,
    'name', service_row.package_name,
    'description', service_row.package_description,
    'pricingModel', package_pricing_model,
    'pricingMode', coalesce(service_row.package_pricing_mode, 'legacy'),
    'pricingUnit', package_unit,
    'basePrice', provider_unit_price,
    'inclusions', coalesce(service_row.package_inclusions, '[]'::jsonb),
    'guestCount', case when package_unit = 'person' then event_row.guest_count else null end,
    'includedDurationHours', null,
    'providerAmount', provider_amount,
    'customerAmount', customer_amount,
    'commissionRate', commission_rate,
    'capturedAt', now()
  );

  return jsonb_build_object(
    'serviceId', service_row.service_id,
    'serviceName', service_row.service_name,
    'categoryKey', category_key,
    'guestCount', greatest(coalesce(event_row.guest_count, 0), 0),
    'providerUnitPrice', provider_unit_price,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * 0.35, 2),
    'providerInitialShare', round(provider_amount * 0.30, 2),
    'remainingProviderBalance', round(provider_amount * 0.70, 2),
    'packageSnapshot', package_snapshot,
    'cateringOption', case when category_key = 'catering' then jsonb_build_object(
      'id', 'provider-package:' || service_row.package_id::text,
      'name', service_row.package_name,
      'packageId', service_row.package_id,
      'pricingBasis', 'provider_package_' || package_pricing_model,
      'pricingUnit', package_unit,
      'providerAmount', provider_amount,
      'customerAmount', customer_amount,
      'inclusions', coalesce(service_row.package_inclusions, '[]'::jsonb)
    ) else '{}'::jsonb end,
    'venueOption', case when category_key = 'venue' then jsonb_build_object(
      'id', 'provider-package:' || service_row.package_id::text,
      'name', service_row.package_name,
      'packageId', service_row.package_id,
      'capacity', venue_capacity,
      'pricingBasis', 'provider_package_fixed_event',
      'providerAmount', provider_amount,
      'customerAmount', customer_amount,
      'inclusions', coalesce(service_row.package_inclusions, '[]'::jsonb)
    ) else '{}'::jsonb end,
    'bookedHours', null,
    'setupStartAt', null,
    'startAt', null,
    'endAt', null
  );
end;
$$;

-- The canonical save RPC already writes package_id and its authoritative
-- quote.  This trigger captures the rest of the immutable package terms on
-- the same row without changing any non-package selection behavior.
create or replace function public.capture_v10_service_package_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  package_row record;
  package_unit text;
  provider_amount numeric(12,2);
  snapshot jsonb;
begin
  if new.package_id is null then
    new.package_snapshot := '{}'::jsonb;
    return new;
  end if;

  select package.id, package.name, package.description, package.price,
    package.pricing_unit, package.pricing_mode, package.inclusions
  into package_row
  from public.service_packages package
  where package.id = new.package_id;
  if package_row.id is null then
    raise exception 'The selected provider package no longer exists.';
  end if;

  package_unit := coalesce(nullif(package_row.pricing_unit, ''), 'event');
  provider_amount := case
    when coalesce(new.selected_provider_snapshot ->> 'providerAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
      then round((new.selected_provider_snapshot ->> 'providerAmount')::numeric, 2)
    when package_unit = 'person' then round(coalesce(package_row.price, 0) * greatest(coalesce(new.attendee_count, 0), 0), 2)
    else round(coalesce(package_row.price, 0), 2)
  end;
  snapshot := jsonb_build_object(
    'id', package_row.id,
    'name', package_row.name,
    'description', package_row.description,
    'pricingModel', case when package_unit = 'person' then 'per_person' else 'fixed_event' end,
    'pricingMode', coalesce(package_row.pricing_mode, 'legacy'),
    'pricingUnit', package_unit,
    'basePrice', round(coalesce(package_row.price, 0), 2),
    'inclusions', coalesce(package_row.inclusions, '[]'::jsonb),
    'guestCount', case when package_unit = 'person' then new.attendee_count else null end,
    'includedDurationHours', null,
    'providerAmount', provider_amount,
    'customerAmount', round(coalesce(new.estimated_amount, 0), 2),
    'commissionRate', coalesce(new.selected_provider_snapshot -> 'commissionRate', '0'::jsonb),
    'capturedAt', now()
  );
  new.package_snapshot := snapshot;
  new.selected_provider_snapshot := coalesce(new.selected_provider_snapshot, '{}'::jsonb)
    || jsonb_build_object('package', snapshot);

  if new.category_key = 'catering' then
    new.catering_option_id := 'provider-package:' || package_row.id::text;
    new.catering_option_name := package_row.name;
    new.catering_option_snapshot := snapshot;
  elsif new.category_key = 'venue' then
    new.venue_option_id := 'provider-package:' || package_row.id::text;
    new.venue_option_name := package_row.name;
    new.venue_option_snapshot := snapshot;
    new.venue_options_snapshot := '[]'::jsonb;
    new.venue_booking_snapshot := jsonb_build_object(
      'package', snapshot,
      'providerBaseTotal', provider_amount,
      'clientFacingTotal', round(coalesce(new.estimated_amount, 0), 2),
      'capturedAt', now()
    );
    new.venue_booked_hours := null;
    new.venue_setup_start_at := null;
    new.venue_start_at := null;
    new.venue_end_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_v10_service_package_snapshot_trigger
  on public.event_service_selections;
create trigger capture_v10_service_package_snapshot_trigger
before insert or update of package_id, estimated_amount, attendee_count, selected_provider_snapshot
on public.event_service_selections
for each row execute function public.capture_v10_service_package_snapshot();

-- Booking rows are created by the existing payment flow. Re-read the saved
-- selection snapshot so a client cannot submit a second markup, a changed
-- package amount, or a package ID that does not belong to the selection.
create or replace function public.enforce_v10_package_booking_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection_row record;
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  commission_rate numeric(7,6);
  payment_terms jsonb;
begin
  if new.package_id is null then
    return new;
  end if;

  select selection.estimated_amount, selection.package_snapshot,
    selection.selected_provider_snapshot
  into selection_row
  from public.event_service_selections selection
  where selection.event_id = new.event_id
    and selection.client_id = new.client_id
    and selection.provider_id = new.provider_id
    and selection.service_id = new.service_id
    and selection.package_id = new.package_id
    and selection.status in ('selected', 'requested')
  order by selection.updated_at desc
  limit 1;
  if selection_row.estimated_amount is null then
    raise exception 'Select this provider package before creating its booking.';
  end if;
  if jsonb_typeof(selection_row.package_snapshot) <> 'object'
    or selection_row.package_snapshot = '{}'::jsonb then
    raise exception 'The selected provider package is missing its booking snapshot.';
  end if;

  provider_amount := case
    when coalesce(selection_row.selected_provider_snapshot ->> 'providerAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
      then round((selection_row.selected_provider_snapshot ->> 'providerAmount')::numeric, 2)
    else round(coalesce(selection_row.estimated_amount, 0), 2)
  end;
  customer_amount := round(coalesce(selection_row.estimated_amount, 0), 2);
  commission_rate := case
    when coalesce(selection_row.selected_provider_snapshot ->> 'commissionRate', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (selection_row.selected_provider_snapshot ->> 'commissionRate')::numeric
    else public.get_public_commission_rate()
  end;
  payment_terms := public.get_public_payment_terms();

  new.package_snapshot := selection_row.package_snapshot;
  new.provider_amount := provider_amount;
  new.amount := customer_amount;
  new.commission_model := 'added_to_customer';
  new.commission_rate := commission_rate;
  new.commission_amount := round(customer_amount - provider_amount, 2);
  new.financial_terms_version := coalesce(new.financial_terms_version, 'phase5-v1');
  new.initial_payment_rate := (payment_terms ->> 'initialPaymentRate')::numeric;
  new.provider_initial_rate := (payment_terms ->> 'providerInitialRate')::numeric;
  return new;
end;
$$;

drop trigger if exists enforce_v10_package_booking_terms_trigger on public.bookings;
create trigger enforce_v10_package_booking_terms_trigger
before insert or update of event_id, client_id, provider_id, service_id, package_id,
  amount, provider_amount, commission_rate, commission_amount, commission_model,
  financial_terms_version, initial_payment_rate, provider_initial_rate, package_snapshot
on public.bookings
for each row execute function public.enforce_v10_package_booking_terms();

-- V8 option-priced venue bookings continue to be canonicalized from manual
-- options. A package deliberately has no separate option array, so its terms
-- are instead supplied by the protected package booking trigger above.
create or replace function public.enforce_v8_venue_booking_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_row record;
  event_row record;
  quote jsonb;
  first_option jsonb;
  option_inputs jsonb;
  booking_terms jsonb;
  changed boolean := true;
begin
  select service.id, service.provider_id, service.category_details, category.name as category_name
  into service_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = new.service_id;

  if service_row.id is null or public.phase9_category_key(service_row.category_name) <> 'venue' then
    return new;
  end if;

  if new.package_id is not null then
    return new;
  end if;

  select event.client_id, event.event_date, event.event_time
  into event_row
  from public.events event
  where event.id = new.event_id;

  if not exists (
    select 1
    from (
      select item.value
      from jsonb_array_elements(case when jsonb_typeof(service_row.category_details -> 'spaces') = 'array'
        then service_row.category_details -> 'spaces' else '[]'::jsonb end) item(value)
      union all
      select item.value
      from jsonb_array_elements(case when jsonb_typeof(service_row.category_details -> 'combinations') = 'array'
        then service_row.category_details -> 'combinations' else '[]'::jsonb end) item(value)
    ) option_row
    where option_row.value ? 'pricingUnit' or option_row.value ? 'baseRate'
  ) then
    return new;
  end if;

  if jsonb_typeof(new.venue_options_snapshot) <> 'array'
    or jsonb_array_length(new.venue_options_snapshot) = 0 then
    raise exception 'Choose at least one available venue option.';
  end if;

  if tg_op = 'UPDATE' then
    changed := new.event_id is distinct from old.event_id
      or new.client_id is distinct from old.client_id
      or new.provider_id is distinct from old.provider_id
      or new.service_id is distinct from old.service_id
      or new.requested_date is distinct from old.requested_date
      or new.requested_time is distinct from old.requested_time
      or new.amount is distinct from old.amount
      or new.provider_amount is distinct from old.provider_amount
      or new.commission_rate is distinct from old.commission_rate
      or new.commission_amount is distinct from old.commission_amount
      or new.commission_model is distinct from old.commission_model
      or new.financial_terms_version is distinct from old.financial_terms_version
      or new.initial_payment_rate is distinct from old.initial_payment_rate
      or new.provider_initial_rate is distinct from old.provider_initial_rate
      or new.venue_option_id is distinct from old.venue_option_id
      or new.venue_option_name is distinct from old.venue_option_name
      or new.venue_option_snapshot is distinct from old.venue_option_snapshot
      or new.venue_options_snapshot is distinct from old.venue_options_snapshot
      or new.venue_booking_snapshot is distinct from old.venue_booking_snapshot
      or new.venue_booked_hours is distinct from old.venue_booked_hours
      or new.venue_setup_start_at is distinct from old.venue_setup_start_at
      or new.venue_start_at is distinct from old.venue_start_at
      or new.venue_end_at is distinct from old.venue_end_at;

    if not changed then
      return new;
    end if;

    if exists (
      select 1 from public.payments payment
      where payment.booking_id = old.id and payment.status in ('paid', 'verified')
    ) then
      raise exception 'Venue booking terms are immutable after the client payment is recorded.'
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.service_id::text));

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'optionId', option_row.value ->> 'id',
    'bookedHours', case when coalesce(option_row.value ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (option_row.value ->> 'selectedDurationHours')::numeric else null end
  ))), '[]'::jsonb)
  into option_inputs
  from jsonb_array_elements(new.venue_options_snapshot) option_row(value);

  quote := public.calculate_event_venue_quote_v8(
    new.service_id,
    new.event_id,
    option_inputs
  );
  first_option := quote -> 'selectedOptions' -> 0;
  booking_terms := quote -> 'venueBookingSnapshot';

  new.venue_option_id := first_option ->> 'id';
  new.venue_option_name := first_option ->> 'name';
  new.venue_option_snapshot := coalesce(first_option, '{}'::jsonb);
  new.venue_options_snapshot := quote -> 'selectedOptions';
  new.venue_booking_snapshot := booking_terms;
  new.venue_booked_hours := case when coalesce(first_option ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
    then (first_option ->> 'selectedDurationHours')::numeric else null end;
  new.venue_setup_start_at := case when nullif(first_option ->> 'setupStartAt', '') is not null
    then (first_option ->> 'setupStartAt')::timestamp else null end;
  new.venue_start_at := case when nullif(first_option ->> 'startAt', '') is not null
    then (first_option ->> 'startAt')::timestamp else null end;
  new.venue_end_at := case when nullif(first_option ->> 'endAt', '') is not null
    then (first_option ->> 'endAt')::timestamp else null end;
  new.provider_amount := round((quote ->> 'providerAmount')::numeric, 2);
  new.client_id := event_row.client_id;
  new.provider_id := service_row.provider_id;
  new.requested_date := event_row.event_date;
  new.requested_time := event_row.event_time;
  new.commission_model := 'added_to_customer';
  new.commission_rate := round((quote ->> 'commissionRate')::numeric, 6);
  new.commission_amount := round((quote ->> 'platformFee')::numeric, 2);
  new.amount := round((quote ->> 'customerAmount')::numeric, 2);
  new.financial_terms_version := coalesce(new.financial_terms_version, 'phase5-v1');

  return new;
end;
$$;

revoke all on function public.calculate_event_service_quote_v10_prepackage(uuid, uuid, text, numeric, uuid) from public;
revoke all on function public.calculate_event_service_quote_v10_prepackage(uuid, uuid, text, numeric, uuid) from authenticated;
revoke all on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) from public;
grant execute on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) to authenticated;

revoke all on function public.capture_v10_service_package_snapshot() from public;
revoke all on function public.enforce_v10_package_booking_terms() from public;
revoke all on function public.enforce_v8_venue_booking_terms() from public;

comment on column public.event_service_selections.package_snapshot is
  'Immutable provider-package ID, name, pricing unit, inclusions, quantities, and booking-time totals.';
comment on column public.bookings.package_snapshot is
  'Package terms copied from the selected service before the provider booking request is created.';
comment on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) is
  'Authoritative quote. Selected provider packages bypass manual options, preserve one marketplace markup, and retain availability and venue-capacity checks.';

commit;
