-- Security remediation: retain public marketplace category discovery while
-- preventing anonymous or ordinary authenticated category configuration writes.

begin;

do $$
begin
  if to_regclass('public.service_categories') is null then
    raise exception 'Expected table public.service_categories does not exist; refusing to apply category-access remediation.';
  end if;
end;
$$;

alter table public.service_categories enable row level security;

-- Replace inherited/broad grants with the one deliberately supported API
-- operation below.  Direct category management stays default-deny; the current
-- application has no direct category CRUD caller and uses category reads for
-- marketplace/service validation only.
revoke all privileges on table public.service_categories from public, anon, authenticated;
grant select on table public.service_categories to anon, authenticated;

drop policy if exists "Active service categories are public" on public.service_categories;
drop policy if exists "Active service categories are readable" on public.service_categories;

create policy "Active service categories are readable"
  on public.service_categories
  for select
  to anon, authenticated
  using (is_active = true);

comment on table public.service_categories is
  'Marketplace categories: active rows are readable through RLS; direct client API mutation is prohibited.';

commit;
