-- V13 Phase 5: category-level reporting for the admin dashboard.
-- These functions are read-only and use the same authoritative booking and
-- financial ledger definitions as the existing dashboard analytics.

begin;

create or replace function public.get_admin_category_performance(
  p_range text default 'week',
  p_event_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_key text := lower(trim(coalesce(p_range, 'week')));
  normalized_event_type text := nullif(lower(trim(coalesce(p_event_type, ''))), '');
  range_start timestamp without time zone;
  range_end timestamp without time zone;
  range_label text;
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

  range_end := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';
  case range_key
    when 'day' then
      range_start := range_end - interval '1 day';
      range_label := '1 day';
    when '3days' then
      range_start := range_end - interval '3 days';
      range_label := '3 days';
    when 'week' then
      range_start := range_end - interval '7 days';
      range_label := '1 week';
    when 'month' then
      range_start := range_end - interval '30 days';
      range_label := '1 month';
    else
      raise exception 'Unsupported dashboard date range.' using errcode = '22023';
  end case;

  with
  scoped_bookings as (
    select booking.id, booking.provider_id, booking.service_id, booking.status::text as status
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    where booking.created_at >= range_start at time zone 'Asia/Manila'
      and booking.created_at < range_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  scoped_revenue as (
    select ledger.booking_id, booking.provider_id, booking.service_id, coalesce(ledger.commission_amount, 0)::numeric as commission_amount
    from public.financial_transactions ledger
    join public.bookings booking on booking.id = ledger.booking_id
    join public.events event on event.id = booking.event_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.transaction_at >= range_start at time zone 'Asia/Manila'
      and ledger.transaction_at < range_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  service_metrics as (
    select
      service.category_id,
      count(distinct service.id) filter (where service.status = 'active') as active_service_count,
      count(distinct service.provider_id) filter (where service.status = 'active') as provider_count
    from public.services service
    group by service.category_id
  ),
  booking_metrics as (
    select
      service.category_id,
      count(distinct booking.id) filter (where booking.status not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from scoped_bookings booking
    join public.services service on service.id = booking.service_id
    group by service.category_id
  ),
  revenue_metrics as (
    select service.category_id, coalesce(sum(revenue.commission_amount), 0)::numeric as platform_revenue
    from scoped_revenue revenue
    join public.services service on service.id = revenue.service_id
    group by service.category_id
  ),
  review_metrics as (
    select
      service.category_id,
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.reviews review
    join scoped_bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    join public.services service on service.id = review.service_id
    group by service.category_id
  ),
  category_rows as (
    select
      category.id,
      category.name,
      category.description,
      category.icon_name,
      category.is_active,
      coalesce(services.active_service_count, 0) as active_services,
      coalesce(services.provider_count, 0) as providers,
      coalesce(bookings.valid_booking_count, 0) as valid_bookings,
      coalesce(bookings.completed_booking_count, 0) as completed_bookings,
      coalesce(revenue.platform_revenue, 0)::numeric as platform_revenue,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.review_count, 0) as review_count
    from public.service_categories category
    left join service_metrics services on services.category_id = category.id
    left join booking_metrics bookings on bookings.category_id = category.id
    left join revenue_metrics revenue on revenue.category_id = category.id
    left join review_metrics reviews on reviews.category_id = category.id
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'key', range_key,
      'label', range_label,
      'start', range_start at time zone 'Asia/Manila',
      'end', range_end at time zone 'Asia/Manila',
      'event_type', normalized_event_type
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'description', category.description,
        'icon_name', category.icon_name,
        'is_active', category.is_active,
        'active_services', category.active_services,
        'providers', category.providers,
        'valid_bookings', category.valid_bookings,
        'completed_bookings', category.completed_bookings,
        'platform_revenue', category.platform_revenue,
        'average_rating', category.average_rating,
        'review_count', category.review_count
      ) order by category.valid_bookings desc, category.platform_revenue desc, category.active_services desc, lower(category.name), category.id)
      from category_rows category
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

create or replace function public.get_admin_category_performance_detail(
  p_category_id uuid,
  p_range text default 'month',
  p_event_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_key text := lower(trim(coalesce(p_range, 'month')));
  normalized_event_type text := nullif(lower(trim(coalesce(p_event_type, ''))), '');
  range_start timestamp without time zone;
  range_end timestamp without time zone;
  range_label text;
  payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.service_categories category where category.id = p_category_id) then
    raise exception 'Category not found.' using errcode = 'P0002';
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'The selected event type is unavailable.' using errcode = '22023';
  end if;

  range_end := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';
  case range_key
    when 'day' then
      range_start := range_end - interval '1 day';
      range_label := '1 day';
    when '3days' then
      range_start := range_end - interval '3 days';
      range_label := '3 days';
    when 'week' then
      range_start := range_end - interval '7 days';
      range_label := '1 week';
    when 'month' then
      range_start := range_end - interval '30 days';
      range_label := '1 month';
    else
      raise exception 'Unsupported dashboard date range.' using errcode = '22023';
  end case;

  with
  category as (
    select id, name, description, icon_name, is_active
    from public.service_categories
    where id = p_category_id
  ),
  category_services as (
    select service.id, service.provider_id, service.name, service.status, service.base_price, service.cover_image_url
    from public.services service
    where service.category_id = p_category_id
  ),
  scoped_bookings as (
    select booking.id, booking.provider_id, booking.service_id, booking.status::text as status, booking.created_at
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join category_services service on service.id = booking.service_id
    where booking.created_at >= range_start at time zone 'Asia/Manila'
      and booking.created_at < range_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  scoped_revenue as (
    select ledger.booking_id, booking.provider_id, booking.service_id, coalesce(ledger.commission_amount, 0)::numeric as commission_amount
    from public.financial_transactions ledger
    join public.bookings booking on booking.id = ledger.booking_id
    join public.events event on event.id = booking.event_id
    join category_services service on service.id = booking.service_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.transaction_at >= range_start at time zone 'Asia/Manila'
      and ledger.transaction_at < range_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  category_service_metrics as (
    select
      count(*) as service_count,
      count(*) filter (where status = 'active') as active_service_count,
      count(distinct provider_id) filter (where status = 'active') as provider_count
    from category_services
  ),
  category_booking_metrics as (
    select
      count(distinct booking.id) filter (where booking.status not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from scoped_bookings booking
  ),
  category_revenue_metrics as (
    select coalesce(sum(revenue.commission_amount), 0)::numeric as platform_revenue
    from scoped_revenue revenue
  ),
  category_review_metrics as (
    select
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.reviews review
    join scoped_bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
  ),
  provider_service_metrics as (
    select
      service.provider_id,
      count(*) as service_count,
      count(*) filter (where service.status = 'active') as active_service_count
    from category_services service
    group by service.provider_id
  ),
  provider_booking_metrics as (
    select
      booking.provider_id,
      count(distinct booking.id) filter (where booking.status not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from scoped_bookings booking
    group by booking.provider_id
  ),
  provider_revenue_metrics as (
    select revenue.provider_id, coalesce(sum(revenue.commission_amount), 0)::numeric as platform_revenue
    from scoped_revenue revenue
    group by revenue.provider_id
  ),
  provider_review_metrics as (
    select
      review.provider_id,
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.reviews review
    join scoped_bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    group by review.provider_id
  ),
  provider_rows as (
    select
      provider.id,
      provider.business_name,
      provider.verification_status::text as verification_status,
      coalesce(services.service_count, 0) as service_count,
      coalesce(services.active_service_count, 0) as active_service_count,
      coalesce(bookings.valid_booking_count, 0) as valid_booking_count,
      coalesce(bookings.completed_booking_count, 0) as completed_booking_count,
      coalesce(revenue.platform_revenue, 0)::numeric as platform_revenue,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.review_count, 0) as review_count
    from provider_service_metrics services
    join public.provider_profiles provider on provider.id = services.provider_id
    left join provider_booking_metrics bookings on bookings.provider_id = provider.id
    left join provider_revenue_metrics revenue on revenue.provider_id = provider.id
    left join provider_review_metrics reviews on reviews.provider_id = provider.id
  ),
  service_booking_metrics as (
    select
      booking.service_id,
      count(distinct booking.id) filter (where booking.status not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from scoped_bookings booking
    group by booking.service_id
  ),
  service_revenue_metrics as (
    select revenue.service_id, coalesce(sum(revenue.commission_amount), 0)::numeric as platform_revenue
    from scoped_revenue revenue
    group by revenue.service_id
  ),
  service_review_metrics as (
    select
      review.service_id,
      count(distinct review.id) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.reviews review
    join scoped_bookings booking on booking.id = review.booking_id
      and booking.status = 'completed'
      and booking.provider_id = review.provider_id
      and booking.service_id = review.service_id
    group by review.service_id
  ),
  service_rows as (
    select
      service.id,
      service.name,
      service.status,
      service.base_price,
      service.cover_image_url,
      provider.id as provider_id,
      provider.business_name as provider_name,
      coalesce(bookings.valid_booking_count, 0) as valid_booking_count,
      coalesce(bookings.completed_booking_count, 0) as completed_booking_count,
      coalesce(revenue.platform_revenue, 0)::numeric as platform_revenue,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.review_count, 0) as review_count
    from category_services service
    join public.provider_profiles provider on provider.id = service.provider_id
    left join service_booking_metrics bookings on bookings.service_id = service.id
    left join service_revenue_metrics revenue on revenue.service_id = service.id
    left join service_review_metrics reviews on reviews.service_id = service.id
  ),
  booking_status_rows as (
    select booking.status, count(*) as booking_count
    from scoped_bookings booking
    group by booking.status
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'key', range_key,
      'label', range_label,
      'start', range_start at time zone 'Asia/Manila',
      'end', range_end at time zone 'Asia/Manila',
      'event_type', normalized_event_type
    ),
    'category', (
      select jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'description', category.description,
        'icon_name', category.icon_name,
        'is_active', category.is_active,
        'services', coalesce((select service_count from category_service_metrics), 0),
        'active_services', coalesce((select active_service_count from category_service_metrics), 0),
        'providers', coalesce((select provider_count from category_service_metrics), 0),
        'valid_bookings', coalesce((select valid_booking_count from category_booking_metrics), 0),
        'completed_bookings', coalesce((select completed_booking_count from category_booking_metrics), 0),
        'platform_revenue', coalesce((select platform_revenue from category_revenue_metrics), 0),
        'average_rating', coalesce((select average_rating from category_review_metrics), 0),
        'review_count', coalesce((select review_count from category_review_metrics), 0)
      )
      from category
    ),
    'booking_activity', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', booking_count) order by booking_count desc, status)
      from booking_status_rows
    ), '[]'::jsonb),
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', provider.id,
        'business_name', provider.business_name,
        'verification_status', provider.verification_status,
        'services', provider.service_count,
        'active_services', provider.active_service_count,
        'valid_bookings', provider.valid_booking_count,
        'completed_bookings', provider.completed_booking_count,
        'platform_revenue', provider.platform_revenue,
        'average_rating', provider.average_rating,
        'review_count', provider.review_count
      ) order by provider.valid_booking_count desc, provider.platform_revenue desc, provider.completed_booking_count desc, provider.business_name, provider.id)
      from (select * from provider_rows order by valid_booking_count desc, platform_revenue desc, completed_booking_count desc, business_name, id limit 12) provider
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', service.id,
        'name', service.name,
        'status', service.status,
        'base_price', service.base_price,
        'cover_image_url', service.cover_image_url,
        'provider_id', service.provider_id,
        'provider_name', service.provider_name,
        'valid_bookings', service.valid_booking_count,
        'completed_bookings', service.completed_booking_count,
        'platform_revenue', service.platform_revenue,
        'average_rating', service.average_rating,
        'review_count', service.review_count
      ) order by service.valid_booking_count desc, service.platform_revenue desc, service.name, service.id)
      from (select * from service_rows order by valid_booking_count desc, platform_revenue desc, name, id limit 12) service
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_category_performance(text, text) from public;
revoke all on function public.get_admin_category_performance_detail(uuid, text, text) from public;
grant execute on function public.get_admin_category_performance(text, text) to authenticated;
grant execute on function public.get_admin_category_performance_detail(uuid, text, text) to authenticated;

comment on function public.get_admin_category_performance(text, text) is
  'Read-only, permission-scoped V13 Phase 5 category metrics. Revenue is paid or verified booking-payment commission only.';
comment on function public.get_admin_category_performance_detail(uuid, text, text) is
  'Read-only, permission-scoped V13 Phase 5 category details, including category-attributed providers, services, bookings, revenue, and ratings.';

commit;
