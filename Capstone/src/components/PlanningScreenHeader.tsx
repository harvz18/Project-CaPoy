import React from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from './AppText'
import { PlanningStepIndicator } from './PlanningStepIndicator'

interface PlanningScreenHeaderProps {
  currentStep: number
  label: string
  nextAccessibilityLabel?: string
  nextEnabled?: boolean
  onBack?: () => void
  onNext?: () => void
  title: string
}

export const PlanningScreenHeader: React.FC<PlanningScreenHeaderProps> = ({
  currentStep,
  label,
  nextAccessibilityLabel = 'Continue to the next step',
  nextEnabled = false,
  onBack,
  onNext,
  title,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const canGoNext = nextEnabled && Boolean(onNext)

  return (
    <>
      <View style={styles.appBar}>
        <View style={[styles.appBarContent, isWide && styles.appBarContentWide]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            disabled={!onBack}
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
          >
            <Text style={styles.navigationIcon}>{'<'}</Text>
          </Pressable>

          <Text numberOfLines={1} style={styles.title}>{title.toUpperCase()}</Text>

          <Pressable
            accessibilityLabel={nextAccessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoNext }}
            disabled={!canGoNext}
            hitSlop={8}
            onPress={onNext}
            style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
          >
            <Text style={[styles.navigationIcon, !canGoNext && styles.navigationIconDisabled]}>
              {'>'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.progressWrapper, isWide && styles.progressWrapperWide]}>
        <PlanningStepIndicator currentStep={currentStep} label={label} />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  appBar: {
    zIndex: 50,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  appBarContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  appBarContentWide: { paddingHorizontal: 64 },
  navigationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  navigationIcon: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '500',
    textAlign: 'center',
  },
  navigationIconDisabled: { color: 'rgba(255,255,255,0.32)' },
  title: {
    minWidth: 0,
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  progressWrapper: {
    zIndex: 30,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  progressWrapperWide: { paddingHorizontal: 64 },
  pressed: { opacity: 0.58, transform: [{ scale: 0.94 }] },
})
