import React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

import { supabase } from './lib/supabase'
import { calculatePaymentBreakdown, DEFAULT_COMMISSION_RATE } from './lib/pricing'
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
  ServiceCategoryOption,
} from './lib/catalog'
import {
  assignCoordinatorToEvent,
  calculateServiceQuote,
  chooseCoordinatorPackage,
  ClientEventDraftSummary,
  closeCurrentEventDraft,
  fetchClientPlanningState,
  removeCoordinatorFromEvent,
  removeServiceSelection,
  saveBudgetPlan,
  saveEventFeedback,
  saveEventDraft,
  savePlanningPayment,
  saveProviderInstructions,
  saveServiceSelection,
  setCategoryBudgetAllocation,
  setCoordinatorPreference,
} from './lib/planning'
import {
  cancelClientEventBookings,
  changeMerchantPassword,
  clearMerchantServiceDraft,
  completeMerchantBooking,
  deleteMerchantPackageListing,
  deleteMerchantServiceListing,
  emptyMerchantPayoutDashboard,
  fetchClientBookings,
  fetchMerchantBookingRequests,
  fetchMerchantPayoutDashboard,
  fetchMerchantServices,
  loadMerchantServiceDraft,
  loadMerchantServiceForEditing,
  MerchantPackageListing,
  MerchantServiceListing,
  markMerchantNotificationRead,
  markMerchantNotificationsRead,
  requestMerchantPayout,
  rescheduleClientEventBookings,
  saveAvailabilityCalendar,
  saveBookingDecision,
  saveMerchantServiceDraft,
  saveMerchantServiceListing,
  saveMerchantComposedPackage,
  saveMerchantPayoutAccount,
  saveNotificationPreferences,
  saveOperatingHours,
  setMerchantServiceAvailability,
} from './lib/merchant'
import { colors } from './theme/tokens'
import { ClientBottomNavigation } from './components/ClientBottomNavigation'
import { MerchantBottomNavigation } from './components/MerchantBottomNavigation'
import { NonBlockingActivityBar, ScreenMotionFrame } from './components/MotionFeedback'
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
  PackageServiceOption,
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
import { AccountProfileScreen } from './screens/24-AccountProfile'
import { SupportScreen } from './screens/25-Support'
import { OperatingHoursScreen } from './screens/22.1-OperatingHours'
import {
  PayoutAccountInput,
  PayoutEarningsPeriod,
  PayoutEarningsScreen,
  PayoutTransaction,
} from './screens/22.2-PayoutEarnings'
import { TransactionDetailsScreen } from './screens/22.3-TransactionDetails'
import { ChangePasswordScreen } from './screens/22.4-ChangePassword'
import { MerchantNotification, NotificationScreen } from './screens/22.5-Notification'
import { CoordinatorScreen } from './screens/23-Coordinator'
import { CoordinatorRemittanceDetailsScreen } from './screens/23.1-CoordinatorRemittanceDetails'
import { CoordinatorServiceProfileScreen } from './screens/23.2-CoordinatorServiceProfile'
import { CoordinatorPackagesScreen } from './screens/23.3-CoordinatorPackages'
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
import type {
  BudgetAllocationValue,
  BudgetPriority,
  CategoryBudgetAllocation,
} from './screens/05-BudgetAllocation'
import { CoordinatorChoiceScreen } from './screens/05.1-CoordinatorChoice'
import {
  EventCreationScreen,
  EventCreationValue,
} from './screens/04-EventCreation'
import { BudgetTrackerScreen } from './screens/04.1-BudgetTracker'
import { CategoryBrowseScreen } from './screens/06-CategoryBrowse'
import { CoordinatorDetailsScreen } from './screens/06.1-CoordinatorDetails'
import { ServiceDetailsScreen } from './screens/08-ServiceDetails'
import {
  emptyCategoryDetails,
  getCateringPricingOptions,
  isLegacyCategoryDetails,
  normalizeCategoryDetails,
  validateCategoryDetails,
} from './lib/service-category-details'
import type { AssignedCoordinatorSummary, SelectedSummaryService } from './screens/07-SelectedSummary'
import { RoleHomePlaceholderScreen } from './screens/RoleHomePlaceholder'
import {
  InstructionModuleScreen,
  InstructionModuleService,
} from './screens/10-InstructionModule'
import { PlanningStepNavigationProvider } from './components/PlanningStepIndicator'
import { PlanningSwipeContainer } from './components/PlanningSwipeContainer'
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
  mapNotificationRecord,
  markConversationRead,
  openCoordinatorProviderConversation,
  sendConversationMessage,
} from './lib/messaging'
import {
  Notifications,
  readNotificationRouteData,
  registerCurrentDeviceForPush,
  revokeCurrentDevicePushToken,
  setApplicationBadgeFromUnreadCount,
} from './lib/notifications'
import {
  CoordinatorBookedService,
  CoordinatorDashboard,
  CoordinatorEvent,
  CoordinatorInvitation,
  CoordinatorRemittanceDetails,
  CoordinatorTask,
  createCoordinatorTask,
  emptyCoordinatorDashboard,
  emptyCoordinatorRemittanceDetails,
  fetchCoordinatorDashboard,
  fetchCoordinatorRemittanceDetails,
  respondToCoordinatorInvitation,
  updateCoordinatorTaskStatus,
} from './lib/coordinator'
import {
  EditableAccountProfile,
  loadEditableAccountProfile,
  saveEditableAccountProfile,
  uploadEditableAccountPhoto,
} from './lib/profile'

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
  | 'providerStandalonePackage'
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
  | 'accountProfile'
  | 'support'
  | 'coordinatorHome'
  | 'coordinatorNotifications'
  | 'coordinatorRemittanceDetails'
  | 'coordinatorServiceProfile'
  | 'coordinatorPackages'
  | 'assistantHome'
  | 'customerServiceHome'
  | 'adminHome'
  | 'superadminHome'
  | 'budgetAllocation'
  | 'coordinatorChoice'
  | 'budgetTracker'
  | 'categoryBrowse'
  | 'coordinatorDetails'
  | 'serviceDetails'
  | 'instructionModule'
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
type VerificationNextScreen = 'clientHome' | 'pendingApproval' | 'coordinatorHome'
type AccountRole =
  | 'client'
  | 'service_provider'
  | 'event_coordinator'
  | 'assistant'
  | 'customer_service'
  | 'admin'
  | 'superadmin'

const screensWithOwnEntrance = new Set<AppScreen>([
  'onboarding',
  'roleSelection',
  'merchantSignup',
  'eventCreation',
  'budgetAllocation',
  'budgetTracker',
  'categoryBrowse',
])

const appRootScreens = new Set<AppScreen>([
  'onboarding',
  'roleSelection',
  'clientHome',
  'providerHome',
  'coordinatorHome',
  'assistantHome',
  'customerServiceHome',
  'adminHome',
  'superadminHome',
])

const fallbackBackScreen = (currentScreen: AppScreen): AppScreen => {
  if (currentScreen.startsWith('provider')) return 'providerHome'
  if (currentScreen.startsWith('coordinator')) return 'coordinatorHome'
  if (
    currentScreen === 'login'
    || currentScreen === 'forgotPassword'
    || currentScreen === 'newPassword'
    || currentScreen === 'clientSignup'
    || currentScreen === 'merchantSignup'
    || currentScreen === 'verification'
    || currentScreen === 'pendingApproval'
    || currentScreen === 'rejectedApplication'
  ) {
    return 'roleSelection'
  }
  return 'clientHome'
}

type UserMetadata = {
  business_name?: unknown
  default_role?: unknown
  email?: unknown
  full_name?: unknown
  name?: unknown
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
  categoryDetails: emptyCategoryDetails('Catering'),
  description: '',
  photos: [],
  serviceName: '',
}

const DEFAULT_SERVICE_PRICING: ServicePricingValue = {
  cateringServiceTypes: [],
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

const confirmReplacement = (title: string, message: string) => {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`))
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { onPress: () => resolve(false), style: 'cancel', text: 'Cancel' },
        { onPress: () => resolve(true), style: 'destructive', text: 'Replace' },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
}

export const App: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })
  const { height, width } = useWindowDimensions()
  const [screen, commitScreen] = React.useState<AppScreen>('onboarding')
  const [isAuthRestoring, setIsAuthRestoring] = React.useState(Boolean(supabase))
  const [authenticatedUserId, setAuthenticatedUserId] = React.useState('')
  const [isScreenTransitioning, setIsScreenTransitioning] = React.useState(false)
  const screenTransitionProgress = React.useRef(new Animated.Value(1)).current
  const screenRef = React.useRef<AppScreen>('onboarding')
  const screenHistoryRef = React.useRef<AppScreen[]>(['onboarding'])
  const navigationLockedRef = React.useRef(false)
  const screenTransitionAnimation = React.useRef<Animated.CompositeAnimation | null>(null)

  const transitionToScreen = React.useCallback((nextScreen: AppScreen) => {
    const currentScreen = screenRef.current
    if (nextScreen === currentScreen || navigationLockedRef.current) return

    navigationLockedRef.current = true
    setIsScreenTransitioning(true)
    screenTransitionAnimation.current?.stop()
    screenTransitionProgress.setValue(0)
    screenRef.current = nextScreen
    commitScreen(nextScreen)

    requestAnimationFrame(() => {
      const animation = Animated.timing(screenTransitionProgress, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      })
      screenTransitionAnimation.current = animation
      animation.start(({ finished }) => {
        if (!finished || screenRef.current !== nextScreen) return
        navigationLockedRef.current = false
        setIsScreenTransitioning(false)
      })
    })
  }, [screenTransitionProgress])

  const setScreen = React.useCallback((nextScreen: AppScreen) => {
    const currentScreen = screenRef.current
    if (nextScreen === currentScreen || navigationLockedRef.current) return

    const history = screenHistoryRef.current
    if (history[history.length - 1] !== currentScreen) history.push(currentScreen)

    // Explicit in-app Back buttons commonly target a screen already in the
    // stack. Truncate to it instead of creating A -> B -> A loops.
    const existingIndex = history.lastIndexOf(nextScreen)
    if (existingIndex >= 0) history.splice(existingIndex + 1)
    else history.push(nextScreen)

    transitionToScreen(nextScreen)
  }, [transitionToScreen])

  const goBackInApp = React.useCallback(() => {
    const currentScreen = screenRef.current

    // MULTIVENT owns Back while a root screen is visible. Returning true on
    // Android prevents the operating system from closing the application.
    if (navigationLockedRef.current || appRootScreens.has(currentScreen)) return true

    const history = screenHistoryRef.current
    if (history[history.length - 1] === currentScreen) history.pop()
    const previousScreen = history[history.length - 1] ?? fallbackBackScreen(currentScreen)
    if (history.length === 0) history.push(previousScreen)
    transitionToScreen(previousScreen)
    return true
  }, [transitionToScreen])

  React.useEffect(() => () => screenTransitionAnimation.current?.stop(), [])

  React.useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBackInApp)
    return () => subscription.remove()
  }, [goBackInApp])

  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined

    const guardState = { ...(window.history.state ?? {}), multiventNavigationGuard: true }
    window.history.replaceState(guardState, window.document.title)
    window.history.pushState(guardState, window.document.title)

    const handleBrowserBack = () => {
      goBackInApp()
      // Restore the same-page guard after every browser Back action so another
      // press continues through app history instead of leaving MULTIVENT.
      window.history.pushState(guardState, window.document.title)
    }

    window.addEventListener('popstate', handleBrowserBack)
    return () => window.removeEventListener('popstate', handleBrowserBack)
  }, [goBackInApp])
  const [isClientNavigationVisible, setIsClientNavigationVisible] = React.useState(true)
  const roleSelectionEntrance = React.useRef(new Animated.Value(0)).current
  const signupEntrance = React.useRef(new Animated.Value(0)).current
  const eventCreationEntrance = React.useRef(new Animated.Value(0)).current
  const budgetAllocationEntrance = React.useRef(new Animated.Value(0)).current
  const categoryBrowseEntrance = React.useRef(new Animated.Value(0)).current
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
  const [chatReturnScreen, setChatReturnScreen] = React.useState<AppScreen>('messages')
  const [conversations, setConversations] = React.useState<ClientConversation[]>([])
  const [conversationMessages, setConversationMessages] = React.useState<ChatMessage[]>([])
  const [notifications, setNotifications] = React.useState<MerchantNotification[]>([])
  const [isSendingMessage, setIsSendingMessage] = React.useState(false)
  const [catalogServices, setCatalogServices] = React.useState<CatalogService[]>([])
  const [serviceCategories, setServiceCategories] =
    React.useState<ServiceCategoryOption[]>(fallbackServiceCategories)
  const [serviceBrowseMode, setServiceBrowseMode] =
    React.useState<'explore' | 'planning'>('planning')
  const [selectedCategory, setSelectedCategory] =
    React.useState<CatalogCategoryId>('catering')
  const [currentServiceId, setCurrentServiceId] = React.useState('')
  const [serviceReviewInsights, setServiceReviewInsights] =
    React.useState<ServiceReviewInsights>()
  const [serviceReviewInsightsLoading, setServiceReviewInsightsLoading] = React.useState(false)
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [assignedCoordinator, setAssignedCoordinator] =
    React.useState<AssignedCoordinatorSummary>()
  const [coordinatorAssignmentStatus, setCoordinatorAssignmentStatus] = React.useState<
    'accepted' | 'pending' | 'awaiting_assignment' | undefined
  >()
  const [coordinatorPreference, setCoordinatorPreferenceState] = React.useState<
    'undecided' | 'skipped' | 'selected'
  >('undecided')
  const [selectedCoordinatorPackage, setSelectedCoordinatorPackage] = React.useState<{
    id: string
    name: string
    serviceSubtotal: number
  }>()
  const [busyCoordinatorChoice, setBusyCoordinatorChoice] = React.useState<'browse' | 'skip' | ''>('')
  const [assigningCoordinatorId, setAssigningCoordinatorId] = React.useState('')
  const [selectingCoordinatorPackageId, setSelectingCoordinatorPackageId] = React.useState('')
  const [maxPlanningStep, setMaxPlanningStep] = React.useState(1)
  const [clientEventDraft, setClientEventDraft] =
    React.useState<ClientEventDraftSummary>()
  const [clientBookings, setClientBookings] = React.useState<BookingItem[]>([])
  const [merchantRequests, setMerchantRequests] = React.useState<MerchantBookingRequest[]>([])
  const [merchantServices, setMerchantServices] = React.useState<MerchantServiceListing[]>([])
  const [totalBudget, setTotalBudget] = React.useState(DEFAULT_BUDGET)
  const [budgetPriorities, setBudgetPriorities] = React.useState<BudgetPriority[]>([])
  const [budgetAllocations, setBudgetAllocations] = React.useState<
    CategoryBudgetAllocation[]
  >([])
  const [coordinatorBudgetCost, setCoordinatorBudgetCost] = React.useState(0)
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
  const [merchantPayoutDashboard, setMerchantPayoutDashboard] = React.useState(
    emptyMerchantPayoutDashboard()
  )
  const [merchantPayoutPeriod, setMerchantPayoutPeriod] =
    React.useState<PayoutEarningsPeriod>('30d')
  const [merchantPayoutError, setMerchantPayoutError] = React.useState('')
  const [isMerchantPayoutLoading, setIsMerchantPayoutLoading] = React.useState(false)
  const [isMerchantPayoutRefreshing, setIsMerchantPayoutRefreshing] = React.useState(false)
  const [isRequestingMerchantPayout, setIsRequestingMerchantPayout] = React.useState(false)
  const [isSavingMerchantPayoutAccount, setIsSavingMerchantPayoutAccount] = React.useState(false)
  const [merchantRequestStatus, setMerchantRequestStatus] =
    React.useState<BookingRequestStatus>('new')
  const [isPublishingService, setIsPublishingService] = React.useState(false)
  const [isSavingServiceDraft, setIsSavingServiceDraft] = React.useState(false)
  const [isSavingStandalonePackage, setIsSavingStandalonePackage] = React.useState(false)
  const [deletingMerchantPackageId, setDeletingMerchantPackageId] = React.useState('')
  const [editingStandalonePackage, setEditingStandalonePackage] =
    React.useState<ServicePackageValue>()
  const [editingPackagePrimaryServiceId, setEditingPackagePrimaryServiceId] = React.useState('')
  const [providerListingsCollection, setProviderListingsCollection] =
    React.useState<'services' | 'packages' | 'deleted'>('services')
  const [providerPackageReturnScreen, setProviderPackageReturnScreen] =
    React.useState<'providerProfile' | 'providerServices'>('providerProfile')
  const [isSavingAvailability, setIsSavingAvailability] = React.useState(false)
  const [completingBookingId, setCompletingBookingId] = React.useState('')
  const [processingMerchantBookingId, setProcessingMerchantBookingId] = React.useState('')
  const [isFinalizingPayment, setIsFinalizingPayment] = React.useState(false)
  const [coordinatorDashboard, setCoordinatorDashboard] =
    React.useState<CoordinatorDashboard>(emptyCoordinatorDashboard())
  const [coordinatorError, setCoordinatorError] = React.useState('')
  const [isCoordinatorLoading, setIsCoordinatorLoading] = React.useState(false)
  const [isCoordinatorRefreshing, setIsCoordinatorRefreshing] = React.useState(false)
  const [coordinatorRemittanceDetails, setCoordinatorRemittanceDetails] =
    React.useState<CoordinatorRemittanceDetails>(emptyCoordinatorRemittanceDetails())
  const [coordinatorRemittanceEventId, setCoordinatorRemittanceEventId] = React.useState('')
  const [coordinatorRemittanceError, setCoordinatorRemittanceError] = React.useState('')
  const [isCoordinatorRemittanceLoading, setIsCoordinatorRemittanceLoading] = React.useState(false)
  const [isCoordinatorRemittanceRefreshing, setIsCoordinatorRemittanceRefreshing] = React.useState(false)
  const [busyCoordinatorTaskId, setBusyCoordinatorTaskId] = React.useState('')
  const [busyCoordinatorInvitationId, setBusyCoordinatorInvitationId] = React.useState('')
  const [removingServiceId, setRemovingServiceId] = React.useState('')
  const [deletingMerchantServiceId, setDeletingMerchantServiceId] = React.useState('')
  const [updatingAvailabilityServiceId, setUpdatingAvailabilityServiceId] = React.useState('')
  const [editingMerchantServiceId, setEditingMerchantServiceId] = React.useState('')
  const [hasMerchantDraft, setHasMerchantDraft] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState('')
  const [activeGuardedActionCount, setActiveGuardedActionCount] = React.useState(0)
  const guardedActionsRef = React.useRef(new Set<string>())
  const [accountProfile, setAccountProfile] = React.useState<EditableAccountProfile>()
  const [userAvatarUrl, setUserAvatarUrl] = React.useState('')
  const [accountProfileError, setAccountProfileError] = React.useState('')
  const [isLoadingAccountProfile, setIsLoadingAccountProfile] = React.useState(false)
  const [isSavingAccountProfile, setIsSavingAccountProfile] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = React.useState(false)
  const [profileReturnScreen, setProfileReturnScreen] = React.useState<AppScreen>('clientHome')

  const runOnce = React.useCallback(async <T,>(
    actionKey: string,
    action: () => Promise<T>
  ): Promise<T | undefined> => {
    if (guardedActionsRef.current.has(actionKey)) return undefined

    guardedActionsRef.current.add(actionKey)
    setActiveGuardedActionCount((current) => current + 1)
    try {
      return await action()
    } finally {
      guardedActionsRef.current.delete(actionKey)
      setActiveGuardedActionCount((current) => Math.max(0, current - 1))
    }
  }, [])

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

  const openPlanningHub = (direction?: 'forward' | 'back') => {
    setServiceBrowseMode('planning')
    const hasDirection = direction === 'forward' || direction === 'back'
    if (hasDirection) categoryBrowseEntrance.setValue(direction === 'forward' ? width : -width)
    setScreen('categoryBrowse')
    if (hasDirection) {
      Animated.timing(categoryBrowseEntrance, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }
  }
  const openSelectedPlan = openPlanningHub
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
  const openBudgetAllocationFromServices = () => {
    budgetAllocationEntrance.setValue(-width)
    setScreen('budgetAllocation')
    Animated.timing(budgetAllocationEntrance, {
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
  }, [clientHomePop, eventCreationEntrance, eventCreationExit, eventCreationExitTranslateY, height, isEventCreationExiting, setScreen])
  const refreshAccountProfile = React.useCallback(async () => {
    setIsLoadingAccountProfile(true)
    setAccountProfileError('')
    const result = await loadEditableAccountProfile()
    setIsLoadingAccountProfile(false)

    if (!result.ok || !result.profile) {
      setAccountProfileError(result.message ?? 'Unable to load your profile.')
      return undefined
    }

    setAccountProfile(result.profile)
    setUserAvatarUrl(result.profile.avatarUrl)
    return result.profile
  }, [])

  const openAccountProfile = (returnScreen: AppScreen = 'clientHome') => {
    setProfileReturnScreen(returnScreen)
    setScreen('accountProfile')
    void refreshAccountProfile()
  }

  const openProviderProfile = () => {
    setScreen('providerProfile')
    void refreshAccountProfile()
  }

  const saveAccountProfile = async (value: EditableAccountProfile) => {
    if (isSavingAccountProfile) return
    setIsSavingAccountProfile(true)
    setAccountProfileError('')
    const result = await saveEditableAccountProfile(value)
    setIsSavingAccountProfile(false)

    if (!result.ok || !result.profile) {
      setAccountProfileError(result.message ?? 'Unable to save your profile.')
      return
    }

    setAccountProfile(result.profile)
    setUserAvatarUrl(result.profile.avatarUrl)
    setUserName(
      result.profile.role === 'service_provider'
        ? result.profile.businessName
        : result.profile.fullName
    )
    setToastMessage(result.message ?? 'Profile updated successfully.')
    setScreen(profileReturnScreen)
  }

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    await revokeCurrentDevicePushToken()
    const result = supabase ? await supabase.auth.signOut() : undefined
    if (result?.error) {
      setToastMessage(result.error.message || 'Unable to log out. Please try again.')
      setIsSigningOut(false)
      return
    }

    setAccountProfile(undefined)
    setUserAvatarUrl('')
    setAccountProfileError('')
    setCoordinatorDashboard(emptyCoordinatorDashboard())
    setUserName('Planner')
    setScreen('roleSelection')
    setIsSigningOut(false)
  }

  const chooseAccountProfilePhoto = async () => {
    if (isUploadingProfilePhoto) return undefined

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      setToastMessage('Photo-library access is needed to choose a profile photo.')
      return undefined
    }

    const selection = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.82,
    })
    if (selection.canceled || !selection.assets[0]) return undefined

    setIsUploadingProfilePhoto(true)
    const asset = selection.assets[0]
    const result = await uploadEditableAccountPhoto({
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      uri: asset.uri,
    })
    setIsUploadingProfilePhoto(false)

    if (!result.ok || !result.avatarUrl) {
      setToastMessage(result.message ?? 'Unable to upload your profile photo.')
      return undefined
    }

    setAccountProfile((current) => current
      ? { ...current, avatarUrl: result.avatarUrl ?? current.avatarUrl }
      : current)
    setUserAvatarUrl(result.avatarUrl)
    setToastMessage('Profile photo updated.')
    return result.avatarUrl
  }

  const openClientTab = (tab: ClientHomeTab) => {
    setHomeReturnScreen('clientHome')
    if (tab === 'home') setScreen('clientHome')
    if (tab === 'explore') {
      setServiceBrowseMode('explore')
      setScreen('categoryBrowse')
    }
    if (tab === 'bookings') setScreen('bookings')
    if (tab === 'messages') setScreen('messages')
    if (tab === 'profile') openAccountProfile('clientHome')
  }
  const openMerchantTab = (tab: MerchantHomeTab) => {
    setHomeReturnScreen('providerHome')
    if (tab === 'home') setScreen('providerHome')
    if (tab === 'services') setScreen('providerServices')
    if (tab === 'bookings') setScreen('providerBookingRequests')
    if (tab === 'messages') setScreen('messages')
    if (tab === 'profile') openProviderProfile()
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
  ) + (assignedCoordinator?.price ?? 0)
  const remainingBudget = Math.max(0, totalBudget - selectedEstimatedTotal)
  const budgetKeyByCategory: Record<CatalogCategoryId, BudgetPriority> = {
    attire: 'gownRental',
    catering: 'catering',
    eventOrganizers: 'eventOrganizer',
    florists: 'floral',
    hosts: 'hostEmcee',
    photography: 'photoVideo',
    soundLights: 'soundLights',
    venues: 'venue',
  }
  const selectedBudgetKey = budgetKeyByCategory[selectedCategory]
  const selectedCategoryBudget = budgetAllocations.find(
    (allocation) => allocation.categoryKey === selectedBudgetKey
  )?.amount ?? 0
  const allocatedBudgetTotal = budgetAllocations.reduce(
    (sum, allocation) => sum + allocation.amount, 0
  )
  const categoryBudgetMaximum = Math.max(
    selectedCategoryBudget,
    totalBudget - allocatedBudgetTotal + selectedCategoryBudget
  )
  const categoryBudgetLocked = selectedServices.some(
    (service) => service.category.toLowerCase() === catalogCategoryName(selectedCategory).toLowerCase()
  ) || (selectedCategory === 'eventOrganizers' && Boolean(assignedCoordinator))
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
  const paymentItems: PaymentOrderItem[] = [
    ...selectedServices.map((service) => ({
      commissionAmount: service.commissionAmount,
      commissionRate: service.commissionRate,
      description: service.detail,
      id: service.id,
      name: service.name,
      price: service.price,
      providerPrice: service.providerPrice,
    })),
    ...(assignedCoordinator
      ? [{
          commissionAmount: assignedCoordinator.commissionAmount,
          commissionRate: assignedCoordinator.commissionRate,
          description: 'Event Coordination',
          id: assignedCoordinator.id,
          name: assignedCoordinator.name,
          price: assignedCoordinator.price,
          providerPrice: assignedCoordinator.providerPrice,
        }]
      : []),
  ]
  const payableItems =
    paymentItems.length > 0
      ? paymentItems
      : [
          {
            description: 'Add services first to build a real order.',
            commissionAmount: 0,
            commissionRate: DEFAULT_COMMISSION_RATE,
            id: 'empty-plan',
            name: 'No selected services yet',
            price: 0,
            providerPrice: 0,
          },
        ]
  const instructionServices: InstructionModuleService[] = [
    ...selectedServices.map((selected) => {
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
    }),
    ...(assignedCoordinator
      ? [{
          category: 'Event Organizer',
          coordinatorId: assignedCoordinator.id.replace(/^coordinator:/, ''),
          id: assignedCoordinator.id,
          imageLabel: `${assignedCoordinator.name}, Event Coordinator`,
          imageUrl: assignedCoordinator.avatarUrl,
          name: assignedCoordinator.name,
          providerName:
            assignedCoordinator.status === 'pending'
              ? 'Coordinator invitation pending'
              : 'Assigned event coordinator',
        }]
      : []),
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
    setBudgetAllocations(planningState.budgetAllocations ?? [])
    setBudgetPriorities(planningState.budgetPriorities ?? [])
    setCoordinatorBudgetCost(planningState.coordinatorBudgetCost ?? 0)
    setAssignedCoordinator(planningState.assignedCoordinator)
    setCoordinatorAssignmentStatus(planningState.coordinatorAssignmentStatus)
    setCoordinatorPreferenceState(planningState.coordinatorPreference ?? 'undecided')
    setSelectedCoordinatorPackage(planningState.coordinatorPackage)
    setClientEventDraft(planningState.draftSummary)
    setSelectedServices(planningState.selectedServices)
    setLastPayment(planningState.lastPayment)
    setMaxPlanningStep(planningState.maxPlanningStep ?? 1)
    setCurrentServiceId((current) =>
      services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
    )

    setHasMerchantDraft(Boolean(draft))
    if (draft?.information) setMerchantServiceInfo(draft.information)
    if (draft?.pricing) setMerchantServicePricing(draft.pricing)
    setMerchantPackages([])
  }, [])

  React.useEffect(() => {
    if (screen === 'clientHome') void refreshLiveData()
  }, [refreshLiveData, screen])

  const loadCoordinatorWorkspace = React.useCallback(async (
    refreshing = false,
    silent = false
  ) => {
    if (!silent) {
      if (refreshing) setIsCoordinatorRefreshing(true)
      else setIsCoordinatorLoading(true)
    }

    const result = await fetchCoordinatorDashboard()
    if (result.ok && result.data) {
      setCoordinatorDashboard(result.data)
      setCoordinatorError('')
    } else {
      setCoordinatorError(result.message ?? 'Unable to load the coordinator workspace.')
    }

    if (!silent) {
      setIsCoordinatorLoading(false)
      setIsCoordinatorRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    if (screen !== 'coordinatorHome') return
    void loadCoordinatorWorkspace()
  }, [loadCoordinatorWorkspace, screen])

  const loadCoordinatorRemittance = React.useCallback(async (
    eventId: string,
    refreshing = false
  ) => {
    if (!eventId) return
    if (refreshing) setIsCoordinatorRemittanceRefreshing(true)
    else {
      setCoordinatorRemittanceDetails(emptyCoordinatorRemittanceDetails())
      setCoordinatorRemittanceError('')
      setIsCoordinatorRemittanceLoading(true)
    }

    const result = await fetchCoordinatorRemittanceDetails(eventId)
    if (result.ok && result.data) {
      setCoordinatorRemittanceDetails(result.data)
      setCoordinatorRemittanceError('')
    } else {
      setCoordinatorRemittanceError(result.message ?? 'Unable to load the remittance breakdown.')
    }

    setIsCoordinatorRemittanceLoading(false)
    setIsCoordinatorRemittanceRefreshing(false)
  }, [])

  React.useEffect(() => {
    if (screen !== 'coordinatorRemittanceDetails' || !coordinatorRemittanceEventId) return
    void loadCoordinatorRemittance(coordinatorRemittanceEventId)
  }, [coordinatorRemittanceEventId, loadCoordinatorRemittance, screen])

  const loadMerchantPayouts = React.useCallback(async (
    period: PayoutEarningsPeriod,
    refreshing = false,
    silent = false
  ) => {
    if (!silent) {
      if (refreshing) setIsMerchantPayoutRefreshing(true)
      else setIsMerchantPayoutLoading(true)
    }

    const result = await fetchMerchantPayoutDashboard(period)
    if (result.ok && result.data) {
      setMerchantPayoutDashboard(result.data)
      setMerchantPayoutError('')
    } else {
      setMerchantPayoutError(result.message ?? 'Unable to load recorded earnings.')
    }

    if (!silent) {
      setIsMerchantPayoutLoading(false)
      setIsMerchantPayoutRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    if (screen !== 'providerPayouts') return
    void loadMerchantPayouts(merchantPayoutPeriod)
  }, [loadMerchantPayouts, merchantPayoutPeriod, screen])

  React.useEffect(() => {
    if (screen !== 'providerPayouts') return undefined
    const refreshTimer = setInterval(() => {
      void loadMerchantPayouts(merchantPayoutPeriod, false, true)
    }, 15000)
    return () => clearInterval(refreshTimer)
  }, [loadMerchantPayouts, merchantPayoutPeriod, screen])

  const handleMerchantPayoutRequest = React.useCallback(async (amount: number) => {
    if (isRequestingMerchantPayout) return
    setIsRequestingMerchantPayout(true)
    const result = await requestMerchantPayout(amount)
    setIsRequestingMerchantPayout(false)
    if (!result.ok) {
      setMerchantPayoutError(result.message ?? 'Unable to request the payout.')
      return
    }
    setToastMessage('Payout request submitted for processing.')
    await loadMerchantPayouts(merchantPayoutPeriod)
  }, [isRequestingMerchantPayout, loadMerchantPayouts, merchantPayoutPeriod])

  const handleSaveMerchantPayoutAccount = React.useCallback(async (
    value: PayoutAccountInput
  ) => {
    if (isSavingMerchantPayoutAccount) return false
    setIsSavingMerchantPayoutAccount(true)
    const result = await saveMerchantPayoutAccount(value)
    setIsSavingMerchantPayoutAccount(false)
    if (!result.ok) {
      setMerchantPayoutError(result.message ?? 'Unable to save the payout account.')
      return false
    }
    setToastMessage('Payout account saved.')
    await loadMerchantPayouts(merchantPayoutPeriod)
    return true
  }, [isSavingMerchantPayoutAccount, loadMerchantPayouts, merchantPayoutPeriod])

  React.useEffect(() => {
    if (screen !== 'coordinatorHome') return undefined

    const refreshTimer = setInterval(() => {
      void loadCoordinatorWorkspace(false, true)
    }, 12000)

    return () => clearInterval(refreshTimer)
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
          invitations: current.invitations,
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

  const handleCoordinatorInvitationResponse = React.useCallback(
    async (invitation: CoordinatorInvitation, accepted: boolean) => {
      if (busyCoordinatorInvitationId) return

      setBusyCoordinatorInvitationId(invitation.eventId)
      const result = await respondToCoordinatorInvitation(invitation.eventId, accepted)

      if (result.ok) {
        setToastMessage(
          accepted
            ? `${invitation.eventName} is now in your coordinator workspace.`
            : `Invitation for ${invitation.eventName} declined.`
        )
        await loadCoordinatorWorkspace(true)
        await refreshLiveData()
      } else {
        setToastMessage(result.message ?? 'Unable to respond to this invitation.')
      }

      setBusyCoordinatorInvitationId('')
    },
    [busyCoordinatorInvitationId, loadCoordinatorWorkspace, refreshLiveData]
  )

  const handleCoordinatorMessageProvider = React.useCallback(
    async (_event: CoordinatorEvent, service: CoordinatorBookedService) => {
      if (!service.bookingId) {
        setToastMessage('A provider conversation becomes available after this service is booked.')
        return
      }

      const result = await openCoordinatorProviderConversation(service.bookingId)
      if (!result.ok || !result.conversationId) {
        setToastMessage(result.error ?? 'Unable to open the provider conversation.')
        return
      }

      const latestConversations = await fetchConversations()
      const conversation = latestConversations.find((item) => item.id === result.conversationId)
      if (!conversation) {
        setToastMessage('The conversation was opened, but it could not be loaded yet. Pull to refresh and try again.')
        return
      }

      setConversations(latestConversations)
      setSelectedConversation(conversation)
      setConversationMessages([])
      setChatReturnScreen('coordinatorHome')
      setScreen('chatThread')
      const messages = await fetchConversationMessages(conversation.id)
      setConversationMessages(messages)
      await markConversationRead(conversation.id)
    },
    [setScreen]
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
      case 'assistant':
        setScreen('assistantHome')
        return
      case 'customer_service':
        setScreen('customerServiceHome')
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
  }, [setScreen])

  const loadProfileAndRoute = React.useCallback(
    async (userId: string, metadata: UserMetadata = {}) => {
      if (!supabase) {
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, default_role, account_status')
        .eq('id', userId)
        .maybeSingle()

      if (data?.account_status === 'suspended' || data?.account_status === 'disabled') {
        setToastMessage(
          data.account_status === 'suspended'
            ? 'This account is temporarily suspended.'
            : 'This account has been disabled.'
        )
        await supabase.auth.signOut()
        setScreen('login')
        return
      }

      const profileName = data?.full_name?.trim()
      const metadataName = getMetadataName(metadata)
      const resolvedRole = data?.default_role ?? String(metadata.default_role ?? '')

      if (profileName || metadataName) {
        setUserName(profileName || metadataName)
      }
      setUserAvatarUrl(data?.avatar_url ?? '')

      const metadataBusinessName =
        typeof metadata.business_name === 'string' ? metadata.business_name.trim() : ''

      if (resolvedRole === 'service_provider' && metadataBusinessName) {
        setUserName(metadataBusinessName)
      }

      routeForRole(resolvedRole)
    },
    [routeForRole, setScreen]
  )

  React.useEffect(() => {
    if (!supabase) {
      setIsAuthRestoring(false)
      return undefined
    }

    let isMounted = true

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!isMounted) return
        if (error || !data.session?.user) {
          setAuthenticatedUserId('')
          return
        }

        setAuthenticatedUserId(data.session.user.id)
        await loadProfileAndRoute(data.session.user.id, {
          ...data.session.user.user_metadata,
          email: data.session.user.email,
        })
        if (isMounted) void refreshLiveData()
      })
      .catch(() => {
        if (isMounted) setAuthenticatedUserId('')
      })
      .finally(() => {
        if (isMounted) setIsAuthRestoring(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        if (event === 'SIGNED_OUT') {
          setAuthenticatedUserId('')
          setIsAuthRestoring(false)
          setUserName('Planner')
          setAccountProfile(undefined)
          setUserAvatarUrl('')
          setAccountProfileError('')
          setMaxPlanningStep(1)
          setBudgetPriorities([])
          setBudgetAllocations([])
          setCoordinatorBudgetCost(0)
          setClientEventDraft(undefined)
          setAssignedCoordinator(undefined)
          setCoordinatorAssignmentStatus(undefined)
          setCoordinatorPreferenceState('undecided')
          setSelectedCoordinatorPackage(undefined)
          setAssigningCoordinatorId('')
          setScreen('roleSelection')
        }
        return
      }

      setAuthenticatedUserId(session.user.id)
      setIsAuthRestoring(false)

      if (event === 'SIGNED_IN') {
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
  }, [loadProfileAndRoute, refreshLiveData, setScreen])

  const openNotificationDestination = React.useCallback(
    (resourceType?: string, resourceId?: string) => {
      const normalizedType = resourceType?.toLowerCase() ?? ''
      if (normalizedType.includes('message') || normalizedType.includes('conversation')) {
        setScreen('messages')
        return
      }
      if (normalizedType === 'event_cash_remittance' && resourceId) {
        setCoordinatorRemittanceEventId(resourceId)
        setScreen('coordinatorRemittanceDetails')
        return
      }
      if (normalizedType.includes('payment') || normalizedType.includes('payout')) {
        setScreen(homeReturnScreen === 'providerHome' ? 'providerPayouts' : 'eventLedger')
        return
      }
      if (normalizedType.includes('review')) {
        setScreen(homeReturnScreen === 'providerHome' ? 'providerReviews' : 'bookings')
        return
      }
      if (
        normalizedType.includes('booking')
        || normalizedType.includes('event')
        || normalizedType.includes('coordinator')
      ) {
        if (screenRef.current.startsWith('coordinator')) setScreen('coordinatorHome')
        else setScreen(homeReturnScreen === 'providerHome' ? 'providerBookingRequests' : 'bookings')
        return
      }
      setScreen(
        screenRef.current.startsWith('coordinator')
          ? 'coordinatorNotifications'
          : homeReturnScreen === 'providerHome'
            ? 'providerNotifications'
            : 'notifications'
      )
    },
    [homeReturnScreen, setScreen]
  )

  React.useEffect(() => {
    if (!authenticatedUserId || Platform.OS === 'web') return undefined

    let active = true
    void registerCurrentDeviceForPush().then((result) => {
      if (!active || result.ok) return
      if (__DEV__) console.warn(`Push registration: ${result.message ?? 'not available'}`)
    })

    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void registerCurrentDeviceForPush()
    })

    return () => {
      active = false
      tokenSubscription.remove()
    }
  }, [authenticatedUserId])

  React.useEffect(() => {
    if (Platform.OS === 'web') return undefined

    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      void refreshLiveData()
    })
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const route = readNotificationRouteData(response.notification)
        openNotificationDestination(route.resourceType, route.resourceId)
        void refreshLiveData()
      }
    )

    if (authenticatedUserId && !isAuthRestoring) {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return
        const route = readNotificationRouteData(response.notification)
        openNotificationDestination(route.resourceType, route.resourceId)
        void Notifications.clearLastNotificationResponseAsync()
      })
    }

    return () => {
      receivedSubscription.remove()
      responseSubscription.remove()
    }
  }, [authenticatedUserId, isAuthRestoring, openNotificationDestination, refreshLiveData])

  React.useEffect(() => {
    if (!supabase || !authenticatedUserId) return undefined

    const client = supabase
    const notificationChannel = client
      .channel(`mobile-notifications-${authenticatedUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `user_id=eq.${authenticatedUserId}`,
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const incoming = mapNotificationRecord(payload.new as Record<string, unknown>)
          setNotifications((current) => [
            incoming,
            ...current.filter((notification) => notification.id !== incoming.id),
          ])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          filter: `user_id=eq.${authenticatedUserId}`,
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const updated = mapNotificationRecord(payload.new as Record<string, unknown>)
          setNotifications((current) =>
            current.map((notification) =>
              notification.id === updated.id ? updated : notification
            )
          )
        }
      )
      .subscribe()

    return () => {
      void client.removeChannel(notificationChannel)
    }
  }, [authenticatedUserId])

  React.useEffect(() => {
    void setApplicationBadgeFromUnreadCount(
      notifications.filter((notification) => !notification.isRead).length
    )
  }, [notifications])

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
  }, [loadProfileAndRoute, refreshLiveData, setScreen])

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
      setScreen('clientSignup')
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

  const handleBudgetContinue = async (value: BudgetAllocationValue) => {
    await runOnce('save-budget-plan', async () => {
      const result = await saveBudgetPlan(value)

      if (!result.ok) {
        setToastMessage(result.message ?? 'Unable to save your budget preferences.')
        return
      }

      setBudgetPriorities(value.priorities)
      setBudgetAllocations(value.allocations)
      setTotalBudget(value.budget)
      setMaxPlanningStep((current) => Math.max(current, 3))
      const refreshedCatalog = await loadClientCatalogServices()
      setCatalogServices(refreshedCatalog)
      setScreen('coordinatorChoice')
    })
  }

  const handleCoordinatorChoice = async (choice: 'browse' | 'skip') => {
    if (busyCoordinatorChoice) return
    setBusyCoordinatorChoice(choice)

    if (choice === 'browse') {
      setSelectedCategory('eventOrganizers')
      setServiceBrowseMode('planning')
      setBusyCoordinatorChoice('')
      openPlanningHub('forward')
      return
    }

    const result = await setCoordinatorPreference('skipped')
    setBusyCoordinatorChoice('')
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save your coordinator choice.')
      return
    }
    setCoordinatorPreferenceState('skipped')
    setSelectedCategory('catering')
    openPlanningHub('forward')
  }

  const handleEventContinue = async (value: EventCreationValue, nextScreen: AppScreen) => {
    await runOnce('save-event-details', async () => {
      setEventDetails(value)

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
    })
  }

  const handlePlanningStepPress = (step: number) => {
    if (step < 1 || step > maxPlanningStep) return

    setServiceBrowseMode('planning')

    if (step === 1) setScreen('eventCreation')
    if (step === 2) setScreen('budgetAllocation')
    if (step === 3) {
      if (
        coordinatorPreference === 'undecided'
        && !assignedCoordinator
        && selectedServices.length === 0
      ) {
        setScreen('coordinatorChoice')
      } else {
        setScreen('categoryBrowse')
      }
    }
    if (step === 4) setScreen('instructionModule')
    if (step === 5) setScreen('payment')
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

    const existingCategorySelection = selectedServices.find((service) =>
      service.category.toLowerCase() === value.service.categoryName.toLowerCase()
        && service.id !== value.service.id
    )
    if (existingCategorySelection) {
      const confirmed = await confirmReplacement(
        `Replace selected ${value.service.categoryName}?`,
        `${existingCategorySelection.name} will be replaced by ${value.service.name}.`
      )
      if (!confirmed) return
    }

    const result = await saveServiceSelection(value)

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save the service selection.')
      return
    }

    const fallbackProviderPrice = value.service.pricingUnit === 'person' && value.attendeeCount > 0
      ? value.service.providerMinPrice * value.attendeeCount
      : value.service.providerMinPrice
    const providerPrice = result.providerAmount ?? fallbackProviderPrice
    const calculatedAmount = result.calculatedAmount ?? value.estimatedTotal
    const nextSelection: SelectedSummaryService = {
      id: value.service.id,
      category: value.service.categoryName.toUpperCase(),
      commissionAmount: Math.round(
        Math.max(0, calculatedAmount - providerPrice) * 100
      ) / 100,
      commissionRate: value.service.commissionRate,
      detail: value.venueOption
        ? `${value.venueOption.name} · ${value.venueBookedHours} hours`
        : value.cateringOption
        ? `${value.cateringOption.name} · ${value.attendeeCount} Guests`
        : value.attendeeCount > 0 ? `${value.attendeeCount} Guests` : value.service.detail,
      imageLabel: value.service.imageLabel,
      imageUrl: value.service.imageUrl,
      name: value.service.name,
      price: calculatedAmount,
      providerPrice,
      status: 'Selected',
    }

    setSelectedServices((current) => {
      const existingIndex = current.findIndex((service) =>
        service.id === nextSelection.id || service.category === nextSelection.category
      )
      return existingIndex >= 0
        ? current.map((service, index) =>
            index === existingIndex ? nextSelection : service
          )
        : [...current, nextSelection]
    })
    setMaxPlanningStep((current) => Math.min(current, 4))

    setToastMessage('Service added. Providers are notified only after final booking.')
    await refreshLiveData()
    openPlanningHub()
  }

  const handleAssignCoordinator = async () => {
    if (
      !currentService?.coordinatorUserId ||
      assigningCoordinatorId ||
      assignedCoordinator?.id === currentService.id
    ) {
      return
    }

    setAssigningCoordinatorId(currentService.id)
    const result = await assignCoordinatorToEvent(currentService)
    setAssigningCoordinatorId('')

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to assign this coordinator.')
      return
    }

    setAssignedCoordinator({
      avatarUrl: currentService.imageUrl,
      commissionAmount: Math.max(0, currentService.minPrice - currentService.providerMinPrice),
      commissionRate: currentService.commissionRate,
      id: currentService.id,
      name: currentService.name,
      price: currentService.minPrice,
      providerPrice: currentService.providerMinPrice,
      status: 'pending',
    })
    setCoordinatorBudgetCost(currentService.minPrice)
    setCoordinatorPreferenceState('selected')
    setCoordinatorAssignmentStatus('pending')
    setSelectedCategory('catering')
    setToastMessage(result.message ?? `Booking request sent to ${currentService.name}.`)
    await refreshLiveData()
    openPlanningHub()
  }

  const handleRemoveCoordinator = async () => {
    if (!assignedCoordinator || assigningCoordinatorId) return
    setAssigningCoordinatorId(assignedCoordinator.id)
    const result = await removeCoordinatorFromEvent()
    setAssigningCoordinatorId('')
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to remove this coordinator booking.')
      return
    }
    setAssignedCoordinator(undefined)
    setCoordinatorBudgetCost(0)
    setCoordinatorAssignmentStatus(undefined)
    setCoordinatorPreferenceState('undecided')
    setSelectedCoordinatorPackage(undefined)
    setToastMessage('Coordinator booking removed. You can choose another or continue without one.')
  }

  const handleChooseCoordinatorPackage = async (
    packageId: string,
    cateringOptionChoices: Record<string, string>
  ) => {
    if (!currentService?.coordinatorUserId || assigningCoordinatorId || selectingCoordinatorPackageId) return
    setSelectingCoordinatorPackageId(packageId)
    let result = await chooseCoordinatorPackage(packageId, cateringOptionChoices)
    if (result.ok && result.requiresConfirmation) {
      const conflictText = (result.conflicts ?? [])
        .map((conflict) => `${conflict.currentService} → ${conflict.replacementService}`)
        .join('\n')
      const confirmed = await confirmReplacement(
        'Replace conflicting services?',
        `This package replaces one service in each listed category:\n\n${conflictText}`
      )
      if (!confirmed) {
        setSelectingCoordinatorPackageId('')
        return
      }
      result = await chooseCoordinatorPackage(packageId, cateringOptionChoices, true)
    }
    setSelectingCoordinatorPackageId('')
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to select this coordinator package.')
      return
    }
    setAssignedCoordinator({
      avatarUrl: currentService.imageUrl,
      commissionAmount: Math.max(0, currentService.minPrice - currentService.providerMinPrice),
      commissionRate: currentService.commissionRate,
      id: currentService.id,
      name: currentService.name,
      price: currentService.minPrice,
      providerPrice: currentService.providerMinPrice,
      status: 'pending',
    })
    setCoordinatorBudgetCost(currentService.minPrice)
    setCoordinatorPreferenceState('selected')
    setCoordinatorAssignmentStatus('pending')
    setSelectedCategory('catering')
    setToastMessage(result.message ?? 'Coordinator package selected.')
    await refreshLiveData()
    openPlanningHub()
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
    setMaxPlanningStep((current) =>
      Math.min(current, selectedServices.length === 1 ? 3 : 4)
    )
    setToastMessage(`${service.name} removed from your event plan.`)
    await refreshLiveData()
    setRemovingServiceId('')
  }

  const handleMerchantAction = (action: MerchantProfileAction) => {
    if (action === 'services') {
      setProviderListingsCollection('services')
      setScreen('providerServices')
    }
    if (action === 'packages') {
      setEditingStandalonePackage(undefined)
      setEditingPackagePrimaryServiceId('')
      setProviderPackageReturnScreen('providerProfile')
      setScreen('providerStandalonePackage')
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
      void handleSignOut()
    }
  }

  const saveStandaloneMerchantPackage = async (value: ServicePackageValue) => {
    if (isSavingStandalonePackage) return
    setIsSavingStandalonePackage(true)
    const result = await saveMerchantComposedPackage(value)
    setIsSavingStandalonePackage(false)

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to save this package.')
      return
    }

    await refreshLiveData()
    setToastMessage(result.message ?? 'Package submitted for review.')
    setEditingStandalonePackage(undefined)
    setEditingPackagePrimaryServiceId('')
    if (providerPackageReturnScreen === 'providerServices') {
      setProviderListingsCollection('packages')
    }
    setScreen(providerPackageReturnScreen)
  }

  const editStandaloneMerchantPackage = (item: MerchantPackageListing) => {
    setEditingStandalonePackage({
      currency: 'PHP',
      description: item.description,
      discountAmount: item.discountAmount,
      discountType: item.discountType,
      discountValue: item.discountValue,
      id: item.id,
      inclusions: item.inclusions,
      name: item.name,
      price: item.price,
      pricingMode: item.pricingMode,
      serviceIds: item.serviceIds.length > 0 ? item.serviceIds : [item.primaryServiceId],
      subtotal: item.subtotal,
      unit: item.pricingUnit,
    })
    setEditingPackagePrimaryServiceId(item.primaryServiceId)
    setProviderListingsCollection('packages')
    setProviderPackageReturnScreen('providerServices')
    setScreen('providerStandalonePackage')
  }

  const handleServiceListingSubmit = async (
    value: ServiceListingReviewValue,
    status: 'draft' | 'active'
  ) => {
    const shouldValidateCategoryDetails =
      !editingMerchantServiceId || !isLegacyCategoryDetails(value.information.categoryDetails)
    const categoryErrors = status === 'active' && shouldValidateCategoryDetails
      ? validateCategoryDetails(value.information.category, value.information.categoryDetails)
      : []

    if (categoryErrors.length > 0) {
      setToastMessage(categoryErrors[0])
      setScreen('providerServiceInfo')
      return
    }

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
      status === 'draft' && !editingMerchantServiceId
        ? await saveMerchantServiceDraft(value)
        : await saveMerchantServiceListing(value, status, editingMerchantServiceId || undefined)

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
      setEditingMerchantServiceId('')
      setToastMessage(
        status === 'active'
          ? 'Service submitted for review. Packages remain optional in the Packages tab.'
          : editingMerchantServiceId
            ? 'Service changes saved as a draft.'
            : 'Draft saved.'
      )
      setProviderListingsCollection('services')
      setScreen('providerServices')
    } else if (result.message) {
      setToastMessage(result.message)
    }
  }

  const startNewMerchantListing = () => {
    setEditingMerchantServiceId('')
    setMerchantServiceInfo(DEFAULT_SERVICE_INFORMATION)
    setMerchantServicePricing(DEFAULT_SERVICE_PRICING)
    setMerchantPackages([])
    setHasMerchantDraft(false)
    void clearMerchantServiceDraft()
    setScreen('providerServiceInfo')
  }

  const editMerchantService = async (service: MerchantServiceListing) => {
    const value = await loadMerchantServiceForEditing(service.id)
    if (!value) {
      setToastMessage('Unable to load this service for editing.')
      return
    }

    setEditingMerchantServiceId(service.id)
    setMerchantServiceInfo(value.information)
    setMerchantServicePricing(value.pricing)
    setMerchantPackages([])
    setHasMerchantDraft(false)
    setScreen('providerServiceReview')
  }

  const deleteMerchantService = async (service: MerchantServiceListing) => {
    if (deletingMerchantServiceId) return
    setDeletingMerchantServiceId(service.id)
    const result = await deleteMerchantServiceListing(service.id)
    setDeletingMerchantServiceId('')

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to delete this service.')
      return
    }

    setMerchantServices((current) => current.map((item) =>
      item.id === service.id
        ? { ...item, isAvailable: false, status: 'deleted' }
        : item
    ))
    if (editingMerchantServiceId === service.id) setEditingMerchantServiceId('')
    setProviderListingsCollection('deleted')
    setToastMessage('Service moved to Deleted. Existing booking history was preserved.')
    await refreshLiveData()
  }

  const deleteMerchantPackage = async () => {
    const packageId = editingStandalonePackage?.id
    if (!packageId || deletingMerchantPackageId) return

    setDeletingMerchantPackageId(packageId)
    const result = await deleteMerchantPackageListing(packageId)
    setDeletingMerchantPackageId('')

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to delete this package.')
      return
    }

    setEditingStandalonePackage(undefined)
    setEditingPackagePrimaryServiceId('')
    setProviderListingsCollection('deleted')
    setToastMessage('Package moved to Deleted and hidden from clients.')
    await refreshLiveData()
    setScreen('providerServices')
  }

  const updateMerchantServiceAvailability = async (
    service: MerchantServiceListing,
    isAvailable: boolean
  ) => {
    if (updatingAvailabilityServiceId) return
    setUpdatingAvailabilityServiceId(service.id)
    const result = await setMerchantServiceAvailability(service.id, isAvailable)
    setUpdatingAvailabilityServiceId('')

    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to update service availability.')
      return
    }

    setMerchantServices((current) =>
      current.map((item) => item.id === service.id ? { ...item, isAvailable } : item)
    )
    setToastMessage(
      isAvailable
        ? `${service.name} is live and bookable again.`
        : `${service.name} is now marked not available.`
    )
    await refreshLiveData()
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

  const handleClientBookingCancellation = async (reason: string) => {
    const eventId = selectedBooking?.eventId ?? selectedBooking?.id
    if (!eventId) return { ok: false, message: 'This event booking could not be identified.' }

    const result = await cancelClientEventBookings(eventId, reason)
    if (!result.ok) return result

    setToastMessage(result.message ?? 'Booking cancelled.')
    await refreshLiveData()
    setScreen('bookings')
    return result
  }

  const handleClientBookingReschedule = async (value: { date: string; time: string }) => {
    const eventId = selectedBooking?.eventId ?? selectedBooking?.id
    if (!eventId) return { ok: false, message: 'This event booking could not be identified.' }

    const result = await rescheduleClientEventBookings(eventId, value)
    if (!result.ok) return result

    setToastMessage(result.message ?? 'The booking schedule was updated.')
    await refreshLiveData()
    setScreen('bookings')
    return result
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

  const startNewClientEvent = async () => {
    if (clientEventDraft) {
      const result = await closeCurrentEventDraft()
      if (!result.ok) {
        setToastMessage(result.message ?? 'Unable to start a new event right now.')
        return false
      }
    }

    setEventDetails({ ...DEFAULT_EVENT })
    setTotalBudget(DEFAULT_BUDGET)
    setBudgetPriorities([])
    setBudgetAllocations([])
    setCoordinatorBudgetCost(0)
    setSelectedServices([])
    setAssignedCoordinator(undefined)
    setCoordinatorAssignmentStatus(undefined)
    setCoordinatorPreferenceState('undecided')
    setSelectedCoordinatorPackage(undefined)
    setLastPayment(undefined)
    setMaxPlanningStep(1)
    setClientEventDraft(undefined)
    setServiceBrowseMode('planning')
    openEventCreation()
    return true
  }

  const continueClientDraft = () => handlePlanningStepPress(Math.max(1, maxPlanningStep))

  const renderClientHome = () => (
    <ClientHomeScreen
      draftEvent={clientEventDraft}
      userAvatarUrl={userAvatarUrl}
      userName={userName}
      selectedServiceCount={selectedServices.length}
      onOpenActiveEvent={continueClientDraft}
      onStartNewEvent={startNewClientEvent}
      onOpenProfile={() => openAccountProfile('clientHome')}
      onOpenNotifications={() => {
        setHomeReturnScreen('clientHome')
        setScreen('notifications')
      }}
      onScrollDirectionChange={(direction) => {
        setIsClientNavigationVisible(direction === 'up')
      }}
      onSeeAllVenues={openPlanningHub}
      onSelectRecommendation={() => {
        const recommendedService = catalogServices[0]
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

  const standalonePackageServices: PackageServiceOption[] = merchantServices
    .filter((service) => service.basePrice > 0 && (
      service.status === 'active'
      || editingStandalonePackage?.serviceIds?.includes(service.id)
    ))
    .map((service) => ({
      categoryName: service.categoryName,
      id: service.id,
      name: service.name,
      price: service.basePrice,
      unit: service.pricingUnit,
    }))
    .sort((left, right) => (
      (left.categoryName ?? '').localeCompare(right.categoryName ?? '')
      || left.name.localeCompare(right.name)
    ))
  const currentPackageServiceId = editingMerchantServiceId || '__current_service__'
  const currentPackageService = merchantServicePricing.amount && merchantServicePricing.amount > 0
    ? [{
        categoryName: merchantServiceInfo.category,
        id: currentPackageServiceId,
        name: merchantServiceInfo.serviceName || 'Current service',
        price: merchantServicePricing.amount,
        unit: merchantServicePricing.unit ?? 'event',
      } satisfies PackageServiceOption]
    : []
  const listingPackageServices = currentPackageService.length > 0
    ? [
        ...currentPackageService,
        ...standalonePackageServices.filter((service) => service.id !== editingMerchantServiceId),
      ]
    : []
  const packageCommissionRate = catalogServices[0]?.commissionRate ?? DEFAULT_COMMISSION_RATE

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
                  isProcessing={activeGuardedActionCount > 0}
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
              isProcessing={activeGuardedActionCount > 0}
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
            showBottomNavigation={false}
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
            deletingServiceId={deletingMerchantServiceId}
            hasDraft={hasMerchantDraft}
            initialCollection={providerListingsCollection}
            showBottomNavigation={false}
            services={merchantServices}
            onAddService={() => {
              setScreen(hasMerchantDraft ? 'providerDraftChoice' : 'providerServiceInfo')
            }}
            onAddPackage={() => {
              setEditingStandalonePackage(undefined)
              setEditingPackagePrimaryServiceId('')
              setProviderListingsCollection('packages')
              setProviderPackageReturnScreen('providerServices')
              setScreen('providerStandalonePackage')
            }}
            onBack={() => setScreen('providerHome')}
            onContinueDraft={() => setScreen('providerServiceReview')}
            onDeleteService={(service) => void deleteMerchantService(service)}
            onEditPackage={editStandaloneMerchantPackage}
            onEditService={(service) => void editMerchantService(service)}
            onOpenAccount={() => setScreen('providerProfile')}
            onSelectCollection={setProviderListingsCollection}
            onSelectService={(service) => void editMerchantService(service)}
            onSetAvailability={(service, isAvailable) =>
              void updateMerchantServiceAvailability(service, isAvailable)
            }
            onSelectTab={openMerchantTab}
            updatingAvailabilityServiceId={updatingAvailabilityServiceId}
          />
        )
      case 'providerServiceReview':
        return (
          <Step3ReviewListingsScreen
            information={merchantServiceInfo}
            isPublishing={isPublishingService}
            isSavingDraft={isSavingServiceDraft}
            pricing={merchantServicePricing}
            onBack={() => setScreen('providerServicePricing')}
            onEditSection={(section: ReviewListingSection) => {
              if (section === 'serviceInformation') setScreen('providerServiceInfo')
              if (section === 'pricing') setScreen('providerServicePricing')
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
                packages: [],
                pricing: merchantServicePricing,
              })
              setScreen('providerServices')
            }}
            onNext={(value) => {
              const details = normalizeCategoryDetails(value.category, value.categoryDetails)
              const cateringOptions = getCateringPricingOptions(details)
              const cateringStartingPrice = cateringOptions.length
                ? Math.min(...cateringOptions.map((option) => option.pricePerHead))
                : undefined
              const nextPricing = details.kind === 'catering'
                ? {
                    ...merchantServicePricing,
                    amount: cateringStartingPrice,
                    model: 'fixed' as const,
                    unit: 'person' as const,
                    cateringServiceTypes: Array.isArray(details.cateringTypes)
                      ? details.cateringTypes.flatMap((item) => {
                          const normalized = String(item).toLowerCase()
                          if (normalized === 'plated') return ['plated' as const]
                          if (normalized === 'buffet') return ['buffet' as const]
                          if (normalized === 'packed meals') return ['packed' as const]
                          return []
                        })
                      : merchantServicePricing.cateringServiceTypes,
                  }
                : merchantServicePricing
              setMerchantServiceInfo(value)
              setMerchantServicePricing(nextPricing)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: value,
                packages: [],
                pricing: nextPricing,
              })
              setScreen('providerServicePricing')
            }}
          />
        )
      case 'providerServicePricing':
        return (
          <Step2PricingScreen
            categoryDetails={merchantServiceInfo.categoryDetails}
            categoryName={merchantServiceInfo.category}
            initialValue={merchantServicePricing}
            onBack={(draft) => {
              const pricing = draft ?? merchantServicePricing
              setMerchantServicePricing(pricing)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: merchantServiceInfo,
                packages: [],
                pricing,
              })
              setScreen('providerServiceInfo')
            }}
            onNext={(value) => {
              setMerchantServicePricing(value)
              setHasMerchantDraft(true)
              void saveMerchantServiceDraft({
                information: merchantServiceInfo,
                packages: [],
                pricing: value,
              })
              setScreen('providerServiceReview')
            }}
          />
        )
      case 'providerPackage':
        return (
          <Step2AddPackageScreen
            availableServices={listingPackageServices}
            commissionRate={packageCommissionRate}
            requiredServiceId={currentPackageService.length > 0 ? currentPackageServiceId : undefined}
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
      case 'providerStandalonePackage':
        return (
          <Step2AddPackageScreen
            availableServices={standalonePackageServices}
            commissionRate={packageCommissionRate}
            initialValue={editingStandalonePackage}
            isDeleting={deletingMerchantPackageId === editingStandalonePackage?.id}
            isSaving={isSavingStandalonePackage}
            mode="standalone"
            requiredServiceId={editingPackagePrimaryServiceId || undefined}
            onBack={() => {
              setEditingStandalonePackage(undefined)
              setEditingPackagePrimaryServiceId('')
              setScreen(providerPackageReturnScreen)
            }}
            onDelete={editingStandalonePackage?.id ? () => void deleteMerchantPackage() : undefined}
            onSave={(value) => void saveStandaloneMerchantPackage(value)}
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
            showBottomNavigation={false}
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
            isLoggingOut={isSigningOut}
            profile={{
              businessName: accountProfile?.businessName || userName,
              contactEmail: accountProfile?.contactEmail || '',
              contactPhone: accountProfile?.contactPhone || '',
              description: accountProfile?.businessDescription || '',
              location: accountProfile?.businessLocation || '',
            }}
            onBack={() => setScreen('providerHome')}
            onEditProfile={() => openAccountProfile('providerProfile')}
            onOpenNotifications={() => setScreen('providerNotifications')}
            onSelectAction={handleMerchantAction}
            onSelectTab={openMerchantTab}
            onViewPublicProfile={() => setScreen('providerServices')}
            showBottomNavigation={false}
          />
        )
      case 'accountProfile':
        return (
          <AccountProfileScreen
            error={accountProfileError}
            isLoading={isLoadingAccountProfile}
            isSaving={isSavingAccountProfile}
            isSigningOut={isSigningOut}
            isUploadingPhoto={isUploadingProfilePhoto}
            onBack={() => setScreen(profileReturnScreen)}
            onChoosePhoto={chooseAccountProfilePhoto}
            onOpenSupport={() => setScreen('support')}
            onSave={(value) => void saveAccountProfile(value)}
            onSignOut={() => void handleSignOut()}
            profile={accountProfile}
          />
        )
      case 'support':
        return <SupportScreen onBack={() => setScreen('accountProfile')} />
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
            earningsTrend={merchantPayoutDashboard.earningsTrend}
            errorMessage={merchantPayoutError}
            initialPeriod={merchantPayoutPeriod}
            isLoading={isMerchantPayoutLoading}
            isRefreshing={isMerchantPayoutRefreshing}
            isRequestingPayout={isRequestingMerchantPayout}
            isSavingPayoutAccount={isSavingMerchantPayoutAccount}
            onBack={() => setScreen('providerProfile')}
            onPeriodChange={setMerchantPayoutPeriod}
            onRefresh={() => void loadMerchantPayouts(merchantPayoutPeriod, true)}
            onRequestPayout={(amount) => void handleMerchantPayoutRequest(amount)}
            onSavePayoutAccount={handleSaveMerchantPayoutAccount}
            onSelectTransaction={(transaction) => {
              setSelectedPayoutTransaction(transaction)
              setScreen('providerTransactionDetails')
            }}
            paymentConfirmations={merchantPayoutDashboard.paymentConfirmations}
            payoutAccount={merchantPayoutDashboard.payoutAccount}
            summary={merchantPayoutDashboard.summary}
            transactions={merchantPayoutDashboard.transactions}
          />
        )
      case 'providerTransactionDetails':
        return (
          <TransactionDetailsScreen
            transaction={selectedPayoutTransaction}
            onBack={() => setScreen('providerPayouts')}
            onContactSupport={() => setScreen('support')}
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
            avatarUrl={userAvatarUrl}
            busyInvitationId={busyCoordinatorInvitationId}
            busyTaskId={busyCoordinatorTaskId}
            dashboard={coordinatorDashboard}
            errorMessage={coordinatorError}
            isLoading={isCoordinatorLoading}
            isRefreshing={isCoordinatorRefreshing}
            onCreateTask={handleCreateCoordinatorTask}
            onMessageProvider={(event, service) => void handleCoordinatorMessageProvider(event, service)}
            onOpenNotifications={() => setScreen('coordinatorNotifications')}
            onOpenPackages={() => setScreen('coordinatorPackages')}
            onOpenProfile={() => openAccountProfile('coordinatorHome')}
            onOpenServiceProfile={() => setScreen('coordinatorServiceProfile')}
            onRefresh={() => void loadCoordinatorWorkspace(true)}
            onRespondInvitation={(invitation, accepted) =>
              void handleCoordinatorInvitationResponse(invitation, accepted)
            }
            onSignOut={() => {
              void handleSignOut()
            }}
            onToggleTask={(task) => void handleCoordinatorTaskToggle(task)}
            unreadNotificationCount={notifications.filter((notification) => !notification.isRead).length}
            userName={userName}
          />
        )
      case 'coordinatorServiceProfile':
        return (
          <CoordinatorServiceProfileScreen
            onBack={() => setScreen('coordinatorHome')}
            onSaved={(message) => {
              setToastMessage(message)
              void refreshLiveData()
            }}
          />
        )
      case 'coordinatorPackages':
        return (
          <CoordinatorPackagesScreen
            onBack={() => setScreen('coordinatorHome')}
            onSaved={setToastMessage}
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
              if (
                notification.resourceType === 'event_cash_remittance'
                && notification.resourceId
              ) {
                setCoordinatorRemittanceEventId(notification.resourceId)
                setScreen('coordinatorRemittanceDetails')
              } else {
                setScreen('coordinatorHome')
              }
            }}
            variant="coordinator"
          />
        )
      case 'coordinatorRemittanceDetails':
        return (
          <CoordinatorRemittanceDetailsScreen
            data={coordinatorRemittanceDetails}
            errorMessage={coordinatorRemittanceError}
            isLoading={isCoordinatorRemittanceLoading}
            isRefreshing={isCoordinatorRemittanceRefreshing}
            onBack={() => setScreen('coordinatorNotifications')}
            onRefresh={() =>
              void loadCoordinatorRemittance(coordinatorRemittanceEventId, true)
            }
          />
        )
      case 'adminHome':
        return (
          <RoleHomePlaceholderScreen
            actionLabel="SIGN OUT"
            cardTitle="Continue on the web"
            description="Business analytics, revenue, cash flow, and view-only user information are available in the secure MULTIVENT Operations web console."
            onBackToRoleSelection={() => {
              void handleSignOut()
            }}
            roleLabel="Admin"
            title="Your management workspace is ready on the web."
            userName={userName}
          />
        )
      case 'superadminHome':
        return (
          <RoleHomePlaceholderScreen
            actionLabel="SIGN OUT"
            cardTitle="Continue on the web"
            description="Permissions, internal accounts, audit logs, system settings, and governance tools are available in the secure MULTIVENT Operations web console."
            onBackToRoleSelection={() => {
              void handleSignOut()
            }}
            roleLabel="Superadmin"
            title="Your governance workspace is ready on the web."
            userName={userName}
          />
        )
      case 'assistantHome':
        return (
          <RoleHomePlaceholderScreen
            actionLabel="SIGN OUT"
            cardTitle="Continue on the web"
            description="Provider reviews, service approvals, coordinator operations, and remittance tools are available according to your permissions in the MULTIVENT Operations web console."
            onBackToRoleSelection={() => {
              void handleSignOut()
            }}
            roleLabel="Assistant"
            title="Your operations workspace is ready on the web."
            userName={userName}
          />
        )
      case 'customerServiceHome':
        return (
          <RoleHomePlaceholderScreen
            actionLabel="SIGN OUT"
            cardTitle="Continue on the web"
            description="Support tickets and the user, booking, event, and payment details needed to resolve platform concerns are available in the MULTIVENT Operations web console."
            onBackToRoleSelection={() => {
              void handleSignOut()
            }}
            roleLabel="Customer Service"
            title="Your support workspace is ready on the web."
            userName={userName}
          />
        )
      case 'budgetAllocation':
        return (
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: budgetAllocationEntrance }] }]}
          >
            <BudgetAllocationScreen
              coordinatorCost={coordinatorBudgetCost}
              initialAllocations={budgetAllocations}
              initialBudget={totalBudget}
              initialPriorities={budgetPriorities}
              isProcessing={activeGuardedActionCount > 0}
              onBack={openEventCreationFromBudget}
              onContinue={handleBudgetContinue}
              onSkip={() =>
                handleBudgetContinue({ allocations: [], budget: 0, priorities: [] })
              }
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
              userAvatarUrl={userAvatarUrl}
              showBottomNavigation={false}
              onBack={() => setScreen('budgetAllocation')}
              onOpenBudget={() => setScreen('budgetAllocation')}
              onOpenMenu={openSelectedPlan}
              onOpenProfile={() => openAccountProfile('budgetTracker')}
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
      case 'coordinatorChoice':
        return (
          <CoordinatorChoiceScreen
            busyChoice={busyCoordinatorChoice}
            onBack={() => setScreen('budgetAllocation')}
            onBrowse={() => void handleCoordinatorChoice('browse')}
            onSkip={() => void handleCoordinatorChoice('skip')}
          />
        )
      case 'categoryBrowse':
        return (
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: categoryBrowseEntrance }] }]}
          >
            <CategoryBrowseScreen
            categories={serviceCategories}
            categoryName={catalogCategoryName(selectedCategory)}
              eventGuestCount={eventDetails.guestCount}
            mode={serviceBrowseMode}
            services={serviceBrowseMode === 'explore' ? catalogServices : visibleCatalogServices}
            hasBudget={totalBudget > 0}
            selectedServiceCount={selectedServices.length}
            selectedServices={selectedServices}
            assignedCoordinator={assignedCoordinator}
            coordinatorAssignmentStatus={coordinatorAssignmentStatus}
            coordinatorPackage={selectedCoordinatorPackage}
            budget={totalBudget}
            categoryBudget={selectedCategoryBudget}
            categoryBudgetLocked={categoryBudgetLocked}
            categoryBudgetMaximum={categoryBudgetMaximum}
            totalEstimatedCost={selectedEstimatedTotal}
            removingServiceId={removingServiceId}
            remainingBudget={Math.max(0, totalBudget - allocatedBudgetTotal)}
            showBottomNavigation={false}
            onBack={() => {
              if (
                serviceBrowseMode === 'planning'
                && selectedCategory === 'eventOrganizers'
                && coordinatorPreference === 'undecided'
              ) {
                setScreen('coordinatorChoice')
              } else if (serviceBrowseMode === 'planning') openBudgetAllocationFromServices()
              else setScreen('clientHome')
            }}
            onCategoryBudgetChange={async (amount) => {
              const result = await setCategoryBudgetAllocation(selectedBudgetKey, amount)
              if (!result.ok) {
                setToastMessage(result.message ?? 'Unable to update this category budget.')
                return false
              }
              setBudgetAllocations((current) => {
                const existing = current.findIndex((item) => item.categoryKey === selectedBudgetKey)
                const next = { amount, categoryKey: selectedBudgetKey, label: catalogCategoryName(selectedCategory) }
                return existing >= 0
                  ? current.map((item, index) => index === existing ? next : item)
                  : [...current, next]
              })
              setCatalogServices(await loadClientCatalogServices())
              return true
            }}
            onContinueSelectedServices={() => {
              setMaxPlanningStep((current) => Math.max(current, 4))
              setScreen('instructionModule')
            }}
            onAddService={openPlanningHub}
            onRemoveCoordinator={() => void handleRemoveCoordinator()}
            onRemoveService={handleRemoveSelection}
            onSelectService={(serviceId) => {
              setCurrentServiceId(serviceId)
              setScreen('serviceDetails')
            }}
            onSelectCategory={(category) => {
              setSelectedCategory(categoryNameToId(category.name))
            }}
            onSelectVendor={(vendorId) => {
              setCurrentServiceId(vendorId)
              const selectedVendor = catalogServices.find((service) => service.id === vendorId)
              setScreen(
                selectedVendor?.kind === 'coordinator'
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
          </Animated.View>
        )
      case 'coordinatorDetails':
        return (
          <CoordinatorDetailsScreen
            assigning={assigningCoordinatorId === currentService?.id}
            categoryBudgets={Object.fromEntries(
              budgetAllocations.map((allocation) => [allocation.categoryKey, allocation.amount])
            )}
            isAssigned={assignedCoordinator?.id === currentService?.id}
            mode={serviceBrowseMode}
            onBack={() => setScreen('categoryBrowse')}
            onSelectProvider={() => void handleAssignCoordinator()}
            eventGuestCount={eventDetails.guestCount}
            onSelectPackage={(packageId, choices) => void handleChooseCoordinatorPackage(packageId, choices)}
            selectingPackageId={selectingCoordinatorPackageId}
            service={currentService}
          />
        )
      case 'serviceDetails':
        return (
          <ServiceDetailsScreen
            eventDate={eventDetails.date}
            eventGuestCount={eventDetails.guestCount}
            eventTime={eventDetails.time}
            mode={serviceBrowseMode}
            service={currentService}
            hasBudget={totalBudget > 0}
            remainingBudget={remainingBudget}
            onAddSelection={handleAddSelection}
            onCalculateQuote={(value) => calculateServiceQuote({
              optionId: value.optionId,
              packageId: value.packageId,
              quantity: value.quantity,
              serviceId: value.service.bookingServiceId ?? value.service.id,
            })}
            onBack={() => setScreen('categoryBrowse')}
            onReadAllReviews={() => setScreen('serviceDetails')}
            reviewInsights={serviceReviewInsights}
            reviewInsightsLoading={serviceReviewInsightsLoading}
          />
        )
      case 'instructionModule':
        return (
          <InstructionModuleScreen
            onBack={() => openPlanningHub('back')}
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

              setMaxPlanningStep((current) => Math.max(current, 5))
              setScreen(selectedServices.length > 0 ? 'payment' : 'categoryBrowse')
            }}
          />
        )
      case 'messages':
        return (
          <MessagesScreen
            conversations={conversations}
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            navigationVariant={homeReturnScreen === 'providerHome' ? 'merchant' : 'client'}
            showBottomNavigation={false}
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
              homeReturnScreen === 'providerHome'
                ? openProviderProfile()
                : openAccountProfile('messages')
            }
            onSelectConversation={(conversation) => {
              setSelectedConversation(conversation)
              setConversationMessages([])
              setChatReturnScreen('messages')
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
            userAvatarUrl={userAvatarUrl}
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
              setScreen(chatReturnScreen)
            }}
            onOpenBooking={() =>
              setScreen(
                chatReturnScreen === 'coordinatorHome'
                  ? 'coordinatorHome'
                  : homeReturnScreen === 'providerHome'
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
            onBackToRoleSelection={openPlanningHub}
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
            onBack={() => setScreen('instructionModule')}
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
                    ? calculatePaymentBreakdown([item]).initialPayment
                    : item.price,
              })),
              referenceNumber: `MV-${Date.now().toString().slice(-8)}`,
              serviceFee: calculatePaymentBreakdown(payableItems).platformFee,
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
            onOpenProfile={() => openAccountProfile('bookings')}
            onSelectEvent={openPlanningHub}
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
            onCancelBooking={handleClientBookingCancellation}
            onMessageProvider={() => setScreen('messages')}
            onRescheduleBooking={handleClientBookingReschedule}
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
            onBackHome={() => setScreen('clientHome')}
            onClose={() => setScreen('bookingDetails')}
            onSubmit={async (value) => {
              const result = await saveEventFeedback(value)
              if (!result.ok) {
                setToastMessage(result.message ?? 'Unable to save your event feedback.')
                return false
              }

              setSelectedBooking((current) => current ? { ...current, hasFeedback: true } : current)
              if (result.message) setToastMessage(result.message)
              void refreshLiveData().catch(() => {
                setToastMessage('Feedback saved. Live data will refresh shortly.')
              })
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

  const providerMainTab: MerchantHomeTab | null =
    screen === 'providerHome'
      ? 'home'
      : screen === 'providerServices'
        ? 'services'
        : screen === 'providerBookingRequests'
          ? 'bookings'
          : screen === 'messages' && homeReturnScreen === 'providerHome'
            ? 'messages'
            : screen === 'providerProfile'
              ? 'profile'
              : null

  const hasVisibleActivity = Boolean(
    isScreenTransitioning
      || activeGuardedActionCount > 0
      || isEventCreationExiting
      || isSendingMessage
      || serviceReviewInsightsLoading
      || isMerchantPayoutLoading
      || isMerchantPayoutRefreshing
      || isRequestingMerchantPayout
      || isSavingMerchantPayoutAccount
      || isPublishingService
      || isSavingServiceDraft
      || isSavingAvailability
      || isFinalizingPayment
      || isCoordinatorLoading
      || isCoordinatorRefreshing
      || isCoordinatorRemittanceLoading
      || isCoordinatorRemittanceRefreshing
      || isLoadingAccountProfile
      || isSavingAccountProfile
      || Boolean(assigningCoordinatorId)
      || Boolean(processingMerchantBookingId)
      || Boolean(completingBookingId)
      || Boolean(busyCoordinatorTaskId)
      || Boolean(busyCoordinatorInvitationId)
      || Boolean(removingServiceId)
      || Boolean(deletingMerchantPackageId)
      || Boolean(deletingMerchantServiceId)
      || Boolean(updatingAvailabilityServiceId)
  )

  if (!fontsLoaded) {
    return null
  }

  if (isAuthRestoring) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.sessionRestoreScreen}>
          <Image
            accessibilityLabel="MULTIVENT"
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={require('../assets/multivent-icon.png')}
            style={styles.sessionRestoreLogo}
          />
          <Text style={styles.sessionRestoreName}>MULTIVENT</Text>
          <ActivityIndicator color="#F7DED2" size="small" />
          <Text style={styles.sessionRestoreText}>Restoring your secure session…</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  const planningSwipeStep =
    screen === 'eventCreation'
      ? 1
      : screen === 'budgetAllocation'
        ? 2
        : screen === 'categoryBrowse'
          ? 3
          : screen === 'instructionModule'
            ? 4
            : screen === 'payment'
              ? 5
              : 0
  const renderedScreen = renderScreen()
  const screenWithPlanningSwipe = planningSwipeStep > 0 ? (
    <PlanningSwipeContainer
      currentStep={planningSwipeStep}
      onSwipeLeft={
        planningSwipeStep < maxPlanningStep
          ? () => handlePlanningStepPress(planningSwipeStep + 1)
          : undefined
      }
      onSwipeRight={
        planningSwipeStep > 1
          ? () => handlePlanningStepPress(planningSwipeStep - 1)
          : undefined
      }
    >
      {renderedScreen}
    </PlanningSwipeContainer>
  ) : renderedScreen

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.container, isHome && styles.homeContainer]}>
        <ScreenMotionFrame
          disabled={screensWithOwnEntrance.has(screen)}
          isLocked={isScreenTransitioning}
          progress={screenTransitionProgress}
        >
          <PlanningStepNavigationProvider
            maxReachableStep={maxPlanningStep}
            onStepPress={handlePlanningStepPress}
          >
            {screenWithPlanningSwipe}
          </PlanningStepNavigationProvider>
        </ScreenMotionFrame>

        <NonBlockingActivityBar visible={hasVisibleActivity} />

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
        {width < 768 && providerMainTab ? (
          <MerchantBottomNavigation
            activeTab={providerMainTab}
            onSelectTab={openMerchantTab}
          />
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  sessionRestoreScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#630019',
    padding: 24,
  },
  sessionRestoreLogo: {
    width: 132,
    height: 132,
    borderRadius: 28,
  },
  sessionRestoreName: {
    color: '#FFF7F2',
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    letterSpacing: 3.2,
    marginBottom: 4,
  },
  sessionRestoreText: {
    color: '#F7DED2',
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
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
