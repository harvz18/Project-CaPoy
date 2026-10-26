import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const mustContain = (source: string, fragments: string[], label: string) => {
  fragments.forEach((fragment) => {
    assert.ok(source.includes(fragment), `${label} is missing: ${fragment}`)
  })
}

const migrations = [
  'database/53_coordinator_marketplace.sql',
  'database/54_coordinator_packages.sql',
  'database/55_catering_pricing_revision.sql',
  'database/56_payment_revenue_revision.sql',
  'database/57_payment_hold_provider_acceptance.sql',
  'database/58_budget_allocation_revision.sql',
  'database/59_budget_aware_recommendations.sql',
  'database/60_service_selection_revision.sql',
  'database/61_coordinator_request_financial_visibility.sql',
  'database/62_dss_service_discovery.sql',
  'database/63_mobile_session_push_notifications.sql',
  'database/64_mobile_push_security_hardening.sql',
  'database/65_downpayment_split_correction.sql',
  'database/66_coordinator_assignment_event_visibility.sql',
  'database/67_budget_allocation_upsert_correction.sql',
  'database/68_conditional_event_coordinator_step.sql',
  'database/69_provider_external_payment_confirmation.sql',
  'database/70_booking_restricted_messaging.sql',
  'database/71_catering_custom_menu_pricing.sql',
  'database/72_catering_food_tasting_scheduling.sql',
  'database/73_catering_food_tasting_timezone_guard.sql',
  'database/74_external_payment_request_key_disambiguation.sql',
]

test('Revision 2 migrations remain ordered, transactional, additive, and non-destructive', () => {
  migrations.forEach((path) => {
    const sql = read(path)
    assert.match(sql, /\bbegin\s*;/i, `${path} must open a transaction`)
    assert.match(sql, /\bcommit\s*;/i, `${path} must commit its transaction`)
    assert.doesNotMatch(sql, /\bdrop\s+table\b/i, `${path} must not drop tables`)
    assert.doesNotMatch(sql, /\btruncate\b/i, `${path} must not truncate data`)
  })
})

test('coordinator skip, booking, acceptance, rejection, and curated packages remain connected', () => {
  const marketplace = read(migrations[0])
  const packages = read(migrations[1])
  const phase6 = read(migrations[4])
  const planning = read('src/lib/planning.ts')
  const coordinator = read('src/lib/coordinator.ts')

  mustContain(marketplace, [
    "coordinator_preference in ('undecided', 'skipped', 'selected')",
    'create or replace function public.assign_event_coordinator(',
    'create or replace function public.respond_event_coordinator_assignment(',
  ], 'coordinator marketplace migration')
  mustContain(packages, [
    'references public.services(id) on delete restrict',
    'create or replace function public.choose_coordinator_package(',
    'Each provider will still review its own booking request.',
  ], 'coordinator package migration')
  mustContain(phase6, [
    'create or replace function public.respond_event_coordinator_assignment(',
    "when accept_assignment then 'accepted' else 'declined'",
    'release_phase6_coordinator_initial_share',
    "provider_funds_status = 'rejected_held'",
  ], 'coordinator payment-response migration')
  mustContain(planning, [
    'target_preference: preference',
    "client.rpc('assign_event_coordinator_only'",
    "client.rpc('choose_coordinator_package_phase9'",
  ], 'client coordinator integration')
  mustContain(coordinator, [
    "supabase.rpc('respond_event_coordinator_assignment'",
  ], 'coordinator response integration')
})

test('catering prices remain guest-based and validate provider option ranges', () => {
  const catering = read(migrations[2])
  const selection = read(migrations[7])
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(catering, [
    "category_details -> 'pricingOptions'",
    "option_row ->> 'pricePerHead'",
    "option_row ->> 'minimumGuests'",
    "option_row ->> 'maximumGuests'",
    'provider_unit_price * event_guests',
    'catering_option_snapshot',
  ], 'catering pricing migration')
  mustContain(selection, [
    'provider_unit_price * event_row.guest_count',
    'This catering option does not support the event guest count.',
  ], 'Phase 9 central quote')
  mustContain(details, [
    'selectedCateringOption',
    'minimumGuests',
    'maximumGuests',
    'pricePerHead',
  ], 'client catering UI')
})

test('provider-created packages honor their configured unit and retain an immutable booking snapshot', () => {
  const migration = read('supabase/migrations/20261021000500_package_booking_configuration.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(migration, [
    'rename to calculate_event_service_quote_v10_prepackage',
    "if package_unit = 'person' then",
    'provider_amount := round(provider_unit_price * event_row.guest_count, 2);',
    "package_pricing_model := 'fixed_event';",
    "'packageSnapshot', package_snapshot",
    'capture_v10_service_package_snapshot_trigger',
    'enforce_v10_package_booking_terms_trigger',
    'new.package_snapshot := selection_row.package_snapshot;',
    'if new.package_id is not null then',
  ], 'provider package quote and snapshot migration')
  mustContain(details, [
    'usesSelectedProviderPackage',
    'Provider package · fixed total for the event',
    "selectedUnit === 'person'",
    "pricingUnit: selectedPackage.unit ?? service.pricingUnit ?? 'event'",
    'Package terms replace individual venue options and duration.',
  ], 'client provider-package selection')
  mustContain(planning, [
    'const hasSelectedProviderPackage = Boolean(packageId && isUuid(packageId))',
    'const hasSelectedProviderPackage = isUuid(packageId)',
    'package_snapshot: selection.package_snapshot',
  ], 'package quote, save, and checkout integration')
})

test('Provider 1 customizable catering demo remains client-selectable and starting-at priced', () => {
  const migration = read('supabase/migrations/20261017000500_provider1_customizable_catering_demo.sql')

  mustContain(migration, [
    "'Customizable Catering'",
    "'provider1@multivent.com'",
    "'startingAt'",
    "'person'",
    '"pricingOptions"',
    '"customMenuSections"',
    '"Classic Celebration Buffet"',
    '"Signature Plated Feast"',
    '"tastingSettings"',
  ], 'Provider 1 customizable catering demo migration')
})

test('service selection keeps option-aware budget fits while exposing exact schedule conflicts', () => {
  const marketplaceMigration = read('supabase/migrations/20261018000300_marketplace_budget_and_schedule_visibility.sql')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(marketplaceMigration, [
    'booking.requested_date = event.event_date',
    'booking.requested_time = event.event_time',
    "then 'unavailable'",
    'current_availability_status',
  ], 'marketplace schedule migration')
  mustContain(browse, [
    'vendor.budgetRecommendation.categoryBudget > 0',
    '!vendor.budgetRecommendation.isWithinBudget',
    'Not Available on Your Schedule',
    'vendorCardUnavailable',
    'disabled={isScheduleUnavailable(vendor)}',
  ], 'service selection marketplace UI')
  mustContain(details, [
    'scheduleUnavailable',
    'Not available on your event schedule',
    "'Unavailable on Your Schedule'",
  ], 'service detail availability guard')
})

test('provider venue options support independent pricing without replacing legacy venue listings', () => {
  const migration = read('supabase/migrations/20261020000100_provider_venue_option_pricing.sql')
  const details = read('src/components/CategorySpecificServiceDetails.tsx')
  const categoryDetails = read('src/lib/service-category-details.ts')

  mustContain(migration, [
    'create or replace function public.validate_venue_option_pricing()',
    "option_row ->> 'pricingUnit' not in ('event', 'hour')",
    'Active venue option % needs a positive base rate.',
    "array array['requiredOptionIds', 'mutuallyExclusiveOptionIds']",
    'Existing flat-price venue services have none of these keys',
    'Existing service RLS policies still restrict all writes to the owning provider',
  ], 'venue option pricing migration')
  mustContain(details, [
    'title="Venue rental options"',
    'Option photo URLs (optional)',
    'Can be booked on its own',
    'Mutually exclusive with',
    'title="Venue combinations"',
  ], 'provider venue-option editor')
  mustContain(categoryDetails, [
    "pricingUnit?: 'event' | 'hour'",
    'isBookableIndividually: boolean',
    'mutuallyExclusiveOptionIds: string[]',
    'optionPricingConfigured',
    'leaves historic, flat-price listings untouched',
  ], 'venue option compatibility model')
  assert.doesNotMatch(migration, /update\s+public\.bookings/i,
    'Phase 1 must not modify historic bookings')
})

test('V8 Phase 2 prices selected venue options together and preserves their booking snapshot', () => {
  const migration = read('supabase/migrations/20261020000200_client_venue_option_dynamic_pricing.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(migration, [
    'create or replace function public.calculate_event_venue_quote_v8(',
    'create or replace function public.save_my_venue_service_selection_v8(',
    'venue_options_snapshot jsonb not null default',
    'venue_booking_snapshot jsonb not null default',
    "option_row.raw ->> 'pricingUnit' = 'hour'",
    "provider_amount := provider_amount + option_subtotal",
    'customer_amount := round(provider_amount * (1 + commission_rate), 2);',
    'Selected venue options cannot use the same space twice.',
    'A selected venue option overlaps another active booking.',
    'does not use a provider\'s current price to',
  ], 'V8 Phase 2 venue pricing migration')
  mustContain(details, [
    'selectedVenueHours',
    'venueSelections: !usesSelectedProviderPackage && isVenue ? selectedVenueSelections : undefined',
    'RENTAL DURATION',
    'Increase ${option.name} duration',
    'VIEW RENTAL DETAILS',
    'Fixed per-event rate',
    'Selected venue options cannot use the same space twice.',
  ], 'client multi-option venue selector')
  mustContain(planning, [
    "'calculate_event_venue_quote_v8'",
    "'save_my_venue_service_selection_v8'",
    'venue_options_snapshot: selection.venue_options_snapshot',
    'venue_booking_snapshot: selection.venue_booking_snapshot',
  ], 'venue selection and checkout snapshot integration')
  assert.doesNotMatch(migration, /update\s+public\.bookings\s+set\s+.*provider_amount/i,
    'Phase 2 must not recalculate existing booking amounts')
})

test('V8 Phase 3 filters venues by an eligible option-level starting configuration', () => {
  const migration = read('supabase/migrations/20261020000300_venue_marketplace_starting_prices.sql')
  const catalog = read('src/lib/catalog.ts')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(migration, [
    'create or replace function public.calculate_venue_starting_quote_v8(',
    'create or replace function public.list_my_budget_aware_service_recommendations_phase9(',
    'required_options(candidate_id, option_id)',
    "option_row.pricing_unit in ('hour', 'event')",
    "option_row.pricing_unit = 'hour'",
    'ceil(option_row.minimum_hours / option_row.duration_increment)',
    'component.all_components_allow_combination',
    'resource.use_count > 1',
    "Starting price is PHP %s over the category budget.",
    'No bookable venue option configuration fits the event requirements.',
    'snapshots continue to be priced only by the authoritative checkout flow.',
  ], 'V8 Phase 3 venue starting-price migration')
  mustContain(catalog, [
    'export const marketplaceStartingPrice',
    'return `From ${formatPeso(venueStartingPrice)}`',
    "return 'No eligible venue option'",
  ], 'venue card starting price')
  mustContain(browse, [
    'marketplaceStartingPrice(vendor)',
    "vendor.categoryId === 'venues' ? 'Starting estimate' : 'Event estimate'",
    'No available venue configuration fits this category budget.',
  ], 'venue-aware marketplace filtering and presentation')
  mustContain(details, [
    'categoryBudgetOverage',
    'over the available {service.categoryName} budget',
    'Adjust the venue options or rental duration',
  ], 'final venue selection budget warning')
  assert.doesNotMatch(migration, /update\s+public\.(bookings|event_service_selections)\s+set/i,
    'Phase 3 must not rewrite existing booking or selection prices')
})

test('V8 Phase 4 exposes the agreed venue snapshot and keeps booking financial terms authoritative', () => {
  const migration = read('supabase/migrations/20261020000400_venue_booking_integrity.sql')
  const merchant = read('src/lib/merchant.ts')
  const providerDetails = read('src/screens/19.1-BookingRequest.tsx')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const venueSummary = read('src/components/VenueBookingSummary.tsx')

  mustContain(migration, [
    'create or replace function public.enforce_v8_venue_booking_terms()',
    'public.calculate_event_venue_quote_v8(',
    'pg_advisory_xact_lock',
    'Venue booking terms are immutable after the client payment is recorded.',
    'create or replace function public.assert_v8_venue_booking_integrity(target_booking_id uuid)',
    'A selected venue option overlaps another active booking.',
    'create trigger v8_enforce_venue_acceptance_integrity_trigger',
    'Legacy records have no detailed option array.',
  ], 'V8 Phase 4 venue integrity migration')
  mustContain(merchant, [
    'venue_options_snapshot, venue_booking_snapshot',
    'venueBookingConfigurationFrom(',
    'venueBooking,',
  ], 'booking snapshot data mapping')
  mustContain(providerDetails, [
    '<VenueBookingSummary audience="provider"',
    'venueBooking: service.venueBooking',
  ], 'provider venue booking review')
  mustContain(clientDetails, [
    '<VenueBookingSummary audience="client"',
  ], 'client venue booking review')
  mustContain(venueSummary, [
    'PROVIDER BASE TOTAL',
    'CLIENT-FACING TOTAL',
    'Your earnings and payout remain based on the provider base total.',
  ], 'shared venue snapshot presentation')
  assert.doesNotMatch(migration, /update\s+public\.bookings\s+set/i,
    'Phase 4 must not rewrite historical booking values')
})

test('V8 Phase 5 removes only the redundant service-detail dietary input', () => {
  const details = read('src/screens/08-ServiceDetails.tsx')
  const instructions = read('src/screens/10-InstructionModule.tsx')
  const planning = read('src/lib/planning.ts')
  const merchant = read('src/lib/merchant.ts')
  const providerDetails = read('src/screens/19.1-BookingRequest.tsx')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const categoryDetails = read('src/components/CategorySpecificServiceDetails.tsx')
  const app = read('src/App.tsx')

  assert.doesNotMatch(details, /DIETARY REQUIREMENTS &amp; NOTES/,
    'the redundant service-detail dietary field must be removed')
  assert.doesNotMatch(details, /Dietary requirements and notes/,
    'the redundant dietary field must not remain accessible')
  assert.doesNotMatch(details, /const \[notes, setNotes\]/,
    'service details must not retain hidden dietary-note state')
  mustContain(details, [
    'Instruction Module, reached after service selection.',
    "notes: ''",
  ], 'service-detail instruction handoff')
  mustContain(instructions, [
    'DIETARY RESTRICTIONS / ALLERGIES',
    'SPECIAL MENU REQUESTS',
  ], 'existing instruction module')
  mustContain(app, [
    "setScreen('instructionModule')",
    'saveProviderInstructions(value)',
  ], 'instruction module workflow')
  mustContain(planning, [
    'const selectionNotes = value.notes.trim() || savedNotes',
    'note previously saved for this same selection',
  ], 'saved-note preservation')
  mustContain(categoryDetails, [
    'label="Dietary Options"',
  ], 'provider dietary accommodation information')
  mustContain(merchant, [
    'dietary_notes',
    'clientNotes: textFrom(record.client_notes)',
  ], 'historical booking notes')
  mustContain(providerDetails, [
    'Dietary notes: {service.dietaryNotes}',
  ], 'provider historical dietary notes')
  mustContain(clientDetails, [
    'SAVED BOOKING NOTE',
  ], 'client read-only historical note')
})

test('client plans can safely remove drafts while home collapses bookings to the next three events', () => {
  const planning = read('src/lib/planning.ts')
  const home = read('src/screens/03-ClientHome.tsx')
  const plans = read('src/screens/03.3-ClientPlans.tsx')
  const app = read('src/App.tsx')

  mustContain(planning, [
    'export const deleteClientEventDraft',
    "update({ status: 'cancelled'",
    ".in('status', ['draft', 'planning'])",
    "activePlanningEventId = ''",
  ], 'client draft deletion')
  mustContain(home, [
    'bookingProgressEvents.slice(0, 3)',
    'showAllBookingProgress',
    'Show all (${bookingProgressEvents.length})',
  ], 'client home booking controls')
  mustContain(plans, [
    'Delete draft',
    'draftPendingDeletion',
  ], 'client plans draft deletion controls')
  mustContain(app, [
    'deleteClientEventDraft',
    'onDeleteDraft={deleteClientDraft}',
  ], 'client plans draft deletion integration')
})

test('item-priced catering menus use provider prices, validate selections, and snapshot bookings', () => {
  const migration = read('database/71_catering_custom_menu_pricing.sql')
  const providerBuilder = read('src/components/CategorySpecificServiceDetails.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')
  const providerRequest = read('src/screens/19.1-BookingRequest.tsx')

  mustContain(migration, [
    "'customMenuSections'",
    "'pricePerHead'",
    'create or replace function public.calculate_catering_menu_quote(',
    'create or replace function public.save_my_catering_menu_service_selection(',
    'target_menu_item_ids jsonb',
    'A food item can only be selected once.',
    'catering_option_snapshot',
    'list_phase11_package_catering_menus',
  ], 'custom catering migration')
  mustContain(providerBuilder, [
    'CustomCateringMenuBuilder',
    'Price per head',
    'Required inclusion',
    'Available to clients',
    'clients choose their preferred offering',
  ], 'provider item-menu builder')
  mustContain(details, [
    'selectedCateringMenuItemIds',
    "type CateringOffering = 'custom' | 'preset'",
    'Choose Preset Package',
    'Customize Your Menu',
    'expandedCateringMenuSections',
    'calculateCateringCustomMenuPrice',
    'Selected menu total',
    'menuItemIds:',
  ], 'client item-menu selection')
  mustContain(planning, [
    "'calculate_catering_menu_quote'",
    "client.rpc('save_my_catering_menu_service_selection'",
    'cateringMenuItemIds',
  ], 'authoritative item-menu planning integration')
  mustContain(providerRequest, [
    'SELECTED FOOD ITEMS',
    'cateringMenuItems',
  ], 'provider selected-food details')
})

test('food tastings stay optional, booking-bound, availability-checked, and historically preserved', () => {
  const migration = read('database/72_catering_food_tasting_scheduling.sql')
  const providerBuilder = read('src/components/CategorySpecificServiceDetails.tsx')
  const clientBooking = read('src/screens/11.1-BookingDetails.tsx')
  const providerBooking = read('src/screens/19.1-BookingRequest.tsx')
  const merchant = read('src/lib/merchant.ts')

  mustContain(migration, [
    'create table if not exists public.catering_food_tastings',
    "status in ('requested', 'confirmed', 'reschedule_proposed', 'rejected', 'cancelled', 'completed')",
    'catering_food_tastings_one_active_booking_idx',
    'create or replace function public.list_my_catering_food_tasting_slots(',
    'create or replace function public.request_my_catering_food_tasting(',
    'create or replace function public.respond_to_catering_food_tasting(',
    'create or replace function public.respond_to_my_catering_food_tasting_proposal(',
    'cancel_catering_food_tastings_after_booking_change',
    'provider_availability',
    'provider_operating_hours',
    'Food tastings cannot be scheduled after the event date.',
    'Booking participants can view catering food tastings',
  ], 'food tasting migration')
  mustContain(read('database/73_catering_food_tasting_timezone_guard.sql'), [
    'normalize_catering_food_tasting_timezone',
    "'Asia/Manila'",
  ], 'food tasting timezone guard')
  mustContain(providerBuilder, [
    'CateringTastingSettingsBuilder',
    'Offer optional food tastings',
    'Available tasting start times',
  ], 'provider food-tasting configuration')
  mustContain(clientBooking, [
    'Schedule Food Tasting',
    'onLoadFoodTastingSlots',
    'onRequestFoodTasting',
    'onMessageProviderForBooking',
    'reschedule_proposed',
  ], 'client food-tasting booking details')
  mustContain(providerBooking, [
    'Confirm tasting',
    'Propose another',
    'onFoodTastingResponse',
  ], 'provider food-tasting response flow')
  mustContain(merchant, [
    "client.rpc('list_my_catering_food_tasting_slots'",
    "client.rpc('request_my_catering_food_tasting'",
    "client.rpc('respond_to_catering_food_tasting'",
    "client.rpc('respond_to_my_catering_food_tasting_proposal'",
  ], 'food tasting RPC integration')
})

test('category budget edits, locks, removal, replacement, and checkout validation share one contract', () => {
  const budgets = read(migrations[5])
  const selection = read(migrations[7])
  const allocationCorrection = read(migrations[14])
  const planning = read('src/lib/planning.ts')
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(budgets, [
    'create or replace function public.save_my_event_budget_allocations(',
    'Category allocations cannot exceed the total event budget.',
    'coordinator_required',
  ], 'budget allocation migration')
  mustContain(selection, [
    'create or replace function public.protect_phase9_locked_budget_item()',
    'create or replace function public.enforce_phase9_one_service_per_category()',
    'create or replace function public.save_my_event_service_selection(',
    'create or replace function public.unlock_phase9_category_budget()',
    'create or replace function public.set_my_category_budget_allocation(',
    'create or replace function public.save_my_event_budget_allocations_phase9(',
    'create or replace function public.validate_my_phase9_selections(',
    'is_selection_locked = true',
    'locked_selection_id = selection.id',
  ], 'Phase 9 selection migration')
  mustContain(allocationCorrection, [
    'create or replace function public.validate_phase7_budget_item_total()',
    'item.id is distinct from new.id',
    'item.category_key is distinct from new.category_key',
  ], 'category allocation upsert correction')
  mustContain(planning, [
    "client.rpc('save_my_event_budget_allocations_phase9'",
    "client.rpc('set_my_category_budget_allocation'",
    "'validate_my_phase9_selections'",
    "client.rpc('save_my_event_service_selection'",
    ".from('event_service_selections')",
    ".delete()",
  ], 'client planning integration')
  mustContain(app, [
    'availableCategoryBudget={categoryBudgetMaximum}',
    "result.message?.includes('Category allocations cannot exceed')",
  ], 'category budget and service-selection coordination')
  mustContain(browse, [
    'isSavingCategoryBudgetRef.current',
    'categoryBudgetMaximum >= CATEGORY_BUDGET_STEP',
  ], 'serialized category budget slider')
  mustContain(details, [
    'exceedsAvailableCategoryBudget',
    'Over Available Category Budget',
  ], 'service budget guard')
})

test('budget allocation cards keep controls inside selected, expanded categories', () => {
  const budgetScreen = read('src/screens/05-BudgetAllocation.tsx')

  mustContain(budgetScreen, [
    'const [expandedCategories, setExpandedCategories]',
    'const handleCategoryPress',
    'handleAllocationChange(categoryKey, startingAmount)',
    'setExpandedCategories((current) => new Set(current).add(categoryKey))',
    'if (next.has(categoryKey)) next.delete(categoryKey)',
    'selected && expanded ? (',
    'REMOVE CATEGORY',
    'lockedCategories.has(categoryKey)',
    'reserveCoordinatorAllocation',
    'Allocated category budgets are above the event budget.',
  ], 'expandable budget allocation UI')
})

test('budget inputs have a contained focus treatment and live available amount', () => {
  const budgetScreen = read('src/screens/05-BudgetAllocation.tsx')

  mustContain(budgetScreen, [
    "alignSelf: 'stretch'",
    "width: '100%'",
    'minWidth: 0',
    'borderWidth: 2',
    'budgetInputCardFocused: { borderColor: palette.primaryContainer }',
    'flexShrink: 1',
    'outlineWidth: 0',
    'amountInputShellFocused: { borderWidth: 2, borderColor: palette.primaryContainer }',
    'availableAmount: number',
    'Available: {formatMoney(availableAmount)}',
    'availableAmount={remainingBudget}',
  ], 'contained focus treatment and live allocation availability')
})

test('Step 1 coordinator preference replaces the redundant coordinator choice screen', () => {
  const app = read('src/App.tsx')
  const creation = read('src/screens/04-EventCreation.tsx')
  const planning = read('src/lib/planning.ts')
  const budgetScreen = read('src/screens/05-BudgetAllocation.tsx')
  const details = read('src/screens/06.1-CoordinatorDetails.tsx')
  const migration = read('database/68_conditional_event_coordinator_step.sql')
  const phase4Migration = read('supabase/migrations/20261020001200_step1_coordinator_and_church_preferences.sql')

  mustContain(app, [
    "allocation.categoryKey === 'eventOrganizer' && allocation.amount > 0",
    'const planningServiceCategories',
    'const coordinatorPlanningEnabled = eventDetails.wantsCoordinator === true || Boolean(assignedCoordinator)',
    'if (hasCoordinatorAllocation && eventDetails.wantsCoordinator === true && !assignedCoordinator)',
    "openPlanningHub('forward', 'eventOrganizers')",
    'coordinatorBookingEnabled={hasEventOrganizerBudget}',
    'confirmDestructiveAction',
    'Remove coordinator booking?',
  ], 'Step 1 coordinator flow')
  assert.doesNotMatch(app, /coordinatorChoice/, 'the retired coordinator choice route must not be reachable')
  mustContain(creation, [
    'WOULD YOU LIKE AN EVENT COORDINATOR?',
    'typeof wantsCoordinator === \'boolean\'',
    'Selecting Yes does not book or assign anyone.',
  ], 'required Step 1 coordinator preference')
  mustContain(planning, [
    'wantsCoordinator?: boolean',
    "target_preference: value.wantsCoordinator ? 'undecided' : 'skipped'",
  ], 'coordinator preference persistence')
  mustContain(budgetScreen, [
    'includeCoordinator = true',
    "category.id !== 'eventOrganizer'",
    'onRemoveCommittedCoordinator',
    'REMOVE COORDINATOR FIRST',
  ], 'coordinator budget removal safeguard')
  mustContain(details, [
    'coordinatorBookingEnabled = false',
    '&& coordinatorBookingEnabled',
  ], 'conditional coordinator details actions')
  mustContain(migration, [
    'require_event_organizer_budget_for_coordinator_assignment',
    "item.category_key = 'eventOrganizer'",
    "coalesce(item.allocated_amount, 0) > 0",
    'before update of coordinator_id, pending_coordinator_id on public.events',
  ], 'conditional coordinator database guard')
  mustContain(phase4Migration, [
    'add column if not exists wants_coordinator boolean',
    'alter column is_church_wedding drop not null',
    'alter column is_church_wedding drop default',
  ], 'Step 1 preference migration')
})

test('planning categories, progression, and budget re-entry share one allocation-driven contract', () => {
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const categories = read('src/lib/planning-categories.ts')

  mustContain(categories, [
    'PLANNING_CATEGORY_PRIORITY',
    "{ categoryId: 'venues', categoryKey: 'venue' }",
    "{ categoryId: 'eventOrganizers', categoryKey: 'eventOrganizer' }",
    'getNextUnselectedServicePlanningCategory',
  ], 'shared planning category priority')
  mustContain(app, [
    'getActivePlanningCategories(planningBudgetAllocations)',
    "budgetAllocations.filter((allocation) => allocation.categoryKey !== 'eventOrganizer')",
    'getNextUnselectedServicePlanningCategory(',
    'unallocatedPlanBudget',
    'unallocatedCategoryCount={unallocatedPlanningCategoryCount}',
    "openPlanningHub(undefined, nextPlanningCategory ?? categoryNameToId(nextSelection.category))",
  ], 'allocation-driven planning flow')
  mustContain(browse, [
    'You still have unallocated budget',
    '+ Add More Category',
    'All of your budget is currently allocated',
    'Allocated categories complete',
  ], 'planning budget guidance')
})

test('V9 Phase 5 category tags count eligible services and mark active selections', () => {
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')

  mustContain(app, [
    'const planningCategoryBudgets',
    'const planningCatalogServices',
    'categoryCountServices=',
    'categoryBudgets={planningCategoryBudgets}',
    'setCatalogServices(await loadClientCatalogServices())',
  ], 'live marketplace category inputs')
  mustContain(browse, [
    'categoryCountServices?: CatalogService[]',
    'const servicesForCategoryCounts = categoryCountServices ?? services',
    'const matchesMarketplaceFilters',
    'const marketplaceCategoryCounts',
    'const activeSelectedCategoryIds',
    'const orderCategoryTags',
    'keepAllFirst = false',
    "marketplaceCategoryId(option) === 'all'",
    '...(allOption ? [allOption] : [])',
    'const orderedExploreCategoryTags = orderCategoryTags(',
    'exploreCategories,',
    'activeExploreCategoryId,',
    'orderedPlanningCategoryTags.map',
    'orderedExploreCategoryTags.map',
    'name="check"',
    'eligible services.',
    'exploreCategoryScroller: { marginBottom: 12 }',
    'minHeight: 40',
  ], 'counted, completed, horizontally-scrollable marketplace tags')
})

test('V10 Phase 1 keeps the marketplace usable without allocations and normalizes category tag IDs', () => {
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const categories = read('src/lib/planning-categories.ts')

  mustContain(categories, [
    'hasConfiguredCategoryBudgets',
    'means the client chose the no-budget marketplace',
  ], 'explicit no-budget detection')
  mustContain(app, [
    'const hasConfiguredPlanningBudget',
    'const planningCategoryIds',
    'PLANNING_CATEGORY_PRIORITY',
    'const planningMarketplaceCategoryIds',
    'hasBudget={hasConfiguredPlanningBudget}',
  ], 'budget-free marketplace inputs')
  mustContain(browse, [
    'const marketplaceCategoryId',
    'categoryNameToId(option.name)',
    'const categoryId = marketplaceCategoryId(option)',
    'marketplaceCategoryCounts.get(categoryId)',
  ], 'canonical category count and completion IDs')
})

test('V10 Phase 3 keeps Explore outside the event-planning navigator', () => {
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(app, [
    "const isPlanningNavigationContext = serviceBrowseMode === 'planning'",
    'isPlanningNavigationContext ? (',
    '<PlanningStepNavigationProvider',
    "setServiceBrowseMode('explore')",
  ], 'Explore navigation isolation')
  assert.doesNotMatch(app, /PlanningSwipeContainer/, 'event routing must not attach a horizontal swipe responder')
  mustContain(browse, [
    "const isExploreMode = mode === 'explore'",
    'EXPLORE SERVICES',
    'onSelectVendor?.(vendor.id)',
  ], 'standalone Explore browsing')
  mustContain(details, [
    "const isExploreMode = mode === 'explore'",
    'disabled={isExploreMode}',
    '{!isExploreMode ? (',
  ], 'read-only service details outside an event')
})

test('V10 Phase 5 uses explicit wizard controls and live local budget feedback', () => {
  const app = read('src/App.tsx')
  const header = read('src/components/PlanningScreenHeader.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')

  assert.doesNotMatch(app, /PlanningSwipeContainer/, 'planning steps must not be changed by swiping')
  mustContain(header, [
    'canGoBack',
    'canGoForward',
    'Go to the previous planning step',
    'Continue to the next planning step',
    'name="chevron-left"',
    'name="chevron-right"',
    'nextPressLockedRef',
  ], 'explicit header navigation controls')
  mustContain(browse, [
    'const CategoryBudgetSlider = React.memo',
    'Keep drag feedback local to the control.',
    'setDraftBudget(normalized)',
    'onPanResponderMove',
    'void commitCategoryBudgetRef.current(amount)',
    'await saveCategoryBudget(amount)',
    'CATEGORY_BUDGET_STEP = 500',
  ], 'live, deferred category budget slider')
})

test('V10 Phase 4 guest-count rules remain intact through the V15 catering selection entry point', () => {
  const migration = read('supabase/migrations/20261021000700_catering_service_guest_count.sql')
  const savedPlanMigration = read('supabase/migrations/20261021000800_catering_saved_plan_guest_count.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(migration, [
    'calculate_catering_service_quote_v10',
    'calculate_catering_menu_quote_v10',
    'save_my_catering_service_selection_v10',
    'target_guest_count integer',
    "'guestCount', target_guest_count",
    'attendee_count = (pricing ->> \'guestCount\')::integer',
    'validate_my_phase9_selections',
  ], 'service-specific catering quote, snapshot, and checkout validation')
  mustContain(savedPlanMigration, [
    'review_my_saved_booking_plan_v9_initial',
    'selection.attendee_count',
    'calculate_catering_menu_quote_v10',
    'calculate_catering_service_quote_v10',
  ], 'saved-plan catering guest-count validation')
  mustContain(details, [
    'NUMBER OF GUESTS',
    'Decrease catering guest count',
    'Increase catering guest count',
    'Catering guest count',
    'Service-specific count. Your event-wide guest count will not be changed.',
    'cateringGuestCountIssue',
    'Set a Valid Guest Count',
  ], 'catering guest quantity controls')
  mustContain(planning, [
    'calculate_catering_menu_quote_v10',
    'calculate_catering_service_quote_v10',
    'save_my_catering_service_selection_v15',
    'target_guest_count: cateringGuestCount',
  ], 'client quote and V15-compatible selection calls')
})

test('service-detail price quotes keep a stable callback after an option is selected', () => {
  const app = read('src/App.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(app, [
    'const calculateServiceDetailsQuote = React.useCallback',
    'onCalculateQuote={calculateServiceDetailsQuote}',
  ], 'stable Service Details quote callback')
  mustContain(details, [
    'setQuoteLoading(true)',
    'clearTimeout(timer)',
  ], 'debounced Service Details quote lifecycle')
})

test('client home uses live eligible services, resumable drafts, and booking progress', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const home = read('src/screens/03-ClientHome.tsx')
  const plans = read('src/screens/03.3-ClientPlans.tsx')
  const recommendations = read('src/lib/home-recommendations.ts')

  mustContain(app, [
    'fetchClientEventDrafts()',
    'createClientEventDraft()',
    'resumeClientEventDraft(draftId)',
    'rankHomeRecommendations(catalogServices)',
    'getClientBookingProgress(clientBookings, new Date(), unreadBookingResourceIds)',
    'client-event-progress-',
  ], 'client home data integration')
  mustContain(planning, [
    "event_service_selections(status)",
    ".in('status', ['draft', 'planning'])",
    "order('updated_at', { ascending: false })",
    'const [latestDraft, ...supersededDrafts] = drafts',
    ".is('saved_plan_at', null)",
    '.neq(\'id\', event.eventId)',
    'activePlanningEventId',
  ], 'draft persistence integration')
  mustContain(home, [
    'recommendations = []',
    'getClientBookingProgress',
    'UPCOMING EVENTS',
    'onOpenBookingProgress',
    'formatServicePrice(recommendation.service)',
    'recommendation.service.reviewCount',
  ], 'client home live UI')
  mustContain(plans, [
    'draftEvents = []',
    'const latestDraft = draftEvents[0]',
    'latestDraft ? 1 : 0',
    'DRAFTS',
    'No drafts yet',
    'onOpenDraft',
  ], 'client plans live UI')
  mustContain(recommendations, [
    "service.kind !== 'coordinator'",
    'service.isMock !== true',
    'bookingCount',
    'reviewReliability',
    'sentimentReliability',
    'Math.log1p(bookingCount)',
    "'New service'",
  ], 'reliable home-service ranking')
})

test('provider completion records direct external payments atomically before service completion', () => {
  const phase5 = read('database/69_provider_external_payment_confirmation.sql')
  const merchant = read('src/lib/merchant.ts')
  const providerDetails = read('src/screens/19.1-BookingRequest.tsx')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const app = read('src/App.tsx')

  mustContain(phase5, [
    'provider_external_payment_confirmations',
    "confirmation_status = 'provider_confirmed_unverified'",
    'unique (booking_id, provider_id, request_key)',
    'for update of booking',
    'provider.user_id = auth.uid()',
    'create or replace function public.confirm_provider_external_payment(',
    'create or replace function public.mark_provider_booking_awaiting_external_payment(',
    'Record the remaining external payment before completing this service.',
    "'gateway_verified', false",
    "'provider_external_confirmation'",
    'external_confirmation_id',
    'remaining_after = 0',
    'external_confirmation_totals',
    'A coordinator remittance already covers this booking.',
  ], 'provider external-payment migration')
  const phase5RequestKeyFix = read('database/74_external_payment_request_key_disambiguation.sql')
  mustContain(phase5RequestKeyFix, [
    'create or replace function public.confirm_provider_external_payment(',
    'confirmation.request_key = trim($3)',
    'trim($3), nullif(trim(provider_note), \'\')',
  ], 'provider external-payment request-key fix')
  mustContain(merchant, [
    "client.rpc('confirm_provider_external_payment'",
    "client.rpc('mark_provider_booking_awaiting_external_payment'",
    'fetchExternalPaymentSummaries',
    'completionPaymentStatus',
  ], 'merchant completion-payment integration')
  mustContain(providerDetails, [
    'Complete This Service?',
    'Confirm payment received',
    'Not Yet',
    'not a verified PayMongo transaction',
    'onCompletionPayment',
  ], 'provider completion-payment UI')
  mustContain(clientDetails, [
    'MARKETPLACE SERVICE PRICE',
    'INITIAL PROVIDER ALLOCATION',
    'REMAINING BALANCE',
    'Awaiting remaining payment',
    'Partially confirmed external payment',
  ], 'client payment status UI')
  mustContain(app, [
    'saveMerchantCompletionPayment',
    'handleBookingCompletionPayment',
    'onCompletionPayment={handleBookingCompletionPayment}',
  ], 'provider completion-payment app flow')
})

test('client booking details consolidate authoritative provider balances without double counting', () => {
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const merchant = read('src/lib/merchant.ts')

  mustContain(clientDetails, [
    'calculateEventPaymentSummary',
    "!['cancelled', 'declined'].includes(service.status)",
    'Event Payment Summary',
    'TOTAL EVENT COST',
    'marketplaceEventTotal',
    'RECORDED SERVICE PAYMENTS',
    'TOTAL REMAINING BALANCE',
    'All Provider Balances Cleared',
    'Marketplace prices shown here already match',
    'External payments are provider-confirmed',
  ], 'client event payment summary')
  mustContain(merchant, [
    'get_my_booking_external_payment_summaries',
    'confirmedExternalPaymentAmount',
    'remainingServiceBalance',
  ], 'authoritative client payment inputs')
})

test('messaging is restricted to active booking relationships while closed history remains readable', () => {
  const migration = read('database/70_booking_restricted_messaging.sql')
  const messaging = read('src/lib/messaging.ts')
  const planning = read('src/lib/planning.ts')
  const app = read('src/App.tsx')
  const chat = read('src/screens/03.2-ChatThread.tsx')

  mustContain(migration, [
    'create or replace function public.is_valid_booking_message_member(',
    "'requested',",
    "'confirmed',",
    "event.coordinator_assignment_status = 'accepted'",
    'create or replace function public.open_booking_conversation(',
    'create or replace function public.send_booking_message(',
    'create or replace function public.mark_booking_conversation_read(',
    "This conversation is read-only because the booking is no longer active.",
    'revoke insert, update, delete on table public.conversations,',
    'public.conversation_participants,',
    'public.messages from public, anon, authenticated;',
    'alter publication supabase_realtime add table public.messages;',
  ], 'booking-authorized messaging migration')
  mustContain(messaging, [
    "client.rpc('open_booking_conversation'",
    "client.rpc('send_booking_message'",
    "client.rpc('mark_booking_conversation_read'",
    'isReadOnly: booking ? !canSendBookingMessages(booking.status) : true',
  ], 'secure messaging client integration')
  assert.doesNotMatch(messaging, /\.from\('messages'\)\s*\.insert/)
  assert.doesNotMatch(messaging, /\.from\('conversation_participants'\)\s*\.upsert/)
  assert.doesNotMatch(
    planning,
    /\.rpc\('open_booking_conversation'/,
    'checkout must defer booking conversations until provider confirmation'
  )
  mustContain(planning, [
    'Messaging intentionally opens only after provider confirmation.',
    'The server-side confirmation trigger creates the conversation later.',
  ], 'booking conversation handoff')
  mustContain(app, [
    'openBookingConversationFor',
    "table: 'messages'",
    'isLoadingMessages={isLoadingConversationMessages}',
    'isReadOnly={selectedConversation?.isReadOnly}',
  ], 'message realtime and loading integration')
  mustContain(chat, [
    'Conversation closed',
    'This booking is no longer active.',
    'isLoadingMessages = false',
  ], 'read-only conversation UI')
})

test('Phase 1 limits client booking-detail messaging to each confirmed provider booking', () => {
  const migration = read('supabase/migrations/20261017000600_phase1_confirmed_booking_messaging.sql')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const app = read('src/App.tsx')
  const messaging = read('src/lib/messaging.ts')

  mustContain(migration, [
    "booking.status::text in ('confirmed', 'completed')",
    "booking_row.status::text not in ('confirmed', 'completed')",
    "new.status::text in ('confirmed', 'completed')",
    "and booking.status::text in ('confirmed', 'completed')",
    "Messaging is available only after the provider confirms the booking.",
  ], 'confirmed booking messaging migration')
  assert.doesNotMatch(migration, /'requested'/)
  mustContain(clientDetails, [
    "service.status === 'confirmed' || service.status === 'completed'",
    'accessibilityLabel={`Message ${service.providerName}`}',
    'onMessageProviderForBooking?.(service.bookingId)',
  ], 'client booking-detail messaging UI')
  assert.doesNotMatch(clientDetails, /onMessageProvider\?:/)
  assert.doesNotMatch(clientDetails, /messageButton/)
  mustContain(app, [
    'after the provider confirms the booking',
    "openBookingConversationFor(bookingId, 'bookingDetails')",
  ], 'direct confirmed booking conversation navigation')
  mustContain(messaging, [
    "['confirmed', 'completed'].includes(textFrom(value).toLowerCase())",
    'isReadOnly: booking ? !canSendBookingMessages(booking.status) : true',
  ], 'client message composer state')
})

test('Phase 6 keeps event messaging direct, event-organized, and coordinator-authorized', () => {
  const migration = read('supabase/migrations/20261017000900_event_based_messaging.sql')
  const messages = read('src/screens/03.1-Messages.tsx')
  const messaging = read('src/lib/messaging.ts')
  const app = read('src/App.tsx')

  mustContain(migration, [
    'create or replace function public.is_valid_event_coordinator_message_member(',
    "event.coordinator_assignment_status = 'accepted'",
    "auth.uid() in (event.client_id, event.coordinator_id)",
    "conversation.conversation_kind = 'event_coordinator'",
  ], 'event-based messaging authorization')
  assert.match(
    migration,
    /values \(resolved_conversation_id, event_row\.client_id\), \(resolved_conversation_id, event_row\.coordinator_id\)/
  )
  mustContain(messages, [
    'const eventGroups = React.useMemo(() => {',
    'available conversation',
    'isVirtualCoordinator',
    "conversations = []",
  ], 'event-organized client inbox')
  mustContain(messaging, [
    'eventId: textFrom(event?.id) || undefined',
    "? 'event_coordinator'",
    "? 'coordinator_provider'",
  ], 'event metadata mapping')
  mustContain(app, [
    'onOpenEventCoordinatorForEvent',
    "openEventCoordinatorConversationFor(eventId, 'messages')",
  ], 'coordinator inbox navigation')
})

test('V7 Phase 2 gives coordinators direct event-grouped messaging without creating group chats', () => {
  const migration = read('supabase/migrations/20261019000100_coordinator_direct_messaging.sql')
  const backfill = read('supabase/migrations/20261019000200_backfill_coordinator_provider_conversations.sql')
  const messages = read('src/screens/03.1-Messages.tsx')
  const coordinator = read('src/screens/23-Coordinator.tsx')
  const messaging = read('src/lib/messaging.ts')
  const app = read('src/App.tsx')

  mustContain(migration, [
    'create or replace function public.is_valid_client_provider_message_member(',
    'create or replace function public.is_valid_coordinator_provider_message_member(',
    "conversation.conversation_kind = 'coordinator_provider'",
    "auth.uid() in (event.coordinator_id, provider.user_id)",
    'create or replace function public.open_coordinator_provider_conversation(',
    'perform public.ensure_coordinator_provider_conversation(new.id);',
  ], 'direct coordinator messaging authorization')
  assert.match(
    migration,
    /values\s*\(resolved_conversation_id, booking_row\.coordinator_user_id\),\s*\(resolved_conversation_id, booking_row\.provider_user_id\)/
  )
  assert.doesNotMatch(
    migration,
    /values\s*\(resolved_conversation_id, booking_row\.client_id\),\s*\(resolved_conversation_id, booking_row\.provider_user_id\),\s*\(resolved_conversation_id, booking_row\.coordinator_user_id\)/
  )
  mustContain(backfill, [
    "booking.status::text in ('confirmed', 'completed')",
    "event.coordinator_assignment_status = 'accepted'",
    'perform public.ensure_coordinator_provider_conversation(booking_row.id);',
  ], 'existing eligible coordinator-provider conversation backfill')
  mustContain(messaging, [
    "client.rpc('open_coordinator_provider_conversation'",
    "conversationKind === 'coordinator_provider'",
  ], 'coordinator-provider RPC integration')
  mustContain(messages, [
    "navigationVariant?: 'client' | 'coordinator' | 'merchant'",
    'for (const event of coordinatorEvents)',
    "participantRole: 'Client'",
    "usesEventGroups && !selectedEvent",
  ], 'event-grouped coordinator inbox')
  mustContain(coordinator, [
    'onOpenMessages?: () => void',
    'onMessageClient?: (event: CoordinatorEvent) => void',
    '<Text style={styles.confirmChurchButtonText}>Message Client</Text>',
    '<Text style={styles.providerActionText}>Message provider</Text>',
    "service.booked && service.bookingId && !['rejected', 'cancelled', 'expired'].includes(service.status)",
  ], 'coordinator messaging entry points')
  mustContain(coordinator, [
    "accessibilityLabel={detailsExpanded ? 'Hide church proposal and details' : 'Show church proposal and details'}",
    "accessibilityState={{ expanded: detailsExpanded }}",
    "name={detailsExpanded ? 'expand-less' : 'expand-more'}",
  ], 'collapsible coordinator church arrangement')
  mustContain(app, [
    "setMessageWorkspace('coordinator')",
    'openCoordinatorProviderConversation(service.bookingId)',
    'coordinatorEvents={messageWorkspace === \'coordinator\' ? coordinatorDashboard.events : []}',
  ], 'coordinator messaging navigation')
})

test('provider inbox groups direct booking conversations by event', () => {
  const messages = read('src/screens/03.1-Messages.tsx')

  mustContain(messages, [
    'Every role works from event-scoped conversations.',
    'const usesEventGroups = true',
    "navigationVariant === 'merchant' ? (",
    'usesEventGroups && !selectedEvent',
  ], 'event-grouped provider inbox')
  assert.doesNotMatch(messages, /navigationVariant !== 'merchant'/)
})

test('coordinator-provider messages remain writable for active client-selected bookings', () => {
  const migration = read('supabase/migrations/20261019000600_coordinator_provider_active_booking_messaging.sql')
  const messaging = read('src/lib/messaging.ts')
  const coordinator = read('src/screens/23-Coordinator.tsx')

  mustContain(migration, [
    "'requested',",
    "'payment_required',",
    "'confirmed',",
    'create or replace function public.ensure_coordinator_provider_conversation',
    'create or replace function public.open_coordinator_provider_conversation',
    'create or replace function public.notify_booking_message_recipients',
    'while accepted coordinators and selected providers may message throughout their active booking',
  ], 'active coordinator-provider messaging migration')
  mustContain(messaging, [
    'const canSendCoordinatorProviderMessages = (',
    "['requested', 'approved', 'payment_required', 'paid', 'confirmed', 'completed']",
    "client.rpc('get_my_coordinator_booking_statuses')",
    'coordinatorBookingStatusesById',
    '? !canSendCoordinatorProviderMessages(bookingStatus)',
  ], 'active coordinator-provider composer state')
  mustContain(coordinator, [
    "service.booked && service.bookingId && !['rejected', 'cancelled', 'expired'].includes(service.status)",
  ], 'active selected-provider message entry point')
})

test('checkout accepts provider-configured custom catering and notifies coordinators after payment', () => {
  const migration = read('supabase/migrations/20261018000100_checkout_catering_and_coordinator_timing.sql')
  const coordinatorTiming = read('supabase/migrations/20261018000200_coordinator_request_after_payment.sql')
  const planning = read('src/lib/planning.ts')

  mustContain(migration, [
    "selection_row.catering_option_id = 'custom-menu'",
    'public.calculate_catering_menu_quote(',
    'Coordinator selected; request will be delivered after the client downpayment.',
    'create trigger notify_paid_coordinator_booking_request_trigger',
    "new.payment_scope is distinct from 'coordinator_service'",
  ], 'checkout catering and coordinator timing migration')
  mustContain(planning, [
    'Their booking request will be sent after your required downpayment is recorded.',
    "client.rpc('save_my_catering_menu_service_selection'",
  ], 'client checkout integration')
  mustContain(coordinatorTiming, [
    "'awaiting_payment'",
    "event.coordinator_assignment_status in ('awaiting_payment', 'pending')",
    "event.coordinator_assignment_status = 'awaiting_payment'",
    "coordinator_assignment_status = 'pending'",
  ], 'post-payment coordinator request boundary')
})

test('Phase 2 saves church wedding preference without creating a church booking workflow', () => {
  const migration = read('supabase/migrations/20261017000700_church_wedding_event_preference.sql')
  const phase4Migration = read('supabase/migrations/20261020001200_step1_coordinator_and_church_preferences.sql')
  const creation = read('src/screens/04-EventCreation.tsx')
  const planning = read('src/lib/planning.ts')
  const bookingDetails = read('src/screens/11.1-BookingDetails.tsx')
  const coordinator = read('src/lib/coordinator.ts')

  mustContain(migration, [
    'add column if not exists is_church_wedding boolean not null default false',
    'get_my_church_wedding_event_flags',
    'Church wedding arrangement required',
    'this does not confirm a church reservation',
    "new.coordinator_assignment_status = 'accepted'",
  ], 'church wedding preference migration')
  assert.doesNotMatch(migration, /Church Venue/i)
  mustContain(creation, [
    "eventType === 'wedding'",
    'IS THIS A CHURCH WEDDING?',
    'Yes — Church Wedding',
    'No — Non-Church / Outdoor Wedding',
    'isChurchWedding,',
  ], 'church wedding creation UI')
  mustContain(planning, [
    'is_church_wedding',
    "payload.is_church_wedding = details.eventType === 'wedding'",
    "typeof details.isChurchWedding === 'boolean'",
    'event.is_church_wedding === false',
  ], 'church wedding draft persistence')
  mustContain(phase4Migration, [
    'alter column is_church_wedding drop not null',
    'Null means a draft has not answered the Step 1 question yet.',
  ], 'explicit unanswered church preference support')
  mustContain(bookingDetails, [
    'booking?.isChurchWedding',
    'WEDDING FORMAT',
    'Church wedding',
  ], 'church wedding client booking details')
  mustContain(coordinator, [
    "get_my_church_wedding_event_flags",
    'isChurchWedding: churchWeddingEventIds.has(event.id)',
  ], 'church wedding coordinator context')
})

test('V7 Phase 1 preserves church proposal history and separates client response from coordinator confirmation', () => {
  const migration = read('supabase/migrations/20261018000500_church_proposal_confirmation_workflow.sql')
  const coordinator = read('src/lib/coordinator.ts')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')
  const merchant = read('src/lib/merchant.ts')
  const bookingDetails = read('src/screens/11.1-BookingDetails.tsx')

  mustContain(migration, [
    'create table if not exists public.event_church_arrangement_proposals',
    'unique (event_id, proposal_version)',
    "arrangement_status = 'awaiting_client_confirmation'",
    'create or replace function public.respond_my_church_wedding_proposal(',
    'create or replace function public.confirm_my_church_wedding_arrangement(',
    "event.client_id = auth.uid()",
    "event_row.coordinator_assignment_status <> 'accepted'",
    "arrangement_row.client_response_status <> 'pending'",
    "arrangement_row.arrangement_status = 'declined'",
    "perform pg_advisory_xact_lock(hashtext('multivent-church-arrangement:'",
    'This does not independently verify the church reservation.',
  ], 'secure church proposal workflow')
  assert.doesNotMatch(migration, /drop\s+table/i)
  mustContain(coordinator, [
    "supabase.rpc('confirm_my_church_wedding_arrangement'",
    'clientResponseReason:',
    'coordinatorConfirmedAt:',
  ], 'coordinator church workflow integration')
  mustContain(coordinatorScreen, [
    'Submit Revised Church Proposal',
    'Mark Church as Confirmed',
    'Discussed with Client Externally',
    'The client declined this proposal. Submit a revised proposal before confirming an arrangement.',
  ], 'coordinator church proposal UI')
  mustContain(merchant, [
    "client.rpc('respond_my_church_wedding_proposal'",
    'Enter a reason for declining this church proposal.',
  ], 'client church response integration')
  mustContain(bookingDetails, [
    'Decline Church Proposal',
    'Please tell your coordinator why you are declining this church.',
    'Submit Decline',
    'Approve Proposal',
    'clientResponseReason',
  ], 'client church proposal UI')
})

test('V7 Phase 3 saves optional church pins and uses schedule-safe mobile pickers', () => {
  const migration = read('supabase/migrations/20261019000300_church_location_and_schedule_pickers.sql')
  const churchDateInheritance = read('supabase/migrations/20261019000500_church_ceremony_date_inherits_event.sql')
  const controls = read('src/components/ChurchArrangementControls.tsx')
  const coordinator = read('src/lib/coordinator.ts')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')
  const merchant = read('src/lib/merchant.ts')
  const booking = read('src/screens/11-BookingScreen.tsx')
  const bookingDetails = read('src/screens/11.1-BookingDetails.tsx')

  mustContain(migration, [
    'add column if not exists church_latitude double precision',
    'add column if not exists church_longitude double precision',
    'create or replace function public.get_my_church_wedding_arrangements_v7()',
    'create or replace function public.save_my_church_wedding_arrangement_v7(',
    'Church latitude and longitude must be saved together.',
    'The ceremony date must match the configured event date.',
    'arrangement_before.church_latitude is distinct from target_church_latitude',
    "'Revised church proposal awaiting confirmation'",
    'event_row.coordinator_assignment_status <> \'accepted\'',
    'grant execute on function public.save_my_church_wedding_arrangement_v7(',
  ], 'church location and schedule migration')
  assert.doesNotMatch(migration, /drop\s+table/i)
  mustContain(churchDateInheritance, [
    'rename to save_my_church_wedding_arrangement_v7_schedule_core',
    'client_event_date',
    'client_event_date,',
    'coordinators may set only the ceremony time',
  ], 'church ceremony date inheritance')
  assert.doesNotMatch(churchDateInheritance, /drop\s+table/i)
  mustContain(controls, [
    'export const ChurchLocationMap',
    'const center = interactive',
    'Tap to place the church pin',
    'openstreetmap.org',
    'export const ChurchDatePickerModal',
    'This date matches the configured event schedule.',
    'export const ChurchTimePickerModal',
    "name={direction === 'left' ? 'chevron-left' : 'chevron-right'}",
    'const ChurchWheelColumn',
    'Ceremony hour wheel',
    'Ceremony minute wheel',
    'Ceremony AM or PM wheel',
    'snapToInterval={wheelRowHeight}',
    'Saved as local ceremony time without timezone conversion.',
  ], 'church map, date, and time controls')
  mustContain(coordinator, [
    "supabase.rpc('get_my_church_wedding_arrangements_v7'",
    "supabase.rpc('save_my_church_wedding_arrangement_v7'",
    "if (value == null || value === '') return undefined",
    'target_church_latitude: input.churchLatitude ?? null',
    'target_church_longitude: input.churchLongitude ?? null',
  ], 'coordinator church coordinate persistence')
  mustContain(coordinatorScreen, [
    'Pin church location',
    'Edit map pin',
    '<ChurchTimePickerModal',
    'Use Address Only',
    '{showLocationPicker ? (',
    "const eventDate = event.date?.slice(0, 10) ?? ''",
    "Set by the client's event schedule",
    'ceremonyDate: eventDate || undefined',
  ], 'coordinator church picker UI')
  assert.doesNotMatch(
    coordinatorScreen,
    /ChurchDatePickerModal|setShowDatePicker/,
    'coordinators must not be able to change the client event date'
  )
  mustContain(merchant, [
    "client.rpc('get_my_church_wedding_arrangements_v7'",
    "if (value == null || value === '') return undefined",
    'churchLatitude: optionalNumber(arrangement.church_latitude)',
    'churchLongitude: optionalNumber(arrangement.church_longitude)',
  ], 'client church coordinate mapping')
  mustContain(booking, ['churchLatitude?: number', 'churchLongitude?: number'], 'booking church coordinate contract')
  mustContain(bookingDetails, [
    'CHURCH MAP PIN',
    '<ChurchLocationMap coordinates={{',
    'No map pin was saved. Use the written church address above.',
    'formatChurchDate(',
    'formatChurchTime(',
  ], 'client read-only church preview')
})

test('package selection checks duplicate categories, manual conflicts, dynamic options, and total budget', () => {
  const packages = read(migrations[1])
  const catering = read(migrations[2])
  const selection = read(migrations[7])

  mustContain(packages, [
    'event_coordinator_package_services',
    'created_by_package',
    'service_subtotal',
  ], 'base package contract')
  mustContain(catering, [
    'choose_coordinator_package_with_options',
    'Choose a catering option for every catering service in this package.',
  ], 'dynamic package catering contract')
  mustContain(selection, [
    'create or replace function public.choose_coordinator_package_phase9(',
    'This package contains more than one service in:',
    'requiresConfirmation',
    'A package cannot replace a category that already has an active provider request.',
    'Choose a venue option and booking duration for every venue in this package.',
    'exceeds the remaining event budget.',
  ], 'Phase 9 package integration')
})

test('venue choices, hours, capacity, schedule, and immutable snapshots reach bookings', () => {
  const selection = read(migrations[7])
  const planning = read('src/lib/planning.ts')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(selection, [
    'venue_option_id text',
    'venue_booked_hours numeric(8,2)',
    "category_key = 'venue'",
    'minimumBookingHours',
    'maximumBookingHours',
    'bookingDurationIncrementHours',
    'does not have enough capacity',
    'exceeds venue operating hours',
    'overlaps another active booking',
    'venue_option_snapshot',
  ], 'venue database contract')
  mustContain(planning, [
    'venue_option_id: selection.venue_option_id',
    'venue_option_snapshot: selection.venue_option_snapshot',
    'venue_booked_hours: selection.venue_booked_hours',
    'venue_setup_start_at: selection.venue_setup_start_at',
    'venue_end_at: selection.venue_end_at',
  ], 'venue booking snapshot copy')
  mustContain(details, [
    'selectedVenueOption',
    'venueBookedHours',
    'minimumBookingHours',
  ], 'client venue UI')
})

test('V9 Phase 6 removes only the redundant venue schedule field', () => {
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(details, [
    'eventDate',
    'eventTime',
    'Set the event date and start time before choosing a venue.',
    'selectedVenueHours',
    'RENTAL DURATION',
    'Fixed per-event rate',
    'venueSelections: !usesSelectedProviderPackage && isVenue ? selectedVenueSelections : undefined',
  ], 'venue date, time, duration, and selection controls')
  assert.doesNotMatch(details, /EVENT SCHEDULE/)
  assert.doesNotMatch(details, /Venue duration is set on each selected hourly option/)
  mustContain(planning, [
    "client.rpc('save_my_venue_service_selection_v8'",
    'target_option_selections: value.venueSelections',
  ], 'authoritative venue booking persistence')
})

test('V9 Phase 7 keeps historical packages while presenting coordinator-led profiles', () => {
  const migration = read('supabase/migrations/20261021000100_coordinator_profile_focus.sql')
  const catalog = read('src/lib/catalog.ts')
  const coordinator = read('src/lib/coordinator.ts')
  const profile = read('src/screens/23.2-CoordinatorServiceProfile.tsx')
  const details = read('src/screens/06.1-CoordinatorDetails.tsx')
  const workspace = read('src/screens/23-Coordinator.tsx')

  mustContain(migration, [
    'add column if not exists years_experience integer',
    'event_types_handled text[]',
    'skills text[]',
    'capabilities text[]',
    'certifications text[]',
    'portfolio_summary text',
    'service_inclusions text[]',
    'availability_notes text',
    'save_my_coordinator_service_profile_v9',
    'list_bookable_event_coordinators_v9',
    'without modifying package or booking history',
  ], 'V9 coordinator profile migration')
  mustContain(catalog, [
    "supabase.rpc('list_bookable_event_coordinators_v9')",
    'coordinatorYearsExperience',
    'coordinatorServiceInclusions',
  ], 'V9 coordinator catalog')
  mustContain(coordinator, [
    "supabase.rpc('save_my_coordinator_service_profile_v9'",
    'eventTypesHandled',
    'serviceInclusions',
  ], 'V9 coordinator profile integration')
  mustContain(profile, [
    'Professional introduction',
    'Years of experience',
    'Event types handled',
    'Coordination specialties',
    'Certifications (optional)',
    'Previous event experience or portfolio',
    'Service inclusions',
    'Availability notes',
  ], 'V9 coordinator profile editor')
  mustContain(details, [
    'About the Coordinator',
    'Experience',
    'Skills and Specialties',
    'Events Handled',
    'Services and Inclusions',
    'Pricing and Availability',
    "'Select Coordinator'",
  ], 'V9 client coordinator details')
  assert.doesNotMatch(details, /Coordinator packages|Choose coordinator package|Book coordinator only/)
  assert.doesNotMatch(workspace, /Manage coordinator packages|onOpenPackages/)
})

test('V9 Phase 8 completes allocated selections once and safely changes an unsubmitted service', () => {
  const app = read('src/App.tsx')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(app, [
    'const requiresCoordinatorSelection = eventDetails.wantsCoordinator === true && hasEventOrganizerBudget',
    '(!requiresCoordinatorSelection || Boolean(assignedCoordinator))',
    'selectionCompletionAcknowledged',
    'setSelectionCompletionAcknowledged(false)',
    'setChangingServiceSelection(service)',
    "'Change Selected Service?'",
    'Current Service:',
    'New Service:',
    'Price Difference:',
    'value.estimatedTotal',
    'Confirm Change',
  ], 'V9 selection completion and replacement orchestration')
  mustContain(browse, [
    'showSelectionCompletionModal',
    "You're All Set!",
    'Review Selected Services',
    'revealSelectedServicesAfterCompletion',
    'Change Service',
    'changeServiceContext',
  ], 'V9 marketplace completion and change-service UI')
  mustContain(details, [
    'authoritativeQuoteUnavailable',
    'estimatedTotal,',
    'onAddSelection',
  ], 'authoritative configured service quote before replacement confirmation')
  mustContain(planning, [
    "current.status !== 'selected'",
    'Only an unsubmitted service selection can be changed.',
  ], 'unsubmitted selection guard')
})

test('V9 Phase 9 saves complete unpaid plans and rechecks them before checkout', () => {
  const migration = read('supabase/migrations/20261021000200_saved_booking_plans.sql')
  const coordinatorSafety = read('supabase/migrations/20261021000300_saved_booking_plan_coordinator_safety.sql')
  const reviewResolution = read('supabase/migrations/20261021000400_saved_booking_plan_review_resolution.sql')
  const planning = read('src/lib/planning.ts')
  const payment = read('src/screens/12-Payment.tsx')
  const plans = read('src/screens/03.3-ClientPlans.tsx')
  const app = read('src/App.tsx')

  mustContain(migration, [
    'saved_plan_at timestamptz',
    'saved_plan_estimated_total numeric(12, 2)',
    'saved_plan_selection_count integer',
    'create or replace function public.review_my_saved_booking_plan',
    'create or replace function public.save_my_booking_plan_for_later',
    'calculate_catering_menu_quote',
    'calculate_event_venue_quote_v8',
    "selection.status = 'selected'",
    'saved_plan_at = now()',
    'grant execute on function public.review_my_saved_booking_plan(uuid) to authenticated',
  ], 'V9 saved-plan persistence and review migration')
  assert.doesNotMatch(
    migration,
    /insert\s+into\s+public\.(payments|bookings|notifications)/i,
    'saving a plan must not create payment, booking, or provider-notification records'
  )
  mustContain(coordinatorSafety, [
    'has_coordinator := coalesce(event_row.pending_coordinator_id, event_row.coordinator_id) is not null',
    "coalesce(event_row.wants_coordinator, false)",
    'saved_plan_selection_count',
  ], 'V9 saved-plan legacy coordinator safety')
  mustContain(reviewResolution, [
    'rename to review_my_saved_booking_plan_v9_initial',
    'has_unresolved_price_change',
    "'{hasPriceChanges}'",
    "item.value ->> 'currentAmount'",
    "item.value ->> 'savedAmount'",
  ], 'V9 saved-plan resolved-price safety')
  mustContain(planning, [
    'fetchClientSavedPlans',
    ".is('saved_plan_at', null)",
    "client.rpc('save_my_booking_plan_for_later'",
    "client.rpc('review_my_saved_booking_plan'",
    'savedPlanReviewFrom',
  ], 'V9 client saved-plan data flow')
  mustContain(payment, [
    'Save Plan for Later',
    'Save Your Event Plan?',
    'Review Changes Before Payment',
    'needsSavedPlanReview',
    'Price Updated',
  ], 'V9 payment saved-plan actions')
  mustContain(plans, [
    'SAVED PLANS',
    'Last saved',
    'Resume booking',
    'savedPlans',
  ], 'V9 saved-plan client screen')
  mustContain(app, [
    'savePlanForLater',
    'resumeSavedPlan',
    'reviewSavedPlanChanges',
    'savedPlanReview={savedPlanReview}',
  ], 'V9 saved-plan application orchestration')
})

test('venue marketplace visibility uses a capacity-compatible starting total without replacing the final quote', () => {
  const venueMarketplace = read('supabase/migrations/20261019000400_venue_marketplace_budget_visibility.sql')
  const browse = read('src/screens/06-CategoryBrowse.tsx')

  mustContain(venueMarketplace, [
    'venue_marketplace_fits as',
    "base.category_key = 'venue'",
    'minimumBookingHours',
    'bookingDurationIncrementHours',
    'setupAllowanceBillable',
    'option_row.capacity >= greatest(event.guest_count, 1)',
    'Starting venue total is PHP',
    'Choose a space and duration for the authoritative total.',
  ], 'venue marketplace budget visibility')
  assert.doesNotMatch(
    venueMarketplace,
    /when base\.category_key = 'venue' then null::numeric/i,
    'venue marketplace recommendations must not blank every venue amount'
  )
  mustContain(browse, [
    "vendor.categoryId === 'venues' ? 'Starting estimate' : 'Event estimate'",
  ], 'venue marketplace estimate label')
})

test('payment, held funds, individual decisions, balances, and payouts remain separated', () => {
  const payment = read(migrations[3])
  const acceptance = read(migrations[4])
  const correction = read(migrations[12])
  const pricing = read('src/lib/pricing.ts')
  const planning = read('src/lib/planning.ts')
  const merchant = read('src/lib/merchant.ts')
  const merchantEarnings = read('src/screens/22.2-PayoutEarnings.tsx')
  const paymentScreen = read('src/screens/12-Payment.tsx')
  const serviceDetailsScreen = read('src/screens/08-ServiceDetails.tsx')

  mustContain(payment, [
    "('commission_rate', '{\"value\": 0.05}'::jsonb",
    "('initial_payment_rate', '{\"value\": 0.40}'::jsonb",
    "('provider_initial_rate', '{\"value\": 0.30}'::jsonb",
    'held_provider_amount',
    'held_unallocated_amount',
    "financial_terms_version is distinct from 'phase5-v1'",
  ], 'Phase 5 financial migration')
  mustContain(acceptance, [
    'create or replace function public.respond_to_provider_booking(',
    'release_phase6_provider_initial_share',
    "provider_funds_status = 'rejected_held'",
    'get_my_provider_payment_confirmations',
    'amountWithdrawable',
    'remainingServiceBalance',
  ], 'Phase 6 financial migration')
  mustContain(correction, [
    "'initial_payment_rate',",
    "'{\"value\": 0.35}'::jsonb",
    'provider_initial_value + platform_fee_value',
    'new.held_unallocated_amount := 0',
    "'remainingCollectionMethod', 'direct_to_provider'",
    "payment_type <> 'deposit'",
    "booking.status::text = 'payment_required'",
  ], '35/30/5 financial correction')
  mustContain(pricing, [
    'DEFAULT_COMMISSION_RATE = 0.05',
    'DEFAULT_INITIAL_PAYMENT_RATE = 0.35',
    'DEFAULT_PROVIDER_INITIAL_RATE = 0.3',
    'providerInitialCents + platformFeeCents',
  ], 'frontend pricing contract')
  mustContain(planning, [
    "financial_terms_version: 'phase5-v1'",
    "accountingVersion: 'phase5-v1'",
    "status: 'paid'",
    "value.paymentType !== 'deposit'",
    'remaining 70% directly to each provider',
  ], 'client payment integration')
  mustContain(paymentScreen, [
    '35% of provider service subtotal',
    'Provider Downpayments (30%, held after verification)',
    'Remaining 70% paid directly to providers',
    'Pay 35% Downpayment',
    'Pay in Full',
    "setPaymentType('full')",
    "mode?: 'booking' | 'planning'",
    'disabled={disabled}',
  ], 'current downpayment and full-payment client UI')
  assert.doesNotMatch(paymentScreen, /Coming later/,
    'the V14 booking payment flow must not leave the full-payment option disabled')
  assert.doesNotMatch(serviceDetailsScreen, /Includes .*MULTIVENT service fee/)
  mustContain(merchantEarnings, [
    'Tap an event to view its payment breakdown',
    'accessibilityState={{ expanded }}',
    'setExpanded((current) => !current)',
  ], 'collapsible provider payment confirmations')
  assert.ok(
    merchantEarnings.indexOf('Earnings overview')
      < merchantEarnings.indexOf('Payment confirmations'),
    'Earnings overview must appear before payment confirmations'
  )
  mustContain(merchant, [
    "context.client.rpc('respond_to_provider_booking'",
    "context.client.rpc('get_my_provider_payment_confirmations')",
    "context.client.rpc('request_my_provider_payout'",
  ], 'provider financial integration')
})

test('coordinators can inspect requests and both provider roles see commission-free remaining balances', () => {
  const visibility = read(migrations[8])
  const coordinator = read('src/lib/coordinator.ts')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')
  const merchant = read('src/lib/merchant.ts')
  const merchantDetails = read('src/screens/19.1-BookingRequest.tsx')

  mustContain(visibility, [
    'create or replace function public.get_my_coordinator_booking_details()',
    "and not is_phase6_payment",
    'The client downpayment is still pending.',
    '- coalesce(payment.provider_initial_allocation, 0)',
    "paid_payment.payment_scope = 'coordinator_service'",
  ], 'coordinator request and financial visibility migration')
  mustContain(coordinator, [
    "supabase.rpc('get_my_coordinator_booking_details')",
    'remainingCoordinatorBalance',
    'selectedServices',
  ], 'coordinator request integration')
  mustContain(coordinatorScreen, [
    'View client request and pricing',
    'REMAINING COORDINATOR BALANCE',
    "commission. The remaining balance above is based only on your coordination fee.",
  ], 'coordinator request UI')
  mustContain(merchant, [
    'provider_initial_allocation',
    'serviceAmount - initialProviderShare - confirmedExternalPaymentAmount',
  ], 'provider booking financial mapping')
  mustContain(merchantDetails, [
    'REMAINING SERVICE BALANCE',
    "commission. It is not deducted from your remaining service balance.",
  ], 'provider booking financial UI')
})

test('optional zero budgets and explainable DSS marketplace signals stay connected', () => {
  const discovery = read(migrations[9])
  const planning = read('src/lib/planning.ts')
  const catalog = read('src/lib/catalog.ts')
  const browse = read('src/screens/06-CategoryBrowse.tsx')
  const budgetScreen = read('src/screens/05-BudgetAllocation.tsx')

  mustContain(discovery, [
    'alter column total_budget set default 0',
    'create or replace function public.list_public_service_decision_signals()',
    "booking.status::text in ('paid', 'confirmed', 'completed')",
    'dense_rank() over',
    'ranked.booking_count > 0 and ranked.category_rank = 1 as is_most_booked',
  ], 'DSS discovery migration')
  mustContain(planning, [
    'total_budget: budget ?? 0',
  ], 'new event zero-budget default')
  mustContain(budgetScreen, [
    'const initialBudgetValue = sanitizeMoney(initialBudget ?? 0)',
    'const BUDGET_ALLOCATION_STEP = 500',
    'dragStartPositionRef.current + gestureState.dx',
    'onPanResponderTerminationRequest: () => false',
    '<Text style={styles.optionalBudgetAmount}>₱0</Text>',
    'ENTER BUDGET',
  ], 'optional zero-budget UI')
  mustContain(catalog, [
    "supabase.rpc('list_public_service_decision_signals')",
    'bookingCount: decisionSignal?.bookingCount ?? 0',
    'isMostBooked: decisionSignal?.isMostBooked ?? false',
  ], 'catalog decision signals')
  mustContain(browse, [
    "{ id: 'recommended', label: 'Recommended' }",
    "{ id: 'bookings', label: 'Most Booked' }",
    'RECOMMENDED FOR YOU',
    'MOST BOOKED',
    'const [selectedFilters, setSelectedFilters]',
    'const CATEGORY_BUDGET_STEP = 500',
    'budgetDragStartRef.current + gestureState.dx',
    'onPanResponderTerminationRequest: () => false',
    'void commitCategoryBudgetRef.current(draftCategoryBudgetRef.current)',
  ], 'client DSS controls and badges')
})

test('mobile sessions persist and push alerts deliver the matching stored notification', () => {
  const migration = read(migrations[10])
  const hardening = read(migrations[11])
  const exactPushMigration = read('supabase/migrations/20261024000100_exact_notification_push_payload.sql')
  const supabaseClient = read('src/lib/supabase.ts')
  const notifications = read('src/lib/notifications.ts')
  const app = read('src/App.tsx')

  mustContain(supabaseClient, [
    'storage: AsyncStorage',
    'autoRefreshToken: true',
    'persistSession: true',
    'supabase.auth.startAutoRefresh()',
    'supabase.auth.stopAutoRefresh()',
  ], 'persistent mobile authentication')
  mustContain(migration, [
    'create table if not exists public.user_push_tokens',
    'create or replace function public.register_my_push_token(',
    'create or replace function public.dispatch_mobile_push_notification()',
    "'title', 'MULTIVENT'",
    "'body', 'You have a new notification. Open MULTIVENT to view it.'",
    'alter publication supabase_realtime add table public.notifications',
  ], 'data-minimized push migration')
  mustContain(hardening, [
    'revoke all on table public.user_push_tokens from public, anon, authenticated',
    'revoke all on function public.dispatch_mobile_push_notification()',
    'from public, anon, authenticated',
    'grant execute on function public.register_my_push_token(text, text, text, text)',
    'grant execute on function public.revoke_my_push_token(text)',
  ], 'mobile push API least-privilege hardening')
  mustContain(exactPushMigration, [
    'create or replace function public.dispatch_mobile_push_notification()',
    "'title', coalesce(nullif(btrim(new.title), ''), 'MULTIVENT')",
    "'body', coalesce(nullif(btrim(new.body), ''), 'You have a new notification.')",
    "'notificationId', new.id::text",
    "'resourceId', new.resource_id::text",
    "'resourceType', new.resource_type",
    "'channelId', 'multivent-updates'",
  ], 'exact mobile push delivery')
  mustContain(notifications, [
    'Notifications.getExpoPushTokenAsync({ projectId })',
    "supabase.rpc('register_my_push_token'",
    "supabase.rpc('revoke_my_push_token'",
    "if (Platform.OS !== 'web' && supportsRemotePushNotifications)",
    "if (Platform.OS === 'web' || !supportsRemotePushNotifications) return",
  ], 'native push registration')
  mustContain(app, [
    'supabase.auth.getSession()',
    'Notifications.addNotificationReceivedListener',
    'Notifications.addNotificationResponseReceivedListener',
    "if (Platform.OS === 'web' || !supportsRemotePushNotifications) return undefined",
    "table: 'notifications'",
  ], 'session restoration and live notification integration')
})

test('hardware and browser Back stay inside the application navigation history', () => {
  const app = read('src/App.tsx')

  mustContain(app, [
    'BackHandler.addEventListener',
    "'hardwareBackPress'",
    "window.addEventListener('popstate', handleBrowserBack)",
    'window.history.pushState(guardState, window.document.title)',
    "const screenHistoryRef = React.useRef<AppScreen[]>(['onboarding'])",
    'history.lastIndexOf(nextScreen)',
    'appRootScreens.has(currentScreen)',
    'transitionToScreen(previousScreen)',
  ], 'cross-platform in-app Back navigation')
})

test('legacy payment submission remains idempotent while V14 Step 5 submits booking requests', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const migration = read('supabase/migrations/20261018000400_payment_checkout_idempotency.sql')
  const confirmedMessaging = read('supabase/migrations/20261017000600_phase1_confirmed_booking_messaging.sql')
  const checkoutStart = planning.indexOf('export const savePlanningPayment')
  const checkoutEnd = planning.indexOf('export const assignCoordinatorToEvent')
  const checkout = planning.slice(checkoutStart, checkoutEnd)
  const paymentScreenStart = app.indexOf("case 'payment':")
  const confirmationScreenStart = app.indexOf("case 'confirmation':")
  const paymentScreen = app.slice(paymentScreenStart, confirmationScreenStart)
  const bookingSubmissionStart = app.indexOf('const submitBookingRequests = async () => {')
  const bookingSubmissionEnd = app.indexOf('const reviewSavedPlanChanges = () => {')
  const bookingSubmission = app.slice(bookingSubmissionStart, bookingSubmissionEnd)

  mustContain(app, [
    'bookingRequestSubmissionInFlight',
    "setScreen('bookings')",
    'void refreshLiveData().catch(() => undefined)',
  ], 'V14 booking-request success transition')
  assert.ok(
    bookingSubmission.indexOf("setScreen('bookings')")
      < bookingSubmission.indexOf('void refreshLiveData().catch(() => undefined)'),
    'The bookings workspace must not wait for the non-critical workspace refresh.'
  )
  assert.doesNotMatch(paymentScreen, /savePlanningPayment\(/,
    'V14 Step 5 must not collect a payment while submitting requests')
  mustContain(planning, [
    'checkout_reference:',
    "onConflict: 'checkout_reference'",
    'ignoreDuplicates: true',
  ], 'idempotent payment submission')
  assert.doesNotMatch(
    checkout,
    /\.rpc\('open_booking_conversation'/,
    'a provider-confirmation-only messaging check must not block the payment receipt'
  )
  mustContain(checkout, [
    'Messaging intentionally opens only after provider confirmation.',
    'The server-side confirmation trigger creates the conversation later.',
  ], 'checkout messaging handoff')
  mustContain(confirmedMessaging, [
    "booking.status::text in ('confirmed', 'completed')",
    'Messaging is available only after the provider confirms the booking.',
  ], 'provider-confirmed messaging boundary')
  mustContain(migration, [
    'add column if not exists checkout_reference text',
    'create unique index if not exists payments_checkout_reference_key',
  ], 'checkout idempotency migration')
})

test('historical booking and financial snapshots remain protected from current listing changes', () => {
  const payment = read(migrations[3])
  const deletion = read('database/52_service_deletion_booking_history.sql')
  const planning = read('src/lib/planning.ts')

  mustContain(payment, [
    'Historical bookings, payments, and ledger rows are deliberately not',
    "old.status in ('paid', 'verified', 'refunded')",
    'A recognized payment financial snapshot cannot be changed.',
  ], 'historical payment protection')
  mustContain(deletion, [
    'always preserve services referenced by bookings',
    'raise exception',
  ], 'historical listing protection')
  mustContain(planning, [
    'catering_option_snapshot: selection.catering_option_snapshot',
    'venue_option_snapshot: selection.venue_option_snapshot',
    'selected_provider_snapshot',
  ], 'booking snapshot integration')
})

test('existing account, listing, image, availability, booking, review, notification, and staff modules remain present', () => {
  const requiredFiles = [
    'src/lib/auth.ts',
    'src/screens/02.1-ClientSignup.tsx',
    'src/screens/02.2-MerchantSignup.tsx',
    'src/screens/17-Step1ServiceListing.tsx',
    'src/screens/17.2-Step3ReviewListings.tsx',
    'src/screens/18-AvailabilityCalendar.tsx',
    'src/screens/11-BookingScreen.tsx',
    'src/screens/15-SubmitReview.tsx',
    'src/screens/22.5-Notification.tsx',
    'src/screens/RoleHomePlaceholder.tsx',
    'supabase/functions/admin-create-user/index.ts',
    'supabase/functions/analyze-review/index.ts',
  ]

  requiredFiles.forEach((path) => assert.doesNotThrow(() => read(path), `${path} must exist`))
})

test('payment gateway boundary stays explicitly labeled instead of implying live PayMongo processing', () => {
  const planning = read('src/lib/planning.ts')
  const features = read('docs/MULTIVENT_FEATURES.md')

  assert.match(planning, /const paymentReference = `demo-/)
  assert.match(features, /generated demo payment reference rather than a confirmed external payment-gateway integration/i)
})

test('V7 Phase 4 separates compact coordinator events from exact event management details', () => {
  const app = read('src/App.tsx')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')

  mustContain(app, [
    "| 'coordinatorEventDetails'",
    'setSelectedCoordinatorEventId(event.id)',
    "setScreen('coordinatorEventDetails')",
    'coordinatorDashboard.events.find(',
    'event.id === selectedCoordinatorEventId',
    "handleCoordinatorMessageClient(event, 'coordinatorEventDetails')",
    "handleCoordinatorMessageProvider(event, service, 'coordinatorEventDetails')",
  ], 'coordinator event detail navigation')
  mustContain(coordinatorScreen, [
    "mode?: 'compact' | 'detail'",
    'View Event',
    'export const CoordinatorEventDetailsScreen',
    'CLIENT REQUEST DETAILS',
    'BOOKED &amp; SELECTED SERVICES',
    'CHURCH ARRANGEMENT',
    'Message Client',
    'Message provider',
    'daysRemainingLabel(event.date)',
  ], 'coordinator event details UI')
  mustContain(coordinatorScreen, [
    'export interface ChurchArrangementDraft',
    'onDraftChange?: (draft: ChurchArrangementDraft) => void',
    'onDraftSaved?.()',
  ], 'church arrangement draft preservation')
})

test('coordinator messages remain in the coordinator workspace and use the coordinator navigation', () => {
  const app = read('src/App.tsx')
  const messages = read('src/screens/03.1-Messages.tsx')
  const coordinatorNavigation = read('src/components/CoordinatorBottomNavigation.tsx')

  mustContain(app, [
    'const openCoordinatorTab = (tab: CoordinatorMainTab)',
    "setMessageWorkspace('coordinator')",
    "screen === 'messages' && messageWorkspace === 'client'",
    "screen === 'messages' && messageWorkspace === 'merchant'",
    "onBack={messageWorkspace === 'coordinator'",
    "? () => setScreen('coordinatorHome')",
    "messageWorkspace === 'client'",
    "? () => setScreen('clientHome')",
    'onSelectCoordinatorTab={openCoordinatorTab}',
  ], 'coordinator message routing')
  mustContain(messages, [
    "navigationVariant === 'coordinator' && showBottomNavigation && !isWide",
    '<CoordinatorBottomNavigation',
    'onSelectCoordinatorTab?: (tab: CoordinatorMainTab) => void',
  ], 'coordinator message navigation')
  mustContain(coordinatorNavigation, [
    "{ id: 'messages', icon: 'chat', label: 'Messages' }",
    "{ id: 'account', icon: 'person', label: 'Account' }",
  ], 'coordinator bottom navigation design')
})

test('V10 Phase 6 keeps the mobile brand and navigation treatment consistent', () => {
  const tokens = read('src/theme/tokens.ts')
  const brandIdentity = read('src/components/BrandIdentity.tsx')
  const clientNavigation = read('src/components/ClientBottomNavigation.tsx')
  const merchantNavigation = read('src/components/MerchantBottomNavigation.tsx')
  const coordinatorNavigation = read('src/components/CoordinatorBottomNavigation.tsx')
  const profile = read('src/screens/24-AccountProfile.tsx')
  const planningHeader = read('src/components/PlanningScreenHeader.tsx')

  mustContain(tokens, [
    "primary: '#6B1E2E'",
    "primaryDark: '#4E061A'",
    "backgroundSecondary: '#F8EFF1'",
    "surface: '#FFF7F2'",
    "border: '#E4D8DA'",
  ], 'MULTIVENT design tokens')
  mustContain(brandIdentity, [
    "require('../../assets/multivent-icon.png')",
    'color: colors.primary',
    'color: colors.textInverse',
    'MULTIVENT',
  ], 'shared MULTIVENT identity')
  mustContain(clientNavigation, [
    'size={21}',
    'fontSize: 12',
    'lineHeight: 16',
    'pressed && styles.navItemPressed',
  ], 'client bottom navigation')
  ;[merchantNavigation, coordinatorNavigation].forEach((navigation) => {
    mustContain(navigation, [
      'size={21}',
      'fontSize: 12',
      'lineHeight: 16',
      'pressed && styles.navItemPressed',
    ], 'provider and coordinator bottom navigation')
  })
  mustContain(profile, [
    'BrandIdentity markSize={28} showName={false} variant="metallicWordmark"',
    'name="arrow-back"',
    "backgroundColor: '#6B1E2E'",
    'hitSlop={8}',
    'accessibilityRole="button"',
    'height: 40',
    'width: 40',
  ], 'account profile header')
  mustContain(planningHeader, [
    'name="chevron-left"',
    'name="chevron-right"',
    'hitSlop={8}',
    'width: 40',
    'height: 40',
  ], 'planning navigation header')
})

test('provider root tabs share the metallic-wordmark header and use global navigation', () => {
  const app = read('src/App.tsx')
  const header = read('src/components/MerchantWorkspaceHeader.tsx')
  const services = read('src/screens/17-ProviderServices.tsx')
  const bookings = read('src/screens/19-BookingRequest.tsx')
  const messages = read('src/screens/03.1-Messages.tsx')
  const profile = read('src/screens/22-MerchantProfile.tsx')

  mustContain(header, [
    'BrandIdentity markSize={32} variant="metallicWordmark"',
    'name="notifications-none"',
    "backgroundColor: palette.primaryContainer",
    'accessibilityLabel="Open notifications"',
  ], 'shared provider workspace header')
  ;[services, bookings, profile].forEach((screen) => {
    mustContain(screen, ['<MerchantWorkspaceHeader'], 'provider root-tab header')
    assert.doesNotMatch(screen, /accessibilityLabel="Go back"/,
      'provider root tabs must rely on the global bottom navigation instead of a duplicate back button')
  })
  mustContain(messages, [
    "navigationVariant === 'merchant' ? (",
    '<MerchantWorkspaceHeader',
  ], 'provider messages header')

  const providerServices = app.slice(
    app.indexOf("case 'providerServices':"),
    app.indexOf("case 'providerServiceReview':")
  )
  const providerBookings = app.slice(
    app.indexOf("case 'providerBookingRequests':"),
    app.indexOf("case 'providerBookingRequestDetails':")
  )
  const providerProfile = app.slice(
    app.indexOf("case 'providerProfile':"),
    app.indexOf("case 'accountProfile':")
  )
  ;[providerServices, providerBookings, providerProfile].forEach((rootTab) => {
    assert.doesNotMatch(rootTab, /onBack=/,
      'provider root-tab routes must not pass a redundant back handler')
  })
})

test('in-progress client planning autosaves and returns to the last safe step', () => {
  const app = read('src/App.tsx')
  const eventCreation = read('src/screens/04-EventCreation.tsx')
  const budget = read('src/screens/05-BudgetAllocation.tsx')
  const instructions = read('src/screens/10-InstructionModule.tsx')
  const planning = read('src/lib/planning.ts')

  mustContain(app, [
    "import AsyncStorage from '@react-native-async-storage/async-storage'",
    'clientPlanningResumeStorageKey',
    'AppState.addEventListener',
    "window.addEventListener('pagehide', persistBeforeDeactivation)",
    'saveEventDraft(value, Math.max(1, maxPlanningStep))',
    'saveBudgetPlan(value, 2)',
    "previousScreen === 'eventCreation' && screen !== 'eventCreation'",
    "previousScreen === 'budgetAllocation' && screen !== 'budgetAllocation'",
    'restoreClientPlanningResume',
    'transitionToScreen(resumeScreen)',
    'onDraftChange={queueBudgetAutosave}',
    'initialValue={instructionDraft}',
    'onDraftChange={handleInstructionDraftChange}',
    'clearClientPlanningResume()',
  ], 'client planning autosave and resume flow')
  assert.doesNotMatch(eventCreation, /SAVE DRAFT/,
    'event creation must not require a separate manual draft action')
  mustContain(eventCreation, ['onValueChange?: (value: EventCreationValue) => void'],
    'event basics autosave input contract')
  mustContain(budget, ['onDraftChange?: (value: BudgetAllocationValue) => void', 'const draftValue'],
    'budget draft autosave contract')
  mustContain(instructions, [
    'initialValue?: InstructionModuleValue',
    'onDraftChange?: (value: InstructionModuleValue) => void',
    'draftsForServices',
  ], 'instruction draft resume contract')
  mustContain(planning, ['planningStep = 3', 'ensureDraftEvent(undefined, undefined, false, false, planningStep)'],
    'budget autosave planning-step contract')
})

test('new events and resumed drafts do not wait for a whole-workspace refresh', () => {
  const app = read('src/App.tsx')
  const createStart = app.indexOf('const startNewClientEvent = async () =>')
  const resumeStart = app.indexOf('const resumeClientDraft = async (draftId: string) =>')
  const savedPlanStart = app.indexOf('const resumeSavedPlan = async (savedPlanId: string) =>')
  const createFlow = app.slice(createStart, resumeStart)
  const resumeFlow = app.slice(resumeStart, savedPlanStart)

  mustContain(app, ['const hydrateClientPlanningState = React.useCallback'],
    'shared client-plan state hydration')
  mustContain(createFlow, [
    'const result = await createClientEventDraft()',
    'openEventCreation()',
    'void refreshLiveData().catch(() => undefined)',
  ], 'new-event foreground and background work')
  assert.ok(
    createFlow.indexOf('openEventCreation()') < createFlow.indexOf('void refreshLiveData().catch(() => undefined)'),
    'The event form must appear before its nonessential workspace refresh.'
  )
  assert.doesNotMatch(createFlow, /await refreshLiveData\(\)/,
    'New-event navigation must not wait for a whole-workspace refresh.')
  mustContain(resumeFlow, [
    'const planningState = await fetchClientPlanningState()',
    'hydrateClientPlanningState(planningState, catalogServices)',
    'void refreshLiveData().catch(() => undefined)',
  ], 'draft-resume foreground and background work')
  assert.doesNotMatch(resumeFlow, /await refreshLiveData\(\)/,
    'Draft navigation must not wait for a whole-workspace refresh.')
})

test('V11 Phase 1 keeps paid initial allocations as non-withdrawable receivables', () => {
  const foundation = read('database/79_held_receivables_foundation.sql')
  const deployMigration = read(
    'supabase/migrations/20261021000900_held_receivables_foundation.sql'
  )
  const pricing = read('src/lib/pricing.ts')

  assert.equal(
    deployMigration,
    foundation,
    'the tracked Supabase migration must exactly match the reviewed database source'
  )
  mustContain(foundation, [
    "'held_receivable'",
    "'eligible_for_release'",
    "'available_for_payout'",
    'receivable_accepted_at',
    'payout_eligible_on',
    'receivable_reconciliation_required',
    'create or replace function public.hold_phase11_provider_receivable(',
    'create or replace function public.hold_phase11_coordinator_receivable(',
    'create or replace function public.respond_to_provider_booking(',
    'create or replace function public.respond_event_coordinator_assignment(',
    'create or replace function public.get_my_coordinator_booking_details()',
    'held receivable; it is not withdrawable yet.',
    'create or replace function public.get_my_provider_payment_confirmations()',
    "then 'Held Receivable'",
    "'release_condition', '14_day_payout_window'",
    "'initial_share_credited', 0",
    'create or replace function public.request_my_provider_payout(requested_amount numeric)',
    "'legacy', 'initial_share_credited', 'available_for_payout'",
    'Held receivable amounts cannot be released or altered before payout eligibility.',
    'phase11_reconciliation_required',
  ], 'V11 held-receivables foundation')
  mustContain(pricing, [
    'DEFAULT_COMMISSION_RATE = 0.05',
    'DEFAULT_INITIAL_PAYMENT_RATE = 0.35',
    'DEFAULT_PROVIDER_INITIAL_RATE = 0.3',
  ], 'V11 must preserve the canonical payment policy')
})

test('V11 Phase 2 evaluates the 14-day payout window only on the secured backend', () => {
  const release = read('database/80_payout_eligibility_release.sql')
  const deployMigration = read(
    'supabase/migrations/20261022000100_payout_eligibility_release.sql'
  )

  assert.equal(
    deployMigration,
    release,
    'the tracked Phase 2 migration must exactly match the reviewed database source'
  )
  mustContain(release, [
    "event_row.event_date - 14",
    'public.phase11_event_local_date(event_row.timezone)',
    'create or replace function public.phase11_receivable_is_release_eligible(',
    "payment.status in ('paid', 'verified')",
    "booking.status::text in ('confirmed', 'completed')",
    "event_row.coordinator_assignment_status = 'accepted'",
    "'refund_pending'",
    "'chargeback_status'",
    'create or replace function public.process_phase11_payout_eligibility(',
    'for update skip locked',
    "provider_funds_status = 'available_for_payout'",
    "'external_payout_released', false",
    'create extension if not exists pg_cron;',
    "'multivent-phase11-payout-eligibility'",
    'after update of event_date, timezone, status on public.events',
    'after update of status on public.bookings',
    'payout_request_reconciliation_required',
    "ledger.provider_funds_status <> 'available_for_payout'",
  ], 'V11 Phase 2 eligibility and payout safeguards')
  assert.doesNotMatch(release, /insert into\s+public\.provider_payout_requests[\s\S]{0,160}process_phase11/i,
    'eligibility processing must not initiate a payout transfer')
})

test('provider acceptance can record a held receivable without releasing it', () => {
  const acceptanceHold = read(
    'supabase/migrations/20261022000500_authorize_acceptance_receivable_hold.sql'
  )
  const providerStart = acceptanceHold.indexOf(
    'create or replace function public.hold_phase11_provider_receivable('
  )
  const coordinatorStart = acceptanceHold.indexOf(
    'create or replace function public.hold_phase11_coordinator_receivable('
  )
  const providerHold = acceptanceHold.slice(providerStart, coordinatorStart)
  const coordinatorHold = acceptanceHold.slice(coordinatorStart)

  assert.ok(providerStart >= 0 && coordinatorStart > providerStart,
    'the acceptance-hold migration must retain both secured receivable helpers')
  mustContain(providerHold, [
    "perform set_config('app.phase11_receivable_release_authorized', 'true', true)",
    "set provider_funds_status = 'held_receivable'",
    'and ledger.provider_net_amount = 0',
  ], 'provider acceptance hold')
  mustContain(coordinatorHold, [
    "perform set_config('app.phase11_receivable_release_authorized', 'true', true)",
    "set provider_funds_status = 'held_receivable'",
    'and ledger.provider_net_amount = 0',
  ], 'coordinator acceptance hold')
  assert.doesNotMatch(acceptanceHold, /provider_funds_status\s*=\s*'available_for_payout'/,
    'acceptance may record a hold but must never make it withdrawable')
  assert.doesNotMatch(acceptanceHold, /amount_released\s*=/,
    'acceptance may not release any amount')
})

test('V11 Phase 3 presents receivables separately from withdrawable funds', () => {
  const walletSource = read('database/81_receivable_wallet_views.sql')
  const deployMigration = read(
    'supabase/migrations/20261022000200_receivable_wallet_views.sql'
  )
  const payouts = read('src/screens/22.2-PayoutEarnings.tsx')
  const merchant = read('src/lib/merchant.ts')
  const coordinator = read('src/lib/coordinator.ts')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')

  assert.equal(
    deployMigration,
    walletSource,
    'the tracked Phase 3 migration must exactly match the reviewed database source'
  )
  mustContain(walletSource, [
    'create or replace function public.get_my_provider_receivable_wallet()',
    'create or replace function public.get_my_coordinator_receivable_wallet()',
    "'receivables'",
    "'availableBalance'",
    "'pendingPayouts'",
    "'totalPaidOut'",
    "'Held Receivable'",
    'receivable_reconciliation_required',
  ], 'V11 Phase 3 read-only wallet projections')
  mustContain(payouts, [
    'RECEIVABLES (HELD)',
    'AVAILABLE BALANCE',
    'PENDING PAYOUTS',
    'TOTAL PAID OUT',
    'No funds are currently available to request.',
    'Your allocation is currently held by MULTIVENT',
    'Expected eligibility:',
    'onRequestPayout?.(value.availableBalance)',
  ], 'provider receivable wallet presentation')
  mustContain(merchant, [
    "get_my_provider_receivable_wallet",
    'receivableWalletResult.error',
    'pendingPayouts:',
    'totalPaidOut:',
  ], 'provider receivable wallet data mapping')
  mustContain(coordinator, [
    "get_my_coordinator_receivable_wallet",
    'CoordinatorWallet',
    'receivableWalletError',
  ], 'coordinator receivable wallet data mapping')
  mustContain(coordinatorScreen, [
    'CoordinatorWalletSummary',
    'This workspace does not submit payout requests.',
    'RECEIVABLES (HELD)',
    'TOTAL PAID OUT',
  ], 'read-only coordinator wallet presentation')
})

test('V11 Phase 4 locks only cancelled or rejected allocations without inventing a refund amount', () => {
  const cancellationProtection = read('database/82_cancellation_refund_hold_protection.sql')
  const deployMigration = read(
    'supabase/migrations/20261022000300_cancellation_refund_hold_protection.sql'
  )
  const merchant = read('src/lib/merchant.ts')

  assert.equal(
    deployMigration,
    cancellationProtection,
    'the tracked Phase 4 migration must exactly match the reviewed database source'
  )
  mustContain(cancellationProtection, [
    'create or replace function public.phase11_has_refund_or_financial_hold',
    "'policy_review_required'",
    "'manual_reconciliation_required'",
    'create or replace function public.phase11_flag_rejected_receivable_refund_review()',
    'create or replace function public.phase11_hold_cancelled_event_receivables()',
    'where ledger.event_id = new.id',
    "'event_cancelled'",
    'and not public.phase11_has_refund_or_financial_hold(ledger.metadata)',
    'create or replace function public.request_my_provider_payout(requested_amount numeric)',
    'provider_funds_status in (',
    "'available_for_payout'",
    'get_my_provider_receivable_wallet()',
    'get_my_coordinator_receivable_wallet()',
    'never invents',
  ], 'V11 Phase 4 cancellation/refund holds')
  assert.doesNotMatch(cancellationProtection, /update\s+public\.payments\s+set\s+status\s*=\s*'refunded'/i,
    'cancellation protection must not claim a refund was completed without verified refund processing')
  mustContain(merchant, [
    'Eligible initial-payment refunds are recorded automatically for external bank or e-wallet disbursement',
  ], 'client cancellation outcome copy')
})

test('V11 wallet refunds apply the confirmed cancellation policy without rewriting payments', () => {
  const walletRefunds = read('database/84_client_refund_wallet.sql')
  const deployMigration = read(
    'supabase/migrations/20261022000600_client_refund_wallet.sql'
  )
  const clientRefunds = read('src/lib/client-wallet.ts')
  const refundsScreen = read('src/screens/24.1-ClientWallet.tsx')
  const home = read('src/screens/03-ClientHome.tsx')
  const app = read('src/App.tsx')

  assert.equal(
    deployMigration,
    walletRefunds,
    'the deployed refund-wallet migration must exactly match the reviewed database source'
  )
  mustContain(walletRefunds, [
    'create table if not exists public.client_wallet_transactions',
    "transaction_type in ('refund_credit')",
    'client_wallet_refund_credit_ledger_uidx',
    'create or replace function public.credit_phase11_client_wallet_refund(',
    "refund_reason not in ('client_cancellation', 'recipient_declined')",
    "event_row.event_date <= local_today + 14",
    "'recipient_declined'",
    "'refund_requires_reconciliation'",
    "'wallet_credited'",
    'create or replace function public.phase11_credit_cancelled_event_wallet_refunds()',
    'create or replace function public.phase11_credit_declined_recipient_wallet_refund()',
    'create or replace function public.get_my_client_wallet()',
    'revoke all on function public.credit_phase11_client_wallet_refund(uuid, text) from public;',
    'grant execute on function public.get_my_client_wallet() to authenticated;',
  ], 'V11 automatic client-wallet refund contract')
  assert.doesNotMatch(walletRefunds, /update\s+public\.payments\s+set\s+status\s*=\s*'refunded'/i,
    'a wallet credit must preserve the original recognized payment record')
  assert.doesNotMatch(walletRefunds, /grant\s+execute\s+on\s+function\s+public\.credit_phase11_client_wallet_refund/i,
    'clients must not be able to invoke the refund-credit routine directly')
  mustContain(clientRefunds, [
    "supabase.rpc('get_my_client_refund_overview_v14')",
    "pendingExternalDisbursements",
    "historicalWalletCredits",
  ], 'client external-refund data boundary')
  mustContain(refundsScreen, [
    'PENDING EXTERNAL REFUNDS',
    'External refund activity',
    'This is not an in-app cash balance.',
    'Historical records',
  ], 'client external-refund presentation')
  mustContain(home, [
    'onOpenRefunds?: () => void',
    "{ id: 'refunds', label: 'Refunds'",
    'onOpenRefunds?.()',
  ], 'client home refund entry point')
  mustContain(app, [
    "| 'clientRefunds'",
    'fetchClientRefundOverview',
    '<ClientRefundsScreen',
  ], 'client refund navigation')
})

test('V11 Phase 5 maps payout requests to authoritative allocations and exposes read-only reconciliation', () => {
  const payoutSecurity = read('database/83_payout_security_and_financial_reconciliation.sql')
  const deployMigration = read(
    'supabase/migrations/20261022000400_payout_security_and_financial_reconciliation.sql'
  )
  const financialReporting = read('web/components/screens/financial-reporting-screen.tsx')

  assert.equal(
    deployMigration,
    payoutSecurity,
    'the tracked Phase 5 migration must exactly match the reviewed database source'
  )
  mustContain(payoutSecurity, [
    'create table if not exists public.provider_payout_request_allocations',
    'allocation_reservations_required boolean not null default false',
    'revoke insert, update, delete on table public.provider_payout_requests from authenticated;',
    'create or replace function public.phase11_provider_allocation_available_amount(',
    "current_setting('app.phase11_payout_request_authorized', true)",
    'create constraint trigger phase11_require_payout_request_allocations_trigger',
    'deferrable initially deferred',
    'create or replace function public.request_my_provider_payout(requested_amount numeric)',
    'for update of provider',
    'for update of ledger',
    'insert into public.provider_payout_request_allocations',
    'The payout request exceeds the available balance.',
    'rename to get_my_provider_earnings_phase11_legacy',
    'create or replace function public.get_admin_phase11_receivables_reconciliation()',
    "'refundHoldExposure'",
    "'historicUnmappedPayoutCount'",
    'historic payout request has no allocation-level ledger mapping',
  ], 'V11 Phase 5 payout security and reconciliation')
  assert.doesNotMatch(payoutSecurity, /grant\s+insert\s+on\s+table\s+public\.provider_payout_requests\s+to\s+authenticated/i,
    'providers must not retain a direct table-insert payout path')
  mustContain(financialReporting, [
    "get_admin_phase11_receivables_reconciliation",
    'Held funds and reconciliation',
    'Refund / hold exposure',
    'Historic unmapped payout requests',
  ], 'authorized web-admin reconciliation visibility')
})

test('V12 Phase 1 keeps client navigation floating, expandable, and booking-route safe', () => {
  const navigation = read('src/components/ClientBottomNavigation.tsx')
  const app = read('src/App.tsx')

  mustContain(navigation, [
    "export type ClientMainTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'",
    "{ id: 'home' as const, icon: 'home' as const, label: 'Home' }",
    "{ id: 'explore' as const, icon: 'explore' as const, label: 'Explore' }",
    "{ id: 'messages' as const, icon: 'inbox' as const, label: 'Inbox' }",
    "{ id: 'profile' as const, icon: 'person' as const, label: 'Account' }",
    "AccessibilityInfo.isReduceMotionEnabled()",
    "AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)",
    'const [isExpanded, setIsExpanded] = React.useState(false)',
    'duration: reducedMotion ? 0 : animationDuration',
    'onToggleNavigation?.()',
    'navigationTranslateY.setValue(0)',
    'outputRange: [0.02, 1]',
    "require('../../assets/Metallic LOGO.png')",
    'const hasCollapsedNavigationUpdate = !isExpanded && (hasUnreadHomeUpdates || hasUnreadInbox)',
    "`Expand navigation${hasCollapsedNavigationUpdate ? ', with unread updates' : ''}`",
    'styles.logoUnreadDot',
    'pressed && styles.navItemPressed',
    'backgroundColor: palette.white',
    "iconMuted: '#625D5D'",
    'width: 82',
    "overflow: 'hidden'",
    'styles.logoGlow',
    "backgroundColor: 'rgba(107, 30, 46, 0.11)'",
    "import { LinearGradient } from 'expo-linear-gradient'",
    'styles.navigationFade',
    "'rgba(224, 185, 198, 0.98)'",
  ], 'V12 Phase 1 client navigation')
  assert.doesNotMatch(navigation, /id: 'bookings' as const/,
    'Bookings must not remain an expandable navigation action')
  assert.doesNotMatch(navigation, /navigationBackdrop/,
    'The expanded white navigation bar must not add a translucent background extension')
  mustContain(app, [
    "if (tab === 'bookings') setScreen('bookings')",
    "screen === 'bookings'",
    '<ClientBottomNavigation',
    "edges={['top', 'right', 'bottom', 'left']}",
    "profileReturnScreen === 'clientHome'",
    'handleClientNavigationScrollDirection',
    'onToggleNavigation={keepClientNavigationVisibleForToggle}',
  ], 'booking route preservation')
  const selectTab = navigation.slice(
    navigation.indexOf('const selectTab'),
    navigation.indexOf('const barScaleX')
  )
  assert.doesNotMatch(selectTab, /setIsExpanded\(false\)/,
    'Only the central M control may collapse the expanded navigation')
  assert.doesNotMatch(navigation, /actionTranslateY/,
    'Pill expansion must not add a vertical translation separate from scroll visibility')
  assert.doesNotMatch(navigation, /opacity:\s*expansion/,
    'The pill must expand and collapse from the M control without fading out')

  const scrollingClientScreens = [
    read('src/screens/06-CategoryBrowse.tsx'),
    read('src/screens/11-BookingScreen.tsx'),
    read('src/screens/03.1-Messages.tsx'),
    read('src/screens/24-AccountProfile.tsx'),
  ]
  scrollingClientScreens.forEach((source) => {
    mustContain(source, [
      "onScrollDirectionChange?: (direction: 'down' | 'up') => void",
      'scrollEventThrottle={16}',
      "onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')",
    ], 'client navigation scroll direction wiring')
  })
})

test('V12 Phase 2 unifies client messages and notifications without duplicating either data source', () => {
  const navigation = read('src/components/ClientBottomNavigation.tsx')
  const messages = read('src/screens/03.1-Messages.tsx')
  const notifications = read('src/screens/22.5-Notification.tsx')
  const home = read('src/screens/03-ClientHome.tsx')
  const app = read('src/App.tsx')

  mustContain(navigation, [
    "{ id: 'messages' as const, icon: 'inbox' as const, label: 'Inbox' }",
    'hasUnreadInbox?: boolean',
    "tab.id === 'messages' && hasUnreadInbox",
    'styles.inboxUnreadDot',
  ], 'V12 Phase 2 Inbox navigation')
  mustContain(messages, [
    "export type ClientInboxTab = 'messages' | 'notifications'",
    'initialInboxTab?: ClientInboxTab',
    "{navigationVariant === 'client' ? 'INBOX' : 'MESSAGES'}",
    "(['messages', 'notifications'] as ClientInboxTab[]).map",
    '<NotificationScreen',
    'embedded',
    'variant="client"',
    "notification.category !== 'message'",
    "if (notification.category === 'message') setInboxTab('messages')",
  ], 'V12 Phase 2 Inbox tabs')
  mustContain(notifications, [
    'embedded?: boolean',
    "variant?: 'client' | 'coordinator' | 'merchant'",
    'embedded && styles.embeddedContent',
    "notifications.filter((notification) => notification.category !== 'message')",
    'onScrollDirectionChange?:',
    'notifications.forEach((notification)',
  ], 'V12 Phase 2 embedded notification feed')
  assert.doesNotMatch(home, /accessibilityLabel="Open notifications"/,
    'Client home must not retain an independent notification shortcut')
  mustContain(app, [
    'const hasUnreadClientInbox',
    'hasUnreadInbox={hasUnreadClientInbox}',
    "renderMessagesWorkspace('notifications')",
    "screen === 'notifications' && homeReturnScreen === 'clientHome'",
    "setMessageWorkspace('client')",
    "if (nextState === 'active') void refreshLiveData()",
  ], 'V12 Phase 2 Inbox routing and unread refresh')
})

test('client home uses a unified MULTIVENT top surface and routes its headset control to support', () => {
  const home = read('src/screens/03-ClientHome.tsx')
  const app = read('src/App.tsx')

  mustContain(home, [
    "import { LinearGradient } from 'expo-linear-gradient'",
    "import { BrandIdentity } from '../components/BrandIdentity'",
    "backgroundColor: '#701B30'",
    'backgroundColor: colors.primaryLight',
    'referenceTopSurface',
    'BrandIdentity markSize={30} showName={false} variant="metallicWordmark"',
    'accessibilityLabel="Contact MULTIVENT Support"',
    'name="support-agent"',
    'referenceAvatarRim',
    'referenceWordmarkDepth',
    'referenceHeaderWordmark',
  ], 'client home branded support header')
  mustContain(app, [
    "setSupportReturnScreen('clientHome')",
    "setScreen('support')",
    '<SupportScreen onBack={() => setScreen(supportReturnScreen)} />',
  ], 'client home support return route')
})

test('client home appearance keeps Classic as the default while Modern reuses the same client data and actions', () => {
  const app = read('src/App.tsx')
  const account = read('src/screens/24-AccountProfile.tsx')
  const home = read('src/screens/03-ClientHome.tsx')
  const modernHome = read('src/screens/03.0-ModernHome.tsx')
  const appearance = read('src/lib/client-home-appearance.ts')

  mustContain(home, [
    "appearance = 'classic'",
    "appearance === 'modern'",
    '<ModernHomeScreen',
    'styles.referenceTopSurface',
    'bookingProgressEvents={bookingProgressEvents}',
    'onQuickAccess={handleQuickAccess}',
  ], 'dual home controller')
  mustContain(modernHome, [
    'bookingProgressEvents?: ClientBookingProgress[]',
    'recommendations?: HomeServiceRecommendation[]',
    'onOpenBookingProgress?: (booking: BookingItem) => void',
    'onQuickAccess: (itemId: QuickAccessId) => void',
    'onSelectRecommendation?: (serviceId: string) => void',
    'QUICK_ACCESS_ITEMS',
  ], 'modern home shared presentation')
  mustContain(account, [
    'Home Screen Appearance',
    'Choose your preferred home screen design.',
    'Classic UI',
    'Modern UI',
    'onHomeAppearanceChange?: (appearance: ClientHomeAppearance) => void',
  ], 'client appearance preference')
  mustContain(appearance, [
    "export type ClientHomeAppearance = 'classic' | 'modern'",
    'AsyncStorage.getItem',
    'AsyncStorage.setItem',
    "value === 'modern' ? 'modern' : 'classic'",
  ], 'client appearance persistence')
  mustContain(app, [
    'loadClientHomeAppearance(authenticatedUserId)',
    'saveClientHomeAppearance(authenticatedUserId, appearance)',
    'clientHomeAppearanceRevisionRef',
    'appearance={clientHomeAppearance}',
    'onHomeAppearanceChange={changeClientHomeAppearance}',
  ], 'appearance routing without a data reload')
})

test('V14 Phase 1 asks for coordinator planning before conditionally asking about a church wedding', () => {
  const eventCreation = read('src/screens/04-EventCreation.tsx')
  const app = read('src/App.tsx')

  mustContain(eventCreation, [
    'const handleCoordinatorPreferenceChange = (nextPreference: boolean)',
    'if (!nextPreference) {',
    'setIsChurchWedding(undefined)',
    "const shouldAskChurchQuestion = eventType === 'wedding' && wantsCoordinator === true",
    "(!shouldAskChurchQuestion || typeof isChurchWedding === 'boolean')",
    'onPress={() => handleCoordinatorPreferenceChange(option.value)}',
    '{shouldAskChurchQuestion ? (',
  ], 'V14 coordinator-first event creation')
  assert.ok(
    eventCreation.indexOf('WOULD YOU LIKE AN EVENT COORDINATOR?')
      < eventCreation.indexOf('IS THIS A CHURCH WEDDING?'),
    'the coordinator question must be rendered before the church question'
  )

  mustContain(app, [
    '&& first.wantsCoordinator === second.wantsCoordinator',
    'value.wantsCoordinator === false && assignedCoordinator',
    'Keep the persisted draft intact',
    'if (value.wantsCoordinator === false && assignedCoordinator) {',
    "'Remove coordinator booking?'",
  ], 'V14 safe coordinator preference persistence')
})

test('V14 Phase 2 keeps Step 5 as a payment-free event summary with idempotent booking requests', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const summary = read('src/screens/12-EventSummary.tsx')
  const sourceMigration = read('database/86_v14_booking_requests_before_payment.sql')
  const deployMigration = read('supabase/migrations/20261024000800_v14_booking_requests_before_payment.sql')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the tracked V14 booking-request migration must exactly match the reviewed database source'
  )
  mustContain(summary, [
    'label="Event Summary"',
    'Total Event Cost',
    'Required Down Payment (35%)',
    'Remaining Balance',
    'Save for Later',
    'Book Now',
    'Submit Booking Requests?',
    'Submit Requests',
    'No payment is collected when you submit booking requests.',
  ], 'V14 event summary UI')
  assert.doesNotMatch(summary, /Select Payment Method|onPay\?\.|Pay 35% Downpayment/,
    'the event summary must not collect a payment')
  mustContain(app, [
    '<EventSummaryScreen',
    'isSubmittingRequests={isSubmittingBookingRequests}',
    'onSubmitRequests={() => void submitBookingRequests()}',
    'const submitBookingRequests = async () => {',
    "setScreen('bookings')",
  ], 'V14 event-summary routing')
  assert.doesNotMatch(app, /savePlanningPayment\(/,
    'Step 5 must not record a payment while submitting requests')
  mustContain(planning, [
    'export const submitPlanningBookingRequests',
    "client.rpc('submit_my_event_booking_requests_v14'",
  ], 'V14 mobile booking-request API')
  mustContain(deployMigration, [
    'create or replace function public.submit_my_event_booking_requests_v14(',
    'for update;',
    "'requested'",
    "'New booking request'",
    "'New coordinator booking request'",
    "'coordinator_request_submitted'",
  ], 'V14 booking-request backend')
  assert.doesNotMatch(deployMigration, /insert\s+into\s+public\.payments/i,
    'booking-request submission must not create a payment record')
})

test('V14 Phase 3 tracks each acceptance and blocks payment until all required recipients accept', () => {
  const sourceMigration = read('database/87_v14_all_provider_acceptance_gate.sql')
  const deployMigration = read('supabase/migrations/20261024000900_v14_all_provider_acceptance_gate.sql')
  const merchant = read('src/lib/merchant.ts')
  const coordinatorScreen = read('src/screens/23-Coordinator.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the tracked V14 all-provider gate migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.event_payment_eligibility_v14(',
    "'accepted_provider_count'",
    "'coordinator_required'",
    "'payment_eligible'",
    'create or replace function public.refresh_event_payment_eligibility_v14(',
    "'All booking requests accepted'",
    'create or replace function public.enforce_v14_payment_eligibility()',
    'aaa_enforce_v14_payment_eligibility_trigger',
    'create or replace function public.respond_to_provider_booking(',
    "set status = 'confirmed'",
    'create or replace function public.respond_event_coordinator_assignment(',
    'create or replace function public.get_my_coordinator_booking_details()',
    'true as can_accept',
  ], 'V14 acceptance gate backend')
  assert.doesNotMatch(
    sourceMigration,
    /payment must be confirmed before this request can be answered/i,
    'V14 providers and coordinators must be able to accept their own unpaid requests'
  )
  mustContain(merchant, [
    'payments(status, amount, service_subtotal',
    'Awaiting provider confirmations',
    'No client payment yet — accept this request to help unlock payment.',
  ], 'V14 pre-payment provider and client request visibility')
  assert.doesNotMatch(merchant, /payments!inner/,
    'pre-payment booking requests must not require a payment join to appear')
  mustContain(coordinatorScreen, [
    'const cannotAccept = busy',
    'The client can pay only after every required provider and coordinator has accepted.',
  ], 'V14 coordinator pre-payment acceptance UI')
})

test('V14 Phase 4 starts payment only from Booking Details after the secured acceptance gate', () => {
  const sourceMigration = read('database/88_v14_booking_details_payment_flow.sql')
  const deployMigration = read('supabase/migrations/20261025000100_v14_booking_details_payment_flow.sql')
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const details = read('src/screens/11.1-BookingDetails.tsx')
  const payment = read('src/screens/12-Payment.tsx')
  const merchant = read('src/lib/merchant.ts')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the tracked V14 Booking Details payment migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.get_my_event_payment_quote_v14(',
    'immutable booking/coordinator price snapshots',
    'create or replace function public.initiate_my_event_payment_v14(',
    'public.event_payment_eligibility_v14(event_row.id)',
    "'v14-phase4'",
    "'pending'",
    'Pending attempts create no verified funds or provider receivables.',
    "payment_type not in ('deposit', 'full')",
    "payment_type = 'full'",
  ], 'V14 Booking Details payment backend')
  mustContain(planning, [
    'export const fetchMyEventPaymentQuoteV14',
    "client.rpc('get_my_event_payment_quote_v14'",
    'export const initiateMyEventPaymentV14',
    "client.rpc('initiate_my_event_payment_v14'",
  ], 'V14 client payment API')
  mustContain(details, [
    'paymentDock',
    'paymentDockContent',
    'acceptedConfirmationCount',
    'requiredConfirmationCount',
    'paddingBottom: 24',
    'Confirm Payment',
    'setChangeMode(\'cancel\')',
    '>Cancel</Text>',
    'paymentQuote?.paymentEligible',
    'not financially reserved yet',
  ], 'V14 Booking Details payment UI')
  assert.doesNotMatch(details, /<DetailRow label="PRICE"/,
    'the Event Details card must not duplicate marketplace pricing')
  mustContain(details, [
    'const bookedServiceCount = bookedServices.length + (hasCoordinatorTracker ? 1 : 0)',
    "coverage: `${bookedServiceCount} service${bookedServiceCount === 1 ? '' : 's'}`",
    '>Event Details</Text>',
    'borderTopLeftRadius: 18',
    'borderTopRightRadius: 18',
    'accessibilityLabel="Confirm payment"',
  ], 'Booking Details header, service count, and payment actions')
  mustContain(payment, [
    "const [paymentType, setPaymentType] = React.useState<PaymentType>('deposit')",
    "onPress={() => setPaymentType('full')}",
    'Pay in Full',
    'Full Payment Due Now',
    'server-authoritative snapshot',
    'BookingPaymentSheet',
    'animationType="fade"',
    'summaryExpanded',
    'bookingSheetHandle',
    'receiptProgress.interpolate',
    'bookingSheetReceiptAnimated',
    'bookingSheetServiceRow',
    'bookingSheetFooter',
    'Confirm Downpayment',
  ], 'V14 payment option UI')
  mustContain(merchant, [
    'const hasRecordedPayment',
    "paymentStatusValue === 'verified' || paymentStatusValue === 'paid'",
  ], 'V14 pending payment financial-display boundary')
  mustContain(app, [
    "| 'bookingPayment'",
    'setIsBookingPaymentSheetVisible(true)',
    '<BookingPaymentSheet',
    'items={bookingPaymentQuote?.items}',
    'visible={isBookingPaymentSheetVisible}',
    'onStartPayment={() => void openBookingPayment()}',
  ], 'V14 Booking Details payment routing')
  assert.doesNotMatch(
    app.slice(app.indexOf("case 'payment':"), app.indexOf("case 'confirmation':")),
    /savePlanningPayment\(/,
    'event-summary submission must remain payment-free after adding Booking Details payment'
  )
})

test('V14 Phase 5 tracks external settlement and refunds without operating an internal cash wallet', () => {
  const sourceMigration = read('database/89_v14_bank_settlement_financial_tracking.sql')
  const deployMigration = read('supabase/migrations/20261025000200_v14_bank_settlement_financial_tracking.sql')
  const payment = read('src/screens/12-Payment.tsx')
  const planning = read('src/lib/planning.ts')
  const refunds = read('src/lib/client-wallet.ts')
  const refundsScreen = read('src/screens/24.1-ClientWallet.tsx')
  const home = read('src/screens/03-ClientHome.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 bank-settlement migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create table if not exists public.payment_settlement_records',
    "'manual_bank_transfer', 'e_wallet_checkout'",
    'create table if not exists public.client_refund_disbursements',
    "'pending_destination', 'pending_disbursement', 'processing'",
    'create or replace function public.get_v14_payment_settlement_context()',
    'Prototype mode: no live bank account is configured.',
    'create or replace function public.enforce_v14_authoritative_payment_status()',
    'Client checkout can only create a pending payment.',
    'create or replace function public.verify_v14_payment_settlement(',
    "public.has_permission('remittance.verify')",
    'drop trigger if exists phase11_wallet_refund_cancelled_event_trigger',
    'create or replace function public.create_v14_external_refund_obligation(',
    "'external_refund_obligation'",
    'create or replace function public.get_my_client_refund_overview_v14()',
    'create or replace function public.record_v14_refund_disbursement(',
  ], 'V14 external-settlement backend')
  assert.doesNotMatch(sourceMigration, /update\s+public\.payments\s+set\s+status\s*=\s*'refunded'/i,
    'refund-disbursement tracking must not simulate a completed refund by overwriting the original payment')
  mustContain(planning, [
    'export const fetchPaymentSettlementContextV14',
    "client.rpc('get_v14_payment_settlement_context')",
    "environment: environment === 'live' || environment === 'sandbox' ? environment : 'prototype'",
  ], 'client settlement configuration boundary')
  mustContain(payment, [
    'paymentSettlementContext?: V14PaymentSettlementContext',
    '<SettlementInstructions',
    'Payment remains pending until MULTIVENT receives authoritative bank or processor confirmation.',
    'A screenshot or client-entered reference is not verification.',
  ], 'client payment settlement presentation')
  mustContain(refunds, [
    "supabase.rpc('get_my_client_refund_overview_v14')",
    "'pending_destination'",
    'historicalRecords',
  ], 'client refund tracking data boundary')
  mustContain(refundsScreen, [
    'Refunds & Disbursements',
    'PENDING EXTERNAL REFUNDS',
    'This is not an in-app cash balance.',
    'Historical records',
  ], 'client refund tracking presentation')
  mustContain(home, [
    "{ id: 'refunds', label: 'Refunds'",
  ], 'home refund entry point')
})

test('V14 Phase 6 records bank payout and refund operations without bypassing receivable holds', () => {
  const sourceMigration = read('database/90_v14_bank_payout_and_refund_operations.sql')
  const deployMigration = read('supabase/migrations/20261025000300_v14_bank_payout_and_refund_operations.sql')
  const app = read('src/App.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 payout/refund migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create table if not exists public.provider_payout_disbursements',
    "'approved', 'processing', 'completed', 'failed', 'cancelled'",
    'create table if not exists public.external_disbursement_audit_events',
    "'provider_payout', 'client_refund'",
    'create or replace function public.phase14_provider_payout_request_is_bank_eligible(',
    "public.phase11_event_local_date(allocation_row.timezone)",
    "public.phase11_has_refund_or_financial_hold",
    'create or replace function public.approve_v14_provider_bank_payout(',
    'create or replace function public.start_v14_provider_bank_payout(',
    'create or replace function public.complete_v14_provider_bank_payout(',
    'A bank or processor reference is required before completing a payout.',
    'create or replace function public.fail_v14_provider_bank_payout(',
    'create or replace function public.record_v14_refund_disbursement(',
    'The requested refund status transition is not allowed.',
    "public.has_permission('remittance.verify')",
  ], 'V14 bank payout and refund-operation backend')
  assert.doesNotMatch(
    sourceMigration,
    /update\s+public\.payments\s+set\s+status\s*=\s*'refunded'/i,
    'manual refund completion must not rewrite the original verified payment as a simulated refund'
  )
  mustContain(app, [
    "setToastMessage('Payout request submitted for review.')",
  ], 'provider payout request UI status copy')
})

test('V14 Phase 7 exposes permission-gated financial operations and preserves authoritative settlement states', () => {
  const sourceMigration = read('database/91_v14_admin_financial_operations.sql')
  const deployMigration = read('supabase/migrations/20261025000400_v14_admin_financial_operations.sql')
  const financialScreen = read('web/components/screens/financial-reporting-screen.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 financial-operations migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.notify_v14_payment_status_change()',
    "'Payment verified'",
    "'Event reservation confirmed'",
    "new.status not in ('verified', 'failed', 'cancelled')",
    'create or replace function public.process_phase11_payout_eligibility(',
    "'Payout available'",
    'create or replace function public.get_admin_v14_financial_operations()',
    "public.has_permission('cashflow.view')",
    "'awaitingProviderConfirmations'",
    "'paymentsPendingVerification'",
    "'pendingRefunds'",
    "'completedRefunds'",
    'individual transitions are still protected by remittance.verify',
    'does not introduce a payment deadline',
  ], 'V14 financial operations backend')
  assert.doesNotMatch(
    sourceMigration,
    /update\s+public\.payments\s+set\s+status\s*=\s*'refunded'/i,
    'financial operations must not simulate a completed client refund by overwriting the original payment'
  )
  mustContain(financialScreen, [
    "supabase.rpc('get_admin_v14_financial_operations')",
    "const canOperateFinancials = can('remittance.verify')",
    "supabase.rpc('verify_v14_payment_settlement'",
    "supabase.rpc('approve_v14_provider_bank_payout'",
    "supabase.rpc('complete_v14_provider_bank_payout'",
    "supabase.rpc('record_v14_refund_disbursement'",
    'Payment verification queue',
    'Booking and payment readiness',
    'Provider payout operations',
    'Client refund operations',
  ], 'web financial operations UI')
})

test('V14 settlement verification is retry-safe without rewriting a verified payment snapshot', () => {
  const sourceMigration = read('database/92_v14_settlement_verification_idempotency.sql')
  const deployMigration = read('supabase/migrations/20261025000500_v14_settlement_verification_idempotency.sql')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 settlement idempotency migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.verify_v14_payment_settlement(',
    "if payment_row.status = 'verified' then",
    "'alreadyVerified', true",
    'already verified with a different authoritative reference',
    "if payment_row.status = 'paid' then",
    'A response-lost or double-click retry with the same authoritative',
  ], 'V14 settlement retry safety')
})

test('V14 verified payments become protected receivables when acceptance preceded payment', () => {
  const sourceMigration = read('database/93_v14_verified_payment_receivable_hold.sql')
  const deployMigration = read('supabase/migrations/20261025000600_v14_verified_payment_receivable_hold.sql')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 pre-acceptance receivable migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.verify_v14_payment_settlement(',
    'perform public.hold_phase11_provider_receivable(payment_row.booking_id);',
    'perform public.hold_phase11_coordinator_receivable(',
    'same private custody helpers after the verified ledger row exists',
  ], 'V14 acceptance-before-payment receivable bridge')
})

test('V14 refunds are isolated to the affected payout allocation', () => {
  const sourceMigration = read('database/94_v14_refund_allocation_isolation.sql')
  const deployMigration = read('supabase/migrations/20261025000700_v14_refund_allocation_isolation.sql')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V14 refund-allocation isolation migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create or replace function public.create_v14_external_refund_obligation(',
    'from public.provider_payout_request_allocations allocation',
    'where allocation.financial_transaction_id = ledger_row.id',
    'Another booking',
    "refund_status_value text := 'pending_destination'",
  ], 'V14 refund allocation isolation')
  assert.doesNotMatch(
    sourceMigration,
    /where\s+request\.provider_id\s*=\s*ledger_row\.provider_id\s+and\s+request\.status/i,
    'refund eligibility must not treat another booking from the same provider as a payout against this ledger row'
  )
})

test('V15 Phase 1 makes catering formats informational and requires an explicit tasting preference', () => {
  const sourceMigration = read('database/95_v15_catering_preference.sql')
  const deployMigration = read('supabase/migrations/20261025000800_v15_catering_preference.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')
  const providerDetails = read('src/components/CategorySpecificServiceDetails.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V15 catering-preference migration must exactly match the reviewed database source'
  )
  mustContain(details, [
    'CATERING SERVICES OFFERED',
    'Would you like to have a food tasting?',
    "Yes, I&apos;d like a food tasting.",
    "No, I&apos;ll choose my menu directly.",
    'const [foodTastingPreference, setFoodTastingPreference] = React.useState<boolean>()',
    'foodTastingPreferenceRequired',
    'foodTastingMenuSelectionPending',
    'mealType: undefined',
  ], 'V15 Phase 1 client catering details')
  assert.doesNotMatch(details, /const mealTypes\s*=/,
    'catering formats must no longer be rendered as client booking choices')
  mustContain(providerDetails, [
    'Catering Formats Offered',
  ], 'V15 Phase 1 provider catering configuration')
  mustContain(planning, [
    "client.rpc('save_my_catering_service_selection_v15'",
    'target_food_tasting_preference: value.foodTastingPreference ?? null',
  ], 'V15 Phase 1 client selection persistence')
  mustContain(sourceMigration, [
    'add column if not exists food_tasting_preference boolean',
    'create or replace function public.save_my_catering_service_selection_v15(',
    'Choose whether you would like a food tasting.',
    'public.save_my_catering_service_selection_v10(',
    "'{foodTastingPreference}'",
    'sync_v15_booking_food_tasting_preference_trigger',
  ], 'V15 Phase 1 backend preference persistence')
})

test('V15 Phase 2 keeps preliminary tasting dishes separate from final catering prices', () => {
  const sourceMigration = read('database/96_v15_food_tasting_preliminary_menu.sql')
  const deployMigration = read('supabase/migrations/20261025000900_v15_food_tasting_preliminary_menu.sql')
  const providerDetails = read('src/components/CategorySpecificServiceDetails.tsx')
  const categoryDetails = read('src/lib/service-category-details.ts')
  const serviceDetails = read('src/screens/08-ServiceDetails.tsx')
  const planning = read('src/lib/planning.ts')
  const app = read('src/App.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V15 preliminary-tasting migration must exactly match the reviewed database source'
  )
  mustContain(providerDetails, [
    'Food tasting selections',
    'Final menu selections',
    'Food tasting limits are separate from the direct menu.',
  ], 'V15 Phase 2 provider course-limit configuration')
  mustContain(categoryDetails, [
    'tastingSelectionLimit?: number',
    'finalSelectionLimit?: number',
    'getCateringTastingMenu',
    'Food tasting requires an item-priced menu with course-level dish selections.',
  ], 'V15 Phase 2 shared catering-menu contract')
  mustContain(serviceDetails, [
    'Proposed Food Tasting Menu',
    'Select {section.tastingSelectionLimit}',
    'Final catering price will be confirmed after food tasting and menu finalization.',
    'toggleTastingMenuItem',
    'Submit Food Tasting Request',
    'onLoadFoodTastingDraft',
    'onSaveFoodTastingDraft',
  ], 'V15 Phase 2 client preliminary-menu UI and draft persistence')
  mustContain(planning, [
    "client.rpc('save_my_catering_tasting_draft_v15'",
    "client.rpc('load_my_catering_tasting_draft_v15'",
    'target_revision',
  ], 'V15 Phase 2 client draft RPC integration')
  mustContain(app, [
    'handleLoadCateringTastingDraft',
    'handleSaveCateringTastingDraft',
  ], 'V15 Phase 2 app-level tasting draft wiring')
  mustContain(sourceMigration, [
    'create table if not exists public.catering_food_tasting_drafts',
    'validate_v15_catering_tasting_course_rules',
    'build_v15_preliminary_tasting_menu',
    'save_my_catering_tasting_draft_v15',
    'load_my_catering_tasting_draft_v15',
    'selected_count > tasting_limit',
    'is_complete',
    'revision <= excluded.revision',
    'This table never represents a final menu, booking request, or payable price.',
  ], 'V15 Phase 2 server-side validation and non-financial draft persistence')
})

test('V15 Phase 3 ties provider acceptance to a seven-day food tasting schedule', () => {
  const sourceMigration = read('database/97_v15_food_tasting_acceptance_scheduling.sql')
  const deployMigration = read('supabase/migrations/20261025001000_v15_food_tasting_acceptance_scheduling.sql')
  const planning = read('src/lib/planning.ts')
  const merchant = read('src/lib/merchant.ts')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const providerDetails = read('src/screens/19.1-BookingRequest.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V15 food-tasting scheduling migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    'create table if not exists public.catering_food_tasting_workflows',
    'submit_my_catering_food_tasting_request_v15',
    'start_v15_food_tasting_scheduling_window',
    "scheduling_window_end_date = accepted_date + 7",
    'list_my_v15_catering_food_tasting_slots',
    'schedule_my_v15_catering_food_tasting',
    'protect_v15_food_tasting_appointments',
    'Final food tasting menu confirmation is required before payment.',
    'Food tasting appointment confirmed',
  ], 'V15 Phase 3 scheduling and payment safety')
  mustContain(planning, [
    "client.rpc('submit_my_catering_food_tasting_request_v15'",
    'foodTastingMenuItemIds',
  ], 'V15 Phase 3 preliminary-request submission')
  mustContain(merchant, [
    "'list_my_v15_catering_food_tasting_slots'",
    "'schedule_my_v15_catering_food_tasting'",
    "'list_my_catering_food_tasting_workflows_v15'",
    'CateringFoodTastingWorkflow',
  ], 'V15 Phase 3 client and provider workflow projections')
  mustContain(clientDetails, [
    'Food Tasting Schedule Required',
    'Choose Schedule',
    'Confirm Schedule',
  ], 'V15 Phase 3 client progress tracker and scheduling action')
  mustContain(providerDetails, [
    'Preliminary Food Tasting Menu',
    'Accept this request to let the client choose an available tasting schedule within seven days.',
    'Final price pending',
  ], 'V15 Phase 3 provider request review')
})

test('V15 Phase 4 enforces attendance, one reschedule, and an explicit direct-menu fallback', () => {
  const sourceMigration = read('database/98_v15_food_tasting_attendance_rescheduling.sql')
  const deployMigration = read('supabase/migrations/20261025001100_v15_food_tasting_attendance_rescheduling.sql')
  const merchant = read('src/lib/merchant.ts')
  const app = read('src/App.tsx')
  const clientDetails = read('src/screens/11.1-BookingDetails.tsx')
  const providerDetails = read('src/screens/19.1-BookingRequest.tsx')

  assert.equal(
    deployMigration,
    sourceMigration,
    'the deployed V15 attendance/rescheduling migration must exactly match the reviewed database source'
  )
  mustContain(sourceMigration, [
    "attendance_status text not null default 'not_required'",
    'reschedule_attempt_count integer not null default 0',
    'reschedule_extension_end_date date',
    'confirm_my_v15_food_tasting_attendance',
    'reschedule_my_v15_catering_food_tasting',
    'list_my_v15_catering_food_tasting_reschedule_slots',
    'activate_my_v15_food_tasting_direct_menu_fallback',
    'process_v15_food_tasting_deadlines',
    "'Food Tasting Tomorrow!'",
    "'Client Has Not Confirmed Attendance'",
    "'multivent-v15-food-tasting-deadlines'",
    "'11 * * * *'",
    'reschedule_attempt_count = 1',
    "fallback_enabled_at = coalesce(fallback_enabled_at, now())",
    'The fallback is explicit client action only.',
    "workflow.status = 'cancelled' and workflow.fallback_enabled_at is not null",
  ], 'V15 Phase 4 backend attendance, scheduler, and fallback safety')
  mustContain(merchant, [
    "'confirm_my_v15_food_tasting_attendance'",
    "'reschedule_my_v15_catering_food_tasting'",
    "'list_my_v15_catering_food_tasting_reschedule_slots'",
    "'activate_my_v15_food_tasting_direct_menu_fallback'",
    'CateringFoodTastingAttendanceStatus',
  ], 'V15 Phase 4 RPC client integration')
  mustContain(app, [
    'handleClientFoodTastingAttendance',
    'handleClientFoodTastingReschedule',
    'handleChooseFinalCateringMenu',
    'initialFoodTastingPreference',
  ], 'V15 Phase 4 app-level shared workflow actions')
  mustContain(clientDetails, [
    'Food Tasting Tomorrow',
    'Yes, I&apos;ll Attend',
    'Request Reschedule',
    'Reschedule Attempts Used: 1 of 1',
    'Choose Final Menu Instead',
    'Confirm Reschedule',
  ], 'V15 Phase 4 client attendance and fallback UI')
  mustContain(providerDetails, [
    'Client Has Not Confirmed Attendance',
    'Message Client',
    'requestForService(request, service)',
  ], 'V15 Phase 4 provider follow-up through existing messaging')
})

test('V15 Phase 6 keeps direct and tasting final menus in one booking-safe structure', () => {
  const migration = read('supabase/migrations/20261026000200_v15_direct_menu_integration.sql')
  const clientBookings = read('src/lib/merchant.ts')
  const bookingDetails = read('src/screens/11.1-BookingDetails.tsx')

  mustContain(migration, [
    'final_menu_snapshot',
    'v15_direct_catering_final_menu_snapshot',
    "'source', 'direct_selection'",
    "'source', 'food_tasting'",
    'sync_v15_direct_catering_final_menu_snapshot',
    'sync_v15_confirmed_tasting_final_menu_snapshot',
    'does not alter\n-- payments, provider acceptance, historical booking values, or payout logic',
  ], 'V15 Phase 6 canonical final-menu snapshots')
  mustContain(clientBookings, [
    'final_menu_snapshot',
    'const finalCateringMenu = finalCateringMenuFrom(record.final_menu_snapshot)',
    'finalCateringMenu,',
  ], 'V15 Phase 6 booking projection')
  mustContain(bookingDetails, [
    'Selected catering menu',
    'Final Menu Ready for Review',
    'Final Menu Confirmed',
  ], 'V15 Phase 6 client booking visibility and progress states')
})

test('V15 Phase 7 keeps Venue + Catering packages inclusive and single-booking', () => {
  const packageMigration = read('supabase/migrations/20261026000300_v15_venue_catering_packages.sql')
  const selectionMigration = read('supabase/migrations/20261026000400_v15_venue_catering_selection.sql')
  const planning = read('src/lib/planning.ts')
  const serviceDetails = read('src/screens/08-ServiceDetails.tsx')

  mustContain(packageMigration, [
    'venue_catering_package_details',
    'provider_save_v15_venue_catering_package',
    "'inclusive_fixed'",
    'one booking and one payable obligation',
  ], 'V15 Phase 7 provider package ownership and inclusive price policy')
  mustContain(selectionMigration, [
    'save_my_v15_venue_catering_package_selection',
    'submit_my_v15_venue_catering_food_tasting_request',
    'one venue-hosted selection and one provider request',
    'sync_v15_combined_package_final_menu_price',
  ], 'V15 Phase 7 single booking and fixed package price enforcement')
  mustContain(planning, [
    "'save_my_v15_venue_catering_package_selection'",
    "'submit_my_v15_venue_catering_food_tasting_request'",
  ], 'V15 Phase 7 client selection routing')
  mustContain(serviceDetails, [
    'Venue + Catering included',
    'isVenueCateringPackage',
    'combinedCateringServiceId',
  ], 'V15 Phase 7 venue-screen embedded catering configuration')
})

test('V15 Phase 8 makes inclusive catering visible without creating a standalone booking', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const marketplace = read('src/screens/06-CategoryBrowse.tsx')
  const bookings = read('src/screens/11.1-BookingDetails.tsx')
  const bookingProjection = read('src/lib/merchant.ts')

  mustContain(planning, [
    'package_snapshot',
    'includesCatering',
    'packageSnapshot.venueCateringPackage === true',
  ], 'V15 Phase 8 package-awareness projection')
  mustContain(app, [
    'venueCateringPackageSelection',
    "ids.add('catering')",
    'venueCateringPackageAllocatedBudget',
    'includesCatering: Boolean(value.venueCateringPackageId)',
  ], 'V15 Phase 8 progress and budget accounting')
  mustContain(marketplace, [
    'Catering Already Included',
    'CONTINUE BROWSING',
    'REVIEW VENUE PACKAGE',
    'Included in Venue Package',
    'counted once:',
    'Over by',
    'if (isExploreMode || !cateringIncludedInVenuePackage || !isCateringCategory)',
  ], 'V15 Phase 8 marketplace warning and one-time total')
  mustContain(bookingProjection, [
    "source === 'venue_catering_package'",
    'isVenueCateringPackage',
  ], 'V15 Phase 8 combined booking projection')
  mustContain(bookings, [
    'Venue + Catering package · Catering is included in this one booking.',
    'Venue + Catering package menu',
  ], 'V15 Phase 8 combined booking progress')
})

test('V15 menu-driven catering keeps legacy style validation without blocking a selected menu', () => {
  const migration = read('supabase/migrations/20261026000500_v15_catering_style_compatibility.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(migration, [
    'nullif(trim(new.meal_type), \'\') is not null',
    "new.meal_type = any(coalesce(available_types, '{}'::text[]))",
    'V15 menu-driven flow',
  ], 'V15 catering style compatibility')
  mustContain(details, [
    "mealType: undefined",
    'Choose one provider menu and pricing option.',
  ], 'V15 client menu selection')
})

test('food tasting schedules only for catering after the V15 provider-acceptance gate', () => {
  const bookingProjection = read('src/lib/merchant.ts')
  const bookingDetails = read('src/screens/11.1-BookingDetails.tsx')

  mustContain(bookingProjection, [
    'const isCateringService = /cater/i.test(categoryName)',
    'const hasCateringComponent = isCateringService || isVenueCateringPackage',
    'foodTastingEnabled: isCateringService',
    'foodTastingWorkflow: hasCateringComponent',
  ], 'food tasting booking projection')
  mustContain(bookingDetails, [
    "service.foodTastingWorkflow?.status !== 'scheduling_required'",
    'isLegacyCateringTasting(service)',
    'isFoodTastingRelevant(service)',
  ], 'food tasting client schedule gate')
})
