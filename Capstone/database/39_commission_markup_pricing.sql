-- MULTIVENT business adjustment: add commission above provider prices.
-- Apply after 38_audit_security_hardening.sql.

begin;

update public.system_settings
set description = 'Commission added above provider-entered prices to produce client-facing totals.',
    updated_at = now()
where key = 'commission_rate';

-- Provider-entered service and package prices remain untouched. These booking
-- fields snapshot the provider amount and the client-facing markup so later
-- commission changes cannot alter an existing booking.
alter table public.bookings
  add column if not exists provider_amount numeric(12,2),
  add column if not exists commission_rate numeric(7,6),
  add column if not exists commission_amount numeric(12,2),
  add column if not exists commission_model text;

-- Existing bookings retain the original deduction model. This migration does
-- not rewrite their quoted amount or any recognized financial transaction.
with configured_rate as (
  select coalesce((
    select case
      when jsonb_typeof(setting.value -> 'value') = 'number'
        then (setting.value ->> 'value')::numeric
      else null
    end
    from public.system_settings setting
    where setting.key = 'commission_rate'
  ), 0.10) as rate
), booking_rates as (
  select booking.id,
    coalesce((
      select ledger.commission_rate
      from public.financial_transactions ledger
      where ledger.booking_id = booking.id
        and ledger.transaction_type = 'booking_payment'
      order by ledger.transaction_at desc, ledger.id
      limit 1
    ), configured_rate.rate) as rate
  from public.bookings booking
  cross join configured_rate
)
update public.bookings booking
set commission_rate = booking_rates.rate,
    commission_amount = case when booking.amount is null then null
      else round(booking.amount * booking_rates.rate, 2) end,
    provider_amount = case when booking.amount is null then null
      else booking.amount - round(booking.amount * booking_rates.rate, 2) end,
    commission_model = 'deducted_from_provider'
from booking_rates
where booking.id = booking_rates.id
  and booking.commission_model is null;

alter table public.bookings
  alter column commission_model set default 'added_to_customer';

alter table public.bookings
  drop constraint if exists bookings_commission_model_check,
  add constraint bookings_commission_model_check check (
    commission_model is null
    or commission_model in ('deducted_from_provider', 'added_to_customer')
  ),
  drop constraint if exists bookings_commission_values_check,
  add constraint bookings_commission_values_check check (
    (provider_amount is null or provider_amount >= 0)
    and (commission_amount is null or commission_amount >= 0)
    and (commission_rate is null or commission_rate between 0 and 1)
    and (
      amount is null
      or provider_amount is null
      or commission_amount is null
      or amount = provider_amount + commission_amount
    )
  );

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
  ), 0.10);
$$;

revoke all on function public.get_public_commission_rate() from public;
grant execute on function public.get_public_commission_rate() to anon, authenticated;

create or replace function public.enforce_booking_commission_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_rate numeric(7,6);
  applied_rate numeric(7,6);
  base_amount numeric(12,2);
  has_recognized_payment boolean := false;
begin
  select public.get_public_commission_rate() into configured_rate;

  if tg_op = 'INSERT' and auth.role() <> 'service_role' then
    new.commission_model := 'added_to_customer';
  elsif tg_op = 'UPDATE'
    and new.commission_model is distinct from old.commission_model
    and auth.role() <> 'service_role'
  then
    select exists (
      select 1
      from public.payments payment
      where payment.booking_id = old.id
        and payment.status in ('paid', 'verified', 'refunded')
    ) into has_recognized_payment;

    if old.commission_model <> 'deducted_from_provider'
      or new.commission_model <> 'added_to_customer'
      or has_recognized_payment
    then
      raise exception 'The booking commission model cannot be changed.' using errcode = '42501';
    end if;
  end if;

  new.commission_model := coalesce(new.commission_model, 'added_to_customer');
  applied_rate := coalesce(new.commission_rate, configured_rate, 0.10);
  if applied_rate < 0 or applied_rate > 1 then
    raise exception 'Commission rate must be between 0 and 1.';
  end if;

  if new.amount is null and new.provider_amount is null then
    new.commission_rate := applied_rate;
    new.commission_amount := null;
    return new;
  end if;

  if new.commission_model = 'added_to_customer' then
    base_amount := coalesce(new.provider_amount, new.amount, 0);
    new.provider_amount := round(base_amount, 2);
    new.commission_rate := applied_rate;
    new.commission_amount := round(base_amount * applied_rate, 2);
    new.amount := new.provider_amount + new.commission_amount;
  else
    new.amount := round(coalesce(new.amount, 0), 2);
    new.commission_rate := applied_rate;
    new.commission_amount := round(new.amount * applied_rate, 2);
    new.provider_amount := new.amount - new.commission_amount;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_booking_commission_pricing_trigger on public.bookings;
create trigger enforce_booking_commission_pricing_trigger
before insert or update of amount, provider_amount, commission_rate, commission_model
on public.bookings
for each row execute function public.enforce_booking_commission_pricing();
revoke all on function public.enforce_booking_commission_pricing() from public;

-- Unsubmitted service selections can safely move to the new client-facing
-- total. Requested/paid work is left unchanged to preserve its agreed quote.
with configured_rate as (
  select public.get_public_commission_rate() as rate
)
update public.event_service_selections selection
set estimated_amount = selection.estimated_amount
      + round(selection.estimated_amount * configured_rate.rate, 2),
    selected_provider_snapshot = coalesce(selection.selected_provider_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'providerAmount', selection.estimated_amount,
        'commissionAmount', round(selection.estimated_amount * configured_rate.rate, 2),
        'commissionRate', configured_rate.rate,
        'commissionModel', 'added_to_customer'
      ),
    updated_at = now()
from configured_rate
where selection.status = 'selected'
  and selection.estimated_amount > 0
  and coalesce(selection.selected_provider_snapshot ->> 'commissionModel', '') = '';

-- Recognized payments now split the client total into the provider-listed
-- amount plus the commission added above it. Legacy bookings keep their old
-- deduction formula whenever a historical payment is explicitly reprocessed.
create or replace function public.capture_payment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_rate numeric(7,6) := 0.10;
  booking_total numeric(12,2);
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
      case when booking.commission_model = 'added_to_customer'
        then case when coalesce(booking.amount, 0) > 0
          and booking.commission_amount is not null
          then round(new.amount * booking.commission_amount / booking.amount, 2)
          else round(new.amount * coalesce(booking.commission_rate, configured_rate)
            / (1 + coalesce(booking.commission_rate, configured_rate)), 2)
        end
        else round(new.amount * coalesce(booking.commission_rate, configured_rate), 2)
      end,
      new.amount - case when booking.commission_model = 'added_to_customer'
        then case when coalesce(booking.amount, 0) > 0
          and booking.commission_amount is not null
          then round(new.amount * booking.commission_amount / booking.amount, 2)
          else round(new.amount * coalesce(booking.commission_rate, configured_rate)
            / (1 + coalesce(booking.commission_rate, configured_rate)), 2)
        end
        else round(new.amount * coalesce(booking.commission_rate, configured_rate), 2)
      end,
      new.amount, 0, new.status::text,
      coalesce(new.verified_at, new.paid_at, now()),
      jsonb_build_object(
        'commission_model', coalesce(booking.commission_model, 'deducted_from_provider')
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
        case when allocation.applied_model = 'added_to_customer'
          then case when coalesce(allocation.booked_gross, 0) > 0
            and allocation.booked_commission is not null
            then round(
              allocation.allocated_gross * allocation.booked_commission
              / allocation.booked_gross,
              2
            )
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
      allocation.allocated_gross, 0, new.status::text,
      coalesce(new.verified_at, new.paid_at, now()),
      jsonb_build_object('commission_model', allocation.applied_model)
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

comment on column public.bookings.provider_amount is
  'Provider-listed amount captured when the booking is priced.';
comment on column public.bookings.commission_amount is
  'MULTIVENT commission captured separately from the provider-listed amount.';
comment on column public.bookings.commission_model is
  'Whether commission was historically deducted or added above the provider price.';
comment on function public.get_public_commission_rate() is
  'Returns the validated commission rate needed to calculate client-facing service prices.';

commit;
