-- V23: provider-owned branding media. Nullable fields preserve all existing provider profiles.
alter table public.provider_profiles
  add column if not exists business_logo_url text,
  add column if not exists business_cover_url text;

comment on column public.provider_profiles.business_logo_url is
  'Public URL for the provider-owned business logo stored in profile-photos.';

comment on column public.provider_profiles.business_cover_url is
  'Public URL for the provider-owned business cover image stored in profile-photos.';
