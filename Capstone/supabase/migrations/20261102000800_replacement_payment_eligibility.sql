-- A declined provider request remains historical once a replacement booking
-- has been created. The replacement itself is the active request that must
-- accept before payment can proceed.

begin;

create or replace function public.event_payment_eligibility_v14(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  provider_count integer := 0;
  accepted_provider_count integer := 0;
  declined_provider_count integer := 0;
  cancelled_provider_count integer := 0;
  selected_without_request_count integer := 0;
  unfinished_food_tasting_count integer := 0;
  coordinator_required boolean := false;
  coordinator_accepted boolean := true;
  event_valid boolean := false;
  payment_eligible boolean := false;
  waiting_for text := null;
begin
  select * into event_row from public.events event where event.id = target_event_id;
  if event_row.id is null then
    return jsonb_build_object('event_found', false, 'payment_eligible', false, 'reason', 'Event not found.');
  end if;

  event_valid := event_row.status not in ('completed', 'cancelled');
  select count(*)::integer,
    count(*) filter (where booking.status in ('approved', 'paid', 'confirmed', 'completed'))::integer,
    count(*) filter (where booking.status = 'rejected')::integer,
    count(*) filter (where booking.status = 'cancelled')::integer
  into provider_count, accepted_provider_count, declined_provider_count, cancelled_provider_count
  from public.bookings booking
  left join public.catering_food_tasting_workflows fallback_workflow
    on fallback_workflow.booking_id = booking.id
  where booking.event_id = event_row.id
    and booking.status <> 'expired'
    -- An explicit fallback retires only its zero-price provisional request.
    and not (
      booking.status = 'cancelled'
      and fallback_workflow.fallback_activated_at is not null
    )
    -- A replacement-linked rejected booking is immutable history, not an
    -- unresolved active request. Its replacement booking is counted above and
    -- must still be accepted before this gate can open.
    and not (
      booking.status = 'rejected'
      and exists (
        select 1
        from public.booking_replacements replacement
        where replacement.rejected_booking_id = booking.id
          and replacement.replacement_booking_id is not null
      )
    );

  select count(*)::integer into selected_without_request_count
  from public.event_service_selections selection
  where selection.event_id = event_row.id and selection.status = 'selected';

  select count(*)::integer into unfinished_food_tasting_count
  from public.catering_food_tasting_workflows workflow
  join public.bookings booking on booking.id = workflow.booking_id
  where workflow.event_id = event_row.id
    and booking.status not in ('rejected', 'cancelled', 'expired')
    and (workflow.status not in ('cancelled', 'finalized')
      or (workflow.status = 'cancelled' and workflow.fallback_enabled_at is not null
        and workflow.fallback_activated_at is null));

  coordinator_required := coalesce(event_row.wants_coordinator, false)
    or event_row.pending_coordinator_id is not null or event_row.coordinator_id is not null;
  coordinator_accepted := not coordinator_required or (
    event_row.coordinator_assignment_status = 'accepted' and event_row.coordinator_id is not null
  );

  if not event_valid then waiting_for := 'This event is no longer available for payment.';
  elsif provider_count = 0 and not coordinator_accepted then
    waiting_for := 'Add a required service provider or receive coordinator acceptance before payment.';
  elsif provider_count = 0 then waiting_for := 'Add at least one required bookable service before payment.';
  elsif declined_provider_count > 0 then waiting_for := 'Replace every declined provider request before payment.';
  elsif cancelled_provider_count > 0 then waiting_for := 'Resolve cancelled provider requests before payment.';
  elsif selected_without_request_count > 0 then waiting_for := 'Submit every selected service provider request before payment.';
  elsif accepted_provider_count < provider_count then
    waiting_for := format('Waiting for %s provider confirmation%s.', provider_count - accepted_provider_count,
      case when provider_count - accepted_provider_count = 1 then '' else 's' end);
  elsif unfinished_food_tasting_count > 0 then
    waiting_for := 'Final food tasting menu confirmation is required before payment.';
  elsif not coordinator_accepted then waiting_for := 'Waiting for coordinator confirmation.';
  else payment_eligible := true;
  end if;

  return jsonb_build_object(
    'event_found', true, 'event_valid', event_valid,
    'provider_count', provider_count, 'accepted_provider_count', accepted_provider_count,
    'pending_provider_count', greatest(provider_count - accepted_provider_count - declined_provider_count, 0),
    'declined_provider_count', declined_provider_count, 'cancelled_provider_count', cancelled_provider_count,
    'selected_without_request_count', selected_without_request_count,
    'unfinished_food_tasting_count', unfinished_food_tasting_count,
    'coordinator_required', coordinator_required, 'coordinator_accepted', coordinator_accepted,
    'payment_eligible', payment_eligible, 'reason', waiting_for
  );
end;
$$;

commit;
