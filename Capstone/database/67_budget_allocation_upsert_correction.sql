-- MULTIVENT budget allocation correction: replace a category without double-counting it.
-- Apply after 66_coordinator_assignment_event_visibility.sql.
--
-- PostgreSQL runs BEFORE INSERT triggers before resolving ON CONFLICT. The
-- Phase 7 validator previously excluded only NEW.id, so an upsert of an
-- existing category counted both the saved row and the proposed replacement.
-- Excluding the category being replaced keeps the total-budget invariant while
-- allowing a client to resize one allocation up to its true available maximum.

begin;

create or replace function public.validate_phase7_budget_item_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_budget numeric(12,2);
  other_allocations numeric(12,2);
begin
  if new.allocation_version is distinct from 'phase7-v1' then
    return new;
  end if;

  if new.category_key is null or new.allocated_amount is null then
    raise exception 'Phase 7 budget rows require a category and allocation amount.';
  end if;

  select event.total_budget into event_budget
  from public.events event
  where event.id = new.event_id;

  if event_budget is null then
    raise exception 'Set the total event budget before saving category allocations.';
  end if;

  -- Exclude both the physical row (ordinary UPDATE) and the logical category
  -- row (INSERT ... ON CONFLICT UPDATE). The Phase 7 partial unique index
  -- guarantees at most one row for each event/category pair.
  select coalesce(sum(item.allocated_amount), 0) into other_allocations
  from public.event_budget_items item
  where item.event_id = new.event_id
    and item.allocation_version = 'phase7-v1'
    and item.id is distinct from new.id
    and item.category_key is distinct from new.category_key;

  if other_allocations + new.allocated_amount > event_budget then
    raise exception 'Category allocations cannot exceed the total event budget.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_phase7_budget_item_total() from public;

comment on function public.validate_phase7_budget_item_total() is
  'Validates Phase 7 totals without double-counting the category replaced by an upsert.';

commit;
