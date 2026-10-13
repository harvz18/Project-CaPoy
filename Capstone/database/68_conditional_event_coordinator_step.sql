begin;

-- Coordinator assignment is only part of an event plan after the client has
-- allocated a positive amount to the actual Event Organizer category. This
-- also protects the workflow from direct RPC calls that bypass the mobile UI.
create or replace function public.require_event_organizer_budget_for_coordinator_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.coordinator_id is not null or new.pending_coordinator_id is not null)
    and (
      new.coordinator_id is distinct from old.coordinator_id
      or new.pending_coordinator_id is distinct from old.pending_coordinator_id
    )
    and not exists (
      select 1
      from public.event_budget_items item
      where item.event_id = new.id
        and item.allocation_version = 'phase7-v1'
        and item.category_key = 'eventOrganizer'
        and coalesce(item.allocated_amount, 0) > 0
    )
  then
    raise exception 'Allocate a positive Event Organizer budget before choosing a coordinator.';
  end if;

  return new;
end;
$$;

drop trigger if exists require_event_organizer_budget_for_coordinator_assignment_trigger
  on public.events;
create trigger require_event_organizer_budget_for_coordinator_assignment_trigger
before update of coordinator_id, pending_coordinator_id on public.events
for each row execute function public.require_event_organizer_budget_for_coordinator_assignment();

revoke all on function public.require_event_organizer_budget_for_coordinator_assignment() from public;

comment on function public.require_event_organizer_budget_for_coordinator_assignment() is
  'Prevents coordinator assignment unless the event has a positive eventOrganizer allocation.';

commit;
