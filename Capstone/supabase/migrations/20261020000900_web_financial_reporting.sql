-- Phase 5: read-only financial overview and operational reports for the web admin workspace.
-- These functions deliberately keep platform-held money, provider-direct money, and
-- platform fee revenue separate. They do not create, update, or release any funds.

begin;

create or replace function public.get_admin_financial_overview(
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
  overview jsonb;
begin
  if not public.has_permission('cashflow.view') then
    raise exception 'Cash-flow access is required.' using errcode = '42501';
  end if;

  if range_start is not null and range_end is not null and range_end < range_start then
    raise exception 'The end date must not be earlier than the start date.';
  end if;

  with
  filtered_ledger as (
    select ledger.*
    from public.financial_transactions ledger
    where (range_start is null or ledger.transaction_at >= range_start)
      and (range_end is null or ledger.transaction_at <= range_end)
  ),
  recognized_platform_payments as (
    select ledger.*
    from filtered_ledger ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ),
  filtered_payouts as (
    select payout.*
    from public.provider_payout_requests payout
    where (range_start is null or payout.requested_at >= range_start)
      and (range_end is null or payout.requested_at <= range_end)
  ),
  direct_receipts as (
    select receipt.booking_id, sum(receipt.amount)::numeric as amount
    from public.provider_payment_receipts receipt
    group by receipt.booking_id
    union all
    select confirmation.booking_id, sum(confirmation.amount)::numeric as amount
    from public.provider_external_payment_confirmations confirmation
    where confirmation.confirmation_status = 'provider_confirmed_unverified'
    group by confirmation.booking_id
  ),
  direct_receipt_totals as (
    select booking_id, sum(amount)::numeric as amount
    from direct_receipts
    group by booking_id
  ),
  filtered_initial_provider_payments as (
    select payment.booking_id,
      max(coalesce(payment.provider_initial_allocation, 0))::numeric as provider_initial_allocation
    from public.payments payment
    where payment.payment_scope = 'provider_service'
      and payment.status in ('paid', 'verified')
      and (range_start is null or coalesce(payment.paid_at, payment.verified_at, payment.created_at) >= range_start)
      and (range_end is null or coalesce(payment.paid_at, payment.verified_at, payment.created_at) <= range_end)
    group by payment.booking_id
  ),
  direct_balance_rows as (
    select booking.id,
      greatest(
        coalesce(booking.provider_amount, booking.amount, 0)
          - initial_payment.provider_initial_allocation
          - coalesce(receipt.amount, 0),
        0
      )::numeric as remaining_direct_balance
    from filtered_initial_provider_payments initial_payment
    join public.bookings booking on booking.id = initial_payment.booking_id
    left join direct_receipt_totals receipt on receipt.booking_id = booking.id
    where booking.status not in ('rejected', 'cancelled', 'expired')
  ),
  latest_payment_rows as (
    select ledger.id,
      ledger.transaction_at,
      ledger.payment_method,
      ledger.amount_received,
      ledger.commission_amount,
      ledger.provider_net_amount,
      ledger.held_provider_amount,
      ledger.amount_released,
      ledger.status,
      ledger.provider_funds_status,
      coalesce(nullif(trim(payment.provider_reference), ''), upper(substr(ledger.id::text, 1, 8))) as reference,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name
    from recognized_platform_payments ledger
    left join public.payments payment on payment.id = ledger.payment_id
    left join public.provider_profiles provider on provider.id = ledger.provider_id
    order by ledger.transaction_at desc, ledger.id
    limit 12
  ),
  latest_payout_rows as (
    select payout.id,
      payout.amount,
      payout.status,
      payout.requested_at,
      payout.processed_at,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name
    from filtered_payouts payout
    join public.provider_profiles provider on provider.id = payout.provider_id
    order by payout.requested_at desc, payout.id
    limit 12
  )
  select jsonb_build_object(
    'generated_at', now(),
    'payment_model', jsonb_build_object(
      'initial_payment_rate', 0.35,
      'provider_initial_rate', 0.30,
      'platform_fee_rate', 0.05,
      'remaining_payment_rate', 0.70,
      'remaining_payment_custody', 'direct_to_provider'
    ),
    'summary', jsonb_build_object(
      'recorded_client_payments', coalesce((select sum(amount_received) from recognized_platform_payments), 0),
      'recognized_platform_fees', coalesce((select sum(commission_amount) from recognized_platform_payments), 0),
      'provider_allocations_accepted', coalesce((select sum(provider_net_amount) from recognized_platform_payments), 0),
      'provider_funds_held', coalesce((select sum(held_provider_amount) from recognized_platform_payments), 0),
      'provider_allocations_released', coalesce((select sum(amount_released) from recognized_platform_payments), 0),
      'recorded_direct_provider_payments', coalesce((
        select sum(ledger.gross_amount)
        from filtered_ledger ledger
        where ledger.transaction_type = 'provider_external_confirmation'
          and ledger.status = 'provider_confirmed_unverified'
      ), 0),
      'tracked_direct_balance_due', coalesce((select sum(remaining_direct_balance) from direct_balance_rows), 0),
      'tracked_direct_balance_count', (select count(*) from direct_balance_rows where remaining_direct_balance > 0),
      'pending_payout_requests', coalesce((
        select sum(amount) from filtered_payouts where status in ('requested', 'processing')
      ), 0),
      'paid_payout_requests', coalesce((
        select sum(amount) from filtered_payouts where status = 'paid'
      ), 0),
      'recognized_payment_count', (select count(*) from recognized_platform_payments)
    ),
    'payment_statuses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', status_rows.status,
        'count', status_rows.count,
        'amount', status_rows.amount
      ) order by status_rows.count desc, status_rows.status)
      from (
        select ledger.status::text as status,
          count(*)::int as count,
          coalesce(sum(ledger.amount_received), 0)::numeric as amount
        from filtered_ledger ledger
        where ledger.transaction_type = 'booking_payment'
        group by ledger.status
      ) status_rows
    ), '[]'::jsonb),
    'latest_payments', coalesce((
      select jsonb_agg(to_jsonb(latest_payment_rows) order by latest_payment_rows.transaction_at desc, latest_payment_rows.id)
      from latest_payment_rows
    ), '[]'::jsonb),
    'payout_requests', coalesce((
      select jsonb_agg(to_jsonb(latest_payout_rows) order by latest_payout_rows.requested_at desc, latest_payout_rows.id)
      from latest_payout_rows
    ), '[]'::jsonb)
  ) into overview;

  return overview;
end;
$$;

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
  if normalized_kind not in (
    'bookings', 'provider_performance', 'popular_categories',
    'revenue', 'client_activity', 'coordinator_activity'
  ) then
    raise exception 'Unsupported report type.';
  end if;

  if range_start is not null and range_end is not null and range_end < range_start then
    raise exception 'The end date must not be earlier than the start date.';
  end if;

  if normalized_kind in ('bookings', 'popular_categories') and not public.has_permission('events.view') then
    raise exception 'Event access is required for this report.' using errcode = '42501';
  end if;
  if normalized_kind = 'provider_performance' and not public.has_permission('providers.view') then
    raise exception 'Provider access is required for this report.' using errcode = '42501';
  end if;
  if normalized_kind = 'revenue'
    and not (public.has_permission('revenue.view') or public.has_permission('cashflow.view')) then
    raise exception 'Revenue access is required for this report.' using errcode = '42501';
  end if;
  if normalized_kind = 'client_activity'
    and not (public.has_permission('users.view') and public.has_permission('events.view')) then
    raise exception 'Client and event access are required for this report.' using errcode = '42501';
  end if;
  if normalized_kind = 'coordinator_activity' and not public.has_permission('coordinators.view') then
    raise exception 'Coordinator access is required for this report.' using errcode = '42501';
  end if;

  if normalized_kind = 'bookings' then
    with filtered as (
      select booking.*, service.name as service_name, provider.business_name as provider_name
      from public.bookings booking
      left join public.services service on service.id = booking.service_id
      left join public.provider_profiles provider on provider.id = booking.provider_id
      where (range_start is null or booking.created_at >= range_start)
        and (range_end is null or booking.created_at <= range_end)
    )
    select jsonb_build_object(
      'title', 'Booking report',
      'description', 'Bookings are filtered by their request date.',
      'columns', jsonb_build_array('Booking', 'Requested', 'Event date', 'Service', 'Provider', 'Service amount', 'Client total', 'Status'),
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
      select booking.*, provider.id as report_provider_id, provider.business_name
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
      ), '[]'::jsonb)
    ) into report;

  elsif normalized_kind = 'popular_categories' then
    with filtered as (
      select booking.id, booking.provider_amount, booking.amount, category.name as category_name
      from public.bookings booking
      left join public.services service on service.id = booking.service_id
      left join public.service_categories category on category.id = service.category_id
      where (range_start is null or booking.created_at >= range_start)
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
      'description', 'Categories are ranked by booking requests within the selected period.',
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

  elsif normalized_kind = 'revenue' then
    with filtered as (
      select ledger.*, provider.business_name
      from public.financial_transactions ledger
      left join public.provider_profiles provider on provider.id = ledger.provider_id
      where ledger.transaction_type = 'booking_payment'
        and ledger.status in ('paid', 'verified')
        and (range_start is null or ledger.transaction_at >= range_start)
        and (range_end is null or ledger.transaction_at <= range_end)
    )
    select jsonb_build_object(
      'title', 'Revenue report',
      'description', 'Platform revenue is the recorded MULTIVENT fee only; direct provider payments are excluded.',
      'columns', jsonb_build_array('Recorded', 'Provider', 'Method', 'Client payment', 'Platform fee', 'Provider held', 'Provider released', 'Status'),
      'summary', jsonb_build_object(
        'payments', (select count(*) from filtered),
        'recorded_client_payments', coalesce((select sum(amount_received) from filtered), 0),
        'recognized_platform_fees', coalesce((select sum(commission_amount) from filtered), 0),
        'provider_funds_held', coalesce((select sum(held_provider_amount) from filtered), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'recorded', transaction_at,
          'provider', coalesce(nullif(trim(business_name), ''), 'Service provider'),
          'method', coalesce(nullif(trim(payment_method), ''), 'Unspecified'),
          'client_payment', amount_received,
          'platform_fee', commission_amount,
          'provider_held', held_provider_amount,
          'provider_released', amount_released,
          'status', status
        ) order by transaction_at desc, id)
        from filtered
      ), '[]'::jsonb)
    ) into report;

  elsif normalized_kind = 'client_activity' then
    with filtered_events as (
      select event.*
      from public.events event
      where (range_start is null or event.created_at >= range_start)
        and (range_end is null or event.created_at <= range_end)
    ), ranked as (
      select client.id as client_id,
        coalesce(nullif(trim(client.full_name), ''), 'Client') as client,
        count(distinct event.id)::int as events,
        count(distinct booking.id)::int as bookings,
        count(distinct event.id) filter (where event.status = 'completed')::int as completed_events,
        coalesce(sum(booking.amount), 0)::numeric as booked_value
      from filtered_events event
      join public.profiles client on client.id = event.client_id
      left join public.bookings booking on booking.event_id = event.id
      group by client.id, client.full_name
    )
    select jsonb_build_object(
      'title', 'Client activity report',
      'description', 'Client activity is based on events created within the selected period.',
      'columns', jsonb_build_array('Client', 'Events', 'Bookings', 'Completed events', 'Booked value'),
      'summary', jsonb_build_object(
        'active_clients', (select count(*) from ranked),
        'events', coalesce((select sum(events) from ranked), 0),
        'bookings', coalesce((select sum(bookings) from ranked), 0),
        'booked_value', coalesce((select sum(booked_value) from ranked), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'client', client,
          'events', events,
          'bookings', bookings,
          'completed_events', completed_events,
          'booked_value', booked_value
        ) order by events desc, bookings desc, client)
        from ranked
      ), '[]'::jsonb)
    ) into report;

  else
    with filtered_events as (
      select event.*
      from public.events event
      where event.coordinator_id is not null
        and event.coordinator_assignment_status = 'accepted'
        and (range_start is null or event.created_at >= range_start)
        and (range_end is null or event.created_at <= range_end)
    ), ranked as (
      select coordinator.id as coordinator_id,
        coalesce(nullif(trim(coordinator.full_name), ''), 'Event coordinator') as coordinator,
        count(*)::int as accepted_events,
        count(*) filter (where event.status = 'completed')::int as completed_events,
        count(*) filter (where event.status not in ('completed', 'cancelled') and event.event_date >= current_date)::int as upcoming_events
      from filtered_events event
      join public.profiles coordinator on coordinator.id = event.coordinator_id
      group by coordinator.id, coordinator.full_name
    )
    select jsonb_build_object(
      'title', 'Coordinator activity report',
      'description', 'Accepted coordinator assignments are filtered by the event creation date.',
      'columns', jsonb_build_array('Coordinator', 'Accepted events', 'Completed events', 'Upcoming events'),
      'summary', jsonb_build_object(
        'coordinators', (select count(*) from ranked),
        'accepted_events', coalesce((select sum(accepted_events) from ranked), 0),
        'completed_events', coalesce((select sum(completed_events) from ranked), 0),
        'upcoming_events', coalesce((select sum(upcoming_events) from ranked), 0)
      ),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'coordinator', coordinator,
          'accepted_events', accepted_events,
          'completed_events', completed_events,
          'upcoming_events', upcoming_events
        ) order by accepted_events desc, completed_events desc, coordinator)
        from ranked
      ), '[]'::jsonb)
    ) into report;
  end if;

  return coalesce(report, '{}'::jsonb) || jsonb_build_object(
    'generated_at', now(),
    'report_kind', normalized_kind
  );
end;
$$;

revoke all on function public.get_admin_financial_overview(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_report(text, timestamptz, timestamptz) from public;
grant execute on function public.get_admin_financial_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_admin_report(text, timestamptz, timestamptz) to authenticated;

comment on function public.get_admin_financial_overview(timestamptz, timestamptz) is
  'Read-only cash-flow summary. Keeps recorded platform fees, held provider funds, payout requests, and provider-direct balances separate.';
comment on function public.get_admin_report(text, timestamptz, timestamptz) is
  'Permission-scoped, read-only web-admin reports for bookings, marketplace activity, revenue, clients, and coordinators.';

commit;
