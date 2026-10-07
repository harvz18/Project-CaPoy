-- MULTIVENT Revision 2, Phase 7: category budget allocation.
-- Apply after 57_payment_hold_provider_acceptance.sql.

begin;

alter table public.event_budget_items
  add column if not exists category_key text,
  add column if not exists allocated_amount numeric(12,2),
  add column if not exists allocation_version text;

alter table public.event_budget_items
  drop constraint if exists event_budget_items_allocated_amount_check,
  add constraint event_budget_items_allocated_amount_check
    check (allocated_amount is null or allocated_amount >= 0),
  drop constraint if exists event_budget_items_category_key_check,
  add constraint event_budget_items_category_key_check check (
    category_key is null or category_key in (
      'venue',
      'catering',
      'eventOrganizer',
      'photoVideo',
      'gownRental',
      'hostEmcee',
      'soundLights',
      'floral'
    )
  );

create unique index if not exists event_budget_items_phase7_category_idx
  on public.event_budget_items (event_id, category_key)
  where allocation_version = 'phase7-v1';

create index if not exists event_budget_items_phase7_event_idx
  on public.event_budget_items (event_id, priority_rank, category_key)
  where allocation_version = 'phase7-v1';

-- Protect the central invariant even if a client writes a Phase 7 row directly.
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

  select coalesce(sum(item.allocated_amount), 0) into other_allocations
  from public.event_budget_items item
  where item.event_id = new.event_id
    and item.allocation_version = 'phase7-v1'
    and item.id is distinct from new.id;

  if other_allocations + new.allocated_amount > event_budget then
    raise exception 'Category allocations cannot exceed the total event budget.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_phase7_budget_item_total_trigger
  on public.event_budget_items;
create trigger validate_phase7_budget_item_total_trigger
before insert or update of event_id, allocated_amount, allocation_version
on public.event_budget_items
for each row execute function public.validate_phase7_budget_item_total();

create or replace function public.validate_phase7_event_budget_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocated_total numeric(12,2);
begin
  if new.total_budget is not distinct from old.total_budget then
    return new;
  end if;

  select coalesce(sum(item.allocated_amount), 0) into allocated_total
  from public.event_budget_items item
  where item.event_id = new.id
    and item.allocation_version = 'phase7-v1';

  if allocated_total > coalesce(new.total_budget, 0) then
    raise exception 'The event budget cannot be lower than its category allocations.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_phase7_event_budget_total_trigger on public.events;
create trigger validate_phase7_event_budget_total_trigger
before update of total_budget on public.events
for each row execute function public.validate_phase7_event_budget_total();

-- Saves the total and all category allocations in one transaction. A selected
-- coordinator reserves exactly one customer-facing coordination fee. Curated
-- package services remain separate service-category costs and are not added to
-- that coordinator reservation.
create or replace function public.save_my_event_budget_allocations(
  target_event_id uuid,
  target_budget numeric,
  target_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  normalized_allocations jsonb := coalesce(target_allocations, '[]'::jsonb);
  allocation_count integer;
  distinct_count integer;
  invalid_count integer;
  allocated_total numeric(12,2);
  coordinator_required numeric(12,2) := 0;
  coordinator_allocated numeric(12,2) := 0;
  commission_rate numeric := public.get_public_commission_rate();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if target_budget is null or target_budget < 0 or target_budget > 9999999999.99 then
    raise exception 'Enter a valid event budget.';
  end if;
  if jsonb_typeof(normalized_allocations) <> 'array' then
    raise exception 'Category allocations must be an array.';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled')
  for update;
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  with allocation as (
    select trim(item.category_key) as category_key,
      coalesce(item.amount, 0)::numeric(12,2) as amount
    from jsonb_to_recordset(normalized_allocations)
      as item(category_key text, amount numeric, priority_rank integer)
  )
  select count(*), count(distinct category_key),
    count(*) filter (where category_key is null
      or category_key not in (
        'venue', 'catering', 'eventOrganizer', 'photoVideo',
        'gownRental', 'hostEmcee', 'soundLights', 'floral'
      )
      or amount < 0),
    round(coalesce(sum(amount), 0), 2),
    round(coalesce(sum(amount) filter (where category_key = 'eventOrganizer'), 0), 2)
  into allocation_count, distinct_count, invalid_count,
    allocated_total, coordinator_allocated
  from allocation;

  if allocation_count <> distinct_count then
    raise exception 'Each budget category can only be allocated once.';
  end if;
  if invalid_count > 0 then
    raise exception 'One or more category allocations are invalid.';
  end if;
  if allocated_total > round(target_budget, 2) then
    raise exception 'Category allocations cannot exceed the total event budget.';
  end if;

  if (event_row.coordinator_id is not null or event_row.pending_coordinator_id is not null)
    and coalesce(event_row.coordinator_fee_amount, 0) > 0
  then
    coordinator_required := round(event_row.coordinator_fee_amount * (1 + commission_rate), 2);
  end if;
  if coordinator_required > round(target_budget, 2) then
    raise exception 'The event budget is lower than the committed coordinator cost.';
  end if;
  if coordinator_allocated < coordinator_required then
    raise exception 'Reserve at least the committed coordinator cost in Event Coordinator.';
  end if;

  delete from public.event_budget_items item
  where item.event_id = event_row.id
    and (
      item.allocation_version = 'phase7-v1'
      or (item.allocation_version is null and item.is_priority = true
        and coalesce(item.actual_amount, 0) = 0)
    );

  update public.events
  set total_budget = round(target_budget, 2),
      status = case when status = 'draft' then 'planning' else status end,
      updated_at = now()
  where id = event_row.id;

  insert into public.event_budget_items (
    event_id, category_key, label, allocated_amount, estimated_amount,
    priority_rank, is_priority, status, allocation_version
  )
  select event_row.id, item.category_key,
    case item.category_key
      when 'venue' then 'Venue'
      when 'catering' then 'Catering'
      when 'eventOrganizer' then 'Event Coordinator'
      when 'photoVideo' then 'Photography & Video'
      when 'gownRental' then 'Attire & Gown Rental'
      when 'hostEmcee' then 'Host / Emcee'
      when 'soundLights' then 'Sound & Lights'
      when 'floral' then 'Florist & Styling'
    end,
    round(item.amount, 2), round(item.amount, 2),
    coalesce(item.priority_rank, 0),
    item.amount > 0, 'planned', 'phase7-v1'
  from jsonb_to_recordset(normalized_allocations)
    as item(category_key text, amount numeric, priority_rank integer)
  where coalesce(item.amount, 0) > 0
  order by coalesce(item.priority_rank, 0), item.category_key;

  return jsonb_build_object(
    'event_id', event_row.id,
    'event_budget', round(target_budget, 2),
    'allocated_budget', allocated_total,
    'remaining_budget', round(target_budget - allocated_total, 2),
    'coordinator_reserved', coordinator_required,
    'allocation_version', 'phase7-v1'
  );
end;
$$;

revoke all on function public.validate_phase7_budget_item_total() from public;
revoke all on function public.validate_phase7_event_budget_total() from public;
revoke all on function public.save_my_event_budget_allocations(uuid, numeric, jsonb) from public;
grant execute on function public.save_my_event_budget_allocations(uuid, numeric, jsonb)
  to authenticated;

comment on column public.event_budget_items.category_key is
  'Stable client category key used by Phase 7 allocation and Phase 8 recommendation.';
comment on column public.event_budget_items.allocated_amount is
  'Client-defined category ceiling; it does not rewrite booked or historical prices.';
comment on function public.save_my_event_budget_allocations(uuid, numeric, jsonb) is
  'Atomically enforces total allocation and one coordinator-fee reservation for an owned event.';

commit;
