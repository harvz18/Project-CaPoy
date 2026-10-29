-- Follow-up to 20261029000300: Supabase grants these RPCs directly to anon,
-- rather than only through PostgreSQL's PUBLIC role. Preserve authenticated
-- execution while explicitly denying anonymous invocation.

begin;

revoke all on function public.admin_review_service(uuid, text, text) from anon;
revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from anon;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status) from anon;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status, text) from anon;
revoke all on function public.approve_v14_provider_bank_payout(uuid, text) from anon;
revoke all on function public.complete_v14_provider_bank_payout(uuid, text, text) from anon;
revoke all on function public.fail_v14_provider_bank_payout(uuid, text, text) from anon;
revoke all on function public.start_v14_provider_bank_payout(uuid, text) from anon;
revoke all on function public.record_v14_refund_disbursement(uuid, text, text, text) from anon;
revoke all on function public.verify_v14_payment_settlement(uuid, text, text) from anon;
revoke all on function public.initiate_my_event_payment_v14(uuid, text, text, boolean) from anon;
revoke all on function public.record_provider_direct_payment(uuid, text, text) from anon;
revoke all on function public.request_my_provider_payout(numeric) from anon;
revoke all on function public.save_my_provider_payout_account(text, text, text, text, boolean) from anon;
revoke all on function public.cancel_client_event_bookings(uuid, text) from anon;
revoke all on function public.reschedule_client_event_bookings(uuid, date, time without time zone) from anon;
revoke all on function public.respond_to_provider_booking(uuid, boolean, text) from anon;
revoke all on function public.submit_my_event_booking_requests_v14(uuid) from anon;
revoke all on function public.provider_delete_package(uuid) from anon;
revoke all on function public.provider_delete_service(uuid) from anon;
revoke all on function public.provider_save_composed_package(uuid, uuid[], text, text, jsonb, text, numeric) from anon;
revoke all on function public.provider_save_v15_venue_catering_package(uuid, uuid, uuid, text, text, text, jsonb, text, numeric) from anon;
revoke all on function public.provider_set_service_availability(uuid, boolean) from anon;
revoke all on function public.superadmin_set_role_permission(text, text, boolean) from anon;
revoke all on function public.superadmin_set_user_permission(uuid, text, boolean) from anon;
revoke all on function public.superadmin_upsert_system_setting(text, jsonb, text) from anon;

commit;
