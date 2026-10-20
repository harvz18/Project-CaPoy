-- MULTIVENT Revision 9, Phase 3: exact client draft continuity.
-- Apply after 76_church_wedding_event_preference.sql.

begin;

alter table public.events
  add column if not exists planning_step smallint,
  add column if not exists venue_latitude numeric(9, 6),
  add column if not exists venue_longitude numeric(9, 6),
  add column if not exists wedding_themes jsonb not null default '[]'::jsonb;

-- Preserve an accurate resume point for existing drafts before making the
-- field mandatory. New records begin on the basics screen.
update public.events event
set planning_step = case
  when exists (
    select 1
    from public.payments payment
    where payment.event_id = event.id
      and payment.status in ('paid', 'verified')
  ) then 5
  when exists (
    select 1
    from public.event_schedule_checks schedule_check
    where schedule_check.event_id = event.id
      and schedule_check.checked_at is not null
  ) then 4
  when exists (
    select 1
    from public.event_service_selections selection
    where selection.event_id = event.id
      and coalesce(selection.status, '') not in ('declined', 'cancelled')
  ) or coalesce(event.total_budget, 0) > 0 then 3
  when event.event_date is not null then 2
  else 1
end
where event.planning_step is null;

alter table public.events
  alter column planning_step set default 1,
  alter column planning_step set not null,
  drop constraint if exists events_planning_step_check,
  add constraint events_planning_step_check
    check (planning_step between 1 and 5),
  drop constraint if exists events_wedding_themes_array_check,
  add constraint events_wedding_themes_array_check
    check (jsonb_typeof(wedding_themes) = 'array');

comment on column public.events.planning_step is
  'The farthest client-planning screen reached by this draft (1 through 5).';
comment on column public.events.wedding_themes is
  'Up to two client-selected wedding themes used for draft restoration and recommendations.';

commit;
