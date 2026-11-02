-- Preserve the distinction between a client-secured location and a MULTIVENT
-- venue booking. Historical events are deliberately not inferred or rewritten.
begin;

alter table public.events
  add column if not exists venue_source text,
  add column if not exists external_venue_confirmed boolean not null default false;

alter table public.events
  drop constraint if exists events_venue_source_check,
  add constraint events_venue_source_check
    check (venue_source is null or venue_source in ('external', 'marketplace'));

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
      or nullif(trim(coalesce(new.location, '')), '') is null
      or new.venue_latitude is null
      or new.venue_longitude is null then
      raise exception 'A confirmed external venue needs a name, address, and map coordinates.';
    end if;

    -- Do not overwrite, cancel, or hide a marketplace venue selection. The
    -- client must use the existing cancellation/replacement workflow first.
    if tg_op = 'UPDATE' and exists (
      select 1
      from public.event_service_selections selection
      where selection.event_id = new.id
        and selection.status in ('selected', 'requested', 'confirmed')
        and lower(coalesce(selection.category_name, '')) ~ '(venue|estate|function[[:space:]]*hall|event[[:space:]]*space)'
    ) then
      raise exception 'An active MULTIVENT venue selection already exists. Use its existing cancellation or replacement workflow before confirming an external venue.';
    end if;

    -- An unlocked allocation is planning-only, so releasing it restores the
    -- entire amount to the remaining event budget without altering the total.
    delete from public.event_budget_items item
    where item.event_id = new.id
      and item.category_key = 'venue'
      and coalesce(item.is_selection_locked, false) = false;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_external_event_venue_write_trigger on public.events;
create trigger guard_external_event_venue_write_trigger
before insert or update of venue_source, external_venue_confirmed, venue_status, venue, location, venue_latitude, venue_longitude
on public.events
for each row execute function public.guard_external_event_venue();

comment on column public.events.venue_source is
  'Explicit source of the official event venue. Existing rows remain null unless deliberately confirmed.';
comment on column public.events.external_venue_confirmed is
  'True only after a client explicitly confirms a client-secured external venue in Step 1.';

commit;
