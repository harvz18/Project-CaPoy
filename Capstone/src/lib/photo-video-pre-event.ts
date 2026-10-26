import { supabase } from './supabase'

export type PhotoVideoPreEventPlan = {
  clientConfirmedAt?: string
  contactPerson?: string
  coverageEnd?: string
  coverageStart?: string
  crewAssignments?: string
  eventDateConfirmed?: boolean
  preparationLocation?: string
  providerConfirmedAt?: string
  receptionLocation?: string
  requiredEquipment?: string
  ceremonyLocation?: string
  shotList?: string
  specialAccessRequirements?: string
  timelineNotes?: string
  venueAddresses?: string
}

type Result = { message?: string; ok: boolean; plan?: PhotoVideoPreEventPlan }

const text = (value: unknown, limit = 1000) => typeof value === 'string' ? value.trim().slice(0, limit) : ''
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {}

export const photoVideoPreEventPlanFrom = (value: unknown): PhotoVideoPreEventPlan => {
  const source = record(value)
  return {
    clientConfirmedAt: text(source.clientConfirmedAt, 80) || undefined,
    contactPerson: text(source.contactPerson) || undefined,
    coverageEnd: text(source.coverageEnd, 12) || undefined,
    coverageStart: text(source.coverageStart, 12) || undefined,
    crewAssignments: text(source.crewAssignments, 3000) || undefined,
    eventDateConfirmed: source.eventDateConfirmed === true,
    preparationLocation: text(source.preparationLocation) || undefined,
    providerConfirmedAt: text(source.providerConfirmedAt, 80) || undefined,
    receptionLocation: text(source.receptionLocation) || undefined,
    requiredEquipment: text(source.requiredEquipment, 3000) || undefined,
    ceremonyLocation: text(source.ceremonyLocation) || undefined,
    shotList: text(source.shotList, 5000) || undefined,
    specialAccessRequirements: text(source.specialAccessRequirements, 3000) || undefined,
    timelineNotes: text(source.timelineNotes, 3000) || undefined,
    venueAddresses: text(source.venueAddresses, 3000) || undefined,
  }
}

const call = async (name: string, args: Record<string, unknown>): Promise<Result> => {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { ok: false, message: error.message }
  const result = record(data)
  return { ok: true, plan: photoVideoPreEventPlanFrom(result.plan ?? result) }
}

export const savePhotoVideoPreEventPlan = (bookingId: string, plan: PhotoVideoPreEventPlan) =>
  call('save_my_photo_video_pre_event_plan_v18', { target_booking_id: bookingId, target_plan: plan })

export const savePhotoVideoShotList = (bookingId: string, shotList: string) =>
  call('save_my_photo_video_shot_list_v18', { target_booking_id: bookingId, target_shot_list: shotList })

export const confirmPhotoVideoPreEventPlan = (bookingId: string) =>
  call('confirm_my_photo_video_pre_event_plan_v18', { target_booking_id: bookingId })
