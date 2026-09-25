-- Coordinator lifecycle cleanup, dedicated instructions, and verified reviews.
-- Apply after 28_coordinator_assignment_confirmation.sql.

begin;

create table if not exists public.event_coordinator_instructions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_coordinator_instructions_status_check
    check (status in ('saved', 'archived')),
  constraint event_coordinator_instructions_body_check
    check (char_length(coalesce(body, '')) <= 4000)
);

create index if not exists event_coordinator_instructions_event_idx
  on public.event_coordinator_instructions (event_id, coordinator_id, created_at);

alter table public.event_coordinator_instructions enable row level security;

drop policy if exists "Clients manage coordinator instructions"
  on public.event_coordinator_instructions;
create policy "Clients manage coordinator instructions"
  on public.event_coordinator_instructions for all to authenticated
  using (
    exists (
      select 1 from public.events event
      where event.id = event_coordinator_instructions.event_id
        and event.client_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events event
      where event.id = event_coordinator_instructions.event_id
        and event.client_id = auth.uid()
        and event_coordinator_instructions.coordinator_id in (
          event.coordinator_id,
          event.pending_coordinator_id
        )
    )
  );

drop policy if exists "Accepted coordinators view their instructions"
  on public.event_coordinator_instructions;
create policy "Accepted coordinators view their instructions"
  on public.event_coordinator_instructions for select to authenticated
  using (
    coordinator_id = auth.uid()
    and exists (
      select 1 from public.events event
      where event.id = event_coordinator_instructions.event_id
        and event.coordinator_id = auth.uid()
        and event.coordinator_assignment_status = 'accepted'
        and event.status <> 'cancelled'
    )
  );

grant select, insert, update, delete on table public.event_coordinator_instructions to authenticated;

create table if not exists public.coordinator_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coordinator_reviews_comment_check
    check (char_length(coalesce(comment, '')) <= 4000),
  constraint coordinator_reviews_event_unique
    unique (event_id, coordinator_id, reviewer_id)
);

create index if not exists coordinator_reviews_coordinator_created_idx
  on public.coordinator_reviews (coordinator_id, created_at desc);

alter table public.coordinator_reviews enable row level security;

drop policy if exists "Authenticated users view coordinator reviews"
  on public.coordinator_reviews;
create policy "Authenticated users view coordinator reviews"
  on public.coordinator_reviews for select to authenticated
  using (true);

revoke insert, update, delete on table public.coordinator_reviews from authenticated;
grant select on table public.coordinator_reviews to authenticated;

-- Repair events cancelled before this migration, when only their bookings were
-- cancelled and coordinator access was accidentally left in place.
with stale_event as materialized (
  select
    event.id,
    event.name,
    event.coordinator_id,
    event.pending_coordinator_id
  from public.events event
  where event.status not in ('completed', 'cancelled')
    and exists (
      select 1 from public.audit_logs audit
      where audit.resource_type = 'event'
        and audit.resource_id = event.id
        and audit.actor_id = event.client_id
        and audit.actor_role = 'client'
        and audit.action = 'booking.cancel'
        and audit.result = 'success'
    )
    and exists (
      select 1 from public.bookings booking
      where booking.event_id = event.id
        and booking.status = 'cancelled'
    )
    and not exists (
      select 1 from public.bookings booking
      where booking.event_id = event.id
        and booking.status not in ('rejected', 'cancelled', 'expired')
    )
), repaired_event as (
  update public.events event
  set
    status = 'cancelled',
    coordinator_id = null,
    pending_coordinator_id = null,
    coordinator_assignment_status = null,
    coordinator_assignment_requested_at = null,
    coordinator_assignment_responded_at = null,
    updated_at = now()
  from stale_event
  where event.id = stale_event.id
  returning stale_event.*
)
insert into public.notifications (user_id, title, body, resource_type, resource_id)
select distinct
  recipient.user_id,
  'Assigned event cancelled',
  format('%s was cancelled and removed from your coordinator workspace.', repaired_event.name),
  'event',
  repaired_event.id
from repaired_event
cross join lateral (
  values
    (repaired_event.coordinator_id),
    (repaired_event.pending_coordinator_id)
) recipient(user_id)
where recipient.user_id is not null;

create or replace function public.get_my_coordinator_instructions()
returns table (
  id uuid,
  event_id uuid,
  title text,
  body text,
  tags jsonb,
  status text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    instruction.id,
    instruction.event_id,
    instruction.title,
    instruction.body,
    instruction.tags,
    instruction.status,
    instruction.created_at
  from public.event_coordinator_instructions instruction
  join public.events event on event.id = instruction.event_id
  where auth.uid() is not null
    and instruction.coordinator_id = auth.uid()
    and instruction.status = 'saved'
    and event.coordinator_id = auth.uid()
    and event.coordinator_assignment_status = 'accepted'
    and event.status <> 'cancelled'
  order by instruction.created_at;
$$;

create or replace function public.list_event_coordinator_review_data()
returns table (
  coordinator_id uuid,
  average_rating numeric,
  review_count bigint,
  reviews jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    coordinator.id as coordinator_id,
    coalesce(round(avg(review.rating)::numeric, 1), 0) as average_rating,
    count(review.id) as review_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', review.id,
          'rating', review.rating,
          'comment', review.comment,
          'created_at', review.created_at,
          'event_type', event.event_type
        ) order by review.created_at desc
      ) filter (where review.id is not null),
      '[]'::jsonb
    ) as reviews
  from public.profiles coordinator
  left join public.coordinator_reviews review on review.coordinator_id = coordinator.id
  left join public.events event on event.id = review.event_id
  where auth.uid() is not null
    and coordinator.account_status = 'active'
    and (
      coordinator.default_role = 'event_coordinator'
      or exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = coordinator.id
          and role.name = 'event_coordinator'
      )
    )
  group by coordinator.id;
$$;

create or replace function public.submit_event_feedback_v2(
  target_event_id uuid,
  service_reviews jsonb,
  coordinator_rating integer default null,
  coordinator_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events%rowtype;
  service_result jsonb;
  coordinator_review_id uuid;
  clean_comment text := nullif(trim(coordinator_comment), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = current_user_id
    and event.status = 'completed'
  for update;

  if event_row.id is null then
    raise exception 'Feedback opens after every provider marks the event finished.';
  end if;

  if event_row.coordinator_id is not null then
    if coordinator_rating is null or coordinator_rating not between 1 and 5 then
      raise exception 'Rate the event coordinator from 1 to 5 stars.';
    end if;
    if char_length(coalesce(clean_comment, '')) > 4000 then
      raise exception 'Coordinator feedback cannot exceed 4000 characters.';
    end if;
  end if;

  service_result := public.submit_event_service_feedback(target_event_id, service_reviews);

  if event_row.coordinator_id is not null then
    insert into public.coordinator_reviews (
      event_id,
      coordinator_id,
      reviewer_id,
      rating,
      comment
    ) values (
      event_row.id,
      event_row.coordinator_id,
      current_user_id,
      coordinator_rating,
      clean_comment
    )
    returning id into coordinator_review_id;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.coordinator_id,
      'New coordinator review',
      format('A client left a %s-star review for coordinating %s.', coordinator_rating, event_row.name),
      'review',
      coordinator_review_id
    );
  end if;

  return service_result || jsonb_build_object('coordinator_review_id', coordinator_review_id);
exception
  when unique_violation then
    raise exception 'Feedback has already been submitted for this event.';
end;
$$;

create or replace function public.cancel_client_event_bookings(
  target_event_id uuid,
  cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.events%rowtype;
  booking_row record;
  cancelled_count integer := 0;
  clean_reason text := nullif(left(trim(cancellation_reason), 500), '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select events.* into event_row
  from public.events
  where events.id = target_event_id
    and events.client_id = current_user_id
    and events.status not in ('completed', 'cancelled')
  for update;

  if event_row.id is null then
    raise exception 'This event is not available for cancellation.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.bookings
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status = 'completed'
  ) then
    raise exception 'A completed service cannot be cancelled.';
  end if;

  for booking_row in
    select
      bookings.id,
      coalesce(services.name, 'service') as service_name,
      provider_profiles.user_id as provider_user_id
    from public.bookings
    join public.provider_profiles on provider_profiles.id = bookings.provider_id
    left join public.services on services.id = bookings.service_id
    where bookings.event_id = event_row.id
      and bookings.client_id = current_user_id
      and bookings.status in ('requested', 'approved', 'payment_required', 'paid', 'confirmed')
    for update of bookings
  loop
    update public.bookings
    set status = 'cancelled', updated_at = now()
    where id = booking_row.id;

    cancelled_count := cancelled_count + 1;

    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      booking_row.provider_user_id,
      'Booking cancelled by client',
      format(
        'The client cancelled %s for %s.%s',
        booking_row.service_name,
        coalesce(nullif(trim(event_row.name), ''), 'their event'),
        case when clean_reason is null then '' else format(' Reason: %s', clean_reason) end
      ),
      'booking',
      booking_row.id
    );
  end loop;

  if cancelled_count = 0 then
    raise exception 'No active provider bookings are available to cancel.';
  end if;

  update public.events
  set
    status = 'cancelled',
    coordinator_id = null,
    pending_coordinator_id = null,
    coordinator_assignment_status = null,
    coordinator_assignment_requested_at = null,
    coordinator_assignment_responded_at = null,
    updated_at = now()
  where id = event_row.id;

  if event_row.coordinator_id is not null then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.coordinator_id,
      'Assigned event cancelled',
      format('The client cancelled %s. It was removed from your coordinator workspace.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  if event_row.pending_coordinator_id is not null
    and event_row.pending_coordinator_id is distinct from event_row.coordinator_id
  then
    insert into public.notifications (user_id, title, body, resource_type, resource_id)
    values (
      event_row.pending_coordinator_id,
      'Event invitation cancelled',
      format('The client cancelled %s, so its coordinator invitation is no longer available.', event_row.name),
      'event',
      event_row.id
    );
  end if;

  delete from public.event_schedule_checks where event_id = event_row.id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    current_user_id,
    'client',
    'booking.cancel',
    'event',
    event_row.id,
    jsonb_build_object(
      'status', event_row.status,
      'coordinator_id', event_row.coordinator_id,
      'pending_coordinator_id', event_row.pending_coordinator_id
    ),
    jsonb_build_object('status', 'cancelled', 'cancelled_booking_count', cancelled_count),
    'success',
    jsonb_build_object('reason', clean_reason)
  );

  return jsonb_build_object(
    'event_id', event_row.id,
    'cancelled_booking_count', cancelled_count,
    'coordinator_released', event_row.coordinator_id is not null
  );
end;
$$;

revoke all on function public.get_my_coordinator_instructions() from public;
revoke all on function public.list_event_coordinator_review_data() from public;
revoke all on function public.submit_event_feedback_v2(uuid, jsonb, integer, text) from public;
revoke all on function public.cancel_client_event_bookings(uuid, text) from public;

grant execute on function public.get_my_coordinator_instructions() to authenticated;
grant execute on function public.list_event_coordinator_review_data() to authenticated;
grant execute on function public.submit_event_feedback_v2(uuid, jsonb, integer, text) to authenticated;
grant execute on function public.cancel_client_event_bookings(uuid, text) to authenticated;

commit;
