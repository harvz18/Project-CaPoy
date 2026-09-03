import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type ReviewPerformancePeriod = '30d' | '90d' | 'all'
export type ReviewSentiment = 'positive' | 'neutral' | 'negative'
export type ReviewRatingFilter = 'all' | 1 | 2 | 3 | 4 | 5

export interface MerchantPerformanceReview {
  comment: string
  createdAt: string
  id: string
  merchantReply?: string
  rating: number
  reviewerName: string
  serviceName: string
  tags: string[]
}

export interface ReviewMention {
  count: number
  label: string
}

export interface ReviewPerformanceSummary {
  averageRating: number
  frequentMentions: ReviewMention[]
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>
  ratingChange: number
  responseRate: number
  sentiment: Record<ReviewSentiment, number>
  totalReviews: number
}

interface ReviewPerformanceScreenProps {
  aiInsight?: string
  initialPeriod?: ReviewPerformancePeriod
  onBack?: () => void
  onOpenAccount?: () => void
  onPeriodChange?: (period: ReviewPerformancePeriod) => void
  onReplyToReview?: (review: MerchantPerformanceReview) => void
  onSelectReview?: (review: MerchantPerformanceReview) => void
  reviews?: MerchantPerformanceReview[]
  summary?: ReviewPerformanceSummary
}

const periodOptions: Array<{ id: ReviewPerformancePeriod; label: string }> = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
]

const ratingFilters: Array<{ id: ReviewRatingFilter; label: string }> = [
  { id: 'all', label: 'All reviews' },
  { id: 5, label: '5 stars' },
  { id: 4, label: '4 stars' },
  { id: 3, label: '3 stars' },
  { id: 2, label: '2 stars' },
  { id: 1, label: '1 star' },
]

const defaultSummary: ReviewPerformanceSummary = {
  averageRating: 4.8,
  frequentMentions: [
    { label: 'Professional', count: 87 },
    { label: 'Beautiful setup', count: 64 },
    { label: 'Responsive', count: 51 },
    { label: 'Great value', count: 42 },
  ],
  ratingCounts: { 1: 1, 2: 1, 3: 3, 4: 12, 5: 107 },
  ratingChange: 0.2,
  responseRate: 92,
  sentiment: { positive: 91, neutral: 6, negative: 3 },
  totalReviews: 124,
}

const defaultReviews: MerchantPerformanceReview[] = [
  {
    comment:
      'The team was professional from planning through teardown. Every arrangement looked beautiful and matched our venue perfectly.',
    createdAt: '2026-08-28',
    id: 'review-maria',
    merchantReply:
      'Thank you, Maria. It was a pleasure helping bring your celebration to life!',
    rating: 5,
    reviewerName: 'Maria Santos',
    serviceName: 'Premium Floral Design',
    tags: ['Professional', 'Beautiful setup'],
  },
  {
    comment:
      'Communication was quick and the team arrived right on time. The package was a great value for our intimate wedding.',
    createdAt: '2026-08-19',
    id: 'review-anna',
    rating: 5,
    reviewerName: 'Anna Reyes',
    serviceName: 'Signature Event Styling',
    tags: ['Responsive', 'Great value', 'On time'],
  },
  {
    comment:
      'The final setup was lovely. I would have appreciated a little more clarity about the replacement flowers, but the result still photographed well.',
    createdAt: '2026-08-07',
    id: 'review-jerome',
    rating: 4,
    reviewerName: 'Jerome Cruz',
    serviceName: 'Garden Ceremony Package',
    tags: ['Beautiful setup'],
  },
  {
    comment:
      'Everything was handled smoothly, and our coordinator always knew what was happening next.',
    createdAt: '2026-07-25',
    id: 'review-camille',
    merchantReply: 'We appreciate your kind feedback, Camille. Congratulations again!',
    rating: 5,
    reviewerName: 'Camille Lim',
    serviceName: 'Full Venue Styling',
    tags: ['Professional', 'Responsive'],
  },
]

const defaultAiInsight =
  'Clients most often praise professional service, responsive communication, and polished event setups. Recent lower ratings primarily mention expectation-setting before substitutions or package changes.'

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const AccountIcon = () => (
  <View style={styles.accountIcon}>
    <View style={styles.accountHead} />
    <View style={styles.accountShoulders} />
  </View>
)

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value))

export const ReviewPerformanceScreen: React.FC<ReviewPerformanceScreenProps> = ({
  aiInsight = defaultAiInsight,
  initialPeriod = '90d',
  onBack,
  onOpenAccount,
  onPeriodChange,
  onReplyToReview,
  onSelectReview,
  reviews = defaultReviews,
  summary = defaultSummary,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [period, setPeriod] = React.useState(initialPeriod)
  const [ratingFilter, setRatingFilter] = React.useState<ReviewRatingFilter>('all')

  const visibleReviews = reviews.filter(
    (review) => ratingFilter === 'all' || Math.round(review.rating) === ratingFilter
  )

  const handlePeriodChange = (nextPeriod: ReviewPerformancePeriod) => {
    setPeriod(nextPeriod)
    onPeriodChange?.(nextPeriod)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Review Performance
          </Text>
          <Pressable
            accessibilityLabel="Open account"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <AccountIcon />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.intro, isWide && styles.introWide]}>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Review Performance</Text>
            <Text style={styles.subtitle}>
              Understand what clients value and where your service can improve.
            </Text>
          </View>
          <View accessibilityRole="tablist" style={styles.periodSelector}>
            {periodOptions.map((option) => {
              const selected = period === option.id
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => handlePeriodChange(option.id)}
                  style={({ pressed }) => [
                    styles.periodOption,
                    selected && styles.periodOptionSelected,
                    pressed && styles.periodOptionPressed,
                  ]}
                >
                  <Text style={[styles.periodText, selected && styles.periodTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard
            accent
            detail={`${summary.ratingChange >= 0 ? '+' : ''}${summary.ratingChange.toFixed(1)} from previous period`}
            label="Average Rating"
            value={`${summary.averageRating.toFixed(1)} / 5`}
          />
          <MetricCard
            detail="Published client reviews"
            label="Total Reviews"
            value={String(summary.totalReviews)}
          />
          <MetricCard
            detail="Reviews with a merchant reply"
            label="Response Rate"
            value={`${Math.round(summary.responseRate)}%`}
          />
        </View>

        <View style={[styles.analyticsGrid, isWide && styles.analyticsGridWide]}>
          <View style={styles.ratingCard}>
            <View style={styles.cardHeading}>
              <View>
                <Text style={styles.cardTitle}>Rating Breakdown</Text>
                <Text style={styles.cardSubtitle}>{summary.totalReviews} verified reviews</Text>
              </View>
              <View style={styles.averageGroup}>
                <Text style={styles.averageValue}>{summary.averageRating.toFixed(1)}</Text>
                <StarRating rating={summary.averageRating} size={16} />
              </View>
            </View>

            <View style={styles.distributionList}>
              {([5, 4, 3, 2, 1] as const).map((rating) => {
                const count = summary.ratingCounts[rating]
                const percentage =
                  summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0

                return (
                  <View key={rating} style={styles.distributionRow}>
                    <Text style={styles.distributionLabel}>{rating}</Text>
                    <Text style={styles.distributionStar}>{'\u2605'}</Text>
                    <View style={styles.distributionTrack}>
                      <View
                        style={[
                          styles.distributionFill,
                          { width: `${clampPercentage(percentage)}%` as `${number}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.distributionCount}>{count}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.insightColumn}>
            <View style={styles.sentimentCard}>
              <Text style={styles.cardTitle}>Customer Sentiment</Text>
              <View style={styles.sentimentBar}>
                <View
                  style={[
                    styles.sentimentPositive,
                    { width: `${clampPercentage(summary.sentiment.positive)}%` as `${number}%` },
                  ]}
                />
                <View
                  style={[
                    styles.sentimentNeutral,
                    { width: `${clampPercentage(summary.sentiment.neutral)}%` as `${number}%` },
                  ]}
                />
                <View
                  style={[
                    styles.sentimentNegative,
                    { width: `${clampPercentage(summary.sentiment.negative)}%` as `${number}%` },
                  ]}
                />
              </View>
              <View style={styles.sentimentLegend}>
                <SentimentItem
                  color={palette.positive}
                  label="Positive"
                  value={summary.sentiment.positive}
                />
                <SentimentItem
                  color={palette.neutral}
                  label="Neutral"
                  value={summary.sentiment.neutral}
                />
                <SentimentItem
                  color={palette.negative}
                  label="Negative"
                  value={summary.sentiment.negative}
                />
              </View>
            </View>

            <View style={styles.mentionsCard}>
              <Text style={styles.cardTitle}>Frequently Mentioned</Text>
              <View style={styles.mentionList}>
                {summary.frequentMentions.map((mention) => (
                  <View key={mention.label} style={styles.mentionChip}>
                    <Text style={styles.mentionLabel}>{mention.label}</Text>
                    <Text style={styles.mentionCount}>{mention.count}</Text>
                  </View>
                ))}
              </View>
            </View>

            {aiInsight.trim() ? (
              <View style={styles.aiCard}>
                <View style={styles.aiHeading}>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI INSIGHT</Text>
                  </View>
                  <Text style={styles.aiSource}>Based on customer reviews</Text>
                </View>
                <Text style={styles.aiInsight}>{aiInsight}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeading}>
            <View>
              <Text style={styles.sectionTitle}>Recent Reviews</Text>
              <Text style={styles.sectionSubtitle}>Read feedback and respond to clients.</Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.ratingFilters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {ratingFilters.map((filter) => {
              const selected = ratingFilter === filter.id
              return (
                <Pressable
                  key={filter.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setRatingFilter(filter.id)}
                  style={({ pressed }) => [
                    styles.ratingFilter,
                    selected && styles.ratingFilterSelected,
                    pressed && styles.ratingFilterPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.ratingFilterText,
                      selected && styles.ratingFilterTextSelected,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={styles.reviewList}>
            {visibleReviews.length > 0 ? (
              visibleReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  onReply={() => onReplyToReview?.(review)}
                  onSelect={() => onSelectReview?.(review)}
                  review={review}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No reviews match this filter.</Text>
                <Text style={styles.emptyCopy}>Choose another rating to see more feedback.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const MetricCard = ({
  accent = false,
  detail,
  label,
  value,
}: {
  accent?: boolean
  detail: string
  label: string
  value: string
}) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
    <Text style={styles.metricDetail}>{detail}</Text>
  </View>
)

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View
    accessibilityLabel={`${rating.toFixed(1)} out of 5 stars`}
    style={styles.starRow}
  >
    {[1, 2, 3, 4, 5].map((star) => (
      <Text
        key={star}
        style={[
          styles.star,
          { fontSize: size, lineHeight: size + 3 },
          star <= Math.round(rating) && styles.starActive,
        ]}
      >
        {star <= Math.round(rating) ? '\u2605' : '\u2606'}
      </Text>
    ))}
  </View>
)

const SentimentItem = ({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) => (
  <View style={styles.sentimentItem}>
    <View style={[styles.sentimentDot, { backgroundColor: color }]} />
    <Text style={styles.sentimentLabel}>{label}</Text>
    <Text style={styles.sentimentValue}>{Math.round(value)}%</Text>
  </View>
)

const ReviewCard = ({
  onReply,
  onSelect,
  review,
}: {
  onReply: () => void
  onSelect: () => void
  review: MerchantPerformanceReview
}) => (
  <View style={styles.reviewCard}>
    <Pressable
      accessibilityLabel={`Open review from ${review.reviewerName}`}
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [styles.reviewMain, pressed && styles.reviewMainPressed]}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerIdentity}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerAvatarText}>{getInitials(review.reviewerName)}</Text>
          </View>
          <View style={styles.reviewerCopy}>
            <Text style={styles.reviewerName}>{review.reviewerName}</Text>
            <Text style={styles.reviewService}>{review.serviceName}</Text>
          </View>
        </View>
        <View style={styles.reviewMeta}>
          <StarRating rating={review.rating} />
          <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
        </View>
      </View>

      <Text style={styles.reviewComment}>{review.comment}</Text>
      {review.tags.length > 0 ? (
        <View style={styles.reviewTags}>
          {review.tags.map((tag) => (
            <View key={tag} style={styles.reviewTag}>
              <Text style={styles.reviewTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>

    {review.merchantReply ? (
      <View style={styles.replyBlock}>
        <Text style={styles.replyLabel}>YOUR REPLY</Text>
        <Text style={styles.replyText}>{review.merchantReply}</Text>
      </View>
    ) : null}

    <View style={styles.reviewFooter}>
      <Pressable
        accessibilityLabel={`${review.merchantReply ? 'Edit reply to' : 'Reply to'} ${review.reviewerName}`}
        accessibilityRole="button"
        onPress={onReply}
        style={({ pressed }) => [styles.replyButton, pressed && styles.replyButtonPressed]}
      >
        <Text style={styles.replyButtonText}>{review.merchantReply ? 'Edit Reply' : 'Reply'}</Text>
      </Pressable>
    </View>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  negative: '#BA1A1A',
  negativeSoft: '#FFDAD6',
  neutral: '#A77B30',
  neutralSoft: '#F6E7CA',
  onPrimary: '#FFFFFF',
  placeholder: '#A8A8A9',
  positive: '#2F6B46',
  positiveSoft: '#E7F3EB',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 30,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1100,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  iconButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
  headerTitle: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: {
    position: 'absolute',
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: palette.primary,
    transform: [{ rotate: '45deg' }],
  },
  backIconShaft: {
    width: 16,
    height: 1.8,
    marginLeft: 4,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  accountIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    borderWidth: 1.7,
    borderColor: palette.primary,
    borderRadius: 12,
  },
  accountHead: {
    position: 'absolute',
    top: 4,
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: 4,
  },
  accountShoulders: {
    position: 'absolute',
    bottom: 3,
    width: 14,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: palette.primary,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 64 },
  intro: { gap: 16, marginBottom: 24 },
  introWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  introCopy: { minWidth: 0, flex: 1 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  subtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 5 },
  periodSelector: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.white,
    padding: 3,
  },
  periodOption: { minHeight: 34, justifyContent: 'center', borderRadius: 6, paddingHorizontal: 12 },
  periodOptionSelected: { backgroundColor: palette.primaryContainer },
  periodOptionPressed: { opacity: 0.7 },
  periodText: { color: palette.secondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  periodTextSelected: { color: palette.onPrimary },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  metricCard: {
    minWidth: 150,
    minHeight: 112,
    flexBasis: '30%',
    flexGrow: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 16,
  },
  metricLabel: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
  metricValue: { color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '700', marginVertical: 5 },
  metricValueAccent: { color: palette.primaryContainer },
  metricDetail: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  analyticsGrid: { gap: 16, marginBottom: 32 },
  analyticsGridWide: { flexDirection: 'row', alignItems: 'stretch' },
  ratingCard: {
    minWidth: 0,
    flex: 1.05,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    padding: 18,
  },
  insightColumn: { minWidth: 0, flex: 0.95, gap: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  cardTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  cardSubtitle: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  averageGroup: { alignItems: 'flex-end' },
  averageValue: { color: palette.primaryContainer, fontSize: 28, lineHeight: 32, fontWeight: '700' },
  starRow: { flexDirection: 'row' },
  star: { color: palette.placeholder },
  starActive: { color: '#A77B30' },
  distributionList: { gap: 10, marginTop: 22 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  distributionLabel: { width: 10, color: palette.secondary, fontSize: 12, lineHeight: 16, textAlign: 'right' },
  distributionStar: { color: '#A77B30', fontSize: 12, lineHeight: 16 },
  distributionTrack: { height: 8, flex: 1, overflow: 'hidden', borderRadius: 4, backgroundColor: palette.surfaceContainerLow },
  distributionFill: { height: '100%', borderRadius: 4, backgroundColor: palette.primaryContainer },
  distributionCount: { width: 28, color: palette.secondary, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  sentimentCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 16 },
  sentimentBar: { height: 10, flexDirection: 'row', overflow: 'hidden', borderRadius: 5, marginTop: 14 },
  sentimentPositive: { height: '100%', backgroundColor: palette.positive },
  sentimentNeutral: { height: '100%', backgroundColor: palette.neutral },
  sentimentNegative: { height: '100%', backgroundColor: palette.negative },
  sentimentLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  sentimentItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sentimentDot: { width: 7, height: 7, borderRadius: 4 },
  sentimentLabel: { color: palette.secondary, fontSize: 11, lineHeight: 15 },
  sentimentValue: { color: palette.text, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  mentionsCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 16 },
  mentionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  mentionChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 10, paddingVertical: 6 },
  mentionLabel: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  mentionCount: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  aiCard: { borderLeftWidth: 4, borderLeftColor: palette.primaryContainer, borderRadius: 8, backgroundColor: palette.primarySoft, padding: 14 },
  aiHeading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  aiBadge: { borderRadius: 4, backgroundColor: palette.primaryContainer, paddingHorizontal: 7, paddingVertical: 3 },
  aiBadgeText: { color: palette.onPrimary, fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 },
  aiSource: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  aiInsight: { color: palette.text, fontSize: 12, lineHeight: 18, marginTop: 9 },
  reviewsSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 28 },
  reviewsHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  sectionSubtitle: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  ratingFilters: { gap: 8, paddingVertical: 16 },
  ratingFilter: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 999, backgroundColor: palette.white, paddingHorizontal: 13 },
  ratingFilterSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primarySoft },
  ratingFilterPressed: { opacity: 0.65 },
  ratingFilterText: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
  ratingFilterTextSelected: { color: palette.primaryContainer, fontWeight: '600' },
  reviewList: { gap: 12 },
  reviewCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white },
  reviewMain: { padding: 16 },
  reviewMainPressed: { backgroundColor: palette.surfaceContainerLow },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reviewerIdentity: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewerAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: palette.primarySoft },
  reviewerAvatarText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  reviewerCopy: { minWidth: 0, flex: 1 },
  reviewerName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  reviewService: { color: palette.secondary, fontSize: 11, lineHeight: 15, marginTop: 1 },
  reviewMeta: { alignItems: 'flex-end' },
  reviewDate: { color: palette.secondary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  reviewComment: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 14 },
  reviewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  reviewTag: { borderRadius: 999, backgroundColor: palette.surfaceContainerLow, paddingHorizontal: 9, paddingVertical: 4 },
  reviewTagText: { color: palette.secondary, fontSize: 10, lineHeight: 14 },
  replyBlock: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceContainerLow, padding: 14 },
  replyLabel: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.6 },
  replyText: { color: palette.secondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  reviewFooter: { alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: palette.border, paddingHorizontal: 14, paddingVertical: 9 },
  replyButton: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  replyButtonPressed: { backgroundColor: palette.primarySoft },
  replyButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  emptyState: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 32 },
  emptyTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  emptyCopy: { color: palette.secondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 3 },
})
