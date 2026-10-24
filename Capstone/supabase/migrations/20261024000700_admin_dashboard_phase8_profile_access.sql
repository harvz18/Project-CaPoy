-- V13 Phase 8: expose the authenticated staff member's existing public
-- profile-photo URL through the permission-scoped dashboard access payload.
-- No profile, role, permission, notification, or financial data is changed.

begin;

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
      'avatar_url', profile.avatar_url,
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

comment on function public.get_my_staff_access() is
  'Returns the authenticated internal staff profile, including its existing avatar URL, and effective permissions.';

-- One dashboard channel observes these established operational sources and
-- debounces a shared client-side refresh.  Do not create separate channels
-- per dashboard card.  The blocks are idempotent for environments where a
-- prior revision already published one or more of these tables.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'events', 'payments', 'financial_transactions', 'services', 'provider_profiles'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

commit;
