-- MULTIVENT Revision V17, Phase 1: normalized florist-service foundation.
--
-- This migration is intentionally additive. Existing generic service category
-- details, packages, selections, and bookings remain readable and untouched.
-- It stores provider-defined florist inventory separately so future client
-- selection and pricing paths can be validated against published records.

begin;

create table if not exists public.florist_arrangements (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  category text not null check (char_length(trim(category)) > 0),
  description text,
  image_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(image_urls) = 'array'),
  base_price numeric(12,2) not null check (base_price >= 0),
  pricing_unit text not null default 'piece'
    check (pricing_unit in ('piece', 'pair', 'set', 'table', 'installation', 'fixed')),
  minimum_quantity integer not null default 1 check (minimum_quantity > 0),
  maximum_quantity integer check (maximum_quantity is null or maximum_quantity >= minimum_quantity),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.florist_arrangement_option_groups (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.florist_arrangements(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  selection_type text not null
    check (selection_type in ('single', 'multiple', 'quantity', 'text', 'image')),
  is_required boolean not null default false,
  minimum_selections integer not null default 0 check (minimum_selections >= 0),
  maximum_selections integer check (maximum_selections is null or maximum_selections >= minimum_selections),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint florist_option_groups_single_maximum_check
    check (selection_type <> 'single' or maximum_selections is null or maximum_selections <= 1)
);

create table if not exists public.florist_arrangement_options (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.florist_arrangement_option_groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  image_url text,
  price_modifier numeric(12,2) not null default 0 check (price_modifier >= 0),
  price_modifier_type text not null default 'included'
    check (price_modifier_type in ('fixed', 'per_unit', 'per_selection', 'included')),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- service_packages remains the package header and price source. These rows
-- add florist-specific inclusions and upgrades without changing generic or
-- composed packages used by any other service category.
create table if not exists public.florist_package_arrangements (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  arrangement_id uuid not null references public.florist_arrangements(id) on delete restrict,
  included_quantity integer not null default 1 check (included_quantity > 0),
  customization_allowed boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint florist_package_arrangements_unique unique (package_id, arrangement_id)
);

create table if not exists public.florist_package_add_ons (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  arrangement_id uuid references public.florist_arrangements(id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  price numeric(12,2) not null check (price >= 0),
  pricing_unit text not null default 'fixed'
    check (pricing_unit in ('piece', 'pair', 'set', 'table', 'installation', 'fixed')),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.florist_service_fulfillment_options (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  fulfillment_kind text not null check (fulfillment_kind in ('pickup', 'delivery', 'installation')),
  name text not null check (char_length(trim(name)) > 0),
  description text,
  coverage_details text,
  price numeric(12,2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists florist_arrangements_service_idx
  on public.florist_arrangements (service_id, is_active, display_order, id);
create index if not exists florist_option_groups_arrangement_idx
  on public.florist_arrangement_option_groups (arrangement_id, is_active, display_order, id);
create index if not exists florist_options_group_idx
  on public.florist_arrangement_options (option_group_id, is_active, display_order, id);
create index if not exists florist_package_arrangements_package_idx
  on public.florist_package_arrangements (package_id, display_order, id);
create index if not exists florist_package_add_ons_package_idx
  on public.florist_package_add_ons (package_id, is_active, display_order, id);
create index if not exists florist_fulfillment_service_idx
  on public.florist_service_fulfillment_options (service_id, is_active, display_order, id);

-- Client configuration remains a snapshot in the existing selection/booking
-- records. It is empty for historic and non-florist rows, preserving all
-- established selection, request, payment, and acceptance flows.
alter table public.event_service_selections
  add column if not exists florist_selection_snapshot jsonb not null default '{}'::jsonb;
alter table public.bookings
  add column if not exists florist_selection_snapshot jsonb not null default '{}'::jsonb;

alter table public.event_service_selections
  drop constraint if exists event_service_selections_florist_snapshot_object_check,
  add constraint event_service_selections_florist_snapshot_object_check
    check (jsonb_typeof(florist_selection_snapshot) = 'object');
alter table public.bookings
  drop constraint if exists bookings_florist_snapshot_object_check,
  add constraint bookings_florist_snapshot_object_check
    check (jsonb_typeof(florist_selection_snapshot) = 'object');

create or replace function public.validate_v17_florist_service_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.services service
    join public.service_categories category on category.id = service.category_id
    where service.id = new.service_id
      and lower(category.name) like '%flor%'
  ) then
    raise exception 'Florist configuration requires a florist service.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_v17_florist_package_arrangement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.service_packages package
    join public.services host_service on host_service.id = package.service_id
    join public.service_categories category on category.id = host_service.category_id
    join public.florist_arrangements arrangement on arrangement.id = new.arrangement_id
    where package.id = new.package_id
      and arrangement.service_id = package.service_id
      and lower(category.name) like '%flor%'
  ) then
    raise exception 'Florist package arrangements must belong to the package florist service.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_v17_florist_package_add_on()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.service_packages package
    join public.services host_service on host_service.id = package.service_id
    join public.service_categories category on category.id = host_service.category_id
    where package.id = new.package_id
      and lower(category.name) like '%flor%'
      and (
        new.arrangement_id is null
        or exists (
          select 1 from public.florist_arrangements arrangement
          where arrangement.id = new.arrangement_id
            and arrangement.service_id = package.service_id
        )
      )
  ) then
    raise exception 'Florist package add-ons must belong to the package florist service.';
  end if;
  return new;
end;
$$;

-- A package containing florist-specific rows may not be reassigned to another
-- service behind those rows. This protects ownership and booking validation.
create or replace function public.validate_v17_florist_package_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.florist_package_arrangements item where item.package_id = new.id
  ) or exists (
    select 1 from public.florist_package_add_ons item where item.package_id = new.id
  ) then
    if not exists (
      select 1
      from public.services service
      join public.service_categories category on category.id = service.category_id
      where service.id = new.service_id and lower(category.name) like '%flor%'
    ) then
      raise exception 'A florist package must remain attached to a florist service.';
    end if;
    if exists (
      select 1
      from public.florist_package_arrangements item
      join public.florist_arrangements arrangement on arrangement.id = item.arrangement_id
      where item.package_id = new.id and arrangement.service_id <> new.service_id
    ) or exists (
      select 1
      from public.florist_package_add_ons item
      join public.florist_arrangements arrangement on arrangement.id = item.arrangement_id
      where item.package_id = new.id
        and item.arrangement_id is not null
        and arrangement.service_id <> new.service_id
    ) then
      raise exception 'Florist package records must remain with their original service.';
    end if;
  end if;
  return new;
end;
$$;

-- Do not allow a configured florist service to be silently recategorized.
create or replace function public.validate_v17_florist_service_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.florist_arrangements where service_id = new.id)
    or exists (select 1 from public.florist_service_fulfillment_options where service_id = new.id)
  then
    if not exists (
      select 1 from public.service_categories category
      where category.id = new.category_id and lower(category.name) like '%flor%'
    ) then
      raise exception 'A service with florist configuration must remain in the florist category.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_v17_florist_arrangement_service_trigger on public.florist_arrangements;
create trigger validate_v17_florist_arrangement_service_trigger
before insert or update of service_id on public.florist_arrangements
for each row execute function public.validate_v17_florist_service_reference();

drop trigger if exists validate_v17_florist_fulfillment_service_trigger on public.florist_service_fulfillment_options;
create trigger validate_v17_florist_fulfillment_service_trigger
before insert or update of service_id on public.florist_service_fulfillment_options
for each row execute function public.validate_v17_florist_service_reference();

drop trigger if exists validate_v17_florist_package_arrangement_trigger on public.florist_package_arrangements;
create trigger validate_v17_florist_package_arrangement_trigger
before insert or update of package_id, arrangement_id on public.florist_package_arrangements
for each row execute function public.validate_v17_florist_package_arrangement();

drop trigger if exists validate_v17_florist_package_add_on_trigger on public.florist_package_add_ons;
create trigger validate_v17_florist_package_add_on_trigger
before insert or update of package_id, arrangement_id on public.florist_package_add_ons
for each row execute function public.validate_v17_florist_package_add_on();

drop trigger if exists validate_v17_florist_package_host_trigger on public.service_packages;
create trigger validate_v17_florist_package_host_trigger
before update of service_id on public.service_packages
for each row execute function public.validate_v17_florist_package_host();

drop trigger if exists validate_v17_florist_service_category_trigger on public.services;
create trigger validate_v17_florist_service_category_trigger
before update of category_id on public.services
for each row execute function public.validate_v17_florist_service_category();

alter table public.florist_arrangements enable row level security;
alter table public.florist_arrangement_option_groups enable row level security;
alter table public.florist_arrangement_options enable row level security;
alter table public.florist_package_arrangements enable row level security;
alter table public.florist_package_add_ons enable row level security;
alter table public.florist_service_fulfillment_options enable row level security;

revoke all on table public.florist_arrangements,
  public.florist_arrangement_option_groups,
  public.florist_arrangement_options,
  public.florist_package_arrangements,
  public.florist_package_add_ons,
  public.florist_service_fulfillment_options from anon, authenticated;

-- Published configuration is readable only while its parent florist service
-- is active and available. Provider ownership policies below retain access to
-- drafts and inactive records without exposing them to clients.
create policy "Public view published florist arrangements"
  on public.florist_arrangements for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.services service
    join public.service_categories category on category.id = service.category_id
    where service.id = florist_arrangements.service_id
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Public view published florist option groups"
  on public.florist_arrangement_option_groups for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.florist_arrangements arrangement
    join public.services service on service.id = arrangement.service_id
    join public.service_categories category on category.id = service.category_id
    where arrangement.id = florist_arrangement_option_groups.arrangement_id
      and arrangement.is_active = true
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Public view published florist options"
  on public.florist_arrangement_options for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.florist_arrangement_option_groups option_group
    join public.florist_arrangements arrangement on arrangement.id = option_group.arrangement_id
    join public.services service on service.id = arrangement.service_id
    join public.service_categories category on category.id = service.category_id
    where option_group.id = florist_arrangement_options.option_group_id
      and option_group.is_active = true and arrangement.is_active = true
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Public view published florist package arrangements"
  on public.florist_package_arrangements for select to anon, authenticated
  using (exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.service_categories category on category.id = service.category_id
    join public.florist_arrangements arrangement on arrangement.id = florist_package_arrangements.arrangement_id
    where package.id = florist_package_arrangements.package_id
      and package.is_active = true and arrangement.is_active = true
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Public view published florist package add-ons"
  on public.florist_package_add_ons for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.service_categories category on category.id = service.category_id
    where package.id = florist_package_add_ons.package_id
      and package.is_active = true
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Public view published florist fulfillment options"
  on public.florist_service_fulfillment_options for select to anon, authenticated
  using (is_active and exists (
    select 1 from public.services service
    join public.service_categories category on category.id = service.category_id
    where service.id = florist_service_fulfillment_options.service_id
      and service.status = 'active' and service.is_available = true
      and lower(category.name) like '%flor%'
  ));

create policy "Providers manage own florist arrangements"
  on public.florist_arrangements for all to authenticated
  using (exists (
    select 1 from public.services service
    join public.provider_profiles provider on provider.id = service.provider_id
    where service.id = florist_arrangements.service_id and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.services service
    join public.provider_profiles provider on provider.id = service.provider_id
    where service.id = florist_arrangements.service_id and provider.user_id = auth.uid()
  ));

create policy "Providers manage own florist option groups"
  on public.florist_arrangement_option_groups for all to authenticated
  using (exists (
    select 1 from public.florist_arrangements arrangement
    join public.services service on service.id = arrangement.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where arrangement.id = florist_arrangement_option_groups.arrangement_id
      and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.florist_arrangements arrangement
    join public.services service on service.id = arrangement.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where arrangement.id = florist_arrangement_option_groups.arrangement_id
      and provider.user_id = auth.uid()
  ));

create policy "Providers manage own florist options"
  on public.florist_arrangement_options for all to authenticated
  using (exists (
    select 1 from public.florist_arrangement_option_groups option_group
    join public.florist_arrangements arrangement on arrangement.id = option_group.arrangement_id
    join public.services service on service.id = arrangement.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where option_group.id = florist_arrangement_options.option_group_id
      and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.florist_arrangement_option_groups option_group
    join public.florist_arrangements arrangement on arrangement.id = option_group.arrangement_id
    join public.services service on service.id = arrangement.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where option_group.id = florist_arrangement_options.option_group_id
      and provider.user_id = auth.uid()
  ));

create policy "Providers manage own florist package arrangements"
  on public.florist_package_arrangements for all to authenticated
  using (exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where package.id = florist_package_arrangements.package_id and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where package.id = florist_package_arrangements.package_id and provider.user_id = auth.uid()
  ));

create policy "Providers manage own florist package add-ons"
  on public.florist_package_add_ons for all to authenticated
  using (exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where package.id = florist_package_add_ons.package_id and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.service_packages package
    join public.services service on service.id = package.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    where package.id = florist_package_add_ons.package_id and provider.user_id = auth.uid()
  ));

create policy "Providers manage own florist fulfillment options"
  on public.florist_service_fulfillment_options for all to authenticated
  using (exists (
    select 1 from public.services service
    join public.provider_profiles provider on provider.id = service.provider_id
    where service.id = florist_service_fulfillment_options.service_id
      and provider.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.services service
    join public.provider_profiles provider on provider.id = service.provider_id
    where service.id = florist_service_fulfillment_options.service_id
      and provider.user_id = auth.uid()
  ));

grant select on table public.florist_arrangements,
  public.florist_arrangement_option_groups,
  public.florist_arrangement_options,
  public.florist_package_arrangements,
  public.florist_package_add_ons,
  public.florist_service_fulfillment_options to anon, authenticated;
grant insert, update, delete on table public.florist_arrangements,
  public.florist_arrangement_option_groups,
  public.florist_arrangement_options,
  public.florist_package_arrangements,
  public.florist_package_add_ons,
  public.florist_service_fulfillment_options to authenticated;

comment on table public.florist_arrangements is
  'Provider-defined florist inventory. No predefined arrangements are seeded.';
comment on table public.florist_arrangement_option_groups is
  'Per-arrangement provider-defined customization groups and selection rules.';
comment on table public.florist_arrangement_options is
  'Provider-defined customization choices with explicit price modifier semantics.';
comment on table public.florist_package_arrangements is
  'Florist arrangement inclusions for the existing service_packages header.';
comment on table public.florist_package_add_ons is
  'Optional provider-defined add-ons for a florist package.';
comment on column public.event_service_selections.florist_selection_snapshot is
  'Client florist configuration snapshot; empty for historic and non-florist selections.';
comment on column public.bookings.florist_selection_snapshot is
  'Immutable florist configuration snapshot copied by the florist booking flow.';

revoke all on function public.validate_v17_florist_service_reference() from public;
revoke all on function public.validate_v17_florist_package_arrangement() from public;
revoke all on function public.validate_v17_florist_package_add_on() from public;
revoke all on function public.validate_v17_florist_package_host() from public;
revoke all on function public.validate_v17_florist_service_category() from public;

commit;
