import React from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from './AppText'
import { PlanningStepIndicator } from './PlanningStepIndicator'

interface PlanningScreenHeaderProps {
  currentStep: number
  label: string
  nextAccessibilityLabel?: string
  nextEnabled?: boolean
  onBack?: () => void
  onNext?: () => void | Promise<void>
  showBackButton?: boolean
  title: string
}

export const PlanningScreenHeader: React.FC<PlanningScreenHeaderProps> = ({
  currentStep,
  label,
  nextAccessibilityLabel = 'Continue to the next planning step',
  nextEnabled,
  onBack,
  onNext,
  showBackButton,
  title,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const canGoBack = (showBackButton ?? Boolean(onBack)) && Boolean(onBack)
  const canGoForward = Boolean(onNext) && nextEnabled !== false
  const nextPressLockedRef = React.useRef(false)

  const handleNext = () => {
    if (!onNext || !canGoForward || nextPressLockedRef.current) return

    nextPressLockedRef.current = true
    void Promise.resolve(onNext()).finally(() => {
      // Most step actions either move to the next screen or expose their
      // validation feedback synchronously. A short release prevents accidental
      // double-taps without leaving non-navigation actions permanently locked.
      setTimeout(() => {
        nextPressLockedRef.current = false
      }, 250)
    })
  }

  return (
    <>
      <View style={styles.appBar}>
        <View style={[styles.appBarContent, isWide && styles.appBarContentWide]}>
          {canGoBack ? (
            <Pressable
              accessibilityLabel="Go to the previous planning step"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="chevron-left" size={28} />
            </Pressable>
          ) : (
            <View style={styles.navigationButton} />
          )}

          <Text numberOfLines={1} style={styles.title}>{title.toUpperCase()}</Text>

          <Pressable
            accessibilityLabel={nextAccessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canGoForward }}
            disabled={!canGoForward}
            hitSlop={8}
            onPress={handleNext}
            style={({ pressed }) => [
              styles.navigationButton,
              !canGoForward && styles.navigationButtonDisabled,
              pressed && canGoForward && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="chevron-right" size={28} />
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
  navigationButtonDisabled: { opacity: 0.32 },
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
