-- Marketplace refresh: a food tasting may cover five courses, with five
-- client tasting selections from no more than ten provider dishes per course.
-- The final-menu workflow still enforces each course's provider-configured
-- finalSelectionLimit from the dishes the client tasted.

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
  active_item_count integer;
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
    active_item_count := (select count(*) from jsonb_array_elements(section_row -> 'items') item where coalesce((item ->> 'isActive')::boolean, true));
    if tasting_limit > 5 then
      raise exception 'A food tasting course may offer at most 5 selections.' using errcode = '22023';
    end if;
    if active_item_count > 10 then
      raise exception 'A food tasting course may offer at most 10 active dishes.' using errcode = '22023';
    end if;
    total_limit := total_limit + tasting_limit;
  end loop;

  if total_limit > 25 then
    raise exception 'A five-course food tasting may offer at most 25 selections in total.' using errcode = '22023';
  end if;
  return new;
end;
$$;

commit;
