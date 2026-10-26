import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Button } from '../components/Button'
import { BrandIdentity } from '../components/BrandIdentity'
import { TextInput, type AppTextInputInstance } from '../components/TextInput'
import { signInWithEmail, signInWithOAuth } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface LoginScreenProps {
  onBack: () => void
  onLogIn: () => void
  onCreateAccount: () => void
  onForgotPassword: () => void
  presentation?: 'screen' | 'sheet'
  onSheetDragStart?: () => void
  onSheetDrag?: (translationY: number) => void
  onSheetDragEnd?: (translationY: number, velocityY: number) => void
}

type ScrollViewInstance = React.ComponentRef<typeof ScrollView>

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onLogIn,
  onCreateAccount,
  onForgotPassword,
  presentation = 'screen',
  onSheetDragStart,
  onSheetDrag,
  onSheetDragEnd,
}) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const scrollRef = useRef<ScrollViewInstance>(null)
  const emailRef = useRef<AppTextInputInstance>(null)
  const passwordRef = useRef<AppTextInputInstance>(null)
  const formTop = useRef(0)
  const fieldOffsets = useRef<Record<'email' | 'password', number>>({ email: 0, password: 0 })
  const focusedField = useRef<'email' | 'password' | null>(null)
  const onBackRef = useRef(onBack)
  const onSheetDragStartRef = useRef(onSheetDragStart)
  const onSheetDragRef = useRef(onSheetDrag)
  const onSheetDragEndRef = useRef(onSheetDragEnd)

  onBackRef.current = onBack
  onSheetDragStartRef.current = onSheetDragStart
  onSheetDragRef.current = onSheetDrag
  onSheetDragEndRef.current = onSheetDragEnd
  const sheetHandlePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => onSheetDragStartRef.current?.(),
      onPanResponderMove: (_event, gesture) => {
        onSheetDragRef.current?.(Math.max(0, gesture.dy))
      },
      onPanResponderRelease: (_event, gesture) => {
        const translationY = Math.max(0, gesture.dy)
        if (onSheetDragEndRef.current) {
          onSheetDragEndRef.current(translationY, gesture.vy)
          return
        }

        if (gesture.dy > 36 || gesture.vy > 0.8) {
          onBackRef.current()
        }
      },
      onPanResponderTerminate: (_event, gesture) => {
        const translationY = Math.max(0, gesture.dy)
        if (onSheetDragEndRef.current) {
          onSheetDragEndRef.current(translationY, gesture.vy)
          return
        }

        if (gesture.dy > 36 || gesture.vy > 0.8) {
          onBackRef.current()
        }
      },
    })
  ).current

  const normalizedEmail = email.trim()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const passwordIsValid = password.length > 0
  const isSheet = presentation === 'sheet'

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height)
      const field = focusedField.current
      if (field) {
        setTimeout(() => scrollToField(field), 100)
      }
    })
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
    })

    return () => {
      keyboardShowSubscription.remove()
      keyboardHideSubscription.remove()
    }
  }, [])

  const handleLogIn = async () => {
    setSubmitted(true)
    setAuthError('')

    if (isLoading) {
      return
    }

    if (!emailIsValid) {
      revealField('email', emailRef)
      return
    }
    if (!passwordIsValid) {
      revealField('password', passwordRef)
      return
    }

    setIsLoading(true)
    const result = await signInWithEmail(normalizedEmail, password)
    setIsLoading(false)

    if (result.ok) {
      onLogIn()
      return
    }

    setAuthError(result.message ?? 'Unable to log in. Please try again.')
  }

  function revealField(
    field: 'email' | 'password',
    inputRef: React.RefObject<AppTextInputInstance | null>
  ) {
    focusedField.current = field
    scrollToField(field)
    setTimeout(() => inputRef.current?.focus(), 180)
  }

  function scrollToField(field: 'email' | 'password') {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formTop.current + fieldOffsets.current[field] - spacing.lg),
        animated: true,
      })
    })
  }

  const handleGoogleLogIn = async () => {
    if (isOAuthLoading || isLoading) {
      return
    }

    setSubmitted(false)
    setAuthError('')
    setIsOAuthLoading(true)
    const result = await signInWithOAuth('google')
    setIsOAuthLoading(false)

    if (result.ok) {
      onLogIn()
      return
    }

    setAuthError(result.message ?? 'Unable to continue with Google. Please try again.')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, isSheet && styles.sheetScreen]}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={[
          styles.content,
          isSheet && styles.sheetContent,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing['2xl'] },
        ]}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="never"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        {!isSheet && (
          <View style={styles.hero}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../images/ClientSignupSVG.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                color={colors.textInverse}
                name="chevron-left-circle-outline"
                size={34}
              />
            </Pressable>
          </View>
        )}

        <View style={[styles.sheet, isSheet && styles.bottomSheet]}>
          {isSheet && (
            <View {...sheetHandlePanResponder.panHandlers} style={styles.sheetTopBar}>
              <View style={styles.sheetHandle} />
            </View>
          )}
          <BrandIdentity markSize={42} showName={!isSheet} style={styles.brandIdentity} />
          <Text style={styles.title}>Welcome Back!</Text>
          <View style={styles.signupPrompt}>
            <Text style={styles.signupPromptText}>Don't Have An Account? </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onCreateAccount}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.signupText}>Sign Up</Text>
            </Pressable>
          </View>

          <View onLayout={(event) => { formTop.current = event.nativeEvent.layout.y }} style={styles.form}>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              error={submitted && !emailIsValid}
              helperText={
                submitted && !emailIsValid ? 'Enter a valid email address.' : undefined
              }
              inputMode="email"
              keyboardType="email-address"
              icon={<MaterialCommunityIcons color={colors.primaryDark} name="email-outline" size={18} />}
              onChangeText={setEmail}
              onContainerLayout={(event) => { fieldOffsets.current.email = event.nativeEvent.layout.y }}
              onFocus={() => {
                focusedField.current = 'email'
                scrollToField('email')
              }}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="Enter your email address"
              ref={emailRef}
              returnKeyType="next"
              style={styles.input}
              value={email}
            />

            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              error={submitted && !passwordIsValid}
              helperText={
                submitted && !passwordIsValid ? 'Enter your password.' : undefined
              }
              icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={18} />}
              onChangeText={setPassword}
              onContainerLayout={(event) => { fieldOffsets.current.password = event.nativeEvent.layout.y }}
              onFocus={() => {
                focusedField.current = 'password'
                scrollToField('password')
              }}
              onSubmitEditing={handleLogIn}
              placeholder="Password"
              ref={passwordRef}
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
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

            {authError.length > 0 && (
              <Text accessibilityRole="alert" style={styles.formError}>
                {authError}
              </Text>
            )}

            <Button
              accessibilityLabel="Log in"
              disabled={isLoading}
              isFullWidth
              isLoading={isLoading}
              onPress={handleLogIn}
              size="lg"
              style={styles.loginButton}
            >
              Login
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              accessibilityLabel="Continue with Google"
              disabled={isLoading}
              isFullWidth
              isLoading={isOAuthLoading}
              onPress={handleGoogleLogIn}
              size="lg"
              style={styles.oauthButton}
              textStyle={styles.oauthButtonText}
              variant="secondary"
            >
              <MaterialCommunityIcons color="#4285F4" name="google" size={18} />
              <Text style={styles.googleLabel}>Google</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  brandIdentity: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetScreen: {
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100%',
    alignSelf: 'center',
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
  },
  sheetContent: {
    flexGrow: 1,
    minHeight: 0,
    paddingBottom: 0,
  },
  topBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
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
    height: 340,
    overflow: 'hidden',
    backgroundColor: colors.primaryDark,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
    width: undefined,
    height: undefined,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(42, 12, 22, 0.58)',
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
    color: colors.primaryDark,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheet: {
    marginTop: -54,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.background,
  },
  bottomSheet: {
    flex: 1,
    marginTop: 0,
    paddingTop: 0,
  },
  sheetTopBar: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetHandle: {
    width: 68,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.grey300,
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  signupPromptText: {
    color: colors.textSecondary,
    fontSize: typography.caption,
  },
  signupText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  input: {
    height: 52,
    borderWidth: 0,
    borderRadius: radius.xl,
    backgroundColor: '#F1F2F4',
    paddingHorizontal: spacing.xl,
    paddingLeft: spacing['4xl'],
    fontSize: 15,
  },
  inputWithIcon: {
    paddingLeft: spacing['4xl'],
  },
  formCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  form: {
    gap: spacing.md,
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
    fontSize: typography.caption,
  },
  forgotPasswordText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  formError: {
    color: colors.error,
    lineHeight: 20,
  },
  loginButton: {
    borderRadius: radius.pill,
    minHeight: 48,
    backgroundColor: '#7A1D35',
    shadowColor: '#7A1D35',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  dividerLine: {
    display: 'none',
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  oauthButton: {
    borderRadius: radius.pill,
    minHeight: 48,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  oauthButtonText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  googleLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.sm,
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
