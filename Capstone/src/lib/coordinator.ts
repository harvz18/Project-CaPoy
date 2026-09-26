import { supabase, supabaseConfig } from './supabase'

export type CoordinatorTaskStatus = 'blocked' | 'completed' | 'in_progress' | 'pending'

export interface CoordinatorServiceInstruction {
  body?: string
  id: string
  isRequired: boolean
  status: string
  tags: string[]
  title: string
  type: string
}

export interface CoordinatorBookedService {
  amount: number
  bookingId?: string
  booked: boolean
  categoryName: string
  clientNotes?: string
  id: string
  instructions: CoordinatorServiceInstruction[]
  providerEmail?: string
  providerId?: string
  providerName: string
  providerPhone?: string
  providerUserId?: string
  serviceId?: string
  serviceName: string
  status: string
}

export interface CoordinatorInvitation {
  clientName: string
  date?: string
  eventId: string
  eventName: string
  eventType?: string
  guestCount?: number
  location?: string
  requestedAt?: string
  time?: string
  venue?: string
}

export interface CoordinatorEvent {
  bookingCount: number
  clientName: string
  completedTaskCount: number
  confirmedBookingCount: number
  date?: string
  guestCount?: number
  id: string
  instructions: CoordinatorServiceInstruction[]
  location?: string
  name: string
  services: CoordinatorBookedService[]
  status: string
  taskCount: number
  time?: string
  totalBudget?: number
  type?: string
  venue?: string
}

export interface CoordinatorTask {
  assignedToName: string
  description?: string
  dueAt?: string
  eventId: string
  eventName: string
  id: string
  status: CoordinatorTaskStatus
  title: string
}

export interface CoordinatorDashboard {
  events: CoordinatorEvent[]
  invitations: CoordinatorInvitation[]
  tasks: CoordinatorTask[]
}

export interface CoordinatorResult<T = undefined> {
  data?: T
  message?: string
  ok: boolean
}

export interface CreateCoordinatorTaskInput {
  description?: string
  dueAt?: string
  eventId: string
  title: string
}

export const emptyCoordinatorDashboard = (): CoordinatorDashboard => ({
  events: [],
  invitations: [],
  tasks: [],
})

const recordFrom = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const numberFrom = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const optionalText = (value: unknown) => {
  const text = textFrom(value)
  return text || undefined
}

const taskStatusFrom = (value: unknown): CoordinatorTaskStatus => {
  if (value === 'blocked' || value === 'completed' || value === 'in_progress') return value
  return 'pending'
}

const parseDashboard = (value: unknown): CoordinatorDashboard => {
  const payload = recordFrom(value)
  const eventRows = Array.isArray(payload.events) ? payload.events : []
  const invitationRows = Array.isArray(payload.invitations) ? payload.invitations : []
  const taskRows = Array.isArray(payload.tasks) ? payload.tasks : []

  return {
    events: eventRows.flatMap((entry) => {
      const row = recordFrom(entry)
      const id = textFrom(row.id)
      const name = textFrom(row.name)
      if (!id || !name) return []

      const serviceRows = Array.isArray(row.services) ? row.services : []

      return [{
        bookingCount: numberFrom(row.booking_count),
        clientName: textFrom(row.client_name, 'Client'),
        completedTaskCount: numberFrom(row.completed_task_count),
        confirmedBookingCount: numberFrom(row.confirmed_booking_count),
        date: optionalText(row.event_date),
        guestCount: row.guest_count == null ? undefined : numberFrom(row.guest_count),
        id,
        instructions: [],
        location: optionalText(row.location),
        name,
        services: serviceRows.flatMap((entry) => {
          const service = recordFrom(entry)
          const serviceId = textFrom(service.id)
          const serviceName = textFrom(service.service_name)
          if (!serviceId || !serviceName) return []

          const instructionRows = Array.isArray(service.instructions) ? service.instructions : []

          return [{
            amount: numberFrom(service.amount),
            bookingId: optionalText(service.booking_id),
            booked: service.booked === true,
            categoryName: textFrom(service.category_name, 'Service'),
            clientNotes: optionalText(service.client_notes),
            id: serviceId,
            instructions: instructionRows.flatMap((entry) => {
              const instruction = recordFrom(entry)
              const instructionId = textFrom(instruction.id)
              const title = textFrom(instruction.title)
              if (!instructionId || !title) return []

              return [{
                body: optionalText(instruction.body),
                id: instructionId,
                isRequired: instruction.is_required === true,
                status: textFrom(instruction.status, 'saved'),
                tags: Array.isArray(instruction.tags)
                  ? instruction.tags.filter((tag): tag is string => typeof tag === 'string')
                  : [],
                title,
                type: textFrom(instruction.type, 'note'),
              }]
            }),
            providerEmail: optionalText(service.provider_email),
            providerId: optionalText(service.provider_id),
            providerName: textFrom(service.provider_name, 'Provider'),
            providerPhone: optionalText(service.provider_phone),
            providerUserId: optionalText(service.provider_user_id),
            serviceId: optionalText(service.service_id),
            serviceName,
            status: textFrom(service.status, 'selected'),
          }]
        }),
        status: textFrom(row.status, 'planning'),
        taskCount: numberFrom(row.task_count),
        time: optionalText(row.event_time),
        totalBudget: row.total_budget == null ? undefined : numberFrom(row.total_budget),
        type: optionalText(row.event_type),
        venue: optionalText(row.venue),
      }]
    }),
    invitations: invitationRows.flatMap((entry) => {
      const row = recordFrom(entry)
      const eventId = textFrom(row.event_id)
      const eventName = textFrom(row.event_name)
      if (!eventId || !eventName) return []

      return [{
        clientName: textFrom(row.client_name, 'Client'),
        date: optionalText(row.event_date),
        eventId,
        eventName,
        eventType: optionalText(row.event_type),
        guestCount: row.guest_count == null ? undefined : numberFrom(row.guest_count),
        location: optionalText(row.location),
        requestedAt: optionalText(row.requested_at),
        time: optionalText(row.event_time),
        venue: optionalText(row.venue),
      }]
    }),
    tasks: taskRows.flatMap((entry) => {
      const row = recordFrom(entry)
      const id = textFrom(row.id)
      const eventId = textFrom(row.event_id)
      const title = textFrom(row.title)
      if (!id || !eventId || !title) return []

      return [{
        assignedToName: textFrom(row.assigned_to_name, 'Unassigned'),
        description: optionalText(row.description),
        dueAt: optionalText(row.due_at),
        eventId,
        eventName: textFrom(row.event_name, 'Assigned event'),
        id,
        status: taskStatusFrom(row.status),
        title,
      }]
    }),
  }
}

const unavailableMessage =
  'Supabase is not configured. Check the app environment settings.'

export const fetchCoordinatorDashboard = async (): Promise<CoordinatorResult<CoordinatorDashboard>> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return { data: emptyCoordinatorDashboard(), message: unavailableMessage, ok: false }
  }

  const [{ data, error }, { data: instructionData, error: instructionError }] =
    await Promise.all([
      supabase.rpc('get_coordinator_dashboard'),
      supabase.rpc('get_my_coordinator_instructions'),
    ])
  if (error) {
    return { data: emptyCoordinatorDashboard(), message: error.message, ok: false }
  }

  if (instructionError) {
    return {
      data: emptyCoordinatorDashboard(),
      message: instructionError.message.toLowerCase().includes('get_my_coordinator_instructions')
        ? 'Coordinator instructions are not installed yet. Apply database/29_coordinator_lifecycle_instructions_reviews.sql.'
        : instructionError.message,
      ok: false,
    }
  }

  const dashboard = parseDashboard(data)
  const instructionsByEvent = new Map<string, CoordinatorServiceInstruction[]>()
  for (const entry of Array.isArray(instructionData) ? instructionData : []) {
    const row = recordFrom(entry)
    const eventId = textFrom(row.event_id)
    const id = textFrom(row.id)
    const title = textFrom(row.title)
    if (!eventId || !id || !title) continue

    const instructions = instructionsByEvent.get(eventId) ?? []
    instructions.push({
      body: optionalText(row.body),
      id,
      isRequired: false,
      status: textFrom(row.status, 'saved'),
      tags: Array.isArray(row.tags)
        ? row.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      title,
      type: 'coordination',
    })
    instructionsByEvent.set(eventId, instructions)
  }

  return {
    data: {
      ...dashboard,
      events: dashboard.events.map((event) => ({
        ...event,
        instructions: instructionsByEvent.get(event.id) ?? [],
      })),
    },
    ok: true,
  }
}

export const createCoordinatorTask = async (
  input: CreateCoordinatorTaskInput
): Promise<CoordinatorResult> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return { message: unavailableMessage, ok: false }
  }

  const { error } = await supabase.rpc('create_coordination_task', {
    target_due_at: input.dueAt ?? null,
    target_event_id: input.eventId,
    task_description: input.description?.trim() || null,
    task_title: input.title.trim(),
  })

  return error ? { message: error.message, ok: false } : { ok: true }
}

export const updateCoordinatorTaskStatus = async (
  taskId: string,
  status: CoordinatorTaskStatus
): Promise<CoordinatorResult> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return { message: unavailableMessage, ok: false }
  }

  const { error } = await supabase.rpc('update_coordination_task_status', {
    new_status: status,
    target_task_id: taskId,
  })

  return error ? { message: error.message, ok: false } : { ok: true }
}

export const respondToCoordinatorInvitation = async (
  eventId: string,
  accepted: boolean
): Promise<CoordinatorResult> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return { message: unavailableMessage, ok: false }
  }

  const { data, error } = await supabase.rpc('respond_event_coordinator_assignment', {
    accept_assignment: accepted,
    target_event_id: eventId,
  })

  if (error) return { message: error.message, ok: false }

  const response = recordFrom(data)
  if (accepted && response.accepted === false) {
    return {
      message: textFrom(
        response.reason,
        'Your availability changed, so MULTIVENT is matching another coordinator.'
      ),
      ok: false,
    }
  }

  return { ok: true }
}
