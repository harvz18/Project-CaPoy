begin;
select set_config('request.jwt.claim.sub', 'a1100000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update public.services
set status = 'active', is_available = true, updated_at = now()
where id = 'a1300000-0000-4000-8005-000000000001'::uuid;
commit;
