-- Provider-configured catering styles used by the client booking-details screen.
-- Apply after 23_service_revision_comparison.sql.

begin;

alter table public.services
  add column if not exists catering_service_types text[] not null default '{}'::text[];

alter table public.services
  drop constraint if exists services_catering_service_types_check,
  add constraint services_catering_service_types_check
    check (
      catering_service_types <@ array['plated', 'buffet', 'packed']::text[]
      and cardinality(catering_service_types) <= 3
    );

create or replace function public.validate_catering_service_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
begin
  select lower(service_categories.name)
  into category_name
  from public.service_categories
  where service_categories.id = new.category_id;

  if category_name like '%cater%'
    and new.status::text in ('pending_review', 'active')
    and cardinality(new.catering_service_types) = 0
  then
    raise exception 'Select at least one catering style before submitting this service.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_catering_service_listing_trigger on public.services;
create trigger validate_catering_service_listing_trigger
before insert or update of category_id, status, catering_service_types
on public.services
for each row execute function public.validate_catering_service_listing();

create or replace function public.validate_selected_catering_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  available_types text[];
begin
  if new.service_id is null then
    return new;
  end if;

  select lower(service_categories.name), services.catering_service_types
  into category_name, available_types
  from public.services
  join public.service_categories on service_categories.id = services.category_id
  where services.id = new.service_id;

  if category_name like '%cater%' and (
    new.meal_type is null
    or not (new.meal_type = any(coalesce(available_types, '{}'::text[])))
  ) then
    raise exception 'Choose a catering style offered by this provider.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_selected_catering_type_trigger
  on public.event_service_selections;
create trigger validate_selected_catering_type_trigger
before insert or update of service_id, meal_type
on public.event_service_selections
for each row execute function public.validate_selected_catering_type();

revoke all on function public.validate_catering_service_listing() from public;
revoke all on function public.validate_selected_catering_type() from public;

create or replace function public.enforce_service_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_material_change boolean;
begin
  if auth.role() = 'service_role'
    or public.is_platform_staff()
    or current_setting('app.service_delete_authorized', true) = 'true'
    or current_setting('app.service_snapshot_authorized', true) = 'true'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.submission_kind := 'new';
    new.last_approved_snapshot := null;
    if new.status <> 'draft' then
      new.status := 'pending_review';
      new.moderation_note := null;
      new.moderated_at := null;
      new.moderated_by := null;
    end if;
    return new;
  end if;

  new.submission_kind := old.submission_kind;
  new.last_approved_snapshot := old.last_approved_snapshot;

  has_material_change :=
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.base_price is distinct from old.base_price
    or new.category_id is distinct from old.category_id
    or new.location is distinct from old.location
    or new.cover_image_url is distinct from old.cover_image_url
    or new.gallery_urls is distinct from old.gallery_urls
    or new.pricing_model is distinct from old.pricing_model
    or new.pricing_unit is distinct from old.pricing_unit
    or new.pricing_details is distinct from old.pricing_details
    or new.catering_service_types is distinct from old.catering_service_types;

  if old.status = 'active' and has_material_change then
    new.last_approved_snapshot := public.build_service_snapshot(old.id);
    new.submission_kind := 'updated';
  elsif has_material_change and old.last_approved_snapshot is not null then
    new.submission_kind := 'updated';
  end if;

  if new.status <> 'draft' and (
    new.status is distinct from old.status or has_material_change
  ) then
    new.status := 'pending_review';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_service_review_status() from public;

comment on column public.services.catering_service_types is
  'Catering fulfillment styles offered by the provider: plated, buffet, and/or packed.';

commit;
