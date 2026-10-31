import React from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ActivityIndicator, Alert, Animated, AppState, BackHandler, Easing, Image, Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as WebBrowser from 'expo-web-browser'
import * as ImagePicker from 'expo-image-picker'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter'

import { supabase } from './lib/supabase'
import { fetchFavoriteServiceIds, toggleFavoriteService } from './lib/favorites'
import {
  clearMyInboxItems,
  type InboxItemType,
  type InboxTrashItem,
  type InboxTrashScope,
  loadMyInboxTrash,
  moveMyInboxItemsToTrash,
  restoreMyInboxItems,
} from './lib/inbox-trash'
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
  formatPeso,
  loadClientCatalogServices,
  ServiceCategoryOption,
} from './lib/catalog'
import {
  assignCoordinatorToEvent,
  activateBookingReplacement,
  calculateServiceQuote,
  ClientEventDraftSummary,
  ClientSavedPlanSummary,
  createClientEventDraft,
  deleteClientEventDraft,
  fetchClientEventDrafts,
  fetchClientSavedPlans,
  fetchClientPlanningState,
  removeCoordinatorFromEvent,
  removeServiceSelection,
  loadCateringTastingDraft,
  saveBudgetPlan,
  saveCateringTastingDraft,
  saveBookingPlanForLater,
  saveEventFeedback,
  saveEventDraft,
  saveProviderInstructions,
  saveServiceSelection,
  setCategoryBudgetAllocation,
  fetchMyEventPaymentQuoteV14,
  createMyPaymongoCheckoutV16,
  reconcileMyPaymongoCheckoutV16,
  submitBookingReplacementRequest,
  submitPlanningBookingRequests,
  type EventPaymentQuote,
  type V14PaymentSettlementContext,
  resumeClientEventDraft,
  resumeClientSavedPlan,
  type ClientPlanningState,
  type SavedPlanReview,
} from './lib/planning'
import type { VenueOptionSelection } from './lib/service-category-details'
import type { PhotoVideoSelectionSnapshot } from './lib/photo-video-booking'
import {
  confirmPhotoVideoPreEventPlan,
  savePhotoVideoPreEventPlan,
  savePhotoVideoShotList,
  type PhotoVideoPreEventPlan,
} from './lib/photo-video-pre-event'
import { respondToPhotoVideoEventDayRequest, savePhotoVideoEventDayUpdate } from './lib/photo-video-event-day'
import { respondToPhotoVideoDeliverable, savePhotoVideoDeliverableUpdate } from './lib/photo-video-deliverables'
import {
  getActivePlanningCategories,
  getConfiguredPlanningCategories,
  getFirstPlanningCategory,
  getFirstServicePlanningCategory,
  getNextUnselectedServicePlanningCategory,
  hasConfiguredCategoryBudgets,
  PLANNING_CATEGORY_PRIORITY,
} from './lib/planning-categories'
import {
  calculateCategoryBudgetMaximum,
  calculateUnallocatedPlanningBudget,
} from './lib/planning-budget'
import { rankHomeRecommendations } from './lib/home-recommendations'
import {
  cancelClientEventBookings,
  changeMerchantPassword,
  clearMerchantServiceDraft,
  deleteMerchantPackageListing,
  deleteMerchantServiceListing,
  emptyMerchantPayoutDashboard,
  activateV15FoodTastingDirectMenuFallback,
  confirmV15FoodTastingAttendance,
  fetchClientBookings,
  fetchMerchantBookingRequests,
  fetchMerchantEarningsOverview,
  fetchMerchantPayoutDashboard,
  fetchMerchantServices,
  loadMerchantServiceDraft,
  loadMerchantServiceForEditing,
  loadCateringFoodTastingSlots,
  loadV15CateringFoodTastingRescheduleSlots,
  MerchantPackageListing,
  type MerchantEarningsOverview,
  MerchantServiceListing,
  markMerchantNotificationRead,
  markMerchantNotificationsRead,
  requestMerchantPayout,
  requestCateringFoodTasting,
  respondToCateringFoodTasting,
  respondToCateringFoodTastingProposal,
  respondToV15FoodTastingFinalMenu,
  respondToChurchWeddingProposal,
  rescheduleClientEventBookings,
  rescheduleV15FoodTasting,
  saveAvailabilityCalendar,
  saveBookingDecision,
  saveMerchantServiceDraft,
  saveMerchantServiceListing,
  saveMerchantComposedPackage,
  saveMerchantCompletionPayment,
  saveMerchantPayoutAccount,
  saveNotificationPreferences,
  saveOperatingHours,
  setMerchantServiceAvailability,
  submitV15FoodTastingFinalMenu,
} from './lib/merchant'
import { colors } from './theme/tokens'
import { ClientBottomNavigation } from './components/ClientBottomNavigation'
import { InboxTrashModal } from './components/InboxTrashModal'
import type { CoordinatorMainTab } from './components/CoordinatorBottomNavigation'
import { MerchantBottomNavigation } from './components/MerchantBottomNavigation'
import { NonBlockingActivityBar, ScreenMotionFrame } from './components/MotionFeedback'
import { ClientHomeScreen, ClientHomeTab, getClientBookingProgress } from './screens/03-ClientHome'
import { ClientPlansScreen } from './screens/03.3-ClientPlans'
import { ClientConversation, ClientInboxTab, MessagesScreen } from './screens/03.1-Messages'
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
  type ProviderCompletionPaymentValue,
} from './screens/19.1-BookingRequest'
import {
  BookingRequestDeclineScreen,
  BookingRequestDeclineValue,
} from './screens/19.2-BookingRequest(Deciline)'
import { MerchantBookingDetailScreen } from './screens/20-BookingDetail'
import { ReviewPerformanceScreen } from './screens/21-ReviewPerformance'
import { MerchantProfileAction, MerchantProfileScreen } from './screens/22-MerchantProfile'
import { AccountProfileScreen } from './screens/24-AccountProfile'
import { ClientRefundsScreen } from './screens/24.1-ClientWallet'
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
import {
  CoordinatorEventDetailsScreen,
  CoordinatorScreen,
  type ChurchArrangementDraft,
  type CoordinatorView,
} from './screens/23-Coordinator'
import { CoordinatorRemittanceDetailsScreen } from './screens/23.1-CoordinatorRemittanceDetails'
import { CoordinatorServiceProfileScreen } from './screens/23.2-CoordinatorServiceProfile'
import { OnboardingScreen } from './screens/01-Onboarding'
import { LoginScreen } from './screens/01.1-Login'
import { ForgotPasswordScreen } from './screens/01.1.1-ForgotPassword'
import { NewPasswordScreen } from './screens/01.1.2-NewPassword'
import { RoleSelectionScreen } from './screens/02-RoleSelection'
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
  cateringCustomMenuStartingPrice,
  getCateringCustomMenu,
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
  type InstructionModuleValue,
} from './screens/10-InstructionModule'
import { PlanningStepNavigationProvider } from './components/PlanningStepIndicator'
import { BookingItem, BookingScreen } from './screens/11-BookingScreen'
import { BookingDetailsScreen } from './screens/11.1-BookingDetails'
import { BookingPaymentSheet, PaymentScreen, type PaymentValue } from './screens/12-Payment'
import {
  EventSummaryScreen,
  type EventSummaryDetails,
  type EventSummaryOrderItem,
} from './screens/12-EventSummary'
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
  markConversationMessageNotificationsRead,
  openBookingConversation,
  openCoordinatorProviderConversation,
  openEventCoordinatorConversation,
  sendConversationMessage,
} from './lib/messaging'
import {
  Notifications,
  readNotificationRouteData,
  registerCurrentDeviceForPush,
  revokeCurrentDevicePushToken,
  setApplicationBadgeFromUnreadCount,
  supportsRemotePushNotifications,
} from './lib/notifications'
import {
  isBookingUpdate,
  isEventUpdate,
  isMessageUpdate,
  isTaskUpdate,
  isUnreadInboxNotification,
  isUnreadUpdate,
  unreadBookingTrackerResourceIds,
} from './lib/unread-updates'
import {
  confirmCoordinatorChurchWeddingArrangement,
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
  saveCoordinatorChurchWeddingArrangement,
  updateCoordinatorTaskStatus,
} from './lib/coordinator'
import {
  EditableAccountProfile,
  loadEditableAccountProfile,
  saveEditableAccountProfile,
  uploadEditableAccountPhoto,
} from './lib/profile'
import {
  ClientRefundOverview,
  emptyClientRefundOverview,
  fetchClientRefundOverview,
} from './lib/client-wallet'

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
  | 'clientPlans'
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
  | 'clientRefunds'
  | 'support'
  | 'coordinatorHome'
  | 'coordinatorEventDetails'
  | 'coordinatorNotifications'
  | 'coordinatorRemittanceDetails'
  | 'coordinatorServiceProfile'
  | 'assistantHome'
  | 'customerServiceHome'
  | 'adminHome'
  | 'superadminHome'
  | 'budgetAllocation'
  | 'budgetTracker'
  | 'categoryBrowse'
  | 'coordinatorDetails'
  | 'serviceDetails'
  | 'instructionModule'
  | 'bookings'
  | 'bookingDetails'
  | 'bookingPayment'
  | 'payment'
  | 'confirmation'
  | 'eventLedger'
  | 'eventFeedback'
  | 'messages'
  | 'chatThread'
  | 'notifications'
  | 'guestList'

type LoginReturnScreen = 'roleSelection' | 'clientSignup' | 'merchantSignup'
type VerificationReturnScreen = 'roleSelection' | 'clientSignup' | 'merchantSignup'
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

type ClientPlanningResumeScreen =
  | 'budgetAllocation'
  | 'categoryBrowse'
  | 'coordinatorDetails'
  | 'eventCreation'
  | 'instructionModule'
  | 'payment'
  | 'serviceDetails'

type ClientPlanningResumeState = {
  budgetDraft?: BudgetAllocationValue
  currentServiceId?: string
  eventId?: string
  eventDetails?: EventCreationValue
  instructionDraft?: InstructionModuleValue
  photoVideoSelectionDraft?: {
    selection: PhotoVideoSelectionSnapshot
    serviceId: string
  }
  savedPlanId?: string
  screen: ClientPlanningResumeScreen
  selectedCategory?: CatalogCategoryId
  version: 1
}

type ClientPlanningResumeUpdate = Partial<Omit<ClientPlanningResumeState, 'version'>>

const clientPlanningResumeScreens = new Set<ClientPlanningResumeScreen>([
  'budgetAllocation',
  'categoryBrowse',
  'coordinatorDetails',
  'eventCreation',
  'instructionModule',
  'payment',
  'serviceDetails',
])

const clientPlanningResumeStorageKey = (userId: string) =>
  `multivent:client-planning-resume:v1:${userId}`

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
  isChurchWedding: undefined,
  time: '',
  venueStatus: 'searching',
  wantsCoordinator: undefined,
}

const eventDetailsMatch = (first: EventCreationValue, second: EventCreationValue) => {
  const firstThemes = first.weddingThemes ?? []
  const secondThemes = second.weddingThemes ?? []

  return first.date === second.date
    && first.eventName === second.eventName
    && first.eventType === second.eventType
    && first.guestCount === second.guestCount
    && first.isChurchWedding === second.isChurchWedding
    && first.wantsCoordinator === second.wantsCoordinator
    && first.time === second.time
    && first.venueAddress === second.venueAddress
    && first.venueName === second.venueName
    && first.venueStatus === second.venueStatus
    && (
      first.venueStatus !== 'secured'
      || (
        first.venueLatitude === second.venueLatitude
        && first.venueLongitude === second.venueLongitude
      )
    )
    && firstThemes.length === secondThemes.length
    && firstThemes.every((theme, index) => theme === secondThemes[index])
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

const confirmDestructiveAction = (title: string, message: string, actionLabel: string) => {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`))
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { onPress: () => resolve(false), style: 'cancel', text: 'Cancel' },
        { onPress: () => resolve(true), style: 'destructive', text: actionLabel },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
}

type ServiceChangeConfirmation = {
  currentName: string
  currentConfiguration?: string
  currentPrice: number
  currentProviderName: string
  nextName: string
  nextConfiguration?: string
  nextPrice: number
  nextProviderName: string
  variant?: 'replacement'
}

const serviceChangeLabels = {
  confirm: 'Confirm Change',
  current: 'Current Service:',
  difference: 'Price Difference:',
  next: 'New Service:',
  title: 'Change Selected Service?',
} as const

const ServiceChangeConfirmationModal: React.FC<{
  confirmation?: ServiceChangeConfirmation
  onCancel: () => void
  onConfirm: () => void
}> = ({ confirmation, onCancel, onConfirm }) => {
  if (!confirmation) return null

  const isReplacement = confirmation.variant === 'replacement'
  const labels = isReplacement
    ? {
        cancel: 'CANCEL',
        confirm: 'Send Request',
        current: 'Declined Service:',
        next: 'Replacement Service:',
        title: 'Replace Declined Service?',
      }
    : {
        cancel: 'KEEP CURRENT',
        confirm: serviceChangeLabels.confirm,
        current: serviceChangeLabels.current,
        next: serviceChangeLabels.next,
        title: serviceChangeLabels.title,
      }
  const difference = Math.round((confirmation.nextPrice - confirmation.currentPrice) * 100) / 100
  const differenceLabel = difference === 0
    ? 'No price difference'
    : difference > 0
      ? `${formatPeso(difference)} higher`
      : `${formatPeso(Math.abs(difference))} lower`

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible
    >
      <View style={styles.serviceChangeOverlay}>
        <View accessibilityViewIsModal style={styles.serviceChangeCard}>
          <View style={styles.serviceChangeIcon}>
            <Text style={styles.serviceChangeIconText}>↔</Text>
          </View>
          <Text style={styles.serviceChangeTitle}>{labels.title}</Text>
          <Text style={styles.serviceChangeCopy}>
            {isReplacement
              ? 'Your declined booking stays in its history. The replacement provider will receive a new request and must respond before payment is available.'
              : 'Your current service will be replaced only after you confirm this change.'}
          </Text>

          <View style={styles.serviceChangeComparison}>
            <View style={styles.serviceChangeServiceRow}>
              <Text style={styles.serviceChangeLabel}>{labels.current}</Text>
              <Text numberOfLines={1} style={styles.serviceChangeName}>{confirmation.currentName}</Text>
              <Text numberOfLines={1} style={styles.serviceChangeProvider}>{confirmation.currentProviderName}</Text>
              {confirmation.currentConfiguration ? (
                <Text numberOfLines={2} style={styles.serviceChangeConfiguration}>{confirmation.currentConfiguration}</Text>
              ) : null}
              <Text style={styles.serviceChangePrice}>{formatPeso(confirmation.currentPrice)}</Text>
            </View>
            <View style={styles.serviceChangeDivider} />
            <View style={styles.serviceChangeServiceRow}>
              <Text style={styles.serviceChangeLabel}>{labels.next}</Text>
              <Text numberOfLines={1} style={styles.serviceChangeName}>{confirmation.nextName}</Text>
              <Text numberOfLines={1} style={styles.serviceChangeProvider}>{confirmation.nextProviderName}</Text>
              {confirmation.nextConfiguration ? (
                <Text numberOfLines={2} style={styles.serviceChangeConfiguration}>{confirmation.nextConfiguration}</Text>
              ) : null}
              <Text style={styles.serviceChangePrice}>{formatPeso(confirmation.nextPrice)}</Text>
            </View>
          </View>

          <View style={styles.serviceChangeDifference}>
            <Text style={styles.serviceChangeDifferenceLabel}>{serviceChangeLabels.difference}</Text>
            <Text style={[
              styles.serviceChangeDifferenceValue,
              difference > 0 && styles.serviceChangeDifferenceHigher,
              difference < 0 && styles.serviceChangeDifferenceLower,
            ]}>{differenceLabel}</Text>
          </View>

          <View style={styles.serviceChangeActions}>
            <Pressable
              accessibilityLabel={isReplacement ? 'Cancel replacement' : 'Keep the current service'}
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.serviceChangeCancel, pressed && styles.serviceChangePressed]}
            >
              <Text style={styles.serviceChangeCancelText}>{labels.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={isReplacement ? 'Send replacement booking request' : 'Confirm changing the selected service'}
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.serviceChangeConfirm, pressed && styles.serviceChangePressed]}
            >
              <Text style={styles.serviceChangeConfirmText}>{labels.confirm}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const outcomeMessageForCompletionPayment = (
  type: ProviderCompletionPaymentValue['type'],
  bookingCompleted: boolean
) => {
  if (type === 'notYet') {
    return 'The service remains open while the remaining balance is outstanding.'
  }
  return bookingCompleted
    ? 'External payment recorded. The service was marked finished and the client was notified.'
    : 'Provider-confirmed external payment recorded. The remaining balance is still outstanding.'
}

export const App: React.FC = () => {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  })
  const { height, width } = useWindowDimensions()
  const [screen, commitScreen] = React.useState<AppScreen>('onboarding')
  const [isAuthRestoring, setIsAuthRestoring] = React.useState(Boolean(supabase))
  const [authenticatedUserId, setAuthenticatedUserId] = React.useState('')
  const [isScreenTransitioning, setIsScreenTransitioning] = React.useState(false)
  const screenTransitionProgress = React.useRef(new Animated.Value(1)).current
  const screenRef = React.useRef<AppScreen>('onboarding')
  const screenHistoryRef = React.useRef<AppScreen[]>(['onboarding'])
  const previousScreenRef = React.useRef<AppScreen>('onboarding')
  const navigationLockedRef = React.useRef(false)
  const screenTransitionAnimation = React.useRef<Animated.CompositeAnimation | null>(null)
  const clientPlanningResumeRef = React.useRef<Partial<ClientPlanningResumeState>>({})
  const clientPlanningResumeWriteRef = React.useRef(Promise.resolve())
  const eventAutosaveChainRef = React.useRef(Promise.resolve())
  const eventAutosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEventAutosaveRef = React.useRef<EventCreationValue | undefined>(undefined)
  const budgetAutosaveChainRef = React.useRef(Promise.resolve())
  const budgetAutosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingBudgetAutosaveRef = React.useRef<BudgetAllocationValue | undefined>(undefined)
  const refreshLiveDataInFlightRef = React.useRef<Promise<ClientPlanningState> | null>(null)
  const clientBookingsRequestRef = React.useRef<ReturnType<typeof fetchClientBookings> | null>(null)

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
  const [isClientHomeRefreshing, setIsClientHomeRefreshing] = React.useState(false)
  const clientNavigationInteractionLockRef = React.useRef(0)
  const keepClientNavigationVisibleForToggle = React.useCallback(() => {
    clientNavigationInteractionLockRef.current = Date.now() + 320
    setIsClientNavigationVisible(true)
  }, [])
  const handleClientNavigationScrollDirection = React.useCallback((direction: 'down' | 'up') => {
    if (Date.now() < clientNavigationInteractionLockRef.current) return
    setIsClientNavigationVisible(direction === 'up')
  }, [])
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
  const [messageWorkspace, setMessageWorkspace] =
    React.useState<'client' | 'coordinator' | 'merchant'>('client')
  const [loginReturnScreen, setLoginReturnScreen] =
    React.useState<LoginReturnScreen>('roleSelection')
  const [verificationEmail, setVerificationEmail] = React.useState('')
  const [verificationReturnScreen, setVerificationReturnScreen] =
    React.useState<VerificationReturnScreen>('clientSignup')
  const [verificationNextScreen, setVerificationNextScreen] =
    React.useState<VerificationNextScreen>('clientHome')
  const [recoveryContact, setRecoveryContact] = React.useState('')
  const [selectedBooking, setSelectedBooking] = React.useState<BookingItem>()
  const [bookingPaymentQuote, setBookingPaymentQuote] = React.useState<EventPaymentQuote>()
  const [isBookingPaymentSheetVisible, setIsBookingPaymentSheetVisible] = React.useState(false)
  const [paymentSettlementContext, setPaymentSettlementContext] =
    React.useState<V14PaymentSettlementContext>()
  const [isLoadingBookingPaymentQuote, setIsLoadingBookingPaymentQuote] = React.useState(false)
  const [isPreparingBookingPayment, setIsPreparingBookingPayment] = React.useState(false)
  const [isInitiatingBookingPayment, setIsInitiatingBookingPayment] = React.useState(false)
  const calculateServiceDetailsQuote = React.useCallback((value: {
    attendeeCount?: number
    menuItemIds?: string[]
    optionId?: string
    packageId?: string
    quantity?: number
    floristSelection?: import('./lib/florist').FloristSelectionSnapshot
    photoVideoSelection?: import('./lib/photo-video-booking').PhotoVideoSelectionSnapshot
    service: CatalogService
    venueSelections?: VenueOptionSelection[]
  }) => calculateServiceQuote({
    attendeeCount: value.attendeeCount,
    menuItemIds: value.menuItemIds,
    optionId: value.optionId,
    packageId: value.packageId,
    quantity: value.quantity,
    floristSelection: value.floristSelection,
    photoVideoSelection: value.photoVideoSelection,
    serviceId: value.service.bookingServiceId ?? value.service.id,
    venueSelections: value.venueSelections,
  }), [])
  const [selectedConversation, setSelectedConversation] =
    React.useState<ClientConversation>()
  const [chatReturnScreen, setChatReturnScreen] = React.useState<AppScreen>('messages')
  const [conversations, setConversations] = React.useState<ClientConversation[]>([])
  const [conversationMessages, setConversationMessages] = React.useState<ChatMessage[]>([])
  const [notifications, setNotifications] = React.useState<MerchantNotification[]>([])
  const [inboxTrashItems, setInboxTrashItems] = React.useState<InboxTrashItem[]>([])
  const [inboxTrashScope, setInboxTrashScope] = React.useState<InboxTrashScope>('all')
  const [isInboxTrashVisible, setIsInboxTrashVisible] = React.useState(false)
  const [isInboxTrashLoading, setIsInboxTrashLoading] = React.useState(false)
  const [isInboxTrashMutating, setIsInboxTrashMutating] = React.useState(false)
  const [isLoadingConversationMessages, setIsLoadingConversationMessages] = React.useState(false)
  const [isSendingMessage, setIsSendingMessage] = React.useState(false)
  const [catalogServices, setCatalogServices] = React.useState<CatalogService[]>([])
  const [favoriteServiceIds, setFavoriteServiceIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [favoritePendingServiceIds, setFavoritePendingServiceIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const favoriteTogglesInFlightRef = React.useRef(new Set<string>())
  const favoriteStateRevisionRef = React.useRef(0)
  const [serviceCategories, setServiceCategories] =
    React.useState<ServiceCategoryOption[]>(fallbackServiceCategories)
  const [serviceBrowseMode, setServiceBrowseMode] =
    React.useState<'explore' | 'planning'>('planning')
  const [exploreFavoritesOnly, setExploreFavoritesOnly] = React.useState(false)
  const [selectedCategory, setSelectedCategory] =
    React.useState<CatalogCategoryId>('catering')
  const [replacementBooking, setReplacementBooking] = React.useState<{
    baselineAmount: number
    bookingId: string
    category: string
    configuration?: string
    providerName: string
    serviceName: string
    serviceId?: string
  }>()
  const [currentServiceId, setCurrentServiceId] = React.useState('')
  const [directCateringFallbackServiceId, setDirectCateringFallbackServiceId] = React.useState('')
  const [serviceReviewInsights, setServiceReviewInsights] =
    React.useState<ServiceReviewInsights>()
  const [serviceReviewInsightsLoading, setServiceReviewInsightsLoading] = React.useState(false)
  const [selectedServices, setSelectedServices] = React.useState<SelectedSummaryService[]>([])
  const [changingServiceSelection, setChangingServiceSelection] = React.useState<SelectedSummaryService>()
  const [serviceChangeConfirmation, setServiceChangeConfirmation] =
    React.useState<ServiceChangeConfirmation>()
  const serviceChangeConfirmationResolverRef = React.useRef<
    ((confirmed: boolean) => void) | undefined
  >(undefined)
  const [selectionCompletionAcknowledged, setSelectionCompletionAcknowledged] = React.useState(false)
  const [assignedCoordinator, setAssignedCoordinator] =
    React.useState<AssignedCoordinatorSummary>()
  const [coordinatorAssignmentStatus, setCoordinatorAssignmentStatus] = React.useState<
    'accepted' | 'pending' | 'awaiting_assignment' | undefined
  >()
  const [, setCoordinatorPreferenceState] = React.useState<
    'undecided' | 'skipped' | 'selected'
  >('undecided')
  const [selectedCoordinatorPackage, setSelectedCoordinatorPackage] = React.useState<{
    id: string
    name: string
    serviceSubtotal: number
  }>()
  const [assigningCoordinatorId, setAssigningCoordinatorId] = React.useState('')
  const [maxPlanningStep, setMaxPlanningStep] = React.useState(1)
  const [clientEventDrafts, setClientEventDrafts] =
    React.useState<ClientEventDraftSummary[]>([])
  const [clientSavedPlans, setClientSavedPlans] =
    React.useState<ClientSavedPlanSummary[]>([])
  const [savedPlanReview, setSavedPlanReview] = React.useState<SavedPlanReview>()
  const [isSavingPlanForLater, setIsSavingPlanForLater] = React.useState(false)
  const [clientBookings, setClientBookings] = React.useState<BookingItem[]>([])
  const [merchantRequests, setMerchantRequests] = React.useState<MerchantBookingRequest[]>([])
  const [merchantServices, setMerchantServices] = React.useState<MerchantServiceListing[]>([])
  const [totalBudget, setTotalBudget] = React.useState(DEFAULT_BUDGET)
  const [budgetPriorities, setBudgetPriorities] = React.useState<BudgetPriority[]>([])
  const [budgetAllocations, setBudgetAllocations] = React.useState<
    CategoryBudgetAllocation[]
  >([])
  const [eventDetails, setEventDetails] =
    React.useState<EventCreationValue>(DEFAULT_EVENT)
  const [instructionDraft, setInstructionDraft] =
    React.useState<InstructionModuleValue>()
  const [photoVideoSelectionDraft, setPhotoVideoSelectionDraft] = React.useState<{
    selection: PhotoVideoSelectionSnapshot
    serviceId: string
  }>()
  const eventDetailsDirtyRef = React.useRef(false)
  const handleEventDetailsChange = React.useCallback((value: EventCreationValue) => {
    setEventDetails((current) => {
      // Removing an already selected coordinator requires an explicit
      // confirmation in handleEventContinue. Keep the persisted draft intact
      // until then so background autosave cannot silently remove that booking.
      const nextValue = value.wantsCoordinator === false && assignedCoordinator
        ? {
            ...value,
            isChurchWedding: current.isChurchWedding,
            wantsCoordinator: current.wantsCoordinator,
          }
        : value

      if (eventDetailsMatch(current, nextValue)) return current
      eventDetailsDirtyRef.current = true
      return nextValue
    })
  }, [assignedCoordinator])

  const persistClientPlanningResume = React.useCallback((update: ClientPlanningResumeUpdate) => {
    if (!authenticatedUserId) return

    const screenToResume = update.screen ?? clientPlanningResumeRef.current.screen
    if (!screenToResume) return

    const next: ClientPlanningResumeState = {
      ...clientPlanningResumeRef.current,
      ...update,
      screen: screenToResume,
      version: 1,
    }
    clientPlanningResumeRef.current = next
    const serialized = JSON.stringify(next)
    const storageKey = clientPlanningResumeStorageKey(authenticatedUserId)

    clientPlanningResumeWriteRef.current = clientPlanningResumeWriteRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(storageKey, serialized))
      .catch(() => undefined)
  }, [authenticatedUserId])

  const clearClientPlanningResume = React.useCallback(() => {
    const userId = authenticatedUserId
    clientPlanningResumeRef.current = {}
    if (!userId) return

    const storageKey = clientPlanningResumeStorageKey(userId)
    clientPlanningResumeWriteRef.current = clientPlanningResumeWriteRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.removeItem(storageKey))
      .catch(() => undefined)
  }, [authenticatedUserId])

  const enqueueEventAutosave = React.useCallback((value: EventCreationValue) => {
    eventAutosaveChainRef.current = eventAutosaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveEventDraft(value, Math.max(1, maxPlanningStep))
      })
    return eventAutosaveChainRef.current
  }, [maxPlanningStep])

  const queueEventAutosave = React.useCallback((value: EventCreationValue) => {
    pendingEventAutosaveRef.current = value
    if (eventAutosaveTimerRef.current) clearTimeout(eventAutosaveTimerRef.current)
    eventAutosaveTimerRef.current = setTimeout(() => {
      eventAutosaveTimerRef.current = null
      const pending = pendingEventAutosaveRef.current
      pendingEventAutosaveRef.current = undefined
      if (pending) void enqueueEventAutosave(pending)
    }, 500)
  }, [enqueueEventAutosave])

  const flushEventAutosave = React.useCallback(async () => {
    if (eventAutosaveTimerRef.current) {
      clearTimeout(eventAutosaveTimerRef.current)
      eventAutosaveTimerRef.current = null
    }

    const pending = pendingEventAutosaveRef.current
    pendingEventAutosaveRef.current = undefined
    if (pending) await enqueueEventAutosave(pending)
    else await eventAutosaveChainRef.current.catch(() => undefined)
  }, [enqueueEventAutosave])

  const discardPendingEventAutosave = React.useCallback(() => {
    if (eventAutosaveTimerRef.current) {
      clearTimeout(eventAutosaveTimerRef.current)
      eventAutosaveTimerRef.current = null
    }
    pendingEventAutosaveRef.current = undefined
  }, [])

  const enqueueBudgetAutosave = React.useCallback((value: BudgetAllocationValue) => {
    budgetAutosaveChainRef.current = budgetAutosaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await saveBudgetPlan(value, 2)
      })
    return budgetAutosaveChainRef.current
  }, [])

  const queueBudgetAutosave = React.useCallback((value: BudgetAllocationValue) => {
    persistClientPlanningResume({ budgetDraft: value })
    pendingBudgetAutosaveRef.current = value
    if (budgetAutosaveTimerRef.current) clearTimeout(budgetAutosaveTimerRef.current)
    budgetAutosaveTimerRef.current = setTimeout(() => {
      budgetAutosaveTimerRef.current = null
      const pending = pendingBudgetAutosaveRef.current
      pendingBudgetAutosaveRef.current = undefined
      if (pending) void enqueueBudgetAutosave(pending)
    }, 500)
  }, [enqueueBudgetAutosave, persistClientPlanningResume])

  const flushBudgetAutosave = React.useCallback(async () => {
    if (budgetAutosaveTimerRef.current) {
      clearTimeout(budgetAutosaveTimerRef.current)
      budgetAutosaveTimerRef.current = null
    }

    const pending = pendingBudgetAutosaveRef.current
    pendingBudgetAutosaveRef.current = undefined
    if (pending) await enqueueBudgetAutosave(pending)
    else await budgetAutosaveChainRef.current.catch(() => undefined)
  }, [enqueueBudgetAutosave])

  const discardPendingBudgetAutosave = React.useCallback(() => {
    if (budgetAutosaveTimerRef.current) {
      clearTimeout(budgetAutosaveTimerRef.current)
      budgetAutosaveTimerRef.current = null
    }
    pendingBudgetAutosaveRef.current = undefined
  }, [])

  const handleInstructionDraftChange = React.useCallback((value: InstructionModuleValue) => {
    setInstructionDraft(value)
    persistClientPlanningResume({ instructionDraft: value })
  }, [persistClientPlanningResume])

  React.useEffect(() => {
    const isPlanningScreen = clientPlanningResumeScreens.has(
      screen as ClientPlanningResumeScreen
    ) && (
      !['categoryBrowse', 'coordinatorDetails', 'serviceDetails'].includes(screen)
      || serviceBrowseMode === 'planning'
    )
    if (!isPlanningScreen) return

    persistClientPlanningResume({
      currentServiceId,
      screen: screen as ClientPlanningResumeScreen,
      selectedCategory,
    })
  }, [currentServiceId, persistClientPlanningResume, screen, selectedCategory, serviceBrowseMode])

  React.useEffect(() => {
    if (screen !== 'eventCreation') return

    persistClientPlanningResume({ eventDetails, screen: 'eventCreation' })
    if (eventDetailsDirtyRef.current) queueEventAutosave(eventDetails)
  }, [eventDetails, persistClientPlanningResume, queueEventAutosave, screen])

  React.useEffect(() => {
    const previousScreen = previousScreenRef.current
    previousScreenRef.current = screen

    // Leaving a planning step is an explicit signal to save immediately,
    // rather than waiting for the normal short debounce window.
    if (previousScreen === 'eventCreation' && screen !== 'eventCreation') {
      void flushEventAutosave()
    }
    if (previousScreen === 'budgetAllocation' && screen !== 'budgetAllocation') {
      void flushBudgetAutosave()
    }
  }, [flushBudgetAutosave, flushEventAutosave, screen])

  React.useEffect(() => () => {
    if (eventAutosaveTimerRef.current) clearTimeout(eventAutosaveTimerRef.current)
    if (budgetAutosaveTimerRef.current) clearTimeout(budgetAutosaveTimerRef.current)
  }, [])

  React.useEffect(() => {
    const persistBeforeDeactivation = () => {
      const isPlanningScreen = clientPlanningResumeScreens.has(
        screenRef.current as ClientPlanningResumeScreen
      ) && (
        !['categoryBrowse', 'coordinatorDetails', 'serviceDetails'].includes(screenRef.current)
        || serviceBrowseMode === 'planning'
      )
      if (isPlanningScreen) {
        persistClientPlanningResume({
          currentServiceId,
          eventDetails,
          instructionDraft,
          photoVideoSelectionDraft,
          screen: screenRef.current as ClientPlanningResumeScreen,
          selectedCategory,
        })
      }
      void flushEventAutosave()
      void flushBudgetAutosave()
    }

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') persistBeforeDeactivation()
    })
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return () => appStateSubscription.remove()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistBeforeDeactivation()
    }
    window.addEventListener('pagehide', persistBeforeDeactivation)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      appStateSubscription.remove()
      window.removeEventListener('pagehide', persistBeforeDeactivation)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    currentServiceId,
    eventDetails,
    flushBudgetAutosave,
    flushEventAutosave,
    instructionDraft,
    photoVideoSelectionDraft,
    persistClientPlanningResume,
    selectedCategory,
    serviceBrowseMode,
  ])
  const [coordinatorBudgetCost, setCoordinatorBudgetCost] = React.useState(0)
  // A previously assigned coordinator remains visible even if the client later
  // changes their preference, so no confirmed booking is hidden or removed.
  const coordinatorPlanningEnabled = eventDetails.wantsCoordinator === true || Boolean(assignedCoordinator)
  const planningBudgetAllocations = React.useMemo(
    () => coordinatorPlanningEnabled
      ? budgetAllocations
      : budgetAllocations.filter((allocation) => allocation.categoryKey !== 'eventOrganizer'),
    [budgetAllocations, coordinatorPlanningEnabled]
  )
  const hasEventOrganizerBudget = coordinatorPlanningEnabled && planningBudgetAllocations.some(
    (allocation) => allocation.categoryKey === 'eventOrganizer' && allocation.amount > 0
  )
  // A total event budget without category allocations is intentionally a
  // no-budget marketplace. Only actual positive category allocations enable
  // budget filtering and the allocation-driven category list.
  const hasConfiguredPlanningBudget = React.useMemo(
    () => hasConfiguredCategoryBudgets(planningBudgetAllocations),
    [planningBudgetAllocations]
  )
  const activePlanningCategories = React.useMemo(
    () => getActivePlanningCategories(planningBudgetAllocations),
    [planningBudgetAllocations]
  )
  const configuredPlanningCategories = React.useMemo(() => {
    const configured = getConfiguredPlanningCategories(planningBudgetAllocations)
    // Positive allocations always have a persisted row. The fallback retains
    // the established allocation-driven path for legacy planning snapshots.
    return configured.length > 0 ? configured : activePlanningCategories
  }, [activePlanningCategories, planningBudgetAllocations])
  const firstPlanningCategory = React.useMemo(
    () => getFirstPlanningCategory(planningBudgetAllocations),
    [planningBudgetAllocations]
  )
  const firstServicePlanningCategory = React.useMemo(
    () => getFirstServicePlanningCategory(planningBudgetAllocations),
    [planningBudgetAllocations]
  )
  const planningCategoryIds = React.useMemo(() => {
    if (hasConfiguredPlanningBudget) {
      return configuredPlanningCategories.map((category) => category.categoryId)
    }

    return PLANNING_CATEGORY_PRIORITY
      .filter((category) => coordinatorPlanningEnabled || category.categoryId !== 'eventOrganizers')
      .map((category) => category.categoryId)
  }, [configuredPlanningCategories, coordinatorPlanningEnabled, hasConfiguredPlanningBudget])
  const planningServiceCategories = React.useMemo(() => {
    const categoriesById = new Map(
      serviceCategories.map((category) => [categoryNameToId(category.name), category])
    )

    return planningCategoryIds.map((categoryId) =>
      categoriesById.get(categoryId)
        ?? fallbackServiceCategories.find((category) => category.id === categoryId)
    ).filter((category): category is ServiceCategoryOption => Boolean(category))
  }, [planningCategoryIds, serviceCategories])
  const planningMarketplaceCategoryIds = React.useMemo(
    () => new Set(planningServiceCategories.map((category) => categoryNameToId(category.name))),
    [planningServiceCategories]
  )
  const defaultPlanningCategory = firstServicePlanningCategory
    ?? firstPlanningCategory
    ?? planningCategoryIds[0]
    ?? 'catering'
  const planningCategoryBudgets = React.useMemo<Partial<Record<CatalogCategoryId, number>>>(() => (
    Object.fromEntries(configuredPlanningCategories.map((category) => [
      category.categoryId,
      planningBudgetAllocations.find((allocation) => (
        allocation.categoryKey === category.categoryKey
      ))?.amount ?? 0,
    ]))
  ), [configuredPlanningCategories, planningBudgetAllocations])
  const planningCatalogServices = React.useMemo(
    () => catalogServices.filter((service) => planningMarketplaceCategoryIds.has(service.categoryId)),
    [catalogServices, planningMarketplaceCategoryIds]
  )
  const addablePlanningServiceCategories = React.useMemo(() => {
    const categoriesById = new Map(
      serviceCategories.map((category) => [categoryNameToId(category.name), category])
    )
    const configuredCategoryIds = new Set(planningCategoryIds)

    return PLANNING_CATEGORY_PRIORITY
      .filter((category) => category.categoryId !== 'eventOrganizers')
      .filter((category) => !configuredCategoryIds.has(category.categoryId))
      .map((category) => categoriesById.get(category.categoryId)
        ?? fallbackServiceCategories.find((fallback) => fallback.id === category.categoryId))
      .filter((category): category is ServiceCategoryOption => Boolean(category))
  }, [planningCategoryIds, serviceCategories])
  const unallocatedPlanningCategoryCount = React.useMemo(
    () => addablePlanningServiceCategories.length,
    [addablePlanningServiceCategories]
  )
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
  const [merchantHomeEarnings, setMerchantHomeEarnings] =
    React.useState<MerchantEarningsOverview>()
  const [merchantPayoutPeriod, setMerchantPayoutPeriod] =
    React.useState<PayoutEarningsPeriod>('30d')
  const [merchantPayoutError, setMerchantPayoutError] = React.useState('')
  const [isMerchantPayoutLoading, setIsMerchantPayoutLoading] = React.useState(false)
  const [isMerchantHomeEarningsLoading, setIsMerchantHomeEarningsLoading] = React.useState(false)
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
  const [isSubmittingBookingRequests, setIsSubmittingBookingRequests] = React.useState(false)
  // State updates are asynchronous, so state alone cannot protect two taps
  // that arrive in the same render frame. Keep this guard outside the render
  // cycle until the current booking-request submission has settled.
  const bookingRequestSubmissionInFlight = React.useRef(false)
  const [coordinatorDashboard, setCoordinatorDashboard] =
    React.useState<CoordinatorDashboard>(emptyCoordinatorDashboard())
  const [selectedCoordinatorEventId, setSelectedCoordinatorEventId] = React.useState('')
  const [coordinatorChurchDrafts, setCoordinatorChurchDrafts] = React.useState<
    Record<string, ChurchArrangementDraft>
  >({})
  const [coordinatorHomeView, setCoordinatorHomeView] = React.useState<CoordinatorView>('overview')
  const coordinatorHomeScrollOffsetRef = React.useRef(0)
  const coordinatorWorkspaceSessionRef = React.useRef('')
  const coordinatorWorkspaceRequestRef = React.useRef<Promise<void> | null>(null)
  const merchantPayoutRequestRef = React.useRef<{
    id: number
    period: PayoutEarningsPeriod
    request: Promise<void>
  } | null>(null)
  const merchantPayoutRequestIdRef = React.useRef(0)
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
  const [supportReturnScreen, setSupportReturnScreen] = React.useState<AppScreen>('accountProfile')
  const [clientRefundsReturnScreen, setClientRefundsReturnScreen] = React.useState<AppScreen>('accountProfile')
  const [clientRefundOverview, setClientRefundOverview] = React.useState<ClientRefundOverview>(emptyClientRefundOverview())
  const [clientRefundOverviewError, setClientRefundOverviewError] = React.useState('')
  const [isClientRefundOverviewLoading, setIsClientRefundOverviewLoading] = React.useState(false)
  const [isClientRefundOverviewRefreshing, setIsClientRefundOverviewRefreshing] = React.useState(false)

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

  const openPlanningHub = React.useCallback((
    direction?: 'forward' | 'back',
    preferredCategory?: CatalogCategoryId
  ) => {
    setServiceBrowseMode('planning')
    setSelectedCategory((current) => {
      if (preferredCategory) return preferredCategory
      if (planningMarketplaceCategoryIds.has(current)) return current
      return defaultPlanningCategory
    })
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
  }, [categoryBrowseEntrance, defaultPlanningCategory, planningMarketplaceCategoryIds, setScreen, width])
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

  const loadClientRefundOverview = React.useCallback(async (refreshing = false) => {
    if (refreshing) setIsClientRefundOverviewRefreshing(true)
    else setIsClientRefundOverviewLoading(true)

    const result = await fetchClientRefundOverview()
    if (result.ok && result.data) {
      setClientRefundOverview(result.data)
      setClientRefundOverviewError('')
    } else {
      setClientRefundOverviewError(result.message ?? 'Unable to load your refund records.')
    }

    setIsClientRefundOverviewLoading(false)
    setIsClientRefundOverviewRefreshing(false)
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
    clearClientPlanningResume()
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
      setExploreFavoritesOnly(false)
      setServiceBrowseMode('explore')
      setScreen('categoryBrowse')
    }
    if (tab === 'bookings') setScreen('bookings')
    if (tab === 'messages') {
      setMessageWorkspace('client')
      setScreen('messages')
    }
    if (tab === 'profile') openAccountProfile('clientHome')
  }
  const openMerchantTab = (tab: MerchantHomeTab) => {
    setHomeReturnScreen('providerHome')
    if (tab === 'home') setScreen('providerHome')
    if (tab === 'services') setScreen('providerServices')
    if (tab === 'bookings') setScreen('providerBookingRequests')
    if (tab === 'messages') {
      setMessageWorkspace('merchant')
      setScreen('messages')
    }
    if (tab === 'profile') openProviderProfile()
  }
  const openCoordinatorTab = (tab: CoordinatorMainTab) => {
    if (tab === 'home') {
      setCoordinatorHomeView('overview')
      setScreen('coordinatorHome')
      return
    }
    if (tab === 'events' || tab === 'tasks') {
      setCoordinatorHomeView(tab)
      setScreen('coordinatorHome')
      return
    }
    if (tab === 'messages') {
      setMessageWorkspace('coordinator')
      setScreen('messages')
      void fetchConversations().then(setConversations)
      return
    }
    openAccountProfile('coordinatorHome')
  }
  const openMessageTab = (tab: ClientHomeTab | MerchantHomeTab) => {
    if (homeReturnScreen === 'providerHome') {
      openMerchantTab(tab === 'explore' ? 'services' : tab)
      return
    }

    openClientTab(tab === 'services' ? 'explore' : tab)
  }
  const eventDisplayName = eventDetails.eventName.trim() || 'Untitled event'
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
  const selectedCategoryBudget = planningBudgetAllocations.find(
    (allocation) => allocation.categoryKey === selectedBudgetKey
  )?.amount ?? 0
  const venueCateringPackageSelection = selectedServices.find((service) => (
    service.includesCatering
    && !['cancelled', 'deleted', 'rejected', 'removed'].includes(service.status.trim().toLowerCase())
  ))
  const venueCateringPackageAllocatedBudget = planningBudgetAllocations
    .filter((allocation) => allocation.categoryKey === 'venue' || allocation.categoryKey === 'catering')
    .reduce((sum, allocation) => sum + allocation.amount, 0)
  const activePlanningSelectionAmounts = React.useMemo(() => {
    const selections = selectedServices
      .filter((service) => !['cancelled', 'deleted', 'rejected', 'removed'].includes(service.status.trim().toLowerCase()))
      .map((service) => ({
        categoryId: categoryNameToId(service.category),
        price: service.price,
      }))

    if (assignedCoordinator) {
      selections.push({ categoryId: 'eventOrganizers', price: assignedCoordinator.price })
    }

    return selections
  }, [assignedCoordinator, selectedServices])
  const unallocatedPlanBudget = React.useMemo(
    () => calculateUnallocatedPlanningBudget(
      totalBudget,
      planningBudgetAllocations,
      activePlanningSelectionAmounts
    ),
    [activePlanningSelectionAmounts, planningBudgetAllocations, totalBudget]
  )
  const categoryBudgetMaximum = calculateCategoryBudgetMaximum(
    selectedCategoryBudget,
    unallocatedPlanBudget
  )
  const selectedPlanningCategoryIds = React.useMemo(() => {
    const ids = new Set(selectedServices
      .filter((service) => !['cancelled', 'deleted', 'rejected', 'removed'].includes(service.status.trim().toLowerCase()))
      .map((service) => categoryNameToId(service.category)))
    // This package is a single venue booking. Mark Catering as fulfilled only
    // for planning progress; do not add a standalone catering selection.
    if (selectedServices.some((service) => service.includesCatering
      && !['cancelled', 'deleted', 'rejected', 'removed'].includes(service.status.trim().toLowerCase()))) {
      ids.add('catering')
    }
    return ids
  }, [selectedServices])
  const selectableServicePlanningCategories = React.useMemo(
    () => (hasConfiguredPlanningBudget
      ? configuredPlanningCategories
      : PLANNING_CATEGORY_PRIORITY
    ).filter((category) => category.categoryId !== 'eventOrganizers'),
    [configuredPlanningCategories, hasConfiguredPlanningBudget]
  )
  const getNextPlanningServiceCategory = React.useCallback(
    (selectedCategoryIds: ReadonlySet<CatalogCategoryId>) => {
      if (!hasConfiguredPlanningBudget) {
        return getNextUnselectedServicePlanningCategory(
          planningBudgetAllocations,
          selectedCategoryIds
        ) ?? selectableServicePlanningCategories.find(
          (category) => !selectedCategoryIds.has(category.categoryId)
        )?.categoryId
      }
      return selectableServicePlanningCategories.find(
        (category) => !selectedCategoryIds.has(category.categoryId)
      )?.categoryId
    },
    [hasConfiguredPlanningBudget, planningBudgetAllocations, selectableServicePlanningCategories]
  )
  const activeServicePlanningCategories = React.useMemo(
    () => configuredPlanningCategories.filter((category) => category.categoryId !== 'eventOrganizers'),
    [configuredPlanningCategories]
  )
  const requiresCoordinatorSelection = eventDetails.wantsCoordinator === true && hasEventOrganizerBudget
  const planningSelectionsComplete = (
    activeServicePlanningCategories.length > 0 || requiresCoordinatorSelection
  ) && activeServicePlanningCategories.every((category) =>
    selectedPlanningCategoryIds.has(category.categoryId)
  ) && (!requiresCoordinatorSelection || Boolean(assignedCoordinator))
  React.useEffect(() => {
    if (!planningSelectionsComplete) setSelectionCompletionAcknowledged(false)
  }, [planningSelectionsComplete])
  const categoryBudgetLocked = selectedServices.some(
    (service) => service.category.toLowerCase() === catalogCategoryName(selectedCategory).toLowerCase()
  ) || (selectedCategory === 'eventOrganizers' && Boolean(assignedCoordinator))
  const currentService = catalogServices.find((service) => service.id === currentServiceId)
  const currentReviewServiceId = currentService?.bookingServiceId ?? currentService?.id

  React.useEffect(() => {
    const coordinatorPlanningScreen = screen === 'coordinatorDetails'
      && serviceBrowseMode === 'planning'
    if (hasEventOrganizerBudget || !coordinatorPlanningScreen) return

    openPlanningHub('forward', defaultPlanningCategory)
  }, [defaultPlanningCategory, hasEventOrganizerBudget, openPlanningHub, screen, serviceBrowseMode])

  React.useEffect(() => {
    if (screen !== 'categoryBrowse' || serviceBrowseMode !== 'planning') return
    if (planningMarketplaceCategoryIds.has(selectedCategory)) return

    setSelectedCategory(defaultPlanningCategory)
  }, [
    defaultPlanningCategory,
    planningMarketplaceCategoryIds,
    screen,
    selectedCategory,
    serviceBrowseMode,
  ])

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
  const summaryItems: EventSummaryOrderItem[] = [
    ...selectedServices.map((service) => {
      const catalogService = catalogServices.find((candidate) => (
        candidate.id === service.id || candidate.bookingServiceId === service.id
      ))
      return {
        category: service.category,
        commissionAmount: service.commissionAmount,
        commissionRate: service.commissionRate,
        detail: service.detail,
        id: service.id,
        name: service.name,
        price: service.price,
        providerName: catalogService?.providerName ?? 'Selected service provider',
        providerPrice: service.providerPrice,
      }
    }),
    ...(assignedCoordinator
      ? [{
          category: 'Event Coordinator',
          commissionAmount: assignedCoordinator.commissionAmount,
          commissionRate: assignedCoordinator.commissionRate,
          detail: assignedCoordinator.status === 'accepted'
            ? 'Coordinator accepted for this event.'
            : 'Coordinator will receive a booking request.',
          id: assignedCoordinator.id,
          isCoordinator: true,
          name: assignedCoordinator.name,
          price: assignedCoordinator.price,
          providerName: assignedCoordinator.name,
          providerPrice: assignedCoordinator.providerPrice,
        }]
      : []),
  ]
  const payableItems =
    summaryItems.length > 0
      ? summaryItems
      : [
          {
            category: 'Services',
            commissionAmount: 0,
            commissionRate: DEFAULT_COMMISSION_RATE,
            detail: 'Add services first to build a real order.',
            id: 'empty-plan',
            name: 'No selected services yet',
            price: 0,
            providerName: 'Not selected',
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
  const eventSummary: EventSummaryDetails = {
    churchWedding: eventDetails.eventType === 'wedding' && eventDetails.wantsCoordinator === true
      ? (typeof eventDetails.isChurchWedding === 'boolean'
        ? eventDetails.isChurchWedding ? 'Yes' : 'No'
        : 'Not specified')
      : undefined,
    coordinatorPreference: eventDetails.wantsCoordinator === true
      ? assignedCoordinator
        ? `Yes — ${assignedCoordinator.name}`
        : 'Yes — selecting a coordinator'
      : 'No — self-managed event',
    date: eventDisplayDate,
    eventType: eventDetails.eventType === 'preWedding'
      ? 'Pre-wedding'
      : eventDetails.eventType === 'postWedding'
        ? 'Post-wedding'
        : 'Wedding',
    guestCount: eventDetails.guestCount,
    location: eventDetails.venueName?.trim()
      || eventDetails.venueAddress?.trim()
      || 'Venue to be confirmed',
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

  const hydrateClientPlanningState = React.useCallback((
    planningState: ClientPlanningState,
    services: CatalogService[]
  ) => {
    // A late network response must never replace partially edited basics with
    // the older persisted draft while the client is still in the flow.
    // A route-to-home refresh can race with a just-restored local draft.
    // Keep the client's latest captured inputs when that happens.
    const localResume = clientPlanningResumeRef.current
    if (localResume.eventDetails) {
      setEventDetails(localResume.eventDetails)
    } else if (planningState.event && !eventDetailsDirtyRef.current) {
      setEventDetails(planningState.event)
    }
    if (localResume.budgetDraft) {
      setTotalBudget(localResume.budgetDraft.budget)
      setBudgetAllocations(localResume.budgetDraft.allocations)
      setBudgetPriorities(localResume.budgetDraft.priorities)
    } else {
      if (planningState.totalBudget !== undefined) setTotalBudget(planningState.totalBudget)
      setBudgetAllocations(planningState.budgetAllocations ?? [])
      setBudgetPriorities(planningState.budgetPriorities ?? [])
    }
    setCoordinatorBudgetCost(planningState.coordinatorBudgetCost ?? 0)
    setAssignedCoordinator(planningState.assignedCoordinator)
    setCoordinatorAssignmentStatus(planningState.coordinatorAssignmentStatus)
    setCoordinatorPreferenceState(planningState.coordinatorPreference ?? 'undecided')
    setSelectedCoordinatorPackage(planningState.coordinatorPackage)
    setSelectedServices(planningState.selectedServices)
    setLastPayment(planningState.lastPayment)
    setMaxPlanningStep(planningState.maxPlanningStep ?? 1)
    setCurrentServiceId((current) =>
      services.some((service) => service.id === current) ? current : services[0]?.id ?? ''
    )
  }, [])

  const loadClientBookings = React.useCallback(() => {
    const inFlightRequest = clientBookingsRequestRef.current
    if (inFlightRequest) return inFlightRequest

    const request = fetchClientBookings()
    clientBookingsRequestRef.current = request
    void request.then(
      () => {
        if (clientBookingsRequestRef.current === request) clientBookingsRequestRef.current = null
      },
      () => {
        if (clientBookingsRequestRef.current === request) clientBookingsRequestRef.current = null
      }
    )
    return request
  }, [])

  const refreshLiveData = React.useCallback((): Promise<ClientPlanningState> => {
    const inFlightRefresh = refreshLiveDataInFlightRef.current
    if (inFlightRefresh) return inFlightRefresh

    const refresh = (async (): Promise<ClientPlanningState> => {
    const favoriteStateRevisionAtStart = favoriteStateRevisionRef.current
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
      eventDrafts,
      savedPlans,
      favorites,
    ] = await Promise.all([
      loadClientCatalogServices(),
      loadClientBookings(),
      fetchMerchantBookingRequests(),
      fetchMerchantServices(),
      loadMerchantServiceDraft(),
      fetchConversations(),
      fetchNotifications(),
      fetchClientPlanningState(),
      fetchServiceCategories(),
      fetchClientEventDrafts(),
      fetchClientSavedPlans(),
      fetchFavoriteServiceIds(),
    ])

    setCatalogServices(services)
    setClientBookings(bookings)
    setSelectedBooking((current) => {
      if (!current) return current
      return bookings.find((item) =>
        item.id === current.id || Boolean(item.eventId && current.eventId && item.eventId === current.eventId)
      ) ?? current
    })
    setMerchantRequests(requests)
    setSelectedMerchantRequest((current) => {
      if (!current) return current
      return requests.find((item) =>
        item.id === current.id || Boolean(item.eventId && current.eventId && item.eventId === current.eventId)
      ) ?? current
    })
    setMerchantServices((current) =>
      merchantServiceRows.length > 0 ? merchantServiceRows : current
    )
    setConversations(conversationRows)
    setNotifications(notificationRows)
    setServiceCategories(categories)
    if (favorites.ok && favoriteStateRevisionAtStart === favoriteStateRevisionRef.current) {
      setFavoriteServiceIds(favorites.ids)
    }
    hydrateClientPlanningState(planningState, services)
    setClientEventDrafts(eventDrafts)
    setClientSavedPlans(savedPlans)

    setHasMerchantDraft(Boolean(draft))
    if (draft?.information) setMerchantServiceInfo(draft.information)
    if (draft?.pricing) setMerchantServicePricing(draft.pricing)
    setMerchantPackages([])
    return planningState
    })()

    refreshLiveDataInFlightRef.current = refresh
    void refresh.then(
      () => {
        if (refreshLiveDataInFlightRef.current === refresh) refreshLiveDataInFlightRef.current = null
      },
      () => {
        if (refreshLiveDataInFlightRef.current === refresh) refreshLiveDataInFlightRef.current = null
      }
    )
    return refresh
  }, [hydrateClientPlanningState, loadClientBookings])

  const handleToggleFavorite = React.useCallback(async (serviceId: string) => {
    if (favoriteTogglesInFlightRef.current.has(serviceId)) return

    const wasFavorited = favoriteServiceIds.has(serviceId)
    favoriteStateRevisionRef.current += 1
    favoriteTogglesInFlightRef.current.add(serviceId)
    setFavoritePendingServiceIds((current) => new Set(current).add(serviceId))
    setFavoriteServiceIds((current) => {
      const next = new Set(current)
      if (wasFavorited) next.delete(serviceId)
      else next.add(serviceId)
      return next
    })

    try {
      const result = await toggleFavoriteService(serviceId)
      if (!result.ok) {
        favoriteStateRevisionRef.current += 1
        setFavoriteServiceIds((current) => {
          const next = new Set(current)
          if (wasFavorited) next.add(serviceId)
          else next.delete(serviceId)
          return next
        })
        setToastMessage(result.message ?? 'Unable to update this saved service.')
        return
      }

      setFavoriteServiceIds((current) => {
        const next = new Set(current)
        if (result.isFavorited) next.add(serviceId)
        else next.delete(serviceId)
        return next
      })
      const completedRevision = ++favoriteStateRevisionRef.current
      const refreshedFavorites = await fetchFavoriteServiceIds()
      if (refreshedFavorites.ok && favoriteStateRevisionRef.current === completedRevision) {
        setFavoriteServiceIds(refreshedFavorites.ids)
      }
    } finally {
      favoriteTogglesInFlightRef.current.delete(serviceId)
      setFavoritePendingServiceIds((current) => {
        const next = new Set(current)
        next.delete(serviceId)
        return next
      })
    }
  }, [favoriteServiceIds])

  const refreshClientHome = React.useCallback(async () => {
    if (isClientHomeRefreshing) return
    setIsClientHomeRefreshing(true)
    try {
      await refreshLiveData()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setToastMessage(/network|fetch|offline|internet/i.test(message)
        ? 'You appear to be offline. Check your connection and pull to refresh again.'
        : 'Unable to refresh your home data. Please try again.')
    } finally {
      setIsClientHomeRefreshing(false)
    }
  }, [isClientHomeRefreshing, refreshLiveData])

  const openInboxTrash = React.useCallback(async (scope: InboxTrashScope = 'all') => {
    if (isInboxTrashLoading) return
    setInboxTrashScope(scope)
    setIsInboxTrashVisible(true)
    setIsInboxTrashLoading(true)
    const result = await loadMyInboxTrash()
    setIsInboxTrashLoading(false)
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to load Inbox Trash.')
      return
    }
    setInboxTrashItems(result.items ?? [])
  }, [isInboxTrashLoading])

  const mutateInboxTrash = React.useCallback(async (
    operation: 'clear' | 'restore' | 'trash',
    itemsByType: Array<{ ids: string[]; itemType: InboxItemType }>
  ) => {
    if (isInboxTrashMutating || !itemsByType.length) return false
    setIsInboxTrashMutating(true)
    try {
      const results = await Promise.all(itemsByType.map(({ ids, itemType }) => (
        operation === 'trash'
          ? moveMyInboxItemsToTrash(itemType, ids)
          : operation === 'restore'
            ? restoreMyInboxItems(itemType, ids)
            : clearMyInboxItems(itemType, ids)
      )))
      const failed = results.find((result) => !result.ok)
      if (failed) {
        setToastMessage(failed.message ?? 'Unable to update the selected Inbox items.')
        await refreshLiveData().catch(() => undefined)
        return false
      }

      await refreshLiveData().catch(() => undefined)
      if (operation !== 'trash') {
        const trashResult = await loadMyInboxTrash()
        if (trashResult.ok) setInboxTrashItems(trashResult.items ?? [])
      }
      setToastMessage(operation === 'trash'
        ? 'Selected items moved to Trash.'
        : operation === 'restore'
          ? 'Selected Inbox items restored.'
          : 'Selected items were permanently cleared from your view.')
      return true
    } finally {
      setIsInboxTrashMutating(false)
    }
  }, [isInboxTrashMutating, refreshLiveData])

  React.useEffect(() => {
    if (!authenticatedUserId) return undefined

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshLiveData()
    })

    return () => appStateSubscription.remove()
  }, [authenticatedUserId, refreshLiveData])

  const refreshClientBookings = React.useCallback(async () => {
    const bookings = await loadClientBookings()
    setClientBookings(bookings)
    setSelectedBooking((current) => {
      if (!current) return current
      return bookings.find((item) =>
        item.id === current.id || Boolean(item.eventId && current.eventId && item.eventId === current.eventId)
      ) ?? current
    })
  }, [loadClientBookings])

  const restoreClientPlanningResume = React.useCallback(async (
    userId: string,
    planningState: ClientPlanningState
  ) => {
    try {
      const serialized = await AsyncStorage.getItem(clientPlanningResumeStorageKey(userId))
      if (!serialized) return false

      const parsed: unknown = JSON.parse(serialized)
      if (
        !parsed
        || typeof parsed !== 'object'
        || (parsed as { version?: unknown }).version !== 1
        || !clientPlanningResumeScreens.has((parsed as { screen?: ClientPlanningResumeScreen }).screen as ClientPlanningResumeScreen)
      ) {
        return false
      }

      const resume = parsed as ClientPlanningResumeState
      if (
        resume.eventId
        && !resume.savedPlanId
        && planningState.draftSummary?.id
        && planningState.draftSummary.id !== resume.eventId
      ) {
        clearClientPlanningResume()
        return false
      }

      clientPlanningResumeRef.current = resume
      if (resume.eventDetails) {
        eventDetailsDirtyRef.current = true
        setEventDetails(resume.eventDetails)
      }
      if (resume.budgetDraft) {
        setBudgetAllocations(resume.budgetDraft.allocations)
        setBudgetPriorities(resume.budgetDraft.priorities)
        setTotalBudget(resume.budgetDraft.budget)
      }
      if (resume.instructionDraft) setInstructionDraft(resume.instructionDraft)
      if (resume.photoVideoSelectionDraft) setPhotoVideoSelectionDraft(resume.photoVideoSelectionDraft)
      if (resume.selectedCategory) setSelectedCategory(resume.selectedCategory)
      if (resume.currentServiceId) setCurrentServiceId(resume.currentServiceId)
      setServiceBrowseMode('planning')

      let restoredPlanningState = planningState
      if (resume.savedPlanId && resume.screen === 'payment') {
        const savedPlanResult = await resumeClientSavedPlan(resume.savedPlanId)
        if (savedPlanResult.ok && savedPlanResult.savedPlanReview) {
          setSavedPlanReview(savedPlanResult.savedPlanReview)
          restoredPlanningState = await refreshLiveData()
        }
      }

      let resumeScreen = resume.screen
      if (
        (resumeScreen === 'serviceDetails' || resumeScreen === 'coordinatorDetails')
        && !resume.currentServiceId
      ) {
        resumeScreen = 'categoryBrowse'
      }
      if (
        (resumeScreen === 'instructionModule' || resumeScreen === 'payment')
        && restoredPlanningState.selectedServices.length === 0
        && !restoredPlanningState.assignedCoordinator
      ) {
        resumeScreen = 'categoryBrowse'
      }

      // Authentication may have just started the Home-screen transition. Retry
      // briefly after it completes so restoring a draft cannot be ignored by
      // the navigation lock that prevents double taps elsewhere in the app.
      const showResumeScreen = (attempt = 0) => {
        if (navigationLockedRef.current && attempt < 8) {
          setTimeout(() => showResumeScreen(attempt + 1), 50)
          return
        }
        transitionToScreen(resumeScreen)
      }
      showResumeScreen()
      return true
    } catch {
      return false
    }
  }, [clearClientPlanningResume, refreshLiveData, transitionToScreen])

  React.useEffect(() => {
    if (screen === 'clientHome') void refreshLiveData()
  }, [refreshLiveData, screen])

  const loadCoordinatorWorkspace = React.useCallback(async (
    refreshing = false,
    silent = false
  ) => {
    if (coordinatorWorkspaceRequestRef.current) {
      await coordinatorWorkspaceRequestRef.current
      return
    }

    const request = (async () => {
      if (!silent) {
        if (refreshing) setIsCoordinatorRefreshing(true)
        else setIsCoordinatorLoading(true)
      }

      try {
        const result = await fetchCoordinatorDashboard()
        if (result.ok && result.data) {
          setCoordinatorDashboard(result.data)
          setCoordinatorError('')
          coordinatorWorkspaceSessionRef.current = authenticatedUserId || 'authenticated'
        } else {
          setCoordinatorError(result.message ?? 'Unable to load the coordinator workspace.')
        }
      } finally {
        if (!silent) {
          setIsCoordinatorLoading(false)
          setIsCoordinatorRefreshing(false)
        }
      }
    })()

    coordinatorWorkspaceRequestRef.current = request
    try {
      await request
    } finally {
      if (coordinatorWorkspaceRequestRef.current === request) {
        coordinatorWorkspaceRequestRef.current = null
      }
    }
  }, [authenticatedUserId])

  React.useEffect(() => {
    if (screen !== 'coordinatorHome') return
    const sessionKey = authenticatedUserId || 'authenticated'
    if (coordinatorWorkspaceSessionRef.current === sessionKey) return
    void loadCoordinatorWorkspace()
  }, [authenticatedUserId, loadCoordinatorWorkspace, screen])

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
    const inFlightRequest = merchantPayoutRequestRef.current
    if (inFlightRequest?.period === period) {
      await inFlightRequest.request
      return
    }

    if (!silent) {
      if (refreshing) setIsMerchantPayoutRefreshing(true)
      else setIsMerchantPayoutLoading(true)
    }

    const requestId = merchantPayoutRequestIdRef.current + 1
    merchantPayoutRequestIdRef.current = requestId
    const request = (async () => {
      try {
        const result = await fetchMerchantPayoutDashboard(period)
        if (merchantPayoutRequestIdRef.current !== requestId) return

        if (result.ok && result.data) {
          setMerchantPayoutDashboard(result.data)
          setMerchantHomeEarnings({
            currency: result.data.summary.currency,
            periodEarnings: result.data.summary.periodEarnings,
            trend: result.data.earningsTrend,
          })
          setMerchantPayoutError('')
        } else {
          setMerchantPayoutError(result.message ?? 'Unable to load recorded earnings.')
        }
      } finally {
        if (!silent && merchantPayoutRequestIdRef.current === requestId) {
          setIsMerchantPayoutLoading(false)
          setIsMerchantPayoutRefreshing(false)
        }
      }
    })()

    merchantPayoutRequestRef.current = { id: requestId, period, request }
    try {
      await request
    } finally {
      if (merchantPayoutRequestRef.current?.id === requestId) {
        merchantPayoutRequestRef.current = null
      }
    }
  }, [])

  const loadMerchantHomeEarnings = React.useCallback(async () => {
    setIsMerchantHomeEarningsLoading(true)
    const result = await fetchMerchantEarningsOverview()
    if (result.ok && result.data) setMerchantHomeEarnings(result.data)
    setIsMerchantHomeEarningsLoading(false)
  }, [])

  React.useEffect(() => {
    if (screen !== 'providerHome') return
    void loadMerchantHomeEarnings()
  }, [loadMerchantHomeEarnings, screen])

  React.useEffect(() => {
    if (screen !== 'clientRefunds') return
    void loadClientRefundOverview()
  }, [loadClientRefundOverview, screen])

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
    setToastMessage('Payout request submitted for review.')
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
    if (screen !== 'coordinatorHome' && screen !== 'coordinatorEventDetails') return undefined

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
          wallet: current.wallet,
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

  const markConversationInboxRead = React.useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId ? { ...item, unreadCount: 0 } : item
      )
    )
    setNotifications((current) => current.map((notification) => (
      notification.resourceId === conversationId && isMessageUpdate(notification)
        ? { ...notification, isRead: true }
        : notification
    )))

    void Promise.all([
      markConversationRead(conversationId),
      markConversationMessageNotificationsRead(conversationId),
    ]).then(([conversationUpdated, notificationsUpdated]) => {
      if (!conversationUpdated || !notificationsUpdated) {
        void refreshLiveData().catch(() => undefined)
      }
    })
  }, [refreshLiveData])

  const openExistingConversation = React.useCallback(
    async (conversation: ClientConversation, returnScreen: AppScreen = 'messages') => {
      setSelectedConversation(conversation)
      setConversationMessages([])
      setIsLoadingConversationMessages(true)
      setChatReturnScreen(returnScreen)
      setScreen('chatThread')

      const [messages] = await Promise.all([
        fetchConversationMessages(conversation.id),
        markConversationInboxRead(conversation.id),
      ])

      setConversationMessages(messages)
      setIsLoadingConversationMessages(false)
    },
    [markConversationInboxRead, setScreen]
  )

  const openBookingConversationFor = React.useCallback(
    async (bookingId: string | undefined, returnScreen: AppScreen = 'messages') => {
      if (!bookingId) {
        setToastMessage('A conversation becomes available after the provider confirms the booking.')
        return
      }

      const result = await openBookingConversation(bookingId)
      if (!result.ok || !result.conversationId) {
        setToastMessage(result.error ?? 'This booking conversation is not available to your account.')
        return
      }

      const latestConversations = await fetchConversations()
      const conversation = latestConversations.find((item) => item.id === result.conversationId)
      if (!conversation) {
        setToastMessage('The conversation was opened, but it could not be loaded yet. Pull to refresh and try again.')
        return
      }

      setConversations(latestConversations)
      await openExistingConversation(conversation, returnScreen)
    },
    [openExistingConversation]
  )

  const openEventCoordinatorConversationFor = React.useCallback(
    async (eventId: string | undefined, returnScreen: AppScreen = 'messages') => {
      if (!eventId) {
        setToastMessage('A coordinator conversation is not available for this event yet.')
        return
      }
      const result = await openEventCoordinatorConversation(eventId)
      if (!result.ok || !result.conversationId) {
        setToastMessage(result.error ?? 'This coordinator conversation is not available to your account.')
        return
      }
      const latestConversations = await fetchConversations()
      const conversation = latestConversations.find((item) => item.id === result.conversationId)
      if (!conversation) {
        setToastMessage('The conversation was opened, but it could not be loaded yet. Pull to refresh and try again.')
        return
      }
      setConversations(latestConversations)
      await openExistingConversation(conversation, returnScreen)
    },
    [openExistingConversation]
  )

  const handleCoordinatorMessageProvider = React.useCallback(
    async (
      _event: CoordinatorEvent,
      service: CoordinatorBookedService,
      returnScreen: AppScreen = 'coordinatorHome'
    ) => {
      if (!service.bookingId) {
        setToastMessage('A provider conversation becomes available after the client-selected booking is created.')
        return
      }
      const result = await openCoordinatorProviderConversation(service.bookingId)
      if (!result.ok || !result.conversationId) {
        setToastMessage(result.error ?? 'This provider conversation is not available to your account.')
        return
      }
      const latestConversations = await fetchConversations()
      const conversation = latestConversations.find((item) => item.id === result.conversationId)
      if (!conversation) {
        setToastMessage('The conversation was opened, but it could not be loaded yet. Pull to refresh and try again.')
        return
      }
      setConversations(latestConversations)
      await openExistingConversation(conversation, returnScreen)
    },
    [openExistingConversation]
  )

  const handleCoordinatorMessageClient = React.useCallback(
    async (event: CoordinatorEvent, returnScreen: AppScreen = 'coordinatorHome') => {
      await openEventCoordinatorConversationFor(event.id, returnScreen)
    },
    [openEventCoordinatorConversationFor]
  )

  const handleSaveChurchArrangement = React.useCallback(async (
    input: Parameters<typeof saveCoordinatorChurchWeddingArrangement>[0]
  ) => {
    const result = await saveCoordinatorChurchWeddingArrangement(input)
    if (result.ok) {
      setToastMessage('Church arrangement saved. This does not create a church reservation.')
      await loadCoordinatorWorkspace(true, true)
    }
    return result
  }, [loadCoordinatorWorkspace])

  const handleConfirmChurchArrangement = React.useCallback(async (
    input: Parameters<typeof confirmCoordinatorChurchWeddingArrangement>[0]
  ) => {
    const result = await confirmCoordinatorChurchWeddingArrangement(input)
    if (result.ok) {
      setToastMessage('Church arrangement confirmed. The client was notified; this does not verify an external reservation.')
      await loadCoordinatorWorkspace(true, true)
    }
    return result
  }, [loadCoordinatorWorkspace])

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
        return undefined
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
        return undefined
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
      return resolvedRole
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
        const resolvedRole = await loadProfileAndRoute(data.session.user.id, {
          ...data.session.user.user_metadata,
          email: data.session.user.email,
        })
        if (!isMounted) return

        const planningState = await refreshLiveData()
        if (isMounted && resolvedRole === 'client') {
          await restoreClientPlanningResume(data.session.user.id, planningState)
        }
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
          setConversations([])
          setNotifications([])
          setHomeReturnScreen('clientHome')
          setMessageWorkspace('client')
          setAccountProfile(undefined)
          setUserAvatarUrl('')
          setAccountProfileError('')
          setMaxPlanningStep(1)
          setBudgetPriorities([])
          setBudgetAllocations([])
          setCoordinatorBudgetCost(0)
          setClientEventDrafts([])
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
        void (async () => {
          const resolvedRole = await loadProfileAndRoute(session.user.id, {
            ...session.user.user_metadata,
            email: session.user.email,
          })
          const planningState = await refreshLiveData()
          if (resolvedRole === 'client') {
            await restoreClientPlanningResume(session.user.id, planningState)
          }
        })()
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfileAndRoute, refreshLiveData, restoreClientPlanningResume, setScreen])

  const openNotificationDestination = React.useCallback(
    (resourceType?: string, resourceId?: string) => {
      const normalizedType = resourceType?.toLowerCase() ?? ''
      if (normalizedType.includes('message') || normalizedType.includes('conversation')) {
        setMessageWorkspace(
          screenRef.current.startsWith('coordinator') || messageWorkspace === 'coordinator'
            ? 'coordinator'
            : homeReturnScreen === 'providerHome'
              ? 'merchant'
              : 'client'
        )
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
      if (!screenRef.current.startsWith('coordinator') && homeReturnScreen !== 'providerHome') {
        setMessageWorkspace('client')
      }
      setScreen(
        screenRef.current.startsWith('coordinator')
          ? 'coordinatorNotifications'
          : homeReturnScreen === 'providerHome'
            ? 'providerNotifications'
            : 'notifications'
      )
    },
    [homeReturnScreen, messageWorkspace, setScreen]
  )

  React.useEffect(() => {
    const notificationModule = Notifications
    if (
      !authenticatedUserId
      || Platform.OS === 'web'
      || !supportsRemotePushNotifications
      || !notificationModule
    ) return undefined

    let active = true
    void registerCurrentDeviceForPush().then((result) => {
      if (!active || result.ok) return
      if (__DEV__) console.warn(`Push registration: ${result.message ?? 'not available'}`)
    })

    let tokenSubscription: { remove: () => void } | undefined
    try {
      tokenSubscription = notificationModule.addPushTokenListener(() => {
        void registerCurrentDeviceForPush()
      })
    } catch (error) {
      if (__DEV__) {
        console.warn(
          `Push token listener is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`
        )
      }
    }

    return () => {
      active = false
      tokenSubscription?.remove()
    }
  }, [authenticatedUserId])

  React.useEffect(() => {
    const notificationModule = Notifications
    if (Platform.OS === 'web' || !supportsRemotePushNotifications || !notificationModule) {
      return undefined
    }

    const receivedSubscription = notificationModule.addNotificationReceivedListener(() => {
      void refreshLiveData()
    })
    const responseSubscription = notificationModule.addNotificationResponseReceivedListener(
      (response) => {
        const route = readNotificationRouteData(response.notification)
        openNotificationDestination(route.resourceType, route.resourceId)
        void refreshLiveData()
      }
    )

    if (authenticatedUserId && !isAuthRestoring) {
      void notificationModule.getLastNotificationResponseAsync().then((response) => {
        if (!response) return
        const route = readNotificationRouteData(response.notification)
        openNotificationDestination(route.resourceType, route.resourceId)
        void notificationModule.clearLastNotificationResponseAsync()
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
    if (!supabase || !authenticatedUserId) return undefined

    const client = supabase
    const activeConversationId = selectedConversation?.id
    let active = true
    let conversationRefreshTimer: ReturnType<typeof setTimeout> | undefined
    let isRefreshingConversations = false
    let shouldRefreshConversationsAgain = false
    const refreshConversationList = () => {
      if (isRefreshingConversations) {
        shouldRefreshConversationsAgain = true
        return
      }
      isRefreshingConversations = true
      void fetchConversations()
        .then((rows) => {
          if (active) setConversations(rows)
        })
        .finally(() => {
          isRefreshingConversations = false
          if (active && shouldRefreshConversationsAgain) {
            shouldRefreshConversationsAgain = false
            refreshConversationList()
          }
        })
    }
    const scheduleConversationRefresh = () => {
      if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer)
      conversationRefreshTimer = setTimeout(refreshConversationList, 300)
    }
    const messageChannel = client
      .channel(`booking-messages-${authenticatedUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const record = payload.new as Record<string, unknown>
          const conversationId = typeof record.conversation_id === 'string'
            ? record.conversation_id
            : ''

          scheduleConversationRefresh()

          if (conversationId && conversationId === activeConversationId) {
            void fetchConversationMessages(conversationId).then(setConversationMessages)
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      if (conversationRefreshTimer) clearTimeout(conversationRefreshTimer)
      void client.removeChannel(messageChannel)
    }
  }, [authenticatedUserId, selectedConversation?.id])

  React.useEffect(() => {
    void setApplicationBadgeFromUnreadCount(
      conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)
      + notifications.filter(isUnreadInboxNotification).length
    )
  }, [conversations, notifications])

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

  const handleBudgetContinue = async (value: BudgetAllocationValue) => {
    // The explicit next-step save below is authoritative. Drop only a queued
    // duplicate autosave, while waiting for an earlier write already in flight.
    discardPendingBudgetAutosave()
    await budgetAutosaveChainRef.current.catch(() => undefined)
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
      const hasCoordinatorAllocation = coordinatorPlanningEnabled && value.allocations.some(
        (allocation) => allocation.categoryKey === 'eventOrganizer' && allocation.amount > 0
      )

      if (hasCoordinatorAllocation && eventDetails.wantsCoordinator === true && !assignedCoordinator) {
        openPlanningHub('forward', 'eventOrganizers')
        return
      }

      const nextCategory = getFirstServicePlanningCategory(value.allocations)
        ?? getFirstPlanningCategory(value.allocations)
        ?? 'catering'
      openPlanningHub('forward', nextCategory)
      void loadClientCatalogServices()
        .then(setCatalogServices)
        .catch(() => undefined)
    })
  }

  const handleEventContinue = async (value: EventCreationValue, nextScreen: AppScreen) => {
    // The explicit next-step save below is authoritative. Drop only a queued
    // duplicate autosave, while waiting for an earlier write already in flight.
    discardPendingEventAutosave()
    await eventAutosaveChainRef.current.catch(() => undefined)
    await runOnce('save-event-details', async () => {
      if (value.wantsCoordinator === false && assignedCoordinator) {
        const confirmed = await confirmDestructiveAction(
          'Remove coordinator booking?',
          'Choosing No removes your currently selected coordinator. This does not affect other services or payments.',
          'Remove coordinator'
        )
        if (!confirmed) return

        const removal = await removeCoordinatorFromEvent()
        if (!removal.ok) {
          setToastMessage(removal.message ?? 'Unable to remove this coordinator booking.')
          return
        }
        setAssignedCoordinator(undefined)
        setCoordinatorBudgetCost(0)
        setCoordinatorAssignmentStatus(undefined)
        setSelectedCoordinatorPackage(undefined)
      }

      setEventDetails(value)

      const nextPlanningStep = nextScreen === 'budgetAllocation' ? 2 : 1
      const result = await saveEventDraft(value, Math.max(maxPlanningStep, nextPlanningStep))
      if (!result.ok) {
        setToastMessage(result.message ?? 'Unable to save your event details.')
        return
      }

      eventDetailsDirtyRef.current = false
      if (value.wantsCoordinator === true && !assignedCoordinator) {
        setCoordinatorPreferenceState('undecided')
      } else if (value.wantsCoordinator === false) {
        setCoordinatorPreferenceState('skipped')
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
        void loadClientCatalogServices()
          .then(setCatalogServices)
          .catch(() => undefined)
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
    if (step === 3) openPlanningHub(
      'forward',
      coordinatorPlanningEnabled && hasEventOrganizerBudget && !assignedCoordinator
        ? 'eventOrganizers'
        : defaultPlanningCategory
    )
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
    let eventChannel: RealtimeChannel | undefined

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
            void refreshClientBookings()
          }
        )
        .subscribe()

      eventChannel = client
        .channel(`client-event-progress-${data.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            filter: `client_id=eq.${data.user.id}`,
            schema: 'public',
            table: 'events',
          },
          () => {
            void refreshClientBookings()
          }
        )
        .subscribe()
    })

    return () => {
      active = false
      if (bookingChannel) void client.removeChannel(bookingChannel)
      if (eventChannel) void client.removeChannel(eventChannel)
    }
  }, [refreshClientBookings])

  React.useEffect(() => {
    if (screen !== 'bookings' && screen !== 'bookingDetails') return undefined

    const refreshTimer = setInterval(() => {
      void refreshClientBookings()
    }, 30000)

    return () => clearInterval(refreshTimer)
  }, [refreshClientBookings, screen])

  React.useEffect(() => {
    setSelectedBooking((current) =>
      current
        ? clientBookings.find((booking) => booking.id === current.id) ?? current
        : current
    )
  }, [clientBookings])

  const handleChangeService = (service: SelectedSummaryService) => {
    if (service.status.trim().toLowerCase() !== 'selected') {
      setToastMessage('Only an unsubmitted service selection can be changed here.')
      return
    }
    setChangingServiceSelection(service)
    setServiceBrowseMode('planning')
    setCurrentServiceId('')
    openPlanningHub('forward', categoryNameToId(service.category))
  }

  const handleLoadCateringTastingDraft = (service: CatalogService) =>
    loadCateringTastingDraft(service)

  const handleSaveCateringTastingDraft = (
    value: Parameters<typeof saveCateringTastingDraft>[0]
  ) => saveCateringTastingDraft(value)

  const requestServiceChangeConfirmation = React.useCallback((confirmation: ServiceChangeConfirmation) => (
    new Promise<boolean>((resolve) => {
      serviceChangeConfirmationResolverRef.current = resolve
      setServiceChangeConfirmation(confirmation)
    })
  ), [])

  const resolveServiceChangeConfirmation = React.useCallback((confirmed: boolean) => {
    const resolve = serviceChangeConfirmationResolverRef.current
    serviceChangeConfirmationResolverRef.current = undefined
    setServiceChangeConfirmation(undefined)
    resolve?.(confirmed)
  }, [])

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

    const existingCategorySelection = changingServiceSelection ?? selectedServices.find((service) =>
      service.category.toLowerCase() === value.service.categoryName.toLowerCase()
        && service.id !== value.service.id
    )
    if (replacementBooking) {
      const replacementConfiguration = value.venueOption?.name
        ?? value.cateringOption?.name
        ?? value.service.detail
      const confirmed = await requestServiceChangeConfirmation({
        currentConfiguration: replacementBooking.configuration,
        currentName: replacementBooking.serviceName,
        currentPrice: replacementBooking.baselineAmount,
        currentProviderName: replacementBooking.providerName,
        nextConfiguration: replacementConfiguration,
        nextName: value.service.name,
        nextPrice: value.estimatedTotal,
        nextProviderName: value.service.providerName || 'New provider',
        variant: 'replacement',
      })
      if (!confirmed) return
    } else if (existingCategorySelection && existingCategorySelection.id !== value.service.id) {
      const currentProviderName = catalogServices.find((service) => (
        service.id === existingCategorySelection.id
        || service.bookingServiceId === existingCategorySelection.id
      ))?.providerName ?? 'Current provider'
      const confirmed = await requestServiceChangeConfirmation({
        currentName: existingCategorySelection.name,
        currentPrice: existingCategorySelection.price,
        currentProviderName,
        nextName: value.service.name,
        nextPrice: value.estimatedTotal,
        nextProviderName: value.service.providerName || 'New provider',
      })
      if (!confirmed) return
    }

    let result = await saveServiceSelection({
      ...value,
      replacementBookingId: replacementBooking?.bookingId,
    })

    // A category-budget update may finish while the quote screen is open.
    // Retry only that transient allocation conflict once after refreshing;
    // genuine over-budget choices retain their authoritative database error.
    if (!result.ok && result.message?.includes('Category allocations cannot exceed')) {
      await refreshLiveData()
      result = await saveServiceSelection({
        ...value,
        replacementBookingId: replacementBooking?.bookingId,
      })
    }

    if (!result.ok) {
      const message = result.message?.includes('remaining event budget')
        ? 'This service is above the budget available for its category. Increase the event budget or reduce another category allocation.'
        : result.message
      setToastMessage(message ?? 'Unable to save the service selection.')
      return
    }

    if (directCateringFallbackServiceId === value.service.id) {
      setDirectCateringFallbackServiceId('')
    }

    const fallbackProviderPrice = value.service.pricingUnit === 'person' && value.attendeeCount > 0
      ? value.service.providerMinPrice * value.attendeeCount
      : value.service.providerMinPrice
    const providerPrice = result.providerAmount ?? fallbackProviderPrice
    const calculatedAmount = result.calculatedAmount ?? value.estimatedTotal
    const foodTastingPricePending = value.foodTastingPreference === true
    const nextSelection: SelectedSummaryService = {
      id: value.service.id,
      category: value.service.categoryName.toUpperCase(),
      commissionAmount: Math.round(
        Math.max(0, calculatedAmount - providerPrice) * 100
      ) / 100,
      commissionRate: value.service.commissionRate,
      detail: foodTastingPricePending
        ? `${value.attendeeCount} Guests - Food tasting request sent`
        : value.venueOption
        ? `${value.venueOption.name} · ${value.venueBookedHours} hours`
        : value.cateringOption
        ? `${value.cateringOption.name} · ${value.attendeeCount} Guests`
        : value.attendeeCount > 0 ? `${value.attendeeCount} Guests` : value.service.detail,
      imageLabel: value.service.imageLabel,
      imageUrl: value.service.imageUrl,
      includesCatering: Boolean(value.venueCateringPackageId),
      name: value.service.name,
      price: calculatedAmount,
      pricePending: foodTastingPricePending,
      providerPrice,
      status: foodTastingPricePending ? 'Requested' : 'Selected',
    }

    const nextSelectedServices = (() => {
      const existingIndex = selectedServices.findIndex((service) =>
        service.id === nextSelection.id || service.category === nextSelection.category
      )
      return existingIndex >= 0
        ? selectedServices.map((service, index) =>
            index === existingIndex ? nextSelection : service
          )
        : [...selectedServices, nextSelection]
    })()
    const nextPlanningCategory = getNextPlanningServiceCategory(
      new Set([
        ...nextSelectedServices.map((service) => categoryNameToId(service.category)),
        ...(nextSelectedServices.some((service) => service.includesCatering) ? ['catering' as const] : []),
      ])
    )

    setSelectedServices(nextSelectedServices)
    setMaxPlanningStep((current) => Math.min(current, 4))

    if (replacementBooking) {
      const replacementSubmission = await submitBookingReplacementRequest(selectedBooking?.eventId ?? '')
      if (!replacementSubmission.ok) {
        setToastMessage(replacementSubmission.message ?? 'Unable to send the replacement booking request.')
        return
      }
      setReplacementBooking(undefined)
      setCurrentServiceId('')
      setToastMessage('Replacement booking request sent. The new provider must accept before payment becomes available.')
      await refreshLiveData()
      setBookingPaymentQuote(undefined)
      setPaymentSettlementContext(undefined)
      setScreen('bookings')
      return
    }

    if (changingServiceSelection) {
      setChangingServiceSelection(undefined)
      setToastMessage('Selected service updated. Review the refreshed event plan before continuing.')
      await refreshLiveData()
      await recheckSavedPlan()
      openPlanningHub(undefined, categoryNameToId(nextSelection.category))
      return
    }

    setToastMessage(foodTastingPricePending
      ? 'Food tasting request sent. The caterer can now review your preliminary menu and event details.'
      : nextPlanningCategory
        ? 'Service added. Moving to your next allocated category.'
        : 'Service added. Your allocated service categories are ready to review.')
    await refreshLiveData()
    await recheckSavedPlan()
    openPlanningHub(undefined, nextPlanningCategory ?? categoryNameToId(nextSelection.category))
  }

  const handleFindAlternativeServices = async (service: NonNullable<BookingItem['services']>[number]) => {
    const eventId = selectedBooking?.eventId
    if (!eventId) {
      setToastMessage('This booking is no longer linked to an event.')
      return
    }
    const result = await activateBookingReplacement(eventId, service.bookingId)
    if (!result.ok) {
      setToastMessage(result.message ?? 'A replacement is not available for this booking.')
      return
    }
    setReplacementBooking({
      baselineAmount: service.amount,
      bookingId: service.bookingId,
      category: service.category,
      configuration: service.clientNotes || undefined,
      providerName: service.providerName,
      serviceId: service.serviceId,
      serviceName: service.serviceName,
    })
    setServiceBrowseMode('planning')
    setSelectedCategory(categoryNameToId(service.category))
    setScreen('categoryBrowse')
  }

  const handleAssignCoordinator = async () => {
    if (
      !currentService?.coordinatorUserId ||
      assigningCoordinatorId ||
      assignedCoordinator?.id === currentService.id
    ) {
      return
    }

    if (!hasEventOrganizerBudget) {
      setToastMessage('Allocate a positive Event Organizer budget before choosing a coordinator.')
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
    setToastMessage(
      result.message ?? `${currentService.name} was selected. Their booking request will be sent after downpayment.`
    )
    await refreshLiveData()
    await recheckSavedPlan()
    openPlanningHub(undefined, defaultPlanningCategory)
  }

  const handleRemoveCoordinator = async () => {
    if (!assignedCoordinator || assigningCoordinatorId) return
    const confirmed = await confirmDestructiveAction(
      'Remove coordinator booking?',
      'This removes the coordinator from your event. Any active booking or package that cannot be safely removed will stay unchanged.',
      'Remove coordinator'
    )
    if (!confirmed) return

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
    await refreshLiveData()
    await recheckSavedPlan()
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
    const removedCategoryKey = budgetKeyByCategory[categoryNameToId(service.category)]
    setBudgetAllocations((current) => current.map((allocation) => (
      allocation.categoryKey === removedCategoryKey
        ? { ...allocation, amount: 0, locked: false }
        : allocation
    )))
    setMaxPlanningStep((current) =>
      Math.min(current, selectedServices.length === 1 ? 3 : 4)
    )
    setToastMessage(`${service.name} removed from your event plan.`)
    await refreshLiveData()
    await recheckSavedPlan()
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

  const handleBookingCompletionPayment = async ({
    amount,
    note,
    request,
    requestKey,
    type,
  }: ProviderCompletionPaymentValue) => {
    if (completingBookingId) {
      return { ok: false, message: 'A payment confirmation is already being saved.' }
    }

    setCompletingBookingId(request.id)
    const result = await saveMerchantCompletionPayment({
      amount,
      bookingId: request.id,
      note,
      requestKey,
      type,
    })

    if (!result.ok) {
      setCompletingBookingId('')
      return { ok: false, message: result.message ?? 'Unable to save the payment confirmation.' }
    }

    await refreshLiveData()
    setCompletingBookingId('')
    setSelectedMerchantRequest((current) => {
      const eventRequest =
        current?.eventId && current.eventId === request.eventId ? current : request
      const outcome = result.completionPayment
      const services = eventRequest.services?.map((service) => {
        if (service.id !== request.id) return service

        const remainingServiceBalance = outcome?.remainingServiceBalance ?? service.remainingServiceBalance
        const confirmedExternalPaymentAmount = outcome?.confirmedExternalPaymentAmount
          ?? service.confirmedExternalPaymentAmount
        const bookingCompleted = outcome?.bookingCompleted === true
        return {
          ...service,
          completionPaymentStatus: bookingCompleted
            ? 'fully_confirmed' as const
            : type === 'notYet'
              ? 'awaiting_external_payment' as const
              : (confirmedExternalPaymentAmount ?? 0) > 0
                ? 'partially_confirmed' as const
                : service.completionPaymentStatus,
          confirmedExternalPaymentAmount,
          remainingServiceBalance,
          status: bookingCompleted ? 'completed' as const : service.status,
        }
      })
      const statuses = services?.map((service) => service.status) ?? [request.status]
      const eventStatus: BookingRequestStatus = statuses.some((status) => status === 'new')
        ? 'new'
        : statuses.some((status) => status === 'confirmed')
          ? 'confirmed'
          : statuses.some((status) => status === 'completed')
            ? 'completed'
            : 'cancelled'

      return { ...eventRequest, services, status: eventStatus }
    })
    const message = outcomeMessageForCompletionPayment(type, result.completionPayment?.bookingCompleted === true)
    setToastMessage(message)
    setScreen('providerBookingRequestDetails')
    return { ok: true, message }
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

  const handleClientFoodTastingRequest = async (value: {
    bookingId: string
    note?: string
    scheduledDate: string
    startTime: string
    useV15?: boolean
  }) => {
    const result = await requestCateringFoodTasting(value)
    if (!result.ok) return result

    await refreshLiveData()
    const message = result.foodTastingScheduled
      ? 'Food tasting schedule confirmed. Your caterer was notified.'
      : 'Food tasting request sent to the catering provider.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleClientFoodTastingAttendance = async (bookingId: string) => {
    const result = await confirmV15FoodTastingAttendance(bookingId)
    if (!result.ok) return result

    await refreshLiveData()
    const message = result.foodTastingAttendanceConfirmed
      ? 'Attendance confirmed. Your caterer was notified.'
      : 'Food tasting attendance is already confirmed.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleClientFoodTastingReschedule = async (value: {
    bookingId: string
    note?: string
    scheduledDate: string
    startTime: string
  }) => {
    const result = await rescheduleV15FoodTasting(value)
    if (!result.ok) return result

    await refreshLiveData()
    const message = result.foodTastingRescheduled
      ? 'Food tasting rescheduled. Your caterer was notified.'
      : 'Food tasting schedule updated.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleChooseFinalCateringMenu = async (
    service: NonNullable<BookingItem['services']>[number]
  ) => {
    const result = await activateV15FoodTastingDirectMenuFallback(service.bookingId)
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to open final menu selection.')
      return
    }

    const targetServiceId = result.foodTastingFallbackServiceId || service.serviceId
    const targetService = catalogServices.find((candidate) => candidate.id === targetServiceId)
    if (!targetService) {
      setToastMessage('The direct catering menu is no longer available. Refresh and try again.')
      void refreshLiveData()
      return
    }

    await refreshLiveData()
    setDirectCateringFallbackServiceId(targetService.id)
    setServiceBrowseMode('planning')
    setSelectedCategory('catering')
    setCurrentServiceId(targetService.id)
    setToastMessage('Choose your final catering menu to replace the expired food tasting request.')
    setScreen('serviceDetails')
  }

  const handleClientFoodTastingProposal = async (tastingId: string, acceptProposal: boolean) => {
    const result = await respondToCateringFoodTastingProposal(tastingId, acceptProposal)
    if (!result.ok) return result

    await refreshLiveData()
    const message = acceptProposal
      ? 'Food tasting schedule confirmed.'
      : 'Food tasting proposal declined. You can request another available slot.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleClientChurchProposalResponse = async (approved: boolean, declineReason?: string) => {
    const eventId = selectedBooking?.eventId ?? selectedBooking?.id
    if (!eventId) return { ok: false, message: 'This church proposal could not be identified.' }

    const result = await respondToChurchWeddingProposal(eventId, approved, declineReason)
    if (!result.ok) return result

    const respondedAt = new Date().toISOString()
    const updateBooking = (booking: BookingItem): BookingItem => {
      if ((booking.eventId ?? booking.id) !== eventId || !booking.churchArrangement) return booking
      return {
        ...booking,
        churchArrangement: {
          ...booking.churchArrangement,
          arrangementStatus: approved ? 'client_approved' : 'declined',
          clientRespondedAt: respondedAt,
          clientResponseReason: approved ? undefined : declineReason?.trim(),
          clientResponseStatus: approved ? 'approved' : 'declined',
          updatedAt: respondedAt,
        },
      }
    }
    setSelectedBooking((current) => current ? updateBooking(current) : current)
    setClientBookings((current) => current.map(updateBooking))
    setToastMessage(result.message ?? (approved ? 'Church proposal approved.' : 'Church proposal declined.'))
    void refreshClientBookings().catch(() => undefined)
    return result
  }

  const handleProviderFoodTastingResponse = async (value: {
    action: 'confirm' | 'reject' | 'propose'
    note?: string
    proposedDate?: string
    proposedStartTime?: string
    tastingId: string
  }) => {
    const result = await respondToCateringFoodTasting(value)
    if (!result.ok) return result

    await refreshLiveData()
    const message = value.action === 'confirm'
      ? 'Food tasting confirmed. The client was notified.'
      : value.action === 'reject'
        ? 'Food tasting request declined. The client was notified.'
        : 'Alternative food tasting schedule sent to the client.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleProviderFoodTastingFinalMenu = async (value: {
    bookingId: string
    finalItemIds: string[]
  }) => {
    const result = await submitV15FoodTastingFinalMenu(value)
    if (!result.ok) return result
    await refreshLiveData()
    const message = 'Final menu sent to the client for confirmation.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleClientFoodTastingFinalMenuResponse = async (value: {
    acceptMenu: boolean
    bookingId: string
    correctionNote?: string
  }) => {
    const result = await respondToV15FoodTastingFinalMenu(value)
    if (!result.ok) return result
    await refreshLiveData()
    const message = value.acceptMenu
      ? 'Final menu confirmed. Your event payment eligibility has been updated.'
      : 'Your correction request was sent to the caterer.'
    setToastMessage(message)
    return { ok: true, message }
  }

  const handleSavePhotoVideoPreEventPlan = async (bookingId: string, plan: PhotoVideoPreEventPlan) => {
    const result = await savePhotoVideoPreEventPlan(bookingId, plan)
    if (result.ok) {
      await refreshLiveData()
      setToastMessage('Pre-event coverage plan saved. The client can now review it.')
    }
    return result
  }

  const handleSavePhotoVideoShotList = async (bookingId: string, shotList: string) => {
    const result = await savePhotoVideoShotList(bookingId, shotList)
    if (result.ok) {
      await refreshClientBookings()
      setToastMessage('Your Photo/Video shot list was saved.')
    }
    return result
  }

  const handleConfirmPhotoVideoPreEventPlan = async (bookingId: string) => {
    const result = await confirmPhotoVideoPreEventPlan(bookingId)
    if (result.ok) {
      await refreshLiveData()
      setToastMessage('Pre-event coverage plan confirmed. This does not change payment or booking terms.')
    }
    return result
  }

  const handleSavePhotoVideoEventDayUpdate = async (bookingId: string, update: Record<string, unknown>) => {
    const result = await savePhotoVideoEventDayUpdate(bookingId, update)
    if (result.ok) {
      await refreshLiveData()
      setToastMessage('Event-day coverage update saved. It did not change payment or booking completion.')
    }
    return result
  }

  const handleRespondToPhotoVideoEventDayRequest = async (bookingId: string, entryId: string, approve: boolean) => {
    const result = await respondToPhotoVideoEventDayRequest(bookingId, entryId, approve)
    if (result.ok) {
      await refreshClientBookings()
      setToastMessage(approve ? 'Event-day request approved. No charge was created automatically.' : 'Event-day request declined.')
    }
    return result
  }

  const handleSavePhotoVideoDeliverableUpdate = async (bookingId: string, update: Record<string, unknown>) => {
    const result = await savePhotoVideoDeliverableUpdate(bookingId, update)
    if (result.ok) {
      await refreshLiveData()
      setToastMessage('Deliverable progress saved. It did not change payment, payout, or booking completion.')
    }
    return result
  }

  const handleRespondToPhotoVideoDeliverable = async (
    bookingId: string,
    deliverableId: string,
    action: 'confirm_receipt' | 'request_revision' | 'approve_output' | 'report_issue',
    note?: string
  ) => {
    const result = await respondToPhotoVideoDeliverable(bookingId, deliverableId, action, note)
    if (result.ok) {
      await refreshClientBookings()
      setToastMessage(action === 'report_issue' ? 'Deliverable issue recorded. You may continue through the existing support process.' : 'Deliverable response saved.')
    }
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
    clearClientPlanningResume()
    const result = await createClientEventDraft()
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to start a new event right now.')
      return false
    }

    eventDetailsDirtyRef.current = false
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
    setSavedPlanReview(undefined)
    setMaxPlanningStep(1)
    setServiceBrowseMode('planning')
    persistClientPlanningResume({
      eventDetails: { ...DEFAULT_EVENT },
      eventId: result.eventId,
      screen: 'eventCreation',
    })
    openEventCreation()
    void refreshLiveData().catch(() => undefined)
    return true
  }

  const resumeClientDraft = async (draftId: string) => {
    const result = await resumeClientEventDraft(draftId)
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to resume this event draft.')
      return
    }

    clearClientPlanningResume()
    eventDetailsDirtyRef.current = false
    setSavedPlanReview(undefined)
    const planningState = await fetchClientPlanningState()
    hydrateClientPlanningState(planningState, catalogServices)
    persistClientPlanningResume({
      eventDetails: planningState.event,
      eventId: draftId,
      screen: 'eventCreation',
    })
    const nextStep = Math.max(1, planningState.maxPlanningStep ?? 1)
    setServiceBrowseMode('planning')

    if (nextStep === 1) {
      openEventCreation()
      void refreshLiveData().catch(() => undefined)
      return
    }
    if (nextStep === 2) {
      setScreen('budgetAllocation')
      void refreshLiveData().catch(() => undefined)
      return
    }
    if (nextStep === 3) {
      const wantsCoordinator = planningState.event?.wantsCoordinator === true
        || Boolean(planningState.assignedCoordinator)
      const resumableAllocations = wantsCoordinator
        ? planningState.budgetAllocations ?? []
        : (planningState.budgetAllocations ?? []).filter(
            (allocation) => allocation.categoryKey !== 'eventOrganizer'
          )
      const hasCoordinatorAllocation = wantsCoordinator && resumableAllocations.some(
        (allocation) => allocation.categoryKey === 'eventOrganizer' && allocation.amount > 0
      )
      const initialCategory = hasCoordinatorAllocation && !planningState.assignedCoordinator
        ? 'eventOrganizers'
        : getFirstServicePlanningCategory(resumableAllocations)
          ?? getFirstPlanningCategory(resumableAllocations)
        ?? 'catering'
      openPlanningHub('forward', initialCategory)
      void refreshLiveData().catch(() => undefined)
      return
    }
    setScreen(nextStep >= 5 ? 'payment' : 'instructionModule')
    void refreshLiveData().catch(() => undefined)
  }

  const resumeSavedPlan = async (savedPlanId: string) => {
    const result = await resumeClientSavedPlan(savedPlanId)
    if (!result.ok || !result.savedPlanReview) {
      setToastMessage(result.message ?? 'Unable to resume this saved plan.')
      return
    }

    clearClientPlanningResume()
    eventDetailsDirtyRef.current = false
    setSavedPlanReview(result.savedPlanReview)
    await refreshLiveData()
    setServiceBrowseMode('planning')
    persistClientPlanningResume({
      eventId: savedPlanId,
      savedPlanId,
      screen: 'payment',
    })
    setScreen('payment')
  }

  const recheckSavedPlan = async () => {
    if (!savedPlanReview?.eventId) return undefined
    const result = await resumeClientSavedPlan(savedPlanReview.eventId)
    if (result.ok && result.savedPlanReview) {
      setSavedPlanReview(result.savedPlanReview)
      return result.savedPlanReview
    }
    setToastMessage(result.message ?? 'Unable to recheck this saved plan.')
    return undefined
  }

  const savePlanForLater = async () => {
    if (isSavingPlanForLater) return
    await runOnce('save-booking-plan-for-later', async () => {
      setIsSavingPlanForLater(true)
      try {
        const result = await saveBookingPlanForLater()
        if (!result.ok) {
          setToastMessage(result.message ?? 'Unable to save this event plan.')
          return
        }

        setSavedPlanReview(result.savedPlanReview)
        await refreshLiveData()
        clearClientPlanningResume()
        setToastMessage('Event plan saved. No payment or provider booking request was created.')
        setScreen('clientHome')
      } finally {
        setIsSavingPlanForLater(false)
      }
    })
  }

  const submitBookingRequests = async () => {
    if (bookingRequestSubmissionInFlight.current) return

    bookingRequestSubmissionInFlight.current = true
    setIsSubmittingBookingRequests(true)
    try {
      const result = await submitPlanningBookingRequests()
      if (!result.ok) {
        setToastMessage(result.message ?? 'Unable to submit booking requests.')
        return
      }

      setReplacementBooking(undefined)
      setSavedPlanReview(undefined)
      clearClientPlanningResume()
      setToastMessage(
        'Booking requests submitted. Payment will become available once every required provider accepts.'
      )
      setScreen('bookings')
      void refreshLiveData().catch(() => undefined)
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'Unable to submit booking requests.')
    } finally {
      bookingRequestSubmissionInFlight.current = false
      setIsSubmittingBookingRequests(false)
    }
  }

  const loadBookingPaymentQuote = async (eventId: string) => {
    setIsLoadingBookingPaymentQuote(true)
    try {
      const result = await fetchMyEventPaymentQuoteV14(eventId)
      if (!result.ok || !result.paymentQuote) {
        setToastMessage(result.message ?? 'Unable to load the current payment details.')
        return undefined
      }
      setBookingPaymentQuote(result.paymentQuote)
      return result.paymentQuote
    } finally {
      setIsLoadingBookingPaymentQuote(false)
    }
  }

  const openBookingPayment = async () => {
    const eventId = selectedBooking?.eventId
    if (!eventId || isInitiatingBookingPayment) return

    setIsBookingPaymentSheetVisible(true)
    setIsPreparingBookingPayment(true)
    // Re-read the secured quote at the point of payment. This keeps the UI
    // responsive after provider acceptance while the server remains the final
    // authority for acceptance and immutable booking-price snapshots.
    try {
      const paymentQuote = await loadBookingPaymentQuote(eventId)
      if (!paymentQuote) {
        setIsBookingPaymentSheetVisible(false)
        return
      }
      setPaymentSettlementContext(undefined)
      if (!paymentQuote.paymentEligible) {
        setToastMessage(paymentQuote.reason ?? 'Payment is not available until all required confirmations are complete.')
        setIsBookingPaymentSheetVisible(false)
        return
      }
      if (!['not_initiated', 'payment_failed_or_cancelled'].includes(paymentQuote.paymentState)) {
        setToastMessage(
          paymentQuote.paymentState === 'payment_initiated'
            ? 'A payment attempt is already awaiting completion or verification.'
            : 'Payment is already recorded for this event.'
        )
        setIsBookingPaymentSheetVisible(false)
      }
    } finally {
      setIsPreparingBookingPayment(false)
    }
  }

  const initiateBookingPayment = async (value: PaymentValue) => {
    const eventId = selectedBooking?.eventId
    if (!eventId || isInitiatingBookingPayment) return

    setIsInitiatingBookingPayment(true)
    try {
      const result = await createMyPaymongoCheckoutV16({
        eventId,
        paymentMethod: value.method,
        paymentType: value.paymentType,
        termsAccepted: value.termsAccepted,
      })
      if (!result.ok || !result.checkoutUrl) {
        setToastMessage(result.message ?? 'Unable to start payment for this booking.')
        return
      }

      const refreshedQuote = await loadBookingPaymentQuote(eventId)
      if (refreshedQuote) setBookingPaymentQuote(refreshedQuote)
      setSelectedBooking((current) => current && current.eventId === eventId
        ? {
            ...current,
            paymentState: 'payment_initiated',
            paymentStatus: 'Secure PayMongo checkout started — awaiting verification',
          }
        : current)
      setIsBookingPaymentSheetVisible(false)
      setScreen('bookingDetails')
      setToastMessage('Complete payment in PayMongo. Your booking updates only after PayMongo verifies it.')
      await WebBrowser.openBrowserAsync(result.checkoutUrl)
      const reconciliation = await reconcileMyPaymongoCheckoutV16(eventId)
      if (reconciliation.verified) {
        // Reconciliation is server-authoritative. Clear the local pending
        // action immediately, even if the follow-up quote request is briefly
        // delayed by a mobile connection.
        setBookingPaymentQuote((current) => current && current.eventId === eventId
          ? { ...current, paymentState: 'paid_or_verified', paymentStatus: 'verified' }
          : current)
        // The quote loaded before opening the hosted checkout represents the
        // pending payment. Re-read it after the server-side reconciliation so
        // Booking Details cannot keep rendering a disabled “Resume Payment”
        // action (or the pre-payment zero allocation projection) after
        // PayMongo has authorized the transaction.
        const verifiedQuote = await loadBookingPaymentQuote(eventId)
        if (verifiedQuote) {
          setSelectedBooking((current) => current && current.eventId === eventId
            ? {
                ...current,
                paymentState: verifiedQuote.paymentState,
                paymentStatus: verifiedQuote.paymentStatus === 'verified'
                  ? 'Payment verified'
                  : current.paymentStatus,
              }
            : current)
        }
        // Wait for the booking relation (including per-service payment
        // snapshots) before returning control to the client. This refreshes
        // the initial provider allocation displayed in Booking Details.
        await refreshLiveData().catch(() => undefined)
        setToastMessage('PayMongo payment verified. Your booking has been updated.')
      } else {
        // Preserve the pending state when the checkout was closed before a
        // successful authorization, while still refreshing any terminal
        // PayMongo status the server may have observed.
        await refreshLiveData().catch(() => undefined)
      }
    } finally {
      setIsInitiatingBookingPayment(false)
    }
  }

  const reviewSavedPlanChanges = () => {
    const changedItem = savedPlanReview?.items.find((item) => (
      !item.available
      || item.currentAmount === undefined
      || Math.abs(item.currentAmount - item.savedAmount) > 0.01
    ))
    const category = changedItem ? categoryNameToId(changedItem.category) : defaultPlanningCategory
    openPlanningHub('forward', category)
  }

  const deleteClientDraft = async (draftId: string) => {
    const result = await deleteClientEventDraft(draftId)
    if (!result.ok) {
      setToastMessage(result.message ?? 'Unable to delete this event draft.')
      return false
    }

    setClientEventDrafts((current) => current.filter((draft) => draft.id !== draftId))
    if (clientPlanningResumeRef.current.eventId === draftId) clearClientPlanningResume()
    setToastMessage('Event draft deleted.')
    return true
  }

  const homeRecommendations = React.useMemo(
    () => rankHomeRecommendations(catalogServices),
    [catalogServices]
  )
  const unreadNotifications = React.useMemo(
    () => notifications.filter(isUnreadUpdate),
    [notifications]
  )
  const unreadInboxNotifications = React.useMemo(
    () => notifications.filter(isUnreadInboxNotification),
    [notifications]
  )
  const unreadBookingResourceIds = React.useMemo(
    () => unreadBookingTrackerResourceIds(notifications),
    [notifications]
  )
  const hasUnreadBookingUpdates = React.useMemo(
    () => unreadNotifications.some(isBookingUpdate),
    [unreadNotifications]
  )
  const hasUnreadEventUpdates = React.useMemo(
    () => unreadNotifications.some(isEventUpdate),
    [unreadNotifications]
  )
  const hasUnreadTaskUpdates = React.useMemo(
    () => unreadNotifications.some(isTaskUpdate),
    [unreadNotifications]
  )
  const hasUnreadMessageUpdates = React.useMemo(
    () => conversations.some((conversation) => conversation.unreadCount > 0),
    [conversations]
  )
  const clientBookingProgress = React.useMemo(
    () => getClientBookingProgress(clientBookings, new Date(), unreadBookingResourceIds),
    [clientBookings, unreadBookingResourceIds]
  )

  const renderClientHome = () => (
    <ClientHomeScreen
      draftEvents={clientEventDrafts}
      bookingProgressEvents={clientBookingProgress}
      favoritePendingServiceIds={favoritePendingServiceIds}
      favoriteServiceIds={favoriteServiceIds}
      hasUnreadBookingUpdates={hasUnreadBookingUpdates}
      isRefreshing={isClientHomeRefreshing}
      recommendations={homeRecommendations}
      selectedServiceCount={selectedServices.length}
      onOpenDraft={(draftId) => void resumeClientDraft(draftId)}
      onOpenFavorites={() => {
        setExploreFavoritesOnly(true)
        setServiceBrowseMode('explore')
        setScreen('categoryBrowse')
      }}
      onOpenBookingProgress={(booking) => {
        setSelectedBooking(booking)
        setBookingPaymentQuote(undefined)
        setPaymentSettlementContext(undefined)
        setScreen('bookingDetails')
        if (booking.eventId) void loadBookingPaymentQuote(booking.eventId)
      }}
      onStartNewEvent={startNewClientEvent}
      onOpenRefunds={() => {
        setClientRefundsReturnScreen('clientHome')
        setScreen('clientRefunds')
      }}
      onRefresh={refreshClientHome}
      onOpenSavedPlans={() => setScreen('clientPlans')}
      onScrollDirectionChange={(direction) => {
        handleClientNavigationScrollDirection(direction)
      }}
      onSeeAllVenues={() => openClientTab('explore')}
      onSelectRecommendation={(serviceId) => {
        const recommendedService = catalogServices.find((service) => service.id === serviceId)
        if (recommendedService?.id) {
          setCurrentServiceId(recommendedService.id)
          setScreen(recommendedService.kind === 'coordinator' ? 'coordinatorDetails' : 'serviceDetails')
        } else {
          openClientTab('explore')
        }
      }}
      onSelectTab={openClientTab}
      onToggleFavorite={(serviceId) => void handleToggleFavorite(serviceId)}
    />
  )

  const renderClientPlans = () => (
    <ClientPlansScreen
      draftEvents={clientEventDrafts}
      savedPlans={clientSavedPlans}
      onBack={() => setScreen('clientHome')}
      onDeleteDraft={deleteClientDraft}
      onOpenDraft={(draftId) => void resumeClientDraft(draftId)}
      onOpenSavedPlan={(savedPlanId) => void resumeSavedPlan(savedPlanId)}
      onScrollDirectionChange={handleClientNavigationScrollDirection}
      onStartNewEvent={startNewClientEvent}
    />
  )

  const openClientInboxNotification = (notification: MerchantNotification) => {
    if (notification.category === 'message') {
      setMessageWorkspace('client')
      setScreen('messages')
      return
    }
    if (notification.category === 'payment') {
      setScreen('eventLedger')
      return
    }
    if (notification.category === 'review' || notification.category === 'booking') {
      setScreen('bookings')
    }
  }

  const renderMessagesWorkspace = (initialInboxTab: ClientInboxTab = 'messages') => (
    <MessagesScreen
      clientBookings={messageWorkspace === 'client' ? clientBookings : []}
      coordinatorEvents={messageWorkspace === 'coordinator' ? coordinatorDashboard.events : []}
      conversations={conversations}
      hasUnreadNotifications={messageWorkspace === 'client'
        ? unreadInboxNotifications.length > 0
        : notifications.some((notification) => !notification.isRead)}
      initialInboxTab={messageWorkspace === 'client' ? initialInboxTab : 'messages'}
      navigationVariant={messageWorkspace}
      notifications={messageWorkspace === 'client' ? notifications : []}
      showBottomNavigation={messageWorkspace === 'coordinator'}
      onBack={messageWorkspace === 'coordinator'
        ? () => setScreen('coordinatorHome')
        : messageWorkspace === 'client'
          ? () => setScreen('clientHome')
          : undefined}
      onMarkAllNotificationsRead={messageWorkspace === 'client' ? (ids) => {
        const readIds = new Set(ids)
        setNotifications((current) => current.map((notification) => (
          readIds.has(notification.id) ? { ...notification, isRead: true } : notification
        )))
        void markMerchantNotificationsRead(ids).then(() => refreshLiveData())
      } : undefined}
      onMarkNotificationRead={messageWorkspace === 'client' ? (notification) => {
        setNotifications((current) => current.map((item) => (
          item.id === notification.id ? { ...item, isRead: true } : item
        )))
        void markMerchantNotificationRead(notification).then(() => refreshLiveData())
      } : undefined}
      onMoveConversationsToTrash={async (conversationIds) => {
        const moved = await mutateInboxTrash('trash', [{ ids: conversationIds, itemType: 'conversation' }])
        if (moved && selectedConversation && conversationIds.includes(selectedConversation.id)) {
          setSelectedConversation(undefined)
        }
        return moved
      }}
      onMoveNotificationsToTrash={(notificationIds) =>
        mutateInboxTrash('trash', [{ ids: notificationIds, itemType: 'notification' }])}
      onOpenNotifications={() => setScreen(
        messageWorkspace === 'coordinator' ? 'coordinatorNotifications' : 'notifications'
      )}
      onOpenProfile={() =>
        messageWorkspace === 'merchant'
          ? openProviderProfile()
          : openAccountProfile('messages')
      }
      onOpenTrash={(scope) => void openInboxTrash(scope)}
      onOpenEventCoordinatorForEvent={(eventId) =>
        void openEventCoordinatorConversationFor(eventId, 'messages')
      }
      onSelectCoordinatorTab={openCoordinatorTab}
      onSelectConversation={(conversation) =>
        void openExistingConversation(conversation, 'messages')
      }
      onSelectNotification={messageWorkspace === 'client' ? openClientInboxNotification : undefined}
      onNewMessage={messageWorkspace === 'merchant' ? () => {
        setServiceBrowseMode('explore')
        setToastMessage('Choose a service to start a provider conversation.')
        setScreen('categoryBrowse')
      } : undefined}
      onSelectTab={messageWorkspace === 'coordinator' ? undefined : openMessageTab}
      onScrollDirectionChange={
        messageWorkspace === 'client' && homeReturnScreen === 'clientHome'
          ? handleClientNavigationScrollDirection
          : undefined
      }
      userName={userName}
      userAvatarUrl={userAvatarUrl}
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
              onClientGoogleSignUp={handleAuthenticatedUser}
              onClientSignUp={(email, needsVerification) => {
                if (needsVerification) {
                  openVerification(email, 'roleSelection', 'clientHome')
                  return
                }

                handleAuthenticatedUser()
              }}
              onForgotPassword={() => {
                setLoginReturnScreen('roleSelection')
                setScreen('forgotPassword')
              }}
              onLogIn={handleAuthenticatedUser}
              onMerchantSignUp={(email, needsVerification) => {
                if (needsVerification) {
                  openVerification(email, 'roleSelection', 'pendingApproval')
                  return
                }

                handleAuthenticatedUser()
              }}
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
      case 'clientPlans':
        return renderClientPlans()
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
                  onValueChange={handleEventDetailsChange}
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
              onValueChange={handleEventDetailsChange}
            />
          </Animated.View>
        )
      case 'providerHome':
        return (
          <MerchantHomeScreen
            businessName={userName}
            earnings={merchantHomeEarnings}
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            isEarningsLoading={isMerchantHomeEarningsLoading}
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
            onOpenEarnings={() => {
              setHomeReturnScreen('providerHome')
              setScreen('providerPayouts')
            }}
            onSelectQuickAction={(action) => {
              setHomeReturnScreen('providerHome')
              if (action === 'newQuote') {
                setMessageWorkspace('merchant')
                setScreen('messages')
              }
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
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
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
            onContinueDraft={() => setScreen('providerServiceReview')}
            onDeleteService={(service) => void deleteMerchantService(service)}
            onEditPackage={editStandaloneMerchantPackage}
            onEditService={(service) => void editMerchantService(service)}
            onOpenNotifications={() => setScreen('providerNotifications')}
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
              const cateringStartingPrice = cateringCustomMenuStartingPrice(getCateringCustomMenu(details)) ?? (cateringOptions.length
                ? Math.min(...cateringOptions.map((option) => option.pricePerHead))
                : undefined)
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
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            initialStatus={merchantRequestStatus}
            requests={merchantRequests}
            showBottomNavigation={false}
            onOpenNotifications={() => setScreen('providerNotifications')}
            onSelectNavigationTab={(tab) => {
              if (tab === 'events') setScreen('providerHome')
              if (tab === 'bookings') setScreen('providerBookingRequests')
              if (tab === 'budget') setScreen('providerPayouts')
              if (tab === 'chat') {
                setMessageWorkspace('merchant')
                setScreen('messages')
              }
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
            onMessageClient={(request) =>
              void openBookingConversationFor(request.id, 'providerBookingRequestDetails')
            }
            onCompletionPayment={handleBookingCompletionPayment}
            onFoodTastingResponse={handleProviderFoodTastingResponse}
            onSubmitFoodTastingFinalMenu={handleProviderFoodTastingFinalMenu}
            onSavePhotoVideoPreEventPlan={handleSavePhotoVideoPreEventPlan}
            onConfirmPhotoVideoPreEventPlan={handleConfirmPhotoVideoPreEventPlan}
            onSavePhotoVideoEventDayUpdate={handleSavePhotoVideoEventDayUpdate}
            onSavePhotoVideoDeliverableUpdate={handleSavePhotoVideoDeliverableUpdate}
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
            onEmailClient={() => {
              setMessageWorkspace('merchant')
              setScreen('messages')
            }}
          />
        )
      case 'providerReviews':
        return (
          <ReviewPerformanceScreen
            onBack={() => setScreen('providerProfile')}
            onOpenAccount={() => setScreen('providerProfile')}
            onReplyToReview={() => {
              setMessageWorkspace('merchant')
              setScreen('messages')
            }}
            onSelectReview={() => setScreen('providerReviews')}
          />
        )
      case 'providerProfile':
        return (
          <MerchantProfileScreen
            hasUnreadNotifications={notifications.some((notification) => !notification.isRead)}
            isLoggingOut={isSigningOut}
            profile={{
              businessName: accountProfile?.businessName || userName,
              contactEmail: accountProfile?.contactEmail || '',
              contactPhone: accountProfile?.contactPhone || '',
              description: accountProfile?.businessDescription || '',
              location: accountProfile?.businessLocation || '',
            }}
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
            onOpenSupport={() => {
              setSupportReturnScreen('accountProfile')
              setScreen('support')
            }}
            onSave={(value) => void saveAccountProfile(value)}
            onScrollDirectionChange={
              ['clientHome', 'budgetTracker', 'bookings', 'messages'].includes(profileReturnScreen)
                ? handleClientNavigationScrollDirection
                : undefined
            }
            onSignOut={() => void handleSignOut()}
            profile={accountProfile}
          />
        )
      case 'clientRefunds':
        return (
          <ClientRefundsScreen
            error={clientRefundOverviewError}
            isLoading={isClientRefundOverviewLoading}
            isRefreshing={isClientRefundOverviewRefreshing}
            onBack={() => setScreen(clientRefundsReturnScreen)}
            onRefresh={() => void loadClientRefundOverview(true)}
            overview={clientRefundOverview}
          />
        )
      case 'support':
        return <SupportScreen onBack={() => setScreen(supportReturnScreen)} />
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
            receivables={merchantPayoutDashboard.receivables}
            summary={merchantPayoutDashboard.summary}
            transactions={merchantPayoutDashboard.transactions}
          />
        )
      case 'providerTransactionDetails':
        return (
          <TransactionDetailsScreen
            transaction={selectedPayoutTransaction}
            onBack={() => setScreen('providerPayouts')}
            onContactSupport={() => {
              setSupportReturnScreen('providerTransactionDetails')
              setScreen('support')
            }}
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
            onMoveToTrash={(notificationIds) =>
              mutateInboxTrash('trash', [{ ids: notificationIds, itemType: 'notification' }])}
            onOpenTrash={(scope) => void openInboxTrash(scope)}
            onPreferencesChange={(preferences) =>
              void saveNotificationPreferences(preferences)
            }
            onSelectNotification={(notification) => {
              if (notification.category === 'booking') setScreen('providerBookingRequests')
              if (notification.category === 'payment') setScreen('providerPayouts')
              if (notification.category === 'message') {
                setMessageWorkspace('merchant')
                setScreen('messages')
              }
              if (notification.category === 'review') setScreen('providerReviews')
            }}
          />
        )
      case 'coordinatorHome':
        return (
          <CoordinatorScreen
            activeView={coordinatorHomeView}
            avatarUrl={userAvatarUrl}
            busyInvitationId={busyCoordinatorInvitationId}
            busyTaskId={busyCoordinatorTaskId}
            dashboard={coordinatorDashboard}
            errorMessage={coordinatorError}
            hasUnreadEventUpdates={hasUnreadEventUpdates}
            hasUnreadTaskUpdates={hasUnreadTaskUpdates}
            isLoading={isCoordinatorLoading}
            isRefreshing={isCoordinatorRefreshing}
            initialScrollOffset={coordinatorHomeScrollOffsetRef.current}
            onCreateTask={handleCreateCoordinatorTask}
            onConfirmChurchArrangement={handleConfirmChurchArrangement}
            onMessageClient={(event) => void handleCoordinatorMessageClient(event)}
            onMessageProvider={(event, service) => void handleCoordinatorMessageProvider(event, service)}
            onOpenEvent={(event) => {
              setSelectedCoordinatorEventId(event.id)
              setScreen('coordinatorEventDetails')
            }}
            onSaveChurchArrangement={handleSaveChurchArrangement}
            onOpenMessages={() => openCoordinatorTab('messages')}
            onOpenNotifications={() => setScreen('coordinatorNotifications')}
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
            onScrollPositionChange={(offset) => {
              coordinatorHomeScrollOffsetRef.current = offset
            }}
            onViewChange={setCoordinatorHomeView}
            unreadMessageCount={conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)}
            unreadNotificationCount={notifications.filter((notification) => !notification.isRead).length}
            userName={userName}
          />
        )
      case 'coordinatorEventDetails': {
        const selectedEvent = coordinatorDashboard.events.find(
          (event) => event.id === selectedCoordinatorEventId
        )
        return (
          <CoordinatorEventDetailsScreen
            churchDraft={coordinatorChurchDrafts[selectedCoordinatorEventId]}
            errorMessage={coordinatorError}
            event={selectedEvent}
            isLoading={isCoordinatorLoading}
            isRefreshing={isCoordinatorRefreshing}
            onBack={() => setScreen('coordinatorHome')}
            onChurchDraftChange={(draft) => {
              if (!selectedCoordinatorEventId) return
              setCoordinatorChurchDrafts((current) => ({
                ...current,
                [selectedCoordinatorEventId]: draft,
              }))
            }}
            onChurchDraftSaved={() => {
              if (!selectedCoordinatorEventId) return
              setCoordinatorChurchDrafts((current) => {
                const next = { ...current }
                delete next[selectedCoordinatorEventId]
                return next
              })
            }}
            onConfirmChurchArrangement={handleConfirmChurchArrangement}
            onMessageClient={(event) =>
              void handleCoordinatorMessageClient(event, 'coordinatorEventDetails')
            }
            onMessageProvider={(event, service) =>
              void handleCoordinatorMessageProvider(event, service, 'coordinatorEventDetails')
            }
            onRefresh={() => void loadCoordinatorWorkspace(true)}
            onSaveChurchArrangement={handleSaveChurchArrangement}
          />
        )
      }
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
            onMoveToTrash={(notificationIds) =>
              mutateInboxTrash('trash', [{ ids: notificationIds, itemType: 'notification' }])}
            onOpenTrash={(scope) => void openInboxTrash(scope)}
            onSelectNotification={(notification) => {
              void markMerchantNotificationRead(notification).then(() => refreshLiveData())
              if (notification.category === 'message') {
                openCoordinatorTab('messages')
              } else if (
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
              includeCoordinator={coordinatorPlanningEnabled}
              initialAllocations={planningBudgetAllocations}
              initialBudget={totalBudget}
              initialPriorities={budgetPriorities}
              isProcessing={activeGuardedActionCount > 0}
              onBack={openEventCreationFromBudget}
              onContinue={handleBudgetContinue}
              onDraftChange={queueBudgetAutosave}
              onRemoveCommittedCoordinator={
                assignedCoordinator ? () => void handleRemoveCoordinator() : undefined
              }
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
                if (!planningMarketplaceCategoryIds.has(category)) {
                  setToastMessage(hasConfiguredPlanningBudget
                    ? 'Allocate a positive budget to this category before browsing services.'
                    : 'This service category is not available for your event preferences.')
                  openBudgetAllocationFromServices()
                  return
                }
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
          <Animated.View
            style={[styles.screenTransition, { transform: [{ translateX: categoryBrowseEntrance }] }]}
          >
            <CategoryBrowseScreen
            categoryCountServices={
              serviceBrowseMode === 'planning' ? planningCatalogServices : catalogServices
            }
            categoryBudgets={planningCategoryBudgets}
            favoritePendingServiceIds={favoritePendingServiceIds}
            favoriteServiceIds={favoriteServiceIds}
            showFavoritesOnly={serviceBrowseMode === 'explore' && exploreFavoritesOnly}
            addableCategories={serviceBrowseMode === 'planning' && !changingServiceSelection
              ? addablePlanningServiceCategories
              : []}
            categories={serviceBrowseMode === 'planning'
              ? changingServiceSelection
                ? planningServiceCategories.filter((category) => (
                    categoryNameToId(category.name) === categoryNameToId(changingServiceSelection.category)
                  ))
                : planningServiceCategories
              : serviceCategories}
            categoryName={catalogCategoryName(selectedCategory)}
              eventGuestCount={eventDetails.guestCount}
            mode={serviceBrowseMode}
            services={(serviceBrowseMode === 'explore' ? catalogServices : visibleCatalogServices).filter(
              (service) => (
                (!replacementBooking || (
                  service.categoryName.toLowerCase() === replacementBooking.category.toLowerCase()
                  && service.id !== replacementBooking.serviceId
                )) && (!changingServiceSelection || (
                  service.categoryName.toLowerCase() === changingServiceSelection.category.toLowerCase()
                  && service.id !== changingServiceSelection.id
                ))
              )
            )}
            hasBudget={hasConfiguredPlanningBudget}
            selectedServiceCount={selectedServices.length}
            selectedServices={selectedServices}
            assignedCoordinator={assignedCoordinator}
            coordinatorAssignmentStatus={coordinatorAssignmentStatus}
            coordinatorPackage={selectedCoordinatorPackage}
            budget={totalBudget}
            categoryBudget={selectedCategoryBudget}
            categoryBudgetLocked={categoryBudgetLocked}
            categoryBudgetMaximum={categoryBudgetMaximum}
            cateringIncludedInVenuePackage={Boolean(venueCateringPackageSelection)}
            venueCateringPackage={venueCateringPackageSelection ? {
              allocatedBudget: venueCateringPackageAllocatedBudget,
              name: venueCateringPackageSelection.name,
              price: venueCateringPackageSelection.price,
            } : undefined}
            totalEstimatedCost={selectedEstimatedTotal}
            removingServiceId={removingServiceId}
            remainingBudget={unallocatedPlanBudget}
            unallocatedCategoryCount={unallocatedPlanningCategoryCount}
            planningSelectionsComplete={planningSelectionsComplete}
            showSelectionCompletionModal={planningSelectionsComplete && !selectionCompletionAcknowledged}
            changeServiceContext={changingServiceSelection ? {
              category: changingServiceSelection.category,
              currentAmount: changingServiceSelection.price,
              serviceId: changingServiceSelection.id,
              serviceName: changingServiceSelection.name,
            } : undefined}
            replacementContext={replacementBooking ? {
              baselineAmount: replacementBooking.baselineAmount,
              currentProviderName: replacementBooking.providerName,
              serviceName: replacementBooking.serviceName,
            } : undefined}
            showBottomNavigation={false}
            onScrollDirectionChange={serviceBrowseMode === 'explore'
              ? handleClientNavigationScrollDirection
              : undefined}
            onClearFavoritesFilter={() => setExploreFavoritesOnly(false)}
            onBack={() => {
              if (changingServiceSelection) {
                setChangingServiceSelection(undefined)
                setCurrentServiceId('')
                setToastMessage('Service change cancelled. Your current selection is unchanged.')
                return
              }
              if (serviceBrowseMode === 'planning') openBudgetAllocationFromServices()
              else setScreen('clientHome')
            }}
            onCategoryBudgetChange={async (amount) => {
              if (changingServiceSelection) {
                setToastMessage('Your budget remains unchanged while you compare a replacement service.')
                return false
              }
              const result = await setCategoryBudgetAllocation(selectedBudgetKey, amount)
              if (!result.ok) {
                await refreshLiveData()
                const message = result.message?.includes('Category allocations cannot exceed')
                  ? 'That amount is above the budget still available for this category. Your saved budget has been refreshed.'
                  : result.message
                setToastMessage(message ?? 'Unable to update this category budget.')
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
            onAddCategory={async (category) => {
              const categoryId = categoryNameToId(category.name)
              const planningCategory = PLANNING_CATEGORY_PRIORITY.find(
                (item) => item.categoryId === categoryId
              )
              if (!planningCategory || planningCategory.categoryId === 'eventOrganizers') {
                setToastMessage('This category cannot be added to the service marketplace.')
                return false
              }

              const result = await setCategoryBudgetAllocation(planningCategory.categoryKey, 0)
              if (!result.ok) {
                await refreshLiveData()
                setToastMessage(result.message ?? 'Unable to add this service category.')
                return false
              }

              setBudgetAllocations((current) => {
                if (current.some((item) => item.categoryKey === planningCategory.categoryKey)) {
                  return current
                }
                return [
                  ...current,
                  { amount: 0, categoryKey: planningCategory.categoryKey, label: category.name },
                ]
              })
              setSelectedCategory(categoryId)
              setCatalogServices(await loadClientCatalogServices())
              return true
            }}
            onAddService={() => {
              const nextCategory = getNextPlanningServiceCategory(selectedPlanningCategoryIds)
              openPlanningHub(undefined, nextCategory ?? selectedCategory)
            }}
            onRemoveCoordinator={() => void handleRemoveCoordinator()}
            onRemoveService={handleRemoveSelection}
            onChangeService={handleChangeService}
            onSelectionCompletionDismissed={() => setSelectionCompletionAcknowledged(true)}
            onSelectService={(serviceId) => {
              setToastMessage('')
              setCurrentServiceId(serviceId)
              setScreen('serviceDetails')
            }}
            onConfirmReplacement={(serviceId) => {
              const replacement = catalogServices.find((service) => service.id === serviceId)
              if (!replacement || replacement.id === replacementBooking?.serviceId) return false
              setCurrentServiceId(serviceId)
              setScreen('serviceDetails')
              return true
            }}
            onSelectCategory={(category) => {
              setSelectedCategory(categoryNameToId(category.name))
            }}
            onToggleFavorite={(serviceId) => void handleToggleFavorite(serviceId)}
            onReviewVenuePackage={() => {
              if (!venueCateringPackageSelection) return
              setServiceBrowseMode('planning')
              setCurrentServiceId(venueCateringPackageSelection.id)
              setSelectedCategory('venues')
              setScreen('serviceDetails')
            }}
            onSelectVendor={(vendorId) => {
              setToastMessage('')
              const selectedVendor = catalogServices.find((service) => service.id === vendorId)
              if (
                serviceBrowseMode === 'planning'
                && selectedVendor?.kind === 'coordinator'
                && !hasEventOrganizerBudget
              ) {
                setSelectedCategory('catering')
                setToastMessage('Allocate a positive Event Organizer budget to browse coordinators.')
                return
              }
              setCurrentServiceId(vendorId)
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
            coordinatorBookingEnabled={hasEventOrganizerBudget}
            isAssigned={assignedCoordinator?.id === currentService?.id}
            mode={serviceBrowseMode}
            onBack={() => setScreen('categoryBrowse')}
            onSelectProvider={() => void handleAssignCoordinator()}
            service={currentService}
          />
        )
      case 'serviceDetails':
        return (
          <ServiceDetailsScreen
            availableCategoryBudget={categoryBudgetMaximum}
            eventDate={eventDetails.date}
            eventGuestCount={eventDetails.guestCount}
            eventTime={eventDetails.time}
            mode={serviceBrowseMode}
            service={currentService}
            hasBudget={hasConfiguredPlanningBudget}
            isChangingSelection={Boolean(changingServiceSelection)}
            initialFoodTastingPreference={
              directCateringFallbackServiceId === currentService?.id ? false : undefined
            }
            initialPhotoVideoSelection={
              photoVideoSelectionDraft?.serviceId === currentService?.id
                ? photoVideoSelectionDraft?.selection
                : undefined
            }
            onAddSelection={handleAddSelection}
            onLoadFoodTastingDraft={handleLoadCateringTastingDraft}
            onSaveFoodTastingDraft={handleSaveCateringTastingDraft}
            onCalculateQuote={calculateServiceDetailsQuote}
            onBack={() => setScreen('categoryBrowse')}
            onReadAllReviews={() => setScreen('serviceDetails')}
            onPhotoVideoSelectionChange={(selection) => {
              if (!currentService) return
              const draft = { selection, serviceId: currentService.id }
              setPhotoVideoSelectionDraft(draft)
              persistClientPlanningResume({ photoVideoSelectionDraft: draft })
            }}
            reviewInsights={serviceReviewInsights}
            reviewInsightsLoading={serviceReviewInsightsLoading}
          />
        )
      case 'instructionModule':
        return (
          <InstructionModuleScreen
            initialValue={instructionDraft}
            onBack={() => openPlanningHub('back')}
            onDraftChange={handleInstructionDraftChange}
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

              setInstructionDraft(undefined)
              persistClientPlanningResume({ instructionDraft: undefined })
              setMaxPlanningStep((current) => Math.max(current, 5))
              setScreen(selectedServices.length > 0 || assignedCoordinator ? 'payment' : 'categoryBrowse')
            }}
          />
        )
      case 'messages':
        return renderMessagesWorkspace()
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
            isLoadingMessages={isLoadingConversationMessages}
            isReadOnly={selectedConversation?.isReadOnly}
            isSending={isSendingMessage}
            messages={conversationMessages}
            onMoveMessagesToTrash={async (messageIds) => {
              const moved = await mutateInboxTrash('trash', [{ ids: messageIds, itemType: 'message' }])
              if (moved) {
                setConversationMessages((current) => current.filter((message) => !messageIds.includes(message.id)))
              }
              return moved
            }}
            onOpenTrash={(scope) => void openInboxTrash(scope)}
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
                chatReturnScreen === 'coordinatorEventDetails'
                  ? 'coordinatorEventDetails'
                  : chatReturnScreen === 'coordinatorHome' || messageWorkspace === 'coordinator'
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
        if (homeReturnScreen === 'clientHome') return renderMessagesWorkspace('notifications')
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
              if (notification.category === 'message') {
                setMessageWorkspace(homeReturnScreen === 'providerHome' ? 'merchant' : 'client')
                setScreen('messages')
              }
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
          <EventSummaryScreen
            event={eventSummary}
            isSavingPlan={isSavingPlanForLater}
            isSubmittingRequests={isSubmittingBookingRequests}
            items={summaryItems}
            onBack={() => setScreen('instructionModule')}
            onReviewSavedPlan={reviewSavedPlanChanges}
            onSavePlan={() => void savePlanForLater()}
            onSubmitRequests={() => void submitBookingRequests()}
            savedPlanReview={savedPlanReview}
          />
        )
      case 'confirmation':
        return (
          <ConfirmationScreen
            receipt={{
              currencySymbol: '₱',
              eventDate: eventDisplayDate,
              items: payableItems.map((item) => ({
                detail: item.detail,
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
            showBottomNavigation={false}
            onOpenMenu={() => setScreen('clientHome')}
            onOpenProfile={() => openAccountProfile('bookings')}
            onScrollDirectionChange={handleClientNavigationScrollDirection}
            unreadBookingResourceIds={unreadBookingResourceIds}
            onSelectBooking={(booking) => {
              setSelectedBooking(booking)
              setBookingPaymentQuote(undefined)
              setPaymentSettlementContext(undefined)
              setIsBookingPaymentSheetVisible(false)
              setScreen('bookingDetails')
              if (booking.eventId) void loadBookingPaymentQuote(booking.eventId)
            }}
            onSelectTab={(tab) => {
              if (tab === 'merchants') openClientTab('explore')
              else openClientTab(tab)
            }}
          />
        )
      case 'bookingDetails':
        return (
          <>
            <BookingDetailsScreen
            booking={selectedBooking}
            details={{
              date: selectedBooking?.date ?? eventDisplayDate,
              paymentStatus:
                selectedBooking?.paymentStatus ?? 'Pending',
              price: formatPeso(selectedBooking?.amount ?? 0),
              requestedDate: selectedBooking?.createdAt
                ? new Date(selectedBooking.createdAt).toLocaleDateString('en-PH')
                : eventDisplayDate,
              time: selectedBooking?.requestedTime ?? eventDisplayTime,
            }}
            onBack={() => {
              setIsBookingPaymentSheetVisible(false)
              setScreen('bookings')
            }}
            onCancelBooking={handleClientBookingCancellation}
            onFindAlternativeServices={(service) => void handleFindAlternativeServices(service)}
            onMessageProviderForBooking={(bookingId) =>
              void openBookingConversationFor(bookingId, 'bookingDetails')
            }
            onMessageCoordinatorForEvent={(eventId) =>
              void openEventCoordinatorConversationFor(eventId, 'bookingDetails')
            }
            onRespondChurchProposal={handleClientChurchProposalResponse}
            onLoadFoodTastingSlots={loadCateringFoodTastingSlots}
            onLoadFoodTastingRescheduleSlots={loadV15CateringFoodTastingRescheduleSlots}
            onStartPayment={() => void openBookingPayment()}
            onChooseFinalCateringMenu={(service) => void handleChooseFinalCateringMenu(service)}
            onConfirmFoodTastingAttendance={handleClientFoodTastingAttendance}
            onRespondToFoodTastingFinalMenu={handleClientFoodTastingFinalMenuResponse}
            onRequestFoodTasting={handleClientFoodTastingRequest}
            onRescheduleBooking={handleClientBookingReschedule}
            onRescheduleFoodTasting={handleClientFoodTastingReschedule}
            onRespondToFoodTastingProposal={handleClientFoodTastingProposal}
            onSavePhotoVideoShotList={handleSavePhotoVideoShotList}
            onConfirmPhotoVideoPreEventPlan={handleConfirmPhotoVideoPreEventPlan}
            onRespondToPhotoVideoEventDayRequest={handleRespondToPhotoVideoEventDayRequest}
            onRespondToPhotoVideoDeliverable={handleRespondToPhotoVideoDeliverable}
            onSubmitReview={
              selectedBooking?.status === 'completed' && !selectedBooking.hasFeedback
                ? () => setScreen('eventFeedback')
                : undefined
            }
            paymentQuote={bookingPaymentQuote}
            isLoadingPaymentQuote={isLoadingBookingPaymentQuote}
            isStartingPayment={isInitiatingBookingPayment}
            />
            <BookingPaymentSheet
              isLoading={isPreparingBookingPayment}
              isProcessing={isInitiatingBookingPayment}
              onClose={() => setIsBookingPaymentSheetVisible(false)}
              onPay={(value) => void initiateBookingPayment(value)}
              items={bookingPaymentQuote?.items}
              paymentBreakdown={bookingPaymentQuote?.breakdown}
              paymentSettlementContext={paymentSettlementContext}
              usePaymongoCheckout
              visible={isBookingPaymentSheetVisible}
            />
          </>
        )
      case 'bookingPayment':
        return (
          <PaymentScreen
            event={{
              date: selectedBooking?.date ?? eventDisplayDate,
              guestCount: selectedBooking?.guestCount ?? 0,
              name: bookingPaymentQuote?.eventName ?? selectedBooking?.name ?? 'Event booking',
              time: selectedBooking?.requestedTime ?? eventDisplayTime,
            }}
            isProcessing={isInitiatingBookingPayment}
            items={bookingPaymentQuote?.items ?? []}
            mode="booking"
            onBack={() => setScreen('bookingDetails')}
            onPay={(value) => void initiateBookingPayment(value)}
            paymentBreakdown={bookingPaymentQuote?.breakdown}
            paymentSettlementContext={paymentSettlementContext}
            usePaymongoCheckout
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
  const hasUnreadClientInbox = hasUnreadMessageUpdates || unreadInboxNotifications.length > 0
  const clientMainTab: ClientHomeTab | null =
    screen === 'clientHome'
      ? 'home'
      : screen === 'clientPlans'
        ? 'home'
      : screen === 'categoryBrowse' && serviceBrowseMode === 'explore'
        ? 'explore'
        : screen === 'bookings'
          ? 'bookings'
          : screen === 'messages' && messageWorkspace === 'client' && homeReturnScreen === 'clientHome'
            ? 'messages'
            : screen === 'notifications' && homeReturnScreen === 'clientHome'
              ? 'messages'
          : screen === 'accountProfile' && (
            profileReturnScreen === 'clientHome'
            || profileReturnScreen === 'budgetTracker'
            || profileReturnScreen === 'bookings'
            || profileReturnScreen === 'messages'
          )
            ? 'profile'
            : null

  const providerMainTab: MerchantHomeTab | null =
    screen === 'providerHome'
      ? 'home'
      : screen === 'providerServices'
        ? 'services'
        : screen === 'providerBookingRequests'
          ? 'bookings'
          : screen === 'messages' && messageWorkspace === 'merchant' && homeReturnScreen === 'providerHome'
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
      || isSubmittingBookingRequests
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

  // Explore is a standalone marketplace. The event wizard deliberately uses
  // explicit header controls and progress segments instead of horizontal
  // gestures, so a horizontal interaction inside any screen cannot skip a
  // validation step or change the current plan route.
  const isPlanningNavigationContext = serviceBrowseMode === 'planning'
  const usesFloatingBottomNavigation = Boolean(clientMainTab || providerMainTab)
    || screen === 'coordinatorHome'
    || (screen === 'messages' && messageWorkspace === 'coordinator')
  // The floating navigation owns its own bottom inset. Keeping the root
  // bottom edge on these screens shortens every ScrollView above Android's
  // system bar, leaving the horizontal cutoff shown on three-button devices.
  // Fixed-footer and wizard screens deliberately retain the root bottom inset.
  const appSafeAreaEdges = screen === 'clientHome'
    ? (['right', 'left'] as const)
    : usesFloatingBottomNavigation
      ? (['top', 'right', 'left'] as const)
      : (['top', 'right', 'bottom', 'left'] as const)
  const renderedScreen = renderScreen()

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === 'clientHome' ? 'light' : 'dark'} />
      <SafeAreaView
        edges={appSafeAreaEdges}
        style={[styles.container, isHome && styles.homeContainer]}
      >
        <ScreenMotionFrame
          disabled={screensWithOwnEntrance.has(screen)}
          isLocked={isScreenTransitioning}
          progress={screenTransitionProgress}
        >
            {isPlanningNavigationContext ? (
              <PlanningStepNavigationProvider
                maxReachableStep={maxPlanningStep}
                onStepPress={handlePlanningStepPress}
              >
                {renderedScreen}
              </PlanningStepNavigationProvider>
            ) : renderedScreen}
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
            hasUnreadHomeUpdates={hasUnreadBookingUpdates}
            hasUnreadInbox={hasUnreadClientInbox}
            isVisible={isClientNavigationVisible}
            onSelectTab={openClientTab}
            onToggleNavigation={keepClientNavigationVisibleForToggle}
          />
        ) : null}
        {width < 768 && providerMainTab ? (
          <MerchantBottomNavigation
            activeTab={providerMainTab}
            hasUnreadBookings={hasUnreadBookingUpdates}
            hasUnreadMessages={hasUnreadMessageUpdates}
            onSelectTab={openMerchantTab}
          />
        ) : null}
        <InboxTrashModal
          busy={isInboxTrashLoading || isInboxTrashMutating}
          items={inboxTrashItems}
          scope={inboxTrashScope}
          onClear={(items) => {
            const groups = new Map<InboxItemType, string[]>()
            items.forEach((item) => groups.set(item.itemType, [...(groups.get(item.itemType) ?? []), item.id]))
            void mutateInboxTrash('clear', Array.from(groups, ([itemType, ids]) => ({ ids, itemType })))
          }}
          onClose={() => setIsInboxTrashVisible(false)}
          onRestore={(items) => {
            const groups = new Map<InboxItemType, string[]>()
            items.forEach((item) => groups.set(item.itemType, [...(groups.get(item.itemType) ?? []), item.id]))
            void mutateInboxTrash('restore', Array.from(groups, ([itemType, ids]) => ({ ids, itemType })))
          }}
          visible={isInboxTrashVisible}
        />
        <ServiceChangeConfirmationModal
          confirmation={serviceChangeConfirmation}
          onCancel={() => resolveServiceChangeConfirmation(false)}
          onConfirm={() => resolveServiceChangeConfirmation(true)}
        />
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
  serviceChangeOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 10, 15, 0.58)',
    padding: 24,
  },
  serviceChangeCard: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DAC0C2',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  serviceChangeIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#F8EDEF',
    marginBottom: 14,
  },
  serviceChangeIconText: {
    color: '#6B1E2E',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 30,
  },
  serviceChangeTitle: {
    color: '#4E061A',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  serviceChangeCopy: {
    color: '#5E5E5E',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  serviceChangeComparison: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    backgroundColor: '#FCFAFA',
    marginTop: 20,
    overflow: 'hidden',
  },
  serviceChangeServiceRow: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  serviceChangeDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  serviceChangeLabel: {
    color: '#6B1E2E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    lineHeight: 14,
  },
  serviceChangeName: {
    color: '#1A1C1C',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 3,
  },
  serviceChangeProvider: {
    color: '#5E5E5E',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 1,
  },
  serviceChangeConfiguration: {
    color: '#5E5E5E',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  serviceChangePrice: {
    color: '#4E061A',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 6,
  },
  serviceChangeDifference: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    backgroundColor: '#F8EDEF',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  serviceChangeDifferenceLabel: {
    color: '#5E5E5E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    lineHeight: 14,
  },
  serviceChangeDifferenceValue: {
    color: '#1A1C1C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  serviceChangeDifferenceHigher: { color: '#B3261E' },
  serviceChangeDifferenceLower: { color: '#16794A' },
  serviceChangeActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  serviceChangeCancel: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DAC0C2',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  serviceChangeCancelText: {
    color: '#6B1E2E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    lineHeight: 15,
  },
  serviceChangeConfirm: {
    minHeight: 48,
    flex: 1.28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#6B1E2E',
    paddingHorizontal: 12,
  },
  serviceChangeConfirmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.65,
    lineHeight: 15,
  },
  serviceChangePressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
})
