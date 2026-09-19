import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import { signUpMerchant } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface MerchantSignupScreenProps {
  onBack: () => void
  onSignUp: (email: string, needsVerification: boolean) => void
  onLogIn?: () => void
}

const serviceCategories = ['Venue', 'Photography', 'Catering', 'Florist', 'Attire']

export const MerchantSignupScreen: React.FC<MerchantSignupScreenProps> = ({
  onBack,
  onSignUp,
  onLogIn,
}) => {
  const { height } = useWindowDimensions()
  const sheetEntrance = useRef(new Animated.Value(1)).current
  const sheetScroll = useRef<ScrollView>(null)
  const categoryFieldRef = useRef<View>(null)
  const categoryDropdownEntrance = useRef(new Animated.Value(0)).current
  const categoryOptionEntrances = useRef(
    serviceCategories.map(() => new Animated.Value(0))
  ).current
  const [businessName, setBusinessName] = useState('')
  const [contactName, setContactName] = useState('')
  const [serviceCategory, setServiceCategory] = useState('')
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState(false)
  const [categoryPickerDirection, setCategoryPickerDirection] = useState<'down' | 'up'>('down')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
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

  useEffect(() => {
    Animated.timing(categoryDropdownEntrance, {
      toValue: isCategoryPickerVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [categoryDropdownEntrance, isCategoryPickerVisible])

  useEffect(() => {
    if (!isCategoryPickerVisible) return

    categoryOptionEntrances.forEach((entrance) => entrance.setValue(0))
    Animated.stagger(
      55,
      categoryOptionEntrances.map((entrance) =>
        Animated.timing(entrance, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        })
      )
    ).start()
  }, [categoryOptionEntrances, isCategoryPickerVisible])

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
    if (!canSubmit || isLoading) return

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../images/OfferServices.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <MaterialCommunityIcons
              color={colors.textInverse}
              name="chevron-left-circle-outline"
              size={34}
            />
          </Pressable>
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
          <Text style={styles.title}>Set up Your Business</Text>
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already Have An Account? </Text>
            <Pressable accessibilityRole="button" disabled={!onLogIn} onPress={onLogIn}>
              <Text style={styles.loginText}>Sign In</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ref={sheetScroll}
            showsVerticalScrollIndicator={false}
            style={styles.formScroll}
          >
            <TextInput autoCapitalize="words" icon={<MaterialCommunityIcons color={colors.primaryDark} name="office-building-outline" size={20} />} onChangeText={setBusinessName} placeholder="Business name" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={businessName} />
            <TextInput autoCapitalize="words" autoComplete="name" icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setContactName} placeholder="Contact person" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={contactName} />
            <View ref={categoryFieldRef} style={styles.dropdownContainer}>
              <Pressable
                accessibilityLabel="Service category"
                accessibilityRole="button"
                accessibilityState={{ expanded: isCategoryPickerVisible }}
                onPress={() => {
                  categoryFieldRef.current?.measureInWindow((_x, y, _width, fieldHeight) => {
                    setCategoryPickerDirection(y + fieldHeight + 260 > height ? 'up' : 'down')
                  })
                  setIsCategoryPickerVisible((visible) => !visible)
                }}
                style={[
                  styles.dropdownField,
                  isCategoryPickerVisible &&
                    (categoryPickerDirection === 'up'
                      ? styles.dropdownFieldOpenUp
                      : styles.dropdownFieldOpenDown),
                ]}
              >
                <MaterialCommunityIcons color={colors.primaryDark} name="format-list-bulleted" size={20} />
                <Text style={[styles.dropdownText, !serviceCategory && styles.dropdownPlaceholder]}>
                  {serviceCategory || 'Service category'}
                </Text>
                <MaterialCommunityIcons
                  color={colors.primaryDark}
                  name={isCategoryPickerVisible ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>
              {isCategoryPickerVisible && (
                <Animated.View
                  style={[
                    styles.dropdownOptions,
                    categoryPickerDirection === 'up'
                      ? styles.dropdownOptionsUp
                      : styles.dropdownOptionsDown,
                    {
                      opacity: categoryDropdownEntrance,
                      transform: [
                        {
                          translateY: categoryDropdownEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-10, 0],
                          }),
                        },
                        {
                          scaleY: categoryDropdownEntrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.96, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                {serviceCategories.map((category, index) => (
                  <Animated.View
                    key={category}
                    style={{
                      opacity: categoryOptionEntrances[index],
                      transform: [
                        {
                          translateY: categoryOptionEntrances[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [-8, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: serviceCategory === category }}
                      onPress={() => {
                        setServiceCategory(category)
                        setIsCategoryPickerVisible(false)
                      }}
                      style={({ pressed }) => [styles.dropdownOption, pressed && styles.dropdownOptionPressed]}
                    >
                      <Text style={styles.dropdownOptionText}>{category}</Text>
                      {serviceCategory === category && (
                        <MaterialCommunityIcons color={colors.primaryDark} name="check" size={20} />
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
                </Animated.View>
              )}
            </View>
            <TextInput autoCapitalize="none" autoComplete="email" error={submitted && !emailIsValid} helperText={submitted && !emailIsValid ? 'Enter a valid business email.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="at" size={20} />} inputMode="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Business email" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={email} />
            <TextInput autoComplete="tel" icon={<MaterialCommunityIcons color={colors.primaryDark} name="cellphone" size={20} />} inputMode="tel" keyboardType="phone-pad" onChangeText={setPhoneNumber} placeholder="Phone number" returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={phoneNumber} />
            <TextInput autoCapitalize="none" autoComplete="new-password" icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setPassword} onFocus={() => sheetScroll.current?.scrollTo({ y: 260, animated: true })} placeholder="Password" returnKeyType="next" rightIcon={visibilityIcon(isPasswordVisible, 'password', () => setIsPasswordVisible((visible) => !visible))} secureTextEntry={!isPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={password} />
            <TextInput autoCapitalize="none" autoComplete="new-password" error={submitted && confirmPassword.length > 0 && !passwordsMatch} helperText={submitted && confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="lock-outline" size={20} />} onChangeText={setConfirmPassword} onFocus={() => setTimeout(() => sheetScroll.current?.scrollToEnd({ animated: true }), 100)} onSubmitEditing={handleSignUp} placeholder="Confirm password" returnKeyType="done" rightIcon={visibilityIcon(isConfirmPasswordVisible, 'confirm password', () => setIsConfirmPasswordVisible((visible) => !visible))} secureTextEntry={!isConfirmPasswordVisible} style={[styles.input, styles.inputWithIcon]} value={confirmPassword} />

            {submitted && !canSubmit && <Text accessibilityRole="alert" style={styles.formError}>Complete your profile, use a valid email, use at least 8 password characters, and accept the terms.</Text>}
            {authError.length > 0 && <Text accessibilityRole="alert" style={styles.formError}>{authError}</Text>}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms((accepted) => !accepted)} style={styles.termsRow}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <MaterialCommunityIcons color={colors.textInverse} name="check" size={14} />}
              </View>
              <Text style={styles.termsText}>I agree to the Merchant Terms and Privacy Policy.</Text>
            </Pressable>
            <Button accessibilityLabel="Create service provider account" disabled={!canSubmit} isFullWidth isLoading={isLoading} onPress={handleSignUp} size="lg" style={styles.submitButton} textStyle={styles.buttonText}>CREATE MERCHANT ACCOUNT</Button>
          </ScrollView>
        </Animated.View>
      </View>

    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F4F6' },
  content: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: colors.background },
  hero: { height: 340, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingTop: spacing['4xl'], backgroundColor: colors.primaryDark, position: 'relative' },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42, 12, 22, 0.48)' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'transparent' },
  backButtonPressed: { opacity: 0.65 },
  heroCopy: { width: '100%', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  heroEyebrow: { color: colors.textInverse, fontSize: typography.caption, fontWeight: '700', letterSpacing: 1.4, marginBottom: spacing.sm },
  heroTitle: { color: colors.textInverse, fontSize: typography.h1, lineHeight: 36, fontWeight: '700' },
  sheet: { flex: 1, marginTop: -180, paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: colors.background },
  title: { color: colors.primaryDark, fontSize: 24, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  loginPromptText: { color: colors.textSecondary, fontSize: 14 },
  loginText: { color: colors.primaryDark, fontSize: 14, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  form: { gap: spacing.md },
  formScroll: { flex: 1 },
  input: { height: 52, borderWidth: 0, borderRadius: radius.xl, backgroundColor: '#F1F2F4', paddingHorizontal: spacing.xl, fontSize: 15 },
  inputWithIcon: { paddingLeft: spacing['4xl'] },
  dropdownContainer: { position: 'relative', zIndex: 3 },
  dropdownField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: '#F1F2F4', paddingHorizontal: spacing.xl },
  dropdownFieldOpenDown: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownFieldOpenUp: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  dropdownText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  dropdownPlaceholder: { color: colors.textMuted },
  dropdownOptions: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, backgroundColor: colors.background, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 6 },
  dropdownOptionsDown: { position: 'relative', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  dropdownOptionsUp: { position: 'absolute', bottom: 58, left: 0, right: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  checkbox: { width: 18, height: 18, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 5, backgroundColor: colors.background },
  checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  termsText: { flexShrink: 1, maxWidth: 280, color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  formError: { color: colors.error, fontSize: typography.body, lineHeight: 20 },
  submitButton: { borderRadius: radius.pill, backgroundColor: '#7A1D35', minHeight: 44, paddingVertical: spacing.sm, marginTop: 0, shadowColor: '#7A1D35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  dropdownOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropdownOptionPressed: { opacity: 0.65 },
  dropdownOptionText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '500' },
})
