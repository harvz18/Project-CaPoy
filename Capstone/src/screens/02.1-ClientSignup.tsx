import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Button } from '../components/Button'
import { BrandIdentity } from '../components/BrandIdentity'
import { TextInput } from '../components/TextInput'
import { signInWithOAuth, signUpClient } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface SignupScreenProps {
  onBack: () => void
  onSignUp: (email: string, needsVerification: boolean) => void
  onGoogleSignUp?: () => void
  onLogIn?: () => void
  presentation?: 'screen' | 'sheet'
  onSheetDragStart?: () => void
  onSheetDrag?: (translationY: number) => void
  onSheetDragEnd?: (translationY: number, velocityY: number) => void
}

type SignupField = 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms'

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onBack,
  onSignUp,
  onGoogleSignUp,
  onLogIn,
  presentation = 'screen',
  onSheetDragStart,
  onSheetDrag,
  onSheetDragEnd,
}) => {
  const { height } = useWindowDimensions()
  const isSheet = presentation === 'sheet'
  const sheetEntrance = useRef(new Animated.Value(presentation === 'sheet' ? 0 : 1)).current
  const sheetScroll = useRef<ScrollViewInstance>(null)
  const fullNameRef = useRef<TextInputInstance>(null)
  const emailRef = useRef<TextInputInstance>(null)
  const phoneRef = useRef<TextInputInstance>(null)
  const passwordRef = useRef<TextInputInstance>(null)
  const confirmPasswordRef = useRef<TextInputInstance>(null)
  const fieldOffsets = useRef<Record<SignupField, number>>({
    fullName: 0,
    email: 0,
    phone: 0,
    password: 0,
    confirmPassword: 0,
    terms: 0,
  })
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [formContentHeight, setFormContentHeight] = useState(0)
  const [formViewportHeight, setFormViewportHeight] = useState(0)
  const focusedField = useRef<SignupField | null>(null)
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

        if (translationY > 36 || gesture.vy > 0.8) onBackRef.current()
      },
      onPanResponderTerminate: (_event, gesture) => {
        const translationY = Math.max(0, gesture.dy)
        if (onSheetDragEndRef.current) {
          onSheetDragEndRef.current(translationY, gesture.vy)
          return
        }

        if (translationY > 36 || gesture.vy > 0.8) onBackRef.current()
      },
    })
  ).current

  useEffect(() => {
    if (isSheet) {
      sheetEntrance.setValue(0)
      return
    }

    sheetEntrance.setValue(1)
    Animated.timing(sheetEntrance, { toValue: 0, duration: 420, useNativeDriver: true }).start()
  }, [isSheet, sheetEntrance])

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height)
      const field = focusedField.current
      if (field) setTimeout(() => scrollToField(field), 100)
    })
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
      sheetScroll.current?.scrollTo({ y: 0, animated: true })
    })

    return () => {
      keyboardShowSubscription.remove()
      keyboardHideSubscription.remove()
    }
  }, [])

  const normalizedEmail = email.trim()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const fullNameIsValid = fullName.trim().length > 0
  const phoneIsValid = phoneNumber.trim().length > 0
  const passwordIsValid = password.length >= 8
  const confirmPasswordIsValid = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit =
    fullNameIsValid &&
    emailIsValid &&
    phoneIsValid &&
    passwordIsValid &&
    confirmPasswordIsValid &&
    acceptedTerms
  const canScrollForm =
    keyboardHeight > 0 || formContentHeight > formViewportHeight + 1

  const handleSignUp = async () => {
    setSubmitted(true)
    setAuthError('')
    if (isLoading) return
    if (!fullNameIsValid) return revealField('fullName', fullNameRef)
    if (!emailIsValid) return revealField('email', emailRef)
    if (!phoneIsValid) return revealField('phone', phoneRef)
    if (!passwordIsValid) return revealField('password', passwordRef)
    if (!confirmPasswordIsValid) return revealField('confirmPassword', confirmPasswordRef)
    if (!acceptedTerms) return revealField('terms')
    if (!canSubmit) return
    setIsLoading(true)
    const result = await signUpClient({ fullName, email: normalizedEmail, phoneNumber, password })
    setIsLoading(false)
    if (result.ok) {
      onSignUp(normalizedEmail, result.needsVerification ?? true)
      return
    }
    setAuthError(result.message ?? 'Unable to create your account. Please try again.')
  }

  const handleGoogleSignUp = async () => {
    if (isLoading || isOAuthLoading) return
    setSubmitted(false)
    setAuthError('')
    setIsOAuthLoading(true)
    const result = await signInWithOAuth('google')
    setIsOAuthLoading(false)
    if (result.ok) {
      onGoogleSignUp?.()
      return
    }
    setAuthError(result.message ?? 'Unable to continue with Google. Please try again.')
  }

  function revealField(
    field: SignupField,
    inputRef?: React.RefObject<TextInputInstance | null>
  ) {
    focusedField.current = field
    scrollToField(field)
    if (inputRef) setTimeout(() => inputRef.current?.focus(), 180)
  }

  function scrollToField(field: SignupField) {
    requestAnimationFrame(() => {
      sheetScroll.current?.scrollTo({
        y: Math.max(0, fieldOffsets.current[field] - spacing.lg),
        animated: true,
      })
    })
  }

  const handleFieldFocus = (field: SignupField) => {
    focusedField.current = field
    scrollToField(field)
  }

  const visibilityIcon = (visible: boolean, label: string, onPress: () => void) => (
    <Pressable
      accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
    >
      <MaterialCommunityIcons color="#92939A" name={visible ? 'eye' : 'eye-off-outline'} size={20} />
    </Pressable>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, isSheet && styles.sheetScreen]}
    >
      <View style={[styles.content, isSheet && styles.sheetContent]}>
        {!isSheet && (
          <View style={styles.hero}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            >
              <MaterialCommunityIcons
                color={colors.primaryDark}
                name="chevron-left-circle-outline"
                size={34}
              />
            </Pressable>
            <Image
              accessibilityIgnoresInvertColors
              blurRadius={3}
              source={require('../../images/ClientSignupSVG.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        )}

        <Animated.View
          style={[
            styles.sheet,
            isSheet && styles.bottomSheet,
            {
              opacity: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                {
                  translateY: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
                },
                {
                  scale: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }),
                },
              ],
            },
          ]}
        >
          {isSheet && (
            <View {...sheetHandlePanResponder.panHandlers} style={styles.sheetTopBar}>
              <View style={styles.sheetHandle} />
            </View>
          )}
          <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
            <View style={styles.sheetBody}>
          <BrandIdentity markSize={38} showName={!isSheet} style={styles.brandIdentity} />
          <Text style={styles.title}>Create Your Account</Text>
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already Have An Account? </Text>
            <Pressable accessibilityRole="button" disabled={!onLogIn} onPress={onLogIn}>
              <Text style={styles.loginText}>Sign In</Text>
            </Pressable>
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={[
              styles.form,
              keyboardHeight > 0 && {
                paddingBottom: Math.min(keyboardHeight * 0.35, 120) + spacing['3xl'],
              },
            ]}
            keyboardDismissMode="none"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={(_width, contentHeight) => setFormContentHeight(contentHeight)}
            onLayout={(event) => setFormViewportHeight(event.nativeEvent.layout.height)}
            ref={sheetScroll}
            scrollEnabled={canScrollForm}
            showsVerticalScrollIndicator={false}
            style={styles.formScroll}
          >
            <TextInput autoCapitalize="words" autoComplete="name" error={submitted && !fullNameIsValid} helperText={submitted && !fullNameIsValid ? 'Full name is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setFullName} onContainerLayout={(event) => { fieldOffsets.current.fullName = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('fullName')} onSubmitEditing={() => emailRef.current?.focus()} placeholder="Full name" ref={fullNameRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={fullName} />
            <TextInput autoCapitalize="none" autoComplete="email" error={submitted && !emailIsValid} helperText={submitted && !emailIsValid ? 'Enter a valid email address.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="at" size={20} />} inputMode="email" keyboardType="email-address" onChangeText={setEmail} onContainerLayout={(event) => { fieldOffsets.current.email = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('email')} onSubmitEditing={() => phoneRef.current?.focus()} placeholder="Enter your email address" ref={emailRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={email} />
            <TextInput autoComplete="tel" error={submitted && !phoneIsValid} helperText={submitted && !phoneIsValid ? 'Phone number is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="cellphone" size={20} />} inputMode="tel" keyboardType="phone-pad" onChangeText={setPhoneNumber} onContainerLayout={(event) => { fieldOffsets.current.phone = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('phone')} onSubmitEditing={() => passwordRef.current?.focus()} placeholder="Phone number" ref={phoneRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={phoneNumber} />
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && !passwordIsValid} helperText={submitted && !passwordIsValid ? 'Password must contain at least 8 characters.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setPassword} onContainerLayout={(event) => { fieldOffsets.current.password = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('password')} onSubmitEditing={() => confirmPasswordRef.current?.focus()} placeholder="Password" ref={passwordRef} returnKeyType="next" rightIcon={visibilityIcon(isPasswordVisible, 'password', () => setIsPasswordVisible((visible) => !visible))} secureTextEntry={!isPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={password} />
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && !confirmPasswordIsValid} helperText={submitted && !confirmPasswordIsValid ? (confirmPassword.length === 0 ? 'Confirm your password.' : 'Passwords do not match.') : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setConfirmPassword} onContainerLayout={(event) => { fieldOffsets.current.confirmPassword = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('confirmPassword')} onSubmitEditing={handleSignUp} placeholder="Confirm password" ref={confirmPasswordRef} returnKeyType="done" rightIcon={visibilityIcon(isConfirmPasswordVisible, 'confirm password', () => setIsConfirmPasswordVisible((visible) => !visible))} secureTextEntry={!isConfirmPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={confirmPassword} />

          {authError.length > 0 && <Text accessibilityRole="alert" style={styles.formError}>{authError}</Text>}

          <View onLayout={(event) => { fieldOffsets.current.terms = event.nativeEvent.layout.y }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((accepted) => !accepted)} style={styles.termsRow}>
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, submitted && !acceptedTerms && styles.checkboxError]}>
              {acceptedTerms && <MaterialCommunityIcons color={colors.textInverse} name="check" size={14} />}
            </View>
            <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
          </Pressable>
          {submitted && !acceptedTerms && <Text accessibilityRole="alert" style={styles.termsError}>Please accept the Terms of Service and Privacy Policy.</Text>}
          </View>

          <Button accessibilityLabel="Create client account" disabled={isLoading} isFullWidth isLoading={isLoading} onPress={handleSignUp} size="lg" style={styles.submitButton} textStyle={styles.buttonText}>CREATE CLIENT ACCOUNT</Button>
          <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
          <Button accessibilityLabel="Sign up with Google" disabled={isLoading || !onGoogleSignUp} isFullWidth isLoading={isOAuthLoading} onPress={handleGoogleSignUp} size="lg" style={styles.googleButton} textStyle={[styles.buttonText, styles.googleButtonText]} variant="secondary">Google</Button>
          </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  brandIdentity: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  screen: { flex: 1, backgroundColor: '#F4F4F6' },
  sheetScreen: { overflow: 'hidden', backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: colors.background },
  sheetContent: { maxWidth: undefined },
  hero: { height: 340, overflow: 'hidden', alignItems: 'center', paddingTop: spacing['4xl'], backgroundColor: '#741C31', position: 'relative' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'transparent' },
  backButtonPressed: { opacity: 0.65 },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  sheet: { flex: 1, marginTop: -180, paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: colors.background },
  bottomSheet: { marginTop: 0, paddingTop: 0 },
  sheetTopBar: { height: 40, alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.sm, marginBottom: spacing.sm },
  sheetHandle: { width: 68, height: 4, borderRadius: radius.pill, backgroundColor: colors.grey300 },
  sheetBody: { flex: 1 },
  title: { color: colors.primaryDark, fontSize: 24, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  loginPromptText: { color: colors.textSecondary, fontSize: 14 },
  loginText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  form: { gap: spacing.md, paddingBottom: spacing['3xl'] },
  formScroll: { flex: 1, marginBottom: spacing.md },
  input: { height: 52, borderWidth: 0, borderRadius: radius.xl, backgroundColor: '#F1F2F4', paddingHorizontal: spacing.xl, fontSize: 15 },
  inputWithIcon: { paddingLeft: spacing['4xl'] },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 0 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: 0 },
  checkbox: { width: 18, height: 18, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 5, backgroundColor: colors.background },
  checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  checkboxError: { borderColor: colors.error, backgroundColor: '#FFF4F4' },
  termsText: { flexShrink: 1, maxWidth: 280, color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  termsError: { marginTop: spacing.xs, color: colors.error, fontSize: typography.caption, lineHeight: 18 },
  formError: { color: colors.error, fontSize: typography.body, lineHeight: 20 },
  submitButton: { borderRadius: radius.pill, backgroundColor: '#7A1D35', minHeight: 44, paddingVertical: spacing.sm, marginTop: 0, shadowColor: '#7A1D35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  googleButton: { borderRadius: radius.pill, minHeight: 44, paddingVertical: spacing.sm, marginTop: 0 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  googleButtonText: { color: colors.textPrimary },
})
