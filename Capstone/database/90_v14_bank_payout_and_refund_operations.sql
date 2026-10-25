-- MULTIVENT Revision V14, Phase 6: externally settled payouts and refunds.
--
-- This migration extends the existing allocation-mapped payout request flow.
-- It does not create stored-value balances, change payment percentages, or
-- initiate a bank transfer. A staff member must record each verified external
-- outcome after the actual bank/e-wallet action has occurred.

begin;

-- One disbursement is created only after a provider's already-protected payout
-- request is reviewed. The provider request remains the authoritative record
-- of its source allocations; this table records the separate external bank
-- workflow and never stores a full account number.
create table if not exists public.provider_payout_disbursements (
  id uuid primary key default gen_random_uuid(),
  payout_request_id uuid not null unique
    references public.provider_payout_requests(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  payout_account_id uuid references public.provider_payout_accounts(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  disbursement_channel text not null
    check (disbursement_channel in ('bank_transfer', 'e_wallet')),
  destination_institution text not null,
  destination_account_name text not null,
  destination_account_last4 text not null,
  status text not null default 'approved'
    check (status in ('approved', 'processing', 'completed', 'failed', 'cancelled')),
  external_reference text,
  approved_at timestamptz not null default now(),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  processing_at timestamptz,
  processing_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_payout_disbursements_reference_check check (
    external_reference is null or char_length(trim(external_reference)) >= 4
  )
);

create index if not exists provider_payout_disbursements_status_idx
  on public.provider_payout_disbursements (status, created_at desc);
create index if not exists provider_payout_disbursements_provider_idx
  on public.provider_payout_disbursements (provider_id, created_at desc);

alter table public.provider_payout_disbursements enable row level security;
revoke all on table public.provider_payout_disbursements from anon, authenticated;

-- The status log makes manual payouts and manual refunds independently
-- auditable. It stores an external reference only for authorized operational
-- review and is never returned to a mobile client.
create table if not exists public.external_disbursement_audit_events (
  id uuid primary key default gen_random_uuid(),
  operation_kind text not null check (operation_kind in ('provider_payout', 'client_refund')),
  payout_disbursement_id uuid references public.provider_payout_disbursements(id) on delete restrict,
  refund_disbursement_id uuid references public.client_refund_disbursements(id) on delete restrict,
  action text not null,
  external_reference text,
  note text,
  acted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint external_disbursement_audit_target_check check (
    (payout_disbursement_id is not null and refund_disbursement_id is null)
    or (payout_disbursement_id is null and refund_disbursement_id is not null)
  )
);

create index if not exists external_disbursement_audit_payout_idx
  on public.external_disbursement_audit_events (payout_disbursement_id, created_at desc)
  where payout_disbursement_id is not null;
create index if not exists external_disbursement_audit_refund_idx
  on public.external_disbursement_audit_events (refund_disbursement_id, created_at desc)
  where refund_disbursement_id is not null;

alter table public.external_disbursement_audit_events enable row level security;
revoke all on table public.external_disbursement_audit_events from anon, authenticated;

-- This predicate rechecks all financial conditions at each staff transition,
-- not just when the provider initially requested a payout. It deliberately
-- uses the existing 14-day eligibility state and allocation reservation
-- calculation rather than introducing another balance source.
create or replace function public.phase14_provider_payout_request_is_bank_eligible(
  target_payout_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.provider_payout_requests%rowtype;
  allocation_row record;
  local_today date;
  is_v14_payment boolean;
  has_verified_settlement boolean;
begin
  select request.* into request_row
  from public.provider_payout_requests request
  where request.id = target_payout_request_id
  for update;

  if request_row.id is null or request_row.status not in ('requested', 'processing') then
    return false;
  end if;

  if not exists (
    select 1 from public.provider_payout_request_allocations allocation
    where allocation.payout_request_id = request_row.id
  ) then
    return false;
  end if;

  -- Locks make an approval/completion mutually exclusive with a cancellation
  -- refund trigger that changes the same financial allocation.
  perform 1
  from public.financial_transactions ledger
  join public.provider_payout_request_allocations allocation
    on allocation.financial_transaction_id = ledger.id
  where allocation.payout_request_id = request_row.id
  for update of ledger;

  for allocation_row in
    select allocation.amount as allocation_amount,
      ledger.id as ledger_id,
      ledger.booking_id,
      ledger.event_id,
      ledger.provider_id,
      ledger.transaction_type,
      ledger.status as ledger_status,
      ledger.provider_funds_status,
      ledger.metadata as ledger_metadata,
      payment.id as payment_id,
      payment.status as payment_status,
      payment.metadata as payment_metadata,
      event.event_date,
      event.timezone,
      event.status as event_status,
      booking.status as booking_status,
      settlement.verification_status as settlement_status
    from public.provider_payout_request_allocations allocation
    join public.financial_transactions ledger on ledger.id = allocation.financial_transaction_id
    join public.payments payment on payment.id = ledger.payment_id
    join public.events event on event.id = ledger.event_id
    left join public.bookings booking on booking.id = ledger.booking_id
    left join public.payment_settlement_records settlement on settlement.payment_id = payment.id
    where allocation.payout_request_id = request_row.id
    order by allocation.id
  loop
    if allocation_row.provider_id is distinct from request_row.provider_id
      or allocation_row.transaction_type <> 'booking_payment'
      or allocation_row.ledger_status not in ('paid', 'verified')
      or allocation_row.provider_funds_status not in ('available_for_payout', 'legacy', 'initial_share_credited')
      or allocation_row.event_date is null
      or allocation_row.event_status::text in ('cancelled', 'completed')
      or allocation_row.booking_id is null
      or allocation_row.booking_status::text not in ('confirmed', 'completed')
      or public.phase11_has_refund_or_financial_hold(coalesce(allocation_row.ledger_metadata, '{}'::jsonb))
      or exists (
        select 1 from public.client_refund_disbursements refund
        where refund.financial_transaction_id = allocation_row.ledger_id
      )
      or allocation_row.allocation_amount > public.phase11_provider_allocation_available_amount(
        allocation_row.ledger_id, request_row.provider_id, request_row.id
      )
    then
      return false;
    end if;

    local_today := public.phase11_event_local_date(allocation_row.timezone);
    if local_today is null or local_today < allocation_row.event_date - 14 then
      return false;
    end if;

    is_v14_payment := coalesce(allocation_row.payment_metadata ->> 'bookingFlowVersion', '') = 'v14-phase4';
    has_verified_settlement := allocation_row.settlement_status = 'verified';
    if is_v14_payment then
      if allocation_row.payment_status <> 'verified' or not has_verified_settlement then
        return false;
      end if;
    elsif allocation_row.payment_status not in ('paid', 'verified') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- Staff approval does not move money. It creates an auditable instruction for
-- an external transfer and snapshots only the masked payout destination.
create or replace function public.approve_v14_provider_bank_payout(
  target_payout_request_id uuid,
  review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.provider_payout_requests%rowtype;
  account_row public.provider_payout_accounts%rowtype;
  disbursement_id uuid;
  normalized_note text := nullif(trim(review_note), '');
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if char_length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'The payout review note cannot exceed 2,000 characters.' using errcode = '22023';
  end if;

  select request.* into request_row
  from public.provider_payout_requests request
  where request.id = target_payout_request_id
  for update;
  if request_row.id is null then
    raise exception 'Payout request not found.' using errcode = 'P0002';
  end if;
  if request_row.status <> 'requested' then
    raise exception 'Only a requested payout can be approved.' using errcode = '42501';
  end if;
  if not public.phase14_provider_payout_request_is_bank_eligible(request_row.id) then
    raise exception 'This payout request is no longer eligible for bank disbursement.' using errcode = '42501';
  end if;

  select account.* into account_row
  from public.provider_payout_accounts account
  where account.provider_id = request_row.provider_id
    and account.ownership_confirmed
  for update;
  if account_row.id is null then
    raise exception 'The provider no longer has a confirmed payout account.' using errcode = '42501';
  end if;

  perform set_config('app.phase11_payout_request_authorized', 'true', true);
  update public.provider_payout_requests request
  set status = 'processing',
      notes = coalesce(request.notes || E'\n', '') || 'Approved for external disbursement.',
      updated_at = now()
  where request.id = request_row.id;

  insert into public.provider_payout_disbursements (
    payout_request_id, provider_id, payout_account_id, amount, currency,
    disbursement_channel, destination_institution, destination_account_name,
    destination_account_last4, status, approved_by, notes, metadata
  ) values (
    request_row.id, request_row.provider_id, account_row.id, request_row.amount,
    request_row.currency,
    case when account_row.account_type = 'e_wallet' then 'e_wallet' else 'bank_transfer' end,
    account_row.institution_name, account_row.account_name, right(account_row.account_number, 4),
    'approved', auth.uid(), normalized_note,
    jsonb_build_object('accountingModel', 'external_bank_disbursement', 'payoutRequestStatus', 'processing')
  ) returning id into disbursement_id;

  insert into public.external_disbursement_audit_events (
    operation_kind, payout_disbursement_id, action, note, acted_by
  ) values ('provider_payout', disbursement_id, 'approved', normalized_note, auth.uid());

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select provider.user_id, 'Payout approved',
    format('Your payout request for PHP %s has been approved for external disbursement.',
      to_char(request_row.amount, 'FM999,999,999,990.00')),
    'provider_payout_disbursement', disbursement_id
  from public.provider_profiles provider where provider.id = request_row.provider_id;

  return jsonb_build_object('payoutRequestId', request_row.id, 'disbursementId', disbursement_id, 'status', 'approved');
end;
$$;

-- Starting the transfer is a deliberate, separately recorded operator action.
create or replace function public.start_v14_provider_bank_payout(
  target_disbursement_id uuid,
  processing_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  disbursement_row public.provider_payout_disbursements%rowtype;
  normalized_note text := nullif(trim(processing_note), '');
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if char_length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'The payout processing note cannot exceed 2,000 characters.' using errcode = '22023';
  end if;

  select disbursement.* into disbursement_row
  from public.provider_payout_disbursements disbursement
  where disbursement.id = target_disbursement_id
  for update;
  if disbursement_row.id is null then
    raise exception 'Payout disbursement not found.' using errcode = 'P0002';
  end if;
  if disbursement_row.status <> 'approved' then
    raise exception 'Only an approved payout can enter processing.' using errcode = '42501';
  end if;
  if not public.phase14_provider_payout_request_is_bank_eligible(disbursement_row.payout_request_id) then
    raise exception 'This payout is no longer eligible for bank processing.' using errcode = '42501';
  end if;

  update public.provider_payout_disbursements disbursement
  set status = 'processing', processing_at = now(), processing_by = auth.uid(),
      notes = coalesce(disbursement.notes || E'\n', '') || coalesce(normalized_note, 'External transfer started.'),
      updated_at = now()
  where disbursement.id = disbursement_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, payout_disbursement_id, action, note, acted_by
  ) values ('provider_payout', disbursement_row.id, 'processing', normalized_note, auth.uid());

  return jsonb_build_object('disbursementId', disbursement_row.id, 'status', 'processing');
end;
$$;

-- Completion is the only point at which a provider allocation is marked paid
-- out. It requires a real bank/processor reference and releases only the
-- allocations mapped to this one payout request.
create or replace function public.complete_v14_provider_bank_payout(
  target_disbursement_id uuid,
  external_reference_value text,
  completion_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  disbursement_row public.provider_payout_disbursements%rowtype;
  allocation_row record;
  reference_value text := nullif(trim(external_reference_value), '');
  normalized_note text := nullif(trim(completion_note), '');
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if reference_value is null or char_length(reference_value) < 4 then
    raise exception 'A bank or processor reference is required before completing a payout.' using errcode = '22023';
  end if;
  if char_length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'The payout completion note cannot exceed 2,000 characters.' using errcode = '22023';
  end if;

  select disbursement.* into disbursement_row
  from public.provider_payout_disbursements disbursement
  where disbursement.id = target_disbursement_id
  for update;
  if disbursement_row.id is null then
    raise exception 'Payout disbursement not found.' using errcode = 'P0002';
  end if;
  if disbursement_row.status <> 'processing' then
    raise exception 'Only a processing payout can be completed.' using errcode = '42501';
  end if;
  if not public.phase14_provider_payout_request_is_bank_eligible(disbursement_row.payout_request_id) then
    raise exception 'This payout is no longer eligible for completion.' using errcode = '42501';
  end if;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);
  perform set_config('app.phase11_payout_request_authorized', 'true', true);

  for allocation_row in
    select allocation.amount, ledger.id as ledger_id
    from public.provider_payout_request_allocations allocation
    join public.financial_transactions ledger on ledger.id = allocation.financial_transaction_id
    where allocation.payout_request_id = disbursement_row.payout_request_id
    order by allocation.id
    for update of ledger
  loop
    update public.financial_transactions ledger
    set amount_released = ledger.amount_released + allocation_row.amount,
        provider_funds_status = case
          when ledger.amount_released + allocation_row.amount >= ledger.provider_net_amount then 'paid_out'
          else 'available_for_payout'
        end,
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'receivable_state', case when ledger.amount_released + allocation_row.amount >= ledger.provider_net_amount
            then 'paid_out' else 'available_for_payout' end,
          'external_payout_released', true,
          'external_payout_disbursement_id', disbursement_row.id,
          'external_payout_reference', reference_value,
          'external_payout_completed_at', now()
        ),
        updated_at = now()
    where ledger.id = allocation_row.ledger_id;
  end loop;

  update public.provider_payout_requests request
  set status = 'paid', processed_at = now(),
      notes = coalesce(request.notes || E'\n', '') || 'External disbursement completed.',
      updated_at = now()
  where request.id = disbursement_row.payout_request_id;

  update public.provider_payout_disbursements disbursement
  set status = 'completed', external_reference = reference_value,
      completed_at = now(), completed_by = auth.uid(),
      notes = coalesce(disbursement.notes || E'\n', '') || coalesce(normalized_note, 'External transfer completed.'),
      metadata = metadata || jsonb_build_object('completedReferenceRecordedAt', now()),
      updated_at = now()
  where disbursement.id = disbursement_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, payout_disbursement_id, action, external_reference, note, acted_by
  ) values ('provider_payout', disbursement_row.id, 'completed', reference_value, normalized_note, auth.uid());

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select provider.user_id, 'Payout completed',
    format('Your external payout of PHP %s has been recorded as completed.',
      to_char(disbursement_row.amount, 'FM999,999,999,990.00')),
    'provider_payout_disbursement', disbursement_row.id
  from public.provider_profiles provider where provider.id = disbursement_row.provider_id;

  return jsonb_build_object('disbursementId', disbursement_row.id, 'status', 'completed', 'externalReference', reference_value);
end;
$$;

-- A failed or cancelled external attempt never releases the source ledger.
-- The request is closed so its reservations no longer block a corrected future
-- provider request, while the original receivable stays protected.
create or replace function public.fail_v14_provider_bank_payout(
  target_disbursement_id uuid,
  failure_status text,
  failure_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  disbursement_row public.provider_payout_disbursements%rowtype;
  normalized_note text := nullif(trim(failure_note), '');
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if failure_status not in ('failed', 'cancelled') then
    raise exception 'Use failed or cancelled for an unsuccessful payout.' using errcode = '22023';
  end if;
  if char_length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'The payout failure note cannot exceed 2,000 characters.' using errcode = '22023';
  end if;

  select disbursement.* into disbursement_row
  from public.provider_payout_disbursements disbursement
  where disbursement.id = target_disbursement_id
  for update;
  if disbursement_row.id is null then
    raise exception 'Payout disbursement not found.' using errcode = 'P0002';
  end if;
  if disbursement_row.status not in ('approved', 'processing') then
    raise exception 'Only an approved or processing payout can be closed without payment.' using errcode = '42501';
  end if;

  perform set_config('app.phase11_payout_request_authorized', 'true', true);
  update public.provider_payout_requests request
  set status = case when failure_status = 'cancelled' then 'cancelled' else 'rejected' end,
      notes = coalesce(request.notes || E'\n', '') || coalesce(normalized_note, 'External disbursement was not completed.'),
      updated_at = now()
  where request.id = disbursement_row.payout_request_id;

  update public.provider_payout_disbursements disbursement
  set status = failure_status,
      notes = coalesce(disbursement.notes || E'\n', '') || coalesce(normalized_note, 'External disbursement was not completed.'),
      updated_at = now()
  where disbursement.id = disbursement_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, payout_disbursement_id, action, note, acted_by
  ) values ('provider_payout', disbursement_row.id, failure_status, normalized_note, auth.uid());

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  select provider.user_id, 'Payout needs attention',
    'Your payout was not completed. Your receivable remains protected while MULTIVENT reviews the transfer.',
    'provider_payout_disbursement', disbursement_row.id
  from public.provider_profiles provider where provider.id = disbursement_row.provider_id;

  return jsonb_build_object('disbursementId', disbursement_row.id, 'status', failure_status);
end;
$$;

-- Phase 5 introduced an external refund record. This replacement keeps its
-- public signature but makes the authorized operational sequence explicit:
-- destination confirmed -> processing -> completed with a bank reference.
-- It cannot turn the original payment into a fake "refunded" payment state.
create or replace function public.record_v14_refund_disbursement(
  target_refund_id uuid,
  next_status text,
  external_reference_value text default null,
  channel_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  refund_row public.client_refund_disbursements%rowtype;
  reference_value text := nullif(trim(external_reference_value), '');
  normalized_channel text := lower(coalesce(nullif(trim(channel_value), ''), ''));
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if next_status not in ('pending_disbursement', 'processing', 'completed', 'failed', 'cancelled') then
    raise exception 'Unsupported refund-disbursement status.' using errcode = '22023';
  end if;
  if normalized_channel not in ('', 'bank_transfer', 'e_wallet') then
    raise exception 'Unsupported refund-disbursement channel.' using errcode = '22023';
  end if;
  if next_status = 'completed' and (reference_value is null or char_length(reference_value) < 4) then
    raise exception 'A bank or processor reference is required before completing a refund.' using errcode = '22023';
  end if;

  select refund.* into refund_row
  from public.client_refund_disbursements refund
  where refund.id = target_refund_id
  for update;
  if refund_row.id is null then
    raise exception 'Refund-disbursement record not found.' using errcode = 'P0002';
  end if;
  if refund_row.status = 'completed' then
    if next_status = 'completed' and reference_value = refund_row.external_reference then
      return jsonb_build_object('refundId', refund_row.id, 'status', 'completed', 'externalReference', refund_row.external_reference);
    end if;
    raise exception 'A completed refund-disbursement record is immutable.' using errcode = '42501';
  end if;
  if refund_row.status = 'requires_reconciliation' then
    raise exception 'Resolve the reconciliation hold before processing this refund.' using errcode = '42501';
  end if;

  if (refund_row.status = 'pending_destination' and next_status = 'pending_disbursement'
      and normalized_channel <> '')
    or (refund_row.status = 'pending_disbursement' and next_status = 'processing')
    or (refund_row.status = 'processing' and next_status = 'completed')
    or (refund_row.status in ('pending_destination', 'pending_disbursement', 'processing')
        and next_status in ('failed', 'cancelled'))
  then
    null;
  else
    raise exception 'The requested refund status transition is not allowed.' using errcode = '42501';
  end if;

  update public.client_refund_disbursements refund
  set status = next_status,
      disbursement_channel = case when normalized_channel = '' then refund.disbursement_channel else normalized_channel end,
      external_reference = coalesce(reference_value, refund.external_reference),
      processed_at = case when next_status = 'completed' then now() else refund.processed_at end,
      processed_by = case when next_status = 'completed' then auth.uid() else refund.processed_by end,
      metadata = refund.metadata || jsonb_build_object(
        'lastStatusChangedAt', now(),
        'manualBankWorkflow', true,
        'completionRecordedByAuthorizedOperator', next_status = 'completed'
      ),
      updated_at = now()
  where refund.id = refund_row.id;

  insert into public.external_disbursement_audit_events (
    operation_kind, refund_disbursement_id, action, external_reference, acted_by
  ) values ('client_refund', refund_row.id, next_status, reference_value, auth.uid());

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    refund_row.client_id,
    case next_status when 'completed' then 'Refund disbursement completed'
      when 'processing' then 'Refund disbursement is processing'
      when 'failed' then 'Refund disbursement needs attention'
      when 'cancelled' then 'Refund disbursement cancelled'
      else 'Refund ready for external disbursement' end,
    case next_status when 'completed' then 'Your external refund transfer has been recorded as completed.'
      when 'processing' then 'Your external refund transfer is being processed.'
      when 'failed' then 'Your external refund transfer could not be completed. MULTIVENT will review the payout details.'
      when 'cancelled' then 'Your external refund transfer was cancelled and requires review.'
      else 'Your refund destination was confirmed for authorized bank or e-wallet disbursement.' end,
    'refund_disbursement', refund_row.id
  );

  return jsonb_build_object('refundId', refund_row.id, 'status', next_status,
    'externalReference', coalesce(reference_value, refund_row.external_reference));
end;
$$;

revoke all on function public.phase14_provider_payout_request_is_bank_eligible(uuid) from public;
revoke all on function public.approve_v14_provider_bank_payout(uuid, text) from public;
revoke all on function public.start_v14_provider_bank_payout(uuid, text) from public;
revoke all on function public.complete_v14_provider_bank_payout(uuid, text, text) from public;
revoke all on function public.fail_v14_provider_bank_payout(uuid, text, text) from public;
revoke all on function public.record_v14_refund_disbursement(uuid, text, text, text) from public;

-- These procedures remain permission-gated: the mobile provider can request a
-- payout, but cannot approve, start, fail, or complete any external transfer.
grant execute on function public.approve_v14_provider_bank_payout(uuid, text) to authenticated;
grant execute on function public.start_v14_provider_bank_payout(uuid, text) to authenticated;
grant execute on function public.complete_v14_provider_bank_payout(uuid, text, text) to authenticated;
grant execute on function public.fail_v14_provider_bank_payout(uuid, text, text) to authenticated;
grant execute on function public.record_v14_refund_disbursement(uuid, text, text, text) to authenticated;

comment on table public.provider_payout_disbursements is
  'Auditable external bank/e-wallet instructions for allocation-mapped provider payout requests; no stored-value wallet balance.';
comment on function public.phase14_provider_payout_request_is_bank_eligible(uuid) is
  'Rechecks verified payment, recipient acceptance, 14-day eligibility, payout allocation availability, and all refund/financial holds before each external payout transition.';
comment on function public.complete_v14_provider_bank_payout(uuid, text, text) is
  'Marks only allocation-mapped provider receivables paid out after an authorized operator records a real bank or processor reference.';
comment on function public.record_v14_refund_disbursement(uuid, text, text, text) is
  'Authorized, ordered external refund workflow. It records a disbursement outcome without rewriting the original client payment.';

commit;
