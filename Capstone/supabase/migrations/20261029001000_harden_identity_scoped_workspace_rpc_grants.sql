-- Identity-scoped workspace RPCs require a signed-in caller. Public discovery
-- functions and policy helpers are deliberately not included in this batch.
begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.activate_my_v15_food_tasting_direct_menu_fallback(uuid)',
    'public.calculate_my_florist_service_quote_v17(uuid,uuid,jsonb)',
    'public.calculate_my_photo_video_service_quote_v18(uuid,uuid,jsonb)',
    'public.confirm_my_church_wedding_arrangement(uuid,text,text)',
    'public.confirm_my_photo_video_pre_event_plan_v18(uuid)',
    'public.confirm_my_v15_food_tasting_attendance(uuid)',
    'public.continue_my_event_planning_after_v15_food_tasting_request(uuid,uuid)',
    'public.get_my_church_wedding_arrangements()',
    'public.get_my_church_wedding_arrangements_v7()',
    'public.get_my_church_wedding_event_flags()',
    'public.get_my_client_wallet()',
    'public.get_my_coordinator_assignment_context()',
    'public.get_my_coordinator_instructions()',
    'public.get_my_coordinator_packages()',
    'public.get_my_staff_access()',
    'public.list_my_budget_aware_service_recommendations(uuid)',
    'public.list_my_budget_aware_service_recommendations_phase9(uuid)',
    'public.list_my_catering_food_tasting_slots(uuid)',
    'public.list_my_catering_food_tasting_workflows_v15(uuid[])',
    'public.list_my_catering_food_tasting_workflows_v15_phase5(uuid[])',
    'public.list_my_catering_food_tastings(uuid[])',
    'public.list_my_support_context()',
    'public.list_my_v15_catering_food_tasting_reschedule_slots(uuid)',
    'public.list_my_v15_catering_food_tasting_slots(uuid)',
    'public.load_my_catering_tasting_draft_v15(uuid,uuid)',
    'public.request_my_catering_food_tasting(uuid,date,time without time zone,text)',
    'public.reschedule_my_v15_catering_food_tasting(uuid,date,time without time zone,text)',
    'public.respond_my_church_wedding_proposal(uuid,boolean,text)',
    'public.respond_to_my_catering_food_tasting_proposal(uuid,boolean)',
    'public.respond_to_my_photo_video_event_day_request_v18(uuid,uuid,boolean)',
    'public.respond_to_my_v15_food_tasting_final_menu(uuid,boolean,text)',
    'public.schedule_my_v15_catering_food_tasting(uuid,date,time without time zone,text)',
    'public.submit_my_v15_food_tasting_final_menu(uuid,jsonb)',
    'public.validate_my_phase9_selections(uuid)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected identity-scoped workspace function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon', function_oid);
    execute format('grant execute on function %s to authenticated', function_oid);
  end loop;
end;
$$;

commit;
