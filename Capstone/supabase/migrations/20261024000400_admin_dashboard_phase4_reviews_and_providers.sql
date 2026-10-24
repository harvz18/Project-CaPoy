-- V13 Phase 4: permission-scoped review and provider-performance reporting.
-- This migration is deliberately read-only. It does not change customer
-- feedback, review visibility, provider standing, bookings, or finances.

begin;

create or replace function public.get_admin_dashboard_phase4(
  p_category_id uuid default null,
  p_event_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_event_type text := nullif(lower(trim(coalesce(p_event_type, ''))), '');
  payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.service_categories category where category.id = p_category_id
  ) then
    raise exception 'The selected category is unavailable.' using errcode = '22023';
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'The selected event type is unavailable.' using errcode = '22023';
  end if;

  with
  eligible_provider_accounts as (
    select provider.id, provider.business_name, provider.verification_status::text as verification_status
    from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where provider.verification_status::text in ('verified', 'active')
      and profile.account_status::text in ('active', 'verified')
  ),
  scoped_services as (
    select
      service.id,
      service.provider_id,
      service.category_id,
      service.name,
      service.cover_image_url,
      category.name as category_name
    from public.services service
    join eligible_provider_accounts provider on provider.id = service.provider_id
    join public.service_categories category on category.id = service.category_id
    where service.status = 'active'
      and (p_category_id is null or service.category_id = p_category_id)
  ),
  scoped_booking_rows as (
    select
      booking.id,
      booking.provider_id,
      booking.service_id,
      booking.status::text as status,
      event.event_type
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join scoped_services service on service.id = booking.service_id
    where normalized_event_type is null
      or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ),
  provider_category_rows as (
    select distinct
      service.provider_id,
      service.category_id,
      service.category_name
    from scoped_services service
  ),
  provider_categories as (
    select
      category.provider_id,
      jsonb_agg(
        jsonb_build_object('id', category.category_id, 'name', category.category_name)
        order by lower(category.category_name), category.category_id
      ) as categories,
      (
        select min(service.cover_image_url)
        from scoped_services service
        where service.provider_id = category.provider_id
          and nullif(trim(coalesce(service.cover_image_url, '')), '') is not null
      ) as cover_image_url
    from provider_category_rows category
    group by category.provider_id
  ),
  provider_booking_metrics as (
    select
      booking.provider_id,
      count(distinct booking.id) filter (where booking.status not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status in ('approved', 'confirmed', 'completed')) as confirmed_booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from scoped_booking_rows booking
    group by booking.provider_id
  ),
  provider_review_metrics as (
    select
      service.provider_id,
      count(distinct review.id) as review_count,
      count(distinct review.id) filter (where nullif(trim(coalesce(review.comment, '')), '') is not null) as written_review_count,
      count(distinct review.id) filter (where review.sentiment_label = 'positive' and nullif(trim(coalesce(review.comment, '')), '') is not null) as positive_written_review_count,
      count(distinct review.id) filter (where review.sentiment_label = 'negative' and nullif(trim(coalesce(review.comment, '')), '') is not null) as negative_written_review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from scoped_services service
    join public.reviews review on review.service_id = service.id and review.provider_id = service.provider_id
    join scoped_booking_rows booking on booking.id = review.booking_id and booking.status = 'completed'
    group by service.provider_id
  ),
  provider_revenue_metrics as (
    select
      booking.provider_id,
      coalesce(sum(ledger.commission_amount), 0)::numeric as platform_revenue
    from scoped_booking_rows booking
    join public.financial_transactions ledger on ledger.booking_id = booking.id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
    group by booking.provider_id
  ),
  provider_metrics as (
    select
      provider.id,
      provider.business_name,
      provider.verification_status,
      coalesce(categories.categories, '[]'::jsonb) as categories,
      categories.cover_image_url,
      coalesce(bookings.valid_booking_count, 0) as valid_booking_count,
      coalesce(bookings.confirmed_booking_count, 0) as confirmed_booking_count,
      coalesce(bookings.completed_booking_count, 0) as completed_booking_count,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.review_count, 0) as review_count,
      coalesce(reviews.written_review_count, 0) as written_review_count,
      coalesce(reviews.positive_written_review_count, 0) as positive_written_review_count,
      coalesce(reviews.negative_written_review_count, 0) as negative_written_review_count,
      coalesce(revenue.platform_revenue, 0)::numeric as platform_revenue
    from eligible_provider_accounts provider
    join provider_categories categories on categories.provider_id = provider.id
    left join provider_booking_metrics bookings on bookings.provider_id = provider.id
    left join provider_review_metrics reviews on reviews.provider_id = provider.id
    left join provider_revenue_metrics revenue on revenue.provider_id = provider.id
  ),
  ranked_providers as (
    select
      provider.*,
      row_number() over (
        order by
          provider.confirmed_booking_count desc,
          provider.completed_booking_count desc,
          provider.valid_booking_count desc,
          case when provider.review_count >= 3 then provider.average_rating else 0 end desc,
          provider.review_count desc,
          provider.positive_written_review_count desc,
          provider.negative_written_review_count asc,
          provider.id
      ) as rank,
      case
        when provider.confirmed_booking_count > 0 and provider.review_count >= 3 and provider.average_rating >= 4 then 'High'
        when provider.confirmed_booking_count > 0 then 'Good'
        when provider.valid_booking_count > 0 then 'Building'
        else 'New'
      end as performance
    from provider_metrics provider
  ),
  recent_review_rows as (
    select
      review.id,
      review.rating,
      review.comment,
      review.created_at,
      review.sentiment_label,
      review.analysis_status,
      provider.business_name as provider_name,
      service.name as service_name,
      service.cover_image_url,
      category.name as category_name
    from public.reviews review
    join public.bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    join public.events event on event.id = booking.event_id
    join public.provider_profiles provider on provider.id = review.provider_id
    join public.services service on service.id = review.service_id
    left join public.service_categories category on category.id = service.category_id
    where (p_category_id is null or service.category_id = p_category_id)
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
    order by review.created_at desc, review.id
    limit 5
  ),
  category_options as (
    select distinct category.id, category.name
    from public.service_categories category
    join scoped_services service on service.category_id = category.id
    order by category.name
  )
  select jsonb_build_object(
    'generated_at', now(),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from category_options
    ), '[]'::jsonb),
    'ranking_method', 'Confirmed and completed bookings, then valid bookings, then ratings with at least three reviews, then written-feedback sentiment.',
    'top_providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', provider.rank,
        'id', provider.id,
        'business_name', provider.business_name,
        'cover_image_url', provider.cover_image_url,
        'categories', provider.categories,
        'average_rating', provider.average_rating,
        'review_count', provider.review_count,
        'platform_revenue', provider.platform_revenue,
        'valid_bookings', provider.valid_booking_count,
        'confirmed_bookings', provider.confirmed_booking_count,
        'completed_bookings', provider.completed_booking_count,
        'performance', provider.performance,
        'verification_status', provider.verification_status
      ) order by provider.rank)
      from (select * from ranked_providers order by rank limit 5) provider
    ), '[]'::jsonb),
    'recent_reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', review.id,
        'rating', review.rating,
        'comment', review.comment,
        'created_at', review.created_at,
        'sentiment', review.sentiment_label,
        'analysis_status', review.analysis_status,
        'provider_name', review.provider_name,
        'service_name', review.service_name,
        'cover_image_url', review.cover_image_url,
        'category_name', coalesce(review.category_name, 'Uncategorized')
      ) order by review.created_at desc, review.id)
      from recent_review_rows review
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

create or replace function public.get_admin_reviews_directory(
  p_category_id uuid default null,
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
  normalized_sentiment text := lower(trim(coalesce(p_sentiment, 'all')));
  normalized_search text := left(trim(coalesce(p_search, '')), 100);
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 5), 25);
  payload jsonb;
begin
  if not public.has_permission('providers.view') then
    raise exception 'Review access is required.' using errcode = '42501';
  end if;

  if normalized_sentiment not in ('all', 'positive', 'negative', 'unprocessed') then
    raise exception 'Unsupported review filter.' using errcode = '22023';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.service_categories category where category.id = p_category_id
  ) then
    raise exception 'The selected category is unavailable.' using errcode = '22023';
  end if;

  with
  eligible_reviews as (
    select
      review.id,
      review.rating,
      review.comment,
      review.created_at,
      review.sentiment_label,
      review.sentiment_score,
      review.analysis_status,
      review.topic_assignments,
      provider.id as provider_id,
      provider.business_name as provider_name,
      service.id as service_id,
      service.name as service_name,
      service.cover_image_url,
      category.id as category_id,
      coalesce(category.name, 'Uncategorized') as category_name
    from public.reviews review
    join public.bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    join public.provider_profiles provider on provider.id = review.provider_id
    join public.services service on service.id = review.service_id
    left join public.service_categories category on category.id = service.category_id
  ),
  filtered_reviews as (
    select review.*
    from eligible_reviews review
    where (p_category_id is null or review.category_id = p_category_id)
      and (
        normalized_sentiment = 'all'
        or (normalized_sentiment in ('positive', 'negative') and review.sentiment_label = normalized_sentiment)
        or (normalized_sentiment = 'unprocessed' and review.analysis_status <> 'processed')
      )
      and (
        normalized_search = ''
        or coalesce(review.comment, '') ilike '%' || normalized_search || '%'
        or review.provider_name ilike '%' || normalized_search || '%'
        or review.service_name ilike '%' || normalized_search || '%'
        or review.category_name ilike '%' || normalized_search || '%'
      )
  ),
  category_options as (
    select distinct category_id as id, category_name as name
    from eligible_reviews
    where category_id is not null
  ),
  paged_reviews as (
    select review.*
    from filtered_reviews review
    order by review.created_at desc, review.id
    offset (safe_page - 1) * safe_page_size
    limit safe_page_size
  )
  select jsonb_build_object(
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (select count(*) from filtered_reviews),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by lower(name), id)
      from category_options
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', review.id,
        'rating', review.rating,
        'comment', review.comment,
        'created_at', review.created_at,
        'sentiment', review.sentiment_label,
        'analysis_status', review.analysis_status,
        'provider_id', review.provider_id,
        'provider_name', review.provider_name,
        'service_id', review.service_id,
        'service_name', review.service_name,
        'cover_image_url', review.cover_image_url,
        'category_id', review.category_id,
        'category_name', review.category_name
      ) order by review.created_at desc, review.id)
      from paged_reviews review
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

create or replace function public.get_admin_review_detail(p_review_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if not public.has_permission('providers.view') then
    raise exception 'Review access is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', review.id,
    'rating', review.rating,
    'comment', review.comment,
    'created_at', review.created_at,
    'sentiment', review.sentiment_label,
    'sentiment_score', review.sentiment_score,
    'analysis_status', review.analysis_status,
    'topics', review.topic_assignments,
    'provider', jsonb_build_object('id', provider.id, 'name', provider.business_name),
    'service', jsonb_build_object(
      'id', service.id,
      'name', service.name,
      'cover_image_url', service.cover_image_url,
      'category_name', coalesce(category.name, 'Uncategorized')
    )
  ) into payload
  from public.reviews review
  join public.bookings booking on booking.id = review.booking_id
    and booking.status = 'completed'
    and booking.provider_id = review.provider_id
    and booking.service_id = review.service_id
  join public.provider_profiles provider on provider.id = review.provider_id
  join public.services service on service.id = review.service_id
  left join public.service_categories category on category.id = service.category_id
  where review.id = p_review_id;

  if payload is null then
    raise exception 'Review not found.' using errcode = 'P0002';
  end if;
  return payload;
end;
$$;

revoke all on function public.get_admin_dashboard_phase4(uuid, text) from public;
revoke all on function public.get_admin_reviews_directory(uuid, text, text, integer, integer) from public;
revoke all on function public.get_admin_review_detail(uuid) from public;
grant execute on function public.get_admin_dashboard_phase4(uuid, text) to authenticated;
grant execute on function public.get_admin_reviews_directory(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.get_admin_review_detail(uuid) to authenticated;

comment on function public.get_admin_dashboard_phase4(uuid, text) is
  'Read-only, permission-scoped V13 Phase 4 dashboard reviews and provider leaderboard.';
comment on function public.get_admin_reviews_directory(uuid, text, text, integer, integer) is
  'Read-only, permission-scoped, paginated completed-booking service reviews without reviewer identity.';
comment on function public.get_admin_review_detail(uuid) is
  'Read-only, permission-scoped completed-booking service review detail without reviewer identity.';

commit;
