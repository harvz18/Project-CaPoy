import React from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { supabase } from './lib/supabase'
import {
  CatalogService,
  fetchCatalogServices,
  mockCatalogServices,
} from './lib/catalog'
import {
  saveBudgetPlan,
  saveEventDraft,
  savePlanningPayment,
  saveProviderInstructions,
  saveScheduleCheck,
  saveServiceSelection,
} from './lib/planning'
import { colors } from './theme/tokens'
import { ClientHomeScreen } from './screens/03-ClientHome'
import { MerchantHomeScreen } from './screens/16-MerchantHome'
import { ServiceListingScreen } from './screens/17-ServiceListing'
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
import { BudgetAllocationScreen } from './screens/05-BudgetAllocation'
import {
  EventCreationScreen,
  EventCreationValue,
} from './screens/04-EventCreation'
import { BudgetTrackerScreen } from './screens/04.1-BudgetTracker'
import { CategoryBrowseScreen } from './screens/06-CategoryBrowse'
import { ServiceDetailsScreen } from './screens/08-ServiceDetails'
import {
  SelectedSummaryScreen,
  SelectedSummaryService,
} from './screens/07-SelectedSummary'
import { RoleHomePlaceholderScreen } from './screens/RoleHomePlaceholder'
import { InstructionModuleScreen } from './screens/10-InstructionModule'
import { ScheduleNoConflictScreen } from './screens/09-Schedule(No-Conflict)'
import { ScheduleConflictScreen } from './screens/09-Schedule(Conflict)'
import { BookingItem, BookingScreen } from './screens/11-BookingScreen'
import { BookingDetailsScreen } from './screens/11.1-BookingDetails'
import {
  PaymentEventDetails,
  PaymentOrderItem,
  PaymentScreen,
  PaymentValue,
} from './screens/12-Payment'
import { ConfirmationReceipt, ConfirmationScreen } from './screens/13-Confirmation'
import {
  EventLedgerScreen,
  LedgerCategory,
  LedgerTransaction,
} from './screens/14-EventLedger'
import { SubmitReviewScreen } from './screens/15-SubmitReview'

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
  | 'eventCreation'
  | 'providerHome'
  | 'providerServices'
  | 'coordinatorHome'
  | 'adminHome'
  | 'superadminHome'
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
  | 'payment'
  | 'confirmation'
  | 'eventLedger'
  | 'submitReview'
  | 'messages'
  | 'notifications'
  | 'guestList'

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
  business_name?: unknown
  default_role?: unknown
  email?: unknown
  full_name?: unknown
  name?: unknown
}

const DEFAULT_BUDGET = 45000
const DEFAULT_EVENT: EventCreationValue = {
  date: '',
  eventName: '',
  eventType: 'wedding',
  guestCount: 120,
  time: '',
  venueStatus: 'searching',
}

const ledgerColors = ['#6B1E2E', '#994251', '#DAC0C2', '#544244', '#C7C6C6']

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
  const [homeReturnScreen, setHomeReturnScreen] =
    React.useState<'clientHome' | 'providerHome'>('clientHome')
  const [loginReturnScreen, setLoginReturnScreen] =
    React.useState<LoginReturnScreen>('roleSelection')
  const [verificationEmail, setVerificationEmail] = React.useState('')
  const [verificationReturnScreen, setVerificationReturnScreen] =
    React.useState<VerificationReturnScreen>('clientSignup')
  const [verificationNextScreen, setVerificationNextScreen] =
    React.useState<VerificationNextScreen>('clientHome')
  const [recoveryContact, setRecoveryContact] = React.useState('')
  const [selectedBooking, setSelectedBooking] = React.useState<BookingItem>()
  const [catalogServices, setCatalogServices] =
    React.useState<CatalogService[]>(mockCatalogServices)
  const [selectedCategory, setSelectedCategory] = React.useState('catering')
  const [currentServiceId, setCurrentServiceId] = React.useState(mockCatalogServices[0].id)
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [totalBudget, setTotalBudget] = React.useState(DEFAULT_BUDGET)
  const [eventDetails, setEventDetails] =
    React.useState<EventCreationValue>(DEFAULT_EVENT)
  const [lastPayment, setLastPayment] = React.useState<PaymentValue>()

  const openPlanningHub = () => setScreen('budgetTracker')
  const openSelectedPlan = () => setScreen('selectedSummary')
  const eventDisplayName = eventDetails.eventName.trim() || 'My Event Plan'
  const eventDisplayDate = eventDetails.date.trim() || 'Date to be confirmed'
  const eventDisplayTime = eventDetails.time.trim() || 'Time to be confirmed'
  const selectedEstimatedTotal = selectedServices.reduce(
    (total, service) => total + service.price,
    0
  )
  const remainingBudget = Math.max(0, totalBudget - selectedEstimatedTotal)
  const currentService =
    catalogServices.find((service) => service.id === currentServiceId) ?? mockCatalogServices[0]
  const categoryServices = catalogServices.filter(
    (service) => service.categoryId === selectedCategory
  )
  const visibleCatalogServices = categoryServices.length > 0 ? categoryServices : catalogServices
  const paymentItems: PaymentOrderItem[] = selectedServices.map((service) => ({
    description: service.detail,
    id: service.id,
    name: service.name,
    price: service.price,
  }))
  const payableItems =
    paymentItems.length > 0
      ? paymentItems
      : [
          {
            description: 'Add services first to build a real order.',
            id: 'empty-plan',
            name: 'No selected services yet',
            price: 0,
          },
        ]
  const paymentEvent: PaymentEventDetails = {
    date: eventDisplayDate,
    guestCount: eventDetails.guestCount,
    name: eventDisplayName,
    time: eventDisplayTime,
  }
  const bookingItems: BookingItem[] = selectedServices.map((service) => ({
    category: service.category,
    date: eventDisplayDate,
    id: service.id,
    image: service.imageUrl,
    imageLabel: service.imageLabel,
    name: service.name,
    status: lastPayment ? 'confirmed' : 'pending',
  }))
  const ledgerCategories: LedgerCategory[] = selectedServices.map((service, index) => ({
    amount: service.price,
    color: ledgerColors[index % ledgerColors.length],
    id: service.id,
    label: service.category,
  }))
  const ledgerTransactions: LedgerTransaction[] = lastPayment
    ? [
        {
          amount: lastPayment.amount,
          category: lastPayment.paymentType === 'deposit' ? 'Deposit' : 'Full Payment',
          date: new Date().toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          id: 'latest-payment',
          merchant: eventDisplayName,
          status: lastPayment.paymentType === 'deposit' ? 'depositPaid' : 'fullyPaid',
        },
      ]
    : []

  React.useEffect(() => {
    let isMounted = true

    fetchCatalogServices().then((services) => {
      if (!isMounted) {
        return
      }

      setCatalogServices(services)
      setCurrentServiceId((current) =>
        services.some((service) => service.id === current) ? current : services[0].id
      )
    })

    return () => {
      isMounted = false
    }
  }, [])

  const routeForRole = React.useCallback((role?: AccountRole | string | null) => {
    switch (role) {
      case 'client':
        setHomeReturnScreen('clientHome')
        setScreen('clientHome')
        return
      case 'service_provider':
        setHomeReturnScreen('providerHome')
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
      const resolvedRole = data?.default_role ?? String(metadata.default_role ?? '')

      if (profileName || metadataName) {
        setUserName(profileName || metadataName)
      }

      const metadataBusinessName =
        typeof metadata.business_name === 'string' ? metadata.business_name.trim() : ''

      if (resolvedRole === 'service_provider' && metadataBusinessName) {
        setUserName(metadataBusinessName)
      }

      routeForRole(resolvedRole)
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

      loadProfileAndRoute(data.session.user.id, {
        ...data.session.user.user_metadata,
        email: data.session.user.email,
      })
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

  const handleBudgetContinue = (budget: number, priorities: string[]) => {
    if (budget <= 0) {
      openPlanningHub()
      return
    }

    setTotalBudget(budget)
    void saveBudgetPlan({ budget, priorities })
    openPlanningHub()
  }

  const handleEventContinue = (value: EventCreationValue, nextScreen: AppScreen) => {
    setEventDetails(value)
    void saveEventDraft(value)
    setScreen(nextScreen)
  }

  const handleAddSelection = (value: Parameters<typeof saveServiceSelection>[0]) => {
    const nextSelection: SelectedSummaryService = {
      id: value.service.id,
      category: value.service.categoryName.toUpperCase(),
      detail: value.attendeeCount > 0 ? `${value.attendeeCount} Guests` : value.service.detail,
      imageLabel: value.service.imageLabel,
      imageUrl: value.service.imageUrl,
      name: value.service.name,
      price: value.estimatedTotal,
      status: 'Selected',
    }

    setSelectedServices((current) => {
      const existingIndex = current.findIndex((service) => service.id === nextSelection.id)
      return existingIndex >= 0
        ? current.map((service, index) =>
            index === existingIndex ? nextSelection : service
          )
        : [...current, nextSelection]
    })

    void saveServiceSelection(value)
    setScreen('selectedSummary')
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
        return (
          <ClientHomeScreen
            userName={userName}
            remainingBudget={remainingBudget}
            selectedServiceCount={selectedServices.length}
            totalBudget={totalBudget}
            onOpenActiveEvent={() => setScreen('selectedSummary')}
            onOpenProfile={() => setScreen('selectedSummary')}
            onOpenNotifications={() => {
              setHomeReturnScreen('clientHome')
              setScreen('notifications')
            }}
            onSeeAllVenues={openPlanningHub}
            onSelectAction={(action) => {
              if (action === 'newEvent') setScreen('eventCreation')
              if (action === 'budget') setScreen('budgetAllocation')
              if (action === 'vendors') openPlanningHub()
              if (action === 'ledger') setScreen('eventLedger')
              if (action === 'tasks') setScreen('selectedSummary')
            }}
            onSelectRecommendation={() => {
              setCurrentServiceId(mockCatalogServices[0].id)
              setScreen('serviceDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'home') setScreen('clientHome')
              if (tab === 'bookings') {
                setHomeReturnScreen('clientHome')
                setScreen('bookings')
              }
              if (tab === 'explore') openPlanningHub()
              if (tab === 'messages') {
                setHomeReturnScreen('clientHome')
                setScreen('messages')
              }
              if (tab === 'profile') setScreen('selectedSummary')
            }}
          />
        )
      case 'eventLedger':
        return (
          <EventLedgerScreen
            budget={totalBudget}
            categories={ledgerCategories}
            transactions={ledgerTransactions}
            onBack={() => setScreen(homeReturnScreen)}
            onExportPdf={() => setScreen('eventLedger')}
            onShare={() => setScreen('eventLedger')}
            onViewAll={() => setScreen('eventLedger')}
          />
        )
      case 'eventCreation':
        return (
          <EventCreationScreen
            initialValue={eventDetails}
            onClose={() => setScreen('clientHome')}
            onContinue={(value) => handleEventContinue(value, 'budgetAllocation')}
            onSaveExit={(value) => handleEventContinue(value, 'clientHome')}
          />
        )
      case 'providerHome':
        return (
          <MerchantHomeScreen
            businessName={userName}
            onOpenNotifications={() => {
              setHomeReturnScreen('providerHome')
              setScreen('notifications')
            }}
            onSelectQuickAction={(action) => {
              setHomeReturnScreen('providerHome')
              if (action === 'newQuote') setScreen('messages')
              if (action === 'clients') setScreen('bookings')
              if (action === 'invoices') setScreen('eventLedger')
            }}
            onSelectScheduleItem={() => {
              setHomeReturnScreen('providerHome')
              setScreen('bookings')
            }}
            onSelectTab={(tab) => {
              setHomeReturnScreen('providerHome')
              if (tab === 'services') setScreen('providerServices')
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'messages') setScreen('messages')
            }}
            onViewAllSchedule={() => {
              setHomeReturnScreen('providerHome')
              setScreen('bookings')
            }}
          />
        )
      case 'providerServices':
        return (
          <ServiceListingScreen
            onOpenMenu={() => setScreen('providerHome')}
            onSelectTab={(tab) => {
              setHomeReturnScreen('providerHome')
              if (tab === 'home') setScreen('providerHome')
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'messages') setScreen('messages')
            }}
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
          />
        )
      case 'budgetAllocation':
        return (
          <BudgetAllocationScreen
            initialBudget={totalBudget}
            onBack={() => setScreen('eventCreation')}
            onBudgetChange={setTotalBudget}
            onContinue={(value) => handleBudgetContinue(value.budget, value.priorities)}
            onSkip={openPlanningHub}
          />
        )
      case 'budgetTracker':
        return (
          <BudgetTrackerScreen
            remainingBudget={remainingBudget}
            onBack={() => setScreen('budgetAllocation')}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onOpenMenu={openSelectedPlan}
            onOpenProfile={() => setScreen('selectedSummary')}
            onSelectCategory={(category) => {
              setSelectedCategory(category)
              setScreen('categoryBrowse')
            }}
            onSelectTab={(tab) => {
              if (tab === 'home') setScreen('clientHome')
              if (tab === 'explore' || tab === 'vendors') setScreen('budgetTracker')
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'messages' || tab === 'chat') setScreen('messages')
              if (tab === 'profile') setScreen('selectedSummary')
              if (tab === 'planner') setScreen('budgetAllocation')
            }}
          />
        )
      case 'categoryBrowse':
        return (
          <CategoryBrowseScreen
            services={visibleCatalogServices}
            remainingBudget={remainingBudget}
            onBack={openPlanningHub}
            onMore={openSelectedPlan}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onOpenSort={() => setScreen('categoryBrowse')}
            onSelectVendor={(vendorId) => {
              setCurrentServiceId(vendorId)
              setScreen('serviceDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'explore' || tab === 'vendors') openPlanningHub()
              if (tab === 'budget') setScreen('budgetAllocation')
              if (tab === 'profile') setScreen('selectedSummary')
            }}
          />
        )
      case 'serviceDetails':
        return (
          <ServiceDetailsScreen
            service={currentService}
            remainingBudget={remainingBudget}
            onAddSelection={handleAddSelection}
            onBack={() => setScreen('categoryBrowse')}
            onBrowseMenus={() => setScreen('categoryBrowse')}
            onReadAllReviews={() => setScreen('serviceDetails')}
          />
        )
      case 'selectedSummary':
        return (
          <SelectedSummaryScreen
            budget={totalBudget}
            selectedServices={selectedServices}
            totalEstimatedCost={selectedEstimatedTotal}
            onAddService={openPlanningHub}
            onBack={openPlanningHub}
            onOpenMenu={() => setScreen('clientHome')}
            onOpenProfile={() => setScreen('clientHome')}
            onSelectService={(service) => {
              setCurrentServiceId(service)
              setScreen('serviceDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'plan') {
                setScreen(selectedServices.length > 0 ? 'instructionModule' : 'budgetTracker')
              }
              if (tab === 'home') setScreen('clientHome')
              if (tab === 'explore') setScreen('budgetTracker')
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'messages') setScreen('messages')
              if (tab === 'profile') setScreen('selectedSummary')
              if (tab === 'guestList') setScreen('guestList')
              if (tab === 'budget') setScreen('budgetAllocation')
              if (tab === 'settings') setScreen('clientHome')
            }}
          />
        )
      case 'instructionModule':
        return (
          <InstructionModuleScreen
            onBack={() => setScreen('selectedSummary')}
            onSaveContinue={(value) => {
              void saveProviderInstructions(value)
              void saveScheduleCheck('conflict')
              setScreen('scheduleConflict')
            }}
          />
        )
      case 'scheduleConflict':
        return (
          <ScheduleConflictScreen
            onBack={() => setScreen('instructionModule')}
            onChangeDate={() => {
              void saveScheduleCheck('available')
              setScreen('scheduleNoConflict')
            }}
            onChooseDifferentProvider={() => {
              void saveScheduleCheck('available')
              setScreen('scheduleNoConflict')
            }}
            onMessageProvider={() => setScreen('messages')}
          />
        )
      case 'scheduleNoConflict':
        return (
          <ScheduleNoConflictScreen
            onBack={() => setScreen('scheduleConflict')}
            onContinueToPayment={() => {
              void saveScheduleCheck('available')
              setScreen(selectedServices.length > 0 ? 'payment' : 'selectedSummary')
            }}
            onSelectProvider={() => setScreen('instructionModule')}
          />
        )
      case 'messages':
        return (
          <RoleHomePlaceholderScreen
            description="Client and provider conversations will appear here for quotes, schedule changes, and booking updates."
            onBackToRoleSelection={() => setScreen(homeReturnScreen)}
            roleLabel="Messages"
            title="Your event messages are ready when providers respond."
            userName={userName}
          />
        )
      case 'notifications':
        return (
          <RoleHomePlaceholderScreen
            description="Notifications will show booking approvals, payment reminders, provider replies, and schedule alerts."
            onBackToRoleSelection={() => setScreen(homeReturnScreen)}
            roleLabel="Alerts"
            title="No urgent updates right now."
            userName={userName}
          />
        )
      case 'guestList':
        return (
          <RoleHomePlaceholderScreen
            description="Guest counts already feed the catering estimate. The full guest list workspace will manage invites, RSVPs, and meal notes."
            onBackToRoleSelection={() => setScreen('selectedSummary')}
            roleLabel="Guests"
            title="Your guest list workspace is being prepared."
            userName={userName}
          />
        )
      case 'payment':
        return (
          <PaymentScreen
            event={paymentEvent}
            items={payableItems}
            onBack={() => setScreen('scheduleNoConflict')}
            onOpenCancellationPolicy={() => setScreen('payment')}
            onOpenTerms={() => setScreen('payment')}
            onPay={(value) => {
              setLastPayment(value)
              void savePlanningPayment(value, payableItems)
              setScreen('confirmation')
            }}
          />
        )
      case 'confirmation':
        return (
          <ConfirmationScreen
            receipt={{
              currencySymbol: 'PHP ',
              eventDate: eventDisplayDate,
              items: payableItems.map((item) => ({
                detail: item.description,
                id: item.id,
                name: item.name,
                price:
                  lastPayment?.paymentType === 'deposit'
                    ? Math.round(item.price * 0.3)
                    : item.price,
              })),
              referenceNumber: `MV-${Date.now().toString().slice(-8)}`,
              serviceFee: 0,
            } satisfies ConfirmationReceipt}
            onBackHome={() => setScreen('clientHome')}
            onViewBookings={() => setScreen('bookings')}
          />
        )
      case 'bookings':
        return (
          <BookingScreen
            bookings={bookingItems}
            eventName={eventDisplayName}
            onOpenMenu={() => setScreen('clientHome')}
            onOpenProfile={() => setScreen('clientHome')}
            onSelectEvent={() => setScreen('selectedSummary')}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking)
              setScreen('bookingDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'home') setScreen(homeReturnScreen)
              if (tab === 'explore' || tab === 'merchants') {
                setScreen(
                  homeReturnScreen === 'providerHome' ? 'providerServices' : 'budgetTracker'
                )
              }
              if (tab === 'bookings') setScreen('bookings')
              if (tab === 'messages') setScreen('messages')
              if (tab === 'profile') {
                setScreen(
                  homeReturnScreen === 'providerHome' ? 'providerHome' : 'selectedSummary'
                )
              }
            }}
          />
        )
      case 'bookingDetails':
        return (
          <BookingDetailsScreen
            booking={selectedBooking}
            details={{
              date: eventDisplayDate,
              paymentStatus: lastPayment ? 'Paid' : 'Pending',
              price: `PHP ${Math.round(
                selectedServices.find((service) => service.id === selectedBooking?.id)
                  ?.price ?? 0
              ).toLocaleString('en-US')}`,
              requestedDate: eventDisplayDate,
              time: eventDisplayTime,
            }}
            onBack={() => setScreen('bookings')}
            onCancelOrReschedule={() => setScreen('scheduleNoConflict')}
            onMessageProvider={() => setScreen('messages')}
            onSubmitReview={() => setScreen('submitReview')}
          />
        )
      case 'submitReview':
        return (
          <SubmitReviewScreen
            booking={selectedBooking}
            onBackToBookings={() => setScreen('bookings')}
            onClose={() => setScreen('bookingDetails')}
            onSubmit={() => setScreen('bookings')}
          />
        )
    }
  }

  const isHome =
    screen === 'clientHome' || screen === 'providerHome' || screen === 'providerServices'

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.container, isHome && styles.homeContainer]}>
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
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
