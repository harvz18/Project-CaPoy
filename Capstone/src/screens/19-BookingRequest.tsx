import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type BookingRequestStatus = 'new' | 'confirmed' | 'completed' | 'cancelled'
export type BookingRequestNavigationTab = 'events' | 'bookings' | 'budget' | 'chat'

export interface MerchantBookingRequest {
  amount: number
  clientName: string
  currency: 'PHP'
  eventDate: string
  id: string
  packageName: string
  status: BookingRequestStatus
}

interface BookingRequestScreenProps {
  initialStatus?: BookingRequestStatus
  onAccept?: (request: MerchantBookingRequest) => void
  onBack?: () => void
  onDecline?: (request: MerchantBookingRequest) => void
  onSelectNavigationTab?: (tab: BookingRequestNavigationTab) => void
  onSelectRequest?: (request: MerchantBookingRequest) => void
  onStatusChange?: (status: BookingRequestStatus) => void
  processingRequestId?: string
  requests?: MerchantBookingRequest[]
}

const defaultRequests: MerchantBookingRequest[] = [
  {
    amount: 3500,
    clientName: 'Eleanor Vance',
    currency: 'PHP',
    eventDate: '2026-10-12',
    id: 'eleanor-vance',
    packageName: 'Premium Photography Package',
    status: 'new',
  },
  {
    amount: 1800,
    clientName: 'Theodora Crain',
    currency: 'PHP',
    eventDate: '2026-11-05',
    id: 'theodora-crain',
    packageName: 'Standard Videography',
    status: 'new',
  },
  {
    amount: 5200,
    clientName: 'Luke Crain',
    currency: 'PHP',
    eventDate: '2026-12-20',
    id: 'luke-crain',
    packageName: 'Deluxe Combo Package',
    status: 'new',
  },
]

const filters: Array<{ id: BookingRequestStatus; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const navigationTabs: Array<{
  id: BookingRequestNavigationTab
  label: string
}> = [
  { id: 'events', label: 'Events' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'budget', label: 'Budget' },
  { id: 'chat', label: 'Chat' },
]

const statusLabels: Record<BookingRequestStatus, string> = {
  new: 'New request',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

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

export const BookingRequestScreen: React.FC<BookingRequestScreenProps> = ({
  initialStatus = 'new',
  onAccept,
  onBack,
  onDecline,
  onSelectNavigationTab,
  onSelectRequest,
  onStatusChange,
  processingRequestId,
  requests = defaultRequests,
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

  const updateRequestStatus = (
    request: MerchantBookingRequest,
    status: Extract<BookingRequestStatus, 'confirmed' | 'cancelled'>
  ) => {
    setRequestItems((current) =>
      current.map((item) => (item.id === request.id ? { ...item, status } : item))
    )

    if (status === 'confirmed') onAccept?.({ ...request, status })
    if (status === 'cancelled') onDecline?.({ ...request, status })
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.brand}>MULTIVENT</Text>
          <View style={styles.topBarSpacer} />
        </View>
      </View>

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
              const isProcessing = processingRequestId === request.id

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={[styles.requestTopRow, isCompact && styles.requestTopRowCompact]}>
                    <Pressable
                      accessibilityLabel={`View request from ${request.clientName}`}
                      accessibilityRole="button"
                      onPress={() => onSelectRequest?.(request)}
                      style={({ pressed }) => [
                        styles.requestSummary,
                        pressed && styles.requestSummaryPressed,
                      ]}
                    >
                      <View style={styles.namePriceRow}>
                        <Text numberOfLines={1} style={styles.clientName}>
                          {request.clientName}
                        </Text>
                        <Text style={styles.price}>{formatPrice(request)}</Text>
                      </View>
                      <Text numberOfLines={2} style={styles.requestMeta}>
                        {formatDate(request.eventDate)} {'\u2022'} {request.packageName}
                      </Text>
                    </Pressable>

                    {request.status === 'new' ? (
                      <View style={[styles.requestActions, isCompact && styles.requestActionsCompact]}>
                        <Pressable
                          accessibilityLabel={`Decline booking request from ${request.clientName}`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: isProcessing }}
                          disabled={isProcessing}
                          onPress={() => updateRequestStatus(request, 'cancelled')}
                          style={({ pressed }) => [
                            styles.declineButton,
                            isProcessing && styles.buttonDisabled,
                            pressed && styles.declineButtonPressed,
                          ]}
                        >
                          <Text style={styles.declineButtonText}>Decline</Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Accept booking request from ${request.clientName}`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: isProcessing }}
                          disabled={isProcessing}
                          onPress={() => updateRequestStatus(request, 'confirmed')}
                          style={({ pressed }) => [
                            styles.acceptButton,
                            isProcessing && styles.buttonDisabled,
                            pressed && styles.acceptButtonPressed,
                          ]}
                        >
                          <Text style={styles.acceptButtonText}>
                            {isProcessing ? 'Updating' : 'Accept'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.statusBadge,
                          request.status === 'confirmed' && styles.statusBadgeConfirmed,
                          request.status === 'completed' && styles.statusBadgeCompleted,
                          request.status === 'cancelled' && styles.statusBadgeCancelled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            request.status === 'confirmed' && styles.statusTextConfirmed,
                            request.status === 'completed' && styles.statusTextCompleted,
                            request.status === 'cancelled' && styles.statusTextCancelled,
                          ]}
                        >
                          {statusLabels[request.status]}
                        </Text>
                      </View>
                    )}
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

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          <View style={styles.bottomNavigationContent}>
            {navigationTabs.map((tab) => {
              const selected = tab.id === 'bookings'
              const color = selected ? palette.primary : palette.secondary

              return (
                <Pressable
                  key={tab.id}
                  accessibilityLabel={`Open ${tab.label}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => onSelectNavigationTab?.(tab.id)}
                  style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                >
                  <BookingNavigationIcon color={color} name={tab.id} />
                  <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>
                    {tab.label.toUpperCase()}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const BookingNavigationIcon = ({
  color,
  name,
}: {
  color: string
  name: BookingRequestNavigationTab
}) => {
  if (name === 'events') {
    return (
      <View style={[styles.navIconCanvas, styles.calendarIcon, { borderColor: color }]}>
        <View style={[styles.calendarRule, { backgroundColor: color }]} />
        <View style={styles.calendarDots}>
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  if (name === 'bookings') {
    return (
      <View style={[styles.navIconCanvas, styles.bookingIcon, { borderColor: color }]}>
        <View style={[styles.bookingIconLine, { backgroundColor: color }]} />
        <View style={[styles.bookingIconLine, styles.bookingIconLineShort, { backgroundColor: color }]} />
      </View>
    )
  }

  if (name === 'budget') {
    return (
      <View style={[styles.navIconCanvas, styles.walletIcon, { borderColor: color }]}>
        <View style={[styles.walletClasp, { borderColor: color }]} />
      </View>
    )
  }

  return (
    <View style={[styles.navIconCanvas, styles.chatIcon, { borderColor: color }]}>
      <View style={[styles.chatTail, { borderColor: color }]} />
    </View>
  )
}

const palette = {
  background: '#FAF9F9',
  border: '#DAC0C2',
  completed: '#145133',
  completedSoft: '#E7F3EB',
  error: '#93000A',
  errorSoft: '#FFDAD6',
  onPrimary: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
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
  contentMobile: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 104 },
  contentWide: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 48 },
  title: { color: palette.text, fontSize: 22, lineHeight: 28, fontWeight: '700', marginBottom: 24 },
  filterScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#E3E2E2', marginBottom: 24 },
  filterTabs: { gap: 24 },
  filterTab: {
    minHeight: 40,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingBottom: 8,
  },
  filterTabSelected: { borderBottomColor: palette.primaryContainer },
  filterTabPressed: { opacity: 0.6 },
  filterLabel: { color: palette.secondary, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  filterLabelSelected: { color: palette.primaryContainer },
  requestList: { gap: 12 },
  requestCard: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.background,
    padding: 12,
  },
  requestTopRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  requestTopRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  requestSummary: { minWidth: 0, flex: 1, borderRadius: 6, paddingVertical: 2 },
  requestSummaryPressed: { opacity: 0.6 },
  namePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientName: { minWidth: 0, flexShrink: 1, color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  price: { color: palette.primaryContainer, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  requestMeta: { color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
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
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeConfirmed: { backgroundColor: palette.primarySoft },
  statusBadgeCompleted: { backgroundColor: palette.completedSoft },
  statusBadgeCancelled: { backgroundColor: palette.errorSoft },
  statusBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  statusTextConfirmed: { color: palette.primaryContainer },
  statusTextCompleted: { color: palette.completed },
  statusTextCancelled: { color: palette.error },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E3E2E2',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
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
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    minHeight: 72,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingVertical: 7,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  navItem: { width: 72, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navItemPressed: { opacity: 0.55, transform: [{ scale: 0.92 }] },
  navLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  navLabelSelected: { color: palette.primary, fontWeight: '700' },
  navIconCanvas: { width: 22, height: 21 },
  calendarIcon: { overflow: 'hidden', borderWidth: 1.6, borderRadius: 3 },
  calendarRule: { width: '100%', height: 1.5, marginTop: 5 },
  calendarDots: { flexDirection: 'row', gap: 4, marginTop: 4, marginLeft: 4 },
  calendarDot: { width: 3, height: 3, borderRadius: 1 },
  bookingIcon: { justifyContent: 'center', gap: 4, borderWidth: 1.6, borderRadius: 3, paddingHorizontal: 4 },
  bookingIconLine: { width: '100%', height: 1.5, borderRadius: 1 },
  bookingIconLineShort: { width: '65%' },
  walletIcon: { borderWidth: 1.6, borderRadius: 4 },
  walletClasp: { position: 'absolute', right: -2, top: 6, width: 9, height: 8, borderWidth: 1.4, borderRadius: 2 },
  chatIcon: { borderWidth: 1.6, borderRadius: 5 },
  chatTail: {
    position: 'absolute',
    bottom: -4,
    left: 3,
    width: 7,
    height: 7,
    borderLeftWidth: 1.6,
    borderBottomWidth: 1.6,
    transform: [{ skewY: '-35deg' }],
    backgroundColor: palette.background,
  },
})
