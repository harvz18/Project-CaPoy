-- MULTIVENT Revision V18, Phase 9: operational planning for confirmed
-- Photo/Video bookings. This intentionally creates no booking, price, or payment.
begin;

alter table public.bookings
  add column if not exists photo_video_pre_event_plan jsonb not null default '{}'::jsonb;
alter table public.bookings
  drop constraint if exists bookings_photo_video_pre_event_plan_object_check,
  add constraint bookings_photo_video_pre_event_plan_object_check
    check (jsonb_typeof(photo_video_pre_event_plan) = 'object');

create or replace function public.v18_photo_video_booking_for_actor(target_booking_id uuid)
returns public.bookings
language plpgsql stable security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype;
begin
  select booking.* into booking_row from public.bookings booking
  left join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id and booking.status::text in ('confirmed', 'completed')
    and (booking.client_id = auth.uid() or provider.user_id = auth.uid());
  if booking_row.id is null then raise exception 'This confirmed Photo/Video booking is unavailable.' using errcode = '42501'; end if;
  if coalesce(booking_row.photo_video_selection_snapshot, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'This booking has no Photo/Video configuration.';
  end if;
  return booking_row;
end;
$$;

create or replace function public.save_my_photo_video_pre_event_plan_v18(target_booking_id uuid, target_plan jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; provider_id uuid; plan jsonb; prior jsonb;
begin
  if auth.uid() is null then raise exception 'You must be signed in.' using errcode = '42501'; end if;
  if jsonb_typeof(target_plan) <> 'object' then raise exception 'The pre-event coverage plan is invalid.'; end if;
  select booking.* into booking_row from public.bookings booking
  where booking.id = target_booking_id and booking.status::text in ('confirmed', 'completed');
  select provider.user_id into provider_id from public.provider_profiles provider where provider.id = booking_row.provider_id;
  if booking_row.id is null or provider_id <> auth.uid() then raise exception 'Only the assigned provider can update this coverage plan.' using errcode = '42501'; end if;
  if coalesce(booking_row.photo_video_selection_snapshot, '{}'::jsonb) = '{}'::jsonb then raise exception 'This booking has no Photo/Video configuration.'; end if;
  prior := coalesce(booking_row.photo_video_pre_event_plan, '{}'::jsonb);
  plan := jsonb_build_object(
    'eventDateConfirmed', coalesce((target_plan ->> 'eventDateConfirmed')::boolean, false),
    'coverageStart', nullif(left(trim(coalesce(target_plan ->> 'coverageStart', '')), 12), ''),
    'coverageEnd', nullif(left(trim(coalesce(target_plan ->> 'coverageEnd', '')), 12), ''),
    'venueAddresses', nullif(left(trim(coalesce(target_plan ->> 'venueAddresses', '')), 3000), ''),
    'crewAssignments', nullif(left(trim(coalesce(target_plan ->> 'crewAssignments', '')), 3000), ''),
    'requiredEquipment', nullif(left(trim(coalesce(target_plan ->> 'requiredEquipment', '')), 3000), ''),
    'contactPerson', nullif(left(trim(coalesce(target_plan ->> 'contactPerson', '')), 1000), ''),
    'preparationLocation', nullif(left(trim(coalesce(target_plan ->> 'preparationLocation', '')), 1000), ''),
    'ceremonyLocation', nullif(left(trim(coalesce(target_plan ->> 'ceremonyLocation', '')), 1000), ''),
    'receptionLocation', nullif(left(trim(coalesce(target_plan ->> 'receptionLocation', '')), 1000), ''),
    'specialAccessRequirements', nullif(left(trim(coalesce(target_plan ->> 'specialAccessRequirements', '')), 3000), ''),
    'timelineNotes', nullif(left(trim(coalesce(target_plan ->> 'timelineNotes', '')), 3000), ''),
    'shotList', prior -> 'shotList', 'providerConfirmedAt', null, 'clientConfirmedAt', null, 'updatedAt', now());
  update public.bookings set photo_video_pre_event_plan = plan, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('plan', plan);
end;
$$;

create or replace function public.save_my_photo_video_shot_list_v18(target_booking_id uuid, target_shot_list text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; plan jsonb;
begin
  select * into booking_row from public.v18_photo_video_booking_for_actor(target_booking_id);
  if booking_row.client_id <> auth.uid() then raise exception 'Only the client can update the Photo/Video shot list.' using errcode = '42501'; end if;
  plan := coalesce(booking_row.photo_video_pre_event_plan, '{}'::jsonb) || jsonb_build_object(
    'shotList', nullif(left(trim(coalesce(target_shot_list, '')), 5000), ''), 'clientConfirmedAt', null, 'updatedAt', now());
  update public.bookings set photo_video_pre_event_plan = plan, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('plan', plan);
end;
$$;

create or replace function public.confirm_my_photo_video_pre_event_plan_v18(target_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; plan jsonb; provider_user_id uuid;
begin
  select * into booking_row from public.v18_photo_video_booking_for_actor(target_booking_id);
  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = booking_row.provider_id;
  plan := coalesce(booking_row.photo_video_pre_event_plan, '{}'::jsonb);
  if auth.uid() = provider_user_id then
    if coalesce((plan ->> 'eventDateConfirmed')::boolean, false) is not true
      or nullif(plan ->> 'crewAssignments', '') is null then raise exception 'Confirm the event date and crew assignments before confirming the plan.'; end if;
    plan := plan || jsonb_build_object('providerConfirmedAt', now(), 'clientConfirmedAt', null, 'updatedAt', now());
  elsif auth.uid() = booking_row.client_id then
    if nullif(plan ->> 'providerConfirmedAt', '') is null then raise exception 'Wait for the provider to confirm the coverage plan first.'; end if;
    plan := plan || jsonb_build_object('clientConfirmedAt', now(), 'updatedAt', now());
  else raise exception 'You cannot confirm this coverage plan.' using errcode = '42501'; end if;
  update public.bookings set photo_video_pre_event_plan = plan, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('plan', plan);
end;
$$;

grant execute on function public.save_my_photo_video_pre_event_plan_v18(uuid, jsonb) to authenticated;
grant execute on function public.save_my_photo_video_shot_list_v18(uuid, text) to authenticated;
grant execute on function public.confirm_my_photo_video_pre_event_plan_v18(uuid) to authenticated;
revoke all on function public.v18_photo_video_booking_for_actor(uuid) from public;
revoke all on function public.save_my_photo_video_pre_event_plan_v18(uuid, jsonb) from anon;
revoke all on function public.save_my_photo_video_shot_list_v18(uuid, text) from anon;
revoke all on function public.confirm_my_photo_video_pre_event_plan_v18(uuid) from anon;
commit;
