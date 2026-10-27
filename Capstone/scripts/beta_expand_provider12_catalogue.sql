-- One-time beta expansion: two approved-ready services per category, all
-- owned only by Provider 1 or Provider 2. Existing accounts are untouched.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

-- Reassign the validated beta foundation. There are no bookings after reset,
-- so no historic booking ownership or financial snapshot is rewritten.
update public.services
set provider_id = case id
  when 'a1300000-0000-4000-8001-000000000001'::uuid then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid
  when 'b1300000-0000-4000-8003-000000000001'::uuid then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid
  when 'a1300000-0000-4000-8004-000000000002'::uuid then '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid
  when 'a1300000-0000-4000-8005-000000000001'::uuid then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid
  when 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid
  when 'a1300000-0000-4000-8006-000000000002'::uuid then '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid
  when 'a1300000-0000-4000-8007-000000000003'::uuid then '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'::uuid
  when 'a1300000-0000-4000-8008-000000000001'::uuid then '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid
end,
updated_at = now()
where id in (
  'a1300000-0000-4000-8001-000000000001'::uuid,
  'b1300000-0000-4000-8003-000000000001'::uuid,
  'a1300000-0000-4000-8004-000000000002'::uuid,
  'a1300000-0000-4000-8005-000000000001'::uuid,
  'dadf546d-4500-4509-b72f-f84add11ac40'::uuid,
  'a1300000-0000-4000-8006-000000000002'::uuid,
  'a1300000-0000-4000-8007-000000000003'::uuid,
  'a1300000-0000-4000-8008-000000000001'::uuid
);

create temporary table beta_service_copies (source_id uuid primary key, copy_id uuid not null, copy_name text not null, provider_id uuid not null) on commit drop;
insert into beta_service_copies values
  ('a1300000-0000-4000-8001-000000000001', 'c1300000-0000-4000-8001-000000000001', 'Heritage Filipiniana Bridal Collection — Signature', '39b29b24-05ec-4519-aa91-891369f1a48d'),
  ('b1300000-0000-4000-8003-000000000001', 'c1300000-0000-4000-8003-000000000001', 'Beta Signature Menu — Celebration Edition', '39b29b24-05ec-4519-aa91-891369f1a48d'),
  ('a1300000-0000-4000-8004-000000000002', 'c1300000-0000-4000-8004-000000000001', 'Sidlak Flexible Function Rooms — Grand Edition', '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'),
  ('a1300000-0000-4000-8005-000000000001', 'c1300000-0000-4000-8005-000000000001', 'Full Wedding Coordination — Signature', '39b29b24-05ec-4519-aa91-891369f1a48d'),
  ('a1300000-0000-4000-8006-000000000002', 'c1300000-0000-4000-8006-000000000001', 'Standard Wedding Sound & Lights — Signature', '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db'),
  ('a1300000-0000-4000-8007-000000000003', 'c1300000-0000-4000-8007-000000000001', 'Wedding Story Photo + Film — Signature', '39b29b24-05ec-4519-aa91-891369f1a48d'),
  ('a1300000-0000-4000-8008-000000000001', 'c1300000-0000-4000-8008-000000000001', 'Elegant Wedding Hosting — Signature', '6a84c0dc-5f8c-4788-83d4-3dbdefa4b2db');

insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available, submission_kind,
  moderation_note, moderated_at, moderated_by
)
select
  copy.copy_id, copy.provider_id, source.category_id, copy.copy_name,
  source.description, source.base_price, source.location, source.cover_image_url,
  source.gallery_urls, source.pricing_model, source.pricing_unit, source.pricing_details,
  source.catering_service_types, source.category_details, 'pending_review', true, 'new',
  null, null, null
from beta_service_copies copy
join public.services source on source.id = copy.source_id
on conflict (id) do nothing;

-- Florist configuration is normalized. Clone its arrangements and fulfillment
-- options before submitting the second florist listing for review.
insert into public.services (
  id, provider_id, category_id, name, description, base_price, location,
  cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details,
  catering_service_types, category_details, status, is_available, submission_kind
)
select
  'c1300000-0000-4000-8002-000000000001'::uuid,
  '39b29b24-05ec-4519-aa91-891369f1a48d'::uuid,
  source.category_id, 'Beta Floral Story — Signature', source.description,
  source.base_price, source.location, source.cover_image_url, source.gallery_urls,
  source.pricing_model, source.pricing_unit, source.pricing_details,
  source.catering_service_types, source.category_details, 'draft', true, 'new'
from public.services source
where source.id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid
on conflict (id) do nothing;

create temporary table beta_florist_arrangement_map (source_id uuid primary key, copy_id uuid not null) on commit drop;
insert into beta_florist_arrangement_map
select arrangement.id, gen_random_uuid()
from public.florist_arrangements arrangement
where arrangement.service_id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid;

insert into public.florist_arrangements (
  id, service_id, name, category, description, image_urls, base_price,
  pricing_unit, minimum_quantity, maximum_quantity, is_active, display_order
)
select map.copy_id, 'c1300000-0000-4000-8002-000000000001'::uuid,
  arrangement.name, arrangement.category, arrangement.description, arrangement.image_urls,
  arrangement.base_price, arrangement.pricing_unit, arrangement.minimum_quantity,
  arrangement.maximum_quantity, arrangement.is_active, arrangement.display_order
from beta_florist_arrangement_map map
join public.florist_arrangements arrangement on arrangement.id = map.source_id;

create temporary table beta_florist_group_map (source_id uuid primary key, copy_id uuid not null) on commit drop;
insert into beta_florist_group_map
select group_row.id, gen_random_uuid()
from public.florist_arrangement_option_groups group_row
join beta_florist_arrangement_map map on map.source_id = group_row.arrangement_id;

insert into public.florist_arrangement_option_groups (
  id, arrangement_id, name, selection_type, is_required, minimum_selections,
  maximum_selections, is_active, display_order
)
select map.copy_id, arrangement_map.copy_id, group_row.name, group_row.selection_type,
  group_row.is_required, group_row.minimum_selections, group_row.maximum_selections,
  group_row.is_active, group_row.display_order
from beta_florist_group_map map
join public.florist_arrangement_option_groups group_row on group_row.id = map.source_id
join beta_florist_arrangement_map arrangement_map on arrangement_map.source_id = group_row.arrangement_id;

insert into public.florist_arrangement_options (
  option_group_id, name, description, image_url, price_modifier, price_modifier_type,
  is_active, display_order
)
select group_map.copy_id, option_row.name, option_row.description, option_row.image_url,
  option_row.price_modifier, option_row.price_modifier_type, option_row.is_active,
  option_row.display_order
from public.florist_arrangement_options option_row
join beta_florist_group_map group_map on group_map.source_id = option_row.option_group_id;

insert into public.florist_service_fulfillment_options (
  service_id, fulfillment_kind, name, description, coverage_details, price, is_active, display_order
)
select 'c1300000-0000-4000-8002-000000000001'::uuid,
  fulfillment.fulfillment_kind, fulfillment.name, fulfillment.description,
  fulfillment.coverage_details, fulfillment.price, fulfillment.is_active, fulfillment.display_order
from public.florist_service_fulfillment_options fulfillment
where fulfillment.service_id = 'dadf546d-4500-4509-b72f-f84add11ac40'::uuid;

update public.services
set status = 'pending_review', updated_at = now()
where id = 'c1300000-0000-4000-8002-000000000001'::uuid
  and status = 'draft';

commit;
