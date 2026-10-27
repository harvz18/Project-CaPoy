-- Event-priced venue options still have an included booking duration. Persist
-- it on editable selections so the V14 final validator receives the same
-- server-calculated duration that was used by the V8 venue quote.

begin;

create or replace function public.persist_v8_selected_venue_duration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_duration text;
begin
  if new.category_key <> 'venue'
    or new.status <> 'selected'
    or coalesce(new.venue_booked_hours, 0) > 0
  then
    return new;
  end if;

  snapshot_duration := coalesce(
    new.venue_option_snapshot ->> 'selectedDurationHours',
    new.venue_option_snapshot ->> 'includedDurationHours',
    new.venue_option_snapshot -> 'rentalConditions' ->> 'includedDurationHours'
  );

  if coalesce(snapshot_duration, '') ~ '^[0-9]+([.][0-9]+)?$'
    and snapshot_duration::numeric > 0
  then
    new.venue_booked_hours := snapshot_duration::numeric;
  end if;

  return new;
end;
$$;

drop trigger if exists persist_v8_selected_venue_duration on public.event_service_selections;
create trigger persist_v8_selected_venue_duration
before insert or update of category_key, status, venue_option_snapshot, venue_booked_hours
on public.event_service_selections
for each row execute function public.persist_v8_selected_venue_duration();

-- Only editable selections may be normalized. Accepted, requested, paid, and
-- historical records retain their existing immutable booking snapshots.
update public.event_service_selections selection
set venue_booked_hours = case
  when coalesce(selection.venue_option_snapshot ->> 'selectedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
    then (selection.venue_option_snapshot ->> 'selectedDurationHours')::numeric
  when coalesce(selection.venue_option_snapshot ->> 'includedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
    then (selection.venue_option_snapshot ->> 'includedDurationHours')::numeric
  when coalesce(selection.venue_option_snapshot -> 'rentalConditions' ->> 'includedDurationHours', '') ~ '^[0-9]+([.][0-9]+)?$'
    then (selection.venue_option_snapshot -> 'rentalConditions' ->> 'includedDurationHours')::numeric
  else selection.venue_booked_hours
end
where selection.category_key = 'venue'
  and selection.status = 'selected'
  and coalesce(selection.venue_booked_hours, 0) <= 0;

revoke all on function public.persist_v8_selected_venue_duration() from public;

comment on function public.persist_v8_selected_venue_duration() is
  'Persists the included V8 venue duration only for editable selections before final V14 validation.';

commit;
