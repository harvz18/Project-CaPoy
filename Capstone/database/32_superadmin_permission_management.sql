-- MULTIVENT Phase 3: Superadmin permission management and manual accounts.
-- Apply after 31_internal_roles_hardening.sql.

begin;

-- Return one permission-management snapshot so the frontend does not need
-- broad profile-table access merely to configure internal staff accounts.
create or replace function public.get_permission_management_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.has_permission('users.permissions.manage') then
    raise exception 'Permission-management access is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', role.id,
        'name', role.name,
        'description', role.description
      ) order by role.name)
      from public.roles role
      where role.name in ('admin', 'assistant', 'customer_service')
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', permission.id,
        'code', permission.code,
        'description', permission.description
      ) order by permission.code)
      from public.permissions permission
    ), '[]'::jsonb),
    'role_permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_id', role_permission.role_id,
        'permission_id', role_permission.permission_id
      ))
      from public.role_permissions role_permission
      join public.roles role on role.id = role_permission.role_id
      where role.name in ('admin', 'assistant', 'customer_service')
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile.id,
        'full_name', profile.full_name,
        'email', profile.email,
        'default_role', profile.default_role,
        'account_status', profile.account_status
      ) order by profile.full_name nulls last, profile.email)
      from public.profiles profile
      where profile.default_role in ('admin', 'assistant', 'customer_service')
    ), '[]'::jsonb),
    'user_permissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', user_permission.user_id,
        'permission_id', user_permission.permission_id,
        'granted', user_permission.granted
      ))
      from public.user_permissions user_permission
      join public.profiles profile on profile.id = user_permission.user_id
      where profile.default_role in ('admin', 'assistant', 'customer_service')
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Role defaults are configurable only for internal office roles. Client,
-- Provider, and Event Coordinator access remains protected by their scoped
-- application policies rather than global staff permissions.
create or replace function public.superadmin_set_role_permission(
  target_role text,
  target_permission text,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_id_value uuid;
  permission_id_value uuid;
  previous_enabled boolean;
begin
  if not public.has_permission('users.permissions.manage') then
    raise exception 'Permission-management access is required.' using errcode = '42501';
  end if;
  if target_role not in ('admin', 'assistant', 'customer_service') then
    raise exception 'Only configurable internal staff roles can be changed here.' using errcode = '42501';
  end if;

  select id into role_id_value from public.roles where name::text = target_role;
  select id into permission_id_value from public.permissions where code = target_permission;
  if role_id_value is null or permission_id_value is null then
    raise exception 'Unknown role or permission.';
  end if;

  select exists (
    select 1 from public.role_permissions
    where role_id = role_id_value and permission_id = permission_id_value
  ) into previous_enabled;

  if enabled then
    insert into public.role_permissions (role_id, permission_id)
    values (role_id_value, permission_id_value)
    on conflict do nothing;
  else
    delete from public.role_permissions
    where role_id = role_id_value and permission_id = permission_id_value;
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  )
  select auth.uid(), profile.default_role, 'permission.role.update', 'role', role_id_value,
    jsonb_build_object('permission', target_permission, 'enabled', previous_enabled),
    jsonb_build_object('permission', target_permission, 'enabled', enabled),
    'success', jsonb_build_object('role', target_role)
  from public.profiles profile where profile.id = auth.uid();
end;
$$;

create or replace function public.superadmin_set_user_permission(
  target_user_id uuid,
  target_permission text,
  granted boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  permission_id_value uuid;
  target_role public.user_role;
  previous_granted boolean;
  previous_exists boolean;
begin
  if not public.has_permission('users.permissions.manage') then
    raise exception 'Permission-management access is required.' using errcode = '42501';
  end if;

  select profile.default_role into target_role
  from public.profiles profile
  where profile.id = target_user_id;
  if target_role is null then
    raise exception 'Account not found.';
  end if;
  if target_role not in ('admin', 'assistant', 'customer_service') then
    raise exception 'Only configurable internal staff accounts can receive overrides.' using errcode = '42501';
  end if;

  select id into permission_id_value
  from public.permissions where code = target_permission;
  if permission_id_value is null then
    raise exception 'Unknown permission.';
  end if;

  select user_permission.granted into previous_granted
  from public.user_permissions user_permission
  where user_permission.user_id = target_user_id
    and user_permission.permission_id = permission_id_value;
  previous_exists := found;

  if granted is null then
    delete from public.user_permissions
    where user_id = target_user_id and permission_id = permission_id_value;
  else
    insert into public.user_permissions (user_id, permission_id, granted, assigned_by, updated_at)
    values (target_user_id, permission_id_value, granted, auth.uid(), now())
    on conflict (user_id, permission_id) do update
    set granted = excluded.granted, assigned_by = auth.uid(), updated_at = now();
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  )
  select auth.uid(), profile.default_role, 'permission.user.update', 'profile', target_user_id,
    jsonb_build_object(
      'permission', target_permission,
      'granted', case when previous_exists then to_jsonb(previous_granted) else 'null'::jsonb end
    ),
    jsonb_build_object('permission', target_permission, 'granted', to_jsonb(granted)),
    'success', '{}'::jsonb
  from public.profiles profile where profile.id = auth.uid();
end;
$$;

revoke all on function public.get_permission_management_data() from public;
revoke all on function public.superadmin_set_role_permission(text, text, boolean) from public;
revoke all on function public.superadmin_set_user_permission(uuid, text, boolean) from public;

grant execute on function public.get_permission_management_data() to authenticated;
grant execute on function public.superadmin_set_role_permission(text, text, boolean) to authenticated;
grant execute on function public.superadmin_set_user_permission(uuid, text, boolean) to authenticated;

comment on function public.get_permission_management_data() is
  'Permission-management snapshot for configurable MULTIVENT office roles and staff.';

commit;
