-- MULTIVENT Revision V15, Phase 5: the agreed menu after a completed food
-- tasting.  The preliminary menu is never overwritten; each provider
-- submission is retained as a revision and only the client can finalize it.

begin;

create table if not exists public.catering_food_tasting_menu_revisions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  revision integer not null check (revision > 0),
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  final_menu jsonb not null,
  provider_unit_price numeric(12,2) not null check (provider_unit_price > 0),
  provider_amount numeric(12,2) not null check (provider_amount > 0),
  customer_amount numeric(12,2) not null check (customer_amount > 0),
  commission_rate numeric(7,6) not null check (commission_rate >= 0),
  status text not null check (status in ('submitted', 'correction_requested', 'client_confirmed')),
  provider_submitted_at timestamptz not null default now(),
  client_responded_at timestamptz,
  client_correction_note text,
  constraint catering_food_tasting_menu_revisions_booking_revision_key unique (booking_id, revision),
  constraint catering_food_tasting_menu_revisions_final_menu_object_check check (jsonb_typeof(final_menu) = 'object')
);

create index if not exists catering_food_tasting_menu_revisions_booking_idx
  on public.catering_food_tasting_menu_revisions (booking_id, revision desc);
alter table public.catering_food_tasting_menu_revisions enable row level security;

drop policy if exists "Food tasting participants can view final menu revisions"
  on public.catering_food_tasting_menu_revisions;
create policy "Food tasting participants can view final menu revisions"
  on public.catering_food_tasting_menu_revisions for select to authenticated using (
    client_id = auth.uid() or exists (
      select 1 from public.provider_profiles provider
      where provider.id = catering_food_tasting_menu_revisions.provider_id
        and provider.user_id = auth.uid()
    )
  );

alter table public.catering_food_tasting_workflows
  add column if not exists final_menu jsonb,
  add column if not exists final_menu_revision integer,
  add column if not exists final_menu_provider_unit_price numeric(12,2),
  add column if not exists final_menu_provider_amount numeric(12,2),
  add column if not exists final_menu_customer_amount numeric(12,2),
  add column if not exists final_menu_submitted_at timestamptz,
  add column if not exists final_menu_client_confirmed_at timestamptz,
  add column if not exists final_menu_correction_note text;

-- The client supplies only IDs.  They must be a subset of the immutable
-- preliminary tasting menu and must exactly meet each course's final limit.
create or replace function public.submit_my_v15_food_tasting_final_menu(
  target_booking_id uuid,
  target_final_item_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_row public.catering_food_tasting_workflows%rowtype;
  booking_row public.bookings%rowtype;
  tasting_row public.catering_food_tastings%rowtype;
  provider_row public.provider_profiles%rowtype;
  course_row jsonb;
  item_row jsonb;
  selected_ids text[] := '{}'::text[];
  recognized_ids text[] := '{}'::text[];
  final_courses jsonb := '[]'::jsonb;
  final_items jsonb;
  final_limit integer;
  selected_count integer;
  unit_price numeric(12,2) := 0;
  provider_amount_value numeric(12,2);
  customer_amount_value numeric(12,2);
  commission_rate_value numeric(7,6);
  next_revision integer;
  provider_user_id uuid;
begin
  if jsonb_typeof(coalesce(target_final_item_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'Final menu dishes must be an array.' using errcode = '22023';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into selected_ids
  from jsonb_array_elements_text(target_final_item_ids) item(value);
  if cardinality(selected_ids) <> cardinality(array(select distinct unnest(selected_ids))) then
    raise exception 'A final-menu dish can only be selected once.' using errcode = '22023';
  end if;

  select workflow.* into workflow_row
  from public.catering_food_tasting_workflows workflow
  join public.provider_profiles provider on provider.id = workflow.provider_id
  where workflow.booking_id = target_booking_id and provider.user_id = auth.uid()
  for update of workflow;
  if workflow_row.booking_id is null then
    raise exception 'This food tasting is not available to your account.' using errcode = '42501';
  end if;
  if workflow_row.status not in ('scheduled', 'completed', 'final_menu_pending') then
    raise exception 'This food tasting is not ready for final-menu submission.' using errcode = '22023';
  end if;

  select * into booking_row from public.bookings where id = workflow_row.booking_id for update;
  if booking_row.status not in ('approved', 'confirmed') then
    raise exception 'The catering booking must be accepted before finalizing its menu.' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments payment where payment.booking_id = booking_row.id
    and payment.status in ('paid', 'verified', 'processing')) then
    raise exception 'A paid or processing booking menu cannot be changed.' using errcode = '22023';
  end if;

  select * into tasting_row from public.catering_food_tastings
  where id = workflow_row.scheduled_tasting_id for update;
  if tasting_row.id is null or tasting_row.status not in ('confirmed', 'completed') then
    raise exception 'A confirmed food tasting appointment is required before finalizing the menu.' using errcode = '22023';
  end if;
  if tasting_row.status <> 'completed'
    and tasting_row.scheduled_date > ((now() at time zone coalesce(nullif(tasting_row.timezone, ''), 'Asia/Manila'))::date) then
    raise exception 'The food tasting appointment has not occurred yet.' using errcode = '22023';
  end if;

  for course_row in select value from jsonb_array_elements(workflow_row.preliminary_menu -> 'courses')
  loop
    final_limit := nullif(course_row ->> 'finalSelectionLimit', '')::integer;
    if final_limit is null or final_limit < 1 then
      raise exception 'The preliminary tasting menu has an invalid final-menu limit.';
    end if;
    selected_count := 0;
    final_items := '[]'::jsonb;
    for item_row in select value from jsonb_array_elements(course_row -> 'selectedItems')
    loop
      if item_row ->> 'id' = any(selected_ids) then
        recognized_ids := recognized_ids || (item_row ->> 'id');
        selected_count := selected_count + 1;
        unit_price := unit_price + coalesce(nullif(item_row ->> 'pricePerHead', '')::numeric, 0);
        final_items := final_items || jsonb_build_array(item_row);
      end if;
    end loop;
    if selected_count <> final_limit then
      raise exception 'Choose exactly % final dish(es) for %.', final_limit, course_row ->> 'courseName'
        using errcode = '22023';
    end if;
    final_courses := final_courses || jsonb_build_array(jsonb_build_object(
      'courseId', course_row ->> 'courseId',
      'courseName', course_row ->> 'courseName',
      'finalSelectionLimit', final_limit,
      'selectedItems', final_items
    ));
  end loop;
  if cardinality(recognized_ids) <> cardinality(selected_ids) then
    raise exception 'Every final dish must come from the client''s preliminary tasting menu.' using errcode = '22023';
  end if;
  if unit_price <= 0 then raise exception 'The final menu has no valid per-head price.' using errcode = '22023'; end if;

  unit_price := round(unit_price, 2);
  provider_amount_value := round(unit_price * workflow_row.guest_count, 2);
  commission_rate_value := public.get_public_commission_rate();
  customer_amount_value := round(provider_amount_value * (1 + commission_rate_value), 2);
  select coalesce(max(revision), 0) + 1 into next_revision
  from public.catering_food_tasting_menu_revisions where booking_id = workflow_row.booking_id;

  insert into public.catering_food_tasting_menu_revisions (
    booking_id, revision, provider_id, client_id, final_menu, provider_unit_price,
    provider_amount, customer_amount, commission_rate, status
  ) values (
    workflow_row.booking_id, next_revision, workflow_row.provider_id, workflow_row.client_id,
    jsonb_build_object('courses', final_courses, 'guestCount', workflow_row.guest_count), unit_price,
    provider_amount_value, customer_amount_value, commission_rate_value, 'submitted'
  );

  update public.catering_food_tasting_workflows set
    status = 'client_confirmation_required', final_menu = jsonb_build_object('courses', final_courses, 'guestCount', workflow_row.guest_count),
    final_menu_revision = next_revision, final_menu_provider_unit_price = unit_price,
    final_menu_provider_amount = provider_amount_value, final_menu_customer_amount = customer_amount_value,
    final_menu_submitted_at = now(), final_menu_client_confirmed_at = null,
    final_menu_correction_note = null, updated_at = now()
  where booking_id = workflow_row.booking_id;

  -- These values are an unapproved quote until the client confirms; a zero
  -- payment is never created and the eligibility function still blocks it.
  update public.bookings set
    amount = customer_amount_value, provider_amount = provider_amount_value,
    commission_amount = round(customer_amount_value - provider_amount_value, 2),
    commission_rate = commission_rate_value,
    catering_option_id = 'food-tasting-final-menu', catering_option_name = 'Food tasting final menu',
    catering_option_snapshot = jsonb_build_object('foodTastingPreference', true, 'finalMenu', jsonb_build_object('courses', final_courses, 'guestCount', workflow_row.guest_count), 'finalMenuRevision', next_revision, 'clientConfirmed', false),
    updated_at = now()
  where id = workflow_row.booking_id;
  update public.event_service_selections set
    estimated_amount = customer_amount_value, attendee_count = workflow_row.guest_count,
    budget_per_head = round(customer_amount_value / greatest(workflow_row.guest_count, 1), 2),
    catering_option_id = 'food-tasting-final-menu', catering_option_name = 'Food tasting final menu',
    catering_option_snapshot = jsonb_build_object('foodTastingPreference', true, 'finalMenu', jsonb_build_object('courses', final_courses, 'guestCount', workflow_row.guest_count), 'finalMenuRevision', next_revision, 'clientConfirmed', false),
    selected_provider_snapshot = coalesce(selected_provider_snapshot, '{}'::jsonb) || jsonb_build_object('providerAmount', provider_amount_value, 'commissionAmount', round(customer_amount_value - provider_amount_value, 2), 'commissionRate', commission_rate_value, 'pricingVersion', 'v15-food-tasting-final-menu-v1'),
    updated_at = now()
  where event_id = workflow_row.event_id and service_id = workflow_row.service_id
    and client_id = workflow_row.client_id and status not in ('declined', 'cancelled');

  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = workflow_row.provider_id;
  update public.catering_food_tastings set status = 'completed', updated_at = now()
  where id = tasting_row.id and status = 'confirmed';
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (workflow_row.client_id, 'Your Final Catering Menu Is Ready!',
    'Review the menu selected during your food tasting and confirm it before payment can continue.',
    'booking', workflow_row.booking_id);
  return jsonb_build_object('revision', next_revision, 'customerAmount', customer_amount_value, 'providerAmount', provider_amount_value);
end;
$$;

create or replace function public.respond_to_my_v15_food_tasting_final_menu(
  target_booking_id uuid,
  accept_menu boolean,
  correction_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_row public.catering_food_tasting_workflows%rowtype;
  revision_row public.catering_food_tasting_menu_revisions%rowtype;
  note_value text := nullif(left(trim(coalesce(correction_note, '')), 600), '');
  provider_user_id uuid;
begin
  select * into workflow_row from public.catering_food_tasting_workflows workflow
  where workflow.booking_id = target_booking_id and workflow.client_id = auth.uid() for update;
  if workflow_row.booking_id is null then raise exception 'This food tasting is not available to your account.' using errcode = '42501'; end if;
  if workflow_row.status <> 'client_confirmation_required' or workflow_row.final_menu_revision is null then
    raise exception 'There is no final menu awaiting your confirmation.' using errcode = '22023';
  end if;
  if not accept_menu and note_value is null then
    raise exception 'Tell the caterer what needs to be corrected.' using errcode = '22023';
  end if;
  select * into revision_row from public.catering_food_tasting_menu_revisions revision
  where revision.booking_id = workflow_row.booking_id and revision.revision = workflow_row.final_menu_revision for update;
  if revision_row.id is null or revision_row.status <> 'submitted' then
    raise exception 'This final menu is no longer awaiting your response.' using errcode = '22023';
  end if;
  select provider.user_id into provider_user_id from public.provider_profiles provider where provider.id = workflow_row.provider_id;
  if accept_menu then
    update public.catering_food_tasting_menu_revisions set status = 'client_confirmed', client_responded_at = now()
    where id = revision_row.id;
    update public.catering_food_tasting_workflows set status = 'finalized', final_menu_client_confirmed_at = now(), updated_at = now()
    where booking_id = workflow_row.booking_id;
    update public.bookings set catering_option_snapshot = coalesce(catering_option_snapshot, '{}'::jsonb)
      || jsonb_build_object('clientConfirmed', true, 'clientConfirmedAt', now()), updated_at = now()
    where id = workflow_row.booking_id;
    update public.event_service_selections set catering_option_snapshot = coalesce(catering_option_snapshot, '{}'::jsonb)
      || jsonb_build_object('clientConfirmed', true, 'clientConfirmedAt', now()), updated_at = now()
    where event_id = workflow_row.event_id and service_id = workflow_row.service_id
      and client_id = workflow_row.client_id and status not in ('declined', 'cancelled');
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (provider_user_id, 'Final catering menu confirmed', 'Your client confirmed the final menu. Payment eligibility will now be rechecked.', 'booking', workflow_row.booking_id);
  else
    update public.catering_food_tasting_menu_revisions set status = 'correction_requested', client_responded_at = now(), client_correction_note = note_value
    where id = revision_row.id;
    update public.catering_food_tasting_workflows set status = 'final_menu_pending', final_menu_correction_note = note_value, updated_at = now()
    where booking_id = workflow_row.booking_id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (provider_user_id, 'Final catering menu correction requested', note_value, 'booking', workflow_row.booking_id);
  end if;
  return jsonb_build_object('status', case when accept_menu then 'finalized' else 'final_menu_pending' end);
end;
$$;

create or replace function public.list_my_catering_food_tasting_workflows_v15_phase5(
  target_booking_ids uuid[] default null
)
returns table (
  booking_id uuid, preliminary_menu jsonb, guest_count integer, workflow_status text,
  provider_accepted_at timestamptz, scheduling_window_start_date date, scheduling_window_end_date date,
  scheduled_tasting_id uuid, attendance_status text, attendance_reminder_sent_at timestamptz,
  attendance_confirmed_at timestamptz, provider_no_response_notified_at timestamptz,
  reschedule_attempt_count integer, reschedule_extension_end_date date, expired_at timestamptz,
  fallback_enabled_at timestamptz, fallback_activated_at timestamptz, final_menu jsonb,
  final_menu_revision integer, final_menu_provider_unit_price numeric, final_menu_provider_amount numeric,
  final_menu_customer_amount numeric, final_menu_submitted_at timestamptz,
  final_menu_client_confirmed_at timestamptz, final_menu_correction_note text, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select workflow.booking_id, workflow.preliminary_menu, workflow.guest_count, workflow.status,
    workflow.provider_accepted_at, workflow.scheduling_window_start_date, workflow.scheduling_window_end_date,
    workflow.scheduled_tasting_id, workflow.attendance_status, workflow.attendance_reminder_sent_at,
    workflow.attendance_confirmed_at, workflow.provider_no_response_notified_at,
    workflow.reschedule_attempt_count, workflow.reschedule_extension_end_date, workflow.expired_at,
    workflow.fallback_enabled_at, workflow.fallback_activated_at, workflow.final_menu,
    workflow.final_menu_revision, workflow.final_menu_provider_unit_price, workflow.final_menu_provider_amount,
    workflow.final_menu_customer_amount, workflow.final_menu_submitted_at,
    workflow.final_menu_client_confirmed_at, workflow.final_menu_correction_note, workflow.updated_at
  from public.catering_food_tasting_workflows workflow
  join public.provider_profiles provider on provider.id = workflow.provider_id
  where auth.uid() is not null
    and (target_booking_ids is null or workflow.booking_id = any(target_booking_ids))
    and (workflow.client_id = auth.uid() or provider.user_id = auth.uid())
  order by workflow.updated_at desc, workflow.booking_id desc;
$$;

revoke all on function public.submit_my_v15_food_tasting_final_menu(uuid, jsonb) from public;
revoke all on function public.respond_to_my_v15_food_tasting_final_menu(uuid, boolean, text) from public;
revoke all on function public.list_my_catering_food_tasting_workflows_v15_phase5(uuid[]) from public;
grant execute on function public.submit_my_v15_food_tasting_final_menu(uuid, jsonb) to authenticated;
grant execute on function public.respond_to_my_v15_food_tasting_final_menu(uuid, boolean, text) to authenticated;
grant execute on function public.list_my_catering_food_tasting_workflows_v15_phase5(uuid[]) to authenticated;

comment on table public.catering_food_tasting_menu_revisions is
  'Immutable V15 provider final-menu proposals and client approval/correction history.';
commit;
