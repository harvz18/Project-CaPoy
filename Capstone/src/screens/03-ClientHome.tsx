import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'

export type ClientHomeAction = 'tasks' | 'budget' | 'vendors' | 'addItem'
export type ClientHomeTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'
export type ClientHomeMilestone = 'catering' | 'saveTheDates'

interface ClientHomeScreenProps {
  eventName?: string
  userName?: string
  onAddItem?: () => void
  onOpenNotifications?: () => void
  onSelectAction?: (action: ClientHomeAction) => void
  onSelectMilestone?: (milestone: ClientHomeMilestone) => void
  onSelectTab?: (tab: ClientHomeTab) => void
}

const PROFILE_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAwjmCk4HvDrjJoFW3czfCUDBxxBFFu9wmoSKXzpj0G3M0cWA9eVLFbpHR5zIUBk90zAGF9R6Fv0cDqQrBj8fZCy5gXN-grKY98cw9EfPnR6GNvOmZ3swQ0vhTNctev2d9UzHeJsWECHAl6lr71ZWMEo3_GaZrKwgNcKQALrCB4DiXuaKSe4vxd81JWyuOaxgGBN5Zp9lFMKN1NJTTFUMBE8knLXM0Zy3gePik9LycX_fsH5u_AF6GOLg'

const stats = [
  { id: 'tasks' as const, icon: 'T', label: 'TASKS PENDING', value: '12', suffix: '' },
  { id: 'budget' as const, icon: 'P', label: 'BUDGET USED', value: '45%', suffix: '' },
  { id: 'vendors' as const, icon: 'V', label: 'VENDORS SECURED', value: '4', suffix: '/10' },
] as const

const milestones = [
  {
    id: 'catering' as const,
    month: 'NOV',
    day: '15',
    title: 'Finalize Catering Menu',
    description: 'Tasting scheduled at The Grand Hotel',
  },
  {
    id: 'saveTheDates' as const,
    month: 'DEC',
    day: '02',
    title: 'Send Save the Dates',
    description: 'Design approved, waiting on print delivery',
  },
] as const

const navigationTabs = [
  { id: 'home' as const, icon: 'H', label: 'Home' },
  { id: 'explore' as const, icon: 'E', label: 'Explore' },
  { id: 'bookings' as const, icon: 'B', label: 'Bookings' },
  { id: 'messages' as const, icon: 'M', label: 'Messages', hasBadge: true },
  { id: 'profile' as const, icon: 'P', label: 'Profile' },
] as const

const progressSegments: ViewStyle[] = Array.from({ length: 40 }, (_, index) => {
  const angle = (index / 40) * Math.PI * 2
  const radius = 58

  return {
    left: 64 + radius * Math.sin(angle) - 2,
    top: 64 - radius * Math.cos(angle) - 4,
    transform: [{ rotate: `${index * 9}deg` }],
  }
})

const getFirstName = (name: string) => {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    return 'Planner'
  }

  return trimmedName.split(/\s+/)[0]
}

export const ClientHomeScreen: React.FC<ClientHomeScreenProps> = ({
  eventName = "L'Alliance",
  userName = 'Planner',
  onAddItem,
  onOpenNotifications,
  onSelectAction,
  onSelectMilestone,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const firstName = getFirstName(userName)

  const handleAddItem = () => {
    onAddItem?.()
    onSelectAction?.('addItem')
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
          <Image
            accessibilityLabel="User profile photo"
            source={{ uri: PROFILE_IMAGE }}
            style={styles.avatar}
          />

          <Text style={[styles.brand, isWide && styles.brandWide]}>MULTIVENT</Text>

          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onOpenNotifications}
            style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
          >
            <View style={styles.bellDome} />
            <View style={styles.bellClapper} />
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
        <View style={styles.welcomeSection}>
          <Text style={[styles.greeting, isWide && styles.greetingWide]}>
            Welcome, {firstName}
          </Text>
          <Text style={[styles.eventName, isWide && styles.eventNameWide]}>{eventName}</Text>
          <Text style={styles.welcomeDescription}>
            Your curated digital concierge for an unforgettable celebration.
          </Text>
        </View>

        <View style={[styles.dashboard, isWide && styles.dashboardWide]}>
          <View style={[styles.progressCard, isWide && styles.progressCardWide]}>
            <Text style={styles.cardHeading}>Planning Progress</Text>

            <View
              accessibilityLabel="Planning progress: 65 percent complete"
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: 65 }}
              style={styles.progressRing}
            >
              {progressSegments.map((segment, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressSegment,
                    segment,
                    index < 26 && styles.progressSegmentComplete,
                  ]}
                />
              ))}
              <Text style={styles.progressValue}>65%</Text>
              <Text style={styles.progressLabel}>COMPLETE</Text>
            </View>

            <Text style={styles.progressCopy}>You are on track for your big day.</Text>
          </View>

          <View style={[styles.statsPanel, isWide && styles.statsPanelWide]}>
            <View style={styles.statsGrid}>
              {stats.map((stat, index) => (
                <Pressable
                  key={stat.id}
                  accessibilityLabel={`${stat.label}: ${stat.value}${stat.suffix}`}
                  accessibilityRole="button"
                  onPress={() => onSelectAction?.(stat.id)}
                  style={({ pressed }) => [
                    styles.statCard,
                    isWide ? styles.statCardWide : index === 2 && styles.statCardFull,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.statIconCircle}>
                    <Text style={styles.statIcon}>{stat.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                    <Text style={styles.statValue}>
                      {stat.value}
                      {stat.suffix ? <Text style={styles.statSuffix}>{stat.suffix}</Text> : null}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityLabel="Add new item"
              accessibilityRole="button"
              onPress={handleAddItem}
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            >
              <Text style={styles.addIcon}>+</Text>
              <Text style={styles.addButtonText}>Add New Item</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesHeading}>Upcoming Milestones</Text>

          <View style={styles.milestoneList}>
            {milestones.map((milestone, index) => (
              <Pressable
                key={milestone.id}
                accessibilityLabel={`${milestone.month} ${milestone.day}: ${milestone.title}`}
                accessibilityRole="button"
                onPress={() => onSelectMilestone?.(milestone.id)}
                style={({ pressed }) => [
                  styles.milestoneCard,
                  index === 1 && styles.milestoneCardMuted,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.dateBlock}>
                  <Text style={[styles.month, index === 1 && styles.secondaryText]}>
                    {milestone.month}
                  </Text>
                  <Text style={[styles.day, index === 1 && styles.secondaryText]}>
                    {milestone.day}
                  </Text>
                </View>

                <View style={styles.dateDivider} />

                <View style={styles.milestoneCopy}>
                  <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                  <Text style={styles.milestoneDescription}>{milestone.description}</Text>
                </View>

                <View style={styles.chevronButton}>
                  <Text style={styles.chevron}>{'>'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {isWide ? (
        <View style={styles.sideNavigation}>
          {navigationTabs.slice(0, 4).map((tab) => (
            <NavigationItem key={tab.id} onPress={() => onSelectTab?.(tab.id)} tab={tab} />
          ))}
        </View>
      ) : (
        <View style={styles.bottomNavigation}>
          {navigationTabs.map((tab) => (
            <NavigationItem key={tab.id} onPress={() => onSelectTab?.(tab.id)} tab={tab} />
          ))}
        </View>
      )}
    </View>
  )
}

interface NavigationItemProps {
  onPress: () => void
  tab: (typeof navigationTabs)[number]
}

const NavigationItem: React.FC<NavigationItemProps> = ({ onPress, tab }) => {
  const isActive = tab.id === 'home'

  return (
    <Pressable
      accessibilityLabel={`Open ${tab.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
    >
      <View>
        {'hasBadge' in tab && tab.hasBadge ? <View style={styles.messageBadge} /> : null}
        <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
      </View>
      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
    </Pressable>
  )
}

const palette = {
  background: '#F9F9F9',
  surface: '#FFFFFF',
  surfaceLow: '#F3F3F4',
  surfaceVariant: '#E2E2E2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  secondary: '#5E5E5E',
  text: '#1A1C1C',
  outline: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topAppBar: {
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1E8E9',
    backgroundColor: palette.background,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1280,
    minHeight: 72,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topAppBarContentWide: {
    paddingHorizontal: 64,
  },
  avatar: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 20,
    backgroundColor: palette.surfaceLow,
  },
  brand: {
    color: palette.primary,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
  },
  brandWide: {
    fontSize: 24,
    lineHeight: 32,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDome: {
    width: 16,
    height: 17,
    borderWidth: 2,
    borderColor: palette.secondary,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  bellClapper: {
    width: 5,
    height: 3,
    marginTop: 2,
    borderRadius: 3,
    backgroundColor: palette.secondary,
  },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },
  contentMobile: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 120,
  },
  contentWide: {
    paddingLeft: 112,
    paddingRight: 64,
    paddingTop: 40,
    paddingBottom: 64,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  greeting: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  greetingWide: {
    fontSize: 18,
    lineHeight: 26,
  },
  eventName: {
    color: palette.primaryContainer,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  eventNameWide: {
    fontSize: 48,
    lineHeight: 56,
  },
  welcomeDescription: {
    maxWidth: 640,
    color: palette.secondary,
    fontSize: 18,
    lineHeight: 30,
    textAlign: 'center',
  },
  dashboard: {
    gap: 16,
  },
  dashboardWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },
  progressCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 32,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 3,
  },
  progressCardWide: {
    flexBasis: '32%',
  },
  cardHeading: {
    width: '100%',
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressRing: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegment: {
    position: 'absolute',
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
  },
  progressSegmentComplete: {
    backgroundColor: palette.primaryContainer,
  },
  progressValue: {
    color: palette.primaryContainer,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  progressLabel: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  progressCopy: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 24,
  },
  statsPanel: {
    gap: 16,
  },
  statsPanelWide: {
    flex: 1,
  },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statCard: {
    minHeight: 170,
    flexBasis: '46%',
    flexGrow: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 24,
  },
  statCardWide: {
    minWidth: 150,
    flexBasis: '28%',
  },
  statCardFull: {
    flexBasis: '100%',
  },
  statIconCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.surfaceLow,
    marginBottom: 16,
  },
  statIcon: {
    color: palette.secondary,
    fontSize: 21,
    fontWeight: '600',
  },
  statLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statValue: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  statSuffix: {
    color: palette.secondary,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: '400',
  },
  addButton: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  addButtonPressed: {
    backgroundColor: palette.primary,
    transform: [{ scale: 0.99 }],
  },
  addIcon: {
    color: palette.surface,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '400',
  },
  addButtonText: {
    color: palette.surface,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  milestonesSection: {
    marginTop: 80,
  },
  milestonesHeading: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
    paddingBottom: 8,
    marginBottom: 24,
  },
  milestoneList: {
    gap: 16,
  },
  milestoneCard: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 16,
  },
  milestoneCardMuted: {
    opacity: 0.8,
  },
  dateBlock: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  day: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    marginTop: 2,
  },
  secondaryText: {
    color: palette.secondary,
  },
  dateDivider: {
    width: 1,
    height: 48,
    backgroundColor: palette.surfaceVariant,
  },
  milestoneCopy: {
    flex: 1,
  },
  milestoneTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '700',
  },
  milestoneDescription: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  chevronButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 20,
  },
  chevron: {
    color: palette.secondary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
    backgroundColor: 'rgba(249, 249, 249, 0.97)',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  sideNavigation: {
    position: 'absolute',
    top: 72,
    bottom: 0,
    left: 0,
    zIndex: 5,
    width: 80,
    alignItems: 'center',
    gap: 28,
    borderRightWidth: 1,
    borderRightColor: palette.surfaceVariant,
    backgroundColor: palette.background,
    paddingTop: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  navItem: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: '400',
  },
  navIconActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
  navLabelActive: {
    color: palette.primary,
  },
  messageBadge: {
    position: 'absolute',
    top: -1,
    right: -5,
    zIndex: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  cardPressed: {
    borderColor: palette.outline,
    backgroundColor: palette.surfaceLow,
    transform: [{ scale: 0.99 }],
  },
  pressed: {
    opacity: 0.55,
    transform: [{ scale: 0.94 }],
  },
})
