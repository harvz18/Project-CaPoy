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
  totalSteps = 4,
}) => {
  const boundedStep = Math.max(1, Math.min(currentStep, totalSteps))

  return (
    <View style={styles.stepStatus}>
      <Text style={styles.stepLabel}>
        STEP {boundedStep} OF {totalSteps} - {label}
      </Text>
      <View
        accessibilityLabel={`Step ${boundedStep} of ${totalSteps}: ${label}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: totalSteps, now: boundedStep }}
        style={styles.stepTrack}
      >
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={[styles.stepSegment, index < boundedStep && styles.stepSegmentActive]}
          />
        ))}
      </View>
    </View>
  )
}

const palette = {
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  surfaceContainerHigh: '#E8E8E8',
} as const

const styles = StyleSheet.create({
  stepStatus: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  stepLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepTrack: {
    width: '100%',
    maxWidth: 220,
    flexDirection: 'row',
    gap: 4,
  },
  stepSegment: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    backgroundColor: palette.surfaceContainerHigh,
  },
  stepSegmentActive: {
    backgroundColor: palette.primaryContainer,
  },
})
