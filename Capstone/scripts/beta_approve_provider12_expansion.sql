begin;
select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $approval$
declare service_id uuid;
begin
  foreach service_id in array array[
    'a1300000-0000-4000-8001-000000000001'::uuid,
    'b1300000-0000-4000-8003-000000000001'::uuid,
    'a1300000-0000-4000-8004-000000000002'::uuid,
    'a1300000-0000-4000-8005-000000000001'::uuid,
    'dadf546d-4500-4509-b72f-f84add11ac40'::uuid,
    'a1300000-0000-4000-8006-000000000002'::uuid,
    'a1300000-0000-4000-8007-000000000003'::uuid,
    'a1300000-0000-4000-8008-000000000001'::uuid,
    'c1300000-0000-4000-8001-000000000001'::uuid,
    'c1300000-0000-4000-8002-000000000001'::uuid,
    'c1300000-0000-4000-8003-000000000001'::uuid,
    'c1300000-0000-4000-8004-000000000001'::uuid,
    'c1300000-0000-4000-8005-000000000001'::uuid,
    'c1300000-0000-4000-8006-000000000001'::uuid,
    'c1300000-0000-4000-8007-000000000001'::uuid,
    'c1300000-0000-4000-8008-000000000001'::uuid
  ] loop
    if exists (select 1 from public.services where id = service_id and status in ('pending_review', 'rejected')) then
      perform public.admin_review_service(service_id, 'approved', 'Beta catalogue review: Provider 1/2 service verified.');
    end if;
  end loop;
end;
$approval$;
commit;
