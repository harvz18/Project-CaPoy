-- V15 removes the legacy client-facing catering-style choice. Providers still
-- declare styles for discovery, while a chosen menu/price option is now the
-- authoritative booking choice. Preserve validation for legacy callers that
-- continue to submit a non-empty meal_type.

begin;

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

  select lower(category.name), service.catering_service_types
  into category_name, available_types
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = new.service_id;

  -- A blank value is valid for the V15 menu-driven flow. When a legacy client
  -- provides a style, continue requiring it to be one the provider offers.
  if category_name like '%cater%'
    and nullif(trim(new.meal_type), '') is not null
    and not (new.meal_type = any(coalesce(available_types, '{}'::text[])))
  then
    raise exception 'Choose a catering style offered by this provider.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_selected_catering_type() from public;

comment on function public.validate_selected_catering_type() is
  'Allows V15 menu-driven catering selections without a legacy meal_type while validating non-empty legacy styles.';

commit;
