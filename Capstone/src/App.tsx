import React from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'
import { colors } from './theme/tokens'
import { ClientHomeScreen } from './screens/03-ClientHome'
import { OnboardingScreen } from './screens/01-Onboarding'
import { LoginScreen } from './screens/01.1-Login'
import { ForgotPasswordScreen } from './screens/01.1.1-ForgotPassword'
import { NewPasswordScreen } from './screens/01.1.2-NewPassword'
import { RoleSelectionScreen, UserRole } from './screens/02-RoleSelection'
import { SignupScreen } from './screens/02.1-ClientSignup'
import { MerchantSignupScreen } from './screens/02.2-MerchantSignup'
import { PendingApprovalScreen } from './screens/02.2.1-PendingApproval'
import { RejectedApplicationScreen } from './screens/02.2.2-RejectedApplication'
import { VerificationScreen } from './screens/02.3-Verification'
<<<<<<< HEAD
import { RoleHomePlaceholderScreen } from './screens/RoleHomePlaceholder'
=======
import { BudgetAllocationScreen } from './screens/04-BudgetAllocation'
import { BudgetTrackerScreen } from './screens/04.1-BudgetTracker'
import { CategoryBrowseScreen } from './screens/05-CategoryBrowse'
import { ServiceDetailsScreen } from './screens/06-ServiceDetails'
import { SelectedSummaryScreen } from './screens/07-SelectedSummary'
>>>>>>> 620a92dd6cfaa56b7cc8f22c5fe3554667d71c5f

type AppScreen =
  | 'onboarding'
  | 'login'
  | 'forgotPassword'
  | 'newPassword'
  | 'roleSelection'
  | 'clientSignup'
  | 'merchantSignup'
  | 'verification'
  | 'pendingApproval'
  | 'rejectedApplication'
  | 'clientHome'
<<<<<<< HEAD
  | 'providerHome'
  | 'coordinatorHome'
  | 'adminHome'
  | 'superadminHome'
=======
  | 'budgetAllocation'
  | 'budgetTracker'
  | 'categoryBrowse'
  | 'serviceDetails'
  | 'selectedSummary'
>>>>>>> 620a92dd6cfaa56b7cc8f22c5fe3554667d71c5f

type LoginReturnScreen = 'roleSelection' | 'clientSignup' | 'merchantSignup'
type VerificationReturnScreen = 'clientSignup' | 'merchantSignup'
type VerificationNextScreen = 'clientHome' | 'pendingApproval'
type AccountRole =
  | 'client'
  | 'service_provider'
  | 'event_coordinator'
  | 'admin'
  | 'superadmin'

type UserMetadata = {
  default_role?: unknown
  email?: unknown
  full_name?: unknown
  name?: unknown
}

const getMetadataName = (metadata: UserMetadata) => {
  const possibleName =
    typeof metadata.full_name === 'string' && metadata.full_name.trim().length > 0
      ? metadata.full_name
      : typeof metadata.name === 'string' && metadata.name.trim().length > 0
        ? metadata.name
        : ''

  if (possibleName.length > 0) {
    return possibleName.trim()
  }

  if (typeof metadata.email === 'string' && metadata.email.includes('@')) {
    return metadata.email.split('@')[0]
  }

  return ''
}

export const App: React.FC = () => {
  const [screen, setScreen] = React.useState<AppScreen>('onboarding')
  const [userName, setUserName] = React.useState('Planner')
  const [loginReturnScreen, setLoginReturnScreen] =
    React.useState<LoginReturnScreen>('roleSelection')
  const [verificationEmail, setVerificationEmail] = React.useState('')
  const [verificationReturnScreen, setVerificationReturnScreen] =
    React.useState<VerificationReturnScreen>('clientSignup')
  const [verificationNextScreen, setVerificationNextScreen] =
    React.useState<VerificationNextScreen>('clientHome')
  const [recoveryContact, setRecoveryContact] = React.useState('')
  const [remainingBudget, setRemainingBudget] = React.useState(45000)

  const routeForRole = React.useCallback((role?: AccountRole | string | null) => {
    switch (role) {
      case 'client':
        setScreen('clientHome')
        return
      case 'service_provider':
        setScreen('providerHome')
        return
      case 'event_coordinator':
        setScreen('coordinatorHome')
        return
      case 'admin':
        setScreen('adminHome')
        return
      case 'superadmin':
        setScreen('superadminHome')
        return
      default:
        setScreen('roleSelection')
    }
  }, [])

  const loadProfileAndRoute = React.useCallback(
    async (userId: string, metadata: UserMetadata = {}) => {
      if (!supabase) {
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, default_role')
        .eq('id', userId)
        .maybeSingle()

      const profileName = data?.full_name?.trim()
      const metadataName = getMetadataName(metadata)

      if (profileName || metadataName) {
        setUserName(profileName || metadataName)
      }

      routeForRole(data?.default_role ?? String(metadata.default_role ?? ''))
    },
    [routeForRole]
  )

  React.useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted || !data.session?.user) {
        return
      }

      loadProfileAndRoute(
        data.session.user.id,
        {
          ...data.session.user.user_metadata,
          email: data.session.user.email,
        }
      )
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfileAndRoute(session.user.id, {
          ...session.user.user_metadata,
          email: session.user.email,
        })
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfileAndRoute])

  const handleAuthenticatedUser = React.useCallback(async () => {
    if (!supabase) {
      setScreen('roleSelection')
      return
    }

    const { data } = await supabase.auth.getUser()

    if (!data.user) {
      setScreen('login')
      return
    }

    loadProfileAndRoute(data.user.id, {
      ...data.user.user_metadata,
      email: data.user.email,
    })
  }, [loadProfileAndRoute])

  const openLogin = (returnScreen: LoginReturnScreen) => {
    setLoginReturnScreen(returnScreen)
    setScreen('login')
  }

  const openVerification = (
    email: string,
    returnScreen: VerificationReturnScreen,
    nextScreen: VerificationNextScreen
  ) => {
    setVerificationEmail(email)
    setVerificationReturnScreen(returnScreen)
    setVerificationNextScreen(nextScreen)
    setScreen('verification')
  }

  const handleRoleSelection = (role: UserRole) => {
    setScreen(role === 'client' ? 'clientSignup' : 'merchantSignup')
  }

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen onComplete={() => setScreen('roleSelection')} />
      case 'login':
        return (
          <LoginScreen
            onBack={() => setScreen(loginReturnScreen)}
            onCreateAccount={() => setScreen('roleSelection')}
            onForgotPassword={() => setScreen('forgotPassword')}
            onLogIn={handleAuthenticatedUser}
          />
        )
      case 'forgotPassword':
        return (
          <ForgotPasswordScreen
            onBackToLogin={() => setScreen('login')}
            onContinueToNewPassword={(contact) => {
              setRecoveryContact(contact)
              setScreen('newPassword')
            }}
          />
        )
      case 'newPassword':
        return (
          <NewPasswordScreen
            onBack={() => setScreen('forgotPassword')}
            onPasswordReset={() => setScreen('login')}
            recoveryContact={recoveryContact}
          />
        )
      case 'roleSelection':
        return (
          <RoleSelectionScreen
            onLogIn={() => openLogin('roleSelection')}
            onSelectRole={handleRoleSelection}
          />
        )
      case 'clientSignup':
        return (
          <SignupScreen
            onBack={() => setScreen('roleSelection')}
            onLogIn={() => openLogin('clientSignup')}
            onSignUp={(email, needsVerification) => {
              if (needsVerification) {
                openVerification(email, 'clientSignup', 'clientHome')
                return
              }

              handleAuthenticatedUser()
            }}
          />
        )
      case 'merchantSignup':
        return (
          <MerchantSignupScreen
            onBack={() => setScreen('roleSelection')}
            onLogIn={() => openLogin('merchantSignup')}
            onSignUp={(email, needsVerification) => {
              if (needsVerification) {
                openVerification(email, 'merchantSignup', 'pendingApproval')
                return
              }

              handleAuthenticatedUser()
            }}
          />
        )
      case 'verification':
        return (
          <VerificationScreen
            email={verificationEmail}
            onBack={() => setScreen(verificationReturnScreen)}
            onVerified={() => setScreen(verificationNextScreen)}
          />
        )
      case 'pendingApproval':
        return (
          <PendingApprovalScreen onBackToRoleSelection={() => setScreen('roleSelection')} />
        )
      case 'rejectedApplication':
        return (
          <RejectedApplicationScreen
            onBackToRoleSelection={() => setScreen('roleSelection')}
            onUpdateApplication={() => setScreen('merchantSignup')}
          />
        )
      case 'clientHome':
<<<<<<< HEAD
        return <ClientHomeScreen userName={userName} />
      case 'providerHome':
        return (
          <RoleHomePlaceholderScreen
            description="The service provider dashboard will live here once 03.1-MerchantHome is rebuilt as 03.1-ProviderHome."
            onBackToRoleSelection={() => setScreen('roleSelection')}
            roleLabel="Service Provider"
            title="Your provider workspace is being prepared."
            userName={userName}
          />
        )
      case 'coordinatorHome':
        return (
          <RoleHomePlaceholderScreen
            description="The event coordinator dashboard will show assigned events, task queues, schedules, and client updates."
            onBackToRoleSelection={() => setScreen('roleSelection')}
            roleLabel="Event Coordinator"
            title="Your coordinator workspace is being prepared."
            userName={userName}
          />
        )
      case 'adminHome':
        return (
          <RoleHomePlaceholderScreen
            description="The admin dashboard will support user management, provider reviews, platform activity, and operations tools."
            onBackToRoleSelection={() => setScreen('roleSelection')}
            roleLabel="Admin"
            title="Your admin workspace is being prepared."
            userName={userName}
          />
        )
      case 'superadminHome':
        return (
          <RoleHomePlaceholderScreen
            description="The superadmin dashboard will support system settings, permissions, governance, and high-level controls."
            onBackToRoleSelection={() => setScreen('roleSelection')}
            roleLabel="Superadmin"
            title="Your superadmin workspace is being prepared."
            userName={userName}
=======
        return (
          <ClientHomeScreen
            onSelectAction={(action) => {
              if (action === 'budget') setScreen('budgetAllocation')
              if (action === 'vendors') setScreen('budgetTracker')
            }}
          />
        )
      case 'budgetAllocation':
        return (
          <BudgetAllocationScreen
            onBack={() => setScreen('clientHome')}
            onContinue={(value) => {
              if (value.budget > 0) setRemainingBudget(value.budget)
              setScreen('budgetTracker')
            }}
            onSkip={() => setScreen('budgetTracker')}
          />
        )
      case 'budgetTracker':
        return (
          <BudgetTrackerScreen
            remainingBudget={remainingBudget}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onSelectCategory={(category) => {
              if (category === 'catering') setScreen('categoryBrowse')
            }}
            onSelectTab={(tab) => {
              if (tab === 'home') setScreen('clientHome')
              if (tab === 'planner') setScreen('budgetAllocation')
            }}
          />
        )
      case 'categoryBrowse':
        return (
          <CategoryBrowseScreen
            remainingBudget={remainingBudget}
            onBack={() => setScreen('budgetTracker')}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onSelectVendor={() => setScreen('serviceDetails')}
            onSelectTab={(tab) => {
              if (tab === 'explore' || tab === 'vendors') setScreen('budgetTracker')
              if (tab === 'budget') setScreen('budgetAllocation')
            }}
          />
        )
      case 'serviceDetails':
        return (
          <ServiceDetailsScreen
            remainingBudget={remainingBudget}
            onAddSelection={(value) => {
              setRemainingBudget((current) => Math.max(0, current - value.estimatedTotal))
              setScreen('selectedSummary')
            }}
            onBack={() => setScreen('categoryBrowse')}
          />
        )
      case 'selectedSummary':
        return (
          <SelectedSummaryScreen
            onAddService={() => setScreen('budgetTracker')}
            onSelectService={(service) => {
              if (service === 'catering') setScreen('serviceDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'budget') setScreen('budgetAllocation')
            }}
>>>>>>> 620a92dd6cfaa56b7cc8f22c5fe3554667d71c5f
          />
        )
    }
  }

  return (
    <>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView
        style={[styles.container, screen === 'clientHome' && styles.homeContainer]}
      >
        {renderScreen()}
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  homeContainer: {
    backgroundColor: '#F9F9F9',
  },
})
