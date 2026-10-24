-- V13 Phase 6: explainable, read-only decision-support insights.
-- This migration does not feature providers, change moderation state, or alter
-- bookings, reviews, service listings, or financial records.

begin;

create or replace function public.get_admin_dashboard_insights(
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
  -- The end is tomorrow at Manila midnight, so start 29 midnights ago to
  -- include today while keeping each comparison window exactly 30 days.
  current_start timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Manila') - interval '29 days';
  previous_start timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Manila') - interval '59 days';
  current_end timestamp without time zone := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';
  payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'The selected event type is unavailable.' using errcode = '22023';
  end if;

  with
  eligible_providers as (
    select provider.id, provider.business_name, provider.verification_status::text as verification_status
    from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where provider.verification_status::text in ('verified', 'active')
      and profile.account_status::text in ('active', 'verified')
  ),
  provider_service_metrics as (
    select
      provider.id as provider_id,
      count(distinct service.id) filter (where service.status = 'active') as active_service_count,
      count(distinct service.id) filter (where service.status = 'pending_review') as pending_service_count
    from eligible_providers provider
    left join public.services service on service.provider_id = provider.id
    group by provider.id
  ),
  scoped_bookings as (
    select booking.id, booking.provider_id, booking.service_id, booking.status::text as status, booking.created_at
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    where booking.created_at >= previous_start at time zone 'Asia/Manila'
      and booking.created_at < current_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  provider_booking_metrics as (
    select
      booking.provider_id,
      count(distinct booking.id) filter (
        where booking.created_at >= current_start at time zone 'Asia/Manila'
          and booking.status not in ('rejected', 'cancelled', 'expired')
      ) as current_valid_booking_count,
      count(distinct booking.id) filter (
        where booking.created_at >= previous_start at time zone 'Asia/Manila'
          and booking.created_at < current_start at time zone 'Asia/Manila'
          and booking.status not in ('rejected', 'cancelled', 'expired')
      ) as previous_valid_booking_count,
      count(distinct booking.id) filter (
        where booking.created_at >= current_start at time zone 'Asia/Manila'
          and booking.status = 'completed'
      ) as current_completed_booking_count
    from scoped_bookings booking
    group by booking.provider_id
  ),
  eligible_reviews as (
    select review.id, review.provider_id, review.rating, review.comment, review.sentiment_label, review.analysis_status, review.created_at
    from public.reviews review
    join public.bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    join public.events event on event.id = booking.event_id
    where normalized_event_type is null
      or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ),
  provider_review_metrics as (
    select
      review.provider_id,
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating,
      count(distinct review.id) filter (
        where review.created_at >= current_start at time zone 'Asia/Manila'
      ) as current_review_count,
      coalesce(round(avg(review.rating) filter (
        where review.created_at >= current_start at time zone 'Asia/Manila'
      )::numeric, 1), 0) as current_average_rating,
      count(distinct review.id) filter (
        where review.created_at >= previous_start at time zone 'Asia/Manila'
          and review.created_at < current_start at time zone 'Asia/Manila'
      ) as previous_review_count,
      coalesce(round(avg(review.rating) filter (
        where review.created_at >= previous_start at time zone 'Asia/Manila'
          and review.created_at < current_start at time zone 'Asia/Manila'
      )::numeric, 1), 0) as previous_average_rating,
      count(distinct review.id) filter (
        where review.created_at >= current_start at time zone 'Asia/Manila'
          and review.analysis_status = 'processed'
          and review.sentiment_label = 'positive'
          and nullif(trim(coalesce(review.comment, '')), '') is not null
      ) as current_positive_written_review_count,
      count(distinct review.id) filter (
        where review.created_at >= current_start at time zone 'Asia/Manila'
          and review.analysis_status = 'processed'
          and review.sentiment_label = 'negative'
          and nullif(trim(coalesce(review.comment, '')), '') is not null
      ) as current_negative_written_review_count
    from eligible_reviews review
    group by review.provider_id
  ),
  provider_metrics as (
    select
      provider.id,
      provider.business_name,
      provider.verification_status,
      coalesce(services.active_service_count, 0) as active_service_count,
      coalesce(services.pending_service_count, 0) as pending_service_count,
      coalesce(bookings.current_valid_booking_count, 0) as current_valid_booking_count,
      coalesce(bookings.previous_valid_booking_count, 0) as previous_valid_booking_count,
      coalesce(bookings.current_completed_booking_count, 0) as current_completed_booking_count,
      coalesce(reviews.review_count, 0) as review_count,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.current_review_count, 0) as current_review_count,
      coalesce(reviews.current_average_rating, 0) as current_average_rating,
      coalesce(reviews.previous_review_count, 0) as previous_review_count,
      coalesce(reviews.previous_average_rating, 0) as previous_average_rating,
      coalesce(reviews.current_positive_written_review_count, 0) as current_positive_written_review_count,
      coalesce(reviews.current_negative_written_review_count, 0) as current_negative_written_review_count
    from eligible_providers provider
    left join provider_service_metrics services on services.provider_id = provider.id
    left join provider_booking_metrics bookings on bookings.provider_id = provider.id
    left join provider_review_metrics reviews on reviews.provider_id = provider.id
  ),
  current_category_revenue as (
    select
      category.id,
      category.name,
      coalesce(sum(ledger.commission_amount), 0)::numeric as platform_revenue
    from public.financial_transactions ledger
    join public.bookings booking on booking.id = ledger.booking_id
    join public.events event on event.id = booking.event_id
    join public.services service on service.id = booking.service_id
    join public.service_categories category on category.id = service.category_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.transaction_at >= current_start at time zone 'Asia/Manila'
      and ledger.transaction_at < current_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
    group by category.id, category.name
  ),
  highest_rated_provider as (
    select provider.*
    from provider_metrics provider
    where provider.review_count >= 3
    order by provider.average_rating desc, provider.review_count desc, provider.current_completed_booking_count desc, provider.id
    limit 1
  ),
  most_booked_provider as (
    select provider.*
    from provider_metrics provider
    where provider.current_valid_booking_count > 0
    order by provider.current_valid_booking_count desc, provider.current_completed_booking_count desc, provider.id
    limit 1
  ),
  declining_provider as (
    select provider.*, (provider.current_average_rating - provider.previous_average_rating)::numeric as rating_difference
    from provider_metrics provider
    where provider.current_review_count >= 3
      and provider.previous_review_count >= 3
      and provider.current_average_rating <= provider.previous_average_rating - 0.5
    order by rating_difference asc, provider.current_review_count desc, provider.id
    limit 1
  ),
  feature_candidate as (
    select provider.*
    from provider_metrics provider
    where provider.active_service_count > 0
      and provider.pending_service_count = 0
      and provider.review_count >= 3
      and provider.average_rating >= 4.2
      and provider.current_valid_booking_count >= 2
      and provider.previous_valid_booking_count >= 2
      and provider.current_positive_written_review_count >= 2
      and provider.current_positive_written_review_count > provider.current_negative_written_review_count
    order by provider.average_rating desc, provider.current_valid_booking_count desc, provider.current_positive_written_review_count desc, provider.review_count desc, provider.id
    limit 1
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'current_start', current_start at time zone 'Asia/Manila',
      'current_end', current_end at time zone 'Asia/Manila',
      'previous_start', previous_start at time zone 'Asia/Manila',
      'event_type', normalized_event_type
    ),
    'criteria', jsonb_build_object(
      'highest_rated_provider', 'Verified active provider with at least three completed-booking reviews; ties use review count, then completed bookings.',
      'top_revenue_category', 'Highest paid or verified booking-payment commission in the current 30-day period.',
      'most_booked_provider', 'Most valid service booking requests in the current 30-day period; cancelled, rejected, and expired bookings are excluded.',
      'declining_rating', 'At least three completed-booking reviews in each comparable 30-day period and a current average rating decline of at least 0.5 points.',
      'recommended_to_feature', 'Advisory only: verified active provider, active services, no service awaiting moderation, at least three completed-booking reviews averaging 4.2 or higher, at least two valid bookings in each 30-day period, and at least two positive analyzed written reviews in the current period.'
    ),
    'highest_rated_provider', (
      select jsonb_build_object(
        'id', provider.id,
        'business_name', provider.business_name,
        'average_rating', provider.average_rating,
        'review_count', provider.review_count,
        'completed_bookings', provider.current_completed_booking_count
      ) from highest_rated_provider provider
    ),
    'top_revenue_category', (
      select jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'platform_revenue', category.platform_revenue
      )
      from current_category_revenue category
      where category.platform_revenue > 0
      order by category.platform_revenue desc, category.name, category.id
      limit 1
    ),
    'most_booked_provider', (
      select jsonb_build_object(
        'id', provider.id,
        'business_name', provider.business_name,
        'valid_bookings', provider.current_valid_booking_count,
        'completed_bookings', provider.current_completed_booking_count
      ) from most_booked_provider provider
    ),
    'declining_rating', (
      select jsonb_build_object(
        'id', provider.id,
        'business_name', provider.business_name,
        'previous_rating', provider.previous_average_rating,
        'current_rating', provider.current_average_rating,
        'difference', provider.rating_difference,
        'previous_review_count', provider.previous_review_count,
        'current_review_count', provider.current_review_count
      ) from declining_provider provider
    ),
    'recommended_to_feature', (
      select jsonb_build_object(
        'id', provider.id,
        'business_name', provider.business_name,
        'average_rating', provider.average_rating,
        'review_count', provider.review_count,
        'current_valid_bookings', provider.current_valid_booking_count,
        'previous_valid_bookings', provider.previous_valid_booking_count,
        'positive_written_reviews', provider.current_positive_written_review_count,
        'negative_written_reviews', provider.current_negative_written_review_count
      ) from feature_candidate provider
    )
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_dashboard_insights(text) from public;
grant execute on function public.get_admin_dashboard_insights(text) to authenticated;

comment on function public.get_admin_dashboard_insights(text) is
  'Read-only, permission-scoped V13 Phase 6 explanatory decision-support insights. It does not feature providers or alter moderation.';

commit;
