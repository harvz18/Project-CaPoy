-- MULTIVENT Revision 2, Phase 2: coordinator-curated packages.
-- Apply after 53_coordinator_marketplace.sql.

begin;

create table if not exists public.coordinator_packages (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  event_type text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coordinator_packages_name_check check (char_length(trim(name)) between 3 and 120),
  constraint coordinator_packages_description_check check (char_length(description) <= 2000),
  constraint coordinator_packages_event_type_check check (event_type in ('wedding', 'preWedding', 'postWedding')),
  constraint coordinator_packages_status_check check (status in ('draft', 'active', 'inactive'))
);

create table if not exists public.coordinator_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.coordinator_packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  constraint coordinator_package_items_unique_service unique (package_id, service_id)
);

create index if not exists coordinator_packages_owner_idx
  on public.coordinator_packages (coordinator_id, status, updated_at desc);
create index if not exists coordinator_package_items_package_idx
  on public.coordinator_package_items (package_id, position, id);
create index if not exists coordinator_package_items_service_idx
  on public.coordinator_package_items (service_id, package_id);

create table if not exists public.event_coordinator_package_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  package_id uuid references public.coordinator_packages(id) on delete set null,
  coordinator_id uuid not null references public.profiles(id) on delete restrict,
  package_name text not null,
  package_snapshot jsonb not null default '{}'::jsonb,
  service_subtotal numeric(12,2) not null default 0 check (service_subtotal >= 0),
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_coordinator_package_services (
  package_selection_id uuid not null references public.event_coordinator_package_selections(id) on delete cascade,
  event_selection_id uuid not null references public.event_service_selections(id) on delete cascade,
  created_by_package boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (package_selection_id, event_selection_id)
);

alter table public.coordinator_packages enable row level security;
alter table public.coordinator_package_items enable row level security;
alter table public.event_coordinator_package_selections enable row level security;
alter table public.event_coordinator_package_services enable row level security;

drop policy if exists "Coordinators view own packages" on public.coordinator_packages;
create policy "Coordinators view own packages"
  on public.coordinator_packages for select to authenticated
  using (coordinator_id = auth.uid());

drop policy if exists "Coordinators view own package items" on public.coordinator_package_items;
create policy "Coordinators view own package items"
  on public.coordinator_package_items for select to authenticated
  using (exists (
    select 1 from public.coordinator_packages package
    where package.id = coordinator_package_items.package_id
      and package.coordinator_id = auth.uid()
  ));

drop policy if exists "Event participants view chosen coordinator package" on public.event_coordinator_package_selections;
create policy "Event participants view chosen coordinator package"
  on public.event_coordinator_package_selections for select to authenticated
  using (exists (
    select 1 from public.events event
    where event.id = event_coordinator_package_selections.event_id
      and (event.client_id = auth.uid() or event.coordinator_id = auth.uid()
        or event.pending_coordinator_id = auth.uid())
  ));

drop policy if exists "Event participants view chosen coordinator package services" on public.event_coordinator_package_services;
create policy "Event participants view chosen coordinator package services"
  on public.event_coordinator_package_services for select to authenticated
  using (exists (
    select 1
    from public.event_coordinator_package_selections package_selection
    join public.events event on event.id = package_selection.event_id
    where package_selection.id = event_coordinator_package_services.package_selection_id
      and (event.client_id = auth.uid() or event.coordinator_id = auth.uid()
        or event.pending_coordinator_id = auth.uid())
  ));

grant select on public.coordinator_packages, public.coordinator_package_items,
  public.event_coordinator_package_selections, public.event_coordinator_package_services
  to authenticated;

create or replace function public.get_my_coordinator_packages()
returns table (
  id uuid, name text, description text, event_type text, status text,
  updated_at timestamptz, items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select package.id, package.name, package.description, package.event_type,
    package.status, package.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'service_id', item.service_id,
        'service_name', service.name,
        'category_name', coalesce(category.name, 'Service'),
        'provider_name', coalesce(provider.business_name, 'Provider'),
        'base_price', service.base_price,
        'pricing_unit', coalesce(service.pricing_unit, 'event'),
        'service_status', service.status,
        'is_available', service.is_available
      ) order by item.position, item.id)
      from public.coordinator_package_items item
      join public.services service on service.id = item.service_id
      left join public.service_categories category on category.id = service.category_id
      left join public.provider_profiles provider on provider.id = service.provider_id
      where item.package_id = package.id
    ), '[]'::jsonb)
  from public.coordinator_packages package
  where package.coordinator_id = auth.uid()
  order by package.updated_at desc, package.name;
$$;

create or replace function public.save_my_coordinator_package(
  target_package_id uuid,
  package_name text,
  package_description text,
  package_event_type text,
  package_status text,
  target_service_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_package_id uuid;
  requested_count integer;
  valid_count integer;
  normalized_status text := coalesce(nullif(trim(package_status), ''), 'draft');
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.account_status = 'active'
      and (profile.default_role = 'event_coordinator' or exists (
        select 1 from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = profile.id and role.name = 'event_coordinator'
      ))
  ) then raise exception 'An active Event Coordinator account is required.' using errcode = '42501'; end if;
  if char_length(coalesce(trim(package_name), '')) < 3 then raise exception 'Package name must contain at least 3 characters.'; end if;
  if char_length(trim(package_name)) > 120 then raise exception 'Package name cannot exceed 120 characters.'; end if;
  if char_length(coalesce(trim(package_description), '')) > 2000 then raise exception 'Description cannot exceed 2,000 characters.'; end if;
  if package_event_type not in ('wedding', 'preWedding', 'postWedding') then raise exception 'Choose a valid event type.'; end if;
  if normalized_status not in ('draft', 'active', 'inactive') then raise exception 'Choose a valid package status.'; end if;

  with requested as (
    select distinct service_id from unnest(coalesce(target_service_ids, '{}')) service_id
    where service_id is not null
  )
  select count(*), count(*) filter (
    where service.id is not null
      and service.status = 'active'
      and service.is_available = true
      and service.base_price is not null and service.base_price > 0
      and provider.id is not null
      and owner.account_status in ('active', 'verified')
  ) into requested_count, valid_count
  from requested
  left join public.services service on service.id = requested.service_id
  left join public.provider_profiles provider on provider.id = service.provider_id
  left join public.profiles owner on owner.id = provider.user_id;

  if requested_count = 0 then raise exception 'Select at least one marketplace service.'; end if;
  if valid_count <> requested_count then
    raise exception 'Packages can only include active, available services with a valid current price.';
  end if;

  if target_package_id is null then
    insert into public.coordinator_packages (
      coordinator_id, name, description, event_type, status
    ) values (
      auth.uid(), trim(package_name), coalesce(trim(package_description), ''),
      package_event_type, normalized_status
    ) returning id into saved_package_id;
  else
    update public.coordinator_packages set
      name = trim(package_name), description = coalesce(trim(package_description), ''),
      event_type = package_event_type, status = normalized_status, updated_at = now()
    where id = target_package_id and coordinator_id = auth.uid()
    returning id into saved_package_id;
    if saved_package_id is null then raise exception 'Coordinator package not found.' using errcode = '42501'; end if;
    delete from public.coordinator_package_items where package_id = saved_package_id;
  end if;

  insert into public.coordinator_package_items (package_id, service_id, position)
  select saved_package_id, requested.service_id, min(requested.position)::integer - 1
  from unnest(target_service_ids) with ordinality requested(service_id, position)
  where requested.service_id is not null
  group by requested.service_id
  order by min(requested.position);

  return saved_package_id;
end;
$$;

create or replace function public.set_my_coordinator_package_status(
  target_package_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare invalid_count integer;
begin
  if target_status not in ('active', 'inactive') then raise exception 'Package status must be active or inactive.'; end if;
  if target_status = 'active' then
    select count(*) filter (
      where service.id is null or service.status <> 'active' or service.is_available = false
        or service.base_price is null or service.base_price <= 0
        or owner.account_status not in ('active', 'verified')
    ) + case when count(*) = 0 then 1 else 0 end
    into invalid_count
    from public.coordinator_package_items item
    left join public.services service on service.id = item.service_id
    left join public.provider_profiles provider on provider.id = service.provider_id
    left join public.profiles owner on owner.id = provider.user_id
    where item.package_id = target_package_id;
    if invalid_count > 0 then raise exception 'Replace unavailable services before activating this package.'; end if;
  end if;
  update public.coordinator_packages set status = target_status, updated_at = now()
  where id = target_package_id and coordinator_id = auth.uid();
  if not found then raise exception 'Coordinator package not found.' using errcode = '42501'; end if;
end;
$$;

create or replace function public.list_bookable_coordinator_packages(
  target_coordinator_id uuid default null,
  target_event_id uuid default null
)
returns table (
  id uuid, coordinator_id uuid, name text, description text, event_type text,
  is_available boolean, unavailable_reason text, service_subtotal numeric,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with requested_event as (
    select event.id, event.event_type, greatest(coalesce(event.guest_count, 1), 1) as guest_count
    from public.events event
    where event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
      and (target_event_id is null or event.id = target_event_id)
    order by event.updated_at desc limit 1
  ), rate as (
    select public.get_public_commission_rate()::numeric as value
  )
  select package.id, package.coordinator_id, package.name, package.description,
    package.event_type,
    coalesce(validity.invalid_count, 0) = 0 and coalesce(validity.item_count, 0) > 0 as is_available,
    case
      when coalesce(validity.item_count, 0) = 0 then 'This package has no services.'
      when coalesce(validity.invalid_count, 0) > 0 then 'One or more services are currently unavailable.'
      else null
    end as unavailable_reason,
    coalesce(validity.customer_subtotal, 0) as service_subtotal,
    coalesce(validity.items, '[]'::jsonb) as items
  from public.coordinator_packages package
  join public.coordinator_service_profiles coordinator_profile
    on coordinator_profile.coordinator_id = package.coordinator_id
  join public.profiles coordinator on coordinator.id = package.coordinator_id
  left join requested_event event on true
  cross join rate
  left join lateral (
    select count(*)::integer as item_count,
      count(*) filter (
        where service.status <> 'active' or service.is_available = false
          or service.base_price is null or service.base_price <= 0
          or owner.account_status not in ('active', 'verified')
      )::integer as invalid_count,
      round(sum(
        service.base_price
        * case when service.pricing_unit = 'person' then coalesce(event.guest_count, 1) else 1 end
        * (1 + rate.value)
      ), 2) as customer_subtotal,
      jsonb_agg(jsonb_build_object(
        'service_id', service.id, 'service_name', service.name,
        'category_name', coalesce(category.name, 'Service'),
        'provider_id', provider.id, 'provider_name', coalesce(provider.business_name, 'Provider'),
        'provider_price', service.base_price,
        'customer_unit_price', round(service.base_price * (1 + rate.value), 2),
        'pricing_unit', coalesce(service.pricing_unit, 'event'),
        'estimated_amount', round(service.base_price
          * case when service.pricing_unit = 'person' then coalesce(event.guest_count, 1) else 1 end
          * (1 + rate.value), 2),
        'commission_rate', rate.value,
        'cover_image_url', service.cover_image_url
      ) order by item.position, item.id) as items
    from public.coordinator_package_items item
    join public.services service on service.id = item.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    left join public.service_categories category on category.id = service.category_id
    where item.package_id = package.id
  ) validity on true
  where auth.uid() is not null
    and package.status = 'active'
    and coordinator.account_status = 'active'
    and coordinator_profile.is_accepting_bookings
    and (target_coordinator_id is null or package.coordinator_id = target_coordinator_id)
    and (event.id is null or package.event_type = event.event_type)
  order by package.name;
$$;

create or replace function public.choose_coordinator_package(
  target_event_id uuid,
  target_package_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  package_row public.coordinator_packages%rowtype;
  package_selection_id uuid;
  item_row record;
  existing_selection_id uuid;
  existing_selection_amount numeric(12,2);
  selection_id uuid;
  created_selection boolean;
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  calculated_service_subtotal numeric(12,2) := 0;
  commission_rate numeric := public.get_public_commission_rate();
  selected_services jsonb := '[]'::jsonb;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then raise exception 'Event not found.' using errcode = '42501'; end if;

  select * into package_row from public.coordinator_packages package
  where package.id = target_package_id and package.status = 'active' for share;
  if package_row.id is null then raise exception 'This coordinator package is no longer active.'; end if;
  if package_row.event_type <> event_row.event_type then raise exception 'This package does not match the event type.'; end if;
  if not exists (
    select 1 from public.coordinator_package_items item
    join public.services service on service.id = item.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where item.package_id = package_row.id
    having count(*) > 0 and count(*) filter (
      where service.status = 'active' and service.is_available = true
        and service.base_price > 0 and owner.account_status in ('active', 'verified')
    ) = count(*)
  ) then raise exception 'One or more package services are currently unavailable.'; end if;

  if event_row.coordinator_id is distinct from package_row.coordinator_id
    and event_row.pending_coordinator_id is distinct from package_row.coordinator_id
  then
    perform public.assign_event_coordinator(event_row.id, package_row.coordinator_id);
    select * into event_row from public.events where id = target_event_id for update;
  end if;

  if exists (
    select 1 from public.event_coordinator_package_services package_service
    join public.event_coordinator_package_selections package_selection
      on package_selection.id = package_service.package_selection_id
    join public.event_service_selections selection on selection.id = package_service.event_selection_id
    where package_selection.event_id = event_row.id
      and package_service.created_by_package
      and selection.status <> 'selected'
  ) then raise exception 'A package with active booking requests cannot be replaced.'; end if;

  delete from public.event_service_selections selection
  where selection.status = 'selected' and selection.id in (
    select package_service.event_selection_id
    from public.event_coordinator_package_services package_service
    join public.event_coordinator_package_selections package_selection
      on package_selection.id = package_service.package_selection_id
    where package_selection.event_id = event_row.id and package_service.created_by_package
  );
  delete from public.event_coordinator_package_selections where event_id = event_row.id;

  insert into public.event_coordinator_package_selections (
    event_id, package_id, coordinator_id, package_name, package_snapshot
  ) values (
    event_row.id, package_row.id, package_row.coordinator_id, package_row.name,
    jsonb_build_object('package_id', package_row.id, 'name', package_row.name,
      'description', package_row.description, 'event_type', package_row.event_type,
      'captured_at', now())
  ) returning id into package_selection_id;

  for item_row in
    select item.position, service.*, category.name as category_name,
      provider.business_name as provider_name
    from public.coordinator_package_items item
    join public.services service on service.id = item.service_id
    join public.provider_profiles provider on provider.id = service.provider_id
    left join public.service_categories category on category.id = service.category_id
    where item.package_id = package_row.id
    order by item.position, item.id
  loop
    provider_amount := round(item_row.base_price
      * case when item_row.pricing_unit = 'person' then greatest(coalesce(event_row.guest_count, 1), 1) else 1 end, 2);
    customer_amount := round(provider_amount * (1 + commission_rate), 2);
    select selection.id, selection.estimated_amount
    into existing_selection_id, existing_selection_amount
    from public.event_service_selections selection
    where selection.event_id = event_row.id and selection.service_id = item_row.id
      and selection.status not in ('declined', 'cancelled')
    order by selection.created_at limit 1;
    created_selection := existing_selection_id is null;
    if not created_selection then customer_amount := existing_selection_amount; end if;
    calculated_service_subtotal := calculated_service_subtotal + customer_amount;

    if created_selection then
      insert into public.event_service_selections (
        event_id, client_id, provider_id, service_id, category_id,
        service_name, category_name, estimated_amount, attendee_count,
        budget_per_head, outside_food, status, selected_provider_snapshot
      ) values (
        event_row.id, event_row.client_id, item_row.provider_id, item_row.id,
        item_row.category_id, item_row.name, coalesce(item_row.category_name, 'Service'),
        customer_amount,
        case when item_row.pricing_unit = 'person' then greatest(coalesce(event_row.guest_count, 1), 1) else null end,
        case when item_row.pricing_unit = 'person' then round(item_row.base_price * (1 + commission_rate), 2) else null end,
        false, 'selected', jsonb_build_object(
          'commissionAmount', round(customer_amount - provider_amount, 2),
          'commissionModel', 'added_to_customer', 'commissionRate', commission_rate,
          'providerAmount', provider_amount, 'providerName', coalesce(item_row.provider_name, 'Provider'),
          'coordinatorPackageId', package_row.id, 'coordinatorPackageName', package_row.name,
          'remainingBudgetCurrency', 'PHP'
        )
      ) returning id into selection_id;
    else
      selection_id := existing_selection_id;
    end if;

    insert into public.event_coordinator_package_services (
      package_selection_id, event_selection_id, created_by_package
    ) values (package_selection_id, selection_id, created_selection);
    selected_services := selected_services || jsonb_build_array(jsonb_build_object(
      'selection_id', selection_id, 'service_id', item_row.id,
      'service_name', item_row.name, 'estimated_amount', customer_amount,
      'created_by_package', created_selection));
    existing_selection_id := null;
    existing_selection_amount := null;
  end loop;

  update public.event_coordinator_package_selections set
    service_subtotal = calculated_service_subtotal,
    package_snapshot = package_snapshot || jsonb_build_object(
      'service_subtotal', calculated_service_subtotal, 'services', selected_services
    ), updated_at = now()
  where id = package_selection_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (package_row.coordinator_id, 'Coordinator package selected',
    format('A client selected %s for %s. Each provider will still review its own booking request.',
      package_row.name, event_row.name), 'event', event_row.id);

  return jsonb_build_object(
    'event_id', event_row.id, 'package_id', package_row.id,
    'package_name', package_row.name, 'service_subtotal', calculated_service_subtotal,
    'services', selected_services, 'coordinator_fee', event_row.coordinator_fee_amount
  );
end;
$$;

create or replace function public.clear_event_coordinator_package(
  target_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then raise exception 'Event not found.' using errcode = '42501'; end if;

  if exists (
    select 1 from public.event_coordinator_package_services package_service
    join public.event_coordinator_package_selections package_selection
      on package_selection.id = package_service.package_selection_id
    join public.event_service_selections selection on selection.id = package_service.event_selection_id
    where package_selection.event_id = target_event_id
      and package_service.created_by_package and selection.status <> 'selected'
  ) then raise exception 'This package already has active provider requests and cannot be removed here.'; end if;

  delete from public.event_service_selections selection
  where selection.status = 'selected' and selection.id in (
    select package_service.event_selection_id
    from public.event_coordinator_package_services package_service
    join public.event_coordinator_package_selections package_selection
      on package_selection.id = package_service.package_selection_id
    where package_selection.event_id = target_event_id and package_service.created_by_package
  );
  delete from public.event_coordinator_package_selections where event_id = target_event_id;
end;
$$;

create or replace function public.assign_event_coordinator_only(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform public.clear_event_coordinator_package(target_event_id);
  result := public.assign_event_coordinator(target_event_id, target_coordinator_id);
  return result;
end;
$$;

create or replace function public.remove_event_coordinator_and_package(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform public.clear_event_coordinator_package(target_event_id);
  result := public.remove_event_coordinator(target_event_id);
  return result;
end;
$$;

create or replace function public.deactivate_coordinator_packages_for_invalid_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.is_available = false or new.base_price is null or new.base_price <= 0 then
    update public.coordinator_packages package set status = 'inactive', updated_at = now()
    where package.status = 'active' and exists (
      select 1 from public.coordinator_package_items item
      where item.package_id = package.id and item.service_id = new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists deactivate_coordinator_packages_for_invalid_service_trigger on public.services;
create trigger deactivate_coordinator_packages_for_invalid_service_trigger
after update of status, is_available, base_price on public.services
for each row execute function public.deactivate_coordinator_packages_for_invalid_service();

drop trigger if exists capture_platform_audit_trigger on public.coordinator_packages;
create trigger capture_platform_audit_trigger
after insert or update or delete on public.coordinator_packages
for each row execute function public.capture_platform_audit();

drop trigger if exists capture_platform_audit_trigger on public.coordinator_package_items;
create trigger capture_platform_audit_trigger
after insert or update or delete on public.coordinator_package_items
for each row execute function public.capture_platform_audit();

drop trigger if exists capture_platform_audit_trigger on public.event_coordinator_package_selections;
create trigger capture_platform_audit_trigger
after insert or update or delete on public.event_coordinator_package_selections
for each row execute function public.capture_platform_audit();

revoke all on function public.get_my_coordinator_packages() from public;
revoke all on function public.save_my_coordinator_package(uuid, text, text, text, text, uuid[]) from public;
revoke all on function public.set_my_coordinator_package_status(uuid, text) from public;
revoke all on function public.list_bookable_coordinator_packages(uuid, uuid) from public;
revoke all on function public.choose_coordinator_package(uuid, uuid) from public;
revoke all on function public.clear_event_coordinator_package(uuid) from public;
revoke all on function public.assign_event_coordinator_only(uuid, uuid) from public;
revoke all on function public.remove_event_coordinator_and_package(uuid) from public;
revoke all on function public.deactivate_coordinator_packages_for_invalid_service() from public;
grant execute on function public.get_my_coordinator_packages() to authenticated;
grant execute on function public.save_my_coordinator_package(uuid, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.set_my_coordinator_package_status(uuid, text) to authenticated;
grant execute on function public.list_bookable_coordinator_packages(uuid, uuid) to authenticated;
grant execute on function public.choose_coordinator_package(uuid, uuid) to authenticated;
grant execute on function public.assign_event_coordinator_only(uuid, uuid) to authenticated;
grant execute on function public.remove_event_coordinator_and_package(uuid) to authenticated;

comment on table public.coordinator_packages is
  'Coordinator-owned curated package definitions that reference real marketplace services.';
comment on table public.coordinator_package_items is
  'Ordered references to provider-owned services; no service data is duplicated.';
comment on table public.event_coordinator_package_selections is
  'Client package choices with an audit snapshot and current centrally calculated subtotal.';

commit;
