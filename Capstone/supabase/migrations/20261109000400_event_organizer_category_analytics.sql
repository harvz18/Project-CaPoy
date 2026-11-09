-- Give the Event Organizer category a coordinator-aware read model.
-- Coordinator profiles are not marketplace provider services, so this preserves
-- the existing service analytics while exposing live coordinator availability.

begin;

create or replace function public.get_admin_event_organizer_category_performance(
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

  range_end := date_trunc('day', now() at time zone 'Asia/Manila') + interval '1 day';
  case range_key
    when 'day' then range_start := range_end - interval '1 day'; range_label := '1 day';
    when '3days' then range_start := range_end - interval '3 days'; range_label := '3 days';
    when 'week' then range_start := range_end - interval '7 days'; range_label := '1 week';
    when 'month' then range_start := range_end - interval '30 days'; range_label := '1 month';
    else raise exception 'Unsupported dashboard date range.' using errcode = '22023';
  end case;

  with organizer_category as (
    select category.id, category.name, category.description, category.icon_name, category.is_active
    from public.service_categories category
    where lower(trim(category.name)) = 'event organizer'
    limit 1
  ), coordinator_profiles as (
    select profile.id, coalesce(nullif(trim(profile.full_name), ''), 'Event coordinator') as full_name,
      coordinator.coordination_fee, coordinator.is_accepting_bookings
    from public.profiles profile
    join public.coordinator_service_profiles coordinator on coordinator.coordinator_id = profile.id
    where profile.default_role = 'event_coordinator'
      and profile.account_status in ('active', 'verified')
  ), scoped_assignments as (
    select event.id, event.coordinator_id, event.status::text as status
    from public.events event
    join coordinator_profiles coordinator on coordinator.id = event.coordinator_id
    where event.coordinator_assignment_status = 'accepted'
      and event.created_at >= range_start at time zone 'Asia/Manila'
      and event.created_at < range_end at time zone 'Asia/Manila'
      and (normalized_event_type is null or lower(trim(coalesce(event.event_type, ''))) = normalized_event_type)
  ), assignment_metrics as (
    select coordinator_id,
      count(*) filter (where status <> 'cancelled') as valid_booking_count,
      count(*) filter (where status = 'completed') as completed_booking_count
    from scoped_assignments
    group by coordinator_id
  ), coordinator_review_metrics as (
    select review.coordinator_id, count(*) as review_count, coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating
    from public.coordinator_reviews review
    join scoped_assignments assignment on assignment.id = review.event_id and assignment.coordinator_id = review.coordinator_id and assignment.status = 'completed'
    group by review.coordinator_id
  ), coordinator_rows as (
    select coordinator.id, coordinator.full_name, coordinator.coordination_fee, coordinator.is_accepting_bookings,
      coalesce(assignments.valid_booking_count, 0) as valid_booking_count,
      coalesce(assignments.completed_booking_count, 0) as completed_booking_count,
      coalesce(reviews.average_rating, 0) as average_rating,
      coalesce(reviews.review_count, 0) as review_count
    from coordinator_profiles coordinator
    left join assignment_metrics assignments on assignments.coordinator_id = coordinator.id
    left join coordinator_review_metrics reviews on reviews.coordinator_id = coordinator.id
  )
  select jsonb_build_object(
    'range', jsonb_build_object('key', range_key, 'label', range_label, 'event_type', normalized_event_type),
    'category', (
      select jsonb_build_object(
        'id', category.id, 'name', category.name, 'description', category.description, 'icon_name', category.icon_name,
        'is_active', category.is_active, 'is_coordinator_category', true,
        'services', (select count(*) from coordinator_rows),
        'active_services', (select count(*) from coordinator_rows where is_accepting_bookings),
        'providers', (select count(*) from coordinator_rows where is_accepting_bookings),
        'valid_bookings', coalesce((select sum(valid_booking_count) from coordinator_rows), 0),
        'completed_bookings', coalesce((select sum(completed_booking_count) from coordinator_rows), 0),
        'platform_revenue', 0,
        'average_rating', coalesce((select round(avg(average_rating) filter (where review_count > 0), 1) from coordinator_rows), 0),
        'review_count', coalesce((select sum(review_count) from coordinator_rows), 0)
      ) from organizer_category category
    ),
    'booking_activity', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'count', booking_count) order by booking_count desc, status) from (select status, count(*) as booking_count from scoped_assignments group by status) activity), '[]'::jsonb),
    'providers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', coordinator.id, 'business_name', coordinator.full_name, 'verification_status', case when coordinator.is_accepting_bookings then 'accepting bookings' else 'not accepting bookings' end,
      'services', 1, 'active_services', case when coordinator.is_accepting_bookings then 1 else 0 end,
      'valid_bookings', coordinator.valid_booking_count, 'completed_bookings', coordinator.completed_booking_count,
      'platform_revenue', 0, 'average_rating', coordinator.average_rating, 'review_count', coordinator.review_count, 'is_coordinator', true
    ) order by coordinator.valid_booking_count desc, coordinator.completed_booking_count desc, coordinator.full_name, coordinator.id) from coordinator_rows coordinator), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
      'id', 'coordinator:' || coordinator.id::text, 'name', 'Event coordination', 'status', case when coordinator.is_accepting_bookings then 'active' else 'inactive' end,
      'base_price', coordinator.coordination_fee, 'provider_id', coordinator.id, 'provider_name', coordinator.full_name,
      'valid_bookings', coordinator.valid_booking_count, 'completed_bookings', coordinator.completed_booking_count,
      'platform_revenue', 0, 'average_rating', coordinator.average_rating, 'review_count', coordinator.review_count, 'is_coordinator', true
    ) order by coordinator.valid_booking_count desc, coordinator.completed_booking_count desc, coordinator.full_name, coordinator.id) from coordinator_rows coordinator), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_event_organizer_category_performance(text, text) from public, anon;
grant execute on function public.get_admin_event_organizer_category_performance(text, text) to authenticated;

commit;
