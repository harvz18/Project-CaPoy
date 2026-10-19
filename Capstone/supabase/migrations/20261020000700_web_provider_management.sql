-- Phase 3: read-only, permission-scoped provider directory and performance detail.
-- These reporting RPCs intentionally do not alter provider, service, booking,
-- review, or financial records.

begin;

create or replace function public.get_admin_provider_directory(
  p_category_id uuid default null,
  p_status text default 'all',
  p_search text default '',
  p_sort text default 'performance',
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
  normalized_status text := lower(trim(coalesce(p_status, 'all')));
  normalized_sort text := lower(trim(coalesce(p_sort, 'performance')));
  normalized_search text := left(trim(coalesce(p_search, '')), 100);
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 5), 25);
  directory_payload jsonb;
begin
  if not public.has_permission('providers.view') then
    raise exception 'Provider-directory access is required.' using errcode = '42501';
  end if;
  if normalized_status not in ('all', 'pending', 'verified', 'disabled') then
    raise exception 'Unsupported provider status filter.' using errcode = '22023';
  end if;
  if normalized_sort not in ('performance', 'newest', 'rating', 'bookings') then
    raise exception 'Unsupported provider sort order.' using errcode = '22023';
  end if;

  with
  filtered_providers as (
    select
      provider.id,
      provider.user_id,
      provider.business_name,
      provider.description,
      provider.contact_email,
      provider.contact_phone,
      provider.location,
      provider.verification_status::text as verification_status,
      provider.terms_accepted,
      provider.terms_version,
      provider.created_at,
      profile.full_name,
      profile.email,
      profile.account_status::text as account_status
    from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where (normalized_status = 'all' or provider.verification_status::text = normalized_status)
      and (
        normalized_search = ''
        or provider.business_name ilike '%' || normalized_search || '%'
        or coalesce(profile.full_name, '') ilike '%' || normalized_search || '%'
        or coalesce(profile.email, '') ilike '%' || normalized_search || '%'
        or coalesce(provider.contact_email, '') ilike '%' || normalized_search || '%'
      )
  ),
  provider_category_rows as (
    select distinct
      service.provider_id,
      category.id as category_id,
      category.name as category_name
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join filtered_providers provider on provider.id = service.provider_id
    where service.status = 'active'
  ),
  provider_categories as (
    select
      provider_id,
      jsonb_agg(jsonb_build_object('id', category_id, 'name', category_name) order by category_name) as categories
    from provider_category_rows
    group by provider_id
  ),
  scoped_services as (
    select service.id, service.provider_id, service.category_id, service.status
    from public.services service
    join filtered_providers provider on provider.id = service.provider_id
    where p_category_id is null or service.category_id = p_category_id
  ),
  provider_service_metrics as (
    select
      provider.id as provider_id,
      count(distinct service.id) filter (where service.status = 'active') as active_service_count,
      count(distinct service.id) as service_count
    from filtered_providers provider
    left join scoped_services service on service.provider_id = provider.id
    group by provider.id
  ),
  provider_booking_metrics as (
    select
      service.provider_id,
      count(distinct booking.id) filter (where booking.status::text not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status::text in ('approved', 'confirmed', 'completed')) as confirmed_booking_count,
      count(distinct booking.id) filter (where booking.status::text = 'completed') as completed_booking_count
    from scoped_services service
    left join public.bookings booking on booking.service_id = service.id
    group by service.provider_id
  ),
  provider_review_metrics as (
    select
      service.provider_id,
      count(distinct review.id) as review_count,
      count(distinct review.id) filter (where nullif(trim(coalesce(review.comment, '')), '') is not null) as written_review_count,
      count(distinct review.id) filter (
        where nullif(trim(coalesce(review.comment, '')), '') is not null
          and review.sentiment_label = 'positive'
      ) as positive_written_review_count,
      count(distinct review.id) filter (
        where nullif(trim(coalesce(review.comment, '')), '') is not null
          and review.sentiment_label = 'negative'
      ) as negative_written_review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from scoped_services service
    left join public.reviews review on review.service_id = service.id
    group by service.provider_id
  ),
  provider_metrics as (
    select
      provider.*,
      coalesce(categories.categories, '[]'::jsonb) as categories,
      coalesce(service_metrics.active_service_count, 0) as active_service_count,
      coalesce(service_metrics.service_count, 0) as service_count,
      coalesce(booking_metrics.valid_booking_count, 0) as valid_booking_count,
      coalesce(booking_metrics.confirmed_booking_count, 0) as confirmed_booking_count,
      coalesce(booking_metrics.completed_booking_count, 0) as completed_booking_count,
      coalesce(review_metrics.review_count, 0) as review_count,
      coalesce(review_metrics.written_review_count, 0) as written_review_count,
      coalesce(review_metrics.positive_written_review_count, 0) as positive_written_review_count,
      coalesce(review_metrics.negative_written_review_count, 0) as negative_written_review_count,
      coalesce(review_metrics.average_rating, 0) as average_rating
    from filtered_providers provider
    left join provider_categories categories on categories.provider_id = provider.id
    left join provider_service_metrics service_metrics on service_metrics.provider_id = provider.id
    left join provider_booking_metrics booking_metrics on booking_metrics.provider_id = provider.id
    left join provider_review_metrics review_metrics on review_metrics.provider_id = provider.id
  ),
  ranked_providers as (
    select
      provider_metrics.*,
      row_number() over (
        order by
          confirmed_booking_count desc,
          completed_booking_count desc,
          valid_booking_count desc,
          case when review_count >= 3 then average_rating else 0 end desc,
          review_count desc,
          positive_written_review_count desc,
          negative_written_review_count asc,
          id
      ) as performance_rank,
      case
        when confirmed_booking_count > 0 and review_count >= 3 and average_rating >= 4 then 'High'
        when confirmed_booking_count > 0 then 'Good'
        when valid_booking_count > 0 then 'Building'
        else 'New'
      end as performance
    from provider_metrics
    where p_category_id is null or categories @> jsonb_build_array(jsonb_build_object('id', p_category_id))
  ),
  sorted_providers as (
    select *
    from ranked_providers
    order by
      case when normalized_sort = 'newest' then created_at end desc nulls last,
      case when normalized_sort = 'rating' and review_count >= 3 then average_rating end desc nulls last,
      case when normalized_sort = 'bookings' then valid_booking_count end desc nulls last,
      case when normalized_sort = 'performance' then confirmed_booking_count end desc nulls last,
      case when normalized_sort = 'performance' then completed_booking_count end desc nulls last,
      case when normalized_sort = 'performance' then valid_booking_count end desc nulls last,
      case when normalized_sort = 'performance' and review_count >= 3 then average_rating end desc nulls last,
      created_at desc,
      id
  ),
  paged_providers as (
    select *
    from sorted_providers
    offset (safe_page - 1) * safe_page_size
    limit safe_page_size
  ),
  category_options as (
    select category.id, category.name
    from public.service_categories category
    where category.is_active
      and exists (
        select 1 from public.services service
        where service.category_id = category.id and service.status = 'active'
      )
    order by category.name
  )
  select jsonb_build_object(
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (select count(*) from ranked_providers),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from category_options
    ), '[]'::jsonb),
    'ranking_method', 'Confirmed and completed bookings, then valid bookings, then ratings with at least three reviews, then written-feedback sentiment.',
    'top_providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', performance_rank,
        'id', id,
        'business_name', business_name,
        'categories', categories,
        'valid_bookings', valid_booking_count,
        'confirmed_bookings', confirmed_booking_count,
        'completed_bookings', completed_booking_count,
        'average_rating', average_rating,
        'review_count', review_count,
        'written_review_count', written_review_count,
        'positive_written_reviews', positive_written_review_count,
        'negative_written_reviews', negative_written_review_count,
        'performance', performance
      ) order by performance_rank)
      from (select * from ranked_providers order by performance_rank limit 5) ranking
    ), '[]'::jsonb),
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'business_name', business_name,
        'full_name', full_name,
        'email', coalesce(contact_email, email),
        'location', location,
        'verification_status', verification_status,
        'account_status', account_status,
        'categories', categories,
        'active_services', active_service_count,
        'services', service_count,
        'valid_bookings', valid_booking_count,
        'confirmed_bookings', confirmed_booking_count,
        'completed_bookings', completed_booking_count,
        'average_rating', average_rating,
        'review_count', review_count,
        'performance', performance,
        'registered_at', created_at,
        'terms_accepted', terms_accepted,
        'terms_version', terms_version
      ) order by row_order)
      from (
        select paged_providers.*, row_number() over () as row_order
        from paged_providers
      ) page_row
    ), '[]'::jsonb)
  ) into directory_payload;

  return directory_payload;
end;
$$;

create or replace function public.get_admin_provider_profile(p_provider_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_payload jsonb;
begin
  if not public.has_permission('providers.view') then
    raise exception 'Provider-profile access is required.' using errcode = '42501';
  end if;

  with
  provider_row as (
    select
      provider.id,
      provider.user_id,
      provider.business_name,
      provider.description,
      provider.contact_email,
      provider.contact_phone,
      provider.location,
      provider.verification_status::text as verification_status,
      provider.terms_accepted,
      provider.terms_version,
      provider.rejection_reason,
      provider.created_at,
      provider.reviewed_at,
      profile.full_name,
      profile.email,
      profile.phone,
      profile.account_status::text as account_status
    from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where provider.id = p_provider_id
  ),
  service_rows as (
    select
      service.id,
      service.name,
      service.status,
      service.is_available,
      service.base_price,
      service.location,
      service.created_at,
      category.id as category_id,
      category.name as category_name,
      count(distinct booking.id) filter (where booking.status::text not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status::text in ('approved', 'confirmed', 'completed')) as confirmed_booking_count,
      count(distinct booking.id) filter (where booking.status::text = 'completed') as completed_booking_count,
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.services service
    join provider_row provider on provider.id = service.provider_id
    left join public.service_categories category on category.id = service.category_id
    left join public.bookings booking on booking.service_id = service.id
    left join public.reviews review on review.service_id = service.id
    group by service.id, category.id, category.name
  ),
  summary as (
    select
      count(*) filter (where status = 'active') as active_service_count,
      count(*) as service_count,
      coalesce(sum(valid_booking_count), 0) as valid_booking_count,
      coalesce(sum(confirmed_booking_count), 0) as confirmed_booking_count,
      coalesce(sum(completed_booking_count), 0) as completed_booking_count
    from service_rows
  ),
  review_summary as (
    select
      count(*) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating,
      count(*) filter (where nullif(trim(coalesce(review.comment, '')), '') is not null) as written_review_count,
      count(*) filter (where review.sentiment_label = 'positive' and nullif(trim(coalesce(review.comment, '')), '') is not null) as positive_written_review_count,
      count(*) filter (where review.sentiment_label = 'negative' and nullif(trim(coalesce(review.comment, '')), '') is not null) as negative_written_review_count
    from public.reviews review
    join provider_row provider on provider.id = review.provider_id
  ),
  category_rows as (
    select distinct category.id, category.name
    from service_rows service
    join public.service_categories category on category.id = service.category_id
    order by category.name
  ),
  recent_review_rows as (
    select
      review.id,
      review.rating,
      review.comment,
      review.sentiment_label,
      review.created_at,
      service.name as service_name
    from public.reviews review
    join provider_row provider on provider.id = review.provider_id
    left join public.services service on service.id = review.service_id
    order by review.created_at desc, review.id
    limit 6
  )
  select jsonb_build_object(
    'provider', jsonb_build_object(
      'id', provider.id,
      'user_id', provider.user_id,
      'business_name', provider.business_name,
      'description', provider.description,
      'full_name', provider.full_name,
      'email', coalesce(provider.contact_email, provider.email),
      'phone', coalesce(provider.contact_phone, provider.phone),
      'location', provider.location,
      'verification_status', provider.verification_status,
      'account_status', provider.account_status,
      'terms_accepted', provider.terms_accepted,
      'terms_version', provider.terms_version,
      'rejection_reason', provider.rejection_reason,
      'registered_at', provider.created_at,
      'reviewed_at', provider.reviewed_at
    ),
    'summary', jsonb_build_object(
      'active_services', coalesce(summary.active_service_count, 0),
      'services', coalesce(summary.service_count, 0),
      'valid_bookings', coalesce(summary.valid_booking_count, 0),
      'confirmed_bookings', coalesce(summary.confirmed_booking_count, 0),
      'completed_bookings', coalesce(summary.completed_booking_count, 0),
      'average_rating', coalesce(review_summary.average_rating, 0),
      'review_count', coalesce(review_summary.review_count, 0),
      'written_review_count', coalesce(review_summary.written_review_count, 0),
      'positive_written_reviews', coalesce(review_summary.positive_written_review_count, 0),
      'negative_written_reviews', coalesce(review_summary.negative_written_review_count, 0)
    ),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name) from category_rows), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'status', status,
        'is_available', is_available,
        'base_price', base_price,
        'location', location,
        'category_id', category_id,
        'category_name', category_name,
        'valid_bookings', valid_booking_count,
        'confirmed_bookings', confirmed_booking_count,
        'completed_bookings', completed_booking_count,
        'average_rating', average_rating,
        'review_count', review_count,
        'created_at', created_at
      ) order by case when status = 'active' then 0 else 1 end, name)
      from service_rows
    ), '[]'::jsonb),
    'recent_reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'rating', rating,
        'comment', comment,
        'sentiment', sentiment_label,
        'created_at', created_at,
        'service_name', coalesce(service_name, 'Service review')
      ) order by created_at desc, id)
      from recent_review_rows
    ), '[]'::jsonb)
  ) into profile_payload
  from provider_row provider
  cross join summary
  cross join review_summary;

  if profile_payload is null then
    raise exception 'Provider not found.' using errcode = 'P0002';
  end if;
  return profile_payload;
end;
$$;

revoke all on function public.get_admin_provider_directory(uuid, text, text, text, integer, integer) from public;
revoke all on function public.get_admin_provider_profile(uuid) from public;
grant execute on function public.get_admin_provider_directory(uuid, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_admin_provider_profile(uuid) to authenticated;

comment on function public.get_admin_provider_directory(uuid, text, text, text, integer, integer) is
  'Read-only, paginated provider directory and category-specific performance ranking for authorized staff.';
comment on function public.get_admin_provider_profile(uuid) is
  'Read-only authorized provider detail, service history summary, and recent service-review information.';

commit;
