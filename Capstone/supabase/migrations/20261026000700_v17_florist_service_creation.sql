-- MULTIVENT Revision V17, Phase 2: florist listing publication guard.
-- Drafts remain unrestricted so providers can complete their configuration
-- gradually. A client-visible or reviewable florist listing needs at least one
-- active, provider-defined bookable offering.

begin;

create or replace function public.validate_v17_florist_service_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_florist boolean := false;
  has_active_arrangement boolean := false;
  has_active_package boolean := false;
begin
  if new.status::text not in ('pending_review', 'active') then
    return new;
  end if;

  select lower(category.name) like '%flor%'
  into is_florist
  from public.service_categories category
  where category.id = new.category_id;

  if not coalesce(is_florist, false) then
    return new;
  end if;

  select exists (
    select 1
    from public.florist_arrangements arrangement
    where arrangement.service_id = new.id
      and arrangement.is_active = true
      and arrangement.minimum_quantity > 0
      and arrangement.base_price >= 0
  ) into has_active_arrangement;

  select exists (
    select 1
    from public.service_packages package
    where package.service_id = new.id
      and package.is_active = true
      and package.price is not null
      and package.price >= 0
      and exists (
        select 1
        from public.florist_package_arrangements item
        join public.florist_arrangements arrangement on arrangement.id = item.arrangement_id
        where item.package_id = package.id
          and item.included_quantity > 0
          and arrangement.is_active = true
      )
  ) into has_active_package;

  if not has_active_arrangement and not has_active_package then
    raise exception 'Add at least one active floral arrangement or active floral package before submitting this florist service for review.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_v17_florist_service_publication_trigger on public.services;
create trigger validate_v17_florist_service_publication_trigger
before insert or update of status, category_id on public.services
for each row execute function public.validate_v17_florist_service_publication();

comment on function public.validate_v17_florist_service_publication() is
  'Keeps florist drafts editable while requiring a real active offering before review or publication.';

revoke all on function public.validate_v17_florist_service_publication() from public;

commit;
