-- MULTIVENT Phase 9: audit logging and security hardening.
-- Apply after 37_revenue_commission_cashflow.sql.

begin;

create index if not exists audit_logs_action_date_idx
  on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_result_date_idx
  on public.audit_logs (result, created_at desc);

-- Keep useful change history while excluding contact details, message bodies,
-- free-form support content, payment references, and large private payloads.
create or replace function public.sanitize_platform_audit_state(
  target_table text,
  target_state jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
begin
  if target_state is null then return null; end if;

  return case target_table
    when 'profiles' then target_state - array['email', 'phone', 'avatar_url']
    when 'provider_profiles' then target_state - array['contact_email', 'contact_phone', 'description']
    when 'services' then target_state - array['description', 'last_approved_snapshot']
    when 'messages' then target_state - array['body']
    when 'support_messages' then target_state - array['body']
    when 'support_tickets' then target_state - array['description']
    when 'payments' then target_state - array['provider_reference']
    when 'cash_remittances' then target_state - array['notes']
    when 'coordination_tasks' then target_state - array['description']
    when 'provider_availability' then target_state - array['notes']
    when 'provider_payout_requests' then target_state - array['notes']
    when 'provider_service_listing_drafts' then target_state - array['payload']
    when 'provider_notification_preferences' then target_state - array['preferences']
    else target_state
  end;
end;
$$;

revoke all on function public.sanitize_platform_audit_state(text, jsonb) from public;

create or replace function public.capture_platform_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_state jsonb;
  after_state jsonb;
  audit_actor_id uuid := auth.uid();
  audit_actor_role public.user_role;
  audit_resource_id uuid;
  audit_action text;
begin
  before_state := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_state := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  select profile.default_role into audit_actor_role
  from public.profiles profile
  where profile.id = audit_actor_id;

  if audit_actor_role is null and tg_table_name = 'profiles' and tg_op = 'INSERT' then
    audit_actor_role := (after_state ->> 'default_role')::public.user_role;
  end if;

  audit_resource_id := nullif(coalesce(
    after_state ->> 'id', before_state ->> 'id',
    after_state ->> 'user_id', before_state ->> 'user_id',
    after_state ->> 'role_id', before_state ->> 'role_id'
  ), '')::uuid;
  audit_action := tg_table_name || '.' || lower(tg_op);

  if tg_table_name = 'services' then
    audit_action := case
      when tg_op = 'INSERT' then 'service.created'
      when tg_op = 'DELETE' or after_state ->> 'status' = 'deleted' then 'service.deleted'
      when audit_actor_role = 'service_provider' then 'service.updated'
      else 'service.updated_by_staff'
    end;

    -- The review RPC records the decision, reason, and submission kind.
    if tg_op = 'UPDATE'
      and before_state ->> 'status' is distinct from after_state ->> 'status'
      and after_state ->> 'status' in ('active', 'rejected')
      and (
        public.user_has_permission(audit_actor_id, 'services.approve')
        or public.user_has_permission(audit_actor_id, 'services.reject')
      )
    then return null;
    end if;
  elsif tg_table_name = 'service_packages' then
    audit_action := 'service_package.' || lower(tg_op);
  elsif tg_table_name = 'profiles' then
    audit_action := 'profile.' || lower(tg_op);

    -- The account-status RPC records a reason and clearer action.
    if tg_op = 'UPDATE'
      and before_state ->> 'account_status' is distinct from after_state ->> 'account_status'
      and public.user_has_permission(audit_actor_id, 'users.update')
    then return null;
    end if;
  elsif tg_table_name = 'provider_profiles' then
    audit_action := 'provider_profile.' || lower(tg_op);

    -- The provider-review RPC records the reason and explicit decision.
    if tg_op = 'UPDATE'
      and before_state ->> 'verification_status' is distinct from after_state ->> 'verification_status'
      and (
        public.user_has_permission(audit_actor_id, 'providers.approve')
        or public.user_has_permission(audit_actor_id, 'providers.reject')
      )
    then return null;
    end if;
  elsif tg_table_name = 'messages' then
    audit_action := case when tg_op = 'INSERT' then 'message.sent' else 'message.updated' end;
  elsif tg_table_name = 'user_roles' then
    audit_action := 'user_role.' || lower(tg_op);
  elsif tg_table_name = 'coordinator_assignment_attempts' then
    audit_action := 'coordinator.assignment_attempt.' || lower(tg_op);
  elsif tg_table_name = 'financial_transactions' then
    audit_action := 'finance.ledger.' || lower(tg_op);
  elsif tg_table_name = 'cash_remittances' then
    audit_action := 'finance.cash_remittance.' || lower(tg_op);
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    audit_actor_id, audit_actor_role, audit_action, tg_table_name, audit_resource_id,
    public.sanitize_platform_audit_state(tg_table_name, before_state),
    public.sanitize_platform_audit_state(tg_table_name, after_state),
    'completed',
    jsonb_build_object(
      'operation', lower(tg_op),
      'schema', tg_table_schema,
      'table', tg_table_name
    )
  );

  return null;
end;
$$;

revoke all on function public.capture_platform_audit() from public;

-- Rebuild the audited-table list once so repeated migration runs stay clean.
do $$
declare
  audited_table text;
begin
  foreach audited_table in array array[
    'profiles', 'provider_profiles', 'services', 'service_packages',
    'events', 'bookings', 'payments', 'reviews', 'messages',
    'coordination_tasks', 'user_roles', 'provider_availability',
    'provider_operating_hours', 'provider_payout_requests',
    'coordinator_availability', 'coordinator_assignment_attempts',
    'financial_transactions', 'cash_remittances'
  ] loop
    execute format(
      'drop trigger if exists capture_platform_audit_trigger on public.%I',
      audited_table
    );
    execute format(
      'create trigger capture_platform_audit_trigger after insert or update or delete on public.%I for each row execute function public.capture_platform_audit()',
      audited_table
    );
  end loop;
end;
$$;

-- Audit history is append-only for application roles. The maintenance flag is
-- reserved for an explicit service-role retention or legal-removal procedure.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role'
    and current_setting('app.audit_maintenance_authorized', true) = 'true'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Audit history is append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_audit_log_mutation_trigger on public.audit_logs;
create trigger prevent_audit_log_mutation_trigger
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();
revoke all on function public.prevent_audit_log_mutation() from public;

drop policy if exists "Authorized staff can view audit logs" on public.audit_logs;
create policy "Authorized staff can view audit logs"
  on public.audit_logs for select to authenticated
  using (public.has_permission('system.audit_logs'));

revoke insert, update, delete, truncate on table public.audit_logs from anon, authenticated;
grant select on table public.audit_logs to authenticated;

-- Providers may create payout requests, but cannot approve, rewrite, cancel,
-- or delete their own financial request after submission.
drop policy if exists "Providers manage owned payout requests" on public.provider_payout_requests;
drop policy if exists "Providers view owned payout requests" on public.provider_payout_requests;
create policy "Providers view owned payout requests"
  on public.provider_payout_requests for select to authenticated
  using (exists (
    select 1 from public.provider_profiles provider
    where provider.id = provider_payout_requests.provider_id
      and provider.user_id = auth.uid()
  ));

drop policy if exists "Providers create owned payout requests" on public.provider_payout_requests;
create policy "Providers create owned payout requests"
  on public.provider_payout_requests for insert to authenticated
  with check (
    status = 'requested'
    and processed_at is null
    and exists (
      select 1 from public.provider_profiles provider
      where provider.id = provider_payout_requests.provider_id
        and provider.user_id = auth.uid()
    )
  );

create or replace function public.protect_provider_payout_request_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.processed_at := null;
    new.requested_at := now();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  raise exception 'Payout request changes require an authorized financial workflow.' using errcode = '42501';
end;
$$;

drop trigger if exists protect_provider_payout_request_fields_trigger
  on public.provider_payout_requests;
create trigger protect_provider_payout_request_fields_trigger
before insert or update on public.provider_payout_requests
for each row execute function public.protect_provider_payout_request_fields();
revoke all on function public.protect_provider_payout_request_fields() from public;

revoke update, delete on table public.provider_payout_requests from authenticated;
grant select, insert on table public.provider_payout_requests to authenticated;

-- These records are changed only by audited security-definer workflows.
revoke insert, update, delete, truncate
  on table public.roles, public.permissions, public.role_permissions,
    public.user_roles, public.user_permissions, public.financial_transactions,
    public.cash_remittances, public.system_settings
  from anon, authenticated;

grant select
  on table public.roles, public.permissions, public.role_permissions,
    public.user_roles, public.user_permissions, public.financial_transactions,
    public.cash_remittances, public.system_settings
  to authenticated;

-- Server-filtered audit access avoids broad browser scans and preserves the
-- same permission check for every consumer.
create or replace function public.list_platform_audit_entries(
  search_text text default null,
  resource_filter text default null,
  action_filter text default null,
  result_filter text default null,
  range_start timestamptz default null,
  range_end timestamptz default null,
  page_limit integer default 100,
  page_offset integer default 0
)
returns table (
  id uuid,
  actor_id uuid,
  actor_role text,
  actor_name text,
  actor_email text,
  action text,
  resource_type text,
  resource_id uuid,
  previous_state jsonb,
  new_state jsonb,
  result text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('system.audit_logs') then
    raise exception 'Audit-log access is required.' using errcode = '42501';
  end if;

  return query
  select audit.id,
    audit.actor_id,
    audit.actor_role::text,
    profile.full_name,
    profile.email,
    audit.action,
    audit.resource_type,
    audit.resource_id,
    audit.previous_state,
    audit.new_state,
    audit.result,
    audit.metadata,
    audit.created_at,
    count(*) over() as total_count
  from public.audit_logs audit
  left join public.profiles profile on profile.id = audit.actor_id
  where (nullif(trim(search_text), '') is null or (
      audit.action ilike '%' || trim(search_text) || '%'
      or audit.resource_type ilike '%' || trim(search_text) || '%'
      or coalesce(audit.resource_id::text, '') ilike '%' || trim(search_text) || '%'
      or coalesce(profile.full_name, '') ilike '%' || trim(search_text) || '%'
      or coalesce(profile.email, '') ilike '%' || trim(search_text) || '%'
    ))
    and (nullif(resource_filter, '') is null or resource_filter = 'all' or audit.resource_type = resource_filter)
    and (nullif(action_filter, '') is null or action_filter = 'all' or audit.action = action_filter)
    and (nullif(result_filter, '') is null or result_filter = 'all' or audit.result = result_filter)
    and (range_start is null or audit.created_at >= range_start)
    and (range_end is null or audit.created_at <= range_end)
  order by audit.created_at desc, audit.id desc
  limit greatest(1, least(coalesce(page_limit, 100), 500))
  offset greatest(coalesce(page_offset, 0), 0);
end;
$$;

create or replace function public.get_audit_security_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary_payload jsonb;
begin
  if not public.has_permission('system.audit_logs') then
    raise exception 'Audit-log access is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_entries', count(*),
    'last_24_hours', count(*) filter (where audit.created_at >= now() - interval '24 hours'),
    'last_7_days', count(*) filter (where audit.created_at >= now() - interval '7 days'),
    'distinct_actors_30_days', count(distinct audit.actor_id) filter (
      where audit.created_at >= now() - interval '30 days'
    ),
    'permission_changes_30_days', count(*) filter (
      where audit.created_at >= now() - interval '30 days'
        and (audit.action like 'permission.%' or audit.resource_type in ('user_roles', 'role_permissions', 'user_permissions'))
    ),
    'financial_changes_30_days', count(*) filter (
      where audit.created_at >= now() - interval '30 days'
        and (audit.action like 'finance.%' or audit.action like 'commission.%')
    ),
    'coordinator_changes_30_days', count(*) filter (
      where audit.created_at >= now() - interval '30 days'
        and audit.action like 'coordinator.%'
    ),
    'oldest_entry_at', min(audit.created_at),
    'newest_entry_at', max(audit.created_at)
  ) into summary_payload
  from public.audit_logs audit;

  return summary_payload;
end;
$$;

revoke all on function public.list_platform_audit_entries(text, text, text, text, timestamptz, timestamptz, integer, integer) from public;
revoke all on function public.get_audit_security_summary() from public;
grant execute on function public.list_platform_audit_entries(text, text, text, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_audit_security_summary() to authenticated;

comment on function public.list_platform_audit_entries(text, text, text, text, timestamptz, timestamptz, integer, integer) is
  'Permission-scoped, server-filtered audit history with redacted row state.';
comment on function public.get_audit_security_summary() is
  'Read-only governance summary for authorized audit viewers.';
comment on function public.prevent_audit_log_mutation() is
  'Makes application audit history append-only; maintenance requires an explicit transaction-local flag.';

commit;
