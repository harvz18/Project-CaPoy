-- V23: public business-rating aggregate.
-- Reviews remain service-owned. This exposes only a weighted provider aggregate,
-- never reviewer identity, comments, or sentiment-analysis data.

create or replace function public.get_provider_business_rating_v23(
  p_provider_id uuid
)
returns table (
  average_rating numeric,
  review_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    round(avg(review.rating)::numeric, 1) as average_rating,
    count(review.id)::integer as review_count
  from public.provider_profiles provider
  left join public.services service
    on service.provider_id = provider.id
  left join public.reviews review
    on review.service_id = service.id
    and review.rating between 1 and 5
  where provider.id = p_provider_id
    and auth.uid() is not null;
$$;

revoke all on function public.get_provider_business_rating_v23(uuid) from public, anon;
grant execute on function public.get_provider_business_rating_v23(uuid) to authenticated;

comment on function public.get_provider_business_rating_v23(uuid) is
  'Returns only the review-weighted rating and eligible rating count across every service owned by one provider.';
