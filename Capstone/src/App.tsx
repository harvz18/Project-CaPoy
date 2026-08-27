import React from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
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
import { BudgetAllocationScreen } from './screens/04-BudgetAllocation'
import { BudgetTrackerScreen } from './screens/04.1-BudgetTracker'
import { CategoryBrowseScreen } from './screens/05-CategoryBrowse'
import { ServiceDetailsScreen } from './screens/06-ServiceDetails'
import { SelectedSummaryScreen } from './screens/07-SelectedSummary'
import { InstructionModuleScreen } from './screens/08-InstructionModule'
import { ScheduleNoConflictScreen } from './screens/09-Schedule(No-Conflict)'
import { ScheduleConflictScreen } from './screens/09.1-Schedule(Conflict)'
import { BookingItem, BookingScreen } from './screens/10-BookingScreen'
import { BookingDetailsScreen } from './screens/10.1-BookingDetails'

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
  | 'budgetAllocation'
  | 'budgetTracker'
  | 'categoryBrowse'
  | 'serviceDetails'
  | 'selectedSummary'
  | 'instructionModule'
  | 'scheduleConflict'
  | 'scheduleNoConflict'
  | 'bookings'
  | 'bookingDetails'

type LoginReturnScreen = 'roleSelection' | 'clientSignup' | 'merchantSignup'
type VerificationReturnScreen = 'clientSignup' | 'merchantSignup'
type VerificationNextScreen = 'clientHome' | 'pendingApproval'

export const App: React.FC = () => {
  const [screen, setScreen] = React.useState<AppScreen>('onboarding')
  const [loginReturnScreen, setLoginReturnScreen] =
    React.useState<LoginReturnScreen>('roleSelection')
  const [verificationEmail, setVerificationEmail] = React.useState('')
  const [verificationReturnScreen, setVerificationReturnScreen] =
    React.useState<VerificationReturnScreen>('clientSignup')
  const [verificationNextScreen, setVerificationNextScreen] =
    React.useState<VerificationNextScreen>('clientHome')
  const [recoveryContact, setRecoveryContact] = React.useState('')
  const [remainingBudget, setRemainingBudget] = React.useState(45000)
  const [selectedBooking, setSelectedBooking] = React.useState<BookingItem>()

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
            onLogIn={() => setScreen('clientHome')}
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
            onSignUp={(email) => openVerification(email, 'clientSignup', 'clientHome')}
          />
        )
      case 'merchantSignup':
        return (
          <MerchantSignupScreen
            onBack={() => setScreen('roleSelection')}
            onLogIn={() => openLogin('merchantSignup')}
            onSignUp={(email) =>
              openVerification(email, 'merchantSignup', 'pendingApproval')
            }
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
        return (
          <ClientHomeScreen
            onSelectAction={(action) => {
              if (action === 'budget') setScreen('budgetAllocation')
              if (action === 'vendors') setScreen('budgetTracker')
            }}
            onSelectTab={(tab) => {
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'explore') setScreen('budgetTracker')
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
              if (tab === 'plan') setScreen('instructionModule')
              if (tab === 'budget') setScreen('budgetAllocation')
            }}
          />
        )
      case 'instructionModule':
        return (
          <InstructionModuleScreen
            onBack={() => setScreen('selectedSummary')}
            onSaveContinue={() => setScreen('scheduleConflict')}
          />
        )
      case 'scheduleConflict':
        return (
          <ScheduleConflictScreen
            onBack={() => setScreen('instructionModule')}
            onChangeDate={() => setScreen('scheduleNoConflict')}
            onChooseDifferentProvider={() => setScreen('scheduleNoConflict')}
          />
        )
      case 'scheduleNoConflict':
        return (
          <ScheduleNoConflictScreen
            onBack={() => setScreen('scheduleConflict')}
            onContinueToPayment={() => setScreen('selectedSummary')}
          />
        )
      case 'bookings':
        return (
          <BookingScreen
            onSelectBooking={(booking) => {
              setSelectedBooking(booking)
              setScreen('bookingDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'home') setScreen('clientHome')
              if (tab === 'merchants') setScreen('budgetTracker')
            }}
          />
        )
      case 'bookingDetails':
        return (
          <BookingDetailsScreen
            booking={selectedBooking}
            onBack={() => setScreen('bookings')}
          />
        )
    }
  }

  return (
    <>
      <StatusBar style="dark" />
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
