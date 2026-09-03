import React from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

export type MerchantHomeQuickAction = 'newQuote' | 'calendar' | 'clients' | 'invoices'
export type MerchantHomeTab = 'home' | 'services' | 'bookings' | 'messages' | 'profile'

export interface MerchantHomeStats {
  activeEvents: number
  newRequests: number
  pendingAction: number
}

export interface MerchantScheduleItem {
  id: string
  location: string
  time: string
  title: string
  urgent?: boolean
}

interface MerchantHomeScreenProps {
  businessName?: string
  hasUnreadNotifications?: boolean
  scheduleItems?: MerchantScheduleItem[]
  stats?: MerchantHomeStats
  onOpenNotifications?: () => void
  onSelectQuickAction?: (action: MerchantHomeQuickAction) => void
  onSelectScheduleItem?: (item: MerchantScheduleItem) => void
  onSelectTab?: (tab: MerchantHomeTab) => void
  onViewAllSchedule?: () => void
}

type IconName =
  | 'bookings'
  | 'briefcase'
  | 'calendar'
  | 'clients'
  | 'home'
  | 'invoices'
  | 'messages'
  | 'notifications'
  | 'plus'
  | 'profile'
  | 'services'

const defaultStats: MerchantHomeStats = {
  newRequests: 12,
  activeEvents: 5,
  pendingAction: 3,
}

const defaultScheduleItems: MerchantScheduleItem[] = [
  {
    id: 'smith-walkthrough',
    title: 'Venue Walkthrough - Smith Wedding',
    time: '10:00 AM',
    location: 'Grand Ballroom',
    urgent: true,
  },
  {
    id: 'vendor-call',
    title: 'Vendor Finalization Call',
    time: '2:30 PM',
    location: 'Online Meeting',
  },
]

const quickActions = [
  { id: 'newQuote' as const, label: 'New Quote', icon: 'plus' as const },
  { id: 'calendar' as const, label: 'Manage Calendar', icon: 'calendar' as const },
  { id: 'clients' as const, label: 'Client List', icon: 'clients' as const },
  { id: 'invoices' as const, label: 'Invoices', icon: 'invoices' as const },
]

const navigationTabs = [
  { id: 'home' as const, label: 'Home', icon: 'home' as const },
  { id: 'services' as const, label: 'Services', icon: 'services' as const },
  { id: 'bookings' as const, label: 'Bookings', icon: 'bookings' as const },
  { id: 'messages' as const, label: 'Messages', icon: 'messages' as const },
  { id: 'profile' as const, label: 'Profile', icon: 'profile' as const },
]

const DashboardIcon: React.FC<{ color?: string; name: IconName; size?: number }> = ({
  color = palette.secondary,
  name,
  size = 24,
}) => {
  const scale = size / 24
  const canvasStyle = { height: size, width: size }

  if (name === 'briefcase') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View
          style={[
            styles.briefcaseHandle,
            { borderColor: color, transform: [{ scale }] },
          ]}
        />
        <View
          style={[
            styles.briefcaseBody,
            { borderColor: color, transform: [{ scale }] },
          ]}
        >
          <View style={[styles.briefcaseBand, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  if (name === 'notifications') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View
          style={[
            styles.bellBody,
            { borderColor: color, transform: [{ scale }] },
          ]}
        />
        <View style={[styles.bellBase, { backgroundColor: color, transform: [{ scale }] }]} />
      </View>
    )
  }

  if (name === 'plus') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View style={[styles.plusCircle, { borderColor: color, transform: [{ scale }] }]}>
          <View style={[styles.plusHorizontal, { backgroundColor: color }]} />
          <View style={[styles.plusVertical, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  if (name === 'calendar' || name === 'bookings') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View
          style={[
            styles.calendarBody,
            { borderColor: color, transform: [{ scale }] },
          ]}
        >
          <View style={[styles.calendarRule, { backgroundColor: color }]} />
          <View style={styles.calendarDots}>
            <View style={[styles.calendarDot, { backgroundColor: color }]} />
            <View style={[styles.calendarDot, { backgroundColor: color }]} />
          </View>
        </View>
      </View>
    )
  }

  if (name === 'clients') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View style={[styles.personHead, styles.personHeadLeft, { borderColor: color }]} />
        <View style={[styles.personHead, styles.personHeadRight, { borderColor: color }]} />
        <View style={[styles.peopleShoulders, { borderColor: color }]} />
      </View>
    )
  }

  if (name === 'invoices') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View style={[styles.invoiceBody, { borderColor: color, transform: [{ scale }] }]}>
          <View style={[styles.invoiceLine, { backgroundColor: color }]} />
          <View style={[styles.invoiceLine, styles.invoiceLineShort, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  if (name === 'home') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View style={[styles.homeRoof, { borderColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]} />
      </View>
    )
  }

  if (name === 'services') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        {[6, 12, 18].map((top, index) => (
          <React.Fragment key={top}>
            <View style={[styles.sliderLine, { backgroundColor: color, top }]} />
            <View
              style={[
                styles.sliderKnob,
                { borderColor: color, left: index === 1 ? 5 : 14, top: top - 3 },
              ]}
            />
          </React.Fragment>
        ))}
      </View>
    )
  }

  if (name === 'messages') {
    return (
      <View style={[styles.iconCanvas, canvasStyle]}>
        <View style={[styles.messageBody, { borderColor: color }]}>
          <View style={[styles.messageFoldLeft, { backgroundColor: color }]} />
          <View style={[styles.messageFoldRight, { backgroundColor: color }]} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.iconCanvas, canvasStyle]}>
      <View style={[styles.profileHead, { borderColor: color }]} />
      <View style={[styles.profileShoulders, { borderColor: color }]} />
    </View>
  )
}

const getBusinessName = (name: string) => {
  const trimmedName = name.trim()
  return trimmedName.length > 0 ? trimmedName : 'Floral Arts'
}

export const MerchantHomeScreen: React.FC<MerchantHomeScreenProps> = ({
  businessName = 'Floral Arts',
  hasUnreadNotifications = true,
  scheduleItems = defaultScheduleItems,
  stats = defaultStats,
  onOpenNotifications,
  onSelectQuickAction,
  onSelectScheduleItem,
  onSelectTab,
  onViewAllSchedule,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const displayName = getBusinessName(businessName)
  const statItems = [
    { label: 'New Requests', value: stats.newRequests, urgent: false },
    { label: 'Active Events', value: stats.activeEvents, urgent: false },
    { label: 'Pending Action', value: stats.pendingAction, urgent: true },
  ]

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
          <View style={styles.brandRow}>
            <View style={styles.brandIconCircle}>
              <DashboardIcon color={palette.primary} name="briefcase" size={20} />
            </View>
            <Text style={styles.brand}>MULTIVENT</Text>
          </View>

          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenNotifications}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <DashboardIcon name="notifications" />
            {hasUnreadNotifications ? <View style={styles.notificationBadge} /> : null}
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
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Good morning, {displayName}.</Text>
          <Text style={styles.greetingSubtitle}>Here is your snapshot for today.</Text>
        </View>

        <View style={styles.statsGrid}>
          {statItems.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text numberOfLines={2} style={styles.statLabel}>
                {stat.label}
              </Text>
              <Text style={[styles.statValue, stat.urgent && styles.statValueUrgent]}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Pressable
              accessibilityLabel="View all scheduled events"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onViewAllSchedule}
              style={({ pressed }) => pressed && styles.textButtonPressed}
            >
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>

          <View style={styles.scheduleList}>
            {scheduleItems.length > 0 ? (
              scheduleItems.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityLabel={`${item.title}, ${item.time}, ${item.location}`}
                  accessibilityRole="button"
                  onPress={() => onSelectScheduleItem?.(item)}
                  style={({ pressed }) => [
                    styles.scheduleItem,
                    pressed && styles.scheduleItemPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.scheduleAccent,
                      item.urgent ? styles.scheduleAccentUrgent : styles.scheduleAccentMuted,
                    ]}
                  />
                  <View style={styles.scheduleCopy}>
                    <Text numberOfLines={2} style={styles.scheduleTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.scheduleMeta}>
                      {item.time} {'\u2022'} {item.location}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{'\u203A'}</Text>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptySchedule}>
                <Text style={styles.emptyScheduleTitle}>Your day is clear.</Text>
                <Text style={styles.emptyScheduleCopy}>No events are scheduled for today.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityLabel={action.label}
                accessibilityRole="button"
                onPress={() => onSelectQuickAction?.(action.id)}
                style={({ pressed }) => [
                  styles.quickAction,
                  pressed && styles.quickActionPressed,
                ]}
              >
                <DashboardIcon color={palette.primaryContainer} name={action.icon} />
                <Text numberOfLines={2} style={styles.quickActionLabel}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          <View style={styles.bottomNavigationContent}>
            {navigationTabs.map((tab) => {
              const isActive = tab.id === 'home'
              const iconColor = isActive ? palette.onPrimaryContainer : palette.secondary

              return (
                <Pressable
                  key={tab.id}
                  accessibilityLabel={`Open ${tab.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => onSelectTab?.(tab.id)}
                  style={({ pressed }) => [styles.navItem, pressed && styles.navItemPressed]}
                >
                  <View style={[styles.navIconContainer, isActive && styles.navIconActive]}>
                    <DashboardIcon color={iconColor} name={tab.icon} />
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const palette = {
  background: '#FFFFFF',
  surface: '#FAF9F9',
  surfaceContainerLow: '#F5F3F3',
  surfaceContainerHigh: '#E9E8E8',
  surfaceContainerHighest: '#E3E2E2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  onPrimaryContainer: '#EE8594',
  secondary: '#5D5F5F',
  text: '#1B1C1C',
  outline: '#877274',
  border: '#DFE0E0',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topAppBar: {
    zIndex: 20,
    minHeight: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1024,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topAppBarContentWide: {
    paddingHorizontal: 32,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: palette.surfaceContainerHigh,
  },
  brand: {
    color: palette.primary,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: palette.surface,
    borderRadius: 5,
    backgroundColor: palette.primaryContainer,
  },
  content: {
    width: '100%',
    maxWidth: 768,
    alignSelf: 'center',
  },
  contentMobile: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 112,
  },
  contentWide: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 48,
  },
  greetingSection: {
    marginBottom: 32,
  },
  greeting: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtitle: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    minWidth: 0,
    minHeight: 88,
    flex: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHighest,
    borderRadius: 8,
    padding: 16,
  },
  statLabel: {
    minHeight: 32,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  statValue: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  statValueUrgent: {
    color: palette.primaryContainer,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceContainerHighest,
    paddingBottom: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    flex: 1,
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  viewAll: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
  },
  scheduleList: {
    gap: 4,
  },
  scheduleItem: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: -8,
  },
  scheduleItemPressed: {
    backgroundColor: palette.surfaceContainerLow,
  },
  scheduleAccent: {
    width: 4,
    height: 42,
    borderRadius: 2,
  },
  scheduleAccentUrgent: {
    backgroundColor: palette.primaryContainer,
  },
  scheduleAccentMuted: {
    backgroundColor: palette.surfaceContainerHigh,
  },
  scheduleCopy: {
    minWidth: 0,
    flex: 1,
  },
  scheduleTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  scheduleMeta: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  chevron: {
    color: palette.outline,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: '300',
  },
  emptySchedule: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceContainerHighest,
    borderRadius: 8,
    padding: 20,
  },
  emptyScheduleTitle: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  emptyScheduleCopy: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickAction: {
    minWidth: 130,
    minHeight: 58,
    flexBasis: '45%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.surfaceContainerHighest,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickActionPressed: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.surfaceContainerLow,
    transform: [{ scale: 0.99 }],
  },
  quickActionLabel: {
    minWidth: 0,
    flex: 1,
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    minHeight: 72,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    paddingTop: 4,
    paddingBottom: 12,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    width: 64,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    width: 56,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  navIconActive: {
    backgroundColor: palette.primaryContainer,
  },
  navItemPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  iconButtonPressed: {
    backgroundColor: palette.surfaceContainerLow,
    opacity: 0.72,
  },
  textButtonPressed: {
    opacity: 0.55,
  },
  iconCanvas: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  briefcaseHandle: {
    position: 'absolute',
    top: 2,
    width: 8,
    height: 6,
    borderWidth: 1.7,
    borderBottomWidth: 0,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  briefcaseBody: {
    position: 'absolute',
    top: 7,
    width: 20,
    height: 15,
    overflow: 'hidden',
    borderWidth: 1.7,
    borderRadius: 3,
  },
  briefcaseBand: {
    position: 'absolute',
    top: 5,
    right: 0,
    left: 0,
    height: 1.5,
  },
  bellBody: {
    position: 'absolute',
    top: 3,
    width: 16,
    height: 16,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bellBase: {
    position: 'absolute',
    bottom: 3,
    width: 6,
    height: 2,
    borderRadius: 2,
  },
  plusCircle: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.8,
    borderRadius: 10,
  },
  plusHorizontal: {
    position: 'absolute',
    width: 9,
    height: 1.8,
    borderRadius: 1,
  },
  plusVertical: {
    position: 'absolute',
    width: 1.8,
    height: 9,
    borderRadius: 1,
  },
  calendarBody: {
    width: 19,
    height: 18,
    overflow: 'hidden',
    borderWidth: 1.7,
    borderRadius: 3,
  },
  calendarRule: {
    width: '100%',
    height: 1.5,
    marginTop: 4,
  },
  calendarDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  calendarDot: {
    width: 3,
    height: 3,
    borderRadius: 1,
  },
  personHead: {
    position: 'absolute',
    top: 3,
    width: 7,
    height: 7,
    borderWidth: 1.6,
    borderRadius: 4,
  },
  personHeadLeft: {
    left: 4,
  },
  personHeadRight: {
    right: 4,
  },
  peopleShoulders: {
    position: 'absolute',
    bottom: 3,
    width: 21,
    height: 10,
    borderWidth: 1.6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 0,
  },
  invoiceBody: {
    width: 17,
    height: 21,
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.7,
    borderRadius: 2,
    paddingHorizontal: 3,
  },
  invoiceLine: {
    width: '100%',
    height: 1.5,
    borderRadius: 1,
  },
  invoiceLineShort: {
    width: '65%',
  },
  homeRoof: {
    position: 'absolute',
    top: 3,
    width: 16,
    height: 16,
    borderTopWidth: 1.8,
    borderLeftWidth: 1.8,
    transform: [{ rotate: '45deg' }],
  },
  homeBody: {
    position: 'absolute',
    bottom: 2,
    width: 15,
    height: 12,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  sliderLine: {
    position: 'absolute',
    left: 3,
    width: 18,
    height: 1.6,
    borderRadius: 1,
  },
  sliderKnob: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderWidth: 1.5,
    borderRadius: 4,
    backgroundColor: palette.surface,
  },
  messageBody: {
    width: 20,
    height: 15,
    overflow: 'hidden',
    borderWidth: 1.7,
    borderRadius: 3,
  },
  messageFoldLeft: {
    position: 'absolute',
    top: 4,
    left: -1,
    width: 13,
    height: 1.5,
    transform: [{ rotate: '32deg' }],
  },
  messageFoldRight: {
    position: 'absolute',
    top: 4,
    right: -1,
    width: 13,
    height: 1.5,
    transform: [{ rotate: '-32deg' }],
  },
  profileHead: {
    position: 'absolute',
    top: 2,
    width: 9,
    height: 9,
    borderWidth: 1.7,
    borderRadius: 5,
  },
  profileShoulders: {
    position: 'absolute',
    bottom: 1,
    width: 20,
    height: 10,
    borderWidth: 1.7,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 0,
  },
})
