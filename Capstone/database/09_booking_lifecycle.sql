-- MULTIVENT event-centered booking lifecycle and real-time progress.
-- Run after 08_client_booking_rls_repair.sql in the Supabase SQL Editor.
-- This migration is additive and idempotent.

begin;

-- Security-definer helpers deliberately bypass table RLS while answering only
-- narrow ownership questions. This avoids events -> bookings -> events policy
-- recursion during a client booking insert.
create or replace function public.is_event_owner(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events
    where id = target_event_id
      and client_id = auth.uid()
  );
$$;

create or replace function public.is_event_booking_provider(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings
    join public.provider_profiles
      on provider_profiles.id = bookings.provider_id
    where bookings.event_id = target_event_id
      and provider_profiles.user_id = auth.uid()
  );
$$;

revoke all on function public.is_event_owner(uuid) from public;
revoke all on function public.is_event_booking_provider(uuid) from public;
grant execute on function public.is_event_owner(uuid) to authenticated;
grant execute on function public.is_event_booking_provider(uuid) to authenticated;

-- A provider may read the event attached to one of their booking requests.
drop policy if exists "Booking providers can view related events" on public.events;
create policy "Booking providers can view related events"
  on public.events for select to authenticated
  using (public.is_event_booking_provider(id));

drop policy if exists "Clients can request bookings" on public.bookings;
create policy "Clients can request bookings"
  on public.bookings for insert to authenticated
  with check (
    auth.uid() = client_id
    and public.is_event_owner(event_id)
    and exists (
      select 1
      from public.services
      where services.id = bookings.service_id
        and services.provider_id = bookings.provider_id
        and services.status = 'active'
    )
  );

-- Keep the private selection, provider request, and overall event progress in
-- sync even when a booking is updated outside the mobile app.
create or replace function public.sync_event_booking_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selection_status text;
  has_active_bookings boolean;
  all_active_bookings_confirmed boolean;
begin
  selection_status := case
    when new.status in ('confirmed', 'completed') then 'confirmed'
    when new.status in ('rejected', 'expired') then 'declined'
    when new.status = 'cancelled' then 'cancelled'
    when new.status = 'payment_required' then 'selected'
    else 'requested'
  end;

  update public.event_service_selections
  set
    status = selection_status,
    updated_at = now()
  where event_id = new.event_id
    and client_id = new.client_id
    and provider_id = new.provider_id
    and service_id = new.service_id;

  select
    count(*) > 0,
    count(*) > 0 and bool_and(status in ('confirmed', 'completed'))
  into has_active_bookings, all_active_bookings_confirmed
  from public.bookings
  where event_id = new.event_id
    and status <> 'payment_required';

  update public.events
  set
    status = case
      when has_active_bookings and all_active_bookings_confirmed then 'confirmed'::public.event_status
      when has_active_bookings then 'booking'::public.event_status
      else 'planning'::public.event_status
    end,
    updated_at = now()
  where id = new.event_id;

  return new;
end;
$$;

revoke all on function public.sync_event_booking_progress() from public;

drop trigger if exists sync_event_booking_progress_on_booking on public.bookings;
create trigger sync_event_booking_progress_on_booking
  after insert or update of status on public.bookings
  for each row execute function public.sync_event_booking_progress();

-- Supabase Realtime only emits row changes for tables in this publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end;
$$;

commit;
