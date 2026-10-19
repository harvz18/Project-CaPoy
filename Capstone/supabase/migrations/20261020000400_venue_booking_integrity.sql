-- V8 Phase 4: every option-priced venue booking is canonicalized from the
-- server quote before it can be paid. Later provider listing edits never
-- rewrite an agreed booking snapshot or its financial records.
begin;

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

  select event.client_id, event.event_date, event.event_time
  into event_row
  from public.events event
  where event.id = new.event_id;

  -- Existing flat-price venue services retain their established booking path.
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

  -- Serialize the authoritative conflict check. This prevents two concurrent
  -- checkouts for different events from reserving the same rentable resource.
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

  -- The quote is the sole source for V8 snapshot fields and amounts. This
  -- overwrites values supplied by the client and applies the marketplace fee
  -- exactly once through the pre-existing Phase 5 accounting model.
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

drop trigger if exists v8_enforce_venue_booking_terms_trigger on public.bookings;
create trigger v8_enforce_venue_booking_terms_trigger
before insert or update of event_id, client_id, provider_id, service_id,
  requested_date, requested_time, amount, provider_amount, commission_rate,
  commission_amount, commission_model, financial_terms_version,
  initial_payment_rate, provider_initial_rate, venue_option_id,
  venue_option_name, venue_option_snapshot, venue_options_snapshot,
  venue_booking_snapshot, venue_booked_hours, venue_setup_start_at,
  venue_start_at, venue_end_at
on public.bookings
for each row execute function public.enforce_v8_venue_booking_terms();

create or replace function public.assert_v8_venue_booking_integrity(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  option_row jsonb;
  provider_total numeric := 0;
  unit_rate numeric;
  selected_hours numeric;
  option_total numeric;
  expected_total numeric;
  option_count integer := 0;
begin
  select * into booking_row from public.bookings booking
  where booking.id = target_booking_id
  for update;
  if booking_row.id is null then
    raise exception 'Booking not found.' using errcode = '42501';
  end if;

  -- Legacy records have no detailed option array. Keep their stored details
  -- and amounts intact instead of inventing a configuration.
  if jsonb_typeof(booking_row.venue_options_snapshot) <> 'array'
    or jsonb_array_length(booking_row.venue_options_snapshot) = 0 then
    return;
  end if;

  if jsonb_typeof(booking_row.venue_booking_snapshot) <> 'object' then
    raise exception 'The venue booking snapshot is incomplete.';
  end if;

  for option_row in select value from jsonb_array_elements(booking_row.venue_options_snapshot)
  loop
    option_count := option_count + 1;
    if nullif(trim(option_row ->> 'id'), '') is null
      or nullif(trim(option_row ->> 'name'), '') is null
      or option_row ->> 'pricingType' not in ('hour', 'event')
      or coalesce(option_row ->> 'unitRate', '') !~ '^[0-9]+([.][0-9]+)?$'
      or coalesce(option_row ->> 'pricingSubtotal', '') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'The venue booking snapshot has invalid option pricing.';
    end if;

    unit_rate := (option_row ->> 'unitRate')::numeric;
    option_total := (option_row ->> 'pricingSubtotal')::numeric;
    if unit_rate <= 0 or option_total <= 0 then
      raise exception 'The venue booking snapshot has invalid option pricing.';
    end if;
    if option_row ->> 'pricingType' = 'hour' then
      if coalesce(option_row ->> 'selectedDurationHours', '') !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'The venue booking snapshot has an invalid rental duration.';
      end if;
      selected_hours := (option_row ->> 'selectedDurationHours')::numeric;
      expected_total := round(unit_rate * selected_hours, 2);
    else
      expected_total := round(unit_rate, 2);
    end if;
    if abs(option_total - expected_total) > 0.01 then
      raise exception 'The venue booking snapshot does not match the agreed option price.';
    end if;
    provider_total := provider_total + option_total;
  end loop;

  if option_count = 0
    or abs(round(provider_total, 2) - round(coalesce(booking_row.provider_amount, 0), 2)) > 0.01
    or coalesce(booking_row.venue_booking_snapshot ->> 'providerBaseTotal', '') !~ '^[0-9]+([.][0-9]+)?$'
    or abs((booking_row.venue_booking_snapshot ->> 'providerBaseTotal')::numeric - provider_total) > 0.01
    or coalesce(booking_row.venue_booking_snapshot ->> 'clientFacingTotal', '') !~ '^[0-9]+([.][0-9]+)?$'
    or abs((booking_row.venue_booking_snapshot ->> 'clientFacingTotal')::numeric - coalesce(booking_row.amount, 0)) > 0.01
    or abs(round(coalesce(booking_row.provider_amount, 0) + coalesce(booking_row.commission_amount, 0), 2)
      - round(coalesce(booking_row.amount, 0), 2)) > 0.01 then
    raise exception 'The venue booking totals do not match the agreed snapshot.';
  end if;

  if exists (
    select 1
    from public.bookings other_booking
    cross join lateral jsonb_array_elements(booking_row.venue_options_snapshot) requested_option(value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(other_booking.venue_options_snapshot) = 'array'
        and jsonb_array_length(other_booking.venue_options_snapshot) > 0
        then other_booking.venue_options_snapshot
        else jsonb_build_array(other_booking.venue_option_snapshot) end
    ) existing_option(value)
    where other_booking.id <> booking_row.id
      and other_booking.service_id = booking_row.service_id
      and other_booking.status::text in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
      and exists (
        select 1
        from jsonb_array_elements_text(coalesce(requested_option.value -> 'resourceIds', '[]'::jsonb)) requested_resource(value)
        join jsonb_array_elements_text(coalesce(existing_option.value -> 'resourceIds', '[]'::jsonb)) existing_resource(value)
          using (value)
      )
      and case
        when nullif(requested_option.value ->> 'setupStartAt', '') is null
          or nullif(requested_option.value ->> 'endAt', '') is null
          or nullif(existing_option.value ->> 'setupStartAt', '') is null
          or nullif(existing_option.value ->> 'endAt', '') is null
          then other_booking.requested_date = booking_row.requested_date
        else (requested_option.value ->> 'setupStartAt')::timestamp < (existing_option.value ->> 'endAt')::timestamp
          and (requested_option.value ->> 'endAt')::timestamp > (existing_option.value ->> 'setupStartAt')::timestamp
      end
  ) then
    raise exception 'A selected venue option overlaps another active booking.';
  end if;
end;
$$;

create or replace function public.enforce_v8_venue_acceptance_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status::text = 'requested' and new.status::text = 'confirmed' then
    perform public.assert_v8_venue_booking_integrity(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists v8_enforce_venue_acceptance_integrity_trigger on public.bookings;
create trigger v8_enforce_venue_acceptance_integrity_trigger
before update of status on public.bookings
for each row execute function public.enforce_v8_venue_acceptance_integrity();

revoke all on function public.enforce_v8_venue_booking_terms() from public;
revoke all on function public.assert_v8_venue_booking_integrity(uuid) from public;
revoke all on function public.enforce_v8_venue_acceptance_integrity() from public;

comment on function public.enforce_v8_venue_booking_terms() is
  'Canonicalizes option-priced venue bookings from the authoritative quote and blocks pricing changes after payment.';
comment on function public.assert_v8_venue_booking_integrity(uuid) is
  'Validates the immutable V8 venue snapshot, agreed financial totals, and rentable-option conflicts before provider acceptance.';

commit;
