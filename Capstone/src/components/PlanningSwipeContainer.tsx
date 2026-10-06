import React from 'react'
import { Animated, Easing, PanResponder, StyleSheet, useWindowDimensions } from 'react-native'

interface PlanningSwipeContainerProps {
  children: React.ReactNode
  currentStep: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export const PlanningSwipeContainer: React.FC<PlanningSwipeContainerProps> = ({
  children,
  currentStep,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const { width } = useWindowDimensions()
  const translateX = React.useRef(new Animated.Value(0)).current
  const isAnimating = React.useRef(false)
  const previousStep = React.useRef(currentStep)
  const pendingDirection = React.useRef<'forward' | 'back' | null>(null)
  const onSwipeLeftRef = React.useRef(onSwipeLeft)
  const onSwipeRightRef = React.useRef(onSwipeRight)

  onSwipeLeftRef.current = onSwipeLeft
  onSwipeRightRef.current = onSwipeRight

  const resetPosition = React.useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      velocity: 0,
      bounciness: 0,
    }).start()
  }, [translateX])

  React.useEffect(() => {
    if (previousStep.current === currentStep) return

    previousStep.current = currentStep
    const direction = pendingDirection.current
    pendingDirection.current = null

    if (!direction) {
      translateX.setValue(0)
      isAnimating.current = false
      return
    }

    // The outgoing page has left the viewport. Start the new page on the
    // opposite edge so one completed gesture always reads as one continuous
    // transition, even though the page content is rendered by the parent.
    translateX.setValue(direction === 'forward' ? width : -width)
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      isAnimating.current = false
    })
  }, [currentStep, translateX, width])

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        !isAnimating.current &&
        Math.abs(gestureState.dx) > 24 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
      onPanResponderMove: (_, gestureState) => {
        const boundedOffset = Math.max(-width, Math.min(width, gestureState.dx))
        translateX.setValue(boundedOffset)
      },
      onPanResponderRelease: (_, gestureState) => {
        const hasCrossedThreshold = Math.abs(gestureState.dx) >= Math.min(width * 0.18, 72)
        const isQuickFling = Math.abs(gestureState.vx) >= 0.5
        if (!hasCrossedThreshold && !isQuickFling) {
          resetPosition()
          return
        }

        const isSwipingLeft = gestureState.dx < 0
        const onComplete = isSwipingLeft ? onSwipeLeftRef.current : onSwipeRightRef.current
        if (!onComplete) {
          resetPosition()
          return
        }

        isAnimating.current = true
        pendingDirection.current = isSwipingLeft ? 'forward' : 'back'
        Animated.timing(translateX, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
          toValue: isSwipingLeft ? -width : width,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            isAnimating.current = false
            translateX.setValue(0)
            pendingDirection.current = null
            return
          }

          onComplete()
        })
      },
      onPanResponderTerminate: resetPosition,
    })
  ).current

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
