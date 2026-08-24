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
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface LoginScreenProps {
  onBack: () => void
  onLogIn: () => void
  onCreateAccount: () => void
  onForgotPassword: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onLogIn,
  onCreateAccount,
  onForgotPassword,
}) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const normalizedEmail = email.trim()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const passwordIsValid = password.length > 0
  const canSubmit = emailIsValid && passwordIsValid

  const handleLogIn = () => {
    setSubmitted(true)

    if (canSubmit) {
      onLogIn()
    }
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
            accessibilityLabel="Go back"
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
          <View style={styles.brandMark}>
            <Text style={styles.brandInitial}>M</Text>
          </View>
          <Text style={styles.eyebrow}>WELCOME BACK</Text>
          <Text style={styles.title}>Log in to your account</Text>
          <Text style={styles.subtitle}>
            Continue planning your events or managing your business with MULTIVENT.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.form}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              error={submitted && !emailIsValid}
              helperText={
                submitted && !emailIsValid ? 'Enter a valid email address.' : undefined
              }
              inputMode="email"
              keyboardType="email-address"
              label="Email address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              returnKeyType="next"
              value={email}
            />

            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              error={submitted && !passwordIsValid}
              helperText={
                submitted && !passwordIsValid ? 'Enter your password.' : undefined
              }
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={handleLogIn}
              placeholder="Enter your password"
              returnKeyType="done"
              secureTextEntry
              value={password}
            />

            <View style={styles.accountOptions}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((isRemembered) => !isRemembered)}
                style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed]}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onForgotPassword}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
            </View>

            {submitted && !canSubmit && (
              <Text accessibilityRole="alert" style={styles.formError}>
                Check your login details and try again.
              </Text>
            )}

            <Button
              accessibilityLabel="Log in"
              isFullWidth
              onPress={handleLogIn}
              size="lg"
              style={styles.loginButton}
            >
              LOG IN
            </Button>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to MULTIVENT? </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onCreateAccount}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.createAccountText}>Create an account</Text>
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
  hero: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  brandMark: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F5E7DC',
    borderWidth: 1,
    borderColor: colors.accentLight,
    marginBottom: spacing.xl,
  },
  brandInitial: {
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
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  accountOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.small,
    backgroundColor: colors.background,
  },
  checkboxChecked: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  checkmark: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  rememberText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  forgotPasswordText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  formError: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
  },
  loginButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
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
  createAccountText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
})
