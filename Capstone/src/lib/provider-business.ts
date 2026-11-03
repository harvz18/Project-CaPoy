import { supabase, supabaseConfig } from './supabase'

export interface ProviderBusinessRating {
  averageRating?: number
  reviewCount: number
}

export const emptyProviderBusinessRating = (): ProviderBusinessRating => ({
  reviewCount: 0,
})

/**
 * Reads the V23 provider-wide, review-weighted aggregate. The RPC deliberately
 * returns no individual reviews, comments, reviewer identity, or sentiment.
 */
export const fetchProviderBusinessRating = async (
  providerId: string
): Promise<ProviderBusinessRating> => {
  if (!supabase || !supabaseConfig.isConfigured || !providerId) {
    return emptyProviderBusinessRating()
  }

  const { data, error } = await supabase.rpc('get_provider_business_rating_v23', {
    p_provider_id: providerId,
  })
  if (error || !Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
    return emptyProviderBusinessRating()
  }

  const row = data[0] as Record<string, unknown>
  const reviewCount = Number(row.review_count)
  const averageRating = Number(row.average_rating)
  if (!Number.isInteger(reviewCount) || reviewCount < 1 || !Number.isFinite(averageRating)) {
    return emptyProviderBusinessRating()
  }

  return {
    averageRating: Math.min(5, Math.max(1, averageRating)),
    reviewCount,
  }
}
