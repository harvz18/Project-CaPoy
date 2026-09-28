-- MULTIVENT trust-and-safety adjustment: supervised sentiment-analysis retries.
-- Apply after 45_booking_venue_sync.sql.

begin;

insert into public.permissions (code, description)
values (
  'reviews.analysis.retry',
  'Retry failed, pending, or stale sentiment analysis for client feedback.'
)
on conflict (code) do update set description = excluded.description;

-- Overall event feedback was previously visible only to its submitting client.
-- Superadmins need read access to see failed jobs before requesting a retry.
drop policy if exists "Authorized staff view event feedback" on public.event_feedback;
create policy "Authorized staff view event feedback"
  on public.event_feedback for select to authenticated
  using (public.has_permission('reviews.analysis.retry'));

comment on policy "Authorized staff view event feedback" on public.event_feedback is
  'Allows authorized trust-and-safety staff to inspect event feedback and its analysis state.';

commit;
