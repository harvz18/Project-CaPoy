import { supabase, supabaseConfig } from './supabase'
import { CatalogService } from './catalog'
import type { SubmitReviewValue } from '../screens'
import type { EventFeedbackValue } from '../screens/15.1-EventFeedback'
import type { InstructionModuleValue } from '../screens/10-InstructionModule'
import type {
  EventCreationValue,
  EventType,
  VenueStatus,
} from '../screens/04-EventCreation'

type PlanningResult = {
  bookingId?: string
  conflictCount?: number
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
  selectionId?: string
  status?: 'available' | 'conflict'
}

type BudgetPlanInput = {
  budget: number
  priorities: string[]
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
  estimatedTotal: number
  mealType: string
  notes: string
  outsideFood: boolean
  service: CatalogService
}

export type ClientPlanningState = {
  event?: EventCreationValue
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
    detail: string
    id: string
    imageLabel: string
    imageUrl: string
    name: string
    price: number
    status: string
  }>
  totalBudget?: number
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
      'id, name, event_type, event_date, event_time, guest_count, total_budget, venue_status, venue, location, status, updated_at'
    )
    .eq('client_id', userId)
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!event?.id) return { selectedServices: [] }

  const [{ data: selections }, { data: payments }, { data: scheduleChecks }] = await Promise.all([
    client
      .from('event_service_selections')
      .select(
        'id, service_id, service_name, category_name, estimated_amount, attendee_count, status, updated_at, selected_provider_snapshot, services(cover_image_url)'
      )
      .eq('event_id', event.id)
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
  ])

  const latestPayment = payments?.[0]
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

  return {
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
    lastPayment: latestPayment
      ? {
          amount: Number(latestPayment.amount ?? 0),
          method: paymentMethodFrom(latestPayment.provider),
          paymentType: paymentMetadata.paymentType === 'full' ? 'full' : 'deposit',
          termsAccepted: paymentMetadata.termsAccepted === true,
        }
      : undefined,
    maxPlanningStep: latestPayment
      ? 5
      : scheduleCheckIsCurrent && latestScheduleCheck?.status === 'available'
        ? 5
        : scheduleCheckIsCurrent && latestScheduleCheck
          ? 4
          : (selections ?? []).length > 0
            ? 3
            : event.event_date
              ? 2
              : 1,
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
        detail: selection.attendee_count
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
  budget,
  priorities,
}: BudgetPlanInput): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent(budget)

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    await client.from('event_budget_items').delete().eq('event_id', event.eventId)

    if (priorities.length > 0) {
      const items = priorities.map((priority, index) => ({
        event_id: event.eventId,
        label: priorityLabels[priority] ?? priority,
        estimated_amount: 0,
        priority_rank: index + 1,
        is_priority: true,
        status: 'planned',
      }))

      await client.from('event_budget_items').insert(items)
    }

    return { ok: true }
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
  items: Array<{ id: string; name: string; price: number }>
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

    const [{ data: eventRow, error: eventError }, { data: selections, error: selectionError }] =
      await Promise.all([
        client
          .from('events')
          .select('event_date, event_time, name')
          .eq('id', event.eventId)
          .single(),
        client
          .from('event_service_selections')
          .select(
            'id, provider_id, service_id, package_id, estimated_amount, notes, service_name, status, provider_profiles(user_id)'
          )
          .eq('event_id', event.eventId)
          .eq('client_id', event.userId)
          .in('status', ['selected', 'requested']),
      ])

    if (eventError) return { ok: false, message: eventError.message }
    if (selectionError) return { ok: false, message: selectionError.message }

    const requestableSelections = (selections ?? []).filter(
      (selection) => isUuid(selection.provider_id) && isUuid(selection.service_id)
    )

    if (requestableSelections.length === 0) {
      return {
        ok: false,
        message: 'Add at least one published provider service before finalizing the booking.',
      }
    }

    const now = new Date().toISOString()
    const bookingRows: Array<{
      amount: number
      id: string
      isNew: boolean
      providerUserId?: string
      selectionId: string
      serviceName: string
    }> = []

    for (const selection of requestableSelections) {
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
        amount: Number(selection.estimated_amount ?? 0),
        client_id: event.userId,
        client_notes: selection.notes,
        event_id: event.eventId,
        package_id: selection.package_id,
        provider_id: selection.provider_id,
        requested_date: eventRow.event_date,
        requested_time: eventRow.event_time,
        service_id: selection.service_id,
        status: 'payment_required',
        updated_at: now,
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
        amount: Number(selection.estimated_amount ?? 0),
        id: bookingResult.data.id as string,
        isNew,
        providerUserId: provider?.user_id as string | undefined,
        selectionId: selection.id as string,
        serviceName: selection.service_name || 'Service',
      })
    }

    const paymentReference = `demo-${Date.now()}`
    const paymentRows = bookingRows.map((booking) => ({
      amount:
        value.paymentType === 'deposit'
          ? Math.round(booking.amount * 0.3)
          : booking.amount,
      booking_id: booking.id,
      currency: 'PHP',
      event_id: event.eventId,
      metadata: {
        eventName: eventRow.name,
        items,
        paymentType: value.paymentType,
        termsAccepted: value.termsAccepted,
      },
      paid_at: now,
      payer_id: event.userId,
      provider: value.method,
      provider_reference: `${paymentReference}-${booking.id.slice(0, 8)}`,
      status: 'paid',
    }))
    const { error: paymentError } = await client.from('payments').insert(paymentRows)

    if (paymentError) return { ok: false, message: paymentError.message }

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
    const selectionPayload = {
      event_id: event.eventId,
      client_id: event.userId,
      provider_id: isUuid(providerId) ? providerId : null,
      service_id: isUuid(serviceId) ? serviceId : null,
      package_id: isUuid(packageId) ? packageId : null,
      category_id: isUuid(value.service.categoryDbId) ? value.service.categoryDbId : null,
      service_name: value.service.name,
      category_name: value.service.categoryName,
      estimated_amount: value.estimatedTotal,
      attendee_count: value.attendeeCount || null,
      budget_per_head: value.budgetPerHead || null,
      meal_type: value.mealType,
      outside_food: value.outsideFood,
      dietary_notes: value.notes,
      notes: value.notes,
      status: 'selected',
      selected_provider_snapshot: {
        mockServiceId: value.service.id,
        providerName: value.service.providerName,
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
    const estimatedAmount =
      service.pricingUnit === 'person' && attendeeCount > 0
        ? service.minPrice * attendeeCount
        : service.minPrice

    const { error } = await client
      .from('event_service_selections')
      .update({
        category_id: isUuid(service.categoryDbId) ? service.categoryDbId : null,
        category_name: service.categoryName,
        estimated_amount: estimatedAmount,
        package_id: isUuid(packageId) ? packageId : null,
        provider_id: providerId,
        selected_provider_snapshot: {
          mockServiceId: service.id,
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

    const rows = value.requests.flatMap((request) => {
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

    const { error: deleteError } = await client
      .from('event_provider_instructions')
      .delete()
      .eq('event_id', event.eventId)

    if (deleteError) return { ok: false, message: deleteError.message }

    if (rows.length > 0) {
      const { error } = await client.from('event_provider_instructions').insert(rows)

      return { ok: !error, message: error?.message }
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
  eventId,
  overallComment,
}: EventFeedbackValue): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const clientId = await getCurrentUserId()
    const comment = overallComment.trim()

    if (!client || !clientId || !eventId || comment.length < 10) {
      return { ok: false, message: 'A completed event and meaningful feedback are required.' }
    }

    const { data: event } = await client
      .from('events')
      .select('id, status')
      .eq('id', eventId)
      .eq('client_id', clientId)
      .maybeSingle()

    if (!event?.id || event.status !== 'completed') {
      return { ok: false, message: 'Feedback opens after every provider marks the event finished.' }
    }

    const { error } = await client.from('event_feedback').insert({
      analysis_status: 'pending',
      client_id: clientId,
      event_id: eventId,
      overall_comment: comment,
    })

    if (error?.code === '23505') {
      return { ok: false, message: 'Feedback has already been submitted for this event.' }
    }

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}
