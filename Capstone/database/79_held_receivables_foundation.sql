-- MULTIVENT Revision V11, Phase 1: held receivables foundation.
-- Apply after 78_step1_coordinator_and_church_preferences.sql.
--
-- Financial policy preserved by this migration:
--   provider/coordinator base price S
--   MULTIVENT markup                  S * 5%
--   client downpayment                S * 35%
--   recipient initial allocation      S * 30%
--   platform fee                      S * 5%
--
-- This migration changes custody timing only. It does not reprice bookings,
-- rewrite recognized payments, or claw back historic credited balances.

begin;

-- Keep the financial lifecycle on the existing immutable-payment ledger. The
-- state is deliberately separate from booking status: an accepted booking can
-- remain a held receivable until a later, controlled payout-release phase.
alter table public.financial_transactions
  add column if not exists receivable_accepted_at timestamptz,
  add column if not exists payout_eligible_on date,
  add column if not exists receivable_reconciliation_required boolean not null default false;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_provider_funds_status_check,
  add constraint financial_transactions_provider_funds_status_check check (
    provider_funds_status in (
      'legacy',
      'awaiting_provider_acceptance',
      'held_receivable',
      'eligible_for_release',
      'available_for_payout',
      'payout_pending',
      'paid_out',
      'initial_share_credited',
      'rejected_held',
      'refunded',
      'disputed_on_hold'
    )
  ),
  drop constraint if exists financial_transactions_receivable_event_check,
  add constraint financial_transactions_receivable_event_check check (
    payout_eligible_on is null or event_id is not null
  );

create index if not exists financial_transactions_receivable_provider_idx
  on public.financial_transactions (
    provider_id, provider_funds_status, payout_eligible_on, transaction_at desc
  )
  where provider_id is not null;

create index if not exists financial_transactions_receivable_coordinator_idx
  on public.financial_transactions (
    coordinator_id, provider_funds_status, payout_eligible_on, transaction_at desc
  )
  where coordinator_id is not null;

-- Populate the eligibility date for existing held Phase 5 allocations without
-- modifying their amount. An accepted historical allocation that was never
-- credited is safely classified as a receivable, but is flagged for review
-- because its precise acceptance timestamp predates this migration.
update public.financial_transactions ledger
set payout_eligible_on = coalesce(ledger.payout_eligible_on, event.event_date - 14),
    provider_funds_status = case
      when ledger.provider_net_amount = 0
        and ledger.held_provider_amount > 0
        and (
          coalesce((
            select booking.status::text
            from public.bookings booking
            where booking.id = ledger.booking_id
          ), '') in ('confirmed', 'completed')
          or (
            event.coordinator_assignment_status = 'accepted'
            and ledger.coordinator_id is not null
          )
        )
      then 'held_receivable'
      else ledger.provider_funds_status
    end,
    receivable_reconciliation_required = case
      when ledger.provider_net_amount = 0
        and ledger.held_provider_amount > 0
        and (
          coalesce((
            select booking.status::text
            from public.bookings booking
            where booking.id = ledger.booking_id
          ), '') in ('confirmed', 'completed')
          or (
            event.coordinator_assignment_status = 'accepted'
            and ledger.coordinator_id is not null
          )
        )
      then true
      else ledger.receivable_reconciliation_required
    end,
    metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
      'receivable_state', case
        when ledger.provider_net_amount = 0
          and ledger.held_provider_amount > 0
          and (
            coalesce((
              select booking.status::text
              from public.bookings booking
              where booking.id = ledger.booking_id
            ), '') in ('confirmed', 'completed')
            or (
              event.coordinator_assignment_status = 'accepted'
              and ledger.coordinator_id is not null
            )
          )
        then 'held_receivable'
        else ledger.provider_funds_status
      end,
      'payout_eligible_on', case
        when event.event_date is null then null
        else (event.event_date - 14)::text
      end,
      'phase11_reconciliation_required', case
        when ledger.provider_net_amount = 0
          and ledger.held_provider_amount > 0
          and (
            coalesce((
              select booking.status::text
              from public.bookings booking
              where booking.id = ledger.booking_id
            ), '') in ('confirmed', 'completed')
            or (
              event.coordinator_assignment_status = 'accepted'
              and ledger.coordinator_id is not null
            )
          )
        then true
        else ledger.receivable_reconciliation_required
      end
    ),
    updated_at = now()
from public.events event
where ledger.event_id = event.id
  and ledger.transaction_type = 'booking_payment'
  and ledger.status in ('paid', 'verified')
  and ledger.held_provider_amount > 0
  and (
    ledger.metadata ->> 'accounting_version' = 'phase5-v1'
    or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
  );

-- A historic amount that has already been credited remains untouched. It is
-- explicitly flagged when it is not yet externally paid so finance can review
-- it instead of silently clawing it back from an existing balance.
update public.financial_transactions ledger
set receivable_reconciliation_required = true,
    metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
      'phase11_reconciliation_required', true,
      'phase11_reconciliation_reason', 'historic_initial_share_already_credited'
    ),
    updated_at = now()
where ledger.transaction_type = 'booking_payment'
  and ledger.status in ('paid', 'verified')
  and ledger.provider_funds_status = 'initial_share_credited'
  and ledger.provider_net_amount > 0
  and ledger.amount_released = 0
  and (
    ledger.metadata ->> 'accounting_version' = 'phase5-v1'
    or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
  );

-- New paid allocations inherit an eligibility date from the authoritative
-- event date. This is only a ledger attribute in Phase 1; it is not a release
-- scheduler and cannot make money withdrawable on its own.
create or replace function public.seed_phase11_receivable_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_date_value date;
begin
  if new.transaction_type <> 'booking_payment'
    or new.status not in ('paid', 'verified')
    or new.held_provider_amount <= 0
    or (
      coalesce(new.metadata, '{}'::jsonb) ->> 'accounting_version' <> 'phase5-v1'
      and coalesce(new.metadata, '{}'::jsonb) ->> 'accountingVersion' <> 'phase5-v1'
    )
  then
    return new;
  end if;

  select event.event_date into event_date_value
  from public.events event
  where event.id = new.event_id;

  new.payout_eligible_on := coalesce(new.payout_eligible_on, event_date_value - 14);
  if new.provider_funds_status = 'legacy' then
    new.provider_funds_status := 'awaiting_provider_acceptance';
  end if;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'receivable_state', new.provider_funds_status,
    'payout_eligible_on', case when new.payout_eligible_on is null
      then null else new.payout_eligible_on::text end,
    'provider_release', false,
    'release_condition', '14_day_payout_window'
  );
  return new;
end;
$$;

drop trigger if exists phase11_seed_receivable_fields_trigger on public.financial_transactions;
create trigger phase11_seed_receivable_fields_trigger
before insert or update of metadata, held_provider_amount, provider_funds_status,
  transaction_type, status, event_id
on public.financial_transactions
for each row execute function public.seed_phase11_receivable_fields();

-- No caller can turn an accepted held receivable into a credited/withdrawable
-- amount by editing the ledger. A later server-side release process will set
-- this local transaction flag only after the Phase 2 eligibility checks.
create or replace function public.enforce_phase11_receivable_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider_funds_status not in ('awaiting_provider_acceptance', 'held_receivable') then
    return new;
  end if;

  if new.status = 'refunded' or new.transaction_type = 'refund' then
    return new;
  end if;

  if new.provider_net_amount is distinct from old.provider_net_amount
    or new.held_provider_amount is distinct from old.held_provider_amount
    or new.amount_released is distinct from old.amount_released
  then
    raise exception 'Held receivable amounts cannot be released or altered before payout eligibility.'
      using errcode = '42501';
  end if;

  if new.provider_funds_status is distinct from old.provider_funds_status
    and new.provider_funds_status not in ('held_receivable', 'rejected_held', 'refunded', 'disputed_on_hold')
    and coalesce(current_setting('app.phase11_receivable_release_authorized', true), '') <> 'true'
  then
    raise exception 'Held receivables can move to an available payout state only through the secured eligibility process.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists phase11_enforce_receivable_hold_trigger on public.financial_transactions;
create trigger phase11_enforce_receivable_hold_trigger
before update of provider_net_amount, held_provider_amount, amount_released,
  provider_funds_status, status, transaction_type, metadata
on public.financial_transactions
for each row execute function public.enforce_phase11_receivable_hold();

-- These helpers are intentionally private. They are idempotent and only move
-- state from paid-and-held to a receivable; no amount is released.
create or replace function public.hold_phase11_provider_receivable(
  target_booking_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  event_date_value date;
  held_amount numeric(12,2);
begin
  select booking.* into booking_row
  from public.bookings booking
  where booking.id = target_booking_id
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking financial snapshot not found.';
  end if;

  select event.event_date into event_date_value
  from public.events event
  where event.id = booking_row.event_id;

  update public.financial_transactions ledger
  set provider_funds_status = 'held_receivable',
      receivable_accepted_at = coalesce(ledger.receivable_accepted_at, now()),
      payout_eligible_on = coalesce(ledger.payout_eligible_on, event_date_value - 14),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'receivable_state', 'held_receivable',
        'receivable_accepted_at', coalesce(ledger.receivable_accepted_at, now()),
        'payout_eligible_on', case when coalesce(ledger.payout_eligible_on, event_date_value - 14) is null
          then null else coalesce(ledger.payout_eligible_on, event_date_value - 14)::text end,
        'provider_release', false,
        'release_condition', '14_day_payout_window'
      ),
      updated_at = now()
  where ledger.booking_id = booking_row.id
    and ledger.provider_id = booking_row.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.held_provider_amount > 0
    and ledger.provider_net_amount = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  select coalesce(sum(ledger.held_provider_amount), 0)
  into held_amount
  from public.financial_transactions ledger
  where ledger.booking_id = booking_row.id
    and ledger.provider_id = booking_row.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status = 'held_receivable';

  return held_amount;
end;
$$;

create or replace function public.hold_phase11_coordinator_receivable(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  held_amount numeric(12,2);
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Coordinator event financial snapshot not found.';
  end if;

  update public.financial_transactions ledger
  set provider_funds_status = 'held_receivable',
      receivable_accepted_at = coalesce(ledger.receivable_accepted_at, now()),
      payout_eligible_on = coalesce(ledger.payout_eligible_on, event_row.event_date - 14),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'receivable_state', 'held_receivable',
        'receivable_accepted_at', coalesce(ledger.receivable_accepted_at, now()),
        'payout_eligible_on', case when coalesce(ledger.payout_eligible_on, event_row.event_date - 14) is null
          then null else coalesce(ledger.payout_eligible_on, event_row.event_date - 14)::text end,
        'provider_release', false,
        'release_condition', '14_day_payout_window'
      ),
      updated_at = now()
  where ledger.event_id = event_row.id
    and ledger.coordinator_id = target_coordinator_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.held_provider_amount > 0
    and ledger.provider_net_amount = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  select coalesce(sum(ledger.held_provider_amount), 0)
  into held_amount
  from public.financial_transactions ledger
  where ledger.event_id = event_row.id
    and ledger.coordinator_id = target_coordinator_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status = 'held_receivable';

  return held_amount;
end;
$$;

-- Kept with the old private signatures so any stale server-side caller is
-- safe: it records a held receivable and returns zero instead of crediting it.
create or replace function public.release_phase6_provider_initial_share(
  target_booking_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.hold_phase11_provider_receivable(target_booking_id);
  return 0;
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
begin
  perform public.hold_phase11_coordinator_receivable(target_event_id, target_coordinator_id);
  return 0;
end;
$$;

-- Booking acceptance and financial state now commit atomically, but acceptance
-- does not credit the allocation to a provider balance.
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
  is_phase5_payment boolean;
  held_now numeric(12,2) := 0;
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
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into is_phase5_payment;

  if booking_row.financial_terms_version = 'phase5-v1' and not is_phase5_payment then
    raise exception 'The client payment must be confirmed before this request can be answered.';
  end if;

  perform set_config('app.phase6_booking_response_authorized', 'true', true);
  update public.bookings
  set status = next_status,
      provider_notes = nullif(trim(coalesce(response_note, '')), ''),
      updated_at = now()
  where id = booking_row.id;

  if is_phase5_payment and accept_booking then
    held_now := public.hold_phase11_provider_receivable(booking_row.id);
  elsif is_phase5_payment then
    update public.financial_transactions ledger
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'receivable_state', 'rejected_held',
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'provider_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where ledger.booking_id = booking_row.id
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      );
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
    'initial_share_credited', 0,
    'held_receivable', held_now,
    'already_processed', false
  );
end;
$$;

-- Coordinators use the same custody rule but remain separate from the
-- provider-profile payout model. Their allocation stays on the coordinator
-- ledger reference until a later payout workflow is introduced.
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
  is_phase5_payment boolean;
  held_now numeric(12,2) := 0;
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
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into is_phase5_payment;
  if accept_assignment
    and event_row.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
    and not is_phase5_payment
  then
    raise exception 'The client downpayment is still pending. You can review or decline this request now, and accept it after payment is confirmed.';
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
    if is_phase5_payment then
      held_now := public.hold_phase11_coordinator_receivable(event_row.id, auth.uid());
    end if;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking accepted',
      format('Your coordinator booking for %s was accepted.', event_row.name), 'event', event_row.id);
  else
    update public.financial_transactions ledger
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'receivable_state', 'rejected_held',
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'coordinator_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where ledger.event_id = event_row.id
      and ledger.coordinator_id = auth.uid()
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      );

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
    'initial_share_credited', 0,
    'held_receivable', held_now
  );
end;
$$;

-- Keep the existing coordinator request details, but correct the financial
-- explanation so an accepted allocation is never presented as withdrawable.
create or replace function public.get_my_coordinator_booking_details()
returns table (
  event_id uuid,
  client_notes text,
  package_name text,
  selected_services jsonb,
  payment_confirmed boolean,
  can_accept boolean,
  payment_status text,
  downpayment_amount numeric,
  coordination_fee numeric,
  platform_fee_paid numeric,
  initial_coordinator_share numeric,
  remaining_coordinator_balance numeric,
  paid_at timestamptz,
  balance_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id,
    nullif(trim(event.notes), '') as client_notes,
    package_selection.package_name,
    coalesce(service_selection.items, '[]'::jsonb) as selected_services,
    payment.id is not null as payment_confirmed,
    coalesce(event.coordinator_pricing_snapshot ->> 'financialTermsVersion', '') <> 'phase5-v1'
      or payment.id is not null as can_accept,
    case
      when payment.id is null
        and event.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
        then 'Awaiting client downpayment'
      when payment.id is null then 'Legacy request - no online downpayment snapshot'
      when coalesce(payment.metadata ->> 'paymentType', 'full') = 'deposit'
        then 'Downpayment confirmed'
      else 'Full payment confirmed'
    end as payment_status,
    round(coalesce(payment.amount, 0), 2) as downpayment_amount,
    round(coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0), 2)
      as coordination_fee,
    round(coalesce(payment.platform_fee_amount, 0), 2) as platform_fee_paid,
    round(coalesce(payment.provider_initial_allocation, 0), 2)
      as initial_coordinator_share,
    round(greatest(
      coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0)
        - coalesce(payment.provider_initial_allocation, 0),
      0
    ), 2) as remaining_coordinator_balance,
    coalesce(payment.verified_at, payment.paid_at, payment.created_at) as paid_at,
    case
      when payment.id is null
        and event.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
        then 'The client must complete the downpayment before acceptance.'
      when payment.id is null
        then 'This request predates the online payment-snapshot workflow.'
      when event.coordinator_assignment_status = 'pending'
        then 'Accepting records the initial coordinator allocation as a held receivable; it is not withdrawable yet.'
      when event.coordinator_assignment_status = 'accepted'
        then 'The initial coordinator allocation is held by MULTIVENT and becomes eligible for payout 14 days before the event, subject to validation.'
      when event.status = 'completed'
        then 'The remaining coordination balance is due through the completion workflow.'
      else 'The remaining coordination balance becomes due after event completion.'
    end as balance_status
  from public.events event
  left join lateral (
    select selection.package_name
    from public.event_coordinator_package_selections selection
    where selection.event_id = event.id
      and selection.coordinator_id = auth.uid()
    order by selection.selected_at desc
    limit 1
  ) package_selection on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', selection.id,
      'serviceName', selection.service_name,
      'categoryName', coalesce(selection.category_name, 'Service'),
      'providerName', coalesce(provider.business_name, 'Provider'),
      'status', selection.status,
      'notes', selection.notes,
      'cateringOptionName', selection.catering_option_name,
      'venueOptionName', selection.venue_option_name,
      'venueBookedHours', selection.venue_booked_hours
    ) order by selection.created_at, selection.id) as items
    from public.event_service_selections selection
    left join public.provider_profiles provider on provider.id = selection.provider_id
    where selection.event_id = event.id
      and selection.status not in ('declined', 'cancelled')
  ) service_selection on true
  left join lateral (
    select paid_payment.*
    from public.payments paid_payment
    where paid_payment.event_id = event.id
      and paid_payment.coordinator_id = auth.uid()
      and paid_payment.payment_scope = 'coordinator_service'
      and paid_payment.status in ('paid', 'verified')
      and (
        paid_payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or paid_payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
    order by coalesce(paid_payment.verified_at, paid_payment.paid_at,
      paid_payment.created_at) desc, paid_payment.id desc
    limit 1
  ) payment on true
  where auth.uid() is not null
    and (
      (event.pending_coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'pending')
      or (event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted')
    )
  order by event.coordinator_assignment_requested_at desc nulls last,
    event.updated_at desc;
$$;

-- The existing provider confirmation cards already expose held funds. Keep
-- that surface truthful in Phase 1 by deriving its status and withdrawable
-- amount from the secured ledger state, without redesigning the wallet UI.
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
    where (
      payment.metadata ->> 'accountingVersion' = 'phase5-v1'
      or payment.metadata ->> 'accounting_version' = 'phase5-v1'
    )
    group by payment.booking_id
  ), ledger_rollup as (
    select ledger.booking_id,
      round(coalesce(sum(ledger.provider_net_amount), 0), 2) as amount_earned,
      round(coalesce(sum(ledger.held_provider_amount) filter (
        where ledger.provider_funds_status in (
          'awaiting_provider_acceptance', 'held_receivable', 'rejected_held',
          'eligible_for_release', 'disputed_on_hold'
        )
      ), 0), 2) as amount_held,
      round(coalesce(sum(ledger.amount_released), 0), 2) as amount_paid_out,
      round(coalesce(sum(greatest(ledger.provider_net_amount - ledger.amount_released, 0)) filter (
        where ledger.provider_funds_status in (
          'legacy', 'initial_share_credited', 'available_for_payout'
        )
      ), 0), 2) as amount_withdrawable,
      max(ledger.receivable_accepted_at) as receivable_accepted_at,
      max(ledger.payout_eligible_on) as payout_eligible_on,
      (array_agg(ledger.provider_funds_status
        order by ledger.updated_at desc nulls last, ledger.id desc))[1] as funds_state
    from public.financial_transactions ledger
    join owned_bookings booking on booking.id = ledger.booking_id
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      )
    group by ledger.booking_id
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
        'amountWithdrawable', coalesce(ledger.amount_withdrawable, 0),
        'amountPaidOut', coalesce(ledger.amount_paid_out, 0),
        'remainingServiceBalance', greatest(booking.service_amount
          - coalesce(payment.snapshotted_initial_share, booking.initial_share), 0),
        'paymentStatus', case when coalesce(payment.is_paid, false)
          then 'Initial payment received' else 'Awaiting Client Payment' end,
        'fundsStatus', case
          when not coalesce(payment.is_paid, false) then 'Awaiting Client Payment'
          when coalesce(ledger.funds_state, '') = 'awaiting_provider_acceptance'
            then 'Held / Pending Booking Acceptance'
          when coalesce(ledger.funds_state, '') = 'held_receivable'
            then 'Held Receivable'
          when coalesce(ledger.funds_state, '') = 'eligible_for_release'
            then 'Eligible for Release'
          when coalesce(ledger.funds_state, '') = 'available_for_payout'
            then 'Available for Payout'
          when coalesce(ledger.funds_state, '') = 'payout_pending'
            then 'Payout Pending'
          when coalesce(ledger.funds_state, '') = 'paid_out'
            then 'Paid Out'
          when coalesce(ledger.funds_state, '') = 'rejected_held'
            then 'Held for Replacement or Refund'
          when coalesce(ledger.funds_state, '') in ('refunded', 'disputed_on_hold')
            then replace(coalesce(ledger.funds_state, ''), '_', ' ')
          when coalesce(ledger.amount_earned, 0) > 0 then 'Legacy Credited Balance'
          else 'Payment Held'
        end,
        'balanceStatus', case
          when coalesce(ledger.funds_state, '') = 'held_receivable'
            then 'Held by MULTIVENT until the 14-day payout eligibility window.'
          when coalesce(ledger.funds_state, '') = 'awaiting_provider_acceptance'
            then 'The allocation remains held until this booking is accepted.'
          when coalesce(ledger.funds_state, '') = 'rejected_held'
            then 'The allocation is held while replacement or refund is resolved.'
          when coalesce(ledger.funds_state, '') in ('eligible_for_release', 'available_for_payout')
            then 'Release remains subject to booking and payment validation.'
          else 'Not Yet Eligible'
        end,
        'payoutStatus', case
          when coalesce(ledger.funds_state, '') = 'available_for_payout' then 'Eligible for Payout'
          when coalesce(ledger.funds_state, '') = 'payout_pending' then 'Payout Pending'
          when coalesce(ledger.funds_state, '') = 'paid_out' then 'Paid Out'
          when coalesce(ledger.amount_withdrawable, 0) > 0 then 'Legacy eligible balance'
          else 'Not Yet Eligible'
        end,
        'paidAt', payment.paid_at,
        'creditedAt', ledger.receivable_accepted_at,
        'payoutEligibleOn', ledger.payout_eligible_on
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

-- The existing payout endpoint is the authority for provider withdrawals.
-- It now considers only historic credited amounts and future explicitly
-- available funds; held receivables are excluded even if a caller manipulates
-- a frontend balance.
create or replace function public.request_my_provider_payout(requested_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  available_balance numeric(12,2);
  payout_id uuid;
begin
  if requested_amount is null or requested_amount <= 0
    or requested_amount <> round(requested_amount, 2)
  then
    raise exception 'Enter a valid payout amount with no fractions smaller than one centavo.';
  end if;

  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and provider.verification_status = 'verified'
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1
  for update of provider;

  if provider_id_value is null then
    raise exception 'A verified service-provider account is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.provider_payout_accounts account
    where account.provider_id = provider_id_value
      and account.ownership_confirmed
  ) then
    raise exception 'Add and confirm a payout account before requesting a payout.';
  end if;

  select greatest(
    coalesce((
      select sum(greatest(ledger.provider_net_amount - ledger.amount_released, 0))
      from public.financial_transactions ledger
      where ledger.provider_id = provider_id_value
        and ledger.transaction_type = 'booking_payment'
        and ledger.status in ('paid', 'verified')
        and ledger.provider_funds_status in (
          'legacy', 'initial_share_credited', 'available_for_payout'
        )
    ), 0) - coalesce((
      select sum(request.amount)
      from public.provider_payout_requests request
      where request.provider_id = provider_id_value
        and request.status in ('requested', 'processing', 'paid')
    ), 0),
    0
  ) into available_balance;

  if requested_amount > available_balance then
    raise exception 'The payout request exceeds the available balance (%).', available_balance;
  end if;

  insert into public.provider_payout_requests (
    provider_id, amount, currency, status, requested_at, created_at, updated_at
  ) values (
    provider_id_value, requested_amount, 'PHP', 'requested', now(), now(), now()
  ) returning id into payout_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    auth.uid(), 'Payout request received',
    format('Your payout request for PHP %s is awaiting processing.',
      to_char(requested_amount, 'FM999,999,999,990.00')),
    'provider_payout_request', payout_id
  );

  return payout_id;
end;
$$;

revoke all on function public.seed_phase11_receivable_fields() from public;
revoke all on function public.enforce_phase11_receivable_hold() from public;
revoke all on function public.hold_phase11_provider_receivable(uuid) from public;
revoke all on function public.hold_phase11_coordinator_receivable(uuid, uuid) from public;
revoke all on function public.release_phase6_provider_initial_share(uuid) from public;
revoke all on function public.release_phase6_coordinator_initial_share(uuid, uuid) from public;
revoke all on function public.respond_to_provider_booking(uuid, boolean, text) from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
revoke all on function public.request_my_provider_payout(numeric) from public;
grant execute on function public.respond_to_provider_booking(uuid, boolean, text) to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;

comment on column public.financial_transactions.payout_eligible_on is
  'Authoritative event-date-derived earliest payout date. Phase 1 records it only; Phase 2 evaluates release eligibility.';
comment on column public.financial_transactions.receivable_reconciliation_required is
  'True when a pre-V11 accepted or credited allocation needs finance review rather than an automatic historical rewrite.';
comment on function public.request_my_provider_payout(numeric) is
  'Requests payout only against authoritative available balances; held receivables are excluded.';

commit;
