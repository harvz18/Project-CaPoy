-- MULTIVENT Revision V14 QA follow-up: V14 accepts a booking before payment,
-- so first authoritative verification must invoke the existing held-receivable
-- transition after the Phase 5 ledger snapshot is created.

begin;

create or replace function public.verify_v14_payment_settlement(
  target_payment_id uuid,
  authoritative_reference text,
  verification_source_value text default 'manual_bank_reconciliation'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  reference_value text := nullif(trim(authoritative_reference), '');
  source_value text := nullif(trim(verification_source_value), '');
begin
  if not public.has_permission('remittance.verify') then
    raise exception 'Settlement-verification access is required.' using errcode = '42501';
  end if;
  if reference_value is null or char_length(reference_value) < 4 then
    raise exception 'An authoritative bank or processor reference is required.' using errcode = '22023';
  end if;

  select payment.* into payment_row
  from public.payments payment
  where payment.id = target_payment_id
  for update;

  if payment_row.id is null
    or coalesce(payment_row.metadata ->> 'bookingFlowVersion', '') <> 'v14-phase4'
  then
    raise exception 'V14 payment record not found.' using errcode = 'P0002';
  end if;
  if payment_row.status in ('refunded', 'cancelled') then
    raise exception 'A cancelled or refunded payment cannot be verified.' using errcode = '22023';
  end if;

  if payment_row.status = 'verified' then
    if payment_row.provider_reference is distinct from reference_value then
      raise exception 'This payment is already verified with a different authoritative reference.'
        using errcode = '42501';
    end if;
    return jsonb_build_object(
      'paymentId', payment_row.id,
      'paymentStatus', 'verified',
      'settlementStatus', 'verified',
      'reference', reference_value,
      'alreadyVerified', true
    );
  end if;

  perform set_config('app.v14_payment_verification_authorized', 'true', true);
  if payment_row.status = 'paid' then
    update public.payments
    set status = 'verified',
        provider_reference = reference_value,
        paid_at = coalesce(paid_at, now()),
        verified_at = now(),
        updated_at = now()
    where id = payment_row.id;
  else
    update public.payments
    set status = 'verified',
        provider_reference = reference_value,
        paid_at = coalesce(paid_at, now()),
        verified_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'settlementVerificationSource', coalesce(source_value, 'authorized_reconciliation'),
          'settlementVerifiedAt', now()
        ),
        updated_at = now()
    where id = payment_row.id;
  end if;

  update public.payment_settlement_records
  set verification_status = 'verified',
      external_reference = reference_value,
      verification_source = coalesce(source_value, 'authorized_reconciliation'),
      verified_at = now(),
      verified_by = auth.uid(),
      updated_at = now()
  where payment_id = payment_row.id;

  -- Phase 5's original workflow accepted providers after payment. In V14 the
  -- provider/coordinator decision is deliberately collected first, so use the
  -- same private custody helpers after the verified ledger row exists. These
  -- helpers preserve the 14-day hold and never make funds withdrawable.
  if payment_row.booking_id is not null then
    perform public.hold_phase11_provider_receivable(payment_row.booking_id);
  elsif payment_row.coordinator_id is not null then
    perform public.hold_phase11_coordinator_receivable(
      payment_row.event_id, payment_row.coordinator_id
    );
  end if;

  return jsonb_build_object(
    'paymentId', payment_row.id,
    'paymentStatus', 'verified',
    'settlementStatus', 'verified',
    'reference', reference_value,
    'alreadyVerified', false
  );
end;
$$;

revoke all on function public.verify_v14_payment_settlement(uuid, text, text) from public;
grant execute on function public.verify_v14_payment_settlement(uuid, text, text) to authenticated;

comment on function public.verify_v14_payment_settlement(uuid, text, text) is
  'Authorized V14 settlement verification: retry-safe and converts only verified, already-accepted V14 allocations into protected Phase 11 receivables.';

commit;
