-- A coordinate-confirmed map pin is still useful when a reverse-geocoded
-- address is unavailable. Never invent an address for it.
begin;

create or replace function public.guard_external_event_venue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.venue_source = 'external' and new.external_venue_confirmed is true then
    if new.venue_status is distinct from 'secured'
      or nullif(trim(coalesce(new.venue, '')), '') is null
      or new.venue_latitude is null
      or new.venue_longitude is null then
      raise exception 'A confirmed external venue needs a location label and map coordinates.';
    end if;

    if tg_op = 'UPDATE' and exists (
      select 1 from public.event_service_selections selection
      where selection.event_id = new.id
        and selection.status in ('selected', 'requested', 'confirmed')
        and lower(coalesce(selection.category_name, '')) ~ '(venue|estate|function[[:space:]]*hall|event[[:space:]]*space)'
    ) then
      raise exception 'An active MULTIVENT venue selection already exists. Use its existing cancellation or replacement workflow before confirming an external venue.';
    end if;

    delete from public.event_budget_items item
    where item.event_id = new.id
      and item.category_key = 'venue'
      and coalesce(item.is_selection_locked, false) = false;
  end if;
  return new;
end;
$$;

commit;
