import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Button } from '../components/Button'
import { TextInput } from '../components/TextInput'
import { signInWithOAuth, signUpClient } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface SignupScreenProps {
  onBack: () => void
  onSignUp: (email: string, needsVerification: boolean) => void
  onGoogleSignUp?: () => void
  onLogIn?: () => void
}

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onBack,
  onSignUp,
  onGoogleSignUp,
  onLogIn,
}) => {
  const { height } = useWindowDimensions()
  const sheetEntrance = useRef(new Animated.Value(1)).current
  const sheetScroll = useRef<ScrollView>(null)
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

  useEffect(() => {
    sheetEntrance.setValue(1)
    Animated.timing(sheetEntrance, { toValue: 0, duration: 420, useNativeDriver: true }).start()
  }, [sheetEntrance])

  useEffect(() => {
    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      sheetScroll.current?.scrollTo({ y: 0, animated: true })
    })

    return () => keyboardHideSubscription.remove()
  }, [])

  const normalizedEmail = email.trim()
  const emailIsValid = /^\S+@\S+\.\S+$/.test(normalizedEmail)
  const passwordsMatch = password === confirmPassword
  const canSubmit =
    fullName.trim().length > 0 &&
    emailIsValid &&
    phoneNumber.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    acceptedTerms

  const handleSignUp = async () => {
    setSubmitted(true)
    setAuthError('')
    if (!canSubmit || isLoading) return
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
      style={styles.screen}
    >
      <View style={styles.content}>
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

        <Animated.View
          style={[
            styles.sheet,
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
          <Text style={styles.title}>Create Your Account</Text>
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already Have An Account? </Text>
            <Pressable accessibilityRole="button" disabled={!onLogIn} onPress={onLogIn}>
              <Text style={styles.loginText}>Sign In</Text>
            </Pressable>
          </View>

          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={styles.form}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            ref={sheetScroll}
            showsVerticalScrollIndicator={false}
            style={styles.formScroll}
          >
            <TextInput autoCapitalize="words" autoComplete="name" icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setFullName} placeholder="Full name" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={fullName} />
            <TextInput autoCapitalize="none" autoComplete="email" error={submitted && !emailIsValid} helperText={submitted && !emailIsValid ? 'Enter a valid email address.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="at" size={20} />} inputMode="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Enter your email address" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={email} />
            <TextInput autoComplete="tel" icon={<MaterialCommunityIcons color={colors.primaryDark} name="cellphone" size={20} />} inputMode="tel" keyboardType="phone-pad" onChangeText={setPhoneNumber} placeholder="Phone number" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={phoneNumber} />
            <TextInput autoCapitalize="none" autoComplete="new-password" icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setPassword} onFocus={() => sheetScroll.current?.scrollTo({ y: 260, animated: true })} placeholder="Password" returnKeyType="next" rightIcon={visibilityIcon(isPasswordVisible, 'password', () => setIsPasswordVisible((visible) => !visible))} secureTextEntry={!isPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={password} />
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && confirmPassword.length > 0 && !passwordsMatch} helperText={submitted && confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setConfirmPassword} onFocus={() => setTimeout(() => sheetScroll.current?.scrollToEnd({ animated: true }), 100)} onSubmitEditing={handleSignUp} placeholder="Confirm password" returnKeyType="done" rightIcon={visibilityIcon(isConfirmPasswordVisible, 'confirm password', () => setIsConfirmPasswordVisible((visible) => !visible))} secureTextEntry={!isConfirmPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={confirmPassword} />

          {submitted && !canSubmit && <Text accessibilityRole="alert" style={styles.formError}>Complete your profile, use a valid email, use at least 8 password characters, and accept the terms.</Text>}
          {authError.length > 0 && <Text accessibilityRole="alert" style={styles.formError}>{authError}</Text>}

          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((accepted) => !accepted)} style={styles.termsRow}>
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <MaterialCommunityIcons color={colors.textInverse} name="check" size={14} />}
            </View>
            <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
          </Pressable>

          <Button accessibilityLabel="Create client account" disabled={!canSubmit} isFullWidth isLoading={isLoading} onPress={handleSignUp} size="lg" style={styles.submitButton} textStyle={styles.buttonText}>Sign Up</Button>
          <View style={styles.dividerRow}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
          <Button accessibilityLabel="Sign up with Google" disabled={isLoading || !onGoogleSignUp} isFullWidth isLoading={isOAuthLoading} onPress={handleGoogleSignUp} size="lg" style={styles.googleButton} textStyle={[styles.buttonText, styles.googleButtonText]} variant="secondary">Google</Button>
          </ScrollView>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F4F6' },
  content: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: colors.background },
  hero: { height: 340, overflow: 'hidden', alignItems: 'center', paddingTop: spacing['4xl'], backgroundColor: '#741C31', position: 'relative' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'transparent' },
  backButtonPressed: { opacity: 0.65 },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  sheet: { flex: 1, marginTop: -180, paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: colors.background },
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
  termsText: { flexShrink: 1, maxWidth: 280, color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  formError: { color: colors.error, fontSize: typography.body, lineHeight: 20 },
  submitButton: { borderRadius: radius.pill, backgroundColor: '#7A1D35', minHeight: 44, paddingVertical: spacing.sm, marginTop: 0, shadowColor: '#7A1D35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  googleButton: { borderRadius: radius.pill, minHeight: 44, paddingVertical: spacing.sm, marginTop: 0 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  googleButtonText: { color: colors.textPrimary },
})
