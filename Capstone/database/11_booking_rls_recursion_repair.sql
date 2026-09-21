-- MULTIVENT booking RLS recursion repair.
-- Run after 10_auth_profile_signup_repair.sql in the Supabase SQL Editor.
-- This migration is idempotent and does not modify booking or payment data.

begin;

-- Keep cross-table ownership checks outside table RLS evaluation. Without
-- these helpers, the provider event policy reads bookings while the booking
-- insert policy reads events, causing PostgreSQL's infinite-recursion error.
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

commit;
