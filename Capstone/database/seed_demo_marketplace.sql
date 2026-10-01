-- MULTIVENT demo marketplace seed
-- Prerequisites: apply database migrations through 52_service_deletion_booking_history.sql.
-- Run manually in the Supabase SQL editor. This is seed data, not a migration.
--
-- The script is transactional and idempotent for its deterministic IDs. It
-- intentionally creates confirmed demo Auth users so the provider and
-- coordinator dashboards can be demonstrated. Never reuse these credentials
-- for production accounts.
--
-- Shared demo password: 12345678
--
-- provider1@multivent.com    Amara Thread & Form (Attire)
-- provider2@multivent.com    Petal & Stem Atelier (Florists)
-- provider3@multivent.com    Hearth & Harvest Events (Catering)
-- provider4@multivent.com    Isla Table Catering Co. (Catering)
-- provider5@multivent.com    Balay Sidlak Events Estate (Venues)
-- provider6@multivent.com    Verdant Horizon Venues (Venues)
-- provider7@multivent.com    Pulsecraft Event Production (Sound & Lights)
-- provider8@multivent.com    Lantern & Lens Studio (Photography)
-- provider9@multivent.com    Stage & Story Hosts (Host/Emcee)
-- coordinator1@multivent.com Mara Villanueva (Wedding coordinator)
-- coordinator2@multivent.com Nico Alvarado (Social-event coordinator)
-- coordinator3@multivent.com Bea Montelibano (Corporate coordinator)
-- coordinator4@multivent.com Carlo Sison (Debut and milestone coordinator)

begin;

-- The current moderation and provider-protection triggers explicitly trust
-- service-role work. The setting is transaction-local and disappears at commit.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  missing_categories text;
begin
  if to_regclass('auth.users') is null
    or to_regclass('auth.identities') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.provider_profiles') is null
    or to_regclass('public.services') is null
    or to_regclass('public.service_packages') is null
    or to_regclass('public.service_package_items') is null
    or to_regclass('public.provider_operating_hours') is null
    or to_regclass('public.provider_availability') is null
    or to_regclass('public.coordinator_availability') is null
  then
    raise exception 'The current MULTIVENT schema is incomplete. Apply migrations through 52 before this seed.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services'
      and column_name = 'category_details'
  ) then
    raise exception 'Migration 51 is required: public.services.category_details is missing.';
  end if;

  select string_agg(required.name, ', ' order by required.name)
  into missing_categories
  from (values
    ('Attire'), ('Florists'), ('Catering'), ('Venues & Estates'),
    ('Event Organizer'), ('Sound & Lights'), ('Photography'), ('Host/Emcee')
  ) required(name)
  where not exists (
    select 1 from public.service_categories category
    where lower(trim(category.name)) = lower(required.name)
  );

  if missing_categories is not null then
    raise exception 'Required service categories are missing: %', missing_categories;
  end if;
end;
$$;

create temporary table multivent_demo_accounts (
  user_id uuid primary key,
  email text not null unique,
  full_name text not null,
  account_role public.user_role not null,
  business_name text not null,
  business_description text not null,
  location text not null,
  open_days text[] not null,
  open_time time,
  close_time time
) on commit drop;

insert into multivent_demo_accounts (
  user_id, email, full_name, account_role, business_name,
  business_description, location, open_days, open_time, close_time
) values
  ('a1100000-0000-4000-8000-000000000001', 'provider1@multivent.com', 'Elena Maravilla', 'service_provider',
    'Amara Thread & Form', 'Formalwear atelier offering carefully fitted wedding and entourage attire.',
    'Bacolod City, Negros Occidental', array['tuesday','wednesday','thursday','friday','saturday'], '09:00', '18:00'),
  ('a1100000-0000-4000-8000-000000000002', 'provider2@multivent.com', 'Rina Solis', 'service_provider',
    'Petal & Stem Atelier', 'Floral studio creating fresh, seasonal arrangements for intimate and large celebrations.',
    'Talisay City, Negros Occidental', array['monday','tuesday','wednesday','thursday','friday','saturday'], '08:00', '18:00'),
  ('a1100000-0000-4000-8000-000000000003', 'provider3@multivent.com', 'Mateo Alunan', 'service_provider',
    'Hearth & Harvest Events', 'Bacolod-based catering team specializing in generous Filipino and modern wedding menus.',
    'Bacolod City, Negros Occidental', array['monday','tuesday','wednesday','thursday','friday','saturday'], '08:00', '20:00'),
  ('a1100000-0000-4000-8000-000000000004', 'provider4@multivent.com', 'Sofia Gamboa', 'service_provider',
    'Isla Table Catering Co.', 'Flexible off-site catering for plated dinners, cocktails, food stations, and family feasts.',
    'Bago City, Negros Occidental', array['tuesday','wednesday','thursday','friday','saturday','sunday'], '09:00', '20:00'),
  ('a1100000-0000-4000-8000-000000000005', 'provider5@multivent.com', 'Arturo Lacson', 'service_provider',
    'Balay Sidlak Events Estate', 'A collection of fictional indoor event spaces serving Bacolod and nearby cities.',
    'Bacolod City, Negros Occidental', array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], '08:00', '22:00'),
  ('a1100000-0000-4000-8000-000000000006', 'provider6@multivent.com', 'Camille Jalandoni', 'service_provider',
    'Verdant Horizon Venues', 'Garden, estate, and outdoor venues designed for relaxed Negros celebrations.',
    'Silay City, Negros Occidental', array['wednesday','thursday','friday','saturday','sunday'], '09:00', '22:00'),
  ('a1100000-0000-4000-8000-000000000007', 'provider7@multivent.com', 'Paolo Severino', 'service_provider',
    'Pulsecraft Event Production', 'Scalable professional audio, lighting, staging, and LED-wall production.',
    'Bacolod City, Negros Occidental', array['wednesday','thursday','friday','saturday','sunday'], '10:00', '23:00'),
  ('a1100000-0000-4000-8000-000000000008', 'provider8@multivent.com', 'Inez Villareal', 'service_provider',
    'Lantern & Lens Studio', 'Documentary-minded photo and film coverage for weddings and milestone events.',
    'Bacolod City, Negros Occidental', array['tuesday','wednesday','thursday','friday','saturday','sunday'], '09:00', '20:00'),
  ('a1100000-0000-4000-8000-000000000009', 'provider9@multivent.com', 'Gabriel Tiu', 'service_provider',
    'Stage & Story Hosts', 'Professional multilingual hosts for weddings, parties, debuts, and corporate programs.',
    'Bacolod City, Negros Occidental', array['tuesday','wednesday','thursday','friday','saturday','sunday'], '10:00', '22:00'),
  ('a1100000-0000-4000-8000-000000000101', 'coordinator1@multivent.com', 'Mara Villanueva', 'event_coordinator',
    'MULTIVENT Coordination - Mara Villanueva', 'MULTIVENT employee specializing in full and on-the-day wedding coordination.',
    'Bacolod City, Negros Occidental', '{}'::text[], null, null),
  ('a1100000-0000-4000-8000-000000000102', 'coordinator2@multivent.com', 'Nico Alvarado', 'event_coordinator',
    'MULTIVENT Coordination - Nico Alvarado', 'MULTIVENT employee coordinating birthdays, anniversaries, and social gatherings.',
    'Talisay City, Negros Occidental', '{}'::text[], null, null),
  ('a1100000-0000-4000-8000-000000000103', 'coordinator3@multivent.com', 'Bea Montelibano', 'event_coordinator',
    'MULTIVENT Coordination - Bea Montelibano', 'MULTIVENT employee focused on corporate programs and formal functions.',
    'Bacolod City, Negros Occidental', '{}'::text[], null, null),
  ('a1100000-0000-4000-8000-000000000104', 'coordinator4@multivent.com', 'Carlo Sison', 'event_coordinator',
    'MULTIVENT Coordination - Carlo Sison', 'MULTIVENT employee specializing in debuts and milestone celebrations.',
    'Silay City, Negros Occidental', '{}'::text[], null, null);

-- Refuse to adopt or overwrite an unrelated account that happens to use one
-- of the reserved demo emails or deterministic IDs.
do $$
begin
  if exists (
    select 1
    from multivent_demo_accounts seed
    join auth.users existing
      on lower(existing.email) = lower(seed.email) or existing.id = seed.user_id
    where existing.id <> seed.user_id
      or lower(existing.email) <> lower(seed.email)
  ) then
    raise exception 'A reserved demo email or user ID belongs to a different Auth user. No seed data was written.';
  end if;
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  seed.user_id,
  'authenticated',
  'authenticated',
  seed.email,
  crypt('12345678', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'full_name', seed.full_name,
    'default_role', seed.account_role::text,
    'business_name', seed.business_name,
    'provider_terms_accepted', seed.account_role = 'service_provider'
  ),
  now(), now(), '', '', '', ''
from multivent_demo_accounts seed
where not exists (
  select 1 from auth.users existing where existing.id = seed.user_id
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  seed.user_id,
  seed.user_id,
  seed.user_id::text,
  jsonb_build_object(
    'sub', seed.user_id::text,
    'email', seed.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email', now(), now(), now()
from multivent_demo_accounts seed
where not exists (
  select 1 from auth.identities identity
  where identity.user_id = seed.user_id and identity.provider = 'email'
)
on conflict do nothing;

-- The public-signup hardening trigger correctly downgrades internal-role claims
-- during Auth insertion. Promote only the four deterministic demo coordinator
-- accounts afterward while still operating as service_role.
update auth.users auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'full_name', seed.full_name,
    'default_role', seed.account_role::text,
    'business_name', seed.business_name
  ),
  updated_at = now()
from multivent_demo_accounts seed
where auth_user.id = seed.user_id;

insert into public.profiles (
  id, full_name, email, default_role, account_status
)
select user_id, full_name, email, account_role, 'active'::public.account_status
from multivent_demo_accounts
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    default_role = excluded.default_role,
    account_status = excluded.account_status,
    updated_at = now();

-- Remove only the incorrect Client membership that the Auth safety trigger
-- created for these known coordinator seed IDs.
delete from public.user_roles membership
using multivent_demo_accounts seed, public.roles role
where seed.account_role = 'event_coordinator'
  and membership.user_id = seed.user_id
  and role.id = membership.role_id
  and role.name = 'client';

insert into public.user_roles (user_id, role_id)
select seed.user_id, role.id
from multivent_demo_accounts seed
join public.roles role on role.name = seed.account_role
on conflict (user_id, role_id) do nothing;

insert into public.provider_profiles (
  user_id, business_name, description, contact_email, location,
  verification_status, terms_accepted, terms_version, terms_accepted_at,
  rejection_reason
)
select
  seed.user_id, seed.business_name, seed.business_description, seed.email,
  seed.location, 'verified'::public.account_status, true,
  '2026-09-25-commission-v1', now(), null
from multivent_demo_accounts seed
on conflict (user_id) do update
set business_name = excluded.business_name,
    description = excluded.description,
    contact_email = excluded.contact_email,
    location = excluded.location,
    verification_status = excluded.verification_status,
    terms_accepted = excluded.terms_accepted,
    terms_version = excluded.terms_version,
    terms_accepted_at = coalesce(public.provider_profiles.terms_accepted_at, excluded.terms_accepted_at),
    rejection_reason = null,
    updated_at = now();

create temporary table multivent_demo_services (
  service_id uuid primary key,
  account_email text not null,
  category_name text not null,
  service_name text not null,
  description text not null,
  base_price numeric(12,2) not null,
  location text not null,
  pricing_model text not null,
  pricing_unit text not null,
  pricing_details text not null,
  catering_service_types text[] not null default '{}'::text[],
  category_details jsonb not null
) on commit drop;

insert into multivent_demo_services values
  -- Attire (5)
  ('a1300000-0000-4000-8001-000000000001', 'provider1@multivent.com', 'Attire',
    'Heritage Filipiniana Bridal Collection',
    'Ivory and pearl-white Filipiniana bridal gowns prepared with a private fitting and coordinated accessories.',
    18500, 'Bacolod City, Negros Occidental', 'fixed', 'event',
    'Three-day rental with fitting, minor adjustment, veil, hair accessory, and garment bag.', '{}',
    $json${"kind":"attire","schemaVersion":1,"attireType":"Wedding Gown","serviceOptions":["Rental"],"intendedFor":["Bride"],"availableSizes":["S","M","L","XL"],"availableColors":["Ivory","Pearl White"],"quantityAvailable":6,"rentalDuration":3,"rentalDurationUnit":"days","fittingRequired":true,"fittingLocation":"Amara fitting studio, Bacolod City","leadTime":2,"leadTimeUnit":"weeks","inclusions":["Veil","Accessories","Hair comb","Garment bag"]}$json$),
  ('a1300000-0000-4000-8001-000000000002', 'provider1@multivent.com', 'Attire',
    'Modern Piña Barong Ensemble',
    'A polished barong rental set for grooms and principal sponsors, available in classic cream and ecru.',
    6500, 'Bacolod City, Negros Occidental', 'fixed', 'event',
    'Three-day barong, inner shirt, trousers, and belt rental with one scheduled fitting.', '{}',
    $json${"kind":"attire","schemaVersion":1,"attireType":"Barong","serviceOptions":["Rental"],"intendedFor":["Groom","Groomsman","Entourage"],"availableSizes":["S","M","L","XL","XXL"],"availableColors":["Cream","Ecru"],"quantityAvailable":14,"rentalDuration":3,"rentalDurationUnit":"days","fittingRequired":true,"fittingLocation":"Amara fitting studio, Bacolod City","leadTime":7,"leadTimeUnit":"days","inclusions":["Belt","Inner shirt","Trousers","Garment bag"]}$json$),
  ('a1300000-0000-4000-8001-000000000003', 'provider1@multivent.com', 'Attire',
    'Entourage Dress Color Collection',
    'Mix-and-match formal dresses for bridesmaids and entourage members in coordinated event palettes.',
    2800, 'Bacolod City, Negros Occidental', 'startingAt', 'person',
    'Price is per dress for a three-day rental; group fittings can be scheduled together.', '{}',
    $json${"kind":"attire","schemaVersion":1,"attireType":"Entourage Attire","serviceOptions":["Rental"],"intendedFor":["Bridesmaid","Entourage"],"availableSizes":["XS","S","M","L","XL","XXL"],"availableColors":["Sage Green","Dusty Rose","Burgundy","Champagne","Navy"],"quantityAvailable":32,"rentalDuration":3,"rentalDurationUnit":"days","fittingRequired":true,"fittingLocation":"Amara fitting studio, Bacolod City","leadTime":10,"leadTimeUnit":"days","inclusions":["Belt","Garment bag"]}$json$),
  ('a1300000-0000-4000-8001-000000000004', 'provider1@multivent.com', 'Attire',
    'Tailored Groom Suit Package',
    'A contemporary two-piece suit package for grooms who prefer a clean, understated formal look.',
    12500, 'Bacolod City, Negros Occidental', 'fixed', 'event',
    'Includes suit rental, dress shirt, tie or bow tie, belt, and two fitting appointments.', '{}',
    $json${"kind":"attire","schemaVersion":1,"attireType":"Suit","serviceOptions":["Rental"],"intendedFor":["Groom"],"availableSizes":["S","M","L","XL","XXL","Custom Size"],"availableColors":["Charcoal","Navy","Black","Sand"],"quantityAvailable":10,"rentalDuration":3,"rentalDurationUnit":"days","fittingRequired":true,"fittingLocation":"Amara fitting studio, Bacolod City","leadTime":3,"leadTimeUnit":"weeks","inclusions":["Tie","Bow Tie","Belt","Dress shirt","Garment bag"]}$json$),
  ('a1300000-0000-4000-8001-000000000005', 'provider1@multivent.com', 'Attire',
    'Bespoke Garden Wedding Gown',
    'A made-to-measure bridal gown with a lightweight silhouette suited to garden and destination weddings.',
    45000, 'Bacolod City, Negros Occidental', 'startingAt', 'event',
    'Custom-made gown price begins at the listed amount and includes design consultation and three fittings.', '{}',
    $json${"kind":"attire","schemaVersion":1,"attireType":"Wedding Gown","serviceOptions":["Purchase","Custom-made"],"intendedFor":["Bride"],"availableSizes":["Custom Size"],"availableColors":["Ivory","Warm White","Blush"],"quantityAvailable":3,"fittingRequired":true,"fittingLocation":"Amara fitting studio, Bacolod City","leadTime":10,"leadTimeUnit":"weeks","inclusions":["Veil","Accessories","Garment bag","Design consultation"]}$json$),

  -- Florists (5)
  ('a1300000-0000-4000-8002-000000000001', 'provider2@multivent.com', 'Florists',
    'Soft Romance Bridal Bouquet',
    'A hand-tied bridal bouquet blending garden roses, carnations, and delicate seasonal fillers.',
    5500, 'Talisay City, Negros Occidental', 'fixed', 'event',
    'Includes bridal bouquet, matching groom boutonniere, ribbon finish, and delivery within Bacolod or Talisay.', '{}',
    $json${"kind":"florists","schemaVersion":1,"serviceTypes":["Bouquet","Boutonniere"],"flowerOptions":["Roses","Carnations","Seasonal Flowers"],"themeOptions":["Blush and Ivory","Burgundy and Cream","Pastel Garden"],"coverage":["Bridal Bouquet","Groom"],"customizationAvailable":true,"setupIncluded":false,"deliveryIncluded":true,"deliveryArea":"Bacolod City and Talisay City","leadTime":5,"leadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8002-000000000002', 'provider2@multivent.com', 'Florists',
    'Sunlit Ceremony Floral Styling',
    'Warm ceremony arrangements featuring sunflowers, local foliage, and white accent flowers.',
    18000, 'Bacolod City and Talisay City', 'fixed', 'event',
    'Covers entrance markers, aisle accents, signing-table flowers, and a simple ceremony focal arrangement.', '{}',
    $json${"kind":"florists","schemaVersion":1,"serviceTypes":["Ceremony Flowers","Stage Flowers"],"flowerOptions":["Sunflowers","Seasonal Flowers","Mixed Flowers"],"themeOptions":["Golden Rustic","Tropical White","Sunset Orange"],"coverage":["Ceremony","Stage"],"customizationAvailable":true,"setupIncluded":true,"deliveryIncluded":true,"deliveryArea":"Bacolod, Talisay, and Silay","leadTime":10,"leadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8002-000000000003', 'provider2@multivent.com', 'Florists',
    'Orchid Table Centerpiece Set',
    'Refined low centerpieces using orchids, roses, and greenery so guests can converse comfortably.',
    24000, 'Bacolod City, Negros Occidental', 'startingAt', 'event',
    'Base price covers twelve guest-table centerpieces, delivery, setup, and post-event vessel collection.', '{}',
    $json${"kind":"florists","schemaVersion":1,"serviceTypes":["Table Centerpieces","Reception Flowers"],"flowerOptions":["Orchids","Roses","Mixed Flowers"],"themeOptions":["Modern White","Plum and Mauve","Emerald Green"],"coverage":["Tables","Reception"],"customizationAvailable":true,"setupIncluded":true,"deliveryIncluded":true,"deliveryArea":"Bacolod City and nearby Talisay venues","leadTime":2,"leadTimeUnit":"weeks"}$json$),
  ('a1300000-0000-4000-8002-000000000004', 'provider2@multivent.com', 'Florists',
    'Tropical Reception Bloomscape',
    'A lush reception package using anthuriums, orchids, local foliage, and seasonal tropical blooms.',
    38000, 'Negros Occidental', 'startingAt', 'event',
    'Includes registration flowers, sweetheart-table styling, stage accents, and ten table arrangements.', '{}',
    $json${"kind":"florists","schemaVersion":1,"serviceTypes":["Reception Flowers","Stage Flowers","Table Centerpieces"],"flowerOptions":["Orchids","Seasonal Flowers","Other"],"themeOptions":["Tropical Jewel","Green and White","Terracotta Sunset"],"coverage":["Reception","Tables","Stage"],"customizationAvailable":true,"setupIncluded":true,"deliveryIncluded":true,"deliveryArea":"Bacolod, Talisay, Silay, and Murcia","leadTime":3,"leadTimeUnit":"weeks"}$json$),
  ('a1300000-0000-4000-8002-000000000005', 'provider2@multivent.com', 'Florists',
    'Complete Wedding Floral Story',
    'Coordinated personal flowers, ceremony styling, and reception florals built around one wedding palette.',
    68000, 'Negros Occidental', 'startingAt', 'event',
    'Full-event floral styling for up to 150 guests; premium imported flowers are quoted separately.', '{}',
    $json${"kind":"florists","schemaVersion":1,"serviceTypes":["Full Event Floral Styling","Bouquet","Boutonniere","Ceremony Flowers","Reception Flowers"],"flowerOptions":["Roses","Tulips","Orchids","Seasonal Flowers"],"themeOptions":["Classic White","Romantic Burgundy","Wildflower Pastel"],"coverage":["Bridal Bouquet","Bridesmaids","Groom","Entourage","Ceremony","Reception","Tables","Stage"],"customizationAvailable":true,"setupIncluded":true,"deliveryIncluded":true,"deliveryArea":"Bacolod, Talisay, Silay, Bago, and Murcia","leadTime":6,"leadTimeUnit":"weeks"}$json$),

  -- Catering (6)
  ('a1300000-0000-4000-8003-000000000001', 'provider3@multivent.com', 'Catering',
    'Negros Heritage Buffet',
    'A generous Filipino buffet with familiar celebration dishes and a few distinctly Negros flavors.',
    650, 'Bacolod City and nearby Negros Occidental areas', 'fixed', 'person',
    'Per-person rate for 50 to 300 guests; menu, buffet setup, service staff, tableware, and iced tea included.', array['buffet'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Buffet"],"cuisines":["Filipino"],"pricingBasis":"per_person","minimumGuests":50,"maximumGuests":300,"menuSections":[{"name":"Appetizer","items":["Lumpiang Shanghai","Chicken Spring Rolls"]},{"name":"Main Course","items":["Chicken Inasal","Beef Caldereta","Fish Fillet with Calamansi Butter"]},{"name":"Sides","items":["Garlic Rice","Pinakbet"]},{"name":"Dessert","items":["Leche Flan","Mango Float"]},{"name":"Drinks","items":["House Iced Tea"]}],"dietaryOptions":["Vegetarian"],"drinksIncluded":true,"servingStaffIncluded":true,"tablesChairsIncluded":false,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod, Talisay, Silay, and Murcia","preparationLeadTime":7,"preparationLeadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8003-000000000002', 'provider3@multivent.com', 'Catering',
    'Garden Wedding Plated Dinner',
    'An elegant three-course plated meal designed for garden receptions and formal evening weddings.',
    1050, 'Bacolod City and Talisay City', 'fixed', 'person',
    'Per-person plated service for 50 to 150 guests with wait staff, tableware, water, and coffee service.', array['plated'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Plated"],"cuisines":["Filipino","Western"],"pricingBasis":"per_person","minimumGuests":50,"maximumGuests":150,"menuSections":[{"name":"Starter","items":["Roasted Pumpkin Soup","Garden Salad"]},{"name":"Main Course","items":["Chicken Roulade","Herb-Crusted Fish","Truffle Mashed Potato"]},{"name":"Dessert","items":["Tablea Chocolate Tart"]},{"name":"Drinks","items":["Cucumber Lemon Water","Brewed Coffee"]}],"dietaryOptions":["Vegetarian","Gluten-Free"],"drinksIncluded":true,"servingStaffIncluded":true,"tablesChairsIncluded":false,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod and Talisay","preparationLeadTime":14,"preparationLeadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8003-000000000003', 'provider3@multivent.com', 'Catering',
    'Office Fiesta Packed Meals',
    'Neatly packed Filipino meals for seminars, office celebrations, and daytime corporate programs.',
    360, 'Bacolod City, Negros Occidental', 'fixed', 'person',
    'Per-person boxed meal with one main dish, rice, vegetables, dessert, bottled water, and labeled dietary variants.', array['packed'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Packed Meals"],"cuisines":["Filipino"],"pricingBasis":"per_person","minimumGuests":30,"maximumGuests":500,"menuSections":[{"name":"Meal Choices","items":["Chicken Inasal Rice Meal","Pork Humba Rice Meal","Grilled Fish Rice Meal"]},{"name":"Sides","items":["Vegetable Lumpia","Atchara"]},{"name":"Dessert","items":["Napoleones Bite"]},{"name":"Drinks","items":["Bottled Water"]}],"dietaryOptions":["Vegetarian","Halal"],"drinksIncluded":true,"servingStaffIncluded":false,"tablesChairsIncluded":false,"tablewareIncluded":false,"setupCleanupIncluded":false,"serviceArea":"Bacolod, Talisay, and Bago","preparationLeadTime":3,"preparationLeadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8003-000000000004', 'provider4@multivent.com', 'Catering',
    'Celebration Food Station Market',
    'Interactive food stations with freshly finished pasta, grilled favorites, and a local dessert corner.',
    850, 'Bacolod City and northern Negros Occidental', 'startingAt', 'person',
    'Per-person rate for three live stations, chefs, buffet attendants, plates, utensils, and cleanup.', array['buffet'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Food Stations","Buffet"],"cuisines":["Filipino","Italian","Mixed"],"pricingBasis":"per_person","minimumGuests":80,"maximumGuests":300,"menuSections":[{"name":"Pasta Station","items":["Creamy Mushroom Penne","Spaghetti Pomodoro"]},{"name":"Grill Station","items":["Chicken Barbecue","Herb Pork Skewers","Grilled Vegetables"]},{"name":"Negros Sweets","items":["Mini Piaya","Napoleones","Muscovado Panna Cotta"]},{"name":"Drinks","items":["Calamansi Cooler"]}],"dietaryOptions":["Vegetarian"],"drinksIncluded":true,"servingStaffIncluded":true,"tablesChairsIncluded":false,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod, Talisay, and Silay","preparationLeadTime":10,"preparationLeadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8003-000000000005', 'provider4@multivent.com', 'Catering',
    'Sunset Cocktail Bites',
    'Passed canapés and grazing selections for wedding cocktails, launches, and intimate evening socials.',
    700, 'Bacolod City and Talisay City', 'fixed', 'person',
    'Per-person cocktail menu for 40 to 120 guests with servers, cocktail napkins, glassware, and two refreshments.', array['plated'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Cocktail"],"cuisines":["Western","Filipino","Mixed"],"pricingBasis":"per_person","minimumGuests":40,"maximumGuests":120,"menuSections":[{"name":"Cold Bites","items":["Tuna Cucumber Cups","Cheese and Grape Skewers"]},{"name":"Hot Bites","items":["Chicken Satay","Mini Beef Sliders","Mushroom Tartlets"]},{"name":"Sweets","items":["Mini Sans Rival","Fruit Tartlets"]},{"name":"Drinks","items":["Ginger Calamansi Fizz","Iced Tea"]}],"dietaryOptions":["Vegetarian"],"drinksIncluded":true,"servingStaffIncluded":true,"tablesChairsIncluded":false,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod and Talisay","preparationLeadTime":7,"preparationLeadTimeUnit":"days"}$json$),
  ('a1300000-0000-4000-8003-000000000006', 'provider4@multivent.com', 'Catering',
    'Sunday Family Table Feast',
    'A warm family-style spread served in sharing platters for birthdays, reunions, and intimate weddings.',
    48000, 'Bacolod City, Talisay City, and Bago City', 'fixed', 'event',
    'Package serves 100 guests and includes sharing platters, buffet replenishment, service crew, and cleanup.', array['buffet'],
    $json${"kind":"catering","schemaVersion":1,"cateringTypes":["Family Style"],"cuisines":["Filipino","Chinese"],"pricingBasis":"package","guestsIncluded":100,"minimumGuests":60,"maximumGuests":200,"menuSections":[{"name":"Starters","items":["Fresh Lumpia","Pancit Canton"]},{"name":"Sharing Mains","items":["Soy-Garlic Chicken","Beef Mechado","Sweet and Sour Fish"]},{"name":"Sides","items":["Steamed Rice","Chopsuey"]},{"name":"Dessert","items":["Buko Pandan","Leche Flan"]},{"name":"Drinks","items":["Iced Tea"]}],"dietaryOptions":["Vegetarian"],"drinksIncluded":true,"servingStaffIncluded":true,"tablesChairsIncluded":false,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod, Talisay, and Bago","preparationLeadTime":7,"preparationLeadTimeUnit":"days"}$json$);

insert into multivent_demo_services values
  -- Venues & Estates (6)
  ('a1300000-0000-4000-8004-000000000001', 'provider5@multivent.com', 'Venues & Estates',
    'Celestine Grand Ballroom',
    'An air-conditioned ballroom for weddings, debuts, and company galas with a built-in stage and bridal suite.',
    95000, 'East Bacolod area, Negros Occidental', 'fixed', 'event',
    'Twelve-hour venue use for up to 350 guests with tables, chairs, stage, dressing rooms, and guarded parking.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Ballroom","address":"Demo site, East Bacolod area, Negros Occidental","latitude":10.6758,"longitude":122.9652,"spaces":[{"id":"celestine-ballroom","name":"Grand Ballroom","areaSqm":440,"capacity":350,"spaceType":"Indoor"}],"combinations":[],"airConditioning":true,"chairs":true,"chairsQuantity":350,"tables":true,"tablesQuantity":36,"parking":true,"parkingQuantity":90,"restrooms":true,"restroomsQuantity":8,"dressingRoom":true,"kitchen":true,"wifi":true,"stage":true,"pwdAccessibility":true,"otherInclusions":["Bridal suite","Projector","Standby generator"],"openingTime":"08:00","closingTime":"23:00","setupAllowance":4,"setupAllowanceUnit":"hours"}$json$),
  ('a1300000-0000-4000-8004-000000000002', 'provider5@multivent.com', 'Venues & Estates',
    'Sidlak Flexible Function Rooms',
    'Three adjoining function rooms that can operate independently or open into larger celebration layouts.',
    32000, 'Mandalagan district demo area, Bacolod City', 'startingAt', 'event',
    'Starting rate is for one hall; valid adjoining-room combinations are priced after guest-count confirmation.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Function Hall","address":"Demo site, Mandalagan district area, Bacolod City","latitude":10.6942,"longitude":122.9671,"spaces":[{"id":"sidlak-hall-1","name":"Function Hall 1","areaSqm":120,"capacity":100,"spaceType":"Indoor"},{"id":"sidlak-hall-2","name":"Function Hall 2","areaSqm":150,"capacity":120,"spaceType":"Indoor"},{"id":"sidlak-hall-3","name":"Function Hall 3","areaSqm":120,"capacity":100,"spaceType":"Indoor"}],"combinations":[{"id":"sidlak-combo-12","name":"Hall 1 + Hall 2","spaceIds":["sidlak-hall-1","sidlak-hall-2"],"capacity":220},{"id":"sidlak-combo-23","name":"Hall 2 + Hall 3","spaceIds":["sidlak-hall-2","sidlak-hall-3"],"capacity":220},{"id":"sidlak-combo-123","name":"Hall 1 + Hall 2 + Hall 3","spaceIds":["sidlak-hall-1","sidlak-hall-2","sidlak-hall-3"],"capacity":320}],"airConditioning":true,"chairs":true,"chairsQuantity":320,"tables":true,"tablesQuantity":34,"parking":true,"parkingQuantity":65,"restrooms":true,"restroomsQuantity":6,"dressingRoom":true,"kitchen":false,"wifi":true,"stage":true,"pwdAccessibility":true,"otherInclusions":["Movable partitions","Projector","Loading bay"],"openingTime":"08:00","closingTime":"22:00","setupAllowance":3,"setupAllowanceUnit":"hours"}$json$),
  ('a1300000-0000-4000-8004-000000000003', 'provider5@multivent.com', 'Venues & Estates',
    'Casa Marisol Courtyard & Hall',
    'A bright courtyard paired with an intimate indoor hall for ceremonies that flow naturally into dinner.',
    58000, 'South Bacolod demo area, Negros Occidental', 'fixed', 'event',
    'Exclusive ten-hour use of both spaces for up to 220 guests, including basic tables, chairs, and ingress time.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Estate","address":"Demo site, South Bacolod area, Negros Occidental","latitude":10.6421,"longitude":122.9418,"spaces":[{"id":"marisol-courtyard","name":"Garden Courtyard","areaSqm":230,"capacity":150,"spaceType":"Outdoor"},{"id":"marisol-hall","name":"Marisol Hall","areaSqm":110,"capacity":80,"spaceType":"Indoor"}],"combinations":[{"id":"marisol-combined","name":"Courtyard + Marisol Hall","spaceIds":["marisol-courtyard","marisol-hall"],"capacity":220}],"airConditioning":true,"chairs":true,"chairsQuantity":220,"tables":true,"tablesQuantity":24,"parking":true,"parkingQuantity":45,"restrooms":true,"restroomsQuantity":5,"dressingRoom":true,"kitchen":true,"wifi":false,"stage":false,"pwdAccessibility":true,"otherInclusions":["Ceremony arch","Catering prep area","Rain-plan hall"],"openingTime":"09:00","closingTime":"22:00","setupAllowance":4,"setupAllowanceUnit":"hours"}$json$),
  ('a1300000-0000-4000-8004-000000000004', 'provider6@multivent.com', 'Venues & Estates',
    'Hacienda Luntian Garden Pavilion',
    'A landscaped ceremony garden and covered pavilion surrounded by mature trees and open countryside views.',
    72000, 'Talisay upland demo area, Negros Occidental', 'fixed', 'event',
    'Exclusive event-day access for up to 260 guests with garden ceremony setup, pavilion, parking, and generator.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Garden","address":"Demo site, Talisay upland area, Negros Occidental","latitude":10.7354,"longitude":123.0116,"spaces":[{"id":"luntian-garden","name":"Ceremony Garden","areaSqm":520,"capacity":180,"spaceType":"Outdoor"},{"id":"luntian-pavilion","name":"Covered Pavilion","areaSqm":165,"capacity":100,"spaceType":"Indoor"}],"combinations":[{"id":"luntian-estate","name":"Garden + Pavilion","spaceIds":["luntian-garden","luntian-pavilion"],"capacity":260}],"airConditioning":false,"chairs":true,"chairsQuantity":260,"tables":true,"tablesQuantity":28,"parking":true,"parkingQuantity":110,"restrooms":true,"restroomsQuantity":6,"dressingRoom":true,"kitchen":true,"wifi":false,"stage":true,"pwdAccessibility":true,"otherInclusions":["Bridal room","Generator","Outdoor string lights"],"openingTime":"08:00","closingTime":"22:00","setupAllowance":6,"setupAllowanceUnit":"hours"}$json$),
  ('a1300000-0000-4000-8004-000000000005', 'provider6@multivent.com', 'Venues & Estates',
    'Silay View Events Lodge',
    'A cozy hill-facing lodge for intimate weddings, family celebrations, workshops, and private dinners.',
    28000, 'Silay City demo area, Negros Occidental', 'fixed', 'event',
    'Eight-hour venue rental for up to 50 guests with indoor dining, veranda access, tables, chairs, and parking.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Resort","address":"Demo site, Silay City countryside area, Negros Occidental","latitude":10.8135,"longitude":123.0184,"spaces":[{"id":"silay-lodge","name":"View Lodge","areaSqm":85,"capacity":50,"spaceType":"Indoor"}],"combinations":[],"airConditioning":true,"chairs":true,"chairsQuantity":50,"tables":true,"tablesQuantity":8,"parking":true,"parkingQuantity":22,"restrooms":true,"restroomsQuantity":3,"dressingRoom":false,"kitchen":true,"wifi":true,"stage":false,"pwdAccessibility":false,"otherInclusions":["Covered veranda","Projector","Coffee station"],"openingTime":"09:00","closingTime":"21:00","setupAllowance":2,"setupAllowanceUnit":"hours"}$json$),
  ('a1300000-0000-4000-8004-000000000006', 'provider6@multivent.com', 'Venues & Estates',
    'North Grove Festival Lawn',
    'A broad outdoor lawn for festivals, large reunions, concerts, and open-air receptions with flexible staging.',
    125000, 'Silay-Talisay corridor demo area, Negros Occidental', 'startingAt', 'event',
    'Base rental covers the lawn, utility access, parking field, restrooms, and eight hours of supplier ingress.', '{}',
    $json${"kind":"venues","schemaVersion":1,"venueType":"Outdoor Venue","address":"Demo site, Silay-Talisay corridor, Negros Occidental","latitude":10.7769,"longitude":122.9973,"spaces":[{"id":"north-grove-lawn","name":"Festival Lawn","areaSqm":1800,"capacity":650,"spaceType":"Outdoor"}],"combinations":[],"airConditioning":false,"chairs":false,"tables":false,"parking":true,"parkingQuantity":220,"restrooms":true,"restroomsQuantity":10,"dressingRoom":true,"kitchen":false,"wifi":false,"stage":false,"pwdAccessibility":true,"otherInclusions":["Three-phase power access","Supplier loading lane","Emergency lighting"],"openingTime":"07:00","closingTime":"23:00","setupAllowance":8,"setupAllowanceUnit":"hours"}$json$),

  -- Event Organizer / MULTIVENT employees (4)
  ('a1300000-0000-4000-8005-000000000001', 'coordinator1@multivent.com', 'Event Organizer',
    'Full Wedding Coordination with Mara',
    'End-to-end wedding planning support covering timelines, supplier alignment, rehearsals, and event-day execution.',
    28000, 'Bacolod City and nearby Negros Occidental areas', 'fixed', 'event',
    'MULTIVENT employee coordination service for one wedding of up to 350 guests.', '{}',
    $json${"kind":"event_organizer","schemaVersion":1,"specializations":["Wedding"],"coordinationTypes":["Full Event Coordination","Planning & Coordination"],"maximumEventSize":350,"assignmentCapacity":4}$json$),
  ('a1300000-0000-4000-8005-000000000002', 'coordinator2@multivent.com', 'Event Organizer',
    'On-the-Day Social Event Coordination',
    'Focused event-day management for birthdays, anniversaries, and family celebrations with an approved supplier plan.',
    12000, 'Bacolod, Talisay, and Silay', 'fixed', 'event',
    'Includes final briefing, supplier call sheet, program cueing, and up to ten hours on event day.', '{}',
    $json${"kind":"event_organizer","schemaVersion":1,"specializations":["Birthday","Anniversary"],"coordinationTypes":["On-the-Day Coordination"],"maximumEventSize":250,"assignmentCapacity":6}$json$),
  ('a1300000-0000-4000-8005-000000000003', 'coordinator3@multivent.com', 'Event Organizer',
    'Corporate Program Coordination',
    'Structured coordination for conferences, launches, recognition nights, and company celebrations.',
    25000, 'Bacolod City and Negros Occidental', 'startingAt', 'event',
    'Covers program planning, technical run sheet, supplier coordination, registration flow, and event supervision.', '{}',
    $json${"kind":"event_organizer","schemaVersion":1,"specializations":["Corporate"],"coordinationTypes":["Full Event Coordination","Partial Coordination"],"maximumEventSize":600,"assignmentCapacity":5}$json$),
  ('a1300000-0000-4000-8005-000000000004', 'coordinator4@multivent.com', 'Event Organizer',
    'Debut & Milestone Coordination',
    'Planning and program support for debuts and milestone celebrations, from traditions to supplier handoffs.',
    18000, 'Bacolod, Silay, and Talisay', 'fixed', 'event',
    'Includes two planning meetings, program sequencing, supplier confirmation, rehearsal, and event-day management.', '{}',
    $json${"kind":"event_organizer","schemaVersion":1,"specializations":["Debut","Birthday"],"coordinationTypes":["Planning & Coordination","On-the-Day Coordination"],"maximumEventSize":300,"assignmentCapacity":5}$json$),

  -- Sound & Lights (5)
  ('a1300000-0000-4000-8006-000000000001', 'provider7@multivent.com', 'Sound & Lights',
    'Intimate Event Sound Package',
    'Clear, compact audio for ceremonies, private dinners, meetings, and celebrations of up to 80 guests.',
    8500, 'Bacolod City and Talisay City', 'fixed', 'event',
    'Includes two powered speakers, two wireless microphones, compact mixer, operator, delivery, and setup.', '{}',
    $json${"kind":"sound_lights","schemaVersion":1,"serviceTypes":["Sound System"],"recommendedGuestCapacity":80,"venueCoverage":"Indoor","speakerCount":2,"microphoneCount":2,"microphoneTypes":["Wireless"],"lightingTypes":[],"mixerIncluded":true,"stageIncluded":false,"ledWallIncluded":false,"projectorIncluded":false,"technicianIncluded":true,"setupIncluded":true,"backupPower":false,"setupTimeHours":1.5,"powerRequirement":"Two grounded 220V outlets","serviceArea":"Bacolod and Talisay"}$json$),
  ('a1300000-0000-4000-8006-000000000002', 'provider7@multivent.com', 'Sound & Lights',
    'Standard Wedding Sound & Lights',
    'Balanced reception audio and flattering ambient lighting for weddings with up to 150 guests.',
    18000, 'Bacolod, Talisay, and Silay', 'fixed', 'event',
    'Four speakers, four microphones, digital mixer, uplights, spotlights, two technicians, delivery, and setup.', '{}',
    $json${"kind":"sound_lights","schemaVersion":1,"serviceTypes":["Sound + Lights"],"recommendedGuestCapacity":150,"venueCoverage":"Both","speakerCount":4,"microphoneCount":4,"microphoneTypes":["Wireless","Wired"],"lightingTypes":["Spotlights","Ambient Lighting","Uplighting"],"mixerIncluded":true,"stageIncluded":false,"ledWallIncluded":false,"projectorIncluded":false,"technicianIncluded":true,"setupIncluded":true,"backupPower":false,"setupTimeHours":3,"powerRequirement":"Dedicated 20A 220V circuit","serviceArea":"Bacolod, Talisay, and Silay"}$json$),
  ('a1300000-0000-4000-8006-000000000003', 'provider7@multivent.com', 'Sound & Lights',
    'Outdoor Celebration Audio',
    'Weather-conscious, higher-output audio for gardens, lawns, and open-air programs of up to 250 guests.',
    28500, 'Negros Occidental', 'fixed', 'event',
    'Six speakers, subwoofers, wireless microphones, digital mixer, two technicians, cable protection, and backup power.', '{}',
    $json${"kind":"sound_lights","schemaVersion":1,"serviceTypes":["Sound System","Full Technical Package"],"recommendedGuestCapacity":250,"venueCoverage":"Outdoor","speakerCount":6,"microphoneCount":4,"microphoneTypes":["Wireless","Lapel"],"lightingTypes":["Ambient Lighting"],"mixerIncluded":true,"stageIncluded":false,"ledWallIncluded":false,"projectorIncluded":false,"technicianIncluded":true,"setupIncluded":true,"backupPower":true,"setupTimeHours":4,"powerRequirement":"Two dedicated 20A circuits; generator included for audio backup","serviceArea":"Bacolod, Talisay, Silay, Bago, and Murcia"}$json$),
  ('a1300000-0000-4000-8006-000000000004', 'provider7@multivent.com', 'Sound & Lights',
    'Premium Stage & Lighting Production',
    'A concert-style stage, intelligent lighting, and full-range audio for major celebrations and corporate shows.',
    65000, 'Negros Occidental', 'startingAt', 'event',
    'Supports up to 500 guests with eight speakers, stage, moving heads, spotlights, mixer, crew, and generator backup.', '{}',
    $json${"kind":"sound_lights","schemaVersion":1,"serviceTypes":["Sound + Lights","Stage Setup","Full Technical Package"],"recommendedGuestCapacity":500,"venueCoverage":"Both","speakerCount":8,"microphoneCount":6,"microphoneTypes":["Wireless","Wired","Lapel"],"lightingTypes":["Stage Lighting","Moving Heads","Spotlights","Uplighting"],"mixerIncluded":true,"stageIncluded":true,"ledWallIncluded":false,"projectorIncluded":false,"technicianIncluded":true,"setupIncluded":true,"backupPower":true,"setupTimeHours":7,"powerRequirement":"Three-phase venue power or production generator","serviceArea":"Bacolod and major Negros Occidental cities"}$json$),
  ('a1300000-0000-4000-8006-000000000005', 'provider7@multivent.com', 'Sound & Lights',
    'LED Wall & Festival Production',
    'Large-format LED visuals, powerful audio, staging, and show lighting for audiences of up to 800.',
    95000, 'Negros Occidental', 'startingAt', 'event',
    'Includes 5-by-3-meter LED wall, ten-speaker system, stage, lighting rig, technical crew, setup, and backup power.', '{}',
    $json${"kind":"sound_lights","schemaVersion":1,"serviceTypes":["LED Wall","Sound + Lights","Stage Setup","Full Technical Package"],"recommendedGuestCapacity":800,"venueCoverage":"Both","speakerCount":10,"microphoneCount":8,"microphoneTypes":["Wireless","Wired","Lapel"],"lightingTypes":["Stage Lighting","Moving Heads","Spotlights","Ambient Lighting"],"mixerIncluded":true,"stageIncluded":true,"ledWallIncluded":true,"ledWallWidth":5,"ledWallHeight":3,"ledWallUnit":"meters","projectorIncluded":false,"technicianIncluded":true,"setupIncluded":true,"backupPower":true,"setupTimeHours":10,"powerRequirement":"Three-phase power plus dedicated generator backup","serviceArea":"Negros Occidental by site assessment"}$json$);

insert into multivent_demo_services values
  -- Photography (5)
  ('a1300000-0000-4000-8007-000000000001', 'provider8@multivent.com', 'Photography',
    'Essential Four-Hour Photo Coverage',
    'Natural, candid photography for civil weddings, birthdays, and intimate celebrations.',
    12000, 'Bacolod City and Talisay City', 'fixed', 'event',
    'Four hours, one photographer, at least 250 edited photographs, and a private online gallery.', '{}',
    $json${"kind":"photography","schemaVersion":1,"coverageTypes":["Ceremony","Reception"],"eventTypes":["Wedding","Birthday","Anniversary"],"coverageDurationHours":4,"photographerCount":1,"photoCoverage":true,"videoCoverage":false,"droneCoverage":false,"sameDayEdit":false,"preEventShoot":false,"rawFilesIncluded":false,"onlineGallery":true,"physicalAlbum":false,"minimumEditedPhotos":250,"turnaroundTime":3,"turnaroundUnit":"weeks","serviceArea":"Bacolod and Talisay"}$json$),
  ('a1300000-0000-4000-8007-000000000002', 'provider8@multivent.com', 'Photography',
    'Golden Hour Six-Hour Story',
    'Six hours of warm documentary photography for ceremonies, portraits, and early reception highlights.',
    25000, 'Bacolod, Talisay, and Silay', 'fixed', 'event',
    'One lead photographer, one assistant photographer, 450 edited images, online gallery, and twenty prints.', '{}',
    $json${"kind":"photography","schemaVersion":1,"coverageTypes":["Ceremony","Reception"],"eventTypes":["Wedding","Debut","Anniversary"],"coverageDurationHours":6,"photographerCount":2,"photoCoverage":true,"videoCoverage":false,"droneCoverage":false,"sameDayEdit":false,"preEventShoot":false,"rawFilesIncluded":false,"onlineGallery":true,"physicalAlbum":false,"minimumEditedPhotos":450,"turnaroundTime":4,"turnaroundUnit":"weeks","serviceArea":"Bacolod, Talisay, and Silay"}$json$),
  ('a1300000-0000-4000-8007-000000000003', 'provider8@multivent.com', 'Photography',
    'Wedding Story Photo + Film',
    'Coordinated photo and video coverage that follows preparations through the main reception program.',
    48000, 'Negros Occidental', 'fixed', 'event',
    'Eight hours, two photographers, one videographer, 600 edited photos, highlight film, and online gallery.', '{}',
    $json${"kind":"photography","schemaVersion":1,"coverageTypes":["Full Event"],"eventTypes":["Wedding","Debut"],"coverageDurationHours":8,"photographerCount":2,"photoCoverage":true,"videoCoverage":true,"videographerCount":1,"droneCoverage":false,"sameDayEdit":false,"preEventShoot":false,"rawFilesIncluded":false,"onlineGallery":true,"physicalAlbum":false,"minimumEditedPhotos":600,"highlightVideo":true,"fullEventVideo":false,"turnaroundTime":6,"turnaroundUnit":"weeks","serviceArea":"Bacolod, Talisay, Silay, Bago, and Murcia"}$json$),
  ('a1300000-0000-4000-8007-000000000004', 'provider8@multivent.com', 'Photography',
    'Cinematic Wedding Day Package',
    'A film-forward wedding package with complete photography, aerial establishing shots, and same-day highlights.',
    75000, 'Negros Occidental', 'fixed', 'event',
    'Ten hours, two photographers, two videographers, licensed drone coverage, same-day edit, and full-event film.', '{}',
    $json${"kind":"photography","schemaVersion":1,"coverageTypes":["Full Event"],"eventTypes":["Wedding"],"coverageDurationHours":10,"photographerCount":2,"photoCoverage":true,"videoCoverage":true,"videographerCount":2,"droneCoverage":true,"sameDayEdit":true,"preEventShoot":false,"rawFilesIncluded":false,"onlineGallery":true,"physicalAlbum":true,"minimumEditedPhotos":700,"highlightVideo":true,"fullEventVideo":true,"turnaroundTime":8,"turnaroundUnit":"weeks","serviceArea":"Negros Occidental subject to drone-site clearance"}$json$),
  ('a1300000-0000-4000-8007-000000000005', 'provider8@multivent.com', 'Photography',
    'Heirloom Full Event Collection',
    'Premium pre-event and wedding-day storytelling with a larger creative team and archival deliverables.',
    110000, 'Negros Occidental', 'fixed', 'event',
    'Pre-event shoot plus twelve hours on event day, two photographers, two videographers, drone, films, files, and album.', '{}',
    $json${"kind":"photography","schemaVersion":1,"coverageTypes":["Pre-event + Event","Full Event"],"eventTypes":["Wedding","Debut","Anniversary"],"coverageDurationHours":12,"photographerCount":2,"photoCoverage":true,"videoCoverage":true,"videographerCount":2,"droneCoverage":true,"sameDayEdit":true,"preEventShoot":true,"rawFilesIncluded":true,"onlineGallery":true,"physicalAlbum":true,"minimumEditedPhotos":900,"highlightVideo":true,"fullEventVideo":true,"turnaroundTime":10,"turnaroundUnit":"weeks","serviceArea":"Negros Occidental; travel beyond the province by quotation"}$json$),

  -- Host/Emcee (4)
  ('a1300000-0000-4000-8008-000000000001', 'provider9@multivent.com', 'Host/Emcee',
    'Elegant Wedding Hosting',
    'Warm, polished wedding hosting that keeps formal traditions clear without making the program feel stiff.',
    8500, 'Bacolod, Talisay, and Silay', 'fixed', 'event',
    'Up to five hours with custom script, program review, one online rehearsal, and wireless microphone backup.', '{}',
    $json${"kind":"host_emcee","schemaVersion":1,"eventTypes":["Wedding","Anniversary"],"hostingStyles":["Formal","Interactive"],"languages":["English","Filipino / Tagalog","Hiligaynon"],"coverageDurationHours":5,"maximumDurationHours":7,"scriptPreparationIncluded":true,"programPlanningAssistance":true,"rehearsalIncluded":true,"rehearsalCount":1,"equipmentProvided":["Microphone","Laptop"],"serviceArea":"Bacolod, Talisay, and Silay"}$json$),
  ('a1300000-0000-4000-8008-000000000002', 'provider9@multivent.com', 'Host/Emcee',
    'Energetic Party Host',
    'An upbeat host for birthdays and casual celebrations, with interactive games and smooth program transitions.',
    6500, 'Bacolod City and nearby cities', 'fixed', 'event',
    'Four hours of hosting with game mechanics, basic script preparation, music cues, and presentation laptop.', '{}',
    $json${"kind":"host_emcee","schemaVersion":1,"eventTypes":["Birthday","Anniversary"],"hostingStyles":["Casual","Energetic","Interactive"],"languages":["Filipino / Tagalog","Hiligaynon"],"coverageDurationHours":4,"maximumDurationHours":6,"scriptPreparationIncluded":true,"programPlanningAssistance":false,"rehearsalIncluded":false,"equipmentProvided":["Laptop"],"serviceArea":"Bacolod, Talisay, Silay, and Bago"}$json$),
  ('a1300000-0000-4000-8008-000000000003', 'provider9@multivent.com', 'Host/Emcee',
    'Corporate Program Emcee',
    'Clear, composed facilitation for conferences, recognition nights, launches, and company town halls.',
    12000, 'Negros Occidental', 'fixed', 'event',
    'Up to six hours with stakeholder briefing, polished script, pronunciation review, rehearsal, and clicker.', '{}',
    $json${"kind":"host_emcee","schemaVersion":1,"eventTypes":["Corporate","Seminar"],"hostingStyles":["Formal","Corporate"],"languages":["English","Filipino / Tagalog"],"coverageDurationHours":6,"maximumDurationHours":8,"scriptPreparationIncluded":true,"programPlanningAssistance":true,"rehearsalIncluded":true,"rehearsalCount":1,"equipmentProvided":["Microphone","Laptop","Presentation Clicker"],"serviceArea":"Bacolod and major Negros Occidental cities"}$json$),
  ('a1300000-0000-4000-8008-000000000004', 'provider9@multivent.com', 'Host/Emcee',
    'Bilingual Debut & Wedding Host',
    'A flexible English-Hiligaynon host who can guide formal segments and keep younger audiences engaged.',
    10000, 'Bacolod, Talisay, Silay, and Murcia', 'fixed', 'event',
    'Five hours with bilingual script preparation, program planning session, two rehearsals, laptop, and clicker.', '{}',
    $json${"kind":"host_emcee","schemaVersion":1,"eventTypes":["Wedding","Debut","Birthday"],"hostingStyles":["Formal","Energetic","Interactive"],"languages":["English","Hiligaynon"],"coverageDurationHours":5,"maximumDurationHours":7,"scriptPreparationIncluded":true,"programPlanningAssistance":true,"rehearsalIncluded":true,"rehearsalCount":2,"equipmentProvided":["Microphone","Laptop","Presentation Clicker"],"serviceArea":"Bacolod, Talisay, Silay, and Murcia"}$json$);

do $$
declare
  actual_total integer;
  category_error text;
begin
  select count(*) into actual_total from multivent_demo_services;
  if actual_total <> 40 then
    raise exception 'Seed definition error: expected 40 services, found %.', actual_total;
  end if;

  with expected(category_name, expected_count) as (values
    ('Attire', 5), ('Florists', 5), ('Catering', 6), ('Venues & Estates', 6),
    ('Event Organizer', 4), ('Sound & Lights', 5), ('Photography', 5), ('Host/Emcee', 4)
  ), actual as (
    select category_name, count(*)::integer as actual_count
    from multivent_demo_services group by category_name
  )
  select string_agg(
    format('%s expected %s found %s', expected.category_name,
      expected.expected_count, coalesce(actual.actual_count, 0)), '; '
  )
  into category_error
  from expected left join actual using (category_name)
  where coalesce(actual.actual_count, 0) <> expected.expected_count;

  if category_error is not null then
    raise exception 'Seed definition category totals are invalid: %', category_error;
  end if;

  if exists (
    select 1
    from multivent_demo_services seed
    join public.services existing on existing.id = seed.service_id
    join public.provider_profiles provider on provider.id = existing.provider_id
    join public.profiles profile on profile.id = provider.user_id
    where lower(profile.email) <> lower(seed.account_email)
      or existing.name <> seed.service_name
  ) then
    raise exception 'A deterministic demo service ID is already used by unrelated data. No seed data was written.';
  end if;
end;
$$;

insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available,
  submission_kind, moderation_note, moderated_at, moderated_by
)
select
  seed.service_id,
  provider.id,
  category.id,
  seed.service_name,
  seed.description,
  seed.base_price,
  seed.location,
  null,
  '[]'::jsonb,
  seed.pricing_model,
  seed.pricing_unit,
  seed.pricing_details,
  seed.catering_service_types,
  seed.category_details,
  'active',
  true,
  'new',
  null,
  now(),
  null
from multivent_demo_services seed
join multivent_demo_accounts account on lower(account.email) = lower(seed.account_email)
join public.provider_profiles provider on provider.user_id = account.user_id
join public.service_categories category
  on lower(trim(category.name)) = lower(seed.category_name)
on conflict (id) do nothing;

-- Packages are a mix of composed cross-service bundles and familiar package
-- choices attached to a single service. Client prices continue to receive the
-- live MULTIVENT commission through the existing catalog pricing functions.
create temporary table multivent_demo_packages (
  package_id uuid primary key,
  host_service_id uuid not null,
  package_name text not null,
  description text not null,
  price numeric(12,2) not null,
  pricing_unit text not null,
  inclusions jsonb not null,
  pricing_mode text not null,
  subtotal numeric(12,2),
  discount_type text not null,
  discount_value numeric(12,2) not null,
  discount_amount numeric(12,2) not null
) on commit drop;

insert into multivent_demo_packages values
  ('a1400000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8001-000000000001',
    'Wedding Party Attire Ensemble',
    'A coordinated bridal gown, groom barong, and one entourage dress selection from Amara.',
    25020, 'event', '["Bridal gown rental","Groom barong ensemble","One entourage dress","Group fitting schedule","Garment bags"]',
    'composed', 27800, 'percentage', 10, 2780),
  ('a1400000-0000-4000-8000-000000000002', 'a1300000-0000-4000-8002-000000000001',
    'Ceremony & Reception Floral Story',
    'Personal flowers, ceremony styling, and twelve coordinated reception centerpieces.',
    42500, 'event', '["Bridal bouquet and boutonniere","Ceremony floral styling","Twelve table centerpieces","Delivery and setup"]',
    'composed', 47500, 'fixed', 5000, 5000),
  ('a1400000-0000-4000-8000-000000000003', 'a1300000-0000-4000-8006-000000000002',
    'Wedding Production Upgrade Bundle',
    'Standard wedding audio and lighting paired with large-format LED-wall production.',
    96050, 'event', '["Reception sound system","Wedding lighting","5 x 3 meter LED wall","Stage and technical crew","Backup power"]',
    'composed', 113000, 'percentage', 15, 16950),
  ('a1400000-0000-4000-8000-000000000004', 'a1300000-0000-4000-8003-000000000001',
    'Classic 100-Guest Buffet',
    'A fixed headcount option for one hundred guests using the Negros Heritage menu.',
    65000, 'event', '["100 buffet portions","Buffet setup","Service staff","Tableware","Iced tea"]',
    'legacy', null, 'none', 0, 0),
  ('a1400000-0000-4000-8000-000000000005', 'a1300000-0000-4000-8004-000000000002',
    'Single Function Hall',
    'One Sidlak function room configured for up to 120 guests.',
    32000, 'event', '["One function room","Tables and chairs","Three-hour ingress","Projector","Parking"]',
    'legacy', null, 'none', 0, 0),
  ('a1400000-0000-4000-8000-000000000006', 'a1300000-0000-4000-8004-000000000002',
    'Three-Hall Celebration',
    'All three adjoining Sidlak halls opened into one layout for up to 320 guests.',
    78000, 'event', '["Three combined halls","320 chairs","34 tables","Stage","Loading bay"]',
    'legacy', null, 'none', 0, 0),
  ('a1400000-0000-4000-8000-000000000007', 'a1300000-0000-4000-8007-000000000003',
    'Wedding Story with Heirloom Album',
    'Eight-hour photo and film coverage upgraded with a handcrafted thirty-page album.',
    55000, 'event', '["Two photographers","One videographer","Highlight film","600 edited photos","Thirty-page album"]',
    'legacy', null, 'none', 0, 0),
  ('a1400000-0000-4000-8000-000000000008', 'a1300000-0000-4000-8008-000000000001',
    'Extended Wedding Program Hosting',
    'Extended wedding coverage for longer dinner programs and late-evening traditions.',
    12000, 'event', '["Up to seven hosting hours","Custom bilingual script","One rehearsal","Program planning session"]',
    'legacy', null, 'none', 0, 0);

do $$
begin
  if exists (
    select 1
    from multivent_demo_packages seed
    join public.service_packages existing on existing.id = seed.package_id
    where existing.service_id <> seed.host_service_id
      or existing.name <> seed.package_name
  ) then
    raise exception 'A deterministic demo package ID is already used by unrelated data. No seed data was written.';
  end if;
end;
$$;

insert into public.service_packages (
  id, service_id, name, description, price, pricing_unit, inclusions,
  is_active, pricing_mode, subtotal, discount_type, discount_value,
  discount_amount, is_deleted
)
select
  package_id, host_service_id, package_name, description, price, pricing_unit,
  inclusions, true, pricing_mode, subtotal, discount_type, discount_value,
  discount_amount, false
from multivent_demo_packages
on conflict (id) do nothing;

insert into public.service_package_items (
  package_id, service_id, quantity, unit_price, position
)
select requested.package_id, requested.service_id, 1, service.base_price, requested.position
from (values
  ('a1400000-0000-4000-8000-000000000001'::uuid, 'a1300000-0000-4000-8001-000000000001'::uuid, 0),
  ('a1400000-0000-4000-8000-000000000001'::uuid, 'a1300000-0000-4000-8001-000000000002'::uuid, 1),
  ('a1400000-0000-4000-8000-000000000001'::uuid, 'a1300000-0000-4000-8001-000000000003'::uuid, 2),
  ('a1400000-0000-4000-8000-000000000002'::uuid, 'a1300000-0000-4000-8002-000000000001'::uuid, 0),
  ('a1400000-0000-4000-8000-000000000002'::uuid, 'a1300000-0000-4000-8002-000000000002'::uuid, 1),
  ('a1400000-0000-4000-8000-000000000002'::uuid, 'a1300000-0000-4000-8002-000000000003'::uuid, 2),
  ('a1400000-0000-4000-8000-000000000003'::uuid, 'a1300000-0000-4000-8006-000000000002'::uuid, 0),
  ('a1400000-0000-4000-8000-000000000003'::uuid, 'a1300000-0000-4000-8006-000000000005'::uuid, 1)
) requested(package_id, service_id, position)
join public.services service on service.id = requested.service_id
on conflict (package_id, service_id) do nothing;

-- Weekly operating hours use the established provider calendar. Closed days
-- are stored explicitly, making schedule behavior visible in demos.
with weekdays(day_of_week, day_order) as (values
  ('monday', 1), ('tuesday', 2), ('wednesday', 3), ('thursday', 4),
  ('friday', 5), ('saturday', 6), ('sunday', 7)
)
insert into public.provider_operating_hours (
  provider_id, day_of_week, is_open, open_time, close_time, timezone
)
select
  provider.id,
  weekday.day_of_week,
  weekday.day_of_week = any(account.open_days),
  case when weekday.day_of_week = any(account.open_days) then account.open_time end,
  case when weekday.day_of_week = any(account.open_days) then account.close_time end,
  'Asia/Manila (GMT+8)'
from multivent_demo_accounts account
join public.provider_profiles provider on provider.user_id = account.user_id
cross join weekdays weekday
where account.account_role = 'service_provider'
on conflict (provider_id, day_of_week) do update
set is_open = excluded.is_open,
    open_time = excluded.open_time,
    close_time = excluded.close_time,
    timezone = excluded.timezone,
    updated_at = now();

-- One deterministic blocked date per provider exercises unavailable-date UI
-- without fabricating a booking conflict.
insert into public.provider_availability (
  id, provider_id, service_id, available_date, start_time, end_time,
  is_available, notes
)
select
  ('a1500000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid,
  provider.id,
  null,
  date '2026-11-15' + (ordinality::integer - 1),
  null,
  null,
  false,
  'Demo blocked date - provider unavailable.'
from unnest(array[
  'provider1@multivent.com','provider2@multivent.com','provider3@multivent.com',
  'provider4@multivent.com','provider5@multivent.com','provider6@multivent.com',
  'provider7@multivent.com','provider8@multivent.com','provider9@multivent.com'
]) with ordinality requested(email, ordinality)
join multivent_demo_accounts account on account.email = requested.email
join public.provider_profiles provider on provider.user_id = account.user_id
on conflict do nothing;

-- Coordinator availability is workforce data, so these blocks use the
-- coordinator table rather than provider operating hours.
insert into public.coordinator_availability (
  id, coordinator_id, starts_at, ends_at, status, reason, created_by
)
select
  ('a1600000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid,
  account.user_id,
  (date '2026-11-20' + (ordinality::integer * 3) + time '08:00') at time zone 'Asia/Manila',
  (date '2026-11-20' + (ordinality::integer * 3) + time '18:00') at time zone 'Asia/Manila',
  case when ordinality = 4 then 'on_leave' else 'unavailable' end,
  'Demo schedule block for availability testing.',
  null
from unnest(array[
  'coordinator1@multivent.com','coordinator2@multivent.com',
  'coordinator3@multivent.com','coordinator4@multivent.com'
]) with ordinality requested(email, ordinality)
join multivent_demo_accounts account on account.email = requested.email
on conflict (id) do nothing;

-- Final integrity checks deliberately fail the transaction instead of leaving
-- a partial marketplace when a schema rule or relationship is incompatible.
do $$
declare
  seeded_services integer;
  seeded_accounts integer;
  seeded_packages integer;
begin
  select count(*) into seeded_accounts
  from multivent_demo_accounts seed
  join auth.users auth_user on auth_user.id = seed.user_id
  join public.profiles profile on profile.id = seed.user_id
  join public.provider_profiles provider on provider.user_id = seed.user_id
  where lower(auth_user.email) = lower(seed.email)
    and profile.default_role = seed.account_role
    and profile.account_status = 'active'
    and provider.verification_status = 'verified';

  if seeded_accounts <> 13 then
    raise exception 'Seed verification failed: expected 13 valid demo accounts, found %.', seeded_accounts;
  end if;

  select count(*) into seeded_services
  from multivent_demo_services definition
  join public.services service on service.id = definition.service_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  join public.service_categories category on category.id = service.category_id
  where lower(profile.email) = lower(definition.account_email)
    and category.name = definition.category_name
    and service.status = 'active'
    and service.is_available = true
    and jsonb_typeof(service.category_details) = 'object'
    and service.category_details ->> 'kind' = definition.category_details ->> 'kind';

  if seeded_services <> 40 then
    raise exception 'Seed verification failed: expected 40 schema-valid services, found %.', seeded_services;
  end if;

  select count(*) into seeded_packages
  from multivent_demo_packages definition
  join public.service_packages package on package.id = definition.package_id
  where package.service_id = definition.host_service_id
    and package.name = definition.package_name
    and package.is_active = true
    and package.is_deleted = false;

  if seeded_packages <> 8 then
    raise exception 'Seed verification failed: expected 8 active packages, found %.', seeded_packages;
  end if;

  if (select count(*) from public.service_package_items
      where package_id in (
        'a1400000-0000-4000-8000-000000000001'::uuid,
        'a1400000-0000-4000-8000-000000000002'::uuid,
        'a1400000-0000-4000-8000-000000000003'::uuid
      )) <> 8
  then
    raise exception 'Seed verification failed: composed package components are incomplete.';
  end if;

  if exists (
    select 1
    from public.service_package_items item
    join public.service_packages package on package.id = item.package_id
    join public.services component on component.id = item.service_id
    join public.services host on host.id = package.service_id
    where package.id in (
      'a1400000-0000-4000-8000-000000000001'::uuid,
      'a1400000-0000-4000-8000-000000000002'::uuid,
      'a1400000-0000-4000-8000-000000000003'::uuid
    ) and component.provider_id <> host.provider_id
  ) then
    raise exception 'Seed verification failed: a composed package crosses provider ownership.';
  end if;
end;
$$;

commit;

-- Expected result:
--   13 login accounts (9 providers + 4 MULTIVENT coordinators)
--   40 active services: 5 attire, 5 florists, 6 catering, 6 venues,
--     4 event organizer, 5 sound & lights, 5 photography, 4 host/emcee
--   8 packages (3 composed bundles and 5 single-service package choices)
--   63 provider operating-hour rows, 9 blocked provider dates,
--   and 4 coordinator schedule blocks
