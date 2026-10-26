-- MULTIVENT Revision V17, Phase 6: broaden provider-defined florist fulfillment.
-- Existing pickup, delivery, and installation rows remain valid.
begin;

alter table public.florist_service_fulfillment_options
  drop constraint if exists florist_service_fulfillment_options_fulfillment_kind_check,
  add constraint florist_service_fulfillment_options_fulfillment_kind_check
    check (fulfillment_kind in (
      'pickup', 'delivery', 'delivery_with_setup', 'installation', 'post_event_removal'
    ));

comment on column public.florist_service_fulfillment_options.fulfillment_kind is
  'Provider-defined florist fulfillment method. Delivery and setup schedules continue to use existing availability controls.';

commit;
