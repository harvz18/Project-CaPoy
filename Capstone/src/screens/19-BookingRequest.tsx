import { Text } from '../components/AppText'
import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { MerchantBottomNavigation } from '../components/MerchantBottomNavigation'
import { MerchantWorkspaceHeader } from '../components/MerchantWorkspaceHeader'
import type { CateringFoodTasting, CateringFoodTastingWorkflow } from '../lib/merchant'
import type { VenueBookingConfiguration } from '../lib/venue-booking'
import type { PhotoVideoPreEventPlan } from '../lib/photo-video-pre-event'
import type { PhotoVideoEventDayLog } from '../lib/photo-video-event-day'
import type { PhotoVideoDeliverableTracking } from '../lib/photo-video-deliverables'
import type { MerchantHomeTab } from './16-MerchantHome'

export type BookingRequestStatus = 'new' | 'confirmed' | 'completed' | 'cancelled'
export type BookingRequestNavigationTab = 'events' | 'bookings' | 'budget' | 'chat'

export interface ClientInstructionNote {
  body: string
  category: string
  id: string
  tags: string[]
  title: string
}

export interface MerchantBookedService {
  amount: number
  attendeeCount?: number
  budgetPerHead?: number
  cateringMenuItems?: string[]
  cateringOptionName?: string
  clientNotes?: string
  completionPaymentStatus?: 'awaiting_external_payment' | 'partially_confirmed' | 'fully_confirmed'
  confirmedExternalPaymentAmount?: number
  foodTasting?: CateringFoodTasting
  foodTastingEnabled?: boolean
  foodTastingWorkflow?: CateringFoodTastingWorkflow
  floristSelectionSummary?: string[]
  photoVideoSelectionSummary?: string[]
  photoVideoPreEventPlan?: PhotoVideoPreEventPlan
  photoVideoEventDayLog?: PhotoVideoEventDayLog
  photoVideoDeliverableTracking?: PhotoVideoDeliverableTracking
  dietaryNotes?: string
  downpaymentAmount?: number
  id: string
  instructions: ClientInstructionNote[]
  packageDescription?: string
  packageInclusions: string[]
  packageName: string
  paymentStatus?: string
  platformFeePaid?: number
  initialProviderShare?: number
  remainingServiceBalance?: number
  mealType?: 'plated' | 'buffet' | 'packed'
  outsideFood?: boolean
  requestedTime?: string
  serviceCategory?: string
  serviceId?: string
  serviceName: string
  status: BookingRequestStatus
  submittedAt?: string
  venueBookedHours?: number
  venueEndAt?: string
  venueOptionName?: string
  venueBooking?: VenueBookingConfiguration
}

export interface MerchantBookingRequest {
  amount: number
  attendeeCount?: number
  budgetPerHead?: number
  cateringMenuItems?: string[]
  cateringOptionName?: string
  clientEmail?: string
  clientNotes?: string
  completionPaymentStatus?: 'awaiting_external_payment' | 'partially_confirmed' | 'fully_confirmed'
  confirmedExternalPaymentAmount?: number
  foodTasting?: CateringFoodTasting
  foodTastingEnabled?: boolean
  foodTastingWorkflow?: CateringFoodTastingWorkflow
  floristSelectionSummary?: string[]
  photoVideoSelectionSummary?: string[]
  photoVideoPreEventPlan?: PhotoVideoPreEventPlan
  photoVideoEventDayLog?: PhotoVideoEventDayLog
  photoVideoDeliverableTracking?: PhotoVideoDeliverableTracking
  dietaryNotes?: string
  downpaymentAmount?: number
  clientName: string
  currency: 'PHP'
  eventDate: string
  eventId?: string
  eventName?: string
  eventType?: string
  guestCount?: number
  id: string
  instructions?: ClientInstructionNote[]
  location?: string
  packageDescription?: string
  packageInclusions?: string[]
  packageName: string
  paymentStatus?: string
  platformFeePaid?: number
  initialProviderShare?: number
  remainingServiceBalance?: number
  mealType?: 'plated' | 'buffet' | 'packed'
  outsideFood?: boolean
  requestedTime?: string
  serviceCategory?: string
  serviceId?: string
  serviceName?: string
  services?: MerchantBookedService[]
  status: BookingRequestStatus
  submittedAt?: string
  venue?: string
  venueLatitude?: number
  venueLongitude?: number
  venueBookedHours?: number
  venueEndAt?: string
  venueOptionName?: string
  venueBooking?: VenueBookingConfiguration
}

interface BookingRequestScreenProps {
  initialStatus?: BookingRequestStatus
  hasUnreadNotifications?: boolean
  showBottomNavigation?: boolean
  onOpenNotifications?: () => void
  onSelectMerchantTab?: (tab: MerchantHomeTab) => void
  onSelectNavigationTab?: (tab: BookingRequestNavigationTab) => void
  onSelectRequest?: (request: MerchantBookingRequest) => void
  onStatusChange?: (status: BookingRequestStatus) => void
  requests?: MerchantBookingRequest[]
}

const filters: Array<{ id: BookingRequestStatus; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const statusLabels: Record<BookingRequestStatus, string> = {
  new: 'New request',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const formatPrice = (request: MerchantBookingRequest) =>
  new Intl.NumberFormat('en-PH', {
    currency: request.currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(request.amount)

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const completionIsAvailable = (value: string) => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return parsed <= today
}

export const BookingRequestScreen: React.FC<BookingRequestScreenProps> = ({
  initialStatus = 'new',
  hasUnreadNotifications = false,
  showBottomNavigation = true,
  onOpenNotifications,
  onSelectMerchantTab,
  onSelectNavigationTab,
  onSelectRequest,
  onStatusChange,
  requests = [],
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isCompact = width < 430
  const [activeStatus, setActiveStatus] = React.useState(initialStatus)
  const [requestItems, setRequestItems] = React.useState(requests)

  React.useEffect(() => {
    setRequestItems(requests)
  }, [requests])

  const visibleRequests = requestItems.filter((request) => request.status === activeStatus)

  const handleStatusChange = (status: BookingRequestStatus) => {
    setActiveStatus(status)
    onStatusChange?.(status)
  }

  return (
    <View style={styles.screen}>
      <MerchantWorkspaceHeader
        hasUnreadNotifications={hasUnreadNotifications}
        onOpenNotifications={onOpenNotifications}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Booking Requests</Text>

        <ScrollView
          contentContainerStyle={styles.filterTabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {filters.map((filter) => {
            const selected = activeStatus === filter.id

            return (
              <Pressable
                key={filter.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => handleStatusChange(filter.id)}
                style={({ pressed }) => [
                  styles.filterTab,
                  selected && styles.filterTabSelected,
                  pressed && styles.filterTabPressed,
                ]}
              >
                <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                  {filter.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View style={styles.requestList}>
          {visibleRequests.length > 0 ? (
            visibleRequests.map((request) => {
              const serviceCount = request.services?.length ?? 1
              const serviceNames = request.services?.map((service) => service.serviceName) ?? [request.packageName]
              const locationLabel = request.venue || request.location || 'Location to be confirmed'
              const needsCompletion =
                request.status === 'confirmed' && completionIsAvailable(request.eventDate)

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestTopRow}>
                    <Pressable
                      accessibilityLabel={`View ${request.eventName || 'event'} booking details`}
                      accessibilityRole="button"
                      onPress={() => onSelectRequest?.(request)}
                      style={({ pressed }) => [
                        styles.requestSummary,
                        pressed && styles.requestSummaryPressed,
                      ]}
                    >
                      <View style={[styles.namePriceRow, isCompact && styles.namePriceRowCompact]}>
                        <Text style={styles.clientName}>
                          {request.eventName || 'Untitled event'}
                        </Text>
                        <Text style={styles.price}>{formatPrice(request)}</Text>
                      </View>
                      <Text style={styles.requestMeta}>
                        {formatDate(request.eventDate)} {'\u2022'} {serviceCount}{' '}
                        {serviceCount === 1 ? 'service' : 'services'}
                      </Text>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationIcon}>PIN</Text>
                        <Text style={styles.locationText}>{locationLabel}</Text>
                      </View>
                      <Text style={styles.serviceNames}>
                        {serviceNames.join(' \u00B7 ')}
                      </Text>
                    </Pressable>

                  </View>
                  <View style={styles.requestFooter}>
                    <View
                      style={[
                        styles.statusBadge,
                        request.status === 'confirmed' && styles.statusBadgeConfirmed,
                        needsCompletion && styles.statusBadgeAction,
                        request.status === 'completed' && styles.statusBadgeCompleted,
                        request.status === 'cancelled' && styles.statusBadgeCancelled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          request.status === 'confirmed' && styles.statusTextConfirmed,
                          needsCompletion && styles.statusTextAction,
                          request.status === 'completed' && styles.statusTextCompleted,
                          request.status === 'cancelled' && styles.statusTextCancelled,
                        ]}
                      >
                        {needsCompletion ? 'ACTION NEEDED' : statusLabels[request.status]}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`View ${request.eventName || 'event'} booking details`}
                      accessibilityRole="button"
                      onPress={() => onSelectRequest?.(request)}
                      style={({ pressed }) => [styles.viewDetailsButton, pressed && styles.requestSummaryPressed]}
                    >
                      <Text style={styles.viewDetailsText}>View details</Text>
                      <Text style={styles.viewDetailsChevron}>{'>'}</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyCalendarIcon}>
                <View style={styles.emptyCalendarHeader} />
                <View style={styles.emptyCalendarDotRow}>
                  <View style={styles.emptyCalendarDot} />
                  <View style={styles.emptyCalendarDot} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>No {statusLabels[activeStatus].toLowerCase()} bookings</Text>
              <Text style={styles.emptyCopy}>
                Requests in this status will appear here when they are available.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {showBottomNavigation && !isWide ? (
        <MerchantBottomNavigation
          activeTab="bookings"
          onSelectTab={(tab) => {
            onSelectMerchantTab?.(tab)
            if (tab === 'home') onSelectNavigationTab?.('events')
            if (tab === 'bookings') onSelectNavigationTab?.('bookings')
            if (tab === 'messages') onSelectNavigationTab?.('chat')
          }}
        />
      ) : null}
    </View>
  )
}

const palette = {
  background: '#E9EDF0',
  border: 'rgba(255,255,255,0.72)',
  completed: '#145133',
  completedSoft: '#E7F3EB',
  error: '#93000A',
  errorSoft: '#FFDAD6',
  onPrimary: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#E9EDF0',
  surfaceDim: '#DBDAD9',
  text: '#1B1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 30,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  backButtonPressed: { backgroundColor: palette.surfaceContainerLow, opacity: 0.72 },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: {
    position: 'absolute',
    left: 4,
    width: 10,
    height: 10,
    borderBottomWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: palette.primary,
    transform: [{ rotate: '45deg' }],
  },
  backIconShaft: {
    width: 16,
    height: 1.8,
    marginLeft: 4,
    borderRadius: 1,
    backgroundColor: palette.primary,
  },
  brand: {
    minWidth: 0,
    flex: 1,
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  topBarSpacer: { width: 40, height: 40 },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 124 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 48 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700', marginBottom: 16 },
  filterScroll: { flexGrow: 0, marginBottom: 20 },
  filterTabs: { gap: 8, paddingHorizontal: 3, paddingVertical: 8 },
  filterTab: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.background,
    paddingHorizontal: 14,
    boxShadow: '3px 3px 7px rgba(160,171,180,0.38), -3px -3px 7px rgba(255,255,255,0.88)',
  },
  filterTabSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.primaryContainer },
  filterTabPressed: { opacity: 0.6 },
  filterLabel: { color: palette.secondary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  filterLabelSelected: { color: palette.onPrimary },
  requestList: { gap: 12 },
  requestCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.background,
    padding: 15,
    boxShadow: '6px 6px 13px rgba(160,171,180,0.44), -6px -6px 13px rgba(255,255,255,0.9)',
  },
  requestTopRow: { width: '100%' },
  requestTopRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  requestSummary: { minWidth: 0, flex: 1, borderRadius: 6, paddingVertical: 2 },
  requestSummaryPressed: { opacity: 0.6 },
  namePriceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  namePriceRowCompact: { flexDirection: 'column', gap: 3 },
  clientName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  price: { color: palette.primaryContainer, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  requestMeta: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  locationRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  locationIcon: { color: palette.primaryContainer, fontSize: 9, lineHeight: 17, fontWeight: '800', letterSpacing: 0.4 },
  locationText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 17 },
  serviceNames: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  requestFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: '#D6DCE0', marginTop: 13, paddingTop: 11 },
  viewDetailsButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, backgroundColor: palette.background, paddingHorizontal: 11, boxShadow: '3px 3px 7px rgba(160,171,180,0.36), -3px -3px 7px rgba(255,255,255,0.86)' },
  viewDetailsText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  viewDetailsChevron: { color: palette.primaryContainer, fontSize: 16, lineHeight: 18, fontWeight: '800' },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestActionsCompact: { alignSelf: 'flex-end' },
  declineButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  declineButtonPressed: { backgroundColor: palette.surfaceDim },
  declineButtonText: { color: palette.secondary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  acceptButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  acceptButtonPressed: { opacity: 0.85 },
  acceptButtonText: { color: palette.onPrimary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  statusBadge: { borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeConfirmed: { backgroundColor: palette.primarySoft },
  statusBadgeAction: { backgroundColor: '#FFF0D6' },
  statusBadgeCompleted: { backgroundColor: palette.completedSoft },
  statusBadgeCancelled: { backgroundColor: palette.errorSoft },
  statusBadgeText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextAction: { color: '#7A4D00' },
  statusTextCompleted: { color: palette.completed },
  statusTextCancelled: { color: palette.error },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3E2E2',
    borderRadius: 18,
    backgroundColor: palette.background,
    paddingHorizontal: 24,
    paddingVertical: 40,
    boxShadow: '6px 6px 13px rgba(160,171,180,0.4), -6px -6px 13px rgba(255,255,255,0.88)',
  },
  emptyCalendarIcon: {
    width: 38,
    height: 36,
    overflow: 'hidden',
    borderWidth: 1.6,
    borderColor: palette.border,
    borderRadius: 5,
    marginBottom: 14,
  },
  emptyCalendarHeader: { height: 8, borderBottomWidth: 1.6, borderBottomColor: palette.border },
  emptyCalendarDotRow: { flexDirection: 'row', gap: 5, padding: 7 },
  emptyCalendarDot: { width: 5, height: 5, borderRadius: 2, backgroundColor: palette.border },
  emptyTitle: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { maxWidth: 320, color: palette.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
})
