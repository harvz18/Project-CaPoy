import { supabase, supabaseConfig } from './supabase'

export type ReviewedService = {
  bookingId: string
  eventDate?: string
  eventName?: string
  id: string
  imageUrl?: string
  isAvailable: boolean
  marketplacePrice?: number
  providerName: string
  rating: number
  reviewDate: string
  reviewPreview?: string
  serviceId?: string
  serviceName: string
}

const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim()
  ? value.trim()
  : fallback

const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? value
  : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : 0

export const fetchMyReviewedServices = async (): Promise<ReviewedService[]> => {
  if (!supabase || !supabaseConfig.isConfigured) return []
  // v23 adds the immutable client-facing booking total used by the reviewed
  // history cards. Keep the V22 fallback for a brief rolling-deployment
  // window so this client still displays existing review history if the app
  // update reaches a device before the additive database migration.
  let { data, error } = await supabase.rpc('get_my_reviewed_services_v23')
  if (error) ({ data, error } = await supabase.rpc('get_my_reviewed_services_v22'))
  if (error || !Array.isArray(data)) return []

  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const id = text(row.review_id)
    if (!id) return []
    const rating = Math.round(number(row.rating))
    if (rating < 1 || rating > 5) return []
    return [{
      bookingId: text(row.booking_id),
      eventDate: text(row.event_date) || undefined,
      eventName: text(row.event_name) || undefined,
      id,
      imageUrl: text(row.image_url) || undefined,
      isAvailable: row.is_available === true,
      marketplacePrice: number(row.marketplace_price) > 0
        ? number(row.marketplace_price)
        : undefined,
      providerName: text(row.provider_name, 'Service provider'),
      rating,
      reviewDate: text(row.reviewed_at),
      reviewPreview: text(row.review_preview) || undefined,
      serviceId: text(row.service_id) || undefined,
      serviceName: text(row.service_name, 'Previously booked service'),
    }]
  })
}
