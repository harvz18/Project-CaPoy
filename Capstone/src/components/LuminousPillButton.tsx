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
  compact?: boolean
  isFullWidth?: boolean
  isLoading?: boolean
  loadingLabel?: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  tone?: 'burgundy' | 'burgundyMatte' | 'neutral' | 'glass' | 'neumorphic' | 'surfaceMatte'
  haloTone?: 'none' | 'burgundy'
  neumorphicSurfaceColor?: string
}

export const LuminousPillButton: React.FC<LuminousPillButtonProps> = ({
  children,
  accessibilityState,
  compact = false,
  disabled,
  isFullWidth = false,
  isLoading = false,
  loadingLabel,
  style,
  textStyle,
  tone = 'burgundy',
  haloTone = 'none',
  neumorphicSurfaceColor = '#E9EDF0',
  ...props
}) => {
  const unavailable = Boolean(disabled || isLoading)
  const isNeutral = tone === 'neutral'
  const isGlass = tone === 'glass'
  const isNeumorphic = tone === 'neumorphic'
  const isSurfaceMatte = tone === 'surfaceMatte'
  const isBurgundyMatte = tone === 'burgundyMatte'
  const isPaleTone = isNeutral || isNeumorphic || isSurfaceMatte
  const hasBurgundyHalo = haloTone === 'burgundy'

  return (
    <View style={[styles.wrap, isFullWidth && styles.fullWidth, style]}>
      {!hasBurgundyHalo && !isBurgundyMatte && !isSurfaceMatte && (
        <View
          pointerEvents="none"
          style={[styles.glow, isNeutral && styles.neutralGlow]}
        />
      )}
      <Pressable
        {...props}
        accessibilityState={{ ...accessibilityState, busy: isLoading, disabled: unavailable }}
        disabled={unavailable}
        style={({ pressed }) => [
          styles.pressable,
          compact && styles.compactPressable,
          isBurgundyMatte && styles.burgundyMattePressable,
          isNeutral && styles.neutralPressable,
          isNeumorphic && styles.neumorphicPressable,
          isNeumorphic && { backgroundColor: neumorphicSurfaceColor },
          isSurfaceMatte && styles.surfaceMattePressable,
          isPaleTone && hasBurgundyHalo && styles.paleBurgundyHaloPressable,
          isGlass && styles.glassPressable,
          pressed && !unavailable && (
            isNeumorphic
              ? styles.neumorphicPressablePressed
              : isSurfaceMatte
                ? styles.surfaceMattePressablePressed
              : isBurgundyMatte
                ? styles.burgundyMattePressablePressed
                : styles.pressablePressed
          ),
          unavailable && styles.disabled,
        ]}
      >
        {({ pressed }) => {
          const faceStyle = [
            styles.face,
            compact && styles.compactFace,
            isBurgundyMatte && styles.burgundyMatteFace,
            isNeutral && styles.neutralFace,
            isNeumorphic && styles.neumorphicFace,
            isNeumorphic && { backgroundColor: neumorphicSurfaceColor },
            isSurfaceMatte && styles.surfaceMatteFace,
            isGlass && styles.glassFace,
            pressed && !unavailable && (
              isNeumorphic
                ? styles.neumorphicFacePressed
                : isSurfaceMatte
                  ? styles.surfaceMatteFacePressed
                : isBurgundyMatte
                  ? styles.burgundyMatteFacePressed
                  : styles.facePressed
            ),
          ]
          const faceContent = (
            <>
              {isGlass ? <BlurView intensity={28} pointerEvents="none" tint="dark" style={styles.glassBlur} /> : null}
              {!isNeumorphic && !isBurgundyMatte && !isSurfaceMatte && (
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
              )}
              {isLoading
                ? <ActivityIndicator color={isPaleTone ? '#57636C' : '#FFFFFF'} size="small" />
                : typeof children === 'string'
                  ? <Text style={[styles.label, isPaleTone && styles.neutralLabel, textStyle]}>{children}</Text>
                  : <View style={styles.content}>{children}</View>}
              {isLoading && loadingLabel ? <Text style={[styles.loadingLabel, textStyle]}>{loadingLabel}</Text> : null}
            </>
          )

          if (isNeumorphic || isSurfaceMatte || isBurgundyMatte) {
            return <View pointerEvents="none" style={faceStyle}>{faceContent}</View>
          }

          return (
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
              style={faceStyle}
            >
              {faceContent}
            </LinearGradient>
          )
        }}
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
  compactPressable: {
    minHeight: 40,
  },
  burgundyMattePressable: {
    backgroundColor: '#6B1E2E',
    borderColor: 'rgba(255, 240, 245, 0.18)',
    shadowColor: '#2B0712',
    shadowOffset: { width: 5, height: 7 },
    shadowOpacity: 0.44,
    shadowRadius: 10,
    elevation: 7,
    boxShadow: '4px 6px 12px rgba(43, 7, 18, 0.44), 10px 14px 24px rgba(43, 7, 18, 0.24), inset 1px 1px 1px rgba(255, 255, 255, 0.12)',
  },
  neutralPressable: {
    borderColor: 'rgba(255, 255, 255, 0.92)',
    boxShadow: '0px 4px 0px rgba(137, 150, 159, 0.54), 0px 10px 18px rgba(99, 112, 121, 0.20), 0px 0px 0px 2px rgba(255, 255, 255, 0.44)',
  },
  neumorphicPressable: {
    backgroundColor: '#E9EDF0',
    borderColor: 'rgba(255, 255, 255, 0.62)',
    shadowColor: '#BAC3CA',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.54,
    shadowRadius: 11,
    elevation: 6,
    boxShadow: '-5px -5px 11px rgba(255, 255, 255, 0.96), 5px 5px 11px rgba(160, 171, 180, 0.52)',
  },
  surfaceMattePressable: {
    backgroundColor: '#E9EDF0',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    shadowColor: '#4E5860',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.48,
    shadowRadius: 7,
    elevation: 4,
    boxShadow: '3px 4px 7px rgba(78, 88, 96, 0.48)',
  },
  paleBurgundyHaloPressable: {
    borderColor: 'rgba(255, 255, 255, 0.65)',
    shadowColor: '#A34E5D',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '-5px -5px 10px rgba(255, 255, 255, 0.86), 3px 5px 10px rgba(163, 78, 93, 0.40), 8px 11px 22px rgba(107, 30, 46, 0.20), 17px 20px 38px rgba(107, 30, 46, 0.07), inset 1px 1px 1px rgba(255, 255, 255, 0.72)',
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
  compactFace: {
    minHeight: 40,
  },
  burgundyMatteFace: {
    backgroundColor: '#6B1E2E',
    boxShadow: 'inset 1px 1px 1px rgba(255, 255, 255, 0.14), inset -2px -2px 4px rgba(43, 7, 18, 0.22)',
  },
  neutralFace: {
    boxShadow: 'inset 0px 2px 1px rgba(255, 255, 255, 0.88), inset 0px -3px 5px rgba(116, 129, 138, 0.24)',
  },
  neumorphicFace: {
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 1px 1px 1px rgba(255, 255, 255, 0.72), inset -1px -1px 1px rgba(186, 195, 202, 0.14)',
  },
  surfaceMatteFace: {
    backgroundColor: '#E9EDF0',
    boxShadow: 'none',
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
    color: '#FFFFFF',
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
  burgundyMattePressablePressed: {
    transform: [{ translateY: 1 }],
    shadowColor: '#2B0712',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
    boxShadow: 'inset 3px 3px 6px rgba(37, 4, 14, 0.66), inset -2px -2px 3px rgba(255, 237, 243, 0.14)',
  },
  neumorphicPressablePressed: {
    transform: [{ translateY: 1 }],
    shadowColor: '#6B1E2E',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
    boxShadow: 'inset 3px 3px 6px rgba(107, 30, 46, 0.38), inset -3px -3px 6px rgba(255, 255, 255, 0.92)',
  },
  surfaceMattePressablePressed: {
    transform: [{ translateY: 1 }],
    elevation: 0,
    boxShadow: 'none',
  },
  facePressed: {
    boxShadow: 'inset 0px 3px 6px rgba(57, 6, 27, 0.28), inset 0px -1px 2px rgba(255, 255, 255, 0.17)',
  },
  burgundyMatteFacePressed: {
    boxShadow: 'inset 3px 3px 6px rgba(37, 4, 14, 0.66), inset -2px -2px 3px rgba(255, 237, 243, 0.14)',
  },
  neumorphicFacePressed: {
    boxShadow: 'inset 3px 3px 6px rgba(107, 30, 46, 0.46), inset -3px -3px 6px rgba(255, 255, 255, 0.94)',
  },
  surfaceMatteFacePressed: {
    boxShadow: 'inset 3px 3px 6px rgba(143, 154, 163, 0.44), inset -3px -3px 6px rgba(255, 255, 255, 0.78)',
  },
  disabled: {
    opacity: 0.55,
  },
})
