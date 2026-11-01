-- V22 Phase 2: store structured names for new registrations without changing
-- historical display names. Existing full_name values intentionally remain as-is.
begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

comment on column public.profiles.first_name is
  'Optional given name captured for new structured registrations. Legacy records are deliberately not inferred from full_name.';
comment on column public.profiles.last_name is
  'Optional family name captured for new structured registrations. Legacy records are deliberately not inferred from full_name.';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.user_role;
  structured_first_name text := nullif(trim(new.raw_user_meta_data ->> 'first_name'), '');
  structured_last_name text := nullif(trim(new.raw_user_meta_data ->> 'last_name'), '');
  legacy_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  resolved_full_name text;
begin
  selected_role := case new.raw_user_meta_data ->> 'default_role'
    when 'service_provider' then 'service_provider'::public.user_role
    when 'event_coordinator' then 'event_coordinator'::public.user_role
    when 'admin' then 'admin'::public.user_role
    when 'superadmin' then 'superadmin'::public.user_role
    else 'client'::public.user_role
  end;

  resolved_full_name := coalesce(
    legacy_full_name,
    nullif(concat_ws(' ', structured_first_name, structured_last_name), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  insert into public.profiles (
    id,
    first_name,
    last_name,
    full_name,
    email,
    phone,
    default_role,
    account_status
  )
  values (
    new.id,
    structured_first_name,
    structured_last_name,
    resolved_full_name,
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    selected_role,
    case
      when selected_role = 'service_provider' then 'pending'::public.account_status
      else 'active'::public.account_status
    end
  )
  on conflict (id) do update
  set
    first_name = coalesce(excluded.first_name, profiles.first_name),
    last_name = coalesce(excluded.last_name, profiles.last_name),
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = coalesce(excluded.email, profiles.email),
    phone = coalesce(excluded.phone, profiles.phone),
    default_role = excluded.default_role,
    updated_at = now();

  insert into public.user_roles (user_id, role_id)
  select new.id, roles.id
  from public.roles
  where roles.name = selected_role
  on conflict (user_id, role_id) do nothing;

  if selected_role = 'service_provider' then
    insert into public.provider_profiles (
      user_id,
      business_name,
      description,
      contact_email,
      contact_phone,
      verification_status
    )
    values (
      new.id,
      coalesce(
        nullif(new.raw_user_meta_data ->> 'business_name', ''),
        resolved_full_name,
        'Business profile'
      ),
      nullif(new.raw_user_meta_data ->> 'service_category', ''),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      'pending'::public.account_status
    )
    on conflict (user_id) do update
    set
      business_name = excluded.business_name,
      description = coalesce(excluded.description, provider_profiles.description),
      contact_email = coalesce(excluded.contact_email, provider_profiles.contact_email),
      contact_phone = coalesce(excluded.contact_phone, provider_profiles.contact_phone),
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

commit;
