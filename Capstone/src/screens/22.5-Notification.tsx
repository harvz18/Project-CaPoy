import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type MerchantNotificationCategory =
  | 'booking'
  | 'message'
  | 'payment'
  | 'review'
  | 'system'

export type MerchantNotificationFilter = 'all' | 'unread'

export interface MerchantNotification {
  actionLabel?: string
  category: MerchantNotificationCategory
  createdAt: string
  id: string
  isRead: boolean
  message: string
  title: string
}

export interface MerchantNotificationPreferences {
  bookingRequests: boolean
  marketing: boolean
  messages: boolean
  payments: boolean
  reviews: boolean
}

interface NotificationScreenProps {
  initialFilter?: MerchantNotificationFilter
  initialPreferences?: Partial<MerchantNotificationPreferences>
  notifications?: MerchantNotification[]
  onBack?: () => void
  onFilterChange?: (filter: MerchantNotificationFilter) => void
  onMarkAllRead?: (notificationIds: string[]) => void
  onMarkRead?: (notification: MerchantNotification) => void
  onPreferencesChange?: (preferences: MerchantNotificationPreferences) => void
  onSelectNotification?: (notification: MerchantNotification) => void
}

const defaultNotifications: MerchantNotification[] = [
  {
    actionLabel: 'Review request',
    category: 'booking',
    createdAt: '2026-09-03T09:15:00+08:00',
    id: 'notification-booking-1052',
    isRead: false,
    message: 'Juan Dela Cruz requested Premium Floral Design for September 28.',
    title: 'New booking request',
  },
  {
    actionLabel: 'View payout',
    category: 'payment',
    createdAt: '2026-09-03T08:10:00+08:00',
    id: 'notification-payout-184',
    isRead: true,
    message: 'Your ₱30,000.00 payout to BDO •••• 4821 has been processed.',
    title: 'Payout completed',
  },
  {
    actionLabel: 'Reply',
    category: 'message',
    createdAt: '2026-09-02T16:42:00+08:00',
    id: 'notification-message-229',
    isRead: false,
    message: 'Maria sent a message about the color palette for her upcoming event.',
    title: 'New message from Maria Santos',
  },
  {
    actionLabel: 'Read review',
    category: 'review',
    createdAt: '2026-08-31T14:20:00+08:00',
    id: 'notification-review-128',
    isRead: true,
    message: 'You received a 5-star review for your Intimate Wedding Package.',
    title: 'A client reviewed your service',
  },
  {
    category: 'system',
    createdAt: '2026-08-28T11:00:00+08:00',
    id: 'notification-system-041',
    isRead: true,
    message: 'Your business profile and submitted documents have been approved.',
    title: 'Business verification approved',
  },
]

const defaultPreferences: MerchantNotificationPreferences = {
  bookingRequests: true,
  marketing: false,
  messages: true,
  payments: true,
  reviews: true,
}

const preferenceOptions: Array<{
  description: string
  id: keyof MerchantNotificationPreferences
  label: string
}> = [
  {
    description: 'New requests, confirmations, changes, and cancellations',
    id: 'bookingRequests',
    label: 'Booking updates',
  },
  {
    description: 'New client messages and conversation reminders',
    id: 'messages',
    label: 'Messages',
  },
  {
    description: 'Payments, refunds, earnings, and payout activity',
    id: 'payments',
    label: 'Payments & payouts',
  },
  {
    description: 'New client reviews and performance updates',
    id: 'reviews',
    label: 'Reviews',
  },
  {
    description: 'Product news, tips, and merchant offers',
    id: 'marketing',
    label: 'Tips & promotions',
  },
]

const categoryContent: Record<
  MerchantNotificationCategory,
  { backgroundColor: string; color: string; glyph: string; label: string }
> = {
  booking: {
    backgroundColor: '#F5EDEF',
    color: '#6B1E2E',
    glyph: '\u25A3',
    label: 'Booking',
  },
  message: {
    backgroundColor: '#EAF1F8',
    color: '#3F6389',
    glyph: '\u2709',
    label: 'Message',
  },
  payment: {
    backgroundColor: '#E7F3EB',
    color: '#2F6B46',
    glyph: '\u20B1',
    label: 'Payment',
  },
  review: {
    backgroundColor: '#FFF3D6',
    color: '#8B6117',
    glyph: '\u2605',
    label: 'Review',
  },
  system: {
    backgroundColor: '#EEECEC',
    color: '#5D5F5F',
    glyph: 'i',
    label: 'System',
  },
}

const toLocalDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const getSectionLabel = (createdAt: string) => {
  const date = new Date(createdAt)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (toLocalDateKey(date) === toLocalDateKey(now)) return 'Today'
  if (toLocalDateKey(date) === toLocalDateKey(yesterday)) return 'Yesterday'

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const formatTime = (createdAt: string) =>
  new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(createdAt))

const BackIcon = () => (
  <View style={styles.backIcon}>
    <View style={styles.backIconHead} />
    <View style={styles.backIconShaft} />
  </View>
)

const BellIcon = () => (
  <View style={styles.bellIcon}>
    <View style={styles.bellDome} />
    <View style={styles.bellClapper} />
  </View>
)

export const NotificationScreen: React.FC<NotificationScreenProps> = ({
  initialFilter = 'all',
  initialPreferences,
  notifications = defaultNotifications,
  onBack,
  onFilterChange,
  onMarkAllRead,
  onMarkRead,
  onPreferencesChange,
  onSelectNotification,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 820
  const [filter, setFilter] = React.useState<MerchantNotificationFilter>(initialFilter)
  const [readIds, setReadIds] = React.useState(
    () => new Set(notifications.filter((item) => item.isRead).map((item) => item.id))
  )
  const [preferences, setPreferences] = React.useState<MerchantNotificationPreferences>({
    ...defaultPreferences,
    ...initialPreferences,
  })

  const unreadNotifications = notifications.filter((item) => !readIds.has(item.id))
  const visibleNotifications =
    filter === 'unread' ? unreadNotifications : notifications
  const groupedNotifications = visibleNotifications.reduce<
    Array<{ items: MerchantNotification[]; label: string }>
  >((groups, notification) => {
    const label = getSectionLabel(notification.createdAt)
    const existingGroup = groups.find((group) => group.label === label)
    if (existingGroup) existingGroup.items.push(notification)
    else groups.push({ items: [notification], label })
    return groups
  }, [])

  const selectFilter = (nextFilter: MerchantNotificationFilter) => {
    setFilter(nextFilter)
    onFilterChange?.(nextFilter)
  }

  const selectNotification = (notification: MerchantNotification) => {
    const renderedNotification = { ...notification, isRead: readIds.has(notification.id) }
    if (!readIds.has(notification.id)) {
      setReadIds((current) => new Set(current).add(notification.id))
      onMarkRead?.({ ...notification, isRead: true })
    }
    onSelectNotification?.(renderedNotification)
  }

  const markAllRead = () => {
    const unreadIds = unreadNotifications.map((notification) => notification.id)
    if (!unreadIds.length) return
    setReadIds(new Set(notifications.map((notification) => notification.id)))
    onMarkAllRead?.(unreadIds)
  }

  const togglePreference = (id: keyof MerchantNotificationPreferences) => {
    const nextPreferences = { ...preferences, [id]: !preferences[id] }
    setPreferences(nextPreferences)
    onPreferencesChange?.(nextPreferences)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.wideHorizontalPadding]}>
          <Pressable
            accessibilityLabel="Back to merchant profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressedSurface]}
          >
            <BackIcon />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            Notifications
          </Text>
          <Pressable
            accessibilityLabel="Mark all notifications as read"
            accessibilityRole="button"
            disabled={!unreadNotifications.length}
            hitSlop={8}
            onPress={markAllRead}
            style={({ pressed }) => [
              styles.headerAction,
              !unreadNotifications.length && styles.headerActionDisabled,
              pressed && styles.pressedSurface,
            ]}
          >
            <Text style={styles.headerActionText}>Read all</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.contentWide : styles.contentMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <BellIcon />
            {unreadNotifications.length ? <View style={styles.unreadDot} /> : null}
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Stay up to date</Text>
            <Text style={styles.subtitle}>
              Booking requests, client messages, payments, and account activity appear here.
            </Text>
          </View>
          {unreadNotifications.length ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadNotifications.length} UNREAD
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.dashboard, isWide && styles.dashboardWide]}>
          <View style={[styles.feedColumn, isWide && styles.feedColumnWide]}>
            <View style={styles.filterBar}>
              {(['all', 'unread'] as MerchantNotificationFilter[]).map((option) => {
                const selected = filter === option
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectFilter(option)}
                    style={({ pressed }) => [
                      styles.filterButton,
                      selected && styles.filterButtonSelected,
                      pressed && styles.filterButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        selected && styles.filterButtonTextSelected,
                      ]}
                    >
                      {option === 'all' ? `All (${notifications.length})` : `Unread (${unreadNotifications.length})`}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {groupedNotifications.length ? (
              <View style={styles.notificationGroups}>
                {groupedNotifications.map((group) => (
                  <View key={group.label} style={styles.notificationGroup}>
                    <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
                    <View style={styles.notificationCard}>
                      {group.items.map((notification, index) => (
                        <NotificationRow
                          isRead={readIds.has(notification.id)}
                          key={notification.id}
                          last={index === group.items.length - 1}
                          notification={notification}
                          onPress={selectNotification}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <BellIcon />
                </View>
                <Text style={styles.emptyTitle}>
                  {filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {filter === 'unread'
                    ? 'There are no unread notifications right now.'
                    : 'New merchant activity will appear here.'}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.preferenceCard, isWide && styles.preferenceCardWide]}>
            <View style={styles.preferenceHeader}>
              <Text style={styles.sectionTitle}>Notification preferences</Text>
              <Text style={styles.sectionSubtitle}>Choose which updates you receive</Text>
            </View>
            <View style={styles.preferenceList}>
              {preferenceOptions.map((option, index) => (
                <PreferenceRow
                  enabled={preferences[option.id]}
                  key={option.id}
                  last={index === preferenceOptions.length - 1}
                  onToggle={() => togglePreference(option.id)}
                  {...option}
                />
              ))}
            </View>
            <View style={styles.preferenceNotice}>
              <Text style={styles.preferenceNoticeText}>
                Critical account and security alerts cannot be turned off.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const NotificationRow = ({
  isRead,
  last,
  notification,
  onPress,
}: {
  isRead: boolean
  last: boolean
  notification: MerchantNotification
  onPress: (notification: MerchantNotification) => void
}) => {
  const category = categoryContent[notification.category]

  return (
    <Pressable
      accessibilityLabel={`${isRead ? '' : 'Unread. '}${notification.title}. ${notification.message}`}
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.notificationRow,
        !isRead && styles.notificationRowUnread,
        !last && styles.notificationRowBorder,
        pressed && styles.notificationRowPressed,
      ]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: category.backgroundColor }]}>
        <Text style={[styles.categoryGlyph, { color: category.color }]}>{category.glyph}</Text>
      </View>
      <View style={styles.notificationCopy}>
        <View style={styles.notificationTitleRow}>
          <Text numberOfLines={2} style={styles.notificationTitle}>
            {notification.title}
          </Text>
          {!isRead ? <View style={styles.rowUnreadDot} /> : null}
        </View>
        <Text numberOfLines={3} style={styles.notificationMessage}>
          {notification.message}
        </Text>
        <View style={styles.notificationMeta}>
          <Text style={[styles.categoryLabel, { color: category.color }]}>{category.label}</Text>
          <Text style={styles.metaDivider}>·</Text>
          <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
          {notification.actionLabel ? (
            <>
              <Text style={styles.metaDivider}>·</Text>
              <Text style={styles.actionLabel}>{notification.actionLabel}</Text>
            </>
          ) : null}
        </View>
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </Pressable>
  )
}

const PreferenceRow = ({
  description,
  enabled,
  label,
  last,
  onToggle,
}: {
  description: string
  enabled: boolean
  label: string
  last: boolean
  onToggle: () => void
}) => (
  <View style={[styles.preferenceRow, !last && styles.preferenceRowBorder]}>
    <View style={styles.preferenceCopy}>
      <Text style={styles.preferenceLabel}>{label}</Text>
      <Text style={styles.preferenceDescription}>{description}</Text>
    </View>
    <Pressable
      accessibilityLabel={`${label} notifications are ${enabled ? 'on' : 'off'}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => pressed && styles.switchPressed}
    >
      <View style={[styles.switchTrack, enabled && styles.switchTrackActive]}>
        <View style={[styles.switchThumb, enabled && styles.switchThumbActive]} />
      </View>
    </Pressable>
  </View>
)

const palette = {
  background: '#FAF9F9',
  border: '#E3E2E2',
  muted: '#777879',
  onPrimary: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primarySoft: '#F5EDEF',
  secondary: '#5D5F5F',
  surfaceContainerLow: '#F5F3F3',
  text: '#1B1C1C',
  white: '#FFFFFF',
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
    maxWidth: 940,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  wideHorizontalPadding: { paddingHorizontal: 32 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  pressedSurface: { backgroundColor: palette.surfaceContainerLow, opacity: 0.74 },
  backIcon: { width: 24, height: 24, justifyContent: 'center' },
  backIconHead: { position: 'absolute', left: 4, width: 10, height: 10, borderBottomWidth: 1.8, borderLeftWidth: 1.8, borderColor: palette.primary, transform: [{ rotate: '45deg' }] },
  backIconShaft: { width: 16, height: 1.8, marginLeft: 4, borderRadius: 1, backgroundColor: palette.primary },
  headerTitle: { minWidth: 0, flex: 1, color: palette.primary, fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  headerAction: { minWidth: 58, minHeight: 40, alignItems: 'flex-end', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 4 },
  headerActionDisabled: { opacity: 0.42 },
  headerActionText: { color: palette.primaryContainer, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center' },
  contentMobile: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  contentWide: { paddingHorizontal: 32, paddingTop: 30, paddingBottom: 56 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 },
  introIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: palette.primarySoft },
  bellIcon: { width: 20, height: 22, alignItems: 'center' },
  bellDome: { width: 16, height: 17, borderWidth: 1.6, borderColor: palette.primaryContainer, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  bellClapper: { position: 'absolute', width: 6, height: 2, bottom: 1, borderRadius: 1, backgroundColor: palette.primaryContainer },
  unreadDot: { position: 'absolute', width: 9, height: 9, top: 7, right: 7, borderWidth: 2, borderColor: palette.primarySoft, borderRadius: 5, backgroundColor: palette.primaryContainer },
  introCopy: { minWidth: 0, flex: 1 },
  title: { color: palette.text, fontSize: 21, lineHeight: 27, fontWeight: '700' },
  subtitle: { maxWidth: 570, color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 3 },
  unreadBadge: { borderRadius: 999, backgroundColor: palette.primarySoft, paddingHorizontal: 9, paddingVertical: 5 },
  unreadBadgeText: { color: palette.primaryContainer, fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 0.45 },
  dashboard: { gap: 16 },
  dashboardWide: { flexDirection: 'row', alignItems: 'flex-start' },
  feedColumn: { gap: 15 },
  feedColumnWide: { minWidth: 0, flex: 1 },
  filterBar: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', borderRadius: 9, backgroundColor: palette.surfaceContainerLow, padding: 4 },
  filterButton: { minWidth: 92, alignItems: 'center', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  filterButtonSelected: { backgroundColor: palette.white },
  filterButtonPressed: { opacity: 0.65 },
  filterButtonText: { color: palette.secondary, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  filterButtonTextSelected: { color: palette.primaryContainer },
  notificationGroups: { gap: 17 },
  notificationGroup: { gap: 7 },
  groupLabel: { color: palette.muted, fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 0.75, marginLeft: 2 },
  notificationCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white },
  notificationRow: { minHeight: 94, flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 14 },
  notificationRowUnread: { backgroundColor: '#FCF8F9' },
  notificationRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  notificationRowPressed: { opacity: 0.68 },
  categoryIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  categoryGlyph: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  notificationCopy: { minWidth: 0, flex: 1 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  notificationTitle: { minWidth: 0, flex: 1, color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  rowUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.primaryContainer, marginTop: 5 },
  notificationMessage: { color: palette.secondary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  notificationMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  categoryLabel: { fontSize: 8, lineHeight: 12, fontWeight: '700' },
  metaDivider: { color: palette.muted, fontSize: 8, lineHeight: 12 },
  notificationTime: { color: palette.muted, fontSize: 8, lineHeight: 12 },
  actionLabel: { color: palette.primaryContainer, fontSize: 8, lineHeight: 12, fontWeight: '700' },
  chevron: { color: palette.secondary, fontSize: 23, lineHeight: 25, marginTop: 4 },
  emptyState: { minHeight: 280, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white, padding: 24 },
  emptyIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: palette.surfaceContainerLow, marginBottom: 12 },
  emptyTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: palette.secondary, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 3 },
  preferenceCard: { overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.white },
  preferenceCardWide: { width: 292 },
  preferenceHeader: { borderBottomWidth: 1, borderBottomColor: palette.border, padding: 15 },
  sectionTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  sectionSubtitle: { color: palette.secondary, fontSize: 9, lineHeight: 14, marginTop: 2 },
  preferenceList: { paddingHorizontal: 15 },
  preferenceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  preferenceRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  preferenceCopy: { minWidth: 0, flex: 1 },
  preferenceLabel: { color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  preferenceDescription: { color: palette.muted, fontSize: 8, lineHeight: 13, marginTop: 2 },
  switchTrack: { width: 38, height: 22, justifyContent: 'center', borderRadius: 11, backgroundColor: palette.border, paddingHorizontal: 3 },
  switchTrackActive: { backgroundColor: palette.primaryContainer },
  switchThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.white },
  switchThumbActive: { alignSelf: 'flex-end' },
  switchPressed: { opacity: 0.62 },
  preferenceNotice: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceContainerLow, padding: 12 },
  preferenceNoticeText: { color: palette.secondary, fontSize: 8, lineHeight: 13, textAlign: 'center' },
})
