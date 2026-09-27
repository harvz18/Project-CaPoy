-- MULTIVENT provider finance: live earnings, transactions, payout destination,
-- and balance-validated payout requests.
-- Apply after 41_all_services_remittance.sql.

begin;

create table if not exists public.provider_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references public.provider_profiles(id) on delete cascade,
  account_type text not null default 'bank_transfer',
  institution_name text not null,
  account_name text not null,
  account_number text not null,
  ownership_confirmed boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_payout_account_type_check
    check (account_type in ('bank_transfer', 'e_wallet')),
  constraint provider_payout_account_text_check check (
    char_length(trim(institution_name)) between 2 and 120
    and char_length(trim(account_name)) between 2 and 160
    and char_length(trim(account_number)) between 4 and 64
  )
);

alter table public.provider_payout_accounts enable row level security;
revoke all on table public.provider_payout_accounts from anon, authenticated;

create or replace function public.save_my_provider_payout_account(
  new_account_type text,
  new_institution_name text,
  new_account_name text,
  new_account_number text,
  confirm_ownership boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  account_id_value uuid;
  normalized_type text := lower(trim(new_account_type));
  normalized_institution text := trim(new_institution_name);
  normalized_name text := trim(new_account_name);
  normalized_number text := regexp_replace(trim(new_account_number), '\s+', '', 'g');
  last_four text;
begin
  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where provider.user_id = auth.uid()
    and profile.account_status in ('active', 'verified')
  order by provider.created_at
  limit 1;

  if provider_id_value is null then
    raise exception 'An active service-provider account is required.' using errcode = '42501';
  end if;
  if normalized_type not in ('bank_transfer', 'e_wallet') then
    raise exception 'Unsupported payout account type.';
  end if;
  if char_length(normalized_institution) not between 2 and 120
    or char_length(normalized_name) not between 2 and 160
    or char_length(normalized_number) not between 4 and 64
  then
    raise exception 'Complete the payout account details using valid values.';
  end if;
  if not confirm_ownership then
    raise exception 'Confirm that the payout account belongs to you or your business.';
  end if;

  last_four := right(normalized_number, 4);
  insert into public.provider_payout_accounts (
    provider_id, account_type, institution_name, account_name, account_number,
    ownership_confirmed, confirmed_at, updated_at
  ) values (
    provider_id_value, normalized_type, normalized_institution, normalized_name,
    normalized_number, true, now(), now()
  )
  on conflict (provider_id) do update
  set account_type = excluded.account_type,
      institution_name = excluded.institution_name,
      account_name = excluded.account_name,
      account_number = excluded.account_number,
      ownership_confirmed = true,
      confirmed_at = now(),
      updated_at = now()
  returning id into account_id_value;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    new_state, result, metadata
  ) values (
    auth.uid(), 'service_provider', 'provider.payout_account.save',
    'provider_payout_account', account_id_value,
    jsonb_build_object(
      'provider_id', provider_id_value,
      'account_type', normalized_type,
      'institution_name', normalized_institution,
      'account_number_last4', last_four,
      'ownership_confirmed', true
    ),
    'success', jsonb_build_object('sensitive_account_number_logged', false)
  );

  return jsonb_build_object(
    'accountName', normalized_name,
    'accountNumberLast4', last_four,
    'accountType', normalized_type,
    'bankName', normalized_institution,
    'isVerified', true
  );
end;
$$;

revoke all on function public.save_my_provider_payout_account(text, text, text, text, boolean) from public;
grant execute on function public.save_my_provider_payout_account(text, text, text, text, boolean) to authenticated;

create or replace function public.get_my_provider_earnings(
  target_period text default '30d'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  provider_id_value uuid;
  period_start timestamptz;
  bucket_step interval;
  bucket_count integer;
  payout_account jsonb;
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

  case target_period
    when '7d' then
      period_start := date_trunc('day', now()) - interval '6 days';
      bucket_step := interval '1 day';
      bucket_count := 7;
    when '30d' then
      period_start := date_trunc('day', now()) - interval '29 days';
      bucket_step := interval '6 days';
      bucket_count := 5;
    when '90d' then
      period_start := date_trunc('day', now()) - interval '89 days';
      bucket_step := interval '15 days';
      bucket_count := 6;
    when 'year' then
      period_start := date_trunc('month', now()) - interval '11 months';
      bucket_step := interval '1 month';
      bucket_count := 12;
    else
      raise exception 'Unsupported earnings period.';
  end case;

  select jsonb_build_object(
    'accountName', account.account_name,
    'accountNumberLast4', right(account.account_number, 4),
    'accountType', account.account_type,
    'bankName', account.institution_name,
    'isVerified', account.ownership_confirmed
  ) into payout_account
  from public.provider_payout_accounts account
  where account.provider_id = provider_id_value;

  with recognized_earnings as (
    select ledger.*
    from public.financial_transactions ledger
    where ledger.provider_id = provider_id_value
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
  ), payout_totals as (
    select
      coalesce(sum(request.amount) filter (
        where request.status in ('requested', 'processing', 'paid')
      ), 0) as reserved_or_paid
    from public.provider_payout_requests request
    where request.provider_id = provider_id_value
  ), earning_totals as (
    select
      coalesce(sum(earning.provider_net_amount), 0) as lifetime_earnings,
      coalesce(sum(greatest(earning.provider_net_amount - earning.amount_released, 0)), 0)
        as platform_held_earnings,
      coalesce(sum(earning.provider_net_amount) filter (
        where earning.transaction_at >= period_start
      ), 0) as period_earnings
    from recognized_earnings earning
  ), pending_earnings as (
    select coalesce(sum(greatest(ledger.provider_net_amount - ledger.amount_released, 0)), 0)
      as pending_clearance
    from public.financial_transactions ledger
    where ledger.provider_id = provider_id_value
      and ledger.transaction_type = 'provider_remittance'
      and ledger.status in ('partially_remitted', 'remitted')
  ), buckets as (
    select series.bucket_index,
      period_start + series.bucket_index * bucket_step as bucket_start,
      period_start + (series.bucket_index + 1) * bucket_step as bucket_end
    from generate_series(0, bucket_count - 1) as series(bucket_index)
  ), trend_rows as (
    select bucket.bucket_index,
      bucket.bucket_start,
      coalesce(sum(earning.provider_net_amount), 0) as amount
    from buckets bucket
    left join recognized_earnings earning
      on earning.transaction_at >= bucket.bucket_start
     and earning.transaction_at < bucket.bucket_end
     and earning.transaction_at <= now()
    group by bucket.bucket_index, bucket.bucket_start
  ), ledger_transactions as (
    select
      ledger.id::text as id,
      case when ledger.transaction_type = 'refund' then 'refund' else 'booking' end as type,
      case when ledger.transaction_type = 'refund'
        then -coalesce(ledger.amount_released, ledger.gross_amount, 0)
        else ledger.provider_net_amount
      end as amount,
      case
        when ledger.status in ('paid', 'verified') then 'completed'
        when ledger.status in ('failed', 'cancelled', 'refunded') then 'failed'
        else 'pending'
      end as display_status,
      ledger.transaction_at as created_at,
      ledger.transaction_at as processed_at,
      coalesce(nullif(trim(service.name), ''), nullif(trim(event.name), ''), 'Booking earning') as label,
      coalesce(
        nullif(trim(payment.provider_reference), ''),
        'TX-' || upper(substr(ledger.id::text, 1, 8))
      ) as reference,
      jsonb_build_array(
        jsonb_build_object('label', 'Client payment', 'amount', ledger.gross_amount),
        jsonb_build_object('label', 'MULTIVENT commission', 'amount', -ledger.commission_amount),
        jsonb_build_object('label', 'Provider earning', 'amount', ledger.provider_net_amount)
      ) as breakdown,
      jsonb_build_array(
        jsonb_build_object('label', 'Event', 'value', coalesce(nullif(trim(event.name), ''), 'Event')),
        jsonb_build_object('label', 'Service', 'value', coalesce(nullif(trim(service.name), ''), 'Service')),
        jsonb_build_object('label', 'Client', 'value', coalesce(nullif(trim(client.full_name), ''), 'Client')),
        jsonb_build_object('label', 'Event date', 'value', coalesce(
          to_char(event.event_date, 'FMMonth DD, YYYY'), 'Not scheduled'
        )),
        jsonb_build_object('label', 'Payment method', 'value', coalesce(nullif(trim(ledger.payment_method), ''), 'Not specified')),
        jsonb_build_object('label', 'Booking', 'value', upper(substr(booking.id::text, 1, 8)))
      ) as details,
      booking.id as related_record_id
    from public.financial_transactions ledger
    left join public.payments payment on payment.id = ledger.payment_id
    left join public.bookings booking on booking.id = ledger.booking_id
    left join public.services service on service.id = booking.service_id
    left join public.events event on event.id = ledger.event_id
    left join public.profiles client on client.id = booking.client_id
    where ledger.provider_id = provider_id_value
      and (
        (ledger.transaction_type = 'booking_payment' and ledger.status in ('paid', 'verified'))
        or (ledger.transaction_type = 'refund' and ledger.status = 'refunded')
      )
  ), payout_transactions as (
    select
      request.id::text as id,
      'payout'::text as type,
      -request.amount as amount,
      case
        when request.status = 'paid' then 'completed'
        when request.status in ('rejected', 'cancelled') then 'failed'
        else 'pending'
      end as display_status,
      request.requested_at as created_at,
      request.processed_at,
      coalesce('Payout to ' || account.institution_name, 'Payout request') as label,
      'PO-' || upper(substr(request.id::text, 1, 8)) as reference,
      jsonb_build_array(
        jsonb_build_object('label', 'Requested payout', 'amount', -request.amount)
      ) as breakdown,
      jsonb_build_array(
        jsonb_build_object('label', 'Destination', 'value', coalesce(account.institution_name, 'Payout account')),
        jsonb_build_object('label', 'Account', 'value', case when account.account_number is null
          then 'Not available' else 'Ending in ' || right(account.account_number, 4) end),
        jsonb_build_object('label', 'Request status', 'value', replace(request.status, '_', ' '))
      ) as details,
      request.id as related_record_id
    from public.provider_payout_requests request
    left join public.provider_payout_accounts account on account.provider_id = request.provider_id
    where request.provider_id = provider_id_value
  ), recent_transactions as (
    select * from ledger_transactions
    union all
    select * from payout_transactions
    order by created_at desc, id
    limit 100
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'availableBalance', greatest(earning_totals.platform_held_earnings - payout_totals.reserved_or_paid, 0),
      'currency', 'PHP',
      'lifetimeEarnings', earning_totals.lifetime_earnings,
      'pendingBalance', pending_earnings.pending_clearance,
      'periodEarnings', earning_totals.period_earnings
    ),
    'payoutAccount', payout_account,
    'earningsTrend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', case when target_period = 'year'
          then to_char(trend.bucket_start, 'Mon')
          else to_char(trend.bucket_start, 'Mon DD')
        end,
        'amount', trend.amount
      ) order by trend.bucket_index)
      from trend_rows trend
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', transaction.id,
        'type', transaction.type,
        'amount', transaction.amount,
        'createdAt', transaction.created_at,
        'processedAt', transaction.processed_at,
        'label', transaction.label,
        'reference', transaction.reference,
        'status', transaction.display_status,
        'currency', 'PHP',
        'breakdown', transaction.breakdown,
        'details', transaction.details,
        'relatedRecordId', transaction.related_record_id
      ) order by transaction.created_at desc, transaction.id)
      from recent_transactions transaction
    ), '[]'::jsonb)
  ) into result_payload
  from earning_totals, payout_totals, pending_earnings;

  return result_payload;
end;
$$;

revoke all on function public.get_my_provider_earnings(text) from public;
grant execute on function public.get_my_provider_earnings(text) to authenticated;

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

revoke all on function public.request_my_provider_payout(numeric) from public;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;

drop policy if exists "Providers create owned payout requests" on public.provider_payout_requests;
revoke insert, update, delete on table public.provider_payout_requests from authenticated;
grant select on table public.provider_payout_requests to authenticated;

comment on table public.provider_payout_accounts is
  'Provider-confirmed payout destinations. Account numbers are returned to clients only as masked last-four values.';
comment on function public.get_my_provider_earnings(text) is
  'Provider-scoped live earnings, chart, payout destination, and transaction history.';
comment on function public.request_my_provider_payout(numeric) is
  'Creates a balance-validated payout request against earnings held by MULTIVENT.';

commit;
