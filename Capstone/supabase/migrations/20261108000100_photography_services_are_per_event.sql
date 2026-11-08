-- Photography coverage packages are quoted once for the event. Their duration
-- describes included coverage, not an hourly multiplier for the base service.
-- Explicit additional-hour configuration remains unchanged and is the only
-- hourly Photo/Video charge.

begin;

update public.services service
set pricing_unit = 'event',
    updated_at = now()
from public.service_categories category
where category.id = service.category_id
  and category.name = 'Photography'
  and service.pricing_unit is distinct from 'event';

commit;
