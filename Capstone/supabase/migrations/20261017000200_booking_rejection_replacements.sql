-- MULTIVENT Revision V4, Phase 3: safe service replacements after a rejection.
--
-- This migration is intentionally additive. A rejected booking, its payment,
-- and its financial transaction remain the original provider's historical
-- record. Replacement discovery creates a separate, explicitly paid booking.

begin;

create table if not exists public.booking_replacements (
  id uuid primary key default gen_random_uuid(),
  rejected_booking_id uuid not null unique references public.bookings(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.service_categories(id) on delete restrict,
  rejected_service_id uuid not null references public.services(id) on delete restrict,
  rejected_provider_id uuid not null references public.provider_profiles(id) on delete restrict,
  rejected_amount numeric(12,2) not null check (rejected_amount >= 0),
  status text not null default 'offered' check (status in ('offered', 'browsing', 'replacement_selected', 'replacement_submitted', 'closed')),
  replacement_service_id uuid references public.services(id) on delete restrict,
  replacement_booking_id uuid unique references public.bookings(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (replacement_booking_id is null or replacement_service_id is not null)
);

create index if not exists booking_replacements_client_status_idx
  on public.booking_replacements (client_id, status, updated_at desc);
create index if not exists booking_replacements_event_idx
  on public.booking_replacements (event_id, updated_at desc);

alter table public.booking_replacements enable row level security;

drop policy if exists "Clients view their booking replacements" on public.booking_replacements;
create policy "Clients view their booking replacements"
  on public.booking_replacements for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Assigned coordinators view event replacements" on public.booking_replacements;
create policy "Assigned coordinators view event replacements"
  on public.booking_replacements for select to authenticated
  using (
    exists (
      select 1
      from public.events event
      where event.id = booking_replacements.event_id
        and event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted'
    )
  );

-- The client explicitly starts this flow after seeing the provider's decline.
-- It does not change a booking, payment, or financial ledger entry.
create or replace function public.start_my_booking_replacement(target_booking_id uuid)
returns public.booking_replacements
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_row public.booking_replacements%rowtype;
begin
  select replacement.* into replacement_row
  from public.booking_replacements replacement
  join public.bookings booking on booking.id = replacement.rejected_booking_id
  where replacement.rejected_booking_id = target_booking_id
    and booking.client_id = auth.uid()
    and booking.status = 'rejected'
  for update;

  if replacement_row.id is null then
    raise exception 'A replacement is available only for one of your rejected booking requests.'
      using errcode = '42501';
  end if;

  if replacement_row.status = 'closed' then
    raise exception 'This replacement request is closed.';
  end if;

  update public.booking_replacements
  set status = case when replacement_row.status = 'offered' then 'browsing' else replacement_row.status end,
      updated_at = now()
  where id = replacement_row.id
  returning * into replacement_row;

  return replacement_row;
end;
$$;

-- Called only after the client has configured an alternative through the
-- existing service-detail flow. It rechecks category, publication, date
-- availability, and same-provider conflicts before the normal payment flow
-- can create the new request.
create or replace function public.stage_my_booking_replacement(
  target_booking_id uuid,
  target_service_id uuid
)
returns public.booking_replacements
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_row public.booking_replacements%rowtype;
  event_row public.events%rowtype;
  service_row record;
begin
  select replacement.* into replacement_row
  from public.booking_replacements replacement
  join public.bookings booking on booking.id = replacement.rejected_booking_id
  where replacement.rejected_booking_id = target_booking_id
    and booking.client_id = auth.uid()
    and booking.status = 'rejected'
  for update;

  if replacement_row.id is null then
    raise exception 'A replacement can only be staged for your rejected booking.' using errcode = '42501';
  end if;
  if replacement_row.status in ('replacement_submitted', 'closed') then
    raise exception 'This replacement request can no longer be changed.';
  end if;

  select * into event_row from public.events
  where id = replacement_row.event_id and client_id = auth.uid()
    and status not in ('completed', 'cancelled');
  if event_row.id is null then raise exception 'The event is no longer available for a replacement.'; end if;

  select service.id, service.provider_id, service.category_id
  into service_row
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  where service.id = target_service_id
    and service.category_id is not distinct from replacement_row.category_id
    and service.status = 'active' and service.is_available = true
    and owner.account_status in ('active', 'verified');
  if service_row.id is null then
    raise exception 'Choose an active service from the same category.';
  end if;

  if event_row.event_date is null or event_row.event_time is null then
    raise exception 'Set the event date and time before choosing a replacement.';
  end if;
  if exists (
    select 1 from public.provider_availability availability
    where availability.provider_id = service_row.provider_id
      and availability.available_date = event_row.event_date
      and (availability.service_id is null or availability.service_id = service_row.id)
      and (availability.is_available = false
        or (availability.start_time is not null and event_row.event_time < availability.start_time)
        or (availability.end_time is not null and event_row.event_time > availability.end_time))
  ) or exists (
    select 1 from public.bookings booking
    where booking.provider_id = service_row.provider_id
      and booking.event_id <> event_row.id
      and booking.requested_date = event_row.event_date
      and booking.status in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
  ) then
    raise exception 'This provider is not available for the event date. Choose another alternative.';
  end if;

  update public.booking_replacements
  set replacement_service_id = service_row.id,
      status = 'replacement_selected',
      updated_at = now()
  where id = replacement_row.id
  returning * into replacement_row;

  if event_row.coordinator_id is not null and event_row.coordinator_assignment_status = 'accepted' then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select event_row.coordinator_id,
      'Replacement service selected',
      format('A client selected a replacement service for %s and must still complete a new payment request.', event_row.name),
      'booking_replacement', replacement_row.id;
  end if;
  return replacement_row;
end;
$$;

-- Links the newly-created booking to its historical rejection. This does not
-- move funds; the new booking keeps its own payment snapshot and provider.
create or replace function public.link_staged_booking_replacement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  replacement_row public.booking_replacements%rowtype;
begin
  select * into replacement_row from public.booking_replacements replacement
  where replacement.event_id = new.event_id
    and replacement.client_id = new.client_id
    and replacement.replacement_service_id = new.service_id
    and replacement.status = 'replacement_selected'
    and replacement.replacement_booking_id is null
  order by replacement.updated_at desc
  limit 1
  for update skip locked;

  if replacement_row.id is not null then
    update public.booking_replacements
    set replacement_booking_id = new.id,
        status = 'replacement_submitted',
        updated_at = now()
    where id = replacement_row.id;
  end if;
  return new;
end;
$$;

drop trigger if exists link_staged_booking_replacement on public.bookings;
create trigger link_staged_booking_replacement
  after insert on public.bookings
  for each row execute function public.link_staged_booking_replacement();

-- Preserve the deployed response logic, then atomically mark the stale
-- selection declined and create the client-visible replacement offer.
create or replace function public.respond_to_provider_booking(target_booking_id uuid, accept_booking boolean, response_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  service_name text;
  event_name text;
  is_phase6_payment boolean;
  released_now numeric(12,2) := 0;
  next_status public.booking_status;
  replacement_id uuid;
begin
  select booking.* into booking_row from public.bookings booking
  join public.provider_profiles provider on provider.id = booking.provider_id
  where booking.id = target_booking_id and provider.user_id = auth.uid()
  for update of booking;
  if booking_row.id is null then raise exception 'Booking request not found for this service-provider account.' using errcode = '42501'; end if;

  next_status := case when accept_booking then 'confirmed'::public.booking_status else 'rejected'::public.booking_status end;
  if booking_row.status = next_status then
    return jsonb_build_object('booking_id', booking_row.id, 'status', next_status, 'accepted', accept_booking, 'initial_share_credited', 0, 'already_processed', true);
  end if;
  if booking_row.status <> 'requested' then raise exception 'This booking request can no longer be answered.'; end if;
  if char_length(coalesce(response_note, '')) > 2000 then raise exception 'The response note cannot exceed 2,000 characters.'; end if;

  select exists (select 1 from public.payments payment where payment.booking_id = booking_row.id and payment.status in ('paid', 'verified') and payment.metadata ->> 'accountingVersion' = 'phase5-v1') into is_phase6_payment;
  if booking_row.financial_terms_version = 'phase5-v1' and not is_phase6_payment then raise exception 'The client payment must be confirmed before this request can be answered.'; end if;

  perform set_config('app.phase6_booking_response_authorized', 'true', true);
  update public.bookings set status = next_status, provider_notes = nullif(trim(coalesce(response_note, '')), ''), updated_at = now() where id = booking_row.id;

  if is_phase6_payment and accept_booking then
    released_now := public.release_phase6_provider_initial_share(booking_row.id);
  elsif is_phase6_payment then
    update public.financial_transactions transaction set provider_funds_status = 'rejected_held', metadata = coalesce(transaction.metadata, '{}'::jsonb) || jsonb_build_object('provider_release', false, 'release_condition', 'replacement_or_refund', 'provider_rejected_at', now(), 'rejected_allocation_recognized_as_revenue', false), updated_at = now()
    where transaction.booking_id = booking_row.id and transaction.transaction_type = 'booking_payment' and transaction.status in ('paid', 'verified') and transaction.metadata ->> 'accounting_version' = 'phase5-v1';
  end if;

  if not accept_booking then
    update public.event_service_selections selection set status = 'declined', updated_at = now()
    where selection.event_id = booking_row.event_id and selection.client_id = booking_row.client_id
      and selection.provider_id = booking_row.provider_id and selection.service_id = booking_row.service_id
      and selection.status in ('selected', 'requested');

    insert into public.booking_replacements (rejected_booking_id, event_id, client_id, category_id, rejected_service_id, rejected_provider_id, rejected_amount)
    select booking_row.id, booking_row.event_id, booking_row.client_id, service.category_id, booking_row.service_id, booking_row.provider_id, greatest(coalesce(booking_row.amount, 0), 0)
    from public.services service where service.id = booking_row.service_id
    on conflict (rejected_booking_id) do nothing
    returning id into replacement_id;
  end if;

  select coalesce(service.name, 'Service'), coalesce(event.name, 'Event') into service_name, event_name
  from public.services service join public.events event on event.id = booking_row.event_id where service.id = booking_row.service_id;
  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (booking_row.client_id, case when accept_booking then 'Booking confirmed' else 'Booking declined' end,
    case when accept_booking then format('%s accepted your booking request for %s.', service_name, event_name) else format('%s could not accept your booking request for %s. You can choose a similar service without changing the held funds.', service_name, event_name) end,
    case when accept_booking then 'booking' else 'booking_replacement' end,
    case when accept_booking then booking_row.id else coalesce(replacement_id, booking_row.id) end);

  if not accept_booking then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    select event.coordinator_id, 'Service booking declined', format('%s was declined for %s. The client may submit a replacement request.', service_name, event_name), 'booking_replacement', coalesce(replacement_id, booking_row.id)
    from public.events event
    where event.id = booking_row.event_id
      and event.coordinator_id is not null
      and event.coordinator_assignment_status = 'accepted';
  end if;

  return jsonb_build_object('booking_id', booking_row.id, 'status', next_status, 'accepted', accept_booking, 'initial_share_credited', released_now, 'replacement_id', replacement_id, 'already_processed', false);
end;
$$;

revoke all on function public.start_my_booking_replacement(uuid) from public;
revoke all on function public.stage_my_booking_replacement(uuid, uuid) from public;
grant execute on function public.start_my_booking_replacement(uuid) to authenticated;
grant execute on function public.stage_my_booking_replacement(uuid, uuid) to authenticated;

commit;
