-- MULTIVENT feedback-analysis integrity constraints.
-- Run after 14_event_completion_feedback.sql in the Supabase SQL Editor.

begin;

alter table public.event_feedback
  drop constraint if exists event_feedback_sentiment_label_check;
alter table public.event_feedback
  add constraint event_feedback_sentiment_label_check
  check (sentiment_label is null or sentiment_label in ('negative', 'positive'));

alter table public.event_feedback
  drop constraint if exists event_feedback_topic_assignments_array_check;
alter table public.event_feedback
  add constraint event_feedback_topic_assignments_array_check
  check (jsonb_typeof(topic_assignments) = 'array');

alter table public.event_feedback
  drop constraint if exists event_feedback_processed_payload_check;
alter table public.event_feedback
  add constraint event_feedback_processed_payload_check
  check (
    analysis_status <> 'processed'
    or (
      sentiment_label is not null
      and sentiment_score is not null
      and analyzed_at is not null
    )
  );

commit;
