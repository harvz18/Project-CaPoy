-- Restore the provider-owned booking configuration missing from the beta
-- marketplace refresh. These listings were approved without the V15/V18 data
-- their client booking flows require. Existing configured listings are left
-- untouched, including the five-course food-tasting service.

begin;

update public.services service
set category_details = jsonb_build_object(
  'kind', 'catering',
  'schemaVersion', 15,
  'cateringTypes', jsonb_build_array('Buffet'),
  'cuisines', jsonb_build_array('Filipino', 'International'),
  'pricingBasis', 'per_person',
  'minimumGuests', 30,
  'maximumGuests', 250,
  'pricingOptions', jsonb_build_array(jsonb_build_object(
    'id', 'standard-buffet',
    'name', 'Standard celebration buffet',
    'pricePerHead', service.base_price,
    'minimumGuests', 30,
    'maximumGuests', 250,
    'menuSections', jsonb_build_array(jsonb_build_object(
      'id', 'standard-main', 'name', 'Main course',
      'items', jsonb_build_array('Chef-selected main course')
    ))
  )),
  'customMenuSections', jsonb_build_array(jsonb_build_object(
    'id', 'custom-main',
    'name', 'Main course',
    'minimumSelections', 1,
    'maximumSelections', 1,
    'items', jsonb_build_array(jsonb_build_object(
      'id', 'chef-main',
      'name', 'Chef-selected main course',
      'pricePerHead', service.base_price,
      'isActive', true
    ))
  )),
  'tastingSettings', jsonb_build_object('enabled', false),
  'dietaryOptions', jsonb_build_array('Vegetarian', 'Gluten-Free'),
  'servingStaffIncluded', true,
  'tablewareIncluded', true,
  'setupCleanupIncluded', true,
  'serviceArea', 'Bacolod and nearby cities',
  'preparationLeadTime', 7,
  'preparationLeadTimeUnit', 'days'
), updated_at = now()
from public.service_categories category
where category.id = service.category_id
  and public.phase9_category_key(category.name) = 'catering'
  and service.status = 'active'
  and service.is_available = true
  and coalesce(service.category_details, '{}'::jsonb) = '{}'::jsonb;

update public.services service
set category_details = jsonb_build_object(
  'kind', 'photography',
  'schemaVersion', 18,
  'photoVideoServiceType', 'photography',
  'eventTypes', jsonb_build_array('wedding', 'birthday', 'debut', 'corporate', 'anniversary', 'other'),
  'operatingLocation', 'Bacolod City and nearby Negros Occidental areas',
  'coverageAreas', jsonb_build_array('Bacolod City', 'Negros Occidental'),
  'minimumBookingNoticeDays', 7,
  'photoCoverage', true,
  'videoCoverage', false,
  'photographerCount', 1,
  'videographerCount', 0,
  'coverageDurationHours', 6,
  'coverageConfigurations', jsonb_build_array(jsonb_build_object(
    'id', 'standard-photo-coverage',
    'name', 'Standard event coverage',
    'durationHours', 6,
    'price', service.base_price,
    'includedCrew', jsonb_build_array(jsonb_build_object('role', 'Photographer', 'quantity', 1))
  )),
  'deliverableConfigurations', jsonb_build_array(jsonb_build_object(
    'id', 'digital-gallery',
    'name', 'Edited digital gallery',
    'mediaType', 'photo',
    'pricingMode', 'included',
    'includedQuantity', 1,
    'maximumQuantity', 1,
    'turnaroundDays', 14,
    'requiredCrewRoles', jsonb_build_array('Photographer')
  )),
  'additionalCrewOptions', '[]'::jsonb,
  'additionalServices', '[]'::jsonb,
  'teamCapacity', 2,
  'scheduleFlexibilityMinutes', 0,
  'allowsMultipleLocations', false,
  'additionalLocationFee', 0,
  'additionalHoursAllowed', false,
  'maximumAdditionalHours', 0,
  'additionalHourRate', 0,
  'overtimeAllowed', false,
  'overtimeRate', 0,
  'overtimeMinimumIncrementHours', 0,
  'overtimeRequiresAuthorization', false,
  'postProductionSettings', jsonb_build_object(
    'deadlineStartingPoint', 'event_completion',
    'deliveryMethods', jsonb_build_array(jsonb_build_object('id', 'online-gallery', 'kind', 'online_gallery')),
    'rushEditingOptions', '[]'::jsonb,
    'revisionPolicy', jsonb_build_object('includedRevisionRounds', 0, 'additionalRevisionCharge', 0)
  )
), updated_at = now()
from public.service_categories category
where category.id = service.category_id
  and public.phase9_category_key(category.name) = 'photoVideo'
  and service.status = 'active'
  and service.is_available = true
  and coalesce(service.category_details, '{}'::jsonb) = '{}'::jsonb;

commit;
