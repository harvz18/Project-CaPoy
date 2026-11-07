-- Enforce the seven-calendar-day event-booking lead time at the authoritative
-- database boundary. Drafts remain editable so older saved plans are preserved
-- and can be corrected; only new booking/payment transitions are blocked.

begin;

create or replace function public.minimum_event_booking_date_manila()
returns date
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Asia/Manila')::date + 7);
$$;

create or replace function public.assert_minimum_event_booking_lead(target_event_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  minimum_date date := public.minimum_event_booking_date_manila();
begin
  if target_event_date is null then
    raise exception 'Select an event date at least 7 days in advance before booking.' using errcode = '22023';
  end if;

  if target_event_date < minimum_date then
    raise exception 'Events must be scheduled at least 7 days in advance. Choose % or a later date.', minimum_date
      using errcode = '22023';
  end if;
end;
$$;

-- A direct status change cannot convert an invalid draft into a booking.
-- Existing events are intentionally checked only when their date changes;
-- ordinary acceptance, messaging, payment verification, cancellation, and
-- completion updates remain available for bookings already in progress.
create or replace function public.enforce_minimum_event_booking_lead_on_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_active_booking boolean := false;
  becomes_bookable boolean := false;
begin
  becomes_bookable := new.status::text not in ('draft', 'planning', 'cancelled', 'completed');

  if tg_op = 'INSERT' then
    if becomes_bookable then
      perform public.assert_minimum_event_booking_lead(new.event_date);
    end if;
    return new;
  end if;

  if new.event_date is distinct from old.event_date then
    select exists (
      select 1 from public.bookings booking
      where booking.event_id = new.id
        and booking.status not in ('cancelled', 'rejected', 'expired')
    ) into has_active_booking;

    if has_active_booking
      or old.status::text not in ('draft', 'planning')
      or becomes_bookable
    then
      perform public.assert_minimum_event_booking_lead(new.event_date);
    end if;
  elsif old.status::text in ('draft', 'planning') and becomes_bookable then
    perform public.assert_minimum_event_booking_lead(new.event_date);
  end if;

  return new;
end;
$$;

drop trigger if exists zz_enforce_minimum_event_booking_lead_on_event on public.events;
create trigger zz_enforce_minimum_event_booking_lead_on_event
before insert or update of event_date, status on public.events
for each row execute function public.enforce_minimum_event_booking_lead_on_event();

-- New provider bookings cannot be inserted for an invalid event even through
-- a stale client or a direct API request. Existing booking lifecycle updates
-- do not use this insert-only trigger.
create or replace function public.enforce_minimum_event_booking_lead_on_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_date_value date;
begin
  if new.event_id is null then return new; end if;

  select event.event_date into event_date_value
  from public.events event
  where event.id = new.event_id;
  perform public.assert_minimum_event_booking_lead(event_date_value);
  return new;
end;
$$;

drop trigger if exists zz_enforce_minimum_event_booking_lead_on_booking on public.bookings;
create trigger zz_enforce_minimum_event_booking_lead_on_booking
before insert on public.bookings
for each row execute function public.enforce_minimum_event_booking_lead_on_booking();

-- V14 is the current initial-payment path. This insert guard blocks a stale
-- client from creating an initial payment if the date becomes invalid between
-- provider acceptance and checkout, without interfering with historical
-- payment verification or provider-side remaining-payment records.
create or replace function public.enforce_minimum_event_booking_lead_on_initial_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_date_value date;
begin
  if coalesce(new.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4' then
    return new;
  end if;

  select event.event_date into event_date_value
  from public.events event
  where event.id = new.event_id;
  perform public.assert_minimum_event_booking_lead(event_date_value);
  return new;
end;
$$;

drop trigger if exists zz_enforce_minimum_event_booking_lead_on_initial_payment on public.payments;
create trigger zz_enforce_minimum_event_booking_lead_on_initial_payment
before insert on public.payments
for each row execute function public.enforce_minimum_event_booking_lead_on_initial_payment();

-- Give the current request/payment entry points the same friendly error before
-- they make any booking, coordinator, payment, or PayMongo-attempt changes.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  function_sql text;
  patched_sql text;
begin
  foreach function_signature in array array[
    'public.submit_my_event_booking_requests_v14(uuid)',
    'public.initiate_my_event_payment_v14(uuid,text,text,boolean)',
    'public.prepare_my_paymongo_checkout_v16(uuid,text,boolean,text)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected booking/payment function % does not exist.', function_signature;
    end if;

    select pg_get_functiondef(function_oid) into function_sql;
    if position('assert_minimum_event_booking_lead' in function_sql) > 0 then
      continue;
    end if;

    patched_sql := regexp_replace(
      function_sql,
      E'(if event_row\\.id is null then[[:space:]]+raise exception ''Event not found\\.'' using errcode = ''42501'';[[:space:]]+end if;)',
      E'\\1\n  perform public.assert_minimum_event_booking_lead(event_row.event_date);'
    );
    if patched_sql = function_sql then
      raise exception 'Could not add the minimum booking lead-time check to %.', function_signature;
    end if;
    execute patched_sql;
  end loop;
end;
$$;

revoke all on function public.minimum_event_booking_date_manila() from public, anon, authenticated;
revoke all on function public.assert_minimum_event_booking_lead(date) from public, anon, authenticated;
revoke all on function public.enforce_minimum_event_booking_lead_on_event() from public, anon, authenticated;
revoke all on function public.enforce_minimum_event_booking_lead_on_booking() from public, anon, authenticated;
revoke all on function public.enforce_minimum_event_booking_lead_on_initial_payment() from public, anon, authenticated;

comment on function public.assert_minimum_event_booking_lead(date) is
  'Rejects new MULTIVENT booking/payment transitions when the event is fewer than seven Manila calendar days away.';

commit;
