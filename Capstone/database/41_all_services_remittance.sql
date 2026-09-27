-- MULTIVENT remittance adjustment: record one complete handoff for all services.
-- Apply after 40_automatic_commission_remittance.sql.

begin;

-- The batch remains atomic while retaining one remittance and ledger allocation
-- per booking. Partial handoffs stay available through the single-service RPC,
-- where their allocation is explicit instead of being guessed across services.
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

comment on function public.record_all_cash_remittances(uuid, uuid, numeric, text, text) is
  'Atomically records the complete automatic remittance balance across every outstanding service booking in an event.';

commit;
