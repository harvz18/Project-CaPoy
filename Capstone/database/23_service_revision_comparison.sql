-- MULTIVENT service revision snapshots for moderation comparisons
-- Apply after 22_platform_audit_and_provider_service_crud.sql.
-- Preserves the last approved listing so staff can review exact before/after
-- changes when a provider resubmits a service.

begin;

alter table public.services
  add column if not exists submission_kind text not null default 'new',
  add column if not exists last_approved_snapshot jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_submission_kind_check'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_submission_kind_check
      check (submission_kind in ('new', 'updated'));
  end if;
end;
$$;

comment on column public.services.submission_kind is
  'Whether the current moderation submission is a new listing or an update to an approved listing.';
comment on column public.services.last_approved_snapshot is
  'Service and package data from the last approved revision, used for staff before/after review.';

create or replace function public.build_service_snapshot(target_service_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'service',
      (to_jsonb(service_row) - array[
        'last_approved_snapshot', 'submission_kind', 'moderation_note',
        'moderated_at', 'moderated_by', 'created_at', 'updated_at', 'status'
      ]) || jsonb_build_object('category_name', category_row.name),
    'packages',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(package_row) - array['created_at', 'updated_at', 'is_active']
            order by package_row.name, package_row.id
          )
          from public.service_packages package_row
          where package_row.service_id = service_row.id
        ),
        '[]'::jsonb
      )
  )
  from public.services service_row
  left join public.service_categories category_row on category_row.id = service_row.category_id
  where service_row.id = target_service_id;
$$;

revoke all on function public.build_service_snapshot(uuid) from public;

-- Existing active listings become the comparison baseline for their first edit.
select set_config('app.service_snapshot_authorized', 'true', true);
alter table public.services disable trigger capture_platform_audit_trigger;
update public.services
set last_approved_snapshot = public.build_service_snapshot(id)
where status = 'active'
  and last_approved_snapshot is null;
alter table public.services enable trigger capture_platform_audit_trigger;
select set_config('app.service_snapshot_authorized', 'false', true);

create or replace function public.enforce_service_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_material_change boolean;
begin
  if auth.role() = 'service_role'
    or public.is_platform_staff()
    or current_setting('app.service_delete_authorized', true) = 'true'
    or current_setting('app.service_snapshot_authorized', true) = 'true'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.submission_kind := 'new';
    new.last_approved_snapshot := null;
    if new.status <> 'draft' then
      new.status := 'pending_review';
      new.moderation_note := null;
      new.moderated_at := null;
      new.moderated_by := null;
    end if;
    return new;
  end if;

  -- These fields are maintained only by trusted moderation functions.
  new.submission_kind := old.submission_kind;
  new.last_approved_snapshot := old.last_approved_snapshot;

  has_material_change :=
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.base_price is distinct from old.base_price
    or new.category_id is distinct from old.category_id
    or new.location is distinct from old.location
    or new.cover_image_url is distinct from old.cover_image_url
    or new.gallery_urls is distinct from old.gallery_urls
    or new.pricing_model is distinct from old.pricing_model
    or new.pricing_unit is distinct from old.pricing_unit
    or new.pricing_details is distinct from old.pricing_details;

  if old.status = 'active' and has_material_change then
    new.last_approved_snapshot := public.build_service_snapshot(old.id);
    new.submission_kind := 'updated';
  elsif has_material_change and old.last_approved_snapshot is not null then
    new.submission_kind := 'updated';
  end if;

  if new.status <> 'draft' and (
    new.status is distinct from old.status or has_material_change
  ) then
    new.status := 'pending_review';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_service_review_status() from public;

create or replace function public.snapshot_service_before_package_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_service_id uuid;
begin
  if auth.role() = 'service_role'
    or public.is_platform_staff()
    or current_setting('app.service_delete_authorized', true) = 'true'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  affected_service_id := coalesce(new.service_id, old.service_id);

  if exists (
    select 1 from public.services
    where id = affected_service_id and status = 'active'
  ) then
    perform set_config('app.service_snapshot_authorized', 'true', true);
    update public.services
    set last_approved_snapshot = public.build_service_snapshot(affected_service_id),
        submission_kind = 'updated'
    where id = affected_service_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.snapshot_service_before_package_change() from public;

drop trigger if exists snapshot_service_before_package_change_trigger on public.service_packages;
create trigger snapshot_service_before_package_change_trigger
before insert or update or delete on public.service_packages
for each row execute function public.snapshot_service_before_package_change();

create or replace function public.admin_review_service(
  target_service_id uuid,
  decision text,
  review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role public.user_role;
  previous_status text;
  next_status text;
  service_name text;
  provider_user_id uuid;
  reviewed_submission_kind text;
begin
  select default_role into caller_role
  from public.profiles
  where id = auth.uid() and account_status = 'active';

  if caller_role is null or caller_role not in ('admin', 'superadmin') then
    raise exception 'Administrator access is required';
  end if;
  if decision is null or decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined';
  end if;

  select services.status, services.name, provider_profiles.user_id, services.submission_kind
  into previous_status, service_name, provider_user_id, reviewed_submission_kind
  from public.services
  join public.provider_profiles on provider_profiles.id = services.provider_id
  where services.id = target_service_id
  for update of services;

  if previous_status is null then raise exception 'Service not found'; end if;
  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only services awaiting review or previously declined can be moderated';
  end if;

  next_status := case when decision = 'approved' then 'active' else 'rejected' end;

  update public.service_packages
  set is_active = (decision = 'approved'), updated_at = now()
  where service_id = target_service_id;

  update public.services
  set status = next_status,
      moderation_note = nullif(trim(review_note), ''),
      moderated_at = now(),
      moderated_by = auth.uid(),
      last_approved_snapshot = case
        when decision = 'approved' then public.build_service_snapshot(target_service_id)
        else last_approved_snapshot
      end,
      updated_at = now()
  where id = target_service_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'service.review.' || decision, 'service', target_service_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', next_status),
    'completed',
    jsonb_build_object(
      'note', nullif(trim(review_note), ''),
      'submission_kind', reviewed_submission_kind
    )
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when decision = 'approved' then 'Service approved' else 'Service needs changes' end,
    case
      when decision = 'approved' then service_name || ' is now visible to clients.'
      else service_name || ' was not approved.' ||
        case when nullif(trim(review_note), '') is not null then ' ' || trim(review_note) else '' end
    end,
    'service', target_service_id
  );
end;
$$;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

commit;
