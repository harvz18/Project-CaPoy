import { supabase, supabaseConfig } from './supabase'
import { CatalogService } from './catalog'

type PlanningResult = {
  ok: boolean
  message?: string
}

type BudgetPlanInput = {
  budget: number
  priorities: string[]
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

type InstructionInput = {
  catering: {
    dietaryRestrictions: string
    selectedTags: string[]
    specialMenuRequests: string
  }
  generalNotes: string
  photography: {
    mustHaveShots: string
  }
  venue: {
    setupRequirements: string
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

const getClient = () => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return null
  }

  return supabase
}

const toMessage = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Unable to save planning data.'

const getCurrentUserId = async () => {
  const client = getClient()

  if (!client) {
    return null
  }

  const { data } = await client.auth.getUser()

  return data.user?.id ?? null
}

const ensureDraftEvent = async (budget?: number) => {
  const client = getClient()
  const userId = await getCurrentUserId()

  if (!client || !userId) {
    return null
  }

  const { data: existing } = await client
    .from('events')
    .select('id')
    .eq('client_id', userId)
    .in('status', ['draft', 'planning'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await client
      .from('events')
      .update({
        status: 'planning',
        total_budget: budget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return { eventId: existing.id as string, userId }
  }

  const { data: created, error } = await client
    .from('events')
    .insert({
      client_id: userId,
      name: defaultEventName,
      status: 'planning',
      total_budget: budget,
    })
    .select('id')
    .single()

  if (error || !created?.id) {
    return null
  }

  return { eventId: created.id as string, userId }
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

export const saveServiceSelection = async (
  value: ServiceSelectionInput
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const { error } = await client.from('event_service_selections').insert({
      event_id: event.eventId,
      client_id: event.userId,
      service_name: value.service.name,
      category_name: value.service.categoryName,
      estimated_amount: value.estimatedTotal,
      attendee_count: value.attendeeCount || null,
      budget_per_head: value.budgetPerHead || null,
      meal_type: value.mealType,
      outside_food: value.outsideFood,
      dietary_notes: value.notes,
      notes: value.notes,
      selected_provider_snapshot: {
        mockServiceId: value.service.id,
        providerName: value.service.providerName,
        rating: value.service.rating,
        remainingBudgetCurrency: 'PHP',
      },
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveProviderInstructions = async (
  value: InstructionInput
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    await client.from('event_provider_instructions').delete().eq('event_id', event.eventId)

    const rows = [
      {
        event_id: event.eventId,
        category_name: 'Catering',
        instruction_type: 'dietary',
        title: 'Dietary restrictions / allergies',
        body: value.catering.dietaryRestrictions,
        tags: value.catering.selectedTags,
        is_required: true,
        status: 'saved',
      },
      {
        event_id: event.eventId,
        category_name: 'Catering',
        instruction_type: 'menu',
        title: 'Special menu requests',
        body: value.catering.specialMenuRequests,
        tags: [],
        status: 'saved',
      },
      {
        event_id: event.eventId,
        category_name: 'Venue',
        instruction_type: 'setup',
        title: 'Setup requirements',
        body: value.venue.setupRequirements,
        tags: [],
        status: 'saved',
      },
      {
        event_id: event.eventId,
        category_name: 'Photography',
        instruction_type: 'shots',
        title: 'Must-have shots',
        body: value.photography.mustHaveShots,
        tags: [],
        status: 'saved',
      },
      {
        event_id: event.eventId,
        category_name: 'Organizer',
        instruction_type: 'general',
        title: 'General notes for organizer',
        body: value.generalNotes,
        tags: [],
        status: 'saved',
      },
    ].filter((row) => row.body.trim().length > 0 || row.tags.length > 0)

    if (rows.length > 0) {
      const { error } = await client.from('event_provider_instructions').insert(rows)

      return { ok: !error, message: error?.message }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveScheduleCheck = async (
  status: 'conflict' | 'available'
): Promise<PlanningResult> => {
  try {
    const client = getClient()
    const event = await ensureDraftEvent()

    if (!client || !event) {
      return { ok: false, message: 'Supabase is not configured or no user is signed in.' }
    }

    const { data: check, error } = await client
      .from('event_schedule_checks')
      .insert({
        event_id: event.eventId,
        client_id: event.userId,
        status,
        conflict_count: status === 'conflict' ? 1 : 0,
        checked_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !check?.id) {
      return { ok: false, message: error?.message }
    }

    const results = [
      {
        schedule_check_id: check.id,
        provider_name: 'Gourmet Affairs',
        is_available: true,
      },
      {
        schedule_check_id: check.id,
        provider_name: 'The Glasshouse Estate',
        is_available: status === 'available',
        conflict_reason: status === 'conflict' ? 'Not available on selected date.' : null,
      },
      {
        schedule_check_id: check.id,
        provider_name: 'Lumiere Photography',
        is_available: true,
      },
    ]

    const { error: resultError } = await client
      .from('event_schedule_check_results')
      .insert(results)

    return { ok: !resultError, message: resultError?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}
