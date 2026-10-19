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

test('provider-created catering packages remain fixed event totals', () => {
  const migration = read('supabase/migrations/20261017000400_catering_provider_package_fixed_total.sql')
  const details = read('src/screens/08-ServiceDetails.tsx')

  mustContain(migration, [
    'rename to calculate_event_service_quote_standard',
    "category_key is distinct from 'catering'",
    "'provider_package_fixed_total'",
    'A selected provider catering package is always a fixed event total',
    'provider_amount := round(coalesce(package_row.package_price, 0), 2);',
  ], 'provider catering package fixed-total migration')
  mustContain(details, [
    'usesSelectedProviderPackage',
    'Provider package · fixed total for the event',
    "pricingUnit: 'event'",
  ], 'client provider-package selection')
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

test('client home can safely remove drafts and collapses bookings to the next three events', () => {
  const planning = read('src/lib/planning.ts')
  const home = read('src/screens/03-ClientHome.tsx')
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
    'Delete Draft',
    'draftPendingDeletion',
  ], 'client home draft and booking controls')
  mustContain(app, [
    'deleteClientEventDraft',
    'onDeleteDraft={deleteClientDraft}',
  ], 'client-home draft deletion integration')
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

test('coordinator choice is available only with a positive Event Organizer allocation', () => {
  const app = read('src/App.tsx')
  const budgetScreen = read('src/screens/05-BudgetAllocation.tsx')
  const choice = read('src/screens/05.1-CoordinatorChoice.tsx')
  const details = read('src/screens/06.1-CoordinatorDetails.tsx')
  const migration = read('database/68_conditional_event_coordinator_step.sql')

  mustContain(app, [
    "allocation.categoryKey === 'eventOrganizer' && allocation.amount > 0",
    'const planningServiceCategories',
    'if (hasCoordinatorAllocation && coordinatorPreference',
    "setScreen('coordinatorChoice')",
    'coordinatorBookingEnabled={hasEventOrganizerBudget}',
    'confirmDestructiveAction',
    'Remove coordinator booking?',
  ], 'conditional coordinator flow')
  mustContain(budgetScreen, [
    'onRemoveCommittedCoordinator',
    'REMOVE COORDINATOR FIRST',
  ], 'coordinator budget removal safeguard')
  mustContain(choice, [
    'enabled = true',
    'if (!enabled) return null',
  ], 'conditional coordinator choice screen')
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
    'getActivePlanningCategories(budgetAllocations)',
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

test('client home uses live eligible services, resumable drafts, and booking progress', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const home = read('src/screens/03-ClientHome.tsx')
  const recommendations = read('src/lib/home-recommendations.ts')

  mustContain(app, [
    'fetchClientEventDrafts()',
    'createClientEventDraft()',
    'resumeClientEventDraft(draftId)',
    'rankHomeRecommendations(catalogServices)',
    'getClientBookingProgress(clientBookings)',
    'client-event-progress-',
  ], 'client home data integration')
  mustContain(planning, [
    "event_service_selections(status)",
    ".in('status', ['draft', 'planning'])",
    "order('updated_at', { ascending: false })",
    'activePlanningEventId',
  ], 'draft persistence integration')
  mustContain(home, [
    'draftEvents = []',
    'recommendations = []',
    'draftEvents.slice(0, 1)',
    'Expand Drafts',
    'getClientBookingProgress',
    'YOUR EVENT BOOKINGS',
    'onOpenBookingProgress',
    'formatServicePrice(recommendation.service)',
    'recommendation.service.reviewCount',
    'No saved drafts yet',
  ], 'client home live UI')
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
    'TOTAL SERVICE AMOUNT',
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
    'TOTAL EVENT SERVICE CHARGES',
    'RECORDED SERVICE PAYMENTS',
    'TOTAL REMAINING BALANCE',
    'All Provider Balances Cleared',
    'MULTIVENT platform fees, held funds, and provider payouts',
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
    "service.booked && ['confirmed', 'completed'].includes(service.status)",
  ], 'coordinator messaging entry points')
  mustContain(app, [
    "setMessageWorkspace('coordinator')",
    'openCoordinatorProviderConversation(service.bookingId)',
    'coordinatorEvents={messageWorkspace === \'coordinator\' ? coordinatorDashboard.events : []}',
  ], 'coordinator messaging navigation')
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
    "details.eventType === 'wedding' && details.isChurchWedding === true",
    'isChurchWedding: event.is_church_wedding === true',
  ], 'church wedding draft persistence')
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
  mustContain(controls, [
    'export const ChurchLocationMap',
    'const center = interactive',
    'Tap to place the church pin',
    'openstreetmap.org',
    'export const ChurchDatePickerModal',
    'This date matches the configured event schedule.',
    'export const ChurchTimePickerModal',
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
    '<ChurchDatePickerModal',
    '<ChurchTimePickerModal',
    'Use Address Only',
    '{showLocationPicker ? (',
    'The ceremony date must match the configured event date:',
  ], 'coordinator church picker UI')
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
    'Provider Downpayments (30%, held until acceptance)',
    'Remaining 70% paid directly to providers',
    'Pay 35% Downpayment',
    'Pay in Full',
    'Coming later',
    'disabled={disabled}',
  ], 'current downpayment and future full-payment client UI')
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
    'View client request and payment',
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

test('mobile sessions persist and push alerts keep business details inside Supabase', () => {
  const migration = read(migrations[10])
  const hardening = read(migrations[11])
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
  assert.doesNotMatch(
    migration,
    /'title',\s*new\.title|'body',\s*new\.body|'resourceId'|'resourceType'/,
    'the external push transport must not receive notification business details'
  )
  mustContain(notifications, [
    'Notifications.getExpoPushTokenAsync({ projectId })',
    "supabase.rpc('register_my_push_token'",
    "supabase.rpc('revoke_my_push_token'",
  ], 'native push registration')
  mustContain(app, [
    'supabase.auth.getSession()',
    'Notifications.addNotificationReceivedListener',
    'Notifications.addNotificationResponseReceivedListener',
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

test('checkout advances after a recorded payment and retries do not duplicate it', () => {
  const app = read('src/App.tsx')
  const planning = read('src/lib/planning.ts')
  const migration = read('supabase/migrations/20261018000400_payment_checkout_idempotency.sql')
  const confirmedMessaging = read('supabase/migrations/20261017000600_phase1_confirmed_booking_messaging.sql')
  const checkoutStart = planning.indexOf('export const savePlanningPayment')
  const checkoutEnd = planning.indexOf('export const assignCoordinatorToEvent')
  const checkout = planning.slice(checkoutStart, checkoutEnd)

  mustContain(app, [
    'paymentSubmissionInFlight',
    "setScreen('confirmation')",
    'void refreshLiveData().catch(() => undefined)',
  ], 'checkout success transition')
  assert.ok(
    app.indexOf("setScreen('confirmation')") < app.indexOf('void refreshLiveData().catch(() => undefined)'),
    'The receipt must not wait for the non-critical workspace refresh.'
  )
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
    "onBack={messageWorkspace === 'coordinator' ? () => setScreen('coordinatorHome') : undefined}",
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
