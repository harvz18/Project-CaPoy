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

test('category budget edits, locks, removal, replacement, and checkout validation share one contract', () => {
  const budgets = read(migrations[5])
  const selection = read(migrations[7])
  const planning = read('src/lib/planning.ts')

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
  mustContain(planning, [
    "client.rpc('save_my_event_budget_allocations_phase9'",
    "client.rpc('set_my_category_budget_allocation'",
    "'validate_my_phase9_selections'",
    "client.rpc('save_my_event_service_selection'",
    ".from('event_service_selections')",
    ".delete()",
  ], 'client planning integration')
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

test('payment, held funds, individual decisions, balances, and payouts remain separated', () => {
  const payment = read(migrations[3])
  const acceptance = read(migrations[4])
  const pricing = read('src/lib/pricing.ts')
  const planning = read('src/lib/planning.ts')
  const merchant = read('src/lib/merchant.ts')

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
  mustContain(pricing, [
    'DEFAULT_COMMISSION_RATE = 0.05',
    'DEFAULT_INITIAL_PAYMENT_RATE = 0.4',
    'DEFAULT_PROVIDER_INITIAL_RATE = 0.3',
  ], 'frontend pricing contract')
  mustContain(planning, [
    "financial_terms_version: 'phase5-v1'",
    "accountingVersion: 'phase5-v1'",
    "status: 'paid'",
  ], 'client payment integration')
  mustContain(merchant, [
    "context.client.rpc('respond_to_provider_booking'",
    "context.client.rpc('get_my_provider_payment_confirmations')",
    "context.client.rpc('request_my_provider_payout'",
  ], 'provider financial integration')
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
