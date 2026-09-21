-- MULTIVENT booking-system security and integrity policies.
-- Run after 01-05. This migration is idempotent and is intended for Supabase SQL Editor.

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

create or replace function public.is_booking_counterpart(target_user_id uuid)
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
    where (bookings.client_id = auth.uid() and provider_profiles.user_id = target_user_id)
       or (provider_profiles.user_id = auth.uid() and bookings.client_id = target_user_id)
  );
$$;

create or replace function public.can_view_provider_profile(target_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.provider_profiles
    where id = target_provider_id
      and user_id = auth.uid()
  )
  or exists (
    select 1
    from public.services
    where provider_id = target_provider_id
      and status = 'active'
  )
  or exists (
    select 1
    from public.bookings
    where provider_id = target_provider_id
      and client_id = auth.uid()
  );
$$;

create or replace function public.can_create_participant_notification(
  target_user_id uuid,
  target_resource_type text,
  target_resource_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_user_id = auth.uid() then
    return true;
  end if;

  if target_resource_type = 'booking' then
    return exists (
      select 1
      from public.bookings
      join public.provider_profiles on provider_profiles.id = bookings.provider_id
      where bookings.id = target_resource_id
        and (
          (bookings.client_id = auth.uid() and provider_profiles.user_id = target_user_id)
          or (provider_profiles.user_id = auth.uid() and bookings.client_id = target_user_id)
        )
    );
  end if;

  if target_resource_type = 'message' then
    return public.is_conversation_participant(target_resource_id)
      and exists (
        select 1 from public.conversation_participants
        where conversation_id = target_resource_id
          and user_id = target_user_id
      );
  end if;

  if target_resource_type = 'payment' then
    return exists (
      select 1
      from public.bookings
      join public.provider_profiles on provider_profiles.id = bookings.provider_id
      where bookings.event_id = target_resource_id
        and bookings.client_id = auth.uid()
        and provider_profiles.user_id = target_user_id
    );
  end if;

  if target_resource_type = 'review' then
    return exists (
      select 1
      from public.bookings
      join public.provider_profiles on provider_profiles.id = bookings.provider_id
      where bookings.id = target_resource_id
        and bookings.client_id = auth.uid()
        and provider_profiles.user_id = target_user_id
    );
  end if;

  return false;
end;
$$;

revoke all on function public.is_booking_counterpart(uuid) from public;
revoke all on function public.can_view_provider_profile(uuid) from public;
revoke all on function public.can_create_participant_notification(uuid, text, uuid) from public;
grant execute on function public.is_booking_counterpart(uuid) to authenticated;
grant execute on function public.can_view_provider_profile(uuid) to authenticated;
grant execute on function public.can_create_participant_notification(uuid, text, uuid) to authenticated;

create unique index if not exists bookings_one_active_request_per_service
  on public.bookings (event_id, client_id, provider_id, service_id)
  where status not in ('rejected', 'cancelled', 'expired');

create index if not exists messages_conversation_created_at_idx
  on public.messages (conversation_id, created_at);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_availability enable row level security;
alter table public.events enable row level security;
alter table public.event_requirements enable row level security;
alter table public.event_budget_items enable row level security;
alter table public.event_service_selections enable row level security;
alter table public.event_provider_instructions enable row level security;
alter table public.event_schedule_checks enable row level security;
alter table public.event_schedule_check_results enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.coordination_tasks enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.provider_operating_hours enable row level security;
alter table public.provider_notification_preferences enable row level security;
alter table public.provider_payout_requests enable row level security;
alter table public.provider_service_listing_drafts enable row level security;

drop policy if exists "Authenticated users can view booking counterpart profiles" on public.profiles;
create policy "Authenticated users can view booking counterpart profiles"
  on public.profiles for select to authenticated
  using (
    auth.uid() = id
    or public.is_booking_counterpart(id)
    or exists (
      select 1
      from public.conversation_participants mine
      join public.conversation_participants theirs
        on theirs.conversation_id = mine.conversation_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

drop policy if exists "Authenticated users can view marketplace providers" on public.provider_profiles;
create policy "Authenticated users can view marketplace providers"
  on public.provider_profiles for select to authenticated
  using (public.can_view_provider_profile(id));

drop policy if exists "Users can view booking-related availability" on public.provider_availability;
create policy "Users can view booking-related availability"
  on public.provider_availability for select to authenticated
  using (true);

drop policy if exists "Providers manage owned availability" on public.provider_availability;
create policy "Providers manage owned availability"
  on public.provider_availability for all to authenticated
  using (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_availability.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_availability.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Booking participants can view payments" on public.payments;
create policy "Booking participants can view payments"
  on public.payments for select to authenticated
  using (
    payer_id = auth.uid()
    or exists (
      select 1
      from public.bookings
      join public.provider_profiles
        on provider_profiles.id = bookings.provider_id
      where bookings.id = payments.booking_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Clients can create owned payments" on public.payments;
create policy "Clients can create owned payments"
  on public.payments for insert to authenticated
  with check (
    payer_id = auth.uid()
    and (
      exists (
        select 1 from public.bookings
        where bookings.id = payments.booking_id
          and bookings.client_id = auth.uid()
      )
      or exists (
        select 1 from public.events
        where events.id = payments.event_id
          and events.client_id = auth.uid()
      )
    )
  );

drop policy if exists "Booking participants can view conversations" on public.conversations;
create policy "Booking participants can view conversations"
  on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));

drop policy if exists "Booking participants can create conversations" on public.conversations;
create policy "Booking participants can create conversations"
  on public.conversations for insert to authenticated
  with check (
    exists (
      select 1
      from public.bookings
      join public.provider_profiles
        on provider_profiles.id = bookings.provider_id
      where bookings.id = conversations.booking_id
        and (
          bookings.client_id = auth.uid()
          or provider_profiles.user_id = auth.uid()
        )
    )
  );

drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update to authenticated
  using (public.is_conversation_participant(id))
  with check (public.is_conversation_participant(id));

drop policy if exists "Participants can view conversation memberships" on public.conversation_participants;
create policy "Participants can view conversation memberships"
  on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Booking participants can create conversation memberships" on public.conversation_participants;
create policy "Booking participants can create conversation memberships"
  on public.conversation_participants for insert to authenticated
  with check (
    exists (
      select 1
      from public.conversations
      join public.bookings on bookings.id = conversations.booking_id
      join public.provider_profiles on provider_profiles.id = bookings.provider_id
      where conversations.id = conversation_participants.conversation_id
        and (
          bookings.client_id = auth.uid()
          or provider_profiles.user_id = auth.uid()
        )
        and conversation_participants.user_id in (
          bookings.client_id,
          provider_profiles.user_id
        )
    )
  );

drop policy if exists "Participants can read messages" on public.messages;
create policy "Participants can read messages"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "Participants can mark received messages read" on public.messages;
create policy "Participants can mark received messages read"
  on public.messages for update to authenticated
  using (
    sender_id <> auth.uid()
    and public.is_conversation_participant(conversation_id)
  )
  with check (public.is_conversation_participant(conversation_id));

drop policy if exists "Users can view owned notifications" on public.notifications;
create policy "Users can view owned notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update owned notifications" on public.notifications;
create policy "Users can update owned notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Booking participants can create notifications" on public.notifications;
create policy "Booking participants can create notifications"
  on public.notifications for insert to authenticated
  with check (
    public.can_create_participant_notification(user_id, resource_type, resource_id)
  );

drop policy if exists "Published reviews are readable" on public.reviews;
create policy "Published reviews are readable"
  on public.reviews for select
  using (true);

drop policy if exists "Clients can review completed bookings" on public.reviews;
create policy "Clients can review completed bookings"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.bookings
      where bookings.id = reviews.booking_id
        and bookings.client_id = auth.uid()
        and bookings.provider_id = reviews.provider_id
        and bookings.status = 'completed'
    )
  );

drop policy if exists "Providers can view owned operating hours" on public.provider_operating_hours;
create policy "Providers can view owned operating hours"
  on public.provider_operating_hours for select to authenticated
  using (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_operating_hours.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers manage owned operating hours" on public.provider_operating_hours;
create policy "Providers manage owned operating hours"
  on public.provider_operating_hours for all to authenticated
  using (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_operating_hours.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_operating_hours.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

drop policy if exists "Providers manage owned notification preferences" on public.provider_notification_preferences;
create policy "Providers manage owned notification preferences"
  on public.provider_notification_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Providers manage owned payout requests" on public.provider_payout_requests;
create policy "Providers manage owned payout requests"
  on public.provider_payout_requests for all to authenticated
  using (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_payout_requests.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.provider_profiles
      where provider_profiles.id = provider_payout_requests.provider_id
        and provider_profiles.user_id = auth.uid()
    )
  );

-- Planning-detail tables follow ownership through their parent event/check.
drop policy if exists "Clients manage owned instructions" on public.event_provider_instructions;
create policy "Clients manage owned instructions"
  on public.event_provider_instructions for all to authenticated
  using (
    exists (
      select 1 from public.events
      where events.id = event_provider_instructions.event_id
        and events.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events
      where events.id = event_provider_instructions.event_id
        and events.client_id = auth.uid()
    )
  );

drop policy if exists "Clients manage owned schedule checks" on public.event_schedule_checks;
create policy "Clients manage owned schedule checks"
  on public.event_schedule_checks for all to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "Clients manage owned schedule results" on public.event_schedule_check_results;
create policy "Clients manage owned schedule results"
  on public.event_schedule_check_results for all to authenticated
  using (
    exists (
      select 1 from public.event_schedule_checks
      where event_schedule_checks.id = event_schedule_check_results.schedule_check_id
        and event_schedule_checks.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.event_schedule_checks
      where event_schedule_checks.id = event_schedule_check_results.schedule_check_id
        and event_schedule_checks.client_id = auth.uid()
    )
  );

-- Re-apply service listing policies after enabling the remaining tables.
-- The earlier 02 and 05 migrations continue to govern events, selections,
-- bookings, services, packages, and provider listing drafts.
