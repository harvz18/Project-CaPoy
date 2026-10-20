-- MULTIVENT Revision 9, Phase 4: explicit Step 1 coordinator and church choices.
-- Apply after 77_event_draft_continuity.sql.

begin;

alter table public.events
  add column if not exists wants_coordinator boolean;

-- A new or partially completed draft must be able to distinguish an explicit
-- "No" from an unanswered church question. Existing values remain unchanged.
alter table public.events
  alter column is_church_wedding drop not null,
  alter column is_church_wedding drop default;

comment on column public.events.wants_coordinator is
  'Explicit client Step 1 preference. Null means a legacy or unfinished draft still needs an answer.';
comment on column public.events.is_church_wedding is
  'Explicit church-wedding preference. Null means a draft has not answered the Step 1 question yet.';

commit;
