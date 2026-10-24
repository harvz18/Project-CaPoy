-- V13 Phase 3: secure, live chart aggregates for the admin dashboard.
-- Revenue is recognized from the financial ledger, not reconstructed from
-- booking prices.  Each ledger entry represents an actual paid/verified
-- payment amount, so instalments are counted once each without duplicating
-- the original booking total.

begin;

create or replace function public.get_admin_dashboard_chart_analytics(
  p_period text default 'monthly',
  p_year integer default null,
  p_event_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  chart_period text := lower(trim(coalesce(p_period, 'monthly')));
  selected_year integer := coalesce(p_year, extract(year from now() at time zone 'Asia/Manila')::integer);
  current_year integer := extract(year from now() at time zone 'Asia/Manila')::integer;
  normalized_event_type text := nullif(lower(trim(coalesce(p_event_type, ''))), '');
  range_start timestamp without time zone;
  range_end timestamp without time zone;
  bucket_start timestamp without time zone;
  bucket_end timestamp without time zone;
  bucket_interval interval;
  range_label text;
  payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  if chart_period not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'Unsupported chart period: %', chart_period using errcode = '22023';
  end if;

  if selected_year < 2000 or selected_year > current_year then
    raise exception 'The selected reporting year is unavailable.' using errcode = '22023';
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'The selected event type is unavailable.' using errcode = '22023';
  end if;

  -- Daily, weekly, and monthly aggregation all represent the selected
  -- calendar year. Yearly is a six-calendar-year view ending in that year.
  if chart_period = 'yearly' then
    range_start := make_date(greatest(2000, selected_year - 5), 1, 1)::timestamp;
    range_end := make_date(selected_year + 1, 1, 1)::timestamp;
    bucket_start := date_trunc('year', range_start);
    bucket_end := date_trunc('year', range_end - interval '1 day');
    bucket_interval := interval '1 year';
    range_label := format('%s–%s', extract(year from range_start)::integer, selected_year);
  elsif chart_period = 'weekly' then
    range_start := make_date(selected_year, 1, 1)::timestamp;
    range_end := make_date(selected_year + 1, 1, 1)::timestamp;
    bucket_start := date_trunc('week', range_start);
    bucket_end := date_trunc('week', range_end - interval '1 day');
    bucket_interval := interval '1 week';
    range_label := selected_year::text;
  elsif chart_period = 'daily' then
    range_start := make_date(selected_year, 1, 1)::timestamp;
    range_end := make_date(selected_year + 1, 1, 1)::timestamp;
    bucket_start := range_start;
    bucket_end := range_end - interval '1 day';
    bucket_interval := interval '1 day';
    range_label := selected_year::text;
  else
    range_start := make_date(selected_year, 1, 1)::timestamp;
    range_end := make_date(selected_year + 1, 1, 1)::timestamp;
    bucket_start := date_trunc('month', range_start);
    bucket_end := date_trunc('month', range_end - interval '1 day');
    bucket_interval := interval '1 month';
    range_label := selected_year::text;
  end if;

  with
  scoped_bookings as (
    select
      booking.id,
      booking.created_at,
      booking.status::text as status,
      service.category_id
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    left join public.services service on service.id = booking.service_id
    where normalized_event_type is null
      or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ),
  valid_bookings_in_range as (
    select booking.*
    from scoped_bookings booking
    where booking.created_at >= range_start at time zone 'Asia/Manila'
      and booking.created_at < range_end at time zone 'Asia/Manila'
      and booking.status not in ('rejected', 'cancelled', 'expired')
  ),
  scoped_recognized_transactions as (
    select
      ledger.transaction_at,
      coalesce(ledger.gross_amount, 0)::numeric as gross_transaction_volume,
      coalesce(ledger.commission_amount, 0)::numeric as platform_revenue
    from public.financial_transactions ledger
    join public.bookings booking on booking.id = ledger.booking_id
    join public.events event on event.id = booking.event_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
  ),
  recognized_transactions_in_range as (
    select ledger.*
    from scoped_recognized_transactions ledger
    where ledger.transaction_at >= range_start at time zone 'Asia/Manila'
      and ledger.transaction_at < range_end at time zone 'Asia/Manila'
  ),
  reporting_buckets as (
    select bucket_start_value as bucket_start
    from generate_series(bucket_start, bucket_end, bucket_interval) bucket_start_value
  ),
  booking_bucket_totals as (
    select
      date_trunc(
        case chart_period
          when 'daily' then 'day'
          when 'weekly' then 'week'
          when 'monthly' then 'month'
          else 'year'
        end,
        booking.created_at at time zone 'Asia/Manila'
      ) as bucket_start,
      count(*)::integer as booking_count
    from valid_bookings_in_range booking
    group by 1
  ),
  revenue_bucket_totals as (
    select
      date_trunc(
        case chart_period
          when 'daily' then 'day'
          when 'weekly' then 'week'
          when 'monthly' then 'month'
          else 'year'
        end,
        ledger.transaction_at at time zone 'Asia/Manila'
      ) as bucket_start,
      coalesce(sum(ledger.gross_transaction_volume), 0)::numeric as gross_transaction_volume,
      coalesce(sum(ledger.platform_revenue), 0)::numeric as platform_revenue
    from recognized_transactions_in_range ledger
    group by 1
  ),
  category_rows as (
    select
      coalesce(category.id::text, 'uncategorized') as id,
      coalesce(nullif(trim(category.name), ''), 'Uncategorized') as name,
      count(distinct booking.id)::integer as booking_count
    from valid_bookings_in_range booking
    left join public.service_categories category on category.id = booking.category_id
    group by coalesce(category.id::text, 'uncategorized'), coalesce(nullif(trim(category.name), ''), 'Uncategorized')
  ),
  available_years as (
    select selected_year as value
    union
    select extract(year from booking.created_at at time zone 'Asia/Manila')::integer
    from scoped_bookings booking
    union
    select extract(year from ledger.transaction_at at time zone 'Asia/Manila')::integer
    from scoped_recognized_transactions ledger
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'period', chart_period,
      'label', range_label,
      'selected_year', selected_year,
      'start', range_start,
      'end', range_end,
      'event_type', normalized_event_type
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', to_char(bucket.bucket_start, 'YYYY-MM-DD'),
        'label', case chart_period
          when 'daily' then to_char(bucket.bucket_start, 'Mon DD')
          when 'weekly' then 'W' || to_char(bucket.bucket_start, 'IW')
          when 'monthly' then to_char(bucket.bucket_start, 'Mon')
          else to_char(bucket.bucket_start, 'YYYY')
        end,
        'platform_revenue', coalesce(revenue.platform_revenue, 0),
        'gross_transaction_volume', coalesce(revenue.gross_transaction_volume, 0),
        'bookings', coalesce(bookings.booking_count, 0)
      ) order by bucket.bucket_start)
      from reporting_buckets bucket
      left join booking_bucket_totals bookings on bookings.bucket_start = bucket.bucket_start
      left join revenue_bucket_totals revenue on revenue.bucket_start = bucket.bucket_start
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'bookings', category.booking_count
      ) order by category.booking_count desc, lower(category.name), category.id)
      from category_rows category
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'bookings', (select count(*) from valid_bookings_in_range),
      'platform_revenue', (select coalesce(sum(platform_revenue), 0) from recognized_transactions_in_range),
      'gross_transaction_volume', (select coalesce(sum(gross_transaction_volume), 0) from recognized_transactions_in_range)
    ),
    'available_years', coalesce((
      select jsonb_agg(value order by value desc)
      from available_years
      where value between 2000 and current_year
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_dashboard_chart_analytics(text, integer, text) from public;
grant execute on function public.get_admin_dashboard_chart_analytics(text, integer, text) to authenticated;

comment on function public.get_admin_dashboard_chart_analytics(text, integer, text) is
  'Read-only, permission-scoped V13 chart analytics. Platform revenue is paid/verified ledger commission; gross transaction volume is reported separately.';

commit;
