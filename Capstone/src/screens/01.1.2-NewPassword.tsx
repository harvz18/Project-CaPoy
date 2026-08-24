import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { resetPasswordWithCode } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface NewPasswordScreenProps {
  recoveryContact: string
  onBack: () => void
  onPasswordReset: () => void
}

export const NewPasswordScreen: React.FC<NewPasswordScreenProps> = ({
  recoveryContact,
  onBack,
  onPasswordReset,
}) => {
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const codeIsValid = /^\d{6}$/.test(resetCode)
  const passwordIsValid = newPassword.length >= 8
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0
  const canSubmit = codeIsValid && passwordIsValid && passwordsMatch

  const handleResetPassword = async () => {
    setSubmitted(true)
    setAuthError('')

    if (!canSubmit || isLoading) {
      return
    }

    setIsLoading(true)
    const result = await resetPasswordWithCode({
      email: recoveryContact,
      token: resetCode,
      password: newPassword,
    })
    setIsLoading(false)

    if (result.ok) {
      setPasswordUpdated(true)
      return
    }

    setAuthError(result.message ?? 'Unable to update your password. Please try again.')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to password recovery"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backArrow}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.topBarSpacer} />
        </View>

        {passwordUpdated ? (
          <View style={styles.successContainer}>
            <View style={[styles.iconCircle, styles.successIconCircle]}>
              <Text style={styles.successIcon}>{'\u2713'}</Text>
            </View>
            <Text style={styles.eyebrow}>PASSWORD UPDATED</Text>
            <Text style={styles.title}>Your new password is ready</Text>
            <Text style={styles.subtitle}>
              You can now use your new password to log in to your MULTIVENT account.
            </Text>
            <Button
              accessibilityLabel="Continue to login"
              isFullWidth
              onPress={onPasswordReset}
              size="lg"
              style={styles.primaryButton}
            >
              CONTINUE TO LOGIN
            </Button>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.iconCircle}>
                <Text style={styles.lockIcon}>*</Text>
              </View>
              <Text style={styles.eyebrow}>SECURE YOUR ACCOUNT</Text>
              <Text style={styles.title}>Create a new password</Text>
              <Text style={styles.subtitle}>
                Enter the reset code sent to{' '}
                <Text style={styles.contactText}>
                  {recoveryContact || 'your email or phone number'}
                </Text>
                , then choose a new password.
              </Text>
            </View>

            <View style={styles.formCard}>
              <TextInput
                error={submitted && !codeIsValid}
                helperText={
                  submitted && !codeIsValid ? 'Enter the six-digit reset code.' : undefined
                }
                inputMode="numeric"
                keyboardType="number-pad"
                label="Reset code"
                maxLength={6}
                onChangeText={(value) => setResetCode(value.replace(/\D/g, ''))}
                placeholder="000000"
                returnKeyType="next"
                value={resetCode}
              />

              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                error={submitted && !passwordIsValid}
                helperText={
                  submitted && !passwordIsValid
                    ? 'Password must contain at least 8 characters.'
                    : 'Use at least 8 characters.'
                }
                label="New password"
                onChangeText={setNewPassword}
                placeholder="Enter your new password"
                returnKeyType="next"
                secureTextEntry
                value={newPassword}
              />

              <TextInput
                autoCapitalize="none"
                autoComplete="new-password"
                error={submitted && !passwordsMatch}
                helperText={
                  submitted && !passwordsMatch ? 'Passwords do not match.' : undefined
                }
                label="Confirm new password"
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleResetPassword}
                placeholder="Re-enter your new password"
                returnKeyType="done"
                secureTextEntry
                value={confirmPassword}
              />

              {submitted && !canSubmit && (
                <Text accessibilityRole="alert" style={styles.formError}>
                  Check the reset code and password details, then try again.
                </Text>
              )}

              {authError.length > 0 && (
                <Text accessibilityRole="alert" style={styles.formError}>
                  {authError}
                </Text>
              )}

              <Button
                accessibilityLabel="Reset password"
                disabled={!canSubmit}
                isFullWidth
                isLoading={isLoading}
                onPress={handleResetPassword}
                size="lg"
                style={styles.primaryButton}
              >
                RESET PASSWORD
              </Button>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.resendButton, pressed && styles.pressed]}
            >
              <Text style={styles.resendText}>Did not receive a code? Request another</Text>
            </Pressable>

            <View style={styles.notice}>
              <Text style={styles.noticeIcon}>i</Text>
              <Text style={styles.noticeText}>
                Choose a password you do not use for other accounts and never share your reset
                code with anyone.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  topBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundSecondary,
  },
  backArrow: {
    color: colors.primaryDark,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -3,
  },
  brand: {
    color: colors.primaryDark,
    fontSize: typography.h3,
    fontWeight: '700',
    letterSpacing: 3,
  },
  topBarSpacer: {
    width: 40,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['5xl'],
    gap: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F5E7DC',
    borderWidth: 1,
    borderColor: colors.accentLight,
    marginBottom: spacing.xl,
  },
  successIconCircle: {
    backgroundColor: '#EAF6EC',
    borderColor: '#AED8B4',
  },
  lockIcon: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: '700',
  },
  successIcon: {
    color: colors.success,
    fontSize: 34,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.h1,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  contactText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  formCard: {
    gap: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  formError: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    marginTop: spacing.sm,
  },
  resendButton: {
    alignSelf: 'center',
    padding: spacing.lg,
  },
  resendText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.medium,
    backgroundColor: '#F5E7DC',
  },
  noticeIcon: {
    width: 22,
    height: 22,
    color: colors.textInverse,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.65,
  },
})
