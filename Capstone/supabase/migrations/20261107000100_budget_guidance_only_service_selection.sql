-- Category allocations are planning guidance. They rank and label marketplace
-- services, but they must never reject a valid service selection or be
-- overwritten by the selected service price.

begin;

-- Remove the legacy budget gate and allocation-lock write from every direct
-- selection entry point. The surrounding quote, schedule, capacity, package,
-- ownership, and one-service-per-category validations remain authoritative.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  function_sql text;
  patched_sql text;
begin
  foreach function_signature in array array[
    'public.save_my_event_service_selection(uuid,uuid,uuid,text,numeric,text,text,boolean)',
    'public.save_my_catering_menu_service_selection(uuid,uuid,jsonb,text,text,boolean)',
    'public.save_my_catering_service_selection_v10(uuid,uuid,integer,text,uuid,jsonb,text,text,boolean)',
    'public.save_my_venue_service_selection_v8(uuid,uuid,jsonb,text,boolean)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected service-selection function % does not exist.', function_signature;
    end if;

    select pg_get_functiondef(function_oid) into function_sql;
    patched_sql := regexp_replace(
      function_sql,
      E'\\n  if coalesce\\(event_row\\.total_budget, 0\\) > 0 then[[:space:][:print:]]*\\n  end if;\\n  update public\\.events',
      E'\n  update public.events'
    );
    if patched_sql = function_sql then
      raise exception 'Could not remove the budget gate from %.', function_signature;
    end if;
    execute patched_sql;
  end loop;
end;
$$;

-- Florist and Photo/Video selectors call the generic selector and then apply
-- their richer snapshots. Remove their duplicate budget rejection and their
-- legacy allocation rewrite while preserving those category-specific details.
do $$
declare
  function_signature text;
  function_oid regprocedure;
  function_sql text;
  patched_sql text;
  without_allocation_write text;
begin
  foreach function_signature in array array[
    'public.save_my_florist_service_selection_v17(uuid,uuid,jsonb,text,boolean)',
    'public.save_my_photo_video_service_selection_v18(uuid,uuid,jsonb,text,boolean)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Expected configured-service function % does not exist.', function_signature;
    end if;

    select pg_get_functiondef(function_oid) into function_sql;
    patched_sql := regexp_replace(
      function_sql,
      E'\\n  select total_budget into event_total[[:space:][:print:]]*\\n  end if;\\n\\n?  update public\\.event_service_selections',
      E'\n\n  update public.event_service_selections'
    );
    if patched_sql = function_sql then
      raise exception 'Could not remove the configured-service budget gate from %.', function_signature;
    end if;

    without_allocation_write := regexp_replace(
      patched_sql,
      E'\\n  perform set_config\\(''app\\.phase9_budget_lock_authorized'', ''true'', true\\);\\n  update public\\.event_budget_items[[:space:][:print:]]*;\\n\\n?  return',
      E'\n\n  return'
    );
    if without_allocation_write = patched_sql then
      raise exception 'Could not remove the configured-service allocation rewrite from %.', function_signature;
    end if;
    execute without_allocation_write;
  end loop;
end;
$$;

-- Curated coordinator packages may contain several service categories. Their
-- prices remain authoritative, but none of those prices may replace or be
-- rejected by the client's planning allocations.
do $$
declare
  function_oid regprocedure := to_regprocedure(
    'public.choose_coordinator_package_phase9(uuid,uuid,jsonb,boolean)'
  );
  function_sql text;
  patched_sql text;
begin
  if function_oid is null then
    raise exception 'Expected coordinator package selection function does not exist.';
  end if;
  select pg_get_functiondef(function_oid) into function_sql;
  patched_sql := regexp_replace(
    function_sql,
    E'\\n  select event\\.total_budget into event_budget[[:space:][:print:]]*\\n  end if;\\n  return result',
    E'\n  return result'
  );
  if patched_sql = function_sql then
    raise exception 'Could not remove the coordinator package budget gate.';
  end if;
  execute patched_sql;
end;
$$;

-- A selected coordinator must not force Step 2 to mirror the coordinator fee.
-- Allocations still cannot exceed the total planning budget; they simply no
-- longer have to equal already-selected service prices.
do $$
declare
  function_oid regprocedure := to_regprocedure(
    'public.save_my_event_budget_allocations(uuid,numeric,jsonb)'
  );
  function_sql text;
  patched_sql text;
begin
  if function_oid is null then
    raise exception 'Expected event budget allocation function does not exist.';
  end if;
  select pg_get_functiondef(function_oid) into function_sql;
  patched_sql := regexp_replace(
    function_sql,
    E'\\n  if \\(event_row\\.coordinator_id is not null or event_row\\.pending_coordinator_id is not null\\)[[:space:][:print:]]*\\n  end if;\\n\\n  delete from public\\.event_budget_items',
    E'\n\n  delete from public.event_budget_items'
  );
  if patched_sql = function_sql then
    raise exception 'Could not remove the coordinator allocation minimum.';
  end if;
  execute patched_sql;
end;
$$;

-- Phase 9 now delegates to the normal allocation save without locking any
-- category to a selected service amount.
create or replace function public.save_my_event_budget_allocations_phase9(
  target_event_id uuid,
  target_budget numeric,
  target_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(coalesce(target_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Category allocations must be an array.';
  end if;
  return public.save_my_event_budget_allocations(
    target_event_id,
    target_budget,
    target_allocations
  );
end;
$$;

-- Retire the old lock lifecycle. Existing allocations are preserved as-is;
-- only their obsolete linkage to a selected service is cleared.
drop trigger if exists protect_phase9_locked_budget_item_trigger
  on public.event_budget_items;
drop trigger if exists unlock_phase9_category_budget_trigger
  on public.event_service_selections;

update public.event_budget_items
set is_selection_locked = false,
    locked_selection_id = null
where allocation_version = 'phase7-v1'
  and (is_selection_locked = true or locked_selection_id is not null);

comment on function public.save_my_event_budget_allocations_phase9(uuid, numeric, jsonb) is
  'Saves planning allocations as guidance without locking them to selected service prices.';

commit;
