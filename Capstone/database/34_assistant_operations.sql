-- MULTIVENT Phase 5: Assistant provider/service review and cash remittance.
-- Apply after 33_coordinator_scheduling.sql.

begin;

-- Keep an accountable decision timestamp on provider applications. Existing
-- reviewed records remain valid and are not assigned fabricated reviewer data.
alter table public.provider_profiles
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

create index if not exists provider_profiles_review_queue_idx
  on public.provider_profiles (verification_status, created_at desc);

-- Provider-owned profile edits must never be able to forge application or
-- agreement decisions. Authorized review RPCs continue to pass this trigger.
create or replace function public.protect_provider_review_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and new.verification_status <> 'pending' then
      raise exception 'New provider applications must begin in pending review.' using errcode = '42501';
    end if;
    new.rejection_reason := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    if new.terms_accepted then
      new.terms_version := '2026-09-25-commission-v1';
      new.terms_accepted_at := now();
    else
      new.terms_version := null;
      new.terms_accepted_at := null;
    end if;
    return new;
  end if;

  if (
    new.verification_status is distinct from old.verification_status
    or new.rejection_reason is distinct from old.rejection_reason
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
  )
    and auth.role() <> 'service_role'
    and not public.has_permission('providers.approve')
    and not public.has_permission('providers.reject')
  then
    raise exception 'Provider review fields can only be changed by authorized MULTIVENT staff.' using errcode = '42501';
  end if;

  if new.terms_accepted and not old.terms_accepted and auth.role() <> 'service_role' then
    new.terms_version := '2026-09-25-commission-v1';
    new.terms_accepted_at := now();
  elsif not new.terms_accepted and old.terms_accepted and auth.role() <> 'service_role' then
    new.terms_version := null;
    new.terms_accepted_at := null;
  elsif auth.role() <> 'service_role' and (
    new.terms_version is distinct from old.terms_version
    or new.terms_accepted_at is distinct from old.terms_accepted_at
  ) then
    raise exception 'Agreement metadata is recorded by MULTIVENT when terms are accepted.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_provider_review_fields_trigger on public.provider_profiles;
create trigger protect_provider_review_fields_trigger
before insert or update on public.provider_profiles
for each row execute function public.protect_provider_review_fields();
revoke all on function public.protect_provider_review_fields() from public;

create or replace function public.admin_set_provider_verification(
  target_provider_id uuid,
  new_status public.account_status,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  provider_user_id uuid;
  provider_name text;
  previous_status public.account_status;
  agreement_accepted boolean;
  agreement_version text;
begin
  if new_status = 'verified' and not public.has_permission('providers.approve') then
    raise exception 'Provider-approval access is required.' using errcode = '42501';
  elsif new_status = 'disabled' and not public.has_permission('providers.reject') then
    raise exception 'Provider-rejection access is required.' using errcode = '42501';
  elsif not public.has_permission('providers.review') then
    raise exception 'Provider-review access is required.' using errcode = '42501';
  end if;
  if new_status not in ('verified', 'disabled') then
    raise exception 'A provider review must approve or reject the application.';
  end if;
  if new_status = 'disabled' and nullif(trim(reason), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  select provider.user_id, provider.business_name, provider.verification_status,
    provider.terms_accepted, provider.terms_version
  into provider_user_id, provider_name, previous_status,
    agreement_accepted, agreement_version
  from public.provider_profiles provider
  where provider.id = target_provider_id
  for update;

  if provider_user_id is null then raise exception 'Provider application not found.'; end if;
  if previous_status = new_status then raise exception 'The provider application already has this status.'; end if;
  if previous_status not in ('pending', 'disabled') then
    raise exception 'Only pending or rejected provider applications can be reviewed.';
  end if;
  if new_status = 'verified' and (
    not agreement_accepted
    or agreement_version is distinct from '2026-09-25-commission-v1'
  ) then
    raise exception 'The provider must accept the current commission terms before approval.';
  end if;

  update public.provider_profiles
  set verification_status = new_status,
      rejection_reason = case when new_status = 'disabled' then trim(reason) else null end,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = target_provider_id;

  update public.profiles
  set account_status = new_status, updated_at = now()
  where id = provider_user_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when new_status = 'verified' then 'Provider application approved' else 'Provider application needs changes' end,
    case when new_status = 'verified'
      then format('%s is now approved to operate on MULTIVENT.', provider_name)
      else format('%s was not approved. %s', provider_name, trim(reason))
    end,
    'provider_profile', target_provider_id
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'provider.verification.update', 'provider_profile', target_provider_id,
    jsonb_build_object('verification_status', previous_status),
    jsonb_build_object('verification_status', new_status),
    'success', jsonb_build_object('reason', nullif(trim(reason), ''))
  );
end;
$$;

-- Preserve the established two-argument RPC for older deployed web builds.
create or replace function public.admin_set_provider_verification(
  target_provider_id uuid,
  new_status public.account_status
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.admin_set_provider_verification(target_provider_id, new_status, null);
$$;

revoke all on function public.admin_set_provider_verification(uuid, public.account_status, text) from public;
revoke all on function public.admin_set_provider_verification(uuid, public.account_status) from public;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_provider_verification(uuid, public.account_status) to authenticated;

-- Services can only enter the marketplace while the owning provider remains
-- verified. Rejections continue to require actionable feedback.
create or replace function public.admin_review_service(
  target_service_id uuid,
  decision text,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  previous_status text;
  next_status text;
  service_name text;
  provider_user_id uuid;
  provider_verification public.account_status;
  provider_account_status public.account_status;
  reviewed_submission_kind text;
begin
  if decision = 'approved' and not public.has_permission('services.approve') then
    raise exception 'Service-approval access is required.' using errcode = '42501';
  elsif decision = 'declined' and not public.has_permission('services.reject') then
    raise exception 'Service-rejection access is required.' using errcode = '42501';
  elsif not public.has_permission('services.review') then
    raise exception 'Service-review access is required.' using errcode = '42501';
  end if;
  if decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined.';
  end if;
  if decision = 'declined' and nullif(trim(review_note), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  select service.status, service.name, provider.user_id,
    provider.verification_status, profile.account_status, service.submission_kind
  into previous_status, service_name, provider_user_id,
    provider_verification, provider_account_status, reviewed_submission_kind
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  where service.id = target_service_id
  for update of service;

  if previous_status is null then raise exception 'Service not found.'; end if;
  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only services awaiting review or previously declined can be moderated.';
  end if;
  if decision = 'approved' and (
    provider_verification <> 'verified' or provider_account_status <> 'verified'
  ) then
    raise exception 'Only services from a verified, enabled provider can be approved.';
  end if;

  next_status := case when decision = 'approved' then 'active' else 'rejected' end;
  perform set_config('app.service_delete_authorized', 'true', true);
  perform set_config('app.service_snapshot_authorized', 'true', true);

  update public.service_packages
  set is_active = (decision = 'approved'), updated_at = now()
  where service_id = target_service_id;

  update public.services
  set status = next_status,
      moderation_note = nullif(trim(review_note), ''),
      moderated_at = now(),
      moderated_by = auth.uid(),
      last_approved_snapshot = case
        when decision = 'approved' then public.build_service_snapshot(target_service_id)
        else last_approved_snapshot
      end,
      updated_at = now()
  where id = target_service_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'service.review.' || decision, 'service', target_service_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', next_status),
    'success',
    jsonb_build_object('note', nullif(trim(review_note), ''), 'submission_kind', reviewed_submission_kind)
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when decision = 'approved' then 'Service approved' else 'Service needs changes' end,
    case when decision = 'approved'
      then service_name || ' is now visible to clients.'
      else service_name || ' was not approved. ' || trim(review_note)
    end,
    'service', target_service_id
  );
end;
$$;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

-- Verification metadata provides a clear second-person review trail without
-- changing or fabricating historical remittance records.
alter table public.cash_remittances
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists dispute_reason text;

alter table public.cash_remittances
  drop constraint if exists cash_remittances_dispute_reason_check,
  add constraint cash_remittances_dispute_reason_check
    check (char_length(coalesce(dispute_reason, '')) <= 4000);

create index if not exists cash_remittances_event_booking_idx
  on public.cash_remittances (event_id, booking_id, coordinator_id, created_at desc);

create or replace function public.record_cash_remittance(
  target_event_id uuid,
  target_booking_id uuid,
  target_coordinator_id uuid,
  expected_amount numeric,
  received_amount numeric,
  reference_number text default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  existing_row public.cash_remittances%rowtype;
  remittance_id uuid;
  booking_provider_id uuid;
  total_received numeric(12,2);
  next_status text;
begin
  if not public.has_permission('remittance.create') then
    raise exception 'Remittance-entry access is required.' using errcode = '42501';
  end if;
  if expected_amount is null or expected_amount <= 0 then
    raise exception 'The expected amount must be greater than zero.';
  end if;
  if received_amount is null or received_amount < 0 then
    raise exception 'The received amount cannot be negative.';
  end if;
  if received_amount > expected_amount then
    raise exception 'The received amount cannot exceed the expected amount.';
  end if;

  select event.* into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.status <> 'completed' then
    raise exception 'Cash remittance can only be recorded after the event is completed.';
  end if;
  if event_row.coordinator_id is distinct from target_coordinator_id then
    raise exception 'The selected coordinator is not the accepted coordinator for this event.';
  end if;

  if target_booking_id is not null then
    select booking.provider_id into booking_provider_id
    from public.bookings booking
    where booking.id = target_booking_id
      and booking.event_id = target_event_id
      and booking.status not in ('rejected', 'cancelled', 'expired');
    if booking_provider_id is null then
      raise exception 'The selected booking does not belong to this completed event.';
    end if;
  end if;

  select remittance.* into existing_row
  from public.cash_remittances remittance
  where remittance.event_id = target_event_id
    and remittance.coordinator_id = target_coordinator_id
    and remittance.booking_id is not distinct from target_booking_id
    and remittance.status in ('pending', 'partially_remitted')
  order by remittance.created_at desc
  limit 1
  for update;

  if existing_row.id is not null then
    if existing_row.amount_expected <> expected_amount then
      raise exception 'The expected amount must match the existing open remittance (%).', existing_row.amount_expected;
    end if;
    total_received := existing_row.amount_received + received_amount;
    if total_received > existing_row.amount_expected then
      raise exception 'This handoff would exceed the remaining remittance balance.';
    end if;
    next_status := case
      when total_received = 0 then 'pending'
      when total_received < existing_row.amount_expected then 'partially_remitted'
      else 'remitted'
    end;
    update public.cash_remittances
    set amount_received = total_received,
        received_at = case when total_received > 0 then now() else received_at end,
        received_by = auth.uid(),
        status = next_status,
        reference_number = coalesce(nullif(trim(reference_number), ''), existing_row.reference_number),
        notes = coalesce(nullif(trim(notes), ''), existing_row.notes),
        updated_at = now()
    where id = existing_row.id
    returning id into remittance_id;
  else
    total_received := received_amount;
    next_status := case
      when total_received = 0 then 'pending'
      when total_received < expected_amount then 'partially_remitted'
      else 'remitted'
    end;
    insert into public.cash_remittances (
      event_id, booking_id, coordinator_id, amount_expected, amount_received,
      received_at, received_by, status, reference_number, notes
    ) values (
      target_event_id, target_booking_id, target_coordinator_id,
      expected_amount, total_received,
      case when total_received > 0 then now() end, auth.uid(), next_status,
      nullif(trim(reference_number), ''), nullif(trim(notes), '')
    ) returning id into remittance_id;
  end if;

  if total_received > 0 then
    update public.financial_transactions
    set gross_amount = total_received,
        amount_received = total_received,
        status = next_status,
        transaction_at = now(),
        updated_at = now()
    where metadata ->> 'cash_remittance_id' = remittance_id::text;

    if not found then
      insert into public.financial_transactions (
        booking_id, event_id, provider_id, transaction_type, payment_method,
        gross_amount, commission_rate, commission_amount, provider_net_amount,
        amount_received, amount_released, status, transaction_at, metadata
      ) values (
        target_booking_id, target_event_id, booking_provider_id,
        'provider_remittance', 'cash', total_received, 0, 0, 0,
        total_received, 0, next_status, now(),
        jsonb_build_object('cash_remittance_id', remittance_id)
      );
    end if;
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    target_coordinator_id,
    'Cash remittance recorded',
    format('MULTIVENT recorded a cash handoff of PHP %s for %s.',
      to_char(received_amount, 'FM999,999,999,990.00'), event_row.name),
    'cash_remittance', remittance_id
  );

  return remittance_id;
end;
$$;

create or replace function public.review_cash_remittance(
  target_remittance_id uuid,
  new_status text,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remittance_row public.cash_remittances%rowtype;
  event_name text;
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Remittance-verification access is required.' using errcode = '42501';
  end if;
  if new_status not in ('verified', 'disputed') then
    raise exception 'Unsupported remittance status.';
  end if;
  if new_status = 'disputed' and nullif(trim(reason), '') is null then
    raise exception 'A dispute reason is required.';
  end if;

  select remittance.* into remittance_row
  from public.cash_remittances remittance
  where remittance.id = target_remittance_id
  for update;

  if remittance_row.id is null then raise exception 'Remittance not found.'; end if;
  if remittance_row.status in ('verified', 'disputed') then
    raise exception 'This remittance has already been reviewed.';
  end if;
  if new_status = 'verified' and (
    remittance_row.status <> 'remitted'
    or remittance_row.amount_received <> remittance_row.amount_expected
  ) then
    raise exception 'Only a fully remitted amount can be verified.';
  end if;

  update public.cash_remittances
  set status = new_status,
      verified_at = now(),
      verified_by = auth.uid(),
      dispute_reason = case when new_status = 'disputed' then trim(reason) else null end,
      updated_at = now()
  where id = target_remittance_id;

  update public.financial_transactions
  set status = new_status, updated_at = now()
  where metadata ->> 'cash_remittance_id' = target_remittance_id::text;

  select event.name into event_name
  from public.events event where event.id = remittance_row.event_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    remittance_row.coordinator_id,
    case when new_status = 'verified' then 'Cash remittance verified' else 'Cash remittance disputed' end,
    case when new_status = 'verified'
      then format('The cash remittance for %s was verified by MULTIVENT.', event_name)
      else format('The cash remittance for %s was disputed. %s', event_name, trim(reason))
    end,
    'cash_remittance', target_remittance_id
  );
end;
$$;

-- Compatibility wrapper for older deployed clients. Disputes intentionally
-- require the new RPC because a reason is mandatory.
create or replace function public.verify_cash_remittance(
  target_remittance_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_status = 'disputed' then
    raise exception 'Use review_cash_remittance and provide a dispute reason.';
  end if;
  perform public.review_cash_remittance(target_remittance_id, new_status, null);
end;
$$;

revoke all on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) from public;
revoke all on function public.review_cash_remittance(uuid, text, text) from public;
revoke all on function public.verify_cash_remittance(uuid, text) from public;
grant execute on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.review_cash_remittance(uuid, text, text) to authenticated;
grant execute on function public.verify_cash_remittance(uuid, text) to authenticated;

comment on column public.provider_profiles.reviewed_at is
  'Time of the most recent provider application decision.';
comment on column public.provider_profiles.reviewed_by is
  'Authorized MULTIVENT staff member who made the most recent provider decision.';
comment on column public.cash_remittances.verified_by is
  'Authorized staff member who verified or disputed the remittance.';
comment on column public.cash_remittances.dispute_reason is
  'Required reason recorded when a cash remittance is disputed.';

commit;
