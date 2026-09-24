-- MULTIVENT service-listing moderation workflow
-- Apply after 20_admin_web_access.sql.
-- Provider submissions and material edits remain hidden until an admin or
-- superadmin explicitly approves them.

alter table public.services
  add column if not exists moderation_note text,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id);

comment on column public.services.moderation_note is
  'Most recent staff moderation note shown to the provider.';
comment on column public.services.moderated_at is
  'Time of the most recent approve or decline decision.';
comment on column public.services.moderated_by is
  'Admin or superadmin who made the most recent decision.';

drop policy if exists "Platform staff can view service packages" on public.service_packages;
create policy "Platform staff can view service packages"
  on public.service_packages for select to authenticated
  using (public.is_platform_staff());

create or replace function public.enforce_service_review_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted backend jobs and platform staff decisions retain their requested status.
  if auth.role() = 'service_role'
    or public.is_platform_staff()
    or current_setting('app.service_delete_authorized', true) = 'true'
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      new.status := 'pending_review';
      new.moderation_note := null;
      new.moderated_at := null;
      new.moderated_by := null;
    end if;
    return new;
  end if;

  -- A provider may keep a draft private. Every submitted listing and every
  -- material change to a reviewed listing requires a fresh staff decision.
  if new.status <> 'draft' and (
    new.status is distinct from old.status
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.base_price is distinct from old.base_price
    or new.category_id is distinct from old.category_id
    or new.location is distinct from old.location
    or new.cover_image_url is distinct from old.cover_image_url
    or new.gallery_urls is distinct from old.gallery_urls
    or new.pricing_model is distinct from old.pricing_model
    or new.pricing_unit is distinct from old.pricing_unit
    or new.pricing_details is distinct from old.pricing_details
  ) then
    new.status := 'pending_review';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_service_review_status_trigger on public.services;
create trigger enforce_service_review_status_trigger
before insert or update on public.services
for each row execute function public.enforce_service_review_status();

revoke all on function public.enforce_service_review_status() from public;

create or replace function public.mark_service_pending_after_package_change()
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
    return null;
  end if;

  affected_service_id := coalesce(new.service_id, old.service_id);

  update public.services
  set status = 'pending_review',
      moderation_note = null,
      moderated_at = null,
      moderated_by = null,
      updated_at = now()
  where id = affected_service_id
    and status not in ('draft', 'pending_review');

  return null;
end;
$$;

drop trigger if exists mark_service_pending_after_package_change_trigger on public.service_packages;
create trigger mark_service_pending_after_package_change_trigger
after insert or update or delete on public.service_packages
for each row execute function public.mark_service_pending_after_package_change();

revoke all on function public.mark_service_pending_after_package_change() from public;

create index if not exists services_status_updated_at_idx
  on public.services (status, updated_at desc);

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

  select services.status, services.name, provider_profiles.user_id
  into previous_status, service_name, provider_user_id
  from public.services
  join public.provider_profiles on provider_profiles.id = services.provider_id
  where services.id = target_service_id
  for update of services;

  if previous_status is null then
    raise exception 'Service not found';
  end if;

  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only services awaiting review or previously declined can be moderated';
  end if;

  next_status := case when decision = 'approved' then 'active' else 'rejected' end;

  update public.services
  set status = next_status,
      moderation_note = nullif(trim(review_note), ''),
      moderated_at = now(),
      moderated_by = auth.uid(),
      updated_at = now()
  where id = target_service_id;

  update public.service_packages
  set is_active = (decision = 'approved'),
      updated_at = now()
  where service_id = target_service_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id,
    previous_state, new_state, result, metadata
  ) values (
    auth.uid(), caller_role, 'service.review.' || decision, 'service', target_service_id,
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', next_status),
    'completed',
    jsonb_build_object('note', nullif(trim(review_note), ''))
  );

  insert into public.notifications (
    user_id, title, body, resource_type, resource_id
  ) values (
    provider_user_id,
    case when decision = 'approved' then 'Service approved' else 'Service needs changes' end,
    case
      when decision = 'approved' then service_name || ' is now visible to clients.'
      else service_name || ' was not approved.' ||
        case when nullif(trim(review_note), '') is not null then ' ' || trim(review_note) else '' end
    end,
    'service',
    target_service_id
  );
end;
$$;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

-- Existing provider-published listings remain active. Only future submissions
-- and future edits enter the review workflow.
