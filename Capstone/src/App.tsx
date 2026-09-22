import React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
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
  fetchServiceReviewInsights,
  fetchServiceReviewSummaries,
  ServiceReviewInsights,
} from './lib/reviews'
import {
  CatalogCategoryId,
  CatalogService,
  catalogCategoryName,
  categoryNameToId,
  fallbackServiceCategories,
  fetchServiceCategories,
  loadClientCatalogServices,
  mockCatalogServices,
  ServiceCategoryOption,
} from './lib/catalog'
import {
  fetchClientPlanningState,
  removeServiceSelection,
  replaceServiceSelection,
  saveBudgetPlan,
  saveEventFeedback,
  saveEventDraft,
  savePlanningPayment,
  saveProviderInstructions,
  saveScheduleCheck,
  saveServiceSelection,
} from './lib/planning'
import {
  changeMerchantPassword,
  clearMerchantServiceDraft,
  completeMerchantBooking,
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
import { ClientBottomNavigation } from './components/ClientBottomNavigation'
import { ClientHomeScreen, ClientHomeTab } from './screens/03-ClientHome'
import { ClientConversation, MessagesScreen } from './screens/03.1-Messages'
import { ChatMessage, ChatThreadScreen } from './screens/03.2-ChatThread'
import { MerchantHomeScreen, MerchantHomeTab } from './screens/16-MerchantHome'
import {
  ServiceInformationValue,
  Step1ServiceListingScreen,
} from './screens/17-Step1ServiceListing'
import { ProviderServicesScreen } from './screens/17-ProviderServices'
import { ServicePricingValue, Step2PricingScreen } from './screens/17.1-Step2Pricing'
import {
  ServicePackageValue,
  Step2AddPackageScreen,
} from './screens/17.1.1-Step2AddPackage'
import {
  ReviewListingSection,
  ServiceListingReviewValue,
  Step3ReviewListingsScreen,
} from './screens/17.2-Step3ReviewListings'
import { AvailabilityCalendarScreen, AvailabilityEntry } from './screens/18-AvailabilityCalendar'
import {
  BookingRequestScreen,
  BookingRequestStatus,
  MerchantBookingRequest,
} from './screens/19-BookingRequest'
import {
  BookingRequestDecisionValue,
  BookingRequestDetailsScreen,
} from './screens/19.1-BookingRequest'
import {
  BookingRequestDeclineScreen,
  BookingRequestDeclineValue,
} from './screens/19.2-BookingRequest(Deciline)'
import { MerchantBookingDetailScreen } from './screens/20-BookingDetail'
import { ReviewPerformanceScreen } from './screens/21-ReviewPerformance'
import { MerchantProfileAction, MerchantProfileScreen } from './screens/22-MerchantProfile'
import { OperatingHoursScreen } from './screens/22.1-OperatingHours'
import { PayoutEarningsScreen, PayoutTransaction } from './screens/22.2-PayoutEarnings'
import { TransactionDetailsScreen } from './screens/22.3-TransactionDetails'
import { ChangePasswordScreen } from './screens/22.4-ChangePassword'
import { MerchantNotification, NotificationScreen } from './screens/22.5-Notification'
import { CoordinatorScreen } from './screens/23-Coordinator'
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
import {
  InstructionModuleScreen,
  InstructionModuleService,
} from './screens/10-InstructionModule'
import {
  ScheduleNoConflictScreen,
  ScheduleProvider,
} from './screens/09-Schedule(No-Conflict)'
import {
  ScheduleConflictProvider,
  ScheduleConflictScreen,
} from './screens/09-Schedule(Conflict)'
import { PlanningStepNavigationProvider } from './components/PlanningStepIndicator'
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
import { EventFeedbackScreen } from './screens/15.1-EventFeedback'
import {
  fetchConversationMessages,
  fetchConversations,
  fetchNotifications,
  markConversationRead,
  sendConversationMessage,
} from './lib/messaging'
import {
  CoordinatorDashboard,
  CoordinatorTask,
  createCoordinatorTask,
  emptyCoordinatorDashboard,
  fetchCoordinatorDashboard,
  updateCoordinatorTaskStatus,
} from './lib/coordinator'

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
  | 'coordinatorNotifications'
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
  | 'eventFeedback'
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

const DEFAULT_BUDGET = 0
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
  const [conversations, setConversations] = React.useState<ClientConversation[]>([])
  const [conversationMessages, setConversationMessages] = React.useState<ChatMessage[]>([])
  const [notifications, setNotifications] = React.useState<MerchantNotification[]>([])
  const [isSendingMessage, setIsSendingMessage] = React.useState(false)
  const [catalogServices, setCatalogServices] =
    React.useState<CatalogService[]>(mockCatalogServices)
  const [serviceCategories, setServiceCategories] =
    React.useState<ServiceCategoryOption[]>(fallbackServiceCategories)
  const [serviceBrowseMode, setServiceBrowseMode] =
    React.useState<'explore' | 'planning'>('planning')
  const [selectedCategory, setSelectedCategory] =
    React.useState<CatalogCategoryId>('catering')
  const [currentServiceId, setCurrentServiceId] = React.useState(mockCatalogServices[0]?.id ?? '')
  const [serviceReviewInsights, setServiceReviewInsights] =
    React.useState<ServiceReviewInsights>()
  const [serviceReviewInsightsLoading, setServiceReviewInsightsLoading] = React.useState(false)
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [scheduleProviders, setScheduleProviders] = React.useState<ScheduleProvider[]>([])
  const [replacementTarget, setReplacementTarget] =
    React.useState<ScheduleConflictProvider>()
  const [maxPlanningStep, setMaxPlanningStep] = React.useState(1)
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
  const [selectedPayoutTransaction, setSelectedPayoutTransaction] =
    React.useState<PayoutTransaction>()
  const [merchantRequestStatus, setMerchantRequestStatus] =
    React.useState<BookingRequestStatus>('new')
  const [isPublishingService, setIsPublishingService] = React.useState(false)
  const [isSavingServiceDraft, setIsSavingServiceDraft] = React.useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false)
  const [completingBookingId, setCompletingBookingId] = React.useState('')
  const [processingMerchantBookingId, setProcessingMerchantBookingId] = React.useState('')
  const [isFinalizingPayment, setIsFinalizingPayment] = React.useState(false)
  const [coordinatorDashboard, setCoordinatorDashboard] =
    React.useState<CoordinatorDashboard>(emptyCoordinatorDashboard())
  const [coordinatorError, setCoordinatorError] = React.useState('')
  const [isCoordinatorLoading, setIsCoordinatorLoading] = React.useState(false)
  const [isCoordinatorRefreshing, setIsCoordinatorRefreshing] = React.useState(false)
  const [busyCoordinatorTaskId, setBusyCoordinatorTaskId] = React.useState('')
  const [removingServiceId, setRemovingServiceId] = React.useState('')
  const [hasMerchantDraft, setHasMerchantDraft] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState('')

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
    setReplacementTarget(undefined)
    setServiceBrowseMode('planning')
    setScreen('categoryBrowse')
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
    if (tab === 'explore') {
      setServiceBrowseMode('explore')
      setScreen('categoryBrowse')
    }
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
  const eventDisplayName = eventDetails.eventName.trim() || 'My Event Plan'
  const eventDisplayDate = eventDetails.date.trim() || 'Date to be confirmed'
  const eventDisplayTime = eventDetails.time.trim() || 'Time to be confirmed'
  const selectedEstimatedTotal = selectedServices.reduce(
    (total, service) => total + service.price,
    0
  )
  const remainingBudget = Math.max(0, totalBudget - selectedEstimatedTotal)
  const currentService = catalogServices.find((service) => service.id === currentServiceId)
  const currentReviewServiceId = currentService?.bookingServiceId ?? currentService?.id

  React.useEffect(() => {
    let active = true

    if (screen !== 'serviceDetails' || !currentReviewServiceId) {
      setServiceReviewInsights(undefined)
      setServiceReviewInsightsLoading(false)
      return () => {
        active = false
      }
    }

    setServiceReviewInsightsLoading(true)
    void fetchServiceReviewInsights(currentReviewServiceId).then(async (insights) => {
      if (!active) return
      setServiceReviewInsights(insights)
      setServiceReviewInsightsLoading(false)

      if (!insights.analyzedCommentCount) return
      const summaries = await fetchServiceReviewSummaries(currentReviewServiceId)
      if (!active || (!summaries.positive && !summaries.negative)) return
      setServiceReviewInsights((current) =>
        current
          ? {
              ...current,
              negative: {
                ...current.negative,
                summary: summaries.negative ?? current.negative.summary,
              },
              positive: {
                ...current.positive,
                summary: summaries.positive ?? current.positive.summary,
              },
            }
          : current
      )
    })

    return () => {
      active = false
    }
  }, [currentReviewServiceId, screen])
  const categoryServices = catalogServices.filter(
    (service) => service.categoryId === selectedCategory
  )
  const visibleCatalogServices = categoryServices
  const replacementCatalogServices = replacementTarget
    ? visibleCatalogServices.filter(
        (service) => !service.isMock && service.providerName !== replacementTarget.name
      )
    : visibleCatalogServices
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
  const instructionServices: InstructionModuleService[] = selectedServices.map((selected) => {
    const catalogService = catalogServices.find((service) => service.id === selected.id)

    return {
      category: catalogService?.categoryName ?? selected.category,
      id: selected.id,
      imageLabel: selected.imageLabel,
      imageUrl: selected.imageUrl,
      name: selected.name,
      providerId: catalogService?.bookingProviderId ?? catalogService?.providerId,
      providerName: catalogService?.providerName ?? selected.name,
      serviceId: catalogService?.bookingServiceId ?? catalogService?.id,
    }
  })
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

    Promise.all([loadClientCatalogServices(), fetchServiceCategories()]).then(
      ([services, categories]) => {
      if (!isMounted) {
        return
      }

      setCatalogServices(services)
      setServiceCategories(categories)
      setCurrentServiceId((current) =>
        services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
      )
      }
    )

    return () => {
      isMounted = false
    }
  }, [])

  const refreshLiveData = React.useCallback(async () => {
    const [
      services,
      bookings,
      requests,
      merchantServiceRows,
      draft,
      conversationRows,
      notificationRows,
      planningState,
      categories,
    ] = await Promise.all([
      loadClientCatalogServices(),
      fetchClientBookings(),
      fetchMerchantBookingRequests(),
      fetchMerchantServices(),
      loadMerchantServiceDraft(),
      fetchConversations(),
      fetchNotifications(),
      fetchClientPlanningState(),
      fetchServiceCategories(),
    ])

    setCatalogServices(services)
    setClientBookings(bookings)
    setMerchantRequests(requests)
    setMerchantServices((current) =>
      merchantServiceRows.length > 0 ? merchantServiceRows : current
    )
    setConversations(conversationRows)
    setNotifications(notificationRows)
    setServiceCategories(categories)
    if (planningState.event) setEventDetails(planningState.event)
    if (planningState.totalBudget !== undefined) setTotalBudget(planningState.totalBudget)
    setSelectedServices(planningState.selectedServices)
    setLastPayment(planningState.lastPayment)
    setScheduleProviders(planningState.scheduleProviders ?? [])
    setMaxPlanningStep((current) => {
      const inferredStep = planningState.maxPlanningStep ?? 1
      return Math.max(current, inferredStep)
    })
    setCurrentServiceId((current) =>
      services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
    )

    setHasMerchantDraft(Boolean(draft))
    if (draft?.information) setMerchantServiceInfo(draft.information)
    if (draft?.pricing) setMerchantServicePricing(draft.pricing)
    if (draft?.packages) setMerchantPackages(draft.packages)
  }, [])

  const loadCoordinatorWorkspace = React.useCallback(async (refreshing = false) => {
    if (refreshing) setIsCoordinatorRefreshing(true)
    else setIsCoordinatorLoading(true)

    const result = await fetchCoordinatorDashboard()
    if (result.ok && result.data) {
      setCoordinatorDashboard(result.data)
      setCoordinatorError('')
    } else {
      setCoordinatorError(result.message ?? 'Unable to load the coordinator workspace.')
    }

    setIsCoordinatorLoading(false)
    setIsCoordinatorRefreshing(false)
  }, [])

  React.useEffect(() => {
    if (screen !== 'coordinatorHome') return
    void loadCoordinatorWorkspace()
  }, [loadCoordinatorWorkspace, screen])

  const handleCoordinatorTaskToggle = React.useCallback(
    async (task: CoordinatorTask) => {
      if (busyCoordinatorTaskId) return

      setBusyCoordinatorTaskId(task.id)
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
      const result = await updateCoordinatorTaskStatus(task.id, nextStatus)

      if (result.ok) {
        setCoordinatorDashboard((current) => ({
          events: current.events.map((event) => {
            if (event.id !== task.eventId) return event
            const completedTaskCount = Math.max(
              0,
              event.completedTaskCount + (nextStatus === 'completed' ? 1 : -1)
            )
            return { ...event, completedTaskCount }
          }),
          tasks: current.tasks.map((item) =>
            item.id === task.id ? { ...item, status: nextStatus } : item
          ),
        }))
        setToastMessage(nextStatus === 'completed' ? 'Task marked complete.' : 'Task reopened.')
      } else {
        setToastMessage(result.message ?? 'Unable to update this task.')
      }

      setBusyCoordinatorTaskId('')
    },
    [busyCoordinatorTaskId]
  )

  const handleCreateCoordinatorTask = React.useCallback(
    async (input: Parameters<typeof createCoordinatorTask>[0]) => {
      const result = await createCoordinatorTask(input)
      if (result.ok) {
        setToastMessage('Coordination task created.')
        await loadCoordinatorWorkspace(true)
      }
      return result
    },
    [loadCoordinatorWorkspace]
  )

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
        if (event === 'SIGNED_OUT') {
          setUserName('Planner')
          setMaxPlanningStep(1)
          setReplacementTarget(undefined)
          setScheduleProviders([])
          setScreen('roleSelection')
        }
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

  const handleBudgetContinue = async (budget: number, priorities: string[]) => {
    const result = await saveBudgetPlan({ budget, priorities })

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save your budget preferences.')
      return
    }

    setTotalBudget(budget)
    setMaxPlanningStep((current) => Math.max(current, 3))
    openPlanningHub()
  }

  const handleEventContinue = async (value: EventCreationValue, nextScreen: AppScreen) => {
    setEventDetails(value)
    setScheduleProviders([])

    const result = await saveEventDraft(value)
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save your event details.')
      return
    }

    if (nextScreen === 'budgetAllocation') {
      setMaxPlanningStep((current) => Math.min(4, Math.max(current, 2)))
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

  const runScheduleCheck = async () => {
    const scheduleResult = await saveScheduleCheck()

    if (!scheduleResult.ok) {
      setToastMessage(scheduleResult.message ?? 'Unable to check provider availability.')
      return false
    }

    setScheduleProviders(scheduleResult.providers ?? [])
    const hasConflict = scheduleResult.status === 'conflict'
    setMaxPlanningStep((current) =>
      hasConflict ? Math.min(current, 4) : Math.max(current, 5)
    )
    setScreen(hasConflict ? 'scheduleConflict' : 'scheduleNoConflict')
    return true
  }

  const handlePlanningStepPress = (step: number) => {
    if (step < 1 || step > maxPlanningStep) return

    setReplacementTarget(undefined)
    setServiceBrowseMode('planning')

    if (step === 1) setScreen('eventCreation')
    if (step === 2) setScreen('budgetAllocation')
    if (step === 3) setScreen(selectedServices.length > 0 ? 'selectedSummary' : 'categoryBrowse')
    if (step === 4) {
      if (scheduleProviders.length > 0) {
        setScreen(
          scheduleProviders.some((provider) => !provider.available)
            ? 'scheduleConflict'
            : 'scheduleNoConflict'
        )
      } else {
        setScreen('instructionModule')
      }
    }
    if (step === 5) setScreen('payment')
  }

  const handleScheduleDateChange = async (date: string) => {
    const nextEvent = { ...eventDetails, date }
    const result = await saveEventDraft(nextEvent)

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to update the event date.')
      return false
    }

    setEventDetails(nextEvent)
    setScheduleProviders([])
    return runScheduleCheck()
  }

  const handleProviderReplacement = async (vendorId: string) => {
    if (!replacementTarget) return false
    const service = catalogServices.find((item) => item.id === vendorId)
    if (!service) {
      setToastMessage('The selected provider service is no longer available.')
      return false
    }

    const result = await replaceServiceSelection({
      selectionId: replacementTarget.id,
      service,
    })

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to change the service provider.')
      return false
    }

    setReplacementTarget(undefined)
    await refreshLiveData()
    setToastMessage(`Provider changed to ${service.providerName}. Rechecking the schedule.`)
    return runScheduleCheck()
  }

  React.useEffect(() => {
    if (!toastMessage) {
      return undefined
    }

    const timeout = setTimeout(() => setToastMessage(''), 2600)
    return () => clearTimeout(timeout)
  }, [toastMessage])

  React.useEffect(() => {
    if (
      [
        'bookings',
        'categoryBrowse',
        'messages',
        'notifications',
        'providerBookingRequests',
        'providerHome',
        'providerNotifications',
        'providerServices',
      ].includes(screen)
    ) {
      void refreshLiveData()
    }
  }, [refreshLiveData, screen])

  React.useEffect(() => {
    if (!supabase) return undefined

    const client = supabase
    let active = true
    let bookingChannel: RealtimeChannel | undefined

    void client.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return

      bookingChannel = client
        .channel(`client-booking-progress-${data.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            filter: `client_id=eq.${data.user.id}`,
            schema: 'public',
            table: 'bookings',
          },
          () => {
            void refreshLiveData()
          }
        )
        .subscribe()
    })

    return () => {
      active = false
      if (bookingChannel) void client.removeChannel(bookingChannel)
    }
  }, [refreshLiveData])

  React.useEffect(() => {
    if (screen !== 'bookings' && screen !== 'bookingDetails') return undefined

    const refreshTimer = setInterval(() => {
      void refreshLiveData()
    }, 12000)

    return () => clearInterval(refreshTimer)
  }, [refreshLiveData, screen])

  React.useEffect(() => {
    setSelectedBooking((current) =>
      current
        ? clientBookings.find((booking) => booking.id === current.id) ?? current
        : current
    )
  }, [clientBookings])

  const handleAddSelection = async (value: Parameters<typeof saveServiceSelection>[0]) => {
    if (!supabase) {
      setToastMessage('Supabase is not configured. Check the app environment settings.')
      return
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      setToastMessage('Your session expired. Sign in again with your client account.')
      openLogin('roleSelection')
      return
    }

    const result = await saveServiceSelection(value)

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save the service selection.')
      return
    }

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
    setScheduleProviders([])
    setMaxPlanningStep((current) => Math.min(current, 4))

    setToastMessage('Service added. Providers are notified only after final booking.')
    await refreshLiveData()
    setScreen('selectedSummary')
  }

  const handleRemoveSelection = async (service: SelectedSummaryService) => {
    if (removingServiceId) return

    setRemovingServiceId(service.id)
    const result = await removeServiceSelection({
      serviceId: service.id,
      serviceName: service.name,
    })

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to remove this service.')
      setRemovingServiceId('')
      return
    }

    setSelectedServices((current) => current.filter((item) => item.id !== service.id))
    setScheduleProviders([])
    setMaxPlanningStep((current) =>
      Math.min(current, selectedServices.length === 1 ? 3 : 4)
    )
    setToastMessage(`${service.name} removed from your event plan.`)
    await refreshLiveData()
    setRemovingServiceId('')
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
    if (!supabase) {
      setToastMessage('Supabase is not configured. Check the app environment settings.')
      return
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      setToastMessage('Your session expired. Sign in again with your service-provider account.')
      openLogin('roleSelection')
      return
    }

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

  const handleBookingDecision = async (
    value: BookingRequestDecisionValue | BookingRequestDeclineValue
  ) => {
    if (processingMerchantBookingId) return
    setProcessingMerchantBookingId(value.request.id)
    const result = await saveBookingDecision(value)
    if (!result.ok) {
      setProcessingMerchantBookingId('')
      setToastMessage(result.message ?? 'Unable to update the booking request.')
      return
    }

    await refreshLiveData()
    const nextStatus: BookingRequestStatus = 'reason' in value || value.decision === 'declined'
      ? 'cancelled'
      : 'confirmed'
    setSelectedMerchantRequest((current) => {
      const eventRequest =
        current?.eventId && current.eventId === value.request.eventId ? current : value.request
      const services = eventRequest.services?.map((service) =>
        service.id === value.request.id ? { ...service, status: nextStatus } : service
      )
      const statuses = services?.map((service) => service.status) ?? [nextStatus]
      const eventStatus: BookingRequestStatus = statuses.some((status) => status === 'new')
        ? 'new'
        : statuses.some((status) => status === 'confirmed')
          ? 'confirmed'
          : statuses.some((status) => status === 'completed')
            ? 'completed'
            : 'cancelled'

      return { ...eventRequest, services, status: eventStatus }
    })
    setToastMessage(nextStatus === 'confirmed' ? 'Service request accepted.' : 'Service request declined.')
    setProcessingMerchantBookingId('')
    setScreen('providerBookingRequestDetails')
  }

  const handleBookingCompletion = async (request: MerchantBookingRequest) => {
    if (completingBookingId) return

    setCompletingBookingId(request.id)
    const result = await completeMerchantBooking(request.id)

    if (!result.ok) {
      setCompletingBookingId('')
      setToastMessage(result.message ?? 'Unable to mark this service as finished.')
      return
    }

    await refreshLiveData()
    setCompletingBookingId('')
    setSelectedMerchantRequest((current) => {
      const eventRequest =
        current?.eventId && current.eventId === request.eventId ? current : request
      const services = eventRequest.services?.map((service) =>
        service.id === request.id ? { ...service, status: 'completed' as const } : service
      )
      const statuses = services?.map((service) => service.status) ?? ['completed']
      const eventStatus: BookingRequestStatus = statuses.some((status) => status === 'new')
        ? 'new'
        : statuses.some((status) => status === 'confirmed')
          ? 'confirmed'
          : statuses.some((status) => status === 'completed')
            ? 'completed'
            : 'cancelled'

      return { ...eventRequest, services, status: eventStatus }
    })
    setToastMessage('Service marked finished. The client has been notified.')
    setScreen('providerBookingRequestDetails')
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
        const recommendedService = catalogServices[0] ?? mockCatalogServices[0]
        if (recommendedService?.id) {
          setCurrentServiceId(recommendedService.id)
          setScreen('serviceDetails')
        } else {
          openPlanningHub()
        }
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
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            scheduleItems={merchantRequests
              .filter((request) => request.status === 'confirmed')
              .slice(0, 4)
              .map((request) => ({
                id: request.id,
                location: request.venue || request.location || 'Venue to be confirmed',
                time: request.eventDate,
                title: request.eventName || 'Event',
              }))}
            stats={{
              activeEvents: merchantRequests.filter(
                (request) => request.status === 'confirmed'
              ).length,
              newRequests: merchantRequests.filter((request) => request.status === 'new').length,
              pendingAction: merchantRequests.filter((request) => request.status === 'new').length,
            }}
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
            onSelectScheduleItem={(item) => {
              setSelectedMerchantRequest(
                merchantRequests.find((request) => request.id === item.id)
              )
              setHomeReturnScreen('providerHome')
              setScreen('providerBookingRequestDetails')
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
            categories={serviceCategories}
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
            onBack={() => setScreen('providerHome')}
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
            details={
              selectedMerchantRequest
                ? {
                    clientNotes: selectedMerchantRequest.clientNotes ?? '',
                    eventName: selectedMerchantRequest.eventName ?? 'Event',
                    eventType: selectedMerchantRequest.eventType ?? 'Event',
                    guestCount: selectedMerchantRequest.guestCount,
                    packageInclusions: selectedMerchantRequest.packageInclusions ?? [],
                    requestedTime: selectedMerchantRequest.requestedTime ?? 'Time to be confirmed',
                    submittedAt:
                      selectedMerchantRequest.submittedAt ?? new Date().toISOString(),
                    venue: [selectedMerchantRequest.venue, selectedMerchantRequest.location]
                      .filter(Boolean)
                      .join(', ') || 'Venue to be confirmed',
                  }
                : undefined
            }
            request={selectedMerchantRequest}
            completingBookingId={completingBookingId}
            processingBookingId={processingMerchantBookingId}
            onAccept={handleBookingDecision}
            onBack={() => setScreen('providerBookingRequests')}
            onDecline={(value) => {
              setSelectedMerchantRequest(value.request)
              setScreen('providerBookingDecline')
            }}
            onMessageClient={() => setScreen('messages')}
            onMarkCompleted={(request) => void handleBookingCompletion(request)}
          />
        )
      case 'providerBookingDecline':
        return (
          <BookingRequestDeclineScreen
            request={selectedMerchantRequest}
            isSubmitting={processingMerchantBookingId === selectedMerchantRequest?.id}
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
              void handleBookingDecision({
                decision: 'accepted',
                providerNote: '',
                request: { ...request, status: 'confirmed' },
              })
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
            notifications={notifications}
            onBack={() => setScreen('providerProfile')}
            onMarkAllRead={(ids) => {
              void markMerchantNotificationsRead(ids).then(() => refreshLiveData())
            }}
            onMarkRead={(notification) => {
              void markMerchantNotificationRead(notification).then(() => refreshLiveData())
            }}
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
          <CoordinatorScreen
            busyTaskId={busyCoordinatorTaskId}
            dashboard={coordinatorDashboard}
            errorMessage={coordinatorError}
            isLoading={isCoordinatorLoading}
            isRefreshing={isCoordinatorRefreshing}
            onCreateTask={handleCreateCoordinatorTask}
            onOpenNotifications={() => setScreen('coordinatorNotifications')}
            onRefresh={() => void loadCoordinatorWorkspace(true)}
            onSignOut={() => {
              void supabase?.auth.signOut()
              setCoordinatorDashboard(emptyCoordinatorDashboard())
              setUserName('Planner')
              setScreen('roleSelection')
            }}
            onToggleTask={(task) => void handleCoordinatorTaskToggle(task)}
            unreadNotificationCount={notifications.filter((notification) => !notification.isRead).length}
            userName={userName}
          />
        )
      case 'coordinatorNotifications':
        return (
          <NotificationScreen
            notifications={notifications}
            onBack={() => setScreen('coordinatorHome')}
            onMarkAllRead={(ids) => {
              void markMerchantNotificationsRead(ids).then(() => refreshLiveData())
            }}
            onMarkRead={(notification) => {
              void markMerchantNotificationRead(notification).then(() => refreshLiveData())
            }}
            onSelectNotification={(notification) => {
              void markMerchantNotificationRead(notification).then(() => refreshLiveData())
              setScreen('coordinatorHome')
            }}
            variant="coordinator"
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
              onContinue={(value) => handleBudgetContinue(value.budget, value.priorities)}
              onSkip={() => handleBudgetContinue(0, [])}
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
                setServiceBrowseMode('planning')
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
            categories={serviceCategories}
            categoryName={catalogCategoryName(selectedCategory)}
            mode={serviceBrowseMode}
            services={
              serviceBrowseMode === 'explore'
                ? catalogServices
                : replacementTarget
                  ? replacementCatalogServices
                  : visibleCatalogServices
            }
            hasBudget={totalBudget > 0}
            selectedServiceCount={selectedServices.length}
            remainingBudget={remainingBudget}
            replacementContext={
              replacementTarget
                ? {
                    currentProviderName: replacementTarget.name,
                    serviceName: replacementTarget.serviceName ?? 'Selected service',
                  }
                : undefined
            }
            showBottomNavigation={false}
            onBack={() => {
              if (replacementTarget) {
                setReplacementTarget(undefined)
                setScreen('scheduleConflict')
              } else if (serviceBrowseMode === 'planning') setScreen('budgetAllocation')
              else setScreen('clientHome')
            }}
            onConfirmReplacement={handleProviderReplacement}
            onOpenBudget={() => setScreen('budgetAllocation')}
            onOpenSelectedServices={() => setScreen('selectedSummary')}
            onOpenSort={() => setScreen('categoryBrowse')}
            onSelectCategory={(category) => {
              if (replacementTarget) return
              setSelectedCategory(categoryNameToId(category.name))
            }}
            onSelectVendor={(vendorId) => {
              if (replacementTarget) return
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
            mode={serviceBrowseMode}
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
            mode={serviceBrowseMode}
            service={currentService}
            hasBudget={totalBudget > 0}
            remainingBudget={remainingBudget}
            onAddSelection={handleAddSelection}
            onBack={() => setScreen('categoryBrowse')}
            onBrowseMenus={() => setScreen('categoryBrowse')}
            onReadAllReviews={() => setScreen('serviceDetails')}
            reviewInsights={serviceReviewInsights}
            reviewInsightsLoading={serviceReviewInsightsLoading}
          />
        )
      case 'selectedSummary':
        return (
          <SelectedSummaryScreen
            budget={totalBudget}
            removingServiceId={removingServiceId}
            selectedServices={selectedServices}
            showBottomNavigation={false}
            totalEstimatedCost={selectedEstimatedTotal}
            onAddService={openPlanningHub}
            onBack={openPlanningHub}
            onOpenMenu={() => setScreen('clientHome')}
            onRemoveService={handleRemoveSelection}
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
                if (selectedServices.length > 0) {
                  setMaxPlanningStep((current) => Math.max(current, 4))
                  setScreen('instructionModule')
                } else {
                  setScreen('categoryBrowse')
                }
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
            services={instructionServices}
            onSaveContinue={async (value) => {
              if (!supabase) {
                setToastMessage('Supabase is not configured. Check the app environment settings.')
                return
              }

              const {
                data: { session },
              } = await supabase.auth.getSession()

              if (!session?.user) {
                setToastMessage('Please sign in to save your event instructions.')
                openLogin('roleSelection')
                return
              }

              const instructionsResult = await saveProviderInstructions(value)

              if (!instructionsResult.ok) {
                setToastMessage(
                  instructionsResult.message ?? 'Unable to save provider instructions.'
                )
                return
              }

              await runScheduleCheck()
            }}
          />
        )
      case 'scheduleConflict':
        return (
          <ScheduleConflictScreen
            eventDate={eventDetails.date}
            onBack={() => setScreen('instructionModule')}
            providers={scheduleProviders}
            onConfirmDateChange={handleScheduleDateChange}
            onChooseDifferentProvider={(provider) => {
              setReplacementTarget(provider)
              setSelectedCategory(categoryNameToId(provider.category ?? ''))
              setServiceBrowseMode('planning')
              setScreen('categoryBrowse')
            }}
            onMessageProvider={() => setScreen('messages')}
            onRecheckAvailability={runScheduleCheck}
          />
        )
      case 'scheduleNoConflict':
        return (
          <ScheduleNoConflictScreen
            providers={scheduleProviders}
            onBack={() => setScreen('instructionModule')}
            onContinueToPayment={() => {
              setMaxPlanningStep((current) => Math.max(current, 5))
              setScreen(selectedServices.length > 0 ? 'payment' : 'selectedSummary')
            }}
            onSelectProvider={() => setScreen('instructionModule')}
          />
        )
      case 'messages':
        return (
          <MessagesScreen
            conversations={conversations}
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            navigationVariant={homeReturnScreen === 'providerHome' ? 'merchant' : 'client'}
            onMarkRead={(conversation) => {
              setConversations((current) =>
                current.map((item) =>
                  item.id === conversation.id ? { ...item, unreadCount: 0 } : item
                )
              )
              void markConversationRead(conversation.id)
            }}
            onOpenNotifications={() => setScreen('notifications')}
            onOpenProfile={() =>
              setScreen(
                homeReturnScreen === 'providerHome' ? 'providerProfile' : 'selectedSummary'
              )
            }
            onSelectConversation={(conversation) => {
              setSelectedConversation(conversation)
              setConversationMessages([])
              setScreen('chatThread')
              void Promise.all([
                fetchConversationMessages(conversation.id),
                markConversationRead(conversation.id),
              ]).then(([messages]) => {
                setConversationMessages(messages)
                setConversations((current) =>
                  current.map((item) =>
                    item.id === conversation.id ? { ...item, unreadCount: 0 } : item
                  )
                )
              })
            }}
            onNewMessage={() => {
              setServiceBrowseMode('explore')
              setToastMessage('Choose a service to start a provider conversation.')
              setScreen('categoryBrowse')
            }}
            onSelectTab={openMessageTab}
            userName={userName}
          />
        )
      case 'chatThread':
        return (
          <ChatThreadScreen
            booking={
              selectedConversation?.bookingId
                ? {
                    eventDate: selectedConversation.bookingDate ?? 'Date to be confirmed',
                    id: selectedConversation.bookingId.slice(0, 8).toUpperCase(),
                    serviceName: selectedConversation.serviceName ?? 'Service booking',
                    status: selectedConversation.bookingStatus ?? 'pending',
                  }
                : null
            }
            isSending={isSendingMessage}
            messages={conversationMessages}
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
            onBack={() => {
              void refreshLiveData()
              setScreen('messages')
            }}
            onOpenBooking={() =>
              setScreen(
                homeReturnScreen === 'providerHome'
                  ? 'providerBookingRequests'
                  : 'bookings'
              )
            }
            onSend={(value) => {
              if (!selectedConversation) return

              setIsSendingMessage(true)
              void sendConversationMessage(selectedConversation.id, value.text).then((result) => {
                setIsSendingMessage(false)
                if (result.message) {
                  setConversationMessages((current) => [...current, result.message as ChatMessage])
                } else if (result.error) {
                  setToastMessage(result.error)
                }
              })
            }}
          />
        )
      case 'notifications':
        return (
          <NotificationScreen
            notifications={notifications}
            onBack={() => setScreen(homeReturnScreen)}
            onMarkAllRead={(ids) => {
              void markMerchantNotificationsRead(ids).then(() => refreshLiveData())
            }}
            onMarkRead={(notification) => {
              void markMerchantNotificationRead(notification).then(() => refreshLiveData())
            }}
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
            isProcessing={isFinalizingPayment}
            items={payableItems}
            onBack={() => setScreen('scheduleNoConflict')}
            onOpenCancellationPolicy={() => setScreen('payment')}
            onOpenTerms={() => setScreen('payment')}
            onPay={(value) => {
              if (isFinalizingPayment) return
              setIsFinalizingPayment(true)
              void savePlanningPayment(value, payableItems).then(async (result) => {
                if (!result.ok) {
                  setIsFinalizingPayment(false)
                  setToastMessage(result.message ?? 'Unable to record the payment.')
                  return
                }

                setLastPayment(value)
                await refreshLiveData()
                setIsFinalizingPayment(false)
                setToastMessage('Payment recorded. Booking requests were sent to your providers.')
                setScreen('confirmation')
              })
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
              date: selectedBooking?.date ?? eventDisplayDate,
              paymentStatus:
                selectedBooking?.paymentStatus ?? 'Pending',
              price: `PHP ${Math.round(selectedBooking?.amount ?? 0).toLocaleString('en-US')}`,
              requestedDate: selectedBooking?.createdAt
                ? new Date(selectedBooking.createdAt).toLocaleDateString('en-PH')
                : eventDisplayDate,
              time: selectedBooking?.requestedTime ?? eventDisplayTime,
            }}
            onBack={() => setScreen('bookings')}
            onCancelOrReschedule={() => setScreen('scheduleNoConflict')}
            onMessageProvider={() => setScreen('messages')}
            onSubmitReview={
              selectedBooking?.status === 'completed' && !selectedBooking.hasFeedback
                ? () => setScreen('eventFeedback')
                : undefined
            }
          />
        )
      case 'eventFeedback':
        return (
          <EventFeedbackScreen
            booking={selectedBooking}
            onBackToBookings={() => setScreen('bookings')}
            onClose={() => setScreen('bookingDetails')}
            onSubmit={async (value) => {
              const result = await saveEventFeedback(value)
              if (!result.ok) {
                setToastMessage(result.message ?? 'Unable to save your event feedback.')
                return false
              }

              await refreshLiveData()
              setSelectedBooking((current) => current ? { ...current, hasFeedback: true } : current)
              if (result.message) setToastMessage(result.message)
              return true
            }}
          />
        )
    }
  }

  const isHome =
    screen === 'clientHome' || screen === 'providerHome' || screen === 'providerServices'
  const clientMainTab: ClientHomeTab | null =
    screen === 'clientHome'
      ? 'home'
      : screen === 'categoryBrowse' && serviceBrowseMode === 'explore'
        ? 'explore'
        : screen === 'bookings'
          ? 'bookings'
          : screen === 'messages' && homeReturnScreen === 'clientHome'
            ? 'messages'
          : null

  if (!fontsLoaded) {
    return null
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.container, isHome && styles.homeContainer]}>
        <PlanningStepNavigationProvider
          maxReachableStep={maxPlanningStep}
          onStepPress={handlePlanningStepPress}
        >
          {renderScreen()}
        </PlanningStepNavigationProvider>

        {toastMessage ? (
          <View pointerEvents="none" style={styles.toastOverlay}>
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </View>
        ) : null}
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
