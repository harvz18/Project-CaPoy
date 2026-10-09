-- MULTIVENT mobile session and push-notification support.
-- Apply after 62_dss_service_discovery.sql.

begin;

-- pg_net queues HTTPS requests and sends them only after the transaction
-- commits, so notification inserts are never blocked by the Expo Push API.
create extension if not exists pg_net;

create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null,
  device_name text,
  app_version text,
  is_enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_token_check check (
    expo_push_token ~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
  ),
  constraint user_push_tokens_platform_check check (platform in ('android', 'ios')),
  constraint user_push_tokens_device_name_check check (
    device_name is null or char_length(device_name) <= 160
  ),
  constraint user_push_tokens_app_version_check check (
    app_version is null or char_length(app_version) <= 50
  )
);

create index if not exists user_push_tokens_user_enabled_idx
  on public.user_push_tokens (user_id, is_enabled, last_registered_at desc);

alter table public.user_push_tokens enable row level security;

-- Keep the in-app notification center current while the app is open. The
-- guarded publication change is safe to rerun and leaves existing members
-- untouched.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

drop policy if exists "Users view own push registrations" on public.user_push_tokens;
create policy "Users view own push registrations"
  on public.user_push_tokens for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users remove own push registrations" on public.user_push_tokens;
create policy "Users remove own push registrations"
  on public.user_push_tokens for delete to authenticated
  using (user_id = auth.uid());

grant select, delete on public.user_push_tokens to authenticated;

-- Registration is server-controlled so a token can safely move to the most
-- recently authenticated account on a shared device.
create or replace function public.register_my_push_token(
  target_expo_push_token text,
  target_platform text,
  target_device_name text default null,
  target_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if target_expo_push_token is null
    or target_expo_push_token !~ '^(Expo|Exponent)PushToken\[[^]]+\]$'
  then
    raise exception 'A valid Expo push token is required.';
  end if;
  if target_platform not in ('android', 'ios') then
    raise exception 'Push platform must be android or ios.';
  end if;

  insert into public.user_push_tokens (
    user_id, expo_push_token, platform, device_name, app_version,
    is_enabled, last_registered_at, updated_at
  ) values (
    auth.uid(), target_expo_push_token, target_platform,
    nullif(left(trim(coalesce(target_device_name, '')), 160), ''),
    nullif(left(trim(coalesce(target_app_version, '')), 50), ''),
    true, now(), now()
  )
  on conflict (expo_push_token) do update set
    user_id = auth.uid(),
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    is_enabled = true,
    last_registered_at = now(),
    updated_at = now()
  returning id into saved_id;

  return saved_id;
end;
$$;

create or replace function public.revoke_my_push_token(
  target_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.user_push_tokens
  set is_enabled = false, updated_at = now()
  where user_id = auth.uid()
    and expo_push_token = target_expo_push_token;
end;
$$;

-- Every application notification remains the source of truth. This trigger
-- sends only a generic wake-up alert: event, booking, payment, message, and
-- user details remain in Supabase and are fetched after authenticated app
-- launch instead of being disclosed to the external push transport.
-- A delivery failure never rolls back the business transaction that created
-- the notification.
create or replace function public.dispatch_mobile_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  token_row record;
  unread_total integer;
begin
  select count(*)::integer into unread_total
  from public.notifications notification
  where notification.user_id = new.user_id
    and notification.status::text = 'unread';

  for token_row in
    select token.expo_push_token
    from public.user_push_tokens token
    where token.user_id = new.user_id
      and token.is_enabled = true
    order by token.last_registered_at desc
  loop
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object(
          'Accept', 'application/json',
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'to', token_row.expo_push_token,
          'title', 'MULTIVENT',
          'body', 'You have a new notification. Open MULTIVENT to view it.',
          'sound', 'default',
          'priority', 'high',
          'channelId', 'multivent-updates',
          'badge', unread_total
        ),
        timeout_milliseconds := 5000
      );
    exception when others then
      raise warning 'Unable to queue MULTIVENT push notification %: %', new.id, sqlerrm;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists dispatch_mobile_push_notification_trigger
  on public.notifications;
create trigger dispatch_mobile_push_notification_trigger
after insert on public.notifications
for each row execute function public.dispatch_mobile_push_notification();

revoke all on function public.register_my_push_token(text, text, text, text) from public;
revoke all on function public.revoke_my_push_token(text) from public;
revoke all on function public.dispatch_mobile_push_notification() from public;
grant execute on function public.register_my_push_token(text, text, text, text)
  to authenticated;
grant execute on function public.revoke_my_push_token(text) to authenticated;

comment on table public.user_push_tokens is
  'User-owned Expo push registrations. Tokens are disabled on explicit device logout.';
comment on function public.dispatch_mobile_push_notification() is
  'Sends a generic data-minimized alert to enabled Expo push tokens through pg_net.';

commit;
