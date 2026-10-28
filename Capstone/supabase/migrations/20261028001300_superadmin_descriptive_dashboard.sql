-- Superadmin governance dashboard: descriptive account, access-control, and
-- operational analytics. This is read-only and intentionally avoids invented
-- infrastructure health or financial metrics.

begin;

create function public.get_superadmin_dashboard_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status = 'active'
      and profile.default_role = 'superadmin'
  ) then
    raise exception 'Superadmin access is required.' using errcode = '42501';
  end if;

  with
  account_totals as (
    select
      count(*)::integer as total_accounts,
      count(*) filter (where account_status in ('active', 'verified'))::integer as active_accounts,
      count(*) filter (where account_status = 'disabled')::integer as disabled_accounts,
      count(*) filter (where default_role in ('admin', 'superadmin', 'assistant', 'customer_service'))::integer as internal_staff,
      count(*) filter (where created_at >= date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')::integer as accounts_this_month
    from public.profiles
  ),
  role_distribution as (
    select
      coalesce(nullif(trim(profile.default_role::text), ''), 'unassigned') as role,
      count(*)::integer as accounts,
      count(*) filter (where profile.account_status in ('active', 'verified'))::integer as active_accounts
    from public.profiles profile
    group by 1
  ),
  status_distribution as (
    select profile.account_status::text as status, count(*)::integer as accounts
    from public.profiles profile
    group by 1
  ),
  monthly_account_buckets as (
    select generate_series(
      date_trunc('month', (now() at time zone 'Asia/Manila') - interval '5 months'),
      date_trunc('month', now() at time zone 'Asia/Manila'),
      interval '1 month'
    )::timestamp without time zone as month_start
  ),
  monthly_account_growth as (
    select
      bucket.month_start,
      count(profile.id)::integer as accounts
    from monthly_account_buckets bucket
    left join public.profiles profile
      on profile.created_at >= bucket.month_start at time zone 'Asia/Manila'
     and profile.created_at < (bucket.month_start + interval '1 month') at time zone 'Asia/Manila'
    group by bucket.month_start
  ),
  system_totals as (
    select
      (select count(*)::integer from public.roles) as configured_roles,
      (select count(*)::integer from public.permissions) as configured_permissions,
      (select count(*)::integer from public.role_permissions) as role_permission_grants,
      (select count(*)::integer from public.user_permissions) as user_permission_overrides,
      (select count(*)::integer from public.services where status = 'active') as active_services,
      (select count(*)::integer from public.services where status = 'pending_review') as pending_service_reviews,
      (select count(*)::integer from public.provider_profiles where verification_status = 'pending') as pending_provider_reviews
  ),
  audit_totals as (
    select
      count(*)::integer as recorded_actions,
      count(*) filter (where created_at >= now() - interval '24 hours')::integer as actions_last_24_hours,
      count(*) filter (where created_at >= now() - interval '30 days')::integer as actions_last_30_days,
      count(*) filter (where result in ('failed', 'failure', 'error'))::integer as recorded_failures_30_days
    from public.audit_logs
    where created_at >= now() - interval '30 days'
  ),
  frequent_actions as (
    select action, count(*)::integer as occurrences
    from public.audit_logs
    where created_at >= now() - interval '30 days'
    group by action
    order by count(*) desc, action asc
    limit 6
  ),
  recent_audit as (
    select
      audit.id,
      audit.action,
      audit.resource_type,
      audit.result,
      audit.created_at,
      actor.full_name as actor_name,
      audit.actor_role::text as actor_role
    from public.audit_logs audit
    left join public.profiles actor on actor.id = audit.actor_id
    order by audit.created_at desc
    limit 8
  )
  select jsonb_build_object(
    'generated_at', now(),
    'accounts', (select to_jsonb(account_totals) from account_totals),
    'roles', coalesce((select jsonb_agg(jsonb_build_object('role', role, 'accounts', accounts, 'active_accounts', active_accounts) order by accounts desc, role asc) from role_distribution), '[]'::jsonb),
    'statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'accounts', accounts) order by accounts desc, status asc) from status_distribution), '[]'::jsonb),
    'account_growth', coalesce((select jsonb_agg(jsonb_build_object('key', to_char(month_start, 'YYYY-MM'), 'label', to_char(month_start, 'Mon'), 'accounts', accounts) order by month_start) from monthly_account_growth), '[]'::jsonb),
    'system', (select to_jsonb(system_totals) from system_totals),
    'audit', (select to_jsonb(audit_totals) from audit_totals),
    'top_audit_actions', coalesce((select jsonb_agg(jsonb_build_object('action', action, 'occurrences', occurrences) order by occurrences desc, action asc) from frequent_actions), '[]'::jsonb),
    'recent_audit', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'action', action, 'resource_type', resource_type, 'result', result, 'created_at', created_at, 'actor_name', actor_name, 'actor_role', actor_role) order by created_at desc) from recent_audit), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_superadmin_dashboard_analytics() from public;
grant execute on function public.get_superadmin_dashboard_analytics() to authenticated;

comment on function public.get_superadmin_dashboard_analytics() is
  'Read-only Superadmin-only governance analytics for account, access-control, service-review, and audit data.';

commit;
