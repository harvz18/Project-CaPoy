import { Text } from './AppText'
import React from 'react'
import { StyleSheet,  View } from 'react-native'

interface PlanningStepIndicatorProps {
  currentStep: number
  label: string
  totalSteps?: number
}

export const PlanningStepIndicator: React.FC<PlanningStepIndicatorProps> = ({
  currentStep,
  label,
  totalSteps = 5,
}) => {
  const boundedStep = Math.max(1, Math.min(currentStep, totalSteps))

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressLabels}>
        <Text style={styles.progressActiveLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.progressLabel}>
          STEP {boundedStep} OF {totalSteps}
        </Text>
      </View>
      <View
        accessibilityLabel={`Step ${boundedStep} of ${totalSteps}: ${label}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: totalSteps, now: boundedStep }}
        style={styles.progressSegments}
      >
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[styles.progressSegment, index < boundedStep && styles.progressSegmentActive]}
          />
        ))}
      </View>
    </View>
  )
}

const palette = {
  burgundy: '#6B1E2E',
  secondary: '#5E5E5E',
  surface: '#E3E2E2',
} as const

const styles = StyleSheet.create({
  progressSection: {
    width: '100%',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 8,
  },
  progressActiveLabel: {
    color: palette.burgundy,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  progressLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  progressSegments: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    height: 10,
    flex: 1,
    borderRadius: 999,
    backgroundColor: palette.surface,
  },
  progressSegmentActive: {
    backgroundColor: palette.burgundy,
  },
})
