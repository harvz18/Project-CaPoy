-- The same unassigned record was also referenced for the optional package
-- name in a custom Photo/Video quote. Resolve that name lazily from the ID.

do $$
declare
  definition text;
  original_definition text;
begin
  select pg_get_functiondef(
    'public.calculate_my_photo_video_service_quote_v18(uuid,uuid,jsonb)'::regprocedure
  ) into original_definition;
  definition := replace(
    original_definition,
    'case when selection_method = ''package'' then package_row.name else null end',
    'case when selection_method = ''package'' then (select package.name from public.service_packages package where package.id = nullif(target_selection ->> ''packageId'', '''')::uuid) else null end'
  );
  if definition = original_definition then
    raise exception 'The V18 Photo/Video custom-selection patch could not locate its package-name reference.';
  end if;
  execute definition;
end;
$$;
