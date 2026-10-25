import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
import { VenueBookingSummary } from '../components/VenueBookingSummary'
import type { MerchantBookedService, MerchantBookingRequest } from './19-BookingRequest'

export interface MerchantBookingRequestDetails {
  clientNotes: string
  eventName: string
  eventType: string
  guestCount?: number
  packageInclusions: string[]
  requestedTime: string
  submittedAt: string
  venue: string
}

export type ProviderCompletionPaymentValue = {
  amount?: number
  note?: string
  request: MerchantBookingRequest
  requestKey?: string
  type: 'confirmPayment' | 'notYet'
}

export type ProviderCompletionPaymentResult = {
  message?: string
  ok: boolean
}

export type ProviderFoodTastingResponseValue = {
  action: 'confirm' | 'reject' | 'propose'
  note?: string
  proposedDate?: string
  proposedStartTime?: string
  tastingId: string
}

export type BookingRequestDecision = 'accepted' | 'declined'

export interface BookingRequestDecisionValue {
  decision: BookingRequestDecision
  providerNote: string
  request: MerchantBookingRequest
}

interface BookingRequestDetailsScreenProps {
  completingBookingId?: string
  details?: Partial<MerchantBookingRequestDetails>
  onAccept?: (value: BookingRequestDecisionValue) => void
  onBack?: () => void
  onCompletionPayment?: (value: ProviderCompletionPaymentValue) => Promise<ProviderCompletionPaymentResult>
  onDecline?: (value: BookingRequestDecisionValue) => void
  onFoodTastingResponse?: (value: ProviderFoodTastingResponseValue) => Promise<ProviderCompletionPaymentResult>
  onMessageClient?: (request: MerchantBookingRequest) => void
  processingBookingId?: string
  request?: MerchantBookingRequest
}

const emptyRequest: MerchantBookingRequest = {
  amount: 0,
  clientName: 'Client',
  currency: 'PHP',
  eventDate: '',
  eventName: 'Event',
  id: 'event',
  packageName: 'Service request',
  status: 'new',
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount)

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value || 'Date to be confirmed'
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date)
}

const formatTime = (value?: string) => {
  if (!value) return 'Time to be confirmed'
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return value
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

const statusLabels: Record<MerchantBookingRequest['status'], string> = {
  cancelled: 'Declined',
  completed: 'Completed',
  confirmed: 'Confirmed',
  new: 'New request',
}

const servicesFor = (request: MerchantBookingRequest): MerchantBookedService[] =>
  request.services?.length
    ? request.services
    : [{
        amount: request.amount,
        attendeeCount: request.attendeeCount,
        budgetPerHead: request.budgetPerHead,
        cateringMenuItems: request.cateringMenuItems,
        cateringOptionName: request.cateringOptionName,
        foodTastingWorkflow: request.foodTastingWorkflow,
        clientNotes: request.clientNotes,
        dietaryNotes: request.dietaryNotes,
        downpaymentAmount: request.downpaymentAmount,
        id: request.id,
        instructions: request.instructions ?? [],
        packageDescription: request.packageDescription,
        packageInclusions: request.packageInclusions ?? [],
        packageName: request.packageName,
        paymentStatus: request.paymentStatus,
        platformFeePaid: request.platformFeePaid,
        initialProviderShare: request.initialProviderShare,
        remainingServiceBalance: request.remainingServiceBalance,
        mealType: request.mealType,
        outsideFood: request.outsideFood,
        requestedTime: request.requestedTime,
        serviceCategory: request.serviceCategory,
        serviceId: request.serviceId,
        serviceName: request.serviceName || request.packageName,
        status: request.status,
        submittedAt: request.submittedAt,
        venueBookedHours: request.venueBookedHours,
        venueEndAt: request.venueEndAt,
        venueOptionName: request.venueOptionName,
        venueBooking: request.venueBooking,
      }]

const requestForService = (
  eventRequest: MerchantBookingRequest,
  service: MerchantBookedService
): MerchantBookingRequest => ({
  ...eventRequest,
  amount: service.amount,
  attendeeCount: service.attendeeCount,
  budgetPerHead: service.budgetPerHead,
  cateringMenuItems: service.cateringMenuItems,
  cateringOptionName: service.cateringOptionName,
  foodTasting: service.foodTasting,
  foodTastingEnabled: service.foodTastingEnabled,
  foodTastingWorkflow: service.foodTastingWorkflow,
  clientNotes: service.clientNotes,
  dietaryNotes: service.dietaryNotes,
  downpaymentAmount: service.downpaymentAmount,
  id: service.id,
  instructions: service.instructions,
  packageDescription: service.packageDescription,
  packageInclusions: service.packageInclusions,
  packageName: service.packageName,
  paymentStatus: service.paymentStatus,
  platformFeePaid: service.platformFeePaid,
  initialProviderShare: service.initialProviderShare,
  remainingServiceBalance: service.remainingServiceBalance,
  mealType: service.mealType,
  outsideFood: service.outsideFood,
  requestedTime: service.requestedTime,
  serviceCategory: service.serviceCategory,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  status: service.status,
  submittedAt: service.submittedAt,
  venueBookedHours: service.venueBookedHours,
  venueEndAt: service.venueEndAt,
  venueOptionName: service.venueOptionName,
  venueBooking: service.venueBooking,
})

const hasEventDateArrived = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date <= today
}

const newConfirmationRequestKey = () =>
  `provider-confirmation-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

const paymentAmountFrom = (value: string) => {
  const amount = Number.parseFloat(value.replace(/,/g, '').trim())
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

export const BookingRequestDetailsScreen: React.FC<BookingRequestDetailsScreenProps> = ({
  completingBookingId,
  details,
  onAccept,
  onBack,
  onCompletionPayment,
  onDecline,
  onFoodTastingResponse,
  onMessageClient,
  processingBookingId,
  request = emptyRequest,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 820
  const services = servicesFor(request)
  const [providerNotes, setProviderNotes] = React.useState<Record<string, string>>({})
  const [completionService, setCompletionService] = React.useState<MerchantBookedService>()
  const [completionAmount, setCompletionAmount] = React.useState('')
  const [completionNote, setCompletionNote] = React.useState('')
  const [completionError, setCompletionError] = React.useState('')
  const [completionRequestKey, setCompletionRequestKey] = React.useState('')
  const [isSavingCompletion, setIsSavingCompletion] = React.useState(false)
  const [tastingService, setTastingService] = React.useState<MerchantBookedService>()
  const [tastingAction, setTastingAction] = React.useState<ProviderFoodTastingResponseValue['action']>()
  const [tastingDate, setTastingDate] = React.useState('')
  const [tastingTime, setTastingTime] = React.useState('')
  const [tastingNote, setTastingNote] = React.useState('')
  const [tastingError, setTastingError] = React.useState('')
  const [isSavingTasting, setIsSavingTasting] = React.useState(false)
  const venue =
    details?.venue ||
    [request.venue, request.location].filter(Boolean).join(', ') ||
    'Venue to be confirmed'
  const eventName = request.eventName || details?.eventName || 'Event'
  const eventType = request.eventType || details?.eventType || 'Event'
  const requestedTime = request.requestedTime || details?.requestedTime
  const total = services.reduce((sum, service) => sum + service.amount, 0)
  const eventDateHasArrived = hasEventDateArrived(request.eventDate)

  const decide = (service: MerchantBookedService, decision: BookingRequestDecision) => {
    const value: BookingRequestDecisionValue = {
      decision,
      providerNote: providerNotes[service.id]?.trim() ?? '',
      request: requestForService(request, service),
    }
    if (decision === 'accepted') onAccept?.(value)
    else onDecline?.(value)
  }

  const openCompletionPayment = (service: MerchantBookedService) => {
    setCompletionService(service)
    setCompletionAmount(String(Math.max(0, service.remainingServiceBalance ?? 0)))
    setCompletionNote('')
    setCompletionError('')
    setCompletionRequestKey(newConfirmationRequestKey())
  }

  const closeCompletionPayment = () => {
    if (isSavingCompletion) return
    setCompletionService(undefined)
    setCompletionError('')
  }

  const submitCompletionPayment = async (type: ProviderCompletionPaymentValue['type']) => {
    if (!completionService || !onCompletionPayment || isSavingCompletion) return
    const completionRequest = requestForService(request, completionService)
    const remaining = Math.max(0, completionService.remainingServiceBalance ?? 0)
    const amount = paymentAmountFrom(completionAmount)

    if (type === 'confirmPayment' && (amount <= 0 || amount > remaining)) {
      setCompletionError(`Enter an amount from ${formatPrice(1)} to ${formatPrice(remaining)}.`)
      return
    }

    setIsSavingCompletion(true)
    setCompletionError('')
    const result = await onCompletionPayment({
      amount: type === 'confirmPayment' ? amount : undefined,
      note: completionNote,
      request: completionRequest,
      requestKey: type === 'confirmPayment' ? completionRequestKey : undefined,
      type,
    })
    setIsSavingCompletion(false)

    if (!result.ok) {
      setCompletionError(result.message ?? 'Unable to update the payment confirmation.')
      return
    }

    setCompletionService(undefined)
  }

  const openFoodTastingResponse = (
    service: MerchantBookedService,
    action: ProviderFoodTastingResponseValue['action']
  ) => {
    setTastingService(service)
    setTastingAction(action)
    setTastingDate(action === 'propose' ? service.foodTasting?.scheduledDate ?? '' : '')
    setTastingTime(action === 'propose' ? service.foodTasting?.startTime ?? '' : '')
    setTastingNote('')
    setTastingError('')
  }

  const closeFoodTastingResponse = () => {
    if (isSavingTasting) return
    setTastingService(undefined)
    setTastingAction(undefined)
    setTastingError('')
  }

  const submitFoodTastingResponse = async () => {
    const tasting = tastingService?.foodTasting
    if (!tasting || !tastingAction || !onFoodTastingResponse || isSavingTasting) return
    if (tastingAction === 'propose' && (!/^\d{4}-\d{2}-\d{2}$/.test(tastingDate) || !/^\d{2}:\d{2}$/.test(tastingTime))) {
      setTastingError('Enter a proposed date (YYYY-MM-DD) and configured slot time (HH:MM).')
      return
    }
    setIsSavingTasting(true)
    setTastingError('')
    const result = await onFoodTastingResponse({
      action: tastingAction,
      note: tastingNote,
      proposedDate: tastingAction === 'propose' ? tastingDate : undefined,
      proposedStartTime: tastingAction === 'propose' ? tastingTime : undefined,
      tastingId: tasting.id,
    })
    setIsSavingTasting(false)
    if (!result.ok) {
      setTastingError(result.message ?? 'Unable to update the food tasting request.')
      return
    }
    closeFoodTastingResponse()
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to booking requests"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressedSurface]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>Event Booking</Text>
          <Pressable
            accessibilityLabel={`Message ${request.clientName}`}
            accessibilityRole="button"
            onPress={() => onMessageClient?.(request)}
            style={({ pressed }) => [styles.messageButton, pressed && styles.pressedSurface]}
          >
            <MaterialIcons color={palette.primaryContainer} name="chat-bubble-outline" size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, isWide ? styles.contentWide : styles.contentMobile]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.eventHero}>
          <View style={styles.eventHeroTop}>
            <View style={styles.eventHeroCopy}>
              <Text style={styles.eventEyebrow}>{eventType.toUpperCase()}</Text>
              <Text style={styles.eventTitle}>{eventName}</Text>
              <Text style={styles.organizerText}>Booked by {request.clientName}</Text>
            </View>
            <View style={styles.totalPill}>
              <Text style={styles.totalLabel}>TOTAL BOOKED</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
          </View>

          <View style={[styles.eventFacts, isWide && styles.eventFactsWide]}>
            <EventFact icon="event" label="DATE" value={formatDate(request.eventDate)} />
            <EventFact icon="schedule" label="TIME" value={formatTime(requestedTime)} />
            <EventFact icon="location-on" label="VENUE" value={venue} />
            <EventFact
              icon="groups"
              label="GUESTS"
              value={
                request.guestCount || details?.guestCount
                  ? `${request.guestCount || details?.guestCount} guests`
                  : 'Not specified'
              }
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>YOUR BUSINESS IN THIS EVENT</Text>
            <Text style={styles.sectionTitle}>Booked services</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{services.length}</Text>
          </View>
        </View>

        <View style={styles.serviceList}>
          {services.map((service, index) => {
            const isProcessing = Boolean(processingBookingId) || Boolean(completingBookingId)
            const isNew = service.status === 'new'
            const isConfirmed = service.status === 'confirmed'
            const foodTastingPricePending = Boolean(
              service.foodTastingWorkflow && service.foodTastingWorkflow.status !== 'finalized'
            )

            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceCardHeader}>
                  <View style={styles.serviceNumber}>
                    <Text style={styles.serviceNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.serviceHeadingCopy}>
                    <Text style={styles.serviceCategory}>
                      {(service.serviceCategory || 'Booked service').toUpperCase()}
                    </Text>
                    <Text style={styles.serviceName}>{service.serviceName}</Text>
                    {service.packageName !== service.serviceName ? (
                      <Text style={styles.packageName}>{service.packageName}</Text>
                    ) : null}
                  </View>
                  <View style={styles.serviceAside}>
                    <Text style={styles.servicePrice}>
                      {foodTastingPricePending ? 'Final price pending' : formatPrice(service.amount)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        service.status === 'confirmed' && styles.statusConfirmed,
                        service.status === 'completed' && styles.statusCompleted,
                        service.status === 'cancelled' && styles.statusCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          service.status === 'confirmed' && styles.statusTextConfirmed,
                          service.status === 'completed' && styles.statusTextCompleted,
                          service.status === 'cancelled' && styles.statusTextCancelled,
                        ]}
                      >
                        {statusLabels[service.status]}
                      </Text>
                    </View>
                  </View>
                </View>

                {service.packageDescription ? (
                  <Text style={styles.packageDescription}>{service.packageDescription}</Text>
                ) : null}

                {service.venueBooking ? (
                  <VenueBookingSummary audience="provider" configuration={service.venueBooking} />
                ) : null}

                {service.paymentStatus ? (
                  <View style={styles.paymentCard}>
                    <View style={styles.paymentCardHeader}>
                      <View style={styles.paymentCardHeaderCopy}>
                        <Text style={styles.miniLabel}>PAYMENT &amp; YOUR SERVICE BALANCE</Text>
                        <Text style={styles.paymentStatus}>{service.paymentStatus}</Text>
                      </View>
                      <MaterialIcons color={palette.success} name="verified" size={20} />
                    </View>
                    <View style={styles.paymentGrid}>
                      <PaymentAmount label="YOUR SERVICE PRICE" value={service.amount} />
                      <PaymentAmount
                        label="CLIENT PAYMENT RECEIVED"
                        value={service.downpaymentAmount ?? 0}
                      />
                      <PaymentAmount
                        label="INITIAL PROVIDER SHARE"
                        value={service.initialProviderShare ?? 0}
                      />
                      <PaymentAmount
                        label="EXTERNAL PAYMENTS CONFIRMED"
                        value={service.confirmedExternalPaymentAmount ?? 0}
                      />
                      <PaymentAmount
                        emphasized
                        label="REMAINING SERVICE BALANCE"
                        value={service.remainingServiceBalance ?? 0}
                      />
                    </View>
                    <Text style={styles.paymentExplanation}>
                      The client's payment already includes MULTIVENT's {formatPrice(service.platformFeePaid ?? 0)} commission. It is not deducted from your remaining service balance.
                    </Text>
                    <Text style={styles.paymentTiming}>
                      {service.status === 'completed'
                        ? 'The remaining balance was recorded before this service was completed.'
                        : service.completionPaymentStatus === 'fully_confirmed'
                          ? 'The external balance has been fully confirmed and the service is ready to complete.'
                          : service.completionPaymentStatus === 'partially_confirmed'
                            ? 'A partial external payment is recorded. Confirm the balance still outstanding before completion.'
                            : isConfirmed
                              ? 'Your initial share is recorded. Confirm any remaining direct payment after service delivery.'
                        : 'Accept this service to credit your initial share. The remaining service balance becomes due after event completion.'}
                    </Text>
                  </View>
                ) : null}

                {service.packageInclusions.length ? (
                  <View style={styles.inclusionsCard}>
                    <Text style={styles.miniLabel}>PACKAGE INCLUSIONS</Text>
                    {service.packageInclusions.map((inclusion, inclusionIndex) => (
                      <View key={`${service.id}-${inclusionIndex}`} style={styles.inclusionRow}>
                        <MaterialIcons color={palette.success} name="check-circle" size={16} />
                        <Text style={styles.inclusionText}>{inclusion}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {service.mealType || service.attendeeCount || service.budgetPerHead || service.cateringOptionName || service.cateringMenuItems?.length || service.venueOptionName ? (
                  <View style={styles.bookingDetailsCard}>
                    <Text style={styles.miniLabel}>CLIENT BOOKING DETAILS</Text>
                    <View style={styles.bookingDetailsGrid}>
                      {service.cateringOptionName ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="restaurant-menu" size={17} />
                          <Text style={styles.bookingDetailText}>{service.cateringOptionName}</Text>
                        </View>
                      ) : null}
                      {service.cateringMenuItems?.length ? (
                        <View style={styles.bookingMenuItems}>
                          <Text style={styles.miniLabel}>SELECTED FOOD ITEMS</Text>
                          {service.cateringMenuItems.map((item) => <Text key={item} style={styles.bookingDetailText}>• {item}</Text>)}
                        </View>
                      ) : null}
                      {service.venueOptionName ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="meeting-room" size={17} />
                          <Text style={styles.bookingDetailText}>
                            {service.venueOptionName} · {service.venueBookedHours ?? 0} hours
                            {service.venueEndAt ? ` · ends ${formatTime(service.venueEndAt.slice(11, 16))}` : ''}
                          </Text>
                        </View>
                      ) : null}
                      {service.mealType ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="restaurant" size={17} />
                          <Text style={styles.bookingDetailText}>
                            {service.mealType.charAt(0).toUpperCase() + service.mealType.slice(1)} service
                          </Text>
                        </View>
                      ) : null}
                      {service.attendeeCount ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="groups" size={17} />
                          <Text style={styles.bookingDetailText}>{service.attendeeCount} attendees</Text>
                        </View>
                      ) : null}
                      {service.budgetPerHead ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="payments" size={17} />
                          <Text style={styles.bookingDetailText}>
                            {formatPrice(service.budgetPerHead)} selected price per head
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {service.dietaryNotes ? (
                      <Text style={styles.dietaryNotes}>Dietary notes: {service.dietaryNotes}</Text>
                    ) : null}
                  </View>
                ) : null}

                {service.foodTastingWorkflow ? (
                  <View style={styles.foodTastingCard}>
                    <View style={styles.foodTastingHeading}>
                      <View style={styles.foodTastingIcon}>
                        <MaterialIcons color={palette.primaryContainer} name="restaurant-menu" size={18} />
                      </View>
                      <View style={styles.foodTastingCopy}>
                        <Text style={styles.foodTastingTitle}>Preliminary Food Tasting Menu</Text>
                        <Text style={styles.foodTastingText}>
                          {service.foodTastingWorkflow.status === 'awaiting_provider_acceptance'
                            ? 'Accept this request to let the client choose an available tasting schedule within seven days.'
                            : service.foodTastingWorkflow.status === 'scheduling_required'
                              ? 'The client has seven calendar days from your acceptance to choose an available schedule.'
                              : 'The preliminary tasting menu remains available for finalization after the appointment.'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.foodTastingText}>
                      {service.foodTastingWorkflow.guestCount} guest{service.foodTastingWorkflow.guestCount === 1 ? '' : 's'}
                    </Text>
                    {service.foodTastingWorkflow.attendanceStatus === 'confirmed' ? (
                      <Text style={styles.foodTastingText}>
                        Client attendance is confirmed for the scheduled food tasting.
                      </Text>
                    ) : service.foodTastingWorkflow.attendanceStatus === 'confirmation_required' ? (
                      <Text style={styles.foodTastingText}>
                        The client has been asked to confirm attendance for the scheduled food tasting.
                      </Text>
                    ) : service.foodTastingWorkflow.attendanceStatus === 'no_response' ? (
                      <>
                        <Text style={styles.foodTastingText}>
                          Client Has Not Confirmed Attendance. Message the client for clarification.
                        </Text>
                        <View style={styles.actionRow}>
                          <Pressable
                            accessibilityLabel={`Message ${request.clientName} about food tasting attendance`}
                            disabled={!onMessageClient}
                            onPress={() => onMessageClient?.(requestForService(request, service))}
                            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                          >
                            <Text style={styles.primaryButtonText}>Message Client</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : null}
                    {service.foodTastingWorkflow.rescheduleAttemptCount > 0 ? (
                      <Text style={styles.foodTastingText}>Client reschedule attempts used: 1 of 1.</Text>
                    ) : null}
                    {service.foodTastingWorkflow.preliminaryMenu.map((course) => (
                      <View key={`${service.id}-${course.name}`} style={styles.foodTastingCourse}>
                        <Text style={styles.foodTastingCourseTitle}>
                          {course.name} - taste {course.tastingSelectionLimit}, finalize {course.finalSelectionLimit}
                        </Text>
                        <Text style={styles.foodTastingText}>{course.selectedItemNames.join(', ')}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {service.foodTasting ? (
                  <View style={styles.foodTastingCard}>
                    <View style={styles.foodTastingHeading}>
                      <View style={styles.foodTastingIcon}>
                        <MaterialIcons color={palette.primaryContainer} name="restaurant" size={18} />
                      </View>
                      <View style={styles.foodTastingCopy}>
                        <Text style={styles.foodTastingTitle}>Food Tasting</Text>
                        <Text style={styles.foodTastingText}>
                          {foodTastingStatusLabel(service.foodTasting.status)} - {formatDate(service.foodTasting.scheduledDate)} at {formatTime(service.foodTasting.startTime)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.foodTastingLocation}>
                      {service.foodTasting.location} - {service.foodTasting.timezone}
                    </Text>
                    {service.foodTasting.clientNote ? (
                      <Text style={styles.foodTastingText}>Client note: {service.foodTasting.clientNote}</Text>
                    ) : null}
                    {service.foodTasting.status === 'requested' && !service.foodTastingWorkflow ? (
                      <View style={styles.actionRow}>
                        <Pressable
                          accessibilityLabel={`Decline food tasting for ${service.serviceName}`}
                          disabled={isSavingTasting || !onFoodTastingResponse}
                          onPress={() => openFoodTastingResponse(service, 'reject')}
                          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.secondaryButtonText}>Decline tasting</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Propose another food tasting schedule for ${service.serviceName}`}
                          disabled={isSavingTasting || !onFoodTastingResponse}
                          onPress={() => openFoodTastingResponse(service, 'propose')}
                          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.secondaryButtonText}>Propose another</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Confirm food tasting for ${service.serviceName}`}
                          disabled={isSavingTasting || !onFoodTastingResponse}
                          onPress={() => openFoodTastingResponse(service, 'confirm')}
                          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                        >
                          <Text style={styles.primaryButtonText}>Confirm tasting</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.noteCard}>
                  <View style={styles.noteHeading}>
                    <MaterialIcons color={palette.primaryContainer} name="notes" size={17} />
                    <Text style={styles.noteTitle}>Client note for this service</Text>
                  </View>
                  <Text style={styles.noteBody}>
                    {service.clientNotes?.trim() ||
                      'The client did not add a separate note for this service.'}
                  </Text>
                </View>

                <View style={styles.instructionsSection}>
                  <View style={styles.noteHeading}>
                    <MaterialIcons color="#9A6500" name="assignment" size={17} />
                    <Text style={styles.instructionSectionTitle}>Service instructions</Text>
                  </View>
                  {service.instructions.length ? (
                    service.instructions.map((instruction) => (
                      <View key={instruction.id} style={styles.instructionItem}>
                        <Text style={styles.instructionTitle}>{instruction.title}</Text>
                        {instruction.body ? (
                          <Text style={styles.instructionBody}>{instruction.body}</Text>
                        ) : null}
                        {instruction.tags.length ? (
                          <View style={styles.tagRow}>
                            {instruction.tags.map((tag) => (
                              <View key={`${instruction.id}-${tag}`} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noInstructions}>
                      No additional instructions were added for this service.
                    </Text>
                  )}
                </View>

                {isNew ? (
                  <View style={styles.actionSection}>
                    <Text style={styles.miniLabel}>RESPONSE NOTE (OPTIONAL)</Text>
                    <TextInput
                      accessibilityLabel={`Response note for ${service.serviceName}`}
                      maxLength={300}
                      multiline
                      onChangeText={(note) =>
                        setProviderNotes((current) => ({ ...current, [service.id]: note }))
                      }
                      placeholder="Add a short confirmation or next step..."
                      placeholderTextColor={palette.placeholder}
                      style={styles.responseInput}
                      textAlignVertical="top"
                      value={providerNotes[service.id] ?? ''}
                    />
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityLabel={`Decline ${service.serviceName}`}
                        disabled={isProcessing}
                        onPress={() => decide(service, 'declined')}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          pressed && styles.pressed,
                          isProcessing && styles.disabled,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>Decline service</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Accept ${service.serviceName}`}
                        disabled={isProcessing}
                        onPress={() => decide(service, 'accepted')}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          pressed && styles.pressed,
                          isProcessing && styles.disabled,
                        ]}
                      >
                        {processingBookingId === service.id ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : null}
                        <Text style={styles.primaryButtonText}>Accept service</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : isConfirmed ? (
                  <View style={styles.completionSection}>
                    <View style={styles.completionCopy}>
                      <Text style={styles.completionTitle}>
                        {eventDateHasArrived
                          ? 'Has this service been delivered?'
                          : 'Completion opens on the event date'}
                      </Text>
                      <Text style={styles.completionText}>
                        {eventDateHasArrived
                          ? 'Mark only this service as finished after delivery.'
                          : `Available on ${formatDate(request.eventDate)}.`}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Mark ${service.serviceName} finished`}
                      disabled={!eventDateHasArrived || isProcessing || !onCompletionPayment}
                      onPress={() => openCompletionPayment(service)}
                      style={({ pressed }) => [
                        styles.finishButton,
                        pressed && styles.pressed,
                        (!eventDateHasArrived || isProcessing || !onCompletionPayment) && styles.disabled,
                      ]}
                    >
                      {completingBookingId === service.id ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <MaterialIcons color="#FFFFFF" name="done" size={17} />
                      )}
                      <Text style={styles.finishButtonText}>Mark finished</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.closedNotice}>
                    <MaterialIcons
                      color={service.status === 'completed' ? palette.success : palette.secondary}
                      name={service.status === 'completed' ? 'task-alt' : 'info-outline'}
                      size={18}
                    />
                    <Text style={styles.closedNoticeText}>
                      {service.status === 'completed'
                        ? 'This service has been marked as delivered.'
                        : 'This service request was declined.'}
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={closeFoodTastingResponse}
        transparent
        visible={Boolean(tastingService && tastingAction)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tastingResponseModal}>
            <Text style={styles.completionModalTitle}>
              {tastingAction === 'confirm'
                ? 'Confirm Food Tasting?'
                : tastingAction === 'reject'
                  ? 'Decline Food Tasting?'
                  : 'Propose Another Schedule'}
            </Text>
            <Text style={styles.completionModalServiceName}>
              {tastingService?.serviceName}
            </Text>
            {tastingAction === 'propose' ? (
              <View style={styles.tastingProposalFields}>
                <Text style={styles.completionInputLabel}>PROPOSED DATE</Text>
                <TextInput
                  accessibilityLabel="Proposed food tasting date"
                  editable={!isSavingTasting}
                  onChangeText={setTastingDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.placeholder}
                  style={styles.completionAmountInput}
                  value={tastingDate}
                />
                <Text style={styles.completionInputLabel}>PROPOSED CONFIGURED SLOT</Text>
                <TextInput
                  accessibilityLabel="Proposed food tasting time"
                  editable={!isSavingTasting}
                  onChangeText={setTastingTime}
                  placeholder="HH:MM"
                  placeholderTextColor={palette.placeholder}
                  style={styles.completionAmountInput}
                  value={tastingTime}
                />
                <Text style={styles.tastingProposalHint}>
                  The server will verify this is one of your configured food tasting slots and is still available.
                </Text>
              </View>
            ) : null}
            <TextInput
              accessibilityLabel="Food tasting response note"
              editable={!isSavingTasting}
              maxLength={600}
              multiline
              onChangeText={setTastingNote}
              placeholder="Optional note for the client"
              placeholderTextColor={palette.placeholder}
              style={styles.completionNoteInput}
              textAlignVertical="top"
              value={tastingNote}
            />
            {tastingError ? <Text style={styles.completionError}>{tastingError}</Text> : null}
            <View style={styles.completionModalActions}>
              <Pressable
                accessibilityLabel="Cancel food tasting response"
                disabled={isSavingTasting}
                onPress={closeFoodTastingResponse}
                style={({ pressed }) => [styles.completionCancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.completionCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Submit food tasting response"
                disabled={isSavingTasting}
                onPress={() => void submitFoodTastingResponse()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSavingTasting && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSavingTasting ? 'Saving...' : tastingAction === 'confirm' ? 'Confirm' : tastingAction === 'reject' ? 'Decline' : 'Send proposal'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeCompletionPayment}
        transparent
        visible={Boolean(completionService)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.completionModal}>
            <Text style={styles.completionModalTitle}>Complete This Service?</Text>
            <Text style={styles.completionModalServiceName}>
              {completionService?.serviceName ?? completionService?.packageName}
            </Text>
            <View style={styles.completionPaymentGrid}>
              <PaymentAmount label="SERVICE AMOUNT" value={completionService?.amount ?? 0} />
              <PaymentAmount
                label="INITIAL AMOUNT CREDITED"
                value={completionService?.initialProviderShare ?? 0}
              />
              <PaymentAmount
                label="EXTERNAL PAYMENTS CONFIRMED"
                value={completionService?.confirmedExternalPaymentAmount ?? 0}
              />
              <PaymentAmount
                emphasized
                label="REMAINING BALANCE"
                value={completionService?.remainingServiceBalance ?? 0}
              />
            </View>
            <Text style={styles.completionModalNotice}>
              Confirming a payment records the amount your client paid directly to you. It is provider-confirmed and is not a verified PayMongo transaction.
            </Text>
            <Text style={styles.completionInputLabel}>AMOUNT RECEIVED NOW</Text>
            <TextInput
              accessibilityLabel="External payment amount received"
              editable={!isSavingCompletion}
              keyboardType="decimal-pad"
              onChangeText={setCompletionAmount}
              placeholder="0.00"
              placeholderTextColor={palette.placeholder}
              style={styles.completionAmountInput}
              value={completionAmount}
            />
            <TextInput
              accessibilityLabel="Optional payment note"
              editable={!isSavingCompletion}
              maxLength={300}
              multiline
              onChangeText={setCompletionNote}
              placeholder="Optional note for your records"
              placeholderTextColor={palette.placeholder}
              style={styles.completionNoteInput}
              textAlignVertical="top"
              value={completionNote}
            />
            {completionError ? <Text style={styles.completionError}>{completionError}</Text> : null}
            <View style={styles.completionModalActions}>
              <Pressable
                accessibilityLabel="Cancel payment confirmation"
                disabled={isSavingCompletion}
                onPress={closeCompletionPayment}
                style={({ pressed }) => [
                  styles.completionCancelButton,
                  pressed && styles.pressed,
                  isSavingCompletion && styles.disabled,
                ]}
              >
                <Text style={styles.completionCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Keep the service open while payment is outstanding"
                disabled={isSavingCompletion}
                onPress={() => void submitCompletionPayment('notYet')}
                style={({ pressed }) => [
                  styles.completionNotYetButton,
                  pressed && styles.pressed,
                  isSavingCompletion && styles.disabled,
                ]}
              >
                <Text style={styles.completionNotYetButtonText}>Not Yet</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Confirm external payment received"
                disabled={isSavingCompletion}
                onPress={() => void submitCompletionPayment('confirmPayment')}
                style={({ pressed }) => [
                  styles.completionConfirmButton,
                  pressed && styles.pressed,
                  isSavingCompletion && styles.disabled,
                ]}
              >
                {isSavingCompletion ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
                <Text style={styles.completionConfirmButtonText}>Confirm payment received</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const EventFact = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  value: string
}) => (
  <View style={styles.eventFact}>
    <View style={styles.eventFactIcon}>
      <MaterialIcons color={palette.primaryContainer} name={icon} size={18} />
    </View>
    <View style={styles.eventFactCopy}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.factValue}>{value}</Text>
    </View>
  </View>
)

const PaymentAmount = ({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean
  label: string
  value: number
}) => (
  <View style={[styles.paymentAmount, emphasized && styles.paymentAmountEmphasized]}>
    <Text style={styles.paymentAmountLabel}>{label}</Text>
    <Text style={[styles.paymentAmountValue, emphasized && styles.paymentAmountValueEmphasized]}>
      {formatPrice(value)}
    </Text>
  </View>
)

const foodTastingStatusLabel = (status: string) => ({
  cancelled: 'Cancelled',
  completed: 'Completed',
  confirmed: 'Confirmed',
  rejected: 'Declined',
  requested: 'Awaiting your response',
  reschedule_proposed: 'Awaiting client response',
}[status] ?? 'Scheduled')

const palette = {
  background: '#FAF9F9',
  border: '#E3DEDD',
  cancelled: '#93000A',
  cancelledSoft: '#FFDAD6',
  completedSoft: '#E7F3EB',
  placeholder: '#9C9695',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#655E5D',
  success: '#16603D',
  surface: '#FFFFFF',
  surfaceLow: '#F5F3F3',
  text: '#201B1B',
  warningSoft: '#FFF4DC',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: { minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topAppBarContent: { width: '100%', maxWidth: 1040, minHeight: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: { position: 'absolute', left: 4, width: 10, height: 10, borderBottomWidth: 1.8, borderLeftWidth: 1.8, borderColor: palette.primary, transform: [{ rotate: '45deg' }] },
  backIconShaft: { width: 16, height: 1.8, marginLeft: 4, borderRadius: 1, backgroundColor: palette.primary },
  headerTitle: { minWidth: 0, flex: 1, color: palette.primary, fontSize: 19, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  messageButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pressedSurface: { backgroundColor: palette.surfaceLow },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 30, paddingBottom: 64 },
  eventHero: { borderWidth: 1, borderColor: '#DDCBCD', borderRadius: 14, backgroundColor: palette.surface, padding: 18, marginBottom: 28 },
  eventHeroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  eventHeroCopy: { minWidth: 0, flex: 1 },
  eventEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  eventTitle: { color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 3 },
  organizerText: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 4 },
  totalPill: { alignItems: 'flex-end', borderRadius: 10, backgroundColor: palette.primarySoft, paddingHorizontal: 11, paddingVertical: 8 },
  totalLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6 },
  totalValue: { color: palette.primaryContainer, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 1 },
  eventFacts: { gap: 13 },
  eventFactsWide: { flexDirection: 'row' },
  eventFact: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eventFactIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: palette.primarySoft },
  eventFactCopy: { minWidth: 0, flex: 1 },
  factLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  factValue: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 10, marginBottom: 13 },
  sectionEyebrow: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
  sectionTitle: { color: palette.text, fontSize: 19, lineHeight: 25, fontWeight: '700', marginTop: 2 },
  countBadge: { minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: palette.primaryContainer },
  countBadgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  serviceList: { gap: 16 },
  serviceCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface, padding: 16 },
  serviceCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.primaryContainer },
  serviceNumberText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  serviceHeadingCopy: { minWidth: 0, flex: 1 },
  serviceCategory: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  serviceName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '700', marginTop: 2 },
  packageName: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  serviceAside: { alignItems: 'flex-end', gap: 5 },
  servicePrice: { color: palette.primaryContainer, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  statusBadge: { borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 4 },
  statusConfirmed: { backgroundColor: palette.primarySoft },
  statusCompleted: { backgroundColor: palette.completedSoft },
  statusCancelled: { backgroundColor: palette.cancelledSoft },
  statusText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextCompleted: { color: palette.success },
  statusTextCancelled: { color: palette.cancelled },
  packageDescription: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 12 },
  paymentCard: { gap: 9, borderWidth: 1, borderColor: '#D7E5DC', borderRadius: 9, backgroundColor: '#F4FAF6', padding: 12, marginTop: 13 },
  paymentCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  paymentCardHeaderCopy: { minWidth: 0, flex: 1 },
  paymentStatus: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 2 },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentAmount: { minWidth: '47%', flexGrow: 1, borderRadius: 8, backgroundColor: palette.surface, padding: 9 },
  paymentAmountEmphasized: { borderWidth: 1, borderColor: '#B9D4C3' },
  paymentAmountLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4 },
  paymentAmountValue: { color: palette.primaryContainer, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 2 },
  paymentAmountValueEmphasized: { color: palette.success },
  paymentExplanation: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  paymentTiming: { color: palette.success, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  inclusionsCard: { borderRadius: 9, backgroundColor: palette.surfaceLow, padding: 12, marginTop: 13, gap: 7 },
  miniLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7, marginBottom: 2 },
  inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  inclusionText: { minWidth: 0, flex: 1, color: palette.text, fontSize: 12, lineHeight: 16 },
  bookingDetailsCard: { borderRadius: 9, backgroundColor: '#F7F1F2', padding: 12, marginTop: 13, gap: 8 },
  bookingDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookingMenuItems: { width: '100%', gap: 3, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8 },
  bookingDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.surface, paddingHorizontal: 9, paddingVertical: 7 },
  bookingDetailText: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  dietaryNotes: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  foodTastingCard: { gap: 8, borderRadius: 9, backgroundColor: '#F7F1F2', padding: 12, marginTop: 13 },
  foodTastingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  foodTastingIcon: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F0DDE1' },
  foodTastingCopy: { minWidth: 0, flex: 1 },
  foodTastingTitle: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  foodTastingText: { color: palette.secondary, fontSize: 12, lineHeight: 16 },
  foodTastingCourse: { gap: 3, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 8 },
  foodTastingCourseTitle: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  foodTastingLocation: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  noteCard: { borderLeftWidth: 3, borderLeftColor: palette.primaryContainer, borderRadius: 8, backgroundColor: palette.primarySoft, padding: 12, marginTop: 13 },
  noteHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  noteBody: { color: palette.text, fontSize: 12, lineHeight: 16, marginTop: 6 },
  instructionsSection: { borderRadius: 8, backgroundColor: palette.warningSoft, padding: 12, marginTop: 10 },
  instructionSectionTitle: { color: '#765000', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  instructionItem: { borderTopWidth: 1, borderTopColor: '#EBD8AE', paddingTop: 9, marginTop: 9 },
  instructionTitle: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  instructionBody: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 3 },
  noInstructions: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  tag: { borderRadius: 10, backgroundColor: '#F3DEB0', paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { color: '#765000', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  actionSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, marginTop: 14 },
  responseInput: { minHeight: 66, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: '#FCFBFB', color: palette.text, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, padding: 10, marginTop: 7 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  secondaryButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D3BFC2', borderRadius: 8, paddingHorizontal: 12 },
  secondaryButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  primaryButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.primaryContainer, paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  completionSection: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, marginTop: 14 },
  completionCopy: { minWidth: 0, flex: 1 },
  completionTitle: { color: palette.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  completionText: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  finishButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, backgroundColor: palette.success, paddingHorizontal: 12 },
  finishButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32, 27, 27, 0.48)', padding: 20 },
  completionModal: { width: '100%', maxWidth: 520, maxHeight: '94%', borderRadius: 16, backgroundColor: palette.surface, padding: 20 },
  tastingResponseModal: { width: '100%', maxWidth: 520, borderRadius: 16, backgroundColor: palette.surface, padding: 20 },
  completionModalTitle: { color: palette.text, fontSize: 21, lineHeight: 27, fontWeight: '700' },
  completionModalServiceName: { color: palette.secondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  completionPaymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  completionModalNotice: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 13 },
  completionInputLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, marginTop: 16 },
  completionAmountInput: { minHeight: 44, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: '#FCFBFB', color: palette.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 20, paddingHorizontal: 12, marginTop: 6 },
  completionNoteInput: { minHeight: 64, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: '#FCFBFB', color: palette.text, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, padding: 10, marginTop: 9 },
  tastingProposalFields: { marginTop: 6 },
  tastingProposalHint: { color: palette.secondary, fontSize: 12, lineHeight: 16, marginTop: 8 },
  completionError: { color: palette.cancelled, fontSize: 12, lineHeight: 16, marginTop: 8 },
  completionModalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  completionCancelButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 8, paddingHorizontal: 12 },
  completionCancelButtonText: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  completionNotYetButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D3BFC2', borderRadius: 8, paddingHorizontal: 12 },
  completionNotYetButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  completionConfirmButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.success, paddingHorizontal: 12 },
  completionConfirmButtonText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  closedNotice: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 13, marginTop: 13 },
  closedNoticeText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
})
