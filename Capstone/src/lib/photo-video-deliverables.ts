import { supabase } from './supabase'

export type PhotoVideoDeliverableStatus = 'awaiting_event' | 'editing' | 'ready_for_review' | 'revision_requested' | 'completed'
export type PhotoVideoDeliverableRecord = {
  additionalPaidRevisionRequested?: boolean
  deliveryMethod?: string
  deliveryReference?: string
  description?: string
  expectedCompletionDate?: string
  id: string
  includedRevisionRounds: number
  issueNote?: string
  name: string
  quantity?: number
  revisionNote?: string
  status: PhotoVideoDeliverableStatus
  usedRevisionRounds: number
}
export type PhotoVideoDeliverableTracking = { deliverables: PhotoVideoDeliverableRecord[]; initializedAt?: string }
type Result = { message?: string; ok: boolean; tracking?: PhotoVideoDeliverableTracking }

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown, limit = 3000) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const whole = (value: unknown) => Math.max(0, Math.floor(Number(value) || 0))
const statuses = new Set<PhotoVideoDeliverableStatus>(['awaiting_event', 'editing', 'ready_for_review', 'revision_requested', 'completed'])

export const photoVideoDeliverableTrackingFrom = (value: unknown): PhotoVideoDeliverableTracking => {
  const source = object(value)
  const rows = Array.isArray(source.deliverables) ? source.deliverables : []
  return {
    initializedAt: text(source.initializedAt, 80) || undefined,
    deliverables: rows.map(object).flatMap((row) => {
      const id = text(row.id, 100)
      const name = text(row.name, 250)
      if (!id || !name) return []
      return [{
        additionalPaidRevisionRequested: row.additionalPaidRevisionRequested === true || undefined,
        deliveryMethod: text(row.deliveryMethod, 160) || undefined,
        deliveryReference: text(row.deliveryReference) || undefined,
        description: text(row.description) || undefined,
        expectedCompletionDate: text(row.expectedCompletionDate, 20) || undefined,
        id,
        includedRevisionRounds: whole(row.includedRevisionRounds),
        issueNote: text(row.issueNote) || undefined,
        name,
        quantity: whole(row.quantity) || undefined,
        revisionNote: text(row.revisionNote) || undefined,
        status: statuses.has(text(row.status) as PhotoVideoDeliverableStatus) ? text(row.status) as PhotoVideoDeliverableStatus : 'awaiting_event',
        usedRevisionRounds: whole(row.usedRevisionRounds),
      }]
    }),
  }
}

const call = async (name: string, args: Record<string, unknown>): Promise<Result> => {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { ok: false, message: error.message }
  const result = object(data)
  return { ok: true, tracking: photoVideoDeliverableTrackingFrom(result.tracking ?? result) }
}

export const savePhotoVideoDeliverableUpdate = (bookingId: string, update: Record<string, unknown>) =>
  call('save_my_photo_video_deliverable_update_v18', { target_booking_id: bookingId, target_update: update })

export const respondToPhotoVideoDeliverable = (bookingId: string, deliverableId: string, action: 'confirm_receipt' | 'request_revision' | 'approve_output' | 'report_issue', note = '') =>
  call('respond_to_my_photo_video_deliverable_v18', { target_action: action, target_booking_id: bookingId, target_deliverable_id: deliverableId, target_note: note })
