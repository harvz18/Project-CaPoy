begin;

-- A deterministic, client-visible demo listing for the retained Provider 1
-- account. It deliberately offers both fixed preset menus and an item-priced
-- custom menu; neither is a provider service package.
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  provider_id_value uuid;
  category_id_value uuid;
  target_service_id constant uuid := 'a1300000-0000-4000-8010-000000000001'::uuid;
begin
  select provider.id into provider_id_value
  from public.provider_profiles provider
  join public.profiles profile on profile.id = provider.user_id
  where profile.id = 'a1100000-0000-4000-8000-000000000001'::uuid
    and lower(profile.email) = 'provider1@multivent.com'
    and profile.default_role = 'service_provider'
    and profile.account_status = 'active'
    and provider.verification_status in ('active', 'verified');

  if provider_id_value is null then
    raise exception 'Demo catering listing stopped: Provider 1 is not active and verified.';
  end if;

  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = 'catering';
  if category_id_value is null then
    raise exception 'Demo catering listing stopped: the Catering category is missing.';
  end if;

  if exists (
    select 1 from public.services service
    where service.id = target_service_id
      and (service.provider_id <> provider_id_value or service.category_id <> category_id_value
        or service.name <> 'Customizable Catering')
  ) then
    raise exception 'Demo catering listing stopped: its deterministic service ID is already used by unrelated data.';
  end if;

  insert into public.services (
    id, provider_id, category_id, name, description, base_price, location,
    cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
    catering_service_types, status, is_available, moderation_note, moderated_at,
    submission_kind, last_approved_snapshot, category_details
  ) values (
    target_service_id,
    provider_id_value,
    category_id_value,
    'Customizable Catering',
    'A flexible celebration menu for the system demo. Clients can book a ready-made preset or build their own per-guest menu from the same catering team.',
    600,
    'Bacolod City, Talisay City, and nearby Negros Occidental areas',
    'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1600&q=82',
    jsonb_build_array(
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1600&q=82',
      'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=82',
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=82'
    ),
    'startingAt',
    'person',
    'Starting at PHP 600 per guest. The final amount depends on the preset or custom food selections chosen by the client.',
    array['buffet', 'plated', 'packed'],
    'active',
    true,
    'Approved demo listing: preset and custom menu paths are both enabled.',
    now(),
    'new',
    jsonb_build_object('demoKey', 'provider1-customizable-catering'),
    $details$
    {
      "kind": "catering",
      "schemaVersion": 1,
      "cateringTypes": ["Buffet", "Plated", "Packed Meals"],
      "cuisines": ["Filipino", "Western", "Mixed"],
      "pricingBasis": "per_person",
      "minimumGuests": 50,
      "maximumGuests": 250,
      "dietaryOptions": ["Vegetarian", "Vegan", "Halal", "Gluten-Free"],
      "drinksIncluded": true,
      "servingStaffIncluded": true,
      "tablesChairsIncluded": false,
      "tablewareIncluded": true,
      "setupCleanupIncluded": true,
      "serviceArea": "Bacolod, Talisay, Silay, Bago, and nearby Negros Occidental areas",
      "preparationLeadTime": 10,
      "preparationLeadTimeUnit": "days",
      "tastingSettings": {
        "enabled": true,
        "location": "Provider 1 tasting table, Bacolod City",
        "tastingTimeSlots": ["10:00", "14:00"],
        "durationMinutes": 60,
        "minimumLeadDays": 3,
        "latestDaysBeforeEvent": 7
      },
      "pricingOptions": [
        {
          "id": "classic-celebration-buffet",
          "name": "Classic Celebration Buffet",
          "pricePerHead": 750,
          "minimumGuests": 50,
          "maximumGuests": 250,
          "menuSections": [
            {"id": "classic-starter", "name": "Starter", "items": ["Fresh Lumpia", "Chicken Spring Rolls"]},
            {"id": "classic-mains", "name": "Mains", "items": ["Chicken Inasal", "Beef Caldereta", "Herb-Roasted Fish"]},
            {"id": "classic-sides", "name": "Sides", "items": ["Garlic Rice", "Pinakbet"]},
            {"id": "classic-dessert", "name": "Dessert", "items": ["Mango Float"]},
            {"id": "classic-drinks", "name": "Drinks", "items": ["House Iced Tea"]}
          ]
        },
        {
          "id": "signature-plated-feast",
          "name": "Signature Plated Feast",
          "pricePerHead": 1050,
          "minimumGuests": 50,
          "maximumGuests": 200,
          "menuSections": [
            {"id": "signature-starter", "name": "Starter", "items": ["Roasted Pumpkin Soup", "Garden Salad"]},
            {"id": "signature-main", "name": "Main Course", "items": ["Chicken Roulade", "Herb-Crusted Fish", "Beef Medallion"]},
            {"id": "signature-dessert", "name": "Dessert", "items": ["Tablea Chocolate Tart"]},
            {"id": "signature-drinks", "name": "Drinks", "items": ["Cucumber Lemon Water", "Brewed Coffee"]}
          ]
        }
      ],
      "customMenuSections": [
        {
          "id": "custom-appetizer",
          "name": "Appetizer",
          "minimumSelections": 1,
          "maximumSelections": 2,
          "items": [
            {"id": "app-fresh-lumpia", "name": "Fresh Lumpia", "description": "Vegetable rolls with peanut-garlic sauce.", "pricePerHead": 60, "isActive": true, "isDefault": true, "isRequired": false},
            {"id": "app-chicken-satay", "name": "Chicken Satay", "description": "Chargrilled chicken skewers with house sauce.", "pricePerHead": 80, "isActive": true, "isDefault": false, "isRequired": false},
            {"id": "app-mushroom-tart", "name": "Mushroom Tart", "description": "Creamy mushroom tartlet for vegetarian guests.", "pricePerHead": 70, "isActive": true, "isDefault": false, "isRequired": false}
          ]
        },
        {
          "id": "custom-main-course",
          "name": "Main Course",
          "minimumSelections": 2,
          "maximumSelections": 3,
          "items": [
            {"id": "main-chicken-inasal", "name": "Chicken Inasal", "description": "Charcoal-grilled Bacolod chicken.", "pricePerHead": 160, "isActive": true, "isDefault": true, "isRequired": false},
            {"id": "main-beef-caldereta", "name": "Beef Caldereta", "description": "Slow-braised beef in a rich tomato sauce.", "pricePerHead": 220, "isActive": true, "isDefault": true, "isRequired": false},
            {"id": "main-herb-fish", "name": "Herb-Roasted Fish", "description": "Lemon-herb fish fillet.", "pricePerHead": 195, "isActive": true, "isDefault": false, "isRequired": false},
            {"id": "main-tofu-steak", "name": "Tofu Mushroom Steak", "description": "Plant-based main with mushroom gravy.", "pricePerHead": 145, "isActive": true, "isDefault": false, "isRequired": false}
          ]
        },
        {
          "id": "custom-side",
          "name": "Side Dish",
          "minimumSelections": 1,
          "maximumSelections": 2,
          "items": [
            {"id": "side-garlic-rice", "name": "Garlic Rice", "description": "Fragrant garlic fried rice.", "pricePerHead": 40, "isActive": true, "isDefault": true, "isRequired": false},
            {"id": "side-pinakbet", "name": "Pinakbet", "description": "Seasonal vegetables with bagoong.", "pricePerHead": 55, "isActive": true, "isDefault": false, "isRequired": false},
            {"id": "side-garden-salad", "name": "Garden Salad", "description": "Fresh greens with calamansi vinaigrette.", "pricePerHead": 60, "isActive": true, "isDefault": false, "isRequired": false}
          ]
        },
        {
          "id": "custom-dessert",
          "name": "Dessert",
          "minimumSelections": 1,
          "maximumSelections": 1,
          "items": [
            {"id": "dessert-mango-float", "name": "Mango Float", "description": "Chilled mango and cream dessert.", "pricePerHead": 80, "isActive": true, "isDefault": true, "isRequired": false},
            {"id": "dessert-leche-flan", "name": "Leche Flan", "description": "Classic caramel custard.", "pricePerHead": 65, "isActive": true, "isDefault": false, "isRequired": false},
            {"id": "dessert-tablea-tart", "name": "Tablea Chocolate Tart", "description": "Dark local chocolate tart.", "pricePerHead": 90, "isActive": true, "isDefault": false, "isRequired": false}
          ]
        },
        {
          "id": "custom-beverage",
          "name": "Beverage",
          "minimumSelections": 1,
          "maximumSelections": 1,
          "items": [
            {"id": "beverage-iced-tea", "name": "House Iced Tea", "description": "Unlimited brewed iced tea.", "pricePerHead": 40, "isActive": true, "isDefault": true, "isRequired": true},
            {"id": "beverage-calamansi", "name": "Calamansi Cooler", "description": "Fresh calamansi citrus cooler.", "pricePerHead": 50, "isActive": true, "isDefault": false, "isRequired": false},
            {"id": "beverage-coffee", "name": "Brewed Coffee", "description": "Freshly brewed local coffee.", "pricePerHead": 55, "isActive": true, "isDefault": false, "isRequired": false}
          ]
        }
      ]
    }
    $details$::jsonb
  ) on conflict (id) do nothing;

  if not exists (
    select 1 from public.services service
    where service.id = target_service_id
      and service.provider_id = provider_id_value
      and service.category_id = category_id_value
      and service.name = 'Customizable Catering'
      and service.status = 'active'
      and service.is_available = true
      and service.pricing_model = 'startingAt'
      and service.pricing_unit = 'person'
      and service.category_details ? 'pricingOptions'
      and service.category_details ? 'customMenuSections'
  ) then
    raise exception 'Demo catering listing verification failed.';
  end if;
end;
$$;

commit;
