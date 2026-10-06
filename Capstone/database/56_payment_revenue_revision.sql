-- MULTIVENT Revision 2, Phase 5: payment and revenue model revision.
-- Apply after 55_catering_pricing_revision.sql.
--
-- New financial terms:
--   service subtotal S
--   platform fee      S * 5%
--   client total      S + platform fee
--   initial payment   S * 40%
--   provider share    S * 30% (held until provider acceptance)
--   unallocated hold  initial payment - provider share - platform fee
--
-- Historical bookings, payments, and ledger rows are deliberately not
-- backfilled. Only unsubmitted service selections and new Phase 5 records use
-- these terms.

begin;

insert into public.system_settings (key, value, description, updated_at)
values
  ('commission_rate', '{"value": 0.05}'::jsonb,
    'Platform fee added above provider-entered prices for new quotes.', now()),
  ('initial_payment_rate', '{"value": 0.40}'::jsonb,
    'Initial client payment as a share of the provider service subtotal.', now()),
  ('provider_initial_rate', '{"value": 0.30}'::jsonb,
    'Initial provider allocation as a share of the provider service subtotal.', now())
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

create or replace function public.get_public_commission_rate()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when jsonb_typeof(setting.value -> 'value') = 'number'
        and (setting.value ->> 'value')::numeric between 0 and 1
      then (setting.value ->> 'value')::numeric
      else null
    end
    from public.system_settings setting
    where setting.key = 'commission_rate'
  ), 0.05);
$$;

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
      ), 0.40) as initial_payment_rate,
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

revoke all on function public.get_public_commission_rate() from public;
revoke all on function public.get_public_payment_terms() from public;
grant execute on function public.get_public_commission_rate() to anon, authenticated;
grant execute on function public.get_public_payment_terms() to anon, authenticated;

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
    ), 0.40) end;
  provider_rate := case when new.key = 'provider_initial_rate'
    then (new.value ->> 'value')::numeric
    else coalesce((
      select (setting.value ->> 'value')::numeric
      from public.system_settings setting
      where setting.key = 'provider_initial_rate'
        and jsonb_typeof(setting.value -> 'value') = 'number'
    ), 0.30) end;

  if initial_rate < provider_rate + platform_rate then
    raise exception 'Initial payment rate must cover the provider allocation and platform fee.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_phase5_financial_settings_trigger on public.system_settings;
create trigger validate_phase5_financial_settings_trigger
before insert or update of key, value on public.system_settings
for each row execute function public.validate_phase5_financial_settings();
revoke all on function public.validate_phase5_financial_settings() from public;

-- Existing bookings retain NULL here. Defaults apply only to bookings created
-- after this migration, while the app explicitly marks reused unpaid drafts.
alter table public.bookings
  add column if not exists financial_terms_version text,
  add column if not exists initial_payment_rate numeric(7,6),
  add column if not exists provider_initial_rate numeric(7,6);

alter table public.bookings
  alter column financial_terms_version set default 'phase5-v1',
  alter column initial_payment_rate set default 0.40,
  alter column provider_initial_rate set default 0.30,
  drop constraint if exists bookings_payment_rate_snapshots_check,
  add constraint bookings_payment_rate_snapshots_check check (
    (initial_payment_rate is null or initial_payment_rate between 0 and 1)
    and (provider_initial_rate is null or provider_initial_rate between 0 and 1)
    and (
      initial_payment_rate is null
      or provider_initial_rate is null
      or provider_initial_rate <= initial_payment_rate
    )
  );

alter table public.payments
  add column if not exists coordinator_id uuid references public.profiles(id) on delete set null,
  add column if not exists payment_scope text,
  add column if not exists service_subtotal numeric(12,2),
  add column if not exists client_total numeric(12,2),
  add column if not exists platform_fee_rate numeric(7,6),
  add column if not exists platform_fee_amount numeric(12,2),
  add column if not exists initial_payment_rate numeric(7,6),
  add column if not exists provider_initial_rate numeric(7,6),
  add column if not exists provider_initial_allocation numeric(12,2),
  add column if not exists held_unallocated_amount numeric(12,2);

alter table public.payments
  drop constraint if exists payments_payment_scope_check,
  add constraint payments_payment_scope_check check (
    payment_scope is null or payment_scope in ('provider_service', 'coordinator_service')
  ),
  drop constraint if exists payments_phase5_amounts_check,
  add constraint payments_phase5_amounts_check check (
    (service_subtotal is null or service_subtotal >= 0)
    and (client_total is null or client_total >= 0)
    and (platform_fee_rate is null or platform_fee_rate between 0 and 1)
    and (platform_fee_amount is null or platform_fee_amount >= 0)
    and (initial_payment_rate is null or initial_payment_rate between 0 and 1)
    and (provider_initial_rate is null or provider_initial_rate between 0 and 1)
    and (provider_initial_allocation is null or provider_initial_allocation >= 0)
    and (held_unallocated_amount is null or held_unallocated_amount >= 0)
    and (
      client_total is null or service_subtotal is null or platform_fee_amount is null
      or client_total = service_subtotal + platform_fee_amount
    )
    and (
      provider_initial_allocation is null or service_subtotal is null
      or provider_initial_allocation <= service_subtotal
    )
  );

alter table public.financial_transactions
  add column if not exists coordinator_id uuid references public.profiles(id) on delete set null,
  add column if not exists held_provider_amount numeric(12,2) not null default 0,
  add column if not exists held_unallocated_amount numeric(12,2) not null default 0;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_held_amounts_check,
  add constraint financial_transactions_held_amounts_check check (
    held_provider_amount >= 0 and held_unallocated_amount >= 0
  );

create index if not exists payments_coordinator_idx
  on public.payments (coordinator_id, created_at desc)
  where coordinator_id is not null;
create index if not exists financial_transactions_coordinator_idx
  on public.financial_transactions (coordinator_id, transaction_at desc)
  where coordinator_id is not null;

drop policy if exists "Coordinators view own service payments" on public.payments;
create policy "Coordinators view own service payments"
  on public.payments for select to authenticated
  using (coordinator_id = auth.uid());

-- The older booking trigger preserves historical snapshots and remains in
-- place. This later-named trigger hardens only versioned Phase 5 bookings so a
-- client cannot submit its own rates or platform-fee amount.
create or replace function public.enforce_phase5_booking_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terms jsonb;
  provider_amount_value numeric(12,2);
  platform_fee_rate_value numeric(7,6);
begin
  if tg_op = 'INSERT' and auth.role() <> 'service_role' then
    new.financial_terms_version := 'phase5-v1';
  elsif tg_op = 'UPDATE'
    and old.financial_terms_version = 'phase5-v1'
    and new.financial_terms_version is distinct from old.financial_terms_version
    and auth.role() <> 'service_role'
  then
    raise exception 'The booking financial terms version cannot be changed.' using errcode = '42501';
  end if;

  if new.financial_terms_version is distinct from 'phase5-v1' then
    return new;
  end if;
  if coalesce(new.commission_model, 'added_to_customer') <> 'added_to_customer' then
    raise exception 'Phase 5 bookings require added-to-customer pricing.';
  end if;

  terms := public.get_public_payment_terms();
  platform_fee_rate_value := (terms ->> 'platformFeeRate')::numeric;
  provider_amount_value := round(coalesce(new.provider_amount, new.amount, 0), 2);

  new.commission_model := 'added_to_customer';
  new.provider_amount := provider_amount_value;
  new.commission_rate := platform_fee_rate_value;
  new.commission_amount := round(provider_amount_value * platform_fee_rate_value, 2);
  new.amount := provider_amount_value + new.commission_amount;
  new.initial_payment_rate := (terms ->> 'initialPaymentRate')::numeric;
  new.provider_initial_rate := (terms ->> 'providerInitialRate')::numeric;

  return new;
end;
$$;

drop trigger if exists phase5_enforce_booking_terms_trigger on public.bookings;
create trigger phase5_enforce_booking_terms_trigger
before insert or update of amount, provider_amount, commission_rate,
  commission_model, financial_terms_version, initial_payment_rate, provider_initial_rate
on public.bookings
for each row execute function public.enforce_phase5_booking_terms();

-- Reprice only editable selections. Requested, paid, completed, cancelled, and
-- declined work keeps its original quote and commission snapshot.
with repriced as (
  select selection.id,
    round(case
      when jsonb_typeof(selection.selected_provider_snapshot -> 'providerAmount') = 'number'
        then (selection.selected_provider_snapshot ->> 'providerAmount')::numeric
      else selection.estimated_amount
    end, 2) as provider_amount,
    public.get_public_commission_rate() as commission_rate
  from public.event_service_selections selection
  where selection.status = 'selected'
    and selection.estimated_amount >= 0
)
update public.event_service_selections selection
set estimated_amount = repriced.provider_amount
      + round(repriced.provider_amount * repriced.commission_rate, 2),
    budget_per_head = case
      when selection.attendee_count is not null and selection.attendee_count > 0
      then round((repriced.provider_amount
        + round(repriced.provider_amount * repriced.commission_rate, 2))
        / selection.attendee_count, 2)
      else selection.budget_per_head
    end,
    selected_provider_snapshot = coalesce(selection.selected_provider_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'providerAmount', repriced.provider_amount,
        'commissionAmount', round(repriced.provider_amount * repriced.commission_rate, 2),
        'commissionRate', repriced.commission_rate,
        'commissionModel', 'added_to_customer',
        'financialTermsVersion', 'phase5-v1'
      ),
    catering_option_snapshot = case
      when selection.catering_option_id is not null
      then coalesce(selection.catering_option_snapshot, '{}'::jsonb)
        || jsonb_build_object(
          'calculatedAmount', repriced.provider_amount
            + round(repriced.provider_amount * repriced.commission_rate, 2)
        )
      else selection.catering_option_snapshot
    end,
    updated_at = now()
from repriced
where selection.id = repriced.id;

-- Keep editable coordinator-package totals aligned with their repriced
-- selections without touching packages that already have provider requests.
with editable_packages as (
  select package_selection.id,
    round(sum(selection.estimated_amount), 2) as service_subtotal,
    jsonb_agg(jsonb_build_object(
      'selection_id', selection.id,
      'service_id', selection.service_id,
      'service_name', selection.service_name,
      'estimated_amount', selection.estimated_amount,
      'created_by_package', package_service.created_by_package,
      'catering_option_id', selection.catering_option_id,
      'catering_option_name', selection.catering_option_name
    ) order by selection.created_at) as services
  from public.event_coordinator_package_selections package_selection
  join public.event_coordinator_package_services package_service
    on package_service.package_selection_id = package_selection.id
  join public.event_service_selections selection
    on selection.id = package_service.event_selection_id
  group by package_selection.id
  having bool_and(selection.status = 'selected')
)
update public.event_coordinator_package_selections package_selection
set service_subtotal = editable.service_subtotal,
    package_snapshot = package_selection.package_snapshot || jsonb_build_object(
      'service_subtotal', editable.service_subtotal,
      'services', editable.services,
      'financial_terms_version', 'phase5-v1'
    ),
    updated_at = now()
from editable_packages editable
where package_selection.id = editable.id;

-- Authoritative server-side snapshot. Client-supplied Phase 5 figures are
-- replaced with values calculated from the booking snapshot before insert.
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
  held_unallocated_value numeric(12,2);
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
    or new.metadata ->> 'paymentScope' = 'coordinator_service'
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

  payment_type := coalesce(new.metadata ->> 'paymentType', 'full');
  if payment_type not in ('deposit', 'full') then
    raise exception 'Payment type must be deposit or full.';
  end if;

  client_total_value := service_subtotal_value + platform_fee_value;
  initial_payment_value := round(service_subtotal_value * initial_rate_value, 2);
  provider_initial_value := round(service_subtotal_value * provider_initial_rate_value, 2);
  held_unallocated_value := greatest(
    initial_payment_value - provider_initial_value - platform_fee_value,
    0
  );

  if payment_type = 'deposit' and initial_payment_value
    < provider_initial_value + platform_fee_value
  then
    raise exception 'Initial payment does not cover the provider allocation and platform fee.';
  end if;

  new.amount := case when payment_type = 'deposit'
    then initial_payment_value else client_total_value end;
  new.service_subtotal := service_subtotal_value;
  new.client_total := client_total_value;
  new.platform_fee_rate := platform_fee_rate_value;
  new.platform_fee_amount := platform_fee_value;
  new.initial_payment_rate := initial_rate_value;
  new.provider_initial_rate := provider_initial_rate_value;
  new.provider_initial_allocation := provider_initial_value;
  new.held_unallocated_amount := case when payment_type = 'deposit'
    then held_unallocated_value else 0 end;
  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'accountingVersion', 'phase5-v1',
    'serviceSubtotal', service_subtotal_value,
    'platformFeeRate', platform_fee_rate_value,
    'platformFeeAmount', platform_fee_value,
    'clientTotal', client_total_value,
    'initialPaymentRate', initial_rate_value,
    'initialPaymentAmount', initial_payment_value,
    'providerInitialRate', provider_initial_rate_value,
    'providerInitialAllocation', provider_initial_value,
    'providerBalance', case when payment_type = 'deposit'
      then service_subtotal_value - provider_initial_value else 0 end,
    'heldUnallocatedAmount', case when payment_type = 'deposit'
      then held_unallocated_value else 0 end
  );

  return new;
end;
$$;

drop trigger if exists enforce_phase5_payment_breakdown_trigger on public.payments;
create trigger enforce_phase5_payment_breakdown_trigger
before insert or update of booking_id, coordinator_id, payment_scope, amount, metadata
on public.payments
for each row execute function public.enforce_phase5_payment_breakdown();

-- The existing ledger trigger runs first and preserves legacy accounting. This
-- second trigger reconciles only Phase 5 rows and never reprocesses history.
-- Provider money is held (amount_released = 0) until Phase 6 implements the
-- provider-acceptance release transition.
create or replace function public.reconcile_phase5_payment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_type text;
  provider_value numeric(12,2);
  held_unallocated_value numeric(12,2);
begin
  if new.metadata ->> 'accountingVersion' is distinct from 'phase5-v1' then
    return new;
  end if;

  payment_type := coalesce(new.metadata ->> 'paymentType', 'full');

  if new.payment_scope = 'coordinator_service' then
    -- The legacy event-level ledger path allocates across provider bookings.
    -- Remove only this new payment's generated rows and replace them with one
    -- coordinator-scoped transaction.
    delete from public.financial_transactions where payment_id = new.id;

    if new.status in ('paid', 'verified') then
      provider_value := case when payment_type = 'deposit'
        then coalesce(new.provider_initial_allocation, 0)
        else coalesce(new.service_subtotal, 0)
      end;
      held_unallocated_value := case when payment_type = 'deposit'
        then coalesce(new.held_unallocated_amount, 0)
        else 0
      end;

      insert into public.financial_transactions (
        payment_id, booking_id, event_id, provider_id, coordinator_id,
        payment_method, gross_amount, commission_rate, commission_amount,
        provider_net_amount, amount_received, amount_released,
        held_provider_amount, held_unallocated_amount, status,
        transaction_at, metadata
      ) values (
        new.id, null, new.event_id, null, new.coordinator_id,
        new.provider, new.amount, coalesce(new.platform_fee_rate, 0.05),
        coalesce(new.platform_fee_amount, 0), 0, new.amount, 0,
        provider_value, held_unallocated_value, new.status::text,
        coalesce(new.verified_at, new.paid_at, now()),
        jsonb_build_object(
          'accounting_version', 'phase5-v1',
          'payment_scope', 'coordinator_service',
          'payment_type', payment_type,
          'service_subtotal', new.service_subtotal,
          'client_total', new.client_total,
          'platform_fee_amount', new.platform_fee_amount,
          'provider_initial_allocation', new.provider_initial_allocation,
          'provider_balance', case when payment_type = 'deposit'
            then greatest(coalesce(new.service_subtotal, 0)
              - coalesce(new.provider_initial_allocation, 0), 0)
            else 0 end,
          'held_provider_amount', provider_value,
          'held_unallocated_amount', held_unallocated_value,
          'provider_release', false,
          'release_condition', 'coordinator_acceptance'
        )
      );
    elsif new.status = 'refunded' then
      insert into public.financial_transactions (
        payment_id, event_id, coordinator_id, transaction_type,
        payment_method, gross_amount, commission_rate, commission_amount,
        provider_net_amount, amount_received, amount_released,
        held_provider_amount, held_unallocated_amount, status,
        transaction_at, metadata
      ) values (
        new.id, new.event_id, new.coordinator_id, 'refund',
        new.provider, new.amount, coalesce(new.platform_fee_rate, 0.05), 0,
        0, 0, new.amount, 0, 0, 'refunded',
        coalesce(new.verified_at, new.paid_at, now()),
        jsonb_build_object(
          'accounting_version', 'phase5-v1',
          'payment_scope', 'coordinator_service',
          'provider_release', false
        )
      );
    end if;

    return new;
  end if;

  if new.status in ('paid', 'verified') then
    provider_value := case when payment_type = 'deposit'
      then coalesce(new.provider_initial_allocation, 0)
      else coalesce(new.service_subtotal, 0)
    end;
    held_unallocated_value := case when payment_type = 'deposit'
      then coalesce(new.held_unallocated_amount, 0)
      else 0
    end;

    update public.financial_transactions transaction
    set gross_amount = new.amount,
        commission_rate = coalesce(new.platform_fee_rate, 0.05),
        commission_amount = coalesce(new.platform_fee_amount, 0),
        provider_net_amount = 0,
        amount_received = new.amount,
        amount_released = 0,
        held_provider_amount = provider_value,
        held_unallocated_amount = held_unallocated_value,
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'accounting_version', 'phase5-v1',
          'payment_scope', 'provider_service',
          'payment_type', payment_type,
          'service_subtotal', new.service_subtotal,
          'client_total', new.client_total,
          'platform_fee_amount', new.platform_fee_amount,
          'provider_initial_allocation', new.provider_initial_allocation,
          'provider_balance', case when payment_type = 'deposit'
            then greatest(coalesce(new.service_subtotal, 0)
              - coalesce(new.provider_initial_allocation, 0), 0)
            else 0 end,
          'held_provider_amount', provider_value,
          'held_unallocated_amount', held_unallocated_value,
          'provider_release', false,
          'release_condition', 'provider_acceptance'
        ),
        updated_at = now()
    where transaction.payment_id = new.id;
  else
    update public.financial_transactions transaction
    set held_provider_amount = 0,
        held_unallocated_amount = 0,
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'accounting_version', 'phase5-v1',
          'provider_release', false
        ),
        updated_at = now()
    where transaction.payment_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists phase5_reconcile_payment_financials_trigger on public.payments;
create trigger phase5_reconcile_payment_financials_trigger
after insert or update of status, amount, provider, booking_id, coordinator_id,
  payment_scope, event_id, paid_at, verified_at
on public.payments
for each row execute function public.reconcile_phase5_payment_financials();

revoke all on function public.enforce_phase5_payment_breakdown() from public;
revoke all on function public.reconcile_phase5_payment_financials() from public;
revoke all on function public.enforce_phase5_booking_terms() from public;

comment on column public.bookings.financial_terms_version is
  'Versioned payment terms snapshot; NULL identifies pre-Phase-5 bookings.';
comment on column public.payments.held_unallocated_amount is
  'Initial-payment remainder that is neither platform revenue nor provider allocation.';
comment on column public.payments.coordinator_id is
  'Coordinator recipient for a coordinator-service payment; separate from provider-owned services.';
comment on column public.financial_transactions.held_provider_amount is
  'Provider funds received but not yet released; Phase 6 releases these after acceptance.';
comment on column public.financial_transactions.held_unallocated_amount is
  'Received funds held separately from platform revenue and provider allocations.';
comment on function public.get_public_payment_terms() is
  'Returns the active versioned 5% platform, 40% initial-payment, and 30% provider-allocation terms.';

commit;
