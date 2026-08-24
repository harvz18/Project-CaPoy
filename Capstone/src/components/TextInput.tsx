import React from 'react'
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
} from 'react-native'
import { colors, radius, spacing, typography } from '../theme/tokens'

interface TextInputProps extends RNTextInputProps {
  label?: string
  helperText?: string
  error?: boolean
  icon?: React.ReactNode
}

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(
  ({ label, helperText, error = false, icon, style, ...props }, ref) => {
    return (
      <View style={styles.wrapper}>
        {label && <Text style={styles.label}>{label}</Text>}

        <View style={styles.inputContainer}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <RNTextInput
            ref={ref}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              icon ? styles.inputWithIcon : null,
              error ? styles.inputError : null,
              style,
            ]}
            {...props}
          />
        </View>

        {helperText && (
          <Text style={[styles.helperText, error ? styles.helperError : null]}>
            {helperText}
          </Text>
        )}
      </View>
    )
  }
)

TextInput.displayName = 'TextInput'

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: typography.secondary.fontSize,
    fontWeight: '500',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.medium,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
  },
  inputWithIcon: {
    paddingLeft: spacing.xl,
  },
  inputError: {
    borderColor: colors.error,
  },
  icon: {
    position: 'absolute',
    left: spacing.md,
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

