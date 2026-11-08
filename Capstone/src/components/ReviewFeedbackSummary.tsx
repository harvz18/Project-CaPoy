import React from 'react'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Pressable, StyleSheet, View } from 'react-native'

import type { ReviewSentiment, ServiceReviewInsights } from '../lib/reviews'
import { animateOptionLayout } from '../theme/option-motion'
import { typography } from '../theme/typography'
import { Text } from './AppText'

interface ReviewFeedbackSummaryProps {
  insights?: ServiceReviewInsights
  isLoading?: boolean
  isWide?: boolean
  neumorphic?: boolean
  showReviewComments?: boolean
  serviceOverlay?: boolean
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
  neumorphic = false,
  showReviewComments = true,
  serviceOverlay = false,
}) => {
  const [expandedSentiments, setExpandedSentiments] = React.useState<Set<ReviewSentiment>>(() => new Set())

  React.useEffect(() => {
    setExpandedSentiments(new Set())
  }, [insights?.totalRatings])

  const toggleExpandedSentiment = (sentiment: ReviewSentiment, allowMultiple = false) => {
    animateOptionLayout()
    setExpandedSentiments((current) => {
      const next = new Set(current)
      if (next.has(sentiment)) next.delete(sentiment)
      else {
        if (!allowMultiple) next.clear()
        next.add(sentiment)
      }
      return next
    })
  }

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
        <View style={[styles.ratingCard, neumorphic && styles.neoRatingCard]}>
          <Text style={styles.bigRating}>{insights.averageRating.toFixed(1)}</Text>
          <View style={[styles.summaryStarsSurface, neumorphic && styles.neoRaisedStar]}>
            <Text numberOfLines={1} style={styles.summaryStars}>
              {'\u2605'.repeat(Math.round(insights.averageRating))}
              {'\u2606'.repeat(5 - Math.round(insights.averageRating))}
            </Text>
          </View>
          <Text style={styles.reviewCount}>
            {insights.totalRatings} {insights.totalRatings === 1 ? 'review' : 'reviews'}
          </Text>
        </View>

        <View style={styles.distributionList}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = insights.distribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0
            const width = `${Math.round((count / insights.totalRatings) * 100)}%` as const
            const ratingFillStyle =
              rating === 5
                ? styles.ratingFiveFill
                : rating === 4
                  ? styles.ratingFourFill
                  : rating === 3
                    ? styles.ratingThreeFill
                    : rating === 2
                      ? styles.ratingTwoFill
                      : styles.ratingOneFill

            return (
              <View key={rating} style={styles.distributionRow}>
                <Text numberOfLines={1} style={styles.distributionLabel}>
                  {rating} star{rating === 1 ? '' : 's'}
                </Text>
                <View style={[styles.distributionTrack, neumorphic && styles.neoInsetTrack]}>
                  <View style={[styles.distributionFill, neumorphic && styles.neoRaisedDistributionFill, ratingFillStyle, { width }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {serviceOverlay ? <Text style={styles.venueAnalysisHeading}>AI Feedback Analysis</Text> : null}

      <View style={styles.sentimentGrid}>
        {(['positive', 'negative'] as const).map((sentiment) => {
          const group = insights[sentiment]
          const expanded = expandedSentiments.has(sentiment)
          const positive = sentiment === 'positive'
          const canExpand = showReviewComments && group.reviews.length > 0
          const cardStyle = [
            styles.sentimentCard,
            neumorphic
              ? styles.neoSentimentCard
              : positive
                ? styles.positiveCard
                : styles.negativeCard,
            neumorphic && (positive ? styles.neoPositiveSentimentCard : styles.neoNegativeSentimentCard),
            serviceOverlay && styles.venueSentimentCard,
            serviceOverlay && (positive ? styles.venuePositiveSentimentCard : styles.venueNegativeSentimentCard),
          ]

          if (serviceOverlay) {
            return (
              <View key={sentiment} style={cardStyle}>
                <View style={styles.sentimentHeadingRow}>
                  <View style={[styles.sentimentThumbIcon, positive ? styles.positiveThumbIcon : styles.negativeThumbIcon]}>
                    <MaterialCommunityIcons color="#FFFFFF" name={positive ? 'thumb-up' : 'thumb-down'} size={16} />
                  </View>
                  <Text style={styles.sentimentHeading}>{positive ? 'WHAT CLIENTS LOVED' : 'WHAT COULD IMPROVE'}</Text>
                  <Text style={[styles.sentimentCount, styles.venueSentimentCount]}>
                    {group.count} {group.count === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
                <Text style={styles.sentimentSummary}>
                  {group.count === 0
                    ? positive
                      ? 'No positive feedback identified yet.'
                      : 'No critical feedback identified yet.'
                    : group.summary}
                </Text>
                {canExpand ? (
                  <Pressable
                    accessibilityLabel={`${expanded ? 'Hide' : 'View'} original ${positive ? 'positive' : 'critical'} feedback`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => toggleExpandedSentiment(sentiment, true)}
                    style={({ pressed }) => [styles.venueOriginalFeedbackAction, pressed && styles.venueOriginalFeedbackActionPressed]}
                  >
                    <Text style={styles.venueOriginalFeedbackActionText}>
                      {expanded ? 'Hide Original Feedback' : 'View Original Feedback'}
                    </Text>
                    <MaterialCommunityIcons color={palette.primary} name={expanded ? 'chevron-up' : 'chevron-down'} size={19} />
                  </Pressable>
                ) : null}
                {canExpand && expanded ? (
                  <View style={styles.venueOriginalFeedback}>
                    <Text style={styles.venueOriginalFeedbackHeading}>ORIGINAL FEEDBACK</Text>
                    {group.reviews.map((review) => (
                      <View key={review.id} style={styles.venueOriginalReview}>
                        <View style={styles.venueOriginalReviewHeader}>
                          <View style={styles.venueOriginalReviewMeta}>
                            <View style={styles.venueVerifiedRow}>
                              <MaterialCommunityIcons color="#1F8D4E" name="check-circle" size={15} />
                              <Text style={styles.venueVerifiedText}>Verified client</Text>
                            </View>
                            <Text style={styles.venueReviewDate}>
                              {review.createdAt
                                ? new Date(review.createdAt).toLocaleDateString('en-PH', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : 'Completed booking'}
                            </Text>
                          </View>
                          <Text style={styles.venueReviewStars}>
                            {'\u2605'.repeat(review.rating)}
                            {'\u2606'.repeat(5 - review.rating)}
                          </Text>
                        </View>
                        <Text style={styles.venueOriginalReviewCopy}>{review.comment}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          }

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
                  if (canExpand) toggleExpandedSentiment(sentiment)
                }}
                style={({ pressed }) => [
                  ...cardStyle,
                  !neumorphic && canExpand && pressed && styles.sentimentCardPressed,
                  neumorphic && canExpand && pressed && styles.neoSentimentCardPressed,
                ]}
              >
                <View style={styles.sentimentHeadingRow}>
                  <Text style={[styles.sentimentIcon, positive && neumorphic && styles.positiveHeartIcon]}>{positive ? '\u2665' : '!'}</Text>
                  <Text style={styles.sentimentHeading}>{positive ? 'WHAT CLIENTS LOVED' : 'WHAT COULD IMPROVE'}</Text>
                  <Text style={styles.sentimentCount}>{group.count}</Text>
                </View>
                <Text style={styles.sentimentSummary}>{group.summary}</Text>
                {canExpand ? (
                  <Text style={[styles.sentimentAction, neumorphic && styles.neoSentimentAction]}>
                    {expanded
                      ? 'Hide Comments'
                      : positive
                        ? 'View All Good Comments'
                        : 'View All Critical Comments'}
                  </Text>
                ) : null}
              </Pressable>

              {canExpand && expanded ? (
                <View style={[styles.sentimentReviewList, neumorphic && styles.neoSentimentReviewList]}>
                  {group.reviews.map((review) => (
                    <View key={review.id} style={[styles.sentimentReviewItem, neumorphic && styles.neoSentimentReviewItem]}>
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
                      <View style={[styles.sentimentCommentContainer, neumorphic && styles.neoSentimentCommentContainer]}>
                        <Text style={styles.reviewCopy}>{review.comment}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      {!neumorphic ? <Text style={styles.analysisCaption}>SUMMARY OF VERIFIED CLIENT FEEDBACK</Text> : null}
      {serviceOverlay ? (
        <Text style={styles.venueTransparencyNote}>
          AI-generated summaries based on customer feedback. Review original comments for full context.
        </Text>
      ) : null}
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
  emptyTitle: { color: palette.text, fontSize: typography.h3, lineHeight: 25, fontWeight: '700' },
  emptyCopy: {
    maxWidth: 480,
    color: palette.secondary,
    fontSize: typography.body,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  reviewSummary: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginBottom: 24 },
  reviewSummaryWide: { gap: 24 },
  ratingCard: {
    width: 140,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
    padding: 16,
  },
  neoRatingCard: {
    backgroundColor: '#E9EDF0',
    borderColor: 'rgba(255, 255, 255, 0.66)',
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.48,
    shadowRadius: 11,
    elevation: 4,
    boxShadow: '5px 5px 11px rgba(157, 169, 178, 0.48), -5px -5px 11px rgba(255, 255, 255, 0.94)',
  },
  bigRating: { color: palette.primary, fontSize: 42, lineHeight: 46, fontWeight: '700', marginBottom: 6 },
  summaryStarsSurface: { alignItems: 'center', alignSelf: 'stretch', minWidth: 108, marginBottom: 6 },
  summaryStars: { color: palette.gold, fontSize: 15, lineHeight: 20, letterSpacing: 0, textAlign: 'center' },
  neoRaisedStar: {
    backgroundColor: '#E9EDF0',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 999,
    paddingHorizontal: 3,
    paddingVertical: 4,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.48,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: '3px 3px 6px rgba(157, 169, 178, 0.48), -3px -3px 6px rgba(255, 255, 255, 0.94)',
  },
  reviewCount: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700', letterSpacing: 1.1 },
  distributionList: { minWidth: 0, flex: 1, justifyContent: 'center', gap: 8 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distributionLabel: { width: 42, flexShrink: 0, color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '600' },
  distributionTrack: { height: 10, minWidth: 0, flex: 1, overflow: 'hidden', borderRadius: 6, backgroundColor: palette.surfaceHigh },
  neoInsetTrack: {
    height: 12,
    backgroundColor: '#E9EDF0',
    padding: 2,
    boxShadow: 'inset 3px 3px 6px rgba(157, 169, 178, 0.48), inset -3px -3px 6px rgba(255, 255, 255, 0.94)',
  },
  distributionFill: { height: '100%', borderRadius: 6, backgroundColor: palette.primary },
  neoRaisedDistributionFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B1E2E',
    shadowColor: '#2B0712',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.38,
    shadowRadius: 4,
    elevation: 2,
    boxShadow: '2px 2px 4px rgba(43, 7, 18, 0.38), -1px -1px 2px rgba(255, 237, 243, 0.24)',
  },
  ratingFiveFill: {
    backgroundColor: '#22C55E',
    boxShadow: '2px 2px 4px rgba(8, 122, 50, 0.42), -1px -1px 2px rgba(229, 255, 239, 0.46)',
  },
  ratingFourFill: {
    backgroundColor: '#A3C72F',
    boxShadow: '2px 2px 4px rgba(102, 131, 17, 0.42), -1px -1px 2px rgba(246, 255, 215, 0.46)',
  },
  ratingThreeFill: {
    backgroundColor: '#F2C94C',
    boxShadow: '2px 2px 4px rgba(166, 109, 0, 0.42), -1px -1px 2px rgba(255, 249, 218, 0.46)',
  },
  ratingTwoFill: {
    backgroundColor: '#F58B2A',
    boxShadow: '2px 2px 4px rgba(156, 73, 4, 0.42), -1px -1px 2px rgba(255, 237, 220, 0.46)',
  },
  ratingOneFill: {
    backgroundColor: '#E53935',
    boxShadow: '2px 2px 4px rgba(147, 29, 26, 0.42), -1px -1px 2px rgba(255, 230, 230, 0.46)',
  },
  distributionCount: { width: 22, flexShrink: 0, color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  sentimentGrid: { gap: 14 },
  venueAnalysisHeading: {
    color: palette.text,
    fontSize: typography.h3,
    lineHeight: 25,
    fontWeight: '700',
    marginBottom: 2,
  },
  sentimentCard: { borderWidth: 1, borderRadius: 16, padding: 20 },
  positiveCard: { borderColor: '#B8D9C4', backgroundColor: '#F2FAF5' },
  negativeCard: { borderColor: '#E6C4C8', backgroundColor: '#FCF5F6' },
  sentimentCardPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  neoSentimentCard: {
    backgroundColor: '#E9EDF0',
    borderColor: 'rgba(255, 255, 255, 0.66)',
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.48,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '6px 6px 12px rgba(157, 169, 178, 0.48), -6px -6px 12px rgba(255, 255, 255, 0.94)',
  },
  neoPositiveSentimentCard: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.68,
    shadowRadius: 14,
    elevation: 5,
    boxShadow: '6px 6px 14px rgba(34, 197, 94, 0.68), -6px -6px 12px rgba(255, 255, 255, 0.94)',
  },
  neoNegativeSentimentCard: {
    shadowColor: '#EF3340',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.68,
    shadowRadius: 14,
    elevation: 5,
    boxShadow: '6px 6px 14px rgba(239, 51, 64, 0.68), -6px -6px 12px rgba(255, 255, 255, 0.94)',
  },
  venueSentimentCard: {
    padding: 16,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 2,
    boxShadow: '3px 3px 7px rgba(157, 169, 178, 0.30), -3px -3px 7px rgba(255, 255, 255, 0.86)',
  },
  venuePositiveSentimentCard: {
    borderLeftWidth: 0,
    shadowColor: '#22C55E',
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '4px 5px 11px rgba(34, 197, 94, 0.50)',
  },
  venueNegativeSentimentCard: {
    borderLeftWidth: 0,
    shadowColor: '#EF3340',
    shadowOffset: { width: 4, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '4px 5px 11px rgba(239, 51, 64, 0.50)',
  },
  neoSentimentCardPressed: {
    backgroundColor: '#E9EDF0',
    transform: [{ translateY: 1 }],
    elevation: 0,
    boxShadow: 'inset 3px 3px 6px rgba(157, 169, 178, 0.48), inset -3px -3px 6px rgba(255, 255, 255, 0.94)',
  },
  sentimentHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sentimentIcon: { width: 22, color: palette.primary, fontSize: 18, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  positiveHeartIcon: { color: '#E53935' },
  sentimentThumbIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  positiveThumbIcon: { backgroundColor: '#42CF6B' },
  negativeThumbIcon: { backgroundColor: '#FF5B58' },
  sentimentHeading: { flex: 1, color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800', letterSpacing: 1 },
  sentimentCount: { minWidth: 28, color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '800', textAlign: 'right' },
  venueSentimentCount: { minWidth: 0, color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '600' },
  sentimentSummary: { color: palette.text, fontSize: typography.body, lineHeight: 21, marginTop: 11 },
  sentimentAction: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800', letterSpacing: 0.5, marginTop: 13 },
  neoSentimentAction: { color: '#87929A' },
  venueOriginalFeedbackAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 12,
    paddingVertical: 3,
  },
  venueOriginalFeedbackActionPressed: { opacity: 0.64 },
  venueOriginalFeedbackActionText: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800' },
  venueOriginalFeedback: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(78, 6, 26, 0.14)',
    marginTop: 10,
    paddingTop: 12,
  },
  venueOriginalFeedbackHeading: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800', letterSpacing: 0.7 },
  venueOriginalReview: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 12,
    backgroundColor: '#E9EDF0',
    padding: 12,
    boxShadow: 'inset 3px 3px 6px rgba(157, 169, 178, 0.42), inset -3px -3px 6px rgba(255, 255, 255, 0.90)',
  },
  venueOriginalReviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  venueOriginalReviewMeta: { minWidth: 0, flex: 1, gap: 3 },
  venueVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  venueVerifiedText: { color: '#1F8D4E', fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  venueReviewDate: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17 },
  venueReviewStars: { flexShrink: 0, color: palette.gold, fontSize: 15, lineHeight: 19, letterSpacing: 0.25 },
  venueOriginalReviewCopy: { color: palette.text, fontSize: typography.body, lineHeight: 21, marginTop: 10 },
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
  neoSentimentReviewList: {
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    backgroundColor: 'transparent',
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 0,
  },
  neoSentimentReviewItem: {
    borderBottomWidth: 0,
    paddingVertical: 0,
  },
  sentimentCommentContainer: {},
  neoSentimentCommentContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 14,
    backgroundColor: '#E9EDF0',
    padding: 16,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.48,
    shadowRadius: 8,
    elevation: 3,
    boxShadow: '4px 4px 8px rgba(157, 169, 178, 0.48), -4px -4px 8px rgba(255, 255, 255, 0.94)',
  },
  sentimentReviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  reviewerName: { color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  reviewerMeta: { color: palette.secondary, fontSize: typography.caption, lineHeight: 18, marginTop: 2 },
  reviewStars: { color: palette.gold, fontSize: 16, lineHeight: 19, letterSpacing: 0.5 },
  reviewCopy: { color: palette.text, fontSize: typography.body, lineHeight: 21 },
  analysisCaption: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center', marginTop: 16 },
  venueTransparencyNote: {
    color: palette.secondary,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'left',
  },
  pendingAnalysisCopy: { color: palette.secondary, fontSize: typography.caption, lineHeight: 18, textAlign: 'center', marginTop: 7 },
})
