import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { radius, spacing } from '../theme/tokens'
import { typography } from '../theme/typography'

export type HomeAction = 'budget' | 'merchants' | 'bookings' | 'ledger'
export type HomeTab = 'home' | 'explore' | 'events' | 'bookings' | 'profile'

interface HomeScreenProps {
  userName?: string
  onCreateEvent?: () => void
  onOpenNotifications?: () => void
  onSelectAction?: (action: HomeAction) => void
  onSelectTab?: (tab: HomeTab) => void
}

const quickActions = [
  {
    id: 'budget' as const,
    icon: '\u20B1',
    title: 'Budget Planner',
    description: 'Track every expense',
  },
  {
    id: 'merchants' as const,
    icon: '\u2726',
    title: 'Find Merchants',
    description: 'Discover trusted services',
  },
  {
    id: 'bookings' as const,
    icon: '\u2713',
    title: 'My Bookings',
    description: 'Review booking updates',
  },
  {
    id: 'ledger' as const,
    icon: '\u2261',
    title: 'Event Ledger',
    description: 'See your event finances',
  },
] as const

const navigationTabs = [
  { id: 'home' as const, icon: 'H', label: 'Home' },
  { id: 'explore' as const, icon: 'E', label: 'Explore' },
  { id: 'events' as const, icon: '+', label: 'Events' },
  { id: 'bookings' as const, icon: 'B', label: 'Bookings' },
  { id: 'profile' as const, icon: 'P', label: 'Profile' },
] as const

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userName = 'Planner',
  onCreateEvent,
  onOpenNotifications,
  onSelectAction,
  onSelectTab,
}) => {
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>MULTIVENT</Text>
            <Text style={styles.brandTagline}>EVENTS, BEAUTIFULLY MANAGED</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            hitSlop={10}
            onPress={onOpenNotifications}
            style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
          >
            <Text style={styles.notificationIcon}>N</Text>
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <View style={styles.welcomeCopy}>
          <Text style={styles.welcome}>Welcome, {userName}</Text>
          <Text style={styles.welcomeSubtitle}>What would you like to plan today?</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create a new event"
          onPress={onCreateEvent}
          style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
        >
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroContent}>
            <Text style={styles.heroEyebrow}>START PLANNING</Text>
            <Text style={styles.heroTitle}>Create your perfect event</Text>
            <Text style={styles.heroDescription}>
              Set your date, budget, and vision. We will help bring every detail together.
            </Text>
            <View style={styles.createAction}>
              <Text style={styles.createActionText}>CREATE EVENT</Text>
              <Text style={styles.createActionIcon}>+</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionCaption}>YOUR PLANNING TOOLS</Text>
        </View>

        <View style={styles.quickActionGrid}>
          {quickActions.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.title}
              onPress={() => onSelectAction?.(action.id)}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionIcon}>{action.icon}</Text>
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Events</Text>
          <Text style={styles.sectionCaption}>YOUR LATEST PLANS</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>+</Text>
          </View>
          <Text style={styles.emptyTitle}>Your first event starts here</Text>
          <Text style={styles.emptyDescription}>
            Create an event to begin tracking your budget, merchants, and bookings in one place.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create your first event"
            onPress={onCreateEvent}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
          >
            <Text style={styles.emptyButtonText}>CREATE EVENT</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomNavigation}>
        {navigationTabs.map((tab) => {
          const isActive = tab.id === 'home'

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tab.label}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectTab?.(tab.id)}
              style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
            >
              <View style={[styles.navIconContainer, isActive && styles.navIconActive]}>
                <Text style={[styles.navIcon, isActive && styles.navIconTextActive]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const homeColors = {
  background: '#160D11',
  surface: '#211419',
  surfaceElevated: '#2B1A20',
  wine: '#6B1E2E',
  wineLight: '#8D3448',
  gold: '#D4A574',
  goldLight: '#F2D2AC',
  text: '#FFF8F5',
  textSecondary: '#CBBEC1',
  textMuted: '#8E7C81',
  border: '#3A272D',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: homeColors.background,
  },
  content: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 112,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['3xl'],
  },
  brand: {
    color: homeColors.gold,
    fontSize: typography.h3,
    fontWeight: '700',
    letterSpacing: 3,
  },
  brandTagline: {
    color: homeColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: spacing.xs,
  },
  notificationButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: homeColors.border,
    backgroundColor: homeColors.surface,
  },
  notificationIcon: {
    color: homeColors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: homeColors.gold,
  },
  welcomeCopy: {
    marginBottom: spacing['2xl'],
  },
  welcome: {
    color: homeColors.text,
    fontSize: typography.h1,
    lineHeight: 36,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  welcomeSubtitle: {
    color: homeColors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  heroCard: {
    minHeight: 240,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: homeColors.wineLight,
    backgroundColor: homeColors.wine,
    padding: spacing['2xl'],
    marginBottom: spacing['3xl'],
  },
  heroCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  heroGlowOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    top: -100,
    right: -60,
    borderRadius: radius.pill,
    backgroundColor: '#8E4050',
    opacity: 0.45,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 140,
    height: 140,
    bottom: -70,
    left: -30,
    borderRadius: radius.pill,
    backgroundColor: homeColors.gold,
    opacity: 0.12,
  },
  heroContent: {
    zIndex: 1,
  },
  heroEyebrow: {
    color: homeColors.goldLight,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    maxWidth: 280,
    color: homeColors.text,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  heroDescription: {
    maxWidth: 320,
    color: '#F2DDE2',
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  createAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: homeColors.gold,
  },
  createActionText: {
    color: '#2A171D',
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  createActionIcon: {
    color: '#2A171D',
    fontSize: typography.h3,
    fontWeight: '700',
  },
  sectionHeader: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: homeColors.text,
    fontSize: typography.h2,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  sectionCaption: {
    color: homeColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing['3xl'],
  },
  actionCard: {
    width: '48%',
    minHeight: 160,
    borderWidth: 1,
    borderColor: homeColors.border,
    borderRadius: radius.large,
    backgroundColor: homeColors.surface,
    padding: spacing.lg,
  },
  actionCardPressed: {
    borderColor: homeColors.gold,
    backgroundColor: homeColors.surfaceElevated,
    transform: [{ scale: 0.98 }],
  },
  actionIconContainer: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.medium,
    backgroundColor: '#3A252B',
    marginBottom: spacing.lg,
  },
  actionIcon: {
    color: homeColors.gold,
    fontSize: typography.h3,
    fontWeight: '700',
  },
  actionTitle: {
    color: homeColors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  actionDescription: {
    color: homeColors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: homeColors.border,
    borderRadius: radius.large,
    backgroundColor: homeColors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  emptyIconContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#3A252B',
    marginBottom: spacing.lg,
  },
  emptyIcon: {
    color: homeColors.gold,
    fontSize: 28,
    fontWeight: '400',
  },
  emptyTitle: {
    color: homeColors.text,
    fontSize: typography.h3,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    color: homeColors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: homeColors.gold,
    borderRadius: radius.pill,
  },
  emptyButtonText: {
    color: homeColors.gold,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bottomNavigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: homeColors.border,
    backgroundColor: '#1B1014',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  navItem: {
    minWidth: 58,
    alignItems: 'center',
    gap: spacing.xs,
  },
  navIconContainer: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  navIconActive: {
    backgroundColor: homeColors.wine,
  },
  navIcon: {
    color: homeColors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  navIconTextActive: {
    color: homeColors.goldLight,
  },
  navLabel: {
    color: homeColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  navLabelActive: {
    color: homeColors.gold,
  },
  pressed: {
    opacity: 0.65,
  },
})
