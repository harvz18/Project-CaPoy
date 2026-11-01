-- V22 Phase 8: a client-only history of reviews they actually submitted.

begin;

create or replace function public.get_my_reviewed_services_v22()
returns table (
  review_id uuid,
  booking_id uuid,
  service_id uuid,
  service_name text,
  provider_name text,
  image_url text,
  event_name text,
  event_date date,
  rating integer,
  review_preview text,
  reviewed_at timestamptz,
  is_available boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    review.id as review_id,
    review.booking_id,
    review.service_id,
    coalesce(service.name, 'Previously booked service') as service_name,
    coalesce(provider.business_name, 'Service provider') as provider_name,
    service.cover_image_url as image_url,
    event.name as event_name,
    event.event_date,
    review.rating::integer,
    nullif(btrim(review.comment), '') as review_preview,
    review.created_at as reviewed_at,
    coalesce(service.status = 'active', false) as is_available
  from public.reviews review
  join public.bookings booking
    on booking.id = review.booking_id
    and booking.client_id = auth.uid()
  left join public.services service on service.id = review.service_id
  left join public.provider_profiles provider on provider.id = review.provider_id
  left join public.events event on event.id = booking.event_id
  where review.reviewer_id = auth.uid()
    and review.booking_id is not null
  order by review.created_at desc, review.id desc;
$$;

revoke all on function public.get_my_reviewed_services_v22() from public, anon;
grant execute on function public.get_my_reviewed_services_v22() to authenticated;

comment on function public.get_my_reviewed_services_v22() is
  'Returns only the signed-in client''s own submitted service reviews for Explore history.';

commit;
