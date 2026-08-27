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
import { requestPasswordReset } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface ForgotPasswordScreenProps {
  onBackToLogin: () => void
  onContinueToNewPassword: (recoveryContact: string) => void
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
  onContinueToNewPassword,
}) => {
  const [recoveryContact, setRecoveryContact] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const normalizedContact = recoveryContact.trim()
  const isEmail = /^\S+@\S+\.\S+$/.test(normalizedContact)
  const contactIsValid = isEmail

  const handleRequestReset = async () => {
    setSubmitted(true)
    setAuthError('')

    if (!contactIsValid || isLoading) {
      return
    }

    setIsLoading(true)
    const result = await requestPasswordReset(normalizedContact)
    setIsLoading(false)

    if (result.ok) {
      setRequestSent(true)
      return
    }

    setAuthError(result.message ?? 'Unable to request a password reset. Please try again.')
  }

  const handleUseAnotherEmail = () => {
    setRecoveryContact('')
    setSubmitted(false)
    setRequestSent(false)
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
            accessibilityLabel="Back to login"
            hitSlop={12}
            onPress={onBackToLogin}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backArrow}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.topBarSpacer} />
        </View>

        {requestSent ? (
          <View style={styles.resultContainer}>
            <View style={[styles.iconCircle, styles.successIconCircle]}>
              <Text style={styles.successIcon}>{'\u2713'}</Text>
            </View>
            <Text style={styles.eyebrow}>RESET CODE REQUESTED</Text>
            <Text style={styles.title}>Check your messages</Text>
            <Text style={styles.subtitle}>A password reset code was requested for</Text>
            <Text numberOfLines={1} style={styles.emailText}>
              {normalizedContact}
            </Text>

            <View style={styles.notice}>
              <Text style={styles.noticeIcon}>i</Text>
              <Text style={styles.noticeText}>
                The reset code will expire for your security. Check your spam folder if it
                does not arrive within a few minutes.
              </Text>
            </View>

            <View style={styles.actions}>
              <Button
                accessibilityLabel="Continue to enter reset code"
                isFullWidth
                onPress={() => onContinueToNewPassword(normalizedContact)}
                size="lg"
                style={styles.primaryButton}
              >
                CONTINUE
              </Button>
              <Pressable
                accessibilityRole="button"
                onPress={handleUseAnotherEmail}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
              >
                <Text style={styles.textButtonLabel}>Use another email or phone number</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.iconCircle}>
                <Text style={styles.keyIcon}>?</Text>
              </View>
              <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
              <Text style={styles.title}>Forgot your password?</Text>
              <Text style={styles.subtitle}>
                Enter the email linked to your account and we will send you a reset code.
              </Text>
            </View>

            <View style={styles.formCard}>
              <TextInput
                autoCapitalize="none"
                error={submitted && !contactIsValid}
                helperText={
                  submitted && !contactIsValid
                    ? 'Enter a valid email address.'
                    : undefined
                }
                inputMode="email"
                keyboardType="email-address"
                label="Email address"
                onChangeText={setRecoveryContact}
                onSubmitEditing={handleRequestReset}
                placeholder="you@example.com"
                returnKeyType="send"
                value={recoveryContact}
              />

              {authError.length > 0 && (
                <Text accessibilityRole="alert" style={styles.formError}>
                  {authError}
                </Text>
              )}

              <Button
                accessibilityLabel="Send password reset code"
                disabled={!contactIsValid}
                isFullWidth
                isLoading={isLoading}
                onPress={handleRequestReset}
                size="lg"
                style={styles.primaryButton}
              >
                SEND RESET CODE
              </Button>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Remembered your password? </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onBackToLogin}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.loginText}>Log In</Text>
              </Pressable>
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
    marginTop: spacing['4xl'],
    marginBottom: spacing['2xl'],
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['5xl'],
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
  keyIcon: {
    color: colors.primaryDark,
    fontSize: 32,
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
  },
  emailText: {
    maxWidth: '100%',
    color: colors.primaryDark,
    fontSize: typography.body,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  formCard: {
    gap: spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  notice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.medium,
    backgroundColor: '#F5E7DC',
    marginBottom: spacing.xl,
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
  formError: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  textButton: {
    alignSelf: 'center',
    padding: spacing.md,
  },
  textButtonLabel: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  loginText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
})
