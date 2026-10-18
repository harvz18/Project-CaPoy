-- Make an initial checkout safe to retry. The client submits a stable
-- checkout_reference for each booking (or coordinator selection), so a lost
-- response or rapid second tap cannot create another downpayment row.

begin;

alter table public.payments
  add column if not exists checkout_reference text;

create unique index if not exists payments_checkout_reference_key
  on public.payments (checkout_reference);

comment on column public.payments.checkout_reference is
  'Stable client-checkout key. It makes retrying a completed initial payment idempotent.';

commit;
