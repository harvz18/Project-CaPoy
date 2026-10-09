-- MULTIVENT financial correction: exact 35% / 30% / 5% downpayment split.
-- Apply after 64_mobile_push_security_hardening.sql.
--
-- For each provider-owned service subtotal S:
--   charged by MULTIVENT now     = provider downpayment + platform fee
--   provider downpayment         = round(S * 30%, 2)
--   MULTIVENT platform revenue   = round(S * 5%, 2)
--   held / unallocated amount    = 0
--   collected directly later     = S - provider downpayment (nominally 70%)
--
-- Existing recognized payments and ledger snapshots are not rewritten.

begin;

insert into public.system_settings (key, value, description, updated_at)
values (
  'initial_payment_rate',
  '{"value": 0.35}'::jsonb,
  'Required client downpayment: 30% provider allocation plus 5% MULTIVENT fee.',
  now()
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

alter table public.bookings
  alter column initial_payment_rate set default 0.35;

create or replace function public.get_public_payment_terms()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with terms as (
    select
      public.get_public_commission_rate() as platform_fee_rate,
      coalesce((
        select case
          when jsonb_typeof(setting.value -> 'value') = 'number'
            and (setting.value ->> 'value')::numeric between 0 and 1
          then (setting.value ->> 'value')::numeric
          else null
        end
        from public.system_settings setting
        where setting.key = 'initial_payment_rate'
      ), 0.35) as initial_payment_rate,
      coalesce((
        select case
          when jsonb_typeof(setting.value -> 'value') = 'number'
            and (setting.value ->> 'value')::numeric between 0 and 1
          then (setting.value ->> 'value')::numeric
          else null
        end
        from public.system_settings setting
        where setting.key = 'provider_initial_rate'
      ), 0.30) as provider_initial_rate
  )
  select jsonb_build_object(
    'version', 'phase5-v1',
    'platformFeeRate', terms.platform_fee_rate,
    'initialPaymentRate', terms.initial_payment_rate,
    'providerInitialRate', terms.provider_initial_rate
  )
  from terms;
$$;

-- Keep the existing version identifier because every booking and payment row
-- already snapshots its rates and amounts. Changing the identifier would
-- disconnect Phase 6 acceptance and release logic from otherwise compatible
-- records.
create or replace function public.validate_phase5_financial_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  platform_rate numeric;
  initial_rate numeric;
  provider_rate numeric;
begin
  if new.key not in ('commission_rate', 'initial_payment_rate', 'provider_initial_rate') then
    return new;
  end if;
  if jsonb_typeof(new.value -> 'value') <> 'number'
    or (new.value ->> 'value')::numeric not between 0 and 1
  then
    raise exception '% must contain a decimal rate between 0 and 1.', new.key;
  end if;

  platform_rate := case when new.key = 'commission_rate'
    then (new.value ->> 'value')::numeric
    else public.get_public_commission_rate() end;
  initial_rate := case when new.key = 'initial_payment_rate'
    then (new.value ->> 'value')::numeric
    else coalesce((
      select (setting.value ->> 'value')::numeric
      from public.system_settings setting
      where setting.key = 'initial_payment_rate'
        and jsonb_typeof(setting.value -> 'value') = 'number'
    ), 0.35) end;
  provider_rate := case when new.key = 'provider_initial_rate'
    then (new.value ->> 'value')::numeric
    else coalesce((
      select (setting.value ->> 'value')::numeric
      from public.system_settings setting
      where setting.key = 'provider_initial_rate'
        and jsonb_typeof(setting.value -> 'value') = 'number'
    ), 0.30) end;

  if initial_rate < provider_rate + platform_rate then
    raise exception 'Downpayment rate must cover the provider allocation and platform fee.';
  end if;
  return new;
end;
$$;

-- Re-snapshot only unpaid booking drafts. Paid, verified, refunded, rejected,
-- confirmed, completed, and other historical financial records remain intact.
update public.bookings booking
set initial_payment_rate = 0.35,
    provider_initial_rate = 0.30,
    updated_at = now()
where booking.financial_terms_version = 'phase5-v1'
  and booking.status::text = 'payment_required'
  and not exists (
    select 1
    from public.payments payment
    where payment.booking_id = booking.id
      and payment.status::text in ('paid', 'verified', 'refunded')
  );

-- Authoritative payment snapshot. New Phase 5 checkout records are
-- downpayment-only: the platform collects exactly the independently rounded
-- 30% provider allocation and 5% fee, leaving no unexplained held remainder.
create or replace function public.enforce_phase5_payment_breakdown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row record;
  coordinator_row record;
  terms jsonb;
  payment_type text;
  service_subtotal_value numeric(12,2);
  platform_fee_rate_value numeric(7,6);
  platform_fee_value numeric(12,2);
  client_total_value numeric(12,2);
  initial_rate_value numeric(7,6);
  provider_initial_rate_value numeric(7,6);
  initial_payment_value numeric(12,2);
  provider_initial_value numeric(12,2);
begin
  if tg_op = 'UPDATE'
    and old.status in ('paid', 'verified', 'refunded')
  then
    raise exception 'A recognized payment financial snapshot cannot be changed.' using errcode = '42501';
  end if;

  terms := public.get_public_payment_terms();
  if new.booking_id is not null then
    select booking.provider_amount, booking.amount, booking.commission_rate,
      booking.commission_amount, booking.commission_model,
      booking.financial_terms_version, booking.initial_payment_rate,
      booking.provider_initial_rate
    into booking_row
    from public.bookings booking
    where booking.id = new.booking_id;

    if not found or booking_row.financial_terms_version is distinct from 'phase5-v1' then
      return new;
    end if;
    if booking_row.commission_model is distinct from 'added_to_customer' then
      raise exception 'Phase 5 payments require added-to-customer pricing.';
    end if;

    service_subtotal_value := round(coalesce(booking_row.provider_amount, 0), 2);
    platform_fee_rate_value := coalesce(
      booking_row.commission_rate,
      (terms ->> 'platformFeeRate')::numeric
    );
    platform_fee_value := round(coalesce(
      booking_row.commission_amount,
      service_subtotal_value * platform_fee_rate_value
    ), 2);
    initial_rate_value := coalesce(
      booking_row.initial_payment_rate,
      (terms ->> 'initialPaymentRate')::numeric
    );
    provider_initial_rate_value := coalesce(
      booking_row.provider_initial_rate,
      (terms ->> 'providerInitialRate')::numeric
    );
    new.payment_scope := 'provider_service';
    new.coordinator_id := null;
  elsif new.coordinator_id is not null
    or new.payment_scope = 'coordinator_service'
    or coalesce(new.metadata, '{}'::jsonb) ->> 'paymentScope' = 'coordinator_service'
  then
    select event.client_id,
      case when event.coordinator_assignment_status = 'pending'
        then event.pending_coordinator_id else event.coordinator_id end as coordinator_id,
      event.coordinator_fee_amount
    into coordinator_row
    from public.events event
    where event.id = new.event_id
      and event.status not in ('completed', 'cancelled');

    if not found or coordinator_row.client_id is distinct from new.payer_id
      or coordinator_row.coordinator_id is null
      or coordinator_row.coordinator_id is distinct from new.coordinator_id
      or coalesce(coordinator_row.coordinator_fee_amount, 0) <= 0
    then
      raise exception 'A valid event coordinator payment is required.' using errcode = '42501';
    end if;

    service_subtotal_value := round(coordinator_row.coordinator_fee_amount, 2);
    platform_fee_rate_value := (terms ->> 'platformFeeRate')::numeric;
    platform_fee_value := round(service_subtotal_value * platform_fee_rate_value, 2);
    initial_rate_value := (terms ->> 'initialPaymentRate')::numeric;
    provider_initial_rate_value := (terms ->> 'providerInitialRate')::numeric;
    new.booking_id := null;
    new.payment_scope := 'coordinator_service';
  else
    return new;
  end if;

  payment_type := coalesce(coalesce(new.metadata, '{}'::jsonb) ->> 'paymentType', 'deposit');
  if payment_type <> 'deposit' then
    raise exception 'MULTIVENT collects only the 35%% downpayment. The remaining 70%% is paid directly to the provider.';
  end if;

  if initial_rate_value <> provider_initial_rate_value + platform_fee_rate_value then
    raise exception 'Current downpayment terms must equal the provider allocation plus platform fee.';
  end if;

  client_total_value := service_subtotal_value + platform_fee_value;
  provider_initial_value := round(service_subtotal_value * provider_initial_rate_value, 2);
  -- Add the two independently rounded obligations. This guarantees that every
  -- provider receives its full 30% allocation and MULTIVENT receives its full
  -- 5% fee, even when a fractional-cent boundary would make round(S * 35%)
  -- differ by one cent.
  initial_payment_value := provider_initial_value + platform_fee_value;

  new.amount := initial_payment_value;
  new.service_subtotal := service_subtotal_value;
  new.client_total := client_total_value;
  new.platform_fee_rate := platform_fee_rate_value;
  new.platform_fee_amount := platform_fee_value;
  new.initial_payment_rate := initial_rate_value;
  new.provider_initial_rate := provider_initial_rate_value;
  new.provider_initial_allocation := provider_initial_value;
  new.held_unallocated_amount := 0;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'accountingVersion', 'phase5-v1',
    'paymentType', 'deposit',
    'serviceSubtotal', service_subtotal_value,
    'platformFeeRate', platform_fee_rate_value,
    'platformFeeAmount', platform_fee_value,
    'clientTotal', client_total_value,
    'initialPaymentRate', initial_rate_value,
    'initialPaymentAmount', initial_payment_value,
    'providerInitialRate', provider_initial_rate_value,
    'providerInitialAllocation', provider_initial_value,
    'providerBalance', service_subtotal_value - provider_initial_value,
    'heldUnallocatedAmount', 0,
    'remainingCollectionMethod', 'direct_to_provider'
  );

  return new;
end;
$$;

-- Phase 9 exposes the downpayment in its quote JSON. Patch only the known
-- declaration in that already-deployed function and abort if its definition
-- is unexpectedly different, rather than silently rewriting unrelated SQL.
do $migration$
declare
  quote_definition text;
  old_declaration constant text := 'initial_payment_rate numeric := 0.40;';
  new_declaration constant text := 'initial_payment_rate numeric := 0.35;';
  old_expression constant text := $text$'initialPayment', round(provider_amount * initial_payment_rate, 2),$text$;
  new_expression constant text := $text$'initialPayment', round(provider_amount * provider_initial_rate, 2)
      + round(customer_amount - provider_amount, 2),$text$;
begin
  select pg_get_functiondef(
    'public.calculate_event_service_quote(uuid,uuid,text,numeric,uuid)'::regprocedure
  ) into quote_definition;

  if position(old_declaration in quote_definition) > 0 then
    quote_definition := replace(quote_definition, old_declaration, new_declaration);
  elsif position(new_declaration in quote_definition) = 0 then
    raise exception 'The Phase 9 quote function has an unexpected initial-payment declaration.';
  end if;

  if position(old_expression in quote_definition) > 0 then
    quote_definition := replace(quote_definition, old_expression, new_expression);
  elsif position(new_expression in quote_definition) = 0 then
    raise exception 'The Phase 9 quote function has an unexpected initial-payment expression.';
  end if;

  execute quote_definition;
end;
$migration$;

revoke all on function public.get_public_payment_terms() from public;
revoke all on function public.validate_phase5_financial_settings() from public;
revoke all on function public.enforce_phase5_payment_breakdown() from public;
grant execute on function public.get_public_payment_terms() to anon, authenticated;

comment on function public.get_public_payment_terms() is
  'Returns the active 5% platform, 35% downpayment, and 30% provider-allocation terms.';
comment on column public.payments.held_unallocated_amount is
  'Always zero for the current 35/30/5 model; retained for immutable legacy payment snapshots.';

commit;
