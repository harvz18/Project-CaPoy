import { Text } from '../components/AppText'
import { ChurchLocationMap, formatChurchDate, formatChurchTime } from '../components/ChurchArrangementControls'
import { VenueBookingSummary } from '../components/VenueBookingSummary'
import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import type { CateringFoodTastingSlot, CateringFoodTastingSlotsResult } from '../lib/merchant'
import { formatPeso } from '../lib/catalog'
import type { EventPaymentQuote } from '../lib/planning'
import type { BookingItem } from './11-BookingScreen'

export interface BookingChangeActionResult {
  message?: string
  ok: boolean
}

export interface BookingDetailValue {
  confirmedDate: string
  coverage: string
  date: string
  paymentStatus: string
  price: string
  requestedDate: string
  service: string
  time: string
}

interface BookingDetailsScreenProps {
  booking?: BookingItem
  details?: Partial<BookingDetailValue>
  onBack?: () => void
  onCancelBooking?: (reason: string) => Promise<BookingChangeActionResult>
  onChooseFinalCateringMenu?: (service: NonNullable<BookingItem['services']>[number]) => Promise<void> | void
  onConfirmFoodTastingAttendance?: (bookingId: string) => Promise<BookingChangeActionResult>
  onFindAlternativeServices?: (service: NonNullable<BookingItem['services']>[number]) => void
  onMessageCoordinatorForEvent?: (eventId: string) => void
  onMessageProviderForBooking?: (bookingId: string) => void
  onRespondChurchProposal?: (approved: boolean, declineReason?: string) => Promise<BookingChangeActionResult>
  onLoadFoodTastingSlots?: (bookingId: string, useV15?: boolean) => Promise<CateringFoodTastingSlotsResult>
  onLoadFoodTastingRescheduleSlots?: (bookingId: string) => Promise<CateringFoodTastingSlotsResult>
  onStartPayment?: () => void
  onRequestFoodTasting?: (value: {
    bookingId: string
    note?: string
    scheduledDate: string
    startTime: string
    useV15?: boolean
  }) => Promise<BookingChangeActionResult>
  onRescheduleBooking?: (value: {
    date: string
    time: string
  }) => Promise<BookingChangeActionResult>
  onRescheduleFoodTasting?: (value: {
    bookingId: string
    note?: string
    scheduledDate: string
    startTime: string
  }) => Promise<BookingChangeActionResult>
  onRespondToFoodTastingProposal?: (
    tastingId: string,
    acceptProposal: boolean
  ) => Promise<BookingChangeActionResult>
  onSubmitReview?: () => void
  paymentQuote?: EventPaymentQuote
  isLoadingPaymentQuote?: boolean
  isStartingPayment?: boolean
}

const defaultProvider: Pick<
  BookingItem,
  'category' | 'image' | 'imageLabel' | 'name'
> = {
  name: 'Lumina Studios',
  category: 'Photography',
  imageLabel: 'Premium camera lens on a white marble surface',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA0Fb2-g7_vlAPClrrgdTM3UGNmnrPIMQgSRE3sgb8csRiqWdSuk2PrdPzC-05cAJr_nZtTzaMFyk--FHj1W1F9xJrbW9s_mwRvqTEFDUhEiRZUV65A9EWz-gKyplEfphrN-FFv1sW9g5lNDJyLuUwPqRvFPkP-RHF84OmkJ5CQc-RJs6xkqoH8S5hoYXjmOGTiyntWNIrQRoS8R0vNP38s05VrAZeE-wSrMTdT476tUrn7jLiuN4X4Vg',
}

const defaultDetails: BookingDetailValue = {
  requestedDate: 'Oct 10, 2024',
  confirmedDate: 'Oct 12, 2024',
  service: 'Wedding Photography',
  date: 'Oct 24, 2025',
  time: '1:00 PM',
  coverage: 'Full Day',
  price: '₱3,200',
  paymentStatus: 'Paid',
}

const emptyBookedServices: NonNullable<BookingItem['services']> = []

export interface EventProviderBalance {
  confirmedExternalPaymentAmount: number
  initialPaymentRecordedAt?: string
  initialProviderShare: number
  providerName: string
  remainingBalance: number
  serviceAmount: number
  status: 'cleared' | 'partially_confirmed' | 'awaiting_payment'
}

export interface EventPaymentSummary {
  confirmedExternalPaymentAmount: number
  initialProviderShare: number
  isCleared: boolean
  providerBalances: EventProviderBalance[]
  recordedPaymentAmount: number
  remainingBalance: number
  serviceAmount: number
}

export const calculateEventPaymentSummary = (
  services: NonNullable<BookingItem['services']>
): EventPaymentSummary | undefined => {
  const activeServices = services.filter(
    (service) => !['cancelled', 'declined'].includes(service.status)
  )
  if (!activeServices.length) return undefined

  const byProvider = new Map<string, EventProviderBalance>()
  activeServices.forEach((service) => {
    const serviceAmount = Math.max(0, service.serviceAmount ?? service.amount)
    const initialProviderShare = Math.max(0, service.initialProviderShare ?? 0)
    const confirmedExternalPaymentAmount = Math.max(0, service.confirmedExternalPaymentAmount ?? 0)
    const remainingBalance = Math.max(
      0,
      service.remainingServiceBalance ?? serviceAmount - initialProviderShare - confirmedExternalPaymentAmount
    )
    const key = service.providerId || service.bookingId
    const current = byProvider.get(key) ?? {
      confirmedExternalPaymentAmount: 0,
      initialProviderShare: 0,
      providerName: service.providerName,
      remainingBalance: 0,
      serviceAmount: 0,
      status: 'awaiting_payment' as const,
    }
    const initialPaymentRecordedAt = current.initialPaymentRecordedAt ?? service.initialPaymentRecordedAt
    const next: EventProviderBalance = {
      ...current,
      confirmedExternalPaymentAmount: current.confirmedExternalPaymentAmount + confirmedExternalPaymentAmount,
      initialPaymentRecordedAt,
      initialProviderShare: current.initialProviderShare + initialProviderShare,
      remainingBalance: current.remainingBalance + remainingBalance,
      serviceAmount: current.serviceAmount + serviceAmount,
      status: remainingBalance <= 0 && current.remainingBalance <= 0
        ? 'cleared'
        : confirmedExternalPaymentAmount > 0 || current.confirmedExternalPaymentAmount > 0
          ? 'partially_confirmed'
          : 'awaiting_payment',
    }
    byProvider.set(key, next)
  })

  const providerBalances = Array.from(byProvider.values())
  const serviceAmount = providerBalances.reduce((total, provider) => total + provider.serviceAmount, 0)
  const initialProviderShare = providerBalances.reduce((total, provider) => total + provider.initialProviderShare, 0)
  const confirmedExternalPaymentAmount = providerBalances.reduce(
    (total, provider) => total + provider.confirmedExternalPaymentAmount,
    0
  )
  const remainingBalance = providerBalances.reduce((total, provider) => total + provider.remainingBalance, 0)

  return {
    confirmedExternalPaymentAmount,
    initialProviderShare,
    isCleared: serviceAmount > 0 && remainingBalance <= 0,
    providerBalances,
    recordedPaymentAmount: Math.max(0, serviceAmount - remainingBalance),
    remainingBalance,
    serviceAmount,
  }
}

const formatPaymentDate = (value?: string) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const completionPaymentLabel = (service: NonNullable<BookingItem['services']>[number]) => {
  const remaining = Math.max(0, service.remainingServiceBalance ?? 0)
  const confirmed = Math.max(0, service.confirmedExternalPaymentAmount ?? 0)

  if (service.status === 'completed' && remaining <= 0) return 'Fully paid / completed'
  if (remaining <= 0) return 'Fully paid — awaiting provider completion'
  if (confirmed > 0 || service.completionPaymentStatus === 'partially_confirmed') {
    return 'Partially confirmed external payment'
  }
  return 'Awaiting remaining payment'
}

const formatTastingDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

const formatTastingTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const hours = Number(match[1])
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? 'PM' : 'AM'}`
}

const formatTastingStatus = (status: string) => ({
  cancelled: 'Cancelled',
  completed: 'Completed',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  requested: 'Awaiting provider confirmation',
  reschedule_proposed: 'Provider proposed a new schedule',
}[status] ?? 'Scheduled')

const formatChurchArrangementStatus = (status?: string) => ({
  awaiting_client_confirmation: 'Awaiting your confirmation',
  client_approved: 'You approved this proposal',
  confirmed: 'Confirmed',
  coordinator_confirmed: 'Coordinator confirmed',
  declined: 'Declined',
  looking_for_church: 'Looking for a church',
  not_started: 'Not started',
  proposed: 'Church proposed',
}[status ?? 'not_started'] ?? 'Not started')

const getCoordinatorTrackerStatus = (status?: string) => {
  if (status === 'accepted') return { kind: 'confirmed' as const, label: 'CONFIRMED' }
  if (status === 'declined' || status === 'cancelled') {
    return { kind: 'declined' as const, label: status.toUpperCase() }
  }
  if (status === 'awaiting_assignment') return { kind: 'requested' as const, label: 'ASSIGNING' }
  return { kind: 'requested' as const, label: 'REQUESTED' }
}

export const BookingDetailsScreen: React.FC<BookingDetailsScreenProps> = ({
  booking,
  details,
  onBack,
  onCancelBooking,
  onChooseFinalCateringMenu,
  onConfirmFoodTastingAttendance,
  onFindAlternativeServices,
  onMessageCoordinatorForEvent,
  onMessageProviderForBooking,
  onRespondChurchProposal,
  onLoadFoodTastingSlots,
  onLoadFoodTastingRescheduleSlots,
  onStartPayment,
  onRequestFoodTasting,
  onRescheduleBooking,
  onRescheduleFoodTasting,
  onRespondToFoodTastingProposal,
  onSubmitReview,
  paymentQuote,
  isLoadingPaymentQuote = false,
  isStartingPayment = false,
}) => {
  const provider = booking ?? defaultProvider
  const isConfirmed = booking?.status === 'confirmed' || booking?.status === 'completed'
  const isCompleted = booking?.status === 'completed'
  const isCancelled = booking?.status === 'cancelled'
  const canMessageCoordinator = Boolean(
    booking?.eventId
      && booking?.isChurchWedding
      && booking?.coordinatorAssignmentStatus === 'accepted'
  )
  const bookedServices = booking?.services ?? emptyBookedServices
  const localAcceptedProviderCount = bookedServices.filter(
    (service) => service.status === 'confirmed' || service.status === 'completed'
  ).length
  const providerCount = paymentQuote?.acceptance.providerCount ?? bookedServices.length
  const acceptedProviderCount = paymentQuote?.acceptance.acceptedProviderCount ?? localAcceptedProviderCount
  const coordinatorRequired = paymentQuote?.acceptance.coordinatorRequired ?? Boolean(booking?.coordinatorRequired)
  const coordinatorAccepted = paymentQuote?.acceptance.coordinatorAccepted
    ?? (!coordinatorRequired || booking?.coordinatorAssignmentStatus === 'accepted')
  const coordinatorTrackerStatus = getCoordinatorTrackerStatus(booking?.coordinatorAssignmentStatus)
  const hasCoordinatorTracker = Boolean(booking?.coordinatorRequired)
  const canMessageEventCoordinator = Boolean(
    booking?.eventId
      && booking?.coordinatorAssignmentStatus === 'accepted'
      && onMessageCoordinatorForEvent
  )
  const paymentReady = Boolean(
    paymentQuote?.paymentEligible
      && ['not_initiated', 'payment_failed_or_cancelled'].includes(paymentQuote.paymentState)
      && onStartPayment
  )
  const paymentInitiated = paymentQuote?.paymentState === 'payment_initiated'
  const paymentRecorded = paymentQuote?.paymentState === 'paid_or_verified'
  const paymentFailed = paymentQuote?.paymentState === 'payment_failed_or_cancelled'
  const paymentBlockedMessage = paymentQuote?.reason
    ?? (providerCount > acceptedProviderCount
      ? 'Payment will become available once all selected service providers have accepted your booking requests.'
      : coordinatorRequired && !coordinatorAccepted
        ? 'Payment will become available once your event coordinator has accepted the booking request.'
        : 'Checking the latest provider confirmations before payment is enabled.')
  const eventPaymentSummary = calculateEventPaymentSummary(bookedServices)
  const [changeMode, setChangeMode] = React.useState<'cancel' | 'options' | 'reschedule'>()
  const [changeError, setChangeError] = React.useState('')
  const [cancelReason, setCancelReason] = React.useState('')
  const [newDate, setNewDate] = React.useState(booking?.date ?? '')
  const [newTime, setNewTime] = React.useState(booking?.requestedTime ?? '')
  const [isSubmittingChange, setIsSubmittingChange] = React.useState(false)
  const [tastingServiceId, setTastingServiceId] = React.useState('')
  const [tastingSlots, setTastingSlots] = React.useState<CateringFoodTastingSlot[]>([])
  const [selectedTastingSlot, setSelectedTastingSlot] = React.useState<CateringFoodTastingSlot>()
  const [tastingNote, setTastingNote] = React.useState('')
  const [tastingScheduleMode, setTastingScheduleMode] = React.useState<'initial' | 'reschedule'>('initial')
  const [tastingUsesV15, setTastingUsesV15] = React.useState(false)
  const [tastingError, setTastingError] = React.useState('')
  const [isLoadingTastingSlots, setIsLoadingTastingSlots] = React.useState(false)
  const [isSavingTasting, setIsSavingTasting] = React.useState(false)
  const [dismissedTastingPrompts, setDismissedTastingPrompts] = React.useState<Set<string>>(new Set())
  const [churchResponseMode, setChurchResponseMode] = React.useState<'approve' | 'decline'>()
  const [churchDeclineReason, setChurchDeclineReason] = React.useState('')
  const [churchResponseError, setChurchResponseError] = React.useState('')
  const [isSavingChurchResponse, setIsSavingChurchResponse] = React.useState(false)
  const value = {
    ...defaultDetails,
    ...(booking
      ? {
          confirmedDate:
            isConfirmed && booking.updatedAt
              ? new Date(booking.updatedAt).toLocaleDateString('en-PH')
              : '',
          coverage: `${bookedServices.length} service${bookedServices.length === 1 ? '' : 's'}`,
          service: booking.eventType || booking.category,
          date: booking.date,
        }
      : {}),
    ...details,
  }
  const paymentStatusText = paymentInitiated
    ? 'Awaiting verification'
    : paymentRecorded
      ? paymentQuote?.paymentStatus === 'verified' ? 'Payment verified' : 'Payment recorded'
      : paymentFailed
        ? 'Payment needs attention'
        : paymentQuote?.paymentEligible
          ? 'Ready for payment'
          : value.paymentStatus
  const churchProposalPending = booking?.churchArrangement?.arrangementStatus === 'awaiting_client_confirmation'
    && booking.churchArrangement.clientResponseStatus === 'pending'
  const coordinatorConfirmedChurch = booking?.churchArrangement?.arrangementStatus === 'coordinator_confirmed'
  const tastingSlotsByDate = React.useMemo(() => tastingSlots.reduce<Record<string, CateringFoodTastingSlot[]>>(
    (groups, slot) => ({
      ...groups,
      [slot.scheduledDate]: [...(groups[slot.scheduledDate] ?? []), slot],
    }),
    {}
  ), [tastingSlots])
  const tastingService = React.useMemo(
    () => bookedServices.find((service) => service.bookingId === tastingServiceId),
    [bookedServices, tastingServiceId]
  )
  const canSubmitFoodTasting = Boolean(
    selectedTastingSlot
    && !isSavingTasting
    && (tastingScheduleMode === 'reschedule' ? onRescheduleFoodTasting : onRequestFoodTasting)
  )

  React.useEffect(() => {
    setChangeMode(undefined)
    setChangeError('')
    setCancelReason('')
    setNewDate(booking?.date ?? '')
    setNewTime(booking?.requestedTime ?? '')
    setTastingServiceId('')
    setTastingSlots([])
    setSelectedTastingSlot(undefined)
    setTastingNote('')
    setTastingScheduleMode('initial')
    setTastingUsesV15(false)
    setTastingError('')
    setDismissedTastingPrompts(new Set())
    setChurchResponseMode(undefined)
    setChurchDeclineReason('')
    setChurchResponseError('')
  }, [booking?.churchArrangement?.activeProposalId, booking?.date, booking?.id, booking?.requestedTime])

  const closeChurchResponse = () => {
    if (isSavingChurchResponse) return
    setChurchResponseMode(undefined)
    setChurchResponseError('')
  }

  const submitChurchResponse = async () => {
    if (!churchResponseMode || !onRespondChurchProposal || isSavingChurchResponse) return
    const approved = churchResponseMode === 'approve'
    const normalizedReason = churchDeclineReason.trim()
    if (!approved && !normalizedReason) {
      setChurchResponseError('Please tell your coordinator why you are declining this church.')
      return
    }

    setIsSavingChurchResponse(true)
    setChurchResponseError('')
    const result = await onRespondChurchProposal(approved, approved ? undefined : normalizedReason)
    setIsSavingChurchResponse(false)
    if (!result.ok) {
      setChurchResponseError(result.message ?? 'Unable to update this church proposal.')
      return
    }
    setChurchResponseMode(undefined)
    setChurchDeclineReason('')
  }

  const closeChangeModal = () => {
    if (isSubmittingChange) return
    setChangeMode(undefined)
    setChangeError('')
  }

  const submitCancellation = async () => {
    if (!onCancelBooking || isSubmittingChange) return
    setIsSubmittingChange(true)
    setChangeError('')
    const result = await onCancelBooking(cancelReason)
    setIsSubmittingChange(false)

    if (!result.ok) {
      setChangeError(result.message ?? 'Unable to cancel this booking.')
      return
    }

    setChangeMode(undefined)
  }

  const submitReschedule = async () => {
    if (!onRescheduleBooking || isSubmittingChange) return
    setIsSubmittingChange(true)
    setChangeError('')
    const result = await onRescheduleBooking({ date: newDate, time: newTime })
    setIsSubmittingChange(false)

    if (!result.ok) {
      setChangeError(result.message ?? 'Unable to reschedule this booking.')
      return
    }

    setChangeMode(undefined)
  }

  const closeTastingModal = () => {
    if (isSavingTasting) return
    setTastingServiceId('')
    setSelectedTastingSlot(undefined)
    setTastingError('')
    setTastingUsesV15(false)
    setTastingScheduleMode('initial')
  }

  const openTastingSchedule = async (
    service: NonNullable<BookingItem['services']>[number],
    mode: 'initial' | 'reschedule' = 'initial'
  ) => {
    const loadSlots = mode === 'reschedule'
      ? onLoadFoodTastingRescheduleSlots
      : onLoadFoodTastingSlots
    if (!loadSlots || isLoadingTastingSlots) return
    setTastingServiceId(service.bookingId)
    setTastingSlots([])
    setSelectedTastingSlot(undefined)
    setTastingNote('')
    setTastingError('')
    setTastingScheduleMode(mode)
    setTastingUsesV15(Boolean(service.foodTastingWorkflow))
    setIsLoadingTastingSlots(true)
    const result = mode === 'reschedule'
      ? await loadSlots(service.bookingId)
      : await loadSlots(service.bookingId, Boolean(service.foodTastingWorkflow))
    setIsLoadingTastingSlots(false)
    if (!result.ok) {
      setTastingError(result.message ?? 'Unable to load food tasting availability.')
      return
    }
    setTastingSlots(result.data ?? [])
  }

  const submitFoodTasting = async () => {
    if (
      !selectedTastingSlot
      || !tastingServiceId
      || isSavingTasting
      || (tastingScheduleMode === 'initial' && !onRequestFoodTasting)
      || (tastingScheduleMode === 'reschedule' && !onRescheduleFoodTasting)
    ) return
    setIsSavingTasting(true)
    setTastingError('')
    const result = tastingScheduleMode === 'reschedule'
      ? await onRescheduleFoodTasting!({
          bookingId: tastingServiceId,
          note: tastingNote,
          scheduledDate: selectedTastingSlot.scheduledDate,
          startTime: selectedTastingSlot.startTime,
        })
      : await onRequestFoodTasting!({
          bookingId: tastingServiceId,
          note: tastingNote,
          scheduledDate: selectedTastingSlot.scheduledDate,
          startTime: selectedTastingSlot.startTime,
          useV15: tastingUsesV15,
        })
    setIsSavingTasting(false)
    if (!result.ok) {
      setTastingError(result.message ?? 'Unable to request the food tasting.')
      return
    }
    closeTastingModal()
  }

  const confirmFoodTastingAttendance = async (bookingId: string) => {
    if (!onConfirmFoodTastingAttendance || isSavingTasting) return
    setIsSavingTasting(true)
    const result = await onConfirmFoodTastingAttendance(bookingId)
    setIsSavingTasting(false)
    if (!result.ok) {
      Alert.alert('Unable to confirm attendance', result.message ?? 'Please try again.')
    }
  }

  const respondToTastingProposal = async (tastingId: string, acceptProposal: boolean) => {
    if (!onRespondToFoodTastingProposal || isSavingTasting) return
    setIsSavingTasting(true)
    setTastingError('')
    const result = await onRespondToFoodTastingProposal(tastingId, acceptProposal)
    setIsSavingTasting(false)
    if (!result.ok) setTastingError(result.message ?? 'Unable to update the food tasting proposal.')
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarContent}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Event Booking</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.providerHeader}>
          {provider.image ? (
            <Image
              accessibilityLabel={provider.imageLabel}
              resizeMode="cover"
              source={{ uri: provider.image }}
              style={styles.providerImage}
            />
          ) : (
            <View style={[styles.providerImage, styles.eventImagePlaceholder]}>
              <Text style={styles.eventImageText}>{provider.name.charAt(0)}</Text>
            </View>
          )}
          <View style={styles.providerCopy}>
            <Text numberOfLines={2} style={styles.providerName}>
              {provider.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {bookedServices.length
                  ? `${bookedServices.length} SERVICES`
                  : provider.category.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineLine} />
          <TimelineStep
            complete
            date={value.requestedDate}
            label="Requested"
          />
          {isCancelled ? (
            <TimelineStep
              complete
              date={booking?.updatedAt ? new Date(booking.updatedAt).toLocaleDateString('en-PH') : undefined}
              label="Cancelled"
            />
          ) : (
            <>
              <TimelineStep
                complete={isConfirmed}
                date={isConfirmed ? value.confirmedDate : undefined}
                label="Confirmed"
              />
              <TimelineStep complete={isCompleted} label="Completed" />
            </>
          )}
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Event Details</Text>
          <DetailRow label="EVENT TYPE" value={value.service} />
          <DetailRow
            label="DATE & TIME"
            value={`${value.date}\n${value.time}`}
          />
          {booking?.guestCount ? (
            <DetailRow label="GUESTS" value={`${booking.guestCount} guests`} />
          ) : null}
          {booking?.isChurchWedding ? (
            <DetailRow label="WEDDING FORMAT" value="Church wedding" />
          ) : null}
          {booking?.venue || booking?.location ? (
            <DetailRow
              label="VENUE"
              value={[booking.venue, booking.location].filter(Boolean).join(', ')}
            />
          ) : null}
          <DetailRow label="SERVICES" value={value.coverage} />
          <DetailRow label="PRICE" last price value={value.price} />
        </View>

        {booking?.isChurchWedding ? (
          <View style={styles.churchArrangementCard}>
            <View style={styles.churchArrangementHeading}>
              <View>
                <Text style={styles.cardTitle}>{churchProposalPending ? 'Church Proposal' : 'Church Arrangement'}</Text>
                <Text style={styles.churchArrangementStatus}>
                  {formatChurchArrangementStatus(booking.churchArrangement?.arrangementStatus)}
                </Text>
              </View>
              <MaterialIcons color={palette.burgundy} name="church" size={25} />
            </View>
            {booking.churchArrangement?.preferredChurch ? (
              <DetailRow label="PREFERRED CHURCH" value={booking.churchArrangement.preferredChurch} />
            ) : null}
            {booking.churchArrangement?.churchName ? (
              <DetailRow label="CHURCH" value={booking.churchArrangement.churchName} />
            ) : null}
            {booking.churchArrangement?.churchAddress ? (
              <DetailRow label="LOCATION" value={booking.churchArrangement.churchAddress} />
            ) : null}
            {booking.churchArrangement?.churchLatitude != null && booking.churchArrangement.churchLongitude != null ? (
              <View style={styles.churchMapPreview}>
                <Text style={styles.churchMapPreviewLabel}>CHURCH MAP PIN</Text>
                <ChurchLocationMap coordinates={{
                  latitude: booking.churchArrangement.churchLatitude,
                  longitude: booking.churchArrangement.churchLongitude,
                }} />
              </View>
            ) : booking.churchArrangement?.churchAddress ? (
              <View style={styles.churchMapFallback}>
                <MaterialIcons color={palette.burgundy} name="location-off" size={18} />
                <Text style={styles.churchMapFallbackText}>No map pin was saved. Use the written church address above.</Text>
              </View>
            ) : null}
            {booking.churchArrangement?.churchContact ? (
              <DetailRow label="CONTACT" value={booking.churchArrangement.churchContact} />
            ) : null}
            {booking.churchArrangement?.ceremonyDate || booking.churchArrangement?.ceremonyTime ? (
              <DetailRow
                label="CEREMONY"
                value={[
                  booking.churchArrangement.ceremonyDate ? formatChurchDate(booking.churchArrangement.ceremonyDate) : undefined,
                  booking.churchArrangement.ceremonyTime ? formatChurchTime(booking.churchArrangement.ceremonyTime) : undefined,
                ].filter(Boolean).join(' · ')}
              />
            ) : null}
            {booking.churchArrangement?.notes ? (
              <DetailRow last label="COORDINATOR NOTES" value={booking.churchArrangement.notes} />
            ) : null}
            {booking.churchArrangement?.clientResponseStatus === 'approved' ? (
              <View style={styles.churchResponseNotice}>
                <MaterialIcons color="#145133" name="check-circle" size={18} />
                <Text style={styles.churchResponseNoticeText}>You accepted this proposed church arrangement.</Text>
              </View>
            ) : null}
            {booking.churchArrangement?.clientResponseStatus === 'declined' ? (
              <View style={[styles.churchResponseNotice, styles.churchDeclinedNotice]}>
                <MaterialIcons color={palette.error} name="cancel" size={18} />
                <View style={styles.churchResponseNoticeCopy}>
                  <Text style={styles.churchDeclinedNoticeTitle}>You declined this proposal.</Text>
                  {booking.churchArrangement.clientResponseReason ? (
                    <Text style={styles.churchResponseNoticeText}>Reason: {booking.churchArrangement.clientResponseReason}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {coordinatorConfirmedChurch ? (
              <View style={styles.coordinatorConfirmationNotice}>
                <MaterialIcons color={palette.burgundy} name="verified" size={18} />
                <View style={styles.churchResponseNoticeCopy}>
                  <Text style={styles.coordinatorConfirmationTitle}>Coordinator-confirmed arrangement</Text>
                  <Text style={styles.churchResponseNoticeText}>
                    Your coordinator documented this arrangement
                    {booking.churchArrangement?.confirmationMethod === 'external_discussion'
                      ? ' after discussing it with you outside Multivent.'
                      : booking.churchArrangement?.confirmationMethod === 'multivent'
                        ? ' through Multivent.'
                        : '.'}
                  </Text>
                  {booking.churchArrangement?.confirmationNotes ? (
                    <Text style={styles.churchResponseNoticeText}>{booking.churchArrangement.confirmationNotes}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {booking.churchArrangement?.updatedAt ? (
              <Text style={styles.churchArrangementUpdatedAt}>
                Last updated {new Date(booking.churchArrangement.updatedAt).toLocaleString('en-PH')}
              </Text>
            ) : null}
            {!booking.churchArrangement?.churchName && !booking.churchArrangement?.notes ? (
              <Text style={styles.churchArrangementEmpty}>Your coordinator has not recorded church details yet.</Text>
            ) : null}
            <Text style={styles.churchArrangementDisclaimer}>
              Client approval or coordinator confirmation accepts the proposed arrangement only. It does not independently verify a church reservation or payment.
            </Text>
            {churchProposalPending && onRespondChurchProposal ? (
              <View style={styles.churchProposalActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setChurchResponseError('')
                    setChurchResponseMode('decline')
                  }}
                  style={({ pressed }) => [styles.churchDeclineButton, pressed && styles.serviceMessageButtonPressed]}
                >
                  <Text style={styles.churchDeclineButtonText}>Decline</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setChurchResponseError('')
                    setChurchResponseMode('approve')
                  }}
                  style={({ pressed }) => [styles.churchApproveButton, pressed && styles.serviceMessageButtonPressed]}
                >
                  <MaterialIcons color={palette.surface} name="check" size={18} />
                  <Text style={styles.churchApproveButtonText}>Approve</Text>
                </Pressable>
              </View>
            ) : null}
            {canMessageCoordinator ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onMessageCoordinatorForEvent?.(booking.eventId!)}
                style={({ pressed }) => [styles.messageCoordinatorButton, pressed && styles.serviceMessageButtonPressed]}
              >
                <MaterialIcons color={palette.surface} name="chat-bubble-outline" size={18} />
                <Text style={styles.messageCoordinatorButtonText}>Message Coordinator</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {eventPaymentSummary ? (
          <View style={styles.eventPaymentCard}>
            <View style={styles.eventPaymentHeading}>
              <View>
                <Text style={styles.cardTitle}>Event Payment Summary</Text>
                <Text style={styles.eventPaymentReference}>
                  Event reference: {booking?.eventId ? `#${booking.eventId.slice(0, 8).toUpperCase()}` : booking?.name}
                </Text>
              </View>
              <MaterialIcons color={palette.burgundy} name="receipt-long" size={25} />
            </View>
            <View style={styles.eventPaymentTotalRow}>
              <Text style={styles.eventPaymentTotalLabel}>TOTAL EVENT SERVICE CHARGES</Text>
              <Text style={styles.eventPaymentTotalValue}>{formatPeso(eventPaymentSummary.serviceAmount)}</Text>
            </View>
            <View style={styles.eventPaymentRow}>
              <Text style={styles.eventPaymentLabel}>RECORDED SERVICE PAYMENTS</Text>
              <Text style={styles.eventPaymentValue}>{formatPeso(eventPaymentSummary.recordedPaymentAmount)}</Text>
            </View>
            <View style={styles.eventPaymentRow}>
              <Text style={styles.eventPaymentLabel}>TOTAL REMAINING BALANCE</Text>
              <Text style={styles.eventPaymentRemaining}>{formatPeso(eventPaymentSummary.remainingBalance)}</Text>
            </View>
            {eventPaymentSummary.isCleared ? (
              <View style={styles.clearedBalanceNotice}>
                <MaterialIcons color="#145133" name="check-circle" size={19} />
                <View style={styles.eventPaymentNoticeCopy}>
                  <Text style={styles.clearedBalanceTitle}>All Provider Balances Cleared</Text>
                  <Text style={styles.clearedBalanceText}>All active provider service balances have been recorded as paid.</Text>
                </View>
              </View>
            ) : null}
            <Text style={styles.eventPaymentCaption}>Provider balance breakdown</Text>
            {eventPaymentSummary.providerBalances.map((provider) => {
              const initialPaymentDate = formatPaymentDate(provider.initialPaymentRecordedAt)
              const statusLabel = provider.status === 'cleared'
                ? 'Cleared'
                : provider.status === 'partially_confirmed'
                  ? 'Partially confirmed'
                  : 'Awaiting payment'
              return (
                <View key={provider.providerName} style={styles.providerBalanceRow}>
                  <View style={styles.providerBalanceHeading}>
                    <Text numberOfLines={1} style={styles.providerBalanceName}>{provider.providerName}</Text>
                    <Text style={[
                      styles.providerBalanceStatus,
                      provider.status === 'cleared' && styles.providerBalanceStatusCleared,
                    ]}>{statusLabel}</Text>
                  </View>
                  <View style={styles.providerBalanceAmounts}>
                    <Text style={styles.providerBalanceMeta}>Agreed: {formatPeso(provider.serviceAmount)}</Text>
                    <Text style={styles.providerBalanceMeta}>Initial: {formatPeso(provider.initialProviderShare)}</Text>
                    <Text style={styles.providerBalanceMeta}>External confirmed: {formatPeso(provider.confirmedExternalPaymentAmount)}</Text>
                  </View>
                  {initialPaymentDate ? (
                    <Text style={styles.providerBalanceHistory}>Initial service payment recorded {initialPaymentDate}</Text>
                  ) : null}
                  {provider.confirmedExternalPaymentAmount > 0 ? (
                    <Text style={styles.providerBalanceHistory}>Provider-confirmed external payment recorded</Text>
                  ) : null}
                  <View style={styles.providerBalanceOutstandingRow}>
                    <Text style={styles.providerBalanceOutstandingLabel}>REMAINING</Text>
                    <Text style={styles.providerBalanceOutstandingValue}>{formatPeso(provider.remainingBalance)}</Text>
                  </View>
                </View>
              )
            })}
            <Text style={styles.eventPaymentDisclaimer}>
              Totals cover service charges only. MULTIVENT platform fees, held funds, and provider payouts follow their existing separate workflows and are not counted again here. External payments are provider-confirmed, not verified PayMongo transactions.
            </Text>
          </View>
        ) : null}

        {bookedServices.length > 0 || hasCoordinatorTracker ? (
          <View style={styles.servicesSection}>
            <Text style={styles.cardTitle}>Booked Services</Text>
            {bookedServices.map((service) => {
              const canMessageProvider = service.status === 'confirmed' || service.status === 'completed'

              return (
                <View key={service.bookingId} style={styles.serviceCard}>
                {service.image ? (
                  <Image
                    accessibilityLabel={service.serviceName}
                    resizeMode="cover"
                    source={{ uri: service.image }}
                    style={styles.serviceImage}
                  />
                ) : (
                  <View style={[styles.serviceImage, styles.eventImagePlaceholder]}>
                    <Text style={styles.eventImageText}>{service.serviceName.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.serviceCopy}>
                  <View style={styles.serviceHeading}>
                    <Text numberOfLines={2} style={styles.serviceName}>
                      {service.serviceName}
                    </Text>
                    <View
                      style={[
                        styles.serviceStatus,
                        service.status === 'confirmed' && styles.serviceStatusConfirmed,
                        (service.status === 'declined' || service.status === 'cancelled') &&
                          styles.serviceStatusDeclined,
                      ]}
                    >
                      <Text style={styles.serviceStatusText}>
                        {service.status === 'requested'
                          ? 'REQUESTED'
                          : service.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.serviceProviderRow}>
                    <Text style={styles.serviceProvider}>{service.providerName}</Text>
                    {canMessageProvider ? (
                      <Pressable
                        accessibilityLabel={`Message ${service.providerName}`}
                        accessibilityRole="button"
                        onPress={() => onMessageProviderForBooking?.(service.bookingId)}
                        style={({ pressed }) => [
                          styles.serviceMessageButton,
                          pressed && styles.serviceMessageButtonPressed,
                        ]}
                      >
                        <MaterialIcons color={palette.burgundy} name="chat-bubble-outline" size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.serviceMeta}>
                    {service.category} · {formatPeso(service.amount)}
                  </Text>
                  {service.venueBooking ? (
                    <VenueBookingSummary audience="client" configuration={service.venueBooking} />
                  ) : null}
                  {service.clientNotes ? (
                    <View style={styles.legacyBookingNote}>
                      <Text style={styles.legacyBookingNoteLabel}>SAVED BOOKING NOTE</Text>
                      <Text style={styles.legacyBookingNoteText}>{service.clientNotes}</Text>
                    </View>
                  ) : null}
                  {service.serviceAmount !== undefined
                    || service.initialProviderShare !== undefined
                    || service.remainingServiceBalance !== undefined ? (
                      <View style={styles.servicePaymentSummary}>
                        <View style={styles.servicePaymentRow}>
                          <Text style={styles.servicePaymentLabel}>TOTAL SERVICE AMOUNT</Text>
                          <Text style={styles.servicePaymentValue}>
                            {formatPeso(service.serviceAmount ?? service.amount)}
                          </Text>
                        </View>
                        <View style={styles.servicePaymentRow}>
                          <Text style={styles.servicePaymentLabel}>INITIAL PROVIDER ALLOCATION</Text>
                          <Text style={styles.servicePaymentValue}>
                            {formatPeso(service.initialProviderShare ?? 0)}
                          </Text>
                        </View>
                        <View style={styles.servicePaymentRow}>
                          <Text style={styles.servicePaymentLabel}>EXTERNAL PAYMENT CONFIRMED</Text>
                          <Text style={styles.servicePaymentValue}>
                            {formatPeso(service.confirmedExternalPaymentAmount ?? 0)}
                          </Text>
                        </View>
                        <View style={styles.servicePaymentRow}>
                          <Text style={styles.servicePaymentLabel}>REMAINING BALANCE</Text>
                          <Text style={styles.servicePaymentRemaining}>
                            {formatPeso(service.remainingServiceBalance ?? 0)}
                          </Text>
                        </View>
                        <Text style={styles.servicePaymentStatus}>
                          Status: {completionPaymentLabel(service)}
                        </Text>
                        <Text style={styles.servicePaymentNotice}>
                          External payments are provider-confirmed and are not verified PayMongo transactions.
                        </Text>
                      </View>
                    ) : null}
                  {service.status === 'declined' && service.replacementAvailable ? (
                    <View style={styles.tastingCard}>
                      <View style={styles.tastingHeading}>
                        <View style={styles.tastingIcon}>
                          <MaterialIcons color={palette.error} name="warning-amber" size={19} />
                        </View>
                        <View style={styles.tastingCopy}>
                          <Text style={styles.tastingTitle}>Service Booking Declined</Text>
                          <Text style={styles.tastingText}>
                            This provider could not accept your request. Find a similar {service.category} service without changing the held payment for this booking.
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tastingActions}>
                        <Pressable
                          accessibilityLabel={`Find an alternative ${service.category} service`}
                          disabled={!onFindAlternativeServices}
                          onPress={() => onFindAlternativeServices?.(service)}
                          style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.tastingPrimaryText}>Find Alternative Services</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {(service.foodTasting || service.foodTastingWorkflow || (
                    service.foodTastingEnabled
                    && service.status === 'confirmed'
                    && !dismissedTastingPrompts.has(service.bookingId)
                  )) ? (
                    <View style={styles.tastingCard}>
                      <View style={styles.tastingHeading}>
                        <View style={styles.tastingIcon}>
                          <MaterialIcons color={palette.burgundy} name="restaurant" size={19} />
                        </View>
                        <View style={styles.tastingCopy}>
                          <Text style={styles.tastingTitle}>
                            {service.foodTastingWorkflow?.status === 'cancelled'
                              && service.foodTastingWorkflow.fallbackEnabledAt
                              ? 'Food Tasting Unavailable'
                              : service.foodTasting
                              ? service.foodTastingWorkflow?.attendanceStatus === 'confirmation_required'
                                ? 'Food Tasting Tomorrow'
                                : 'Food Tasting'
                              : service.foodTastingWorkflow?.status === 'awaiting_provider_acceptance'
                                ? 'Food Tasting Request'
                                : service.foodTastingWorkflow?.status === 'scheduling_required'
                                  ? 'Food Tasting Schedule Required'
                                  : 'Catering Booking Confirmed'}
                          </Text>
                          <Text style={styles.tastingText}>
                            {service.foodTastingWorkflow?.status === 'cancelled'
                              && service.foodTastingWorkflow.fallbackEnabledAt
                              ? 'The food tasting process has ended. You can continue by choosing your final menu directly.'
                              : service.foodTasting
                              ? `${formatTastingStatus(service.foodTasting.status)} - ${formatTastingDate(service.foodTasting.scheduledDate)}, ${formatTastingTime(service.foodTasting.startTime)}${service.foodTasting.endTime ? ` to ${formatTastingTime(service.foodTasting.endTime)}` : ''}`
                              : service.foodTastingWorkflow?.status === 'awaiting_provider_acceptance'
                                ? 'Your preliminary tasting menu was sent to the caterer. Waiting for their acceptance.'
                                : service.foodTastingWorkflow?.status === 'scheduling_required'
                                  ? `Your request was accepted. Choose a schedule by ${formatTastingDate(service.foodTastingWorkflow.schedulingWindowEndDate ?? '')}.`
                              : 'Your catering provider has accepted your booking. Food tasting is optional.'}
                          </Text>
                        </View>
                      </View>
                      {service.foodTasting ? (
                        <>
                          <Text style={styles.tastingLocation}>
                            {service.foodTasting.location} - {service.foodTasting.timezone}
                          </Text>
                          {service.foodTasting.providerNote ? (
                            <Text style={styles.tastingNote}>Provider note: {service.foodTasting.providerNote}</Text>
                          ) : null}
                          {service.foodTastingWorkflow?.attendanceStatus === 'confirmation_required' ? (
                            <View style={styles.tastingActions}>
                              <Text style={styles.tastingText}>
                                Please confirm whether you can attend this scheduled food tasting.
                              </Text>
                              <Pressable
                                accessibilityLabel="Confirm food tasting attendance"
                                disabled={isSavingTasting || !onConfirmFoodTastingAttendance}
                                onPress={() => void confirmFoodTastingAttendance(service.bookingId)}
                                style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                              >
                                <Text style={styles.tastingPrimaryText}>Yes, I&apos;ll Attend</Text>
                              </Pressable>
                              {service.foodTastingWorkflow.rescheduleAttemptCount === 0 ? (
                                <Pressable
                                  accessibilityLabel="Request food tasting reschedule"
                                  disabled={isLoadingTastingSlots || !onLoadFoodTastingRescheduleSlots}
                                  onPress={() => void openTastingSchedule(service, 'reschedule')}
                                  style={({ pressed }) => [styles.tastingSecondaryButton, pressed && styles.pressed]}
                                >
                                  <Text style={styles.tastingSecondaryText}>
                                    {isLoadingTastingSlots && tastingServiceId === service.bookingId
                                      ? 'Loading...'
                                      : 'Request Reschedule'}
                                  </Text>
                                </Pressable>
                              ) : (
                                <Text style={styles.tastingText}>Reschedule Attempts Used: 1 of 1</Text>
                              )}
                            </View>
                          ) : service.foodTastingWorkflow?.attendanceStatus === 'confirmed' ? (
                            <Text style={styles.tastingText}>Attendance confirmed. Your caterer was notified.</Text>
                          ) : null}
                          {service.foodTastingWorkflow?.status === 'cancelled'
                            && service.foodTastingWorkflow.fallbackEnabledAt ? (
                              <View style={styles.tastingActions}>
                                <Pressable
                                  accessibilityLabel={`Choose final menu with ${service.providerName}`}
                                  disabled={!onChooseFinalCateringMenu}
                                  onPress={() => void onChooseFinalCateringMenu?.(service)}
                                  style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                                >
                                  <Text style={styles.tastingPrimaryText}>Choose Final Menu Instead</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          {service.foodTasting.status === 'reschedule_proposed' && !service.foodTastingWorkflow ? (
                            <View style={styles.tastingActions}>
                              <Pressable
                                accessibilityLabel="Decline proposed food tasting schedule"
                                disabled={isSavingTasting || !onRespondToFoodTastingProposal}
                                onPress={() => void respondToTastingProposal(service.foodTasting!.id, false)}
                                style={({ pressed }) => [styles.tastingSecondaryButton, pressed && styles.pressed]}
                              >
                                <Text style={styles.tastingSecondaryText}>Decline</Text>
                              </Pressable>
                              <Pressable
                                accessibilityLabel="Accept proposed food tasting schedule"
                                disabled={isSavingTasting || !onRespondToFoodTastingProposal}
                                onPress={() => void respondToTastingProposal(service.foodTasting!.id, true)}
                                style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                              >
                                <Text style={styles.tastingPrimaryText}>Accept schedule</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </>
                      ) : service.foodTastingWorkflow ? (
                        service.foodTastingWorkflow.status === 'scheduling_required' ? (
                          <View style={styles.tastingActions}>
                            <Pressable
                              accessibilityLabel={`Choose food tasting schedule with ${service.providerName}`}
                              disabled={!onLoadFoodTastingSlots || isLoadingTastingSlots}
                              onPress={() => void openTastingSchedule(service)}
                              style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                            >
                              <Text style={styles.tastingPrimaryText}>
                                {isLoadingTastingSlots && tastingServiceId === service.bookingId ? 'Loading...' : 'Choose Schedule'}
                              </Text>
                            </Pressable>
                          </View>
                        ) : service.foodTastingWorkflow.status === 'cancelled'
                          && service.foodTastingWorkflow.fallbackEnabledAt ? (
                            <View style={styles.tastingActions}>
                              <Pressable
                                accessibilityLabel={`Choose final menu with ${service.providerName}`}
                                disabled={!onChooseFinalCateringMenu}
                                onPress={() => void onChooseFinalCateringMenu?.(service)}
                                style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                              >
                                <Text style={styles.tastingPrimaryText}>Choose Final Menu Instead</Text>
                              </Pressable>
                            </View>
                        ) : null
                      ) : (
                        <View style={styles.tastingActions}>
                          <Pressable
                            accessibilityLabel={`Schedule food tasting with ${service.providerName}`}
                            disabled={!onLoadFoodTastingSlots || isLoadingTastingSlots}
                            onPress={() => void openTastingSchedule(service)}
                            style={({ pressed }) => [styles.tastingPrimaryButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.tastingPrimaryText}>
                              {isLoadingTastingSlots && tastingServiceId === service.bookingId ? 'Loading...' : 'Schedule Food Tasting'}
                            </Text>
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Decide about food tasting later"
                            onPress={() => setDismissedTastingPrompts((current) => new Set([...current, service.bookingId]))}
                            style={({ pressed }) => [styles.tastingSecondaryButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.tastingSecondaryText}>Not now</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
                </View>
              )
            })}
            {hasCoordinatorTracker ? (
              <View style={styles.serviceCard}>
                {booking?.coordinatorAvatarUrl ? (
                  <Image
                    accessibilityLabel={`${booking.coordinatorName ?? 'Event Coordinator'} profile photo`}
                    resizeMode="cover"
                    source={{ uri: booking.coordinatorAvatarUrl }}
                    style={styles.serviceImage}
                  />
                ) : (
                  <View style={[styles.serviceImage, styles.coordinatorServiceImage]}>
                    <MaterialIcons color={palette.burgundy} name="event-available" size={27} />
                  </View>
                )}
                <View style={styles.serviceCopy}>
                  <View style={styles.serviceHeading}>
                    <Text numberOfLines={2} style={styles.serviceName}>Event Coordination</Text>
                    <View
                      style={[
                        styles.serviceStatus,
                        coordinatorTrackerStatus.kind === 'confirmed' && styles.serviceStatusConfirmed,
                        coordinatorTrackerStatus.kind === 'declined' && styles.serviceStatusDeclined,
                      ]}
                    >
                      <Text style={styles.serviceStatusText}>{coordinatorTrackerStatus.label}</Text>
                    </View>
                  </View>
                  <View style={styles.serviceProviderRow}>
                    <Text style={styles.serviceProvider}>
                      {booking?.coordinatorName ?? 'Event coordinator'}
                    </Text>
                    {canMessageEventCoordinator ? (
                      <Pressable
                        accessibilityLabel={`Message ${booking?.coordinatorName ?? 'event coordinator'}`}
                        accessibilityRole="button"
                        onPress={() => {
                          const eventId = booking?.eventId
                          if (eventId) onMessageCoordinatorForEvent?.(eventId)
                        }}
                        style={({ pressed }) => [
                          styles.serviceMessageButton,
                          pressed && styles.serviceMessageButtonPressed,
                        ]}
                      >
                        <MaterialIcons color={palette.burgundy} name="chat-bubble-outline" size={18} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.serviceMeta}>
                    {booking?.coordinatorFeeAmount && booking.coordinatorFeeAmount > 0
                      ? `Event coordination · ${formatPeso(booking.coordinatorFeeAmount)}`
                      : 'Event coordination'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.confirmationCard}>
          <View style={styles.confirmationHeading}>
            <View>
              <Text style={styles.cardTitle}>Provider Confirmations & Coordinator</Text>
              <Text style={styles.confirmationSubtitle}>
                Payment opens only when every required booking is accepted.
              </Text>
              <Text style={styles.confirmationSubtitle}>
                This includes your selected event coordinator.
              </Text>
            </View>
            <MaterialIcons
              color={acceptedProviderCount === providerCount && coordinatorAccepted ? '#145133' : palette.burgundy}
              name={acceptedProviderCount === providerCount && coordinatorAccepted ? 'verified' : 'hourglass-empty'}
              size={24}
            />
          </View>
          <View style={styles.confirmationRow}>
            <Text style={styles.confirmationLabel}>Service providers</Text>
            <Text style={styles.confirmationValue}>{acceptedProviderCount} of {providerCount} accepted</Text>
          </View>
          {coordinatorRequired ? (
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Event coordinator</Text>
              <Text style={styles.confirmationValue}>{coordinatorAccepted ? 'Accepted' : 'Awaiting confirmation'}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.paymentCard}>
          <View style={styles.paymentCardHeading}>
            <Text style={styles.paymentLabel}>Payment Status</Text>
            <View style={styles.paymentBadge}>
              <Text style={styles.paymentBadgeText}>{paymentStatusText}</Text>
            </View>
          </View>
          {paymentQuote ? (
            <View style={styles.paymentBreakdown}>
              <View style={styles.paymentBreakdownRow}>
                <Text style={styles.paymentBreakdownLabel}>Total event cost</Text>
                <Text style={styles.paymentBreakdownValue}>{formatPeso(paymentQuote.breakdown.clientTotal)}</Text>
              </View>
              <View style={styles.paymentBreakdownRow}>
                <Text style={styles.paymentBreakdownLabel}>Required downpayment (35%)</Text>
                <Text style={styles.paymentBreakdownValue}>{formatPeso(paymentQuote.breakdown.initialPayment)}</Text>
              </View>
              <Text style={styles.paymentBreakdownHint}>
                The downpayment contains the 30% provider allocation and 5% MULTIVENT service fee.
              </Text>
            </View>
          ) : null}
          {isLoadingPaymentQuote ? (
            <Text style={styles.paymentNotice}>Checking current confirmations and price snapshots…</Text>
          ) : paymentReady ? (
            <>
              <View style={styles.paymentReadyNotice}>
                <MaterialIcons color="#145133" name="check-circle" size={18} />
                <Text style={styles.paymentReadyText}>All required bookings confirmed — payment is ready.</Text>
              </View>
              <Pressable
                accessibilityLabel="Pay now to reserve this booking"
                accessibilityRole="button"
                disabled={isStartingPayment}
                onPress={onStartPayment}
                style={({ pressed }) => [
                  styles.paymentActionButton,
                  isStartingPayment && styles.paymentActionButtonDisabled,
                  pressed && !isStartingPayment && styles.paymentActionButtonPressed,
                ]}
              >
                <Text style={styles.paymentActionButtonText}>
                  {isStartingPayment ? 'Loading payment…' : paymentFailed ? 'Try Payment Again' : 'Pay Now to Reserve'}
                </Text>
              </Pressable>
            </>
          ) : paymentInitiated ? (
            <Text style={styles.paymentNotice}>
              Payment was initiated and is awaiting completion or verification. Your booking is not financially reserved yet.
            </Text>
          ) : paymentRecorded ? (
            <Text style={styles.paymentNotice}>
              Payment is recorded. Provider funds follow the existing verified-payment hold and release policy.
            </Text>
          ) : (
            <Text style={styles.paymentNotice}>{paymentBlockedMessage}</Text>
          )}
        </View>

        <View style={styles.actions}>
          {isCompleted && booking?.hasFeedback ? (
            <View style={styles.feedbackSubmittedCard}>
              <View style={styles.feedbackSubmittedIcon}>
                <Text style={styles.feedbackSubmittedCheck}>{'\u2713'}</Text>
              </View>
              <View style={styles.feedbackSubmittedCopy}>
                <Text style={styles.feedbackSubmittedTitle}>Event feedback submitted</Text>
                <Text style={styles.feedbackSubmittedText}>
                  Your overall experience was saved for analysis.
                </Text>
              </View>
            </View>
          ) : null}
          {onSubmitReview && (
            <Pressable
              accessibilityRole="button"
              onPress={onSubmitReview}
              style={({ pressed }) => [
                styles.reviewButton,
                pressed && styles.reviewButtonPressed,
              ]}
            >
              <Text style={styles.reviewButtonText}>Share Event Experience</Text>
            </Pressable>
          )}
          {!isCompleted && !isCancelled ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setChangeError('')
                setChangeMode('options')
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>CANCEL OR RESCHEDULE</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeChurchResponse}
        transparent
        visible={Boolean(churchResponseMode)}
      >
        <View style={styles.changeBackdrop}>
          <View accessibilityViewIsModal style={styles.churchResponseModal}>
            <View style={styles.changeHeader}>
              <View style={styles.changeHeaderCopy}>
                <Text style={styles.changeTitle}>
                  {churchResponseMode === 'decline' ? 'Decline Church Proposal' : 'Approve Church Proposal'}
                </Text>
                <Text style={styles.changeSubtitle}>
                  {churchResponseMode === 'decline'
                    ? 'Please tell your coordinator why you are declining this church.'
                    : 'Approve this coordinator-proposed church arrangement? This does not verify that the church accepted a reservation.'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close church proposal response"
                accessibilityRole="button"
                disabled={isSavingChurchResponse}
                onPress={closeChurchResponse}
                style={styles.changeClose}
              >
                <MaterialIcons color={palette.muted} name="close" size={23} />
              </Pressable>
            </View>

            {churchResponseMode === 'decline' ? (
              <View style={styles.changeField}>
                <Text style={styles.changeLabel}>REASON</Text>
                <TextInput
                  accessibilityLabel="Reason for declining church proposal"
                  editable={!isSavingChurchResponse}
                  maxLength={1000}
                  multiline
                  onChangeText={setChurchDeclineReason}
                  placeholder="Explain what should be changed in the next proposal"
                  placeholderTextColor="#9A9291"
                  style={[styles.changeInput, styles.reasonInput]}
                  textAlignVertical="top"
                  value={churchDeclineReason}
                />
              </View>
            ) : null}

            {churchResponseError ? <Text style={styles.changeError}>{churchResponseError}</Text> : null}
            <View style={styles.changeActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingChurchResponse}
                onPress={closeChurchResponse}
                style={({ pressed }) => [styles.changeBackButton, pressed && styles.pressed]}
              >
                <Text style={styles.changeBackText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingChurchResponse}
                onPress={() => void submitChurchResponse()}
                style={({ pressed }) => [
                  styles.changeSubmit,
                  churchResponseMode === 'decline' && styles.cancelSubmit,
                  isSavingChurchResponse && styles.changeSubmitDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.changeSubmitText}>
                  {isSavingChurchResponse
                    ? 'Saving...'
                    : churchResponseMode === 'decline'
                      ? 'Submit Decline'
                      : 'Approve Proposal'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeTastingModal}
        transparent
        visible={Boolean(tastingServiceId)}
      >
        <View style={styles.tastingBackdrop}>
          <View accessibilityViewIsModal style={styles.tastingModal}>
            <View style={styles.changeHeader}>
              <View style={styles.changeHeaderCopy}>
                <Text style={styles.changeTitle}>
                  {tastingScheduleMode === 'reschedule' ? 'Reschedule Food Tasting' : 'Schedule Food Tasting'}
                </Text>
                <Text style={styles.changeSubtitle}>
                  {tastingScheduleMode === 'reschedule'
                    ? 'Choose one new available provider slot within your one-week extension. This is your only self-service reschedule.'
                    : tastingUsesV15
                    ? 'Choose an available provider slot within your seven-day scheduling window. Times are shown in the provider\'s configured timezone.'
                    : 'Choose an available provider slot before your event. Times are shown in the provider\'s configured timezone.'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close food tasting calendar"
                accessibilityRole="button"
                disabled={isSavingTasting}
                onPress={closeTastingModal}
                style={styles.changeClose}
              >
                <MaterialIcons color={palette.muted} name="close" size={23} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.tastingCalendarContent} showsVerticalScrollIndicator={false}>
              {isLoadingTastingSlots ? (
                <Text style={styles.tastingEmpty}>Loading provider availability...</Text>
              ) : Object.keys(tastingSlotsByDate).length ? (
                Object.entries(tastingSlotsByDate).map(([date, slots]) => (
                  <View key={date} style={styles.tastingDateGroup}>
                    <Text style={styles.tastingDateTitle}>{formatTastingDate(date)}</Text>
                    <View style={styles.tastingSlotRow}>
                      {slots.map((slot) => {
                        const selected = selectedTastingSlot?.scheduledDate === slot.scheduledDate
                          && selectedTastingSlot.startTime === slot.startTime
                        return (
                          <Pressable
                            accessibilityLabel={`Choose ${formatTastingDate(slot.scheduledDate)} at ${formatTastingTime(slot.startTime)}`}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            key={`${slot.scheduledDate}-${slot.startTime}`}
                            onPress={() => setSelectedTastingSlot(slot)}
                            style={({ pressed }) => [
                              styles.tastingSlot,
                              selected && styles.tastingSlotSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.tastingSlotText, selected && styles.tastingSlotTextSelected]}>
                              {formatTastingTime(slot.startTime)}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.tastingEmpty}>
                  {tastingError || 'No food tasting slots are currently available. The provider may need to configure slots or update availability.'}
                </Text>
              )}

              {selectedTastingSlot ? (
                <View style={styles.tastingSelectionSummary}>
                  <Text style={styles.tastingSelectionTitle}>
                    {tastingScheduleMode === 'reschedule' ? 'New selected appointment' : 'Selected appointment'}
                  </Text>
                  <Text style={styles.tastingSelectionText}>
                    {formatTastingDate(selectedTastingSlot.scheduledDate)} - {formatTastingTime(selectedTastingSlot.startTime)} to {formatTastingTime(selectedTastingSlot.endTime)}
                  </Text>
                  <Text style={styles.tastingSelectionText}>{selectedTastingSlot.location}</Text>
                  <Text style={styles.tastingSelectionText}>{selectedTastingSlot.timezone}</Text>
                  {tastingUsesV15 && tastingService?.foodTastingWorkflow ? (
                    <View style={styles.tastingMenuConfirmation}>
                      <Text style={styles.tastingSelectionTitle}>Preliminary tasting menu</Text>
                      {tastingService.foodTastingWorkflow.preliminaryMenu.map((course) => (
                        <Text key={course.name} style={styles.tastingSelectionText}>
                          {course.name}: {course.selectedItemNames.join(', ')}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.changeField}>
                <Text style={styles.changeLabel}>NOTE FOR PROVIDER (OPTIONAL)</Text>
                <TextInput
                  accessibilityLabel="Food tasting note for provider"
                  editable={!isSavingTasting}
                  maxLength={600}
                  multiline
                  onChangeText={setTastingNote}
                  placeholder="Menu preferences, allergies, or questions"
                  placeholderTextColor="#9A9291"
                  style={[styles.changeInput, styles.reasonInput]}
                  textAlignVertical="top"
                  value={tastingNote}
                />
              </View>
              {tastingError && Object.keys(tastingSlotsByDate).length > 0 ? (
                <Text style={styles.changeError}>{tastingError}</Text>
              ) : null}
            </ScrollView>

            <View style={styles.changeActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isSavingTasting}
                onPress={closeTastingModal}
                style={({ pressed }) => [styles.changeBackButton, pressed && styles.pressed]}
              >
                <Text style={styles.changeBackText}>Not now</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!canSubmitFoodTasting}
                onPress={() => void submitFoodTasting()}
                style={({ pressed }) => [
                  styles.changeSubmit,
                  !canSubmitFoodTasting && styles.changeSubmitDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.changeSubmitText}>
                  {isSavingTasting
                    ? 'Saving...'
                    : tastingScheduleMode === 'reschedule'
                      ? 'Confirm Reschedule'
                      : tastingUsesV15
                        ? 'Confirm Schedule'
                        : 'Request Food Tasting'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeChangeModal}
        transparent
        visible={Boolean(changeMode)}
      >
        <View style={styles.changeBackdrop}>
          <View accessibilityViewIsModal style={styles.changeCard}>
            <View style={styles.changeHeader}>
              <View style={styles.changeHeaderCopy}>
                <Text style={styles.changeTitle}>
                  {changeMode === 'cancel'
                    ? 'Cancel event booking?'
                    : changeMode === 'reschedule'
                      ? 'Choose a new schedule'
                      : 'Manage booking'}
                </Text>
                <Text style={styles.changeSubtitle}>
                  {changeMode === 'cancel'
                    ? 'All active provider reservations for this event will be released.'
                    : changeMode === 'reschedule'
                      ? 'Every booked provider must be available before the schedule can change.'
                      : 'This change applies to every provider booked for this event.'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close booking options"
                accessibilityRole="button"
                disabled={isSubmittingChange}
                onPress={closeChangeModal}
                style={styles.changeClose}
              >
                <MaterialIcons color={palette.muted} name="close" size={23} />
              </Pressable>
            </View>

            {changeMode === 'options' ? (
              <View style={styles.changeOptions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChangeMode('reschedule')}
                  style={({ pressed }) => [styles.changeOption, pressed && styles.pressed]}
                >
                  <View style={styles.changeOptionIcon}>
                    <MaterialIcons color={palette.burgundy} name="event-repeat" size={25} />
                  </View>
                  <View style={styles.changeOptionCopy}>
                    <Text style={styles.changeOptionTitle}>Reschedule Event</Text>
                    <Text style={styles.changeOptionText}>Check providers and request a new date and time.</Text>
                  </View>
                  <MaterialIcons color={palette.muted} name="chevron-right" size={24} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChangeMode('cancel')}
                  style={({ pressed }) => [styles.changeOption, pressed && styles.pressed]}
                >
                  <View style={[styles.changeOptionIcon, styles.cancelOptionIcon]}>
                    <MaterialIcons color={palette.error} name="event-busy" size={25} />
                  </View>
                  <View style={styles.changeOptionCopy}>
                    <Text style={[styles.changeOptionTitle, styles.cancelText]}>Cancel Booking</Text>
                    <Text style={styles.changeOptionText}>Release all providers from this event booking.</Text>
                  </View>
                  <MaterialIcons color={palette.muted} name="chevron-right" size={24} />
                </Pressable>
              </View>
            ) : null}

            {changeMode === 'reschedule' ? (
              <View style={styles.changeForm}>
                <View style={styles.changeField}>
                  <Text style={styles.changeLabel}>NEW EVENT DATE</Text>
                  <TextInput
                    accessibilityLabel="New event date"
                    autoCapitalize="none"
                    onChangeText={setNewDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9A9291"
                    style={styles.changeInput}
                    value={newDate}
                  />
                </View>
                <View style={styles.changeField}>
                  <Text style={styles.changeLabel}>NEW EVENT TIME</Text>
                  <TextInput
                    accessibilityLabel="New event time"
                    onChangeText={setNewTime}
                    placeholder="2:30 PM"
                    placeholderTextColor="#9A9291"
                    style={styles.changeInput}
                    value={newTime}
                  />
                </View>
                <View style={styles.changeNotice}>
                  <MaterialIcons color={palette.muted} name="info-outline" size={19} />
                  <Text style={styles.changeNoticeText}>
                    Confirmed services return to Requested until each provider accepts the new schedule.
                  </Text>
                </View>
              </View>
            ) : null}

            {changeMode === 'cancel' ? (
              <View style={styles.changeForm}>
                <View style={styles.changeField}>
                  <Text style={styles.changeLabel}>REASON (OPTIONAL)</Text>
                  <TextInput
                    accessibilityLabel="Cancellation reason"
                    maxLength={500}
                    multiline
                    onChangeText={setCancelReason}
                    placeholder="Tell the providers why the event booking is being cancelled"
                    placeholderTextColor="#9A9291"
                    style={[styles.changeInput, styles.reasonInput]}
                    textAlignVertical="top"
                    value={cancelReason}
                  />
                </View>
                <View style={[styles.changeNotice, styles.cancelNotice]}>
                  <MaterialIcons color={palette.error} name="warning-amber" size={19} />
                  <Text style={styles.changeNoticeText}>
                    More than 14 days before the event, the eligible refund is recorded for external bank or e-wallet disbursement. Cancellations at 14 days or sooner are non-refundable.
                  </Text>
                </View>
              </View>
            ) : null}

            {changeError ? <Text style={styles.changeError}>{changeError}</Text> : null}

            {changeMode === 'reschedule' || changeMode === 'cancel' ? (
              <View style={styles.changeActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmittingChange}
                  onPress={() => {
                    setChangeError('')
                    setChangeMode('options')
                  }}
                  style={({ pressed }) => [styles.changeBackButton, pressed && styles.pressed]}
                >
                  <Text style={styles.changeBackText}>Back</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmittingChange}
                  onPress={() => void (changeMode === 'cancel' ? submitCancellation() : submitReschedule())}
                  style={({ pressed }) => [
                    styles.changeSubmit,
                    changeMode === 'cancel' && styles.cancelSubmit,
                    isSubmittingChange && styles.changeSubmitDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.changeSubmitText}>
                    {isSubmittingChange
                      ? 'Saving…'
                      : changeMode === 'cancel'
                        ? 'Confirm Cancellation'
                        : 'Check & Reschedule'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

interface TimelineStepProps {
  complete?: boolean
  date?: string
  label: string
}

const TimelineStep: React.FC<TimelineStepProps> = ({ complete = false, date, label }) => (
  <View style={styles.timelineStep}>
    <View style={[styles.stepOuter, !complete && styles.stepOuterPending]}>
      {complete ? (
        <View style={styles.stepComplete}>
          <Text style={styles.stepCheck}>{'\u2713'}</Text>
        </View>
      ) : (
        <View style={styles.stepPending} />
      )}
    </View>
    <View style={styles.stepCopy}>
      <Text style={[styles.stepLabel, !complete && styles.stepLabelPending]}>{label}</Text>
      {date && <Text style={styles.stepDate}>{date}</Text>}
    </View>
  </View>
)

interface DetailRowProps {
  label: string
  last?: boolean
  price?: boolean
  value: string
}

const DetailRow: React.FC<DetailRowProps> = ({ label, last = false, price = false, value }) => (
  <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={[styles.detailValue, price && styles.priceValue]}>{value}</Text>
  </View>
)

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  card: '#EEEEEE',
  muted: '#5E5E5E',
  error: '#B3261E',
  surface: '#FFFFFF',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: palette.card,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 600,
    minHeight: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backIcon: { color: palette.muted, fontSize: 25, lineHeight: 28 },
  headerTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 96,
  },
  providerHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  providerImage: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: palette.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  eventImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  eventImageText: { color: palette.burgundy, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  providerCopy: { flex: 1, alignItems: 'flex-start' },
  providerName: { color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '600', marginBottom: 4 },
  categoryBadge: {
    borderRadius: 14,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  categoryBadgeText: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timeline: { position: 'relative', gap: 24, paddingLeft: 8, marginBottom: 32 },
  timelineLine: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: 22,
    width: 2,
    backgroundColor: palette.border,
  },
  timelineStep: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start' },
  stepOuter: {
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.background,
    borderRadius: 16,
    backgroundColor: palette.background,
  },
  stepOuterPending: { borderColor: palette.border },
  stepComplete: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
  },
  stepCheck: { color: palette.surface, fontSize: 15, lineHeight: 17, fontWeight: '800' },
  stepPending: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.border },
  stepCopy: { flex: 1, paddingTop: 2, marginLeft: 8 },
  stepLabel: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  stepLabelPending: { color: palette.muted },
  stepDate: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  detailsCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.card,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: { color: palette.text, fontSize: 20, lineHeight: 25, fontWeight: '600', marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 13,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  detailLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  detailValue: {
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'right',
  },
  priceValue: { color: palette.burgundy, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  churchArrangementCard: { borderWidth: 1, borderColor: '#D9C6CA', borderRadius: 12, backgroundColor: '#FEFAFB', padding: 20, marginBottom: 32 },
  churchArrangementHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  churchArrangementStatus: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: -11, marginBottom: 5 },
  churchArrangementEmpty: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  churchArrangementUpdatedAt: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  churchArrangementDisclaimer: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 14 },
  churchMapPreview: { gap: 8, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, marginTop: 4, marginBottom: 14 },
  churchMapPreviewLabel: { color: palette.muted, fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.8 },
  churchMapFallback: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, backgroundColor: '#F8F3F4', padding: 10, marginBottom: 12 },
  churchMapFallbackText: { minWidth: 0, flex: 1, color: palette.muted, fontSize: 10, lineHeight: 15 },
  churchResponseNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#CDE1D3', borderRadius: 10, backgroundColor: '#F2F8F4', padding: 11, marginTop: 10 },
  churchDeclinedNotice: { borderColor: '#EDCDD3', backgroundColor: '#FFF6F7' },
  churchDeclinedNoticeTitle: { color: palette.error, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  churchResponseNoticeCopy: { minWidth: 0, flex: 1 },
  churchResponseNoticeText: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  coordinatorConfirmationNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#D9C6CA', borderRadius: 10, backgroundColor: '#F9F1F3', padding: 11, marginTop: 10 },
  coordinatorConfirmationTitle: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  churchProposalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 14 },
  churchDeclineButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8C5C8', borderRadius: 10, paddingHorizontal: 18 },
  churchDeclineButtonText: { color: palette.burgundy, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchApproveButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, backgroundColor: palette.burgundy, paddingHorizontal: 18 },
  churchApproveButtonText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  churchResponseModal: { width: '100%', maxWidth: 520, borderRadius: 18, backgroundColor: palette.surface, padding: 20 },
  messageCoordinatorButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 9, backgroundColor: palette.burgundy, marginTop: 14, paddingHorizontal: 14 },
  messageCoordinatorButtonText: { color: palette.surface, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  eventPaymentCard: { borderWidth: 1, borderColor: '#D9C6CA', borderRadius: 12, backgroundColor: '#FFFCFC', padding: 20, marginBottom: 32 },
  eventPaymentHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eventPaymentReference: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: -11, marginBottom: 6 },
  eventPaymentTotalRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 10, paddingTop: 13 },
  eventPaymentTotalLabel: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.3 },
  eventPaymentTotalValue: { color: palette.burgundy, fontSize: 16, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  eventPaymentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  eventPaymentLabel: { flex: 1, color: palette.muted, fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.4 },
  eventPaymentValue: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'right' },
  eventPaymentRemaining: { color: palette.burgundy, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'right' },
  clearedBalanceNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 8, backgroundColor: '#E7F3EB', marginTop: 14, padding: 11 },
  eventPaymentNoticeCopy: { flex: 1, minWidth: 0 },
  clearedBalanceTitle: { color: '#145133', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  clearedBalanceText: { color: '#356744', fontSize: 11, lineHeight: 16, marginTop: 2 },
  eventPaymentCaption: { color: palette.muted, fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.5, marginTop: 18, marginBottom: 7 },
  providerBalanceRow: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 11 },
  providerBalanceHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  providerBalanceName: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  providerBalanceStatus: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  providerBalanceStatusCleared: { color: '#145133' },
  providerBalanceAmounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  providerBalanceMeta: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  providerBalanceHistory: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  providerBalanceOutstandingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  providerBalanceOutstandingLabel: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.5 },
  providerBalanceOutstandingValue: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  eventPaymentDisclaimer: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  servicesSection: { gap: 12, marginBottom: 32 },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  serviceImage: {
    width: 56,
    height: 56,
    flexShrink: 0,
    borderRadius: 10,
    backgroundColor: palette.card,
  },
  coordinatorServiceImage: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7ECEF' },
  serviceCopy: { flex: 1, minWidth: 0 },
  serviceHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  serviceName: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  serviceProviderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  serviceProvider: { flex: 1, color: palette.muted, fontSize: 13, lineHeight: 19 },
  serviceMessageButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9C6CA',
    borderRadius: 16,
    backgroundColor: '#F8F1F3',
  },
  serviceMessageButtonPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
  serviceMeta: { color: palette.burgundy, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 3 },
  servicePaymentSummary: { gap: 5, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 10, paddingTop: 9 },
  servicePaymentRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  servicePaymentLabel: { flex: 1, color: palette.muted, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.25 },
  servicePaymentValue: { color: palette.text, fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'right' },
  servicePaymentRemaining: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'right' },
  servicePaymentStatus: { color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 2 },
  servicePaymentNotice: { color: palette.muted, fontSize: 9, lineHeight: 13 },
  legacyBookingNote: { borderRadius: 9, backgroundColor: '#F7F1F2', marginTop: 12, padding: 11 },
  legacyBookingNoteLabel: { color: palette.burgundy, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, lineHeight: 14 },
  legacyBookingNoteText: { color: palette.text, fontSize: 11, lineHeight: 16, marginTop: 3 },
  serviceStatus: {
    borderRadius: 10,
    backgroundColor: '#FFF1D9',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  serviceStatusConfirmed: { backgroundColor: '#DDF4E4' },
  serviceStatusDeclined: { backgroundColor: '#F9DEDE' },
  serviceStatusText: {
    color: palette.text,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  confirmationCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#D9C6CA',
    borderRadius: 12,
    backgroundColor: '#FCF7F8',
    padding: 16,
    marginBottom: 12,
  },
  confirmationHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  confirmationSubtitle: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  confirmationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  confirmationLabel: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  confirmationValue: { color: palette.burgundy, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  paymentCard: {
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.background,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentCardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paymentLabel: { color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  paymentBadge: {
    borderRadius: 14,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  paymentBadgeText: {
    color: palette.surface,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  paymentBreakdown: { gap: 6, borderTopWidth: 1, borderTopColor: '#E6DADC', paddingTop: 11 },
  paymentBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  paymentBreakdownLabel: { color: palette.muted, flex: 1, fontSize: 11, lineHeight: 16 },
  paymentBreakdownValue: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  paymentBreakdownHint: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  paymentReadyNotice: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 9, backgroundColor: '#E7F3EB', padding: 10 },
  paymentReadyText: { color: '#145133', flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  paymentNotice: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  paymentActionButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.burgundy, paddingHorizontal: 16, paddingVertical: 11 },
  paymentActionButtonDisabled: { opacity: 0.62 },
  paymentActionButtonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  paymentActionButtonText: { color: palette.surface, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  feedbackSubmittedCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#B7D7C5',
    borderRadius: 12,
    backgroundColor: '#E7F3EB',
    padding: 15,
  },
  feedbackSubmittedIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#145133',
  },
  feedbackSubmittedCheck: { color: palette.surface, fontSize: 17, lineHeight: 20, fontWeight: '800' },
  feedbackSubmittedCopy: { minWidth: 0, flex: 1 },
  feedbackSubmittedTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  feedbackSubmittedText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  actions: { alignItems: 'center', gap: 16, paddingTop: 16 },
  reviewButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  reviewButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  reviewButtonText: { color: palette.surface, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  tastingCard: { gap: 9, borderRadius: 10, backgroundColor: '#F8F0F1', padding: 11, marginTop: 12 },
  tastingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  tastingIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F0DDE1' },
  tastingCopy: { minWidth: 0, flex: 1 },
  tastingTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  tastingText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 1 },
  tastingLocation: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  tastingNote: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  tastingActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tastingPrimaryButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: palette.burgundy, paddingHorizontal: 11 },
  tastingPrimaryText: { color: palette.surface, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  tastingSecondaryButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D9C6CA', borderRadius: 8, paddingHorizontal: 11 },
  tastingSecondaryText: { color: palette.burgundy, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  tastingBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31, 20, 23, 0.55)', padding: 16 },
  tastingModal: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 18, backgroundColor: palette.surface, padding: 20 },
  tastingCalendarContent: { gap: 13, paddingBottom: 4 },
  tastingEmpty: { color: palette.muted, fontSize: 13, lineHeight: 20, paddingVertical: 18, textAlign: 'center' },
  tastingDateGroup: { gap: 8, borderBottomWidth: 1, borderBottomColor: palette.card, paddingBottom: 12 },
  tastingDateTitle: { color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  tastingSlotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tastingSlot: { minHeight: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.background, paddingHorizontal: 11 },
  tastingSlotSelected: { borderColor: palette.burgundy, backgroundColor: '#F4E7EA' },
  tastingSlotText: { color: palette.text, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  tastingSlotTextSelected: { color: palette.burgundy, fontWeight: '700' },
  tastingSelectionSummary: { gap: 3, borderRadius: 10, backgroundColor: '#F4E7EA', padding: 12 },
  tastingSelectionTitle: { color: palette.burgundy, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  tastingSelectionText: { color: palette.text, fontSize: 11, lineHeight: 16 },
  tastingMenuConfirmation: { gap: 2, marginTop: 6 },
  changeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31, 20, 23, 0.55)',
    padding: 20,
  },
  changeCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 18,
    backgroundColor: palette.surface,
    padding: 20,
    shadowColor: '#210A10',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  changeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  changeHeaderCopy: { minWidth: 0, flex: 1 },
  changeTitle: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '700' },
  changeSubtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  changeClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: palette.card,
  },
  changeOptions: { gap: 10 },
  changeOption: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 13,
  },
  changeOptionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#F8EDF0',
  },
  cancelOptionIcon: { backgroundColor: '#FCE9E7' },
  changeOptionCopy: { minWidth: 0, flex: 1 },
  changeOptionTitle: { color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  changeOptionText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  cancelText: { color: palette.error },
  changeForm: { gap: 14 },
  changeField: { gap: 7 },
  changeLabel: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  changeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.background,
    color: palette.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  reasonInput: { minHeight: 96 },
  changeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    backgroundColor: palette.card,
    padding: 12,
  },
  cancelNotice: { backgroundColor: '#FCEFED' },
  changeNoticeText: { minWidth: 0, flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18 },
  changeError: {
    color: palette.error,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  changeActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  changeBackButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 18,
  },
  changeBackText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
  changeSubmit: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: palette.burgundy,
    paddingHorizontal: 14,
  },
  cancelSubmit: { backgroundColor: palette.error },
  changeSubmitDisabled: { opacity: 0.55 },
  changeSubmitText: { color: palette.surface, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.58 },
})
