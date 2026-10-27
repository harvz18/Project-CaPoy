-- Beta catalogue guards: provider-defined venue choices and bounded tasting menus.
-- These rules preserve historical snapshots while protecting every new booking.

begin;

create or replace function public.validate_beta_food_tasting_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_name text;
  section_row jsonb;
  tasting_limit integer;
  total_limit integer := 0;
begin
  select lower(trim(category.name)) into category_name
  from public.service_categories category
  where category.id = new.category_id;

  if category_name not like '%cater%'
    or not coalesce(new.category_details @> '{"tastingSettings":{"enabled":true}}'::jsonb, false) then
    return new;
  end if;

  for section_row in select value from jsonb_array_elements(new.category_details -> 'customMenuSections')
  loop
    tasting_limit := (section_row ->> 'tastingSelectionLimit')::integer;
    if tasting_limit > 5 then
      raise exception 'A food tasting course may offer at most 5 selections.' using errcode = '22023';
    end if;
    total_limit := total_limit + tasting_limit;
  end loop;

  if total_limit > 10 then
    raise exception 'A food tasting may offer at most 10 selections in total.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_beta_food_tasting_limits_trigger on public.services;
create trigger validate_beta_food_tasting_limits_trigger
before insert or update of category_id, category_details on public.services
for each row execute function public.validate_beta_food_tasting_limits();

create or replace function public.reject_multiple_beta_venue_options()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(new.venue_options_snapshot) = 'array'
    and jsonb_array_length(new.venue_options_snapshot) > 1 then
    raise exception 'Choose one provider-configured venue option or combination.' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- The quote RPC is also public-facing. Patch the deployed V8 function at its
-- stable validation anchor so a forged request cannot price an ad-hoc room
-- combination before the persistence triggers see it.
do $$
declare
  function_sql text;
  validation_anchor text := '  if cardinality(selected_ids) <> cardinality(array(select distinct unnest(selected_ids))) then';
begin
  select pg_get_functiondef('public.calculate_event_venue_quote_v8(uuid, uuid, jsonb)'::regprocedure)
  into function_sql;

  if position('Choose one provider-configured venue option or combination.' in function_sql) = 0 then
    if position(validation_anchor in function_sql) = 0 then
      raise exception 'Cannot apply beta venue guard: V8 quote validation anchor was not found.';
    end if;
    function_sql := replace(
      function_sql,
      validation_anchor,
      '  if cardinality(selected_ids) > 1 then' || E'\n'
      || '    raise exception ''Choose one provider-configured venue option or combination.'' using errcode = ''22023'';' || E'\n'
      || '  end if;' || E'\n\n'
      || validation_anchor
    );
    execute function_sql;
  end if;
end;
$$;

drop trigger if exists reject_multiple_beta_venue_options_on_selection on public.event_service_selections;
create trigger reject_multiple_beta_venue_options_on_selection
before insert or update of venue_options_snapshot on public.event_service_selections
for each row execute function public.reject_multiple_beta_venue_options();

drop trigger if exists reject_multiple_beta_venue_options_on_booking on public.bookings;
create trigger reject_multiple_beta_venue_options_on_booking
before insert or update of venue_options_snapshot on public.bookings
for each row execute function public.reject_multiple_beta_venue_options();

revoke all on function public.validate_beta_food_tasting_limits() from public;
revoke all on function public.reject_multiple_beta_venue_options() from public;

commit;
