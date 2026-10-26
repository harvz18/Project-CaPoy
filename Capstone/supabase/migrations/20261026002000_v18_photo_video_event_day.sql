-- MULTIVENT Revision V18, Phase 10: operational event-day records only.
-- These records never amend booking prices, payment state, or booking completion.
begin;
alter table public.bookings add column if not exists photo_video_event_day_log jsonb not null default '{"coverageStatus":"scheduled","entries":[]}'::jsonb;
alter table public.bookings drop constraint if exists bookings_photo_video_event_day_log_object_check,
  add constraint bookings_photo_video_event_day_log_object_check check (jsonb_typeof(photo_video_event_day_log) = 'object');

create or replace function public.save_my_photo_video_event_day_update_v18(target_booking_id uuid, target_update jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; provider_user_id uuid; details jsonb; log jsonb; entries jsonb; entry jsonb; action_name text; requested_hours numeric; overtime_rate numeric; increment_hours numeric;
begin
  if auth.uid() is null or jsonb_typeof(target_update) <> 'object' then raise exception 'A valid event-day update is required.' using errcode = '42501'; end if;
  select booking.* into booking_row from public.bookings booking where booking.id = target_booking_id and booking.status::text in ('confirmed', 'completed');
  select provider.user_id, service.category_details into provider_user_id, details from public.provider_profiles provider join public.services service on service.id = booking_row.service_id where provider.id = booking_row.provider_id;
  if booking_row.id is null or provider_user_id <> auth.uid() or coalesce(booking_row.photo_video_selection_snapshot, '{}'::jsonb) = '{}'::jsonb then raise exception 'Only the assigned Photo/Video provider can record this event-day update.' using errcode = '42501'; end if;
  log := coalesce(booking_row.photo_video_event_day_log, '{"coverageStatus":"scheduled","entries":[]}'::jsonb); entries := coalesce(log -> 'entries', '[]'::jsonb); action_name := target_update ->> 'action';
  if action_name = 'coverage_started' then log := log || jsonb_build_object('coverageStatus', 'started', 'coverageStartedAt', now());
  elsif action_name = 'coverage_completed' then
    if log ->> 'coverageStatus' <> 'started' then raise exception 'Start coverage before recording it complete.'; end if;
    log := log || jsonb_build_object('coverageStatus', 'completed', 'coverageCompletedAt', now());
  elsif action_name in ('incident', 'restriction', 'crew_replacement', 'overtime_request') then
    entry := jsonb_build_object('id', gen_random_uuid(), 'type', action_name, 'note', nullif(left(trim(coalesce(target_update ->> 'note', '')), 3000), ''), 'createdAt', now(), 'createdBy', auth.uid());
    if action_name = 'overtime_request' then
      requested_hours := coalesce(nullif(target_update ->> 'hours', '')::numeric, 0); overtime_rate := coalesce((details ->> 'overtimeRate')::numeric, 0); increment_hours := coalesce((details ->> 'overtimeMinimumIncrementHours')::numeric, 0);
      if coalesce((details ->> 'overtimeAllowed')::boolean, false) is not true or requested_hours <= 0 or overtime_rate <= 0 or increment_hours <= 0 or mod(requested_hours, increment_hours) <> 0 then raise exception 'This overtime request does not match the provider-configured policy.'; end if;
      entry := entry || jsonb_build_object('hours', requested_hours, 'rate', overtime_rate, 'proposedAmount', round(requested_hours * overtime_rate, 2), 'status', 'pending_client_approval');
    elsif action_name = 'crew_replacement' then entry := entry || jsonb_build_object('material', coalesce((target_update ->> 'material')::boolean, true), 'status', 'pending_client_approval');
    else entry := entry || jsonb_build_object('status', 'recorded'); end if;
    log := log || jsonb_build_object('entries', entries || jsonb_build_array(entry));
  else raise exception 'Unsupported event-day update.'; end if;
  update public.bookings set photo_video_event_day_log = log, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('log', log);
end;
$$;

create or replace function public.respond_to_my_photo_video_event_day_request_v18(target_booking_id uuid, target_entry_id uuid, accept_request boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; log jsonb; entry jsonb; next_entries jsonb := '[]'::jsonb;
begin
  select * into booking_row from public.v18_photo_video_booking_for_actor(target_booking_id);
  if booking_row.client_id <> auth.uid() then raise exception 'Only the client can respond to this event-day request.' using errcode = '42501'; end if;
  log := coalesce(booking_row.photo_video_event_day_log, '{"coverageStatus":"scheduled","entries":[]}'::jsonb);
  for entry in select value from jsonb_array_elements(coalesce(log -> 'entries', '[]'::jsonb)) loop
    if entry ->> 'id' = target_entry_id::text then
      if entry ->> 'status' <> 'pending_client_approval' then raise exception 'This event-day request is no longer awaiting approval.'; end if;
      entry := entry || jsonb_build_object('status', case when accept_request then 'client_approved' else 'client_declined' end, 'respondedAt', now());
    end if;
    next_entries := next_entries || jsonb_build_array(entry);
  end loop;
  if not exists(select 1 from jsonb_array_elements(next_entries) item where item ->> 'id' = target_entry_id::text) then raise exception 'Event-day request not found.'; end if;
  log := log || jsonb_build_object('entries', next_entries);
  update public.bookings set photo_video_event_day_log = log, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('log', log);
end;
$$;

grant execute on function public.save_my_photo_video_event_day_update_v18(uuid, jsonb) to authenticated;
grant execute on function public.respond_to_my_photo_video_event_day_request_v18(uuid, uuid, boolean) to authenticated;
revoke all on function public.save_my_photo_video_event_day_update_v18(uuid, jsonb) from anon;
revoke all on function public.respond_to_my_photo_video_event_day_request_v18(uuid, uuid, boolean) from anon;
commit;
