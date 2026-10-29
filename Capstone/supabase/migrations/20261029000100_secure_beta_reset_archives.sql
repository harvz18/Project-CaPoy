-- Security remediation: protect retained beta-reset archive snapshots.
-- This migration is additive and deliberately preserves existing archive rows.

begin;

do $$
begin
  if to_regclass('public.beta_reset_archives') is null then
    raise exception 'Expected table public.beta_reset_archives does not exist; refusing to apply archive-access remediation.';
  end if;
end;
$$;

alter table public.beta_reset_archives enable row level security;

-- The table contains operational snapshot archives.  It is not a client-facing
-- resource, so default-deny RLS is intentional.  Revoke PUBLIC as well as the
-- concrete API roles because a PUBLIC grant applies to every role.
revoke all privileges on table public.beta_reset_archives from public, anon, authenticated;

comment on table public.beta_reset_archives is
  'Internal beta-reset archive snapshots. Client API roles have no direct access; access must use an approved internal operation.';

commit;
