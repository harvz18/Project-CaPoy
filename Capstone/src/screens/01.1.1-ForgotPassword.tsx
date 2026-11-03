import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Button } from '../components/Button'
import { LuminousPillButton } from '../components/LuminousPillButton'
import { TextInput, type AppTextInputInstance } from '../components/TextInput'
import { requestPasswordReset } from '../lib/auth'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

interface ForgotPasswordScreenProps {
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  onBackToLogin: () => void
  onContinueToNewPassword: (recoveryContact: string) => void
}

type ScrollViewInstance = React.ComponentRef<typeof ScrollView>

const neo = {
  background: '#E9EDF0',
  burgundyDarkShadow: 'rgba(62, 12, 28, 0.56)',
  burgundyLightShadow: 'rgba(181, 98, 121, 0.52)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  edge: 'rgba(255, 255, 255, 0.62)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
  mutedText: '#87929A',
  text: '#57636C',
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  blurTarget,
  onBackToLogin,
  onContinueToNewPassword,
}) => {
  const [recoveryContact, setRecoveryContact] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [authError, setAuthError] = useState('')
  const scrollRef = useRef<ScrollViewInstance>(null)
  const contactRef = useRef<AppTextInputInstance>(null)
  const formTop = useRef(0)
  const contactOffset = useRef(0)
  const popupScale = useRef(new Animated.Value(0.82)).current

  useEffect(() => {
    popupScale.setValue(0.82)
    const animation = Animated.sequence([
      Animated.timing(popupScale, {
        toValue: 1.045,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(popupScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [popupScale])

  const dismissOverlay = () => {
    if (isClosing) return

    setIsClosing(true)
    popupScale.stopAnimation()
    Animated.sequence([
      Animated.timing(popupScale, {
        toValue: 1.035,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(popupScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onBackToLogin()
    })
  }

  const normalizedContact = recoveryContact.trim()
  const isEmail = /^\S+@\S+\.\S+$/.test(normalizedContact)
  const contactIsValid = isEmail

  const handleRequestReset = async () => {
    setSubmitted(true)
    setAuthError('')

    if (isLoading) return
    if (!contactIsValid) return revealContactField()

    setIsLoading(true)
    const result = await requestPasswordReset(normalizedContact)
    setIsLoading(false)

    if (result.ok) {
      setRequestSent(true)
      return
    }

    setAuthError(result.message ?? 'Unable to request a password reset. Please try again.')
  }

  function revealContactField() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, formTop.current + contactOffset.current - spacing.lg),
        animated: true,
      })
      setTimeout(() => contactRef.current?.focus(), 180)
    })
  }

  const handleUseAnotherEmail = () => {
    setRecoveryContact('')
    setSubmitted(false)
    setRequestSent(false)
  }

  return (
    <View pointerEvents={isClosing ? 'none' : 'auto'} style={styles.modalOverlay}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={1}
          intensity={42}
          tint="dark"
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            accessibilityLabel="Close account recovery"
            accessibilityRole="button"
            onPress={dismissOverlay}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={styles.modalScrollContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              accessibilityViewIsModal
              style={[
                styles.modalCard,
                {
                  opacity: popupScale.interpolate({ inputRange: [0.82, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                  transform: [{ scale: popupScale }],
                },
              ]}
            >
              <Pressable
                accessibilityLabel="Close account recovery"
                accessibilityRole="button"
                hitSlop={10}
                onPress={dismissOverlay}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Text style={styles.closeButtonLabel}>×</Text>
              </Pressable>

              {requestSent ? (
                <View style={styles.modalResult}>
                  <Text style={styles.modalTitle}>Check your messages</Text>
                  <Text style={styles.modalSubtitle}>A password reset code was requested for</Text>
                  <Text numberOfLines={1} style={styles.emailText}>{normalizedContact}</Text>
                  <View style={styles.notice}>
                    <Text style={styles.noticeIcon}>i</Text>
                    <Text style={styles.noticeText}>Check your spam folder if the code does not arrive within a few minutes.</Text>
                  </View>
                  <Button accessibilityLabel="Continue to enter reset code" isFullWidth onPress={() => onContinueToNewPassword(normalizedContact)} size="md" style={styles.primaryButton}>CONTINUE</Button>
                  <Pressable accessibilityRole="button" onPress={handleUseAnotherEmail} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                    <Text style={styles.textButtonLabel}>Use another email</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.modalForm}>
                  <Text style={styles.modalTitle}>Account Recovery</Text>
                  <Text style={styles.modalSubtitle}>Enter the email linked to your account and we will send you a reset code.</Text>
                  <View onLayout={(event) => { formTop.current = event.nativeEvent.layout.y }}>
                    <TextInput
                      autoCapitalize="none"
                      error={submitted && !contactIsValid}
                      helperText={submitted && !contactIsValid ? 'Enter a valid email address.' : undefined}
                      inputMode="email"
                      keyboardType="email-address"
                      label="Email address"
                      onChangeText={setRecoveryContact}
                      onContainerLayout={(event) => { contactOffset.current = event.nativeEvent.layout.y }}
                      onSubmitEditing={handleRequestReset}
                      placeholder="you@example.com"
                      ref={contactRef}
                      returnKeyType="send"
                      style={styles.emailInput}
                      value={recoveryContact}
                    />
                  </View>
                  {authError.length > 0 && <Text accessibilityRole="alert" style={styles.formError}>{authError}</Text>}
                  <LuminousPillButton
                    accessibilityLabel="Send password reset code"
                    disabled={isLoading}
                    isFullWidth
                    isLoading={isLoading}
                    onPress={handleRequestReset}
                    textStyle={styles.sinkingButtonText}
                    tone="burgundyMatte"
                  >
                    Send Reset Code
                  </LuminousPillButton>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
  },
  modalKeyboard: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['3xl'],
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: 20,
    backgroundColor: neo.background,
    padding: spacing['2xl'],
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.pill,
    backgroundColor: neo.background,
    boxShadow: `3px 3px 6px ${neo.darkShadow}, -3px -3px 6px ${neo.lightShadow}`,
  },
  closeButtonLabel: {
    color: neo.text,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '400',
  },
  modalForm: {
    alignItems: 'stretch',
    gap: spacing.lg,
  },
  modalResult: {
    alignItems: 'stretch',
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalTitle: {
    color: neo.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: neo.mutedText,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: neo.background,
  },
  content: {
    flexGrow: 1,
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
    backgroundColor: neo.background,
    borderWidth: 1,
    borderColor: neo.edge,
    boxShadow: `4px 4px 8px ${neo.darkShadow}, -4px -4px 8px ${neo.lightShadow}`,
  },
  backArrow: {
    color: neo.text,
    fontSize: 34,
    lineHeight: 36,
    marginTop: -3,
  },
  topBarSpacer: {
    width: 40,
  },
  hero: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  recoveryContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing['2xl'],
  },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['5xl'],
  },
  iconCircle: {
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
  successIconCircle: {
    backgroundColor: '#EAF6EC',
    borderColor: '#AED8B4',
  },
  successIcon: {
    color: colors.success,
    fontSize: 34,
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
    color: neo.text,
    fontSize: typography.h1,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: neo.mutedText,
    fontSize: typography.body,
    lineHeight: 23,
    textAlign: 'center',
  },
  emailText: {
    maxWidth: '100%',
    color: colors.primaryDark,
    fontSize: typography.body,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  formCard: {
    gap: spacing.xl,
    backgroundColor: neo.background,
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.large,
    padding: spacing.xl,
    boxShadow: `8px 8px 17px ${neo.darkShadow}, -8px -8px 17px ${neo.lightShadow}`,
  },
  emailInput: {
    backgroundColor: neo.background,
    borderWidth: 1,
    borderColor: neo.edge,
    borderRadius: radius.large,
    minHeight: 52,
    boxShadow: `inset 4px 4px 8px ${neo.darkShadow}, inset -4px -4px 8px ${neo.lightShadow}`,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    boxShadow: `5px 5px 11px ${neo.burgundyDarkShadow}, -5px -5px 11px ${neo.burgundyLightShadow}`,
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
  notice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.medium,
    backgroundColor: '#F5E7DC',
    marginBottom: spacing.xl,
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
  formError: {
    color: colors.error,
    fontSize: typography.body,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  textButton: {
    alignSelf: 'center',
    padding: spacing.md,
  },
  textButtonLabel: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
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
  loginText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.65,
  },
})
