-- V20 Phase 11: a user may hide Inbox items without deleting shared history.

begin;

create table if not exists public.user_inbox_item_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('conversation', 'message', 'notification')),
  item_id uuid not null,
  trashed_at timestamptz,
  permanently_hidden_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id),
  check (permanently_hidden_at is null or trashed_at is null)
);

create index if not exists user_inbox_item_states_visible_idx
  on public.user_inbox_item_states (user_id, item_type, trashed_at)
  where permanently_hidden_at is null;

alter table public.user_inbox_item_states enable row level security;

drop policy if exists "Users view their Inbox item state" on public.user_inbox_item_states;
create policy "Users view their Inbox item state"
  on public.user_inbox_item_states for select to authenticated
  using (user_id = auth.uid());

revoke insert, update, delete on table public.user_inbox_item_states from public, anon, authenticated;
grant select on table public.user_inbox_item_states to authenticated;

create or replace function public.move_my_inbox_items_to_trash(
  target_item_type text,
  target_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to manage Inbox items.' using errcode = '42501';
  end if;
  if target_item_type not in ('conversation', 'message', 'notification')
    or coalesce(cardinality(target_item_ids), 0) = 0
    or cardinality(target_item_ids) > 100 then
    raise exception 'Choose between 1 and 100 valid Inbox items.' using errcode = '22023';
  end if;

  if target_item_type = 'conversation' and exists (
    select 1 from unnest(target_item_ids) item_id
    where not public.can_view_booking_conversation(item_id)
  ) then
    raise exception 'One or more conversations are not available to your account.' using errcode = '42501';
  end if;
  if target_item_type = 'message' and exists (
    select 1 from unnest(target_item_ids) item_id
    where not exists (
      select 1 from public.messages message
      where message.id = item_id
        and public.can_view_booking_conversation(message.conversation_id)
    )
  ) then
    raise exception 'One or more messages are not available to your account.' using errcode = '42501';
  end if;
  if target_item_type = 'notification' and exists (
    select 1 from unnest(target_item_ids) item_id
    where not exists (
      select 1 from public.notifications notification
      where notification.id = item_id and notification.user_id = auth.uid()
    )
  ) then
    raise exception 'One or more notifications are not available to your account.' using errcode = '42501';
  end if;

  insert into public.user_inbox_item_states (user_id, item_type, item_id, trashed_at, permanently_hidden_at, updated_at)
  select auth.uid(), target_item_type, item_id, now(), null, now()
  from unnest(target_item_ids) item_id
  on conflict (user_id, item_type, item_id) do update
  set trashed_at = now(),
      updated_at = now()
  where user_inbox_item_states.permanently_hidden_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.restore_my_inbox_items(
  target_item_type text,
  target_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in to manage Inbox items.' using errcode = '42501'; end if;
  if target_item_type not in ('conversation', 'message', 'notification')
    or coalesce(cardinality(target_item_ids), 0) = 0
    or cardinality(target_item_ids) > 100 then
    raise exception 'Choose between 1 and 100 valid Inbox items.' using errcode = '22023';
  end if;

  update public.user_inbox_item_states
  set trashed_at = null, updated_at = now()
  where user_id = auth.uid()
    and item_type = target_item_type
    and item_id = any(target_item_ids)
    and trashed_at is not null
    and permanently_hidden_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.clear_my_inbox_items(
  target_item_type text,
  target_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in to manage Inbox items.' using errcode = '42501'; end if;
  if target_item_type not in ('conversation', 'message', 'notification')
    or coalesce(cardinality(target_item_ids), 0) = 0
    or cardinality(target_item_ids) > 100 then
    raise exception 'Choose between 1 and 100 valid Inbox items.' using errcode = '22023';
  end if;

  update public.user_inbox_item_states
  set trashed_at = null, permanently_hidden_at = now(), updated_at = now()
  where user_id = auth.uid()
    and item_type = target_item_type
    and item_id = any(target_item_ids)
    and trashed_at is not null
    and permanently_hidden_at is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.move_my_inbox_items_to_trash(text, uuid[]) from public, anon;
revoke all on function public.restore_my_inbox_items(text, uuid[]) from public, anon;
revoke all on function public.clear_my_inbox_items(text, uuid[]) from public, anon;
grant execute on function public.move_my_inbox_items_to_trash(text, uuid[]) to authenticated;
grant execute on function public.restore_my_inbox_items(text, uuid[]) to authenticated;
grant execute on function public.clear_my_inbox_items(text, uuid[]) to authenticated;

commit;
