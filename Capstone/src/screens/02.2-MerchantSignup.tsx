import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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
import { signUpMerchant } from '../lib/auth'
import { pricingPolicy, privacyPolicy, providerTermsAndConditions } from '../content/clientLegalDocuments'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface MerchantSignupScreenProps {
  onBack: () => void
  onSignUp: (
    email: string,
    needsVerification: boolean,
    accountRole: 'service_provider'
  ) => void
  onLogIn?: () => void
  onOpenPolicyOverlay?: (policy: { content: string; title: string }) => void
  presentation?: 'screen' | 'sheet'
  onSheetDragStart?: () => void
  onSheetDrag?: (translationY: number) => void
  onSheetDragEnd?: (translationY: number, velocityY: number) => void
}

type MerchantSignupField = 'businessName' | 'contactName' | 'category' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms'

const neo = {
  surface: '#E9EDF0',
  edge: 'rgba(255, 255, 255, 0.62)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
}
type ScrollViewInstance = React.ComponentRef<typeof ScrollView>
type ViewInstance = React.ComponentRef<typeof View>
type ProviderLegalDocument = 'providerTerms' | 'pricingPolicy' | 'privacyPolicy'

const serviceCategories = ['Venue', 'Photography', 'Catering', 'Florist', 'Attire']
const countryCodes = [
  { code: '+63', name: 'Philippines' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+81', name: 'Japan' },
]

export const MerchantSignupScreen: React.FC<MerchantSignupScreenProps> = ({
  onBack,
  onSignUp,
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
  const businessNameRef = useRef<AppTextInputInstance>(null)
  const contactNameRef = useRef<AppTextInputInstance>(null)
  const emailRef = useRef<AppTextInputInstance>(null)
  const phoneRef = useRef<AppTextInputInstance>(null)
  const passwordRef = useRef<AppTextInputInstance>(null)
  const confirmPasswordRef = useRef<AppTextInputInstance>(null)
  const fieldOffsets = useRef<Record<MerchantSignupField, number>>({
    businessName: 0,
    contactName: 0,
    category: 0,
    email: 0,
    phone: 0,
    password: 0,
    confirmPassword: 0,
    terms: 0,
  })
  const categoryFieldRef = useRef<ViewInstance>(null)
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
  const [countryCode, setCountryCode] = useState('+63')
  const [showCountryCodes, setShowCountryCodes] = useState(false)
  const [legalDocument, setLegalDocument] = useState<ProviderLegalDocument | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [formContentHeight, setFormContentHeight] = useState(0)
  const [formViewportHeight, setFormViewportHeight] = useState(0)
  const focusedField = useRef<MerchantSignupField | null>(null)
  const onBackRef = useRef(onBack)
  const onSheetDragStartRef = useRef(onSheetDragStart)
  const onSheetDragRef = useRef(onSheetDrag)
  const onSheetDragEndRef = useRef(onSheetDragEnd)

  const openLegalDocument = (document: ProviderLegalDocument) => {
    const policy = document === 'providerTerms'
      ? { title: 'Provider Terms', content: providerTermsAndConditions }
      : document === 'pricingPolicy'
        ? { title: 'Pricing Policy', content: pricingPolicy }
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
  const businessNameIsValid = businessName.trim().length > 0
  const contactNameIsValid = contactName.trim().length > 0
  const categoryIsValid = serviceCategory.trim().length > 0
  const phoneIsValid = phoneNumber.trim().length > 0
  const passwordIsValid = password.length >= 8
  const confirmPasswordIsValid = confirmPassword.length > 0 && password === confirmPassword
  const hasRequiredFields =
    businessNameIsValid &&
    contactNameIsValid &&
    categoryIsValid &&
    emailIsValid &&
    phoneIsValid &&
    passwordIsValid &&
    confirmPasswordIsValid
  const canSubmit = hasRequiredFields && acceptedTerms
  const canScrollForm =
    keyboardHeight > 0 || formContentHeight > formViewportHeight + 1
  const handleSignUp = async () => {
    setSubmitted(true)
    setAuthError('')
    if (isLoading) return
    if (!businessNameIsValid) return revealField('businessName', businessNameRef)
    if (!contactNameIsValid) return revealField('contactName', contactNameRef)
    if (!categoryIsValid) return revealField('category')
    if (!emailIsValid) return revealField('email', emailRef)
    if (!phoneIsValid) return revealField('phone', phoneRef)
    if (!passwordIsValid) return revealField('password', passwordRef)
    if (!confirmPasswordIsValid) return revealField('confirmPassword', confirmPasswordRef)
    if (!acceptedTerms) return revealField('terms')
    if (!canSubmit) return

    setIsLoading(true)
    const result = await signUpMerchant({
      businessName,
      contactName,
      serviceCategory,
      email: normalizedEmail,
      phoneNumber: `${countryCode} ${phoneNumber.trim()}`,
      password,
    })
    setIsLoading(false)

    if (result.ok) {
      onSignUp(normalizedEmail, result.needsVerification ?? true, 'service_provider')
      return
    }

    setAuthError(
      result.message ??
        'Unable to create your merchant account. Please try again.'
    )
  }

  function revealField(
    field: MerchantSignupField,
    inputRef?: React.RefObject<AppTextInputInstance | null>
  ) {
    focusedField.current = field
    scrollToField(field)
    if (field === 'category') setIsCategoryPickerVisible(true)
    if (inputRef) setTimeout(() => inputRef.current?.focus(), 180)
  }

  function scrollToField(field: MerchantSignupField) {
    requestAnimationFrame(() => {
      sheetScroll.current?.scrollTo({
        y: Math.max(0, fieldOffsets.current[field] - spacing.lg),
        animated: true,
      })
    })
  }

  const handleFieldFocus = (field: MerchantSignupField) => {
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
          <Pressable accessibilityLabel="Accept Provider Terms, Pricing Policy, and Privacy Policy" accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} hitSlop={6} onPress={() => setAcceptedTerms((accepted) => !accepted)}>
            {({ pressed }) => (
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked, submitted && !acceptedTerms && styles.checkboxError, pressed && styles.checkboxPressed]}>
                {acceptedTerms && <MaterialCommunityIcons color="#FFFFFF" name="check" size={14} />}
              </View>
            )}
          </Pressable>
          <Text style={styles.termsText}>
            I agree to the <Text accessibilityRole="link" onPress={() => openLegalDocument('providerTerms')} style={styles.termsEmphasis}>Provider Terms</Text> and <Text accessibilityRole="link" onPress={() => openLegalDocument('pricingPolicy')} style={styles.termsEmphasis}>Pricing Policy</Text> and acknowledge the <Text accessibilityRole="link" onPress={() => openLegalDocument('privacyPolicy')} style={styles.termsEmphasis}>Privacy Policy</Text>.
          </Text>
        </View>
        {submitted && !acceptedTerms && <Text accessibilityRole="alert" style={styles.termsError}>Please accept the Provider Terms and Privacy Policy.</Text>}
      </View>
      <LuminousPillButton
        accessibilityLabel="Create service provider account"
        disabled={isLoading}
        isFullWidth
        isLoading={isLoading}
        onPress={handleSignUp}
        style={styles.submitButton}
        textStyle={styles.sinkingButtonText}
        tone="burgundyMatte"
      >
        Create Business Account
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
          <Text style={styles.title}>Set up Your Business</Text>
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
            <Animated.View
              style={[
                styles.roleFields,
                {
                  opacity: 1,
                  transform: [
                    {
                      translateY: 0,
                    },
                  ],
                },
              ]}
            >
            <TextInput autoCapitalize="words" error={submitted && !businessNameIsValid} helperText={submitted && !businessNameIsValid ? 'Business name is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="office-building-outline" size={20} />} onChangeText={setBusinessName} onContainerLayout={(event) => { fieldOffsets.current.businessName = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('businessName')} onSubmitEditing={() => contactNameRef.current?.focus()} placeholder="Business name" ref={businessNameRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={businessName} />
            <TextInput autoCapitalize="words" autoComplete="name" error={submitted && !contactNameIsValid} helperText={submitted && !contactNameIsValid ? 'Contact person is required.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="account-circle-outline" size={20} />} onChangeText={setContactName} onContainerLayout={(event) => { fieldOffsets.current.contactName = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('contactName')} placeholder="Contact person" ref={contactNameRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={contactName} />
            <View onLayout={(event) => { fieldOffsets.current.category = event.nativeEvent.layout.y }} ref={categoryFieldRef} style={styles.dropdownContainer}>
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
                  submitted && !categoryIsValid && styles.dropdownFieldError,
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
            {submitted && !categoryIsValid && <Text accessibilityRole="alert" style={styles.fieldError}>Select a service category.</Text>}
            <TextInput autoCapitalize="none" autoComplete="email" error={submitted && !emailIsValid} helperText={submitted && !emailIsValid ? 'Enter a valid business email.' : undefined} icon={<MaterialCommunityIcons color={colors.primaryDark} name="at" size={20} />} inputMode="email" keyboardType="email-address" onChangeText={setEmail} onContainerLayout={(event) => { fieldOffsets.current.email = event.nativeEvent.layout.y }} onFocus={() => handleFieldFocus('email')} onSubmitEditing={() => phoneRef.current?.focus()} placeholder="Business email" ref={emailRef} returnKeyType="next" style={[styles.input, styles.inputWithIcon]} value={email} />
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
            </Animated.View>
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
          content={legalDocument === 'providerTerms' ? providerTermsAndConditions : legalDocument === 'pricingPolicy' ? pricingPolicy : privacyPolicy}
          onClose={() => setLegalDocument(null)}
          title={legalDocument === 'providerTerms' ? 'Provider Terms' : legalDocument === 'pricingPolicy' ? 'Pricing Policy' : 'Privacy Policy'}
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
  hero: { height: 340, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingTop: spacing['4xl'], backgroundColor: colors.primaryDark, position: 'relative' },
  heroImage: { ...StyleSheet.absoluteFill, width: undefined, height: undefined },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(42, 12, 22, 0.48)' },
  backButton: { position: 'absolute', top: spacing.lg, left: spacing.lg, zIndex: 2, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'transparent' },
  backButtonPressed: { opacity: 0.65 },
  heroCopy: { width: '100%', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  heroEyebrow: { color: colors.textInverse, fontSize: typography.caption, fontWeight: '700', letterSpacing: 1.4, marginBottom: spacing.sm },
  heroTitle: { color: colors.textInverse, fontSize: typography.h1, lineHeight: 36, fontWeight: '700' },
  sheet: { flex: 1, marginTop: -180, paddingHorizontal: spacing['2xl'], paddingTop: spacing['2xl'], borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: neo.surface },
  bottomSheet: { marginTop: 0, paddingTop: 0 },
  sheetTopBar: { height: 40, alignItems: 'center', justifyContent: 'flex-start', paddingTop: spacing.sm, marginBottom: spacing.sm },
  sheetHandle: { width: 68, height: 4, borderRadius: radius.pill, backgroundColor: colors.grey300 },
  sheetBody: { flex: 1 },
  title: { color: colors.primaryDark, fontSize: 24, lineHeight: 29, fontWeight: '700', textAlign: 'center' },
  loginPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  loginPromptText: { color: colors.textSecondary, fontSize: 14 },
  loginText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing['2xl'] },
  form: { gap: spacing.md, paddingBottom: spacing['3xl'] },
  formScroll: { flex: 1 },
  actionFooter: { gap: spacing.md },
  stickyActionFooter: { borderTopWidth: 1, borderTopColor: neo.edge, backgroundColor: neo.surface, paddingTop: spacing.md, paddingBottom: spacing.sm },
  roleSelector: { position: 'relative', flexDirection: 'row', gap: spacing.sm, padding: 4, borderRadius: radius.xl, backgroundColor: '#F1F2F4' },
  roleSelectionIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.large, backgroundColor: colors.primaryDark, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 2 },
  roleOption: { zIndex: 1, minWidth: 0, minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.sm, borderRadius: radius.large },
  roleOptionPressed: { opacity: 0.75 },
  roleOptionText: { minWidth: 0, color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  roleOptionTextSelected: { color: colors.textInverse },
  roleFields: { gap: spacing.md },
  input: { height: 52, borderWidth: 1, borderColor: neo.edge, borderRadius: radius.xl, backgroundColor: neo.surface, paddingHorizontal: spacing.xl, fontSize: 15, boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}` },
  inputWithIcon: { paddingLeft: spacing['4xl'] },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  countryCodeButton: { height: 52, minWidth: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: neo.edge, borderRadius: radius.xl, backgroundColor: neo.surface, paddingHorizontal: spacing.sm, boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}` },
  countryCodeText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  phoneInput: { flex: 1 },
  dropdownContainer: { position: 'relative', zIndex: 3 },
  dropdownField: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: neo.edge, borderRadius: radius.xl, backgroundColor: neo.surface, paddingHorizontal: spacing.xl, boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}` },
  dropdownFieldError: { borderWidth: 1.5, borderColor: colors.error },
  dropdownFieldOpenDown: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownFieldOpenUp: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  dropdownText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  dropdownPlaceholder: { color: colors.textMuted },
  dropdownOptions: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, backgroundColor: colors.background, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 12, elevation: 6 },
  dropdownOptionsDown: { position: 'relative', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  dropdownOptionsUp: { position: 'absolute', bottom: 58, left: 0, right: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
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
  termsText: { flexShrink: 1, maxWidth: 280, color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  termsEmphasis: { color: colors.primaryDark, fontWeight: '800', textDecorationLine: 'underline' },
  fieldError: { marginTop: -spacing.xs, color: colors.error, fontSize: typography.caption, lineHeight: 18 },
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
  dropdownOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropdownOptionPressed: { opacity: 0.65 },
  dropdownOptionText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '500' },
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
