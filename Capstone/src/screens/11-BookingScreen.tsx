import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { ClientBottomNavigation, ClientMainTab } from '../components/ClientBottomNavigation'

export type BookingStatus = 'all' | 'confirmed' | 'pending' | 'past'
export type BookingTab = ClientMainTab | 'merchants'

export interface BookingItem {
  category: string
  date: string
  id: string
  image: string
  imageLabel: string
  name: string
  status: Exclude<BookingStatus, 'all'>
}

interface BookingScreenProps {
  bookings?: BookingItem[]
  eventName?: string
  onOpenMenu?: () => void
  onOpenProfile?: () => void
  onSelectBooking?: (booking: BookingItem) => void
  onSelectEvent?: () => void
  onSelectTab?: (tab: BookingTab) => void
}

const defaultBookings: BookingItem[] = [
  {
    id: 'bloom',
    name: 'Bloom & Co. Floral Design',
    category: 'Florist',
    date: 'Oct 12, 2024',
    status: 'confirmed',
    imageLabel: 'Burgundy and white wedding flowers',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDNza7Ea4qcTAb2VvQN2HF_5F9MaahHs1-NE41dqQmC59MbqYdGxJ6y9dtFBtsY874amM7g-C_eDNh394waj-7fjl-8uDwACSncBzSg5hfEuoE__b5-8P-L7k8YQd90quOmexFXMqvojz4n0O9JtFY7c_dkxgRnODD-Gzku5pCZTqocu1NeLtwBjDoaz299K8zUiAejxPhN2nNbVeBvi2kmgq5D1jgl1ll1iYHhZK4QuKhx7PN9Mb1NUA',
  },
  {
    id: 'lumina',
    name: 'Lumina Studios',
    category: 'Photography',
    date: 'Oct 12, 2024',
    status: 'pending',
    imageLabel: 'Professional camera and wedding invitations',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDyttZEr4I_yedpP-bfFgmfYBI2PiDE0WFI3PQaXWo6szA6T2C3nfbIz6mxCYBjOgkYC_uI8P82Hyd5ukZsN_HF4PRgQrRHvocZNgETIqYh9xB35uYu7e_37D1QTGTLAZ95-S0kC7zSh8zPA06XeA-KYQkzhwAoLCZQvAzfpcJoFS7don7in4xvy28LR_r2Ni4y237DEMRtt4_jtZQF0O1P8YbVxjbNh7D1P2wQvR8kbel68u4duNwRGA',
  },
  {
    id: 'epicurean',
    name: 'Epicurean Delights',
    category: 'Catering',
    date: 'Oct 12, 2024',
    status: 'confirmed',
    imageLabel: 'Gourmet plated catering dish',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_EIFo0SJ-TT7DgjYnwWHnL5bOdoujXkukfV_lQBTtOhXpDVi6dqvZPUucpsO-YOw6owu98l0Ay0nNP2wxd4yUzRcvp2InPd7q7hNMxKP9EVP742E9QEP8zMqhBBJl7GokMCwCmD1QQeNxxMO6_35iFC4r0_BBllTq-gvdafYrm0Jk3GEgva16m1qkLxKcDvwLI76mtBPJuwCfd3MEnuDRsdDCTC6SJh0UUBwjogXyZsBDjHv9mfe0Xw',
  },
]

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDFKwwMGKf49MfjiaUPbQKbEV8NAm7-Ac8OP_SHq6vcWQCN3Re793zWxivgmVCo6QuLCp-8HNm2S3W_Jbcm_WlaTPpN3nkd1TbURID3kM0AnFd9X4OJgEKc9msJGzYFIL8ktk08fD82kYaDWMjXh9IoyXG1ywt7ZvE7-g9w4pkB-O6wa1DVpBOd3v0EeR1P5T0L2gWhclnG-gntgBi9HLC4WSyJdhGoetVg7jKhT0XK1HGBWLpevDqSXQ'

const filters = [
  { id: 'all' as const, label: 'ALL BOOKINGS', count: 8 },
  { id: 'confirmed' as const, label: 'CONFIRMED', count: 5 },
  { id: 'pending' as const, label: 'PENDING', count: 2 },
  { id: 'past' as const, label: 'PAST', count: 1 },
]

const categoryIcons: Record<string, string> = {
  Catering: '\u2668',
  Florist: '\u273F',
  Photography: '\u25C9',
}

export const BookingScreen: React.FC<BookingScreenProps> = ({
  bookings = defaultBookings,
  eventName = 'Sarah & James Wedding',
  onOpenMenu,
  onOpenProfile,
  onSelectBooking,
  onSelectEvent,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const [activeFilter, setActiveFilter] = React.useState<BookingStatus>('all')
  const visibleBookings = activeFilter === 'all'
    ? bookings
    : bookings.filter((booking) => booking.status === activeFilter)

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Open menu"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenMenu}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
            <View style={styles.menuLine} />
          </Pressable>

          <Text style={[styles.brand, isWide && styles.brandWide]}>MULTIVENT</Text>

          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenProfile}
            style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
          >
            <Image
              accessibilityLabel="User profile photo"
              resizeMode="cover"
              source={{ uri: profileImage }}
              style={styles.profileImage}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && styles.scrollContentWide,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainContent, isWide && styles.wideHorizontalPadding]}>
          <View style={[styles.intro, isWide && styles.introWide]}>
            <View style={styles.introCopy}>
              <Text style={styles.pageTitle}>My Bookings</Text>
              <Text style={styles.pageDescription}>Manage your service provider reservations</Text>
            </View>

            <Pressable
              accessibilityLabel={`Select event. Current event: ${eventName}`}
              accessibilityRole="button"
              onPress={onSelectEvent}
              style={({ pressed }) => [
                styles.eventSelector,
                isWide && styles.eventSelectorWide,
                pressed && styles.selectorPressed,
              ]}
            >
              <Text style={styles.eventIcon}>{'\u2726'}</Text>
              <Text numberOfLines={1} style={styles.eventName}>
                {eventName}
              </Text>
              <Text style={styles.dropdownIcon}>{'\u2304'}</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.filterTabs}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
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
                    active && styles.filterTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {filter.label} ({filter.count})
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

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
                  <Image
                    accessibilityLabel={booking.imageLabel}
                    resizeMode="cover"
                    source={{ uri: booking.image }}
                    style={styles.thumbnail}
                  />

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
                              : booking.status === 'pending'
                                ? styles.pendingDot
                                : styles.pastDot,
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
                          {booking.category}
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
                <Text style={styles.emptyTitle}>No {activeFilter} bookings</Text>
                <Text style={styles.emptyDescription}>
                  Reservations with this status will appear here.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {!isWide && (
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
  pill: '#FFD9DC',
  surface: '#FFFFFF',
  text: '#1A1C1C',
  textVariant: '#544244',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topAppBar: {
    zIndex: 40,
    backgroundColor: palette.background,
    shadowColor: palette.burgundy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 4,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 64 },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  menuLine: { width: 22, height: 2, borderRadius: 1, backgroundColor: palette.burgundyDark },
  brand: {
    color: palette.burgundyDark,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  brandWide: { fontSize: 40, lineHeight: 48 },
  profileButton: {
    width: 40,
    height: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    backgroundColor: palette.surface,
  },
  profileImage: { width: '100%', height: '100%' },
  scrollContent: { flexGrow: 1, paddingBottom: 96 },
  scrollContentWide: { paddingBottom: 40 },
  mainContent: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  intro: { gap: 16, marginBottom: 32 },
  introWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  introCopy: { flexShrink: 1 },
  pageTitle: { color: palette.burgundyDark, fontSize: 24, lineHeight: 32, fontWeight: '600' },
  pageDescription: { color: palette.muted, fontSize: 16, lineHeight: 26, marginTop: 4 },
  eventSelector: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eventSelectorWide: { width: 256 },
  selectorPressed: { borderColor: palette.burgundy },
  eventIcon: { color: palette.muted, fontSize: 20, lineHeight: 22 },
  eventName: { flex: 1, color: palette.text, fontSize: 16, lineHeight: 24 },
  dropdownIcon: { color: palette.muted, fontSize: 22, lineHeight: 24 },
  filterScroll: { width: '100%', borderBottomWidth: 1, borderBottomColor: palette.border },
  filterTabs: { gap: 24 },
  filterTab: { borderBottomWidth: 2, borderBottomColor: 'transparent', padding: 4, paddingBottom: 12 },
  filterTabActive: { borderBottomColor: palette.burgundy },
  filterText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  filterTextActive: { color: palette.burgundy },
  bookingList: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.surface,
    marginTop: 24,
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
  pastDot: { backgroundColor: palette.muted },
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
