-- Preserve all provider-entered listing details for the client marketplace.
-- Additive and safe for existing services; no rows or columns are removed.

alter table public.services
  add column if not exists gallery_urls jsonb not null default '[]'::jsonb,
  add column if not exists pricing_model text,
  add column if not exists pricing_unit text,
  add column if not exists pricing_details text;

alter table public.service_packages
  add column if not exists pricing_unit text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'services_pricing_model_check'
  ) then
    alter table public.services
      add constraint services_pricing_model_check
      check (pricing_model is null or pricing_model in ('fixed', 'startingAt', 'customQuote'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'services_pricing_unit_check'
  ) then
    alter table public.services
      add constraint services_pricing_unit_check
      check (pricing_unit is null or pricing_unit in ('event', 'person', 'hour', 'day'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_packages_pricing_unit_check'
  ) then
    alter table public.service_packages
      add constraint service_packages_pricing_unit_check
      check (pricing_unit is null or pricing_unit in ('event', 'person', 'hour', 'day'));
  end if;
end
$$;

comment on column public.services.gallery_urls is
  'Public photo URLs uploaded by the service provider, ordered with the cover image first.';
comment on column public.services.pricing_model is
  'Provider-selected pricing model: fixed, startingAt, or customQuote.';
comment on column public.services.pricing_unit is
  'Provider-selected pricing unit: event, person, hour, or day.';
comment on column public.services.pricing_details is
  'Additional pricing explanation entered by the provider.';
comment on column public.service_packages.pricing_unit is
  'Package pricing unit: event, person, hour, or day.';
