import { Text } from '../components/AppText'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurTargetView, BlurView } from 'expo-blur'
import { LuminousPillButton } from '../components/LuminousPillButton'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'
import { LoginScreen } from './01.1-Login'
import { ForgotPasswordScreen } from './01.1.1-ForgotPassword'
import { SignupScreen } from './02.1-ClientSignup'
import { MerchantSignupScreen } from './02.2-MerchantSignup'
import { PolicyDocumentOverlay } from '../components/PolicyDocumentOverlay'

export type UserRole = 'client' | 'provider'

interface RoleSelectionScreenProps {
  onClientGoogleSignUp?: () => void
  onClientSignUp: (email: string, needsVerification: boolean) => void
  onLogIn?: () => void
  onMerchantSignUp: (
    email: string,
    needsVerification: boolean,
    accountRole: 'service_provider'
  ) => void
  onForgotPassword?: (recoveryContact: string) => void
  openLoginOnMount?: boolean
  onLoginSheetOpened?: () => void
  entranceDelay?: number
}

const roles = [
  {
    id: 'client' as const,
    image: require('../../images/PlanEvent.png'),
    title: 'Plan an Event',
    description: 'Browse, compare, and book wedding services all in one place.',
  },
  {
    id: 'provider' as const,
    image: require('../../images/OfferServices.png'),
    title: 'Offer Your Services',
    description: 'List your services and manage bookings from couples planning their big day.',
  },
]

const neo = {
  surface: '#E9EDF0',
  edge: 'rgba(255, 255, 255, 0.62)',
  darkShadow: 'rgba(160, 171, 180, 0.54)',
  lightShadow: 'rgba(255, 255, 255, 0.96)',
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onClientGoogleSignUp,
  onClientSignUp,
  onLogIn,
  onMerchantSignUp,
  onForgotPassword,
  openLoginOnMount = false,
  onLoginSheetOpened,
  entranceDelay = 0,
}) => {
  const { height, width } = useWindowDimensions()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isLoginSheetVisible, setIsLoginSheetVisible] = useState(false)
  const [isForgotPasswordVisible, setIsForgotPasswordVisible] = useState(false)
  const [authPolicy, setAuthPolicy] = useState<{ content: string; title: string } | null>(null)
  const authPolicyBlurTargetRef = useRef<React.ComponentRef<typeof View>>(null)
  const recoveryBlurTargetRef = useRef<React.ComponentRef<typeof View>>(null)
  const [activeAuthSheet, setActiveAuthSheet] = useState<
    'login' | 'clientSignup' | 'merchantSignup'
  >('login')
  const hoverAnimations = useRef({
    client: new Animated.Value(0),
    provider: new Animated.Value(0),
  }).current
  const cardEntranceAnimations = useRef({
    client: new Animated.Value(1),
    provider: new Animated.Value(1),
  }).current
  const actionsEntranceAnimation = useRef(new Animated.Value(1)).current
  const loginSheetProgress = useRef(new Animated.Value(0)).current
  const loginSheetState = useRef<'closed' | 'opening' | 'open' | 'closing'>('closed')
  const hasOpenedInitialLoginSheet = useRef(false)
  // Browser builds use the JS driver for this slide-up transition. Native
  // apps retain the native driver while web keeps the same animation without
  // relying on the native driver in Mobile Safari.
  const useSheetNativeDriver = Platform.OS !== 'web'
  const isCompact = height < 700
  const isWide = width >= 700
  const authSheetTop =
    activeAuthSheet === 'login'
      ? Math.min(250, height * 0.32)
      : activeAuthSheet === 'clientSignup' || activeAuthSheet === 'merchantSignup'
        ? Math.min(120, Math.max(72, height * 0.1))
        : Math.min(360, Math.max(220, height * 0.42))

  useEffect(() => {
    roles.forEach((role) => {
      Animated.timing(hoverAnimations[role.id], {
        toValue: selectedRole === role.id ? 1 : 0,
        duration: 420,
        useNativeDriver: true,
      }).start()
    })
  }, [hoverAnimations, selectedRole])

  useEffect(() => {
    roles.forEach((role, index) => {
      Animated.timing(cardEntranceAnimations[role.id], {
        toValue: 0,
        delay: entranceDelay + index * 90,
        duration: 520,
        useNativeDriver: true,
      }).start()
    })
  }, [cardEntranceAnimations, entranceDelay])

  useEffect(() => {
    Animated.timing(actionsEntranceAnimation, {
      toValue: 0,
      delay: entranceDelay,
      duration: 520,
      useNativeDriver: true,
    }).start()
  }, [actionsEntranceAnimation, entranceDelay])

  const handleContinue = () => {
    if (!selectedRole) return
    openSignupSheet(selectedRole)
  }

  const openAuthSheet = useCallback((sheet: 'login' | 'clientSignup' | 'merchantSignup') => {
    if (loginSheetState.current !== 'closed') return

    setActiveAuthSheet(sheet)
    loginSheetProgress.setValue(0)
    loginSheetState.current = 'opening'
    setIsLoginSheetVisible(true)
    requestAnimationFrame(() => {
      Animated.timing(loginSheetProgress, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useSheetNativeDriver,
      }).start(({ finished }) => {
        if (finished) loginSheetState.current = 'open'
      })
    })
  }, [loginSheetProgress, useSheetNativeDriver])

  const openLoginSheet = useCallback(() => {
    if (!onLogIn) return
    if (loginSheetState.current !== 'closed') {
      setActiveAuthSheet('login')
      return
    }

    openAuthSheet('login')
  }, [onLogIn, openAuthSheet])

  useEffect(() => {
    if (!openLoginOnMount || hasOpenedInitialLoginSheet.current || !onLogIn) return

    hasOpenedInitialLoginSheet.current = true
    openLoginSheet()
    onLoginSheetOpened?.()
  }, [onLogIn, onLoginSheetOpened, openLoginOnMount, openLoginSheet])

  const openSignupSheet = (role: UserRole) => {
    openAuthSheet(role === 'client' ? 'clientSignup' : 'merchantSignup')
  }

  const closeLoginSheet = () => {
    if (loginSheetState.current === 'closed' || loginSheetState.current === 'closing') return

    loginSheetState.current = 'closing'
    Animated.timing(loginSheetProgress, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: useSheetNativeDriver,
    }).start(({ finished }) => {
      if (!finished) return
      loginSheetState.current = 'closed'
      setIsLoginSheetVisible(false)
    })
  }

  const handleLoginSheetDragStart = () => {
    if (loginSheetState.current === 'open') {
      loginSheetProgress.stopAnimation()
    }
  }

  const handleLoginSheetDrag = (translationY: number) => {
    if (loginSheetState.current !== 'open') return

    loginSheetProgress.setValue(Math.max(0, 1 - translationY / height))
  }

  const handleLoginSheetDragEnd = (translationY: number, velocityY: number) => {
    if (loginSheetState.current !== 'open') return

    if (translationY > height * 0.2 || velocityY > 1.2) {
      closeLoginSheet()
      return
    }

    Animated.timing(loginSheetProgress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useSheetNativeDriver,
    }).start()
  }

  return (
    <View style={styles.safeArea}>
      <BlurTargetView ref={authPolicyBlurTargetRef} style={styles.safeArea}>
      <BlurTargetView ref={recoveryBlurTargetRef} style={styles.safeArea}>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.screenContent}>
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <View style={[styles.brandIdentitySpacer, { height: isCompact ? 40 : 50 }]} />
            <Text style={styles.title}>HOW DO YOU WANT TO USE MULTIVENT?</Text>
            <Text style={styles.subtitle}>
              Choose the experience that fits you best.
            </Text>
          </View>

          <View style={[styles.roles, isWide && styles.rolesWide]}>
            {roles.map((role) => {
              const isSelected = selectedRole === role.id

              return (
                <Animated.View
                  key={role.id}
                  style={[
                    styles.roleCardLift,
                    isWide && styles.roleCardLiftWide,
                    {
                      transform: [
                        {
                          translateY: cardEntranceAnimations[role.id].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, height],
                          }),
                        },
                        {
                          scale: hoverAnimations[role.id].interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.03],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={role.title}
                    accessibilityHint={`Select ${role.title}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedRole(role.id)}
                    style={({ pressed }) => [
                      styles.roleCard,
                      isWide && styles.roleCardWide,
                      isCompact && styles.roleCardCompact,
                      isSelected && styles.roleCardSelected,
                      pressed && styles.roleCardPressed,
                    ]}
                  >
                  {isSelected && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}

                  <View style={[styles.roleCardContent, isCompact && styles.roleCardContentCompact]}>
                    <Image
                      source={role.image}
                      style={[styles.roleImage, isCompact && styles.roleImageCompact]}
                      resizeMode="cover"
                    />
                    <View style={styles.roleCopy}>
                      <Text style={styles.roleTitle}>{role.title}</Text>
                      <Text style={styles.roleDescription}>{role.description}</Text>
                    </View>
                  </View>
                  </Pressable>
                </Animated.View>
              )
            })}
          </View>

          <Animated.View
            style={[
              styles.bottomActions,
              {
                transform: [
                  {
                    translateY: actionsEntranceAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, height],
                    }),
                  },
                ],
              },
            ]}
          >
            <LuminousPillButton
              accessibilityRole="button"
              accessibilityLabel="Continue with selected role"
              accessibilityState={{ disabled: !selectedRole }}
              disabled={!selectedRole}
              onPress={handleContinue}
              style={styles.continueButton}
              tone="burgundyMatte"
            >
              <Text style={styles.continueButtonText}>CONTINUE</Text>
            </LuminousPillButton>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log in"
                disabled={!onLogIn}
                onPress={openLoginSheet}
                style={({ pressed }) => pressed && styles.loginPressed}
              >
                <Text style={styles.loginText}>Sign In</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </View>
      </SafeAreaView>
      </BlurTargetView>

      {isLoginSheetVisible && (
        <View pointerEvents="box-none" style={styles.loginOverlay}>
          <Animated.View
            style={[
              styles.loginBackdrop,
              {
                opacity: loginSheetProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          >
            <BlurView
              blurTarget={recoveryBlurTargetRef}
              blurMethod="dimezisBlurViewSdk31Plus"
              blurReductionFactor={1}
              intensity={90}
              tint="dark"
              style={styles.loginBackdropBlur}
            >
              <View style={styles.loginBackdropTint} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sign in"
                onPress={closeLoginSheet}
                style={StyleSheet.absoluteFill}
              />
            </BlurView>
          </Animated.View>

          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.loginSheet,
              { top: authSheetTop },
              {
                transform: [
                  {
                    translateY: loginSheetProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {activeAuthSheet === 'login' ? (
              <LoginScreen
                onBack={closeLoginSheet}
                onCreateAccount={closeLoginSheet}
                onForgotPassword={() => setIsForgotPasswordVisible(true)}
                onLogIn={onLogIn ?? closeLoginSheet}
                onSheetDrag={handleLoginSheetDrag}
                onSheetDragEnd={handleLoginSheetDragEnd}
                onSheetDragStart={handleLoginSheetDragStart}
                presentation="sheet"
              />
            ) : activeAuthSheet === 'clientSignup' ? (
              <SignupScreen
                onBack={closeLoginSheet}
                onGoogleSignUp={onClientGoogleSignUp}
                onLogIn={openLoginSheet}
                onOpenPolicyOverlay={setAuthPolicy}
                onSheetDrag={handleLoginSheetDrag}
                onSheetDragEnd={handleLoginSheetDragEnd}
                onSheetDragStart={handleLoginSheetDragStart}
                onSignUp={onClientSignUp}
                presentation="sheet"
              />
            ) : (
              <MerchantSignupScreen
                onBack={closeLoginSheet}
                onLogIn={openLoginSheet}
                onOpenPolicyOverlay={setAuthPolicy}
                onSheetDrag={handleLoginSheetDrag}
                onSheetDragEnd={handleLoginSheetDragEnd}
                onSheetDragStart={handleLoginSheetDragStart}
                onSignUp={onMerchantSignUp}
                presentation="sheet"
              />
            )}
          </Animated.View>
        </View>
      )}
      </BlurTargetView>

      {isForgotPasswordVisible && (
        <ForgotPasswordScreen
          blurTarget={recoveryBlurTargetRef}
          onBackToLogin={() => setIsForgotPasswordVisible(false)}
          onContinueToNewPassword={(contact) => {
            setIsForgotPasswordVisible(false)
            onForgotPassword?.(contact)
          }}
        />
      )}
      {authPolicy && (
        <PolicyDocumentOverlay
          blurTarget={authPolicyBlurTargetRef}
          content={authPolicy.content}
          onClose={() => setAuthPolicy(null)}
          title={authPolicy.title}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: neo.surface,
  },
  screenContent: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  containerCompact: {
    paddingVertical: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  headerCompact: {
    marginBottom: spacing.lg,
  },
  brandIdentitySpacer: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.primaryDark,
    fontSize: typography.h1,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 460,
  },
  roles: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  rolesWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleCardLift: {
    width: '100%',
    alignSelf: 'center',
  },
  roleCardLiftWide: {
    flex: 1,
  },
  roleCard: {
    backgroundColor: neo.surface,
    borderColor: neo.edge,
    borderRadius: radius.large,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    boxShadow: `inset 5px 5px 9px ${neo.darkShadow}, inset -5px -5px 9px ${neo.lightShadow}`,
  },
  roleCardWide: {
    flex: 1,
  },
  roleCardCompact: {
    minHeight: 120,
  },
  roleCardSelected: {
    transform: [{ translateY: -2 }],
    boxShadow: `10px 10px 20px ${neo.darkShadow}, -10px -10px 20px ${neo.lightShadow}`,
  },
  roleCardHovered: {
    boxShadow: `10px 10px 20px ${neo.darkShadow}, -10px -10px 20px ${neo.lightShadow}`,
  },
  roleCardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 140,
  },
  roleCardContentCompact: {
    height: 120,
  },
  roleImage: {
    width: '27%',
    height: 140,
    flexShrink: 0,
  },
  roleImageCompact: {
    height: 120,
  },
  checkmark: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
  },
  checkmarkText: {
    color: colors.textInverse,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  roleCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingRight: spacing['2xl'],
  },
  roleTitle: {
    color: colors.textPrimary,
    fontSize: typography.h3,
    lineHeight: 25,
    fontWeight: '700',
  },
  roleDescription: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
  },
  bottomActions: {
    marginTop: 'auto',
    paddingTop: spacing['2xl'],
  },
  continueButton: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: typography.body,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(37, 4, 14, 0.50)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    transform: [{ translateY: 1 }],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 26,
  },
  loginText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 26,
  },
  loginPressed: {
    opacity: 0.65,
  },
  loginOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  loginBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  loginBackdropBlur: {
    ...StyleSheet.absoluteFill,
  },
  loginBackdropTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(28, 11, 18, 0.24)',
  },
  loginSheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.background,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  videoModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35, 17, 21, 0.72)',
  },
  videoModal: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#180D10',
  },
  providerVideo: {
    flex: 1,
  },
})
