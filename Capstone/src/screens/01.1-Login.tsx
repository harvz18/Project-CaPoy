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
import { BrandIdentity } from '../components/BrandIdentity'
import { LuminousPillButton } from '../components/LuminousPillButton'
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

const neo = {
  surface: '#E9EDF0',
  edge: 'rgba(255, 255, 255, 0.62)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
}

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
                {({ pressed }) => (
                  <>
                    <View style={[styles.checkbox, rememberMe && styles.checkboxChecked, pressed && styles.checkboxPressed]}>
                      {rememberMe && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </>
                )}
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

            <LuminousPillButton
              accessibilityLabel="Log in"
              disabled={isLoading}
              isFullWidth
              isLoading={isLoading}
              onPress={handleLogIn}
              style={styles.loginButton}
              textStyle={styles.sinkingButtonText}
              tone="burgundyMatte"
            >
              Login
            </LuminousPillButton>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            <LuminousPillButton
              accessibilityLabel="Continue with Google"
              disabled={isLoading}
              isFullWidth
              isLoading={isOAuthLoading}
              neumorphicSurfaceColor={neo.surface}
              onPress={handleGoogleLogIn}
              style={styles.oauthButton}
              tone="neumorphic"
            >
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                source={require('../../assets/google-g-neo.png')}
                style={styles.googleIcon}
              />
              <Text style={styles.googleLabel}>Google</Text>
            </LuminousPillButton>
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
    backgroundColor: neo.surface,
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
    backgroundColor: neo.surface,
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
    backgroundColor: neo.surface,
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
    backgroundColor: colors.grey600,
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
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.xl,
    backgroundColor: neo.surface,
    paddingHorizontal: spacing.xl,
    paddingLeft: spacing['4xl'],
    fontSize: 15,
    boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}`,
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
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.small,
    backgroundColor: neo.surface,
    elevation: 0,
    boxShadow: 'inset 3px 3px 6px rgba(160, 171, 180, 0.48), inset -3px -3px 6px rgba(255, 255, 255, 0.92)',
  },
  checkboxChecked: {
    borderColor: 'rgba(255, 240, 245, 0.30)',
    backgroundColor: '#6B1E2E',
    shadowColor: '#2B0712',
    shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.36,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: '3px 4px 7px rgba(43, 7, 18, 0.36), -2px -2px 5px rgba(255, 255, 255, 0.70), inset 1px 1px 1px rgba(255, 255, 255, 0.16)',
  },
  checkboxPressed: {
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ translateY: 1 }],
    boxShadow: 'inset 2px 2px 4px rgba(107, 30, 46, 0.28), inset -2px -2px 4px rgba(255, 255, 255, 0.86)',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
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
    marginTop: spacing.xs,
  },
  sinkingButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textShadowColor: 'rgba(37, 4, 14, 0.50)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    transform: [{ translateY: 1 }],
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
    marginTop: spacing.xs,
  },
  googleLabel: {
    color: '#6B1E2E',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.sm,
    textShadowColor: 'rgba(255, 255, 255, 0.84)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0.6,
    transform: [{ translateY: 1 }],
  },
  googleIcon: { width: 20, height: 20 },
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
