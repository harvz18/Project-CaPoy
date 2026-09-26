-- MULTIVENT Phase 2: internal-role and coordinator-access hardening.
-- Apply after 30_business_operations_rbac.sql.

begin;

-- Event Coordinators use the established assignment-scoped event policies and
-- RPCs. The global staff permission would otherwise expose unrelated events.
delete from public.role_permissions role_permission
using public.roles role, public.permissions permission
where role_permission.role_id = role.id
  and role_permission.permission_id = permission.id
  and role.name = 'event_coordinator'
  and permission.code = 'events.view';

-- Keep role membership consistent for internal profiles that existed before
-- the dynamic-RBAC migration or were repaired manually by authorized staff.
insert into public.user_roles (user_id, role_id)
select profile.id, role.id
from public.profiles profile
join public.roles role on role.name = profile.default_role
where profile.default_role in (
  'event_coordinator',
  'assistant',
  'customer_service',
  'admin',
  'superadmin'
)
on conflict (user_id, role_id) do nothing;

-- Public Auth metadata is user-controlled. Normalize internal role claims
-- before the existing profile-creation trigger sees them. Privileged account
-- creation deliberately starts as Client and promotes the profile afterward
-- with service-role credentials.
create or replace function public.restrict_public_internal_role_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'default_role', '') in (
    'event_coordinator',
    'assistant',
    'customer_service',
    'admin',
    'superadmin'
  ) then
    new.raw_user_meta_data := jsonb_set(
      coalesce(new.raw_user_meta_data, '{}'::jsonb),
      '{default_role}',
      '"client"'::jsonb,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists aa_restrict_public_internal_role_claims on auth.users;
create trigger aa_restrict_public_internal_role_claims
before insert on auth.users
for each row execute function public.restrict_public_internal_role_claims();

revoke all on function public.restrict_public_internal_role_claims() from public;

comment on function public.restrict_public_internal_role_claims() is
  'Prevents public Auth metadata from creating MULTIVENT employee accounts.';

commit;
