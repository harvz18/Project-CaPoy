-- These are internal helpers used by triggers or secured database functions.
-- None is invoked by the mobile or web client, so no API role needs EXECUTE.
begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.assert_v8_venue_booking_integrity(uuid)',
    'public.assign_coordinator_when_booked()',
    'public.build_service_snapshot(uuid)',
    'public.build_v15_preliminary_tasting_menu(uuid,uuid,integer,jsonb)',
    'public.create_v14_external_refund_obligation(uuid,text)',
    'public.credit_phase11_client_wallet_refund(uuid,text)',
    'public.ensure_booking_conversation(uuid)',
    'public.ensure_coordinator_provider_conversation(uuid)',
    'public.ensure_event_coordinator_conversation(uuid)',
    'public.event_payment_eligibility_v14(uuid)',
    'public.hold_phase11_coordinator_receivable(uuid,uuid)',
    'public.hold_phase11_provider_receivable(uuid)',
    'public.mark_declined_coordinator_as_unassigned()',
    'public.phase11_credit_cancelled_event_wallet_refunds()',
    'public.phase11_credit_declined_recipient_wallet_refund()',
    'public.phase11_event_local_date(text)',
    'public.phase11_provider_allocation_available_amount(uuid,uuid,uuid)',
    'public.phase11_receivable_is_release_eligible(uuid)',
    'public.phase14_provider_payout_request_is_bank_eligible(uuid)',
    'public.process_phase11_payout_eligibility(uuid)',
    'public.process_v15_food_tasting_deadlines()',
    'public.recalculate_composed_service_package(uuid)',
    'public.reconcile_coordinator_account_status()',
    'public.reconcile_coordinator_unavailability()',
    'public.refresh_event_payment_eligibility_v14(uuid)',
    'public.refresh_event_venue_from_selections(uuid,text)',
    'public.release_phase6_coordinator_initial_share(uuid,uuid)',
    'public.release_phase6_provider_initial_share(uuid)',
    'public.resolve_catering_tasting_slot(uuid,date,time without time zone,uuid)',
    'public.retry_event_coordinator_assignment(uuid)',
    'public.retry_waiting_coordinator_events()',
    'public.sanitize_platform_audit_state(text,jsonb)',
    'public.sync_unconfigured_coordinator_profile_from_listing(uuid)',
    'public.unlock_phase9_category_budget()',
    'public.v15_combined_package_context(uuid,uuid)',
    'public.v18_photo_video_booking_for_actor(uuid)',
    'public.validate_v18_photo_video_package()'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected internal helper function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon, authenticated', function_oid);
  end loop;
end;
$$;

commit;
