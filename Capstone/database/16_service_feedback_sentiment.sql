-- MULTIVENT per-service ratings, comments, and sentiment analysis.
-- Run after 15_sentiment_analysis_integrity.sql in the Supabase SQL Editor.

begin;

-- Event feedback is now the one-per-event submission marker. The actual ratings
-- and optional comments live in public.reviews, one row per completed booking.
alter table public.event_feedback
  alter column overall_comment drop not null;

alter table public.event_feedback
  drop constraint if exists event_feedback_comment_length;
alter table public.event_feedback
  add constraint event_feedback_comment_length
  check (
    overall_comment is null
    or char_length(trim(overall_comment)) between 10 and 4000
  );

alter table public.event_feedback
  drop constraint if exists event_feedback_analysis_status_check;
alter table public.event_feedback
  add constraint event_feedback_analysis_status_check
  check (analysis_status in ('not_requested', 'pending', 'processing', 'processed', 'failed'));

alter table public.reviews
  add column if not exists analysis_status text not null default 'not_requested',
  add column if not exists sentiment_label text,
  add column if not exists sentiment_score numeric,
  add column if not exists topic_assignments jsonb not null default '[]'::jsonb,
  add column if not exists analysis_metadata jsonb not null default '{}'::jsonb,
  add column if not exists analyzed_at timestamptz;

alter table public.reviews
  drop constraint if exists reviews_analysis_status_check;
alter table public.reviews
  add constraint reviews_analysis_status_check
  check (analysis_status in ('not_requested', 'pending', 'processing', 'processed', 'failed'));

alter table public.reviews
  drop constraint if exists reviews_sentiment_label_check;
alter table public.reviews
  add constraint reviews_sentiment_label_check
  check (sentiment_label is null or sentiment_label in ('negative', 'positive'));

alter table public.reviews
  drop constraint if exists reviews_sentiment_score_check;
alter table public.reviews
  add constraint reviews_sentiment_score_check
  check (sentiment_score is null or sentiment_score between -1 and 1);

alter table public.reviews
  drop constraint if exists reviews_topic_assignments_array_check;
alter table public.reviews
  add constraint reviews_topic_assignments_array_check
  check (jsonb_typeof(topic_assignments) = 'array');

alter table public.reviews
  drop constraint if exists reviews_processed_payload_check;
alter table public.reviews
  add constraint reviews_processed_payload_check
  check (
    analysis_status <> 'processed'
    or (
      comment is not null
      and char_length(trim(comment)) > 0
      and sentiment_label is not null
      and sentiment_score is not null
      and analyzed_at is not null
    )
  );

do $$
begin
  if exists (
    select 1
    from public.reviews
    group by booking_id
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce one review per booking: duplicate review rows already exist. Resolve them before rerunning migration 16.';
  end if;
end;
$$;

create unique index if not exists reviews_one_per_booking_idx
  on public.reviews (booking_id);
create index if not exists reviews_service_created_idx
  on public.reviews (service_id, created_at desc);
create index if not exists reviews_service_sentiment_idx
  on public.reviews (service_id, sentiment_label, created_at desc)
  where analysis_status = 'processed';
create index if not exists reviews_analysis_queue_idx
  on public.reviews (analysis_status, created_at)
  where analysis_status in ('pending', 'processing', 'failed');

create or replace function public.submit_event_service_feedback(
  target_event_id uuid,
  service_reviews jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  completed_booking_count integer;
  submitted_count integer;
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.events
    where id = target_event_id
      and client_id = current_user_id
      and status = 'completed'
  ) then
    raise exception 'Feedback opens after every provider marks the event finished.';
  end if;

  if service_reviews is null or jsonb_typeof(service_reviews) <> 'array' then
    raise exception 'Service reviews must be a JSON array.';
  end if;

  select count(*)
  into submitted_count
  from jsonb_array_elements(service_reviews);

  select count(*)
  into completed_booking_count
  from public.bookings
  where event_id = target_event_id
    and client_id = current_user_id
    and status = 'completed';

  if completed_booking_count = 0 or submitted_count <> completed_booking_count then
    raise exception 'Rate every completed service exactly once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(service_reviews) item
    where coalesce(item->>'booking_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or coalesce(item->>'rating', '') !~ '^[1-5]$'
      or (
        nullif(trim(coalesce(item->>'comment', '')), '') is not null
        and char_length(trim(item->>'comment')) > 4000
      )
  ) then
    raise exception 'Each service needs a valid booking, a 1-5 rating, and a comment no longer than 4000 characters.';
  end if;

  if (
    select count(distinct (item->>'booking_id')::uuid)
    from jsonb_array_elements(service_reviews) item
  ) <> submitted_count then
    raise exception 'Each completed service may only be rated once.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(service_reviews) item
    left join public.bookings booking
      on booking.id = (item->>'booking_id')::uuid
      and booking.event_id = target_event_id
      and booking.client_id = current_user_id
      and booking.status = 'completed'
    where booking.id is null
  ) then
    raise exception 'One or more services do not belong to this completed event.';
  end if;

  if exists (
    select 1
    from public.reviews review
    join public.bookings booking on booking.id = review.booking_id
    where booking.event_id = target_event_id
      and booking.client_id = current_user_id
  ) then
    raise exception 'Feedback has already been submitted for this event.';
  end if;

  insert into public.event_feedback (
    event_id,
    client_id,
    overall_comment,
    analysis_status
  ) values (
    target_event_id,
    current_user_id,
    null,
    'not_requested'
  )
  on conflict (event_id) do nothing;

  with submitted as (
    select
      (item->>'booking_id')::uuid as booking_id,
      (item->>'rating')::integer as rating,
      nullif(trim(coalesce(item->>'comment', '')), '') as comment
    from jsonb_array_elements(service_reviews) item
  ), inserted as (
    insert into public.reviews (
      booking_id,
      reviewer_id,
      provider_id,
      service_id,
      rating,
      comment,
      analysis_status
    )
    select
      booking.id,
      current_user_id,
      booking.provider_id,
      booking.service_id,
      submitted.rating,
      submitted.comment,
      case when submitted.comment is null then 'not_requested' else 'pending' end
    from submitted
    join public.bookings booking on booking.id = submitted.booking_id
    returning id, booking_id, comment
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'review_id', id,
        'booking_id', booking_id,
        'needs_analysis', comment is not null
      )
      order by booking_id
    ),
    '[]'::jsonb
  )
  into result
  from inserted;

  insert into public.notifications (
    user_id,
    title,
    body,
    resource_type,
    resource_id
  )
  select
    provider.user_id,
    'New client rating',
    'A client rated a completed service.',
    'review',
    booking.id
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.event_id = target_event_id
    and booking.client_id = current_user_id
    and booking.status = 'completed';

  return jsonb_build_object(
    'event_id', target_event_id,
    'reviews', result
  );
exception
  when unique_violation then
    raise exception 'Feedback has already been submitted for this event.';
end;
$$;

revoke all on function public.submit_event_service_feedback(uuid, jsonb) from public;
grant execute on function public.submit_event_service_feedback(uuid, jsonb) to authenticated;

-- Feedback must go through the atomic RPC above. Public review reads remain
-- available through the existing published-review RLS policy.
revoke insert on table public.event_feedback from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end;
$$;

commit;
