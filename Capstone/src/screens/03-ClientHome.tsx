import { Text } from '../components/AppText'
import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { ClientMainTab } from '../components/ClientBottomNavigation'

export type ClientHomeAction = 'newEvent' | 'budget' | 'vendors' | 'ledger' | 'tasks'
export type ClientHomeTab = ClientMainTab
export type ClientHomeRecommendation = 'glasshouse' | 'aesthete'

interface ClientHomeScreenProps {
  remainingBudget?: number
  selectedServiceCount?: number
  totalBudget?: number
  userName?: string
  searchValue?: string
  onChangeSearch?: (value: string) => void
  onOpenActiveEvent?: () => void
  onOpenNotifications?: () => void
  onOpenProfile?: () => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onSeeAllVenues?: () => void
  onSelectAction?: (action: ClientHomeAction) => void
  onSelectRecommendation?: (recommendation: ClientHomeRecommendation) => void
  onSelectTab?: (tab: ClientHomeTab) => void
}

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

export const ClientHomeScreen: React.FC<ClientHomeScreenProps> = ({
  onOpenActiveEvent,
  onOpenNotifications,
  onOpenProfile,
  onScrollDirectionChange,
  onSeeAllVenues,
  onSelectAction,
  onSelectRecommendation,
  remainingBudget,
  totalBudget,
  userName,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const budget = remainingBudget ?? 0
  const hasSetBudget = (totalBudget ?? 0) > 0
  const lastScrollY = React.useRef(0)

  return (
    <View style={styles.referenceScreen}>
      <ScrollView
        contentContainerStyle={[
          styles.referenceContent,
          isWide && styles.referenceContentWide,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current

          if (Math.abs(delta) >= 4) {
            onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
            lastScrollY.current = scrollY
          }
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.referenceHeader}>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={onOpenProfile}
            style={({ pressed }) => [styles.referenceHeaderIdentity, pressed && styles.referencePressed]}
          >
            <View style={styles.referenceAvatar}>
              <MaterialIcons name="account-circle" size={34} color="#8A2944" />
            </View>
            <View>
              <View style={styles.referenceNameRow}>
                <Text style={styles.referenceName}>{userName || 'Maria Santos'}</Text>
              </View>
              <Text style={styles.referenceGreeting}>Event's Location</Text>
            </View>
          </Pressable>
          <View style={styles.referenceHeaderActions}>
            <Pressable
              accessibilityLabel="Open notifications"
              accessibilityRole="button"
              onPress={onOpenNotifications}
              style={({ pressed }) => [styles.referenceHeaderAction, pressed && styles.referencePressed]}
            >
              <MaterialIcons name="notifications-none" size={19} color={palette.primary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.referenceHero}>
          <Text style={styles.heroTitle}>LET'S PLAN{`\n`}YOUR BIG DAY!</Text>
          <Text style={styles.heroDescription}>
            Deploy planning tools, manage budget & vendors{`\n`}in one workspace.
          </Text>
          <View style={styles.heroFooter}>
            
            <Pressable
              accessibilityLabel="Begin setup"
              accessibilityRole="button"
              onPress={() => onSelectAction?.('newEvent')}
              style={({ pressed }) => [styles.heroButton, pressed && styles.referencePressed]}
            >
              <Text style={styles.heroButtonText}>Create Event</Text>
              <Text style={styles.heroButtonArrow}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.referenceSection}>
          <Pressable
            accessibilityLabel="Open active event"
            accessibilityRole="button"
            onPress={onOpenActiveEvent}
            style={({ pressed }) => [styles.activeEventCard, pressed && styles.referencePressed]}
          >
            <View style={styles.activeEventHeader}>
              <View style={styles.activeEventHeading}>
                <Text style={styles.activeEventEyebrow}>• IN PROGRESS</Text>
                <Text style={styles.activeEventTitle}>Santos–Valdez Nuptials</Text>
                <Text style={styles.activeEventMeta}>⌖ Baguio Country Club · Dec 18, 2025</Text>
              </View>
              <View style={styles.daysBadge}>
                <Text style={styles.daysValue}>142</Text>
                <Text style={styles.daysLabel}>DAYS LEFT</Text>
              </View>
            </View>
            <View style={styles.milestoneRow}>
              <Text style={styles.milestoneLabel}>Milestones</Text>
              <Text style={styles.milestoneValue}>65% <Text style={styles.milestoneMuted}>(13 of 20 tasks)</Text></Text>
            </View>
            <View style={styles.milestoneTrack}>
              <View style={styles.milestoneFill} />
            </View>
            <View style={styles.nextTaskRow}>
              <Text style={styles.nextTask}>Next: Finalize Floral Designer</Text>
              <Text style={styles.nextTaskLink}>Continue Planning <Text style={styles.nextTaskArrow}>→</Text></Text>
            </View>
          </Pressable>
        </View>
 
        <View style={styles.referenceSection}>
          <View style={styles.referenceSectionHeader}>
            <Text style={styles.referenceSectionTitle}>QUICK TOOLS<Text style={styles.sectionDot}></Text></Text>
            <Text style={styles.liveSync}>Live Sync</Text>
          </View>
          <View style={styles.financeGrid}>
            <Pressable
              accessibilityLabel="Open budget"
              accessibilityRole="button"
              onPress={() => onSelectAction?.('budget')}
              style={styles.financeCard}
            >
              <View style={styles.budgetCardContent}>
                <Image accessibilityLabel="Budget illustration" source={require('../../images/BudgetSVG.png')} style={styles.budgetImage} />
                <View style={styles.budgetCardCopy}>
                  <Text style={styles.financeLabel}>
                    {hasSetBudget ? 'BUDGET AVAILABLE' : 'PAYMENT PLAN'}
                  </Text>
                  <Text style={[styles.financeValue, !hasSetBudget && styles.financeValueCompact]}>
                    {hasSetBudget ? `₱${budget.toLocaleString()}` : 'Actual service costs'}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel="Open event ledger"
              accessibilityRole="button"
              onPress={() => onSelectAction?.('ledger')}
              style={styles.financeCard}
            >
              <View style={styles.budgetCardContent}>
                <Image accessibilityLabel="Event ledger illustration" source={require('../../images/EventLedgerSVG.png')} style={styles.eventLedgerImage} />
                <View style={styles.budgetCardCopy}>
                  <Text style={styles.financeLabel}>EVENT LEDGER</Text>
                  <Text style={styles.financeValue}>-- Transactions</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.referenceSection}>
          <View style={styles.referenceSectionHeader}>
            <View><Text style={styles.referenceSectionTitle}>RECOMMENDED FOR YOU<Text style={styles.sectionDot}></Text></Text><Text style={styles.referenceSectionSubtitle}>Selected based on Bacolod wedding spaces</Text></View>
            <Pressable accessibilityLabel="See all venues" accessibilityRole="button" onPress={onSeeAllVenues}>
              <Text style={styles.exploreAll}>Explore All →</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.referenceCarousel}
            decelerationRate="fast"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={isWide ? 340 : Math.max(252, width - 56) + 12}
          >
            {recommendations.map((recommendation) => (
              <Pressable
                key={recommendation.id}
                accessibilityLabel={`Open ${recommendation.title}`}
                accessibilityRole="button"
                onPress={() => onSelectRecommendation?.(recommendation.id)}
                style={({ pressed }) => [styles.referenceVenueCard, { width: isWide ? 324 : Math.max(252, width - 56) }, pressed && styles.referencePressed]}
              >
                <View style={styles.referenceVenueImageWrap}>
                  <Image accessibilityLabel={recommendation.imageLabel} resizeMode="cover" source={{ uri: recommendation.image }} style={styles.referenceVenueImage} />
                  <View style={styles.venueBadge}><Text style={styles.venueBadgeText}>{recommendation.category.split(' / ')[0]}</Text></View>
                </View>
                <Text style={styles.referenceVenueTitle}>{recommendation.title}</Text>
                <Text style={styles.referenceVenueMeta}>The Glasshouse Estate · 250 Guests Max</Text>
                <View style={styles.referenceVenueFooter}><Text style={styles.referenceVenuePrice}>{recommendation.price}</Text><Text style={styles.referenceVenueAction}>View Specs</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

      </ScrollView>

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
  referenceScreen: {
    flex: 1,
    backgroundColor: '#F8F6F3',
  },
  referenceContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 96,
  },
  referenceContentWide: {
    paddingHorizontal: 28,
  },
  referenceHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  referenceHeaderIdentity: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  referenceAvatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 19,
    backgroundColor: '#F8EDEF',
  },
  referenceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  referenceName: {
    color: '#2B2323',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  referenceRole: {
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#F8EDEF',
  },
  referenceGreeting: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  referenceHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  referenceHeaderAction: {
    height: 32,
    minWidth: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  referenceNotificationCount: {
    color: '#2B2323',
    fontSize: 12,
    fontWeight: '600',
  },
  referenceHeaderProfile: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  referenceHero: {
    minHeight: 158,
    overflow: 'hidden',
    marginBottom: 18,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#701B30',
    shadowColor: '#4E061A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  heroEyebrow: {
    color: '#F6DAD4',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroEdition: {
    color: '#E8BFC0',
    fontSize: 12,
    lineHeight: 15,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  heroDescription: {
    maxWidth: 260,
    color: '#F4DDE0',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 7,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  heroHint: {
    color: '#E8BFC0',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  heroButton: {
    minWidth: 108,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  heroButtonText: {
    color: '#701B30',
    fontSize: 12,
    fontWeight: '600',
  },
  heroButtonArrow: {
    color: '#701B30',
    fontSize: 14,
    lineHeight: 14,
  },
  referenceSection: {
    marginBottom: 18,
  },
  activeEventCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
  },
  activeEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  activeEventHeading: {
    flex: 1,
  },
  activeEventEyebrow: {
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeEventTitle: {
    color: '#241E1E',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  activeEventMeta: {
    color: '#7C7271',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  daysBadge: {
    minWidth: 42,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: '#F8EDEF',
  },
  daysValue: {
    color: '#8A2944',
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
  },
  daysLabel: {
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  milestoneLabel: {
    color: '#847977',
    fontSize: 12,
  },
  milestoneValue: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '600',
  },
  milestoneMuted: {
    color: '#847977',
    fontWeight: '400',
  },
  milestoneTrack: {
    height: 3,
    overflow: 'hidden',
    marginTop: 5,
    borderRadius: 2,
    backgroundColor: '#E8DDE0',
  },
  milestoneFill: {
    width: '65%',
    height: '100%',
    backgroundColor: '#8A2944',
  },
  nextTask: {
    flex: 1,
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 9,
  },
  nextTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextTaskLink: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 9,
  },
  nextTaskArrow: {
    fontSize: 12,
    fontWeight: '700',
  },
  referenceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  referenceSectionTitle: {
    color: '#2B2323',
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionDot: {
    color: '#8A2944',
  },
  liveSync: {
    color: '#847977',
    fontSize: 12,
  },
  financeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  financeCard: {
    minWidth: 0,
    flex: 1,
    minHeight: 86,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  financeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetImage: {
    width: 68,
    height: 74,
  },
  eventLedgerImage: {
    width: 54,
    height: 60,
  },
  budgetCardCopy: {
    minWidth: 0,
    flex: 1,
  },
  financeIcon: {
    width: 18,
    height: 18,
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    borderRadius: 4,
    backgroundColor: '#F8EDEF',
  },
  financeStatus: {
    color: '#18966D',
    fontSize: 14,
    lineHeight: 14,
  },
  financeLabel: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 15,
    marginTop: 0,
  },
  financeValue: {
    color: '#2B2323',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  financeValueCompact: { fontSize: 15, lineHeight: 20 },
  financeSubvalue: {
    color: '#2B2323',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  financeRule: {
    height: 2,
    marginTop: 8,
    backgroundColor: '#F0E8E5',
  },
  financeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  financeMetaText: {
    color: '#9A8E8B',
    fontSize: 12,
  },
  settled: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '700',
  },
  referenceSectionSubtitle: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  exploreAll: {
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  referenceCarousel: {
    gap: 12,
  },
  referenceVenueCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  referenceVenueImageWrap: {
    height: 104,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#EDE4DF',
  },
  referenceVenueImage: {
    width: '100%',
    height: '100%',
  },
  venueBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  venueBadgeText: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '700',
  },
  referenceVenueTitle: {
    color: '#2B2323',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    paddingHorizontal: 9,
    marginTop: 7,
  },
  referenceVenueMeta: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 9,
    marginTop: 2,
  },
  referenceVenueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 9,
    marginTop: 4,
  },
  referenceVenuePrice: {
    color: '#847977',
    fontSize: 12,
  },
  referenceVenueAction: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '700',
  },
  milestonesSection: {
    marginBottom: 0,
  },
  scheduleCard: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 8,
    marginBottom: 7,
    borderWidth: 1,
    borderColor: '#E4D9D5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  dateBadge: {
    width: 30,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: '#F8EDEF',
  },
  dateMonth: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '700',
  },
  dateDay: {
    color: '#8A2944',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  scheduleCopy: {
    minWidth: 0,
    flex: 1,
  },
  scheduleTitle: {
    color: '#2B2323',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  scheduleMeta: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
  },
  scheduleStatus: {
    color: '#8A2944',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8EDEF',
  },
  scheduleStatusConfirmed: {
    color: '#847977',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F2F0EE',
  },
  referenceProfileButton: {
    position: 'absolute',
    top: 16,
    right: 14,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  referenceNotificationButton: {
    position: 'absolute',
    top: 16,
    right: 50,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  referencePressed: {
    opacity: 0.7,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.primaryContainer,
  },
  topAppBar: {
    zIndex: 20,
    height: 64,
    justifyContent: 'center',
    backgroundColor: palette.primaryContainer,
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
  profileGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  topGreeting: {
    color: palette.surface,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '400',
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
  contentSheet: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#F4F3F1',
  },
  contentSheetWide: {
    marginHorizontal: -64,
    paddingHorizontal: 64,
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
    justifyContent: 'flex-end',
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
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 22,
    backgroundColor: palette.surface,
    paddingHorizontal: 18,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  newEventIcon: {
    color: palette.primary,
    fontSize: 20,
    lineHeight: 22,
  },
  newEventText: {
    color: palette.primary,
    fontSize: 15,
    lineHeight: 20,
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
    fontSize: 12,
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
    fontSize: 12,
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
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickToolIconCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.surfaceContainer,
  },
  quickToolIcon: {
    color: palette.secondary,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: '600',
  },
  quickToolLabel: {
    maxWidth: '100%',
    color: palette.text,
    fontSize: 12,
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  recommendationsList: {
    gap: 16,
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
    fontSize: 12,
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
