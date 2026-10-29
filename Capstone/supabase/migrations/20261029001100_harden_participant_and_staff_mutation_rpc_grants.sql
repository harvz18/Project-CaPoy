-- Participant and staff mutations always require an authenticated actor.
-- Their existing role and ownership checks remain the authorization boundary.
begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.assign_event_coordinator(uuid,uuid)',
    'public.auto_assign_event_coordinator(uuid)',
    'public.choose_coordinator_package(uuid,uuid)',
    'public.choose_coordinator_package_with_options(uuid,uuid,jsonb)',
    'public.clear_event_coordinator_package(uuid)',
    'public.create_coordination_task(uuid,text,text,timestamp with time zone)',
    'public.record_all_cash_remittances(uuid,uuid,numeric,text,text)',
    'public.record_cash_remittance(uuid,uuid,uuid,numeric,numeric,text,text)',
    'public.respond_event_coordinator_assignment(uuid,boolean)',
    'public.respond_to_catering_food_tasting(uuid,text,text,date,time without time zone)',
    'public.review_cash_remittance(uuid,text,text)',
    'public.staff_assign_event_coordinator(uuid,uuid)',
    'public.submit_event_service_feedback(uuid,jsonb)',
    'public.update_coordination_task_status(uuid,text)',
    'public.verify_cash_remittance(uuid,text)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected participant or staff mutation function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon', function_oid);
    execute format('grant execute on function %s to authenticated', function_oid);
  end loop;
end;
$$;

commit;
