-- MULTIVENT Revision V14 QA follow-up: a payout hold belongs to its mapped
-- ledger allocation, never to every booking owned by the same provider.

begin;

create or replace function public.create_v14_external_refund_obligation(
  target_ledger_id uuid,
  refund_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_row public.financial_transactions%rowtype;
  payment_row public.payments%rowtype;
  event_row public.events%rowtype;
  refund_id uuid;
  local_today date;
  already_paid_out boolean := false;
  refund_amount numeric(12,2);
  refund_status_value text := 'pending_destination';
begin
  if refund_reason not in ('client_cancellation', 'recipient_declined') then
    raise exception 'Unsupported automatic refund reason.' using errcode = '22023';
  end if;
  select ledger.* into ledger_row
  from public.financial_transactions ledger
  where ledger.id = target_ledger_id
  for update;
  if ledger_row.id is null or ledger_row.transaction_type <> 'booking_payment'
    or ledger_row.status not in ('paid', 'verified')
    or (ledger_row.metadata ->> 'accounting_version' <> 'phase5-v1'
      and ledger_row.metadata ->> 'accountingVersion' <> 'phase5-v1')
  then
    return null;
  end if;

  if exists (
    select 1
    from public.client_wallet_transactions historic_wallet
    where historic_wallet.financial_transaction_id = ledger_row.id
  ) then
    return null;
  end if;

  select payment.* into payment_row
  from public.payments payment
  where payment.id = ledger_row.payment_id
  for update;
  select event.* into event_row
  from public.events event
  where event.id = ledger_row.event_id
  for update;
  if payment_row.id is null or event_row.id is null
    or payment_row.payer_id is distinct from event_row.client_id
    or payment_row.status not in ('paid', 'verified')
  then
    return null;
  end if;

  if refund_reason = 'client_cancellation' then
    local_today := public.phase11_event_local_date(event_row.timezone);
    if event_row.status::text <> 'cancelled' or event_row.event_date is null
      or local_today is null or event_row.event_date <= local_today + 14
    then
      return null;
    end if;
  elsif not (ledger_row.metadata ? 'provider_rejected_at'
      or ledger_row.metadata ? 'coordinator_rejected_at') then
    return null;
  end if;

  refund_amount := round(coalesce(payment_row.amount, 0), 2);
  if refund_amount <= 0 then
    return null;
  end if;

  -- Only a request that actually reserves this particular financial row (or a
  -- recorded release from this row) requires reconciliation. Another booking
  -- from the same provider must not block this client’s eligible refund.
  select ledger_row.amount_released > 0
    or ledger_row.provider_funds_status in ('legacy', 'initial_share_credited', 'payout_pending', 'paid_out')
    or exists (
      select 1
      from public.provider_payout_request_allocations allocation
      join public.provider_payout_requests request
        on request.id = allocation.payout_request_id
      where allocation.financial_transaction_id = ledger_row.id
        and request.status in ('requested', 'processing', 'paid')
    )
  into already_paid_out;

  if already_paid_out then
    refund_status_value := 'requires_reconciliation';
  end if;

  insert into public.client_refund_disbursements (
    client_id, financial_transaction_id, payment_id, event_id, booking_id,
    amount, currency, status, metadata
  ) values (
    event_row.client_id, ledger_row.id, payment_row.id, event_row.id, ledger_row.booking_id,
    refund_amount, coalesce(nullif(payment_row.currency, ''), 'PHP'), refund_status_value,
    jsonb_build_object(
      'accountingModel', 'external_refund_obligation',
      'refundReason', refund_reason,
      'paymentScope', payment_row.payment_scope,
      'paymentSettlementEnvironment', coalesce((
        select settlement.settlement_environment
        from public.payment_settlement_records settlement
        where settlement.payment_id = payment_row.id
      ), 'historical_unclassified'),
      'requiresManualDestination', refund_status_value = 'pending_destination',
      'requiresReconciliation', refund_status_value = 'requires_reconciliation'
    )
  ) on conflict (financial_transaction_id) do update
    set updated_at = public.client_refund_disbursements.updated_at
  returning id into refund_id;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);
  if refund_status_value = 'requires_reconciliation' then
    update public.financial_transactions ledger
    set provider_funds_status = 'disputed_on_hold',
        receivable_reconciliation_required = true,
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'financial_hold', true,
          'financial_hold_reason', 'external_refund_requires_reconciliation',
          'refund_status', 'requires_reconciliation',
          'refund_reason', refund_reason,
          'refund_disbursement_id', refund_id,
          'provider_release', false
        ),
        updated_at = now()
    where ledger.id = ledger_row.id;
  else
    update public.financial_transactions ledger
    set provider_net_amount = 0,
        held_provider_amount = 0,
        provider_funds_status = 'disputed_on_hold',
        receivable_reconciliation_required = false,
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'financial_hold', true,
          'financial_hold_reason', 'external_refund_pending_disbursement',
          'receivable_state', 'refund_pending_disbursement',
          'refund_status', 'pending_destination',
          'refund_reason', refund_reason,
          'refund_amount', refund_amount,
          'refund_disbursement_id', refund_id,
          'provider_release', false
        ),
        updated_at = now()
    where ledger.id = ledger_row.id;
  end if;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    event_row.client_id,
    case when refund_status_value = 'requires_reconciliation'
      then 'Refund requires reconciliation' else 'Refund queued for external disbursement' end,
    case when refund_status_value = 'requires_reconciliation'
      then 'Your refund is recorded and requires financial reconciliation before an external transfer can be completed.'
      else format('PHP %s is recorded as a refund obligation. It is not an in-app wallet balance.',
        to_char(refund_amount, 'FM999,999,999,990.00')) end,
    'refund_disbursement', refund_id
  );

  return refund_id;
end;
$$;

revoke all on function public.create_v14_external_refund_obligation(uuid, text) from public;

comment on function public.create_v14_external_refund_obligation(uuid, text) is
  'Creates an external V14 refund obligation only when the affected ledger row meets policy; unrelated provider payouts never broaden its hold.';

commit;
