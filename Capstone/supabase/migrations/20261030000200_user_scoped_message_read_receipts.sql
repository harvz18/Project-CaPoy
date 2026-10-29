-- V20 Phase 10: inbox read state must belong to the user who read it.
-- messages.read_at is retained for historical sender delivery presentation;
-- unread counts now use these per-user receipts.

begin;

create table if not exists public.message_read_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_read_receipts_user_message_idx
  on public.message_read_receipts (user_id, message_id);

-- Existing read_at had no reader identity. Preserve its historic behavior by
-- making its already-read incoming messages read for every prior recipient;
-- all reads recorded after this migration are exact to one user.
insert into public.message_read_receipts (message_id, user_id, read_at)
select message.id, participant.user_id, coalesce(message.read_at, now())
from public.messages message
join public.conversation_participants participant
  on participant.conversation_id = message.conversation_id
where message.read_at is not null
  and participant.user_id <> message.sender_id
on conflict (message_id, user_id) do nothing;

alter table public.message_read_receipts enable row level security;

drop policy if exists "Users view their message read receipts" on public.message_read_receipts;
create policy "Users view their message read receipts"
  on public.message_read_receipts for select to authenticated
  using (user_id = auth.uid());

-- The established read RPC below is the only mutation path. It derives the
-- recipient from auth.uid() and the conversation from server authorization.
revoke insert, update, delete on table public.message_read_receipts from public, anon, authenticated;
grant select on table public.message_read_receipts to authenticated;

create or replace function public.mark_booking_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if not public.can_view_booking_conversation(target_conversation_id) then
    raise exception 'This conversation is not available to your account.' using errcode = '42501';
  end if;

  with inserted_receipts as (
    insert into public.message_read_receipts (message_id, user_id)
    select message.id, auth.uid()
    from public.messages message
    where message.conversation_id = target_conversation_id
      and message.sender_id <> auth.uid()
    on conflict (message_id, user_id) do nothing
    returning 1
  )
  select count(*) into updated_count from inserted_receipts;

  -- Keep the existing sender-facing delivery marker without using it to
  -- calculate another participant's unread count.
  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = target_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;

  return updated_count;
end;
$$;

revoke all on function public.mark_booking_conversation_read(uuid) from public, anon;
grant execute on function public.mark_booking_conversation_read(uuid) to authenticated;

commit;
