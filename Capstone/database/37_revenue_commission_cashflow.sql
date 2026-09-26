-- MULTIVENT Phase 8: revenue, commission, and cash-flow reporting.
-- Apply after 36_admin_business_analytics.sql.

begin;

create index if not exists financial_transactions_reporting_idx
  on public.financial_transactions (transaction_type, status, transaction_at desc);
create index if not exists financial_transactions_provider_date_idx
  on public.financial_transactions (provider_id, transaction_at desc);

-- Validate commission configuration at the only supported write boundary.
-- Existing ledger rows retain their captured rate; a rate change affects only
-- payments recognized or reprocessed after that change.
create or replace function public.superadmin_upsert_system_setting(
  setting_key text,
  setting_value jsonb,
  setting_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_key text := trim(setting_key);
  setting_id uuid;
  previous_value jsonb;
  caller_role public.user_role;
  commission_value numeric;
begin
  if not public.has_permission('system.settings') then
    raise exception 'System-settings access is required.' using errcode = '42501';
  end if;
  if nullif(normalized_key, '') is null or char_length(normalized_key) > 120 then
    raise exception 'A valid setting key is required.';
  end if;
  if setting_value is null or jsonb_typeof(setting_value) <> 'object' then
    raise exception 'The setting value must be a JSON object.';
  end if;

  if normalized_key = 'commission_rate' then
    if jsonb_typeof(setting_value -> 'value') <> 'number' then
      raise exception 'Commission rate must be a decimal number between 0 and 1.';
    end if;
    commission_value := (setting_value ->> 'value')::numeric;
    if commission_value < 0 or commission_value > 1 then
      raise exception 'Commission rate must be between 0 and 1.';
    end if;
  end if;

  select setting.value into previous_value
  from public.system_settings setting
  where setting.key = normalized_key;

  select profile.default_role into caller_role
  from public.profiles profile where profile.id = auth.uid();

  insert into public.system_settings (key, value, description, updated_by, updated_at)
  values (normalized_key, setting_value, setting_description, auth.uid(), now())
  on conflict (key) do update
  set value = excluded.value,
      description = coalesce(excluded.description, public.system_settings.description),
      updated_by = auth.uid(),
      updated_at = now()
  returning id into setting_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role,
    case when normalized_key = 'commission_rate'
      then 'commission.configuration.update'
      else 'system_setting.update'
    end,
    'system_setting', setting_id,
    jsonb_build_object('value', previous_value),
    jsonb_build_object('value', setting_value),
    'success', jsonb_build_object('key', normalized_key)
  );

  return setting_id;
end;
$$;

revoke all on function public.superadmin_upsert_system_setting(text, jsonb, text) from public;
grant execute on function public.superadmin_upsert_system_setting(text, jsonb, text) to authenticated;

-- Keep the financial ledger synchronized when a payment's financial fields are
-- corrected, not only when its status changes. No historical row is rewritten
-- merely by installing this migration.
create or replace function public.capture_payment_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commission_rate_value numeric(7,6) := 0.10;
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

  select coalesce(nullif(setting.value ->> 'value', '')::numeric, 0.10)
  into commission_rate_value
  from public.system_settings setting
  where setting.key = 'commission_rate';
  commission_rate_value := coalesce(commission_rate_value, 0.10);
  if commission_rate_value < 0 or commission_rate_value > 1 then
    commission_rate_value := 0.10;
  end if;

  delete from public.financial_transactions where payment_id = new.id;

  if new.booking_id is not null then
    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received,
      amount_released, status, transaction_at
    )
    select new.id, booking.id, booking.event_id, booking.provider_id, new.provider, new.amount,
      commission_rate_value, round(new.amount * commission_rate_value, 2),
      new.amount - round(new.amount * commission_rate_value, 2), new.amount,
      0, new.status::text, coalesce(new.verified_at, new.paid_at, now())
    from public.bookings booking
    where booking.id = new.booking_id;
  elsif new.event_id is not null then
    select sum(coalesce(booking.amount, 0)) into booking_total
    from public.bookings booking
    where booking.event_id = new.event_id
      and booking.status not in ('rejected', 'cancelled', 'expired');

    insert into public.financial_transactions (
      payment_id, booking_id, event_id, provider_id, payment_method, gross_amount,
      commission_rate, commission_amount, provider_net_amount, amount_received,
      amount_released, status, transaction_at
    )
    select new.id, booking.id, booking.event_id, booking.provider_id, new.provider,
      case when coalesce(booking_total, 0) > 0
        then round(new.amount * coalesce(booking.amount, 0) / booking_total, 2)
        else 0 end,
      commission_rate_value,
      round((case when coalesce(booking_total, 0) > 0
        then new.amount * coalesce(booking.amount, 0) / booking_total else 0 end)
        * commission_rate_value, 2),
      round((case when coalesce(booking_total, 0) > 0
        then new.amount * coalesce(booking.amount, 0) / booking_total else 0 end)
        * (1 - commission_rate_value), 2),
      case when coalesce(booking_total, 0) > 0
        then round(new.amount * coalesce(booking.amount, 0) / booking_total, 2)
        else 0 end,
      0, new.status::text, coalesce(new.verified_at, new.paid_at, now())
    from public.bookings booking
    where booking.event_id = new.event_id
      and booking.status not in ('rejected', 'cancelled', 'expired');
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

create or replace function public.get_revenue_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  revenue_payload jsonb;
begin
  if not public.has_permission('revenue.view') then
    raise exception 'Revenue access is required.' using errcode = '42501';
  end if;

  with
  reporting_months as (
    select generated_month::date as month_start
    from generate_series(
      (date_trunc('month', current_date) - interval '11 months')::date,
      date_trunc('month', current_date)::date,
      interval '1 month'
    ) as month_series(generated_month)
  ),
  recognized_ledger as (
    select ledger_item.*
    from public.financial_transactions ledger_item
    where ledger_item.transaction_type = 'booking_payment'
      and ledger_item.status in ('paid', 'verified')
  ),
  monthly_totals as (
    select date_trunc('month', ledger_item.transaction_at)::date as month_start,
      sum(ledger_item.gross_amount) as gross_total,
      sum(ledger_item.commission_amount) as commission_total,
      sum(ledger_item.provider_net_amount) as provider_net_total,
      count(*) as transaction_count
    from recognized_ledger ledger_item
    where ledger_item.transaction_at >= date_trunc('month', current_date) - interval '11 months'
    group by date_trunc('month', ledger_item.transaction_at)::date
  ),
  complete_months as (
    select reporting_months.month_start,
      coalesce(monthly_totals.gross_total, 0) as gross_total,
      coalesce(monthly_totals.commission_total, 0) as commission_total,
      coalesce(monthly_totals.provider_net_total, 0) as provider_net_total,
      coalesce(monthly_totals.transaction_count, 0) as transaction_count
    from reporting_months
    left join monthly_totals using (month_start)
  ),
  comparison_totals as (
    select
      coalesce(sum(ledger_item.commission_amount) filter (
        where ledger_item.transaction_at >= date_trunc('month', current_date)
      ), 0) as current_commission,
      coalesce(sum(ledger_item.commission_amount) filter (
        where ledger_item.transaction_at >= date_trunc('month', current_date) - interval '1 month'
          and ledger_item.transaction_at < date_trunc('month', current_date)
      ), 0) as previous_commission
    from recognized_ledger ledger_item
  ),
  payment_method_rows as (
    select coalesce(nullif(trim(ledger_item.payment_method), ''), 'Unspecified') as payment_method,
      sum(ledger_item.gross_amount) as gross_total,
      sum(ledger_item.commission_amount) as commission_total,
      count(*) as transaction_count
    from recognized_ledger ledger_item
    group by coalesce(nullif(trim(ledger_item.payment_method), ''), 'Unspecified')
    order by gross_total desc, payment_method
  ),
  provider_revenue_rows as (
    select provider.id,
      coalesce(nullif(trim(provider.business_name), ''), 'Service provider') as provider_name,
      sum(ledger_item.gross_amount) as gross_total,
      sum(ledger_item.commission_amount) as commission_total,
      sum(ledger_item.provider_net_amount) as provider_net_total,
      count(*) as transaction_count
    from recognized_ledger ledger_item
    join public.provider_profiles provider on provider.id = ledger_item.provider_id
    group by provider.id, provider.business_name
    order by commission_total desc, gross_total desc, provider.id
    limit 10
  )
  select jsonb_build_object(
    'generated_at', now(),
    'commission_rate', coalesce((
      select nullif(setting.value ->> 'value', '')::numeric
      from public.system_settings setting where setting.key = 'commission_rate'
    ), 0.10),
    'gross_amount', coalesce((select sum(gross_amount) from recognized_ledger), 0),
    'commission_amount', coalesce((select sum(commission_amount) from recognized_ledger), 0),
    'provider_net_amount', coalesce((select sum(provider_net_amount) from recognized_ledger), 0),
    'amount_received', coalesce((select sum(amount_received) from recognized_ledger), 0),
    'amount_released', coalesce((select sum(amount_released) from recognized_ledger), 0),
    'transaction_count', (select count(*) from recognized_ledger),
    'current_month', (
      select jsonb_build_object(
        'commission', comparison_totals.current_commission,
        'previous_commission', comparison_totals.previous_commission,
        'percent_change', case when comparison_totals.previous_commission = 0 then null
          else round(
            (comparison_totals.current_commission - comparison_totals.previous_commission)
            * 100 / comparison_totals.previous_commission,
            1
          )
        end
      )
      from comparison_totals
    ),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', to_char(complete_months.month_start, 'YYYY-MM'),
        'gross', complete_months.gross_total,
        'commission', complete_months.commission_total,
        'provider_net', complete_months.provider_net_total,
        'transactions', complete_months.transaction_count
      ) order by complete_months.month_start)
      from complete_months
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method', payment_method_rows.payment_method,
        'gross', payment_method_rows.gross_total,
        'commission', payment_method_rows.commission_total,
        'transactions', payment_method_rows.transaction_count
      ) order by payment_method_rows.gross_total desc, payment_method_rows.payment_method)
      from payment_method_rows
    ), '[]'::jsonb),
    'top_providers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', provider_revenue_rows.id,
        'name', provider_revenue_rows.provider_name,
        'gross', provider_revenue_rows.gross_total,
        'commission', provider_revenue_rows.commission_total,
        'provider_net', provider_revenue_rows.provider_net_total,
        'transactions', provider_revenue_rows.transaction_count
      ) order by provider_revenue_rows.commission_total desc,
        provider_revenue_rows.gross_total desc,
        provider_revenue_rows.id)
      from provider_revenue_rows
    ), '[]'::jsonb)
  ) into revenue_payload;

  return revenue_payload;
end;
$$;

create or replace function public.get_cash_flow_report(
  range_start timestamptz default null,
  range_end timestamptz default null,
  target_type text default null,
  target_status text default null,
  page_limit integer default 250,
  page_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cashflow_payload jsonb;
  safe_limit integer := least(greatest(coalesce(page_limit, 250), 1), 500);
  safe_offset integer := greatest(coalesce(page_offset, 0), 0);
begin
  if not public.has_permission('cashflow.view') then
    raise exception 'Cash-flow access is required.' using errcode = '42501';
  end if;
  if range_start is not null and range_end is not null and range_end < range_start then
    raise exception 'Cash-flow end date must not be earlier than the start date.';
  end if;
  if target_type is not null and target_type <> 'all' and target_type not in (
    'booking_payment', 'commission_revenue', 'provider_payable',
    'provider_remittance', 'refund', 'adjustment'
  ) then
    raise exception 'Unsupported cash-flow transaction type.';
  end if;

  with filtered_ledger as (
    select ledger_item.*
    from public.financial_transactions ledger_item
    where (range_start is null or ledger_item.transaction_at >= range_start)
      and (range_end is null or ledger_item.transaction_at <= range_end)
      and (target_type is null or target_type = 'all' or ledger_item.transaction_type = target_type)
      and (target_status is null or target_status = 'all' or ledger_item.status = target_status)
  ),
  report_rows as (
    select ledger_item.id,
      ledger_item.payment_id,
      ledger_item.booking_id,
      ledger_item.event_id,
      ledger_item.provider_id,
      ledger_item.transaction_type,
      case
        when ledger_item.transaction_type = 'refund' then 'Refund'
        when ledger_item.transaction_type = 'provider_payable' then 'Provider payable'
        when ledger_item.transaction_type = 'provider_remittance' then 'Office cash remittance'
        when ledger_item.transaction_type = 'commission_revenue' then 'Commission revenue'
        when ledger_item.transaction_type = 'adjustment' then 'Adjustment'
        else 'Cash inflow'
      end as classification,
      case
        when ledger_item.transaction_type = 'refund'
          or ledger_item.amount_released > ledger_item.amount_received then 'outflow'
        when ledger_item.amount_received > 0 then 'inflow'
        else 'non_cash'
      end as cash_direction,
      ledger_item.payment_method,
      ledger_item.gross_amount,
      ledger_item.commission_rate,
      ledger_item.commission_amount,
      ledger_item.provider_net_amount,
      ledger_item.amount_received,
      ledger_item.amount_released,
      ledger_item.status,
      ledger_item.transaction_at,
      coalesce(
        nullif(trim(payment.provider_reference), ''),
        nullif(trim(remittance.reference_number), ''),
        upper(substr(ledger_item.id::text, 1, 8))
      ) as transaction_reference,
      coalesce(nullif(trim(event.name), ''), 'No event') as event_name,
      coalesce(nullif(trim(service.name), ''), 'No service') as service_name,
      coalesce(nullif(trim(provider.business_name), ''), 'No provider') as provider_name
    from filtered_ledger ledger_item
    left join public.payments payment on payment.id = ledger_item.payment_id
    left join public.cash_remittances remittance
      on ledger_item.metadata ->> 'cash_remittance_id' = remittance.id::text
    left join public.events event on event.id = ledger_item.event_id
    left join public.bookings booking on booking.id = ledger_item.booking_id
    left join public.services service on service.id = booking.service_id
    left join public.provider_profiles provider on provider.id = ledger_item.provider_id
    order by ledger_item.transaction_at desc, ledger_item.id
    limit safe_limit offset safe_offset
  )
  select jsonb_build_object(
    'generated_at', now(),
    'total_count', (select count(*) from filtered_ledger),
    'summary', jsonb_build_object(
      'amount_received', coalesce((select sum(amount_received) from filtered_ledger), 0),
      'amount_released', coalesce((select sum(amount_released) from filtered_ledger), 0),
      'net_cash_movement', coalesce((select sum(amount_received - amount_released) from filtered_ledger), 0),
      'gross_amount', coalesce((select sum(gross_amount) from filtered_ledger), 0),
      'commission_revenue', coalesce((select sum(commission_amount) from filtered_ledger
        where transaction_type = 'booking_payment' and status in ('paid', 'verified')), 0),
      'provider_payable', coalesce((select sum(provider_net_amount - amount_released) from filtered_ledger
        where transaction_type = 'booking_payment' and status in ('paid', 'verified')), 0),
      'refunds', coalesce((select sum(amount_released) from filtered_ledger
        where transaction_type = 'refund'), 0)
    ),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(report_rows) order by report_rows.transaction_at desc, report_rows.id)
      from report_rows
    ), '[]'::jsonb)
  ) into cashflow_payload;

  return cashflow_payload;
end;
$$;

revoke all on function public.get_revenue_dashboard() from public;
revoke all on function public.get_cash_flow_report(timestamptz, timestamptz, text, text, integer, integer) from public;
grant execute on function public.get_revenue_dashboard() to authenticated;
grant execute on function public.get_cash_flow_report(timestamptz, timestamptz, text, text, integer, integer) to authenticated;

comment on function public.get_revenue_dashboard() is
  'Read-only commission revenue summary with monthly, payment-method, and provider breakdowns.';
comment on function public.get_cash_flow_report(timestamptz, timestamptz, text, text, integer, integer) is
  'Permission-scoped cash-flow report with server-side date, type, status, and pagination controls.';

commit;
