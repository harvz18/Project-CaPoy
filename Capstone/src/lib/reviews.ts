import { supabase, supabaseConfig } from './supabase'

export type ReviewSentiment = 'negative' | 'positive'

export interface ServiceReview {
  comment: string
  confidence?: number
  createdAt: string
  id: string
  rating: number
  reason?: string
  sentiment: ReviewSentiment
  sentimentScore: number
  topicKeywords: string[]
}

export interface ServiceReviewGroup {
  count: number
  reviews: ServiceReview[]
  summary: string
  themes: string[]
}

export interface ServiceReviewInsights {
  analyzedCommentCount: number
  averageRating: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  negative: ServiceReviewGroup
  pendingCommentCount: number
  positive: ServiceReviewGroup
  totalRatings: number
}

export interface ServiceReviewSummaries {
  negative?: string
  positive?: string
}

const emptyDistribution = (): ServiceReviewInsights['distribution'] => ({
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
})

export const emptyServiceReviewInsights = (): ServiceReviewInsights => ({
  analyzedCommentCount: 0,
  averageRating: 0,
  distribution: emptyDistribution(),
  negative: { count: 0, reviews: [], summary: 'No critical comments yet.', themes: [] },
  pendingCommentCount: 0,
  positive: { count: 0, reviews: [], summary: 'No positive comments yet.', themes: [] },
  totalRatings: 0,
})

const recordFrom = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const topicKeywordsFrom = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return value.flatMap((topic) => {
    const keywords = recordFrom(topic).keywords
    return Array.isArray(keywords)
      ? keywords.filter((keyword): keyword is string => typeof keyword === 'string')
      : []
  })
}

const summaryStopwords = new Set([
  'ako', 'ang', 'at', 'ay', 'client', 'event', 'experience', 'feedback', 'gid', 'good',
  'ikaw', 'indi', 'ito', 'iyo', 'kag', 'kami', 'kay', 'ko', 'lang', 'man', 'mga',
  'mo', 'na', 'namin', 'naman', 'negative', 'ng', 'nga', 'nila', 'nito', 'on', 'or',
  'our', 'para', 'pero', 'po', 'positive', 'provider', 'really', 'rin', 'sa', 'sang',
  'service', 'siya', 'that', 'the', 'their', 'they', 'this', 'very', 'wala', 'was',
  'were', 'with', 'yung',
])

const topThemes = (reviews: ServiceReview[]) => {
  const counts = new Map<string, number>()

  reviews.forEach((review) => {
    new Set(
      review.topicKeywords
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length >= 3 && !summaryStopwords.has(keyword))
    )
      .forEach((keyword) => counts.set(keyword, (counts.get(keyword) ?? 0) + 1))
  })

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([keyword]) => keyword)
}

const naturalList = (values: string[]) => {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

const buildGroup = (
  sentiment: ReviewSentiment,
  reviews: ServiceReview[]
): ServiceReviewGroup => {
  const themes = topThemes(reviews)
  const singleClient = reviews.length === 1
  const subject = singleClient ? 'A client' : 'Most clients'
  const empty = sentiment === 'positive'
    ? 'No comments about what clients loved yet.'
    : 'No comments about what could improve yet.'
  const summary = themes.length
    ? sentiment === 'positive'
      ? `${subject} praised ${naturalList(themes)}.`
      : `${subject} mentioned concerns about ${naturalList(themes)}.`
    : sentiment === 'positive'
      ? `${subject} described a positive experience with this service.`
      : `${subject} shared suggestions for improving this service.`

  return {
    count: reviews.length,
    reviews,
    summary: reviews.length ? summary : empty,
    themes,
  }
}

export const fetchServiceReviewInsights = async (
  serviceId: string
): Promise<ServiceReviewInsights> => {
  if (!supabase || !supabaseConfig.isConfigured || !serviceId) {
    return emptyServiceReviewInsights()
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, created_at, analysis_status, sentiment_label, sentiment_score, topic_assignments, analysis_metadata'
    )
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false })

  if (error || !data) return emptyServiceReviewInsights()

  const distribution = emptyDistribution()
  let ratingTotal = 0
  let pendingCommentCount = 0
  const analyzedReviews: ServiceReview[] = []

  data.forEach((row) => {
    const rating = Number(row.rating)
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5] += 1
      ratingTotal += rating
    }

    const comment = typeof row.comment === 'string' ? row.comment.trim() : ''
    if (comment && row.analysis_status !== 'processed') pendingCommentCount += 1
    if (
      !comment ||
      row.analysis_status !== 'processed' ||
      (row.sentiment_label !== 'positive' && row.sentiment_label !== 'negative')
    ) {
      return
    }

    const metadata = recordFrom(row.analysis_metadata)
    analyzedReviews.push({
      comment,
      confidence: typeof metadata.confidence === 'number' ? metadata.confidence : undefined,
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
      id: String(row.id),
      rating,
      reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
      sentiment: row.sentiment_label,
      sentimentScore: typeof row.sentiment_score === 'number' ? row.sentiment_score : 0,
      topicKeywords: topicKeywordsFrom(row.topic_assignments),
    })
  })

  const positiveReviews = analyzedReviews.filter((review) => review.sentiment === 'positive')
  const negativeReviews = analyzedReviews.filter((review) => review.sentiment === 'negative')

  return {
    analyzedCommentCount: analyzedReviews.length,
    averageRating: data.length ? ratingTotal / data.length : 0,
    distribution,
    negative: buildGroup('negative', negativeReviews),
    pendingCommentCount,
    positive: buildGroup('positive', positiveReviews),
    totalRatings: data.length,
  }
}

export const fetchServiceReviewSummaries = async (
  serviceId: string
): Promise<ServiceReviewSummaries> => {
  if (!supabase || !supabaseConfig.isConfigured || !serviceId) return {}

  const { data, error } = await supabase.functions.invoke('summarize-reviews', {
    body: { serviceId },
  })
  if (error || !data || typeof data !== 'object') return {}

  const summaries = recordFrom(recordFrom(data).summaries)
  return {
    negative:
      typeof summaries.negative === 'string' && summaries.negative.trim()
        ? summaries.negative.trim()
        : undefined,
    positive:
      typeof summaries.positive === 'string' && summaries.positive.trim()
        ? summaries.positive.trim()
        : undefined,
  }
}
