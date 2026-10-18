-- Checkout repair: custom catering is validated from its provider-configured
-- food-item snapshot, and coordinators are notified only after the required
-- initial payment has been recorded.

begin;

create or replace function public.validate_my_phase9_selections(target_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  selection_row record;
  custom_menu_item_ids jsonb;
begin
  if not exists (
    select 1 from public.events event
    where event.id = target_event_id
      and event.client_id = auth.uid()
      and event.status not in ('completed', 'cancelled')
  ) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.status not in ('declined', 'cancelled')
    group by selection.category_key
    having count(*) > 1
  ) then
    raise exception 'Only one service may be selected per category.';
  end if;

  for selection_row in
    select selection.service_id, selection.package_id, selection.category_key,
      selection.catering_option_id, selection.catering_option_snapshot,
      selection.venue_option_id, selection.venue_booked_hours
    from public.event_service_selections selection
    where selection.event_id = target_event_id
      and selection.client_id = auth.uid()
      and selection.status in ('selected', 'requested')
  loop
    if selection_row.category_key = 'catering'
      and selection_row.catering_option_id = 'custom-menu'
    then
      select coalesce(jsonb_agg(item.value ->> 'id'), '[]'::jsonb)
      into custom_menu_item_ids
      from jsonb_array_elements(
        coalesce(selection_row.catering_option_snapshot -> 'selectedItems', '[]'::jsonb)
      ) item(value);

      -- This re-checks every selected food item, selection limit, guest range,
      -- and current provider price without pretending custom-menu is a preset.
      perform public.calculate_catering_menu_quote(
        selection_row.service_id,
        target_event_id,
        custom_menu_item_ids
      );
    else
      perform public.calculate_event_service_quote(
        selection_row.service_id,
        target_event_id,
        case when selection_row.category_key = 'venue'
          then selection_row.venue_option_id
          else selection_row.catering_option_id end,
        selection_row.venue_booked_hours,
        selection_row.package_id
      );
    end if;
  end loop;

  return true;
end;
$$;

-- Coordinator selection reserves the quoted fee and availability for checkout,
-- but it is not sent to the coordinator until a paid coordinator payment exists.
create or replace function public.assign_event_coordinator(
  target_event_id uuid,
  target_coordinator_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  coordinator_name text;
  fee numeric(12,2);
  fee_currency text;
  profile_description text;
  profile_specializations text[];
  event_start timestamptz;
  event_end timestamptz;
begin
  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled')
  for update;
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select profile.full_name, service_profile.coordination_fee,
    service_profile.currency, service_profile.description, service_profile.specializations
  into coordinator_name, fee, fee_currency, profile_description, profile_specializations
  from public.coordinator_service_profiles service_profile
  join public.profiles profile on profile.id = service_profile.coordinator_id
  where service_profile.coordinator_id = target_coordinator_id
    and service_profile.is_accepting_bookings
    and service_profile.coordination_fee > 0
    and profile.account_status = 'active';
  if coordinator_name is null then
    raise exception 'This coordinator is not accepting bookings.';
  end if;

  select event_window.starts_at, event_window.ends_at
  into event_start, event_end
  from public.coordinator_event_window(event_row) event_window;
  if event_start is null or event_end is null then
    raise exception 'Complete the event date and time before requesting a coordinator.';
  end if;
  if exists (
    select 1
    from public.coordinator_availability availability
    where availability.coordinator_id = target_coordinator_id
      and availability.status in ('unavailable', 'on_leave')
      and event_start < availability.ends_at
      and event_end > availability.starts_at
  ) or exists (
    select 1
    from public.events conflict_event
    cross join lateral public.coordinator_event_window(conflict_event) conflict_window
    where conflict_event.id <> event_row.id
      and conflict_event.status not in ('completed', 'cancelled')
      and (conflict_event.coordinator_id = target_coordinator_id
        or conflict_event.pending_coordinator_id = target_coordinator_id)
      and event_start < conflict_window.ends_at
      and event_end > conflict_window.starts_at
  ) then
    raise exception 'This coordinator is unavailable for the event schedule.';
  end if;

  perform set_config('app.coordinator_assignment_authorized', 'true', true);
  update public.coordinator_assignment_attempts
  set status = case when status = 'accepted' then 'reassigned' else 'withdrawn' end,
      responded_at = coalesce(responded_at, now()),
      updated_at = now(),
      note = coalesce(note, 'Client selected another coordinator.')
  where event_id = event_row.id
    and status in ('invited', 'accepted');

  update public.events
  set coordinator_id = null,
      pending_coordinator_id = target_coordinator_id,
      coordinator_assignment_status = 'pending',
      coordinator_assignment_requested_at = now(),
      coordinator_assignment_responded_at = null,
      coordinator_assignment_attempted_at = now(),
      coordinator_assignment_source = 'client',
      coordinator_assignment_note = 'Coordinator selected; waiting for the client downpayment before sending the request.',
      coordinator_preference = 'selected',
      coordinator_fee_amount = fee,
      coordinator_fee_currency = fee_currency,
      coordinator_pricing_snapshot = jsonb_build_object(
        'coordinator_id', target_coordinator_id,
        'coordinator_name', coordinator_name,
        'description', profile_description,
        'specializations', profile_specializations,
        'coordination_fee', fee,
        'currency', fee_currency,
        'captured_at', now()
      ),
      updated_at = now()
  where id = event_row.id;

  insert into public.coordinator_assignment_attempts (
    event_id, coordinator_id, assignment_source, status, requested_at, assigned_by, note
  ) values (
    event_row.id, target_coordinator_id, 'client', 'invited', now(), auth.uid(),
    'Coordinator selected; request will be delivered after the client downpayment.'
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'coordinator_id', target_coordinator_id,
    'coordinator_name', coordinator_name,
    'assignment_status', 'pending',
    'coordination_fee', fee,
    'currency', fee_currency,
    'request_status', 'awaiting_downpayment'
  );
end;
$$;

create or replace function public.notify_paid_coordinator_booking_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row record;
  client_name text;
begin
  if new.payment_scope is distinct from 'coordinator_service'
    or new.coordinator_id is null
    or new.status not in ('paid', 'verified') then
    return new;
  end if;

  select event.id, event.name, event.pending_coordinator_id, event.coordinator_fee_amount
  into event_row
  from public.events event
  where event.id = new.event_id
    and event.pending_coordinator_id = new.coordinator_id
    and event.coordinator_assignment_status = 'pending';
  if event_row.id is null then return new; end if;

  select profile.full_name into client_name
  from public.profiles profile
  where profile.id = new.payer_id;

  if not exists (
    select 1
    from public.notifications notification
    where notification.user_id = new.coordinator_id
      and notification.resource_type = 'event'
      and notification.resource_id = event_row.id
      and notification.title = 'New coordinator booking request'
  ) then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      new.coordinator_id,
      'New coordinator booking request',
      format('%s requested your coordination service for %s at PHP %s.',
        coalesce(client_name, 'A client'), event_row.name,
        to_char(event_row.coordinator_fee_amount, 'FM999,999,990.00')),
      'event', event_row.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_paid_coordinator_booking_request_trigger on public.payments;
create trigger notify_paid_coordinator_booking_request_trigger
after insert on public.payments
for each row execute function public.notify_paid_coordinator_booking_request();

revoke all on function public.validate_my_phase9_selections(uuid) from public;
revoke all on function public.assign_event_coordinator(uuid, uuid) from public;
revoke all on function public.notify_paid_coordinator_booking_request() from public;
grant execute on function public.validate_my_phase9_selections(uuid) to authenticated;
grant execute on function public.assign_event_coordinator(uuid, uuid) to authenticated;

commit;
