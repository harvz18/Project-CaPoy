import React from 'react'
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { colors } from '../theme/tokens'

interface ScreenMotionFrameProps {
  children: React.ReactNode
  direction: -1 | 1
  disabled?: boolean
  isLocked?: boolean
  progress: Animated.Value
}

export const ScreenMotionFrame: React.FC<ScreenMotionFrameProps> = ({
  children,
  direction,
  disabled = false,
  isLocked = false,
  progress,
}) => {
  const { width } = useWindowDimensions()
  const distance = Math.min(Math.max(width * 0.16, 36), 72)

  const motionStyle = disabled
    ? {
        opacity: progress.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.88, 1, 1],
        }),
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }
    : {
        opacity: progress.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0.76, 1, 1],
        }),
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [direction * distance, 0],
            }),
          },
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.992, 1],
            }),
          },
        ],
      }

  return (
    <Animated.View
      pointerEvents={isLocked ? 'none' : 'auto'}
      renderToHardwareTextureAndroid={isLocked}
      shouldRasterizeIOS={isLocked}
      style={[styles.screen, motionStyle]}
    >
      {children}
    </Animated.View>
  )
}

interface NonBlockingActivityBarProps {
  visible: boolean
}

export const NonBlockingActivityBar: React.FC<NonBlockingActivityBarProps> = ({ visible }) => {
  const { width } = useWindowDimensions()
  const travel = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (!visible) {
      travel.stopAnimation()
      travel.setValue(0)
      return undefined
    }

    const animation = Animated.loop(
      Animated.timing(travel, {
        duration: 1050,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [travel, visible])

  if (!visible) return null

  const indicatorWidth = Math.min(Math.max(width * 0.34, 110), 220)
  const translateX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [-indicatorWidth, width],
  })

  return (
    <View
      accessibilityLabel="MULTIVENT is processing your request"
      accessibilityLiveRegion="polite"
      accessible
      pointerEvents="none"
      style={styles.activityTrack}
    >
      <Animated.View
        style={[
          styles.activityIndicator,
          { transform: [{ translateX }], width: indicatorWidth },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  activityTrack: {
    position: 'absolute',
    zIndex: 1000,
    top: 0,
    right: 0,
    left: 0,
    height: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(78, 6, 26, 0.08)',
  },
  activityIndicator: {
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
})
