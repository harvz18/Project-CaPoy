-- A client who explicitly updates a changed service receives a new
-- authoritative selection snapshot. Continue blocking untouched price
-- changes, but do not keep the plan blocked solely by its older aggregate
-- saved-plan estimate.

begin;

alter function public.review_my_saved_booking_plan(uuid)
  rename to review_my_saved_booking_plan_v9_initial;

create function public.review_my_saved_booking_plan(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  review jsonb;
  has_unresolved_price_change boolean := false;
begin
  review := public.review_my_saved_booking_plan_v9_initial(target_event_id);

  select exists (
    select 1
    from jsonb_array_elements(coalesce(review -> 'items', '[]'::jsonb)) item(value)
    where coalesce((item.value ->> 'available')::boolean, false)
      and item.value ? 'currentAmount'
      and abs(
        coalesce((item.value ->> 'currentAmount')::numeric, 0)
        - coalesce((item.value ->> 'savedAmount')::numeric, 0)
      ) > 0.01
  ) into has_unresolved_price_change;

  return jsonb_set(
    review,
    '{hasPriceChanges}',
    to_jsonb(has_unresolved_price_change),
    true
  );
end;
$$;

revoke all on function public.review_my_saved_booking_plan(uuid) from public;
grant execute on function public.review_my_saved_booking_plan(uuid) to authenticated;

comment on function public.review_my_saved_booking_plan(uuid) is
  'Rechecks saved plan availability and only unresolved per-service price changes before checkout.';

commit;
