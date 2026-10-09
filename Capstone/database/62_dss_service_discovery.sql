-- MULTIVENT DSS service discovery: zero-based budgets and public decision signals.
-- Apply after 61_coordinator_request_financial_visibility.sql.

begin;

-- A budget is optional. New events therefore start at zero until the client
-- chooses to enter a total and category allocations. Existing historical NULL
-- values retain their meaning and are already read as zero by the application.
alter table public.events
  alter column total_budget set default 0;

-- Expose only aggregate marketplace signals. No client, event, booking, or
-- review identity is returned. "Most booked" is calculated inside each
-- service category from genuinely paid/confirmed/completed booking records.
create or replace function public.list_public_service_decision_signals()
returns table (
  service_id uuid,
  average_rating numeric,
  review_count bigint,
  booking_count bigint,
  category_rank bigint,
  is_most_booked boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with review_rollup as (
    select review.service_id,
      round(avg(review.rating)::numeric, 2) as average_rating,
      count(*)::bigint as review_count
    from public.reviews review
    group by review.service_id
  ), booking_rollup as (
    select booking.service_id,
      count(distinct booking.id)::bigint as booking_count
    from public.bookings booking
    where booking.status::text in ('paid', 'confirmed', 'completed')
    group by booking.service_id
  ), eligible as (
    select service.id as service_id, service.category_id,
      coalesce(review.average_rating, 0)::numeric as average_rating,
      coalesce(review.review_count, 0)::bigint as review_count,
      coalesce(booking.booking_count, 0)::bigint as booking_count
    from public.services service
    join public.service_categories category
      on category.id = service.category_id and category.is_active = true
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
      and owner.account_status in ('active', 'verified')
    left join review_rollup review on review.service_id = service.id
    left join booking_rollup booking on booking.service_id = service.id
    where service.status = 'active' and service.is_available = true
  ), ranked as (
    select eligible.*,
      dense_rank() over (
        partition by eligible.category_id
        order by eligible.booking_count desc, eligible.average_rating desc,
          eligible.review_count desc, eligible.service_id
      )::bigint as category_rank
    from eligible
  )
  select ranked.service_id, ranked.average_rating, ranked.review_count,
    ranked.booking_count, ranked.category_rank,
    ranked.booking_count > 0 and ranked.category_rank = 1 as is_most_booked
  from ranked
  where auth.uid() is not null
  order by ranked.category_id, ranked.category_rank, ranked.service_id;
$$;

revoke all on function public.list_public_service_decision_signals() from public;
grant execute on function public.list_public_service_decision_signals() to authenticated;

comment on function public.list_public_service_decision_signals() is
  'Authenticated aggregate ratings and completed-booking popularity used for explainable client DSS ordering and badges.';

commit;
