import React from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

import clientSignupVideo from '../images/ClientSignupMP4.mp4'
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
import { ClientBottomNavigation } from './components/ClientBottomNavigation'
import { ClientHomeScreen, ClientHomeTab } from './screens/03-ClientHome'
import { ClientConversation, MessagesScreen } from './screens/03.1-Messages'
import { ChatThreadScreen } from './screens/03.2-ChatThread'
import { MerchantHomeScreen, MerchantHomeTab } from './screens/16-MerchantHome'
import {
  ServiceInformationValue,
  Step1ServiceListingScreen,
} from './screens/17-Step1ServiceListing'
import { ServicePricingValue, Step2PricingScreen } from './screens/17.1-Step2Pricing'
import {
  ServicePackageValue,
  Step2AddPackageScreen,
} from './screens/17.1.1-Step2AddPackage'
import { Step3ReviewListingsScreen } from './screens/17.2-Step3ReviewListings'
import { AvailabilityCalendarScreen } from './screens/18-AvailabilityCalendar'
import {
  BookingRequestNavigationTab,
  BookingRequestScreen,
  MerchantBookingRequest,
} from './screens/19-BookingRequest'
import { BookingRequestDetailsScreen } from './screens/19.1-BookingRequest'
import { BookingRequestDeclineScreen } from './screens/19.2-BookingRequest(Deciline)'
import { MerchantBookingDetailScreen } from './screens/20-BookingDetail'
import { ReviewPerformanceScreen } from './screens/21-ReviewPerformance'
import { MerchantProfileAction, MerchantProfileScreen } from './screens/22-MerchantProfile'
import { OperatingHoursScreen } from './screens/22.1-OperatingHours'
import { PayoutEarningsScreen, PayoutTransaction } from './screens/22.2-PayoutEarnings'
import { TransactionDetailsScreen } from './screens/22.3-TransactionDetails'
import { ChangePasswordScreen } from './screens/22.4-ChangePassword'
import { MerchantNotification, NotificationScreen } from './screens/22.5-Notification'
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
import { CoordinatorDetailsScreen } from './screens/06.1-CoordinatorDetails'
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
  | 'clientSignupIntro'
  | 'clientSignup'
  | 'merchantSignup'
  | 'verification'
  | 'pendingApproval'
  | 'rejectedApplication'
  | 'clientHome'
  | 'eventCreation'
  | 'providerHome'
  | 'providerServices'
  | 'providerServicePricing'
  | 'providerAddPackage'
  | 'providerServiceReview'
  | 'providerAvailability'
  | 'providerBookingRequests'
  | 'providerBookingRequestDetails'
  | 'providerBookingDecline'
  | 'providerBookingDetail'
  | 'providerReviews'
  | 'providerProfile'
  | 'providerOperatingHours'
  | 'providerPayouts'
  | 'providerTransactionDetails'
  | 'providerChangePassword'
  | 'coordinatorHome'
  | 'adminHome'
  | 'superadminHome'
  | 'budgetAllocation'
  | 'budgetTracker'
  | 'categoryBrowse'
  | 'coordinatorDetails'
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
  | 'chatThread'
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

interface ClientSignupIntroScreenProps {
  onComplete: () => void
}

const ClientSignupIntroScreen: React.FC<ClientSignupIntroScreenProps> = ({ onComplete }) => {
  const player = useVideoPlayer(clientSignupVideo, (videoPlayer) => {
    videoPlayer.loop = false
    videoPlayer.muted = true
    videoPlayer.play()
  })
  const entranceAnimation = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceAnimation, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start()
  }, [entranceAnimation])

  React.useEffect(() => {
    const subscription = player.addListener('playToEnd', onComplete)
    return () => subscription.remove()
  }, [onComplete, player])

  return (
    <Animated.View
      style={[
        styles.clientSignupIntroFrame,
        {
          opacity: entranceAnimation,
          transform: [
            {
              scale: entranceAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              }),
            },
          ],
        },
      ]}
    >
      <VideoView
        contentFit="cover"
        nativeControls={false}
        player={player}
        style={styles.clientSignupIntroVideo}
      />
    </Animated.View>
  )
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })
  const { height, width } = useWindowDimensions()
  const [screen, setScreen] = React.useState<AppScreen>('onboarding')
  const [isClientNavigationVisible, setIsClientNavigationVisible] = React.useState(true)
  const roleSelectionEntrance = React.useRef(new Animated.Value(0)).current
  const signupEntrance = React.useRef(new Animated.Value(0)).current
  const eventCreationEntrance = React.useRef(new Animated.Value(0)).current
  const budgetAllocationEntrance = React.useRef(new Animated.Value(0)).current
  const budgetTrackerEntrance = React.useRef(new Animated.Value(0)).current
  const eventCreationExit = React.useRef(new Animated.Value(1)).current
  const eventCreationExitTranslateY = React.useRef(new Animated.Value(0)).current
  const clientHomePop = React.useRef(new Animated.Value(1)).current
  const [isEventCreationExiting, setIsEventCreationExiting] = React.useState(false)
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
  const [selectedConversation, setSelectedConversation] =
    React.useState<ClientConversation>()
  const [serviceInformation, setServiceInformation] =
    React.useState<ServiceInformationValue>()
  const [servicePricing, setServicePricing] = React.useState<ServicePricingValue>()
  const [servicePackages, setServicePackages] = React.useState<ServicePackageValue[]>([])
  const [selectedMerchantRequest, setSelectedMerchantRequest] =
    React.useState<MerchantBookingRequest>()
  const [selectedPayoutTransaction, setSelectedPayoutTransaction] =
    React.useState<PayoutTransaction>()
  const [catalogServices, setCatalogServices] =
    React.useState<CatalogService[]>(mockCatalogServices)
  const [selectedCategory, setSelectedCategory] = React.useState('catering')
  const [currentServiceId, setCurrentServiceId] = React.useState(mockCatalogServices[0].id)
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [totalBudget, setTotalBudget] = React.useState(DEFAULT_BUDGET)
  const [eventDetails, setEventDetails] =
    React.useState<EventCreationValue>(DEFAULT_EVENT)
  const [lastPayment, setLastPayment] = React.useState<PaymentValue>()

  React.useEffect(() => {
    setIsClientNavigationVisible(true)
  }, [screen])

  const openRoleSelectionFromOnboarding = () => {
    roleSelectionEntrance.setValue(width)
    setScreen('roleSelection')
    Animated.timing(roleSelectionEntrance, {
      toValue: 0,
      duration: 360,
      useNativeDriver: true,
    }).start()
  }

  const openRoleSelectionFromSignup = () => {
    roleSelectionEntrance.setValue(-width)
    setScreen('roleSelection')
    Animated.timing(roleSelectionEntrance, {
      toValue: 0,
      duration: 360,
      useNativeDriver: true,
    }).start()
  }

  const openPlanningHub = () => {
    budgetTrackerEntrance.setValue(width)
    setScreen('budgetTracker')
    Animated.timing(budgetTrackerEntrance, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }
  const openSelectedPlan = () => setScreen('selectedSummary')
  const openEventCreation = () => {
    eventCreationEntrance.setValue(width)
    eventCreationExit.setValue(1)
    clientHomePop.setValue(1)
    setIsEventCreationExiting(false)
    setScreen('eventCreation')
    Animated.timing(eventCreationEntrance, {
      toValue: 0,
      duration: 360,
      useNativeDriver: true,
    }).start()
  }
  const openEventCreationFromBudget = () => {
    eventCreationEntrance.setValue(-width)
    eventCreationExit.setValue(1)
    clientHomePop.setValue(1)
    setIsEventCreationExiting(false)
    setScreen('eventCreation')
    Animated.timing(eventCreationEntrance, {
      toValue: 0,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }
  const closeEventCreation = () => {
    clientHomePop.setValue(0.92)
    eventCreationExitTranslateY.setValue(0)
    setIsEventCreationExiting(true)
  }

  React.useEffect(() => {
    if (!isEventCreationExiting) {
      return undefined
    }

    const exitAnimation = Animated.parallel([
      Animated.timing(eventCreationExitTranslateY, {
        toValue: height,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(clientHomePop, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])

    exitAnimation.start(() => {
      setScreen('clientHome')
      setIsEventCreationExiting(false)
      eventCreationEntrance.setValue(0)
      eventCreationExit.setValue(1)
      eventCreationExitTranslateY.setValue(0)
      clientHomePop.setValue(1)
    })

    return () => exitAnimation.stop()
  }, [clientHomePop, eventCreationEntrance, eventCreationExit, eventCreationExitTranslateY, height, isEventCreationExiting])
  const openClientTab = (tab: ClientHomeTab) => {
    setHomeReturnScreen('clientHome')
    if (tab === 'home') setScreen('clientHome')
    if (tab === 'explore') setScreen('budgetTracker')
    if (tab === 'bookings') setScreen('bookings')
    if (tab === 'messages') setScreen('messages')
    if (tab === 'profile') setScreen('selectedSummary')
  }
  const openMerchantTab = (tab: MerchantHomeTab) => {
    setHomeReturnScreen('providerHome')
    if (tab === 'home') setScreen('providerHome')
    if (tab === 'services') setScreen('providerServices')
    if (tab === 'bookings') setScreen('providerBookingRequests')
    if (tab === 'messages') setScreen('messages')
    if (tab === 'profile') setScreen('providerProfile')
  }
  const openMessageTab = (tab: ClientHomeTab | MerchantHomeTab) => {
    if (homeReturnScreen === 'providerHome') {
      openMerchantTab(tab === 'explore' ? 'services' : tab)
      return
    }

    openClientTab(tab === 'services' ? 'explore' : tab)
  }
  const openBookingRequestTab = (tab: BookingRequestNavigationTab) => {
    if (tab === 'events') setScreen('providerHome')
    if (tab === 'bookings') setScreen('providerBookingRequests')
    if (tab === 'budget') setScreen('providerPayouts')
    if (tab === 'chat') setScreen('messages')
  }
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

  if (!fontsLoaded) {
    return null
  }

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
    if (role === 'client') {
      setScreen('clientSignupIntro')
      return
    }

    signupEntrance.setValue(width)
    setScreen('merchantSignup')
    Animated.timing(signupEntrance, {
      toValue: 0,
      duration: 360,
      useNativeDriver: true,
    }).start()
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

    if (nextScreen === 'budgetAllocation') {
      budgetAllocationEntrance.setValue(width)
      setScreen(nextScreen)
      Animated.timing(budgetAllocationEntrance, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
      return
    }

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

  const renderClientHome = () => (
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
      onScrollDirectionChange={(direction) => {
        setIsClientNavigationVisible(direction === 'up')
      }}
      onSeeAllVenues={openPlanningHub}
      onSelectAction={(action) => {
        if (action === 'newEvent') openEventCreation()
        if (action === 'budget') setScreen('budgetAllocation')
        if (action === 'vendors') openPlanningHub()
        if (action === 'ledger') setScreen('eventLedger')
        if (action === 'tasks') setScreen('selectedSummary')
      }}
      onSelectRecommendation={() => {
        setCurrentServiceId(mockCatalogServices[0].id)
        setScreen('serviceDetails')
      }}
      onSelectTab={openClientTab}
    />
  )

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen onComplete={openRoleSelectionFromOnboarding} />
      case 'login':
        return (
          <LoginScreen
            allowPreviewAccess
            onBack={() => setScreen(loginReturnScreen)}
            onCreateAccount={() => setScreen('roleSelection')}
            onForgotPassword={() => setScreen('forgotPassword')}
            onLogIn={() => {
              setHomeReturnScreen('clientHome')
              setScreen('clientHome')
            }}
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
          <Animated.View
            style={[
              styles.screenTransition,
              { transform: [{ translateX: roleSelectionEntrance }] },
            ]}
          >
            <RoleSelectionScreen
              entranceDelay={100}
              onLogIn={() => openLogin('roleSelection')}
              onSelectRole={handleRoleSelection}
            />
          </Animated.View>
        )
      case 'clientSignupIntro':
        return (
          <ClientSignupIntroScreen
            onComplete={() => {
              setScreen('clientSignup')
            }}
          />
        )
      case 'clientSignup':
        return (
          <SignupScreen
            onBack={openRoleSelectionFromSignup}
            onLogIn={() => openLogin('clientSignup')}
            onGoogleSignUp={handleAuthenticatedUser}
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
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: signupEntrance }] }]}
          >
            <MerchantSignupScreen
              onBack={openRoleSelectionFromSignup}
              onLogIn={() => openLogin('merchantSignup')}
              onSignUp={(email, needsVerification) => {
                if (needsVerification) {
                  openVerification(email, 'merchantSignup', 'pendingApproval')
                  return
                }

                handleAuthenticatedUser()
              }}
            />
          </Animated.View>
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
        return renderClientHome()
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
        if (isEventCreationExiting) {
          return (
            <View style={styles.transitionStack}>
              <Animated.View
                style={[styles.screenTransition, { transform: [{ scale: clientHomePop }] }]}
              >
                {renderClientHome()}
              </Animated.View>
              <Animated.View
                style={[
                  styles.screenTransitionOverlay,
                  { transform: [{ translateY: eventCreationExitTranslateY }] },
                ]}
              >
                <EventCreationScreen
                  initialValue={eventDetails}
                  onClose={closeEventCreation}
                  onContinue={(value) => handleEventContinue(value, 'budgetAllocation')}
                  onSaveExit={(value) => handleEventContinue(value, 'clientHome')}
                />
              </Animated.View>
            </View>
          )
        }
        return (
          <Animated.View
            style={[
              styles.screenTransition,
              { transform: [{ scale: eventCreationExit }, { translateX: eventCreationEntrance }] },
            ]}
          >
            <EventCreationScreen
              initialValue={eventDetails}
              onClose={closeEventCreation}
              onContinue={(value) => handleEventContinue(value, 'budgetAllocation')}
              onSaveExit={(value) => handleEventContinue(value, 'clientHome')}
            />
          </Animated.View>
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
      case 'providerServices':
        return (
          <Step1ServiceListingScreen
            category={serviceInformation?.category}
            initialValue={serviceInformation}
            onBack={() => setScreen('providerHome')}
            onNext={(value) => {
              setServiceInformation(value)
              setScreen('providerServicePricing')
            }}
          />
        )
      case 'providerServicePricing':
        return (
          <Step2PricingScreen
            initialValue={servicePricing}
            onBack={() => setScreen('providerServices')}
            onNext={(value) => {
              setServicePricing(value)
              setScreen('providerAddPackage')
            }}
          />
        )
      case 'providerAddPackage':
        return (
          <Step2AddPackageScreen
            initialValue={servicePackages[0]}
            onBack={() => setScreen('providerServicePricing')}
            onSave={(value) => {
              setServicePackages((current) => {
                const existingIndex = current.findIndex((item) => item.id === value.id)
                return existingIndex >= 0
                  ? current.map((item, index) => (index === existingIndex ? value : item))
                  : [...current, value]
              })
              setScreen('providerServiceReview')
            }}
          />
        )
      case 'providerServiceReview':
        return (
          <Step3ReviewListingsScreen
            information={serviceInformation}
            packages={servicePackages.length > 0 ? servicePackages : undefined}
            pricing={servicePricing}
            onBack={() => setScreen('providerAddPackage')}
            onEditSection={(section) => {
              if (section === 'serviceInformation') setScreen('providerServices')
              if (section === 'pricing') setScreen('providerServicePricing')
              if (section === 'packages') setScreen('providerAddPackage')
            }}
            onOpenAccount={() => setScreen('providerProfile')}
            onPublish={(value) => {
              setServiceInformation(value.information)
              setServicePricing(value.pricing)
              setServicePackages(value.packages)
              setScreen('providerProfile')
            }}
            onSaveDraft={() => setScreen('providerHome')}
          />
        )
      case 'providerAvailability':
        return (
          <AvailabilityCalendarScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAccount={() => setScreen('providerProfile')}
            onSave={() => setScreen('providerProfile')}
          />
        )
      case 'providerBookingRequests':
        return (
          <BookingRequestScreen
            onBack={() => setScreen('providerHome')}
            onDecline={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingDecline')
            }}
            onSelectNavigationTab={openBookingRequestTab}
            onSelectRequest={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingRequestDetails')
            }}
          />
        )
      case 'providerBookingRequestDetails':
        return (
          <BookingRequestDetailsScreen
            request={selectedMerchantRequest}
            onAccept={(value) => {
              setSelectedMerchantRequest({ ...value.request, status: 'confirmed' })
              setScreen('providerBookingDetail')
            }}
            onBack={() => setScreen('providerBookingRequests')}
            onDecline={(value) => {
              setSelectedMerchantRequest(value.request)
              setScreen('providerBookingDecline')
            }}
            onMessageClient={() => setScreen('chatThread')}
          />
        )
      case 'providerBookingDecline':
        return (
          <BookingRequestDeclineScreen
            request={selectedMerchantRequest}
            onBack={() => setScreen('providerBookingRequestDetails')}
            onCancel={() => setScreen('providerBookingRequestDetails')}
            onConfirmDecline={() => setScreen('providerBookingRequests')}
          />
        )
      case 'providerBookingDetail':
        return (
          <MerchantBookingDetailScreen
            request={selectedMerchantRequest}
            onAccept={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingRequests')
            }}
            onBack={() => setScreen('providerBookingRequests')}
            onDecline={(request) => {
              setSelectedMerchantRequest(request)
              setScreen('providerBookingDecline')
            }}
            onEmailClient={() => setScreen('chatThread')}
          />
        )
      case 'providerReviews':
        return (
          <ReviewPerformanceScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAccount={() => setScreen('providerProfile')}
            onReplyToReview={() => setScreen('messages')}
          />
        )
      case 'providerProfile':
        return (
          <MerchantProfileScreen
            profile={{ businessName: userName }}
            onBack={() => setScreen('providerHome')}
            onOpenNotifications={() => {
              setHomeReturnScreen('providerHome')
              setScreen('notifications')
            }}
            onSelectAction={(action) => {
              const destinations: Partial<Record<MerchantProfileAction, AppScreen>> = {
                availability: 'providerAvailability',
                notifications: 'notifications',
                operatingHours: 'providerOperatingHours',
                packages: 'providerServiceReview',
                payouts: 'providerPayouts',
                reviews: 'providerReviews',
                security: 'providerChangePassword',
                services: 'providerServices',
              }

              if (action === 'logout') {
                setScreen('roleSelection')
                return
              }

              const destination = destinations[action]
              if (destination) setScreen(destination)
            }}
            onSelectTab={openMerchantTab}
          />
        )
      case 'providerOperatingHours':
        return (
          <OperatingHoursScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAvailabilityCalendar={() => setScreen('providerAvailability')}
            onSave={() => setScreen('providerProfile')}
          />
        )
      case 'providerPayouts':
        return (
          <PayoutEarningsScreen
            onBack={() => setScreen('providerProfile')}
            onSelectTransaction={(transaction) => {
              setSelectedPayoutTransaction(transaction)
              setScreen('providerTransactionDetails')
            }}
          />
        )
      case 'providerTransactionDetails':
        return (
          <TransactionDetailsScreen
            transaction={selectedPayoutTransaction}
            onBack={() => setScreen('providerPayouts')}
            onContactSupport={() => setScreen('messages')}
            onOpenRelatedRecord={() => setScreen('providerBookingRequests')}
          />
        )
      case 'providerChangePassword':
        return (
          <ChangePasswordScreen
            onBack={() => setScreen('providerProfile')}
            onChangePassword={() => setScreen('providerProfile')}
            onDone={() => setScreen('providerProfile')}
            onForgotPassword={() => setScreen('forgotPassword')}
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
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: budgetAllocationEntrance }] }]}
          >
            <BudgetAllocationScreen
              initialBudget={totalBudget}
              onBack={openEventCreationFromBudget}
              onBudgetChange={setTotalBudget}
              onContinue={(value) => handleBudgetContinue(value.budget, value.priorities)}
              onSkip={openPlanningHub}
            />
          </Animated.View>
        )
      case 'budgetTracker':
        return (
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: budgetTrackerEntrance }] }]}
          >
            <BudgetTrackerScreen
              remainingBudget={remainingBudget}
              showBottomNavigation={false}
              onBack={() => setScreen('budgetAllocation')}
              onOpenBudget={() => setScreen('budgetAllocation')}
              onOpenMenu={openSelectedPlan}
              onOpenProfile={() => setScreen('selectedSummary')}
              onSelectCategory={(category) => {
                setSelectedCategory(category)
                setScreen('categoryBrowse')
              }}
              onSelectTab={(tab) => {
                if (tab === 'planner') setScreen('budgetAllocation')
                else if (tab === 'vendors' || tab === 'chat') {
                  openClientTab(tab === 'vendors' ? 'explore' : 'messages')
                } else openClientTab(tab)
              }}
            />
          </Animated.View>
        )
      case 'categoryBrowse':
        return (
          <CategoryBrowseScreen
            services={visibleCatalogServices}
            remainingBudget={remainingBudget}
            showBottomNavigation={false}
            onBack={openPlanningHub}
            onMore={openSelectedPlan}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onOpenSort={() => setScreen('categoryBrowse')}
            onSelectVendor={(vendorId) => {
              setCurrentServiceId(vendorId)
              const selectedVendor = catalogServices.find((service) => service.id === vendorId)
              setScreen(
                selectedVendor?.categoryName.toLowerCase().includes('coordinator')
                  ? 'coordinatorDetails'
                  : 'serviceDetails'
              )
            }}
            onSelectTab={(tab) => {
              if (tab === 'budget') setScreen('budgetAllocation')
              else if (tab === 'vendors') openClientTab('explore')
              else openClientTab(tab)
            }}
          />
        )
      case 'coordinatorDetails':
        return (
          <CoordinatorDetailsScreen
            onBack={() => setScreen('categoryBrowse')}
            onMessage={() => {
              setHomeReturnScreen('clientHome')
              setScreen('messages')
            }}
            onSelectProvider={() => setScreen('selectedSummary')}
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
            showBottomNavigation={false}
            totalEstimatedCost={selectedEstimatedTotal}
            onAddService={openPlanningHub}
            onBack={openPlanningHub}
            onOpenMenu={() => setScreen('clientHome')}
            onOpenProfile={() => setScreen('clientHome')}
            onSelectService={(service) => {
              setCurrentServiceId(service)
              const selectedService = selectedServices.find((item) => item.id === service)
              setScreen(
                selectedService?.category.toLowerCase().includes('coordinator')
                  ? 'coordinatorDetails'
                  : 'serviceDetails'
              )
            }}
            onSelectTab={(tab) => {
              if (tab === 'plan') {
                setScreen(selectedServices.length > 0 ? 'instructionModule' : 'budgetTracker')
              } else if (tab === 'guestList') setScreen('guestList')
              else if (tab === 'budget') setScreen('budgetAllocation')
              else if (tab === 'settings') setScreen('clientHome')
              else openClientTab(tab)
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
          <MessagesScreen
            navigationVariant={homeReturnScreen === 'providerHome' ? 'merchant' : 'client'}
            onOpenNotifications={() => setScreen('notifications')}
            onOpenProfile={() =>
              setScreen(
                homeReturnScreen === 'providerHome' ? 'providerProfile' : 'selectedSummary'
              )
            }
            onSelectConversation={(conversation) => {
              setSelectedConversation(conversation)
              setScreen('chatThread')
            }}
            onNewMessage={() => {
              setSelectedConversation(undefined)
              setScreen('chatThread')
            }}
            onSelectTab={openMessageTab}
            userName={userName}
          />
        )
      case 'chatThread':
        return (
          <ChatThreadScreen
            participant={
              selectedConversation
                ? {
                    avatarUrl: selectedConversation.avatarUrl,
                    id: selectedConversation.id,
                    isOnline: selectedConversation.isOnline,
                    name: selectedConversation.participantName,
                    role: selectedConversation.participantRole,
                  }
                : undefined
            }
            onBack={() => setScreen('messages')}
            onOpenBooking={() =>
              setScreen(
                homeReturnScreen === 'providerHome'
                  ? 'providerBookingRequests'
                  : 'bookings'
              )
            }
          />
        )
      case 'notifications':
        return (
          <NotificationScreen
            onBack={() => setScreen(homeReturnScreen)}
            onSelectNotification={(notification: MerchantNotification) => {
              if (notification.category === 'message') setScreen('messages')
              else if (notification.category === 'payment') {
                setScreen(
                  homeReturnScreen === 'providerHome' ? 'providerPayouts' : 'eventLedger'
                )
              } else if (notification.category === 'review') {
                setScreen(
                  homeReturnScreen === 'providerHome' ? 'providerReviews' : 'bookings'
                )
              } else if (notification.category === 'booking') {
                setScreen(
                  homeReturnScreen === 'providerHome'
                    ? 'providerBookingRequests'
                    : 'bookings'
                )
              }
            }}
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
            showBottomNavigation={false}
            onOpenMenu={() => setScreen('clientHome')}
            onOpenProfile={() => setScreen('clientHome')}
            onSelectEvent={() => setScreen('selectedSummary')}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking)
              setScreen('bookingDetails')
            }}
            onSelectTab={(tab) => {
              if (tab === 'merchants') openClientTab('explore')
              else openClientTab(tab)
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
  const clientMainTab: ClientHomeTab | null =
    screen === 'clientHome'
      ? 'home'
      : screen === 'budgetTracker' || screen === 'categoryBrowse'
        ? 'explore'
        : screen === 'bookings'
          ? 'bookings'
          : screen === 'messages' && homeReturnScreen === 'clientHome'
            ? 'messages'
            : screen === 'selectedSummary'
              ? 'profile'
              : null

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.container, isHome && styles.homeContainer]}>
        {renderScreen()}
        {width < 768 && clientMainTab ? (
          <ClientBottomNavigation
            activeTab={clientMainTab}
            isVisible={isClientNavigationVisible}
            onSelectTab={openClientTab}
          />
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
  screenTransition: {
    flex: 1,
  },
  transitionStack: {
    flex: 1,
    overflow: 'hidden',
  },
  screenTransitionOverlay: {
    ...StyleSheet.absoluteFill,
  },
  clientSignupIntroFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  clientSignupIntroVideo: {
    width: '100%',
    height: '112%',
  },
  homeContainer: {
    backgroundColor: '#F9F9F9',
  },
})
