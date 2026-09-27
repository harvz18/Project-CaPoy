import { Text } from './AppText'
import React from 'react'
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import { colors, radius, spacing, typography } from '../theme/tokens'

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isFullWidth?: boolean
  isLoading?: boolean
  loadingLabel?: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isFullWidth = false,
  isLoading = false,
  loadingLabel = 'Please wait…',
  children,
  accessibilityState,
  disabled,
  onPress,
  style,
  textStyle,
  ...props
}) => {
  const lastPressAt = React.useRef(0)
  const unavailable = Boolean(disabled || isLoading)

  const handlePress = React.useCallback((event: GestureResponderEvent) => {
    const pressedAt = Date.now()
    if (pressedAt - lastPressAt.current < 450) return
    lastPressAt.current = pressedAt
    onPress?.(event)
  }, [onPress])

  const variantStyles = (() => {
    switch (variant) {
      case 'primary':
        return styles.primary
      case 'secondary':
        return styles.secondary
      case 'tertiary':
        return styles.tertiary
      case 'danger':
        return styles.danger
      default:
        return styles.primary
    }
  })()

  const sizeStyles = (() => {
    switch (size) {
      case 'sm':
        return styles.sm
      case 'md':
        return styles.md
      case 'lg':
        return styles.lg
      default:
        return styles.md
    }
  })()

  const textVariantStyle = (() => {
    switch (variant) {
      case 'secondary':
        return styles.labelSecondary
      case 'tertiary':
        return styles.labelTertiary
      default:
        return styles.labelDefault
    }
  })()

  const loadingColor = variant === 'secondary' || variant === 'tertiary'
    ? colors.primary
    : colors.textInverse

  return (
    <Pressable
      {...props}
      accessibilityState={{ ...accessibilityState, busy: isLoading, disabled: unavailable }}
      disabled={unavailable}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variantStyles,
        sizeStyles,
        isFullWidth && styles.fullWidth,
        unavailable ? styles.disabled : null,
        pressed && !unavailable ? styles.pressed : null,
        style,
      ]}
    >
      {isLoading ? <ActivityIndicator color={loadingColor} size="small" /> : null}
      <Text style={[styles.label, textVariantStyle, textStyle]}>
        {isLoading ? loadingLabel : children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tertiary: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  label: {
    fontWeight: '600',
    textAlign: 'center',
  },
  labelDefault: {
    color: colors.textInverse,
    fontSize: typography.button.fontSize,
  },
  labelSecondary: {
    color: colors.textPrimary,
    fontSize: typography.button.fontSize,
  },
  labelTertiary: {
    color: colors.primary,
    fontSize: typography.button.fontSize,
  },
})

