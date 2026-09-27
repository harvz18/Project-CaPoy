-- MULTIVENT account adjustment: authenticated profile-photo uploads.
-- Apply after 43_event_remittance_notifications.sql.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public profile photos are readable" on storage.objects;
create policy "Public profile photos are readable"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');

drop policy if exists "Users upload owned profile photos" on storage.objects;
create policy "Users upload owned profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update owned profile photos" on storage.objects;
create policy "Users update owned profile photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete owned profile photos" on storage.objects;
create policy "Users delete owned profile photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on column public.profiles.avatar_url is
  'Public URL of the account-owned image stored in the profile-photos bucket.';

commit;
