import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

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
  const progress = `${Math.round((boundedStep / totalSteps) * 100)}%` as `${number}%`

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
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: progress }]} />
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
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: palette.surface,
  },
  progressFill: {
    height: 2,
    backgroundColor: palette.burgundy,
  },
})
