import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { BlurTargetView } from 'expo-blur'
import { BrandIdentity } from '../components/BrandIdentity'
import { LuminousPillButton } from '../components/LuminousPillButton'
import { PolicyDocumentOverlay } from '../components/PolicyDocumentOverlay'
import { TextInput, type AppTextInputInstance } from '../components/TextInput'
import { signInWithOAuth, signUpClient } from '../lib/auth'
import { clientTermsAndConditions, privacyPolicy } from '../content/clientLegalDocuments'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface SignupScreenProps {
  onBack: () => void
  onSignUp: (email: string, needsVerification: boolean) => void
  onGoogleSignUp?: () => void
  onLogIn?: () => void
  onOpenPolicyOverlay?: (policy: { content: string; title: string }) => void
  presentation?: 'screen' | 'sheet'
  onSheetDragStart?: () => void
  onSheetDrag?: (translationY: number) => void
  onSheetDragEnd?: (translationY: number, velocityY: number) => void
}

type SignupField = 'firstName' | 'lastName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms'

const neo = {
  surface: '#E9EDF0',
  edge: 'rgba(255, 255, 255, 0.62)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
}
type ScrollViewInstance = React.ComponentRef<typeof ScrollView>
type LegalDocument = 'terms' | 'privacy'

const countryCodes = [
  { code: '+63', name: 'Philippines' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+81', name: 'Japan' },
]

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onBack,
  onSignUp,
  onGoogleSignUp,
  onLogIn,
  onOpenPolicyOverlay,
  presentation = 'screen',
  onSheetDragStart,
  onSheetDrag,
  onSheetDragEnd,
}) => {
  const { height } = useWindowDimensions()
  const isSheet = presentation === 'sheet'
  const sheetEntrance = useRef(new Animated.Value(presentation === 'sheet' ? 0 : 1)).current
  const sheetScroll = useRef<ScrollViewInstance>(null)
  const policyBlurTargetRef = useRef<React.ComponentRef<typeof View>>(null)
  const firstNameRef = useRef<AppTextInputInstance>(null)
  const lastNameRef = useRef<AppTextInputInstance>(null)
  const emailRef = useRef<AppTextInputInstance>(null)
  const phoneRef = useRef<AppTextInputInstance>(null)
  const passwordRef = useRef<AppTextInputInstance>(null)
  const confirmPasswordRef = useRef<AppTextInputInstance>(null)
  const fieldOffsets = useRef<Record<SignupField, number>>({
    firstName: 0,
    lastName: 0,
    email: 0,
    phone: 0,
    password: 0,
    confirmPassword: 0,
    terms: 0,
  })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
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
  const [countryCode, setCountryCode] = useState('+63')
  const [showCountryCodes, setShowCountryCodes] = useState(false)
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [formContentHeight, setFormContentHeight] = useState(0)
  const [formViewportHeight, setFormViewportHeight] = useState(0)
  const focusedField = useRef<SignupField | null>(null)
  const onBackRef = useRef(onBack)
  const onSheetDragStartRef = useRef(onSheetDragStart)
  const onSheetDragRef = useRef(onSheetDrag)
  const onSheetDragEndRef = useRef(onSheetDragEnd)

  const openLegalDocument = (document: LegalDocument) => {
    const policy = document === 'terms'
      ? { title: 'Terms & Conditions', content: clientTermsAndConditions }
      : { title: 'Privacy Policy', content: privacyPolicy }

    if (onOpenPolicyOverlay) {
      onOpenPolicyOverlay(policy)
      return
    }

    setLegalDocument(document)
  }

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
  const firstNameIsValid = firstName.trim().length > 0
  const lastNameIsValid = lastName.trim().length > 0
  const phoneIsValid = phoneNumber.trim().length > 0
  const passwordIsValid = password.length >= 8
  const confirmPasswordIsValid = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit =
    firstNameIsValid &&
    lastNameIsValid &&
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
    if (!firstNameIsValid) return revealField('firstName', firstNameRef)
    if (!lastNameIsValid) return revealField('lastName', lastNameRef)
    if (!emailIsValid) return revealField('email', emailRef)
    if (!phoneIsValid) return revealField('phone', phoneRef)
    if (!passwordIsValid) return revealField('password', passwordRef)
    if (!confirmPasswordIsValid) return revealField('confirmPassword', confirmPasswordRef)
    if (!acceptedTerms) return revealField('terms')
    if (!canSubmit) return
    setIsLoading(true)
    const result = await signUpClient({ firstName, lastName, email: normalizedEmail, phoneNumber: `${countryCode} ${phoneNumber.trim()}`, password })
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
    inputRef?: React.RefObject<AppTextInputInstance | null>
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

  const registrationActions = (
    <View style={[styles.actionFooter, isSheet && styles.stickyActionFooter]}>
      <View onLayout={(event) => { fieldOffsets.current.terms = event.nativeEvent.layout.y }}>
        <View style={styles.termsRow}>
          <Pressable accessibilityLabel="Accept Terms & Conditions and Privacy Policy" accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} hitSlop={6} onPress={() => setAcceptedTerms((accepted) => !accepted)}>
            {({ pressed }) => (
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, submitted && !acceptedTerms && styles.checkboxError, pressed && styles.checkboxPressed]}>
                {acceptedTerms && <MaterialCommunityIcons color="#FFFFFF" name="check" size={14} />}
              </View>
            )}
          </Pressable>
          <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.termsText}>
            I agree to the{' '}
            <Text accessibilityRole="link" onPress={() => openLegalDocument('terms')} style={styles.legalLink}>Terms & Conditions</Text>
            {' '}and{' '}
            <Text accessibilityRole="link" onPress={() => openLegalDocument('privacy')} style={styles.legalLink}>Privacy Policy</Text>.
          </Text>
        </View>
        {submitted && !acceptedTerms && <Text accessibilityRole="alert" style={styles.termsError}>Please accept the Terms & Conditions and Privacy Policy.</Text>}
      </View>
      <LuminousPillButton
        accessibilityLabel="Create client account"
        disabled={isLoading}
        isFullWidth
        isLoading={isLoading}
        onPress={handleSignUp}
        style={styles.submitButton}
        textStyle={styles.sinkingButtonText}
        tone="burgundyMatte"
      >
        Create Client Account
      </LuminousPillButton>
      <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
      <LuminousPillButton
        accessibilityLabel="Sign up with Google"
        disabled={isLoading || !onGoogleSignUp}
        isFullWidth
        isLoading={isOAuthLoading}
        neumorphicSurfaceColor={neo.surface}
        onPress={handleGoogleSignUp}
        style={styles.googleButton}
        tone="neumorphic"
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require('../../assets/google-g-neo.png')}
          style={styles.googleIcon}
        />
        <Text style={styles.sinkingGoogleLabel}>Google</Text>
      </LuminousPillButton>
    </View>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, isSheet && styles.sheetScreen, legalDocument && styles.policyOverlayVisibleScreen]}
    >
      <BlurTargetView ref={policyBlurTargetRef} style={[styles.content, isSheet && styles.sheetContent]}>
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
            <View style={styles.nameRow}>
              <View onLayout={(event) => { fieldOffsets.current.firstName = event.nativeEvent.layout.y }} style={styles.nameInput}>
                <TextInput autoCapitalize="words" autoComplete="name-given" error={submitted && !firstNameIsValid} helperText={submitted && !firstNameIsValid ? 'First name is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setFirstName} onFocus={() => handleFieldFocus('firstName')} onSubmitEditing={() => lastNameRef.current?.focus()} placeholder="First name" ref={firstNameRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={firstName} />
              </View>
              <View onLayout={(event) => { fieldOffsets.current.lastName = event.nativeEvent.layout.y }} style={styles.nameInput}>
                <TextInput autoCapitalize="words" autoComplete="name-family" error={submitted && !lastNameIsValid} helperText={submitted && !lastNameIsValid ? 'Last name is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setLastName} onFocus={() => handleFieldFocus('lastName')} onSubmitEditing={() => emailRef.current?.focus()} placeholder="Last name" ref={lastNameRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={lastName} />
              </View>
            </View>
            <TextInput autoCapitalize="none" autoComplete="email" error={submitted && !emailIsValid} helperText={submitted && !emailIsValid ? 'Enter a valid email address.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="at" size={20} />} inputMode="email" keyboardType="email-address" onChangeText={setEmail} onContainerLayout={(event) => { fieldOffsets.current.email = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('email')} onSubmitEditing={() => phoneRef.current?.focus()} placeholder="Enter your email address" ref={emailRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={email} />
            <View onLayout={(event) => { fieldOffsets.current.phone = event.nativeEvent.layout.y }} style={styles.phoneRow}>
              <Pressable accessibilityLabel="Select country calling code" accessibilityRole="button" onPress={() => setShowCountryCodes(true)} style={styles.countryCodeButton}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <MaterialCommunityIcons color={colors.primaryDark} name="chevron-down" size={18} />
              </Pressable>
              <View style={styles.phoneInput}>
                <TextInput autoComplete="tel" error={submitted && !phoneIsValid} helperText={submitted && !phoneIsValid ? 'Phone number is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="cellphone" size={20} />} inputMode="tel" keyboardType="phone-pad" onChangeText={setPhoneNumber} onFocus={() => handleFieldFocus('phone')} onSubmitEditing={() => passwordRef.current?.focus()} placeholder="Phone number" ref={phoneRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={phoneNumber} />
              </View>
            </View>
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && !passwordIsValid} helperText={submitted && !passwordIsValid ? 'Password must contain at least 8 characters.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setPassword} onContainerLayout={(event) => { fieldOffsets.current.password = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('password')} onSubmitEditing={() => confirmPasswordRef.current?.focus()} placeholder="Password" ref={passwordRef} returnKeyType="next" rightIcon={visibilityIcon(isPasswordVisible, 'password', () => setIsPasswordVisible((visible) => !visible))} secureTextEntry={!isPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={password} />
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && !confirmPasswordIsValid} helperText={submitted && !confirmPasswordIsValid ? (confirmPassword.length === 0 ? 'Confirm your password.' : 'Passwords do not match.') : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setConfirmPassword} onContainerLayout={(event) => { fieldOffsets.current.confirmPassword = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('confirmPassword')} onSubmitEditing={handleSignUp} placeholder="Confirm password" ref={confirmPasswordRef} returnKeyType="done" rightIcon={visibilityIcon(isConfirmPasswordVisible, 'confirm password', () => setIsConfirmPasswordVisible((visible) => !visible))} secureTextEntry={!isConfirmPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={confirmPassword} />

          {authError.length > 0 && <Text accessibilityRole="alert" style={styles.formError}>{authError}</Text>}

          {!isSheet && registrationActions}
          </ScrollView>
          {isSheet && registrationActions}
          </View>
        </Animated.View>
      </BlurTargetView>
      <Modal animationType="fade" onRequestClose={() => setShowCountryCodes(false)} transparent visible={showCountryCodes}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Close country code selector" onPress={() => setShowCountryCodes(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.countryCodeSheet}>
            <Text style={styles.modalTitle}>Country code</Text>
            {countryCodes.map((country) => (
              <Pressable accessibilityRole="button" key={country.code} onPress={() => { setCountryCode(country.code); setShowCountryCodes(false) }} style={styles.countryCodeOption}>
                <Text style={styles.countryCodeOptionText}>{country.name}</Text>
                <Text style={styles.countryCodeOptionValue}>{country.code}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      {legalDocument && (
        <PolicyDocumentOverlay
          blurTarget={policyBlurTargetRef}
          content={legalDocument === 'terms' ? clientTermsAndConditions : privacyPolicy}
          onClose={() => setLegalDocument(null)}
          title={legalDocument === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  brandIdentity: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  screen: { flex: 1, backgroundColor: neo.surface },
  sheetScreen: { overflow: 'hidden', backgroundColor: neo.surface },
  policyOverlayVisibleScreen: { overflow: 'visible' },
  content: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: neo.surface },
  sheetContent: { maxWidth: undefined },
  hero: { height: 340, overflow: 'hidden', alignItems: 'center', paddingTop: spacing['4xl'], backgroundColor: '#741C31', position: 'relative' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'transparent' },
  backButtonPressed: { opacity: 0.65 },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  sheet: { flex: 1, marginTop: -180, paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: neo.surface },
  bottomSheet: { marginTop: 0, paddingTop: 0 },
  sheetTopBar: { height: 40, alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.sm, marginBottom: spacing.sm },
  sheetHandle: { width: 68, height: 4, borderRadius: radius.pill, backgroundColor: colors.grey300 },
  sheetBody: { flex: 1 },
  title: { color: colors.primaryDark, fontSize: 24, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  loginPromptText: { color: colors.textSecondary, fontSize: 14 },
  loginText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  form: { gap: spacing.md, paddingBottom: spacing['3xl'] },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  nameInput: { flex: 1, minWidth: 0 },
  formScroll: { flex: 1, marginBottom: spacing.md },
  actionFooter: { gap: spacing.md },
  stickyActionFooter: { borderTopWidth: 1, borderTopColor: neo.edge, backgroundColor: neo.surface, paddingTop: spacing.md, paddingBottom: spacing.sm },
  input: { height: 52, borderWidth: 1, borderColor: neo.edge, borderRadius: radius.xl, backgroundColor: neo.surface, paddingHorizontal: spacing.xl, fontSize: 15, boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}` },
  inputWithIcon: { paddingLeft: spacing['4xl'] },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  countryCodeButton: { height: 52, minWidth: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: neo.edge, borderRadius: radius.xl, backgroundColor: neo.surface, paddingHorizontal: spacing.sm, boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}` },
  countryCodeText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  phoneInput: { flex: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 0 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: 0 },
  checkbox: {
    width: 18,
    height: 18,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: 5,
    backgroundColor: neo.surface,
    elevation: 0,
    boxShadow: 'inset 3px 3px 6px rgba(160, 171, 180, 0.48), inset -3px -3px 6px rgba(255, 255, 255, 0.92)',
  },
  checkboxChecked: {
    borderColor: 'rgba(255, 240, 245, 0.30)',
    backgroundColor: '#6B1E2E',
    shadowColor: '#2B0712',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.34,
    shadowRadius: 5,
    elevation: 3,
    boxShadow: '2px 3px 6px rgba(43, 7, 18, 0.34), -2px -2px 4px rgba(255, 255, 255, 0.70), inset 1px 1px 1px rgba(255, 255, 255, 0.16)',
  },
  checkboxError: {
    borderColor: colors.error,
    backgroundColor: '#FFF4F4',
    shadowOpacity: 0,
    elevation: 0,
    boxShadow: 'inset 2px 2px 4px rgba(179, 38, 30, 0.20), inset -2px -2px 4px rgba(255, 255, 255, 0.86)',
  },
  checkboxPressed: {
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ translateY: 1 }],
    boxShadow: 'inset 2px 2px 4px rgba(107, 30, 46, 0.28), inset -2px -2px 4px rgba(255, 255, 255, 0.86)',
  },
  termsText: { flexShrink: 1, color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18, textAlign: 'center' },
  legalLink: { color: colors.primaryDark, fontWeight: '800', textDecorationLine: 'underline' },
  termsError: { marginTop: spacing.xs, color: colors.error, fontSize: typography.caption, lineHeight: 18 },
  formError: { color: colors.error, fontSize: typography.body, lineHeight: 20 },
  submitButton: { marginTop: 0 },
  sinkingButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textShadowColor: 'rgba(37, 4, 14, 0.50)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    transform: [{ translateY: 1 }],
  },
  googleButton: { marginTop: 0 },
  sinkingGoogleLabel: {
    color: '#6B1E2E',
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textShadowColor: 'rgba(255, 255, 255, 0.84)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0.6,
    transform: [{ translateY: 1 }],
  },
  googleIcon: { width: 20, height: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22, 16, 17, 0.48)' },
  countryCodeSheet: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, padding: spacing.xl, paddingBottom: spacing['3xl'] },
  modalTitle: { color: colors.primaryDark, fontSize: 19, fontWeight: '700' },
  countryCodeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: spacing.md },
  countryCodeOptionText: { color: colors.textPrimary, fontSize: 16 },
  countryCodeOptionValue: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  policySheet: { width: '100%', maxHeight: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, paddingTop: spacing.lg },
  policyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  policyContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing['4xl'] },
  policyText: { color: colors.textPrimary, fontSize: 14, lineHeight: 21 },
})
