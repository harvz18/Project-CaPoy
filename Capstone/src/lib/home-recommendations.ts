import type { CatalogService } from './catalog'

export type HomeServiceRecommendation = {
  indicator: string
  score: number
  service: CatalogService
}

const valueOrZero = (value: number | undefined) =>
  Number.isFinite(value) && value && value > 0 ? value : 0

/**
 * Ranks active marketplace services using the aggregate decision signals
 * already supplied by the database. Booking counts originate from paid,
 * confirmed, and completed bookings only; cancelled, rejected, and duplicate
 * booking rows are excluded by the source RPC.
 *
 * Ratings are reliability-weighted instead of using a made-up rating prior:
 * a five-star review carries only 1/8 of the rating weight, while eight or
 * more reviews receive full weight. This prevents a single review from
 * outranking an established well-reviewed service by itself.
 * Processed positive/negative review sentiment is optional and contributes
 * at most 0.4 points, so it can resolve close results without displacing
 * booking history or reliable ratings.
 */
export const rankHomeRecommendations = (
  services: ReadonlyArray<CatalogService>,
  limit = 6
): HomeServiceRecommendation[] => services
  .filter((service) => service.kind !== 'coordinator' && service.isMock !== true)
  .map((service) => {
    const bookingCount = valueOrZero(service.bookingCount)
    const reviewCount = valueOrZero(service.reviewCount)
    const positiveSentimentCount = valueOrZero(service.positiveSentimentCount)
    const negativeSentimentCount = valueOrZero(service.negativeSentimentCount)
    const averageRating = Math.min(5, Math.max(0, Number.parseFloat(service.rating) || 0))
    const reviewReliability = Math.min(1, reviewCount / 8)
    const analyzedSentimentCount = positiveSentimentCount + negativeSentimentCount
    const sentimentReliability = Math.min(1, analyzedSentimentCount / 5)
    const bookingScore = Math.log1p(bookingCount) * 3
    const ratingScore = (averageRating / 5) * reviewReliability * 4
    const reviewDepthScore = Math.log1p(reviewCount) * 0.25
    const sentimentScore = analyzedSentimentCount > 0
      ? ((positiveSentimentCount - negativeSentimentCount) / analyzedSentimentCount + 1)
        * sentimentReliability * 0.2
      : 0
    const popularityTieBreaker = service.popularityRank && service.popularityRank > 0
      ? 0.1 / service.popularityRank
      : 0
    const indicator = bookingCount >= 3
      ? 'Popular choice'
      : positiveSentimentCount >= 3 && positiveSentimentCount > negativeSentimentCount
        ? 'Positive feedback'
      : reviewCount >= 5 && averageRating >= 4
        ? 'Well reviewed'
        : bookingCount > 0
          ? 'Booked by clients'
          : reviewCount > 0
            ? 'Client rated'
            : 'New service'

    return {
      indicator,
      score: bookingScore + ratingScore + reviewDepthScore + sentimentScore + popularityTieBreaker,
      service,
    }
  })
  .sort((left, right) =>
    right.score - left.score
    || valueOrZero(right.service.bookingCount) - valueOrZero(left.service.bookingCount)
    || valueOrZero(right.service.reviewCount) - valueOrZero(left.service.reviewCount)
    || left.service.name.localeCompare(right.service.name)
  )
  .slice(0, Math.max(0, limit))
