-- Replaces the unreliable LoremFlickr endpoints from the marketplace refresh
-- with direct Unsplash image endpoints that are compatible with the mobile web
-- image component. Every active category receives a curated visual rotation.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

with image_library(category_name, image_urls) as (
  values
    ('Attire', array['https://images.unsplash.com/photo-1681714552617-fe3f4cf4be47?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1632729331892-b318f62e4e72?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1594552072238-b8a33785b261?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Catering', array['https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Florists', array['https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Venues & Estates', array['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Host/Emcee', array['https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Photography', array['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=82']::text[]),
    ('Sound & Lights', array['https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1600&q=82','https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1600&q=82']::text[])
), ranked as (
  select service.id, library.image_urls, row_number() over (partition by category.name order by service.name)::integer as position
  from public.services service join public.service_categories category on category.id=service.category_id join image_library library on library.category_name=category.name
  where service.status='active' and service.is_available
), desired as (
  select id, image_urls[((position - 1) % cardinality(image_urls)) + 1] as image_url from ranked
)
update public.services service set cover_image_url=desired.image_url,gallery_urls=jsonb_build_array(desired.image_url),updated_at=now()
from desired where service.id=desired.id;
commit;
