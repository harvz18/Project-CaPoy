-- MULTIVENT platform audit trail and provider service deletion
-- Apply after 21_service_moderation_workflow.sql.
-- Logs meaningful data-changing actions. Read-only page views, searches, and
-- low-level server/runtime events are intentionally not logged.

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);

create or replace function public.capture_platform_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_state jsonb;
  after_state jsonb;
  clean_before jsonb;
  clean_after jsonb;
  audit_actor_id uuid := auth.uid();
  audit_actor_role public.user_role;
  audit_resource_id uuid;
  audit_action text;
begin
  before_state := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  after_state := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  select default_role into audit_actor_role
  from public.profiles
  where id = audit_actor_id;

  if audit_actor_role is null and tg_table_name = 'profiles' and tg_op = 'INSERT' then
    audit_actor_role := (after_state ->> 'default_role')::public.user_role;
  end if;

  audit_resource_id := nullif(
    coalesce(after_state ->> 'id', before_state ->> 'id', after_state ->> 'user_id', before_state ->> 'user_id'),
    ''
  )::uuid;

  audit_action := tg_table_name || '.' || lower(tg_op);

  if tg_table_name = 'services' then
    audit_action := case
      when tg_op = 'INSERT' then 'service.created'
      when tg_op = 'DELETE' then 'service.deleted'
      when after_state ->> 'status' = 'deleted' then 'service.deleted'
      when audit_actor_role = 'service_provider' then 'service.updated'
      else 'service.updated_by_staff'
    end;

    -- admin_review_service already writes a richer decision-specific record.
    if tg_op = 'UPDATE'
      and audit_actor_role in ('admin', 'superadmin')
      and before_state ->> 'status' is distinct from after_state ->> 'status'
      and after_state ->> 'status' in ('active', 'rejected')
    then
      return null;
    end if;
  elsif tg_table_name = 'service_packages' then
    audit_action := 'service_package.' || lower(tg_op);
  elsif tg_table_name = 'profiles' then
    audit_action := 'profile.' || lower(tg_op);

    -- The account-status RPC records a reason and a clearer action.
    if tg_op = 'UPDATE'
      and audit_actor_role in ('admin', 'superadmin')
      and before_state ->> 'account_status' is distinct from after_state ->> 'account_status'
    then
      return null;
    end if;
  elsif tg_table_name = 'provider_profiles' then
    audit_action := 'provider_profile.' || lower(tg_op);

    -- The provider-verification RPC already writes the full decision.
    if tg_op = 'UPDATE'
      and audit_actor_role in ('admin', 'superadmin')
      and before_state ->> 'verification_status' is distinct from after_state ->> 'verification_status'
    then
      return null;
    end if;
  elsif tg_table_name = 'messages' then
    audit_action := case when tg_op = 'INSERT' then 'message.sent' else 'message.updated' end;
  elsif tg_table_name = 'user_roles' then
    audit_action := 'user_role.' || lower(tg_op);
  end if;

  -- Avoid storing message bodies and other unnecessary private payloads.
  clean_before := case
    when before_state is null then null
    when tg_table_name = 'messages' then before_state - 'body'
    when tg_table_name = 'services' then before_state - 'last_approved_snapshot'
    else before_state
  end;
  clean_after := case
    when after_state is null then null
    when tg_table_name = 'messages' then after_state - 'body'
    when tg_table_name = 'services' then after_state - 'last_approved_snapshot'
    else after_state
  end;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    previous_state,
    new_state,
    result,
    metadata
  ) values (
    audit_actor_id,
    audit_actor_role,
    audit_action,
    tg_table_name,
    audit_resource_id,
    clean_before,
    clean_after,
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

do $$
declare
  audited_table text;
begin
  foreach audited_table in array array[
    'profiles',
    'provider_profiles',
    'services',
    'service_packages',
    'events',
    'bookings',
    'payments',
    'reviews',
    'messages',
    'coordination_tasks',
    'user_roles',
    'provider_availability',
    'provider_operating_hours',
    'provider_payout_requests'
  ]
  loop
    execute format('drop trigger if exists capture_platform_audit_trigger on public.%I', audited_table);
    execute format(
      'create trigger capture_platform_audit_trigger after insert or update or delete on public.%I for each row execute function public.capture_platform_audit()',
      audited_table
    );
  end loop;
end;
$$;

create or replace function public.provider_delete_service(target_service_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_provider_id uuid;
  target_name text;
begin
  select provider_profiles.id into current_provider_id
  from public.provider_profiles
  where provider_profiles.user_id = auth.uid();

  if current_provider_id is null then
    raise exception 'Service-provider access is required';
  end if;

  select name into target_name
  from public.services
  where id = target_service_id
    and provider_id = current_provider_id
  for update;

  if target_name is null then
    raise exception 'Service not found or does not belong to this provider';
  end if;

  perform set_config('app.service_delete_authorized', 'true', true);

  if exists (select 1 from public.bookings where service_id = target_service_id) then
    -- Preserve the service row referenced by historical bookings, but remove it
    -- from all provider/client lists and from marketplace visibility.
    update public.services
    set status = 'deleted',
        moderation_note = 'Deleted by provider',
        moderated_at = now(),
        moderated_by = null,
        updated_at = now()
    where id = target_service_id;

    update public.service_packages
    set is_active = false,
        updated_at = now()
    where service_id = target_service_id;
  else
    delete from public.services where id = target_service_id;
  end if;
end;
$$;

revoke all on function public.provider_delete_service(uuid) from public;
grant execute on function public.provider_delete_service(uuid) to authenticated;
