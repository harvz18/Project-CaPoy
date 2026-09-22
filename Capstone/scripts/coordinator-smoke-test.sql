-- Safe integration smoke test for migration 19. Every temporary change is rolled back.

begin;

do $test$
declare
  test_user uuid;
  test_event uuid;
  dashboard jsonb;
  created jsonb;
  updated jsonb;
begin
  select id into test_user
  from public.profiles
  where default_role = 'admin'
  limit 1;

  select id into test_event
  from public.events
  where status not in ('completed', 'cancelled')
  limit 1;

  if test_user is null or test_event is null then
    raise exception 'Coordinator smoke test requires one account and one event.';
  end if;

  perform set_config('request.jwt.claim.sub', test_user::text, true);
  update public.profiles
  set default_role = 'event_coordinator'
  where id = test_user;
  update public.events
  set coordinator_id = test_user
  where id = test_event;

  dashboard := public.get_coordinator_dashboard();
  if jsonb_array_length(dashboard->'events') < 1 then
    raise exception 'Dashboard did not return the assigned event.';
  end if;

  created := public.create_coordination_task(
    test_event,
    'Rollback-only coordinator smoke test',
    'This row must be rolled back.',
    now() + interval '1 day'
  );
  updated := public.update_coordination_task_status(
    (created->>'id')::uuid,
    'completed'
  );

  if updated->>'status' <> 'completed' then
    raise exception 'Task status did not update.';
  end if;
end
$test$;

rollback;
