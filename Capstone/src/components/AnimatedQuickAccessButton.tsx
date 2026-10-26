import React from 'react'
import type {
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import { Animated, Easing, Image, Platform, Pressable, View } from 'react-native'

import { Text } from './AppText'

type AnimatedQuickAccessButtonProps = {
  accessibilityLabel: string
  badgeStyle?: StyleProp<ViewStyle>
  entranceDelay?: number
  iconContainerStyle?: StyleProp<ViewStyle>
  iconScale?: number
  iconSource: ImageSourcePropType
  iconStyle: StyleProp<ImageStyle>
  itemStyle: StyleProp<ViewStyle>
  label: string
  labelStyle: StyleProp<TextStyle>
  onPress: () => void
  pressedStyle?: StyleProp<ViewStyle>
  showBadge?: boolean
}

export const AnimatedQuickAccessButton: React.FC<AnimatedQuickAccessButtonProps> = ({
  accessibilityLabel,
  badgeStyle,
  entranceDelay,
  iconContainerStyle,
  iconScale = 1,
  iconSource,
  iconStyle,
  itemStyle,
  label,
  labelStyle,
  onPress,
  pressedStyle,
  showBadge = false,
}) => {
  const entranceProgress = React.useRef(new Animated.Value(entranceDelay === undefined ? 1 : 0)).current
  const pulseScale = React.useRef(new Animated.Value(1)).current
  const isAnimating = React.useRef(false)

  React.useEffect(() => {
    if (entranceDelay === undefined) {
      entranceProgress.setValue(1)
      return undefined
    }

    entranceProgress.setValue(0)
    const entrance = Animated.sequence([
      Animated.delay(entranceDelay),
      Animated.timing(entranceProgress, {
        duration: 720,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ])
    entrance.start()

    return () => entrance.stop()
  }, [entranceDelay, entranceProgress])

  const handlePress = () => {
    if (isAnimating.current) return
    isAnimating.current = true

    Animated.sequence([
      Animated.timing(pulseScale, {
        duration: 95,
        easing: Easing.out(Easing.cubic),
        toValue: 1.16,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(pulseScale, {
        duration: 115,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(({ finished }) => {
      isAnimating.current = false
      if (finished) onPress()
    })
  }

  return (
    <View style={itemStyle}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          { alignItems: 'center', alignSelf: 'stretch' },
          pressed && pressedStyle,
        ]}
      >
        <Animated.View
          style={[
            iconContainerStyle,
            {
              opacity: entranceProgress,
              transform: [
                {
                  translateY: entranceProgress.interpolate({
                    inputRange: [0, 0.62, 1],
                    outputRange: [14, -7, 0],
                  }),
                },
                { scale: pulseScale },
              ],
            },
          ]}
        >
          <Image
            resizeMode="contain"
            source={iconSource}
            style={[iconStyle, { transform: [{ scale: iconScale }] }]}
          />
          {showBadge ? <View style={badgeStyle} /> : null}
        </Animated.View>
        <Text numberOfLines={1} style={labelStyle}>{label}</Text>
      </Pressable>
    </View>
  )
}
