-- Correct the provider-performance branch introduced with the Phase 5 report RPC.
-- The original function is retained privately for its already-validated report types.

begin;

alter function public.get_admin_report(text, timestamptz, timestamptz)
  rename to get_admin_report_legacy;

create or replace function public.get_admin_report(
  report_kind text,
  range_start timestamptz default null,
  range_end timestamptz default null
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
  if normalized_kind <> 'provider_performance' then
    return public.get_admin_report_legacy(normalized_kind, range_start, range_end);
  end if;

  if not public.has_permission('providers.view') then
    raise exception 'Provider access is required for this report.' using errcode = '42501';
  end if;
  if range_start is not null and range_end is not null and range_end < range_start then
    raise exception 'The end date must not be earlier than the start date.';
  end if;

  with filtered as (
    select booking.status,
      booking.provider_amount,
      booking.amount,
      provider.id as report_provider_id,
      provider.business_name
    from public.bookings booking
    join public.provider_profiles provider on provider.id = booking.provider_id
    where (range_start is null or booking.created_at >= range_start)
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
    'description', 'Provider booking performance is filtered by booking request date.',
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
    ), '[]'::jsonb),
    'generated_at', now(),
    'report_kind', normalized_kind
  ) into report;

  return report;
end;
$$;

revoke all on function public.get_admin_report_legacy(text, timestamptz, timestamptz) from public, authenticated;
revoke all on function public.get_admin_report(text, timestamptz, timestamptz) from public;
grant execute on function public.get_admin_report(text, timestamptz, timestamptz) to authenticated;

comment on function public.get_admin_report(text, timestamptz, timestamptz) is
  'Permission-scoped, read-only web-admin reports. Provider performance uses a dedicated ambiguity-free query.';

commit;
