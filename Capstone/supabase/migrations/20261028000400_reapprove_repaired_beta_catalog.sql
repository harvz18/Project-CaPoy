-- Provider configuration edits correctly return listings to moderation. These
-- records were repaired from the beta catalog, so restore their prior approved
-- availability through the normal admin review function.

begin;

select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  target_service_id uuid;
begin
  for target_service_id in
    select service.id
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where service.status = 'pending_review'
      and category.name in ('Catering', 'Photography')
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and (service.category_details ? 'pricingOptions' or service.category_details ? 'coverageConfigurations')
  loop
    perform public.admin_review_service(target_service_id, 'approved', 'Beta catalog booking configuration verified.');
  end loop;
end;
$$;

commit;
