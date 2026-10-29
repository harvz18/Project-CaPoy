-- Security hardening: planning, selection, coordinator-workspace, feedback,
-- and event-day RPCs require the caller's authenticated identity.

begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.assign_event_coordinator_only(uuid,uuid)',
    'public.choose_coordinator_package_phase9(uuid,uuid,jsonb,boolean)',
    'public.remove_event_coordinator(uuid)',
    'public.remove_event_coordinator_and_package(uuid)',
    'public.review_my_saved_booking_plan(uuid)',
    'public.review_my_saved_booking_plan_v9_initial(uuid)',
    'public.save_my_booking_plan_for_later(uuid)',
    'public.save_my_catering_menu_service_selection(uuid,uuid,jsonb,text,text,boolean)',
    'public.save_my_catering_service_selection_v10(uuid,uuid,integer,text,uuid,jsonb,text,text,boolean)',
    'public.save_my_catering_service_selection_v15(uuid,uuid,integer,text,uuid,jsonb,boolean,text,text,boolean)',
    'public.save_my_catering_tasting_draft_v15(uuid,uuid,integer,jsonb,integer)',
    'public.save_my_church_wedding_arrangement(uuid,text,text,text,text,date,time without time zone,text,text)',
    'public.save_my_church_wedding_arrangement_v7(uuid,text,text,text,text,double precision,double precision,date,time without time zone,text,text)',
    'public.save_my_coordinator_package(uuid,text,text,text,text,uuid[])',
    'public.save_my_coordinator_service_profile(text,numeric,text[],boolean)',
    'public.save_my_coordinator_service_profile_v9(text,numeric,text[],integer,text[],text[],text[],text[],text,text[],text,boolean)',
    'public.save_my_event_budget_allocations(uuid,numeric,jsonb)',
    'public.save_my_event_budget_allocations_phase9(uuid,numeric,jsonb)',
    'public.save_my_event_service_selection(uuid,uuid,uuid,text,numeric,text,text,boolean)',
    'public.save_my_florist_service_selection_v17(uuid,uuid,jsonb,text,boolean)',
    'public.save_my_photo_video_event_day_update_v18(uuid,jsonb)',
    'public.save_my_photo_video_pre_event_plan_v18(uuid,jsonb)',
    'public.save_my_photo_video_service_selection_v18(uuid,uuid,jsonb,text,boolean)',
    'public.save_my_photo_video_shot_list_v18(uuid,text)',
    'public.save_my_v15_venue_catering_package_selection(uuid,uuid,integer,text,jsonb)',
    'public.save_my_venue_service_selection_v8(uuid,uuid,jsonb,text,boolean)',
    'public.set_event_coordinator_preference(uuid,text)',
    'public.set_my_category_budget_allocation(uuid,text,numeric)',
    'public.set_my_coordinator_package_status(uuid,text)',
    'public.stage_my_booking_replacement(uuid,uuid)',
    'public.start_my_booking_replacement(uuid)',
    'public.submit_event_feedback_v2(uuid,jsonb,integer,text)',
    'public.submit_my_catering_food_tasting_request_v15(uuid,uuid,integer,jsonb)',
    'public.submit_my_v15_venue_catering_food_tasting_request(uuid,uuid,integer,jsonb)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected planning/workspace function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon', function_oid);
    execute format('grant execute on function %s to authenticated', function_oid);
  end loop;
end;
$$;

commit;
