-- Existing V15 databases need the same narrowly scoped authorization that
-- fresh installs receive from the Phase 5 source migration.  Do not loosen
-- the appointment trigger: only the existing final-menu RPC sets this flag.

begin;

do $$
declare
  definition text;
  anchor text := '  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = workflow_row.provider_id;' || chr(10)
    || '  update public.catering_food_tastings set status = ''completed'', updated_at = now()';
  replacement text := '  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = workflow_row.provider_id;' || chr(10)
    || '  perform set_config(''app.v15_food_tasting_schedule_authorized'', ''true'', true);' || chr(10)
    || '  update public.catering_food_tastings set status = ''completed'', updated_at = now()';
begin
  select pg_get_functiondef('public.submit_my_v15_food_tasting_final_menu(uuid, jsonb)'::regprocedure)
    into definition;

  if position('app.v15_food_tasting_schedule_authorized' in definition) = 0 then
    if position(anchor in definition) = 0 then
      raise exception 'Unable to apply V15 final-menu completion authorization: expected function body was not found.';
    end if;
    execute replace(definition, anchor, replacement);
  end if;
end;
$$;

commit;
