import { Text } from '../components/AppText'
import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
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
  onMessageProvider?: () => void
  onRescheduleBooking?: (value: {
    date: string
    time: string
  }) => Promise<BookingChangeActionResult>
  onSubmitReview?: () => void
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
  price: '$3,200',
  paymentStatus: 'Paid',
}

export const BookingDetailsScreen: React.FC<BookingDetailsScreenProps> = ({
  booking,
  details,
  onBack,
  onCancelBooking,
  onMessageProvider,
  onRescheduleBooking,
  onSubmitReview,
}) => {
  const provider = booking ?? defaultProvider
  const isConfirmed = booking?.status === 'confirmed' || booking?.status === 'completed'
  const isCompleted = booking?.status === 'completed'
  const isCancelled = booking?.status === 'cancelled'
  const bookedServices = booking?.services ?? []
  const [changeMode, setChangeMode] = React.useState<'cancel' | 'options' | 'reschedule'>()
  const [changeError, setChangeError] = React.useState('')
  const [cancelReason, setCancelReason] = React.useState('')
  const [newDate, setNewDate] = React.useState(booking?.date ?? '')
  const [newTime, setNewTime] = React.useState(booking?.requestedTime ?? '')
  const [isSubmittingChange, setIsSubmittingChange] = React.useState(false)
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

  React.useEffect(() => {
    setChangeMode(undefined)
    setChangeError('')
    setCancelReason('')
    setNewDate(booking?.date ?? '')
    setNewTime(booking?.requestedTime ?? '')
  }, [booking?.date, booking?.id, booking?.requestedTime])

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
          {booking?.venue || booking?.location ? (
            <DetailRow
              label="VENUE"
              value={[booking.venue, booking.location].filter(Boolean).join(', ')}
            />
          ) : null}
          <DetailRow label="SERVICES" value={value.coverage} />
          <DetailRow label="PRICE" last price value={value.price} />
        </View>

        {bookedServices.length > 0 ? (
          <View style={styles.servicesSection}>
            <Text style={styles.cardTitle}>Booked Services</Text>
            {bookedServices.map((service) => (
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
                  <Text style={styles.serviceProvider}>{service.providerName}</Text>
                  <Text style={styles.serviceMeta}>
                    {service.category} · PHP {Math.round(service.amount).toLocaleString('en-PH')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.paymentCard}>
          <Text style={styles.paymentLabel}>Payment Status</Text>
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentBadgeText}>{value.paymentStatus}</Text>
          </View>
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
          <Pressable
            accessibilityRole="button"
            onPress={onMessageProvider}
            style={({ pressed }) => [
              styles.messageButton,
              pressed && styles.messageButtonPressed,
            ]}
          >
            <View style={styles.messageIcon}>
              <View style={styles.messageIconTail} />
            </View>
            <Text style={styles.messageButtonText}>Message Provider</Text>
          </Pressable>

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
                    Existing payments are preserved. Any refund must follow the provider's cancellation policy.
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
  serviceCopy: { flex: 1, minWidth: 0 },
  serviceHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  serviceName: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  serviceProvider: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  serviceMeta: { color: palette.burgundy, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 3 },
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
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
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
  messageButton: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.burgundy,
    borderRadius: 12,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  messageButtonPressed: { backgroundColor: '#F8F1F3', transform: [{ scale: 0.98 }] },
  messageIcon: {
    width: 19,
    height: 15,
    borderWidth: 2,
    borderColor: palette.burgundy,
    borderRadius: 5,
  },
  messageIconTail: {
    position: 'absolute',
    bottom: -5,
    left: 3,
    width: 6,
    height: 6,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: palette.burgundy,
    transform: [{ rotate: '-20deg' }],
  },
  messageButtonText: { color: palette.burgundy, fontSize: 18, lineHeight: 28, fontWeight: '700' },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
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
