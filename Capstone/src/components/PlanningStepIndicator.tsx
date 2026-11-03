import { Text } from './AppText'
import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

interface PlanningStepNavigationValue {
  maxReachableStep: number
  onStepPress?: (step: number) => void
}

const PlanningStepNavigationContext = React.createContext<PlanningStepNavigationValue>({
  maxReachableStep: 1,
})

export const PlanningStepNavigationProvider: React.FC<
  PlanningStepNavigationValue & React.PropsWithChildren
> = ({ children, maxReachableStep, onStepPress }) => (
  <PlanningStepNavigationContext.Provider value={{ maxReachableStep, onStepPress }}>
    {children}
  </PlanningStepNavigationContext.Provider>
)

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
  const navigation = React.useContext(PlanningStepNavigationContext)
  const maxReachableStep = Math.max(1, Math.min(navigation.maxReachableStep, totalSteps))

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
        {Array.from({ length: totalSteps }, (_, index) => {
          const step = index + 1
          const isReachable = step <= maxReachableStep
          const isFilled = step <= boundedStep
          const isCurrent = step === boundedStep

          return (
            <Pressable
              key={step}
              accessibilityLabel={`Go to planning step ${step}`}
              accessibilityRole={isReachable ? 'button' : undefined}
              accessibilityState={{ disabled: !isReachable, selected: isCurrent }}
              disabled={!isReachable || !navigation.onStepPress}
              hitSlop={6}
              onPress={() => navigation.onStepPress?.(step)}
              style={({ pressed }) => [
                styles.progressSegment,
                isFilled && styles.progressSegmentFilled,
                isCurrent && styles.progressSegmentCurrent,
                pressed && styles.progressSegmentPressed,
              ]}
            />
          )
        })}
      </View>
    </View>
  )
}

const palette = {
  burgundy: '#6B1E2E',
  secondary: '#5E5E5E',
  surface: '#E9EDF0',
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
    height: 12,
    flex: 1,
    borderRadius: 999,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    boxShadow:
      'inset 3px 3px 6px rgba(166, 175, 183, 0.57), inset -3px -3px 6px rgba(255, 255, 255, 0.97)',
  },
  progressSegmentFilled: {
    backgroundColor: palette.burgundy,
    borderColor: 'rgba(255, 237, 243, 0.32)',
    boxShadow:
      '3px 4px 7px rgba(43, 7, 18, 0.42), -3px -3px 6px rgba(255, 237, 243, 0.36), inset 1px 1px 1px rgba(255, 255, 255, 0.16)',
  },
  progressSegmentCurrent: {
    transform: [{ scaleY: 1.08 }],
  },
  progressSegmentPressed: { opacity: 0.62 },
})
