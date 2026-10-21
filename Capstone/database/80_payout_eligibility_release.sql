-- MULTIVENT Revision V11, Phase 2: 14-day payout eligibility.
-- Apply after 79_held_receivables_foundation.sql.
--
-- This phase releases no money externally. It only moves a valid held Phase 5
-- allocation into the existing Available for Payout state after authoritative,
-- server-side checks. The client downpayment, 30% recipient allocation, and 5%
-- platform-fee policy remain unchanged.

begin;

-- A date-only event is evaluated at the start of its own local calendar day.
-- An unknown timezone is deliberately not guessed: the allocation remains held
-- until a valid event timezone is supplied, which is safer than an early payout.
create or replace function public.phase11_event_local_date(event_timezone text)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_timezone text := coalesce(nullif(trim(event_timezone), ''), 'Asia/Manila');
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names timezone_name
    where timezone_name.name = normalized_timezone
  ) then
    return null;
  end if;

  return (now() at time zone normalized_timezone)::date;
end;
$$;

-- Preserve the Phase 1 ledger guard, while allowing only this secured
-- server-side eligibility workflow to move money between held and available
-- internal balances. `amount_released` continues to mean an actual payout.
create or replace function public.enforce_phase11_receivable_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  release_authorized boolean := coalesce(
    current_setting('app.phase11_receivable_release_authorized', true), ''
  ) = 'true';
begin
  if old.provider_funds_status in (
    'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
    'available_for_payout', 'payout_pending', 'paid_out', 'disputed_on_hold'
  ) then
    if new.status = 'refunded' or new.transaction_type = 'refund' then
      return new;
    end if;

    if (
      new.provider_net_amount is distinct from old.provider_net_amount
      or new.held_provider_amount is distinct from old.held_provider_amount
      or new.amount_released is distinct from old.amount_released
    ) and not release_authorized then
      raise exception 'Receivable amounts can be changed only by the secured payout eligibility process.'
        using errcode = '42501';
    end if;

    if new.provider_funds_status is distinct from old.provider_funds_status
      and not release_authorized
      and new.provider_funds_status not in ('rejected_held', 'refunded', 'disputed_on_hold')
    then
      raise exception 'Receivables can move to a payout state only through the secured eligibility process.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- One authoritative predicate is shared by the scheduler and any protected
-- wallet request. It validates payment, acceptance, recipient ownership,
-- event-local eligibility, cancellation/refund/dispute indicators, and prior
-- settlement before a held allocation can become withdrawable.
create or replace function public.phase11_receivable_is_release_eligible(
  target_ledger_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ledger_row public.financial_transactions%rowtype;
  event_row public.events%rowtype;
  local_today date;
  payment_is_collected boolean := false;
  recipient_is_current boolean := false;
  has_financial_hold boolean := false;
begin
  select * into ledger_row
  from public.financial_transactions ledger
  where ledger.id = target_ledger_id;

  if ledger_row.id is null
    or ledger_row.transaction_type <> 'booking_payment'
    or ledger_row.status not in ('paid', 'verified')
    or ledger_row.provider_funds_status not in ('held_receivable', 'eligible_for_release')
    or coalesce(ledger_row.held_provider_amount, 0) <= 0
    or coalesce(ledger_row.provider_net_amount, 0) <> 0
    or coalesce(ledger_row.amount_released, 0) <> 0
    or coalesce(ledger_row.receivable_reconciliation_required, false)
    or ledger_row.event_id is null
  then
    return false;
  end if;

  select * into event_row
  from public.events event
  where event.id = ledger_row.event_id;

  if event_row.id is null
    or event_row.event_date is null
    or event_row.status::text in ('cancelled', 'completed')
  then
    return false;
  end if;

  local_today := public.phase11_event_local_date(event_row.timezone);
  if local_today is null or local_today < event_row.event_date - 14 then
    return false;
  end if;

  select exists (
    select 1
    from public.payments payment
    where payment.id = ledger_row.payment_id
      and payment.status in ('paid', 'verified')
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into payment_is_collected;
  if not payment_is_collected then
    return false;
  end if;

  if ledger_row.provider_id is not null and ledger_row.booking_id is not null then
    select exists (
      select 1
      from public.bookings booking
      where booking.id = ledger_row.booking_id
        and booking.event_id = ledger_row.event_id
        and booking.provider_id = ledger_row.provider_id
        and booking.status::text in ('confirmed', 'completed')
    ) into recipient_is_current;
  elsif ledger_row.coordinator_id is not null then
    recipient_is_current := event_row.coordinator_id = ledger_row.coordinator_id
      and event_row.coordinator_assignment_status = 'accepted';
  end if;
  if not recipient_is_current then
    return false;
  end if;

  has_financial_hold := lower(coalesce(ledger_row.metadata ->> 'refund_pending', 'false'))
      in ('true', 'pending', 'open')
    or lower(coalesce(ledger_row.metadata ->> 'refund_status', ''))
      in ('pending', 'requested', 'open')
    or lower(coalesce(ledger_row.metadata ->> 'chargeback_status', ''))
      in ('pending', 'open', 'disputed', 'held')
    or lower(coalesce(ledger_row.metadata ->> 'financial_hold', 'false'))
      in ('true', 'pending', 'open', 'held')
    or exists (
      select 1
      from public.financial_transactions related_ledger
      where related_ledger.id <> ledger_row.id
        and related_ledger.transaction_type = 'booking_payment'
        and (
          (ledger_row.booking_id is not null and related_ledger.booking_id = ledger_row.booking_id)
          or (
            ledger_row.booking_id is null
            and related_ledger.event_id = ledger_row.event_id
            and related_ledger.coordinator_id = ledger_row.coordinator_id
          )
        )
        and related_ledger.provider_funds_status in ('rejected_held', 'disputed_on_hold')
    );

  return not has_financial_hold;
end;
$$;

-- Idempotent internal release processor. It is intentionally not exposed to
-- clients: a held row can only be released once, and reruns simply find no
-- remaining eligible held allocation. No bank/e-wallet transfer is created.
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
      returning ledger.provider_net_amount into released_now;

      if found then
        released_count := released_count + 1;
        released_amount := released_amount + coalesce(released_now, 0);
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

-- Keep unreleased allocations tied to the authoritative event date. A move
-- beyond the 14-day window re-holds a previously available allocation unless
-- a payout request already makes the exact historic allocation ambiguous; that
-- case is frozen for the existing financial resolution workflow instead.
create or replace function public.recalculate_phase11_event_receivables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_today date;
  newly_eligible_on date;
begin
  if new.event_date is not distinct from old.event_date
    and new.timezone is not distinct from old.timezone
    and new.status is not distinct from old.status
  then
    return new;
  end if;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);
  local_today := public.phase11_event_local_date(new.timezone);
  newly_eligible_on := case when new.event_date is null then null else new.event_date - 14 end;

  update public.financial_transactions ledger
  set payout_eligible_on = newly_eligible_on,
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'payout_eligible_on', case when newly_eligible_on is null then null else newly_eligible_on::text end,
        'payout_eligibility_recalculated_at', now()
      ),
      updated_at = now()
  where ledger.event_id = new.id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status in (
      'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
      'available_for_payout', 'payout_pending'
    )
    and ledger.amount_released = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  if new.status::text = 'cancelled'
    or newly_eligible_on is null
    or local_today is null
    or local_today < newly_eligible_on
  then
    update public.financial_transactions ledger
    set provider_net_amount = case
          when ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          ) then ledger.provider_net_amount
          else 0
        end,
        held_provider_amount = case
          when ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          ) then ledger.held_provider_amount
          else ledger.held_provider_amount + ledger.provider_net_amount
        end,
        provider_funds_status = case
          when ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          ) then 'disputed_on_hold'
          when new.status::text = 'cancelled' then 'rejected_held'
          else 'held_receivable'
        end,
        receivable_reconciliation_required = coalesce(ledger.receivable_reconciliation_required, false)
          or (
            ledger.provider_id is not null and exists (
              select 1 from public.provider_payout_requests request
              where request.provider_id = ledger.provider_id
                and request.status in ('requested', 'processing', 'paid')
            )
          ),
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'receivable_state', case
            when ledger.provider_id is not null and exists (
              select 1 from public.provider_payout_requests request
              where request.provider_id = ledger.provider_id
                and request.status in ('requested', 'processing', 'paid')
            ) then 'disputed_on_hold'
            when new.status::text = 'cancelled' then 'rejected_held'
            else 'held_receivable'
          end,
          'provider_release', false,
          'release_condition', case when new.status::text = 'cancelled'
            then 'event_cancelled' else '14_day_payout_window' end,
          'rescheduled_after_eligibility', true,
          'payout_request_reconciliation_required', ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          )
        ),
        updated_at = now()
    where ledger.event_id = new.id
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.provider_funds_status = 'available_for_payout'
      and ledger.amount_released = 0
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      );

    update public.financial_transactions ledger
    set receivable_reconciliation_required = true,
        metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
          'phase11_reconciliation_required', true,
          'phase11_reconciliation_reason', 'event_schedule_changed_after_payout',
          'payout_eligible_on', case when newly_eligible_on is null then null else newly_eligible_on::text end
        ),
        updated_at = now()
    where ledger.event_id = new.id
      and ledger.transaction_type = 'booking_payment'
      and ledger.status in ('paid', 'verified')
      and ledger.amount_released > 0
      and ledger.provider_funds_status in ('available_for_payout', 'payout_pending', 'paid_out')
      and (
        ledger.metadata ->> 'accounting_version' = 'phase5-v1'
        or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists phase11_recalculate_event_receivables_trigger on public.events;
create trigger phase11_recalculate_event_receivables_trigger
after update of event_date, timezone, status on public.events
for each row execute function public.recalculate_phase11_event_receivables();

-- If an accepted provider booking returns to a request/cancellation state, its
-- unreleased allocation cannot remain withdrawable while it awaits acceptance,
-- replacement, or refund resolution.
create or replace function public.rehold_phase11_booking_receivable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_receivable_state text;
begin
  if new.status is not distinct from old.status
    or new.status::text in ('confirmed', 'completed')
  then
    return new;
  end if;

  perform set_config('app.phase11_receivable_release_authorized', 'true', true);
  next_receivable_state := case
    when new.status::text in ('cancelled', 'rejected', 'expired') then 'rejected_held'
    else 'awaiting_provider_acceptance'
  end;

  update public.financial_transactions ledger
  set provider_net_amount = case
        when ledger.provider_id is not null and exists (
          select 1 from public.provider_payout_requests request
          where request.provider_id = ledger.provider_id
            and request.status in ('requested', 'processing', 'paid')
        ) then ledger.provider_net_amount
        else 0
      end,
      held_provider_amount = case
        when ledger.provider_id is not null and exists (
          select 1 from public.provider_payout_requests request
          where request.provider_id = ledger.provider_id
            and request.status in ('requested', 'processing', 'paid')
        ) then ledger.held_provider_amount
        else ledger.held_provider_amount + ledger.provider_net_amount
      end,
      provider_funds_status = case
        when ledger.provider_id is not null and exists (
          select 1 from public.provider_payout_requests request
          where request.provider_id = ledger.provider_id
            and request.status in ('requested', 'processing', 'paid')
        ) then 'disputed_on_hold'
        else next_receivable_state
      end,
      receivable_reconciliation_required = coalesce(ledger.receivable_reconciliation_required, false)
        or (
          ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          )
        ),
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'receivable_state', case
          when ledger.provider_id is not null and exists (
            select 1 from public.provider_payout_requests request
            where request.provider_id = ledger.provider_id
              and request.status in ('requested', 'processing', 'paid')
          ) then 'disputed_on_hold'
          else next_receivable_state
        end,
        'provider_release', false,
        'release_condition', case when next_receivable_state = 'rejected_held'
          then 'replacement_or_refund' else 'provider_reacceptance_required' end,
        'payout_request_reconciliation_required', ledger.provider_id is not null and exists (
          select 1 from public.provider_payout_requests request
          where request.provider_id = ledger.provider_id
            and request.status in ('requested', 'processing', 'paid')
        )
      ),
      updated_at = now()
  where ledger.booking_id = new.id
    and ledger.provider_id = new.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.provider_funds_status in (
      'awaiting_provider_acceptance', 'held_receivable', 'eligible_for_release',
      'available_for_payout'
    )
    and ledger.amount_released = 0
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  update public.financial_transactions ledger
  set receivable_reconciliation_required = true,
      metadata = coalesce(ledger.metadata, '{}'::jsonb) || jsonb_build_object(
        'phase11_reconciliation_required', true,
        'phase11_reconciliation_reason', 'booking_status_changed_after_payout'
      ),
      updated_at = now()
  where ledger.booking_id = new.id
    and ledger.provider_id = new.provider_id
    and ledger.transaction_type = 'booking_payment'
    and ledger.status in ('paid', 'verified')
    and ledger.amount_released > 0
    and ledger.provider_funds_status in ('available_for_payout', 'payout_pending', 'paid_out')
    and (
      ledger.metadata ->> 'accounting_version' = 'phase5-v1'
      or ledger.metadata ->> 'accountingVersion' = 'phase5-v1'
    );

  return new;
end;
$$;

drop trigger if exists phase11_rehold_booking_receivable_trigger on public.bookings;
create trigger phase11_rehold_booking_receivable_trigger
after update of status on public.bookings
for each row execute function public.rehold_phase11_booking_receivable();

-- A payout request remains an explicit provider action. Evaluate the protected
-- ledger first for freshness, then count only validated, unreconciled available
-- receivables alongside the unchanged historical eligible balance.
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

  perform public.process_phase11_payout_eligibility(null);

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
        and (
          ledger.provider_funds_status <> 'available_for_payout'
          or not coalesce(ledger.receivable_reconciliation_required, false)
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

-- pg_cron is a Supabase-supported backend scheduler. It keeps eligibility
-- processing independent from a user opening the app or requesting a wallet.
create extension if not exists pg_cron;
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'multivent-phase11-payout-eligibility'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'multivent-phase11-payout-eligibility',
    '5 * * * *',
    'select public.process_phase11_payout_eligibility();'
  );
end;
$$;

revoke all on function public.phase11_event_local_date(text) from public;
revoke all on function public.enforce_phase11_receivable_hold() from public;
revoke all on function public.phase11_receivable_is_release_eligible(uuid) from public;
revoke all on function public.process_phase11_payout_eligibility(uuid) from public;
revoke all on function public.recalculate_phase11_event_receivables() from public;
revoke all on function public.rehold_phase11_booking_receivable() from public;
revoke all on function public.request_my_provider_payout(numeric) from public;
grant execute on function public.request_my_provider_payout(numeric) to authenticated;

comment on function public.process_phase11_payout_eligibility(uuid) is
  'Secure idempotent V11 eligibility evaluation. It makes validated held allocations available for payout but never starts an external transfer.';
comment on function public.phase11_receivable_is_release_eligible(uuid) is
  'Authoritative V11 release validation: verified payment, accepted correct recipient, event-local 14-day window, and no cancellation/refund/dispute/financial hold.';

commit;
