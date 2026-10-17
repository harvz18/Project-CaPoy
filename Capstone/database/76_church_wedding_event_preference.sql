-- Canonical database-script counterpart of the Phase 2 Supabase migration.
-- Apply after 75_confirmed_booking_messaging.sql.

begin;

alter table public.events
  add column if not exists is_church_wedding boolean not null default false;

comment on column public.events.is_church_wedding is
  'Client-selected wedding preference. It does not reserve a church or create a marketplace booking.';

create or replace function public.get_my_church_wedding_event_flags()
returns table (event_id uuid, is_church_wedding boolean)
language sql
stable
security definer
set search_path = public
as $$
  select event.id, event.is_church_wedding
  from public.events event
  where auth.uid() is not null
    and event.is_church_wedding
    and event.status <> 'cancelled'
    and (
      (event.pending_coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'pending')
      or (event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted')
    );
$$;

create or replace function public.notify_coordinator_of_church_wedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_church_wedding
    and new.coordinator_id is not null
    and new.coordinator_assignment_status = 'accepted'
    and (
      tg_op = 'INSERT'
      or old.is_church_wedding is distinct from new.is_church_wedding
      or old.coordinator_id is distinct from new.coordinator_id
      or old.coordinator_assignment_status is distinct from new.coordinator_assignment_status
    )
  then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      new.coordinator_id,
      'Church wedding arrangement required',
      format('%s is a church wedding. Coordinate with the client about church arrangements; this does not confirm a church reservation.', new.name),
      'event', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_coordinator_of_church_wedding_trigger on public.events;
create trigger notify_coordinator_of_church_wedding_trigger
after insert or update of is_church_wedding, coordinator_id, coordinator_assignment_status
on public.events
for each row execute function public.notify_coordinator_of_church_wedding();

revoke all on function public.get_my_church_wedding_event_flags() from public;
revoke all on function public.notify_coordinator_of_church_wedding() from public;
grant execute on function public.get_my_church_wedding_event_flags() to authenticated;

commit;
