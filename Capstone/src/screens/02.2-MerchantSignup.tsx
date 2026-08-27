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
import { signUpMerchant } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface MerchantSignupScreenProps {
  onBack: () => void
  onSignUp: (email: string, needsVerification: boolean) => void
  onLogIn?: () => void
}

export const MerchantSignupScreen: React.FC<MerchantSignupScreenProps> = ({
  onBack,
  onSignUp,
  onLogIn,
}) => {
  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState('')
  const [serviceCategory, setServiceCategory] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const normalizedEmail = email.trim()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const passwordsMatch = password === confirmPassword
  const hasRequiredFields =
    businessName.trim().length > 0 &&
    contactName.trim().length > 0 &&
    serviceCategory.trim().length > 0 &&
    emailIsValid &&
    phoneNumber.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0
  const canSubmit = hasRequiredFields && passwordsMatch && acceptedTerms

  const handleSignUp = async () => {
    setSubmitted(true)
    setAuthError('')

    if (!canSubmit || isLoading) {
      return
    }

    setIsLoading(true)
    const result = await signUpMerchant({
      businessName,
      contactName,
      serviceCategory,
      email: normalizedEmail,
      phoneNumber,
      password,
    })
    setIsLoading(false)

    if (result.ok) {
      onSignUp(normalizedEmail, result.needsVerification ?? true)
      return
    }

    setAuthError(result.message ?? 'Unable to create your merchant account. Please try again.')
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
            accessibilityLabel="Back to role selection"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backArrow}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>SERVICE PROVIDER ACCOUNT</Text>
          <Text style={styles.title}>Grow your event business</Text>
          <Text style={styles.subtitle}>
            Join MULTIVENT to showcase your services, connect with clients, and manage bookings.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="words"
            label="Business name"
            onChangeText={setBusinessName}
            placeholder="Enter your business name"
            returnKeyType="next"
            value={businessName}
          />

          <TextInput
            autoCapitalize="words"
            autoComplete="name"
            label="Contact person"
            onChangeText={setContactName}
            placeholder="Enter the primary contact name"
            returnKeyType="next"
            value={contactName}
          />

          <TextInput
            autoCapitalize="words"
            label="Service category"
            onChangeText={setServiceCategory}
            placeholder="e.g. Catering, Venue, Photography"
            returnKeyType="next"
            value={serviceCategory}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            error={submitted && !emailIsValid}
            helperText={
              submitted && !emailIsValid ? 'Enter a valid business email.' : undefined
            }
            inputMode="email"
            keyboardType="email-address"
            label="Business email"
            onChangeText={setEmail}
            placeholder="business@example.com"
            returnKeyType="next"
            value={email}
          />

          <TextInput
            autoComplete="tel"
            inputMode="tel"
            keyboardType="phone-pad"
            label="Phone number"
            onChangeText={setPhoneNumber}
            placeholder="Enter your business phone number"
            returnKeyType="next"
            value={phoneNumber}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            label="Password"
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            returnKeyType="next"
            secureTextEntry
            value={password}
          />

          <TextInput
            autoCapitalize="none"
            autoComplete="new-password"
            error={submitted && confirmPassword.length > 0 && !passwordsMatch}
            helperText={
              submitted && confirmPassword.length > 0 && !passwordsMatch
                ? 'Passwords do not match.'
                : undefined
            }
            label="Confirm password"
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSignUp}
            placeholder="Re-enter your password"
            returnKeyType="done"
            secureTextEntry
            value={confirmPassword}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => setAcceptedTerms((isAccepted) => !isAccepted)}
            style={({ pressed }) => [styles.termsRow, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Text style={styles.checkmark}>{'\u2713'}</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Merchant Terms</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </Pressable>

          {submitted && !canSubmit && (
            <Text accessibilityRole="alert" style={styles.formError}>
              Please complete every field, use a valid email, use at least 8 password
              characters, and accept the terms.
            </Text>
          )}

          {authError.length > 0 && (
            <Text accessibilityRole="alert" style={styles.formError}>
              {authError}
            </Text>
          )}

          <Button
            accessibilityLabel="Create service provider account"
            disabled={!canSubmit}
            isFullWidth
            isLoading={isLoading}
            onPress={handleSignUp}
            size="lg"
            style={styles.submitButton}
          >
            CREATE MERCHANT ACCOUNT
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!onLogIn}
            onPress={onLogIn}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.loginText, !onLogIn && styles.loginDisabled]}>Log In</Text>
          </Pressable>
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
  intro: {
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  form: {
    gap: spacing.lg,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.small,
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  termsLink: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  formError: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  footer: {
    flexDirection: 'row',
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
  loginDisabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.65,
  },
})
