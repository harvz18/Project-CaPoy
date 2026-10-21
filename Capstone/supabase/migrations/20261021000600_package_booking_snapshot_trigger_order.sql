-- Keep the package snapshot enforcement after the established Phase 5 and V8
-- booking triggers. PostgreSQL executes same-timing triggers alphabetically;
-- the final package trigger therefore restores the selected, authoritative
-- package quote instead of allowing a later generic trigger to overwrite it.
begin;

drop trigger if exists enforce_v10_package_booking_terms_trigger on public.bookings;
drop trigger if exists z_enforce_v10_package_booking_terms_trigger on public.bookings;
create trigger z_enforce_v10_package_booking_terms_trigger
before insert or update of event_id, client_id, provider_id, service_id, package_id,
  amount, provider_amount, commission_rate, commission_amount, commission_model,
  financial_terms_version, initial_payment_rate, provider_initial_rate, package_snapshot
on public.bookings
for each row execute function public.enforce_v10_package_booking_terms();

comment on trigger z_enforce_v10_package_booking_terms_trigger on public.bookings is
  'Runs after generic booking pricing triggers so a selected provider package keeps its one-time authoritative snapshot.';

commit;
