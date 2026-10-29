-- Security hardening: conversations and personal financial/workspace RPCs are
-- identity-bound. Keep authenticated execution and deny anonymous invocation.

begin;

revoke all on function public.get_my_client_refund_overview_v14() from public, anon;
grant execute on function public.get_my_client_refund_overview_v14() to authenticated;
revoke all on function public.get_my_coordinator_booking_details() from public, anon;
grant execute on function public.get_my_coordinator_booking_details() to authenticated;
revoke all on function public.get_my_coordinator_booking_fees() from public, anon;
grant execute on function public.get_my_coordinator_booking_fees() to authenticated;
revoke all on function public.get_my_coordinator_booking_statuses() from public, anon;
grant execute on function public.get_my_coordinator_booking_statuses() to authenticated;
revoke all on function public.get_my_coordinator_receivable_wallet() from public, anon;
grant execute on function public.get_my_coordinator_receivable_wallet() to authenticated;
revoke all on function public.get_my_coordinator_service_profile() from public, anon;
grant execute on function public.get_my_coordinator_service_profile() to authenticated;
revoke all on function public.get_my_event_payment_quote_v14(uuid) from public, anon;
grant execute on function public.get_my_event_payment_quote_v14(uuid) to authenticated;
revoke all on function public.get_my_event_remittance_details(uuid) from public, anon;
grant execute on function public.get_my_event_remittance_details(uuid) to authenticated;
revoke all on function public.get_my_provider_earnings(text) from public, anon;
grant execute on function public.get_my_provider_earnings(text) to authenticated;
revoke all on function public.get_my_provider_payment_confirmations() from public, anon;
grant execute on function public.get_my_provider_payment_confirmations() to authenticated;
revoke all on function public.get_my_provider_receivable_wallet() from public, anon;
grant execute on function public.get_my_provider_receivable_wallet() to authenticated;
revoke all on function public.get_v14_payment_settlement_context() from public, anon;
grant execute on function public.get_v14_payment_settlement_context() to authenticated;
revoke all on function public.mark_booking_conversation_read(uuid) from public, anon;
grant execute on function public.mark_booking_conversation_read(uuid) to authenticated;
revoke all on function public.open_booking_conversation(uuid) from public, anon;
grant execute on function public.open_booking_conversation(uuid) to authenticated;
revoke all on function public.open_coordinator_provider_conversation(uuid) from public, anon;
grant execute on function public.open_coordinator_provider_conversation(uuid) to authenticated;
revoke all on function public.open_event_coordinator_conversation(uuid) from public, anon;
grant execute on function public.open_event_coordinator_conversation(uuid) to authenticated;
revoke all on function public.send_booking_message(uuid, text) from public, anon;
grant execute on function public.send_booking_message(uuid, text) to authenticated;

commit;
