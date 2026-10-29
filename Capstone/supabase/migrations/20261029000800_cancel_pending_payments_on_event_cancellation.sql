-- Reconcile prototype checkout records when an event is cancelled before
-- settlement. Settled payments retain the existing Phase 14 refund workflow.

begin;

-- A cancelled event is no longer payment-eligible, but its own unsettled
-- checkout record must be allowed to transition from pending to cancelled.
-- This exception is deliberately narrower than a general payment-status bypass.
create or replace function public.enforce_v14_payment_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  eligibility jsonb;
begin
  if tg_op = 'UPDATE' and old.status in ('paid', 'verified', 'refunded') then
    return new;
  end if;

  if new.event_id is null then
    return new;
  end if;

  select * into event_row
  from public.events event
  where event.id = new.event_id;

  if event_row.id is null or event_row.client_id is distinct from new.payer_id then
    raise exception 'A valid client event is required before payment.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status = 'cancelled'
    and event_row.status::text = 'cancelled'
  then
    return new;
  end if;

  eligibility := public.event_payment_eligibility_v14(new.event_id);
  if not coalesce((eligibility ->> 'payment_eligible')::boolean, false) then
    raise exception '%', coalesce(eligibility ->> 'reason',
      'Payment is unavailable until all required booking requests are accepted.') using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.cancel_pending_payments_on_event_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and new.status::text = 'cancelled'
  then
    update public.payments payment
    set
      status = 'cancelled',
      metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelledByEventCancellation', true,
        'cancellationReason', 'event_cancelled_before_settlement',
        'cancelledAt', now()
      ),
      updated_at = now()
    where payment.event_id = new.id
      and payment.payer_id = new.client_id
      and payment.status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_cancel_pending_payments_on_event_cancellation_trigger on public.events;
create trigger aaa_cancel_pending_payments_on_event_cancellation_trigger
  after update of status on public.events
  for each row execute function public.cancel_pending_payments_on_event_cancellation();

-- Repair only stale, unsettled payments on already-cancelled events. This is
-- idempotent and deliberately excludes processing, paid, and verified rows.
update public.payments payment
set
  status = 'cancelled',
  metadata = coalesce(payment.metadata, '{}'::jsonb) || jsonb_build_object(
    'cancelledByEventCancellation', true,
    'cancellationReason', 'event_cancelled_before_settlement',
    'cancelledAt', now()
  ),
  updated_at = now()
from public.events event
where event.id = payment.event_id
  and event.status::text = 'cancelled'
  and payment.payer_id = event.client_id
  and payment.status = 'pending';

revoke all on function public.cancel_pending_payments_on_event_cancellation() from public;

commit;
