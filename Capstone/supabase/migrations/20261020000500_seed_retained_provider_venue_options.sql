begin;

-- Populate the current marketplace copies of the six retained demo venues
-- with V8 option-level pricing. The Phase 1 redistribution deliberately
-- preserved these source identifiers, so the update is limited to the active
-- Provider 1 and Provider 2 copies. Provider 3 has no venue listing.
--
-- No booking, payment, selection, availability, parent service-price, or
-- historical snapshot is modified here. Confirmed booking terms remain
-- immutable in their existing booking snapshots.
select set_config('request.jwt.claim.role', 'service_role', true);

do $guard$
declare
  target_count integer;
begin
  select count(*) into target_count
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  join public.service_categories category on category.id = service.category_id
  where service.status = 'active'
    and service.is_available = true
    and category.name = 'Venues & Estates'
    and (
      (lower(profile.email) = 'provider1@multivent.com'
        and service.last_approved_snapshot ->> 'phase1_source_service_id' in (
          'a1300000-0000-4000-8004-000000000004',
          'a1300000-0000-4000-8004-000000000005',
          'a1300000-0000-4000-8004-000000000006'
        ))
      or (lower(profile.email) = 'provider2@multivent.com'
        and service.last_approved_snapshot ->> 'phase1_source_service_id' in (
          'a1300000-0000-4000-8004-000000000001',
          'a1300000-0000-4000-8004-000000000002',
          'a1300000-0000-4000-8004-000000000003'
        ))
    );

  if target_count <> 6 then
    raise exception 'V8 demo venue option seed stopped: expected 6 active retained venue services, found %.', target_count;
  end if;
end;
$guard$;

with option_updates (
  source_service_id,
  provider_email,
  spaces,
  combinations
) as (
  values
    (
      'a1300000-0000-4000-8004-000000000004',
      'provider1@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'luntian-garden',
          'name', 'Ceremony Garden',
          'description', 'A landscaped outdoor ceremony garden with mature trees and open countryside views.',
          'areaSqm', 520,
          'capacity', 180,
          'spaceType', 'Outdoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'event',
          'baseRate', 42000,
          'includedDurationHours', 8,
          'amenities', jsonb_build_array('Ceremony layout area', 'Outdoor string lights', 'Emergency lighting'),
          'inclusions', jsonb_build_array('Garden ceremony access', 'Basic supplier ingress'),
          'restrictions', jsonb_build_array('Outdoor use is subject to the venue weather plan')
        ),
        jsonb_build_object(
          'id', 'luntian-pavilion',
          'name', 'Covered Pavilion',
          'description', 'A covered reception pavilion with event-day access and countryside views.',
          'areaSqm', 165,
          'capacity', 100,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'event',
          'baseRate', 30000,
          'includedDurationHours', 8,
          'amenities', jsonb_build_array('Covered reception area', 'Stage access', 'Generator'),
          'inclusions', jsonb_build_array('Pavilion use', 'Basic tables and chairs'),
          'restrictions', jsonb_build_array('Capacity is limited to 100 guests when booked alone')
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', 'luntian-estate',
          'name', 'Garden + Pavilion',
          'description', 'Exclusive use of the ceremony garden and covered pavilion for one event day.',
          'spaceIds', jsonb_build_array('luntian-garden', 'luntian-pavilion'),
          'combinedAreaSqm', 685,
          'combinedCapacity', 260,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'event',
          'baseRate', 72000,
          'includedDurationHours', 10,
          'amenities', jsonb_build_array('Garden ceremony area', 'Covered pavilion', 'Bridal room', 'Generator'),
          'inclusions', jsonb_build_array('Exclusive garden and pavilion use', 'Basic tables and chairs'),
          'restrictions', jsonb_build_array('Cannot be combined with either constituent space')
        )
      )
    ),
    (
      'a1300000-0000-4000-8004-000000000005',
      'provider1@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'silay-lodge',
          'name', 'View Lodge',
          'description', 'A hill-facing lodge for intimate weddings, family celebrations, workshops, and private dinners.',
          'areaSqm', 85,
          'capacity', 50,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'hour',
          'baseRate', 3500,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'setupAllowanceHours', 2,
          'amenities', jsonb_build_array('Air conditioning', 'Covered veranda', 'Wi-Fi', 'Coffee station'),
          'inclusions', jsonb_build_array('View Lodge access', 'Basic tables and chairs'),
          'restrictions', jsonb_build_array('Hourly rental must be booked in whole-hour increments')
        )
      ),
      '[]'::jsonb
    ),
    (
      'a1300000-0000-4000-8004-000000000006',
      'provider1@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'north-grove-lawn',
          'name', 'Festival Lawn',
          'description', 'A broad outdoor lawn for festivals, large reunions, concerts, and open-air receptions.',
          'areaSqm', 1800,
          'capacity', 650,
          'spaceType', 'Outdoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'event',
          'baseRate', 125000,
          'includedDurationHours', 8,
          'amenities', jsonb_build_array('Three-phase power access', 'Supplier loading lane', 'Emergency lighting'),
          'inclusions', jsonb_build_array('Festival Lawn use', 'Parking field', 'Restroom access'),
          'restrictions', jsonb_build_array('Outdoor event-use conditions apply')
        )
      ),
      '[]'::jsonb
    ),
    (
      'a1300000-0000-4000-8004-000000000001',
      'provider2@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'celestine-ballroom',
          'name', 'Grand Ballroom',
          'description', 'An air-conditioned ballroom for weddings, debuts, and company galas.',
          'areaSqm', 440,
          'capacity', 350,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'event',
          'baseRate', 95000,
          'includedDurationHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Built-in stage', 'Bridal suite', 'Wi-Fi'),
          'inclusions', jsonb_build_array('Grand Ballroom use', 'Tables and chairs', 'Guarded parking'),
          'restrictions', jsonb_build_array('Maximum occupancy is 350 guests')
        )
      ),
      '[]'::jsonb
    ),
    (
      'a1300000-0000-4000-8004-000000000002',
      'provider2@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'sidlak-hall-1',
          'name', 'Function Hall 1',
          'description', 'A flexible indoor function hall for intimate celebrations and meetings.',
          'areaSqm', 120,
          'capacity', 100,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'hour',
          'baseRate', 4500,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Projector'),
          'inclusions', jsonb_build_array('Function Hall 1 access'),
          'restrictions', jsonb_build_array('Hourly rental must be booked in whole-hour increments')
        ),
        jsonb_build_object(
          'id', 'sidlak-hall-2',
          'name', 'Function Hall 2',
          'description', 'The largest of the adjoining Sidlak function rooms, suited to mid-sized receptions.',
          'areaSqm', 150,
          'capacity', 120,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'hour',
          'baseRate', 5000,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Loading bay'),
          'inclusions', jsonb_build_array('Function Hall 2 access'),
          'restrictions', jsonb_build_array('Hourly rental must be booked in whole-hour increments')
        ),
        jsonb_build_object(
          'id', 'sidlak-hall-3',
          'name', 'Function Hall 3',
          'description', 'An adjoining function hall for smaller celebrations, breakout use, or expanded layouts.',
          'areaSqm', 120,
          'capacity', 100,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'hour',
          'baseRate', 4250,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Projector'),
          'inclusions', jsonb_build_array('Function Hall 3 access'),
          'restrictions', jsonb_build_array('Hourly rental must be booked in whole-hour increments')
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', 'sidlak-combo-12',
          'name', 'Hall 1 + Hall 2',
          'description', 'Adjoining use of Function Halls 1 and 2 for a larger reception layout.',
          'spaceIds', jsonb_build_array('sidlak-hall-1', 'sidlak-hall-2'),
          'combinedAreaSqm', 270,
          'combinedCapacity', 220,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'hour',
          'baseRate', 9500,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Projector'),
          'inclusions', jsonb_build_array('Combined Hall 1 and Hall 2 access'),
          'restrictions', jsonb_build_array('Cannot be combined with either constituent hall')
        ),
        jsonb_build_object(
          'id', 'sidlak-combo-23',
          'name', 'Hall 2 + Hall 3',
          'description', 'Adjoining use of Function Halls 2 and 3 for expanded celebrations.',
          'spaceIds', jsonb_build_array('sidlak-hall-2', 'sidlak-hall-3'),
          'combinedAreaSqm', 270,
          'combinedCapacity', 220,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'hour',
          'baseRate', 9250,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Loading bay'),
          'inclusions', jsonb_build_array('Combined Hall 2 and Hall 3 access'),
          'restrictions', jsonb_build_array('Cannot be combined with either constituent hall')
        ),
        jsonb_build_object(
          'id', 'sidlak-combo-123',
          'name', 'Hall 1 + Hall 2 + Hall 3',
          'description', 'Full adjoining-room configuration for larger receptions and company events.',
          'spaceIds', jsonb_build_array('sidlak-hall-1', 'sidlak-hall-2', 'sidlak-hall-3'),
          'combinedAreaSqm', 390,
          'combinedCapacity', 320,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'hour',
          'baseRate', 13750,
          'minimumBookingHours', 4,
          'maximumBookingHours', 12,
          'amenities', jsonb_build_array('Air conditioning', 'Movable partitions', 'Projector', 'Loading bay'),
          'inclusions', jsonb_build_array('Combined access to all Sidlak function halls'),
          'restrictions', jsonb_build_array('Cannot be combined with any constituent hall')
        )
      )
    ),
    (
      'a1300000-0000-4000-8004-000000000003',
      'provider2@multivent.com',
      jsonb_build_array(
        jsonb_build_object(
          'id', 'marisol-courtyard',
          'name', 'Garden Courtyard',
          'description', 'A bright open-air courtyard for ceremonies, cocktails, and garden receptions.',
          'areaSqm', 230,
          'capacity', 150,
          'spaceType', 'Outdoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'event',
          'baseRate', 35000,
          'includedDurationHours', 8,
          'amenities', jsonb_build_array('Ceremony arch', 'Outdoor courtyard', 'Catering prep area'),
          'inclusions', jsonb_build_array('Garden Courtyard access', 'Basic ceremony layout'),
          'restrictions', jsonb_build_array('Outdoor use is subject to the venue weather plan')
        ),
        jsonb_build_object(
          'id', 'marisol-hall',
          'name', 'Marisol Hall',
          'description', 'An intimate indoor hall that also serves as the estate''s rain-plan venue.',
          'areaSqm', 110,
          'capacity', 80,
          'spaceType', 'Indoor',
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', true,
          'pricingUnit', 'event',
          'baseRate', 30000,
          'includedDurationHours', 8,
          'amenities', jsonb_build_array('Air conditioning', 'Rain-plan hall', 'Kitchen access'),
          'inclusions', jsonb_build_array('Marisol Hall access', 'Basic tables and chairs'),
          'restrictions', jsonb_build_array('Capacity is limited to 80 guests when booked alone')
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', 'marisol-combined',
          'name', 'Courtyard + Marisol Hall',
          'description', 'Exclusive use of the courtyard and indoor hall for a ceremony and reception flow.',
          'spaceIds', jsonb_build_array('marisol-courtyard', 'marisol-hall'),
          'combinedAreaSqm', 340,
          'combinedCapacity', 220,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'pricingUnit', 'event',
          'baseRate', 58000,
          'includedDurationHours', 10,
          'amenities', jsonb_build_array('Garden Courtyard', 'Marisol Hall', 'Ceremony arch', 'Rain-plan hall'),
          'inclusions', jsonb_build_array('Exclusive courtyard and hall use', 'Basic tables and chairs'),
          'restrictions', jsonb_build_array('Cannot be combined with either constituent space')
        )
      )
    )
)
update public.services service
set category_details = jsonb_set(
      jsonb_set(
        jsonb_set(service.category_details, '{schemaVersion}', '2'::jsonb, true),
        '{spaces}', option_updates.spaces, true
      ),
      '{combinations}', option_updates.combinations, true
    ),
    updated_at = now()
from option_updates
join public.provider_profiles provider on provider.user_id in (
  select profile.id from public.profiles profile
  where lower(profile.email) = option_updates.provider_email
)
where service.provider_id = provider.id
  and service.last_approved_snapshot ->> 'phase1_source_service_id' = option_updates.source_service_id
  and service.status = 'active'
  and service.is_available = true;

do $verify$
declare
  configured_count integer;
begin
  select count(*) into configured_count
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  join public.service_categories category on category.id = service.category_id
  where service.status = 'active'
    and service.is_available = true
    and category.name = 'Venues & Estates'
    and (
      (lower(profile.email) = 'provider1@multivent.com'
        and service.last_approved_snapshot ->> 'phase1_source_service_id' in (
          'a1300000-0000-4000-8004-000000000004',
          'a1300000-0000-4000-8004-000000000005',
          'a1300000-0000-4000-8004-000000000006'
        ))
      or (lower(profile.email) = 'provider2@multivent.com'
        and service.last_approved_snapshot ->> 'phase1_source_service_id' in (
          'a1300000-0000-4000-8004-000000000001',
          'a1300000-0000-4000-8004-000000000002',
          'a1300000-0000-4000-8004-000000000003'
        ))
    )
    and exists (
      select 1
      from jsonb_array_elements(service.category_details -> 'spaces') option_row(value)
      where option_row.value ->> 'pricingUnit' in ('event', 'hour')
        and coalesce(option_row.value ->> 'baseRate', '') ~ '^[0-9]+([.][0-9]+)?$'
        and (option_row.value ->> 'baseRate')::numeric > 0
    );

  if configured_count <> 6 then
    raise exception 'V8 demo venue option seed failed: all 6 retained venue services require a priced option, found %.', configured_count;
  end if;
end;
$verify$;

commit;
