-- MULTIVENT moderation adjustment: repair assistant listing approvals and
-- normalize enabled staff/provider account states.
-- Apply after 49_deleted_provider_listings.sql.

begin;

insert into public.permissions (code, description)
values
  ('services.view', 'View provider service and package submissions.'),
  ('services.review', 'Inspect provider service and package submissions.'),
  ('services.approve', 'Approve provider service and package submissions.'),
  ('services.reject', 'Reject provider service and package submissions.')
on conflict (code) do update set description = excluded.description;

-- Repair installations where the Assistant role existed before the dynamic
-- permission seed ran. Explicit per-user overrides remain authoritative.
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from public.roles role
cross join public.permissions permission
where role.name::text = 'assistant'
  and permission.code in (
    'services.view', 'services.review', 'services.approve', 'services.reject'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.user_roles (user_id, role_id)
select profile.id, role.id
from public.profiles profile
join public.roles role on role.name = profile.default_role
where profile.default_role = 'assistant'
on conflict (user_id, role_id) do nothing;

create or replace function public.user_has_permission(
  target_user_id uuid,
  target_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when profile.default_role = 'superadmin' then true
      when override_permission.granted is not null then override_permission.granted
      else exists (
        select 1
        from public.user_roles user_role
        join public.role_permissions role_permission on role_permission.role_id = user_role.role_id
        join public.permissions permission on permission.id = role_permission.permission_id
        where user_role.user_id = profile.id
          and permission.code = target_permission
        union all
        select 1
        from public.roles role
        join public.role_permissions role_permission on role_permission.role_id = role.id
        join public.permissions permission on permission.id = role_permission.permission_id
        where role.name = profile.default_role
          and permission.code = target_permission
      )
    end
    from public.profiles profile
    left join public.permissions permission on permission.code = target_permission
    left join public.user_permissions override_permission
      on override_permission.user_id = profile.id
     and override_permission.permission_id = permission.id
    where profile.id = target_user_id
      and profile.account_status in ('active', 'verified')
  ), false);
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status in ('active', 'verified')
      and profile.default_role in ('admin', 'superadmin')
  );
$$;

create or replace function public.get_my_staff_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile.id,
      'full_name', profile.full_name,
      'email', profile.email,
      'default_role', profile.default_role,
      'account_status', profile.account_status
    ),
    'permissions', coalesce((
      select jsonb_agg(permission.code order by permission.code)
      from public.permissions permission
      where public.user_has_permission(profile.id, permission.code)
    ), '[]'::jsonb)
  )
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.account_status in ('active', 'verified')
    and profile.default_role in ('admin', 'superadmin', 'assistant', 'customer_service');
$$;

revoke all on function public.user_has_permission(uuid, text) from public;
revoke all on function public.is_platform_staff() from public;
revoke all on function public.get_my_staff_access() from public;
grant execute on function public.is_platform_staff() to authenticated;
grant execute on function public.get_my_staff_access() to authenticated;

create or replace function public.admin_review_service(
  target_service_id uuid,
  decision text,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  previous_status text;
  next_status text;
  service_name text;
  provider_user_id uuid;
  provider_verification public.account_status;
  provider_account_status public.account_status;
  reviewed_submission_kind text;
begin
  if decision = 'approved' and not public.has_permission('services.approve') then
    raise exception 'Service-approval access is required.' using errcode = '42501';
  elsif decision = 'declined' and not public.has_permission('services.reject') then
    raise exception 'Service-rejection access is required.' using errcode = '42501';
  elsif not public.has_permission('services.review') then
    raise exception 'Service-review access is required.' using errcode = '42501';
  end if;
  if decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined.';
  end if;
  if decision = 'declined' and nullif(trim(review_note), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select profile.default_role into caller_role
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.account_status in ('active', 'verified');

  if caller_role is null then
    raise exception 'An enabled staff account is required.' using errcode = '42501';
  end if;

  select service.status, service.name, provider.user_id,
    provider.verification_status, profile.account_status, service.submission_kind
  into previous_status, service_name, provider_user_id,
    provider_verification, provider_account_status, reviewed_submission_kind
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  where service.id = target_service_id
  for update of service;

  if previous_status is null then
    raise exception 'Service not found.';
  end if;
  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only listings awaiting review or previously declined can be moderated.';
  end if;
  if decision = 'approved'
    and provider_verification not in ('active', 'verified')
  then
    raise exception 'Approve or enable the provider application before approving this listing. Its verification status is %.',
      provider_verification;
  end if;
  if decision = 'approved'
    and provider_account_status not in ('active', 'verified')
  then
    raise exception 'Enable the provider account before approving this listing. Its current status is %.',
      provider_account_status;
  end if;

  next_status := case when decision = 'approved' then 'active' else 'rejected' end;
  perform set_config('app.service_delete_authorized', 'true', true);
  perform set_config('app.service_snapshot_authorized', 'true', true);

  update public.service_packages
  set is_active = (decision = 'approved' and is_deleted = false),
      updated_at = now()
  where service_id = target_service_id;

  update public.services
  set status = next_status,
      moderation_note = nullif(trim(review_note), ''),
      moderated_at = now(),
      moderated_by = auth.uid(),
      last_approved_snapshot = case
        when decision = 'approved' then public.build_service_snapshot(target_service_id)
        else last_approved_snapshot
      end,
      updated_at = now()
  where id = target_service_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'service.review.' || decision, 'service', target_service_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', next_status),
    'success',
    jsonb_build_object(
      'note', nullif(trim(review_note), ''),
      'submission_kind', reviewed_submission_kind
    )
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when decision = 'approved' then 'Listing approved' else 'Listing needs changes' end,
    case when decision = 'approved'
      then service_name || ' is now visible to clients.'
      else service_name || ' was not approved. ' || trim(review_note)
    end,
    'service', target_service_id
  );
end;
$$;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

comment on function public.admin_review_service(uuid, text, text) is
  'Moderates service and package submissions using enabled-account compatibility and dynamic staff permissions.';

commit;
