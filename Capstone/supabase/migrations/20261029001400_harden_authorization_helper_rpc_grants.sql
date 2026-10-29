-- RLS predicates and authenticated Edge Functions need these helpers, but
-- anonymous callers do not. Public marketplace read helpers stay unchanged.
begin;

do $$
declare
  function_signature text;
  function_oid regprocedure;
begin
  foreach function_signature in array array[
    'public.can_create_participant_notification(uuid,text,uuid)',
    'public.can_provider_view_instruction(uuid,uuid,uuid)',
    'public.can_reference_my_support_context(uuid,uuid)',
    'public.can_send_booking_message(uuid)',
    'public.can_view_booked_package(uuid)',
    'public.can_view_booked_service(uuid)',
    'public.can_view_booking_conversation(uuid)',
    'public.can_view_provider_profile(uuid)',
    'public.coordinator_active_workload(uuid,uuid)',
    'public.has_permission(text)',
    'public.is_booking_counterpart(uuid)',
    'public.is_conversation_participant(uuid)',
    'public.is_event_booking_provider(uuid)',
    'public.is_event_owner(uuid)',
    'public.is_platform_staff()',
    'public.is_platform_superadmin()',
    'public.is_valid_booking_message_member(uuid,boolean)',
    'public.is_valid_client_provider_message_member(uuid,boolean)',
    'public.is_valid_coordinator_provider_message_member(uuid,boolean)',
    'public.is_valid_event_coordinator_message_member(uuid,boolean)',
    'public.user_has_permission(uuid,text)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected authorization helper function % does not exist.', function_signature;
    end if;

    execute format('revoke all on function %s from public, anon', function_oid);
    execute format('grant execute on function %s to authenticated', function_oid);
  end loop;
end;
$$;

commit;
