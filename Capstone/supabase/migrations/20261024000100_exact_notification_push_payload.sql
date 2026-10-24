-- MULTIVENT mobile push delivery: show the same text as the in-app notification.
--
-- The notifications table remains the source of truth. This only changes the
-- user-visible Expo alert from a generic wake-up message to the notification's
-- existing title and body, and keeps the existing route metadata for taps.

begin;

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
          'title', coalesce(nullif(btrim(new.title), ''), 'MULTIVENT'),
          'body', coalesce(nullif(btrim(new.body), ''), 'You have a new notification.'),
          'sound', 'default',
          'priority', 'high',
          'channelId', 'multivent-updates',
          'badge', unread_total,
          'data', jsonb_strip_nulls(jsonb_build_object(
            'notificationId', new.id::text,
            'resourceId', new.resource_id::text,
            'resourceType', new.resource_type
          ))
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

comment on function public.dispatch_mobile_push_notification() is
  'Trigger-only Expo dispatcher that delivers each stored notification title, body, and route metadata.';

commit;
