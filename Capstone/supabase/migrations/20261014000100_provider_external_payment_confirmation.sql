-- Phase 5: provider-confirmed external balances and payment-gated completion.
-- Apply after 68_conditional_event_coordinator_step.sql.
--
-- The 35% MULTIVENT downpayment remains unchanged: 30% provider allocation
-- plus the 5% platform fee. The remaining provider balance is paid outside
-- MULTIVENT and is therefore recorded as provider-confirmed, never as a
-- verified gateway payment.

begin;

alter table public.bookings
  add column if not exists completion_payment_status text,
  add column if not exists completion_payment_updated_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_completion_payment_status_check,
  add constraint bookings_completion_payment_status_check check (
    completion_payment_status is null
    or completion_payment_status in (
      'awaiting_external_payment',
      'partially_confirmed',
      'fully_confirmed'
    )
  );

create table if not exists public.provider_external_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  source text not null default 'provider_confirmed_external',
  confirmation_status text not null default 'provider_confirmed_unverified',
  request_key text not null,
  notes text,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint provider_external_payment_confirmations_source_check
    check (source = 'provider_confirmed_external'),
  constraint provider_external_payment_confirmations_status_check
    check (confirmation_status = 'provider_confirmed_unverified'),
  constraint provider_external_payment_confirmations_request_key_check
    check (char_length(trim(request_key)) between 8 and 200),
  constraint provider_external_payment_confirmations_provider_request_key_key
    unique (booking_id, provider_id, request_key)
);

create index if not exists provider_external_payment_confirmations_booking_idx
  on public.provider_external_payment_confirmations (booking_id, confirmed_at desc);

alter table public.provider_external_payment_confirmations enable row level security;
revoke all on table public.provider_external_payment_confirmations from public, anon, authenticated;
grant select on table public.provider_external_payment_confirmations to authenticated;

drop policy if exists "Clients and providers view related external payment confirmations"
  on public.provider_external_payment_confirmations;
drop policy if exists "Providers view their external payment confirmations"
  on public.provider_external_payment_confirmations;
create policy "Providers view their external payment confirmations"
  on public.provider_external_payment_confirmations
  for select to authenticated
  using (
    exists (
      select 1
      from public.provider_profiles provider
      where provider.id = provider_external_payment_confirmations.provider_id
        and (
          provider.user_id = auth.uid()
          or public.has_permission('remittance.view')
          or public.has_permission('remittance.create')
        )
    )
  );

alter table public.financial_transactions
  add column if not exists external_confirmation_id uuid
    references public.provider_external_payment_confirmations(id) on delete restrict;

drop index if exists public.financial_transactions_external_confirmation_uidx;
create unique index financial_transactions_external_confirmation_uidx
  on public.financial_transactions (external_confirmation_id)
  where external_confirmation_id is not null;

alter table public.financial_transactions
  drop constraint if exists financial_transaction_type_check,
  add constraint financial_transaction_type_check check (transaction_type in (
    'booking_payment',
    'commission_revenue',
    'provider_payable',
    'provider_remittance',
    'provider_external_confirmation',
    'refund',
    'adjustment'
  ));

-- A shared server-side calculation prevents client state, platform-fee rows,
-- and direct-to-provider staff receipts from being confused with one another.
create or replace function public.get_provider_booking_completion_balance(
  target_booking_id uuid
)
returns table (
  service_amount numeric,
  initial_provider_amount numeric,
  recorded_external_amount numeric,
  remaining_balance numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with target_booking as (
    select
      booking.id,
      round(coalesce(booking.provider_amount, booking.amount, 0), 2) as service_amount
    from public.bookings booking
    where booking.id = target_booking_id
  ), initial_payment as (
    select
      booking.id,
      coalesce(max(
        case
          when coalesce(payment.metadata ->> 'paymentType', 'deposit') = 'deposit'
            then coalesce(payment.provider_initial_allocation, round(booking.service_amount * 0.30, 2))
          else coalesce(payment.service_subtotal, booking.service_amount)
        end
      ), 0) as initial_provider_amount
    from target_booking booking
    left join public.payments payment
      on payment.booking_id = booking.id
      and payment.status in ('paid', 'verified')
    group by booking.id, booking.service_amount
  ), external_receipts as (
    select
      booking.id,
      coalesce((
        select sum(receipt.amount)
        from public.provider_payment_receipts receipt
        where receipt.booking_id = booking.id
      ), 0)
      + coalesce((
        select sum(confirmation.amount)
        from public.provider_external_payment_confirmations confirmation
        where confirmation.booking_id = booking.id
          and confirmation.confirmation_status = 'provider_confirmed_unverified'
      ), 0) as recorded_external_amount
    from target_booking booking
  )
  select
    booking.service_amount,
    initial_payment.initial_provider_amount,
    external_receipts.recorded_external_amount,
    greatest(
      booking.service_amount
        - initial_payment.initial_provider_amount
        - external_receipts.recorded_external_amount,
      0
    ) as remaining_balance
  from target_booking booking
  join initial_payment on initial_payment.id = booking.id
  join external_receipts on external_receipts.id = booking.id;
$$;

revoke all on function public.get_provider_booking_completion_balance(uuid) from public, anon, authenticated;

create or replace function public.get_my_booking_external_payment_summaries(
  target_booking_ids uuid[] default null
)
returns table (
  booking_id uuid,
  confirmed_external_amount numeric,
  completion_payment_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    booking.id as booking_id,
    coalesce(receipts.amount, 0) + coalesce(confirmations.amount, 0)
      as confirmed_external_amount,
    booking.completion_payment_status
  from public.bookings booking
  left join public.provider_profiles provider on provider.id = booking.provider_id
  left join lateral (
    select sum(receipt.amount) as amount
    from public.provider_payment_receipts receipt
    where receipt.booking_id = booking.id
  ) receipts on true
  left join lateral (
    select sum(confirmation.amount) as amount
    from public.provider_external_payment_confirmations confirmation
    where confirmation.booking_id = booking.id
      and confirmation.confirmation_status = 'provider_confirmed_unverified'
  ) confirmations on true
  where (
    booking.client_id = auth.uid()
    or provider.user_id = auth.uid()
  )
  and (target_booking_ids is null or booking.id = any(target_booking_ids));
$$;

revoke all on function public.get_my_booking_external_payment_summaries(uuid[]) from public, anon;
grant execute on function public.get_my_booking_external_payment_summaries(uuid[]) to authenticated;

-- Existing staff remittance tools calculate the amount still due from one
-- shared source. Include provider-confirmed direct payments in that source so
-- a later staff reconciliation cannot record the same client payment twice.
create or replace function public.get_event_remittance_expectations(target_event_id uuid)
returns table (
  booking_id uuid,
  event_id uuid,
  provider_id uuid,
  service_name text,
  provider_name text,
  booking_total numeric,
  provider_amount numeric,
  provider_received numeric,
  provider_outstanding numeric,
  commission_amount numeric,
  commission_received numeric,
  commission_outstanding numeric,
  amount_expected numeric,
  amount_remitted numeric,
  amount_remaining numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_bookings as (
    select booking.id,
      booking.event_id,
      booking.provider_id,
      coalesce(nullif(trim(service.name), ''), 'Service') as service_name,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name,
      coalesce(booking.amount, 0)::numeric as booking_total,
      coalesce(booking.provider_amount, booking.amount, 0)::numeric as provider_amount,
      coalesce(booking.commission_amount, 0)::numeric as commission_amount
    from public.bookings booking
    left join public.services service on service.id = booking.service_id
    join public.provider_profiles provider on provider.id = booking.provider_id
    where booking.event_id = target_event_id
      and booking.status not in ('rejected', 'cancelled', 'expired')
      and booking.commission_model = 'added_to_customer'
      and (
        public.has_permission('remittance.view')
        or public.has_permission('remittance.create')
      )
  ), platform_totals as (
    select ledger.booking_id,
      coalesce(sum(ledger.amount_released), 0)::numeric as provider_received,
      coalesce(sum(ledger.commission_amount), 0)::numeric as commission_received
    from public.financial_transactions ledger
    where ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
    group by ledger.booking_id
  ), external_confirmation_totals as (
    select confirmation.booking_id,
      coalesce(sum(confirmation.amount), 0)::numeric as provider_received
    from public.provider_external_payment_confirmations confirmation
    where confirmation.confirmation_status = 'provider_confirmed_unverified'
    group by confirmation.booking_id
  ), remittance_totals as (
    select remittance.booking_id, coalesce(sum(remittance.amount_received), 0)::numeric as amount_remitted
    from public.cash_remittances remittance
    where remittance.booking_id is not null
      and remittance.status <> 'disputed'
    group by remittance.booking_id
  ), calculated as (
    select eligible.*,
      least(
        eligible.provider_amount,
        coalesce(platform_totals.provider_received, 0)
          + coalesce(external_confirmation_totals.provider_received, 0)
      ) as provider_received,
      greatest(
        eligible.provider_amount
          - coalesce(platform_totals.provider_received, 0)
          - coalesce(external_confirmation_totals.provider_received, 0),
        0
      ) as provider_outstanding,
      least(eligible.commission_amount, coalesce(platform_totals.commission_received, 0))
        as commission_received,
      greatest(
        eligible.commission_amount - coalesce(platform_totals.commission_received, 0),
        0
      ) as commission_outstanding,
      coalesce(remittance_totals.amount_remitted, 0) as amount_remitted
    from eligible_bookings eligible
    left join platform_totals on platform_totals.booking_id = eligible.id
    left join external_confirmation_totals on external_confirmation_totals.booking_id = eligible.id
    left join remittance_totals on remittance_totals.booking_id = eligible.id
  )
  select calculated.id,
    calculated.event_id,
    calculated.provider_id,
    calculated.service_name,
    calculated.provider_name,
    calculated.booking_total,
    calculated.provider_amount,
    calculated.provider_received,
    calculated.provider_outstanding,
    calculated.commission_amount,
    calculated.commission_received,
    calculated.commission_outstanding,
    calculated.provider_outstanding + calculated.commission_outstanding,
    calculated.amount_remitted,
    greatest(
      calculated.provider_outstanding + calculated.commission_outstanding
        - calculated.amount_remitted,
      0
    )
  from calculated
  order by calculated.provider_name, calculated.service_name, calculated.id;
$$;

revoke all on function public.get_event_remittance_expectations(uuid) from public;
grant execute on function public.get_event_remittance_expectations(uuid) to authenticated;

create or replace function public.mark_provider_booking_awaiting_external_payment(
  target_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row public.bookings%rowtype;
  event_row public.events%rowtype;
  balance_row record;
begin
  select booking.* into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id
    and provider.user_id = auth.uid()
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking not found for this service-provider account.' using errcode = '42501';
  end if;
  if booking_row.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can await a remaining payment.';
  end if;

  select event.* into event_row
  from public.events event
  where event.id = booking_row.event_id;
  if event_row.event_date is null
    or event_row.event_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This payment check is available on or after the event date.';
  end if;

  select * into balance_row
  from public.get_provider_booking_completion_balance(booking_row.id);
  if coalesce(balance_row.remaining_balance, 0) <= 0 then
    raise exception 'No remaining provider balance is outstanding for this booking.';
  end if;

  update public.bookings
  set completion_payment_status = 'awaiting_external_payment',
      completion_payment_updated_at = now(),
      updated_at = now()
  where id = booking_row.id;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'recorded_external_amount', balance_row.recorded_external_amount,
    'remaining_balance', balance_row.remaining_balance,
    'status', 'awaiting_external_payment'
  );
end;
$$;

revoke all on function public.mark_provider_booking_awaiting_external_payment(uuid) from public, anon;
grant execute on function public.mark_provider_booking_awaiting_external_payment(uuid) to authenticated;

-- Replaces the earlier direct-completion procedure. Calling this RPC directly
-- can no longer bypass a recorded remaining-balance confirmation.
create or replace function public.mark_provider_booking_completed(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings%rowtype;
  target_event public.events%rowtype;
  service_name text;
  event_is_complete boolean;
  balance_row record;
begin
  select bookings.* into target_booking
  from public.bookings bookings
  join public.provider_profiles provider on provider.id = bookings.provider_id
  where bookings.id = target_booking_id
    and provider.user_id = auth.uid()
  for update of bookings;

  if target_booking.id is null then
    raise exception 'Booking not found for this service-provider account.' using errcode = '42501';
  end if;

  if target_booking.status = 'completed' then
    select status = 'completed' into event_is_complete
    from public.events where id = target_booking.event_id;
    return jsonb_build_object(
      'booking_id', target_booking.id,
      'event_id', target_booking.event_id,
      'event_completed', coalesce(event_is_complete, false)
    );
  end if;
  if target_booking.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be marked completed.';
  end if;

  select * into target_event from public.events where id = target_booking.event_id;
  if target_event.event_date is null
    or target_event.event_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This booking can be completed on or after the event date.';
  end if;

  select * into balance_row
  from public.get_provider_booking_completion_balance(target_booking.id);
  if coalesce(balance_row.remaining_balance, 0) > 0 then
    raise exception 'Record the remaining external payment before completing this service.';
  end if;

  update public.bookings
  set status = 'completed',
      completion_payment_status = 'fully_confirmed',
      completion_payment_updated_at = now(),
      updated_at = now()
  where id = target_booking.id;

  select name into service_name from public.services where id = target_booking.service_id;
  select count(*) > 0 and bool_and(status = 'completed') into event_is_complete
  from public.bookings
  where event_id = target_booking.event_id
    and status not in ('payment_required', 'rejected', 'cancelled', 'expired');

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    target_booking.client_id,
    'Service marked finished',
    coalesce(service_name, 'A service provider') ||
      ' marked their part of ' || target_event.name || ' as finished.',
    'booking',
    target_booking.id
  );

  if event_is_complete then
    update public.events set status = 'completed', updated_at = now()
    where id = target_booking.event_id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      target_booking.client_id,
      'Your event is complete',
      'All providers marked ' || target_event.name ||
        ' as finished. You can now share your overall event experience.',
      'booking',
      target_booking.event_id
    );
  end if;

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'event_id', target_booking.event_id,
    'event_completed', event_is_complete,
    'remaining_balance', 0
  );
end;
$$;

revoke all on function public.mark_provider_booking_completed(uuid) from public, anon;
grant execute on function public.mark_provider_booking_completed(uuid) to authenticated;

create or replace function public.confirm_provider_external_payment(
  target_booking_id uuid,
  received_amount numeric,
  request_key text,
  provider_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_row public.bookings%rowtype;
  event_row public.events%rowtype;
  existing_confirmation public.provider_external_payment_confirmations%rowtype;
  balance_row record;
  remaining_after numeric(12,2);
  confirmation_id uuid;
  completion_result jsonb;
begin
  if nullif(trim(request_key), '') is null or char_length(trim(request_key)) < 8 then
    raise exception 'A valid payment confirmation request key is required.';
  end if;
  if received_amount is null or round(received_amount, 2) <= 0 then
    raise exception 'Enter a payment amount greater than zero.';
  end if;

  select booking.* into booking_row
  from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id
    and provider.user_id = auth.uid()
  for update of booking;

  if booking_row.id is null then
    raise exception 'Booking not found for this service-provider account.' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.cash_remittances remittance
    where remittance.booking_id = booking_row.id
      and remittance.status <> 'disputed'
      and remittance.amount_received > 0
  ) then
    raise exception 'A coordinator remittance already covers this booking. Use staff reconciliation instead.';
  end if;

  select confirmation.* into existing_confirmation
  from public.provider_external_payment_confirmations confirmation
  where confirmation.booking_id = booking_row.id
    and confirmation.provider_id = booking_row.provider_id
    and confirmation.request_key = trim(request_key)
  limit 1;
  if existing_confirmation.id is not null then
    select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
    return jsonb_build_object(
      'booking_id', booking_row.id,
      'confirmation_id', existing_confirmation.id,
      'duplicate_request', true,
      'recorded_external_amount', coalesce(balance_row.recorded_external_amount, 0),
      'remaining_balance', coalesce(balance_row.remaining_balance, 0),
      'booking_completed', booking_row.status = 'completed'
    );
  end if;

  if booking_row.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can record an external remaining payment.';
  end if;
  select event.* into event_row from public.events event where event.id = booking_row.event_id;
  if event_row.event_date is null
    or event_row.event_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This payment confirmation is available on or after the event date.';
  end if;

  select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
  if coalesce(balance_row.remaining_balance, 0) <= 0 then
    raise exception 'The remaining provider balance is already fully recorded.';
  end if;
  if round(received_amount, 2) > balance_row.remaining_balance then
    raise exception 'The confirmed amount cannot exceed the remaining service balance.';
  end if;

  insert into public.provider_external_payment_confirmations (
    booking_id, event_id, provider_id, amount, request_key, notes, confirmed_by
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id,
    round(received_amount, 2), trim(request_key), nullif(trim(provider_note), ''), auth.uid()
  ) returning id into confirmation_id;

  insert into public.financial_transactions (
    booking_id, event_id, provider_id, external_confirmation_id,
    transaction_type, payment_method, gross_amount, commission_rate,
    commission_amount, provider_net_amount, amount_received, amount_released,
    status, transaction_at, metadata
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id, confirmation_id,
    'provider_external_confirmation', 'external_direct', round(received_amount, 2),
    coalesce(booking_row.commission_rate, public.get_public_commission_rate()),
    0, round(received_amount, 2), 0, 0,
    'provider_confirmed_unverified', now(),
    jsonb_build_object(
      'source', 'provider_confirmed_external',
      'gateway_verified', false,
      'external_payment_confirmation_id', confirmation_id,
      'cash_custody', 'direct_to_provider'
    )
  );

  select * into balance_row from public.get_provider_booking_completion_balance(booking_row.id);
  remaining_after := coalesce(balance_row.remaining_balance, 0);
  update public.bookings
  set completion_payment_status = case
        when remaining_after = 0 then 'fully_confirmed'
        else 'partially_confirmed'
      end,
      completion_payment_updated_at = now(),
      updated_at = now()
  where id = booking_row.id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    booking_row.client_id,
    'Provider reported a remaining payment',
    format(
      'Your provider reported receiving PHP %s directly. This is provider-confirmed and not a verified gateway transaction.',
      to_char(round(received_amount, 2), 'FM999,999,999,990.00')
    ),
    'booking',
    booking_row.id
  );

  if remaining_after = 0 then
    select public.mark_provider_booking_completed(booking_row.id) into completion_result;
  else
    completion_result := jsonb_build_object('booking_id', booking_row.id, 'event_completed', false);
  end if;

  return jsonb_build_object(
    'booking_id', booking_row.id,
    'confirmation_id', confirmation_id,
    'recorded_external_amount', coalesce(balance_row.recorded_external_amount, 0),
    'remaining_balance', remaining_after,
    'booking_completed', remaining_after = 0,
    'event_completed', coalesce((completion_result ->> 'event_completed')::boolean, false),
    'confirmation_status', 'provider_confirmed_unverified'
  );
end;
$$;

revoke all on function public.confirm_provider_external_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.confirm_provider_external_payment(uuid, numeric, text, text) to authenticated;

comment on table public.provider_external_payment_confirmations is
  'Append-only records of provider-confirmed direct client payments. These are not verified PayMongo or MULTIVENT-custodied payments.';
comment on column public.financial_transactions.external_confirmation_id is
  'Links an unverified, provider-confirmed external-payment ledger record without treating it as a gateway payment.';

commit;
