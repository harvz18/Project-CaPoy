-- Security hardening: high-impact RPCs must never inherit anonymous execution
-- from PostgreSQL's default PUBLIC function grant. All listed RPCs are called
-- from authenticated client or staff flows and retain authenticated execution.

begin;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from public;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;

revoke all on function public.admin_set_provider_verification(uuid, public.account_status) from public;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status) to authenticated;

revoke all on function public.admin_set_provider_verification(uuid, public.account_status, text) from public;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status, text) to authenticated;

revoke all on function public.approve_v14_provider_bank_payout(uuid, text) from public;
grant execute on function public.approve_v14_provider_bank_payout(uuid, text) to authenticated;

revoke all on function public.complete_v14_provider_bank_payout(uuid, text, text) from public;
grant execute on function public.complete_v14_provider_bank_payout(uuid, text, text) to authenticated;

revoke all on function public.fail_v14_provider_bank_payout(uuid, text, text) from public;
grant execute on function public.fail_v14_provider_bank_payout(uuid, text, text) to authenticated;

revoke all on function public.start_v14_provider_bank_payout(uuid, text) from public;
grant execute on function public.start_v14_provider_bank_payout(uuid, text) to authenticated;

revoke all on function public.record_v14_refund_disbursement(uuid, text, text, text) from public;
grant execute on function public.record_v14_refund_disbursement(uuid, text, text, text) to authenticated;

revoke all on function public.verify_v14_payment_settlement(uuid, text, text) from public;
grant execute on function public.verify_v14_payment_settlement(uuid, text, text) to authenticated;

revoke all on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) from public;
grant execute on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) to authenticated;

revoke all on function public.record_provider_direct_payment(uuid, text, text) from public;
grant execute on function public.record_provider_direct_payment(uuid, text, text) to authenticated;

revoke all on function public.request_my_provider_payout(numeric) from public;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;

revoke all on function public.save_my_provider_payout_account(text, text, text, text, boolean) from public;
grant execute on function public.save_my_provider_payout_account(text, text, text, text, boolean) to authenticated;

revoke all on function public.cancel_client_event_bookings(uuid, text) from public;
grant execute on function public.cancel_client_event_bookings(uuid, text) to authenticated;

revoke all on function public.reschedule_client_event_bookings(uuid, date, time without time zone) from public;
grant execute on function public.reschedule_client_event_bookings(uuid, date, time without time zone) to authenticated;

revoke all on function public.respond_to_provider_booking(uuid, boolean, text) from public;
grant execute on function public.respond_to_provider_booking(uuid, boolean, text) to authenticated;

revoke all on function public.submit_my_event_booking_requests_v14(uuid) from public;
grant execute on function public.submit_my_event_booking_requests_v14(uuid) to authenticated;

revoke all on function public.provider_delete_package(uuid) from public;
grant execute on function public.provider_delete_package(uuid) to authenticated;

revoke all on function public.provider_delete_service(uuid) from public;
grant execute on function public.provider_delete_service(uuid) to authenticated;

revoke all on function public.provider_save_composed_package(uuid, uuid[], text, text, jsonb, text, numeric) from public;
grant execute on function public.provider_save_composed_package(uuid, uuid[], text, text, jsonb, text, numeric) to authenticated;

revoke all on function public.provider_save_v15_venue_catering_package(uuid, uuid, uuid, text, text, text, jsonb, text, numeric) from public;
grant execute on function public.provider_save_v15_venue_catering_package(uuid, uuid, uuid, text, text, text, jsonb, text, numeric) to authenticated;

revoke all on function public.provider_set_service_availability(uuid, boolean) from public;
grant execute on function public.provider_set_service_availability(uuid, boolean) to authenticated;

revoke all on function public.superadmin_set_role_permission(text, text, boolean) from public;
grant execute on function public.superadmin_set_role_permission(text, text, boolean) to authenticated;

revoke all on function public.superadmin_set_user_permission(uuid, text, boolean) from public;
grant execute on function public.superadmin_set_user_permission(uuid, text, boolean) to authenticated;

revoke all on function public.superadmin_upsert_system_setting(text, jsonb, text) from public;
grant execute on function public.superadmin_upsert_system_setting(text, jsonb, text) to authenticated;

commit;
