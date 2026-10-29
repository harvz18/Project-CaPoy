-- V20 Phase 9: client-owned marketplace service favorites.
-- This is intentionally separate from event_service_selections.favorite, which
-- describes an event-plan choice rather than a reusable client marketplace save.

begin;

create table if not exists public.client_favorite_services (
  client_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, service_id)
);

create index if not exists client_favorite_services_client_created_idx
  on public.client_favorite_services (client_id, created_at desc);

alter table public.client_favorite_services enable row level security;

drop policy if exists "Clients view their saved services" on public.client_favorite_services;
create policy "Clients view their saved services"
  on public.client_favorite_services for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Clients save services" on public.client_favorite_services;
drop policy if exists "Clients remove their saved services" on public.client_favorite_services;

-- The primary key prevents duplicate rows. The RPC serializes a fast double
-- tap into one authoritative toggle while also refusing unpublished services.
-- Mutations have no direct client RLS policy; they are allowed only through
-- that availability-checking RPC.
create or replace function public.toggle_my_favorite_service(target_service_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_existing boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save a service.' using errcode = '42501';
  end if;

  if target_service_id is null or not exists (
    select 1
    from public.services service
    where service.id = target_service_id
      and service.status = 'active'
      and service.is_available = true
  ) then
    raise exception 'This service is no longer available to save.' using errcode = '22023';
  end if;

  delete from public.client_favorite_services
  where client_id = auth.uid()
    and service_id = target_service_id
  returning true into removed_existing;

  if removed_existing then
    return false;
  end if;

  insert into public.client_favorite_services (client_id, service_id)
  values (auth.uid(), target_service_id)
  on conflict (client_id, service_id) do nothing;

  return true;
end;
$$;

revoke all on function public.toggle_my_favorite_service(uuid) from public, anon;
grant execute on function public.toggle_my_favorite_service(uuid) to authenticated;

commit;
