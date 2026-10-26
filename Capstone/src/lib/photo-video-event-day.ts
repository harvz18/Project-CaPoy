import { supabase } from './supabase'

export type PhotoVideoEventDayLog = { coverageStatus?: 'scheduled' | 'started' | 'completed'; entries: Array<Record<string, unknown>> }
type Result = { log?: PhotoVideoEventDayLog; message?: string; ok: boolean }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const photoVideoEventDayLogFrom = (value: unknown): PhotoVideoEventDayLog => {
  const source = object(value)
  return { coverageStatus: ['scheduled', 'started', 'completed'].includes(String(source.coverageStatus)) ? source.coverageStatus as PhotoVideoEventDayLog['coverageStatus'] : 'scheduled', entries: Array.isArray(source.entries) ? source.entries.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))) : [] }
}
const call = async (name: string, args: Record<string, unknown>): Promise<Result> => {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { ok: false, message: error.message }
  return { ok: true, log: photoVideoEventDayLogFrom(object(data).log ?? data) }
}
export const savePhotoVideoEventDayUpdate = (bookingId: string, update: Record<string, unknown>) => call('save_my_photo_video_event_day_update_v18', { target_booking_id: bookingId, target_update: update })
export const respondToPhotoVideoEventDayRequest = (bookingId: string, entryId: string, approve: boolean) => call('respond_to_my_photo_video_event_day_request_v18', { accept_request: approve, target_booking_id: bookingId, target_entry_id: entryId })
