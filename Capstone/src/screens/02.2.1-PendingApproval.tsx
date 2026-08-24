import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/Button'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface PendingApprovalScreenProps {
  onBackToRoleSelection: () => void
}

const reviewSteps = [
  {
    id: 'submitted',
    label: 'Application submitted',
    description: 'Your merchant information has been received.',
    completed: true,
  },
  {
    id: 'review',
    label: 'Business verification',
    description: 'The MULTIVENT team will review your business details.',
    completed: false,
  },
  {
    id: 'approval',
    label: 'Account approval',
    description: 'We will notify you when your merchant account is ready.',
    completed: false,
  },
] as const

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({
  onBackToRoleSelection,
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>MULTIVENT</Text>

      <View style={styles.hero}>
        <View style={styles.statusIcon}>
          <Text style={styles.checkmark}>{'\u2713'}</Text>
        </View>
        <Text style={styles.eyebrow}>APPLICATION RECEIVED</Text>
        <Text style={styles.title}>Your account is pending approval</Text>
        <Text style={styles.subtitle}>
          Thanks for joining MULTIVENT. We are reviewing your business details to keep our
          marketplace trusted and reliable.
        </Text>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.estimateRow}>
          <View>
            <Text style={styles.cardEyebrow}>ESTIMATED REVIEW TIME</Text>
            <Text style={styles.estimate}>24–48 hours</Text>
          </View>
          <View style={styles.pendingBadge}>
            <View style={styles.pendingDot} />
            <Text style={styles.pendingText}>In review</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View accessibilityLabel="Merchant application review progress" style={styles.timeline}>
          {reviewSteps.map((step, index) => (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepMarkerColumn}>
                <View
                  style={[
                    styles.stepMarker,
                    step.completed ? styles.stepMarkerCompleted : styles.stepMarkerPending,
                  ]}
                >
                  {step.completed && <Text style={styles.stepCheckmark}>{'\u2713'}</Text>}
                </View>
                {index < reviewSteps.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepLabel, !step.completed && styles.stepLabelPending]}>
                  {step.label}
                </Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>i</Text>
        <Text style={styles.noticeText}>
          You will receive an email when the review is complete. No further action is needed
          right now.
        </Text>
      </View>

      <Button
        accessibilityLabel="Back to role selection"
        isFullWidth
        onPress={onBackToRoleSelection}
        size="lg"
        style={styles.button}
      >
        BACK TO ROLE SELECTION
      </Button>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.background,
  },
  brand: {
    color: colors.primaryDark,
    fontSize: typography.h3,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  statusIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F5E7DC',
    borderWidth: 1,
    borderColor: colors.accentLight,
    marginBottom: spacing.xl,
  },
  checkmark: {
    color: colors.primaryDark,
    fontSize: 38,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h1,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  estimate: {
    color: colors.textPrimary,
    fontSize: typography.h2,
    fontWeight: '700',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#FFF4DB',
  },
  pendingDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: '#B7791F',
  },
  pendingText: {
    color: '#8A5A16',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xl,
  },
  timeline: {
    gap: 0,
  },
  stepRow: {
    minHeight: 76,
    flexDirection: 'row',
  },
  stepMarkerColumn: {
    width: 30,
    alignItems: 'center',
  },
  stepMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  stepMarkerCompleted: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  stepMarkerPending: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.grey300,
  },
  stepCheckmark: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.grey300,
  },
  stepCopy: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingBottom: spacing.lg,
  },
  stepLabel: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stepLabelPending: {
    color: colors.textSecondary,
  },
  stepDescription: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.medium,
    backgroundColor: '#F5E7DC',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  noticeIcon: {
    width: 22,
    height: 22,
    color: colors.textInverse,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
  },
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
})
