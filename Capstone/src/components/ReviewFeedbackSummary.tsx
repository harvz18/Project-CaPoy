import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import type { ReviewSentiment, ServiceReviewInsights } from '../lib/reviews'
import { Text } from './AppText'

interface ReviewFeedbackSummaryProps {
  insights?: ServiceReviewInsights
  isLoading?: boolean
  isWide?: boolean
  showReviewComments?: boolean
}

/**
 * Shared, privacy-conscious review presentation. It leads with the verified
 * rating distribution and the summarized feedback, while detail screens can
 * opt into the individual comments when that is appropriate.
 */
export const ReviewFeedbackSummary: React.FC<ReviewFeedbackSummaryProps> = ({
  insights,
  isLoading = false,
  isWide = false,
  showReviewComments = true,
}) => {
  const [expandedSentiment, setExpandedSentiment] = React.useState<ReviewSentiment>()

  React.useEffect(() => {
    setExpandedSentiment(undefined)
  }, [insights?.totalRatings])

  if (isLoading) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Loading verified feedback...</Text>
      </View>
    )
  }

  if (!insights || insights.totalRatings === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No reviews yet</Text>
        <Text style={styles.emptyCopy}>
          Ratings and summarized feedback will appear after clients complete bookings.
        </Text>
      </View>
    )
  }

  return (
    <>
      <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
        <View style={styles.ratingCard}>
          <Text style={styles.bigRating}>{insights.averageRating.toFixed(1)}</Text>
          <Text style={styles.summaryStars}>
            {'\u2605'.repeat(Math.round(insights.averageRating))}
            {'\u2606'.repeat(5 - Math.round(insights.averageRating))}
          </Text>
          <Text style={styles.reviewCount}>
            {insights.totalRatings} {insights.totalRatings === 1 ? 'RATING' : 'RATINGS'}
          </Text>
        </View>

        <View style={styles.distributionList}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = insights.distribution[rating as 1 | 2 | 3 | 4 | 5]
            const width = `${Math.round((count / insights.totalRatings) * 100)}%` as const

            return (
              <View key={rating} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{rating}</Text>
                <View style={styles.distributionTrack}>
                  <View style={[styles.distributionFill, { width }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.sentimentGrid}>
        {(['positive', 'negative'] as const).map((sentiment) => {
          const group = insights[sentiment]
          const expanded = expandedSentiment === sentiment
          const positive = sentiment === 'positive'
          const canExpand = showReviewComments && group.reviews.length > 0

          return (
            <View key={sentiment}>
              <Pressable
                accessibilityLabel={
                  canExpand
                    ? `${expanded ? 'Hide' : 'Show'} all ${positive ? 'good' : 'critical'} comments`
                    : `${positive ? 'Positive' : 'Critical'} feedback summary`
                }
                accessibilityRole={canExpand ? 'button' : undefined}
                accessibilityState={canExpand ? { expanded } : undefined}
                disabled={!canExpand}
                onPress={() => {
                  if (canExpand) setExpandedSentiment(expanded ? undefined : sentiment)
                }}
                style={({ pressed }) => [
                  styles.sentimentCard,
                  positive ? styles.positiveCard : styles.negativeCard,
                  canExpand && pressed && styles.sentimentCardPressed,
                ]}
              >
                <View style={styles.sentimentHeadingRow}>
                  <Text style={styles.sentimentIcon}>{positive ? '\u2665' : '!'}</Text>
                  <Text style={styles.sentimentHeading}>
                    {positive ? 'WHAT CLIENTS LOVED' : 'WHAT COULD IMPROVE'}
                  </Text>
                  <Text style={styles.sentimentCount}>{group.count}</Text>
                </View>
                <Text style={styles.sentimentSummary}>{group.summary}</Text>
                {canExpand ? (
                  <Text style={styles.sentimentAction}>
                    {expanded
                      ? 'HIDE COMMENTS'
                      : `READ ALL ${group.count} ${positive ? 'GOOD' : 'CRITICAL'} COMMENTS`}
                  </Text>
                ) : null}
              </Pressable>

              {canExpand && expanded ? (
                <View style={styles.sentimentReviewList}>
                  {group.reviews.map((review) => (
                    <View key={review.id} style={styles.sentimentReviewItem}>
                      <View style={styles.sentimentReviewHeader}>
                        <View>
                          <Text style={styles.reviewerName}>Verified client</Text>
                          <Text style={styles.reviewerMeta}>
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString('en-PH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Completed booking'}
                          </Text>
                        </View>
                        <Text style={styles.reviewStars}>
                          {'\u2605'.repeat(review.rating)}
                          {'\u2606'.repeat(5 - review.rating)}
                        </Text>
                      </View>
                      <Text style={styles.reviewCopy}>{review.comment}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      <Text style={styles.analysisCaption}>SUMMARY OF VERIFIED CLIENT FEEDBACK</Text>
      {insights.pendingCommentCount > 0 ? (
        <Text style={styles.pendingAnalysisCopy}>
          {insights.pendingCommentCount}{' '}
          {insights.pendingCommentCount === 1 ? 'comment is' : 'comments are'} still being analyzed.
        </Text>
      ) : null}
    </>
  )
}

const palette = {
  gold: '#B57910',
  primary: '#4E061A',
  secondary: '#5E5E5E',
  surfaceHigh: '#E3E2E2',
  surfaceLowest: '#FFFFFF',
  surfaceVariant: '#E4D8DA',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
    padding: 28,
  },
  emptyTitle: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  emptyCopy: {
    maxWidth: 480,
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  reviewSummary: { gap: 24, marginBottom: 24 },
  reviewSummaryWide: { flexDirection: 'row', gap: 32 },
  ratingCard: {
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
    padding: 24,
  },
  bigRating: { color: palette.primary, fontSize: 56, lineHeight: 58, fontWeight: '700', marginBottom: 8 },
  summaryStars: { color: palette.gold, fontSize: 22, lineHeight: 25, letterSpacing: 1, marginBottom: 8 },
  reviewCount: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1 },
  distributionList: { flex: 1, justifyContent: 'center', gap: 12 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distributionLabel: { width: 14, color: palette.secondary, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  distributionTrack: { height: 12, flex: 1, overflow: 'hidden', borderRadius: 6, backgroundColor: palette.surfaceHigh },
  distributionFill: { height: '100%', borderRadius: 6, backgroundColor: palette.primary },
  distributionCount: { width: 24, color: palette.secondary, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  sentimentGrid: { gap: 14 },
  sentimentCard: { borderWidth: 1, borderRadius: 16, padding: 20 },
  positiveCard: { borderColor: '#B8D9C4', backgroundColor: '#F2FAF5' },
  negativeCard: { borderColor: '#E6C4C8', backgroundColor: '#FCF5F6' },
  sentimentCardPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  sentimentHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sentimentIcon: { width: 22, color: palette.primary, fontSize: 18, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  sentimentHeading: { flex: 1, color: palette.primary, fontSize: 12, lineHeight: 17, fontWeight: '800', letterSpacing: 1 },
  sentimentCount: { minWidth: 28, color: palette.primary, fontSize: 13, lineHeight: 19, fontWeight: '800', textAlign: 'right' },
  sentimentSummary: { color: palette.text, fontSize: 15, lineHeight: 23, marginTop: 11 },
  sentimentAction: { color: palette.primary, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, marginTop: 13 },
  sentimentReviewList: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: palette.surfaceVariant,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 18,
  },
  sentimentReviewItem: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 18 },
  sentimentReviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  reviewerName: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  reviewerMeta: { color: palette.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
  reviewStars: { color: palette.gold, fontSize: 16, lineHeight: 19, letterSpacing: 0.5 },
  reviewCopy: { color: palette.text, fontSize: 15, lineHeight: 23 },
  analysisCaption: { color: palette.secondary, fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center', marginTop: 16 },
  pendingAnalysisCopy: { color: palette.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
})
