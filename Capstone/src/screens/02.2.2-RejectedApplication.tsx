import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button } from '../components/Button'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface RejectedApplicationScreenProps {
  onUpdateApplication: () => void
  onBackToRoleSelection: () => void
  rejectionReason?: string
}

const requirements = [
  'Make sure your business name matches your submitted documents.',
  'Upload clear and valid business registration or permit details.',
  'Check that your contact information is complete and accurate.',
] as const

export const RejectedApplicationScreen: React.FC<RejectedApplicationScreenProps> = ({
  onUpdateApplication,
  onBackToRoleSelection,
  rejectionReason = 'Some of your business information could not be verified.',
}) => {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.brand}>MULTIVENT</Text>

      <View style={styles.hero}>
        <View style={styles.statusIcon}>
          <Text style={styles.statusMark}>!</Text>
        </View>
        <Text style={styles.eyebrow}>APPLICATION UPDATE NEEDED</Text>
        <Text style={styles.title}>We could not approve your application</Text>
        <Text style={styles.subtitle}>
          Your merchant account is not active yet, but you can review the details below and
          submit an updated application.
        </Text>
      </View>

      <View style={styles.reasonCard}>
        <View style={styles.reasonHeader}>
          <Text style={styles.reasonEyebrow}>REVIEW RESULT</Text>
          <View style={styles.rejectedBadge}>
            <View style={styles.rejectedDot} />
            <Text style={styles.rejectedText}>Not approved</Text>
          </View>
        </View>
        <Text style={styles.reasonTitle}>Reason for rejection</Text>
        <Text style={styles.reasonText}>{rejectionReason}</Text>
      </View>

      <View style={styles.checklistCard}>
        <Text style={styles.checklistTitle}>Before you resubmit</Text>
        <Text style={styles.checklistSubtitle}>
          Review these common requirements to help avoid another delay.
        </Text>

        <View style={styles.requirements}>
          {requirements.map((requirement, index) => (
            <View key={requirement} style={styles.requirementRow}>
              <View style={styles.requirementNumber}>
                <Text style={styles.requirementNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.requirementText}>{requirement}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeIcon}>i</Text>
        <Text style={styles.noticeText}>
          Updating your application will send it back for review. Approval is not guaranteed,
          but complete and accurate information helps us process it faster.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          accessibilityLabel="Update merchant application"
          isFullWidth
          onPress={onUpdateApplication}
          size="lg"
          style={styles.primaryButton}
        >
          UPDATE APPLICATION
        </Button>
        <Button
          accessibilityLabel="Back to role selection"
          isFullWidth
          onPress={onBackToRoleSelection}
          size="lg"
          variant="secondary"
          style={styles.secondaryButton}
          textStyle={styles.secondaryButtonText}
        >
          BACK TO ROLE SELECTION
        </Button>
      </View>
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
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F3BABA',
    marginBottom: spacing.xl,
  },
  statusMark: {
    color: '#B42318',
    fontSize: 38,
    fontWeight: '700',
  },
  eyebrow: {
    color: '#B42318',
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1.3,
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
  reasonCard: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#F3BABA',
    borderRadius: radius.large,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  reasonEyebrow: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#FDECEC',
  },
  rejectedDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: '#B42318',
  },
  rejectedText: {
    color: '#8E1B12',
    fontSize: typography.caption,
    fontWeight: '700',
  },
  reasonTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  reasonText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  checklistCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  checklistTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  checklistSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  requirements: {
    gap: spacing.lg,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  requirementNumber: {
    width: 26,
    height: 26,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F5E7DC',
  },
  requirementNumberText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  requirementText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
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
  actions: {
    gap: spacing.md,
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  secondaryButton: {
    borderRadius: radius.pill,
    borderColor: colors.primaryDark,
    backgroundColor: colors.background,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
})
