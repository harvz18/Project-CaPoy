begin;
select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.admin_review_service(
  'a1300000-0000-4000-8005-000000000001'::uuid,
  'approved',
  'Beta catalogue review: coordinator service verified.'
);
commit;
