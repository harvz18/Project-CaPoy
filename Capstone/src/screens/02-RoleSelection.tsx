import { Text } from '../components/AppText'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { colors, radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'
import { LoginScreen } from './01.1-Login'
import { SignupScreen } from './02.1-ClientSignup'
import { MerchantSignupScreen } from './02.2-MerchantSignup'

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
  onForgotPassword?: () => void
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

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onClientGoogleSignUp,
  onClientSignUp,
  onLogIn,
  onMerchantSignUp,
  onForgotPassword,
  entranceDelay = 0,
}) => {
  const { height, width } = useWindowDimensions()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [isLoginSheetVisible, setIsLoginSheetVisible] = useState(false)
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
  const isCompact = height < 700
  const isWide = width >= 700
  const authSheetTop =
    activeAuthSheet === 'login'
      ? Math.min(250, height * 0.32)
      : activeAuthSheet === 'merchantSignup'
        ? Math.min(32, height * 0.04)
        : Math.min(72, height * 0.09)

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

  const openAuthSheet = (sheet: 'login' | 'clientSignup' | 'merchantSignup') => {
    if (loginSheetState.current !== 'closed') return

    setActiveAuthSheet(sheet)
    loginSheetState.current = 'opening'
    setIsLoginSheetVisible(true)
    requestAnimationFrame(() => {
      Animated.timing(loginSheetProgress, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) loginSheetState.current = 'open'
      })
    })
  }

  const openLoginSheet = () => {
    if (!onLogIn) return
    if (loginSheetState.current !== 'closed') {
      setActiveAuthSheet('login')
      return
    }

    openAuthSheet('login')
  }

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
      useNativeDriver: true,
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
      useNativeDriver: true,
    }).start()
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.screenContent}>
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <View style={[styles.brandIdentitySpacer, { height: isCompact ? 40 : 50 }]} />
            <Text style={styles.title}>HOW DO YOU WANT TO USE MULTIVENT?</Text>
            <Text style={styles.subtitle}>
              Choose the experience that fits you best.{'\n'}You can switch later from your profile.
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with selected role"
              accessibilityState={{ disabled: !selectedRole }}
              disabled={!selectedRole}
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                !selectedRole && styles.continueButtonDisabled,
                pressed && selectedRole && styles.continueButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !selectedRole && styles.continueButtonTextDisabled,
                ]}
              >
                CONTINUE
              </Text>
            </Pressable>

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
                onForgotPassword={onForgotPassword ?? closeLoginSheet}
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

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.grey200,
    borderRadius: radius.large,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  roleCardWide: {
    flex: 1,
  },
  roleCardCompact: {
    minHeight: 120,
  },
  roleCardSelected: {
    backgroundColor: '#FFF3F4',
    borderColor: colors.primaryDark,
    shadowOpacity: 0.16,
    elevation: 5,
  },
  roleCardHovered: {
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 7,
  },
  roleCardPressed: {
    opacity: 0.88,
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
    minHeight: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  continueButtonDisabled: {
    backgroundColor: '#E8D9DC',
  },
  continueButtonPressed: {
    backgroundColor: '#541F2A',
    transform: [{ scale: 0.99 }],
  },
  continueButtonText: {
    color: colors.textInverse,
    fontSize: typography.body,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  continueButtonTextDisabled: {
    color: '#9E7C83',
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
