-- MULTIVENT Revision V14, Phase 7: protected financial operations and notifications.
--
-- This migration intentionally does not introduce a payment deadline or an
-- automatic reservation timeout. V14 booking availability is protected by the
-- existing server-authoritative selection checks while requests, accepted
-- bookings, pending settlement, verified payments, refund holds, and payout
-- states remain separately observable.

begin;

create index if not exists payments_v14_flow_status_idx
  on public.payments ((metadata ->> 'bookingFlowVersion'), status, created_at desc);

-- The existing payment-confirmation notification remains the client-facing
-- payment-available event. This trigger records the later authoritative
-- settlement outcome and lets the established notification-to-push pipeline
-- deliver it to the right participants. It never trusts a client reference.
create or replace function public.notify_v14_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  booking_row public.bookings%rowtype;
  all_event_payments_verified boolean := false;
begin
  if old.status is not distinct from new.status
    or coalesce(new.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4'
    or new.status not in ('verified', 'failed', 'cancelled')
  then
    return new;
  end if;

  select event.* into event_row
  from public.events event
  where event.id = new.event_id;

  if event_row.id is null then
    return new;
  end if;

  if new.status = 'verified' then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      'Payment verified',
      format('MULTIVENT verified your payment for %s.', event_row.name),
      'payment',
      new.id
    );

    if new.booking_id is not null then
      select booking.* into booking_row
      from public.bookings booking
      where booking.id = new.booking_id;

      if booking_row.id is not null then
        insert into public.notifications (user_id, title, body, resource_type, resource_id)
        select provider.user_id,
          'Client payment verified',
          format('MULTIVENT verified the client payment for %s.', event_row.name),
          'booking', booking_row.id
        from public.provider_profiles provider
        where provider.id = booking_row.provider_id;
      end if;
    elsif new.coordinator_id is not null then
      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        new.coordinator_id,
        'Client payment verified',
        format('MULTIVENT verified the client payment for %s.', event_row.name),
        'event',
        event_row.id
      );
    end if;

    select not exists (
      select 1
      from public.payments payment
      where payment.event_id = event_row.id
        and coalesce(payment.metadata ->> 'bookingFlowVersion', '') = 'v14-phase4'
        and payment.status <> 'verified'
    ) and exists (
      select 1
      from public.payments payment
      where payment.event_id = event_row.id
        and coalesce(payment.metadata ->> 'bookingFlowVersion', '') = 'v14-phase4'
    ) into all_event_payments_verified;

    if all_event_payments_verified and event_row.status in ('booking', 'payment_required') then
      update public.events
      set status = 'confirmed', updated_at = now()
      where id = event_row.id;

      insert into public.notifications (user_id, title, body, resource_type, resource_id)
      values (
        event_row.client_id,
        'Event reservation confirmed',
        format('All required payments for %s are verified. Your event reservation is confirmed.', event_row.name),
        'event',
        event_row.id
      );
    end if;
  else
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.client_id,
      case when new.status = 'failed' then 'Payment needs attention' else 'Payment cancelled' end,
      case when new.status = 'failed'
        then format('Your payment for %s could not be verified. Please contact MULTIVENT support before trying again.', event_row.name)
        else format('Your payment for %s was cancelled. Your booking requests remain available for review.', event_row.name)
      end,
      'payment',
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists v14_payment_status_notification_trigger on public.payments;
create trigger v14_payment_status_notification_trigger
after update of status on public.payments
for each row execute function public.notify_v14_payment_status_change();

-- The Phase 11 release processor is the authoritative 14-day payout gate.
-- Keep its monetary rules exactly intact, then notify the recipient only when
-- a held allocation actually transitions into available-for-payout state.
create or replace function public.process_phase11_payout_eligibility(
  target_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ledger_row record;
  released_count integer := 0;
  held_count integer := 0;
  released_amount numeric(12,2) := 0;
  released_now numeric(12,2);
  released_provider_id uuid;
  released_coordinator_id uuid;
  released_event_id uuid;
begin
  perform set_config('app.phase11_receivable_release_authorized', 'true', true);

  for ledger_row in
    select ledger.id
    from public.financial_transactions ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.provider_funds_status in ('held_receivable', 'eligible_for_release')
      and ledger.held_provider_amount > 0
      and ledger.provider_net_amount = 0
      and ledger.amount_released = 0
      and (target_event_id is null or ledger.event_id = target_event_id)
      and (ledger.payout_eligible_on is null or ledger.payout_eligible_on <= current_date + 1)
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      )
    order by ledger.payout_eligible_on nulls last, ledger.transaction_at, ledger.id
    for update skip locked
  loop
    if public.phase11_receivable_is_release_eligible(ledger_row.id) then
      update public.financial_transactions ledger
      set provider_net_amount = ledger.provider_net_amount + ledger.held_provider_amount,
          held_provider_amount = 0,
          provider_funds_status = 'available_for_payout',
          provider_credited_at = coalesce(ledger.provider_credited_at, now()),
          metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
            'receivable_state', 'available_for_payout',
            'payout_eligible_on', ledger.payout_eligible_on::text,
            'payout_eligibility_processed_at', now(),
            'payout_eligibility_release', true,
            'external_payout_released', false
          ),
          updated_at = now()
      where ledger.id = ledger_row.id
        and ledger.provider_funds_status in ('held_receivable', 'eligible_for_release')
        and ledger.held_provider_amount > 0
        and ledger.provider_net_amount = 0
        and ledger.amount_released = 0
      returning ledger.provider_net_amount, ledger.provider_id, ledger.coordinator_id, ledger.event_id
      into released_now, released_provider_id, released_coordinator_id, released_event_id;

      if found then
        released_count := released_count + 1;
        released_amount := released_amount + coalesce(released_now, 0);

        if released_provider_id is not null then
          insert into public.notifications (user_id, title, body, resource_type, resource_id)
          select provider.user_id,
            'Payout available',
            format('PHP %s is now available to request for payout.', to_char(released_now, 'FM999,999,999,990.00')),
            'event',
            released_event_id
          from public.provider_profiles provider
          where provider.id = released_provider_id;
        elsif released_coordinator_id is not null then
          insert into public.notifications (user_id, title, body, resource_type, resource_id)
          values (
            released_coordinator_id,
            'Payout available',
            format('PHP %s is now available for your confirmed event assignment.', to_char(released_now, 'FM999,999,999,990.00')),
            'event',
            released_event_id
          );
        end if;
      end if;
    else
      held_count := held_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'releasedCount', released_count,
    'remainingHeldCount', held_count,
    'releasedAmount', released_amount,
    'processedAt', now()
  );
end;
$$;

-- Read-only operations projection for the existing Financial Overview screen.
-- Sensitive bank destinations and authoritative references remain absent from
-- this payload; individual transitions are still protected by remittance.verify.
create or replace function public.get_admin_v14_financial_operations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if not public.has_permission('cashflow.view') then
    raise exception 'Financial reporting access is required.' using errcode = '42501';
  end if;

  with v14_events as (
    select event.id, event.name, event.event_date, event.status, event.client_id,
      public.event_payment_eligibility_v14(event.id) as eligibility
    from public.events event
    where event.status in ('booking', 'payment_required', 'confirmed')
      and exists (
        select 1 from public.bookings booking
        where booking.event_id = event.id
      )
  ), event_readiness as (
    select event.id, event.name, event.event_date, event.status, event.client_id,
      coalesce((event.eligibility ->> 'provider_count')::integer, 0) as provider_count,
      coalesce((event.eligibility ->> 'accepted_provider_count')::integer, 0) as accepted_provider_count,
      coalesce((event.eligibility ->> 'pending_provider_count')::integer, 0) as pending_provider_count,
      coalesce((event.eligibility ->> 'declined_provider_count')::integer, 0) as declined_provider_count,
      coalesce((event.eligibility ->> 'coordinator_required')::boolean, false) as coordinator_required,
      coalesce((event.eligibility ->> 'coordinator_accepted')::boolean, false) as coordinator_accepted,
      coalesce((event.eligibility ->> 'payment_eligible')::boolean, false) as payment_eligible,
      coalesce(event.eligibility ->> 'reason', 'Awaiting booking progress') as reason
    from v14_events event
  ), settlement_payments as (
    select payment.id, payment.event_id, payment.booking_id, payment.coordinator_id,
      payment.amount, payment.currency, payment.provider, payment.status,
      payment.created_at, payment.provider_reference,
      settlement.settlement_environment, settlement.settlement_channel,
      settlement.verification_status, settlement.created_at as settlement_created_at
    from public.payments payment
    join public.payment_settlement_records settlement on settlement.payment_id = payment.id
    where coalesce(payment.metadata ->> 'bookingFlowVersion', '') = 'v14-phase4'
  ), payout_operations as (
    select request.id as payout_request_id, disbursement.id as disbursement_id,
      provider.business_name as provider_name, request.amount, request.currency,
      coalesce(disbursement.status, request.status) as status,
      request.requested_at, request.processed_at,
      disbursement.approved_at, disbursement.processing_at, disbursement.completed_at,
      disbursement.disbursement_channel,
      disbursement.destination_institution,
      disbursement.destination_account_last4
    from public.provider_payout_requests request
    join public.provider_profiles provider on provider.id = request.provider_id
    left join public.provider_payout_disbursements disbursement
      on disbursement.payout_request_id = request.id
  ), refund_operations as (
    select refund.id, refund.amount, refund.currency, refund.status,
      refund.disbursement_channel, refund.created_at, refund.processed_at,
      event.name as event_name, client.full_name as client_name
    from public.client_refund_disbursements refund
    join public.events event on event.id = refund.event_id
    join public.profiles client on client.id = refund.client_id
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'awaitingProviderConfirmations', (select count(*) from event_readiness where pending_provider_count > 0),
      'allProvidersConfirmed', (select count(*) from event_readiness where payment_eligible),
      'awaitingClientPayment', (select count(*) from event_readiness where payment_eligible and status = 'payment_required'),
      'paymentsPendingVerification', (select count(*) from settlement_payments where verification_status = 'pending_verification'),
      'verifiedPayments', (select count(*) from settlement_payments where verification_status = 'verified'),
      'heldProviderAllocations', (select count(*) from public.financial_transactions ledger where ledger.provider_funds_status in ('held_receivable', 'eligible_for_release', 'awaiting_provider_acceptance')),
      'availableForPayout', (select count(*) from public.financial_transactions ledger where ledger.provider_funds_status = 'available_for_payout'),
      'pendingPayouts', (select count(*) from payout_operations where status in ('requested', 'approved', 'processing')),
      'completedPayouts', (select count(*) from payout_operations where status in ('completed', 'paid')),
      'pendingRefunds', (select count(*) from refund_operations where status not in ('completed', 'failed', 'cancelled')),
      'completedRefunds', (select count(*) from refund_operations where status = 'completed')
    ),
    'paymentVerificationQueue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', payment.id, 'eventName', event.name, 'clientName', client.full_name,
        'amount', payment.amount, 'currency', payment.currency, 'method', payment.provider,
        'settlementEnvironment', payment.settlement_environment,
        'settlementChannel', payment.settlement_channel,
        'status', payment.status, 'verificationStatus', payment.verification_status,
        'createdAt', payment.created_at,
        'clientReferencePresent', nullif(trim(payment.provider_reference), '') is not null
      ) order by payment.created_at asc)
      from (
        select payment.* from settlement_payments payment
        where payment.verification_status = 'pending_verification'
        order by payment.created_at asc
        limit 50
      ) payment
      join public.events event on event.id = payment.event_id
      join public.profiles client on client.id = event.client_id
    ), '[]'::jsonb),
    'bookingReadiness', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', readiness.id, 'eventName', readiness.name, 'eventDate', readiness.event_date,
        'status', readiness.status, 'providerCount', readiness.provider_count,
        'acceptedProviderCount', readiness.accepted_provider_count,
        'pendingProviderCount', readiness.pending_provider_count,
        'declinedProviderCount', readiness.declined_provider_count,
        'coordinatorRequired', readiness.coordinator_required,
        'coordinatorAccepted', readiness.coordinator_accepted,
        'paymentEligible', readiness.payment_eligible, 'reason', readiness.reason
      ) order by readiness.event_date nulls last, readiness.name)
      from (select * from event_readiness order by event_date nulls last, name limit 50) readiness
    ), '[]'::jsonb),
    'payoutOperations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'payoutRequestId', payout.payout_request_id, 'disbursementId', payout.disbursement_id,
        'providerName', payout.provider_name, 'amount', payout.amount, 'currency', payout.currency,
        'status', payout.status, 'requestedAt', payout.requested_at, 'processedAt', payout.processed_at,
        'approvedAt', payout.approved_at, 'processingAt', payout.processing_at,
        'completedAt', payout.completed_at, 'channel', payout.disbursement_channel,
        'institution', payout.destination_institution, 'last4', payout.destination_account_last4
      ) order by coalesce(payout.completed_at, payout.processing_at, payout.approved_at, payout.requested_at) desc)
      from (
        select * from payout_operations
        order by coalesce(completed_at, processing_at, approved_at, requested_at) desc
        limit 50
      ) payout
    ), '[]'::jsonb),
    'refundOperations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', refund.id, 'eventName', refund.event_name, 'clientName', refund.client_name,
        'amount', refund.amount, 'currency', refund.currency, 'status', refund.status,
        'channel', refund.disbursement_channel, 'createdAt', refund.created_at,
        'processedAt', refund.processed_at
      ) order by refund.created_at desc)
      from (select * from refund_operations order by created_at desc limit 50) refund
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.notify_v14_payment_status_change() from public;
revoke all on function public.process_phase11_payout_eligibility(uuid) from public;
revoke all on function public.get_admin_v14_financial_operations() from public;
grant execute on function public.get_admin_v14_financial_operations() to authenticated;

comment on function public.get_admin_v14_financial_operations() is
  'V14 administrative financial operations projection: confirmation, verification, receivable, payout, and external-refund states without bank credentials or references.';
comment on function public.notify_v14_payment_status_change() is
  'Creates stored V14 settlement outcome notifications consumed by the existing Inbox and push-notification pipeline.';
comment on function public.process_phase11_payout_eligibility(uuid) is
  'Secure idempotent 14-day payout release; recipient notification is emitted only after a held allocation is actually available for payout.';

commit;
