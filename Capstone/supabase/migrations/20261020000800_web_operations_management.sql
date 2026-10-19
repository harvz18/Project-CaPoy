-- Phase 4: read-only, permission-scoped operations reporting for the admin web.
-- These functions intentionally do not update booking, payment, client, or
-- coordinator state. Existing operational workflows remain authoritative.

begin;

create or replace function public.get_admin_booking_directory(
  p_category_id uuid default null,
  p_status text default 'all',
  p_provider_id uuid default null,
  p_search text default '',
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  normalized_status text := lower(trim(coalesce(p_status, 'all')));
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_sort text := case lower(trim(coalesce(p_sort, 'newest')))
    when 'event_date' then 'event_date'
    when 'amount' then 'amount'
    else 'newest'
  end;
  directory_payload jsonb;
begin
  if not public.has_permission('events.view') then
    raise exception 'You do not have permission to view bookings.' using errcode = '42501';
  end if;

  with booking_rows as (
    select
      booking.id,
      booking.event_id,
      booking.client_id,
      booking.provider_id,
      booking.service_id,
      booking.requested_date,
      booking.requested_time,
      booking.amount,
      booking.provider_amount,
      booking.status::text as booking_status,
      booking.created_at,
      event.name as event_name,
      event.event_type,
      event.event_date,
      event.status::text as event_status,
      client.full_name as client_name,
      client.email as client_email,
      provider.business_name as provider_name,
      service.name as service_name,
      category.id as category_id,
      category.name as category_name,
      coalesce(payment_summary.amount_paid, 0) as amount_paid,
      coalesce(payment_summary.payment_count, 0) as payment_count,
      payment_summary.latest_status as latest_payment_status,
      payment_summary.latest_paid_at
    from public.bookings booking
    join public.events event on event.id = booking.event_id
    join public.profiles client on client.id = booking.client_id
    join public.provider_profiles provider on provider.id = booking.provider_id
    join public.services service on service.id = booking.service_id
    left join public.service_categories category on category.id = service.category_id
    left join lateral (
      select
        coalesce(sum(payment.amount) filter (where payment.status::text in ('paid', 'verified')), 0) as amount_paid,
        count(*) as payment_count,
        (array_agg(payment.status::text order by coalesce(payment.paid_at, payment.created_at) desc, payment.id desc))[1] as latest_status,
        max(payment.paid_at) filter (where payment.status::text in ('paid', 'verified')) as latest_paid_at
      from public.payments payment
      where payment.booking_id = booking.id
        and coalesce(payment.payment_scope, 'provider_service') = 'provider_service'
    ) payment_summary on true
    where (p_category_id is null or category.id = p_category_id)
      and (p_provider_id is null or booking.provider_id = p_provider_id)
      and (normalized_status = 'all' or booking.status::text = normalized_status)
      and (p_date_from is null or event.event_date >= p_date_from)
      and (p_date_to is null or event.event_date <= p_date_to)
      and (
        normalized_search = ''
        or booking.id::text ilike '%' || normalized_search || '%'
        or coalesce(event.name, '') ilike '%' || normalized_search || '%'
        or coalesce(client.full_name, '') ilike '%' || normalized_search || '%'
        or coalesce(client.email, '') ilike '%' || normalized_search || '%'
        or coalesce(provider.business_name, '') ilike '%' || normalized_search || '%'
        or coalesce(service.name, '') ilike '%' || normalized_search || '%'
        or coalesce(category.name, '') ilike '%' || normalized_search || '%'
      )
  ),
  ranked_rows as (
    select booking_rows.*, row_number() over (
      order by
        case when normalized_sort = 'event_date' then event_date end asc nulls last,
        case when normalized_sort = 'amount' then amount end desc nulls last,
        case when normalized_sort = 'newest' then created_at end desc nulls last,
        created_at desc,
        id
    ) as sort_position
    from booking_rows
  ),
  paged_rows as (
    select *
    from ranked_rows
    where sort_position > (safe_page - 1) * safe_page_size
      and sort_position <= safe_page * safe_page_size
  ),
  category_options as (
    select category.id, category.name
    from public.service_categories category
    where category.is_active
      and exists (select 1 from public.services service where service.category_id = category.id)
    order by category.name
  ),
  provider_options as (
    select provider.id, provider.business_name
    from public.provider_profiles provider
    where exists (select 1 from public.bookings booking where booking.provider_id = provider.id)
    order by provider.business_name
  )
  select jsonb_build_object(
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (select count(*) from booking_rows),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from category_options
    ), '[]'::jsonb),
    'providers', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name) order by business_name)
      from provider_options
    ), '[]'::jsonb),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'event_id', event_id,
        'event_name', event_name,
        'event_type', event_type,
        'event_date', event_date,
        'event_status', event_status,
        'client_id', client_id,
        'client_name', client_name,
        'client_email', client_email,
        'provider_id', provider_id,
        'provider_name', provider_name,
        'service_id', service_id,
        'service_name', service_name,
        'category_id', category_id,
        'category_name', category_name,
        'requested_date', requested_date,
        'requested_time', requested_time,
        'amount', amount,
        'provider_amount', provider_amount,
        'status', booking_status,
        'amount_paid', amount_paid,
        'payment_count', payment_count,
        'latest_payment_status', latest_payment_status,
        'latest_paid_at', latest_paid_at,
        'created_at', created_at
      ) order by sort_position)
      from paged_rows
    ), '[]'::jsonb)
  ) into directory_payload;

  return directory_payload;
end;
$$;

create or replace function public.get_admin_booking_profile(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_payload jsonb;
begin
  if not public.has_permission('events.view') then
    raise exception 'You do not have permission to view booking details.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'booking', jsonb_build_object(
      'id', booking.id,
      'status', booking.status,
      'amount', booking.amount,
      'provider_amount', booking.provider_amount,
      'requested_date', booking.requested_date,
      'requested_time', booking.requested_time,
      'created_at', booking.created_at,
      'updated_at', booking.updated_at,
      'client_notes', booking.client_notes,
      'provider_notes', booking.provider_notes,
      'catering_option_name', booking.catering_option_name,
      'venue_option_name', booking.venue_option_name,
      'venue_booked_hours', booking.venue_booked_hours,
      'completion_payment_status', booking.completion_payment_status
    ),
    'event', jsonb_build_object(
      'id', event.id,
      'name', event.name,
      'type', event.event_type,
      'date', event.event_date,
      'time', event.event_time,
      'location', event.location,
      'venue', event.venue,
      'guest_count', event.guest_count,
      'status', event.status,
      'coordinator_assignment_status', event.coordinator_assignment_status
    ),
    'client', jsonb_build_object(
      'id', client.id,
      'full_name', client.full_name,
      'email', client.email,
      'phone', client.phone,
      'account_status', client.account_status
    ),
    'provider', jsonb_build_object(
      'id', provider.id,
      'business_name', provider.business_name,
      'contact_email', provider.contact_email,
      'location', provider.location,
      'verification_status', provider.verification_status
    ),
    'service', jsonb_build_object(
      'id', service.id,
      'name', service.name,
      'category_name', category.name,
      'location', service.location
    ),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', payment.id,
        'amount', payment.amount,
        'status', payment.status,
        'method', payment.provider,
        'paid_at', payment.paid_at,
        'created_at', payment.created_at
      ) order by coalesce(payment.paid_at, payment.created_at) desc, payment.id desc)
      from public.payments payment
      where payment.booking_id = booking.id
        and coalesce(payment.payment_scope, 'provider_service') = 'provider_service'
    ), '[]'::jsonb)
  ) into profile_payload
  from public.bookings booking
  join public.events event on event.id = booking.event_id
  join public.profiles client on client.id = booking.client_id
  join public.provider_profiles provider on provider.id = booking.provider_id
  join public.services service on service.id = booking.service_id
  left join public.service_categories category on category.id = service.category_id
  where booking.id = p_booking_id;

  if profile_payload is null then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;
  return profile_payload;
end;
$$;

create or replace function public.get_admin_client_directory(
  p_status text default 'all',
  p_search text default '',
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  normalized_status text := lower(trim(coalesce(p_status, 'all')));
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_sort text := case lower(trim(coalesce(p_sort, 'newest')))
    when 'events' then 'events'
    when 'bookings' then 'bookings'
    else 'newest'
  end;
  directory_payload jsonb;
begin
  if not public.has_permission('users.view') then
    raise exception 'You do not have permission to view clients.' using errcode = '42501';
  end if;

  with client_rows as (
    select
      client.id,
      client.full_name,
      client.email,
      client.account_status::text as account_status,
      client.created_at,
      count(distinct event.id) as event_count,
      count(distinct event.id) filter (where event.status::text not in ('draft', 'completed', 'cancelled')) as active_event_count,
      count(distinct booking.id) as booking_count,
      count(distinct booking.id) filter (where booking.status::text not in ('cancelled', 'expired', 'rejected')) as valid_booking_count,
      max(event.event_date) as latest_event_date,
      max(booking.created_at) as latest_booking_at
    from public.profiles client
    left join public.events event on event.client_id = client.id
    left join public.bookings booking on booking.client_id = client.id
    where client.default_role = 'client'
      and (normalized_status = 'all' or client.account_status::text = normalized_status)
      and (
        normalized_search = ''
        or coalesce(client.full_name, '') ilike '%' || normalized_search || '%'
        or coalesce(client.email, '') ilike '%' || normalized_search || '%'
      )
    group by client.id, client.full_name, client.email, client.account_status, client.created_at
  ),
  ranked_rows as (
    select client_rows.*, row_number() over (
      order by
        case when normalized_sort = 'events' then event_count end desc,
        case when normalized_sort = 'bookings' then valid_booking_count end desc,
        case when normalized_sort = 'newest' then created_at end desc,
        created_at desc,
        id
    ) as sort_position
    from client_rows
  ),
  paged_rows as (
    select * from ranked_rows
    where sort_position > (safe_page - 1) * safe_page_size
      and sort_position <= safe_page * safe_page_size
  )
  select jsonb_build_object(
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (select count(*) from client_rows),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'full_name', full_name,
        'email', email,
        'account_status', account_status,
        'registered_at', created_at,
        'event_count', event_count,
        'active_event_count', active_event_count,
        'booking_count', booking_count,
        'valid_booking_count', valid_booking_count,
        'latest_event_date', latest_event_date,
        'latest_booking_at', latest_booking_at
      ) order by sort_position)
      from paged_rows
    ), '[]'::jsonb)
  ) into directory_payload;

  return directory_payload;
end;
$$;

create or replace function public.get_admin_client_profile(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_payload jsonb;
begin
  if not public.has_permission('users.view') then
    raise exception 'You do not have permission to view client details.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'client', jsonb_build_object(
      'id', client.id,
      'full_name', client.full_name,
      'email', client.email,
      'phone', client.phone,
      'account_status', client.account_status,
      'registered_at', client.created_at
    ),
    'summary', jsonb_build_object(
      'events', (select count(*) from public.events event where event.client_id = client.id),
      'active_events', (select count(*) from public.events event where event.client_id = client.id and event.status::text not in ('draft', 'completed', 'cancelled')),
      'bookings', (select count(*) from public.bookings booking where booking.client_id = client.id),
      'valid_bookings', (select count(*) from public.bookings booking where booking.client_id = client.id and booking.status::text not in ('cancelled', 'expired', 'rejected'))
    ),
    'recent_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event_row.id,
        'name', event_row.name,
        'type', event_row.event_type,
        'event_date', event_row.event_date,
        'status', event_row.status,
        'booking_count', event_row.booking_count,
        'valid_booking_count', event_row.valid_booking_count
      ) order by event_row.event_date desc nulls last, event_row.created_at desc)
      from (
        select event.id, event.name, event.event_type, event.event_date, event.status, event.created_at,
          count(booking.id) as booking_count,
          count(booking.id) filter (where booking.status::text not in ('cancelled', 'expired', 'rejected')) as valid_booking_count
        from public.events event
        left join public.bookings booking on booking.event_id = event.id
        where event.client_id = client.id
        group by event.id
        order by event.event_date desc nulls last, event.created_at desc
        limit 10
      ) event_row
    ), '[]'::jsonb),
    'recent_bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', booking_row.id,
        'event_name', booking_row.event_name,
        'service_name', booking_row.service_name,
        'provider_name', booking_row.provider_name,
        'category_name', booking_row.category_name,
        'event_date', booking_row.event_date,
        'amount', booking_row.amount,
        'status', booking_row.status,
        'created_at', booking_row.created_at
      ) order by booking_row.created_at desc)
      from (
        select booking.id, booking.amount, booking.status, booking.created_at,
          event.name as event_name, event.event_date, service.name as service_name,
          provider.business_name as provider_name, category.name as category_name
        from public.bookings booking
        join public.events event on event.id = booking.event_id
        join public.services service on service.id = booking.service_id
        join public.provider_profiles provider on provider.id = booking.provider_id
        left join public.service_categories category on category.id = service.category_id
        where booking.client_id = client.id
        order by booking.created_at desc
        limit 10
      ) booking_row
    ), '[]'::jsonb)
  ) into profile_payload
  from public.profiles client
  where client.id = p_client_id and client.default_role = 'client';

  if profile_payload is null then
    raise exception 'Client not found.' using errcode = 'P0002';
  end if;
  return profile_payload;
end;
$$;

create or replace function public.get_admin_coordinator_directory(
  p_status text default 'all',
  p_search text default '',
  p_sort text default 'upcoming',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_page integer := greatest(coalesce(p_page, 1), 1);
  safe_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  normalized_status text := lower(trim(coalesce(p_status, 'all')));
  normalized_search text := lower(trim(coalesce(p_search, '')));
  normalized_sort text := case lower(trim(coalesce(p_sort, 'upcoming')))
    when 'completed' then 'completed'
    when 'newest' then 'newest'
    else 'upcoming'
  end;
  directory_payload jsonb;
begin
  if not public.has_permission('coordinators.view') then
    raise exception 'You do not have permission to view coordinators.' using errcode = '42501';
  end if;

  with coordinator_rows as (
    select
      coordinator.id,
      coordinator.full_name,
      coordinator.email,
      coordinator.phone,
      coordinator.account_status::text as account_status,
      coordinator.created_at,
      coalesce(service_profile.description, '') as description,
      coalesce(service_profile.coordination_fee, 0) as coordination_fee,
      service_profile.currency,
      coalesce(service_profile.specializations, '{}'::text[]) as specializations,
      coalesce(service_profile.is_accepting_bookings, false) as is_accepting_bookings,
      count(distinct accepted_event.id) filter (where accepted_event.status::text not in ('completed', 'cancelled')) as active_event_count,
      count(distinct accepted_event.id) filter (where accepted_event.status::text not in ('completed', 'cancelled') and accepted_event.event_date >= current_date) as upcoming_event_count,
      count(distinct accepted_event.id) filter (where accepted_event.status::text = 'completed') as completed_event_count,
      count(distinct pending_event.id) filter (where pending_event.coordinator_assignment_status = 'pending') as pending_request_count,
      count(distinct pending_event.id) filter (where pending_event.coordinator_assignment_status = 'awaiting_payment') as awaiting_payment_count,
      min(accepted_event.event_date) filter (where accepted_event.status::text not in ('completed', 'cancelled') and accepted_event.event_date >= current_date) as next_event_date
    from public.profiles coordinator
    left join public.coordinator_service_profiles service_profile on service_profile.coordinator_id = coordinator.id
    left join public.events accepted_event on accepted_event.coordinator_id = coordinator.id and accepted_event.coordinator_assignment_status = 'accepted'
    left join public.events pending_event on pending_event.pending_coordinator_id = coordinator.id
    where coordinator.default_role = 'event_coordinator'
      and (normalized_status = 'all'
        or (normalized_status = 'accepting' and coalesce(service_profile.is_accepting_bookings, false) and coordinator.account_status::text = 'active')
        or (normalized_status = 'not_accepting' and (not coalesce(service_profile.is_accepting_bookings, false) or coordinator.account_status::text <> 'active'))
        or (normalized_status = 'pending' and exists (
          select 1 from public.events event
          where event.pending_coordinator_id = coordinator.id and event.coordinator_assignment_status = 'pending'
        ))
      )
      and (
        normalized_search = ''
        or coalesce(coordinator.full_name, '') ilike '%' || normalized_search || '%'
        or coalesce(coordinator.email, '') ilike '%' || normalized_search || '%'
        or coalesce(service_profile.description, '') ilike '%' || normalized_search || '%'
        or array_to_string(coalesce(service_profile.specializations, '{}'::text[]), ' ') ilike '%' || normalized_search || '%'
      )
    group by coordinator.id, coordinator.full_name, coordinator.email, coordinator.phone, coordinator.account_status,
      coordinator.created_at, service_profile.description, service_profile.coordination_fee, service_profile.currency,
      service_profile.specializations, service_profile.is_accepting_bookings
  ),
  ranked_rows as (
    select coordinator_rows.*, row_number() over (
      order by
        case when normalized_sort = 'upcoming' then upcoming_event_count end desc,
        case when normalized_sort = 'upcoming' then next_event_date end asc nulls last,
        case when normalized_sort = 'completed' then completed_event_count end desc,
        case when normalized_sort = 'newest' then created_at end desc,
        created_at desc,
        id
    ) as sort_position
    from coordinator_rows
  ),
  paged_rows as (
    select * from ranked_rows
    where sort_position > (safe_page - 1) * safe_page_size
      and sort_position <= safe_page * safe_page_size
  )
  select jsonb_build_object(
    'page', safe_page,
    'page_size', safe_page_size,
    'total', (select count(*) from coordinator_rows),
    'coordinators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'full_name', full_name,
        'email', email,
        'phone', phone,
        'account_status', account_status,
        'registered_at', created_at,
        'description', description,
        'coordination_fee', coordination_fee,
        'currency', currency,
        'specializations', to_jsonb(specializations),
        'is_accepting_bookings', is_accepting_bookings,
        'active_event_count', active_event_count,
        'upcoming_event_count', upcoming_event_count,
        'completed_event_count', completed_event_count,
        'pending_request_count', pending_request_count,
        'awaiting_payment_count', awaiting_payment_count,
        'next_event_date', next_event_date
      ) order by sort_position)
      from paged_rows
    ), '[]'::jsonb)
  ) into directory_payload;

  return directory_payload;
end;
$$;

create or replace function public.get_admin_coordinator_profile(p_coordinator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile_payload jsonb;
begin
  if not public.has_permission('coordinators.view') then
    raise exception 'You do not have permission to view coordinator details.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'coordinator', jsonb_build_object(
      'id', coordinator.id,
      'full_name', coordinator.full_name,
      'email', coordinator.email,
      'phone', coordinator.phone,
      'account_status', coordinator.account_status,
      'registered_at', coordinator.created_at,
      'description', service_profile.description,
      'coordination_fee', service_profile.coordination_fee,
      'currency', service_profile.currency,
      'specializations', coalesce(to_jsonb(service_profile.specializations), '[]'::jsonb),
      'is_accepting_bookings', coalesce(service_profile.is_accepting_bookings, false)
    ),
    'summary', jsonb_build_object(
      'active_events', (select count(*) from public.events event where event.coordinator_id = coordinator.id and event.coordinator_assignment_status = 'accepted' and event.status::text not in ('completed', 'cancelled')),
      'upcoming_events', (select count(*) from public.events event where event.coordinator_id = coordinator.id and event.coordinator_assignment_status = 'accepted' and event.status::text not in ('completed', 'cancelled') and event.event_date >= current_date),
      'completed_events', (select count(*) from public.events event where event.coordinator_id = coordinator.id and event.coordinator_assignment_status = 'accepted' and event.status::text = 'completed'),
      'pending_requests', (select count(*) from public.events event where event.pending_coordinator_id = coordinator.id and event.coordinator_assignment_status = 'pending'),
      'awaiting_payment_selections', (select count(*) from public.events event where event.pending_coordinator_id = coordinator.id and event.coordinator_assignment_status = 'awaiting_payment')
    ),
    'upcoming_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event_row.id,
        'name', event_row.name,
        'event_date', event_row.event_date,
        'event_time', event_row.event_time,
        'status', event_row.status,
        'client_name', event_row.client_name,
        'assignment_status', event_row.coordinator_assignment_status
      ) order by event_row.event_date asc nulls last, event_row.event_time asc nulls last)
      from (
        select event.id, event.name, event.event_date, event.event_time, event.status,
          event.coordinator_assignment_status, client.full_name as client_name
        from public.events event
        join public.profiles client on client.id = event.client_id
        where event.coordinator_id = coordinator.id
          and event.coordinator_assignment_status = 'accepted'
          and event.status::text not in ('completed', 'cancelled')
        order by event.event_date asc nulls last, event.event_time asc nulls last
        limit 12
      ) event_row
    ), '[]'::jsonb),
    'recent_completed_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event_row.id,
        'name', event_row.name,
        'event_date', event_row.event_date,
        'client_name', event_row.client_name
      ) order by event_row.event_date desc nulls last)
      from (
        select event.id, event.name, event.event_date, client.full_name as client_name
        from public.events event
        join public.profiles client on client.id = event.client_id
        where event.coordinator_id = coordinator.id
          and event.coordinator_assignment_status = 'accepted'
          and event.status::text = 'completed'
        order by event.event_date desc nulls last
        limit 8
      ) event_row
    ), '[]'::jsonb),
    'pending_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event_row.id,
        'name', event_row.name,
        'event_date', event_row.event_date,
        'client_name', event_row.client_name,
        'assignment_status', event_row.coordinator_assignment_status,
        'requested_at', event_row.coordinator_assignment_requested_at
      ) order by event_row.coordinator_assignment_requested_at desc nulls last, event_row.created_at desc)
      from (
        select event.id, event.name, event.event_date, event.created_at,
          event.coordinator_assignment_status, event.coordinator_assignment_requested_at,
          client.full_name as client_name
        from public.events event
        join public.profiles client on client.id = event.client_id
        where event.pending_coordinator_id = coordinator.id
          and event.coordinator_assignment_status in ('pending', 'awaiting_payment')
        order by event.coordinator_assignment_requested_at desc nulls last, event.created_at desc
        limit 12
      ) event_row
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', availability.id,
        'starts_at', availability.starts_at,
        'ends_at', availability.ends_at,
        'status', availability.status,
        'reason', availability.reason
      ) order by availability.starts_at asc)
      from (
        select availability.*
        from public.coordinator_availability availability
        where availability.coordinator_id = coordinator.id
          and availability.ends_at >= now()
        order by availability.starts_at asc
        limit 10
      ) availability
    ), '[]'::jsonb)
  ) into profile_payload
  from public.profiles coordinator
  left join public.coordinator_service_profiles service_profile on service_profile.coordinator_id = coordinator.id
  where coordinator.id = p_coordinator_id and coordinator.default_role = 'event_coordinator';

  if profile_payload is null then
    raise exception 'Coordinator not found.' using errcode = 'P0002';
  end if;
  return profile_payload;
end;
$$;

revoke all on function public.get_admin_booking_directory(uuid, text, uuid, text, date, date, text, integer, integer) from public;
revoke all on function public.get_admin_booking_profile(uuid) from public;
revoke all on function public.get_admin_client_directory(text, text, text, integer, integer) from public;
revoke all on function public.get_admin_client_profile(uuid) from public;
revoke all on function public.get_admin_coordinator_directory(text, text, text, integer, integer) from public;
revoke all on function public.get_admin_coordinator_profile(uuid) from public;

grant execute on function public.get_admin_booking_directory(uuid, text, uuid, text, date, date, text, integer, integer) to authenticated;
grant execute on function public.get_admin_booking_profile(uuid) to authenticated;
grant execute on function public.get_admin_client_directory(text, text, text, integer, integer) to authenticated;
grant execute on function public.get_admin_client_profile(uuid) to authenticated;
grant execute on function public.get_admin_coordinator_directory(text, text, text, integer, integer) to authenticated;
grant execute on function public.get_admin_coordinator_profile(uuid) to authenticated;

comment on function public.get_admin_booking_directory(uuid, text, uuid, text, date, date, text, integer, integer) is
  'Permission-scoped, paginated, read-only booking reporting for the admin web.';
comment on function public.get_admin_client_directory(text, text, text, integer, integer) is
  'Permission-scoped, paginated, read-only client reporting for the admin web.';
comment on function public.get_admin_coordinator_directory(text, text, text, integer, integer) is
  'Permission-scoped, paginated, read-only coordinator reporting for the admin web; it does not permit assignment or rematching.';

commit;
