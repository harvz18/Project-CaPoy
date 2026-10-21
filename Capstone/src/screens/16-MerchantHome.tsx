import { Text } from '../components/AppText'
import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { MerchantBottomNavigation } from '../components/MerchantBottomNavigation'
import { BrandIdentity } from '../components/BrandIdentity'

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

export interface MerchantHomeEarningsOverview {
  currency: string
  periodEarnings: number
  trend: Array<{ amount: number; label: string }>
}

interface MerchantHomeScreenProps {
  businessName?: string
  earnings?: MerchantHomeEarningsOverview
  hasUnreadNotifications?: boolean
  isEarningsLoading?: boolean
  showBottomNavigation?: boolean
  scheduleItems?: MerchantScheduleItem[]
  stats?: MerchantHomeStats
  onOpenNotifications?: () => void
  onOpenEarnings?: () => void
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

const dashboardIconNames: Record<IconName, React.ComponentProps<typeof MaterialIcons>['name']> = {
  bookings: 'event-available',
  briefcase: 'business-center',
  calendar: 'calendar-month',
  clients: 'people-outline',
  home: 'home',
  invoices: 'receipt-long',
  messages: 'chat',
  notifications: 'notifications-none',
  plus: 'add-circle-outline',
  profile: 'person-outline',
  services: 'storefront',
}

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

const DashboardIcon: React.FC<{ color?: string; name: IconName; size?: number }> = ({
  color = palette.secondary,
  name,
  size = 24,
}) => <MaterialIcons color={color} name={dashboardIconNames[name]} size={size} />

const getBusinessName = (name: string) => {
  const trimmedName = name.trim()
  return trimmedName.length > 0 ? trimmedName : 'Floral Arts'
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-PH', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount)

export const MerchantHomeScreen: React.FC<MerchantHomeScreenProps> = ({
  businessName = 'Floral Arts',
  earnings,
  hasUnreadNotifications = true,
  isEarningsLoading = false,
  showBottomNavigation = true,
  scheduleItems = defaultScheduleItems,
  stats = defaultStats,
  onOpenNotifications,
  onOpenEarnings,
  onSelectQuickAction,
  onSelectScheduleItem,
  onSelectTab,
  onViewAllSchedule,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const displayName = getBusinessName(businessName)
  const earningsTrend = earnings?.trend ?? []
  const maximumEarnings = Math.max(...earningsTrend.map((point) => point.amount), 1)
  const statItems = [
    { label: 'New Requests', value: stats.newRequests, urgent: false },
    { label: 'Active Events', value: stats.activeEvents, urgent: false },
    { label: 'Pending Action', value: stats.pendingAction, urgent: true },
  ]

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
          <BrandIdentity markSize={32} variant="metallicWordmark" />

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
            <DashboardIcon color={palette.onPrimary} name="notifications" size={23} />
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
            <Text style={styles.sectionTitle}>Earnings Overview</Text>
            <Pressable
              accessibilityLabel="View detailed earnings"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenEarnings}
              style={({ pressed }) => pressed && styles.textButtonPressed}
            >
              <Text style={styles.viewAll}>View details</Text>
            </Pressable>
          </View>

          <View style={styles.earningsCard}>
            <View style={styles.earningsSummary}>
              <View>
                <Text style={styles.earningsLabel}>EARNINGS · LAST 30 DAYS</Text>
                <Text style={styles.earningsValue}>
                  {formatCurrency(earnings?.periodEarnings ?? 0, earnings?.currency ?? 'PHP')}
                </Text>
              </View>
              <View style={styles.earningsIconWrap}>
                <MaterialIcons color={palette.primaryContainer} name="account-balance-wallet" size={21} />
              </View>
            </View>

            {isEarningsLoading && !earnings ? (
              <View style={styles.earningsLoading}>
                <ActivityIndicator color={palette.primaryContainer} size="small" />
                <Text style={styles.earningsEmptyText}>Loading recorded earnings…</Text>
              </View>
            ) : earningsTrend.length ? (
              <View style={styles.earningsChart}>
                {earningsTrend.map((point, index) => {
                  const height = Math.max((point.amount / maximumEarnings) * 100, 8)
                  return (
                    <View key={`${point.label}-${index}`} style={styles.earningsColumn}>
                      <View style={styles.earningsTrack}>
                        <View style={[styles.earningsBar, { height: `${height}%` }]} />
                      </View>
                      <Text numberOfLines={1} style={styles.earningsChartLabel}>
                        {point.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <Text style={styles.earningsEmptyText}>
                Completed booking earnings will appear here.
              </Text>
            )}
          </View>
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
                  <MaterialIcons color={palette.outline} name="chevron-right" size={24} />
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

      {showBottomNavigation && !isWide ? (
        <MerchantBottomNavigation activeTab="home" onSelectTab={onSelectTab} />
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
  onPrimary: '#FFFFFF',
  accent: '#E8BF94',
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
    borderBottomColor: palette.primary,
    backgroundColor: palette.primaryContainer,
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
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: palette.primaryContainer,
    borderRadius: 5,
    backgroundColor: palette.accent,
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
    borderColor: palette.border,
    borderRadius: 12,
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
  earningsCard: {
    minHeight: 178,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: '#FFFDFD',
    padding: 16,
  },
  earningsSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  earningsLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  earningsValue: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginTop: 2,
  },
  earningsIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F8EFF1',
  },
  earningsChart: {
    height: 78,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    marginTop: 12,
  },
  earningsColumn: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  earningsTrack: {
    width: '100%',
    height: 54,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: '#F1E6E8',
  },
  earningsBar: {
    width: '100%',
    minHeight: 4,
    borderRadius: 5,
    backgroundColor: palette.primaryContainer,
  },
  earningsChartLabel: {
    width: '100%',
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  earningsEmptyText: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
  },
  earningsLoading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  iconButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    opacity: 1,
  },
  textButtonPressed: {
    opacity: 0.55,
  },
})
