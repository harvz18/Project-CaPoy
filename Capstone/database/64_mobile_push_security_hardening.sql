-- MULTIVENT mobile push security hardening.
-- Apply after 63_mobile_session_push_notifications.sql.

begin;

-- Supabase project defaults may grant new public-schema objects directly to
-- API roles. RLS already blocks unauthorized rows, but remove those broader
-- object grants as defense in depth and expose only the intended operations.
revoke all on table public.user_push_tokens from public, anon, authenticated;
grant select, delete on table public.user_push_tokens to authenticated;

revoke all on function public.register_my_push_token(text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.revoke_my_push_token(text)
  from public, anon, authenticated;
revoke all on function public.dispatch_mobile_push_notification()
  from public, anon, authenticated;

grant execute on function public.register_my_push_token(text, text, text, text)
  to authenticated;
grant execute on function public.revoke_my_push_token(text)
  to authenticated;

comment on function public.dispatch_mobile_push_notification() is
  'Trigger-only generic mobile alert dispatcher; direct API execution is denied.';

commit;
