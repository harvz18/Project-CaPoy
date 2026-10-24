-- MULTIVENT Revision V13, Phase 2: live KPI cards, event-type scope, and
-- permission-scoped global dashboard search. These are read-only reporting
-- functions; they do not create or change bookings, payment, or account data.

begin;

drop function if exists public.get_admin_dashboard_analytics(text);

create function public.get_admin_dashboard_analytics(
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
  previous_start timestamp without time zone;
  current_month_start timestamp without time zone;
  previous_month_start timestamp without time zone;
  bucket_step interval;
  bucket_precision text;
  range_label text;
  analytics_payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  if normalized_event_type = 'all' then
    normalized_event_type := null;
  end if;

  if normalized_event_type is not null and not exists (
    select 1
    from public.events event
    where lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ) then
    raise exception 'Unsupported dashboard event type.' using errcode = '22023';
  end if;

  -- All reporting boundaries follow the MULTIVENT business timezone.
  range_end := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';
  current_month_start := date_trunc('month', now() at time zone 'Asia/Manila');
  previous_month_start := current_month_start - interval '1 month';

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
  provider_accounts as (
    select provider.*
    from public.provider_profiles provider
    join public.profiles profile on profile.id = provider.user_id
    where profile.default_role = 'service_provider'
      and profile.account_status not in ('disabled', 'suspended')
      and provider.verification_status <> 'disabled'
  ),
  active_provider_accounts as (
    select provider.*
    from provider_accounts provider
    join public.profiles profile on profile.id = provider.user_id
    where provider.verification_status in ('active', 'verified')
      and profile.account_status in ('active', 'verified')
  ),
  scoped_bookings as (
    select booking.*, event.event_type
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    where normalized_event_type is null
      or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ),
  bookings_in_range as (
    select booking.*
    from scoped_bookings booking
    where booking.created_at >= range_start at time zone 'Asia/Manila'
      and booking.created_at < range_end at time zone 'Asia/Manila'
  ),
  scoped_financial_transactions as (
    select ledger.*
    from public.financial_transactions ledger
    left join public.bookings booking on booking.id = ledger.booking_id
    left join public.events event on event.id = coalesce(ledger.event_id, booking.event_id)
    where normalized_event_type is null
      or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
  ),
  recognized_finance_in_range as (
    select ledger.*
    from scoped_financial_transactions ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.transaction_at >= range_start at time zone 'Asia/Manila'
      and ledger.transaction_at < range_end at time zone 'Asia/Manila'
  ),
  scoped_completed_reviews as (
    select review.*
    from public.reviews review
    join public.bookings booking on booking.id = review.booking_id
    join public.events event on event.id = booking.event_id
    where booking.status = 'completed'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
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
  booking_period_totals as (
    select
      count(*) as total_booking_count,
      count(*) filter (
        where booking.created_at >= range_start at time zone 'Asia/Manila'
          and booking.created_at < range_end at time zone 'Asia/Manila'
      ) as current_booking_count,
      count(*) filter (
        where booking.created_at >= previous_start at time zone 'Asia/Manila'
          and booking.created_at < range_start at time zone 'Asia/Manila'
      ) as previous_booking_count,
      count(*) filter (
        where booking.created_at >= range_start at time zone 'Asia/Manila'
          and booking.created_at < range_end at time zone 'Asia/Manila'
          and booking.status::text not in ('rejected', 'cancelled', 'expired')
      ) as valid_current_booking_count,
      count(*) filter (
        where booking.created_at >= previous_start at time zone 'Asia/Manila'
          and booking.created_at < range_start at time zone 'Asia/Manila'
          and booking.status::text not in ('rejected', 'cancelled', 'expired')
      ) as valid_previous_booking_count
    from scoped_bookings booking
  ),
  finance_period_totals as (
    select
      coalesce(sum(ledger.commission_amount) filter (
        where ledger.transaction_at >= range_start at time zone 'Asia/Manila'
          and ledger.transaction_at < range_end at time zone 'Asia/Manila'
      ), 0) as current_platform_revenue,
      coalesce(sum(ledger.commission_amount) filter (
        where ledger.transaction_at >= previous_start at time zone 'Asia/Manila'
          and ledger.transaction_at < range_start at time zone 'Asia/Manila'
      ), 0) as previous_platform_revenue,
      coalesce(sum(ledger.commission_amount) filter (
        where ledger.transaction_at >= current_month_start at time zone 'Asia/Manila'
          and ledger.transaction_at < (current_month_start + interval '1 month') at time zone 'Asia/Manila'
      ), 0) as current_month_platform_revenue,
      coalesce(sum(ledger.commission_amount) filter (
        where ledger.transaction_at >= previous_month_start at time zone 'Asia/Manila'
          and ledger.transaction_at < current_month_start at time zone 'Asia/Manila'
      ), 0) as previous_month_platform_revenue
    from scoped_financial_transactions ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ),
  provider_period_totals as (
    select
      count(*) as total_provider_count,
      count(*) filter (
        where provider.created_at >= range_start at time zone 'Asia/Manila'
          and provider.created_at < range_end at time zone 'Asia/Manila'
      ) as current_provider_count,
      count(*) filter (
        where provider.created_at >= previous_start at time zone 'Asia/Manila'
          and provider.created_at < range_start at time zone 'Asia/Manila'
      ) as previous_provider_count
    from provider_accounts provider
  ),
  review_period_totals as (
    select
      coalesce(round(avg(review.rating)::numeric, 1), 0) as overall_average_rating,
      count(*) as review_count,
      coalesce(round(avg(review.rating) filter (
        where review.created_at >= range_start at time zone 'Asia/Manila'
          and review.created_at < range_end at time zone 'Asia/Manila'
      )::numeric, 1), 0) as current_average_rating,
      coalesce(round(avg(review.rating) filter (
        where review.created_at >= previous_start at time zone 'Asia/Manila'
          and review.created_at < range_start at time zone 'Asia/Manila'
      )::numeric, 1), 0) as previous_average_rating
    from scoped_completed_reviews review
  ),
  scoped_payments_in_range as (
    select payment.*
    from public.payments payment
    left join public.bookings booking on booking.id = payment.booking_id
    left join public.events event on event.id = booking.event_id
    where payment.created_at >= range_start at time zone 'Asia/Manila'
      and payment.created_at < range_end at time zone 'Asia/Manila'
      and (
        normalized_event_type is null
        or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type
      )
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
    from scoped_bookings booking
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
      'end', range_end at time zone 'Asia/Manila',
      'event_type', normalized_event_type
    ),
    'kpis', jsonb_build_object(
      'providers', jsonb_build_object(
        'total', (select total_provider_count from provider_period_totals),
        'active', (select count(*) from active_provider_accounts),
        'verified', (select count(*) from provider_accounts where verification_status = 'verified'),
        'pending', (select count(*) from provider_accounts where verification_status = 'pending'),
        'current', (select current_provider_count from provider_period_totals),
        'previous', (select previous_provider_count from provider_period_totals)
      ),
      'clients', jsonb_build_object(
        'total', (select count(*) from public.profiles where default_role = 'client'),
        'active', (select count(*) from public.profiles where default_role = 'client' and account_status in ('active', 'verified'))
      ),
      'bookings', jsonb_build_object(
        'total', (select total_booking_count from booking_period_totals),
        'current', (select current_booking_count from booking_period_totals),
        'previous', (select previous_booking_count from booking_period_totals)
      ),
      'valid_bookings', jsonb_build_object(
        'current', (select valid_current_booking_count from booking_period_totals),
        'previous', (select valid_previous_booking_count from booking_period_totals)
      ),
      'confirmed_bookings', jsonb_build_object(
        'current', (select count(*) from bookings_in_range where status::text in ('approved', 'confirmed', 'completed'))
      ),
      'platform_revenue', jsonb_build_object(
        'current', (select current_platform_revenue from finance_period_totals),
        'previous', (select previous_platform_revenue from finance_period_totals)
      ),
      'monthly_platform_revenue', jsonb_build_object(
        'current', (select current_month_platform_revenue from finance_period_totals),
        'previous', (select previous_month_platform_revenue from finance_period_totals)
      ),
      'average_rating', jsonb_build_object(
        'value', (select overall_average_rating from review_period_totals),
        'review_count', (select review_count from review_period_totals),
        'current', (select current_average_rating from review_period_totals),
        'previous', (select previous_average_rating from review_period_totals)
      ),
      'pending_applications', jsonb_build_object(
        'current', (
          (select count(*) from provider_accounts where verification_status = 'pending')
          + (select count(*) from public.profiles where default_role = 'event_coordinator' and account_status = 'pending')
          + (select count(*) from public.services where status = 'pending_review')
        ),
        'providers', (select count(*) from provider_accounts where verification_status = 'pending'),
        'coordinators', (select count(*) from public.profiles where default_role = 'event_coordinator' and account_status = 'pending'),
        'services', (select count(*) from public.services where status = 'pending_review')
      )
    ),
    'financial_summary', jsonb_build_object(
      'gross_booking_value', (select coalesce(sum(gross_booking_value), 0) from booking_bucket_totals),
      'recognized_platform_revenue', (select coalesce(sum(platform_revenue), 0) from finance_bucket_totals),
      'pending_collections', (
        select coalesce(sum(payment.amount), 0)
        from scoped_payments_in_range payment
        where payment.status in ('pending', 'processing')
      ),
      'pending_collection_count', (
        select count(*)
        from scoped_payments_in_range payment
        where payment.status in ('pending', 'processing')
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
      select jsonb_agg(jsonb_build_object('status', status, 'count', booking_count) order by booking_count desc, status)
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
      'pending_providers', (select count(*) from provider_accounts where verification_status = 'pending'),
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

create or replace function public.get_admin_dashboard_event_types()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(event_type order by lower(event_type), event_type)
    from (
      select distinct trim(event.event_type) as event_type
      from public.events event
      where nullif(trim(coalesce(event.event_type, '')), '') is not null
    ) event_types
  ), '[]'::jsonb);
end;
$$;

create or replace function public.search_admin_dashboard(
  p_query text,
  p_limit integer default 8
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := lower(trim(coalesce(p_query, '')));
  safe_limit integer := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if not (
    public.has_permission('providers.view')
    or public.has_permission('events.view')
    or public.has_permission('users.view')
  ) then
    raise exception 'Dashboard search access is required.' using errcode = '42501';
  end if;

  if char_length(normalized_query) < 2 then
    return jsonb_build_object('results', '[]'::jsonb);
  end if;

  return jsonb_build_object('results', coalesce((
    with search_rows as (
      select
        'provider'::text as result_type,
        provider.id,
        coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as title,
        concat_ws(' · ', 'Provider', nullif(trim(provider.location), ''), provider.verification_status::text) as subtitle,
        1 as result_order
      from public.provider_profiles provider
      join public.profiles profile on profile.id = provider.user_id
      where public.has_permission('providers.view')
        and (
          coalesce(provider.business_name, '') ilike '%' || normalized_query || '%'
          or coalesce(profile.full_name, '') ilike '%' || normalized_query || '%'
          or coalesce(provider.contact_email, profile.email, '') ilike '%' || normalized_query || '%'
        )

      union all

      select
        'category'::text,
        category.id,
        category.name,
        case when category.is_active then 'Service category · Active' else 'Service category · Inactive' end,
        2
      from public.service_categories category
      where public.has_permission('providers.view')
        and (
          coalesce(category.name, '') ilike '%' || normalized_query || '%'
          or coalesce(category.description, '') ilike '%' || normalized_query || '%'
        )

      union all

      select
        'booking'::text,
        booking.id,
        coalesce(nullif(trim(event.name), ''), 'Untitled event'),
        concat_ws(' · ', 'Booking', nullif(trim(provider.business_name), ''), nullif(trim(service.name), '')),
        3
      from public.bookings booking
      join public.events event on event.id = booking.event_id
      join public.provider_profiles provider on provider.id = booking.provider_id
      join public.services service on service.id = booking.service_id
      where public.has_permission('events.view')
        and (
          booking.id::text ilike '%' || normalized_query || '%'
          or coalesce(event.name, '') ilike '%' || normalized_query || '%'
          or coalesce(provider.business_name, '') ilike '%' || normalized_query || '%'
          or coalesce(service.name, '') ilike '%' || normalized_query || '%'
        )

      union all

      select
        'client'::text,
        client.id,
        coalesce(nullif(trim(client.full_name), ''), 'Client'),
        concat_ws(' · ', 'Client', nullif(trim(client.email), ''), client.account_status::text),
        4
      from public.profiles client
      where public.has_permission('users.view')
        and client.default_role = 'client'
        and (
          coalesce(client.full_name, '') ilike '%' || normalized_query || '%'
          or coalesce(client.email, '') ilike '%' || normalized_query || '%'
        )
    )
    select jsonb_agg(jsonb_build_object(
      'result_type', result_type,
      'id', id,
      'title', title,
      'subtitle', subtitle
    ) order by result_order, title, id)
    from (
      select *
      from search_rows
      order by result_order, title, id
      limit safe_limit
    ) limited_rows
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_admin_dashboard_analytics(text, text) from public;
revoke all on function public.get_admin_dashboard_event_types() from public;
revoke all on function public.search_admin_dashboard(text, integer) from public;
grant execute on function public.get_admin_dashboard_analytics(text, text) to authenticated;
grant execute on function public.get_admin_dashboard_event_types() to authenticated;
grant execute on function public.search_admin_dashboard(text, integer) to authenticated;

comment on function public.get_admin_dashboard_analytics(text, text) is
  'Read-only, permission-scoped V13 dashboard KPIs. Platform revenue is verified booking-payment commission only.';
comment on function public.get_admin_dashboard_event_types() is
  'Permission-scoped list of actual event types recorded by MULTIVENT events.';
comment on function public.search_admin_dashboard(text, integer) is
  'Permission-scoped global search across providers, categories, bookings, and authorized clients.';

commit;
