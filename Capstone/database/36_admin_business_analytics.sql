-- MULTIVENT Phase 7: Admin business analytics and provider statistics.
-- Apply after 35_customer_service_ticket_management.sql.

begin;

-- This RPC is intentionally read-only. It centralizes dashboard aggregation so
-- the browser does not need broad, repeated table scans or fabricated health
-- data. Existing top-level keys are retained for older dashboard builds.
create or replace function public.get_business_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  dashboard_payload jsonb;
begin
  if not public.has_permission('dashboard.analytics.view') then
    raise exception 'Analytics access is required.' using errcode = '42501';
  end if;

  with
  reporting_months as (
    select generated_month::date as month_start
    from generate_series(
      (date_trunc('month', current_date) - interval '11 months')::date,
      date_trunc('month', current_date)::date,
      interval '1 month'
    ) as month_series(generated_month)
  ),
  monthly_booking_totals as (
    select date_trunc('month', booking.created_at)::date as month_start,
      count(*) as booking_count,
      count(*) filter (where booking.status = 'completed') as completed_booking_count
    from public.bookings booking
    where booking.created_at >= date_trunc('month', current_date) - interval '11 months'
    group by date_trunc('month', booking.created_at)::date
  ),
  monthly_event_totals as (
    select date_trunc('month', event.created_at)::date as month_start,
      count(*) as event_count,
      count(*) filter (where event.status = 'completed') as completed_event_count,
      count(*) filter (where event.status = 'cancelled') as cancelled_event_count
    from public.events event
    where event.created_at >= date_trunc('month', current_date) - interval '11 months'
    group by date_trunc('month', event.created_at)::date
  ),
  monthly_finance_totals as (
    select date_trunc('month', ledger_item.transaction_at)::date as month_start,
      coalesce(sum(ledger_item.gross_amount), 0) as gross_amount,
      coalesce(sum(ledger_item.commission_amount), 0) as commission_amount
    from public.financial_transactions ledger_item
    where ledger_item.transaction_type = 'booking_payment'
      and ledger_item.status in ('paid', 'verified')
      and ledger_item.transaction_at >= date_trunc('month', current_date) - interval '11 months'
    group by date_trunc('month', ledger_item.transaction_at)::date
  ),
  monthly_business_trend as (
    select reporting_months.month_start,
      coalesce(monthly_booking_totals.booking_count, 0) as booking_count,
      coalesce(monthly_booking_totals.completed_booking_count, 0) as completed_booking_count,
      coalesce(monthly_event_totals.event_count, 0) as event_count,
      coalesce(monthly_event_totals.completed_event_count, 0) as completed_event_count,
      coalesce(monthly_event_totals.cancelled_event_count, 0) as cancelled_event_count,
      coalesce(monthly_finance_totals.gross_amount, 0) as gross_amount,
      coalesce(monthly_finance_totals.commission_amount, 0) as commission_amount
    from reporting_months
    left join monthly_booking_totals using (month_start)
    left join monthly_event_totals using (month_start)
    left join monthly_finance_totals using (month_start)
  ),
  period_comparison as (
    select
      (select count(*) from public.bookings booking
        where booking.created_at >= date_trunc('month', current_date)) as current_bookings,
      (select count(*) from public.bookings booking
        where booking.created_at >= date_trunc('month', current_date) - interval '1 month'
          and booking.created_at < date_trunc('month', current_date)) as previous_bookings,
      (select count(*) from public.provider_profiles provider
        where provider.created_at >= date_trunc('month', current_date)) as current_providers,
      (select count(*) from public.provider_profiles provider
        where provider.created_at >= date_trunc('month', current_date) - interval '1 month'
          and provider.created_at < date_trunc('month', current_date)) as previous_providers,
      (select coalesce(sum(ledger_item.commission_amount), 0)
        from public.financial_transactions ledger_item
        where ledger_item.transaction_type = 'booking_payment'
          and ledger_item.status in ('paid', 'verified')
          and ledger_item.transaction_at >= date_trunc('month', current_date)) as current_commission,
      (select coalesce(sum(ledger_item.commission_amount), 0)
        from public.financial_transactions ledger_item
        where ledger_item.transaction_type = 'booking_payment'
          and ledger_item.status in ('paid', 'verified')
          and ledger_item.transaction_at >= date_trunc('month', current_date) - interval '1 month'
          and ledger_item.transaction_at < date_trunc('month', current_date)) as previous_commission
  ),
  provider_booking_totals as (
    select booking.provider_id,
      count(*) as booking_count,
      count(*) filter (where booking.status = 'completed') as completed_booking_count,
      coalesce(sum(booking.amount) filter (
        where booking.status not in ('rejected', 'cancelled', 'expired')
      ), 0) as booked_value
    from public.bookings booking
    group by booking.provider_id
  ),
  provider_review_totals as (
    select review.provider_id,
      count(*) as review_count,
      coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.reviews review
    group by review.provider_id
  ),
  top_provider_rows as (
    select provider.id,
      provider.business_name,
      coalesce(provider_review_totals.average_rating, 0) as average_rating,
      coalesce(provider_review_totals.review_count, 0) as review_count,
      coalesce(provider_booking_totals.booking_count, 0) as booking_count,
      coalesce(provider_booking_totals.completed_booking_count, 0) as completed_booking_count,
      coalesce(provider_booking_totals.booked_value, 0) as booked_value,
      case when coalesce(provider_booking_totals.booking_count, 0) = 0 then 0
        else round(
          provider_booking_totals.completed_booking_count::numeric * 100
          / provider_booking_totals.booking_count,
          1
        )
      end as completion_rate
    from public.provider_profiles provider
    left join provider_booking_totals on provider_booking_totals.provider_id = provider.id
    left join provider_review_totals on provider_review_totals.provider_id = provider.id
    where provider.verification_status = 'verified'
    order by average_rating desc, completed_booking_count desc, booking_count desc, provider.id
    limit 8
  ),
  category_performance_rows as (
    select category.id,
      category.name,
      count(distinct service.id) filter (where service.status = 'active') as active_service_count,
      count(distinct service.provider_id) filter (where service.status = 'active') as provider_count,
      count(distinct booking.id) as booking_count,
      count(distinct booking.id) filter (where booking.status = 'completed') as completed_booking_count
    from public.service_categories category
    left join public.services service on service.category_id = category.id
    left join public.bookings booking on booking.service_id = service.id
    where category.is_active
    group by category.id, category.name
    order by booking_count desc, active_service_count desc, category.name
    limit 8
  ),
  event_type_rows as (
    select coalesce(nullif(trim(event.event_type), ''), 'Unspecified') as event_type,
      count(*) as event_count,
      count(*) filter (where event.status = 'completed') as completed_event_count,
      count(*) filter (where event.status = 'cancelled') as cancelled_event_count
    from public.events event
    group by coalesce(nullif(trim(event.event_type), ''), 'Unspecified')
    order by event_count desc, event_type
    limit 8
  ),
  recent_booking_rows as (
    select booking.id,
      booking.status::text as status,
      coalesce(booking.amount, 0) as amount,
      booking.created_at,
      coalesce(nullif(trim(event.name), ''), 'Untitled event') as event_name,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join public.provider_profiles provider on provider.id = booking.provider_id
    order by booking.created_at desc, booking.id
    limit 8
  )
  select jsonb_build_object(
    'generated_at', now(),

    -- Backward-compatible summary fields.
    'total_users', (select count(*) from public.profiles),
    'total_clients', (select count(*) from public.profiles where default_role = 'client'),
    'total_providers', (select count(*) from public.provider_profiles),
    'total_bookings', (select count(*) from public.bookings),
    'completed_events', (select count(*) from public.events where status = 'completed'),
    'upcoming_events', (select count(*) from public.events
      where status not in ('completed', 'cancelled') and event_date >= current_date),
    'cancelled_events', (select count(*) from public.events where status = 'cancelled'),
    'gross_transaction_value', (select coalesce(sum(ledger_item.gross_amount), 0)
      from public.financial_transactions ledger_item
      where ledger_item.transaction_type = 'booking_payment'
        and ledger_item.status in ('paid', 'verified')),
    'commission_revenue', (select coalesce(sum(ledger_item.commission_amount), 0)
      from public.financial_transactions ledger_item
      where ledger_item.transaction_type = 'booking_payment'
        and ledger_item.status in ('paid', 'verified')),

    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'active', (select count(*) from public.profiles where account_status in ('active', 'verified')),
      'suspended', (select count(*) from public.profiles where account_status = 'suspended'),
      'disabled', (select count(*) from public.profiles where account_status = 'disabled'),
      'clients', (select count(*) from public.profiles where default_role = 'client')
    ),
    'providers', jsonb_build_object(
      'total', (select count(*) from public.provider_profiles),
      'verified', (select count(*) from public.provider_profiles where verification_status = 'verified'),
      'pending', (select count(*) from public.provider_profiles where verification_status = 'pending'),
      'disabled', (select count(*) from public.provider_profiles where verification_status = 'disabled'),
      'activation_rate', (
        select case when count(*) = 0 then 0
          else round(count(*) filter (where verification_status = 'verified')::numeric * 100 / count(*), 1)
        end
        from public.provider_profiles
      )
    ),
    'services', jsonb_build_object(
      'total', (select count(*) from public.services),
      'active', (select count(*) from public.services where status = 'active'),
      'pending_review', (select count(*) from public.services where status = 'pending_review'),
      'rejected', (select count(*) from public.services where status = 'rejected')
    ),
    'bookings', jsonb_build_object(
      'total', (select count(*) from public.bookings),
      'completed', (select count(*) from public.bookings where status = 'completed'),
      'active', (select count(*) from public.bookings
        where status not in ('completed', 'rejected', 'cancelled', 'expired')),
      'cancelled_or_expired', (select count(*) from public.bookings
        where status in ('rejected', 'cancelled', 'expired')),
      'average_value', (select coalesce(round(avg(amount), 2), 0) from public.bookings
        where status not in ('rejected', 'cancelled', 'expired')),
      'completion_rate', (
        select case when count(*) = 0 then 0
          else round(count(*) filter (where status = 'completed')::numeric * 100 / count(*), 1)
        end
        from public.bookings
      )
    ),
    'events', jsonb_build_object(
      'total', (select count(*) from public.events),
      'completed', (select count(*) from public.events where status = 'completed'),
      'upcoming', (select count(*) from public.events
        where status not in ('completed', 'cancelled') and event_date >= current_date),
      'in_progress', (select count(*) from public.events where status = 'in_progress'),
      'cancelled', (select count(*) from public.events where status = 'cancelled'),
      'completion_rate', (
        select case when count(*) filter (where status in ('completed', 'cancelled')) = 0 then 0
          else round(
            count(*) filter (where status = 'completed')::numeric * 100
            / count(*) filter (where status in ('completed', 'cancelled')),
            1
          )
        end
        from public.events
      )
    ),
    'finance', jsonb_build_object(
      'gross_transaction_value', (select coalesce(sum(ledger_item.gross_amount), 0)
        from public.financial_transactions ledger_item
        where ledger_item.transaction_type = 'booking_payment'
          and ledger_item.status in ('paid', 'verified')),
      'commission_revenue', (select coalesce(sum(ledger_item.commission_amount), 0)
        from public.financial_transactions ledger_item
        where ledger_item.transaction_type = 'booking_payment'
          and ledger_item.status in ('paid', 'verified')),
      'provider_net_value', (select coalesce(sum(ledger_item.provider_net_amount), 0)
        from public.financial_transactions ledger_item
        where ledger_item.transaction_type = 'booking_payment'
          and ledger_item.status in ('paid', 'verified'))
    ),
    'action_counts', jsonb_build_object(
      'pending_providers', (select count(*) from public.provider_profiles where verification_status = 'pending'),
      'pending_services', (select count(*) from public.services where status = 'pending_review'),
      'pending_payments', (select count(*) from public.payments where status in ('pending', 'processing')),
      'negative_reviews', (select count(*) from public.reviews where sentiment_label = 'negative'),
      'active_support_tickets', (select count(*) from public.support_tickets
        where status in ('open', 'in_progress', 'waiting_for_user')),
      'urgent_support_tickets', (select count(*) from public.support_tickets
        where status in ('open', 'in_progress', 'waiting_for_user') and priority = 'urgent'),
      'unassigned_events', (select count(*) from public.events
        where coordinator_assignment_status = 'awaiting_assignment'
          and status not in ('completed', 'cancelled'))
    ),
    'comparisons', (
      select jsonb_build_object(
        'bookings', jsonb_build_object(
          'current', period_comparison.current_bookings,
          'previous', period_comparison.previous_bookings,
          'percent_change', case when period_comparison.previous_bookings = 0 then null
            else round(
              (period_comparison.current_bookings - period_comparison.previous_bookings)::numeric
              * 100 / period_comparison.previous_bookings,
              1
            )
          end
        ),
        'providers', jsonb_build_object(
          'current', period_comparison.current_providers,
          'previous', period_comparison.previous_providers,
          'percent_change', case when period_comparison.previous_providers = 0 then null
            else round(
              (period_comparison.current_providers - period_comparison.previous_providers)::numeric
              * 100 / period_comparison.previous_providers,
              1
            )
          end
        ),
        'commission', jsonb_build_object(
          'current', period_comparison.current_commission,
          'previous', period_comparison.previous_commission,
          'percent_change', case when period_comparison.previous_commission = 0 then null
            else round(
              (period_comparison.current_commission - period_comparison.previous_commission)
              * 100 / period_comparison.previous_commission,
              1
            )
          end
        )
      )
      from period_comparison
    ),
    'booking_statuses', coalesce((
      select jsonb_agg(
        jsonb_build_object('status', status_row.booking_status, 'count', status_row.status_count)
        order by status_row.status_count desc, status_row.booking_status
      )
      from (
        select booking.status::text as booking_status, count(*) as status_count
        from public.bookings booking
        group by booking.status
      ) status_row
    ), '[]'::jsonb),
    'monthly_bookings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(monthly_business_trend.month_start, 'YYYY-MM'),
          'count', monthly_business_trend.booking_count
        )
        order by monthly_business_trend.month_start
      )
      from monthly_business_trend
    ), '[]'::jsonb),
    'monthly_trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(monthly_business_trend.month_start, 'YYYY-MM'),
          'bookings', monthly_business_trend.booking_count,
          'completed_bookings', monthly_business_trend.completed_booking_count,
          'events', monthly_business_trend.event_count,
          'completed_events', monthly_business_trend.completed_event_count,
          'cancelled_events', monthly_business_trend.cancelled_event_count,
          'gross', monthly_business_trend.gross_amount,
          'commission', monthly_business_trend.commission_amount
        )
        order by monthly_business_trend.month_start
      )
      from monthly_business_trend
    ), '[]'::jsonb),
    'top_providers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', top_provider_rows.id,
          'name', top_provider_rows.business_name,
          'rating', top_provider_rows.average_rating,
          'reviews', top_provider_rows.review_count,
          'bookings', top_provider_rows.booking_count,
          'completed_bookings', top_provider_rows.completed_booking_count,
          'booked_value', top_provider_rows.booked_value,
          'completion_rate', top_provider_rows.completion_rate
        )
        order by top_provider_rows.average_rating desc,
          top_provider_rows.completed_booking_count desc,
          top_provider_rows.booking_count desc,
          top_provider_rows.id
      )
      from top_provider_rows
    ), '[]'::jsonb),
    'popular_categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category_performance_rows.id,
          'name', category_performance_rows.name,
          'active_services', category_performance_rows.active_service_count,
          'providers', category_performance_rows.provider_count,
          'bookings', category_performance_rows.booking_count,
          'completed_bookings', category_performance_rows.completed_booking_count
        )
        order by category_performance_rows.booking_count desc,
          category_performance_rows.active_service_count desc,
          category_performance_rows.name
      )
      from category_performance_rows
    ), '[]'::jsonb),
    'event_types', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', event_type_rows.event_type,
          'events', event_type_rows.event_count,
          'completed', event_type_rows.completed_event_count,
          'cancelled', event_type_rows.cancelled_event_count
        )
        order by event_type_rows.event_count desc, event_type_rows.event_type
      )
      from event_type_rows
    ), '[]'::jsonb),
    'recent_bookings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_booking_rows.id,
          'status', recent_booking_rows.status,
          'amount', recent_booking_rows.amount,
          'created_at', recent_booking_rows.created_at,
          'event_name', recent_booking_rows.event_name,
          'provider_name', recent_booking_rows.provider_name
        )
        order by recent_booking_rows.created_at desc, recent_booking_rows.id
      )
      from recent_booking_rows
    ), '[]'::jsonb)
  ) into dashboard_payload;

  return dashboard_payload;
end;
$$;

revoke all on function public.get_business_dashboard() from public;
grant execute on function public.get_business_dashboard() to authenticated;

comment on function public.get_business_dashboard() is
  'Read-only Admin dashboard analytics, trends, provider performance, and operational aggregate counts.';

commit;
