begin;

-- Church ceremony dates are owned by the client's event schedule. Keep the
-- established V7 arrangement workflow intact, but place a small wrapper in
-- front of it so older clients and direct RPC calls cannot supply a different
-- ceremony date.
alter function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) rename to save_my_church_wedding_arrangement_v7_schedule_core;

revoke all on function public.save_my_church_wedding_arrangement_v7_schedule_core(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) from public, anon, authenticated;

create function public.save_my_church_wedding_arrangement_v7(
  target_event_id uuid,
  target_preferred_church text,
  target_church_name text,
  target_church_address text,
  target_church_contact text,
  target_church_latitude double precision,
  target_church_longitude double precision,
  target_ceremony_date date,
  target_ceremony_time time,
  target_notes text,
  target_arrangement_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client_event_date date;
begin
  -- The schedule core below retains authorization and every existing
  -- validation rule. This lookup only determines the date to pass through.
  select event.event_date into client_event_date
  from public.events event
  where event.id = target_event_id;

  return public.save_my_church_wedding_arrangement_v7_schedule_core(
    target_event_id,
    target_preferred_church,
    target_church_name,
    target_church_address,
    target_church_contact,
    target_church_latitude,
    target_church_longitude,
    client_event_date,
    target_ceremony_time,
    target_notes,
    target_arrangement_status
  );
end;
$$;

revoke all on function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) from public;
grant execute on function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) to authenticated;

comment on function public.save_my_church_wedding_arrangement_v7(
  uuid, text, text, text, text, double precision, double precision, date, time, text, text
) is
  'Saves church arrangement details using the client event date as the immutable ceremony date; coordinators may set only the ceremony time.';

commit;
