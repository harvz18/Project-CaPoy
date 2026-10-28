-- Rebuilds the beta marketplace after beta_reset_bookings_and_catalog.sql.
-- Retains accounts/profiles and archives prior listing rows; publishes 50
-- distinct, bookable Provider 1/2 services (no coordinator service listings).
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

create temporary table refresh_provider on commit drop as
select lower(profile.email) as email, provider.id
from public.provider_profiles provider join public.profiles profile on profile.id = provider.user_id
where lower(profile.email) in ('provider1@multivent.com','provider2@multivent.com');

create temporary table refresh_catalog (
  id uuid primary key, category_name text not null, provider_email text not null,
  name text not null, description text not null, base_price numeric not null, image_url text not null
) on commit drop;

insert into refresh_catalog values
  (gen_random_uuid(),'Attire','provider1@multivent.com','Amara Heritage Bridal Gown','Hand-finished Filipiniana bridal gown with fitting support.',28500,'https://loremflickr.com/1200/800/bridal-gown?lock=101'),
  (gen_random_uuid(),'Attire','provider2@multivent.com','Solis Modern Barong Set','Contemporary piña barong and trouser tailoring.',16800,'https://loremflickr.com/1200/800/barong?lock=102'),
  (gen_random_uuid(),'Attire','provider1@multivent.com','Petal Blush Entourage Dresses','Coordinated bridesmaid dress collection in custom tones.',22400,'https://loremflickr.com/1200/800/bridesmaid,dress?lock=103'),
  (gen_random_uuid(),'Attire','provider2@multivent.com','Midnight Groom Tuxedo Package','Classic tuxedo, shirt, bow tie, and final fitting.',14500,'https://loremflickr.com/1200/800/groom,suit?lock=104'),
  (gen_random_uuid(),'Attire','provider1@multivent.com','Garden Silk Bridal Separates','Lightweight two-piece bridal look for garden ceremonies.',19800,'https://loremflickr.com/1200/800/wedding,dress?lock=105'),
  (gen_random_uuid(),'Attire','provider2@multivent.com','Little Entourage Formalwear','Junior entourage outfits with coordinated accessories.',12600,'https://loremflickr.com/1200/800/formalwear?lock=106'),
  (gen_random_uuid(),'Attire','provider1@multivent.com','Heirloom Veil and Accessories','Cathedral veil, hairpiece, and jewelry styling set.',8900,'https://loremflickr.com/1200/800/bridal,veil?lock=107'),
  (gen_random_uuid(),'Catering','provider1@multivent.com','Hearth & Harvest Five-Course Tasting','Five-course custom menu with a guided provider food tasting.',980,'https://loremflickr.com/1200/800/wedding,catering?lock=201'),
  (gen_random_uuid(),'Catering','provider2@multivent.com','Negros Fiesta Buffet','Local favorites buffet with staffed service.',720,'https://loremflickr.com/1200/800/buffet,food?lock=202'),
  (gen_random_uuid(),'Catering','provider1@multivent.com','Coastal Plated Celebration','Three-course plated dinner with seafood-forward choices.',1250,'https://loremflickr.com/1200/800/plated,dinner?lock=203'),
  (gen_random_uuid(),'Catering','provider2@multivent.com','Garden Brunch Table','Morning brunch stations for intimate gatherings.',640,'https://loremflickr.com/1200/800/brunch,food?lock=204'),
  (gen_random_uuid(),'Catering','provider1@multivent.com','Smokehouse Family Feast','Grilled mains, sides, and dessert buffet.',860,'https://loremflickr.com/1200/800/grilled,food?lock=205'),
  (gen_random_uuid(),'Catering','provider2@multivent.com','Filipino Merienda Stations','Interactive merienda and dessert stations.',590,'https://loremflickr.com/1200/800/filipino,food?lock=206'),
  (gen_random_uuid(),'Catering','provider1@multivent.com','Cocktail Canapés Reception','Passed canapés and mocktail pairing service.',780,'https://loremflickr.com/1200/800/canapes?lock=207'),
  (gen_random_uuid(),'Catering','provider2@multivent.com','Executive Lunch Buffet','Polished lunch buffet for corporate celebrations.',840,'https://loremflickr.com/1200/800/lunch,buffet?lock=208'),
  (gen_random_uuid(),'Florists','provider1@multivent.com','Ivory Garden Bridal Florals','Bridal bouquet, boutonnières, and aisle accents.',18500,'https://loremflickr.com/1200/800/bridal,bouquet?lock=301'),
  (gen_random_uuid(),'Florists','provider2@multivent.com','Tropical Reception Bloomscape','Vibrant reception centerpieces and entry florals.',24500,'https://loremflickr.com/1200/800/tropical,flowers?lock=302'),
  (gen_random_uuid(),'Florists','provider1@multivent.com','Mauve Ceremony Flower Story','Soft mauve ceremony arrangements and altar styling.',22000,'https://loremflickr.com/1200/800/ceremony,flowers?lock=303'),
  (gen_random_uuid(),'Florists','provider2@multivent.com','Modern Orchid Tablescape','Contemporary orchid centerpieces for dinner tables.',16800,'https://loremflickr.com/1200/800/orchid,flowers?lock=304'),
  (gen_random_uuid(),'Florists','provider1@multivent.com','Sunset Rose Reception Set','Rose-forward floral styling with warm seasonal color.',19800,'https://loremflickr.com/1200/800/rose,flowers?lock=305'),
  (gen_random_uuid(),'Florists','provider2@multivent.com','Wildflower Garden Arch','Ceremony arch and aisle meadow installation.',32000,'https://loremflickr.com/1200/800/flower,arch?lock=306'),
  (gen_random_uuid(),'Florists','provider1@multivent.com','Petite Celebration Posies','Small-event bouquets, corsages, and table blooms.',11500,'https://loremflickr.com/1200/800/flower,arrangement?lock=307'),
  (gen_random_uuid(),'Venues & Estates','provider1@multivent.com','Aurora Grand Ballroom','Fixed-price ballroom for formal celebrations.',95000,'https://loremflickr.com/1200/800/ballroom,wedding?lock=401'),
  (gen_random_uuid(),'Venues & Estates','provider2@multivent.com','Lakeside Glass Pavilion','Hourly pavilion hire with lakeside ceremony lawn.',8500,'https://loremflickr.com/1200/800/lakeside,pavilion?lock=402'),
  (gen_random_uuid(),'Venues & Estates','provider1@multivent.com','Casa Verde Courtyard','Fixed event package with indoor rain-plan hall.',68000,'https://loremflickr.com/1200/800/courtyard,wedding?lock=403'),
  (gen_random_uuid(),'Venues & Estates','provider2@multivent.com','The Foundry Function Rooms','Provider-configured room and hall combinations.',7200,'https://loremflickr.com/1200/800/function,hall?lock=404'),
  (gen_random_uuid(),'Venues & Estates','provider1@multivent.com','Hacienda Sunset Garden','Open-air garden estate fixed event package.',78000,'https://loremflickr.com/1200/800/garden,wedding?lock=405'),
  (gen_random_uuid(),'Venues & Estates','provider2@multivent.com','Silay Heritage House','Hourly heritage-house reception booking.',6200,'https://loremflickr.com/1200/800/heritage,house?lock=406'),
  (gen_random_uuid(),'Venues & Estates','provider1@multivent.com','North Grove Event Lawn','Fixed festival lawn package for large guest counts.',112000,'https://loremflickr.com/1200/800/event,lawn?lock=407'),
  (gen_random_uuid(),'Host/Emcee','provider1@multivent.com','Arielle Wedding Host','Warm bilingual hosting for wedding receptions.',12500,'https://loremflickr.com/1200/800/wedding,host?lock=501'),
  (gen_random_uuid(),'Host/Emcee','provider2@multivent.com','Marco Party Emcee','High-energy program hosting for birthdays and debuts.',9800,'https://loremflickr.com/1200/800/event,emcee?lock=502'),
  (gen_random_uuid(),'Host/Emcee','provider1@multivent.com','Celeste Corporate Moderator','Professional corporate program moderation.',15000,'https://loremflickr.com/1200/800/conference,speaker?lock=503'),
  (gen_random_uuid(),'Host/Emcee','provider2@multivent.com','Noel Bilingual Celebrations','English-Filipino reception hosting package.',11800,'https://loremflickr.com/1200/800/microphone,host?lock=504'),
  (gen_random_uuid(),'Host/Emcee','provider1@multivent.com','Mika Intimate Events Host','Relaxed hosting for family dinners and small weddings.',7600,'https://loremflickr.com/1200/800/intimate,event?lock=505'),
  (gen_random_uuid(),'Host/Emcee','provider2@multivent.com','The Reception Duo','Two-host package for full-day programs.',18500,'https://loremflickr.com/1200/800/event,presenter?lock=506'),
  (gen_random_uuid(),'Host/Emcee','provider1@multivent.com','Raya Debut Storyteller','Debut and milestone celebration emcee.',10800,'https://loremflickr.com/1200/800/debut,party?lock=507'),
  (gen_random_uuid(),'Photography','provider1@multivent.com','Lumen Four-Hour Photo Story','Essential photography coverage for intimate events.',18500,'https://loremflickr.com/1200/800/wedding,photography?lock=601'),
  (gen_random_uuid(),'Photography','provider2@multivent.com','Golden Hour Photo and Film','Six-hour photo and highlight-film package.',34000,'https://loremflickr.com/1200/800/camera,wedding?lock=602'),
  (gen_random_uuid(),'Photography','provider1@multivent.com','Cinematic Full-Day Collection','Full-day documentary coverage and film.',58000,'https://loremflickr.com/1200/800/film,wedding?lock=603'),
  (gen_random_uuid(),'Photography','provider2@multivent.com','Portrait Studio Pop-Up','Event portrait studio with instant digital gallery.',22000,'https://loremflickr.com/1200/800/portrait,studio?lock=604'),
  (gen_random_uuid(),'Photography','provider1@multivent.com','Heirloom Wedding Album Story','Photo coverage with premium printed album.',46500,'https://loremflickr.com/1200/800/wedding,album?lock=605'),
  (gen_random_uuid(),'Photography','provider2@multivent.com','Pre-Wedding City Session','Engagement session with edited digital collection.',14500,'https://loremflickr.com/1200/800/couple,portrait?lock=606'),
  (gen_random_uuid(),'Photography','provider1@multivent.com','Same-Day Edit Film Team','Photo plus same-day edit film crew.',72000,'https://loremflickr.com/1200/800/videographer,wedding?lock=607'),
  (gen_random_uuid(),'Sound & Lights','provider1@multivent.com','Sage Intimate Audio','Sound system and technician for up to 80 guests.',9500,'https://loremflickr.com/1200/800/sound,system?lock=701'),
  (gen_random_uuid(),'Sound & Lights','provider2@multivent.com','Prism Wedding Sound and Lights','Audio, uplighting, and four microphones.',18500,'https://loremflickr.com/1200/800/stage,lighting?lock=702'),
  (gen_random_uuid(),'Sound & Lights','provider1@multivent.com','Open-Air Festival Audio','Outdoor-ready speakers and generator backup.',26500,'https://loremflickr.com/1200/800/outdoor,concert?lock=703'),
  (gen_random_uuid(),'Sound & Lights','provider2@multivent.com','Velvet Stage Production','Stage, moving heads, and technical crew.',42000,'https://loremflickr.com/1200/800/concert,lights?lock=704'),
  (gen_random_uuid(),'Sound & Lights','provider1@multivent.com','LED Wall Celebration Set','LED wall, audio, lighting, and operators.',68000,'https://loremflickr.com/1200/800/led,wall?lock=705'),
  (gen_random_uuid(),'Sound & Lights','provider2@multivent.com','Acoustic Ceremony Package','Ceremony audio and wireless lapel microphones.',12000,'https://loremflickr.com/1200/800/ceremony,sound?lock=706'),
  (gen_random_uuid(),'Sound & Lights','provider1@multivent.com','After-Party DJ Lighting','Dance-floor lighting and DJ-ready sound.',23500,'https://loremflickr.com/1200/800/dj,lighting?lock=707');

create temporary table refresh_sources on commit drop as
select distinct on (category.name) category.name as category_name, service.*
from public.services service join public.service_categories category on category.id = service.category_id
where category.name in (select distinct category_name from refresh_catalog)
order by category.name, service.created_at, service.id;

insert into public.services (id,provider_id,category_id,name,description,base_price,location,cover_image_url,gallery_urls,pricing_model,pricing_unit,pricing_details,catering_service_types,category_details,status,is_available,submission_kind)
select catalog.id, provider.id, source.category_id, catalog.name, catalog.description, catalog.base_price,
  coalesce(source.location,'Bacolod City and nearby Negros Occidental areas'), catalog.image_url, jsonb_build_array(catalog.image_url),
  source.pricing_model, source.pricing_unit, source.pricing_details,
  case when catalog.category_name = 'Catering' then array['buffet','plated']::text[] else source.catering_service_types end, source.category_details,
  case when catalog.category_name = 'Florists' then 'draft' else 'pending_review' end, true, 'new'
from refresh_catalog catalog join refresh_provider provider on provider.email = catalog.provider_email
join refresh_sources source on source.category_name = catalog.category_name;

-- The tasting listing has five courses. Clients taste five of ten dishes in
-- every course; the provider's existing final-menu tool subsequently keeps
-- the configured final number (three) from each client-tasted set.
with courses(id,name,items) as (
  values
    ('appetizer','Appetizers',array['Lumpiang Ubod','Prawn Toast','Chicken Satay','Mushroom Tart','Tuna Tartare','Crispy Calamari','Caprese Skewer','Beef Empanada','Corn Fritter','Stuffed Pepper']),
    ('soup','Soups',array['Roasted Pumpkin Soup','Sinigang Consommé','Mushroom Velouté','Seafood Chowder','Chicken Tinola','Tomato Basil Soup','Corn Soup','Buko Soup','Beef Nilaga Broth','Miso Vegetable Soup']),
    ('salad','Salads',array['Mango Green Salad','Caesar Salad','Pomelo Salad','Garden Salad','Pasta Primavera','Quinoa Salad','Cucumber Salad','Roasted Beet Salad','Asian Slaw','Watermelon Feta Salad']),
    ('main','Main Course',array['Chicken Inasal','Beef Caldereta','Calamansi Fish','Mushroom Chicken','Pork Belly','Vegetable Lasagna','Herb Salmon','Beef Rendang','Tofu Steak','Lamb Shank']),
    ('dessert','Desserts',array['Tablea Tart','Mango Float','Leche Flan','Ube Cheesecake','Buko Pandan','Sans Rival','Banoffee Pie','Coconut Panna Cotta','Bibingka','Chocolate Mousse'])
), sections as (
  select jsonb_agg(jsonb_build_object('id',id,'name',name,'minimumSelections',1,'maximumSelections',3,'tastingSelectionLimit',5,'finalSelectionLimit',3,'items',(
    select jsonb_agg(jsonb_build_object('id',courses.id||'-'||ordinality,'name',dish,'pricePerHead',120,'isActive',true)) from unnest(items) with ordinality item(dish,ordinality)
  ))) as value from courses
)
update public.services service set category_details=jsonb_build_object(
  'kind','catering','schemaVersion',15,'cateringTypes',jsonb_build_array('Buffet','Plated'),'cuisines',jsonb_build_array('Filipino','Western'),'pricingBasis','per_person','minimumGuests',30,'maximumGuests',250,
  'customMenuSections',sections.value,'tastingSettings',jsonb_build_object('enabled',true,'location','Hearth & Harvest Tasting Room, Bacolod City','tastingTimeSlots',jsonb_build_array('10:00','14:00'),'durationMinutes',90,'minimumLeadDays',1,'latestDaysBeforeEvent',7),
  'dietaryOptions',jsonb_build_array('Vegetarian','Gluten-Free'),'drinksIncluded',true,'servingStaffIncluded',true,'tablewareIncluded',true,'setupCleanupIncluded',true,'serviceArea','Bacolod and nearby cities','preparationLeadTime',7,'preparationLeadTimeUnit','days'
), pricing_model='startingAt',pricing_unit='person',pricing_details='Five-course food tasting: select 5 of 10 dishes in every course; the provider finalizes up to 3 tasted dishes per course.'
from sections where service.id=(select id from refresh_catalog where name='Hearth & Harvest Five-Course Tasting');

-- Preserve both pricing styles: event packages and hourly venue rentals.
update public.services service set category_details=jsonb_build_object('kind','venues','schemaVersion',8,'venueType','Ballroom','address','Bacolod City','openingTime','09:00','closingTime','23:00','minimumBookingHours',6,'maximumBookingHours',12,'bookingDurationIncrementHours',1,'spaces',jsonb_build_array(jsonb_build_object('id','aurora-grand','name','Grand Ballroom','areaSqm',480,'capacity',350,'spaceType','Indoor','isActive',true,'isBookableIndividually',true,'pricingUnit','event','baseRate',95000,'includedDurationHours',10,'inclusions',jsonb_build_array('Tables','Chairs','Stage','Dressing room'))),'combinations','[]'::jsonb,'airConditioning',true,'chairs',true,'tables',true,'parking',true,'restrooms',true,'dressingRoom',true,'wifi',true,'stage',true,'pwdAccessibility',true)
where service.id=(select id from refresh_catalog where name='Aurora Grand Ballroom');
update public.services service set category_details=jsonb_build_object('kind','venues','schemaVersion',8,'venueType','Pavilion','address','Talisay City','openingTime','08:00','closingTime','22:00','minimumBookingHours',4,'maximumBookingHours',12,'bookingDurationIncrementHours',1,'spaces',jsonb_build_array(jsonb_build_object('id','lakeside-pavilion','name','Glass Pavilion','areaSqm',220,'capacity',160,'spaceType','Indoor','isActive',true,'isBookableIndividually',true,'pricingUnit','hour','baseRate',8500,'includedDurationHours',1,'inclusions',jsonb_build_array('Garden access','Tables','Chairs'))),'combinations','[]'::jsonb,'airConditioning',true,'chairs',true,'tables',true,'parking',true,'restrooms',true,'dressingRoom',true,'wifi',true,'stage',false,'pwdAccessibility',true)
where service.id=(select id from refresh_catalog where name='Lakeside Glass Pavilion');

-- Florist selections are provider-owned records, not just JSON. Clone the
-- established arrangement/fulfillment configuration for every new florist
-- listing so each remains immediately bookable.
create temporary table refresh_florist_arrangements (service_id uuid, source_id uuid, id uuid primary key) on commit drop;
insert into refresh_florist_arrangements
select catalog.id, arrangement.id, gen_random_uuid()
from refresh_catalog catalog cross join public.florist_arrangements arrangement
where catalog.category_name = 'Florists' and arrangement.service_id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid;
insert into public.florist_arrangements (id,service_id,name,category,description,image_urls,base_price,pricing_unit,minimum_quantity,maximum_quantity,is_active,display_order)
select map.id,map.service_id,source.name,source.category,source.description,source.image_urls,source.base_price,source.pricing_unit,source.minimum_quantity,source.maximum_quantity,source.is_active,source.display_order
from refresh_florist_arrangements map join public.florist_arrangements source on source.id = map.source_id;
create temporary table refresh_florist_groups (source_id uuid, id uuid primary key, service_id uuid) on commit drop;
insert into refresh_florist_groups
select source.id,gen_random_uuid(),map.service_id from refresh_florist_arrangements map join public.florist_arrangement_option_groups source on source.arrangement_id = map.source_id;
insert into public.florist_arrangement_option_groups (id,arrangement_id,name,selection_type,is_required,minimum_selections,maximum_selections,is_active,display_order)
select map.id,arrangement.id,source.name,source.selection_type,source.is_required,source.minimum_selections,source.maximum_selections,source.is_active,source.display_order
from refresh_florist_groups map join public.florist_arrangement_option_groups source on source.id=map.source_id join refresh_florist_arrangements arrangement on arrangement.service_id=map.service_id and arrangement.source_id=source.arrangement_id;
insert into public.florist_arrangement_options (option_group_id,name,description,image_url,price_modifier,price_modifier_type,is_active,display_order)
select map.id,source.name,source.description,source.image_url,source.price_modifier,source.price_modifier_type,source.is_active,source.display_order
from refresh_florist_groups map join public.florist_arrangement_options source on source.option_group_id=map.source_id;
insert into public.florist_service_fulfillment_options (service_id,fulfillment_kind,name,description,coverage_details,price,is_active,display_order)
select catalog.id,source.fulfillment_kind,source.name,source.description,source.coverage_details,source.price,source.is_active,source.display_order
from refresh_catalog catalog cross join public.florist_service_fulfillment_options source
where catalog.category_name='Florists' and source.service_id='dadf546d-4500-4509-b72f-f84add11ac40'::uuid;

update public.services service set status = 'pending_review', updated_at = now()
where service.id in (select id from refresh_catalog where category_name = 'Florists');

-- Only coordinator1 and coordinator2 remain available in the client coordinator marketplace.
update public.coordinator_service_profiles profile set is_accepting_bookings = (owner.email in ('coordinator1@multivent.com','coordinator2@multivent.com')), updated_at = now()
from public.profiles owner where owner.id = profile.coordinator_id and owner.default_role = 'event_coordinator';

-- Publish through the moderation workflow.
select set_config('request.jwt.claim.sub','4d6476ce-928d-442c-bf1a-87218a0263c4',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare service_id uuid; begin
  for service_id in select id from refresh_catalog loop perform public.admin_review_service(service_id,'approved','Varied beta marketplace listing verified.'); end loop;
end $$;
commit;
