-- Phase 2: permission-scoped, range-aware analytics for the admin web dashboard.
-- This is read-only reporting. It neither changes booking/payment state nor
-- exposes source rows to the browser.

begin;

create or replace function public.get_admin_dashboard_analytics(p_range text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  range_key text := lower(trim(coalesce(p_range, 'week')));
  range_start timestamp without time zone;
  range_end timestamp without time zone;
  previous_start timestamp without time zone;
  bucket_step interval;
  bucket_precision text;
  range_label text;
  analytics_payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  -- Use the business timezone for all date boundaries and graph labels.
  range_end := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';

  case range_key
    when 'day' then
      range_start := range_end - interval '1 day';
      previous_start := range_start - interval '1 day';
      bucket_step := interval '1 hour';
      bucket_precision := 'hour';
      range_label := '1 day';
    when '3days' then
      range_start := range_end - interval '3 days';
      previous_start := range_start - interval '3 days';
      bucket_step := interval '1 day';
      bucket_precision := 'day';
      range_label := '3 days';
    when 'week' then
      range_start := range_end - interval '7 days';
      previous_start := range_start - interval '7 days';
      bucket_step := interval '1 day';
      bucket_precision := 'day';
      range_label := '1 week';
    when 'month' then
      range_start := range_end - interval '30 days';
      previous_start := range_start - interval '30 days';
      bucket_step := interval '1 day';
      bucket_precision := 'day';
      range_label := '1 month';
    else
      raise exception 'Unsupported dashboard date range.' using errcode = '22023';
  end case;

  with
  reporting_buckets as (
    select bucket_start
    from generate_series(range_start, range_end - bucket_step, bucket_step) as series(bucket_start)
  ),
  bookings_in_range as (
    select booking.*
    from public.bookings booking
    where booking.created_at >= range_start at time zone 'Asia/Manila'
      and booking.created_at < range_end at time zone 'Asia/Manila'
  ),
  recognized_finance_in_range as (
    select ledger.*
    from public.financial_transactions ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.transaction_at >= range_start at time zone 'Asia/Manila'
      and ledger.transaction_at < range_end at time zone 'Asia/Manila'
  ),
  booking_bucket_totals as (
    select
      date_trunc(bucket_precision, booking.created_at at time zone 'Asia/Manila') as bucket_start,
      count(*) filter (where booking.status::text not in ('rejected', 'cancelled', 'expired')) as valid_booking_count,
      coalesce(sum(booking.amount) filter (
        where booking.status::text not in ('rejected', 'cancelled', 'expired')
      ), 0) as gross_booking_value
    from bookings_in_range booking
    group by date_trunc(bucket_precision, booking.created_at at time zone 'Asia/Manila')
  ),
  finance_bucket_totals as (
    select
      date_trunc(bucket_precision, ledger.transaction_at at time zone 'Asia/Manila') as bucket_start,
      coalesce(sum(ledger.commission_amount), 0) as platform_revenue
    from recognized_finance_in_range ledger
    group by date_trunc(bucket_precision, ledger.transaction_at at time zone 'Asia/Manila')
  ),
  previous_period_totals as (
    select
      (
        select count(*)
        from public.bookings booking
        where booking.created_at >= previous_start at time zone 'Asia/Manila'
          and booking.created_at < range_start at time zone 'Asia/Manila'
          and booking.status::text not in ('rejected', 'cancelled', 'expired')
      ) as valid_booking_count,
      (
        select coalesce(sum(ledger.commission_amount), 0)
        from public.financial_transactions ledger
        where ledger.transaction_type = 'booking_payment'
          and ledger.status in ('paid', 'verified')
          and ledger.transaction_at >= previous_start at time zone 'Asia/Manila'
          and ledger.transaction_at < range_start at time zone 'Asia/Manila'
      ) as platform_revenue
  ),
  category_rows as (
    select
      category.id,
      category.name,
      count(distinct service.id) filter (where service.status = 'active') as active_service_count,
      count(distinct service.provider_id) filter (where service.status = 'active') as provider_count,
      count(distinct booking.id) filter (
        where booking.status::text not in ('rejected', 'cancelled', 'expired')
      ) as booking_count
    from public.service_categories category
    left join public.services service on service.category_id = category.id
    left join bookings_in_range booking on booking.service_id = service.id
    where category.is_active
    group by category.id, category.name
    order by booking_count desc, active_service_count desc, category.name
    limit 8
  ),
  booking_status_rows as (
    select booking.status::text as status, count(*) as booking_count
    from bookings_in_range booking
    group by booking.status
    order by count(*) desc, booking.status
  ),
  recent_booking_rows as (
    select
      booking.id,
      booking.status::text as status,
      coalesce(booking.amount, 0) as amount,
      booking.created_at,
      coalesce(nullif(trim(event.name), ''), 'Untitled event') as event_name,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join public.provider_profiles provider on provider.id = booking.provider_id
    order by booking.created_at desc, booking.id
    limit 5
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'key', range_key,
      'label', range_label,
      'start', range_start at time zone 'Asia/Manila',
      'end', range_end at time zone 'Asia/Manila'
    ),
    'kpis', jsonb_build_object(
      'providers', jsonb_build_object(
        'total', (select count(*) from public.provider_profiles),
        'verified', (select count(*) from public.provider_profiles where verification_status = 'verified'),
        'pending', (select count(*) from public.provider_profiles where verification_status = 'pending')
      ),
      'clients', jsonb_build_object(
        'total', (select count(*) from public.profiles where default_role = 'client'),
        'active', (select count(*) from public.profiles where default_role = 'client' and account_status in ('active', 'verified'))
      ),
      'valid_bookings', jsonb_build_object(
        'current', (select coalesce(sum(valid_booking_count), 0) from booking_bucket_totals),
        'previous', (select valid_booking_count from previous_period_totals)
      ),
      'confirmed_bookings', jsonb_build_object(
        'current', (select count(*) from bookings_in_range where status::text in ('approved', 'confirmed', 'completed'))
      ),
      'platform_revenue', jsonb_build_object(
        'current', (select coalesce(sum(platform_revenue), 0) from finance_bucket_totals),
        'previous', (select platform_revenue from previous_period_totals)
      ),
      'pending_applications', jsonb_build_object(
        'current', (
          (select count(*) from public.provider_profiles where verification_status = 'pending')
          + (select count(*) from public.services where status = 'pending_review')
        ),
        'providers', (select count(*) from public.provider_profiles where verification_status = 'pending'),
        'services', (select count(*) from public.services where status = 'pending_review')
      )
    ),
    'financial_summary', jsonb_build_object(
      'gross_booking_value', (select coalesce(sum(gross_booking_value), 0) from booking_bucket_totals),
      'recognized_platform_revenue', (select coalesce(sum(platform_revenue), 0) from finance_bucket_totals),
      'pending_collections', (
        select coalesce(sum(payment.amount), 0)
        from public.payments payment
        where payment.status in ('pending', 'processing')
          and payment.created_at >= range_start at time zone 'Asia/Manila'
          and payment.created_at < range_end at time zone 'Asia/Manila'
      ),
      'pending_collection_count', (
        select count(*)
        from public.payments payment
        where payment.status in ('pending', 'processing')
          and payment.created_at >= range_start at time zone 'Asia/Manila'
          and payment.created_at < range_end at time zone 'Asia/Manila'
      )
    ),
    'booking_trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', to_char(bucket.bucket_start, case when range_key = 'day' then 'YYYY-MM-DD HH24:00' else 'YYYY-MM-DD' end),
        'label', case when range_key = 'day' then to_char(bucket.bucket_start, 'HH24:00') else to_char(bucket.bucket_start, 'Mon DD') end,
        'bookings', coalesce(totals.valid_booking_count, 0)
      ) order by bucket.bucket_start)
      from reporting_buckets bucket
      left join booking_bucket_totals totals on totals.bucket_start = bucket.bucket_start
    ), '[]'::jsonb),
    'revenue_trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', to_char(bucket.bucket_start, case when range_key = 'day' then 'YYYY-MM-DD HH24:00' else 'YYYY-MM-DD' end),
        'label', case when range_key = 'day' then to_char(bucket.bucket_start, 'HH24:00') else to_char(bucket.bucket_start, 'Mon DD') end,
        'gross_booking_value', coalesce(bookings.gross_booking_value, 0),
        'recognized_platform_revenue', coalesce(finance.platform_revenue, 0)
      ) order by bucket.bucket_start)
      from reporting_buckets bucket
      left join booking_bucket_totals bookings on bookings.bucket_start = bucket.bucket_start
      left join finance_bucket_totals finance on finance.bucket_start = bucket.bucket_start
    ), '[]'::jsonb),
    'booking_statuses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', status,
        'count', booking_count
      ) order by booking_count desc, status)
      from booking_status_rows
    ), '[]'::jsonb),
    'popular_categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'active_services', active_service_count,
        'providers', provider_count,
        'bookings', booking_count
      ) order by booking_count desc, active_service_count desc, name)
      from category_rows
    ), '[]'::jsonb),
    'action_counts', jsonb_build_object(
      'pending_providers', (select count(*) from public.provider_profiles where verification_status = 'pending'),
      'pending_services', (select count(*) from public.services where status = 'pending_review'),
      'pending_payments', (select count(*) from public.payments where status in ('pending', 'processing')),
      'negative_reviews', (select count(*) from public.reviews where sentiment_label = 'negative'),
      'active_support_tickets', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_for_user')),
      'urgent_support_tickets', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_for_user') and priority = 'urgent'),
      'unassigned_events', (select count(*) from public.events where coordinator_assignment_status = 'awaiting_assignment' and status not in ('completed', 'cancelled'))
    ),
    'recent_bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'status', status,
        'amount', amount,
        'created_at', created_at,
        'event_name', event_name,
        'provider_name', provider_name
      ) order by created_at desc, id)
      from recent_booking_rows
    ), '[]'::jsonb)
  ) into analytics_payload;

  return analytics_payload;
end;
$$;

revoke all on function public.get_admin_dashboard_analytics(text) from public;
grant execute on function public.get_admin_dashboard_analytics(text) to authenticated;

comment on function public.get_admin_dashboard_analytics(text) is
  'Read-only, permission-scoped dashboard aggregates for a 1-day, 3-day, 1-week, or 1-month Manila reporting period.';

commit;
