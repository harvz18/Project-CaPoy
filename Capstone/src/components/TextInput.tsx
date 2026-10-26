import { Text } from './AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  
  TextInput as RNTextInput,
  type TextInputInstance,
  TextInputProps as RNTextInputProps,
  View,
} from 'react-native'
import { colors, radius, spacing, typography } from '../theme/tokens'

interface TextInputProps extends RNTextInputProps {
  label?: string
  helperText?: string
  error?: boolean
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
  onContainerLayout?: (event: LayoutChangeEvent) => void
}

export const TextInput = React.forwardRef<TextInputInstance, TextInputProps>(
  ({ label, helperText, error = false, icon, rightIcon, onContainerLayout, onBlur, onFocus, style, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const translateX = useRef(new Animated.Value(0)).current
    const wasError = useRef(error)

    useEffect(() => {
      const shouldShake = error && !wasError.current
      wasError.current = error
      if (!shouldShake) return

      let active = true
      void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotionEnabled) => {
        if (!active || reduceMotionEnabled) return
        translateX.setValue(0)
        Animated.sequence([
          Animated.timing(translateX, { toValue: -5, duration: 55, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 5, duration: 70, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -3, duration: 55, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 55, useNativeDriver: true }),
        ]).start()
      })

      return () => {
        active = false
        translateX.stopAnimation()
      }
    }, [error, translateX])

    return (
      <Animated.View
        onLayout={onContainerLayout}
        style={[styles.wrapper, { transform: [{ translateX }] }]}
      >
        {label && <Text style={styles.label}>{label}</Text>}

        <View style={styles.inputContainer}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <RNTextInput
            ref={ref}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              icon ? styles.inputWithIcon : null,
              rightIcon ? styles.inputWithRightIcon : null,
              style,
              focused ? styles.inputFocused : null,
              error ? styles.inputError : null,
            ]}
            onBlur={(event) => {
              setFocused(false)
              onBlur?.(event)
            }}
            onFocus={(event) => {
              setFocused(true)
              onFocus?.(event)
            }}
            {...props}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>

        {helperText && (
          <Text style={[styles.helperText, error ? styles.helperError : null]}>
            {helperText}
          </Text>
        )}
      </Animated.View>
    )
  }
)

TextInput.displayName = 'TextInput'

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    overflow: 'visible',
  },
  label: {
    fontSize: typography.secondary.fontSize,
    fontWeight: '500',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  inputContainer: {
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
  },
  inputWithIcon: {
    paddingLeft: spacing.xl,
  },
  inputWithRightIcon: {
    paddingRight: spacing['4xl'],
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  inputFocused: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  icon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 1,
  },
  helperText: {
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  helperError: {
    color: colors.error,
  },
})

