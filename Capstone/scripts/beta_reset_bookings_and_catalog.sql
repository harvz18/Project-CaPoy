-- One-time beta reset. Accounts, provider/coordinator profiles, and
-- coordinator feedback are deliberately retained. Existing services are
-- archived rather than physically deleted so they can be restored if needed.
-- Execute this file only against the linked beta database.

begin;

-- The booking FK clears support-ticket references. Authorize that one system
-- maintenance change without altering tickets themselves.
select set_config('app.support_ticket_management_authorized', 'true', true);
select set_config('app.coordinator_assignment_authorized', 'true', true);

create table if not exists public.beta_reset_archives (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  created_at timestamptz not null default now(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);

create temporary table beta_reset_booking_ids (id uuid primary key) on commit drop;
insert into beta_reset_booking_ids (id) select id from public.bookings;

insert into public.beta_reset_archives (label, snapshot)
select
  'beta-catalogue-reset-2026-10-27',
  jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(to_jsonb(row)) from public.bookings row), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(row)) from public.payments row), '[]'::jsonb),
    'foodTastingDrafts', coalesce((select jsonb_agg(to_jsonb(row)) from public.catering_food_tasting_drafts row), '[]'::jsonb),
    'foodTastingWorkflows', coalesce((select jsonb_agg(to_jsonb(row)) from public.catering_food_tasting_workflows row), '[]'::jsonb),
    'foodTastings', coalesce((select jsonb_agg(to_jsonb(row)) from public.catering_food_tastings row), '[]'::jsonb),
    'foodTastingRevisions', coalesce((select jsonb_agg(to_jsonb(row)) from public.catering_food_tasting_menu_revisions row), '[]'::jsonb),
    'eventSelections', coalesce((select jsonb_agg(to_jsonb(row)) from public.event_service_selections row), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(to_jsonb(row)) from public.services row), '[]'::jsonb),
    'servicePackages', coalesce((select jsonb_agg(to_jsonb(row)) from public.service_packages row), '[]'::jsonb)
  );

-- Remove booking derivatives before the parent rows. Each statement is
-- constrained to this reset's bookings, keeping unrelated audit tables intact.
delete from public.provider_payment_receipts receipt
using beta_reset_booking_ids booking where receipt.booking_id = booking.id;
-- Keep the financial ledger itself, but detach the beta-only confirmation
-- record that otherwise restricts its removal.
update public.financial_transactions transaction_ledger
set external_confirmation_id = null
from public.provider_external_payment_confirmations confirmation,
     beta_reset_booking_ids booking
where transaction_ledger.external_confirmation_id = confirmation.id
  and confirmation.booking_id = booking.id;
delete from public.provider_external_payment_confirmations confirmation
using beta_reset_booking_ids booking where confirmation.booking_id = booking.id;
delete from public.payment_settlement_records settlement
using public.payments payment, beta_reset_booking_ids booking
where settlement.payment_id = payment.id and payment.booking_id = booking.id;
delete from public.client_refund_disbursements disbursement
using beta_reset_booking_ids booking where disbursement.booking_id = booking.id;
delete from public.client_wallet_transactions wallet_txn
using beta_reset_booking_ids booking where wallet_txn.booking_id = booking.id;
delete from public.catering_food_tasting_menu_revisions revision
using beta_reset_booking_ids booking where revision.booking_id = booking.id;
delete from public.catering_food_tastings tasting
using beta_reset_booking_ids booking where tasting.booking_id = booking.id;
delete from public.catering_food_tasting_workflows workflow
using beta_reset_booking_ids booking where workflow.booking_id = booking.id;
delete from public.catering_food_tasting_drafts;
delete from public.booking_replacements;
delete from public.notifications notification
using beta_reset_booking_ids booking
where notification.resource_type = 'booking' and notification.resource_id = booking.id;
delete from public.payments payment
using beta_reset_booking_ids booking where payment.booking_id = booking.id;
delete from public.bookings booking using beta_reset_booking_ids reset_booking where booking.id = reset_booking.id;

-- A saved selection is part of the booking path. Removing it prevents an old
-- plan from masquerading as a new beta booking after services are refreshed.
-- A few old completed test events predate the current coordinator-state
-- constraint. Normalize only those invalid assignment states so the venue
-- selection cleanup trigger can update the event safely.
update public.events
set coordinator_id = null,
    pending_coordinator_id = null,
    coordinator_assignment_status = null,
    updated_at = now()
where not (
  (coordinator_assignment_status in ('awaiting_payment', 'pending')
    and pending_coordinator_id is not null and coordinator_id is null)
  or (coordinator_assignment_status = 'accepted'
    and coordinator_id is not null and pending_coordinator_id is null)
  or (coordinator_assignment_status is null
    and pending_coordinator_id is null and coordinator_id is null)
);

delete from public.event_coordinator_package_selections;
delete from public.event_service_selections;

-- Preserve every service row and package for reuse, but remove them from all
-- client/provider catalog views. The beta overlay publishes fresh listings
-- through the current validation rules rather than reviving stale schemas.
-- These legacy records predate their current category validators. Temporarily
-- disable only table triggers while archiving them; the new beta listings are
-- created normally with all validation enabled below/after this transaction.
alter table public.services disable trigger user;
update public.services
set status = 'deleted', is_available = false, updated_at = now();
alter table public.services enable trigger user;

commit;
