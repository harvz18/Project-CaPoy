import { Text } from './AppText'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { radius, spacing } from '../theme/tokens'

interface LuminousPillButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: React.ReactNode
  isFullWidth?: boolean
  isLoading?: boolean
  loadingLabel?: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  tone?: 'burgundy' | 'neutral' | 'glass'
}

export const LuminousPillButton: React.FC<LuminousPillButtonProps> = ({
  children,
  accessibilityState,
  disabled,
  isFullWidth = false,
  isLoading = false,
  loadingLabel,
  style,
  textStyle,
  tone = 'burgundy',
  ...props
}) => {
  const unavailable = Boolean(disabled || isLoading)
  const isNeutral = tone === 'neutral'
  const isGlass = tone === 'glass'

  return (
    <View style={[styles.wrap, isFullWidth && styles.fullWidth, style]}>
      <View pointerEvents="none" style={[styles.glow, isNeutral && styles.neutralGlow]} />
      <Pressable
        {...props}
        accessibilityState={{ ...accessibilityState, busy: isLoading, disabled: unavailable }}
        disabled={unavailable}
        style={({ pressed }) => [
          styles.pressable,
          isNeutral && styles.neutralPressable,
          isGlass && styles.glassPressable,
          pressed && !unavailable && styles.pressablePressed,
          unavailable && styles.disabled,
        ]}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={pressed && !unavailable
              ? (isGlass
                ? ['rgba(255, 244, 249, 0.30)', 'rgba(170, 54, 94, 0.46)', 'rgba(90, 12, 38, 0.62)']
                : isNeutral
                  ? ['#E7ECEF', '#DCE3E7', '#C8D1D7', '#B8C2C8']
                  : ['#B8486D', '#A83F63', '#8C2347', '#64132E'])
              : (isGlass
                ? ['rgba(255, 246, 250, 0.38)', 'rgba(159, 43, 83, 0.36)', 'rgba(82, 10, 34, 0.52)']
                : isNeutral
                  ? ['#F6F8F9', '#EDF1F3', '#DDE4E8', '#CCD5DA']
                  : ['#D17A95', '#BC4A70', '#962747', '#6D102D'])}
            locations={isGlass ? [0, 0.57, 1] : [0, 0.24, 0.57, 1]}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.face, isNeutral && styles.neutralFace, isGlass && styles.glassFace, pressed && !unavailable && styles.facePressed]}
          >
            {isGlass ? <BlurView intensity={28} pointerEvents="none" tint="dark" style={styles.glassBlur} /> : null}
            <LinearGradient
              colors={isNeutral
                ? ['rgba(255, 255, 255, 0.82)', 'rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0)']
                : ['rgba(255, 246, 249, 0.68)', 'rgba(255, 226, 237, 0.25)', 'rgba(255, 226, 237, 0)']}
              locations={[0, 0.55, 1]}
              pointerEvents="none"
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.sheen, isNeutral && styles.neutralSheen, isGlass && styles.glassSheen]}
            />
            {isLoading
              ? <ActivityIndicator color={isNeutral ? '#57636C' : '#FFF7F9'} size="small" />
              : typeof children === 'string'
                ? <Text style={[styles.label, isNeutral && styles.neutralLabel, textStyle]}>{children}</Text>
                : <View style={styles.content}>{children}</View>}
            {isLoading && loadingLabel ? <Text style={[styles.loadingLabel, textStyle]}>{loadingLabel}</Text> : null}
          </LinearGradient>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 132,
    position: 'relative',
    paddingBottom: 10,
  },
  fullWidth: {
    width: '100%',
  },
  glow: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    bottom: 1,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
  neutralGlow: {
    backgroundColor: 'rgba(132, 145, 154, 0.26)',
    boxShadow: '0px 8px 15px rgba(117, 130, 139, 0.26)',
  },
  pressable: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(234, 174, 192, 0.9)',
    boxShadow: '0px 8px 16px rgba(30, 33, 37, 0.30)',
  },
  neutralPressable: {
    borderColor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0px 4px 0px rgba(137, 150, 159, 0.54), 0px 10px 18px rgba(99, 112, 121, 0.20), 0px 0px 0px 2px rgba(255, 255, 255, 0.44)',
  },
  glassPressable: {
    borderColor: 'rgba(255, 244, 249, 0.62)',
    backgroundColor: 'rgba(117, 25, 54, 0.2)',
    boxShadow: '0px 5px 12px rgba(29, 4, 13, 0.28)',
  },
  face: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    boxShadow: 'inset 0px 2px 1px rgba(255, 255, 255, 0.51), inset 0px -3px 5px rgba(55, 5, 24, 0.32)',
  },
  neutralFace: {
    boxShadow: 'inset 0px 2px 1px rgba(255, 255, 255, 0.88), inset 0px -3px 5px rgba(116, 129, 138, 0.24)',
  },
  glassFace: {
    backgroundColor: 'rgba(112, 24, 51, 0.18)',
    boxShadow: 'inset 0px 1px 1px rgba(255, 255, 255, 0.5), inset 0px -2px 6px rgba(37, 4, 17, 0.26)',
  },
  glassBlur: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheen: {
    position: 'absolute',
    top: 3,
    left: '9%',
    right: '9%',
    height: '54%',
    borderRadius: radius.pill,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
  },
  neutralSheen: {
    borderTopColor: 'rgba(255, 255, 255, 0.85)',
  },
  glassSheen: {
    borderTopColor: 'rgba(255, 255, 255, 0.62)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    color: '#FFF7F9',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    lineHeight: 19,
    textShadowColor: 'rgba(58, 10, 27, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  neutralLabel: {
    color: '#57636C',
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
  },
  loadingLabel: {
    marginTop: 2,
  },
  pressablePressed: {
    transform: [{ translateY: 2 }],
    boxShadow: '0px 3px 7px rgba(30, 33, 37, 0.24)',
  },
  facePressed: {
    boxShadow: 'inset 0px 3px 6px rgba(57, 6, 27, 0.28), inset 0px -1px 2px rgba(255, 255, 255, 0.17)',
  },
  disabled: {
    opacity: 0.55,
  },
})
