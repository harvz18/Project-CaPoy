-- MULTIVENT Revision V15, Phase 7: one provider-owned commercial package
-- containing one venue and one catering service. The package price is the
-- inclusive total; it never adds both standalone services at checkout.

begin;

create table if not exists public.venue_catering_package_details (
  package_id uuid primary key references public.service_packages(id) on delete cascade,
  venue_service_id uuid not null references public.services(id) on delete restrict,
  catering_service_id uuid not null references public.services(id) on delete restrict,
  venue_option_id text,
  package_pricing_policy text not null default 'inclusive_fixed'
    check (package_pricing_policy = 'inclusive_fixed'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_catering_package_details_distinct_services check (venue_service_id <> catering_service_id),
  constraint venue_catering_package_details_unique_components unique (venue_service_id, catering_service_id)
);

alter table public.venue_catering_package_details enable row level security;
revoke all on table public.venue_catering_package_details from anon, authenticated;
create policy "Public view active venue catering packages"
  on public.venue_catering_package_details for select to anon, authenticated using (
    exists (
      select 1 from public.service_packages package
      join public.services venue on venue.id = venue_catering_package_details.venue_service_id
      join public.services catering on catering.id = venue_catering_package_details.catering_service_id
      where package.id = venue_catering_package_details.package_id
        and package.is_active = true and coalesce(package.is_deleted, false) = false
        and venue.status = 'active' and venue.is_available = true
        and catering.status = 'active' and catering.is_available = true
    )
  );
create policy "Providers view owned venue catering packages"
  on public.venue_catering_package_details for select to authenticated using (
    exists (
      select 1 from public.services venue
      join public.provider_profiles provider on provider.id = venue.provider_id
      where venue.id = venue_catering_package_details.venue_service_id
        and provider.user_id = auth.uid()
    )
  );
grant select on public.venue_catering_package_details to anon, authenticated;

-- Reuse the reviewed composed-package routine for price, moderation, and
-- service ownership. This wrapper fixes the venue as host regardless of UI
-- selection order, and refuses unrelated or duplicate category components.
create or replace function public.provider_save_v15_venue_catering_package(
  target_package_id uuid,
  target_venue_service_id uuid,
  target_catering_service_id uuid,
  target_venue_option_id text default null,
  package_name text default null,
  package_description text default null,
  package_inclusions jsonb default '[]'::jsonb,
  package_discount_type text default 'none',
  package_discount_value numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_provider_id uuid;
  venue_row record;
  catering_row record;
  saved_package_id uuid;
begin
  select provider.id into caller_provider_id
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid() and profile.account_status = 'active'
  order by provider.created_at limit 1;
  if caller_provider_id is null then
    raise exception 'An active service-provider account is required.' using errcode = '42501';
  end if;

  select service.id, service.provider_id, service.category_details, category.name as category_name
  into venue_row from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_venue_service_id;
  select service.id, service.provider_id, category.name as category_name
  into catering_row from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_catering_service_id;
  if venue_row.id is null or catering_row.id is null
    or venue_row.provider_id <> caller_provider_id or catering_row.provider_id <> caller_provider_id
    or public.phase9_category_key(venue_row.category_name) <> 'venue'
    or public.phase9_category_key(catering_row.category_name) <> 'catering' then
    raise exception 'Choose one of your active Venue services and one of your active Catering services.' using errcode = '22023';
  end if;
  if target_venue_option_id is not null and not exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(venue_row.category_details -> 'spaces') = 'array'
        then venue_row.category_details -> 'spaces' else '[]'::jsonb end
    ) option_row(value) where option_row.value ->> 'id' = target_venue_option_id
  ) then
    raise exception 'The selected venue hall is not offered by this venue service.' using errcode = '22023';
  end if;

  -- The ordered arguments make the venue the host service for catalog display
  -- and booking ownership while retaining catering as a real package component.
  saved_package_id := public.provider_save_composed_package(
    target_package_id,
    array[target_venue_service_id, target_catering_service_id],
    package_name, package_description, package_inclusions,
    package_discount_type, package_discount_value
  );
  update public.service_packages set is_active = false, updated_at = now()
  where id = saved_package_id;
  insert into public.venue_catering_package_details (
    package_id, venue_service_id, catering_service_id, venue_option_id, updated_at
  ) values (
    saved_package_id, target_venue_service_id, target_catering_service_id,
    nullif(trim(coalesce(target_venue_option_id, '')), ''), now()
  ) on conflict (package_id) do update set
    venue_service_id = excluded.venue_service_id,
    catering_service_id = excluded.catering_service_id,
    venue_option_id = excluded.venue_option_id,
    updated_at = now();
  return saved_package_id;
end;
$$;

-- Packages remain moderation-controlled. An active combined package must
-- retain its venue host and both components; this blocks hand-edited records
-- from turning into a second payable service.
create or replace function public.validate_v15_venue_catering_package()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  detail_row public.venue_catering_package_details%rowtype;
  item_count integer;
begin
  select * into detail_row from public.venue_catering_package_details
  where package_id = new.id;
  if detail_row.package_id is null then return new; end if;
  if new.service_id <> detail_row.venue_service_id then
    raise exception 'A Venue + Catering package must remain hosted by its venue service.';
  end if;
  select count(*) into item_count from public.service_package_items item
  where item.package_id = new.id and item.service_id in (detail_row.venue_service_id, detail_row.catering_service_id);
  if item_count <> 2 then
    raise exception 'A Venue + Catering package must retain exactly its venue and catering components.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_v15_venue_catering_package_trigger on public.service_packages;
create trigger validate_v15_venue_catering_package_trigger
before update of service_id, is_active on public.service_packages
for each row execute function public.validate_v15_venue_catering_package();

revoke all on function public.provider_save_v15_venue_catering_package(uuid, uuid, uuid, text, text, text, jsonb, text, numeric) from public;
grant execute on function public.provider_save_v15_venue_catering_package(uuid, uuid, uuid, text, text, text, jsonb, text, numeric) to authenticated;
revoke all on function public.validate_v15_venue_catering_package() from public;

comment on table public.venue_catering_package_details is
  'V15 fixed-inclusive Venue + Catering package components. One package creates one booking and one payable obligation.';
commit;
