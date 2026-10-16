begin;

-- A provider package is a fixed event bundle, not a catering preset.  Keep the
-- existing quote implementation intact for every normal service, and route
-- only a selected catering service_package through this fixed-total contract.
alter function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid)
  rename to calculate_event_service_quote_standard;

create function public.calculate_event_service_quote(
  target_service_id uuid,
  target_event_id uuid,
  target_option_id text default null,
  target_quantity numeric default null,
  target_package_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  package_row record;
  category_key text;
  commission_rate numeric := public.get_public_commission_rate();
  provider_amount numeric(12,2);
  customer_amount numeric(12,2);
  initial_payment_rate numeric := 0.35;
  provider_initial_rate numeric := 0.30;
begin
  -- Preserve the existing, fully validated pricing contract unless the client
  -- explicitly selects a provider-created package for a catering service.
  if target_package_id is null then
    return public.calculate_event_service_quote_standard(
      target_service_id, target_event_id, target_option_id, target_quantity, null
    );
  end if;

  select public.phase9_category_key(category.name) into category_key
  from public.services service
  join public.service_categories category on category.id = service.category_id
  where service.id = target_service_id;

  if category_key is distinct from 'catering' then
    return public.calculate_event_service_quote_standard(
      target_service_id, target_event_id, target_option_id, target_quantity, target_package_id
    );
  end if;

  select * into event_row
  from public.events event
  where event.id = target_event_id
    and event.client_id = auth.uid()
    and event.status not in ('completed', 'cancelled');
  if event_row.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;

  select
    service.id as service_id,
    service.name as service_name,
    package.id as package_id,
    package.name as package_name,
    package.price as package_price
  into package_row
  from public.services service
  join public.service_categories category on category.id = service.category_id
  join public.provider_profiles provider on provider.id = service.provider_id
  join public.profiles owner on owner.id = provider.user_id
  join public.service_packages package on package.id = target_package_id
    and package.service_id = service.id
    and package.is_active = true
  where service.id = target_service_id
    and service.status = 'active'
    and service.is_available = true
    and public.phase9_category_key(category.name) = 'catering'
    and owner.account_status in ('active', 'verified');

  if package_row.service_id is null then
    raise exception 'The selected provider package is no longer available.';
  end if;

  provider_amount := round(coalesce(package_row.package_price, 0), 2);
  if provider_amount <= 0 then
    raise exception 'The selected provider package must have a fixed price greater than zero.';
  end if;

  customer_amount := round(provider_amount * (1 + commission_rate), 2);
  return jsonb_build_object(
    'serviceId', package_row.service_id,
    'serviceName', package_row.service_name,
    'categoryKey', 'catering',
    'isCatering', true,
    'guestCount', greatest(coalesce(event_row.guest_count, 0), 0),
    'providerUnitPrice', provider_amount,
    'providerAmount', provider_amount,
    'serviceSubtotal', provider_amount,
    'commissionRate', commission_rate,
    'platformFee', round(customer_amount - provider_amount, 2),
    'commissionAmount', round(customer_amount - provider_amount, 2),
    'customerAmount', customer_amount,
    'clientTotal', customer_amount,
    'initialPayment', round(provider_amount * initial_payment_rate, 2),
    'providerInitialShare', round(provider_amount * provider_initial_rate, 2),
    'remainingProviderBalance', round(provider_amount * (1 - provider_initial_rate), 2),
    'cateringOption', jsonb_build_object(
      'id', 'provider-package:' || package_row.package_id::text,
      'name', package_row.package_name,
      'pricingBasis', 'provider_package_fixed_total',
      'providerAmount', provider_amount,
      'packageId', package_row.package_id
    ),
    'venueOption', '{}'::jsonb,
    'bookedHours', null,
    'setupStartAt', null,
    'startAt', null,
    'endAt', null
  );
end;
$$;

revoke all on function public.calculate_event_service_quote_standard(uuid, uuid, text, numeric, uuid) from public;
revoke all on function public.calculate_event_service_quote_standard(uuid, uuid, text, numeric, uuid) from authenticated;
revoke all on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) from public;
grant execute on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) to authenticated;

comment on function public.calculate_event_service_quote(uuid, uuid, text, numeric, uuid) is
  'Authoritative service quote. A selected provider catering package is always a fixed event total; catering presets and custom menus retain their existing guest-based rules.';

commit;
