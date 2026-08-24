import React, { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Button } from '../components/Button'
import { resendSignupCode, verifySignupCode } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface VerificationScreenProps {
  email: string
  onBack: () => void
  onVerified: () => void
}

const codeLength = 6

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  email,
  onBack,
  onVerified,
}) => {
  const inputRefs = useRef<Array<TextInput | null>>([])
  const [code, setCode] = useState<string[]>(Array(codeLength).fill(''))
  const [submitted, setSubmitted] = useState(false)
  const [resent, setResent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [resendError, setResendError] = useState('')

  const isComplete = code.every((digit) => digit.length === 1)
  const recipient = email.trim() || 'your email address'

  const handleCodeChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, '')
    const nextCode = [...code]

    if (digits.length === 0) {
      nextCode[index] = ''
      setCode(nextCode)
      return
    }

    digits
      .slice(0, codeLength - index)
      .split('')
      .forEach((digit, offset) => {
        nextCode[index + offset] = digit
      })

    setCode(nextCode)
    setSubmitted(false)

    const nextIndex = index + digits.length
    if (nextIndex < codeLength) {
      inputRefs.current[nextIndex]?.focus()
    } else {
      inputRefs.current[codeLength - 1]?.blur()
    }
  }

  const handleBackspace = (index: number) => {
    if (code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    setSubmitted(true)
    setAuthError('')

    if (!isComplete || isLoading) {
      return
    }

    setIsLoading(true)
    const result = await verifySignupCode(email, code.join(''))
    setIsLoading(false)

    if (result.ok) {
      onVerified()
      return
    }

    setAuthError(result.message ?? 'Unable to verify this code. Please try again.')
  }

  const handleResend = async () => {
    setCode(Array(codeLength).fill(''))
    setSubmitted(false)
    setResent(false)
    setAuthError('')
    setResendError('')
    inputRefs.current[0]?.focus()

    const result = await resendSignupCode(email)

    if (result.ok) {
      setResent(true)
      return
    }

    setResendError(result.message ?? 'Unable to request a new code. Please try again.')
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
            accessibilityLabel="Back to signup"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backArrow}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.mailIcon}>
            <Text style={styles.mailSymbol}>@</Text>
          </View>
          <Text style={styles.eyebrow}>EMAIL VERIFICATION</Text>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>We sent a six-digit verification code to</Text>
          <Text numberOfLines={1} style={styles.email}>
            {recipient}
          </Text>
        </View>

        <View style={styles.verificationCard}>
          <Text style={styles.codeLabel}>Enter verification code</Text>
          <View style={styles.codeRow}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(input) => {
                  inputRefs.current[index] = input
                }}
                accessibilityLabel={`Verification code digit ${index + 1}`}
                autoFocus={index === 0}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={codeLength}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace') {
                    handleBackspace(index)
                  }
                }}
                onSubmitEditing={index === codeLength - 1 ? handleVerify : undefined}
                returnKeyType={index === codeLength - 1 ? 'done' : 'next'}
                selectTextOnFocus
                style={[
                  styles.codeInput,
                  digit.length === 1 && styles.codeInputFilled,
                  submitted && !isComplete && styles.codeInputError,
                ]}
                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                value={digit}
              />
            ))}
          </View>

          {submitted && !isComplete && (
            <Text accessibilityRole="alert" style={styles.errorText}>
              Enter the complete six-digit code.
            </Text>
          )}

          {authError.length > 0 && (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {authError}
            </Text>
          )}

          {resent && (
            <Text accessibilityLiveRegion="polite" style={styles.successText}>
              A new verification code has been requested.
            </Text>
          )}

          {resendError.length > 0 && (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {resendError}
            </Text>
          )}

          <Button
            accessibilityLabel="Verify email address"
            disabled={!isComplete}
            isFullWidth
            isLoading={isLoading}
            onPress={handleVerify}
            size="lg"
            style={styles.verifyButton}
          >
            VERIFY EMAIL
          </Button>
        </View>

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>Did not receive the code? </Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleResend}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.resendAction}>Resend code</Text>
          </Pressable>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeIcon}>i</Text>
          <Text style={styles.noticeText}>
            Check your spam or junk folder if the verification email does not appear within a
            few minutes.
          </Text>
        </View>
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
  mailIcon: {
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
  mailSymbol: {
    color: colors.primaryDark,
    fontSize: 30,
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  email: {
    maxWidth: '100%',
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  verificationCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  codeLabel: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  codeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeInput: {
    flex: 1,
    minWidth: 40,
    maxWidth: 52,
    height: 56,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.medium,
    fontSize: typography.h2,
    fontWeight: '700',
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: colors.primaryDark,
    backgroundColor: '#FFF9F5',
  },
  codeInputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: typography.body,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  verifyButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  resendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  resendPrompt: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  resendAction: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
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
