-- MULTIVENT service moderation adjustment: accept every enabled provider account state.
-- Apply after 47_composed_service_packages.sql.

begin;

-- Provider verification and login/account enablement are separate checks. Some
-- valid providers use the legacy `active` profile state while newer approvals
-- use `verified`. Both states are enabled throughout the rest of the platform.
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
  provider_verification public.account_status;
  provider_account_status public.account_status;
  reviewed_submission_kind text;
begin
  if decision = 'approved' and not public.has_permission('services.approve') then
    raise exception 'Service-approval access is required.' using errcode = '42501';
  elsif decision = 'declined' and not public.has_permission('services.reject') then
    raise exception 'Service-rejection access is required.' using errcode = '42501';
  elsif not public.has_permission('services.review') then
    raise exception 'Service-review access is required.' using errcode = '42501';
  end if;
  if decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined.';
  end if;
  if decision = 'declined' and nullif(trim(review_note), '') is null then
    raise exception 'A rejection reason is required.';
  end if;

  select profile.default_role into caller_role
  from public.profiles profile
  where profile.id = auth.uid();

  select service.status, service.name, provider.user_id,
    provider.verification_status, profile.account_status, service.submission_kind
  into previous_status, service_name, provider_user_id,
    provider_verification, provider_account_status, reviewed_submission_kind
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles profile on profile.id = provider.user_id
  where service.id = target_service_id
  for update of service;

  if previous_status is null then
    raise exception 'Service not found.';
  end if;
  if previous_status not in ('pending_review', 'rejected') then
    raise exception 'Only services awaiting review or previously declined can be moderated.';
  end if;
  if decision = 'approved' and provider_verification <> 'verified' then
    raise exception 'Approve the provider application before approving this service.';
  end if;
  if decision = 'approved'
    and provider_account_status not in ('active', 'verified')
  then
    raise exception 'Enable the provider account before approving this service. Its current status is %.',
      provider_account_status;
  end if;

  next_status := case when decision = 'approved' then 'active' else 'rejected' end;
  perform set_config('app.service_delete_authorized', 'true', true);
  perform set_config('app.service_snapshot_authorized', 'true', true);

  update public.service_packages
  set is_active = (decision = 'approved'),
      updated_at = now()
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
    'success',
    jsonb_build_object(
      'note', nullif(trim(review_note), ''),
      'submission_kind', reviewed_submission_kind
    )
  );

  insert into public.notifications (user_id, title, body, resource_type, resource_id)
  values (
    provider_user_id,
    case when decision = 'approved' then 'Service approved' else 'Service needs changes' end,
    case when decision = 'approved'
      then service_name || ' is now visible to clients.'
      else service_name || ' was not approved. ' || trim(review_note)
    end,
    'service', target_service_id
  );
end;
$$;

revoke all on function public.admin_review_service(uuid, text, text) from public;
grant execute on function public.admin_review_service(uuid, text, text) to authenticated;

comment on function public.admin_review_service(uuid, text, text) is
  'Moderates a service after validating staff permissions, provider verification, and enabled account status.';

commit;
