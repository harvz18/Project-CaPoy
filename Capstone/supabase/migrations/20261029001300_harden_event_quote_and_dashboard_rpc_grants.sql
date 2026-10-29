-- Event-scoped quote, matching, availability, and dashboard RPCs require the
-- authenticated actor whose ownership or role is checked in each function.
begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.calculate_catering_menu_quote(uuid,uuid,jsonb)',
    'public.calculate_catering_menu_quote_v10(uuid,uuid,jsonb,integer)',
    'public.calculate_catering_service_quote_v10(uuid,uuid,integer,text,uuid)',
    'public.calculate_event_service_price(uuid,uuid,text)',
    'public.calculate_event_service_quote(uuid,uuid,text,numeric,uuid)',
    'public.calculate_event_service_quote_standard(uuid,uuid,text,numeric,uuid)',
    'public.calculate_event_service_quote_v10_prepackage(uuid,uuid,text,numeric,uuid)',
    'public.calculate_event_venue_quote_v8(uuid,uuid,jsonb)',
    'public.get_business_dashboard()',
    'public.get_coordinator_dashboard()',
    'public.get_event_schedule_availability(uuid)',
    'public.list_bookable_coordinator_packages(uuid,uuid)',
    'public.list_bookable_event_coordinators(uuid)',
    'public.list_bookable_event_coordinators_v9(uuid)',
    'public.try_calculate_event_service_quote(uuid,uuid,text,numeric)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected event quote or dashboard function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon', function_oid);
    execute format('grant execute on function %s to authenticated', function_oid);
  end loop;
end;
$$;

commit;
