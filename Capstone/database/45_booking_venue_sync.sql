-- MULTIVENT booking adjustment: keep event venue details in sync with venue services.
-- Apply after 44_profile_photos.sql.

begin;

-- Event details historically only used the venue entered during event creation.
-- Clients who selected a marketplace venue therefore still saw "Venue to be
-- confirmed". This helper treats an active venue-service selection as the
-- authoritative venue while leaving unrelated/manual venue details alone.
create or replace function public.refresh_event_venue_from_selections(
  target_event_id uuid,
  removed_venue_label text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  venue_choice record;
begin
  if target_event_id is null then
    return;
  end if;

  select selection.id,
    concat_ws(
      ' - ',
      coalesce(
        nullif(trim(selection.selected_provider_snapshot ->> 'providerName'), ''),
        nullif(trim(provider.business_name), ''),
        'Venue provider'
      ),
      coalesce(
        nullif(trim(selection.service_name), ''),
        nullif(trim(service.name), ''),
        'Venue'
      )
    ) as venue_label,
    coalesce(
      nullif(trim(selection.selected_provider_snapshot ->> 'providerLocation'), ''),
      nullif(trim(service.location), ''),
      nullif(trim(provider.location), '')
    ) as venue_location
  into venue_choice
  from public.event_service_selections selection
  left join public.service_categories category on category.id = selection.category_id
  left join public.services service on service.id = selection.service_id
  left join public.provider_profiles provider on provider.id = selection.provider_id
  where selection.event_id = target_event_id
    and selection.status in ('selected', 'requested', 'confirmed')
    and lower(concat_ws(' ', selection.category_name, category.name))
      ~ '(venue|estate|function[[:space:]]*hall|event[[:space:]]*space)'
  order by
    case selection.status
      when 'confirmed' then 1
      when 'requested' then 2
      else 3
    end,
    selection.updated_at desc,
    selection.id
  limit 1;

  if venue_choice.id is not null then
    update public.events event
    set venue = venue_choice.venue_label,
        location = venue_choice.venue_location,
        venue_status = 'secured',
        updated_at = now()
    where event.id = target_event_id
      and (
        event.venue is distinct from venue_choice.venue_label
        or event.location is distinct from venue_choice.venue_location
        or event.venue_status is distinct from 'secured'
      );
  elsif nullif(trim(removed_venue_label), '') is not null then
    -- Clear only a label that this synchronization previously produced. A
    -- manually changed venue is preserved if the service selection is removed.
    update public.events event
    set venue = null,
        location = null,
        venue_status = 'searching',
        updated_at = now()
    where event.id = target_event_id
      and event.venue = removed_venue_label;
  end if;
end;
$$;

revoke all on function public.refresh_event_venue_from_selections(uuid, text) from public;

create or replace function public.sync_event_venue_from_selection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_category_name text;
  previous_event_id uuid;
  previous_venue_label text;
begin
  if tg_op <> 'INSERT' then
    previous_event_id := old.event_id;

    select category.name into previous_category_name
    from public.service_categories category
    where category.id = old.category_id;

    if lower(concat_ws(' ', old.category_name, previous_category_name))
      ~ '(venue|estate|function[[:space:]]*hall|event[[:space:]]*space)'
    then
      select concat_ws(
        ' - ',
        coalesce(
          nullif(trim(old.selected_provider_snapshot ->> 'providerName'), ''),
          (
            select nullif(trim(provider.business_name), '')
            from public.provider_profiles provider
            where provider.id = old.provider_id
          ),
          'Venue provider'
        ),
        coalesce(nullif(trim(old.service_name), ''), 'Venue')
      ) into previous_venue_label;
    end if;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_event_venue_from_selections(
      previous_event_id,
      previous_venue_label
    );
    return old;
  end if;

  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    perform public.refresh_event_venue_from_selections(
      previous_event_id,
      previous_venue_label
    );
  end if;

  perform public.refresh_event_venue_from_selections(
    new.event_id,
    previous_venue_label
  );
  return new;
end;
$$;

drop trigger if exists sync_event_venue_selection_write_trigger
  on public.event_service_selections;
create trigger sync_event_venue_selection_write_trigger
after insert or update of event_id, provider_id, service_id, category_id,
  service_name, category_name, status, selected_provider_snapshot
on public.event_service_selections
for each row execute function public.sync_event_venue_from_selection_change();

drop trigger if exists sync_event_venue_selection_delete_trigger
  on public.event_service_selections;
create trigger sync_event_venue_selection_delete_trigger
after delete on public.event_service_selections
for each row execute function public.sync_event_venue_from_selection_change();

revoke all on function public.sync_event_venue_from_selection_change() from public;

-- Repair events that already reached the booking/provider-request stages. Draft
-- selections are intentionally not rewritten during migration; their next edit
-- will be handled by the trigger above.
do $$
declare
  booked_event record;
begin
  for booked_event in
    select distinct selection.event_id
    from public.event_service_selections selection
    left join public.service_categories category on category.id = selection.category_id
    where selection.status in ('requested', 'confirmed')
      and lower(concat_ws(' ', selection.category_name, category.name))
        ~ '(venue|estate|function[[:space:]]*hall|event[[:space:]]*space)'
  loop
    perform public.refresh_event_venue_from_selections(booked_event.event_id);
  end loop;
end;
$$;

comment on function public.refresh_event_venue_from_selections(uuid, text) is
  'Synchronizes an event venue label and address from its active marketplace venue selection.';

commit;
