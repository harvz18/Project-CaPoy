import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

export type ClientHomeAction = 'newEvent' | 'budget' | 'vendors' | 'ledger' | 'tasks'
export type ClientHomeTab = 'home' | 'explore' | 'bookings' | 'messages' | 'profile'
export type ClientHomeRecommendation = 'glasshouse' | 'aesthete'

interface ClientHomeScreenProps {
  userName?: string
  searchValue?: string
  onChangeSearch?: (value: string) => void
  onOpenActiveEvent?: () => void
  onOpenNotifications?: () => void
  onOpenProfile?: () => void
  onSeeAllVenues?: () => void
  onSelectAction?: (action: ClientHomeAction) => void
  onSelectRecommendation?: (recommendation: ClientHomeRecommendation) => void
  onSelectTab?: (tab: ClientHomeTab) => void
}

const planStats = [
  { label: 'TASKS', value: '18', detail: '/ 45 done' },
  { label: 'BUDGET', value: 'PHP 42k', detail: '/ PHP 85k', accent: true },
  { label: 'VENDORS', value: '5', detail: 'booked' },
  { label: 'NEXT DUE', value: 'Caterer Deposit' },
] as const

const quickTools = [
  { id: 'budget' as const, icon: 'P', label: 'Budget' },
  { id: 'vendors' as const, icon: 'V', label: 'Vendors' },
  { id: 'ledger' as const, icon: 'L', label: 'Ledger' },
  { id: 'tasks' as const, icon: 'T', label: 'Tasks' },
] as const

const recommendations = [
  {
    id: 'glasshouse' as const,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuACgPKY6101R5Tt8wM3MANys6BhdJIdq1lEXymw2shJq516w4JybVe1vBAbZ7aeMfuHHry13Yy3fmt7tA6qoTOtxueyxdpuKDui18IO8ECZIIJDVrFCmgAc0gpyyGkCBLHu2IolGWZWlWnprUVbJSXFDDyy2ef5ck9w5VW_KXkT9bKfW_UN8lPym799buuDLFhshrnkD-PLqLFWvxmrVNLyb15lTaySHkXVDvJJMrTu9lb-ianLsojffw',
    imageLabel: 'The Glasshouse Botanical venue',
    category: 'VENUE / MINIMALIST',
    title: 'The Glasshouse Botanical',
    description:
      'An ethereal space blending modern architecture with lush, curated gardens.',
    price: 'From PHP 480k',
  },
  {
    id: 'aesthete' as const,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAM9W82WCl23k2o4k6YTzPQls2wvdD5QmVEV_CNbUrqcJN4hkSXgAaCe4WCwIpAQWsAEAcnYo_3XZqHY4KmnU4HEbf2ELXoKRPaDFooeL4Cu4IuaHk4_0DAwCh-yii_8j1GIsF9mQV3maGJ6oIdsX3RrOaUPLRUlP-TINybREUbIvO0p_ZeORHdxqvqVYFgC7_Ix2SIVeNwvzxTtpldCsOocgG6cLLjPsJv6o81qzwIUOG1i5OqrDs0aQ',
    imageLabel: 'Studio Aesthete editorial photography',
    category: 'PHOTOGRAPHY / EDITORIAL',
    title: 'Studio Aesthete',
    description:
      'Capturing raw emotion through a refined, cinematic lens for wedding storytelling.',
    price: 'From PHP 235k',
  },
] as const

const navigationTabs = [
  { id: 'home' as const, icon: 'H', label: 'Home' },
  { id: 'explore' as const, icon: 'E', label: 'Explore' },
  { id: 'bookings' as const, icon: 'B', label: 'Bookings' },
  { id: 'messages' as const, icon: 'M', label: 'Messages', hasBadge: true },
  { id: 'profile' as const, icon: 'P', label: 'Profile' },
] as const

const getFirstName = (name: string) => {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    return 'Planner'
  }

  return trimmedName.split(/\s+/)[0]
}

const getAvatarInitial = (name: string) => getFirstName(name).charAt(0).toUpperCase()

export const ClientHomeScreen: React.FC<ClientHomeScreenProps> = ({
  userName = 'Planner',
  searchValue,
  onChangeSearch,
  onOpenActiveEvent,
  onOpenNotifications,
  onOpenProfile,
  onSeeAllVenues,
  onSelectAction,
  onSelectRecommendation,
  onSelectTab,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const firstName = getFirstName(userName)
  const avatarInitial = getAvatarInitial(userName)

  return (
    <View style={styles.screen}>
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.topAppBarContentWide]}>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onOpenProfile}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
          </Pressable>

          <Text style={styles.brand}>MULTIVENT</Text>

          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            hitSlop={8}
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.greeting, isWide && styles.greetingWide]}>
          <Text style={styles.greetingTitle}>Hi, {firstName}</Text>
          <Text style={styles.greetingSubtitle}>Dashboard and Overview</Text>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchField}>
            <Text style={styles.searchIcon}>S</Text>
            <TextInput
              accessibilityLabel="Search services"
              onChangeText={onChangeSearch}
              placeholder="Search services..."
              placeholderTextColor={palette.secondary}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchValue}
            />
          </View>

          <Pressable
            accessibilityLabel="Create a new event"
            accessibilityRole="button"
            onPress={() => onSelectAction?.('newEvent')}
            style={({ pressed }) => [styles.newEventButton, pressed && styles.primaryPressed]}
          >
            <Text style={styles.newEventIcon}>+</Text>
            <Text style={styles.newEventText}>{isWide ? 'New Event' : 'New'}</Text>
          </Pressable>
        </View>

        <View style={styles.planningSection}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.liveDot} />
            <Text style={styles.sectionTitle}>Planning in Progress</Text>
          </View>

          <Pressable
            accessibilityLabel="Open current event plan"
            accessibilityRole="button"
            onPress={onOpenActiveEvent}
            style={({ pressed }) => [styles.eventCard, pressed && styles.cardPressed]}
          >
            <View style={styles.eventHeader}>
              <View style={styles.eventHeadingCopy}>
                <Text style={styles.eventTitle}>The Smith-Doe Wedding</Text>
                <View style={styles.eventMetaRow}>
                  <Text style={styles.calendarIcon}>D</Text>
                  <Text style={styles.eventMeta}>Oct 12, 2024 / Estate Solitude</Text>
                </View>
              </View>
              <View style={styles.moreButton}>
                <Text style={styles.moreText}>...</Text>
              </View>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text style={styles.overline}>OVERALL PROGRESS</Text>
                <Text style={styles.progressValue}>65%</Text>
              </View>
              <View
                accessibilityLabel="Overall progress: 65 percent"
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: 65 }}
                style={styles.progressTrack}
              >
                <View style={styles.progressFill} />
              </View>
            </View>

            <View style={styles.planStatsGrid}>
              {planStats.map((stat) => (
                <View key={stat.label} style={[styles.planStat, isWide && styles.planStatWide]}>
                  <Text style={styles.planStatLabel}>{stat.label}</Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.planStatValue,
                      'accent' in stat && stat.accent && styles.accentText,
                      stat.label === 'NEXT DUE' && styles.nextDueValue,
                    ]}
                  >
                    {stat.value}{' '}
                    {'detail' in stat && stat.detail ? (
                      <Text style={styles.planStatDetail}>{stat.detail}</Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        </View>

        <View style={styles.quickToolsSection}>
          <Text style={styles.quickToolsHeading}>Quick Tools</Text>
          <View style={styles.quickToolsGrid}>
            {quickTools.map((tool) => (
              <Pressable
                key={tool.id}
                accessibilityLabel={`Open ${tool.label}`}
                accessibilityRole="button"
                onPress={() => onSelectAction?.(tool.id)}
                style={({ pressed }) => [styles.quickTool, pressed && styles.toolPressed]}
              >
                <View style={styles.quickToolIconCircle}>
                  <Text style={styles.quickToolIcon}>{tool.icon}</Text>
                </View>
                <Text numberOfLines={1} style={styles.quickToolLabel}>
                  {tool.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.recommendedSection}>
          <View style={styles.recommendedHeader}>
            <Text style={styles.recommendedHeading}>Recommended Venues</Text>
            <Pressable
              accessibilityLabel="See all recommended venues"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onSeeAllVenues}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.seeAll}>SEE ALL</Text>
            </Pressable>
          </View>

          <View style={styles.recommendationsList}>
            {recommendations.map((recommendation) => (
              <Pressable
                key={recommendation.id}
                accessibilityLabel={`Open ${recommendation.title}`}
                accessibilityRole="button"
                onPress={() => onSelectRecommendation?.(recommendation.id)}
                style={({ pressed }) => [
                  styles.recommendationCard,
                  isWide && styles.recommendationCardWide,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={[styles.imagePanel, isWide && styles.imagePanelWide]}>
                  <Image
                    accessibilityLabel={recommendation.imageLabel}
                    resizeMode="cover"
                    source={{ uri: recommendation.image }}
                    style={styles.recommendationImage}
                  />
                  <View style={styles.imageTint} />
                  <View style={styles.bookmarkButton}>
                    <View style={styles.bookmarkOutline} />
                  </View>
                </View>

                <View style={[styles.recommendationCopy, isWide && styles.recommendationCopyWide]}>
                  <Text style={styles.category}>{recommendation.category}</Text>
                  <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                  <Text numberOfLines={2} style={styles.recommendationDescription}>
                    {recommendation.description}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{recommendation.price}</Text>
                    <Text style={styles.arrow}>{'>'}</Text>
                  </View>
                </View>
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

              return (
                <Pressable
                  key={tab.id}
                  accessibilityLabel={`Open ${tab.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => onSelectTab?.(tab.id)}
                  style={({ pressed }) => [styles.navItem, pressed && styles.pressed]}
                >
                  <View style={[styles.navIconContainer, isActive && styles.navIconContainerActive]}>
                    {'hasBadge' in tab && tab.hasBadge ? <View style={styles.messageBadge} /> : null}
                    <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{tab.icon}</Text>
                  </View>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {tab.label}
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

const palette = {
  background: '#F9F9F9',
  surface: '#FFFFFF',
  surfaceLow: '#F3F3F4',
  surfaceContainer: '#EEEEEE',
  surfaceVariant: '#E2E2E2',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primaryFixedDim: '#FFB2BB',
  secondary: '#5E5E5E',
  text: '#1A1C1C',
  outlineVariant: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topAppBar: {
    zIndex: 20,
    height: 64,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant,
    backgroundColor: palette.background,
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topAppBarContentWide: {
    paddingHorizontal: 64,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 16,
    backgroundColor: palette.primaryContainer,
  },
  avatarInitial: {
    color: palette.surface,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  brand: {
    color: palette.primary,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  notificationButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDome: {
    width: 16,
    height: 17,
    borderWidth: 2,
    borderColor: palette.primary,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: palette.primary,
  },
  bellClapper: {
    width: 5,
    height: 3,
    borderRadius: 3,
    backgroundColor: palette.primary,
    marginTop: 2,
  },
  content: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },
  contentMobile: {
    paddingHorizontal: 20,
    paddingBottom: 108,
  },
  contentWide: {
    paddingHorizontal: 64,
    paddingBottom: 64,
  },
  greeting: {
    alignItems: 'flex-start',
    paddingTop: 24,
    paddingBottom: 24,
  },
  greetingWide: {
    paddingTop: 40,
    paddingBottom: 32,
  },
  greetingTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSubtitle: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 26,
  },
  searchSection: {
    width: '100%',
    maxWidth: 672,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  searchField: {
    height: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 16,
  },
  searchIcon: {
    color: palette.secondary,
    fontSize: 20,
    lineHeight: 24,
    marginRight: 8,
  },
  searchInput: {
    height: '100%',
    flex: 1,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 0,
  },
  newEventButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 18,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  newEventIcon: {
    color: palette.surface,
    fontSize: 22,
    lineHeight: 24,
  },
  newEventText: {
    color: palette.surface,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  planningSection: {
    marginBottom: 40,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  eventCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    padding: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  eventHeadingCopy: {
    flex: 1,
  },
  eventTitle: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarIcon: {
    color: palette.secondary,
    fontSize: 18,
  },
  eventMeta: {
    flex: 1,
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 24,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 20,
    backgroundColor: palette.surfaceContainer,
  },
  moreText: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: -6,
  },
  progressBlock: {
    marginBottom: 24,
  },
  progressLabels: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overline: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  progressValue: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: palette.surfaceVariant,
  },
  progressFill: {
    width: '65%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: palette.primaryContainer,
  },
  planStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    paddingTop: 24,
  },
  planStat: {
    minWidth: 120,
    flexBasis: '45%',
    flexGrow: 1,
  },
  planStatWide: {
    minWidth: 150,
    flexBasis: '20%',
  },
  planStatLabel: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  planStatValue: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  planStatDetail: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  accentText: {
    color: palette.primaryContainer,
  },
  nextDueValue: {
    fontSize: 16,
    lineHeight: 21,
  },
  quickToolsSection: {
    marginBottom: 48,
  },
  quickToolsHeading: {
    color: palette.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  quickToolsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTool: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
    paddingHorizontal: 5,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickToolIconCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.surfaceContainer,
  },
  quickToolIcon: {
    color: palette.secondary,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '600',
  },
  quickToolLabel: {
    maxWidth: '100%',
    color: palette.text,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  recommendedSection: {
    marginBottom: 32,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  recommendedHeading: {
    flex: 1,
    color: palette.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  seeAll: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  recommendationsList: {
    gap: 24,
  },
  recommendationCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 8,
    backgroundColor: palette.surface,
  },
  recommendationCardWide: {
    minHeight: 260,
    flexDirection: 'row',
  },
  imagePanel: {
    width: '100%',
    height: 192,
    overflow: 'hidden',
    backgroundColor: palette.surfaceContainer,
  },
  imagePanelWide: {
    width: '33.333%',
    height: '100%',
    minHeight: 260,
  },
  recommendationImage: {
    width: '100%',
    height: '100%',
  },
  imageTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(94, 94, 94, 0.08)',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bookmarkOutline: {
    width: 11,
    height: 15,
    borderWidth: 1.5,
    borderColor: palette.secondary,
    borderRadius: 2,
  },
  recommendationCopy: {
    padding: 20,
  },
  recommendationCopyWide: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  category: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  recommendationTitle: {
    color: palette.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  recommendationDescription: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  price: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  arrow: {
    color: palette.outlineVariant,
    fontSize: 24,
    lineHeight: 26,
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    height: 80,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    backgroundColor: palette.background,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 8,
  },
  bottomNavigationContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 2,
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(255, 178, 187, 0.2)',
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '400',
  },
  navIconActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    opacity: 0.8,
  },
  navLabelActive: {
    color: palette.primary,
    opacity: 1,
  },
  messageBadge: {
    position: 'absolute',
    top: 1,
    right: 8,
    zIndex: 1,
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: palette.background,
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  primaryPressed: {
    backgroundColor: palette.primary,
    transform: [{ scale: 0.98 }],
  },
  cardPressed: {
    borderColor: palette.primaryContainer,
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  toolPressed: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.surfaceLow,
    transform: [{ scale: 0.97 }],
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },
})
