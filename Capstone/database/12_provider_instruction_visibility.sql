-- MULTIVENT provider instruction visibility.
-- Run after 11_booking_rls_recursion_repair.sql in the Supabase SQL Editor.
-- This migration is idempotent and does not modify existing instruction data.

begin;

-- Keep the booking ownership lookup outside RLS evaluation. Providers may read
-- instructions only after a booking exists for the same event and service.
create or replace function public.can_provider_view_instruction(
  target_event_id uuid,
  target_provider_id uuid,
  target_service_id uuid
)
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
      and (
        target_provider_id is null
        or bookings.provider_id = target_provider_id
      )
      and (
        target_service_id is null
        or bookings.service_id = target_service_id
      )
  );
$$;

revoke all on function public.can_provider_view_instruction(uuid, uuid, uuid) from public;
grant execute on function public.can_provider_view_instruction(uuid, uuid, uuid) to authenticated;

drop policy if exists "Booking providers can view relevant instructions"
  on public.event_provider_instructions;
create policy "Booking providers can view relevant instructions"
  on public.event_provider_instructions for select to authenticated
  using (
    public.can_provider_view_instruction(event_id, provider_id, service_id)
  );

commit;
