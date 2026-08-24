import React from 'react'
import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native'
import { colors, radius, spacing, typography } from '../theme/tokens'

interface ButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isFullWidth?: boolean
  isLoading?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isFullWidth = false,
  isLoading = false,
  children,
  disabled,
  style,
  textStyle,
  ...props
}) => {
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

  return (
    <Pressable
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.base,
        variantStyles,
        sizeStyles,
        isFullWidth && styles.fullWidth,
        disabled || isLoading ? styles.disabled : null,
        pressed && !disabled && !isLoading ? styles.pressed : null,
        style,
      ]}
      {...props}
    >
      <Text style={[styles.label, textVariantStyle, textStyle]}>
        {isLoading ? 'Loading...' : children}
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

