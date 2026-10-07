-- MULTIVENT Revision 2, Phase 6: held funds and individual acceptance.
-- Apply after 56_payment_revenue_revision.sql.

begin;

-- This state belongs to the platform ledger, not to the external payout rail.
-- amount_released continues to mean money that has actually left MULTIVENT.
alter table public.financial_transactions
  add column if not exists provider_funds_status text not null default 'legacy',
  add column if not exists provider_credited_at timestamptz;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_provider_funds_status_check,
  add constraint financial_transactions_provider_funds_status_check check (
    provider_funds_status in (
      'legacy',
      'awaiting_provider_acceptance',
      'initial_share_credited',
      'rejected_held',
      'refunded'
    )
  );

create index if not exists financial_transactions_provider_funds_idx
  on public.financial_transactions (provider_id, provider_funds_status, transaction_at desc)
  where provider_id is not null;
create index if not exists financial_transactions_coordinator_funds_idx
  on public.financial_transactions (coordinator_id, provider_funds_status, transaction_at desc)
  where coordinator_id is not null;

-- Classify only Phase 5 rows. Legacy financial history remains untouched.
create or replace function public.classify_phase6_financial_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'refunded' or new.transaction_type = 'refund' then
    if coalesce(new.metadata, '{}'::jsonb) ->> 'accounting_version' = 'phase5-v1'
      or coalesce(new.metadata, '{}'::jsonb) ->> 'accountingVersion' = 'phase5-v1'
    then
      new.provider_funds_status := 'refunded';
    end if;
  elsif new.provider_funds_status = 'legacy'
    and (
      coalesce(new.metadata, '{}'::jsonb) ->> 'accounting_version' = 'phase5-v1'
      or coalesce(new.metadata, '{}'::jsonb) ->> 'accountingVersion' = 'phase5-v1'
    )
    and new.status in ('paid', 'verified')
  then
    new.provider_funds_status := case
      when new.provider_net_amount > 0 then 'initial_share_credited'
      else 'awaiting_provider_acceptance'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists classify_phase6_financial_transaction_trigger
  on public.financial_transactions;
create trigger classify_phase6_financial_transaction_trigger
before insert or update of transaction_type, status, provider_net_amount, metadata
on public.financial_transactions
for each row execute function public.classify_phase6_financial_transaction();

update public.financial_transactions transaction
set provider_funds_status = case
      when transaction.status = 'refunded' or transaction.transaction_type = 'refund'
        then 'refunded'
      when transaction.provider_net_amount > 0 then 'initial_share_credited'
      else 'awaiting_provider_acceptance'
    end,
    provider_credited_at = case when transaction.provider_net_amount > 0
      then coalesce(transaction.provider_credited_at, transaction.updated_at)
      else transaction.provider_credited_at end
where transaction.provider_funds_status = 'legacy'
  and (
    transaction.metadata ->> 'accounting_version' = 'phase5-v1'
    or transaction.metadata ->> 'accountingVersion' = 'phase5-v1'
  );

-- Move at most one snapshotted 30% allocation into the provider's internal
-- balance. Multiple recognized payment attempts cannot credit the same share
-- twice because the booking-level target is reduced by prior credits.
create or replace function public.release_phase6_provider_initial_share(
  target_booking_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_initial numeric(12,2);
  already_credited numeric(12,2);
  released_now numeric(12,2);
  service_amount numeric(12,2);
  remaining_after_initial numeric(12,2);
begin
  select round(coalesce(booking.provider_amount, 0), 2),
    round(coalesce(max(payment.provider_initial_allocation),
      coalesce(booking.provider_amount, 0) * coalesce(booking.provider_initial_rate, 0.30)), 2)
  into service_amount, target_initial
  from public.bookings booking
  left join public.payments payment on payment.booking_id = booking.id
    and payment.status in ('paid', 'verified')
    and payment.metadata ->> 'accountingVersion' = 'phase5-v1'
  where booking.id = target_booking_id
  group by booking.id, booking.provider_amount, booking.provider_initial_rate;

  if service_amount is null then
    raise exception 'Booking financial snapshot not found.';
  end if;

  select coalesce(sum(transaction.provider_net_amount), 0)
  into already_credited
  from public.financial_transactions transaction
  where transaction.booking_id = target_booking_id
    and transaction.transaction_type = 'booking_payment'
    and transaction.status in ('paid', 'verified')
    and transaction.metadata ->> 'accounting_version' = 'phase5-v1';

  target_initial := greatest(target_initial - already_credited, 0);
  remaining_after_initial := greatest(service_amount - (already_credited + target_initial), 0);

  with eligible as (
    select transaction.id,
      transaction.held_provider_amount,
      coalesce(sum(transaction.held_provider_amount) over (
        order by transaction.transaction_at, transaction.id
        rows between unbounded preceding and 1 preceding
      ), 0) as prior_held
    from public.financial_transactions transaction
    where transaction.booking_id = target_booking_id
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1'
      and transaction.held_provider_amount > 0
  ), allocations as (
    select eligible.id,
      least(eligible.held_provider_amount,
        greatest(target_initial - eligible.prior_held, 0)) as allocation
    from eligible
  ), updated as (
    update public.financial_transactions transaction
    set provider_net_amount = transaction.provider_net_amount + allocation.allocation,
        held_provider_amount = transaction.held_provider_amount - allocation.allocation,
        provider_funds_status = 'initial_share_credited',
        provider_credited_at = coalesce(transaction.provider_credited_at, now()),
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', true,
          'release_condition', 'provider_accepted',
          'initial_share_credited_at', now(),
          'service_amount', service_amount,
          'provider_initial_amount', already_credited + target_initial,
          'remaining_service_balance', remaining_after_initial,
          'external_payout_released', false
        ),
        updated_at = now()
    from allocations allocation
    where transaction.id = allocation.id and allocation.allocation > 0
    returning allocation.allocation
  )
  select coalesce(sum(updated.allocation), 0) into released_now from updated;

  if already_credited + released_now > 0 then
    update public.financial_transactions transaction
    set provider_funds_status = 'initial_share_credited',
        provider_credited_at = coalesce(transaction.provider_credited_at, now()),
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', true,
          'release_condition', 'provider_accepted',
          'provider_initial_amount', already_credited + released_now,
          'remaining_service_balance', greatest(
            service_amount - already_credited - released_now, 0
          ),
          'external_payout_released', false
        ),
        updated_at = now()
    where transaction.booking_id = target_booking_id
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1';
  end if;

  return released_now;
end;
$$;

create or replace function public.release_phase6_coordinator_initial_share(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_initial numeric(12,2);
  already_credited numeric(12,2);
  released_now numeric(12,2);
  service_amount numeric(12,2);
  remaining_after_initial numeric(12,2);
begin
  select round(coalesce(max(payment.service_subtotal), 0), 2),
    round(coalesce(max(payment.provider_initial_allocation), 0), 2)
  into service_amount, target_initial
  from public.payments payment
  where payment.event_id = target_event_id
    and payment.coordinator_id = target_coordinator_id
    and payment.payment_scope = 'coordinator_service'
    and payment.status in ('paid', 'verified')
    and payment.metadata ->> 'accountingVersion' = 'phase5-v1';

  select coalesce(sum(transaction.provider_net_amount), 0)
  into already_credited
  from public.financial_transactions transaction
  where transaction.event_id = target_event_id
    and transaction.coordinator_id = target_coordinator_id
    and transaction.transaction_type = 'booking_payment'
    and transaction.status in ('paid', 'verified')
    and transaction.metadata ->> 'accounting_version' = 'phase5-v1';

  target_initial := greatest(coalesce(target_initial, 0) - already_credited, 0);
  remaining_after_initial := greatest(coalesce(service_amount, 0)
    - (already_credited + target_initial), 0);

  with eligible as (
    select transaction.id,
      transaction.held_provider_amount,
      coalesce(sum(transaction.held_provider_amount) over (
        order by transaction.transaction_at, transaction.id
        rows between unbounded preceding and 1 preceding
      ), 0) as prior_held
    from public.financial_transactions transaction
    where transaction.event_id = target_event_id
      and transaction.coordinator_id = target_coordinator_id
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1'
      and transaction.held_provider_amount > 0
  ), allocations as (
    select eligible.id,
      least(eligible.held_provider_amount,
        greatest(target_initial - eligible.prior_held, 0)) as allocation
    from eligible
  ), updated as (
    update public.financial_transactions transaction
    set provider_net_amount = transaction.provider_net_amount + allocation.allocation,
        held_provider_amount = transaction.held_provider_amount - allocation.allocation,
        provider_funds_status = 'initial_share_credited',
        provider_credited_at = coalesce(transaction.provider_credited_at, now()),
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', true,
          'release_condition', 'coordinator_accepted',
          'initial_share_credited_at', now(),
          'service_amount', service_amount,
          'provider_initial_amount', already_credited + target_initial,
          'remaining_service_balance', remaining_after_initial,
          'external_payout_released', false
        ),
        updated_at = now()
    from allocations allocation
    where transaction.id = allocation.id and allocation.allocation > 0
    returning allocation.allocation
  )
  select coalesce(sum(updated.allocation), 0) into released_now from updated;

  if already_credited + released_now > 0 then
    update public.financial_transactions transaction
    set provider_funds_status = 'initial_share_credited',
        provider_credited_at = coalesce(transaction.provider_credited_at, now()),
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', true,
          'release_condition', 'coordinator_accepted',
          'provider_initial_amount', already_credited + released_now,
          'remaining_service_balance', greatest(
            coalesce(service_amount, 0) - already_credited - released_now, 0
          ),
          'external_payout_released', false
        ),
        updated_at = now()
    where transaction.event_id = target_event_id
      and transaction.coordinator_id = target_coordinator_id
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1';
  end if;

  return released_now;
end;
$$;

-- A Phase 5 booking may already have been accepted while Phase 6 was still
-- being deployed. Reconcile only those versioned accepted rows; legacy
-- accounting and pending/rejected requests are not rewritten.
do $$
declare
  accepted_row record;
begin
  for accepted_row in
    select booking.id
    from public.bookings booking
    where booking.financial_terms_version = 'phase5-v1'
      and booking.status in ('confirmed', 'completed')
      and exists (
        select 1 from public.payments payment
        where payment.booking_id = booking.id
          and payment.status in ('paid', 'verified')
          and payment.metadata ->> 'accountingVersion' = 'phase5-v1'
      )
  loop
    perform public.release_phase6_provider_initial_share(accepted_row.id);
  end loop;

  for accepted_row in
    select event.id, event.coordinator_id
    from public.events event
    where event.coordinator_id is not null
      and event.coordinator_assignment_status = 'accepted'
      and exists (
        select 1 from public.payments payment
        where payment.event_id = event.id
          and payment.coordinator_id = event.coordinator_id
          and payment.payment_scope = 'coordinator_service'
          and payment.status in ('paid', 'verified')
          and payment.metadata ->> 'accountingVersion' = 'phase5-v1'
      )
  loop
    perform public.release_phase6_coordinator_initial_share(
      accepted_row.id, accepted_row.coordinator_id
    );
  end loop;
end;
$$;

-- Phase 5 acceptance must use the RPC below so the booking decision and the
-- corresponding balance transition commit or roll back together.
create or replace function public.enforce_phase6_booking_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.financial_terms_version = 'phase5-v1'
    and old.status = 'requested'
    and new.status in ('confirmed', 'rejected')
    and auth.role() <> 'service_role'
    and coalesce(current_setting('app.phase6_booking_response_authorized', true), '') <> 'true'
  then
    raise exception 'Use the provider booking response action so held funds are updated safely.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_phase6_booking_response_trigger on public.bookings;
create trigger enforce_phase6_booking_response_trigger
before update of status on public.bookings
for each row execute function public.enforce_phase6_booking_response();

-- Mark only coordinator requests created after this migration. This lets the
-- response RPC require payment for the Phase 6 flow without trapping a legacy
-- pending invitation that existed before Phase 6 was installed.
create or replace function public.mark_phase6_coordinator_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pending_coordinator_id is not null
    and new.coordinator_assignment_status = 'pending'
    and (
      tg_op = 'INSERT'
      or old.pending_coordinator_id is distinct from new.pending_coordinator_id
      or old.coordinator_assignment_status is distinct from new.coordinator_assignment_status
    )
  then
    new.coordinator_pricing_snapshot := coalesce(new.coordinator_pricing_snapshot, '{}'::jsonb)
      || jsonb_build_object('financialTermsVersion', 'phase5-v1');
  end if;
  return new;
end;
$$;

drop trigger if exists mark_phase6_coordinator_request_trigger on public.events;
create trigger mark_phase6_coordinator_request_trigger
before insert or update of pending_coordinator_id, coordinator_assignment_status
on public.events
for each row execute function public.mark_phase6_coordinator_request();

create or replace function public.respond_to_provider_booking(
  target_booking_id uuid,
  accept_booking boolean,
  response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  service_name text;
  event_name text;
  is_phase6_payment boolean;
  released_now numeric(12,2) := 0;
  next_status public.booking_status;
begin
  select booking.*
  into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id and provider.user_id = auth.uid()
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking request not found for this service-provider account.'
      using errcode = '42501';
  end if;

  next_status := case when accept_booking then 'confirmed'::public.booking_status
    else 'rejected'::public.booking_status end;
  if booking_row.status = next_status then
    return jsonb_build_object(
      'booking_id', booking_row.id,
      'status', next_status,
      'accepted', accept_booking,
      'initial_share_credited', 0,
      'already_processed', true
    );
  end if;
  if booking_row.status <> 'requested' then
    raise exception 'This booking request can no longer be answered.';
  end if;
  if char_length(coalesce(response_note, '')) > 2000 then
    raise exception 'The response note cannot exceed 2,000 characters.';
  end if;

  select exists (
    select 1 from public.payments payment
    where payment.booking_id = booking_row.id
      and payment.status in ('paid', 'verified')
      and payment.metadata ->> 'accountingVersion' = 'phase5-v1'
  ) into is_phase6_payment;

  if booking_row.financial_terms_version = 'phase5-v1' and not is_phase6_payment then
    raise exception 'The client payment must be confirmed before this request can be answered.';
  end if;

  perform set_config('app.phase6_booking_response_authorized', 'true', true);
  update public.bookings
  set status = next_status,
      provider_notes = nullif(trim(coalesce(response_note, '')), ''),
      updated_at = now()
  where id = booking_row.id;

  if is_phase6_payment and accept_booking then
    released_now := public.release_phase6_provider_initial_share(booking_row.id);
  elsif is_phase6_payment then
    update public.financial_transactions transaction
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'provider_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where transaction.booking_id = booking_row.id
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1';
  end if;

  select coalesce(service.name, 'Service'), coalesce(event.name, 'Event')
  into service_name, event_name
  from public.services service
  join public.events event on event.id = booking_row.event_id
  where service.id = booking_row.service_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    booking_row.client_id,
    case when accept_booking then 'Booking confirmed' else 'Booking declined' end,
    case when accept_booking
      then format('%s accepted your booking request for %s.', service_name, event_name)
      else format('%s could not accept your booking request for %s.', service_name, event_name)
    end,
    'booking', booking_row.id
  );

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'status', next_status,
    'accepted', accept_booking,
    'initial_share_credited', released_now,
    'already_processed', false
  );
end;
$$;

-- Preserve the Phase 1 signature while making coordinator acceptance perform
-- the same atomic held-to-balance transition as provider acceptance.
create or replace function public.respond_event_coordinator_assignment(
  target_event_id uuid,
  accept_assignment boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  is_phase6_payment boolean;
  released_now numeric(12,2) := 0;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.pending_coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then
    raise exception 'This coordinator booking request is no longer available.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.payments payment
    where payment.event_id = event_row.id
      and payment.coordinator_id = auth.uid()
      and payment.payment_scope = 'coordinator_service'
      and payment.status in ('paid', 'verified')
      and payment.metadata ->> 'accountingVersion' = 'phase5-v1'
  ) into is_phase6_payment;
  if event_row.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
    and not is_phase6_payment
  then
    raise exception 'The client payment must be confirmed before this coordinator request can be answered.';
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when accept_assignment then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now(),
      note = case when accept_assignment then note
        else 'Coordinator declined the client booking request.' end
  where event_id = event_row.id and coordinator_id = auth.uid() and status = 'invited';

  if accept_assignment then
    update public.events set coordinator_id = auth.uid(), pending_coordinator_id = null,
      coordinator_assignment_status = 'accepted', coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = null, updated_at = now() where id = event_row.id;
    if is_phase6_payment then
      released_now := public.release_phase6_coordinator_initial_share(event_row.id, auth.uid());
    end if;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking accepted',
      format('Your coordinator booking for %s was accepted.', event_row.name), 'event', event_row.id);
  else
    update public.financial_transactions transaction
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'coordinator_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where transaction.event_id = event_row.id
      and transaction.coordinator_id = auth.uid()
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1';

    update public.events set coordinator_id = null, pending_coordinator_id = null,
      coordinator_assignment_status = null, coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = 'The coordinator declined the client booking request.',
      coordinator_preference = 'undecided', coordinator_fee_amount = null,
      coordinator_fee_currency = null, coordinator_pricing_snapshot = null,
      updated_at = now() where id = event_row.id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking declined',
      format('Your coordinator request for %s was declined. You can choose another coordinator or continue without one.', event_row.name),
      'event', event_row.id);
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'accepted', accept_assignment,
    'assignment_status', case when accept_assignment then 'accepted' else null end,
    'initial_share_credited', released_now
  );
end;
$$;

-- Provider-facing confirmation cards use immutable booking/payment snapshots;
-- current marketplace prices never rewrite historical amounts.
create or replace function public.get_my_provider_payment_confirmations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  result_payload jsonb;
begin
  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1;
  if provider_id_value is null then
    raise exception 'A service-provider account is required.' using errcode = '42501';
  end if;

  with owned_bookings as (
    select booking.id, booking.event_id, booking.service_id, booking.status::text as booking_status,
      round(coalesce(booking.provider_amount, booking.amount, 0), 2) as service_amount,
      round(coalesce(booking.provider_amount, booking.amount, 0)
        * coalesce(booking.provider_initial_rate, 0.30), 2) as initial_share,
      booking.financial_terms_version, booking.updated_at
    from public.bookings booking
    where booking.provider_id = provider_id_value
      and booking.financial_terms_version = 'phase5-v1'
  ), payment_rollup as (
    select payment.booking_id,
      bool_or(payment.status in ('paid', 'verified')) as is_paid,
      max(coalesce(payment.verified_at, payment.paid_at, payment.created_at))
        filter (where payment.status in ('paid', 'verified')) as paid_at,
      max(payment.provider_initial_allocation)
        filter (where payment.status in ('paid', 'verified')) as snapshotted_initial_share
    from public.payments payment
    join owned_bookings booking on booking.id = payment.booking_id
    where payment.metadata ->> 'accountingVersion' = 'phase5-v1'
    group by payment.booking_id
  ), ledger_rollup as (
    select transaction.booking_id,
      round(coalesce(sum(transaction.provider_net_amount), 0), 2) as amount_earned,
      round(coalesce(sum(transaction.held_provider_amount), 0), 2) as amount_held,
      round(coalesce(sum(transaction.amount_released), 0), 2) as amount_paid_out,
      max(transaction.provider_credited_at) as credited_at
    from public.financial_transactions transaction
    join owned_bookings booking on booking.id = transaction.booking_id
    where transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and transaction.metadata ->> 'accounting_version' = 'phase5-v1'
    group by transaction.booking_id
  ), cards as (
    select booking.id, booking.updated_at,
      jsonb_build_object(
        'bookingId', booking.id,
        'eventId', booking.event_id,
        'eventName', coalesce(nullif(trim(event.name), ''), 'Event'),
        'eventStatus', replace(event.status::text, '_', ' '),
        'serviceName', coalesce(nullif(trim(service.name), ''), 'Service'),
        'serviceAmount', booking.service_amount,
        'initialProviderShare', coalesce(payment.snapshotted_initial_share, booking.initial_share),
        'amountEarned', coalesce(ledger.amount_earned, 0),
        'amountHeld', coalesce(ledger.amount_held, 0),
        'amountWithdrawable', greatest(coalesce(ledger.amount_earned, 0)
          - coalesce(ledger.amount_paid_out, 0), 0),
        'amountPaidOut', coalesce(ledger.amount_paid_out, 0),
        'remainingServiceBalance', greatest(booking.service_amount
          - coalesce(payment.snapshotted_initial_share, booking.initial_share), 0),
        'paymentStatus', case when coalesce(payment.is_paid, false)
          then 'Payment Held' else 'Awaiting Client Payment' end,
        'fundsStatus', case
          when not coalesce(payment.is_paid, false) then 'Awaiting Client Payment'
          when booking.booking_status = 'rejected' then 'Payment Held for Replacement or Refund'
          when booking.booking_status = 'requested' then 'Awaiting Provider Acceptance'
          when coalesce(ledger.amount_earned, 0) > 0 then 'Initial Share Credited'
          else 'Payment Held'
        end,
        'balanceStatus', case
          when booking.booking_status in ('confirmed', 'completed')
            and coalesce(ledger.amount_earned, 0) > 0 then 'Balance Pending Event Completion'
          else 'Not Yet Eligible'
        end,
        'payoutStatus', case
          when greatest(coalesce(ledger.amount_earned, 0)
            - coalesce(ledger.amount_paid_out, 0), 0) > 0 then 'Eligible for Payout'
          else 'Not Yet Eligible'
        end,
        'paidAt', payment.paid_at,
        'creditedAt', ledger.credited_at
      ) as payload
    from owned_bookings booking
    join public.events event on event.id = booking.event_id
    join public.services service on service.id = booking.service_id
    left join payment_rollup payment on payment.booking_id = booking.id
    left join ledger_rollup ledger on ledger.booking_id = booking.id
    where coalesce(payment.is_paid, false) or booking.booking_status = 'payment_required'
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'heldBalance', coalesce(sum((card.payload ->> 'amountHeld')::numeric), 0),
      'remainingReceivable', coalesce(sum((card.payload ->> 'remainingServiceBalance')::numeric), 0)
    ),
    'items', coalesce(jsonb_agg(card.payload order by card.updated_at desc, card.id), '[]'::jsonb)
  ) into result_payload
  from cards card;

  return coalesce(result_payload, jsonb_build_object(
    'summary', jsonb_build_object('heldBalance', 0, 'remainingReceivable', 0),
    'items', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.classify_phase6_financial_transaction() from public;
revoke all on function public.release_phase6_provider_initial_share(uuid) from public;
revoke all on function public.release_phase6_coordinator_initial_share(uuid, uuid) from public;
revoke all on function public.enforce_phase6_booking_response() from public;
revoke all on function public.mark_phase6_coordinator_request() from public;
revoke all on function public.respond_to_provider_booking(uuid, boolean, text) from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
revoke all on function public.get_my_provider_payment_confirmations() from public;
grant execute on function public.respond_to_provider_booking(uuid, boolean, text) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.get_my_provider_payment_confirmations() to authenticated;

comment on column public.financial_transactions.provider_funds_status is
  'Internal-custody state; separate from payment status and external payout completion.';
comment on function public.respond_to_provider_booking(uuid, boolean, text) is
  'Atomically records one provider decision and credits only its eligible Phase 6 initial share.';
comment on function public.get_my_provider_payment_confirmations() is
  'Returns provider-scoped payment, held-fund, credited-share, payout-eligibility, and remaining-balance snapshots.';

commit;
