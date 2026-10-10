-- MULTIVENT coordinator repair: bookable profiles and complete event context.
-- Apply after 65_downpayment_split_correction.sql.

begin;

-- Coordinator accounts created before the marketplace migration can already
-- own a valid Event Organizer listing while their coordinator service profile
-- remains at the migration defaults (PHP 0 and not accepting bookings). Seed
-- only those unconfigured profiles from their active listing. A coordinator's
-- explicit profile settings remain authoritative and are never overwritten.
create or replace function public.sync_unconfigured_coordinator_profile_from_listing(
  target_coordinator_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing record;
begin
  if target_coordinator_id is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = target_coordinator_id
      and profile.account_status = 'active'
      and (
        profile.default_role = 'event_coordinator'
        or exists (
          select 1
          from public.user_roles user_role
          join public.roles role on role.id = user_role.role_id
          where user_role.user_id = profile.id
            and role.name = 'event_coordinator'
        )
      )
  ) then
    return;
  end if;

  select service.description,
    round(coalesce(service.base_price, 0), 2) as coordination_fee,
    service.status::text = 'active'
      and service.is_available
      and coalesce(service.base_price, 0) > 0 as is_accepting_bookings,
    coalesce(specialization.values, '{}'::text[]) as specializations
  into listing
  from public.services service
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.service_categories category on category.id = service.category_id
  left join lateral (
    select coalesce(array_agg(distinct trim(item)) filter (where trim(item) <> ''),
      '{}'::text[]) as values
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(service.category_details -> 'specializations') = 'array'
          then service.category_details -> 'specializations'
        else '[]'::jsonb
      end
    ) item
  ) specialization on true
  where provider.user_id = target_coordinator_id
    and (
      lower(category.name) like '%organizer%'
      or lower(category.name) like '%coordinator%'
    )
  order by
    (service.status::text = 'active' and service.is_available
      and coalesce(service.base_price, 0) > 0) desc,
    service.updated_at desc,
    service.id
  limit 1;

  if not found then
    insert into public.coordinator_service_profiles (coordinator_id)
    values (target_coordinator_id)
    on conflict (coordinator_id) do nothing;
    return;
  end if;

  insert into public.coordinator_service_profiles (
    coordinator_id, description, coordination_fee, currency,
    specializations, is_accepting_bookings, updated_at
  ) values (
    target_coordinator_id,
    coalesce(trim(listing.description), ''),
    listing.coordination_fee,
    'PHP',
    listing.specializations,
    listing.is_accepting_bookings,
    now()
  )
  on conflict (coordinator_id) do update set
    description = case
      when trim(public.coordinator_service_profiles.description) = ''
        then excluded.description
      else public.coordinator_service_profiles.description
    end,
    coordination_fee = case
      when public.coordinator_service_profiles.coordination_fee <= 0
        then excluded.coordination_fee
      else public.coordinator_service_profiles.coordination_fee
    end,
    specializations = case
      when cardinality(public.coordinator_service_profiles.specializations) = 0
        then excluded.specializations
      else public.coordinator_service_profiles.specializations
    end,
    is_accepting_bookings = case
      when public.coordinator_service_profiles.coordination_fee <= 0
        then excluded.is_accepting_bookings
      else public.coordinator_service_profiles.is_accepting_bookings
    end,
    updated_at = case
      when trim(public.coordinator_service_profiles.description) = ''
        or public.coordinator_service_profiles.coordination_fee <= 0
        or cardinality(public.coordinator_service_profiles.specializations) = 0
        then now()
      else public.coordinator_service_profiles.updated_at
    end;
end;
$$;

create or replace function public.sync_coordinator_profile_listing_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner_id uuid;
  new_owner_id uuid;
begin
  if tg_op <> 'INSERT' then
    select provider.user_id into old_owner_id
    from public.provider_profiles provider
    where provider.id = old.provider_id;
  end if;
  if tg_op <> 'DELETE' then
    select provider.user_id into new_owner_id
    from public.provider_profiles provider
    where provider.id = new.provider_id;
  end if;

  if old_owner_id is not null then
    perform public.sync_unconfigured_coordinator_profile_from_listing(old_owner_id);
  end if;
  if new_owner_id is not null and new_owner_id is distinct from old_owner_id then
    perform public.sync_unconfigured_coordinator_profile_from_listing(new_owner_id);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_coordinator_profile_listing_write_trigger
  on public.services;
create trigger sync_coordinator_profile_listing_write_trigger
after insert or update of provider_id, category_id, description, base_price,
  status, is_available, category_details
on public.services
for each row execute function public.sync_coordinator_profile_listing_trigger();

drop trigger if exists sync_coordinator_profile_listing_delete_trigger
  on public.services;
create trigger sync_coordinator_profile_listing_delete_trigger
after delete on public.services
for each row execute function public.sync_coordinator_profile_listing_trigger();

do $$
declare
  coordinator_row record;
begin
  for coordinator_row in
    select profile.id
    from public.profiles profile
    where profile.account_status = 'active'
      and (
        profile.default_role = 'event_coordinator'
        or exists (
          select 1
          from public.user_roles user_role
          join public.roles role on role.id = user_role.role_id
          where user_role.user_id = profile.id
            and role.name = 'event_coordinator'
        )
      )
  loop
    perform public.sync_unconfigured_coordinator_profile_from_listing(coordinator_row.id);
  end loop;
end;
$$;

-- A single coordinator-scoped snapshot keeps pending-request review and the
-- accepted workspace consistent. It includes event facts, category budgets,
-- selected services, actual booking state, provider contacts, and client
-- instructions. It also includes a booked service if a historical booking has
-- no surviving selection row.
create or replace function public.get_my_coordinator_assignment_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with assigned_events as (
    select event.*
    from public.events event
    where auth.uid() is not null
      and event.status not in ('cancelled')
      and (
        (event.pending_coordinator_id = auth.uid()
          and event.coordinator_assignment_status = 'pending')
        or (event.coordinator_id = auth.uid()
          and event.coordinator_assignment_status = 'accepted')
      )
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId', event.id,
      'eventName', event.name,
      'eventType', event.event_type,
      'eventDate', event.event_date,
      'eventTime', event.event_time,
      'guestCount', event.guest_count,
      'totalBudget', event.total_budget,
      'status', event.status,
      'venueStatus', event.venue_status,
      'venue', event.venue,
      'location', event.location,
      'clientName', coalesce(client.full_name, 'Client'),
      'clientNotes', nullif(trim(event.notes), ''),
      'assignmentStatus', event.coordinator_assignment_status,
      'budgetAllocations', coalesce(budget.items, '[]'::jsonb),
      'services', coalesce(service.items, '[]'::jsonb)
    )
    order by event.coordinator_assignment_requested_at desc nulls last,
      event.updated_at desc
  ), '[]'::jsonb)
  from assigned_events event
  join public.profiles client on client.id = event.client_id
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'categoryKey', item.category_key,
      'label', item.label,
      'allocatedAmount', coalesce(item.allocated_amount, item.estimated_amount, 0),
      'actualAmount', coalesce(item.actual_amount, 0)
    ) order by item.priority_rank nulls last, item.label) as items
    from public.event_budget_items item
    where item.event_id = event.id
      and item.allocation_version = 'phase7-v1'
  ) budget on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', service_row.id,
      'serviceId', service_row.service_id,
      'serviceName', service_row.service_name,
      'categoryName', service_row.category_name,
      'providerId', service_row.provider_id,
      'providerUserId', service_row.provider_user_id,
      'providerName', service_row.provider_name,
      'providerEmail', service_row.provider_email,
      'providerPhone', service_row.provider_phone,
      'amount', service_row.amount,
      'status', service_row.status,
      'booked', service_row.booking_id is not null,
      'bookingId', service_row.booking_id,
      'notes', service_row.notes,
      'cateringOptionName', service_row.catering_option_name,
      'venueOptionName', service_row.venue_option_name,
      'venueBookedHours', service_row.venue_booked_hours
    ) order by service_row.created_at, service_row.id) as items
    from (
      select selection.id,
        selection.service_id,
        selection.service_name,
        coalesce(selection.category_name, category.name, 'Service') as category_name,
        selection.provider_id,
        provider.user_id as provider_user_id,
        coalesce(provider.business_name, 'Provider') as provider_name,
        provider.contact_email as provider_email,
        provider.contact_phone as provider_phone,
        selection.estimated_amount as amount,
        coalesce(latest_booking.status::text, selection.status) as status,
        latest_booking.id as booking_id,
        coalesce(latest_booking.client_notes, selection.notes,
          selection.dietary_notes) as notes,
        selection.catering_option_name,
        selection.venue_option_name,
        selection.venue_booked_hours,
        selection.created_at
      from public.event_service_selections selection
      left join public.services listed_service on listed_service.id = selection.service_id
      left join public.service_categories category on category.id = listed_service.category_id
      left join public.provider_profiles provider on provider.id = selection.provider_id
      left join lateral (
        select booking.id, booking.status, booking.client_notes
        from public.bookings booking
        where booking.event_id = selection.event_id
          and booking.provider_id = selection.provider_id
          and booking.service_id = selection.service_id
          and booking.status not in ('rejected', 'cancelled', 'expired')
        order by booking.updated_at desc, booking.id desc
        limit 1
      ) latest_booking on true
      where selection.event_id = event.id
        and selection.status not in ('declined', 'cancelled')

      union all

      select booking.id,
        booking.service_id,
        coalesce(listed_service.name, 'Service'),
        coalesce(category.name, 'Service'),
        booking.provider_id,
        provider.user_id,
        coalesce(provider.business_name, 'Provider'),
        provider.contact_email,
        provider.contact_phone,
        coalesce(booking.amount, 0),
        booking.status::text,
        booking.id,
        booking.client_notes,
        booking.catering_option_name,
        booking.venue_option_name,
        booking.venue_booked_hours,
        booking.created_at
      from public.bookings booking
      join public.services listed_service on listed_service.id = booking.service_id
      left join public.service_categories category on category.id = listed_service.category_id
      join public.provider_profiles provider on provider.id = booking.provider_id
      where booking.event_id = event.id
        and booking.status not in ('rejected', 'cancelled', 'expired')
        and not exists (
          select 1
          from public.event_service_selections selection
          where selection.event_id = booking.event_id
            and selection.provider_id = booking.provider_id
            and selection.service_id = booking.service_id
            and selection.status not in ('declined', 'cancelled')
        )
    ) service_row
  ) service on true;
$$;

revoke all on function public.sync_unconfigured_coordinator_profile_from_listing(uuid)
  from public;
revoke all on function public.sync_coordinator_profile_listing_trigger() from public;
revoke all on function public.get_my_coordinator_assignment_context() from public;
grant execute on function public.get_my_coordinator_assignment_context()
  to authenticated;

comment on function public.get_my_coordinator_assignment_context() is
  'Returns complete event, budget, selected-service, booking, provider, and client-note context only for the signed-in pending or accepted coordinator.';

commit;

