-- A custom V18 selection has no package row. Reference its package ID from the
-- client selection only for the package path, instead of dereferencing an
-- unassigned PL/pgSQL record in the custom path.

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
    'case when selection_method = ''package'' then package_row.id else null end',
    'case when selection_method = ''package'' then nullif(target_selection ->> ''packageId'', '''')::uuid else null end'
  );
  if definition = original_definition then
    raise exception 'The V18 Photo/Video custom-selection patch could not locate its package reference.';
  end if;
  execute definition;
end;
$$;
