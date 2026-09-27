-- MULTIVENT remittance presentation: event-level notifications and breakdowns.
-- Apply after 42_live_provider_earnings.sql.

begin;

-- Existing single-service recording remains the accounting source of truth.
-- This trigger only upgrades its coordinator notification to an event-level
-- message. Batch recording suppresses those child messages and sends one total.
create or replace function public.prepare_cash_remittance_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remittance_row record;
begin
  if new.resource_type <> 'cash_remittance'
    or new.title <> 'Cash remittance recorded'
  then
    return new;
  end if;

  if current_setting('app.remittance_batch_notification_suppressed', true) = 'true' then
    return null;
  end if;

  select remittance.event_id,
    remittance.coordinator_id,
    coalesce((
      select sum(event_remittance.amount_received)
      from public.cash_remittances event_remittance
      where event_remittance.event_id = remittance.event_id
        and event_remittance.coordinator_id = remittance.coordinator_id
        and event_remittance.status <> 'disputed'
    ), 0) as amount_received,
    coalesce(nullif(trim(event.name), ''), 'your event') as event_name,
    coalesce(nullif(trim(receiver.full_name), ''), 'A MULTIVENT Assistant') as recorder_name
  into remittance_row
  from public.cash_remittances remittance
  join public.events event on event.id = remittance.event_id
  left join public.profiles receiver on receiver.id = remittance.received_by
  where remittance.id = new.resource_id;

  if remittance_row.event_id is null
    or new.user_id is distinct from remittance_row.coordinator_id
  then
    return new;
  end if;

  new.title := 'Event remittance recorded';
  new.body := format(
    '%s successfully recorded your remittance for %s. The event remittance total received by MULTIVENT is PHP %s. Tap to view the service breakdown.',
    remittance_row.recorder_name,
    remittance_row.event_name,
    to_char(remittance_row.amount_received, 'FM999,999,999,990.00')
  );
  new.resource_type := 'event_cash_remittance';
  new.resource_id := remittance_row.event_id;
  return new;
end;
$$;

drop trigger if exists prepare_cash_remittance_notification_trigger on public.notifications;
create trigger prepare_cash_remittance_notification_trigger
before insert on public.notifications
for each row execute function public.prepare_cash_remittance_notification();
revoke all on function public.prepare_cash_remittance_notification() from public;

create or replace function public.record_all_cash_remittances(
  target_event_id uuid,
  target_coordinator_id uuid,
  received_amount numeric,
  reference_number text default null,
  notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  expectation_row record;
  automatic_total numeric(12,2);
  normalized_received numeric(12,2);
  remittance_id uuid;
  remittance_ids uuid[] := array[]::uuid[];
  service_count integer := 0;
  recorder_name text;
  event_received_total numeric(12,2);
  event_service_count integer;
begin
  if not public.has_permission('remittance.create') then
    raise exception 'Remittance-entry access is required.' using errcode = '42501';
  end if;
  if received_amount is null or received_amount <= 0 then
    raise exception 'The received amount must be greater than zero.';
  end if;

  select event.* into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.status <> 'completed' then
    raise exception 'Cash remittance can only be recorded after the event is completed.';
  end if;
  if event_row.coordinator_id is distinct from target_coordinator_id then
    raise exception 'The selected coordinator is not the accepted coordinator for this event.';
  end if;

  select round(coalesce(sum(expectation.amount_remaining), 0), 2)
  into automatic_total
  from public.get_event_remittance_expectations(target_event_id) expectation
  where expectation.amount_remaining > 0;

  if automatic_total <= 0 then
    raise exception 'Nothing remains to be remitted for this event.';
  end if;
  if received_amount <> round(received_amount, 2) then
    raise exception 'The received amount cannot contain fractions smaller than one centavo.';
  end if;

  normalized_received := round(received_amount, 2);
  if normalized_received <> automatic_total then
    raise exception 'All services requires the complete automatic balance (%). Select one service to record a partial handoff.',
      automatic_total;
  end if;

  -- Each child RPC keeps its own remittance and ledger allocation, but the
  -- coordinator receives only the event-level total below.
  perform set_config('app.remittance_batch_notification_suppressed', 'true', true);
  for expectation_row in
    select expectation.*
    from public.get_event_remittance_expectations(target_event_id) expectation
    where expectation.amount_remaining > 0
    order by expectation.provider_name, expectation.service_name, expectation.booking_id
  loop
    remittance_id := public.record_cash_remittance(
      target_event_id,
      expectation_row.booking_id,
      target_coordinator_id,
      expectation_row.amount_remaining,
      expectation_row.amount_remaining,
      reference_number,
      notes
    );
    remittance_ids := array_append(remittance_ids, remittance_id);
    service_count := service_count + 1;
  end loop;
  perform set_config('app.remittance_batch_notification_suppressed', 'false', true);

  select coalesce(nullif(trim(profile.full_name), ''), 'A MULTIVENT Assistant')
  into recorder_name
  from public.profiles profile
  where profile.id = auth.uid();

  select coalesce(sum(remittance.amount_received), 0),
    count(distinct remittance.booking_id)
  into event_received_total, event_service_count
  from public.cash_remittances remittance
  where remittance.event_id = target_event_id
    and remittance.coordinator_id = target_coordinator_id
    and remittance.status <> 'disputed';

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    target_coordinator_id,
    'Event remittance recorded',
    format(
      '%s successfully recorded your remittance for %s. The event remittance total received by MULTIVENT is PHP %s across %s service%s. Tap to view the breakdown.',
      coalesce(recorder_name, 'A MULTIVENT Assistant'),
      coalesce(nullif(trim(event_row.name), ''), 'your event'),
      to_char(event_received_total, 'FM999,999,999,990.00'),
      event_service_count,
      case when event_service_count = 1 then '' else 's' end
    ),
    'event_cash_remittance',
    target_event_id
  );

  return jsonb_build_object(
    'event_id', target_event_id,
    'amount_received', automatic_total,
    'service_count', service_count,
    'remittance_ids', to_jsonb(remittance_ids)
  );
end;
$$;

revoke all on function public.record_all_cash_remittances(uuid, uuid, numeric, text, text) from public;
grant execute on function public.record_all_cash_remittances(uuid, uuid, numeric, text, text) to authenticated;

create or replace function public.get_my_event_remittance_details(target_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  result_payload jsonb;
begin
  select event.* into event_row
  from public.events event
  join public.profiles coordinator on coordinator.id = event.coordinator_id
  where event.id = target_event_id
    and event.coordinator_id = auth.uid()
    and coordinator.account_status = 'active';

  if event_row.id is null then
    raise exception 'This event remittance is not available to your account.' using errcode = '42501';
  end if;

  with remittance_rows as (
    select remittance.id,
      remittance.booking_id,
      remittance.amount_expected,
      remittance.amount_received,
      remittance.status,
      remittance.reference_number,
      remittance.received_at,
      remittance.created_at,
      coalesce(nullif(trim(service.name), ''), 'Service') as service_name,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name,
      coalesce(nullif(trim(receiver.full_name), ''), 'MULTIVENT staff') as recorded_by
    from public.cash_remittances remittance
    left join public.bookings booking on booking.id = remittance.booking_id
    left join public.services service on service.id = booking.service_id
    left join public.provider_profiles provider on provider.id = booking.provider_id
    left join public.profiles receiver on receiver.id = remittance.received_by
    where remittance.event_id = target_event_id
      and remittance.coordinator_id = auth.uid()
  ), totals as (
    select coalesce(sum(item.amount_expected) filter (where item.status <> 'disputed'), 0) as amount_expected,
      coalesce(sum(item.amount_received) filter (where item.status <> 'disputed'), 0) as amount_received,
      count(distinct item.booking_id) filter (where item.status <> 'disputed') as service_count,
      max(coalesce(item.received_at, item.created_at)) as recorded_at,
      case
        when count(*) = 0 then 'pending'
        when count(*) filter (where item.status <> 'disputed') = 0 then 'disputed'
        when bool_and(item.status = 'verified') filter (where item.status <> 'disputed') then 'verified'
        when bool_and(item.status in ('remitted', 'verified')) filter (where item.status <> 'disputed') then 'remitted'
        when bool_or(item.status = 'partially_remitted') filter (where item.status <> 'disputed') then 'partially_remitted'
        else 'pending'
      end as summary_status
    from remittance_rows item
  )
  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', event_row.id,
      'name', event_row.name,
      'eventDate', event_row.event_date,
      'status', event_row.status
    ),
    'summary', jsonb_build_object(
      'amountExpected', totals.amount_expected,
      'amountReceived', totals.amount_received,
      'recordedAt', totals.recorded_at,
      'serviceCount', totals.service_count,
      'status', totals.summary_status
    ),
    'breakdown', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'bookingId', item.booking_id,
        'serviceName', item.service_name,
        'providerName', item.provider_name,
        'amountExpected', item.amount_expected,
        'amountReceived', item.amount_received,
        'status', item.status,
        'referenceNumber', item.reference_number,
        'recordedAt', coalesce(item.received_at, item.created_at),
        'recordedBy', item.recorded_by
      ) order by item.provider_name, item.service_name, item.id)
      from remittance_rows item
    ), '[]'::jsonb)
  ) into result_payload
  from totals;

  return result_payload;
end;
$$;

revoke all on function public.get_my_event_remittance_details(uuid) from public;
grant execute on function public.get_my_event_remittance_details(uuid) to authenticated;

comment on function public.get_my_event_remittance_details(uuid) is
  'Returns an assigned coordinator''s event-level remittance total and per-service breakdown.';

commit;
