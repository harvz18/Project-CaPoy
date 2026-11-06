-- Read-only category filtering for the existing staff reports. This is an
-- additive RPC: the established three-argument get_admin_report function and
-- its callers remain unchanged.

begin;

create or replace function public.get_admin_report_with_category(
  report_kind text,
  range_start timestamptz,
  range_end timestamptz,
  category_filter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_kind text := lower(trim(coalesce(report_kind, '')));
  report jsonb;
begin
  if category_filter_id is null then
    return public.get_admin_report(normalized_kind, range_start, range_end);
  end if;

  if normalized_kind not in ('bookings', 'provider_performance', 'popular_categories') then
    raise exception 'Category filtering is not available for this report type.' using errcode = '22023';
  end if;

  if range_start is not null and range_end is not null and range_end < range_start then
    raise exception 'The end date must not be earlier than the start date.' using errcode = '22007';
  end if;

  if normalized_kind in ('bookings', 'popular_categories') and not public.has_permission('events.view') then
    raise exception 'Event access is required for this report.' using errcode = '42501';
  end if;
  if normalized_kind = 'provider_performance' and not public.has_permission('providers.view') then
    raise exception 'Provider access is required for this report.' using errcode = '42501';
  end if;

  if normalized_kind = 'bookings' then
    with filtered as (
      select booking.*, service.name as service_name, provider.business_name as provider_name,
        category.name as category_name
      from public.bookings booking
      join public.services service on service.id = booking.service_id
      left join public.service_categories category on category.id = service.category_id
      left join public.provider_profiles provider on provider.id = booking.provider_id
      where service.category_id = category_filter_id
        and (range_start is null or booking.created_at >= range_start)
        and (range_end is null or booking.created_at <= range_end)
    )
    select jsonb_build_object(
      'title', 'Booking report',
      'description', 'Bookings are filtered by their request date and selected service category.',
      'columns', jsonb_build_array('Booking', 'Requested', 'Event date', 'Category', 'Service', 'Provider', 'Service amount', 'Client total', 'Status'),
      'summary', jsonb_build_object(
        'bookings', (select count(*) from filtered),
        'confirmed', (select count(*) from filtered where status in ('confirmed', 'completed')),
        'service_value', coalesce((select sum(provider_amount) from filtered), 0),
        'client_total', coalesce((select sum(amount) from filtered), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'booking', 'MV-' || upper(substr(id::text, 1, 8)),
          'requested', created_at,
          'event_date', requested_date,
          'category', coalesce(nullif(trim(category_name), ''), 'Uncategorized'),
          'service', coalesce(nullif(trim(service_name), ''), 'Service'),
          'provider', coalesce(nullif(trim(provider_name), ''), 'Service provider'),
          'service_amount', coalesce(provider_amount, amount, 0),
          'client_total', coalesce(amount, 0),
          'status', status
        ) order by created_at desc, id)
        from filtered
      ), '[]'::jsonb)
    ) into report;

  elsif normalized_kind = 'provider_performance' then
    with filtered as (
      select booking.status, booking.provider_amount, booking.amount,
        provider.id as report_provider_id, provider.business_name
      from public.bookings booking
      join public.services service on service.id = booking.service_id
      join public.provider_profiles provider on provider.id = booking.provider_id
      where service.category_id = category_filter_id
        and (range_start is null or booking.created_at >= range_start)
        and (range_end is null or booking.created_at <= range_end)
    ), ranked as (
      select report_provider_id,
        coalesce(nullif(trim(business_name), ''), 'Service provider') as provider,
        count(*)::int as bookings,
        count(*) filter (where status in ('confirmed', 'completed'))::int as confirmed,
        coalesce(sum(provider_amount), 0)::numeric as service_value,
        coalesce(sum(amount), 0)::numeric as client_total,
        coalesce(avg(provider_amount), 0)::numeric as average_service_value
      from filtered
      group by report_provider_id, business_name
    )
    select jsonb_build_object(
      'title', 'Provider performance report',
      'description', 'Provider performance is filtered by booking request date and selected service category.',
      'columns', jsonb_build_array('Provider', 'Bookings', 'Confirmed', 'Service value', 'Client total', 'Average service value'),
      'summary', jsonb_build_object(
        'providers', (select count(*) from ranked),
        'bookings', coalesce((select sum(bookings) from ranked), 0),
        'confirmed', coalesce((select sum(confirmed) from ranked), 0),
        'service_value', coalesce((select sum(service_value) from ranked), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'provider', provider,
          'bookings', bookings,
          'confirmed', confirmed,
          'service_value', service_value,
          'client_total', client_total,
          'average_service_value', average_service_value
        ) order by confirmed desc, bookings desc, provider)
        from ranked
      ), '[]'::jsonb)
    ) into report;

  else
    with filtered as (
      select booking.id, booking.provider_amount, booking.amount, category.name as category_name
      from public.bookings booking
      join public.services service on service.id = booking.service_id
      left join public.service_categories category on category.id = service.category_id
      where service.category_id = category_filter_id
        and (range_start is null or booking.created_at >= range_start)
        and (range_end is null or booking.created_at <= range_end)
    ), ranked as (
      select coalesce(nullif(trim(category_name), ''), 'Uncategorized') as category,
        count(*)::int as bookings,
        coalesce(sum(provider_amount), 0)::numeric as service_value,
        coalesce(sum(amount), 0)::numeric as client_total
      from filtered
      group by category_name
    )
    select jsonb_build_object(
      'title', 'Popular categories report',
      'description', 'Category demand is filtered by booking request date and selected category.',
      'columns', jsonb_build_array('Category', 'Bookings', 'Service value', 'Client total'),
      'summary', jsonb_build_object(
        'categories', (select count(*) from ranked),
        'bookings', coalesce((select sum(bookings) from ranked), 0),
        'service_value', coalesce((select sum(service_value) from ranked), 0),
        'client_total', coalesce((select sum(client_total) from ranked), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'category', category,
          'bookings', bookings,
          'service_value', service_value,
          'client_total', client_total
        ) order by bookings desc, service_value desc, category)
        from ranked
      ), '[]'::jsonb)
    ) into report;
  end if;

  return coalesce(report, '{}'::jsonb) || jsonb_build_object(
    'generated_at', now(),
    'report_kind', normalized_kind,
    'category_filter_id', category_filter_id
  );
end;
$$;

revoke all on function public.get_admin_report_with_category(text, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_admin_report_with_category(text, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.get_admin_report_with_category(text, timestamptz, timestamptz, uuid) is
  'Permission-scoped, read-only category-filtered variants of booking, provider-performance, and category reports.';

commit;
