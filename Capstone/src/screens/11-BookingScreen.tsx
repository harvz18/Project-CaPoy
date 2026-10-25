import { Text } from '../components/AppText'
import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { ClientBottomNavigation, ClientMainTab } from '../components/ClientBottomNavigation'
import type { CateringFoodTasting } from '../lib/merchant'
import type { VenueBookingConfiguration } from '../lib/venue-booking'

export type BookingStatus = 'all' | 'confirmed' | 'requested' | 'completed' | 'cancelled'
export type BookingTab = ClientMainTab | 'merchants'

export interface BookingServiceItem {
  amount: number
  bookingId: string
  category: string
  clientNotes?: string
  completionPaymentStatus?: 'awaiting_external_payment' | 'partially_confirmed' | 'fully_confirmed'
  confirmedExternalPaymentAmount?: number
  foodTasting?: CateringFoodTasting
  foodTastingEnabled?: boolean
  image: string
  initialProviderShare?: number
  initialPaymentRecordedAt?: string
  paymentStatus: string
  providerId: string
  providerName: string
  rawStatus: string
  replacementAvailable?: boolean
  remainingServiceBalance?: number
  serviceAmount?: number
  serviceId: string
  serviceName: string
  status: 'confirmed' | 'declined' | 'requested' | 'completed' | 'cancelled'
  updatedAt: string
  venueBooking?: VenueBookingConfiguration
}

export interface BookingItem {
  amount?: number
  category: string
  createdAt?: string
  coordinatorAvatarUrl?: string
  coordinatorFeeAmount?: number
  coordinatorName?: string
  coordinatorUserId?: string
  coordinatorAssignmentStatus?: string
  coordinatorRequired?: boolean
  churchArrangement?: {
    activeProposalId?: string
    arrangementStatus: string
    ceremonyDate?: string
    ceremonyTime?: string
    churchAddress?: string
    churchContact?: string
    churchLatitude?: number
    churchLongitude?: number
    churchName?: string
    clientRespondedAt?: string
    clientResponseReason?: string
    clientResponseStatus?: 'not_requested' | 'pending' | 'approved' | 'declined'
    confirmationMethod?: 'external_discussion' | 'multivent' | 'other'
    confirmationNotes?: string
    coordinatorConfirmedAt?: string
    coordinatorConfirmedBy?: string
    notes?: string
    preferredChurch?: string
    proposalVersion?: number
    updatedAt?: string
  }
  date: string
  eventId?: string
  isChurchWedding?: boolean
  hasFeedback?: boolean
  eventType?: string
  guestCount?: number
  id: string
  image: string
  imageLabel: string
  location?: string
  name: string
  paymentStatus?: string
  paymentState?: 'not_initiated' | 'payment_initiated' | 'paid_or_verified' | 'payment_failed_or_cancelled'
  rawStatus?: string
  requestedTime?: string
  status: Exclude<BookingStatus, 'all'>
  services?: BookingServiceItem[]
  updatedAt?: string
  venue?: string
  venueBooking?: VenueBookingConfiguration
}

interface BookingScreenProps {
  bookings?: BookingItem[]
  showBottomNavigation?: boolean
  onOpenMenu?: () => void
  onOpenProfile?: () => void
  onSelectBooking?: (booking: BookingItem) => void
  onSelectTab?: (tab: BookingTab) => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
}

const filterOptions = [
  { id: 'all' as const, label: 'ALL' },
  { id: 'requested' as const, label: 'REQUESTED' },
  { id: 'confirmed' as const, label: 'CONFIRMED' },
  { id: 'completed' as const, label: 'COMPLETED' },
  { id: 'cancelled' as const, label: 'CANCELLED' },
]

const categoryIcons: Record<string, string> = {
  Catering: '\u2668',
  Florist: '\u273F',
  Photography: '\u25C9',
}

export const BookingScreen: React.FC<BookingScreenProps> = ({
  bookings = [],
  showBottomNavigation = true,
  onOpenMenu,
  onSelectBooking,
  onSelectTab,
  onScrollDirectionChange,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [activeFilter, setActiveFilter] = React.useState<BookingStatus>('all')
  const lastScrollY = React.useRef(0)
  const visibleBookings = activeFilter === 'all'
    ? bookings
    : bookings.filter((booking) => booking.status === activeFilter)
  const filters = filterOptions

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to home"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenMenu}
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          >
            <Text style={styles.backIcon}>{'\u2039'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>MY BOOKINGS</Text>
          <View style={styles.headerButton} />
        </View>
      </View>

      <View style={styles.filterTabs}>
        <View style={[styles.filterTabsContent, isWide && styles.wideHorizontalPadding]}>
          {filters.map((filter) => {
            const active = activeFilter === filter.id
            return (
              <Pressable
                key={filter.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveFilter(filter.id)}
                style={({ pressed }) => [
                  styles.filterTab,
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter.label}
                </Text>
                {active ? <View style={styles.filterTabIndicator} /> : null}
              </Pressable>
            )
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
        ]}
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current
          if (Math.abs(delta) < 8) return
          lastScrollY.current = scrollY
          onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainContent, isWide && styles.wideHorizontalPadding]}>
          <View style={styles.bookingList}>
            {visibleBookings.length > 0 ? (
              visibleBookings.map((booking, index) => (
                <Pressable
                  key={booking.id}
                  accessibilityLabel={`${booking.name}, ${booking.status}, ${booking.date}`}
                  accessibilityRole="button"
                  onPress={() => onSelectBooking?.(booking)}
                  style={({ pressed }) => [
                    styles.bookingRow,
                    index < visibleBookings.length - 1 && styles.bookingRowBorder,
                    pressed && styles.bookingRowPressed,
                  ]}
                >
                  {booking.image ? (
                    <Image
                      accessibilityLabel={booking.imageLabel}
                      resizeMode="cover"
                      source={{ uri: booking.image }}
                      style={styles.thumbnail}
                    />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                      <Text style={styles.thumbnailPlaceholderText}>
                        {booking.name.charAt(0)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.bookingCopy}>
                    <View style={styles.bookingHeading}>
                      <Text numberOfLines={1} style={styles.bookingName}>
                        {booking.name}
                      </Text>
                      <View style={styles.statusBadge}>
                        <View
                          style={[
                            styles.statusDot,
                            booking.status === 'confirmed'
                              ? styles.confirmedDot
                              : booking.status === 'requested'
                                ? styles.pendingDot
                                : booking.status === 'cancelled'
                                  ? styles.cancelledDot
                                  : styles.completedDot,
                          ]}
                        />
                        <Text style={styles.statusText}>{booking.status.toUpperCase()}</Text>
                      </View>
                    </View>

                    <View style={[styles.bookingDetails, isWide && styles.bookingDetailsWide]}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>
                          {categoryIcons[booking.category] ?? '\u25A1'}
                        </Text>
                        <Text numberOfLines={1} style={styles.detailText}>
                          {booking.services?.length
                            ? `${booking.services.length} service${booking.services.length === 1 ? '' : 's'}`
                            : booking.category}
                        </Text>
                      </View>
                      {isWide && <Text style={styles.detailDivider}>{'\u2022'}</Text>}
                      <View style={styles.detailItem}>
                        <Text style={styles.detailIcon}>{'\u25A6'}</Text>
                        <Text numberOfLines={1} style={styles.detailText}>
                          {booking.date}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isWide && <Text style={styles.moreIcon}>{'\u22EE'}</Text>}
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>{'\u25A6'}</Text>
                <Text style={styles.emptyTitle}>
                  {activeFilter === 'all' ? 'No event bookings yet' : `No ${activeFilter} events`}
                </Text>
                <Text style={styles.emptyDescription}>
                  Reservations with this status will appear here.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {showBottomNavigation && !isWide && (
        <ClientBottomNavigation activeTab="bookings" onSelectTab={onSelectTab} />
      )}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E2E2E2',
  burgundy: '#6B1E2E',
  burgundyDark: '#4E061A',
  green: '#4CAF50',
  muted: '#5E5E5E',
  orange: '#FF9800',
  error: '#B3261E',
  pill: '#FFD9DC',
  surface: '#FFFFFF',
  text: '#1A1C1C',
  textVariant: '#544244',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: palette.burgundyDark,
    backgroundColor: palette.burgundy,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  wideHorizontalPadding: { paddingHorizontal: 64 },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerButtonPressed: { backgroundColor: 'rgba(255,255,255,0.14)', opacity: 0.82 },
  backIcon: { color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  scrollContent: { flexGrow: 1, paddingBottom: 96 },
  scrollContentWide: { paddingBottom: 40 },
  mainContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterTabs: { zIndex: 30, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  filterTabsContent: { width: '100%', maxWidth: 1200, minHeight: 48, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 8 },
  filterTab: { minWidth: 0, minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  filterTabIndicator: { position: 'absolute', right: 3, bottom: 0, left: 3, height: 3, borderRadius: 2, backgroundColor: palette.burgundy },
  filterText: {
    color: palette.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  filterTextActive: { color: palette.burgundy },
  bookingList: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    marginTop: 0,
  },
  bookingRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
  bookingRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  bookingRowPressed: { backgroundColor: palette.background },
  thumbnail: {
    width: 64,
    height: 64,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  thumbnailPlaceholderText: {
    color: palette.burgundy,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  bookingCopy: { flex: 1, minWidth: 0 },
  bookingHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  bookingName: { flex: 1, color: palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  statusBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    backgroundColor: palette.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  confirmedDot: { backgroundColor: palette.green },
  pendingDot: { backgroundColor: palette.orange },
  cancelledDot: { backgroundColor: palette.error },
  completedDot: { backgroundColor: palette.green },
  statusText: {
    color: palette.textVariant,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bookingDetails: { gap: 2 },
  bookingDetailsWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailIcon: { color: palette.muted, fontSize: 16, lineHeight: 18 },
  detailText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  detailDivider: { color: palette.border, fontSize: 14 },
  moreIcon: { color: palette.muted, fontSize: 25, lineHeight: 27, padding: 8 },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  emptyIcon: { color: palette.muted, fontSize: 30, lineHeight: 34, marginBottom: 10 },
  emptyTitle: { color: palette.text, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  emptyDescription: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 4 },
  bottomNav: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 6,
  },
  bottomNavContent: {
    width: '100%',
    maxWidth: 600,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    width: 68,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  navItemActive: { backgroundColor: palette.pill },
  navIcon: { color: palette.muted, fontSize: 20, lineHeight: 22 },
  navLabel: { color: palette.muted, fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 1 },
  navTextActive: { color: palette.burgundyDark },
  navPressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
  pressed: { opacity: 0.6 },
})
