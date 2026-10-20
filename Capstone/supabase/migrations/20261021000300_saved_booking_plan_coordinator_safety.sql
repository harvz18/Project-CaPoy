-- Preserve an existing coordinator selection for legacy plans even when the
-- newer Step 1 preference value is missing or was changed after selection.

begin;

create or replace function public.save_my_booking_plan_for_later(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  selected_service_count integer := 0;
  selected_service_total numeric(12,2) := 0;
  coordinator_amount numeric(12,2) := 0;
  has_coordinator boolean := false;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status in ('draft', 'planning')
  for update;
  if event_row.id is null then
    raise exception 'Only an unbooked event plan can be saved for later.' using errcode = '42501';
  end if;
  if event_row.event_date is null or event_row.event_time is null
    or coalesce(event_row.guest_count, 0) <= 0 then
    raise exception 'Complete the event details before saving this plan.';
  end if;

  perform public.validate_my_phase9_selections(target_event_id);

  if exists (
    select 1
    from public.event_budget_items item
    where item.event_id = event_row.id
      and item.allocation_version = 'phase7-v1'
      and coalesce(item.allocated_amount, 0) > 0
      and item.category_key <> 'eventOrganizer'
      and not exists (
        select 1 from public.event_service_selections selection
        where selection.event_id = event_row.id
          and selection.category_key = item.category_key
          and selection.status = 'selected'
      )
  ) then
    raise exception 'Select a service for every allocated category before saving this plan.';
  end if;

  has_coordinator := coalesce(event_row.pending_coordinator_id, event_row.coordinator_id) is not null
    and coalesce(event_row.coordinator_fee_amount, 0) > 0;
  if coalesce(event_row.wants_coordinator, false)
    and exists (
      select 1 from public.event_budget_items item
      where item.event_id = event_row.id
        and item.allocation_version = 'phase7-v1'
        and item.category_key = 'eventOrganizer'
        and coalesce(item.allocated_amount, 0) > 0
    )
    and not has_coordinator then
    raise exception 'Select an event coordinator before saving this plan.';
  end if;

  select count(*), coalesce(sum(selection.estimated_amount), 0)
  into selected_service_count, selected_service_total
  from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.status = 'selected';
  if selected_service_count = 0 and not has_coordinator then
    raise exception 'Select at least one service before saving this plan.';
  end if;

  if has_coordinator then
    coordinator_amount := round(
      coalesce(event_row.coordinator_fee_amount, 0) * (1 + public.get_public_commission_rate()), 2
    );
  end if;

  update public.events
  set status = case when status = 'draft' then 'planning' else status end,
      planning_step = greatest(coalesce(planning_step, 1), 5),
      saved_plan_at = now(),
      saved_plan_estimated_total = round(selected_service_total + coordinator_amount, 2),
      saved_plan_selection_count = selected_service_count + case when has_coordinator then 1 else 0 end,
      updated_at = now()
  where id = event_row.id;

  return public.review_my_saved_booking_plan(event_row.id);
end;
$$;

comment on function public.save_my_booking_plan_for_later(uuid) is
  'Saves a complete unpaid plan while retaining legacy selected coordinators in its estimate.';

commit;
