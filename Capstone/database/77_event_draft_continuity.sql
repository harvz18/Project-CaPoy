-- MULTIVENT Revision 9, Phase 3: exact client draft continuity.
-- Apply after 76_church_wedding_event_preference.sql.

begin;

alter table public.events
  add column if not exists planning_step smallint not null default 1,
  add column if not exists venue_latitude numeric(9, 6),
  add column if not exists venue_longitude numeric(9, 6),
  add column if not exists wedding_themes jsonb not null default '[]'::jsonb;

-- Existing drafts retain their established inferred resume step from saved
-- budget, selection, schedule, and payment data. Avoiding a historical update
-- prevents unrelated legacy consistency triggers from touching old events.

alter table public.events
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
