import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
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
  onDecline?: (value: BookingRequestDecisionValue) => void
  onMarkCompleted?: (request: MerchantBookingRequest) => void
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
        clientNotes: request.clientNotes,
        dietaryNotes: request.dietaryNotes,
        id: request.id,
        instructions: request.instructions ?? [],
        packageDescription: request.packageDescription,
        packageInclusions: request.packageInclusions ?? [],
        packageName: request.packageName,
        mealType: request.mealType,
        outsideFood: request.outsideFood,
        requestedTime: request.requestedTime,
        serviceCategory: request.serviceCategory,
        serviceId: request.serviceId,
        serviceName: request.serviceName || request.packageName,
        status: request.status,
        submittedAt: request.submittedAt,
      }]

const requestForService = (
  eventRequest: MerchantBookingRequest,
  service: MerchantBookedService
): MerchantBookingRequest => ({
  ...eventRequest,
  amount: service.amount,
  attendeeCount: service.attendeeCount,
  budgetPerHead: service.budgetPerHead,
  clientNotes: service.clientNotes,
  dietaryNotes: service.dietaryNotes,
  id: service.id,
  instructions: service.instructions,
  packageDescription: service.packageDescription,
  packageInclusions: service.packageInclusions,
  packageName: service.packageName,
  mealType: service.mealType,
  outsideFood: service.outsideFood,
  requestedTime: service.requestedTime,
  serviceCategory: service.serviceCategory,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  status: service.status,
  submittedAt: service.submittedAt,
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
  onDecline,
  onMarkCompleted,
  onMessageClient,
  processingBookingId,
  request = emptyRequest,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 820
  const services = servicesFor(request)
  const [providerNotes, setProviderNotes] = React.useState<Record<string, string>>({})
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
                    <Text style={styles.servicePrice}>{formatPrice(service.amount)}</Text>
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

                {service.mealType || service.attendeeCount || service.budgetPerHead || service.outsideFood ? (
                  <View style={styles.bookingDetailsCard}>
                    <Text style={styles.miniLabel}>CLIENT BOOKING DETAILS</Text>
                    <View style={styles.bookingDetailsGrid}>
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
                            {formatPrice(service.budgetPerHead)} per head budget
                          </Text>
                        </View>
                      ) : null}
                      {service.outsideFood ? (
                        <View style={styles.bookingDetailItem}>
                          <MaterialIcons color={palette.primaryContainer} name="takeout-dining" size={17} />
                          <Text style={styles.bookingDetailText}>Bringing outside food or drinks</Text>
                        </View>
                      ) : null}
                    </View>
                    {service.dietaryNotes ? (
                      <Text style={styles.dietaryNotes}>Dietary notes: {service.dietaryNotes}</Text>
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
                      disabled={!eventDateHasArrived || isProcessing}
                      onPress={() => onMarkCompleted?.(requestForService(request, service))}
                      style={({ pressed }) => [
                        styles.finishButton,
                        pressed && styles.pressed,
                        (!eventDateHasArrived || isProcessing) && styles.disabled,
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
  eventEyebrow: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 1 },
  eventTitle: { color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 3 },
  organizerText: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  totalPill: { alignItems: 'flex-end', borderRadius: 10, backgroundColor: palette.primarySoft, paddingHorizontal: 11, paddingVertical: 8 },
  totalLabel: { color: palette.secondary, fontSize: 7, lineHeight: 10, fontWeight: '700', letterSpacing: 0.6 },
  totalValue: { color: palette.primaryContainer, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 1 },
  eventFacts: { gap: 13 },
  eventFactsWide: { flexDirection: 'row' },
  eventFact: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  eventFactIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: palette.primarySoft },
  eventFactCopy: { minWidth: 0, flex: 1 },
  factLabel: { color: palette.secondary, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.7 },
  factValue: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 10, marginBottom: 13 },
  sectionEyebrow: { color: palette.primaryContainer, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.8 },
  sectionTitle: { color: palette.text, fontSize: 19, lineHeight: 25, fontWeight: '700', marginTop: 2 },
  countBadge: { minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: palette.primaryContainer },
  countBadgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  serviceList: { gap: 16 },
  serviceCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: palette.surface, padding: 16 },
  serviceCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: palette.primaryContainer },
  serviceNumberText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  serviceHeadingCopy: { minWidth: 0, flex: 1 },
  serviceCategory: { color: palette.primaryContainer, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.7 },
  serviceName: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '700', marginTop: 2 },
  packageName: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 2 },
  serviceAside: { alignItems: 'flex-end', gap: 5 },
  servicePrice: { color: palette.primaryContainer, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  statusBadge: { borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 8, paddingVertical: 4 },
  statusConfirmed: { backgroundColor: palette.primarySoft },
  statusCompleted: { backgroundColor: palette.completedSoft },
  statusCancelled: { backgroundColor: palette.cancelledSoft },
  statusText: { color: palette.primaryContainer, fontSize: 8, lineHeight: 11, fontWeight: '700' },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextCompleted: { color: palette.success },
  statusTextCancelled: { color: palette.cancelled },
  packageDescription: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 12 },
  inclusionsCard: { borderRadius: 9, backgroundColor: palette.surfaceLow, padding: 12, marginTop: 13, gap: 7 },
  miniLabel: { color: palette.secondary, fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 2 },
  inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  inclusionText: { minWidth: 0, flex: 1, color: palette.text, fontSize: 10, lineHeight: 15 },
  bookingDetailsCard: { borderRadius: 9, backgroundColor: '#F7F1F2', padding: 12, marginTop: 13, gap: 8 },
  bookingDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookingDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.surface, paddingHorizontal: 9, paddingVertical: 7 },
  bookingDetailText: { color: palette.text, fontSize: 9, lineHeight: 14, fontWeight: '600' },
  dietaryNotes: { color: palette.secondary, fontSize: 10, lineHeight: 16 },
  noteCard: { borderLeftWidth: 3, borderLeftColor: palette.primaryContainer, borderRadius: 8, backgroundColor: palette.primarySoft, padding: 12, marginTop: 13 },
  noteHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle: { color: palette.primaryContainer, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  noteBody: { color: palette.text, fontSize: 10, lineHeight: 16, marginTop: 6 },
  instructionsSection: { borderRadius: 8, backgroundColor: palette.warningSoft, padding: 12, marginTop: 10 },
  instructionSectionTitle: { color: '#765000', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  instructionItem: { borderTopWidth: 1, borderTopColor: '#EBD8AE', paddingTop: 9, marginTop: 9 },
  instructionTitle: { color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  instructionBody: { color: palette.secondary, fontSize: 10, lineHeight: 16, marginTop: 3 },
  noInstructions: { color: palette.secondary, fontSize: 10, lineHeight: 16, marginTop: 7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  tag: { borderRadius: 10, backgroundColor: '#F3DEB0', paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { color: '#765000', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  actionSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, marginTop: 14 },
  responseInput: { minHeight: 66, borderWidth: 1, borderColor: palette.border, borderRadius: 8, backgroundColor: '#FCFBFB', color: palette.text, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, padding: 10, marginTop: 7 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  secondaryButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D3BFC2', borderRadius: 8, paddingHorizontal: 12 },
  secondaryButtonText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  primaryButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: palette.primaryContainer, paddingHorizontal: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  completionSection: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14, marginTop: 14 },
  completionCopy: { minWidth: 0, flex: 1 },
  completionTitle: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  completionText: { color: palette.secondary, fontSize: 9, lineHeight: 14, marginTop: 2 },
  finishButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, backgroundColor: palette.success, paddingHorizontal: 12 },
  finishButtonText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  closedNotice: { flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 13, marginTop: 13 },
  closedNoticeText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 10, lineHeight: 15 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
})
