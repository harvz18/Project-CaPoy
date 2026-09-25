-- MULTIVENT business operations, dynamic RBAC, workforce scheduling,
-- support, remittance, and commission accounting.
-- Apply after 29_coordinator_lifecycle_instructions_reviews.sql.

-- PostgreSQL requires newly-added enum values to be committed before use.
alter type public.user_role add value if not exists 'assistant';
alter type public.user_role add value if not exists 'customer_service';

commit;
begin;

insert into public.roles (name, description)
values
  ('assistant', 'MULTIVENT operations staff for approvals, coordination, and remittance.'),
  ('customer_service', 'MULTIVENT platform support and complaint-resolution staff.')
on conflict (name) do update set description = excluded.description;

insert into public.permissions (code, description)
values
  ('dashboard.analytics.view', 'View business performance analytics.'),
  ('users.view', 'View registered user profiles.'),
  ('users.create', 'Create internal MULTIVENT accounts.'),
  ('users.update', 'Update user status and operational profile fields.'),
  ('users.permissions.manage', 'Manage role and user permission overrides.'),
  ('providers.view', 'View provider applications and profiles.'),
  ('providers.review', 'Inspect provider applications.'),
  ('providers.approve', 'Approve provider applications.'),
  ('providers.reject', 'Reject provider applications.'),
  ('services.view', 'View provider service submissions.'),
  ('services.review', 'Inspect provider service submissions.'),
  ('services.approve', 'Approve provider services.'),
  ('services.reject', 'Reject provider services.'),
  ('coordinators.view', 'View coordinator workforce records.'),
  ('coordinators.create', 'Create employed coordinator accounts.'),
  ('coordinators.assign', 'Assign coordinators to unassigned events.'),
  ('coordinators.reassign', 'Replace an event coordinator.'),
  ('events.view', 'View event and booking operations.'),
  ('events.manage', 'Manage event operations.'),
  ('revenue.view', 'View commission revenue and transaction records.'),
  ('cashflow.view', 'View platform cash flow.'),
  ('remittance.view', 'View coordinator cash remittances.'),
  ('remittance.create', 'Record cash received by MULTIVENT.'),
  ('remittance.verify', 'Verify or dispute cash remittances.'),
  ('support.view', 'View platform support tickets.'),
  ('support.respond', 'Respond to platform support tickets.'),
  ('support.resolve', 'Resolve and close support tickets.'),
  ('system.settings', 'Manage system configuration.'),
  ('system.audit_logs', 'View privileged audit history.')
on conflict (code) do update set description = excluded.description;

-- Default grants are data, so Superadmins can change them without a frontend release.
with defaults(role_name, permission_code) as (
  values
    ('admin', 'dashboard.analytics.view'),
    ('admin', 'users.view'),
    ('admin', 'providers.view'),
    ('admin', 'services.view'),
    ('admin', 'coordinators.view'),
    ('admin', 'events.view'),
    ('admin', 'revenue.view'),
    ('admin', 'cashflow.view'),
    ('admin', 'remittance.view'),
    ('assistant', 'users.view'),
    ('assistant', 'providers.view'),
    ('assistant', 'providers.review'),
    ('assistant', 'providers.approve'),
    ('assistant', 'providers.reject'),
    ('assistant', 'services.view'),
    ('assistant', 'services.review'),
    ('assistant', 'services.approve'),
    ('assistant', 'services.reject'),
    ('assistant', 'coordinators.view'),
    ('assistant', 'coordinators.assign'),
    ('assistant', 'events.view'),
    ('assistant', 'events.manage'),
    ('assistant', 'cashflow.view'),
    ('assistant', 'remittance.view'),
    ('assistant', 'remittance.create'),
    ('customer_service', 'support.view'),
    ('customer_service', 'support.respond'),
    ('customer_service', 'support.resolve'),
    ('event_coordinator', 'events.view')
)
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from defaults
join public.roles role on role.name::text = defaults.role_name
join public.permissions permission on permission.code = defaults.permission_code
on conflict (role_id, permission_id) do nothing;

create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted boolean not null,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

alter table public.user_permissions enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

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
      and profile.account_status = 'active'
  ), false);
$$;

create or replace function public.has_permission(target_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and public.user_has_permission(auth.uid(), target_permission);
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status = 'active'
      and profile.default_role in ('admin', 'superadmin')
  );
$$;

revoke all on function public.user_has_permission(uuid, text) from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.is_platform_staff() from public;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_platform_staff() to authenticated;

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
    and profile.account_status = 'active'
    and profile.default_role in ('admin', 'superadmin', 'assistant', 'customer_service');
$$;

revoke all on function public.get_my_staff_access() from public;
grant execute on function public.get_my_staff_access() to authenticated;

drop policy if exists "Permission managers view roles" on public.roles;
create policy "Permission managers view roles" on public.roles for select to authenticated
  using (public.has_permission('users.permissions.manage'));
drop policy if exists "Permission managers view permissions" on public.permissions;
create policy "Permission managers view permissions" on public.permissions for select to authenticated
  using (public.has_permission('users.permissions.manage'));
drop policy if exists "Permission managers view role grants" on public.role_permissions;
create policy "Permission managers view role grants" on public.role_permissions for select to authenticated
  using (public.has_permission('users.permissions.manage'));
drop policy if exists "Permission managers view user grants" on public.user_permissions;
create policy "Permission managers view user grants" on public.user_permissions for select to authenticated
  using (public.has_permission('users.permissions.manage'));

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
begin
  if not public.has_permission('users.permissions.manage') then
    raise exception 'Permission-management access is required.' using errcode = '42501';
  end if;
  if target_role = 'superadmin' then
    raise exception 'Superadmin always has full system access.';
  end if;

  select id into role_id_value from public.roles where name::text = target_role;
  select id into permission_id_value from public.permissions where code = target_permission;
  if role_id_value is null or permission_id_value is null then
    raise exception 'Unknown role or permission.';
  end if;

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
    null, jsonb_build_object('permission', target_permission, 'enabled', enabled),
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
begin
  if not public.has_permission('users.permissions.manage') then
    raise exception 'Permission-management access is required.' using errcode = '42501';
  end if;
  select id into permission_id_value from public.permissions where code = target_permission;
  if permission_id_value is null then raise exception 'Unknown permission.'; end if;

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
    new_state, result, metadata
  )
  select auth.uid(), profile.default_role, 'permission.user.update', 'profile', target_user_id,
    jsonb_build_object('permission', target_permission, 'granted', granted),
    'success', '{}'::jsonb
  from public.profiles profile where profile.id = auth.uid();
end;
$$;

revoke all on function public.superadmin_set_role_permission(text, text, boolean) from public;
revoke all on function public.superadmin_set_user_permission(uuid, text, boolean) from public;
grant execute on function public.superadmin_set_role_permission(text, text, boolean) to authenticated;
grant execute on function public.superadmin_set_user_permission(uuid, text, boolean) to authenticated;

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and new.default_role not in ('client', 'service_provider') then
      raise exception 'Internal MULTIVENT accounts cannot be self-created.' using errcode = '42501';
    end if;
    if auth.role() <> 'service_role' and (
      (new.default_role = 'client' and new.account_status <> 'active')
      or (new.default_role = 'service_provider' and new.account_status <> 'pending')
    ) then
      raise exception 'Unsupported public account status.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.default_role is distinct from old.default_role
    and auth.role() <> 'service_role'
    and not public.has_permission('users.update')
  then
    raise exception 'Account roles can only be changed by authorized MULTIVENT staff.' using errcode = '42501';
  end if;
  if new.account_status is distinct from old.account_status
    and auth.role() <> 'service_role'
    and not public.has_permission('users.update')
    and not public.has_permission('providers.approve')
    and not public.has_permission('providers.reject')
  then
    raise exception 'Account status can only be changed by authorized MULTIVENT staff.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_authorization_fields_trigger on public.profiles;
create trigger protect_profile_authorization_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_authorization_fields();
revoke all on function public.protect_profile_authorization_fields() from public;

-- Provider agreement acceptance is captured with a version for future policy updates.
alter table public.provider_profiles
  add column if not exists terms_accepted boolean not null default false,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists rejection_reason text;

create or replace function public.capture_provider_terms_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'default_role' = 'service_provider' then
    update public.provider_profiles
    set terms_accepted = coalesce(new.raw_user_meta_data ->> 'provider_terms_accepted', 'false') = 'true',
        terms_version = nullif(new.raw_user_meta_data ->> 'provider_terms_version', ''),
        terms_accepted_at = case
          when coalesce(new.raw_user_meta_data ->> 'provider_terms_accepted', 'false') = 'true' then now()
          else null
        end,
        updated_at = now()
    where user_id = new.id;
  end if;

  -- Any Auth API signup claiming an internal role is normalized to Client.
  -- The privileged Edge Function starts as Client and promotes the profile
  -- afterward with service-role credentials, so metadata cannot grant access.
  if new.raw_user_meta_data ->> 'default_role' in ('event_coordinator', 'assistant', 'customer_service', 'admin', 'superadmin')
  then
    update public.profiles
    set default_role = 'client', account_status = 'active', updated_at = now()
    where id = new.id;
    delete from public.user_roles where user_id = new.id;
    insert into public.user_roles (user_id, role_id)
    select new.id, role.id from public.roles role where role.name = 'client'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_capture_provider_terms_from_auth on auth.users;
create trigger zz_capture_provider_terms_from_auth
after insert on auth.users for each row execute function public.capture_provider_terms_from_auth();
revoke all on function public.capture_provider_terms_from_auth() from public;

create or replace function public.protect_provider_review_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and new.verification_status <> 'pending' then
      raise exception 'New provider applications must begin in pending review.' using errcode = '42501';
    end if;
    new.rejection_reason := null;
    if new.terms_accepted then
      new.terms_version := '2026-09-25-commission-v1';
      new.terms_accepted_at := now();
    else
      new.terms_version := null;
      new.terms_accepted_at := null;
    end if;
    return new;
  end if;

  if (
    new.verification_status is distinct from old.verification_status
    or new.rejection_reason is distinct from old.rejection_reason
  )
    and auth.role() <> 'service_role'
    and not public.has_permission('providers.approve')
    and not public.has_permission('providers.reject')
  then
    raise exception 'Provider review fields can only be changed by authorized MULTIVENT staff.' using errcode = '42501';
  end if;

  if new.terms_accepted and not old.terms_accepted and auth.role() <> 'service_role' then
    new.terms_version := '2026-09-25-commission-v1';
    new.terms_accepted_at := now();
  elsif not new.terms_accepted and old.terms_accepted and auth.role() <> 'service_role' then
    new.terms_version := null;
    new.terms_accepted_at := null;
  elsif auth.role() <> 'service_role' and (
    new.terms_version is distinct from old.terms_version
    or new.terms_accepted_at is distinct from old.terms_accepted_at
  ) then
    raise exception 'Agreement metadata is recorded by MULTIVENT when terms are accepted.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_provider_review_fields_trigger on public.provider_profiles;
create trigger protect_provider_review_fields_trigger
before insert or update
on public.provider_profiles for each row execute function public.protect_provider_review_fields();
revoke all on function public.protect_provider_review_fields() from public;

-- Coordinator workforce availability and assignment queue.
create table if not exists public.coordinator_availability (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'unavailable',
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coordinator_availability_time_check check (ends_at > starts_at),
  constraint coordinator_availability_status_check
    check (status in ('available', 'unavailable', 'on_leave'))
);
create index if not exists coordinator_availability_schedule_idx
  on public.coordinator_availability (coordinator_id, starts_at, ends_at);
alter table public.coordinator_availability enable row level security;

alter table public.events
  add column if not exists coordinator_assignment_attempted_at timestamptz,
  add column if not exists coordinator_assignment_source text,
  add column if not exists coordinator_assignment_note text;

alter table public.events
  drop constraint if exists events_coordinator_assignment_status_check,
  add constraint events_coordinator_assignment_status_check
    check (coordinator_assignment_status is null or coordinator_assignment_status in (
      'awaiting_assignment', 'pending', 'accepted'
    )),
  drop constraint if exists events_coordinator_assignment_consistency_check,
  add constraint events_coordinator_assignment_consistency_check check (
    (coordinator_assignment_status = 'pending' and pending_coordinator_id is not null)
    or (coordinator_assignment_status = 'accepted' and coordinator_id is not null)
    or (coordinator_assignment_status = 'awaiting_assignment' and pending_coordinator_id is null and coordinator_id is null)
    or (coordinator_assignment_status is null and pending_coordinator_id is null and coordinator_id is null)
  );

insert into public.system_settings (key, value, description)
values
  ('commission_rate', '{"value":0.10}'::jsonb, 'Commission earned by MULTIVENT from provider transactions.'),
  ('coordinator_workload_limit', '{"value":5}'::jsonb, 'Maximum upcoming accepted or pending events per coordinator.'),
  ('coordinator_default_event_hours', '{"value":4}'::jsonb, 'Fallback event duration used for coordinator conflict checks.')
on conflict (key) do nothing;

create or replace function public.coordinator_event_window(target_event public.events)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(
      target_event.preferred_start_at,
      case when target_event.event_date is not null and target_event.event_time is not null
        then (target_event.event_date + target_event.event_time) at time zone coalesce(target_event.timezone, 'Asia/Manila')
      end
    ),
    coalesce(
      target_event.preferred_end_at,
      coalesce(
        target_event.preferred_start_at,
        case when target_event.event_date is not null and target_event.event_time is not null
          then (target_event.event_date + target_event.event_time) at time zone coalesce(target_event.timezone, 'Asia/Manila')
        end
      ) + make_interval(hours => coalesce((
        select nullif(setting.value ->> 'value', '')::integer
        from public.system_settings setting
        where setting.key = 'coordinator_default_event_hours'
      ), 4))
    );
$$;

create or replace function public.auto_assign_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  event_start timestamptz;
  event_end timestamptz;
  workload_limit integer;
  selected_coordinator uuid;
  selected_name text;
begin
  select * into event_row from public.events where id = target_event_id for update;
  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.status in ('draft', 'planning', 'completed', 'cancelled') then
    return jsonb_build_object('event_id', event_row.id, 'assignment_status', event_row.coordinator_assignment_status);
  end if;
  if event_row.coordinator_id is not null or event_row.pending_coordinator_id is not null then
    return jsonb_build_object('event_id', event_row.id, 'assignment_status', event_row.coordinator_assignment_status);
  end if;
  perform set_config('app.coordinator_assignment_authorized', 'true', true);

  select event_window.starts_at, event_window.ends_at into event_start, event_end
  from public.coordinator_event_window(event_row) as event_window;
  if event_start is null or event_end is null then
    update public.events set
      coordinator_assignment_status = 'awaiting_assignment',
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_note = 'Waiting for a complete event schedule.',
      updated_at = now()
    where id = event_row.id;
    return jsonb_build_object('event_id', event_row.id, 'assignment_status', 'awaiting_assignment');
  end if;

  select coalesce(nullif(setting.value ->> 'value', '')::integer, 5)
  into workload_limit from public.system_settings setting
  where setting.key = 'coordinator_workload_limit';
  workload_limit := coalesce(workload_limit, 5);

  with candidates as (
    select
      profile.id,
      coalesce(nullif(trim(profile.full_name), ''), 'Event Coordinator') as full_name,
      count(assigned.id) filter (
        where assigned.status not in ('completed', 'cancelled')
          and assigned.event_date >= current_date
      ) as workload,
      max(coalesce(assigned.coordinator_assignment_requested_at, assigned.updated_at)) as last_assignment
    from public.profiles profile
    left join public.events assigned
      on assigned.coordinator_id = profile.id or assigned.pending_coordinator_id = profile.id
    where profile.account_status = 'active'
      and (
        profile.default_role = 'event_coordinator'
        or exists (
          select 1 from public.user_roles user_role
          join public.roles role on role.id = user_role.role_id
          where user_role.user_id = profile.id and role.name = 'event_coordinator'
        )
      )
      and not exists (
        select 1 from public.coordinator_availability availability
        where availability.coordinator_id = profile.id
          and availability.status in ('unavailable', 'on_leave')
          and event_start < availability.ends_at
          and event_end > availability.starts_at
      )
      and not exists (
        select 1
        from public.events conflict_event
        cross join lateral public.coordinator_event_window(conflict_event) conflict_window
        where conflict_event.id <> event_row.id
          and conflict_event.status not in ('completed', 'cancelled')
          and (conflict_event.coordinator_id = profile.id or conflict_event.pending_coordinator_id = profile.id)
          and event_start < conflict_window.ends_at
          and event_end > conflict_window.starts_at
      )
    group by profile.id, profile.full_name
  )
  select id, full_name into selected_coordinator, selected_name
  from candidates
  where workload < workload_limit
  order by workload, last_assignment nulls first, id
  limit 1;

  if selected_coordinator is null then
    update public.events set
      coordinator_assignment_status = 'awaiting_assignment',
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'automatic',
      coordinator_assignment_note = 'No conflict-free coordinator is currently available.',
      updated_at = now()
    where id = event_row.id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select profile.id, 'Coordinator assignment needed',
      format('%s is waiting for an available event coordinator.', event_row.name),
      'event', event_row.id
    from public.profiles profile
    where public.user_has_permission(profile.id, 'coordinators.assign');

    return jsonb_build_object('event_id', event_row.id, 'assignment_status', 'awaiting_assignment');
  end if;

  update public.events set
    pending_coordinator_id = selected_coordinator,
    coordinator_assignment_status = 'pending',
    coordinator_assignment_requested_at = now(),
    coordinator_assignment_responded_at = null,
    coordinator_assignment_attempted_at = now(),
    coordinator_assignment_source = 'automatic',
    coordinator_assignment_note = null,
    updated_at = now()
  where id = event_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    selected_coordinator,
    'Event coordination invitation',
    format('MULTIVENT assigned %s to you based on availability. Review and confirm it in your workspace.', event_row.name),
    'event', event_row.id
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    'Coordinator assignment in progress',
    format('%s has been matched with %s. You will be notified after confirmation.', event_row.name, selected_name),
    'event', event_row.id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, new_state, result, metadata
  ) values (
    auth.uid(), null, 'coordinator.assignment.automatic', 'event', event_row.id,
    jsonb_build_object('pending_coordinator_id', selected_coordinator, 'status', 'pending'),
    'success', jsonb_build_object('strategy', 'least_workload_availability')
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'coordinator_id', selected_coordinator,
    'coordinator_name', selected_name,
    'assignment_status', 'pending'
  );
end;
$$;

create or replace function public.assign_coordinator_when_booked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_coordinator uuid;
  event_start timestamptz;
  event_end timestamptz;
  schedule_changed boolean;
begin
  schedule_changed := case when tg_op = 'UPDATE' then
    old.event_date is distinct from new.event_date
    or old.event_time is distinct from new.event_time
    or old.preferred_start_at is distinct from new.preferred_start_at
    or old.preferred_end_at is distinct from new.preferred_end_at
  else false end;
  assigned_coordinator := coalesce(new.coordinator_id, new.pending_coordinator_id);

  if new.status in ('booking', 'payment_required', 'confirmed', 'in_progress')
    and schedule_changed
    and assigned_coordinator is not null
  then
    select event_window.starts_at, event_window.ends_at into event_start, event_end
    from public.coordinator_event_window(new) as event_window;

    if event_start is null or event_end is null or exists (
      select 1 from public.coordinator_availability availability
      where availability.coordinator_id = assigned_coordinator
        and availability.status in ('unavailable', 'on_leave')
        and event_start < availability.ends_at and event_end > availability.starts_at
    ) or exists (
      select 1 from public.events conflict_event
      cross join lateral public.coordinator_event_window(conflict_event) conflict_window
      where conflict_event.id <> new.id
        and conflict_event.status not in ('completed', 'cancelled')
        and (conflict_event.coordinator_id = assigned_coordinator or conflict_event.pending_coordinator_id = assigned_coordinator)
        and event_start < conflict_window.ends_at and event_end > conflict_window.starts_at
    ) then
      perform set_config('app.coordinator_assignment_authorized', 'true', true);
      update public.events set
        coordinator_id = null,
        pending_coordinator_id = null,
        coordinator_assignment_status = 'awaiting_assignment',
        coordinator_assignment_requested_at = null,
        coordinator_assignment_responded_at = null,
        coordinator_assignment_note = 'The revised schedule requires coordinator reassignment.',
        updated_at = now()
      where id = new.id;
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (assigned_coordinator, 'Event schedule reassigned',
        format('%s changed schedule and requires a new availability match.', new.name), 'event', new.id);
      perform public.auto_assign_event_coordinator(new.id);
      return null;
    end if;
  end if;

  if new.status in ('booking', 'payment_required', 'confirmed', 'in_progress')
    and new.coordinator_id is null
    and new.pending_coordinator_id is null
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
      or schedule_changed
    )
  then
    perform public.auto_assign_event_coordinator(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists assign_coordinator_when_booked_trigger on public.events;
create trigger assign_coordinator_when_booked_trigger
after insert or update of status, event_date, event_time, preferred_start_at, preferred_end_at
on public.events for each row execute function public.assign_coordinator_when_booked();

create or replace function public.mark_declined_coordinator_as_unassigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.coordinator_assignment_status = 'pending'
    and new.coordinator_assignment_status is null
    and new.coordinator_id is null
    and new.pending_coordinator_id is null
    and new.status not in ('draft', 'planning', 'completed', 'cancelled')
  then
    perform set_config('app.coordinator_assignment_authorized', 'true', true);
    update public.events set
      coordinator_assignment_status = 'awaiting_assignment',
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_note = 'The previous coordinator declined the assignment.',
      updated_at = now()
    where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists mark_declined_coordinator_as_unassigned_trigger on public.events;
create trigger mark_declined_coordinator_as_unassigned_trigger
after update of coordinator_assignment_status, pending_coordinator_id
on public.events for each row execute function public.mark_declined_coordinator_as_unassigned();

create or replace function public.retry_waiting_coordinator_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare waiting_event record;
begin
  for waiting_event in
    select event.id from public.events event
    where event.coordinator_assignment_status = 'awaiting_assignment'
      and event.status not in ('completed', 'cancelled')
    order by event.event_date nulls last, event.created_at
  loop
    perform public.auto_assign_event_coordinator(waiting_event.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists retry_waiting_events_after_availability_trigger on public.coordinator_availability;
create trigger retry_waiting_events_after_availability_trigger
after insert or update or delete on public.coordinator_availability
for each statement execute function public.retry_waiting_coordinator_events();

create or replace function public.retry_event_coordinator_assignment(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('coordinators.assign') then
    raise exception 'Coordinator-assignment access is required.' using errcode = '42501';
  end if;
  return public.auto_assign_event_coordinator(target_event_id);
end;
$$;

create or replace function public.staff_assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  coordinator_name text;
  can_reassign boolean;
  event_start timestamptz;
  event_end timestamptz;
begin
  if not public.has_permission('coordinators.assign') then
    raise exception 'Coordinator-assignment access is required.' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = target_event_id for update;
  if event_row.id is null or event_row.status in ('completed', 'cancelled') then
    raise exception 'This event is not available for assignment.';
  end if;
  can_reassign := event_row.coordinator_id is not null or event_row.pending_coordinator_id is not null;
  if can_reassign and not public.has_permission('coordinators.reassign') then
    raise exception 'Coordinator-reassignment access is required.' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'Event Coordinator') into coordinator_name
  from public.profiles
  where id = target_coordinator_id
    and account_status = 'active'
    and (
      default_role = 'event_coordinator'
      or exists (
        select 1 from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = target_coordinator_id and role.name = 'event_coordinator'
      )
    );
  if coordinator_name is null then raise exception 'The selected coordinator is unavailable.'; end if;
  select event_window.starts_at, event_window.ends_at into event_start, event_end
  from public.coordinator_event_window(event_row) as event_window;
  if event_start is null or event_end is null then raise exception 'Complete the event schedule before assigning a coordinator.'; end if;
  if exists (
    select 1 from public.coordinator_availability availability
    where availability.coordinator_id = target_coordinator_id
      and availability.status in ('unavailable', 'on_leave')
      and event_start < availability.ends_at and event_end > availability.starts_at
  ) or exists (
    select 1 from public.events conflict_event
    cross join lateral public.coordinator_event_window(conflict_event) conflict_window
    where conflict_event.id <> event_row.id
      and conflict_event.status not in ('completed', 'cancelled')
      and (conflict_event.coordinator_id = target_coordinator_id or conflict_event.pending_coordinator_id = target_coordinator_id)
      and event_start < conflict_window.ends_at and event_end > conflict_window.starts_at
  ) then
    raise exception 'The selected coordinator has a schedule conflict or is unavailable.';
  end if;

  if event_row.coordinator_id is not null and event_row.coordinator_id <> target_coordinator_id then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.coordinator_id, 'Event assignment updated',
      format('You are no longer assigned to coordinate %s.', event_row.name), 'event', event_row.id);
  end if;
  if event_row.pending_coordinator_id is not null and event_row.pending_coordinator_id <> target_coordinator_id then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.pending_coordinator_id, 'Event invitation withdrawn',
      format('The invitation to coordinate %s was withdrawn.', event_row.name), 'event', event_row.id);
  end if;

  update public.events set
    coordinator_id = null,
    pending_coordinator_id = target_coordinator_id,
    coordinator_assignment_status = 'pending',
    coordinator_assignment_requested_at = now(),
    coordinator_assignment_responded_at = null,
    coordinator_assignment_attempted_at = now(),
    coordinator_assignment_source = 'manual',
    coordinator_assignment_note = null,
    updated_at = now()
  where id = event_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (target_coordinator_id, 'Event coordination invitation',
    format('MULTIVENT assigned %s to you. Review and confirm it in your workspace.', event_row.name),
    'event', event_row.id);

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, previous_state, new_state, result
  )
  select auth.uid(), profile.default_role, 'coordinator.assignment.manual', 'event', event_row.id,
    jsonb_build_object('coordinator_id', event_row.coordinator_id, 'pending_coordinator_id', event_row.pending_coordinator_id),
    jsonb_build_object('pending_coordinator_id', target_coordinator_id, 'status', 'pending'), 'success'
  from public.profiles profile where profile.id = auth.uid();

  return jsonb_build_object('event_id', event_row.id, 'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name, 'assignment_status', 'pending');
end;
$$;

create or replace function public.list_unassigned_events()
returns table (
  id uuid, name text, event_type text, event_date date, event_time time,
  venue text, location text, client_name text, assignment_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, event.name, event.event_type, event.event_date, event.event_time,
    event.venue, event.location, coalesce(client.full_name, 'Client'), event.coordinator_assignment_note
  from public.events event
  join public.profiles client on client.id = event.client_id
  where public.has_permission('coordinators.view')
    and event.coordinator_assignment_status = 'awaiting_assignment'
    and event.status not in ('completed', 'cancelled')
  order by event.event_date nulls last, event.created_at;
$$;

drop policy if exists "Staff view coordinator availability" on public.coordinator_availability;
create policy "Staff view coordinator availability" on public.coordinator_availability for select to authenticated
  using (public.has_permission('coordinators.view') or coordinator_id = auth.uid());
drop policy if exists "Staff manage coordinator availability" on public.coordinator_availability;
create policy "Staff manage coordinator availability" on public.coordinator_availability for all to authenticated
  using (public.has_permission('coordinators.assign') or coordinator_id = auth.uid())
  with check (public.has_permission('coordinators.assign') or coordinator_id = auth.uid());

revoke all on function public.coordinator_event_window(public.events) from public;
revoke all on function public.auto_assign_event_coordinator(uuid) from public;
revoke all on function public.assign_coordinator_when_booked() from public;
revoke all on function public.mark_declined_coordinator_as_unassigned() from public;
revoke all on function public.retry_waiting_coordinator_events() from public;
revoke all on function public.retry_event_coordinator_assignment(uuid) from public;
revoke all on function public.staff_assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.list_unassigned_events() from public;
grant execute on function public.retry_event_coordinator_assignment(uuid) to authenticated;
grant execute on function public.staff_assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.list_unassigned_events() to authenticated;

create or replace function public.protect_event_coordinator_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  coordinator_response boolean;
  client_cancellation boolean;
begin
  if new.coordinator_id is not distinct from old.coordinator_id
    and new.pending_coordinator_id is not distinct from old.pending_coordinator_id
    and new.coordinator_assignment_status is not distinct from old.coordinator_assignment_status
    and new.coordinator_assignment_requested_at is not distinct from old.coordinator_assignment_requested_at
    and new.coordinator_assignment_responded_at is not distinct from old.coordinator_assignment_responded_at
  then
    return new;
  end if;

  coordinator_response := old.pending_coordinator_id = auth.uid()
    and old.coordinator_assignment_status = 'pending'
    and new.pending_coordinator_id is null
    and (
      (new.coordinator_id = auth.uid() and new.coordinator_assignment_status = 'accepted')
      or (
        new.coordinator_id is not distinct from old.coordinator_id
        and (
          (old.coordinator_id is null and new.coordinator_assignment_status is null)
          or (old.coordinator_id is not null and new.coordinator_assignment_status = 'accepted')
        )
      )
    );
  client_cancellation := old.client_id = auth.uid()
    and new.status = 'cancelled'
    and new.coordinator_id is null
    and new.pending_coordinator_id is null
    and new.coordinator_assignment_status is null;

  if auth.role() = 'service_role'
    or current_setting('app.coordinator_assignment_authorized', true) = 'true'
    or public.has_permission('coordinators.assign')
    or public.has_permission('coordinators.reassign')
    or coordinator_response
    or client_cancellation
  then
    return new;
  end if;
  raise exception 'Coordinator assignments are managed by MULTIVENT.' using errcode = '42501';
end;
$$;
drop trigger if exists protect_event_coordinator_assignment_trigger on public.events;
create trigger protect_event_coordinator_assignment_trigger
before update of coordinator_id, pending_coordinator_id, coordinator_assignment_status,
  coordinator_assignment_requested_at, coordinator_assignment_responded_at
on public.events for each row execute function public.protect_event_coordinator_assignment();
revoke all on function public.protect_event_coordinator_assignment() from public;

-- Preserve the established RPC names while moving assignment authority from
-- clients to MULTIVENT workforce staff.
create or replace function public.assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.staff_assign_event_coordinator(target_event_id, target_coordinator_id);
$$;

create or replace function public.remove_event_coordinator(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_row public.events%rowtype;
begin
  if not public.has_permission('coordinators.reassign') then
    raise exception 'Coordinator-reassignment access is required.' using errcode = '42501';
  end if;
  select * into event_row from public.events where id = target_event_id for update;
  if event_row.id is null or event_row.status in ('completed', 'cancelled') then
    raise exception 'This event is not available for coordinator changes.';
  end if;
  update public.events set coordinator_id = null, pending_coordinator_id = null,
    coordinator_assignment_status = 'awaiting_assignment',
    coordinator_assignment_requested_at = null, coordinator_assignment_responded_at = null,
    coordinator_assignment_attempted_at = now(), coordinator_assignment_source = 'manual',
    coordinator_assignment_note = 'Coordinator removed by authorized MULTIVENT staff.', updated_at = now()
  where id = event_row.id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select recipient.user_id, 'Event assignment updated',
    format('You are no longer assigned to coordinate %s.', event_row.name), 'event', event_row.id
  from (values (event_row.coordinator_id), (event_row.pending_coordinator_id)) recipient(user_id)
  where recipient.user_id is not null;
  return jsonb_build_object('event_id', event_row.id, 'coordinator_id', null, 'assignment_status', 'awaiting_assignment');
end;
$$;

create or replace function public.list_available_event_coordinators()
returns table (id uuid, full_name text, avatar_url text)
language sql
security definer
stable
set search_path = ''
as $$
  select profile.id,
    coalesce(nullif(trim(profile.full_name), ''), 'Event Coordinator'), profile.avatar_url
  from public.profiles profile
  where auth.uid() is not null
    and profile.account_status = 'active'
    and (
      profile.default_role = 'event_coordinator'
      or exists (
        select 1 from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id and role.name = 'event_coordinator'
      )
    )
    and (
      public.has_permission('coordinators.view')
      or profile.id = auth.uid()
      or exists (
        select 1 from public.events event
        where event.client_id = auth.uid()
          and (event.coordinator_id = profile.id or event.pending_coordinator_id = profile.id)
      )
    )
  order by full_name;
$$;

revoke all on function public.assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.remove_event_coordinator(uuid) from public;
revoke all on function public.list_available_event_coordinators() from public;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;
grant execute on function public.remove_event_coordinator(uuid) to authenticated;
grant execute on function public.list_available_event_coordinators() to authenticated;

-- Support tickets are limited to their owner and authorized support personnel.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_ticket_category_check check (category in ('account', 'booking', 'payment', 'system', 'technical', 'other')),
  constraint support_ticket_status_check check (status in ('open', 'in_progress', 'waiting_for_user', 'resolved', 'closed')),
  constraint support_ticket_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
);
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_queue_idx on public.support_tickets (status, priority, created_at);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Users view owned or authorized tickets" on public.support_tickets;
create policy "Users view owned or authorized tickets" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.has_permission('support.view'));
drop policy if exists "Users create owned support tickets" on public.support_tickets;
create policy "Users create owned support tickets" on public.support_tickets for insert to authenticated
  with check (
    user_id = auth.uid()
    and (event_id is null or exists (
      select 1 from public.events event where event.id = support_tickets.event_id and event.client_id = auth.uid()
    ))
    and (booking_id is null or exists (
      select 1 from public.bookings booking where booking.id = support_tickets.booking_id and booking.client_id = auth.uid()
    ))
  );
drop policy if exists "Support staff update tickets" on public.support_tickets;
create policy "Support staff update tickets" on public.support_tickets for update to authenticated
  using (public.has_permission('support.respond'))
  with check (public.has_permission('support.respond'));
drop policy if exists "Ticket participants view messages" on public.support_messages;
create policy "Ticket participants view messages" on public.support_messages for select to authenticated
  using (exists (
    select 1 from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and (ticket.user_id = auth.uid() or public.has_permission('support.view'))
      and (not support_messages.is_internal or public.has_permission('support.view'))
  ));
drop policy if exists "Ticket participants send messages" on public.support_messages;
create policy "Ticket participants send messages" on public.support_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from public.support_tickets ticket
    where ticket.id = support_messages.ticket_id
      and ticket.status <> 'closed'
      and (ticket.user_id = auth.uid() or public.has_permission('support.respond'))
      and (not support_messages.is_internal or public.has_permission('support.respond'))
  ));

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets ticket
  set status = case
      when ticket.status in ('resolved', 'closed') then ticket.status
      when new.sender_id = ticket.user_id then 'in_progress'
      else 'waiting_for_user'
    end,
    assigned_to = case
      when new.sender_id <> ticket.user_id and public.user_has_permission(new.sender_id, 'support.respond')
        then coalesce(ticket.assigned_to, new.sender_id)
      else ticket.assigned_to
    end,
    updated_at = now()
  where ticket.id = new.ticket_id;
  if exists (
    select 1 from public.support_tickets ticket
    where ticket.id = new.ticket_id and ticket.user_id <> new.sender_id
  ) then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select ticket.user_id, 'New support reply',
      format('MULTIVENT Customer Service replied to ticket MV-%s.', lpad(ticket.ticket_number::text, 6, '0')),
      'support_ticket', ticket.id
    from public.support_tickets ticket where ticket.id = new.ticket_id;
  end if;
  return new;
end;
$$;
drop trigger if exists touch_support_ticket_from_message_trigger on public.support_messages;
create trigger touch_support_ticket_from_message_trigger
after insert on public.support_messages for each row execute function public.touch_support_ticket_from_message();
revoke all on function public.touch_support_ticket_from_message() from public;

create or replace function public.notify_support_ticket_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select profile.id, 'New support ticket',
    format('Ticket MV-%s requires Customer Service review.', lpad(new.ticket_number::text, 6, '0')),
    'support_ticket', new.id
  from public.profiles profile
  where public.user_has_permission(profile.id, 'support.view');
  return new;
end;
$$;
drop trigger if exists notify_support_ticket_created_trigger on public.support_tickets;
create trigger notify_support_ticket_created_trigger
after insert on public.support_tickets for each row execute function public.notify_support_ticket_created();
revoke all on function public.notify_support_ticket_created() from public;

drop policy if exists "Support staff view ticket users" on public.profiles;
create policy "Support staff view ticket users" on public.profiles for select to authenticated
  using (public.has_permission('support.view') and exists (
    select 1 from public.support_tickets ticket where ticket.user_id = profiles.id
  ));
drop policy if exists "Support staff view ticket events" on public.events;
create policy "Support staff view ticket events" on public.events for select to authenticated
  using (public.has_permission('support.view') and exists (
    select 1 from public.support_tickets ticket where ticket.event_id = events.id
  ));
drop policy if exists "Support staff view ticket bookings" on public.bookings;
create policy "Support staff view ticket bookings" on public.bookings for select to authenticated
  using (public.has_permission('support.view') and exists (
    select 1 from public.support_tickets ticket where ticket.booking_id = bookings.id
  ));
drop policy if exists "Support staff view ticket payments" on public.payments;
create policy "Support staff view ticket payments" on public.payments for select to authenticated
  using (public.has_permission('support.view') and exists (
    select 1 from public.support_tickets ticket
    where ticket.booking_id = payments.booking_id or ticket.event_id = payments.event_id
  ));

create or replace function public.update_support_ticket(
  target_ticket_id uuid,
  new_status text,
  new_priority text default null,
  assign_to_self boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare previous_row public.support_tickets%rowtype;
begin
  if not public.has_permission('support.respond') then
    raise exception 'Support access is required.' using errcode = '42501';
  end if;
  if new_status in ('resolved', 'closed') and not public.has_permission('support.resolve') then
    raise exception 'Ticket-resolution access is required.' using errcode = '42501';
  end if;
  select * into previous_row from public.support_tickets where id = target_ticket_id for update;
  if previous_row.id is null then raise exception 'Ticket not found.'; end if;
  update public.support_tickets set
    status = new_status,
    priority = coalesce(new_priority, priority),
    assigned_to = case when assign_to_self then auth.uid() else assigned_to end,
    resolved_at = case when new_status in ('resolved', 'closed') then now() else null end,
    updated_at = now()
  where id = target_ticket_id;
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, previous_state, new_state, result)
  select auth.uid(), profile.default_role, 'support.ticket.update', 'support_ticket', target_ticket_id,
    jsonb_build_object('status', previous_row.status, 'priority', previous_row.priority),
    jsonb_build_object('status', new_status, 'priority', coalesce(new_priority, previous_row.priority)), 'success'
  from public.profiles profile where profile.id = auth.uid();
end;
$$;
revoke all on function public.update_support_ticket(uuid, text, text, boolean) from public;
grant execute on function public.update_support_ticket(uuid, text, text, boolean) to authenticated;

-- Commission ledger, cash flow, and office remittance.
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  provider_id uuid references public.provider_profiles(id) on delete set null,
  transaction_type text not null default 'booking_payment',
  payment_method text,
  gross_amount numeric(12,2) not null default 0,
  commission_rate numeric(7,6) not null default 0.10,
  commission_amount numeric(12,2) not null default 0,
  provider_net_amount numeric(12,2) not null default 0,
  amount_received numeric(12,2) not null default 0,
  amount_released numeric(12,2) not null default 0,
  status text not null default 'pending',
  transaction_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transaction_type_check check (transaction_type in (
    'booking_payment', 'commission_revenue', 'provider_payable', 'provider_remittance', 'refund', 'adjustment'
  ))
);
create unique index if not exists financial_transactions_payment_booking_uidx
  on public.financial_transactions (
    payment_id,
    coalesce(booking_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(provider_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where payment_id is not null;
create index if not exists financial_transactions_date_idx on public.financial_transactions (transaction_at desc);

create table if not exists public.cash_remittances (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  coordinator_id uuid not null references public.profiles(id) on delete restrict,
  amount_expected numeric(12,2) not null check (amount_expected >= 0),
  amount_received numeric(12,2) not null default 0 check (amount_received >= 0),
  received_at timestamptz,
  received_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_remittance_status_check check (status in ('pending', 'partially_remitted', 'remitted', 'verified', 'disputed'))
);
create index if not exists cash_remittances_status_idx on public.cash_remittances (status, created_at desc);
alter table public.financial_transactions enable row level security;
alter table public.cash_remittances enable row level security;

drop policy if exists "Finance readers view transactions" on public.financial_transactions;
create policy "Finance readers view transactions" on public.financial_transactions for select to authenticated
  using (public.has_permission('revenue.view') or public.has_permission('cashflow.view'));
drop policy if exists "Remittance readers view remittances" on public.cash_remittances;
create policy "Remittance readers view remittances" on public.cash_remittances for select to authenticated
  using (public.has_permission('remittance.view') or coordinator_id = auth.uid());

create or replace function public.capture_payment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_rate_value numeric(7,6) := 0.10;
  booking_total numeric(12,2);
begin
  if new.status = 'refunded' then
    update public.financial_transactions
    set transaction_type = 'refund',
        commission_amount = 0,
        provider_net_amount = 0,
        amount_received = 0,
        amount_released = gross_amount,
        status = 'refunded',
        updated_at = now()
    where payment_id = new.id;
    return new;
  end if;
  if new.status not in ('paid', 'verified') then return new; end if;
  select coalesce(nullif(setting.value ->> 'value', '')::numeric, 0.10)
  into commission_rate_value from public.system_settings setting where setting.key = 'commission_rate';
  commission_rate_value := coalesce(commission_rate_value, 0.10);

  -- Rebuild this payment's ledger rows so a corrected/re-verified payment does
  -- not retain stale allocations or a previous refund classification.
  delete from public.financial_transactions where payment_id = new.id;

  if new.booking_id is not null then
    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received, status, transaction_at
    )
    select new.id, booking.id, booking.event_id, booking.provider_id, new.provider, new.amount,
      commission_rate_value, round(new.amount * commission_rate_value, 2),
      new.amount - round(new.amount * commission_rate_value, 2), new.amount, new.status::text,
      coalesce(new.verified_at, new.paid_at, now())
    from public.bookings booking where booking.id = new.booking_id
    on conflict do nothing;
  elsif new.event_id is not null then
    select sum(coalesce(booking.amount, 0)) into booking_total
    from public.bookings booking
    where booking.event_id = new.event_id
      and booking.status not in ('rejected', 'cancelled', 'expired');

    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received, status, transaction_at
    )
    select new.id, booking.id, booking.event_id, booking.provider_id, new.provider,
      case when coalesce(booking_total, 0) > 0
        then round(new.amount * coalesce(booking.amount, 0) / booking_total, 2)
        else 0 end,
      commission_rate_value,
      round((case when coalesce(booking_total, 0) > 0
        then new.amount * coalesce(booking.amount, 0) / booking_total else 0 end) * commission_rate_value, 2),
      round((case when coalesce(booking_total, 0) > 0
        then new.amount * coalesce(booking.amount, 0) / booking_total else 0 end) * (1 - commission_rate_value), 2),
      case when coalesce(booking_total, 0) > 0
        then round(new.amount * coalesce(booking.amount, 0) / booking_total, 2) else 0 end,
      new.status::text, coalesce(new.verified_at, new.paid_at, now())
    from public.bookings booking
    where booking.event_id = new.event_id
      and booking.status not in ('rejected', 'cancelled', 'expired')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists capture_payment_financials_trigger on public.payments;
create trigger capture_payment_financials_trigger
after insert or update of status on public.payments
for each row execute function public.capture_payment_financials();
revoke all on function public.capture_payment_financials() from public;

-- Backfill already-paid payments. The trigger function is reused by a harmless status touch.
update public.payments set status = status where status in ('paid', 'verified');

create or replace function public.record_cash_remittance(
  target_event_id uuid,
  target_booking_id uuid,
  target_coordinator_id uuid,
  expected_amount numeric,
  received_amount numeric,
  reference_number text default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  remittance_id uuid;
  next_status text;
  booking_provider_id uuid;
begin
  if not public.has_permission('remittance.create') then
    raise exception 'Remittance-entry access is required.' using errcode = '42501';
  end if;
  if expected_amount < 0 or received_amount < 0 then raise exception 'Amounts cannot be negative.'; end if;
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id and event.coordinator_id = target_coordinator_id
  ) then raise exception 'Coordinator is not assigned to this event.'; end if;
  next_status := case
    when received_amount = 0 then 'pending'
    when received_amount < expected_amount then 'partially_remitted'
    else 'remitted'
  end;
  insert into public.cash_remittances (
    event_id, booking_id, coordinator_id, amount_expected, amount_received,
    received_at, received_by, status, reference_number, notes
  ) values (
    target_event_id, target_booking_id, target_coordinator_id, expected_amount, received_amount,
    case when received_amount > 0 then now() end, auth.uid(), next_status,
    nullif(trim(reference_number), ''), nullif(trim(notes), '')
  ) returning id into remittance_id;

  if received_amount > 0 then
    select booking.provider_id into booking_provider_id
    from public.bookings booking where booking.id = target_booking_id;
    insert into public.financial_transactions (
      booking_id, event_id, provider_id, transaction_type, payment_method,
      gross_amount, commission_rate, commission_amount, provider_net_amount,
      amount_received, amount_released, status, transaction_at, metadata
    ) values (
      target_booking_id, target_event_id, booking_provider_id, 'provider_remittance', 'cash',
      received_amount, 0, 0, 0, received_amount, 0, next_status, now(),
      jsonb_build_object('cash_remittance_id', remittance_id)
    );
  end if;
  return remittance_id;
end;
$$;

create or replace function public.verify_cash_remittance(target_remittance_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Remittance-verification access is required.' using errcode = '42501';
  end if;
  if new_status not in ('verified', 'disputed') then raise exception 'Unsupported remittance status.'; end if;
  update public.cash_remittances set status = new_status, updated_at = now()
  where id = target_remittance_id;
  if not found then raise exception 'Remittance not found.'; end if;
  update public.financial_transactions set status = new_status, updated_at = now()
  where metadata ->> 'cash_remittance_id' = target_remittance_id::text;
end;
$$;

create or replace function public.get_revenue_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.has_permission('revenue.view') then
    jsonb_build_object('error', 'Revenue access is required.')
  else jsonb_build_object(
    'gross_amount', coalesce(sum(ledger.gross_amount) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')), 0),
    'commission_amount', coalesce(sum(ledger.commission_amount) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')), 0),
    'provider_net_amount', coalesce(sum(ledger.provider_net_amount) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')), 0),
    'amount_received', coalesce(sum(ledger.amount_received) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')), 0),
    'amount_released', coalesce(sum(ledger.amount_released) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')), 0),
    'transaction_count', count(ledger.id) filter (where ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified')),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', month_row.month_key,
        'gross', month_row.gross_total,
        'commission', month_row.commission_total
      ) order by month_row.month_key)
      from (
        select
          to_char(date_trunc('month', item.transaction_at), 'YYYY-MM') as month_key,
          sum(item.gross_amount) as gross_total,
          sum(item.commission_amount) as commission_total
        from public.financial_transactions item
        where item.transaction_type = 'booking_payment'
          and item.status in ('paid', 'verified')
        group by date_trunc('month', item.transaction_at)
        order by date_trunc('month', item.transaction_at) desc limit 12
      ) month_row
    ), '[]'::jsonb)
  ) end
  from public.financial_transactions as ledger;
$$;

create or replace function public.get_business_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.has_permission('dashboard.analytics.view') then
    jsonb_build_object('error', 'Analytics access is required.')
  else jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'total_clients', (select count(*) from public.profiles where default_role = 'client'),
    'total_providers', (select count(*) from public.provider_profiles),
    'total_bookings', (select count(*) from public.bookings),
    'completed_events', (select count(*) from public.events where status = 'completed'),
    'upcoming_events', (select count(*) from public.events where status not in ('completed', 'cancelled') and event_date >= current_date),
    'cancelled_events', (select count(*) from public.events where status = 'cancelled'),
    'gross_transaction_value', (select coalesce(sum(gross_amount), 0) from public.financial_transactions where transaction_type = 'booking_payment' and status in ('paid', 'verified')),
    'commission_revenue', (select coalesce(sum(commission_amount), 0) from public.financial_transactions where transaction_type = 'booking_payment' and status in ('paid', 'verified')),
    'booking_statuses', coalesce((
      select jsonb_agg(jsonb_build_object('status', status_row.status_key, 'count', status_row.status_total) order by status_row.status_total desc)
      from (
        select booking.status::text as status_key, count(*) as status_total
        from public.bookings booking
        group by booking.status
      ) status_row
    ), '[]'::jsonb),
    'monthly_bookings', coalesce((
      select jsonb_agg(jsonb_build_object('month', trend.month_key, 'count', trend.booking_total) order by trend.month_key)
      from (
        select
          to_char(date_trunc('month', booking.created_at), 'YYYY-MM') as month_key,
          count(*) as booking_total
        from public.bookings booking
        where booking.created_at >= date_trunc('month', now()) - interval '11 months'
        group by date_trunc('month', booking.created_at)
      ) trend
    ), '[]'::jsonb),
    'top_providers', coalesce((
      select jsonb_agg(jsonb_build_object('name', ranked.business_name, 'rating', ranked.rating, 'bookings', ranked.booking_count) order by ranked.rating desc, ranked.booking_count desc)
      from (
        select provider.business_name, coalesce(round(avg(review.rating)::numeric, 1), 0) as rating,
          count(distinct booking.id) as booking_count
        from public.provider_profiles provider
        left join public.reviews review on review.provider_id = provider.id
        left join public.bookings booking on booking.provider_id = provider.id
        group by provider.id, provider.business_name order by rating desc, booking_count desc limit 5
      ) ranked
    ), '[]'::jsonb),
    'popular_categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', ranked.name, 'bookings', ranked.booking_count) order by ranked.booking_count desc)
      from (
        select category.name, count(booking.id) as booking_count
        from public.service_categories category
        left join public.services service on service.category_id = category.id
        left join public.bookings booking on booking.service_id = service.id
        group by category.id, category.name order by booking_count desc limit 6
      ) ranked
    ), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) from public;
revoke all on function public.verify_cash_remittance(uuid, text) from public;
revoke all on function public.get_revenue_dashboard() from public;
revoke all on function public.get_business_dashboard() from public;
grant execute on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.verify_cash_remittance(uuid, text) to authenticated;
grant execute on function public.get_revenue_dashboard() to authenticated;
grant execute on function public.get_business_dashboard() to authenticated;

-- Replace broad legacy staff read policies with feature-scoped authorization.
drop policy if exists "Platform staff can view profiles" on public.profiles;
drop policy if exists "Authorized staff can view profiles" on public.profiles;
create policy "Authorized staff can view profiles" on public.profiles for select to authenticated
  using (public.has_permission('users.view'));
drop policy if exists "Platform staff can view providers" on public.provider_profiles;
drop policy if exists "Authorized staff can view providers" on public.provider_profiles;
create policy "Authorized staff can view providers" on public.provider_profiles for select to authenticated
  using (public.has_permission('providers.view'));
drop policy if exists "Platform staff can view events" on public.events;
drop policy if exists "Authorized staff can view events" on public.events;
create policy "Authorized staff can view events" on public.events for select to authenticated
  using (public.has_permission('events.view'));
drop policy if exists "Platform staff can view services" on public.services;
drop policy if exists "Authorized staff can view services" on public.services;
create policy "Authorized staff can view services" on public.services for select to authenticated
  using (public.has_permission('services.view'));
drop policy if exists "Platform staff can view service packages" on public.service_packages;
drop policy if exists "Authorized staff can view service packages" on public.service_packages;
create policy "Authorized staff can view service packages" on public.service_packages for select to authenticated
  using (public.has_permission('services.view'));
drop policy if exists "Platform staff can view bookings" on public.bookings;
drop policy if exists "Authorized staff can view bookings" on public.bookings;
create policy "Authorized staff can view bookings" on public.bookings for select to authenticated
  using (public.has_permission('events.view') or public.has_permission('revenue.view'));
drop policy if exists "Platform staff can view payments" on public.payments;
drop policy if exists "Authorized staff can view payments" on public.payments;
create policy "Authorized staff can view payments" on public.payments for select to authenticated
  using (public.has_permission('revenue.view') or public.has_permission('cashflow.view'));
drop policy if exists "Platform staff can view reviews" on public.reviews;
drop policy if exists "Authorized staff can view reviews" on public.reviews;
create policy "Authorized staff can view reviews" on public.reviews for select to authenticated
  using (public.has_permission('providers.view'));
drop policy if exists "Superadmins can view audit logs" on public.audit_logs;
drop policy if exists "Authorized staff can view audit logs" on public.audit_logs;
create policy "Authorized staff can view audit logs" on public.audit_logs for select to authenticated
  using (public.has_permission('system.audit_logs'));
drop policy if exists "Superadmins can view system settings" on public.system_settings;
drop policy if exists "Authorized staff can view system settings" on public.system_settings;
create policy "Authorized staff can view system settings" on public.system_settings for select to authenticated
  using (public.has_permission('system.settings'));

-- Keep the established RPC name, but enforce the dynamic permission instead
-- of hardcoding the Superadmin role in the backend.
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
  caller_role public.user_role;
begin
  if not public.has_permission('system.settings') then
    raise exception 'System-settings access is required.' using errcode = '42501';
  end if;
  if nullif(trim(setting_key), '') is null then
    raise exception 'A setting key is required.';
  end if;

  select value into previous_value
  from public.system_settings
  where key = setting_key;
  select default_role into caller_role
  from public.profiles where id = auth.uid();

  insert into public.system_settings (key, value, description, updated_by, updated_at)
  values (trim(setting_key), setting_value, setting_description, auth.uid(), now())
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
    auth.uid(), caller_role, 'system_setting.update', 'system_setting', setting_id,
    jsonb_build_object('value', previous_value),
    jsonb_build_object('value', setting_value),
    'success'
  );
  return setting_id;
end;
$$;
revoke all on function public.superadmin_upsert_system_setting(text, jsonb, text) from public;
grant execute on function public.superadmin_upsert_system_setting(text, jsonb, text) to authenticated;

-- Admin user access is now view-only; account changes require users.update.
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
  if not public.has_permission('users.update') then
    raise exception 'User-update access is required.' using errcode = '42501';
  end if;
  select default_role into caller_role from public.profiles where id = auth.uid();
  select default_role, account_status into target_role, previous_status from public.profiles where id = target_user_id;
  if target_role is null then raise exception 'Account not found.'; end if;
  if target_user_id = auth.uid() or target_role = 'superadmin' then raise exception 'This account cannot be changed here.'; end if;
  if target_role = 'admin' and caller_role <> 'superadmin' then
    raise exception 'Only a Superadmin can change an Admin account.' using errcode = '42501';
  end if;
  if new_status not in ('active', 'suspended', 'disabled') then raise exception 'Unsupported account status.'; end if;
  if new_status in ('suspended', 'disabled') and nullif(trim(reason), '') is null then
    raise exception 'A reason is required.';
  end if;
  update public.profiles set account_status = new_status, updated_at = now() where id = target_user_id;
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, previous_state, new_state, result, metadata)
  values (auth.uid(), caller_role, 'account.status.update', 'profile', target_user_id,
    jsonb_build_object('account_status', previous_status), jsonb_build_object('account_status', new_status),
    'success', jsonb_build_object('reason', nullif(trim(reason), '')));
end;
$$;

create or replace function public.admin_set_provider_verification(
  target_provider_id uuid,
  new_status public.account_status,
  reason text
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
  agreement_accepted boolean;
  agreement_version text;
begin
  if new_status = 'verified' and not public.has_permission('providers.approve') then
    raise exception 'Provider-approval access is required.' using errcode = '42501';
  elsif new_status = 'disabled' and not public.has_permission('providers.reject') then
    raise exception 'Provider-rejection access is required.' using errcode = '42501';
  elsif not public.has_permission('providers.review') then
    raise exception 'Provider-review access is required.' using errcode = '42501';
  end if;
  if new_status not in ('pending', 'verified', 'disabled') then raise exception 'Unsupported status.'; end if;
  if new_status = 'disabled' and nullif(trim(reason), '') is null then raise exception 'A rejection reason is required.'; end if;
  select default_role into caller_role from public.profiles where id = auth.uid();
  select user_id, verification_status, terms_accepted, terms_version
  into provider_user_id, previous_status, agreement_accepted, agreement_version
  from public.provider_profiles where id = target_provider_id for update;
  if provider_user_id is null then raise exception 'Provider not found.'; end if;
  if new_status = 'verified' and (
    not agreement_accepted
    or agreement_version is distinct from '2026-09-25-commission-v1'
  ) then
    raise exception 'The provider must accept the current commission terms before approval.';
  end if;
  update public.provider_profiles set verification_status = new_status,
    rejection_reason = case when new_status = 'disabled' then trim(reason) else null end,
    updated_at = now() where id = target_provider_id;
  update public.profiles set account_status = new_status, updated_at = now() where id = provider_user_id;
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, previous_state, new_state, result, metadata)
  values (auth.uid(), caller_role, 'provider.verification.update', 'provider_profile', target_provider_id,
    jsonb_build_object('verification_status', previous_status), jsonb_build_object('verification_status', new_status),
    'success', jsonb_build_object('reason', nullif(trim(reason), '')));
end;
$$;

-- Keep the original two-argument RPC compatible with older web builds.
create or replace function public.admin_set_provider_verification(
  target_provider_id uuid,
  new_status public.account_status
)
returns void
language sql
security definer
set search_path = ''
as $$ select public.admin_set_provider_verification(target_provider_id, new_status, null); $$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text) from public;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status, text) from public;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status) from public;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status) to authenticated;

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
  select default_role into caller_role from public.profiles where id = auth.uid();
  select service.status, service.name, provider.user_id, service.submission_kind
  into previous_status, service_name, provider_user_id, reviewed_submission_kind
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  where service.id = target_service_id for update of service;
  if previous_status is null then raise exception 'Service not found.'; end if;
  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only services awaiting review or previously declined can be moderated.';
  end if;
  next_status := case when decision = 'approved' then 'active' else 'rejected' end;
  perform set_config('app.service_delete_authorized', 'true', true);
  perform set_config('app.service_snapshot_authorized', 'true', true);
  update public.service_packages set is_active = (decision = 'approved'), updated_at = now()
  where service_id = target_service_id;
  update public.services set status = next_status,
    moderation_note = nullif(trim(review_note), ''), moderated_at = now(), moderated_by = auth.uid(),
    last_approved_snapshot = case when decision = 'approved' then public.build_service_snapshot(target_service_id) else last_approved_snapshot end,
    updated_at = now()
  where id = target_service_id;
  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'service.review.' || decision, 'service', target_service_id,
    jsonb_build_object('status', previous_status), jsonb_build_object('status', next_status), 'success',
    jsonb_build_object('note', nullif(trim(review_note), ''), 'submission_kind', reviewed_submission_kind)
  );
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (provider_user_id,
    case when decision = 'approved' then 'Service approved' else 'Service needs changes' end,
    case when decision = 'approved' then service_name || ' is now visible to clients.'
      else service_name || ' was not approved. ' || trim(review_note) end,
    'service', target_service_id);
end;
$$;
revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

-- Audit the new operational records. Ticket/message text is intentionally excluded.
drop trigger if exists capture_platform_audit_trigger on public.role_permissions;
drop trigger if exists capture_platform_audit_trigger on public.user_permissions;
do $$
declare audited_table text;
begin
  foreach audited_table in array array[
    'coordinator_availability',
    'financial_transactions', 'cash_remittances'
  ] loop
    execute format('drop trigger if exists capture_platform_audit_trigger on public.%I', audited_table);
    execute format('create trigger capture_platform_audit_trigger after insert or update or delete on public.%I for each row execute function public.capture_platform_audit()', audited_table);
  end loop;
end;
$$;

grant select on public.roles, public.permissions, public.role_permissions, public.user_permissions to authenticated;
grant select, insert, update, delete on public.coordinator_availability to authenticated;
grant select on public.financial_transactions, public.cash_remittances to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

comment on table public.user_permissions is 'Per-user permission overrides; granted=false explicitly denies a role default.';
comment on table public.financial_transactions is 'Commission-aware financial ledger generated from paid or verified payments.';
comment on table public.cash_remittances is 'Office cash handoff records involving assigned coordinators.';
comment on table public.support_tickets is 'Platform and process concerns handled by MULTIVENT Customer Service.';

commit;
