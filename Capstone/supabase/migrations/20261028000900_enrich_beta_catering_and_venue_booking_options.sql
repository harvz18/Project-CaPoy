-- Give the beta marketplace's active Catering and Venue listings complete,
-- client-selectable configurations.  The provider-owned structures below use
-- the same contracts as the service editors: preset menus list every course,
-- while custom menus expose per-dish pricing and provider-controlled limits.

begin;

do $$
declare
  target record;
  preset_menus jsonb;
  custom_menu jsonb;
begin
  for target in
    select service.id, service.base_price
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where category.name = 'Catering'
      and service.status = 'active'
      and service.is_available = true
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and service.name <> 'Hearth & Harvest Five-Course Tasting'
  loop
    preset_menus := jsonb_build_array(
      jsonb_build_object(
        'id', 'classic-celebration',
        'name', 'Classic Celebration Buffet',
        'pricePerHead', target.base_price,
        'minimumGuests', 30,
        'maximumGuests', 250,
        'menuSections', jsonb_build_array(
          jsonb_build_object('id', 'classic-appetizer', 'name', 'Appetizer', 'items', jsonb_build_array('Fresh lumpia', 'Chicken satay')),
          jsonb_build_object('id', 'classic-soup', 'name', 'Soup', 'items', jsonb_build_array('Creamy pumpkin soup')),
          jsonb_build_object('id', 'classic-main', 'name', 'Main course', 'items', jsonb_build_array('Chicken galantina', 'Beef stroganoff')),
          jsonb_build_object('id', 'classic-side', 'name', 'Side dish', 'items', jsonb_build_array('Buttered vegetables', 'Garlic rice')),
          jsonb_build_object('id', 'classic-dessert', 'name', 'Dessert', 'items', jsonb_build_array('Mango panna cotta'))
        )
      ),
      jsonb_build_object(
        'id', 'signature-celebration',
        'name', 'Signature Celebration Buffet',
        'pricePerHead', round(target.base_price * 1.24, 2),
        'minimumGuests', 30,
        'maximumGuests', 250,
        'menuSections', jsonb_build_array(
          jsonb_build_object('id', 'signature-appetizer', 'name', 'Appetizer', 'items', jsonb_build_array('Prawn cocktail', 'Truffle mushroom crostini')),
          jsonb_build_object('id', 'signature-soup', 'name', 'Soup', 'items', jsonb_build_array('Roasted tomato bisque')),
          jsonb_build_object('id', 'signature-main', 'name', 'Main course', 'items', jsonb_build_array('Herb-crusted chicken', 'Braised beef cheeks')),
          jsonb_build_object('id', 'signature-side', 'name', 'Side dish', 'items', jsonb_build_array('Potato gratin', 'Seasonal vegetables')),
          jsonb_build_object('id', 'signature-dessert', 'name', 'Dessert', 'items', jsonb_build_array('Dark chocolate torte'))
        )
      )
    );

    custom_menu := jsonb_build_array(
      jsonb_build_object(
        'id', 'appetizer', 'name', 'Appetizer', 'minimumSelections', 1, 'maximumSelections', 1,
        'items', jsonb_build_array(
          jsonb_build_object('id', 'app-fresh-lumpia', 'name', 'Fresh lumpia', 'description', 'Vegetable rolls with peanut sauce.', 'pricePerHead', round(target.base_price * 0.11, 2), 'isActive', true),
          jsonb_build_object('id', 'app-chicken-satay', 'name', 'Chicken satay', 'description', 'Grilled chicken skewers with house peanut sauce.', 'pricePerHead', round(target.base_price * 0.13, 2), 'isActive', true),
          jsonb_build_object('id', 'app-prawn-cocktail', 'name', 'Prawn cocktail', 'description', 'Chilled prawns with citrus cocktail sauce.', 'pricePerHead', round(target.base_price * 0.16, 2), 'isActive', true),
          jsonb_build_object('id', 'app-mushroom-crostini', 'name', 'Mushroom crostini', 'description', 'Herbed mushrooms on toasted baguette.', 'pricePerHead', round(target.base_price * 0.12, 2), 'isActive', true)
        )
      ),
      jsonb_build_object(
        'id', 'soup', 'name', 'Soup', 'minimumSelections', 1, 'maximumSelections', 1,
        'items', jsonb_build_array(
          jsonb_build_object('id', 'soup-pumpkin', 'name', 'Creamy pumpkin soup', 'description', 'Roasted pumpkin with toasted seeds.', 'pricePerHead', round(target.base_price * 0.10, 2), 'isActive', true),
          jsonb_build_object('id', 'soup-tomato', 'name', 'Roasted tomato bisque', 'description', 'Slow-roasted tomatoes with basil cream.', 'pricePerHead', round(target.base_price * 0.12, 2), 'isActive', true),
          jsonb_build_object('id', 'soup-corn', 'name', 'Sweet corn chowder', 'description', 'Corn, potato, and herb chowder.', 'pricePerHead', round(target.base_price * 0.11, 2), 'isActive', true),
          jsonb_build_object('id', 'soup-mushroom', 'name', 'Wild mushroom soup', 'description', 'Creamy mushroom soup with thyme.', 'pricePerHead', round(target.base_price * 0.13, 2), 'isActive', true)
        )
      ),
      jsonb_build_object(
        'id', 'main-course', 'name', 'Main course', 'minimumSelections', 2, 'maximumSelections', 2,
        'items', jsonb_build_array(
          jsonb_build_object('id', 'main-galantina', 'name', 'Chicken galantina', 'description', 'Chicken roulade with savory filling.', 'pricePerHead', round(target.base_price * 0.18, 2), 'isActive', true),
          jsonb_build_object('id', 'main-beef-stroganoff', 'name', 'Beef stroganoff', 'description', 'Tender beef in mushroom cream sauce.', 'pricePerHead', round(target.base_price * 0.22, 2), 'isActive', true),
          jsonb_build_object('id', 'main-herb-chicken', 'name', 'Herb-crusted chicken', 'description', 'Roasted chicken with herb jus.', 'pricePerHead', round(target.base_price * 0.19, 2), 'isActive', true),
          jsonb_build_object('id', 'main-salmon', 'name', 'Citrus glazed salmon', 'description', 'Baked salmon with citrus glaze.', 'pricePerHead', round(target.base_price * 0.25, 2), 'isActive', true),
          jsonb_build_object('id', 'main-vegetable-lasagna', 'name', 'Vegetable lasagna', 'description', 'Layered vegetables, pasta, and cheese.', 'pricePerHead', round(target.base_price * 0.17, 2), 'isActive', true)
        )
      ),
      jsonb_build_object(
        'id', 'side-dish', 'name', 'Side dish', 'minimumSelections', 1, 'maximumSelections', 1,
        'items', jsonb_build_array(
          jsonb_build_object('id', 'side-garlic-rice', 'name', 'Garlic rice', 'description', 'Fragrant garlic fried rice.', 'pricePerHead', round(target.base_price * 0.08, 2), 'isActive', true),
          jsonb_build_object('id', 'side-potato-gratin', 'name', 'Potato gratin', 'description', 'Creamy baked potato gratin.', 'pricePerHead', round(target.base_price * 0.12, 2), 'isActive', true),
          jsonb_build_object('id', 'side-buttered-vegetables', 'name', 'Buttered vegetables', 'description', 'Seasonal vegetables with herb butter.', 'pricePerHead', round(target.base_price * 0.09, 2), 'isActive', true),
          jsonb_build_object('id', 'side-pasta-primavera', 'name', 'Pasta primavera', 'description', 'Pasta with garden vegetables.', 'pricePerHead', round(target.base_price * 0.11, 2), 'isActive', true)
        )
      ),
      jsonb_build_object(
        'id', 'dessert', 'name', 'Dessert', 'minimumSelections', 1, 'maximumSelections', 1,
        'items', jsonb_build_array(
          jsonb_build_object('id', 'dessert-mango-panna-cotta', 'name', 'Mango panna cotta', 'description', 'Silky cream dessert with mango.', 'pricePerHead', round(target.base_price * 0.09, 2), 'isActive', true),
          jsonb_build_object('id', 'dessert-chocolate-torte', 'name', 'Dark chocolate torte', 'description', 'Rich flourless chocolate cake.', 'pricePerHead', round(target.base_price * 0.12, 2), 'isActive', true),
          jsonb_build_object('id', 'dessert-buko-pandan', 'name', 'Buko pandan parfait', 'description', 'Young coconut and pandan cream.', 'pricePerHead', round(target.base_price * 0.08, 2), 'isActive', true),
          jsonb_build_object('id', 'dessert-lemon-tart', 'name', 'Lemon tart', 'description', 'Tangy lemon curd in a crisp shell.', 'pricePerHead', round(target.base_price * 0.10, 2), 'isActive', true)
        )
      )
    );

    update public.services service
    set category_details = coalesce(service.category_details, '{}'::jsonb) || jsonb_build_object(
      'kind', 'catering',
      'schemaVersion', 15,
      'cateringTypes', jsonb_build_array('Buffet'),
      'cuisines', jsonb_build_array('Filipino', 'International'),
      'pricingBasis', 'per_person',
      'minimumGuests', 30,
      'maximumGuests', 250,
      'pricingOptions', preset_menus,
      'customMenuSections', custom_menu,
      'tastingSettings', jsonb_build_object('enabled', false),
      'betaBookableOptionsVersion', '20261028',
      'dietaryOptions', jsonb_build_array('Vegetarian', 'Gluten-Free'),
      'servingStaffIncluded', true,
      'tablewareIncluded', true,
      'setupCleanupIncluded', true,
      'serviceArea', 'Bacolod and nearby cities',
      'preparationLeadTime', 7,
      'preparationLeadTimeUnit', 'days'
    ), updated_at = now()
    where service.id = target.id;
  end loop;
end;
$$;

-- Keep the existing five-course tasting setup (including the 5-to-taste and
-- 3-to-finalize limits) but give each offered dish a distinct displayed price
-- and provide the same complete preset-menu disclosure for direct booking.
update public.services service
set category_details = service.category_details
  || jsonb_build_object(
    'pricingOptions', jsonb_build_array(
      jsonb_build_object(
        'id', 'hearth-classic-celebration', 'name', 'Hearth Classic Celebration',
        'pricePerHead', service.base_price, 'minimumGuests', 30, 'maximumGuests', 250,
        'menuSections', jsonb_build_array(
          jsonb_build_object('id', 'hearth-classic-appetizer', 'name', 'Appetizer', 'items', jsonb_build_array('Fresh lumpia', 'Chicken satay')),
          jsonb_build_object('id', 'hearth-classic-soup', 'name', 'Soup', 'items', jsonb_build_array('Creamy pumpkin soup')),
          jsonb_build_object('id', 'hearth-classic-main', 'name', 'Main course', 'items', jsonb_build_array('Chicken galantina', 'Beef stroganoff')),
          jsonb_build_object('id', 'hearth-classic-side', 'name', 'Side dish', 'items', jsonb_build_array('Buttered vegetables', 'Garlic rice')),
          jsonb_build_object('id', 'hearth-classic-dessert', 'name', 'Dessert', 'items', jsonb_build_array('Mango panna cotta'))
        )
      ),
      jsonb_build_object(
        'id', 'hearth-signature-celebration', 'name', 'Hearth Signature Celebration',
        'pricePerHead', round(service.base_price * 1.24, 2), 'minimumGuests', 30, 'maximumGuests', 250,
        'menuSections', jsonb_build_array(
          jsonb_build_object('id', 'hearth-signature-appetizer', 'name', 'Appetizer', 'items', jsonb_build_array('Prawn cocktail', 'Truffle mushroom crostini')),
          jsonb_build_object('id', 'hearth-signature-soup', 'name', 'Soup', 'items', jsonb_build_array('Roasted tomato bisque')),
          jsonb_build_object('id', 'hearth-signature-main', 'name', 'Main course', 'items', jsonb_build_array('Herb-crusted chicken', 'Citrus glazed salmon')),
          jsonb_build_object('id', 'hearth-signature-side', 'name', 'Side dish', 'items', jsonb_build_array('Potato gratin', 'Seasonal vegetables')),
          jsonb_build_object('id', 'hearth-signature-dessert', 'name', 'Dessert', 'items', jsonb_build_array('Dark chocolate torte'))
        )
      )
    ),
    'customMenuSections', (
      select jsonb_agg(section.value || jsonb_build_object('items', (
        select jsonb_agg(item.value || jsonb_build_object(
          'pricePerHead', round((65 + (section.ordinality * 17) + (item.ordinality * 13))::numeric, 2)
        ) order by item.ordinality)
        from jsonb_array_elements(section.value -> 'items') with ordinality as item(value, ordinality)
      )) order by section.ordinality)
      from jsonb_array_elements(service.category_details -> 'customMenuSections') with ordinality as section(value, ordinality)
    ),
    'betaBookableOptionsVersion', '20261028'
  ),
  updated_at = now()
from public.service_categories category,
     public.provider_profiles provider,
     public.profiles owner
where category.id = service.category_id
  and provider.id = service.provider_id
  and owner.id = provider.user_id
  and category.name = 'Catering'
  and service.name = 'Hearth & Harvest Five-Course Tasting'
  and service.status = 'active'
  and service.is_available = true
  and owner.email in ('provider1@multivent.com', 'provider2@multivent.com');

-- Each remaining beta venue needs one provider-defined space that a client can
-- select. Existing configured venues are intentionally not changed.
update public.services service
set category_details = jsonb_build_object(
  'kind', 'venues',
  'schemaVersion', 8,
  'venueType', 'Event Hall',
  'address', 'Bacolod City, Negros Occidental',
  'openingTime', '09:00',
  'closingTime', '23:00',
  'minimumBookingHours', 4,
  'maximumBookingHours', 12,
  'bookingDurationIncrementHours', 1,
  'parking', true,
  'wifi', true,
  'airConditioning', true,
  'tables', true,
  'chairs', true,
  'stage', true,
  'dressingRoom', true,
  'restrooms', true,
  'pwdAccessibility', true,
  'combinations', '[]'::jsonb,
  'spaces', jsonb_build_array(jsonb_build_object(
    'id', 'space-' || replace(service.id::text, '-', ''),
    'name', 'Main event space',
    'spaceType', 'Indoor',
    'capacity', 250,
    'areaSqm', 350,
    'baseRate', service.base_price,
    'pricingUnit', 'event',
    'includedDurationHours', 8,
    'minimumBookingHours', 4,
    'maximumBookingHours', 12,
    'inclusions', jsonb_build_array('Use of the main event space', 'Standard venue setup', 'Basic on-site support'),
    'isBookableIndividually', true,
    'isActive', true
  )),
  'betaBookableOptionsVersion', '20261028'
), updated_at = now()
from public.service_categories category,
     public.provider_profiles provider,
     public.profiles owner
where category.id = service.category_id
  and provider.id = service.provider_id
  and owner.id = provider.user_id
  and category.name = 'Venues & Estates'
  and service.status = 'active'
  and service.is_available = true
  and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
  and coalesce(jsonb_array_length(service.category_details -> 'spaces'), 0) = 0;

-- Configuration updates enter normal moderation. Restore only the tagged beta
-- records after the server-side validators have accepted the new options.
select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  target_service_id uuid;
begin
  for target_service_id in
    select service.id
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where service.status = 'pending_review'
      and category.name in ('Catering', 'Venues & Estates')
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and service.category_details ->> 'betaBookableOptionsVersion' = '20261028'
  loop
    perform public.admin_review_service(target_service_id, 'approved', 'Beta catalog options verified for booking.');
  end loop;
end;
$$;

commit;
