-- V18 Phase 11: operational post-event deliverable tracking. This deliberately
-- does not write booking amount, payment state, payout state, or booking status.
begin;

alter table public.bookings add column if not exists photo_video_deliverable_tracking jsonb;
alter table public.bookings drop constraint if exists bookings_photo_video_deliverable_tracking_object;
alter table public.bookings add constraint bookings_photo_video_deliverable_tracking_object check (
  photo_video_deliverable_tracking is null or jsonb_typeof(photo_video_deliverable_tracking) = 'object'
);

create or replace function public.v18_photo_video_deliverable_tracking_for_booking(target_booking public.bookings)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb := coalesce(target_booking.photo_video_selection_snapshot, '{}'::jsonb); policy jsonb; rows jsonb;
begin
  if coalesce(target_booking.photo_video_deliverable_tracking, '{}'::jsonb) <> '{}'::jsonb then return target_booking.photo_video_deliverable_tracking; end if;
  policy := coalesce(snapshot -> 'revisionPolicy', '{}'::jsonb);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.value ->> 'id', 'name', item.value ->> 'name', 'description', item.value ->> 'deliveryFormat',
    'quantity', coalesce(nullif(item.value ->> 'quantity', '')::integer, 1), 'expectedCompletionDate', item.value ->> 'expectedDeadlineDate',
    'status', 'awaiting_event', 'includedRevisionRounds', coalesce(nullif(policy ->> 'includedRevisionRounds', '')::integer, 0),
    'usedRevisionRounds', 0, 'revisionEligible', exists (select 1 from jsonb_array_elements_text(coalesce(policy -> 'eligibleDeliverableIds', '[]'::jsonb)) eligible where eligible = item.value ->> 'id')
  ) order by item.value ->> 'id'), '[]'::jsonb) into rows
  from jsonb_array_elements(coalesce(snapshot -> 'deliverables', '[]'::jsonb)) item(value)
  where nullif(trim(item.value ->> 'id'), '') is not null and nullif(trim(item.value ->> 'name'), '') is not null;
  return jsonb_build_object('initializedAt', now(), 'deliverables', rows);
end;
$$;

create or replace function public.save_my_photo_video_deliverable_update_v18(target_booking_id uuid, target_update jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; provider_user_id uuid; tracking jsonb; entry jsonb; next_rows jsonb := '[]'::jsonb; action_name text; target_id text; found boolean := false;
begin
  if auth.uid() is null or jsonb_typeof(target_update) <> 'object' then raise exception 'A valid deliverable update is required.' using errcode = '42501'; end if;
  select booking.* into booking_row from public.bookings booking where booking.id = target_booking_id and booking.status::text in ('confirmed', 'completed');
  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = booking_row.provider_id;
  if booking_row.id is null or provider_user_id <> auth.uid() or coalesce(booking_row.photo_video_selection_snapshot, '{}'::jsonb) = '{}'::jsonb then raise exception 'Only the assigned Photo/Video provider can update deliverables.' using errcode = '42501'; end if;
  tracking := public.v18_photo_video_deliverable_tracking_for_booking(booking_row); action_name := target_update ->> 'action'; target_id := nullif(trim(target_update ->> 'deliverableId'), '');
  if action_name = 'initialize' then
    update public.bookings set photo_video_deliverable_tracking = tracking, updated_at = now() where id = booking_row.id;
    return jsonb_build_object('tracking', tracking);
  end if;
  if target_id is null or action_name not in ('start_editing', 'ready_for_review', 'revision_completed', 'record_completed') then raise exception 'Choose a promised deliverable and supported update.'; end if;
  for entry in select value from jsonb_array_elements(coalesce(tracking -> 'deliverables', '[]'::jsonb)) loop
    if entry ->> 'id' = target_id then
      found := true;
      if action_name = 'start_editing' then entry := entry || jsonb_build_object('status', 'editing', 'editingStartedAt', now());
      elsif action_name = 'ready_for_review' then entry := entry || jsonb_build_object('status', 'ready_for_review', 'deliveryMethod', nullif(left(trim(coalesce(target_update ->> 'deliveryMethod', '')), 160), ''), 'deliveryReference', nullif(left(trim(coalesce(target_update ->> 'deliveryReference', '')), 3000), ''), 'deliveredAt', now());
      elsif action_name = 'revision_completed' then entry := entry || jsonb_build_object('status', 'ready_for_review', 'deliveryMethod', nullif(left(trim(coalesce(target_update ->> 'deliveryMethod', '')), 160), ''), 'deliveryReference', nullif(left(trim(coalesce(target_update ->> 'deliveryReference', '')), 3000), ''), 'revisionCompletedAt', now());
      else entry := entry || jsonb_build_object('status', 'completed', 'providerCompletedAt', now()); end if;
    end if;
    next_rows := next_rows || jsonb_build_array(entry);
  end loop;
  if not found then raise exception 'Promised deliverable not found.'; end if;
  tracking := tracking || jsonb_build_object('deliverables', next_rows);
  update public.bookings set photo_video_deliverable_tracking = tracking, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('tracking', tracking);
end;
$$;

create or replace function public.respond_to_my_photo_video_deliverable_v18(target_booking_id uuid, target_deliverable_id text, target_action text, target_note text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking_row public.bookings%rowtype; tracking jsonb; entry jsonb; next_rows jsonb := '[]'::jsonb; found boolean := false; used_rounds integer; included_rounds integer; request_period integer; delivered_at timestamptz;
begin
  select * into booking_row from public.v18_photo_video_booking_for_actor(target_booking_id);
  if booking_row.client_id <> auth.uid() then raise exception 'Only the client can respond to a Photo/Video deliverable.' using errcode = '42501'; end if;
  if target_action not in ('confirm_receipt', 'request_revision', 'approve_output', 'report_issue') then raise exception 'Unsupported deliverable response.'; end if;
  tracking := public.v18_photo_video_deliverable_tracking_for_booking(booking_row);
  for entry in select value from jsonb_array_elements(coalesce(tracking -> 'deliverables', '[]'::jsonb)) loop
    if entry ->> 'id' = target_deliverable_id then
      found := true; used_rounds := coalesce(nullif(entry ->> 'usedRevisionRounds', '')::integer, 0); included_rounds := coalesce(nullif(entry ->> 'includedRevisionRounds', '')::integer, 0);
      if target_action = 'confirm_receipt' then entry := entry || jsonb_build_object('receiptConfirmedAt', now());
      elsif target_action = 'approve_output' then
        if entry ->> 'status' <> 'ready_for_review' then raise exception 'This output must be ready for review before approval.'; end if;
        entry := entry || jsonb_build_object('status', 'completed', 'approvedAt', now());
      elsif target_action = 'report_issue' then entry := entry || jsonb_build_object('issueNote', nullif(left(trim(target_note), 3000), ''), 'supportEscalationSuggested', true, 'issueReportedAt', now());
      else
        if entry ->> 'revisionEligible' <> 'true' then raise exception 'This deliverable is not eligible for revisions.'; end if;
        delivered_at := nullif(entry ->> 'deliveredAt', '')::timestamptz; request_period := coalesce(nullif(booking_row.photo_video_selection_snapshot #>> '{revisionPolicy,revisionRequestPeriodDays}', '')::integer, 0);
        if delivered_at is null then raise exception 'A provider delivery is required before requesting a revision.'; end if;
        if request_period > 0 and delivered_at + make_interval(days => request_period) < now() then raise exception 'The agreed revision request period has ended.'; end if;
        entry := entry || jsonb_build_object('status', 'revision_requested', 'revisionNote', nullif(left(trim(target_note), 3000), ''), 'revisionRequestedAt', now(), 'usedRevisionRounds', least(used_rounds + 1, included_rounds), 'additionalPaidRevisionRequested', used_rounds >= included_rounds);
      end if;
    end if;
    next_rows := next_rows || jsonb_build_array(entry);
  end loop;
  if not found then raise exception 'Promised deliverable not found.'; end if;
  tracking := tracking || jsonb_build_object('deliverables', next_rows);
  update public.bookings set photo_video_deliverable_tracking = tracking, updated_at = now() where id = booking_row.id;
  return jsonb_build_object('tracking', tracking);
end;
$$;

grant execute on function public.save_my_photo_video_deliverable_update_v18(uuid, jsonb) to authenticated;
grant execute on function public.respond_to_my_photo_video_deliverable_v18(uuid, text, text, text) to authenticated;
revoke all on function public.v18_photo_video_deliverable_tracking_for_booking(public.bookings) from public, anon, authenticated;
revoke all on function public.save_my_photo_video_deliverable_update_v18(uuid, jsonb) from public, anon;
revoke all on function public.respond_to_my_photo_video_deliverable_v18(uuid, text, text, text) from public, anon;
commit;
