-- MULTIVENT administrator web console access
-- Apply after the existing schema and booking security migrations.
-- Grants authenticated admin/superadmin accounts read access to operational
-- records and exposes narrow, audited functions for privileged mutations.

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.default_role in ('admin', 'superadmin')
      and profiles.account_status = 'active'
  );
$$;

create or replace function public.is_platform_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.default_role = 'superadmin'
      and profiles.account_status = 'active'
  );
$$;

revoke all on function public.is_platform_staff() from public;
revoke all on function public.is_platform_superadmin() from public;
grant execute on function public.is_platform_staff() to authenticated;
grant execute on function public.is_platform_superadmin() to authenticated;

-- Staff members need platform-wide visibility for operational monitoring.
drop policy if exists "Platform staff can view profiles" on public.profiles;
create policy "Platform staff can view profiles"
  on public.profiles for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view providers" on public.provider_profiles;
create policy "Platform staff can view providers"
  on public.provider_profiles for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view events" on public.events;
create policy "Platform staff can view events"
  on public.events for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view services" on public.services;
create policy "Platform staff can view services"
  on public.services for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view bookings" on public.bookings;
create policy "Platform staff can view bookings"
  on public.bookings for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view payments" on public.payments;
create policy "Platform staff can view payments"
  on public.payments for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Platform staff can view reviews" on public.reviews;
create policy "Platform staff can view reviews"
  on public.reviews for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "Superadmins can view audit logs" on public.audit_logs;
create policy "Superadmins can view audit logs"
  on public.audit_logs for select to authenticated
  using (public.is_platform_superadmin());

drop policy if exists "Superadmins can view system settings" on public.system_settings;
create policy "Superadmins can view system settings"
  on public.system_settings for select to authenticated
  using (public.is_platform_superadmin());

drop function if exists public.admin_set_account_status(uuid, public.account_status);

create or replace function public.admin_set_account_status(
  target_user_id uuid,
  new_status public.account_status,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  target_role public.user_role;
  previous_status public.account_status;
begin
  select default_role into caller_role
  from public.profiles
  where id = auth.uid() and account_status = 'active';

  if caller_role is null or caller_role not in ('admin', 'superadmin') then
    raise exception 'Administrator access is required';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own account status';
  end if;

  if new_status is null or new_status not in ('active', 'suspended', 'disabled') then
    raise exception 'Unsupported account status';
  end if;

  if new_status in ('suspended', 'disabled') and nullif(trim(reason), '') is null then
    raise exception 'A reason is required when restricting an account';
  end if;

  select default_role, account_status into target_role, previous_status
  from public.profiles
  where id = target_user_id;

  if target_role is null then
    raise exception 'Account not found';
  end if;

  if caller_role = 'admin' and target_role in ('admin', 'superadmin') then
    raise exception 'Only a superadmin can change a staff account';
  end if;

  if target_role = 'superadmin' then
    raise exception 'Superadmin status cannot be changed from this operation';
  end if;

  update public.profiles
  set account_status = new_status,
      updated_at = now()
  where id = target_user_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'account.status.update', 'profile', target_user_id,
    jsonb_build_object('account_status', previous_status),
    jsonb_build_object('account_status', new_status),
    'completed',
    jsonb_build_object('reason', nullif(trim(reason), ''))
  );
end;
$$;

create or replace function public.admin_set_provider_verification(
  target_provider_id uuid,
  new_status public.account_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  provider_user_id uuid;
  previous_status public.account_status;
begin
  select default_role into caller_role
  from public.profiles
  where id = auth.uid() and account_status = 'active';

  if caller_role is null or caller_role not in ('admin', 'superadmin') then
    raise exception 'Administrator access is required';
  end if;

  if new_status is null or new_status not in ('pending', 'verified', 'disabled') then
    raise exception 'Unsupported provider verification status';
  end if;

  select user_id, verification_status into provider_user_id, previous_status
  from public.provider_profiles
  where id = target_provider_id;

  if provider_user_id is null then
    raise exception 'Provider profile not found';
  end if;

  update public.provider_profiles
  set verification_status = new_status,
      updated_at = now()
  where id = target_provider_id;

  update public.profiles
  set account_status = new_status,
      updated_at = now()
  where id = provider_user_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  ) values (
    auth.uid(), caller_role, 'provider.verification.update', 'provider_profile', target_provider_id,
    jsonb_build_object('verification_status', previous_status),
    jsonb_build_object('verification_status', new_status),
    'completed'
  );
end;
$$;

create or replace function public.superadmin_upsert_system_setting(
  setting_key text,
  setting_value jsonb,
  setting_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  setting_id uuid;
  previous_value jsonb;
begin
  if not public.is_platform_superadmin() then
    raise exception 'Superadmin access is required';
  end if;

  if nullif(trim(setting_key), '') is null then
    raise exception 'A setting key is required';
  end if;

  select value into previous_value
  from public.system_settings
  where key = setting_key;

  insert into public.system_settings (key, value, description, updated_by, updated_at)
  values (setting_key, setting_value, setting_description, auth.uid(), now())
  on conflict (key) do update
  set value = excluded.value,
      description = coalesce(excluded.description, public.system_settings.description),
      updated_by = auth.uid(),
      updated_at = now()
  returning id into setting_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result
  ) values (
    auth.uid(), 'superadmin', 'system_setting.update', 'system_setting', setting_id,
    jsonb_build_object('value', previous_value),
    jsonb_build_object('value', setting_value),
    'completed'
  );

  return setting_id;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from public;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status) from public;
revoke all on function public.superadmin_upsert_system_setting(text, jsonb, text) from public;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status) to authenticated;
grant execute on function public.superadmin_upsert_system_setting(text, jsonb, text) to authenticated;
