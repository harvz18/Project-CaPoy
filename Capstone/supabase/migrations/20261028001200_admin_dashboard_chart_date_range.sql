-- V13 dashboard follow-up: custom From/To analytics for the revenue chart.
-- This is deliberately a new RPC so the already-deployed annual-chart RPC
-- remains available to any existing client while the dashboard moves to the
-- requested calendar range control.

begin;

create function public.get_admin_dashboard_chart_range_analytics(
  p_from_date date default null,
  p_to_date date default null,
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
  selected_year integer := coalesce(p_year, extract(year from now() at time zone 'Asia/Manila')::integer);
  current_year integer := extract(year from now() at time zone 'Asia/Manila')::integer;
  today_manila date := (now() at time zone 'Asia/Manila')::date;
  reporting_from date;
  reporting_to date;
  normalized_event_type text := nullif(lower(trim(coalesce(p_event_type, ''))), '');
  chart_period text;
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

  if selected_year < 2000 or selected_year > current_year then
    raise exception 'The selected reporting year is unavailable.' using errcode = '22023';
  end if;

  reporting_from := coalesce(p_from_date, make_date(selected_year, 1, 1));
  reporting_to := coalesce(
    p_to_date,
    case when selected_year = current_year then today_manila else make_date(selected_year, 12, 31) end
  );

  if extract(year from reporting_from)::integer <> selected_year
    or extract(year from reporting_to)::integer <> selected_year then
    raise exception 'The selected dates must be within the selected reporting year.' using errcode = '22023';
  end if;

  if reporting_from > reporting_to then
    raise exception 'The From date must be on or before the To date.' using errcode = '22023';
  end if;

  if reporting_to > today_manila then
    raise exception 'Future reporting dates are unavailable.' using errcode = '22023';
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'The selected event type is unavailable.' using errcode = '22023';
  end if;

  -- Pick readable buckets from the user-selected interval. This keeps short
  -- ranges day-level, medium ranges week-level, and long ranges month-level
  -- without returning hundreds of unreadable bars.
  chart_period := case
    when reporting_to - reporting_from <= 31 then 'daily'
    when reporting_to - reporting_from <= 183 then 'weekly'
    else 'monthly'
  end;
  range_start := reporting_from::timestamp;
  range_end := (reporting_to + 1)::timestamp;

  if chart_period = 'daily' then
    bucket_start := range_start;
    bucket_end := range_end - interval '1 day';
    bucket_interval := interval '1 day';
  elsif chart_period = 'weekly' then
    bucket_start := date_trunc('week', range_start);
    bucket_end := date_trunc('week', range_end - interval '1 day');
    bucket_interval := interval '1 week';
  else
    bucket_start := date_trunc('month', range_start);
    bucket_end := date_trunc('month', range_end - interval '1 day');
    bucket_interval := interval '1 month';
  end if;

  range_label := case
    when reporting_from = reporting_to then to_char(reporting_from, 'Mon DD, YYYY')
    when extract(year from reporting_from) = extract(year from reporting_to)
      then format('%s - %s, %s', to_char(reporting_from, 'Mon DD'), to_char(reporting_to, 'Mon DD'), extract(year from reporting_to)::integer)
    else format('%s - %s', to_char(reporting_from, 'Mon DD, YYYY'), to_char(reporting_to, 'Mon DD, YYYY'))
  end;

  with
  scoped_bookings as (
    select booking.id, booking.created_at, booking.status::text as status, service.category_id
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
      and (normalized_event_type is null or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type)
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
      date_trunc(case chart_period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end, booking.created_at at time zone 'Asia/Manila') as bucket_start,
      count(*)::integer as booking_count
    from valid_bookings_in_range booking
    group by 1
  ),
  revenue_bucket_totals as (
    select
      date_trunc(case chart_period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end, ledger.transaction_at at time zone 'Asia/Manila') as bucket_start,
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
    select extract(year from booking.created_at at time zone 'Asia/Manila')::integer from scoped_bookings booking
    union
    select extract(year from ledger.transaction_at at time zone 'Asia/Manila')::integer from scoped_recognized_transactions ledger
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
          when 'weekly' then 'Week of ' || to_char(bucket.bucket_start, 'Mon DD')
          else to_char(bucket.bucket_start, 'Mon')
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
      select jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name, 'bookings', category.booking_count) order by category.booking_count desc, lower(category.name), category.id)
      from category_rows category
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'bookings', (select count(*) from valid_bookings_in_range),
      'platform_revenue', (select coalesce(sum(platform_revenue), 0) from recognized_transactions_in_range),
      'gross_transaction_volume', (select coalesce(sum(gross_transaction_volume), 0) from recognized_transactions_in_range)
    ),
    'available_years', coalesce((
      select jsonb_agg(value order by value desc) from available_years where value between 2000 and current_year
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_dashboard_chart_range_analytics(date, date, integer, text) from public;
grant execute on function public.get_admin_dashboard_chart_range_analytics(date, date, integer, text) to authenticated;

comment on function public.get_admin_dashboard_chart_range_analytics(date, date, integer, text) is
  'Read-only, permission-scoped V13 chart analytics for a selected calendar range. Platform revenue is paid/verified ledger commission; gross payment volume is separate.';

commit;
