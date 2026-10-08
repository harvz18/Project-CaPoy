-- MULTIVENT coordinator request visibility and provider/coordinator balance clarity.
-- Apply after 60_service_selection_revision.sql.

begin;

-- Coordinators must be able to inspect a request before accepting it. This RPC
-- deliberately exposes only events assigned to the signed-in coordinator and
-- uses immutable payment snapshots for every financial amount.
create or replace function public.get_my_coordinator_booking_details()
returns table (
  event_id uuid,
  client_notes text,
  package_name text,
  selected_services jsonb,
  payment_confirmed boolean,
  can_accept boolean,
  payment_status text,
  downpayment_amount numeric,
  coordination_fee numeric,
  platform_fee_paid numeric,
  initial_coordinator_share numeric,
  remaining_coordinator_balance numeric,
  paid_at timestamptz,
  balance_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id,
    nullif(trim(event.notes), '') as client_notes,
    package_selection.package_name,
    coalesce(service_selection.items, '[]'::jsonb) as selected_services,
    payment.id is not null as payment_confirmed,
    coalesce(event.coordinator_pricing_snapshot ->> 'financialTermsVersion', '') <> 'phase5-v1'
      or payment.id is not null as can_accept,
    case
      when payment.id is null
        and event.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
        then 'Awaiting client downpayment'
      when payment.id is null then 'Legacy request - no online downpayment snapshot'
      when coalesce(payment.metadata ->> 'paymentType', 'full') = 'deposit'
        then 'Downpayment confirmed'
      else 'Full payment confirmed'
    end as payment_status,
    round(coalesce(payment.amount, 0), 2) as downpayment_amount,
    round(coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0), 2)
      as coordination_fee,
    round(coalesce(payment.platform_fee_amount, 0), 2) as platform_fee_paid,
    round(coalesce(payment.provider_initial_allocation, 0), 2)
      as initial_coordinator_share,
    round(greatest(
      coalesce(payment.service_subtotal, event.coordinator_fee_amount, 0)
        - coalesce(payment.provider_initial_allocation, 0),
      0
    ), 2) as remaining_coordinator_balance,
    coalesce(payment.verified_at, payment.paid_at, payment.created_at) as paid_at,
    case
      when payment.id is null
        and event.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
        then 'The client must complete the downpayment before acceptance.'
      when payment.id is null
        then 'This request predates the online payment-snapshot workflow.'
      when event.coordinator_assignment_status = 'pending'
        then 'Accept the request to credit the initial coordinator share.'
      when event.status = 'completed'
        then 'The remaining coordination balance is due through the completion workflow.'
      else 'The remaining coordination balance becomes due after event completion.'
    end as balance_status
  from public.events event
  left join lateral (
    select selection.package_name
    from public.event_coordinator_package_selections selection
    where selection.event_id = event.id
      and selection.coordinator_id = auth.uid()
    order by selection.selected_at desc
    limit 1
  ) package_selection on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', selection.id,
      'serviceName', selection.service_name,
      'categoryName', coalesce(selection.category_name, 'Service'),
      'providerName', coalesce(provider.business_name, 'Provider'),
      'status', selection.status,
      'notes', selection.notes,
      'cateringOptionName', selection.catering_option_name,
      'venueOptionName', selection.venue_option_name,
      'venueBookedHours', selection.venue_booked_hours
    ) order by selection.created_at, selection.id) as items
    from public.event_service_selections selection
    left join public.provider_profiles provider on provider.id = selection.provider_id
    where selection.event_id = event.id
      and selection.status not in ('declined', 'cancelled')
  ) service_selection on true
  left join lateral (
    select paid_payment.*
    from public.payments paid_payment
    where paid_payment.event_id = event.id
      and paid_payment.coordinator_id = auth.uid()
      and paid_payment.payment_scope = 'coordinator_service'
      and paid_payment.status in ('paid', 'verified')
      and (
        paid_payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or paid_payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
    order by coalesce(paid_payment.verified_at, paid_payment.paid_at,
      paid_payment.created_at) desc, paid_payment.id desc
    limit 1
  ) payment on true
  where auth.uid() is not null
    and (
      (event.pending_coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'pending')
      or (event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted')
    )
  order by event.coordinator_assignment_requested_at desc nulls last,
    event.updated_at desc;
$$;

-- Preserve the Phase 6 atomic accounting transition. An unpaid Phase 6
-- request cannot be accepted, but it can be declined, and both historical
-- metadata spellings are recognized.
create or replace function public.respond_event_coordinator_assignment(
  target_event_id uuid,
  accept_assignment boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  is_phase6_payment boolean;
  released_now numeric(12,2) := 0;
begin
  select * into event_row from public.events event
  where event.id = target_event_id and event.pending_coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'pending'
    and event.status not in ('completed', 'cancelled') for update;
  if event_row.id is null then
    raise exception 'This coordinator booking request is no longer available.' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.payments payment
    where payment.event_id = event_row.id
      and payment.coordinator_id = auth.uid()
      and payment.payment_scope = 'coordinator_service'
      and payment.status in ('paid', 'verified')
      and (
        payment.metadata ->> 'accountingVersion' = 'phase5-v1'
        or payment.metadata ->> 'accounting_version' = 'phase5-v1'
      )
  ) into is_phase6_payment;
  if accept_assignment
    and event_row.coordinator_pricing_snapshot ->> 'financialTermsVersion' = 'phase5-v1'
    and not is_phase6_payment
  then
    raise exception 'The client downpayment is still pending. You can review or decline this request now, and accept it after payment is confirmed.';
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when accept_assignment then 'accepted' else 'declined' end,
      responded_at = now(), updated_at = now(),
      note = case when accept_assignment then note
        else 'Coordinator declined the client booking request.' end
  where event_id = event_row.id and coordinator_id = auth.uid() and status = 'invited';

  if accept_assignment then
    update public.events set coordinator_id = auth.uid(), pending_coordinator_id = null,
      coordinator_assignment_status = 'accepted', coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = null, updated_at = now() where id = event_row.id;
    if is_phase6_payment then
      released_now := public.release_phase6_coordinator_initial_share(event_row.id, auth.uid());
    end if;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking accepted',
      format('Your coordinator booking for %s was accepted.', event_row.name), 'event', event_row.id);
  else
    update public.financial_transactions transaction
    set provider_funds_status = 'rejected_held',
        metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object(
          'provider_release', false,
          'release_condition', 'replacement_or_refund',
          'coordinator_rejected_at', now(),
          'rejected_allocation_recognized_as_revenue', false
        ),
        updated_at = now()
    where transaction.event_id = event_row.id
      and transaction.coordinator_id = auth.uid()
      and transaction.transaction_type = 'booking_payment'
      and transaction.status in ('paid', 'verified')
      and (
        transaction.metadata ->> 'accounting_version' = 'phase5-v1'
        or transaction.metadata ->> 'accountingVersion' = 'phase5-v1'
      );

    update public.events set coordinator_id = null, pending_coordinator_id = null,
      coordinator_assignment_status = null, coordinator_assignment_responded_at = now(),
      coordinator_assignment_note = 'The coordinator declined the client booking request.',
      coordinator_preference = 'undecided', coordinator_fee_amount = null,
      coordinator_fee_currency = null, coordinator_pricing_snapshot = null,
      updated_at = now() where id = event_row.id;
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (event_row.client_id, 'Coordinator booking declined',
      format('Your coordinator request for %s was declined. You can choose another coordinator or continue without one.', event_row.name),
      'event', event_row.id);
  end if;

  return jsonb_build_object(
    'event_id', event_row.id,
    'accepted', accept_assignment,
    'assignment_status', case when accept_assignment then 'accepted' else null end,
    'initial_share_credited', released_now
  );
end;
$$;

revoke all on function public.get_my_coordinator_booking_details() from public;
revoke all on function public.respond_event_coordinator_assignment(uuid, boolean) from public;
grant execute on function public.get_my_coordinator_booking_details() to authenticated;
grant execute on function public.respond_event_coordinator_assignment(uuid, boolean) to authenticated;

comment on function public.get_my_coordinator_booking_details() is
  'Coordinator-scoped request preview and immutable payment breakdown; commission is excluded from the remaining coordination balance.';

commit;
