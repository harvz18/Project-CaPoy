import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './lib/supabase'
import { CatalogService, fetchCatalogServices } from './lib/catalog'
import {
  saveBudgetPlan,
  saveClientReview,
  saveEventDraft,
  savePlanningPayment,
  saveProviderInstructions,
  saveScheduleCheck,
  saveServiceSelection,
} from './lib/planning'
import {
  changeMerchantPassword,
  clearMerchantServiceDraft,
  fetchClientBookings,
  fetchMerchantBookingRequests,
  fetchMerchantServices,
  loadMerchantServiceDraft,
  MerchantServiceListing,
  markMerchantNotificationRead,
  markMerchantNotificationsRead,
  requestMerchantPayout,
  saveAvailabilityCalendar,
  saveBookingDecision,
  saveMerchantServiceDraft,
  saveMerchantServiceListing,
  saveMerchantTransactionNote,
  saveNotificationPreferences,
  saveOperatingHours,
} from './lib/merchant'
import { colors } from './theme/tokens'
import { ClientHomeScreen } from './screens/03-ClientHome'
import { MerchantHomeScreen } from './screens/16-MerchantHome'
import {
  Step1ServiceListingScreen,
  ServiceInformationValue,
} from './screens/17-Step1ServiceListing'
import { ProviderServicesScreen } from './screens/17-ProviderServices'
import {
  Step2PricingScreen,
  ServicePricingValue,
} from './screens/17.1-Step2Pricing'
import {
  Step2AddPackageScreen,
  ServicePackageValue,
} from './screens/17.1.1-Step2AddPackage'
import {
  ReviewListingSection,
  ServiceListingReviewValue,
  Step3ReviewListingsScreen,
} from './screens/17.2-Step3ReviewListings'
import {
  AvailabilityCalendarScreen,
  AvailabilityEntry,
} from './screens/18-AvailabilityCalendar'
import {
  BookingRequestDecisionValue,
  BookingRequestDetailsScreen,
} from './screens/19.1-BookingRequest'
import {
  BookingRequestDeclineScreen,
  BookingRequestDeclineValue,
} from './screens/19.2-BookingRequest(Deciline)'
import {
  BookingRequestScreen,
  BookingRequestStatus,
  MerchantBookingRequest,
} from './screens/19-BookingRequest'
import { MerchantBookingDetailScreen } from './screens/20-BookingDetail'
import { ReviewPerformanceScreen } from './screens/21-ReviewPerformance'
import {
  MerchantProfileAction,
  MerchantProfileScreen,
} from './screens/22-MerchantProfile'
import { OperatingHoursScreen } from './screens/22.1-OperatingHours'
import {
  PayoutEarningsScreen,
  PayoutTransaction,
} from './screens/22.2-PayoutEarnings'
import { TransactionDetailsScreen } from './screens/22.3-TransactionDetails'
import { ChangePasswordScreen } from './screens/22.4-ChangePassword'
import { NotificationScreen } from './screens/22.5-Notification'
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
  | 'providerDraftChoice'
  | 'providerServices'
  | 'providerServiceInfo'
  | 'providerServicePricing'
  | 'providerPackage'
  | 'providerServiceReview'
  | 'providerAvailability'
  | 'providerBookingRequests'
  | 'providerBookingRequestDetails'
  | 'providerBookingDecline'
  | 'providerBookingDetails'
  | 'providerReviews'
  | 'providerProfile'
  | 'providerOperatingHours'
  | 'providerPayouts'
  | 'providerTransactionDetails'
  | 'providerChangePassword'
  | 'providerNotifications'
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

const DEFAULT_SERVICE_INFORMATION: ServiceInformationValue = {
  category: 'Catering',
  description: '',
  photos: [],
  serviceName: '',
}

const DEFAULT_SERVICE_PRICING: ServicePricingValue = {
  currency: 'PHP',
  details: '',
  model: 'fixed',
  unit: 'event',
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
  const [catalogServices, setCatalogServices] = React.useState<CatalogService[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState('catering')
  const [currentServiceId, setCurrentServiceId] = React.useState('')
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [clientBookings, setClientBookings] = React.useState<BookingItem[]>([])
  const [merchantRequests, setMerchantRequests] = React.useState<MerchantBookingRequest[]>([])
  const [merchantServices, setMerchantServices] = React.useState<MerchantServiceListing[]>([])
  const [totalBudget, setTotalBudget] = React.useState(DEFAULT_BUDGET)
  const [eventDetails, setEventDetails] =
    React.useState<EventCreationValue>(DEFAULT_EVENT)
  const [lastPayment, setLastPayment] = React.useState<PaymentValue>()
  const [merchantServiceInfo, setMerchantServiceInfo] =
    React.useState<ServiceInformationValue>(DEFAULT_SERVICE_INFORMATION)
  const [merchantServicePricing, setMerchantServicePricing] =
    React.useState<ServicePricingValue>(DEFAULT_SERVICE_PRICING)
  const [merchantPackages, setMerchantPackages] = React.useState<ServicePackageValue[]>([])
  const [merchantAvailability, setMerchantAvailability] = React.useState<AvailabilityEntry[]>([])
  const [selectedMerchantRequest, setSelectedMerchantRequest] =
    React.useState<MerchantBookingRequest>()
  const [selectedMerchantTransaction, setSelectedMerchantTransaction] =
    React.useState<PayoutTransaction>()
  const [merchantRequestStatus, setMerchantRequestStatus] =
    React.useState<BookingRequestStatus>('new')
  const [isPublishingService, setIsPublishingService] = React.useState(false)
  const [isSavingServiceDraft, setIsSavingServiceDraft] = React.useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false)
  const [hasMerchantDraft, setHasMerchantDraft] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState('')

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
  const currentService = catalogServices.find((service) => service.id === currentServiceId)
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
  const bookingItems = clientBookings
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
        services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
      )
    })

    return () => {
      isMounted = false
    }
  }, [])

  const refreshLiveData = React.useCallback(async () => {
    const [services, bookings, requests, merchantServiceRows, draft] = await Promise.all([
      fetchCatalogServices(),
      fetchClientBookings(),
      fetchMerchantBookingRequests(),
      fetchMerchantServices(),
      loadMerchantServiceDraft(),
    ])

    setCatalogServices(services)
    setClientBookings(bookings)
    setMerchantRequests(requests)
    setMerchantServices((current) =>
      merchantServiceRows.length > 0 ? merchantServiceRows : current
    )
    setCurrentServiceId((current) =>
      services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
    )

    setHasMerchantDraft(Boolean(draft))
    if (draft?.information) setMerchantServiceInfo(draft.information)
    if (draft?.pricing) setMerchantServicePricing(draft.pricing)
    if (draft?.packages) setMerchantPackages(draft.packages)
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
      void refreshLiveData()
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
        void refreshLiveData()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfileAndRoute, refreshLiveData])

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
    void refreshLiveData()
  }, [loadProfileAndRoute, refreshLiveData])

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

  React.useEffect(() => {
    if (!toastMessage) {
      return undefined
    }

    const timeout = setTimeout(() => setToastMessage(''), 2600)
    return () => clearTimeout(timeout)
  }, [toastMessage])

  React.useEffect(() => {
    if (screen === 'providerServices') {
      void refreshLiveData()
    }
  }, [refreshLiveData, screen])

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

    void saveServiceSelection(value).then(() => refreshLiveData())
    setScreen('selectedSummary')
  }

  const openMerchantTab = (tab: 'home' | 'services' | 'bookings' | 'messages' | 'profile') => {
    setHomeReturnScreen('providerHome')
    if (tab === 'home') setScreen('providerHome')
    if (tab === 'services') setScreen('providerServices')
    if (tab === 'bookings') setScreen('providerBookingRequests')
    if (tab === 'messages') setScreen('messages')
    if (tab === 'profile') setScreen('providerProfile')
  }

  const handleMerchantAction = (action: MerchantProfileAction) => {
    if (action === 'services' || action === 'packages') {
      setScreen('providerServices')
    }
    if (action === 'availability') setScreen('providerAvailability')
    if (action === 'operatingHours') setScreen('providerOperatingHours')
    if (action === 'payouts') setScreen('providerPayouts')
    if (action === 'reviews') setScreen('providerReviews')
    if (action === 'notifications') setScreen('providerNotifications')
    if (action === 'security') setScreen('providerChangePassword')
    if (action === 'verification') setScreen('pendingApproval')
    if (action === 'help' || action === 'terms') setScreen('providerProfile')
    if (action === 'logout') {
      void supabase?.auth.signOut()
      setUserName('Planner')
      setScreen('roleSelection')
    }
  }

  const handleServiceListingSubmit = async (
    value: ServiceListingReviewValue,
    status: 'draft' | 'active'
  ) => {
    if (status === 'active') {
      setIsPublishingService(true)
    } else {
      setIsSavingServiceDraft(true)
    }

    const result =
      status === 'draft'
        ? await saveMerchantServiceDraft(value)
        : await saveMerchantServiceListing(value, status)

    setIsPublishingService(false)
    setIsSavingServiceDraft(false)

    if (result.ok) {
      await refreshLiveData()
      const savedService = result.service

      if (savedService) {
        setMerchantServices((current) => {
          const existingIndex = current.findIndex((service) => service.id === savedService.id)

          if (existingIndex >= 0) {
            return current.map((service, index) =>
              index === existingIndex ? savedService : service
            )
          }

          return [savedService, ...current]
        })
      }
      setHasMerchantDraft(status === 'draft')
      setToastMessage(status === 'active' ? 'Service published successfully.' : 'Draft saved.')
      setScreen('providerServices')
    } else if (result.message) {
      setToastMessage(result.message)
    }
  }

  const startNewMerchantListing = () => {
    setMerchantServiceInfo(DEFAULT_SERVICE_INFORMATION)
    setMerchantServicePricing(DEFAULT_SERVICE_PRICING)
    setMerchantPackages([])
    setHasMerchantDraft(false)
    void clearMerchantServiceDraft()
    setScreen('providerServiceInfo')
  }

  const handleBookingDecision = (
    value: BookingRequestDecisionValue | BookingRequestDeclineValue
  ) => {
    void saveBookingDecision(value).then(() => refreshLiveData())
    setMerchantRequestStatus('reason' in value || value.decision === 'declined' ? 'cancelled' : 'confirmed')
    setSelectedMerchantRequest(value.request)
    setScreen('providerBookingRequests')
  }

  const pickMerchantServicePhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      return null
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
      quality: 0.82,
      selectionLimit: 5,
    })

    if (result.canceled) {
      return null
    }

    return result.assets.map((asset) => asset.uri).filter(Boolean)
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
              if (catalogServices[0]?.id) {
                setCurrentServiceId(catalogServices[0].id)
                setScreen('serviceDetails')
              } else {
                openPlanningHub()
              }
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
              if (action === 'calendar') setScreen('providerAvailability')
              if (action === 'clients') setScreen('providerBookingRequests')
              if (action === 'invoices') setScreen('providerPayouts')
            }}
            onSelectScheduleItem={() => {
              setHomeReturnScreen('providerHome')
              setScreen('providerBookingRequests')
            }}
            onSelectTab={openMerchantTab}
            onViewAllSchedule={() => {
              setHomeReturnScreen('providerHome')
              setScreen('providerBookingRequests')
            }}
          />
        )
      case 'providerDraftChoice':
        return (
          <View style={styles.draftChoiceScreen}>
            <View style={styles.draftChoiceCard}>
              <Text style={styles.draftChoiceTitle}>Continue previous draft?</Text>
              <Text style={styles.draftChoiceCopy}>
                You have an unpublished service listing saved for {merchantServiceInfo.serviceName || 'your service'}.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setScreen('providerServiceReview')}
                style={({ pressed }) => [
                  styles.draftPrimaryButton,
                  pressed && styles.draftButtonPressed,
                ]}
              >
                <Text style={styles.draftPrimaryText}>Continue Draft</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={startNewMerchantListing}
                style={({ pressed }) => [
                  styles.draftSecondaryButton,
                  pressed && styles.draftButtonPressed,
                ]}
              >
                <Text style={styles.draftSecondaryText}>Start New Listing</Text>
              </Pressable>
            </View>
          </View>
        )
      case 'providerServices':
        return (
          <ProviderServicesScreen
            hasDraft={hasMerchantDraft}
            services={merchantServices}
            onAddService={() => {
              setScreen(hasMerchantDraft ? 'providerDraftChoice' : 'providerServiceInfo')
            }}
            onBack={() => setScreen('providerHome')}
            onContinueDraft={() => setScreen('providerServiceReview')}
            onOpenAccount={() => setScreen('providerProfile')}
            onSelectTab={openMerchantTab}
          />
        )
      case 'providerServiceReview':
        return (
          <Step3ReviewListingsScreen
            information={merchantServiceInfo}
            isPublishing={isPublishingService}
            isSavingDraft={isSavingServiceDraft}
            packages={merchantPackages}
            pricing={merchantServicePricing}
            onBack={() => setScreen('providerHome')}
            onEditSection={(section: ReviewListingSection) => {
              if (section === 'serviceInformation') setScreen('providerServiceInfo')
              if (section === 'pricing') setScreen('providerServicePricing')
              if (section === 'packages') setScreen('providerPackage')
            }}
            onOpenAccount={() => setScreen('providerProfile')}
            onPublish={(value) => void handleServiceListingSubmit(value, 'active')}
            onSaveDraft={(value) => void handleServiceListingSubmit(value, 'draft')}
          />
        )
      case 'providerServiceInfo':
        return (
          <Step1ServiceListingScreen
            initialValue={merchantServiceInfo}
            onAddPhoto={pickMerchantServicePhotos}
            onBack={(draft) => {
              const information = draft ?? merchantServiceInfo
              setMerchantServiceInfo(information)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information,
                packages: merchantPackages,
                pricing: merchantServicePricing,
              })
              setScreen('providerServices')
            }}
            onNext={(value) => {
              setMerchantServiceInfo(value)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: value,
                packages: merchantPackages,
                pricing: merchantServicePricing,
              })
              setScreen('providerServicePricing')
            }}
          />
        )
      case 'providerServicePricing':
        return (
          <Step2PricingScreen
            initialValue={merchantServicePricing}
            onBack={(draft) => {
              const pricing = draft ?? merchantServicePricing
              setMerchantServicePricing(pricing)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: merchantServiceInfo,
                packages: merchantPackages,
                pricing,
              })
              setScreen('providerServiceInfo')
            }}
            onNext={(value) => {
              setMerchantServicePricing(value)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: merchantServiceInfo,
                packages: merchantPackages,
                pricing: value,
              })
              setScreen('providerPackage')
            }}
          />
        )
      case 'providerPackage':
        return (
          <Step2AddPackageScreen
            onBack={(draft) => {
              if (draft) {
                setMerchantPackages((current) => {
                  const existing = current.findIndex((item) => item.id === draft.id)
                  const nextPackages = existing >= 0
                    ? current.map((item, index) => (index === existing ? draft : item))
                    : [...current, draft]
                  void saveMerchantServiceDraft({
                    information: merchantServiceInfo,
                    packages: nextPackages,
                    pricing: merchantServicePricing,
                  })
                  return nextPackages
                })
              }
              setHasMerchantDraft(true)
              setScreen('providerServicePricing')
            }}
            onSave={(value) => {
              setMerchantPackages((current) => {
                const existing = current.findIndex((item) => item.id === value.id)
                const nextPackages = existing >= 0
                  ? current.map((item, index) => (index === existing ? value : item))
                  : [...current, value]
                void saveMerchantServiceDraft({
                  information: merchantServiceInfo,
                  packages: nextPackages,
                  pricing: merchantServicePricing,
                })
                return nextPackages
              })
              setHasMerchantDraft(true)
              setScreen('providerServiceReview')
            }}
            onSkip={() => {
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: merchantServiceInfo,
                packages: merchantPackages,
                pricing: merchantServicePricing,
              })
              setScreen('providerServiceReview')
            }}
          />
        )
      case 'providerAvailability':
        return (
          <AvailabilityCalendarScreen
            initialEntries={merchantAvailability}
            isSaving={isSavingAvailability}
            onBack={() => setScreen('providerProfile')}
            onOpenAccount={() => setScreen('providerProfile')}
            onSave={async (value) => {
              setIsSavingAvailability(true)
              const result = await saveAvailabilityCalendar(value)
              setIsSavingAvailability(false)
              if (result.ok) setMerchantAvailability(value.entries)
            }}
          />
        )
      case 'providerBookingRequests':
        return (
          <BookingRequestScreen
            initialStatus={merchantRequestStatus}
            requests={merchantRequests}
            onAccept={(request) => {
              void saveBookingDecision({
                decision: 'accepted',
                providerNote: '',
                request,
              }).then(() => refreshLiveData())
              setMerchantRequestStatus('confirmed')
            }}
            onBack={() => setScreen('providerHome')}
            onDecline={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingDecline')
            }}
            onSelectNavigationTab={(tab) => {
              if (tab === 'events') setScreen('providerHome')
              if (tab === 'bookings') setScreen('providerBookingRequests')
              if (tab === 'budget') setScreen('providerPayouts')
              if (tab === 'chat') setScreen('messages')
            }}
            onSelectMerchantTab={openMerchantTab}
            onSelectRequest={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingRequestDetails')
            }}
            onStatusChange={setMerchantRequestStatus}
          />
        )
      case 'providerBookingRequestDetails':
        return (
          <BookingRequestDetailsScreen
            request={selectedMerchantRequest}
            onAccept={handleBookingDecision}
            onBack={() => setScreen('providerBookingRequests')}
            onDecline={(value) => {
              setSelectedMerchantRequest(value.request)
              setScreen('providerBookingDecline')
            }}
            onMessageClient={() => setScreen('messages')}
          />
        )
      case 'providerBookingDecline':
        return (
          <BookingRequestDeclineScreen
            request={selectedMerchantRequest}
            onBack={() => setScreen('providerBookingRequestDetails')}
            onCancel={() => setScreen('providerBookingRequests')}
            onConfirmDecline={handleBookingDecision}
          />
        )
      case 'providerBookingDetails':
        return (
          <MerchantBookingDetailScreen
            request={selectedMerchantRequest}
            onAccept={(request) => {
              void saveBookingDecision({
                decision: 'accepted',
                providerNote: '',
                request: { ...request, status: 'confirmed' },
              })
              setScreen('providerBookingRequests')
            }}
            onBack={() => setScreen('providerBookingRequests')}
            onDecline={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingDecline')
            }}
            onEmailClient={() => setScreen('messages')}
          />
        )
      case 'providerReviews':
        return (
          <ReviewPerformanceScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAccount={() => setScreen('providerProfile')}
            onReplyToReview={() => setScreen('messages')}
            onSelectReview={() => setScreen('providerReviews')}
          />
        )
      case 'providerProfile':
        return (
          <MerchantProfileScreen
            profile={{ businessName: userName }}
            onBack={() => setScreen('providerHome')}
            onEditProfile={() => setScreen('merchantSignup')}
            onOpenNotifications={() => setScreen('providerNotifications')}
            onSelectAction={handleMerchantAction}
            onSelectTab={openMerchantTab}
            onViewPublicProfile={() => setScreen('providerServices')}
          />
        )
      case 'providerOperatingHours':
        return (
          <OperatingHoursScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAvailabilityCalendar={() => setScreen('providerAvailability')}
            onSave={(value) => {
              void saveOperatingHours(value)
              setScreen('providerProfile')
            }}
          />
        )
      case 'providerPayouts':
        return (
          <PayoutEarningsScreen
            onBack={() => setScreen('providerProfile')}
            onManagePayoutAccount={() => setScreen('providerProfile')}
            onRequestPayout={(amount) => void requestMerchantPayout(amount)}
            onSelectTransaction={(transaction) => {
              setSelectedMerchantTransaction(transaction)
              setScreen('providerTransactionDetails')
            }}
          />
        )
      case 'providerTransactionDetails':
        return (
          <TransactionDetailsScreen
            transaction={selectedMerchantTransaction}
            onBack={() => setScreen('providerPayouts')}
            onContactSupport={(transaction) =>
              void saveMerchantTransactionNote(transaction, 'contact_support')
            }
            onDownloadReceipt={(transaction) =>
              void saveMerchantTransactionNote(transaction, 'download_receipt')
            }
            onOpenRelatedRecord={() => setScreen('providerBookingRequests')}
          />
        )
      case 'providerChangePassword':
        return (
          <ChangePasswordScreen
            onBack={() => setScreen('providerProfile')}
            onChangePassword={(value) => void changeMerchantPassword(value)}
            onDone={() => setScreen('providerProfile')}
            onForgotPassword={() => setScreen('forgotPassword')}
          />
        )
      case 'providerNotifications':
        return (
          <NotificationScreen
            onBack={() => setScreen('providerProfile')}
            onMarkAllRead={(ids) => void markMerchantNotificationsRead(ids)}
            onMarkRead={(notification) => void markMerchantNotificationRead(notification)}
            onPreferencesChange={(preferences) =>
              void saveNotificationPreferences(preferences)
            }
            onSelectNotification={(notification) => {
              if (notification.category === 'booking') setScreen('providerBookingRequests')
              if (notification.category === 'payment') setScreen('providerPayouts')
              if (notification.category === 'message') setScreen('messages')
              if (notification.category === 'review') setScreen('providerReviews')
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
              void savePlanningPayment(value, payableItems).then(() => refreshLiveData())
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
            onSubmit={(value) => {
              void saveClientReview(value).then(() => refreshLiveData())
              setScreen('bookings')
            }}
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
        {toastMessage ? (
          <View pointerEvents="none" style={styles.toastOverlay}>
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  draftButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  draftChoiceCard: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E3E2E2',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  draftChoiceCopy: {
    color: '#5D5F5F',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  draftChoiceScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  draftChoiceTitle: {
    color: '#1B1C1C',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  draftPrimaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#6B1E2E',
    paddingHorizontal: 18,
  },
  draftPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  draftSecondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6B1E2E',
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  draftSecondaryText: {
    color: '#6B1E2E',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  homeContainer: {
    backgroundColor: '#F9F9F9',
  },
  toast: {
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#1B1C1C',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  toastOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 92,
    left: 0,
    zIndex: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
})
