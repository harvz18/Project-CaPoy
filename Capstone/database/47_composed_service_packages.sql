-- MULTIVENT provider package adjustment: compose packages from owned services.
-- Apply after 46_sentiment_analysis_retry.sql.

begin;

alter table public.service_packages
  add column if not exists pricing_mode text not null default 'legacy',
  add column if not exists subtotal numeric(12,2),
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric(12,2) not null default 0,
  add column if not exists discount_amount numeric(12,2) not null default 0;

alter table public.service_packages
  drop constraint if exists service_packages_pricing_mode_check,
  add constraint service_packages_pricing_mode_check
    check (pricing_mode in ('legacy', 'composed')),
  drop constraint if exists service_packages_discount_type_check,
  add constraint service_packages_discount_type_check
    check (discount_type in ('none', 'percentage', 'fixed')),
  drop constraint if exists service_packages_discount_value_check,
  add constraint service_packages_discount_value_check
    check (discount_value >= 0),
  drop constraint if exists service_packages_discount_amount_check,
  add constraint service_packages_discount_amount_check
    check (discount_amount >= 0),
  drop constraint if exists service_packages_subtotal_check,
  add constraint service_packages_subtotal_check
    check (subtotal is null or subtotal >= 0);

create table if not exists public.service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  quantity numeric(8,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_package_items_unique_service unique (package_id, service_id)
);

create index if not exists service_package_items_package_idx
  on public.service_package_items (package_id, position, id);
create index if not exists service_package_items_service_idx
  on public.service_package_items (service_id, package_id);

alter table public.service_package_items enable row level security;
revoke all on table public.service_package_items from anon, authenticated;

drop policy if exists "Public view published package services" on public.service_package_items;
create policy "Public view published package services"
  on public.service_package_items for select to anon, authenticated
  using (
    exists (
      select 1
      from public.service_packages package
      join public.services host_service on host_service.id = package.service_id
      where package.id = service_package_items.package_id
        and package.is_active = true
        and host_service.status = 'active'
        and host_service.is_available = true
    )
  );

drop policy if exists "Providers view owned package services" on public.service_package_items;
create policy "Providers view owned package services"
  on public.service_package_items for select to authenticated
  using (
    exists (
      select 1
      from public.service_packages package
      join public.services host_service on host_service.id = package.service_id
      join public.provider_profiles provider on provider.id = host_service.provider_id
      where package.id = service_package_items.package_id
        and provider.user_id = auth.uid()
    )
  );

drop policy if exists "Authorized staff view package services" on public.service_package_items;
create policy "Authorized staff view package services"
  on public.service_package_items for select to authenticated
  using (public.has_permission('services.review'));

grant select on public.service_package_items to anon, authenticated;

-- Preserve composition and promotion details in the established moderation
-- snapshot so staff can compare a package-only revision with its approved one.
create or replace function public.build_service_snapshot(target_service_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'service',
      (to_jsonb(service_row) - array[
        'last_approved_snapshot', 'submission_kind', 'moderation_note',
        'moderated_at', 'moderated_by', 'created_at', 'updated_at', 'status'
      ]) || jsonb_build_object('category_name', category_row.name),
    'packages',
      coalesce(
        (
          select jsonb_agg(
            (to_jsonb(package_row) - array['created_at', 'updated_at', 'is_active'])
              || jsonb_build_object(
                'services', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'service_id', item.service_id,
                      'service_name', included_service.name,
                      'quantity', item.quantity,
                      'unit_price', item.unit_price,
                      'position', item.position
                    ) order by item.position, item.id
                  )
                  from public.service_package_items item
                  join public.services included_service on included_service.id = item.service_id
                  where item.package_id = package_row.id
                ), '[]'::jsonb)
              )
            order by package_row.name, package_row.id
          )
          from public.service_packages package_row
          where package_row.service_id = service_row.id
        ),
        '[]'::jsonb
      )
  )
  from public.services service_row
  left join public.service_categories category_row on category_row.id = service_row.category_id
  where service_row.id = target_service_id;
$$;

revoke all on function public.build_service_snapshot(uuid) from public;

create or replace function public.recalculate_composed_service_package(
  target_package_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  package_row public.service_packages%rowtype;
  host_provider_id uuid;
  item_count integer;
  invalid_count integer;
  calculated_subtotal numeric(12,2);
  calculated_discount numeric(12,2);
  calculated_price numeric(12,2);
begin
  select package.* into package_row
  from public.service_packages package
  where package.id = target_package_id
  for update;

  if package_row.id is null or package_row.pricing_mode <> 'composed' then
    return;
  end if;

  select service.provider_id into host_provider_id
  from public.services service
  where service.id = package_row.service_id;

  select count(*),
    count(*) filter (
      where service.provider_id is distinct from host_provider_id
        or service.base_price is null
        or service.base_price <= 0
    ),
    round(sum(service.base_price * item.quantity), 2)
  into item_count, invalid_count, calculated_subtotal
  from public.service_package_items item
  join public.services service on service.id = item.service_id
  where item.package_id = target_package_id;

  if item_count = 0 then
    raise exception 'A composed package must include at least one service.';
  end if;
  if invalid_count > 0 then
    raise exception 'Packages can only contain your own services with a set price.';
  end if;
  if package_row.discount_type = 'percentage' then
    if package_row.discount_value >= 100 then
      raise exception 'The percentage discount must be less than 100%%.';
    end if;
    calculated_discount := round(calculated_subtotal * package_row.discount_value / 100, 2);
  elsif package_row.discount_type = 'fixed' then
    if package_row.discount_value >= calculated_subtotal then
      raise exception 'The fixed discount must be less than the package subtotal.';
    end if;
    calculated_discount := round(package_row.discount_value, 2);
  else
    calculated_discount := 0;
  end if;

  calculated_price := round(calculated_subtotal - calculated_discount, 2);

  update public.service_package_items item
  set unit_price = service.base_price,
      updated_at = now()
  from public.services service
  where item.package_id = target_package_id
    and service.id = item.service_id
    and item.unit_price is distinct from service.base_price;

  update public.service_packages
  set subtotal = calculated_subtotal,
      discount_amount = calculated_discount,
      price = calculated_price,
      -- A bundle may mix services from any category and charging unit. Its
      -- calculated sum is sold once as a fixed package for the whole event.
      pricing_unit = 'event',
      updated_at = now()
  where id = target_package_id;
end;
$$;

revoke all on function public.recalculate_composed_service_package(uuid) from public;

create or replace function public.provider_save_composed_package(
  target_package_id uuid,
  target_service_ids uuid[],
  package_name text,
  package_description text,
  package_inclusions jsonb,
  package_discount_type text,
  package_discount_value numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_provider_id uuid;
  saved_package_id uuid;
  host_service_id uuid;
  existing_host_service_id uuid;
  normalized_discount_type text := coalesce(nullif(trim(package_discount_type), ''), 'none');
  normalized_discount_value numeric(12,2) := round(coalesce(package_discount_value, 0), 2);
  service_count integer;
  valid_service_count integer;
  calculated_subtotal numeric(12,2);
  calculated_discount numeric(12,2);
  calculated_price numeric(12,2);
begin
  if nullif(trim(package_name), '') is null then
    raise exception 'Enter a package name.';
  end if;
  if coalesce(array_length(target_service_ids, 1), 0) = 0 then
    raise exception 'Select at least one service for this package.';
  end if;
  if normalized_discount_type not in ('none', 'percentage', 'fixed') then
    raise exception 'Unsupported package discount type.';
  end if;
  if normalized_discount_value < 0 then
    raise exception 'The package discount cannot be negative.';
  end if;
  if jsonb_typeof(coalesce(package_inclusions, '[]'::jsonb)) <> 'array' then
    raise exception 'Package inclusions must be a list.';
  end if;

  select provider.id into caller_provider_id
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and profile.account_status = 'active'
  order by provider.created_at
  limit 1;

  if caller_provider_id is null then
    raise exception 'An active service-provider account is required.' using errcode = '42501';
  end if;

  with requested_services as (
    select service_id, min(position)::integer as position
    from unnest(target_service_ids) with ordinality requested(service_id, position)
    where service_id is not null
    group by service_id
  )
  select count(*),
    count(*) filter (
      where service.provider_id = caller_provider_id
        and service.base_price is not null
        and service.base_price > 0
        and service.status <> 'deleted'
    ),
    round(sum(service.base_price), 2),
    (array_agg(service.id order by requested.position))[1]
  into service_count, valid_service_count, calculated_subtotal, host_service_id
  from requested_services requested
  join public.services service on service.id = requested.service_id;

  if service_count <> coalesce(array_length(target_service_ids, 1), 0)
    or valid_service_count <> service_count
  then
    raise exception 'Packages can only contain your own services with a set price.';
  end if;
  if normalized_discount_type = 'percentage' then
    if normalized_discount_value >= 100 then
      raise exception 'The percentage discount must be less than 100%%.';
    end if;
    calculated_discount := round(calculated_subtotal * normalized_discount_value / 100, 2);
  elsif normalized_discount_type = 'fixed' then
    if normalized_discount_value >= calculated_subtotal then
      raise exception 'The fixed discount must be less than the package subtotal.';
    end if;
    calculated_discount := normalized_discount_value;
  else
    normalized_discount_value := 0;
    calculated_discount := 0;
  end if;
  calculated_price := round(calculated_subtotal - calculated_discount, 2);

  if target_package_id is not null then
    select package.id, package.service_id
    into saved_package_id, existing_host_service_id
    from public.service_packages package
    join public.services host_service on host_service.id = package.service_id
    where package.id = target_package_id
      and host_service.provider_id = caller_provider_id
    for update;

    if saved_package_id is null then
      raise exception 'Package not found or not owned by this provider.' using errcode = '42501';
    end if;
    if not existing_host_service_id = any(target_service_ids) then
      raise exception 'The package must retain its primary service.';
    end if;
    host_service_id := existing_host_service_id;

    update public.service_packages
    set service_id = host_service_id,
        name = trim(package_name),
        description = nullif(trim(package_description), ''),
        price = calculated_price,
        pricing_unit = 'event',
        inclusions = coalesce(package_inclusions, '[]'::jsonb),
        is_active = false,
        pricing_mode = 'composed',
        subtotal = calculated_subtotal,
        discount_type = normalized_discount_type,
        discount_value = normalized_discount_value,
        discount_amount = calculated_discount,
        updated_at = now()
    where id = saved_package_id;

    delete from public.service_package_items where package_id = saved_package_id;
  else
    insert into public.service_packages (
      service_id, name, description, price, pricing_unit, inclusions, is_active,
      pricing_mode, subtotal, discount_type, discount_value, discount_amount
    ) values (
      host_service_id, trim(package_name), nullif(trim(package_description), ''),
      calculated_price, 'event', coalesce(package_inclusions, '[]'::jsonb), false,
      'composed', calculated_subtotal, normalized_discount_type,
      normalized_discount_value, calculated_discount
    ) returning id into saved_package_id;
  end if;

  insert into public.service_package_items (
    package_id, service_id, quantity, unit_price, position
  )
  select saved_package_id, service.id, 1, service.base_price, requested.position - 1
  from unnest(target_service_ids) with ordinality requested(service_id, position)
  join public.services service on service.id = requested.service_id
  group by service.id, service.base_price, requested.position
  order by requested.position;

  perform public.recalculate_composed_service_package(saved_package_id);
  return saved_package_id;
end;
$$;

revoke all on function public.provider_save_composed_package(
  uuid, uuid[], text, text, jsonb, text, numeric
) from public;
grant execute on function public.provider_save_composed_package(
  uuid, uuid[], text, text, jsonb, text, numeric
) to authenticated;

create or replace function public.refresh_composed_packages_after_service_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_package record;
begin
  if new.status <> 'active' or new.is_available = false then
    update public.service_packages package
    set is_active = false,
        updated_at = now()
    where package.id in (
      select item.package_id
      from public.service_package_items item
      where item.service_id = new.id
    )
      and package.is_active = true;
    return new;
  end if;

  if new.base_price is not distinct from old.base_price
    and new.pricing_unit is not distinct from old.pricing_unit
    and new.status is not distinct from old.status
    and new.is_available is not distinct from old.is_available
  then
    return new;
  end if;

  for affected_package in
    select package.id
    from public.service_package_items item
    join public.service_packages package on package.id = item.package_id
    where item.service_id = new.id
      and package.pricing_mode = 'composed'
  loop
    begin
      perform public.recalculate_composed_service_package(affected_package.id);
    exception when others then
      -- A service-price edit must not strand the provider. If the edit makes a
      -- composition invalid (for example a missing component price), hide that
      -- package until the provider reconfigures and resubmits it.
      update public.service_packages
      set is_active = false,
          updated_at = now()
      where id = affected_package.id;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists refresh_composed_packages_after_service_price_trigger
  on public.services;
create trigger refresh_composed_packages_after_service_price_trigger
after update of base_price, pricing_unit, status, is_available on public.services
for each row execute function public.refresh_composed_packages_after_service_price_change();

revoke all on function public.refresh_composed_packages_after_service_price_change() from public;

comment on table public.service_package_items is
  'Provider-owned services selected as the components of a composed package.';
comment on function public.provider_save_composed_package(
  uuid, uuid[], text, text, jsonb, text, numeric
) is
  'Validates and saves a provider package, deriving its price from owned services and an optional discount.';

commit;
