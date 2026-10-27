-- One-time beta catalog expansion to 50 validated, approved services.
-- Distribution: 7 Attire, 7 Catering, and 6 in every other category.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

-- Stable public image endpoints, intentionally reused by category so every
-- listing has a dependable visual without creating external storage records.
update public.services service
set cover_image_url = case lower(category.name)
  when 'attire' then 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=85'
  when 'catering' then 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85'
  when 'venues & estates' then 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85'
  when 'event organizer' then 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=85'
  when 'florists' then 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85'
  when 'host/emcee' then 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1200&q=85'
  when 'photography' then 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85'
  when 'sound & lights' then 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=85'
  else service.cover_image_url
end,
gallery_urls = case when coalesce(jsonb_array_length(service.gallery_urls), 0) = 0 then jsonb_build_array(case lower(category.name)
  when 'attire' then 'https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1200&q=85'
  when 'catering' then 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85'
  when 'venues & estates' then 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85'
  when 'event organizer' then 'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1200&q=85'
  when 'florists' then 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1200&q=85'
  when 'host/emcee' then 'https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1200&q=85'
  when 'photography' then 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85'
  when 'sound & lights' then 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=85'
  else service.cover_image_url end) else service.gallery_urls end,
updated_at = now()
from public.service_categories category
where category.id = service.category_id
  and service.status = 'active' and service.is_available;

update public.profiles
set avatar_url = case lower(email)
  when 'coordinator1@multivent.com' then 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=85'
  when 'coordinator2@multivent.com' then 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=85'
  when 'coordinator3@multivent.com' then 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=85'
  when 'coordinator4@multivent.com' then 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=85'
  else avatar_url end,
updated_at = now()
where default_role = 'event_coordinator';

create temporary table beta_fifty_generic_copies (
  source_id uuid not null,
  copy_id uuid primary key,
  copy_name text not null,
  provider_id uuid not null
) on commit drop;

insert into beta_fifty_generic_copies (source_id, copy_id, copy_name, provider_id)
select source.id, gen_random_uuid(), source.name || ' — Beta ' || sequence.number,
  case when sequence.number % 2 = 0 then '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid else '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid end
from (
  values
    ('Attire'::text, 5), ('Catering', 5), ('Venues & Estates', 4),
    ('Event Organizer', 4), ('Host/Emcee', 4), ('Photography', 4), ('Sound & Lights', 4)
) target(category_name, copies)
join lateral (
  select service.id, service.name
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where category.name = target.category_name and service.status = 'active' and service.is_available
  order by service.created_at, service.id
  limit 1
) source on true
join lateral generate_series(1, target.copies) sequence(number) on true;

insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available, submission_kind,
  moderation_note, moderated_at, moderated_by
)
select copy.copy_id, copy.provider_id, source.category_id, copy.copy_name,
  source.description, source.base_price, source.location, source.cover_image_url,
  source.gallery_urls, source.pricing_model, source.pricing_unit, source.pricing_details,
  source.catering_service_types, source.category_details, 'pending_review', true, 'new',
  null, null, null
from beta_fifty_generic_copies copy
join public.services source on source.id = copy.source_id;

create temporary table beta_fifty_florist_copies (
  copy_id uuid primary key,
  copy_name text not null,
  provider_id uuid not null
) on commit drop;
insert into beta_fifty_florist_copies
select gen_random_uuid(), 'Beta Floral Story — Beta ' || sequence.number,
  case when sequence.number % 2 = 0 then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid else '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid end
from generate_series(1, 4) sequence(number);

insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available, submission_kind
)
select copy.copy_id, copy.provider_id, source.category_id, copy.copy_name,
  source.description, source.base_price, source.location, source.cover_image_url,
  source.gallery_urls, source.pricing_model, source.pricing_unit, source.pricing_details,
  source.catering_service_types, source.category_details, 'draft', true, 'new'
from beta_fifty_florist_copies copy
cross join lateral (
  select * from public.services where id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid
) source;

create temporary table beta_fifty_arrangements (copy_service_id uuid, source_id uuid, copy_id uuid, primary key (copy_service_id, source_id)) on commit drop;
insert into beta_fifty_arrangements
select copy.copy_id, arrangement.id, gen_random_uuid()
from beta_fifty_florist_copies copy
cross join public.florist_arrangements arrangement
where arrangement.service_id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid;

insert into public.florist_arrangements (id, service_id, name, category, description, image_urls, base_price, pricing_unit, minimum_quantity, maximum_quantity, is_active, display_order)
select map.copy_id, map.copy_service_id, arrangement.name, arrangement.category,
  arrangement.description, arrangement.image_urls, arrangement.base_price,
  arrangement.pricing_unit, arrangement.minimum_quantity, arrangement.maximum_quantity,
  arrangement.is_active, arrangement.display_order
from beta_fifty_arrangements map
join public.florist_arrangements arrangement on arrangement.id = map.source_id;

create temporary table beta_fifty_groups (copy_service_id uuid, source_id uuid, copy_id uuid, primary key (copy_service_id, source_id)) on commit drop;
insert into beta_fifty_groups
select arrangement_map.copy_service_id, group_row.id, gen_random_uuid()
from beta_fifty_arrangements arrangement_map
join public.florist_arrangement_option_groups group_row on group_row.arrangement_id = arrangement_map.source_id;

insert into public.florist_arrangement_option_groups (id, arrangement_id, name, selection_type, is_required, minimum_selections, maximum_selections, is_active, display_order)
select group_map.copy_id, arrangement_map.copy_id, group_row.name, group_row.selection_type,
  group_row.is_required, group_row.minimum_selections, group_row.maximum_selections,
  group_row.is_active, group_row.display_order
from beta_fifty_groups group_map
join public.florist_arrangement_option_groups group_row on group_row.id = group_map.source_id
join beta_fifty_arrangements arrangement_map on arrangement_map.copy_service_id = group_map.copy_service_id and arrangement_map.source_id = group_row.arrangement_id;

insert into public.florist_arrangement_options (option_group_id, name, description, image_url, price_modifier, price_modifier_type, is_active, display_order)
select group_map.copy_id, option_row.name, option_row.description, option_row.image_url,
  option_row.price_modifier, option_row.price_modifier_type, option_row.is_active, option_row.display_order
from beta_fifty_groups group_map
join public.florist_arrangement_option_groups source_group on source_group.id = group_map.source_id
join public.florist_arrangement_options option_row on option_row.option_group_id = source_group.id;

insert into public.florist_service_fulfillment_options (service_id, fulfillment_kind, name, description, coverage_details, price, is_active, display_order)
select copy.copy_id, fulfillment.fulfillment_kind, fulfillment.name, fulfillment.description,
  fulfillment.coverage_details, fulfillment.price, fulfillment.is_active, fulfillment.display_order
from beta_fifty_florist_copies copy
cross join public.florist_service_fulfillment_options fulfillment
where fulfillment.service_id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid;

update public.services
set status = 'pending_review', updated_at = now()
where id in (select copy_id from beta_fifty_florist_copies);

-- Approve only the services created in this transaction using the established
-- moderation workflow, which retains audit records and provider notifications.
select set_config('request.jwt.claim.sub', '4d6476ce-928d-442c-bf1a-87218a0263c4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $approval$
declare service_id uuid;
begin
  for service_id in
    select copy_id from beta_fifty_generic_copies
    union all select copy_id from beta_fifty_florist_copies
  loop
    perform public.admin_review_service(service_id, 'approved', 'Beta catalogue expansion: configuration and image verified.');
  end loop;
end;
$approval$;

commit;
