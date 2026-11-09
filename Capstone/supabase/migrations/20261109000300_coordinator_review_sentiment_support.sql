-- Give written coordinator reviews the same queued sentiment-analysis lifecycle as service reviews.

begin;

alter table public.coordinator_reviews
  add column if not exists analysis_status text not null default 'not_requested',
  add column if not exists sentiment_label text,
  add column if not exists sentiment_score numeric,
  add column if not exists topic_assignments jsonb not null default '[]'::jsonb,
  add column if not exists analysis_metadata jsonb not null default '{}'::jsonb,
  add column if not exists analyzed_at timestamptz;

alter table public.coordinator_reviews
  drop constraint if exists coordinator_reviews_analysis_status_check,
  add constraint coordinator_reviews_analysis_status_check
  check (analysis_status in ('not_requested', 'pending', 'processing', 'processed', 'failed')),
  drop constraint if exists coordinator_reviews_sentiment_label_check,
  add constraint coordinator_reviews_sentiment_label_check
  check (sentiment_label is null or sentiment_label in ('negative', 'positive')),
  drop constraint if exists coordinator_reviews_sentiment_score_check,
  add constraint coordinator_reviews_sentiment_score_check
  check (sentiment_score is null or sentiment_score between -1 and 1),
  drop constraint if exists coordinator_reviews_topic_assignments_array_check,
  add constraint coordinator_reviews_topic_assignments_array_check
  check (jsonb_typeof(topic_assignments) = 'array'),
  drop constraint if exists coordinator_reviews_processed_payload_check,
  add constraint coordinator_reviews_processed_payload_check
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

create index if not exists coordinator_reviews_analysis_queue_idx
  on public.coordinator_reviews (analysis_status, created_at)
  where analysis_status in ('pending', 'processing', 'failed');

create or replace function public.set_coordinator_review_analysis_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(trim(new.comment), '') is null then
    new.analysis_status := 'not_requested';
    new.sentiment_label := null;
    new.sentiment_score := null;
    new.topic_assignments := '[]'::jsonb;
    new.analysis_metadata := '{}'::jsonb;
    new.analyzed_at := null;
  elsif tg_op = 'INSERT' or old.comment is distinct from new.comment then
    new.analysis_status := 'pending';
    new.sentiment_label := null;
    new.sentiment_score := null;
    new.topic_assignments := '[]'::jsonb;
    new.analysis_metadata := '{}'::jsonb;
    new.analyzed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists coordinator_reviews_analysis_state on public.coordinator_reviews;
create trigger coordinator_reviews_analysis_state
before insert or update of comment on public.coordinator_reviews
for each row execute function public.set_coordinator_review_analysis_state();

update public.coordinator_reviews
set analysis_status = 'pending',
    sentiment_label = null,
    sentiment_score = null,
    topic_assignments = '[]'::jsonb,
    analysis_metadata = '{}'::jsonb,
    analyzed_at = null
where nullif(trim(comment), '') is not null
  and analysis_status <> 'processed';

create or replace function public.get_admin_feedback_directory(
  p_category_id uuid default null,
  p_source text default 'all',
  p_sentiment text default 'all',
  p_search text default '',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_source text := lower(trim(coalesce(p_source, 'all')));
  normalized_sentiment text := lower(trim(coalesce(p_sentiment, 'all')));
  normalized_search text := left(trim(coalesce(p_search, '')), 100);
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 5), 25);
  payload jsonb;
begin
  if not public.has_permission('providers.view') then raise exception 'Review access is required.' using errcode = '42501'; end if;
  if normalized_source not in ('all', 'service', 'coordinator', 'event') then raise exception 'Unsupported feedback source.' using errcode = '22023'; end if;
  if normalized_sentiment not in ('all', 'positive', 'negative', 'unprocessed') then raise exception 'Unsupported review filter.' using errcode = '22023'; end if;

  with eligible_feedback as (
    select review.id, 'service'::text as source, 'Service review'::text as source_label, review.rating, review.comment, review.created_at, review.sentiment_label, review.analysis_status, provider.id as target_id, provider.business_name as target_name, service.id as context_id, service.name as context_name, service.cover_image_url, category.id as category_id, coalesce(category.name, 'Uncategorized') as category_name
    from public.reviews review join public.bookings booking on booking.id = review.booking_id and booking.status = 'completed' and booking.provider_id = review.provider_id and booking.service_id = review.service_id join public.provider_profiles provider on provider.id = review.provider_id join public.services service on service.id = review.service_id left join public.service_categories category on category.id = service.category_id
    union all
    select review.id, 'coordinator'::text, 'Coordinator review'::text, review.rating, review.comment, review.created_at, review.sentiment_label, review.analysis_status, coordinator.id, coalesce(coordinator.full_name, 'Event coordinator'), event.id, coalesce(event.name, 'Completed event'), null::text, null::uuid, 'Coordinator'::text
    from public.coordinator_reviews review join public.events event on event.id = review.event_id and event.status = 'completed' join public.profiles coordinator on coordinator.id = review.coordinator_id
    union all
    select feedback.id, 'event'::text, 'Event feedback'::text, null::integer, feedback.overall_comment, feedback.created_at, feedback.sentiment_label, feedback.analysis_status, event.id, coalesce(event.name, 'Completed event'), event.id, coalesce(event.event_type, 'Event'), null::text, null::uuid, 'Event feedback'::text
    from public.event_feedback feedback join public.events event on event.id = feedback.event_id and event.status = 'completed' where nullif(trim(feedback.overall_comment), '') is not null
  ), filtered_feedback as (
    select feedback.* from eligible_feedback feedback
    where (normalized_source = 'all' or feedback.source = normalized_source)
      and (p_category_id is null or feedback.category_id = p_category_id)
      and (normalized_sentiment = 'all' or (normalized_sentiment in ('positive', 'negative') and feedback.sentiment_label = normalized_sentiment) or (normalized_sentiment = 'unprocessed' and feedback.analysis_status <> 'processed'))
      and (normalized_search = '' or coalesce(feedback.comment, '') ilike '%' || normalized_search || '%' or feedback.target_name ilike '%' || normalized_search || '%' or feedback.context_name ilike '%' || normalized_search || '%' or feedback.category_name ilike '%' || normalized_search || '%' or feedback.source_label ilike '%' || normalized_search || '%')
  ), category_options as (
    select distinct category_id as id, category_name as name from eligible_feedback where category_id is not null
  ), paged_feedback as (
    select feedback.* from filtered_feedback feedback order by feedback.created_at desc, feedback.id offset (safe_page - 1) * safe_page_size limit safe_page_size
  )
  select jsonb_build_object('page', safe_page, 'page_size', safe_page_size, 'total', (select count(*) from filtered_feedback), 'categories', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by lower(name), id) from category_options), '[]'::jsonb), 'reviews', coalesce((select jsonb_agg(jsonb_build_object('id', feedback.id, 'source', feedback.source, 'source_label', feedback.source_label, 'rating', feedback.rating, 'comment', feedback.comment, 'created_at', feedback.created_at, 'sentiment', feedback.sentiment_label, 'analysis_status', feedback.analysis_status, 'target_id', feedback.target_id, 'target_name', feedback.target_name, 'context_id', feedback.context_id, 'context_name', feedback.context_name, 'cover_image_url', feedback.cover_image_url, 'category_id', feedback.category_id, 'category_name', feedback.category_name) order by feedback.created_at desc, feedback.id) from paged_feedback feedback), '[]'::jsonb)) into payload;
  return payload;
end;
$$;

create or replace function public.get_admin_feedback_detail(p_source text, p_feedback_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare normalized_source text := lower(trim(coalesce(p_source, ''))); payload jsonb;
begin
  if not public.has_permission('providers.view') then raise exception 'Review access is required.' using errcode = '42501'; end if;
  if normalized_source = 'service' then
    select jsonb_build_object('id', review.id, 'source', 'service', 'source_label', 'Service review', 'rating', review.rating, 'comment', review.comment, 'created_at', review.created_at, 'sentiment', review.sentiment_label, 'sentiment_score', review.sentiment_score, 'analysis_status', review.analysis_status, 'topics', review.topic_assignments, 'target', jsonb_build_object('id', provider.id, 'name', provider.business_name, 'kind', 'Service provider'), 'context', jsonb_build_object('id', service.id, 'name', service.name, 'cover_image_url', service.cover_image_url, 'category_name', coalesce(category.name, 'Uncategorized'))) into payload from public.reviews review join public.bookings booking on booking.id = review.booking_id and booking.status = 'completed' and booking.provider_id = review.provider_id and booking.service_id = review.service_id join public.provider_profiles provider on provider.id = review.provider_id join public.services service on service.id = review.service_id left join public.service_categories category on category.id = service.category_id where review.id = p_feedback_id;
  elsif normalized_source = 'coordinator' then
    select jsonb_build_object('id', review.id, 'source', 'coordinator', 'source_label', 'Coordinator review', 'rating', review.rating, 'comment', review.comment, 'created_at', review.created_at, 'sentiment', review.sentiment_label, 'sentiment_score', review.sentiment_score, 'analysis_status', review.analysis_status, 'topics', review.topic_assignments, 'target', jsonb_build_object('id', coordinator.id, 'name', coalesce(coordinator.full_name, 'Event coordinator'), 'kind', 'Event coordinator'), 'context', jsonb_build_object('id', event.id, 'name', coalesce(event.name, 'Completed event'), 'cover_image_url', null, 'category_name', 'Coordinator')) into payload from public.coordinator_reviews review join public.events event on event.id = review.event_id and event.status = 'completed' join public.profiles coordinator on coordinator.id = review.coordinator_id where review.id = p_feedback_id;
  elsif normalized_source = 'event' then
    select jsonb_build_object('id', feedback.id, 'source', 'event', 'source_label', 'Event feedback', 'rating', null, 'comment', feedback.overall_comment, 'created_at', feedback.created_at, 'sentiment', feedback.sentiment_label, 'sentiment_score', feedback.sentiment_score, 'analysis_status', feedback.analysis_status, 'topics', feedback.topic_assignments, 'target', jsonb_build_object('id', event.id, 'name', coalesce(event.name, 'Completed event'), 'kind', 'Event'), 'context', jsonb_build_object('id', event.id, 'name', coalesce(event.event_type, 'Event'), 'cover_image_url', null, 'category_name', 'Event feedback')) into payload from public.event_feedback feedback join public.events event on event.id = feedback.event_id and event.status = 'completed' where feedback.id = p_feedback_id and nullif(trim(feedback.overall_comment), '') is not null;
  else raise exception 'Unsupported feedback source.' using errcode = '22023'; end if;
  if payload is null then raise exception 'Feedback not found.' using errcode = 'P0002'; end if;
  return payload;
end;
$$;

commit;
