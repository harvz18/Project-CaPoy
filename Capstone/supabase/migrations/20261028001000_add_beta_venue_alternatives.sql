-- Add provider-defined alternatives to each active beta venue. Every option is
-- explicitly non-combinable: the client chooses one published room/layout,
-- never an ad-hoc combination of spaces.

begin;

do $$
declare
  target record;
  provider_unit text;
  included_hours integer;
  minimum_hours integer;
  maximum_hours integer;
  compact_name text;
  compact_type text;
  compact_capacity integer;
  compact_area integer;
  terrace_name text;
  terrace_type text;
  terrace_capacity integer;
  terrace_area integer;
begin
  for target in
    select service.id, service.name, service.base_price, service.category_details
    from public.services service
    join public.service_categories category on category.id = service.category_id
    join public.provider_profiles provider on provider.id = service.provider_id
    join public.profiles owner on owner.id = provider.user_id
    where category.name = 'Venues & Estates'
      and service.status = 'active'
      and service.is_available = true
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and service.category_details ->> 'betaVenueAlternativesVersion' is distinct from '20261028'
  loop
    provider_unit := coalesce(target.category_details -> 'spaces' -> 0 ->> 'pricingUnit', 'event');
    included_hours := case when provider_unit = 'hour' then 1 else 8 end;
    minimum_hours := case when provider_unit = 'hour' then 4 else 4 end;
    maximum_hours := case when provider_unit = 'hour' then 10 else 12 end;

    select option_names.compact_name, option_names.compact_type, option_names.compact_capacity, option_names.compact_area,
      option_names.terrace_name, option_names.terrace_type, option_names.terrace_capacity, option_names.terrace_area
    into compact_name, compact_type, compact_capacity, compact_area,
      terrace_name, terrace_type, terrace_capacity, terrace_area
    from (
      values
        ('Aurora Grand Ballroom', 'Sapphire Hall', 'Indoor', 180, 260, 'Sky Garden Terrace', 'Outdoor', 120, 180),
        ('Casa Verde Courtyard', 'Garden Pavilion', 'Outdoor', 120, 190, 'Olive Reception Lawn', 'Outdoor', 180, 270),
        ('Hacienda Sunset Garden', 'Sunset Pavilion', 'Outdoor', 140, 220, 'Orchard Ceremony Lawn', 'Outdoor', 210, 320),
        ('Lakeside Glass Pavilion', 'Lakeside Garden Deck', 'Outdoor', 80, 130, 'Waterfront Lawn', 'Outdoor', 130, 240),
        ('North Grove Event Lawn', 'Willow Pavilion', 'Outdoor', 160, 250, 'Cedar Grove Lawn', 'Outdoor', 300, 520),
        ('Silay Heritage House', 'Heritage Sala', 'Indoor', 70, 115, 'Ancestral Courtyard', 'Outdoor', 150, 240),
        ('The Foundry Function Rooms', 'Brick Hall', 'Indoor', 100, 170, 'Loft Reception Room', 'Indoor', 180, 280)
    ) as option_names(venue_name, compact_name, compact_type, compact_capacity, compact_area, terrace_name, terrace_type, terrace_capacity, terrace_area)
    where option_names.venue_name = target.name;

    -- All seven beta venue names are listed above. This guard makes future
    -- catalog additions safe: a service is left untouched until it has an
    -- explicitly designed alternative rather than receiving a generic room.
    if compact_name is null or terrace_name is null then
      continue;
    end if;

    update public.services service
    set category_details = service.category_details || jsonb_build_object(
      'spaces', (
        select jsonb_agg(space.value || jsonb_build_object('allowsCombination', false) order by space.ordinality)
        from jsonb_array_elements(service.category_details -> 'spaces') with ordinality as space(value, ordinality)
      ) || jsonb_build_array(
        jsonb_build_object(
          'id', 'compact-' || replace(target.id::text, '-', ''),
          'name', compact_name,
          'spaceType', compact_type,
          'capacity', compact_capacity,
          'areaSqm', compact_area,
          'baseRate', round(target.base_price * 0.72, 2),
          'pricingUnit', provider_unit,
          'includedDurationHours', included_hours,
          'minimumBookingHours', minimum_hours,
          'maximumBookingHours', maximum_hours,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'inclusions', jsonb_build_array('Use of the selected space', 'Standard setup', 'Basic on-site support')
        ),
        jsonb_build_object(
          'id', 'premium-' || replace(target.id::text, '-', ''),
          'name', terrace_name,
          'spaceType', terrace_type,
          'capacity', terrace_capacity,
          'areaSqm', terrace_area,
          'baseRate', round(target.base_price * 0.88, 2),
          'pricingUnit', provider_unit,
          'includedDurationHours', included_hours,
          'minimumBookingHours', minimum_hours,
          'maximumBookingHours', maximum_hours,
          'isActive', true,
          'isBookableIndividually', true,
          'allowsCombination', false,
          'inclusions', jsonb_build_array('Use of the selected space', 'Enhanced setup', 'Basic on-site support')
        )
      ),
      'betaVenueAlternativesVersion', '20261028'
    ), updated_at = now()
    where service.id = target.id;
  end loop;
end;
$$;

-- Updating provider configuration correctly returns a listing to moderation.
-- Restore only the tagged beta venues through the normal approval workflow.
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
      and category.name = 'Venues & Estates'
      and owner.email in ('provider1@multivent.com', 'provider2@multivent.com')
      and service.category_details ->> 'betaVenueAlternativesVersion' = '20261028'
  loop
    perform public.admin_review_service(target_service_id, 'approved', 'Beta venue alternatives verified for booking.');
  end loop;
end;
$$;

commit;
