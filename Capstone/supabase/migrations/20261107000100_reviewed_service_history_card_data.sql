-- Adds immutable client-facing booking price data to the client-only
-- reviewed-service history without altering review, booking, or payment rows.

begin;

create function public.get_my_reviewed_services_v23()
returns table (
  review_id uuid,
  booking_id uuid,
  service_id uuid,
  service_name text,
  provider_name text,
  image_url text,
  event_name text,
  event_date date,
  marketplace_price numeric,
  rating integer,
  review_preview text,
  reviewed_at timestamptz,
  is_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.id as review_id,
    booking.id as booking_id,
    coalesce(review.service_id, booking.service_id) as service_id,
    coalesce(service.name, 'Previously booked service') as service_name,
    coalesce(provider.business_name, 'Service provider') as provider_name,
    service.cover_image_url as image_url,
    event.name as event_name,
    event.event_date,
    nullif(round(coalesce(booking.amount, 0), 2), 0) as marketplace_price,
    review.rating::integer,
    nullif(btrim(review.comment), '') as review_preview,
    review.created_at as reviewed_at,
    coalesce(service.status = 'active', false) as is_available
  from public.reviews review
  join public.bookings booking
    on booking.id = review.booking_id
    and booking.client_id = auth.uid()
  left join public.services service
    on service.id = coalesce(review.service_id, booking.service_id)
  left join public.provider_profiles provider
    on provider.id = coalesce(review.provider_id, booking.provider_id)
  left join public.events event on event.id = booking.event_id
  where review.reviewer_id = auth.uid()
    and review.booking_id is not null
  order by review.created_at desc, review.id desc;
$$;

revoke all on function public.get_my_reviewed_services_v23() from public, anon;
grant execute on function public.get_my_reviewed_services_v23() to authenticated;

comment on function public.get_my_reviewed_services_v23() is
  'Returns only the signed-in client''s submitted service reviews with the immutable marketplace price recorded on the booking.';

commit;
