-- MULTIVENT business adjustment: automatic provider settlement and remittance totals.
-- Apply after 39_commission_markup_pricing.sql.

begin;

-- Direct-to-provider receipts are separate from platform cash. Keeping them in
-- an append-only table prevents a checkbox from silently rewriting payments.
create table if not exists public.provider_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  source text not null default 'direct_event_payment',
  reference_number text,
  notes text,
  received_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint provider_payment_receipt_source_check
    check (source in ('direct_event_payment', 'other_direct_payment'))
);

create index if not exists provider_payment_receipts_booking_idx
  on public.provider_payment_receipts (booking_id, received_at desc);

alter table public.provider_payment_receipts enable row level security;

revoke all on table public.provider_payment_receipts from anon, authenticated;

drop policy if exists "Remittance staff view provider receipts" on public.provider_payment_receipts;
create policy "Remittance staff view provider receipts"
  on public.provider_payment_receipts for select to authenticated
  using (public.has_permission('remittance.view') or public.has_permission('remittance.create'));

grant select on public.provider_payment_receipts to authenticated;

-- Deposits reserve provider services, so the 30% is entirely provider money.
-- Full payments still split the provider price from MULTIVENT's added fee.
create or replace function public.capture_payment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_rate numeric(7,6) := 0.10;
  booking_total numeric(12,2);
  payment_type text;
begin
  if new.status = 'refunded' then
    update public.financial_transactions
    set transaction_type = 'refund',
        payment_method = new.provider,
        commission_amount = 0,
        provider_net_amount = 0,
        amount_received = 0,
        amount_released = gross_amount,
        status = 'refunded',
        transaction_at = coalesce(new.verified_at, new.paid_at, transaction_at),
        updated_at = now()
    where payment_id = new.id;
    return new;
  end if;

  if new.status not in ('paid', 'verified') then
    update public.financial_transactions
    set transaction_type = 'booking_payment',
        payment_method = new.provider,
        commission_amount = 0,
        provider_net_amount = 0,
        amount_received = 0,
        amount_released = 0,
        status = new.status::text,
        updated_at = now()
    where payment_id = new.id;
    return new;
  end if;

  select public.get_public_commission_rate() into configured_rate;
  payment_type := coalesce(new.metadata ->> 'paymentType', 'full');
  delete from public.financial_transactions where payment_id = new.id;

  if new.booking_id is not null then
    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received,
      amount_released, status, transaction_at, metadata
    )
    select new.id, booking.id, booking.event_id, booking.provider_id, new.provider,
      new.amount,
      coalesce(booking.commission_rate, configured_rate),
      case
        when booking.commission_model = 'added_to_customer' and payment_type = 'deposit' then
          least(
            greatest(
              new.amount - least(
                new.amount,
                round(coalesce(booking.provider_amount, booking.amount, 0) * 0.30, 2)
              ),
              0
            ),
            coalesce(booking.commission_amount, 0)
          )
        when booking.commission_model = 'added_to_customer' then
          case when coalesce(booking.amount, 0) > 0 and booking.commission_amount is not null
            then round(new.amount * booking.commission_amount / booking.amount, 2)
            else round(new.amount * coalesce(booking.commission_rate, configured_rate)
              / (1 + coalesce(booking.commission_rate, configured_rate)), 2)
          end
        else round(new.amount * coalesce(booking.commission_rate, configured_rate), 2)
      end,
      new.amount - case
        when booking.commission_model = 'added_to_customer' and payment_type = 'deposit' then
          least(
            greatest(
              new.amount - least(
                new.amount,
                round(coalesce(booking.provider_amount, booking.amount, 0) * 0.30, 2)
              ),
              0
            ),
            coalesce(booking.commission_amount, 0)
          )
        when booking.commission_model = 'added_to_customer' then
          case when coalesce(booking.amount, 0) > 0 and booking.commission_amount is not null
            then round(new.amount * booking.commission_amount / booking.amount, 2)
            else round(new.amount * coalesce(booking.commission_rate, configured_rate)
              / (1 + coalesce(booking.commission_rate, configured_rate)), 2)
          end
        else round(new.amount * coalesce(booking.commission_rate, configured_rate), 2)
      end,
      new.amount,
      case when booking.commission_model = 'added_to_customer'
        then new.amount - case
          when payment_type = 'deposit' then
            least(
              greatest(
                new.amount - least(
                  new.amount,
                  round(coalesce(booking.provider_amount, booking.amount, 0) * 0.30, 2)
                ),
                0
              ),
              coalesce(booking.commission_amount, 0)
            )
          when coalesce(booking.amount, 0) > 0 and booking.commission_amount is not null
            then round(new.amount * booking.commission_amount / booking.amount, 2)
          else round(new.amount * coalesce(booking.commission_rate, configured_rate)
            / (1 + coalesce(booking.commission_rate, configured_rate)), 2)
        end
        else 0
      end,
      new.status::text,
      coalesce(new.verified_at, new.paid_at, now()),
      jsonb_build_object(
        'commission_model', coalesce(booking.commission_model, 'deducted_from_provider'),
        'payment_type', payment_type,
        'provider_release', booking.commission_model = 'added_to_customer'
      )
    from public.bookings booking
    where booking.id = new.booking_id;
  elsif new.event_id is not null then
    select sum(coalesce(booking.amount, 0)) into booking_total
    from public.bookings booking
    where booking.event_id = new.event_id
      and booking.status not in ('rejected', 'cancelled', 'expired');

    with allocations as (
      select booking.id,
        booking.event_id,
        booking.provider_id,
        coalesce(booking.commission_rate, configured_rate) as applied_rate,
        coalesce(booking.commission_model, 'deducted_from_provider') as applied_model,
        booking.amount as booked_gross,
        booking.provider_amount as booked_provider_amount,
        booking.commission_amount as booked_commission,
        case when coalesce(booking_total, 0) > 0
          then round(new.amount * coalesce(booking.amount, 0) / booking_total, 2)
          else 0
        end as allocated_gross
      from public.bookings booking
      where booking.event_id = new.event_id
        and booking.status not in ('rejected', 'cancelled', 'expired')
    ), priced_allocations as (
      select allocation.*,
        case
          when allocation.applied_model = 'added_to_customer' and payment_type = 'deposit' then
            least(
              greatest(
                allocation.allocated_gross - least(
                  allocation.allocated_gross,
                  round(coalesce(allocation.booked_provider_amount, allocation.booked_gross, 0) * 0.30, 2)
                ),
                0
              ),
              coalesce(allocation.booked_commission, 0)
            )
          when allocation.applied_model = 'added_to_customer' then
            case when coalesce(allocation.booked_gross, 0) > 0
              and allocation.booked_commission is not null
              then round(allocation.allocated_gross * allocation.booked_commission
                / allocation.booked_gross, 2)
              else round(allocation.allocated_gross * allocation.applied_rate
                / (1 + allocation.applied_rate), 2)
            end
          else round(allocation.allocated_gross * allocation.applied_rate, 2)
        end as allocated_commission
      from allocations allocation
    )
    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received,
      amount_released, status, transaction_at, metadata
    )
    select new.id, allocation.id, allocation.event_id, allocation.provider_id,
      new.provider, allocation.allocated_gross, allocation.applied_rate,
      allocation.allocated_commission,
      allocation.allocated_gross - allocation.allocated_commission,
      allocation.allocated_gross,
      case when allocation.applied_model = 'added_to_customer'
        then allocation.allocated_gross - allocation.allocated_commission
        else 0
      end,
      new.status::text,
      coalesce(new.verified_at, new.paid_at, now()),
      jsonb_build_object(
        'commission_model', allocation.applied_model,
        'payment_type', payment_type,
        'provider_release', allocation.applied_model = 'added_to_customer'
      )
    from priced_allocations allocation;
  end if;

  return new;
end;
$$;

drop trigger if exists capture_payment_financials_trigger on public.payments;
create trigger capture_payment_financials_trigger
after insert or update of status, amount, provider, booking_id, event_id, paid_at, verified_at
on public.payments
for each row execute function public.capture_payment_financials();
revoke all on function public.capture_payment_financials() from public;

-- Rebuild only new-model ledgers. Legacy bookings retain their historical
-- deduction accounting from the previous migration.
update public.payments payment
set status = payment.status
where payment.status in ('paid', 'verified')
  and exists (
    select 1 from public.bookings booking
    where booking.id = payment.booking_id
      and booking.commission_model = 'added_to_customer'
  );

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
      ) as provider_received,
      greatest(
        eligible.provider_amount
          - coalesce(platform_totals.provider_received, 0),
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

create or replace function public.record_provider_direct_payment(
  target_booking_id uuid,
  reference_number text default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  event_row public.events%rowtype;
  expectation_row record;
  receipt_id uuid;
  provider_user_id uuid;
  caller_role public.user_role;
begin
  if not public.has_permission('remittance.create') then
    raise exception 'Remittance-entry access is required.' using errcode = '42501';
  end if;

  select booking.* into booking_row
  from public.bookings booking
  where booking.id = target_booking_id
  for update;
  if booking_row.id is null then raise exception 'Booking not found.'; end if;

  select event.* into event_row
  from public.events event
  where event.id = booking_row.event_id
  for update;
  if event_row.status not in ('confirmed', 'in_progress', 'completed') then
    raise exception 'Direct provider payment can only be recorded for a confirmed or completed event.';
  end if;
  if exists (
    select 1 from public.cash_remittances remittance
    where remittance.booking_id = target_booking_id
      and remittance.status <> 'disputed'
      and remittance.amount_received > 0
  ) then
    raise exception 'A coordinator remittance has already been received for this booking.';
  end if;

  select expectation.* into expectation_row
  from public.get_event_remittance_expectations(booking_row.event_id) expectation
  where expectation.booking_id = target_booking_id;
  if expectation_row.booking_id is null then raise exception 'Remittance expectation not found.'; end if;
  if expectation_row.provider_outstanding <= 0 then
    raise exception 'The provider amount is already fully recorded as received.';
  end if;

  insert into public.provider_payment_receipts (
    booking_id, event_id, provider_id, amount, source,
    reference_number, notes, received_at, recorded_by
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id,
    expectation_row.provider_outstanding, 'direct_event_payment',
    nullif(trim(reference_number), ''), nullif(trim(notes), ''), now(), auth.uid()
  ) returning id into receipt_id;

  -- Mirror the direct receipt in the financial ledger. Received and released
  -- are equal because this money moved from the client to the provider without
  -- entering MULTIVENT custody.
  insert into public.financial_transactions (
    booking_id, event_id, provider_id, transaction_type, payment_method,
    gross_amount, commission_rate, commission_amount, provider_net_amount,
    amount_received, amount_released, status, transaction_at, metadata
  ) values (
    booking_row.id, booking_row.event_id, booking_row.provider_id,
    'booking_payment', 'direct_to_provider', expectation_row.provider_outstanding,
    coalesce(booking_row.commission_rate, public.get_public_commission_rate()),
    0, expectation_row.provider_outstanding,
    expectation_row.provider_outstanding, expectation_row.provider_outstanding,
    'verified', now(),
    jsonb_build_object(
      'provider_payment_receipt_id', receipt_id,
      'commission_model', 'added_to_customer',
      'payment_type', 'provider_balance',
      'provider_release', true,
      'cash_custody', 'direct_to_provider'
    )
  );

  select provider.user_id into provider_user_id
  from public.provider_profiles provider where provider.id = booking_row.provider_id;
  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'provider.payment.direct.record', 'booking', booking_row.id,
    jsonb_build_object(
      'provider_id', booking_row.provider_id,
      'amount', expectation_row.provider_outstanding,
      'source', 'direct_event_payment'
    ),
    'success', jsonb_build_object('provider_payment_receipt_id', receipt_id)
  );

  if provider_user_id is not null then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      provider_user_id,
      'Direct payment recorded',
      format('MULTIVENT recorded PHP %s as received directly for %s.',
        to_char(expectation_row.provider_outstanding, 'FM999,999,999,990.00'), event_row.name),
      'booking', booking_row.id
    );
  end if;

  return receipt_id;
end;
$$;

revoke all on function public.record_provider_direct_payment(uuid, text, text) from public;
grant execute on function public.record_provider_direct_payment(uuid, text, text) to authenticated;

-- Keep the established signature for compatibility, but calculate the expected
-- total on the server. The caller-supplied expected_amount is never trusted.
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
  expectation_row record;
  remittance_id uuid;
  booking_provider_id uuid;
  booking_commission_rate numeric(7,6);
  calculated_expected numeric(12,2);
  total_received numeric(12,2);
  next_status text;
begin
  if not public.has_permission('remittance.create') then
    raise exception 'Remittance-entry access is required.' using errcode = '42501';
  end if;
  if target_booking_id is null then
    raise exception 'Select a service booking so the remittance can be calculated automatically.';
  end if;
  if received_amount is null or received_amount <= 0 then
    raise exception 'The received amount must be greater than zero.';
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

  select booking.provider_id,
    coalesce(booking.commission_rate, public.get_public_commission_rate())
  into booking_provider_id, booking_commission_rate
  from public.bookings booking
  where booking.id = target_booking_id
    and booking.event_id = target_event_id
    and booking.status not in ('rejected', 'cancelled', 'expired');
  if booking_provider_id is null then
    raise exception 'The selected booking does not belong to this completed event.';
  end if;

  select expectation.* into expectation_row
  from public.get_event_remittance_expectations(target_event_id) expectation
  where expectation.booking_id = target_booking_id;
  if expectation_row.booking_id is null then raise exception 'Remittance expectation not found.'; end if;
  if expectation_row.amount_remaining <= 0 then
    raise exception 'Nothing remains to be remitted for this booking.';
  end if;
  if received_amount > expectation_row.amount_remaining then
    raise exception 'The received amount cannot exceed the automatic remaining balance (%).',
      expectation_row.amount_remaining;
  end if;

  select remittance.* into existing_row
  from public.cash_remittances remittance
  where remittance.event_id = target_event_id
    and remittance.coordinator_id = target_coordinator_id
    and remittance.booking_id = target_booking_id
    and remittance.status in ('pending', 'partially_remitted')
  order by remittance.created_at desc
  limit 1
  for update;

  if existing_row.id is not null then
    calculated_expected := existing_row.amount_received + expectation_row.amount_remaining;
    total_received := existing_row.amount_received + received_amount;
    next_status := case
      when total_received < calculated_expected then 'partially_remitted'
      else 'remitted'
    end;
    update public.cash_remittances
    set amount_expected = calculated_expected,
        amount_received = total_received,
        received_at = now(),
        received_by = auth.uid(),
        status = next_status,
        reference_number = coalesce(nullif(trim(reference_number), ''), existing_row.reference_number),
        notes = coalesce(nullif(trim(notes), ''), existing_row.notes),
        updated_at = now()
    where id = existing_row.id
    returning id into remittance_id;
  else
    calculated_expected := expectation_row.amount_remaining;
    total_received := received_amount;
    next_status := case
      when total_received < calculated_expected then 'partially_remitted'
      else 'remitted'
    end;
    insert into public.cash_remittances (
      event_id, booking_id, coordinator_id, amount_expected, amount_received,
      received_at, received_by, status, reference_number, notes
    ) values (
      target_event_id, target_booking_id, target_coordinator_id,
      calculated_expected, total_received, now(), auth.uid(), next_status,
      nullif(trim(reference_number), ''), nullif(trim(notes), '')
    ) returning id into remittance_id;
  end if;

  update public.financial_transactions
  set transaction_type = 'provider_remittance',
      gross_amount = total_received,
      commission_rate = booking_commission_rate,
      commission_amount = least(total_received, expectation_row.commission_outstanding),
      provider_net_amount = greatest(total_received - expectation_row.commission_outstanding, 0),
      amount_received = total_received,
      status = next_status,
      transaction_at = now(),
      metadata = metadata || jsonb_build_object(
        'calculated_automatically', true,
        'provider_outstanding', expectation_row.provider_outstanding,
        'commission_outstanding', expectation_row.commission_outstanding
      ),
      updated_at = now()
  where metadata ->> 'cash_remittance_id' = remittance_id::text;

  if not found then
    insert into public.financial_transactions (
      booking_id, event_id, provider_id, transaction_type, payment_method,
      gross_amount, commission_rate, commission_amount, provider_net_amount,
      amount_received, amount_released, status, transaction_at, metadata
    ) values (
      target_booking_id, target_event_id, booking_provider_id,
      'provider_remittance', 'cash', total_received, booking_commission_rate,
      least(total_received, expectation_row.commission_outstanding),
      greatest(total_received - expectation_row.commission_outstanding, 0),
      total_received, 0, next_status, now(),
      jsonb_build_object(
        'cash_remittance_id', remittance_id,
        'calculated_automatically', true,
        'provider_outstanding', expectation_row.provider_outstanding,
        'commission_outstanding', expectation_row.commission_outstanding
      )
    );
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

revoke all on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) from public;
grant execute on function public.record_cash_remittance(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated;

-- A remittance is recognized as booking revenue only after a second authorized
-- staff member verifies the complete handoff. Disputed cash remains excluded.
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
  set transaction_type = case
        when new_status = 'verified' then 'booking_payment'
        else 'provider_remittance'
      end,
      status = new_status,
      updated_at = now()
  where metadata ->> 'cash_remittance_id' = target_remittance_id::text;

  select event.name into event_name
  from public.events event where event.id = remittance_row.event_id;

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    remittance_row.coordinator_id,
    case when new_status = 'verified'
      then 'Cash remittance verified'
      else 'Cash remittance disputed'
    end,
    case when new_status = 'verified'
      then format('The cash remittance for %s was verified by MULTIVENT.', event_name)
      else format('The cash remittance for %s was disputed. %s', event_name, trim(reason))
    end,
    'cash_remittance', target_remittance_id
  );
end;
$$;

revoke all on function public.review_cash_remittance(uuid, text, text) from public;
grant execute on function public.review_cash_remittance(uuid, text, text) to authenticated;

-- The guarded RPC writes a deliberately limited audit entry. Do not attach the
-- generic row snapshot trigger here because receipt notes may contain private
-- operational details that do not belong in the audit log.
drop trigger if exists capture_platform_audit_trigger on public.provider_payment_receipts;

comment on table public.provider_payment_receipts is
  'Append-only acknowledgements of money a provider received outside MULTIVENT cash custody.';
comment on function public.get_event_remittance_expectations(uuid) is
  'Calculates provider balances and unpaid MULTIVENT commission for each event booking.';
comment on function public.record_provider_direct_payment(uuid, text, text) is
  'Records the remaining provider amount as paid directly and leaves commission due to MULTIVENT.';

commit;
