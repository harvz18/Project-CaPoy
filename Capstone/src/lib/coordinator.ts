import { supabase, supabaseConfig } from './supabase'

export type CoordinatorTaskStatus = 'blocked' | 'completed' | 'in_progress' | 'pending'

export interface CoordinatorEvent {
  bookingCount: number
  clientName: string
  completedTaskCount: number
  confirmedBookingCount: number
  date?: string
  guestCount?: number
  id: string
  location?: string
  name: string
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

export const emptyCoordinatorDashboard = (): CoordinatorDashboard => ({ events: [], tasks: [] })

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
  const taskRows = Array.isArray(payload.tasks) ? payload.tasks : []

  return {
    events: eventRows.flatMap((entry) => {
      const row = recordFrom(entry)
      const id = textFrom(row.id)
      const name = textFrom(row.name)
      if (!id || !name) return []

      return [{
        bookingCount: numberFrom(row.booking_count),
        clientName: textFrom(row.client_name, 'Client'),
        completedTaskCount: numberFrom(row.completed_task_count),
        confirmedBookingCount: numberFrom(row.confirmed_booking_count),
        date: optionalText(row.event_date),
        guestCount: row.guest_count == null ? undefined : numberFrom(row.guest_count),
        id,
        location: optionalText(row.location),
        name,
        status: textFrom(row.status, 'planning'),
        taskCount: numberFrom(row.task_count),
        time: optionalText(row.event_time),
        totalBudget: row.total_budget == null ? undefined : numberFrom(row.total_budget),
        type: optionalText(row.event_type),
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

  const { data, error } = await supabase.rpc('get_coordinator_dashboard')
  if (error) {
    return { data: emptyCoordinatorDashboard(), message: error.message, ok: false }
  }

  return { data: parseDashboard(data), ok: true }
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
