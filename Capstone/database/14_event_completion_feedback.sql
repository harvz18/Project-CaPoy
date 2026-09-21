-- MULTIVENT event completion and overall-experience feedback.
-- Run after 13_real_schedule_check.sql in the Supabase SQL Editor.
-- The analysis columns are intentionally reserved for the future LDA/RAG pipeline.

begin;

create table if not exists public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  overall_comment text not null,
  analysis_status text not null default 'pending',
  sentiment_label text,
  sentiment_score numeric,
  topic_assignments jsonb not null default '[]'::jsonb,
  analysis_metadata jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_feedback_one_per_event unique (event_id),
  constraint event_feedback_comment_length
    check (char_length(trim(overall_comment)) between 10 and 4000),
  constraint event_feedback_analysis_status_check
    check (analysis_status in ('pending', 'processing', 'processed', 'failed')),
  constraint event_feedback_sentiment_score_check
    check (sentiment_score is null or sentiment_score between -1 and 1)
);

create index if not exists event_feedback_client_created_idx
  on public.event_feedback (client_id, created_at desc);
create index if not exists event_feedback_analysis_queue_idx
  on public.event_feedback (analysis_status, created_at);

alter table public.event_feedback enable row level security;
grant select, insert on table public.event_feedback to authenticated;

drop policy if exists "Clients can view owned event feedback" on public.event_feedback;
create policy "Clients can view owned event feedback"
  on public.event_feedback for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Clients can submit completed event feedback" on public.event_feedback;
create policy "Clients can submit completed event feedback"
  on public.event_feedback for insert to authenticated
  with check (
    client_id = auth.uid()
    and analysis_status = 'pending'
    and exists (
      select 1
      from public.events
      where events.id = event_feedback.event_id
        and events.client_id = auth.uid()
        and events.status = 'completed'
    )
  );

-- Keep private selections and the event-level lifecycle synchronized with every
-- provider booking. An event is completed only when every active provider has
-- marked their own booking completed.
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
  all_active_bookings_completed boolean;
begin
  selection_status := case
    when new.status in ('confirmed', 'completed') then 'confirmed'
    when new.status in ('rejected', 'expired') then 'declined'
    when new.status = 'cancelled' then 'cancelled'
    when new.status = 'payment_required' then 'selected'
    else 'requested'
  end;

  update public.event_service_selections
  set status = selection_status, updated_at = now()
  where event_id = new.event_id
    and client_id = new.client_id
    and provider_id = new.provider_id
    and service_id = new.service_id;

  select
    count(*) > 0,
    count(*) > 0 and bool_and(status in ('confirmed', 'completed')),
    count(*) > 0 and bool_and(status = 'completed')
  into
    has_active_bookings,
    all_active_bookings_confirmed,
    all_active_bookings_completed
  from public.bookings
  where event_id = new.event_id
    and status not in ('payment_required', 'rejected', 'cancelled', 'expired');

  update public.events
  set
    status = case
      when has_active_bookings and all_active_bookings_completed
        then 'completed'::public.event_status
      when has_active_bookings and all_active_bookings_confirmed
        then 'confirmed'::public.event_status
      when has_active_bookings then 'booking'::public.event_status
      else 'planning'::public.event_status
    end,
    updated_at = now()
  where id = new.event_id;

  return new;
end;
$$;

revoke all on function public.sync_event_booking_progress() from public;

create or replace function public.mark_provider_booking_completed(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_booking public.bookings%rowtype;
  target_event public.events%rowtype;
  service_name text;
  event_is_complete boolean;
begin
  select bookings.*
  into target_booking
  from public.bookings
  join public.provider_profiles
    on provider_profiles.id = bookings.provider_id
  where bookings.id = target_booking_id
    and provider_profiles.user_id = auth.uid()
  for update of bookings;

  if target_booking.id is null then
    raise exception 'Booking not found for this service-provider account.';
  end if;

  if target_booking.status = 'completed' then
    select status = 'completed'
    into event_is_complete
    from public.events
    where id = target_booking.event_id;

    return jsonb_build_object(
      'booking_id', target_booking.id,
      'event_id', target_booking.event_id,
      'event_completed', coalesce(event_is_complete, false)
    );
  end if;

  if target_booking.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be marked completed.';
  end if;

  select * into target_event
  from public.events
  where id = target_booking.event_id;

  if target_event.event_date is null
    or target_event.event_date > (now() at time zone 'Asia/Manila')::date then
    raise exception 'This booking can be completed on or after the event date.';
  end if;

  update public.bookings
  set status = 'completed', updated_at = now()
  where id = target_booking.id;

  select name into service_name
  from public.services
  where id = target_booking.service_id;

  select
    count(*) > 0 and bool_and(status = 'completed')
  into event_is_complete
  from public.bookings
  where event_id = target_booking.event_id
    and status not in ('payment_required', 'rejected', 'cancelled', 'expired');

  insert into public.notifications (
    user_id,
    title,
    body,
    resource_type,
    resource_id
  ) values (
    target_booking.client_id,
    'Service marked finished',
    coalesce(service_name, 'A service provider') ||
      ' marked their part of ' || target_event.name || ' as finished.',
    'booking',
    target_booking.id
  );

  if event_is_complete then
    update public.events
    set status = 'completed', updated_at = now()
    where id = target_booking.event_id;

    insert into public.notifications (
      user_id,
      title,
      body,
      resource_type,
      resource_id
    ) values (
      target_booking.client_id,
      'Your event is complete',
      'All providers marked ' || target_event.name ||
        ' as finished. You can now share your overall event experience.',
      'booking',
      target_booking.event_id
    );
  end if;

  return jsonb_build_object(
    'booking_id', target_booking.id,
    'event_id', target_booking.event_id,
    'event_completed', event_is_complete
  );
end;
$$;

revoke all on function public.mark_provider_booking_completed(uuid) from public;
grant execute on function public.mark_provider_booking_completed(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_feedback'
  ) then
    alter publication supabase_realtime add table public.event_feedback;
  end if;
end;
$$;

commit;
