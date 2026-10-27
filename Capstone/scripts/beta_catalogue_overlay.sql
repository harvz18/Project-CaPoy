-- One-time beta overlay applied after seed_demo_marketplace.sql.
-- It adds a fully configured catering flow, provider-defined venue choices,
-- and complete public coordinator profiles without creating or deleting users.

begin;

with target as (
  select provider.id as provider_id, category.id as category_id
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  join public.service_categories category on lower(trim(category.name)) = 'catering'
  where lower(profile.email) = 'provider3@multivent.com'
)
insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available,
  submission_kind, moderated_at
)
select
  'b1300000-0000-4000-8003-000000000001'::uuid,
  target.provider_id, target.category_id,
  'Beta Signature Menu with Food Tasting',
  'A beta-ready catering offering with two fixed menus, a fully item-priced custom menu, and an optional provider-approved food tasting.',
  680, 'Bacolod City and nearby Negros Occidental areas',
  '[]'::jsonb, 'startingAt', 'person',
  'Choose a preset menu or build your own. Food tasting clients choose exactly five dishes from each course, then the provider finalizes only from those tasted dishes.',
  array['buffet','plated'],
  $json$
  {
    "kind":"catering","schemaVersion":15,
    "cateringTypes":["Buffet","Plated"],"cuisines":["Filipino","Western"],
    "pricingBasis":"per_person","minimumGuests":30,"maximumGuests":250,
    "pricingOptions":[
      {"id":"beta-classic-buffet","name":"Classic Celebration Buffet","pricePerHead":680,"minimumGuests":30,"maximumGuests":250,"menuSections":[{"id":"classic-main","name":"Mains","items":["Chicken Inasal","Beef Caldereta"]},{"id":"classic-dessert","name":"Dessert","items":["Leche Flan"]}]},
      {"id":"beta-plated-dinner","name":"Signature Plated Dinner","pricePerHead":980,"minimumGuests":30,"maximumGuests":180,"menuSections":[{"id":"plated-main","name":"Mains","items":["Herb Chicken Roulade","Calamansi Fish Fillet"]},{"id":"plated-dessert","name":"Dessert","items":["Tablea Tart"]}]}
    ],
    "customMenuSections":[
      {"id":"beta-mains","name":"Main Course","minimumSelections":1,"maximumSelections":2,"tastingSelectionLimit":5,"finalSelectionLimit":2,"items":[
        {"id":"beta-main-1","name":"Chicken Inasal Supreme","pricePerHead":190,"isActive":true},{"id":"beta-main-2","name":"Beef Caldereta","pricePerHead":240,"isActive":true},{"id":"beta-main-3","name":"Calamansi Fish Fillet","pricePerHead":225,"isActive":true},{"id":"beta-main-4","name":"Mushroom Stuffed Chicken","pricePerHead":215,"isActive":true},{"id":"beta-main-5","name":"Vegetable Lasagna","pricePerHead":175,"isActive":true}
      ]},
      {"id":"beta-desserts","name":"Dessert","minimumSelections":1,"maximumSelections":2,"tastingSelectionLimit":5,"finalSelectionLimit":1,"items":[
        {"id":"beta-dessert-1","name":"Tablea Chocolate Tart","pricePerHead":95,"isActive":true},{"id":"beta-dessert-2","name":"Mango Float","pricePerHead":85,"isActive":true},{"id":"beta-dessert-3","name":"Leche Flan","pricePerHead":80,"isActive":true},{"id":"beta-dessert-4","name":"Buko Pandan","pricePerHead":75,"isActive":true},{"id":"beta-dessert-5","name":"Ube Cheesecake","pricePerHead":110,"isActive":true}
      ]}
    ],
    "tastingSettings":{"enabled":true,"location":"Hearth & Harvest Tasting Room, Bacolod City","tastingTimeSlots":["10:00","14:00"],"durationMinutes":60,"minimumLeadDays":1,"latestDaysBeforeEvent":7},
    "dietaryOptions":["Vegetarian","Gluten-Free"],"drinksIncluded":true,"servingStaffIncluded":true,"tablewareIncluded":true,"setupCleanupIncluded":true,"serviceArea":"Bacolod, Talisay, Silay, Bago, and Murcia","preparationLeadTime":7,"preparationLeadTimeUnit":"days"
  }
  $json$::jsonb,
  'active', true, 'new', now()
from target
on conflict (id) do update set
  provider_id = excluded.provider_id, category_id = excluded.category_id,
  name = excluded.name, description = excluded.description, base_price = excluded.base_price,
  location = excluded.location, gallery_urls = excluded.gallery_urls,
  pricing_model = excluded.pricing_model, pricing_unit = excluded.pricing_unit,
  pricing_details = excluded.pricing_details, catering_service_types = excluded.catering_service_types,
  category_details = excluded.category_details, status = 'active', is_available = true,
  moderated_at = now(), updated_at = now();

-- The flexible venue has four provider-published options. A combined hall is
-- an option in its own right; clients cannot build a new combination.
update public.services
set category_details = $json$
{
  "kind":"venues","schemaVersion":8,"venueType":"Function Hall","address":"Mandalagan district, Bacolod City",
  "openingTime":"08:00","closingTime":"22:00","minimumBookingHours":4,"maximumBookingHours":12,"bookingDurationIncrementHours":1,"setupAllowanceHours":2,"setupAllowanceBillable":false,
  "spaces":[
    {"id":"sidlak-hall-1","name":"Function Hall 1","areaSqm":120,"capacity":100,"spaceType":"Indoor","isActive":true,"isBookableIndividually":true,"allowsCombination":true,"pricingUnit":"event","baseRate":32000,"includedDurationHours":8,"inclusions":["Tables","Chairs","Projector"]},
    {"id":"sidlak-hall-2","name":"Function Hall 2","areaSqm":150,"capacity":120,"spaceType":"Indoor","isActive":true,"isBookableIndividually":true,"allowsCombination":true,"pricingUnit":"event","baseRate":36000,"includedDurationHours":8,"inclusions":["Tables","Chairs","Projector"]},
    {"id":"sidlak-hall-3","name":"Function Hall 3","areaSqm":120,"capacity":100,"spaceType":"Indoor","isActive":true,"isBookableIndividually":true,"allowsCombination":true,"pricingUnit":"event","baseRate":32000,"includedDurationHours":8,"inclusions":["Tables","Chairs","Projector"]}
  ],
  "combinations":[
    {"id":"sidlak-combo-12","name":"Hall 1 + Hall 2","spaceIds":["sidlak-hall-1","sidlak-hall-2"],"combinedAreaSqm":270,"combinedCapacity":220,"isActive":true,"isBookableIndividually":true,"pricingUnit":"event","baseRate":62000,"includedDurationHours":8,"inclusions":["Combined halls","Stage","Tables and chairs"]},
    {"id":"sidlak-combo-123","name":"All Three Halls","spaceIds":["sidlak-hall-1","sidlak-hall-2","sidlak-hall-3"],"combinedAreaSqm":390,"combinedCapacity":320,"isActive":true,"isBookableIndividually":true,"pricingUnit":"event","baseRate":78000,"includedDurationHours":10,"inclusions":["Combined halls","Stage","Tables and chairs","Loading bay"]}
  ],
  "airConditioning":true,"chairs":true,"chairsQuantity":320,"tables":true,"tablesQuantity":34,"parking":true,"parkingQuantity":65,"restrooms":true,"restroomsQuantity":6,"dressingRoom":true,"wifi":true,"stage":true,"pwdAccessibility":true
}
$json$::jsonb,
status = 'active', is_available = true, updated_at = now()
where id = 'a1300000-0000-4000-8004-000000000002'::uuid;

-- Bookable coordinator profiles show full fees, capabilities, and the
-- existing clickable verified-feedback summaries in the client UI.
update public.coordinator_service_profiles profile
set description = beta_profile.description,
    coordination_fee = beta_profile.coordination_fee,
    specializations = beta_profile.specializations,
    years_experience = beta_profile.years_experience,
    event_types_handled = beta_profile.event_types_handled,
    skills = beta_profile.skills,
    capabilities = beta_profile.capabilities,
    certifications = beta_profile.certifications,
    portfolio_summary = beta_profile.portfolio_summary,
    service_inclusions = beta_profile.service_inclusions,
    availability_notes = 'Available for beta bookings subject to the event schedule.',
    is_accepting_bookings = true,
    updated_at = now()
from (
  values
    ('coordinator1@multivent.com', 'Full-service wedding coordination from planning through event-day execution.', 18000::numeric, array['Weddings','Church ceremonies']::text[], 8, array['Wedding','Debut','Anniversary']::text[], array['Timeline design','Supplier coordination','Program flow']::text[], array['Budget tracking','On-site coordination','Vendor briefing']::text[], array['Event management training']::text[], 'Eight years coordinating polished, guest-focused celebrations.', array['Planning consultation','Supplier coordination','Event-day management']::text[]),
    ('coordinator2@multivent.com', 'Social-event coordination for birthdays, anniversaries, and intimate celebrations.', 14000::numeric, array['Social events','Family celebrations']::text[], 6, array['Birthday','Anniversary','Debut']::text[], array['Run-of-show','Client communication','Guest flow']::text[], array['Supplier follow-up','Program coordination','On-site support']::text[], array['Event management training']::text[], 'Experienced in warm, well-paced social gatherings.', array['Planning consultation','Program coordination','Event-day support']::text[])
) as beta_profile(email, description, coordination_fee, specializations, years_experience, event_types_handled, skills, capabilities, certifications, portfolio_summary, service_inclusions)
join public.profiles owner on lower(owner.email) = beta_profile.email
where profile.coordinator_id = owner.id;

commit;
