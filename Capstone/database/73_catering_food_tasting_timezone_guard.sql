-- Phase 8 follow-up: preserve a stable timezone snapshot even when a provider
-- has not configured operating hours for a particular weekday.

begin;

create or replace function public.normalize_catering_food_tasting_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.timezone := coalesce(nullif(trim(new.timezone), ''), 'Asia/Manila');
  return new;
end;
$$;

drop trigger if exists normalize_catering_food_tasting_timezone_trigger
  on public.catering_food_tastings;
create trigger normalize_catering_food_tasting_timezone_trigger
before insert or update of timezone on public.catering_food_tastings
for each row execute function public.normalize_catering_food_tasting_timezone();

revoke all on function public.normalize_catering_food_tasting_timezone() from public;

comment on function public.normalize_catering_food_tasting_timezone() is
  'Keeps historical catering food tasting timezone snapshots non-empty.';

commit;
