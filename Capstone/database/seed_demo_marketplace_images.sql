-- MULTIVENT demo marketplace image follow-up
-- Prerequisite: run seed_demo_marketplace.sql first.
-- Run manually in the Supabase SQL editor. This updates only the 40
-- deterministic demo services created by that seed.
--
-- The images are remote demo assets. An internet connection is required when
-- the app renders them. No Supabase Storage objects or production listings are
-- created, replaced, or removed by this script.

begin;

-- Image fields are material listing data, so provider edits normally return an
-- active service to review. This transaction-local service-role claim lets the
-- seed add presentation data without changing moderation state.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
begin
  if to_regclass('public.services') is null then
    raise exception 'public.services is missing. Apply the MULTIVENT schema before this image seed.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'cover_image_url'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'gallery_urls'
  ) then
    raise exception 'public.services image columns are missing.';
  end if;
end;
$$;

create temporary table multivent_demo_image_library (
  category_key text primary key,
  image_urls text[] not null check (cardinality(image_urls) = 3)
) on commit drop;

insert into multivent_demo_image_library (category_key, image_urls) values
  ('attire', array[
    'https://images.unsplash.com/photo-1681714552617-fe3f4cf4be47?auto=format&fit=crop&w=1600&q=82',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAhOaMh7guHQRWcfJIcC56siy1CyThxFOSx7dyWh6AG-8PBqlKc_xoyX4MNRQVGxsTqI07SOOqSaAnPWyVfEsezhn5jGDzCSTrzP_KJPf53_4p93_h9ts4yBdtN6F_tO0EVIbisbn1TP21WJfuejQfbwEdWpEfNOPgr05R1vgUpl3-V2AJGmrxpqa8-KBWVbeiEDX4tAZyKo_8wc8RenWMhdYYFDzG3LsMBuKHMI2BDyqI8ih3zj7PzpA',
    'https://images.unsplash.com/photo-1632729331892-b318f62e4e72?auto=format&fit=crop&w=1600&q=82'
  ]),
  ('florists', array[
    'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=82',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAH1yFzMAgyLMN3JORx0DhYQQHFPAj422xzhrcKK6ChdPV6dm_0wrP_oDl9Wud3F6Ws72Z-cBpgyhY3teVPnpIQ2mgHrAh8W7sbZFz1FvzOb0sToO6FYRkDzvJB037uXyVHbTxArwHfkBN0XhoukCrPF-DmsRz4omO01orqJavqAoODiqwA0700gcX3zQfZI7gO7BXFuzIm6nPgFD4OOmQtKbqUJv7lmlIctJHEKtKFKCsLyttn0ZENJw',
    'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=82'
  ]),
  ('catering', array[
    'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1600&q=82',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBYIJtkALd6RZTKB793xTml6IliaeOS--YYb7nCOzBNZjzLtFYVWDdwGKaNi_mPRU62Wt5FYlQiePs93otpMlHT0Cz38RzlC3d9uE8YLt3QHL0UWZ7LIyp0KbmD3L_znUY9EmN9hQoR9B-lx0V67uiTAq-5yHzAUzVJILN2SSFLN5UQDT31rxBkUe0QDWuduZxbSt5LwtlVMwM8oiRRG1sicxmtQsmkFYNBkOwC-pbg7kcLpd-My6m3eg',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuABeTfkfDgOw5Bxt9ZfSrVxhbQd7U7OOPzU9yTO2su3aiwKbo-UoDS6t9jfg_200Gn1niFd-HTSGYxeygTBUkFi_VnqB6CYADVUtghQ1V7YDj8fHUOcUP26I46vVMNgiEv_wfyCQtETB-3ErjbrwUIF0ZeWzxZ76uorYxSfYy8tNkiG034cK_7sUVP1wBK7wwnhvGJ-R8cMSwDPQ74NaxzfQzG-FdOx2KUx-6YcD9FdiV1rhUeBLAwKLA'
  ]),
  ('venues', array[
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDcsG3q-fnP7YT8BoefsbQp-dsyHueshrdXDPYVSU30cc0CKsPEoEyrH7kqGV-DHCjy-dWdlW-hkOAzVwebQlrBC-0QcKZveHZHG8ljzAb5mXvNzyarrJSPRz7DRuvSol4tTtG2lObMjjD0sFK4-bJQLpGtO9R6vQjYZ3F3Bj4WMZwGY-N02BIvNED-SWAYXTHOYdIHw36Hvs_ibLOOujMX9mMhBGBSixszIl93YxJ0i_vTgECOmmZuLA',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuACgPKY6101R5Tt8wM3MANys6BhdJIdq1lEXymw2shJq516w4JybVe1vBAbZ7aeMfuHHry13Yy3fmt7tA6qoTOtxueyxdpuKDui18IO8ECZIIJDVrFCmgAc0gpyyGkCBLHu2IolGWZWlWnprUVbJSXFDDyy2ef5ck9w5VW_KXkT9bKfW_UN8lPym799buuDLFhshrnkD-PLqLFWvxmrVNLyb15lTaySHkXVDvJJMrTu9lb-ianLsojffw'
  ]),
  ('event_organizer', array[
    'https://images.unsplash.com/photo-1653821355736-0c2598d0a63e?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1600&q=82'
  ]),
  ('sound_lights', array[
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1670028514318-0ac718c0590d?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1600&q=82'
  ]),
  ('photography', array[
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=82',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC1ZIU6o-m0q6y4T4wQeXMLmoVAc9EZd1FfTiE46IJoR0_bz8RlR8qnb1nLYsv4_DvPB8OXhCtl1G4smTBFdmVmEuBJygUFyWyvNZnosGFxZeIzBkbqPbK1SOaBwnGInYFTA-V6SQzBKx2Hc-C8OaWlWG1GYcQzVT2SmHohIQK0SKGBSWpZf6Ch89DCzz_o5Wv63pUYfqCrrdqTKteTCjJiReWnKIHkhMkLpH7p3GME5EZreXJOeg2oXQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAM9W82WCl23k2o4k6YTzPQls2wvdD5QmVEV_CNbUrqcJN4hkSXgAaCe4WCwIpAQWsAEAcnYo_3XZqHY4KmnU4HEbf2ELXoKRPaDFooeL4Cu4IuaHk4_0DAwCh-yii_8j1GIsF9mQV3maGJ6oIdsX3RrOaUPLRUlP-TINybREUbIvO0p_ZeORHdxqvqVYFgC7_Ix2SIVeNwvzxTtpldCsOocgG6cLLjPsJv6o81qzwIUOG1i5OqrDs0aQ'
  ]),
  ('host_emcee', array[
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1770392735602-e22dff1b0fb8?auto=format&fit=crop&w=1600&q=82',
    'https://images.unsplash.com/photo-1786290552999-9a09f879691b?auto=format&fit=crop&w=1600&q=82'
  ]);

create temporary table multivent_demo_image_targets (
  service_id uuid primary key,
  category_key text not null references multivent_demo_image_library(category_key),
  expected_name text not null
) on commit drop;

insert into multivent_demo_image_targets (service_id, category_key, expected_name) values
  ('a1300000-0000-4000-8001-000000000001', 'attire', 'Heritage Filipiniana Bridal Collection'),
  ('a1300000-0000-4000-8001-000000000002', 'attire', 'Modern Piña Barong Ensemble'),
  ('a1300000-0000-4000-8001-000000000003', 'attire', 'Entourage Dress Color Collection'),
  ('a1300000-0000-4000-8001-000000000004', 'attire', 'Tailored Groom Suit Package'),
  ('a1300000-0000-4000-8001-000000000005', 'attire', 'Bespoke Garden Wedding Gown'),
  ('a1300000-0000-4000-8002-000000000001', 'florists', 'Soft Romance Bridal Bouquet'),
  ('a1300000-0000-4000-8002-000000000002', 'florists', 'Sunlit Ceremony Floral Styling'),
  ('a1300000-0000-4000-8002-000000000003', 'florists', 'Orchid Table Centerpiece Set'),
  ('a1300000-0000-4000-8002-000000000004', 'florists', 'Tropical Reception Bloomscape'),
  ('a1300000-0000-4000-8002-000000000005', 'florists', 'Complete Wedding Floral Story'),
  ('a1300000-0000-4000-8003-000000000001', 'catering', 'Negros Heritage Buffet'),
  ('a1300000-0000-4000-8003-000000000002', 'catering', 'Garden Wedding Plated Dinner'),
  ('a1300000-0000-4000-8003-000000000003', 'catering', 'Office Fiesta Packed Meals'),
  ('a1300000-0000-4000-8003-000000000004', 'catering', 'Celebration Food Station Market'),
  ('a1300000-0000-4000-8003-000000000005', 'catering', 'Sunset Cocktail Bites'),
  ('a1300000-0000-4000-8003-000000000006', 'catering', 'Sunday Family Table Feast'),
  ('a1300000-0000-4000-8004-000000000001', 'venues', 'Celestine Grand Ballroom'),
  ('a1300000-0000-4000-8004-000000000002', 'venues', 'Sidlak Flexible Function Rooms'),
  ('a1300000-0000-4000-8004-000000000003', 'venues', 'Casa Marisol Courtyard & Hall'),
  ('a1300000-0000-4000-8004-000000000004', 'venues', 'Hacienda Luntian Garden Pavilion'),
  ('a1300000-0000-4000-8004-000000000005', 'venues', 'Silay View Events Lodge'),
  ('a1300000-0000-4000-8004-000000000006', 'venues', 'North Grove Festival Lawn'),
  ('a1300000-0000-4000-8005-000000000001', 'event_organizer', 'Full Wedding Coordination with Mara'),
  ('a1300000-0000-4000-8005-000000000002', 'event_organizer', 'On-the-Day Social Event Coordination'),
  ('a1300000-0000-4000-8005-000000000003', 'event_organizer', 'Corporate Program Coordination'),
  ('a1300000-0000-4000-8005-000000000004', 'event_organizer', 'Debut & Milestone Coordination'),
  ('a1300000-0000-4000-8006-000000000001', 'sound_lights', 'Intimate Event Sound Package'),
  ('a1300000-0000-4000-8006-000000000002', 'sound_lights', 'Standard Wedding Sound & Lights'),
  ('a1300000-0000-4000-8006-000000000003', 'sound_lights', 'Outdoor Celebration Audio'),
  ('a1300000-0000-4000-8006-000000000004', 'sound_lights', 'Premium Stage & Lighting Production'),
  ('a1300000-0000-4000-8006-000000000005', 'sound_lights', 'LED Wall & Festival Production'),
  ('a1300000-0000-4000-8007-000000000001', 'photography', 'Essential Four-Hour Photo Coverage'),
  ('a1300000-0000-4000-8007-000000000002', 'photography', 'Golden Hour Six-Hour Story'),
  ('a1300000-0000-4000-8007-000000000003', 'photography', 'Wedding Story Photo + Film'),
  ('a1300000-0000-4000-8007-000000000004', 'photography', 'Cinematic Wedding Day Package'),
  ('a1300000-0000-4000-8007-000000000005', 'photography', 'Heirloom Full Event Collection'),
  ('a1300000-0000-4000-8008-000000000001', 'host_emcee', 'Elegant Wedding Hosting'),
  ('a1300000-0000-4000-8008-000000000002', 'host_emcee', 'Energetic Party Host'),
  ('a1300000-0000-4000-8008-000000000003', 'host_emcee', 'Corporate Program Emcee'),
  ('a1300000-0000-4000-8008-000000000004', 'host_emcee', 'Bilingual Debut & Wedding Host');

do $$
declare
  target_count integer;
  missing_or_changed text;
begin
  select count(*) into target_count from multivent_demo_image_targets;
  if target_count <> 40 then
    raise exception 'Image seed definition error: expected 40 targets, found %.', target_count;
  end if;

  select string_agg(
    format('%s (%s)', target.expected_name, target.service_id),
    '; ' order by target.expected_name
  )
  into missing_or_changed
  from multivent_demo_image_targets target
  left join public.services service on service.id = target.service_id
  where service.id is null or service.name <> target.expected_name;

  if missing_or_changed is not null then
    raise exception 'The demo service seed is missing or has conflicting IDs: %. No images were changed.',
      missing_or_changed;
  end if;
end;
$$;

-- Preserve the exact visibility/moderation state so the script can prove that
-- adding images did not accidentally publish, reject, or delete a listing.
create temporary table multivent_demo_image_state_before on commit drop as
select
  service.id,
  service.status,
  service.is_available,
  service.submission_kind,
  service.moderation_note,
  service.moderated_at,
  service.moderated_by
from public.services service
join multivent_demo_image_targets target on target.service_id = service.id;

with ranked_targets as (
  select
    target.service_id,
    library.image_urls,
    row_number() over (
      partition by target.category_key order by target.service_id
    )::integer as category_position
  from multivent_demo_image_targets target
  join multivent_demo_image_library library using (category_key)
), desired_images as (
  select
    service_id,
    image_urls[((category_position - 1) % cardinality(image_urls)) + 1] as cover_image_url,
    to_jsonb(image_urls) as gallery_urls
  from ranked_targets
)
update public.services service
set cover_image_url = desired.cover_image_url,
    gallery_urls = desired.gallery_urls,
    updated_at = now()
from desired_images desired
where service.id = desired.service_id
  and (
    service.cover_image_url is distinct from desired.cover_image_url
    or service.gallery_urls is distinct from desired.gallery_urls
  );

do $$
declare
  image_count integer;
begin
  select count(*)
  into image_count
  from public.services service
  join multivent_demo_image_targets target on target.service_id = service.id
  where service.cover_image_url ~ '^https://'
    and jsonb_typeof(service.gallery_urls) = 'array'
    and jsonb_array_length(service.gallery_urls) = 3
    and not exists (
      select 1
      from jsonb_array_elements_text(service.gallery_urls) image(url)
      where image.url !~ '^https://'
    );

  if image_count <> 40 then
    raise exception 'Image seed verification failed: expected 40 services with valid HTTPS cover/gallery data, found %.',
      image_count;
  end if;

  if exists (
    select 1
    from public.services service
    join multivent_demo_image_state_before before_state on before_state.id = service.id
    where service.status is distinct from before_state.status
      or service.is_available is distinct from before_state.is_available
      or service.submission_kind is distinct from before_state.submission_kind
      or service.moderation_note is distinct from before_state.moderation_note
      or service.moderated_at is distinct from before_state.moderated_at
      or service.moderated_by is distinct from before_state.moderated_by
  ) then
    raise exception 'Image seed verification failed: a listing moderation or visibility field changed. The transaction was rolled back.';
  end if;
end;
$$;

commit;

-- Expected result:
--   40 demo services with category-aligned cover images
--   3 gallery images per demo service
--   no changes to provider ownership, prices, availability, or moderation state
