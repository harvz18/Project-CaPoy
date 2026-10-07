import { supabase, supabaseConfig } from './supabase'
import { CatalogService } from './catalog'
import {
  calculatePaymentBreakdown,
  commissionFromProviderPrice,
  customerPriceFromProviderPrice,
  DEFAULT_INITIAL_PAYMENT_RATE,
  DEFAULT_PROVIDER_INITIAL_RATE,
  normalizeCommissionRate,
} from './pricing'
import type { SubmitReviewValue } from '../screens'
import type { EventFeedbackValue } from '../screens/15.1-EventFeedback'
import type { InstructionModuleValue } from '../screens/10-InstructionModule'
import type {
  EventCreationValue,
  EventType,
  VenueStatus,
} from '../screens/04-EventCreation'
import type { CateringPricingOption, VenueBookingOption } from './service-category-details'
import type {
  BudgetPriority,
  CategoryBudgetAllocation,
} from '../screens/05-BudgetAllocation'

type PlanningResult = {
  bookingId?: string
  calculatedAmount?: number
  conflictCount?: number
  conflicts?: Array<{
    categoryKey: string
    currentService: string
    replacementService: string
  }>
  ok: boolean
  message?: string
  providers?: Array<{
    available: boolean
    category?: string
    dateTime: string
    id: string
    message?: string
    name: string
    serviceName?: string
  }>
  providerAmount?: number
  requiresConfirmation?: boolean
  replacedSelectionId?: string
  selectionId?: string
  status?: 'available' | 'conflict'
}

type BudgetPlanInput = {
  allocations: CategoryBudgetAllocation[]
  budget: number
  priorities: BudgetPriority[]
}

type EventDraftInput = {
  date: string
  eventName: string
  eventType: string
  guestCount: number
  time: string
  venueAddress?: string
  venueName?: string
  venueStatus: string
}

type ServiceSelectionInput = {
  attendeeCount: number
  budgetPerHead: number
  cateringOption?: CateringPricingOption
  estimatedTotal: number
  mealType?: string
  notes: string
  service: CatalogService
  venueBookedHours?: number
  venueOption?: VenueBookingOption
}

export type ClientPlanningState = {
  assignedCoordinator?: {
    avatarUrl: string
    commissionAmount: number
    commissionRate: number
    id: string
    name: string
    price: number
    providerPrice: number
    status: 'accepted' | 'pending'
  }
  coordinatorAssignmentStatus?: 'accepted' | 'pending' | 'awaiting_assignment'
  coordinatorBudgetCost?: number
  coordinatorPreference?: 'undecided' | 'skipped' | 'selected'
  coordinatorPackage?: {
    id: string
    name: string
    serviceSubtotal: number
  }
  budgetAllocations?: CategoryBudgetAllocation[]
  budgetPriorities?: BudgetPriority[]
  event?: EventCreationValue
  draftSummary?: ClientEventDraftSummary
  lastPayment?: {
    amount: number
    method: 'bankTransfer' | 'eWallet'
    paymentType: 'deposit' | 'full'
    termsAccepted: boolean
  }
  maxPlanningStep?: number
  scheduleProviders?: Array<{
    available: boolean
    category?: string
    dateTime: string
    id: string
    message?: string
    name: string
    serviceName?: string
  }>
  selectedServices: Array<{
    category: string
    commissionAmount: number
    commissionRate: number
    detail: string
    id: string
    imageLabel: string
    imageUrl: string
    name: string
    price: number
    providerPrice: number
    status: string
  }>
  totalBudget?: number
}

export type ClientEventDraftSummary = {
  completedSteps: number
  eventDate: string
  id: string
  location: string
  name: string
  nextStep: string
  progressPercent: number
  status: 'draft' | 'planning'
  totalSteps: number
  updatedAt: string
}

export const calculateServiceQuote = async ({
  optionId,
  packageId,
  quantity,
  serviceId,
}: {
  optionId?: string
  packageId?: string
  quantity?: number
  serviceId: string
}): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()
    if (!client || !event || !isUuid(serviceId)) {
      return { ok: false, message: 'Choose a published service to calculate its event price.' }
    }
    const { data, error } = await client.rpc('calculate_event_service_quote', {
      target_event_id: event.eventId,
      target_option_id: optionId ?? null,
      target_package_id: packageId && isUuid(packageId) ? packageId : null,
      target_quantity: quantity ?? null,
      target_service_id: serviceId,
    })
    if (error) return { ok: false, message: error.message }
    const quote = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      calculatedAmount: Number(quote.customerAmount ?? 0),
      ok: true,
      providerAmount: Number(quote.providerAmount ?? 0),
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

const defaultEventName = 'My Event Plan'

const priorityLabels: Record<string, string> = {
  catering: 'Catering',
  eventOrganizer: 'Event Organizer',
  floral: 'Floral',
  gownRental: 'Gown Rental',
  hostEmcee: 'Host/Emcee',
  photoVideo: 'Photo/Video',
  soundLights: 'Sound & Lights',
  venue: 'Venue',
}

const priorityFromLabel: Record<string, BudgetPriority> = Object.entries(priorityLabels).reduce(
  (result, [priority, label]) => ({
    ...result,
    [label.toLowerCase()]: priority as BudgetPriority,
  }),
  {} as Record<string, BudgetPriority>
)

const getClient = () => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return null
  }

  return supabase
}

const toMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : ''

  if (message.toLowerCase().includes('row-level security policy')) {
    return 'Booking access needs a Supabase database update. Apply database/08_client_booking_rls_repair.sql, then try again.'
  }

  if (
    message.toLowerCase().includes('infinite recursion') &&
    message.toLowerCase().includes('bookings')
  ) {
    return 'Booking security policies need an update. Apply database/11_booking_rls_recursion_repair.sql, then try again.'
  }

  return message || 'Unable to save planning data.'
}

const parseDate = (value?: string) => {
  if (!value) return null

  const trimmed = value.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) return trimmed

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!slashMatch) return null

  const [, month, day, year] = slashMatch
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const parseTime = (value?: string) => {
  if (!value) return null

  const trimmed = value.trim().toUpperCase()
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/.exec(trimmed)
  if (!match) return null

  const [, hourText, minuteText = '00', meridiem] = match
  let hour = Number(hourText)
  const minute = Number(minuteText)

  if (hour > 23 || minute > 59) return null
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

const isUuid = (value?: string) =>
  Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  )

const getCurrentUserId = async () => {
  const client = getClient()

  if (!client) {
    return null
  }

  const { data } = await client.auth.getUser()

  return data.user?.id ?? null
}

const paymentMethodFrom = (value: unknown): 'bankTransfer' | 'eWallet' => {
  if (value === 'bankTransfer') return value
  return 'eWallet'
}

export const fetchClientPlanningState = async (): Promise<ClientPlanningState> => {
  const client = getClient()
  const userId = await getCurrentUserId()

  if (!client || !userId) return { selectedServices: [] }

  const { data: event } = await client
    .from('events')
    .select(
      'id, coordinator_id, pending_coordinator_id, coordinator_assignment_status, coordinator_preference, coordinator_fee_amount, name, event_type, event_date, event_time, guest_count, total_budget, venue_status, venue, location, status, updated_at'
    )
    .eq('client_id', userId)
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!event?.id) return { selectedServices: [] }

  const visibleCoordinatorId =
    event.coordinator_assignment_status === 'pending'
      ? event.pending_coordinator_id
      : event.coordinator_id
  const [{ data: coordinatorRows }, { data: configuredCommissionRate }] = await Promise.all([
    visibleCoordinatorId
      ? client.rpc('list_bookable_event_coordinators', { target_event_id: event.id })
      : Promise.resolve({ data: [] }),
    client.rpc('get_public_commission_rate'),
  ])
  const assignedCoordinatorRow = Array.isArray(coordinatorRows)
    ? coordinatorRows.find((row) => row?.id === visibleCoordinatorId)
    : undefined
  const coordinatorCommissionRate = normalizeCommissionRate(configuredCommissionRate)
  const coordinatorProviderPrice = Number(event.coordinator_fee_amount ?? 0)
  const coordinatorCommissionAmount = commissionFromProviderPrice(
    coordinatorProviderPrice,
    coordinatorCommissionRate
  )

  const [
    { data: selections },
    { data: payments },
    { data: scheduleChecks },
    { data: coordinatorPackageRows },
    { data: budgetItems },
  ] = await Promise.all([
    client
      .from('event_service_selections')
      .select(
        'id, service_id, service_name, category_name, estimated_amount, attendee_count, catering_option_name, venue_option_name, venue_booked_hours, status, updated_at, selected_provider_snapshot, services(cover_image_url)'
      )
      .eq('event_id', event.id)
      .not('status', 'in', '(declined,cancelled)')
      .order('created_at', { ascending: true }),
    client
      .from('payments')
      .select('amount, provider, status, metadata, created_at')
      .eq('event_id', event.id)
      .in('status', ['paid', 'verified'])
      .order('created_at', { ascending: false })
      .limit(1),
    client
      .from('event_schedule_checks')
      .select('id, status, checked_at, requested_start_at')
      .eq('event_id', event.id)
      .order('checked_at', { ascending: false })
      .limit(1),
    client
      .from('event_coordinator_package_selections')
      .select('package_id, package_name, service_subtotal')
      .eq('event_id', event.id)
      .limit(1),
    client
      .from('event_budget_items')
      .select(
        'category_key, label, allocated_amount, estimated_amount, priority_rank, is_priority, allocation_version, is_selection_locked'
      )
      .eq('event_id', event.id)
      .order('priority_rank', { ascending: true }),
  ])

  const latestPayment = (selections ?? []).length > 0 ? payments?.[0] : undefined
  const latestScheduleCheck = scheduleChecks?.[0]
  const latestSelectionUpdate = Math.max(
    ...(selections ?? []).map((selection) => new Date(selection.updated_at).getTime())
  )
  const expectedStartAt =
    event.event_date && event.event_time
      ? new Date(`${event.event_date}T${String(event.event_time).slice(0, 8)}+08:00`).getTime()
      : Number.NaN
  const checkedStartAt = latestScheduleCheck?.requested_start_at
    ? new Date(latestScheduleCheck.requested_start_at).getTime()
    : Number.NaN
  const scheduleCheckIsCurrent = Boolean(
    (selections ?? []).length > 0 &&
      latestScheduleCheck?.checked_at &&
      new Date(latestScheduleCheck.checked_at).getTime() >= latestSelectionUpdate &&
      Number.isFinite(expectedStartAt) &&
      Number.isFinite(checkedStartAt) &&
      Math.abs(expectedStartAt - checkedStartAt) < 60_000
  )
  const { data: savedScheduleResults } =
    scheduleCheckIsCurrent && latestScheduleCheck?.id
      ? await client
          .from('event_schedule_check_results')
          .select(
            'selection_id, provider_id, service_id, provider_name, requested_start_at, is_available, conflict_reason, event_service_selections(service_name, category_name)'
          )
          .eq('schedule_check_id', latestScheduleCheck.id)
      : { data: [] }
  const paymentMetadata =
    latestPayment?.metadata && typeof latestPayment.metadata === 'object'
      ? (latestPayment.metadata as Record<string, unknown>)
      : {}
  const inferredMaxPlanningStep = latestPayment
    ? 5
    : scheduleCheckIsCurrent && latestScheduleCheck?.status === 'available'
      ? 5
      : scheduleCheckIsCurrent && latestScheduleCheck
        ? 4
        : (selections ?? []).length > 0
          ? 3
          : Number(event.total_budget ?? 0) > 0
            ? 3
            : event.event_date
              ? 2
              : 1
  const completedSteps = latestPayment ? 5 : Math.max(0, inferredMaxPlanningStep - 1)
  const nextStepLabels = [
    'Add event details',
    'Set your budget',
    'Choose services',
    'Review schedule',
    'Complete payment',
  ]
  const phase7BudgetItems = (budgetItems ?? []).filter(
    (item) => item.allocation_version === 'phase7-v1' && item.category_key
  )
  const savedBudgetPriorities = (budgetItems ?? [])
    .filter((item) => item.is_priority)
    .map((item) => {
      const categoryKey = String(item.category_key ?? '') as BudgetPriority
      if (categoryKey in priorityLabels) return categoryKey
      return priorityFromLabel[String(item.label ?? '').toLowerCase()]
    })
    .filter((priority): priority is BudgetPriority => Boolean(priority))
    .slice(0, 3)

  return {
    budgetAllocations: phase7BudgetItems.map((item) => ({
      amount: Number(item.allocated_amount ?? item.estimated_amount ?? 0),
      categoryKey: item.category_key as BudgetPriority,
      label: String(item.label ?? priorityLabels[item.category_key] ?? 'Service'),
      locked: item.is_selection_locked === true,
    })),
    budgetPriorities: savedBudgetPriorities,
    coordinatorBudgetCost:
      visibleCoordinatorId && coordinatorProviderPrice > 0
        ? customerPriceFromProviderPrice(
            coordinatorProviderPrice,
            coordinatorCommissionRate
          )
        : 0,
    coordinatorPackage: coordinatorPackageRows?.[0]
      ? {
          id: String(coordinatorPackageRows[0].package_id ?? ''),
          name: String(coordinatorPackageRows[0].package_name ?? 'Coordinator package'),
          serviceSubtotal: Number(coordinatorPackageRows[0].service_subtotal ?? 0),
        }
      : undefined,
    coordinatorAssignmentStatus: ['accepted', 'pending', 'awaiting_assignment'].includes(
      String(event.coordinator_assignment_status)
    )
      ? (event.coordinator_assignment_status as 'accepted' | 'pending' | 'awaiting_assignment')
      : undefined,
    coordinatorPreference: ['undecided', 'skipped', 'selected'].includes(
      String(event.coordinator_preference)
    )
      ? (event.coordinator_preference as 'undecided' | 'skipped' | 'selected')
      : 'undecided',
    assignedCoordinator: assignedCoordinatorRow
      ? {
          avatarUrl:
            typeof assignedCoordinatorRow.avatar_url === 'string'
              ? assignedCoordinatorRow.avatar_url
              : '',
          commissionAmount: coordinatorCommissionAmount,
          commissionRate: coordinatorCommissionRate,
          id: `coordinator:${assignedCoordinatorRow.id}`,
          name:
            typeof assignedCoordinatorRow.full_name === 'string'
              ? assignedCoordinatorRow.full_name
              : 'Event Coordinator',
          price: customerPriceFromProviderPrice(
            coordinatorProviderPrice,
            coordinatorCommissionRate
          ),
          providerPrice: coordinatorProviderPrice,
          status:
            event.coordinator_assignment_status === 'pending' ? 'pending' : 'accepted',
        }
      : undefined,
    event: {
      date: event.event_date ?? '',
      eventName: event.name ?? defaultEventName,
      eventType: ['wedding', 'preWedding', 'postWedding'].includes(event.event_type)
        ? (event.event_type as EventType)
        : 'wedding',
      guestCount: Number(event.guest_count ?? 0),
      time: event.event_time ?? '',
      venueAddress: event.location ?? '',
      venueName: event.venue ?? '',
      venueStatus: ['secured', 'searching'].includes(event.venue_status)
        ? (event.venue_status as VenueStatus)
        : 'searching',
    },
    draftSummary:
      event.status === 'draft' || event.status === 'planning'
        ? {
            completedSteps,
            eventDate: event.event_date ?? '',
            id: event.id,
            location: event.venue || event.location || '',
            name: event.name || defaultEventName,
            nextStep:
              completedSteps >= 5
                ? 'Review your event plan'
                : nextStepLabels[completedSteps] ?? 'Continue planning',
            progressPercent: Math.round((completedSteps / 5) * 100),
            status: event.status,
            totalSteps: 5,
            updatedAt: event.updated_at ?? '',
          }
        : undefined,
    lastPayment: latestPayment
      ? {
          amount: Number(latestPayment.amount ?? 0),
          method: paymentMethodFrom(latestPayment.provider),
          paymentType: paymentMetadata.paymentType === 'full' ? 'full' : 'deposit',
          termsAccepted: paymentMetadata.termsAccepted === true,
        }
      : undefined,
    maxPlanningStep: inferredMaxPlanningStep,
    scheduleProviders: (savedScheduleResults ?? []).map((result) => {
      const selection = Array.isArray(result.event_service_selections)
        ? result.event_service_selections[0]
        : result.event_service_selections

      return {
        available: result.is_available === true,
        category: selection?.category_name ?? 'Service',
        dateTime: formatScheduleDateTime(result.requested_start_at),
        id: result.selection_id ?? `${result.provider_id}-${result.service_id}`,
        message: result.conflict_reason ?? undefined,
        name: result.provider_name ?? 'Service provider',
        serviceName: selection?.service_name ?? 'Selected service',
      }
    }),
    selectedServices: (selections ?? []).map((selection) => {
      const snapshot =
        selection.selected_provider_snapshot &&
        typeof selection.selected_provider_snapshot === 'object'
          ? (selection.selected_provider_snapshot as Record<string, unknown>)
          : {}
      const service = Array.isArray(selection.services)
        ? selection.services[0]
        : selection.services
      const name = selection.service_name || 'Selected service'

      return {
        category: selection.category_name || 'SERVICE',
        commissionAmount: Number(snapshot.commissionAmount ?? 0),
        commissionRate: Number(snapshot.commissionRate ?? 0),
        detail: selection.venue_option_name
          ? `${selection.venue_option_name} · ${selection.venue_booked_hours ?? 0} hours`
          : selection.catering_option_name
          ? `${selection.catering_option_name} · ${selection.attendee_count ?? 0} Guests`
          : selection.attendee_count
            ? `${selection.attendee_count} Guests`
          : selection.category_name || 'Service',
        id:
          typeof snapshot.mockServiceId === 'string'
            ? snapshot.mockServiceId
            : selection.service_id || selection.id,
        imageLabel: name,
        imageUrl: service?.cover_image_url || '',
        name,
        price: Number(selection.estimated_amount ?? 0),
        providerPrice: Number(snapshot.providerAmount ?? selection.estimated_amount ?? 0),
        status:
          selection.status === 'confirmed'
            ? 'Confirmed'
            : selection.status === 'requested'
              ? 'Requested'
              : selection.status === 'declined'
                ? 'Declined'
                : 'Selected',
      }
    }),
    totalBudget: Number(event.total_budget ?? 0),
  }
}

const toEventPayload = (budget?: number, details?: EventDraftInput) => {
  const payload: Record<string, unknown> = {
    status: 'planning',
    updated_at: new Date().toISOString(),
  }

  if (budget !== undefined) {
    payload.total_budget = budget
  }

  if (details) {
    const eventDate = parseDate(details.date)
    const eventTime = parseTime(details.time)

    payload.name = details.eventName.trim() || defaultEventName
    payload.event_type = details.eventType
    payload.guest_count = details.guestCount
    payload.venue = details.venueStatus === 'secured' ? details.venueName?.trim() || null : null
    payload.location = details.venueStatus === 'secured' ? details.venueAddress?.trim() || null : null
    payload.venue_status = details.venueStatus

    if (eventDate) payload.event_date = eventDate
    if (eventTime) payload.event_time = eventTime
  }

  return payload
}

const ensureDraftEvent = async (budget?: number, details?: EventDraftInput) => {
  const client = getClient()

  if (!client) {
    throw new Error('Supabase is not configured. Check the app environment settings.')
  }

  const { data: userData, error: userError } = await client.auth.getUser()
  const user = userData.user

  if (userError || !user) {
    throw new Error('Your session expired. Sign in again with your client account.')
  }

  const userId = user.id
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, default_role')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(`Unable to load your client profile: ${profileError.message}`)
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const accountRole = String(profile?.default_role ?? metadata.default_role ?? 'client')

  if (accountRole === 'service_provider') {
    throw new Error('Sign in with a client account to add services to an event plan.')
  }

  if (!profile?.id) {
    const metadataName =
      typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : user.email?.split('@')[0] ?? 'Client'
    const { error: createProfileError } = await client.from('profiles').upsert({
      account_status: 'active',
      default_role: 'client',
      email: user.email ?? '',
      full_name: metadataName,
      id: userId,
      phone: typeof metadata.phone === 'string' ? metadata.phone : null,
      updated_at: new Date().toISOString(),
    })

    if (createProfileError) {
      throw new Error(`Unable to prepare your client profile: ${createProfileError.message}`)
    }
  }

  const { data: existing, error: existingError } = await client
    .from('events')
    .select('id')
    .eq('client_id', userId)
    .in('status', ['draft', 'planning'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Unable to load your event plan: ${existingError.message}`)
  }

  if (existing?.id) {
    const { error: updateError } = await client
      .from('events')
      .update(toEventPayload(budget, details))
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Unable to update your event plan: ${updateError.message}`)
    }

    return { eventId: existing.id as string, userId }
  }

  const { data: created, error } = await client
    .from('events')
    .insert({
      client_id: userId,
      name: defaultEventName,
      ...toEventPayload(budget, details),
    })
    .select('id')
    .single()

  if (error || !created?.id) {
    throw new Error(`Unable to create your event plan: ${error?.message ?? 'No event was returned.'}`)
  }

  return { eventId: created.id as string, userId }
}

export const closeCurrentEventDraft = async (): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const userId = await getCurrentUserId()

    if (!client || !userId) {
      return { ok: false, message: 'Sign in with your client account to start a new event.' }
    }

    const { data: currentDrafts, error: loadError } = await client
      .from('events')
      .select('id, coordinator_id, pending_coordinator_id')
      .eq('client_id', userId)
      .in('status', ['draft', 'planning'])
      .order('updated_at', { ascending: false })

    if (loadError) {
      throw new Error(`Unable to load your current draft: ${loadError.message}`)
    }

    if (!currentDrafts?.length) return { ok: true }

    for (const draft of currentDrafts) {
      if (!draft.coordinator_id && !draft.pending_coordinator_id) continue

      const { error: coordinatorError } = await client.rpc('remove_event_coordinator', {
        target_event_id: draft.id,
      })

      if (coordinatorError) {
        throw new Error(`Unable to release the assigned coordinator: ${coordinatorError.message}`)
      }
    }

    const draftIds = currentDrafts.map((draft) => draft.id)
    const { error: closeError } = await client
      .from('events')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .in('id', draftIds)
      .eq('client_id', userId)

    if (closeError) {
      throw new Error(`Unable to close your current draft: ${closeError.message}`)
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveEventDraft = async (
  value: EventDraftInput
): Promise<PlanningResult> => {
  try {
    const event = await ensureDraftEvent(undefined, value)

    if (!event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveBudgetPlan = async ({
  allocations,
  budget,
  priorities,
}: BudgetPlanInput): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const priorityRank = new Map(priorities.map((priority, index) => [priority, index + 1]))
    const { error } = await client.rpc('save_my_event_budget_allocations_phase9', {
      target_allocations: allocations.map((allocation, index) => ({
        amount: allocation.amount,
        category_key: allocation.categoryKey,
        priority_rank: priorityRank.get(allocation.categoryKey) ?? priorities.length + index + 1,
      })),
      target_budget: budget,
      target_event_id: event.eventId,
    })

    if (error) {
      throw new Error(
        error.message.toLowerCase().includes('save_my_event_budget_allocations_phase9')
          ? 'Phase 9 budget locking is not installed yet. Apply database/60_service_selection_revision.sql.'
          : `Unable to save your budget allocations: ${error.message}`
      )
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const setCategoryBudgetAllocation = async (
  categoryKey: BudgetPriority,
  amount: number
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()
    if (!client || !event) return { ok: false, message: 'Unable to load your event plan.' }
    const { error } = await client.rpc('set_my_category_budget_allocation', {
      target_amount: amount,
      target_category_key: categoryKey,
      target_event_id: event.eventId,
    })
    return error
      ? {
          ok: false,
          message: error.message.toLowerCase().includes('set_my_category_budget_allocation')
            ? 'Phase 9 category budgets are not installed yet. Apply database/60_service_selection_revision.sql.'
            : error.message,
        }
      : { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const savePlanningPayment = async (
  value: {
    amount: number
    method: string
    paymentType: string
    termsAccepted: boolean
  },
  items: Array<{
    commissionAmount?: number
    commissionRate?: number
    id: string
    name: string
    price: number
    providerPrice?: number
  }>
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    if (!value.termsAccepted) {
      return { ok: false, message: 'Accept the booking and cancellation terms first.' }
    }

    const [
      { data: eventRow, error: eventError },
      { data: selections, error: selectionError },
      { data: configuredCommissionRate },
    ] =
      await Promise.all([
        client
          .from('events')
          .select(
            'event_date, event_time, name, coordinator_id, pending_coordinator_id, coordinator_assignment_status, coordinator_fee_amount'
          )
          .eq('id', event.eventId)
          .single(),
        client
          .from('event_service_selections')
          .select(
            'id, provider_id, service_id, package_id, estimated_amount, notes, service_name, status, selected_provider_snapshot, catering_option_id, catering_option_name, catering_option_snapshot, venue_option_id, venue_option_name, venue_option_snapshot, venue_booked_hours, venue_setup_start_at, venue_start_at, venue_end_at, provider_profiles(user_id)'
          )
          .eq('event_id', event.eventId)
          .eq('client_id', event.userId)
          .in('status', ['selected', 'requested']),
        client.rpc('get_public_commission_rate'),
      ])

    if (eventError) return { ok: false, message: eventError.message }
    if (selectionError) return { ok: false, message: selectionError.message }

    const { error: phase9ValidationError } = await client.rpc(
      'validate_my_phase9_selections',
      { target_event_id: event.eventId }
    )
    if (phase9ValidationError) {
      return {
        ok: false,
        message: phase9ValidationError.message.toLowerCase().includes('validate_my_phase9_selections')
          ? 'Phase 9 checkout validation is not installed yet. Apply database/60_service_selection_revision.sql.'
          : phase9ValidationError.message,
      }
    }

    const requestableSelections = (selections ?? []).filter(
      (selection) => isUuid(selection.provider_id) && isUuid(selection.service_id)
    )
    const coordinatorId = eventRow.coordinator_assignment_status === 'pending'
      ? eventRow.pending_coordinator_id
      : eventRow.coordinator_id
    const hasCoordinatorPayment = isUuid(coordinatorId)
      && Number(eventRow.coordinator_fee_amount ?? 0) > 0

    if (requestableSelections.length === 0 && !hasCoordinatorPayment) {
      return {
        ok: false,
        message: 'Add a provider service or coordinator before finalizing the booking.',
      }
    }

    const now = new Date().toISOString()
    const bookingRows: Array<{
      amount: number
      commissionAmount: number
      commissionRate: number
      id: string
      isNew: boolean
      providerAmount: number
      providerUserId?: string
      selectionId: string
      serviceName: string
    }> = []

    for (const selection of requestableSelections) {
      const snapshot = selection.selected_provider_snapshot && typeof selection.selected_provider_snapshot === 'object'
        ? selection.selected_provider_snapshot as Record<string, unknown>
        : {}
      const commissionRate = normalizeCommissionRate(snapshot.commissionRate)
      const hasMarkupSnapshot = snapshot.commissionModel === 'added_to_customer'
      const providerAmount = hasMarkupSnapshot
        ? Number(snapshot.providerAmount ?? selection.estimated_amount ?? 0)
        : Number(selection.estimated_amount ?? 0)
      const amount = hasMarkupSnapshot
        ? Number(selection.estimated_amount ?? 0)
        : customerPriceFromProviderPrice(providerAmount, commissionRate)
      const commissionAmount = Math.round(Math.max(0, amount - providerAmount) * 100) / 100
      const { data: existingBooking, error: existingBookingError } = await client
        .from('bookings')
        .select('id')
        .eq('event_id', event.eventId)
        .eq('client_id', event.userId)
        .eq('provider_id', selection.provider_id)
        .eq('service_id', selection.service_id)
        .not('status', 'in', '(cancelled,rejected,expired)')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingBookingError) {
        return { ok: false, message: existingBookingError.message }
      }

      const bookingPayload = {
        amount,
        catering_option_id: selection.catering_option_id,
        catering_option_name: selection.catering_option_name,
        catering_option_snapshot: selection.catering_option_snapshot,
        client_id: event.userId,
        client_notes: selection.notes,
        commission_amount: commissionAmount,
        commission_model: 'added_to_customer',
        commission_rate: commissionRate,
        event_id: event.eventId,
        financial_terms_version: 'phase5-v1',
        package_id: selection.package_id,
        provider_id: selection.provider_id,
        provider_amount: providerAmount,
        requested_date: eventRow.event_date,
        requested_time: eventRow.event_time,
        service_id: selection.service_id,
        status: 'payment_required',
        updated_at: now,
        venue_booked_hours: selection.venue_booked_hours,
        venue_end_at: selection.venue_end_at,
        venue_option_id: selection.venue_option_id,
        venue_option_name: selection.venue_option_name,
        venue_option_snapshot: selection.venue_option_snapshot,
        venue_setup_start_at: selection.venue_setup_start_at,
        venue_start_at: selection.venue_start_at,
      }
      const isNew = !existingBooking?.id
      const bookingResult = existingBooking?.id
        ? await client
            .from('bookings')
            .update(bookingPayload)
            .eq('id', existingBooking.id)
            .select('id')
            .single()
        : await client.from('bookings').insert(bookingPayload).select('id').single()

      if (bookingResult.error || !bookingResult.data?.id) {
        return {
          ok: false,
          message: bookingResult.error?.message ?? 'Unable to create a provider request.',
        }
      }

      const provider = Array.isArray(selection.provider_profiles)
        ? selection.provider_profiles[0]
        : selection.provider_profiles

      bookingRows.push({
        amount,
        commissionAmount,
        commissionRate,
        id: bookingResult.data.id as string,
        isNew,
        providerAmount,
        providerUserId: provider?.user_id as string | undefined,
        selectionId: selection.id as string,
        serviceName: selection.service_name || 'Service',
      })
    }

    const paymentReference = `demo-${Date.now()}`
    const paymentRows: Array<Record<string, unknown>> = bookingRows.map((booking) => {
      const breakdown = calculatePaymentBreakdown([{
        commissionAmount: booking.commissionAmount,
        price: booking.amount,
        providerPrice: booking.providerAmount,
      }])

      return {
        amount: value.paymentType === 'deposit'
          ? breakdown.initialPayment
          : breakdown.clientTotal,
        booking_id: booking.id,
        client_total: breakdown.clientTotal,
        currency: 'PHP',
        event_id: event.eventId,
        held_unallocated_amount: value.paymentType === 'deposit'
          ? breakdown.heldUnallocatedAmount
          : 0,
        initial_payment_rate: DEFAULT_INITIAL_PAYMENT_RATE,
        metadata: {
          accountingVersion: 'phase5-v1',
          clientTotal: breakdown.clientTotal,
          commissionAmount: booking.commissionAmount,
          commissionModel: 'added_to_customer',
          commissionRate: booking.commissionRate,
          eventName: eventRow.name,
          heldUnallocatedAmount: value.paymentType === 'deposit'
            ? breakdown.heldUnallocatedAmount
            : 0,
          items,
          paymentType: value.paymentType,
          platformFeeAmount: breakdown.platformFee,
          providerAmount: booking.providerAmount,
          providerBalance: value.paymentType === 'deposit' ? breakdown.providerBalance : 0,
          providerInitialAllocation: breakdown.providerInitialAllocation,
          serviceSubtotal: breakdown.serviceSubtotal,
          termsAccepted: value.termsAccepted,
        },
        paid_at: now,
        payer_id: event.userId,
        platform_fee_amount: breakdown.platformFee,
        platform_fee_rate: booking.commissionRate,
        provider: value.method,
        provider_initial_allocation: breakdown.providerInitialAllocation,
        provider_initial_rate: DEFAULT_PROVIDER_INITIAL_RATE,
        provider_reference: `${paymentReference}-${booking.id.slice(0, 8)}`,
        service_subtotal: breakdown.serviceSubtotal,
        status: 'paid',
      }
    })

    if (hasCoordinatorPayment && coordinatorId) {
      const coordinatorProviderAmount = Number(eventRow.coordinator_fee_amount ?? 0)
      const coordinatorCommissionRate = normalizeCommissionRate(configuredCommissionRate)
      const coordinatorCommissionAmount = commissionFromProviderPrice(
        coordinatorProviderAmount,
        coordinatorCommissionRate
      )
      const breakdown = calculatePaymentBreakdown([{
        commissionAmount: coordinatorCommissionAmount,
        price: customerPriceFromProviderPrice(
          coordinatorProviderAmount,
          coordinatorCommissionRate
        ),
        providerPrice: coordinatorProviderAmount,
      }])

      paymentRows.push({
        amount: value.paymentType === 'deposit'
          ? breakdown.initialPayment
          : breakdown.clientTotal,
        booking_id: null,
        client_total: breakdown.clientTotal,
        coordinator_id: coordinatorId,
        currency: 'PHP',
        event_id: event.eventId,
        held_unallocated_amount: value.paymentType === 'deposit'
          ? breakdown.heldUnallocatedAmount
          : 0,
        initial_payment_rate: DEFAULT_INITIAL_PAYMENT_RATE,
        metadata: {
          accountingVersion: 'phase5-v1',
          clientTotal: breakdown.clientTotal,
          commissionAmount: coordinatorCommissionAmount,
          commissionModel: 'added_to_customer',
          commissionRate: coordinatorCommissionRate,
          eventName: eventRow.name,
          heldUnallocatedAmount: value.paymentType === 'deposit'
            ? breakdown.heldUnallocatedAmount
            : 0,
          items,
          paymentScope: 'coordinator_service',
          paymentType: value.paymentType,
          platformFeeAmount: breakdown.platformFee,
          providerAmount: coordinatorProviderAmount,
          providerBalance: value.paymentType === 'deposit' ? breakdown.providerBalance : 0,
          providerInitialAllocation: breakdown.providerInitialAllocation,
          serviceSubtotal: breakdown.serviceSubtotal,
          termsAccepted: value.termsAccepted,
        },
        paid_at: now,
        payer_id: event.userId,
        payment_scope: 'coordinator_service',
        platform_fee_amount: breakdown.platformFee,
        platform_fee_rate: coordinatorCommissionRate,
        provider: value.method,
        provider_initial_allocation: breakdown.providerInitialAllocation,
        provider_initial_rate: DEFAULT_PROVIDER_INITIAL_RATE,
        provider_reference: `${paymentReference}-coord-${coordinatorId.slice(0, 8)}`,
        service_subtotal: breakdown.serviceSubtotal,
        status: 'paid',
      })
    }
    const { error: paymentError } = await client.from('payments').insert(paymentRows)

    if (paymentError) return { ok: false, message: paymentError.message }

    if (bookingRows.length > 0) {
      const { error: bookingStatusError } = await client
        .from('bookings')
        .update({ status: 'requested', updated_at: now })
        .in(
          'id',
          bookingRows.map((booking) => booking.id)
        )

      if (bookingStatusError) return { ok: false, message: bookingStatusError.message }

      const { error: selectionStatusError } = await client
        .from('event_service_selections')
        .update({ status: 'requested', updated_at: now })
        .in(
          'id',
          bookingRows.map((booking) => booking.selectionId)
        )

      if (selectionStatusError) return { ok: false, message: selectionStatusError.message }
    }

    const { error: eventStatusError } = await client
      .from('events')
      .update({ status: 'booking', updated_at: now })
      .eq('id', event.eventId)

    if (eventStatusError) return { ok: false, message: eventStatusError.message }

    for (const booking of bookingRows) {
      if (!booking.providerUserId) continue

      const { data: existingConversation } = await client
        .from('conversations')
        .select('id')
        .eq('booking_id', booking.id)
        .maybeSingle()
      const conversationResult = existingConversation?.id
        ? { data: existingConversation }
        : await client
            .from('conversations')
            .insert({
              booking_id: booking.id,
              event_id: event.eventId,
              title: `${eventRow.name}: ${booking.serviceName}`,
            })
            .select('id')
            .single()

      if (conversationResult.data?.id) {
        await client.from('conversation_participants').upsert(
          [
            { conversation_id: conversationResult.data.id, user_id: event.userId },
            { conversation_id: conversationResult.data.id, user_id: booking.providerUserId },
          ],
          { onConflict: 'conversation_id,user_id' }
        )
      }

      if (booking.isNew) {
        await client.from('notifications').insert({
          body: `${booking.serviceName} was requested for ${eventRow.name}.`,
          resource_id: booking.id,
          resource_type: 'booking',
          title: 'New paid booking request',
          user_id: booking.providerUserId,
        })
      }
    }

    return { bookingId: bookingRows[0]?.id, ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const assignCoordinatorToEvent = async (
  coordinator: CatalogService
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event || !coordinator.coordinatorUserId) {
      return { ok: false, message: 'Choose an available event coordinator first.' }
    }

    const { error } = await client.rpc('assign_event_coordinator_only', {
      target_coordinator_id: coordinator.coordinatorUserId,
      target_event_id: event.eventId,
    })

    return error
      ? { ok: false, message: error.message }
      : { ok: true, message: `Booking request sent to ${coordinator.name}. They must accept before receiving event access.` }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const chooseCoordinatorPackage = async (
  packageId: string,
  cateringOptionChoices: Record<string, string> = {},
  replaceConflicts = false
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()
    if (!client || !event || !isUuid(packageId)) {
      return { ok: false, message: 'Choose an available coordinator package first.' }
    }
    const { data, error } = await client.rpc('choose_coordinator_package_phase9', {
      catering_option_choices: cateringOptionChoices,
      replace_conflicts: replaceConflicts,
      target_event_id: event.eventId,
      target_package_id: packageId,
    })
    if (error) return {
      ok: false,
      message: error.message.toLowerCase().includes('choose_coordinator_package_phase9')
        ? 'Phase 9 package conflict checks are not installed yet. Apply database/60_service_selection_revision.sql.'
        : error.message,
    }
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    const conflicts = Array.isArray(result.conflicts)
      ? result.conflicts.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const row = item as Record<string, unknown>
          return [{
            categoryKey: String(row.categoryKey ?? ''),
            currentService: String(row.currentService ?? 'Current service'),
            replacementService: String(row.replacementService ?? 'Package service'),
          }]
        })
      : []
    return result.requiresConfirmation === true
      ? { conflicts, ok: true, requiresConfirmation: true }
      : { ok: true, message: 'Coordinator package selected. Each provider will still review its own booking request.' }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const setCoordinatorPreference = async (
  preference: 'undecided' | 'skipped'
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Unable to load your event plan.' }
    }

    const { error } = await client.rpc('set_event_coordinator_preference', {
      target_event_id: event.eventId,
      target_preference: preference,
    })

    return error
      ? { ok: false, message: error.message }
      : { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const removeCoordinatorFromEvent = async (): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Unable to load your event plan.' }
    }

    const { error } = await client.rpc('remove_event_coordinator_and_package', {
      target_event_id: event.eventId,
    })

    return error
      ? { ok: false, message: error.message }
      : { ok: true, message: 'The coordinator was removed from your event.' }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveServiceSelection = async (
  value: ServiceSelectionInput
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const providerId = value.service.bookingProviderId ?? value.service.providerId
    const serviceId = value.service.bookingServiceId ?? value.service.id
    const packageId = value.service.bookingPackageId ?? value.service.packageId
    if (isUuid(serviceId)) {
      const { data, error } = await client.rpc('save_my_event_service_selection', {
        replace_existing: true,
        target_event_id: event.eventId,
        target_meal_type: value.mealType ?? null,
        target_notes: value.notes,
        target_option_id: value.venueOption?.id ?? value.cateringOption?.id ?? null,
        target_package_id: isUuid(packageId) ? packageId : null,
        target_quantity: value.venueBookedHours ?? null,
        target_service_id: serviceId,
      })
      if (error) {
        return {
          ok: false,
          message: error.message.toLowerCase().includes('save_my_event_service_selection')
            ? 'Phase 9 service selection is not installed yet. Apply database/60_service_selection_revision.sql.'
            : error.message,
        }
      }
      const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
      return {
        calculatedAmount: Number(result.customerAmount ?? value.estimatedTotal),
        ok: true,
        providerAmount: Number(result.providerAmount ?? value.service.providerMinPrice),
        replacedSelectionId: typeof result.replacedSelectionId === 'string'
          ? result.replacedSelectionId
          : undefined,
        selectionId: typeof result.selectionId === 'string' ? result.selectionId : undefined,
      }
    }
    let providerAmount = value.service.pricingUnit === 'person' && value.attendeeCount > 0
      ? value.service.providerMinPrice * value.attendeeCount
      : value.service.providerMinPrice
    let estimatedTotal = value.estimatedTotal
    let authoritativeOption: Record<string, unknown> = value.cateringOption ?? {}
    if (value.cateringOption && isUuid(serviceId)) {
      const { data: pricingData, error: pricingError } = await client.rpc(
        'calculate_event_service_price',
        {
          target_catering_option_id: value.cateringOption.id,
          target_event_id: event.eventId,
          target_service_id: serviceId,
        }
      )
      if (pricingError) {
        return {
          ok: false,
          message: pricingError.message.toLowerCase().includes('calculate_event_service_price')
            ? 'Catering pricing is not installed yet. Apply database/55_catering_pricing_revision.sql.'
            : pricingError.message,
        }
      }
      const pricing = pricingData && typeof pricingData === 'object'
        ? pricingData as Record<string, unknown>
        : {}
      providerAmount = Number(pricing.providerAmount ?? providerAmount)
      estimatedTotal = Number(pricing.customerAmount ?? estimatedTotal)
      authoritativeOption = pricing.cateringOption && typeof pricing.cateringOption === 'object'
        ? pricing.cateringOption as Record<string, unknown>
        : value.cateringOption
    }
    const commissionAmount = Math.round(
      Math.max(0, estimatedTotal - providerAmount) * 100
    ) / 100
    const selectionPayload = {
      event_id: event.eventId,
      client_id: event.userId,
      provider_id: isUuid(providerId) ? providerId : null,
      service_id: isUuid(serviceId) ? serviceId : null,
      package_id: isUuid(packageId) ? packageId : null,
      category_id: isUuid(value.service.categoryDbId) ? value.service.categoryDbId : null,
      service_name: value.service.name,
      category_name: value.service.categoryName,
      estimated_amount: estimatedTotal,
      attendee_count: value.attendeeCount || null,
      budget_per_head: value.cateringOption && value.attendeeCount > 0
        ? Math.round((estimatedTotal / value.attendeeCount) * 100) / 100
        : value.budgetPerHead || null,
      meal_type: value.mealType ?? null,
      outside_food: false,
      catering_option_id: value.cateringOption?.id ?? null,
      catering_option_name: value.cateringOption?.name ?? null,
      catering_option_snapshot: value.cateringOption
        ? {
            ...authoritativeOption,
            calculatedAmount: estimatedTotal,
            guestCount: value.attendeeCount,
            providerAmount,
            selectedAt: new Date().toISOString(),
          }
        : {},
      dietary_notes: value.notes,
      notes: value.notes,
      status: 'selected',
      selected_provider_snapshot: {
        commissionAmount,
        commissionModel: 'added_to_customer',
        commissionRate: value.service.commissionRate,
        mockServiceId: value.service.id,
        providerAmount,
        providerLocation: value.service.location ?? null,
        providerName: value.service.providerName,
        cateringOption: value.cateringOption
          ? {
              id: value.cateringOption.id,
              name: value.cateringOption.name,
              pricePerHead: value.cateringOption.pricePerHead,
            }
          : null,
        rating: value.service.rating,
        remainingBudgetCurrency: 'PHP',
      },
      updated_at: new Date().toISOString(),
    }
    const { data: existingSelection, error: existingSelectionError } = isUuid(serviceId)
      ? await client
          .from('event_service_selections')
          .select('id')
          .eq('event_id', event.eventId)
          .eq('client_id', event.userId)
          .eq('service_id', serviceId)
          .limit(1)
          .maybeSingle()
      : { data: null, error: null }

    if (existingSelectionError) {
      return { ok: false, message: existingSelectionError.message }
    }

    const selectionResult = existingSelection?.id
      ? await client
          .from('event_service_selections')
          .update(selectionPayload)
          .eq('id', existingSelection.id)
          .select('id')
          .single()
      : await client
          .from('event_service_selections')
          .insert(selectionPayload)
          .select('id')
          .single()
    const { data: selection, error } = selectionResult

    return {
      ok: !error,
      message: error?.message,
      selectionId: selection?.id as string | undefined,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const removeServiceSelection = async ({
  serviceId,
  serviceName,
}: {
  serviceId: string
  serviceName: string
}): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const userId = await getCurrentUserId()

    if (!client || !userId) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const { data: event, error: eventError } = await client
      .from('events')
      .select('id')
      .eq('client_id', userId)
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (eventError) return { ok: false, message: eventError.message }
    if (!event?.id) return { ok: false, message: 'No active event plan was found.' }

    const { data: selections, error: selectionError } = await client
      .from('event_service_selections')
      .select('id, service_id, service_name, selected_provider_snapshot')
      .eq('event_id', event.id)
      .eq('client_id', userId)
      .eq('status', 'selected')

    if (selectionError) return { ok: false, message: selectionError.message }

    const matchesServiceId = (item: (typeof selections)[number]) => {
      const snapshot =
        item.selected_provider_snapshot && typeof item.selected_provider_snapshot === 'object'
          ? (item.selected_provider_snapshot as Record<string, unknown>)
          : {}

      return item.service_id === serviceId || snapshot.mockServiceId === serviceId
    }
    const selection =
      (selections ?? []).find(matchesServiceId) ??
      (selections ?? []).find((item) => item.service_name === serviceName)

    if (!selection?.id) {
      return { ok: false, message: 'This service is no longer available to remove.' }
    }

    const { error } = await client
      .from('event_service_selections')
      .delete()
      .eq('id', selection.id)
      .eq('client_id', userId)
      .eq('status', 'selected')

    if (error) return { ok: false, message: error.message }

    const { error: eventTouchError } = await client
      .from('events')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', event.id)
      .eq('client_id', userId)

    return { ok: !eventTouchError, message: eventTouchError?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const replaceServiceSelection = async ({
  selectionId,
  service,
}: {
  selectionId: string
  service: CatalogService
}): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const userId = await getCurrentUserId()

    if (!client || !userId) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const providerId = service.bookingProviderId ?? service.providerId
    const serviceId = service.bookingServiceId ?? service.id
    const packageId = service.bookingPackageId ?? service.packageId

    if (!isUuid(selectionId) || !isUuid(providerId) || !isUuid(serviceId)) {
      return { ok: false, message: 'Choose a published provider service to replace this selection.' }
    }

    const { data: current, error: currentError } = await client
      .from('event_service_selections')
      .select('id, attendee_count, event_id, status')
      .eq('id', selectionId)
      .eq('client_id', userId)
      .maybeSingle()

    if (currentError) return { ok: false, message: currentError.message }
    if (!current?.id || current.status !== 'selected') {
      return { ok: false, message: 'Only an unsubmitted service selection can be changed.' }
    }

    const attendeeCount = Number(current.attendee_count ?? 0)
    const providerAmount =
      service.pricingUnit === 'person' && attendeeCount > 0
        ? service.providerMinPrice * attendeeCount
        : service.providerMinPrice
    const estimatedAmount = customerPriceFromProviderPrice(
      providerAmount,
      service.commissionRate
    )

    const { error } = await client
      .from('event_service_selections')
      .update({
        category_id: isUuid(service.categoryDbId) ? service.categoryDbId : null,
        category_name: service.categoryName,
        estimated_amount: estimatedAmount,
        package_id: isUuid(packageId) ? packageId : null,
        provider_id: providerId,
        selected_provider_snapshot: {
          commissionAmount: Math.round(
            Math.max(0, estimatedAmount - providerAmount) * 100
          ) / 100,
          commissionModel: 'added_to_customer',
          commissionRate: service.commissionRate,
          mockServiceId: service.id,
          providerAmount,
          providerLocation: service.location ?? null,
          providerName: service.providerName,
          rating: service.rating,
          remainingBudgetCurrency: 'PHP',
        },
        service_id: serviceId,
        service_name: service.name,
        status: 'selected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectionId)
      .eq('client_id', userId)
      .eq('status', 'selected')

    if (error) return { ok: false, message: error.message }

    const { error: instructionError } = await client
      .from('event_provider_instructions')
      .update({
        category_name: service.categoryName,
        provider_id: providerId,
        service_id: serviceId,
      })
      .eq('selection_id', selectionId)

    if (instructionError) return { ok: false, message: instructionError.message }

    const { error: eventTouchError } = await client
      .from('events')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', current.event_id)
      .eq('client_id', userId)

    return { ok: !eventTouchError, message: eventTouchError?.message, selectionId }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveProviderInstructions = async (
  value: InstructionModuleValue
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const { data: selections, error: selectionsError } = await client
      .from('event_service_selections')
      .select('id, provider_id, service_id, service_name, category_name')
      .eq('event_id', event.eventId)
      .eq('client_id', event.userId)

    if (selectionsError) return { ok: false, message: selectionsError.message }

    const providerRequests = value.requests.filter((request) => !request.coordinatorId)
    const coordinatorRequests = value.requests.filter(
      (request) => isUuid(request.coordinatorId)
    )
    const rows = providerRequests.flatMap((request) => {
      const selection = (selections ?? []).find(
        (item) =>
          (isUuid(request.serviceId) && item.service_id === request.serviceId) ||
          item.service_name === request.serviceName
      )
      const base = {
        category_name: request.category,
        event_id: event.eventId,
        provider_id: selection?.provider_id ?? (isUuid(request.providerId) ? request.providerId : null),
        selection_id: selection?.id ?? null,
        service_id: selection?.service_id ?? (isUuid(request.serviceId) ? request.serviceId : null),
        status: 'saved',
      }
      const kind = request.category.toLowerCase()

      if (kind.includes('cater')) {
        return [
          {
            ...base,
            body: request.dietaryRestrictions,
            instruction_type: 'dietary',
            is_required: false,
            tags: request.selectedTags,
            title: 'Dietary restrictions / allergies',
          },
          {
            ...base,
            body: request.specialMenuRequests,
            instruction_type: 'menu',
            is_required: false,
            tags: [],
            title: 'Special menu requests',
          },
        ]
      }

      if (kind.includes('venue') || kind.includes('estate')) {
        return [{
          ...base,
          body: request.setupRequirements,
          instruction_type: 'setup',
          is_required: false,
          tags: [],
          title: 'Setup requirements',
        }]
      }

      if (kind.includes('photo')) {
        return [{
          ...base,
          body: request.mustHaveShots,
          instruction_type: 'shots',
          is_required: false,
          tags: [],
          title: 'Must-have shots',
        }]
      }

      return [{
        ...base,
        body: request.notes,
        instruction_type: 'general',
        is_required: false,
        tags: [],
        title: `Special requests for ${request.category}`,
      }]
    }).filter((row) => row.body.trim().length > 0 || row.tags.length > 0)

    const { error: coordinatorDeleteError } = await client
      .from('event_coordinator_instructions')
      .delete()
      .eq('event_id', event.eventId)

    if (coordinatorDeleteError) {
      return {
        ok: false,
        message: coordinatorDeleteError.message.toLowerCase().includes('event_coordinator_instructions')
          ? 'Coordinator instructions are not installed yet. Apply database/29_coordinator_lifecycle_instructions_reviews.sql.'
          : coordinatorDeleteError.message,
      }
    }

    const { error: deleteError } = await client
      .from('event_provider_instructions')
      .delete()
      .eq('event_id', event.eventId)

    if (deleteError) return { ok: false, message: deleteError.message }

    if (rows.length > 0) {
      const { error } = await client.from('event_provider_instructions').insert(rows)
      if (error) return { ok: false, message: error.message }
    }

    const coordinatorRows = coordinatorRequests
      .map((request) => ({
        body: request.notes.trim() || null,
        coordinator_id: request.coordinatorId,
        event_id: event.eventId,
        status: 'saved',
        tags: request.selectedTags,
        title: 'Planning and coordination notes',
      }))
      .filter((row) => Boolean(row.body) || row.tags.length > 0)

    if (coordinatorRows.length > 0) {
      const { error } = await client
        .from('event_coordinator_instructions')
        .insert(coordinatorRows)
      if (error) return { ok: false, message: error.message }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

const formatScheduleDateTime = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 'Date and time not specified'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Asia/Manila',
    year: 'numeric',
  }).format(parsed)
}

export const saveScheduleCheck = async (): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const { data: scheduleRows, error: scheduleError } = await client.rpc(
      'get_event_schedule_availability',
      { target_event_id: event.eventId }
    )

    if (scheduleError) {
      return {
        ok: false,
        message: scheduleError.message.toLowerCase().includes('get_event_schedule_availability')
          ? 'The real schedule checker is not installed yet. Apply database/13_real_schedule_check.sql in Supabase, then try again.'
          : scheduleError.message,
      }
    }

    const results = ((scheduleRows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      category_name: typeof row.category_name === 'string' ? row.category_name : 'Service',
      conflict_reason:
        typeof row.conflict_reason === 'string' ? row.conflict_reason : null,
      is_available: row.is_available === true,
      provider_id: typeof row.provider_id === 'string' ? row.provider_id : null,
      provider_name:
        typeof row.provider_name === 'string' ? row.provider_name : 'Service provider',
      requested_start_at:
        typeof row.requested_start_at === 'string' ? row.requested_start_at : null,
      schedule_check_id: '',
      selection_id: typeof row.selection_id === 'string' ? row.selection_id : null,
      service_id: typeof row.service_id === 'string' ? row.service_id : null,
      service_name: typeof row.service_name === 'string' ? row.service_name : 'Selected service',
    }))

    if (results.length === 0) {
      return { ok: false, message: 'No selected services were found for this event.' }
    }

    const conflictCount = results.filter((result) => !result.is_available).length
    const status: 'available' | 'conflict' = conflictCount > 0 ? 'conflict' : 'available'
    const requestedStartAt = results.find((result) => result.requested_start_at)?.requested_start_at

    const { data: check, error } = await client
      .from('event_schedule_checks')
      .insert({
        event_id: event.eventId,
        client_id: event.userId,
        status,
        conflict_count: conflictCount,
        checked_at: new Date().toISOString(),
        requested_start_at: requestedStartAt ?? null,
      })
      .select('id')
      .single()

    if (error || !check?.id) {
      return { ok: false, message: error?.message }
    }

    const { error: resultError } = results.length
      ? await client
          .from('event_schedule_check_results')
          .insert(
            results.map((result) => ({
              conflict_reason: result.conflict_reason,
              is_available: result.is_available,
              provider_id: result.provider_id,
              provider_name: result.provider_name,
              requested_start_at: result.requested_start_at,
              schedule_check_id: check.id,
              selection_id: result.selection_id,
              service_id: result.service_id,
            }))
          )
      : { error: null }

    return {
      conflictCount,
      ok: !resultError,
      message: resultError?.message,
      providers: results.map((result) => ({
        available: result.is_available,
        category: result.category_name,
        dateTime: formatScheduleDateTime(result.requested_start_at),
        id: result.selection_id ?? `${result.provider_id}-${result.service_id}`,
        message: result.conflict_reason ?? undefined,
        name: result.provider_name,
        serviceName: result.service_name,
      })),
      status,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveClientReview = async ({
  bookingId,
  comment,
  rating,
  tags,
}: SubmitReviewValue): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const reviewerId = await getCurrentUserId()

    if (!client || !reviewerId || !bookingId || rating < 1) {
      return { ok: false, message: 'Supabase is not configured or no reviewable booking exists.' }
    }

    const { data: booking } = await client
      .from('bookings')
      .select('provider_id, service_id, status, provider_profiles(user_id)')
      .eq('id', bookingId)
      .eq('client_id', reviewerId)
      .maybeSingle()

    if (!booking?.provider_id) {
      return { ok: false, message: 'Unable to find this booking for review.' }
    }

    if (booking.status !== 'completed') {
      return { ok: false, message: 'Reviews can be submitted after a booking is completed.' }
    }

    const { error } = await client.from('reviews').insert({
      booking_id: bookingId,
      comment,
      provider_id: booking.provider_id,
      rating,
      reviewer_id: reviewerId,
      service_id: booking.service_id ?? null,
      tags,
    })

    if (!error) {
      const provider = Array.isArray(booking.provider_profiles)
        ? booking.provider_profiles[0]
        : booking.provider_profiles

      if (provider?.user_id) {
        await client.from('notifications').insert({
          body: `A client left a ${rating}-star review.`,
          resource_id: bookingId,
          resource_type: 'review',
          title: 'New client review',
          user_id: provider.user_id,
        })
      }
    }

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveEventFeedback = async ({
  coordinatorReview,
  eventId,
  serviceReviews,
}: EventFeedbackValue): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const clientId = await getCurrentUserId()

    if (!client || !clientId || !eventId || serviceReviews.length === 0) {
      return { ok: false, message: 'A completed event and service ratings are required.' }
    }

    if (
      serviceReviews.some(
        (review) =>
          !review.bookingId ||
          !Number.isInteger(review.rating) ||
          review.rating < 1 ||
          review.rating > 5 ||
          review.comment.trim().length > 4000
      )
    ) {
      return { ok: false, message: 'Rate every service from 1 to 5 stars.' }
    }

    if (
      coordinatorReview && (
        !Number.isInteger(coordinatorReview.rating) ||
        coordinatorReview.rating < 1 ||
        coordinatorReview.rating > 5 ||
        coordinatorReview.comment.trim().length > 4000
      )
    ) {
      return { ok: false, message: 'Rate the coordinator from 1 to 5 stars.' }
    }

    const { data, error } = await client.rpc('submit_event_feedback_v2', {
      coordinator_comment: coordinatorReview?.comment.trim() || null,
      coordinator_rating: coordinatorReview?.rating ?? null,
      service_reviews: serviceReviews.map((review) => ({
        booking_id: review.bookingId,
        comment: review.comment.trim() || null,
        rating: review.rating,
      })),
      target_event_id: eventId,
    })

    if (error) {
      return {
        ok: false,
        message: error.message.toLowerCase().includes('submit_event_feedback_v2')
          ? 'Coordinator feedback is not installed yet. Apply database/29_coordinator_lifecycle_instructions_reviews.sql.'
          : error.message ?? 'Unable to save event feedback.',
      }
    }

    const result = data as
      | { reviews?: Array<{ needs_analysis?: boolean; review_id?: string }> }
      | null
    const queuedReviews = (result?.reviews ?? []).filter(
      (review): review is { needs_analysis: true; review_id: string } =>
        review.needs_analysis === true && typeof review.review_id === 'string'
    )
    const analysisResults = await Promise.allSettled(
      queuedReviews.map((review) =>
        client.functions.invoke('analyze-review', {
          body: { reviewId: review.review_id },
        })
      )
    )
    const hasPendingAnalysis = analysisResults.some(
      (result) => result.status === 'rejected' || Boolean(result.value.error)
    )

    return {
      ok: true,
      message: hasPendingAnalysis
        ? 'Ratings were saved. Some comment analysis is still pending.'
        : undefined,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}
