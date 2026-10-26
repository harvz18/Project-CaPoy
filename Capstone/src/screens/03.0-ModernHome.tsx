import { MaterialIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'

import { Text } from '../components/AppText'
import { AnimatedQuickAccessButton } from '../components/AnimatedQuickAccessButton'
import { BrandIdentity } from '../components/BrandIdentity'
import { CardInsetShadow } from '../components/CardInsetShadow'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatServicePrice } from '../lib/catalog'
import type { HomeServiceRecommendation } from '../lib/home-recommendations'
import type { ClientBookingProgress } from './03-ClientHome'
import type { BookingItem } from './11-BookingScreen'

const QUICK_ACCESS_ITEMS = [
  { id: 'bookings', label: 'Bookings', image: require('../../images/Bookings.png'), iconScale: 1 },
  { id: 'savedPlans', label: 'Saved Plans', image: require('../../images/Plans.png'), iconScale: 1.5 },
  { id: 'favourites', label: 'Favourites', image: require('../../images/Favourites.png'), iconScale: 1.48 },
  { id: 'refunds', label: 'Refunds', image: require('../../images/Wallet.png'), iconScale: 1.45 },
] as const

type QuickAccessId = (typeof QUICK_ACCESS_ITEMS)[number]['id']

export interface ModernHomeScreenProps {
  bookingProgressEvents?: ClientBookingProgress[]
  hasAdditionalBookingProgress: boolean
  hasUnreadBookingUpdates?: boolean
  isDraftPromptVisible: boolean
  isRefreshing?: boolean
  isStartingNewEvent: boolean
  onCreateEvent: () => void
  onDismissDraftPrompt: () => void
  onOpenBookingProgress?: (booking: BookingItem) => void
  onOpenProfile?: () => void
  onRefresh?: () => void | Promise<void>
  onOpenSupport?: () => void
  onQuickAccess: (itemId: QuickAccessId) => void
  onResumeDraft: () => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onSeeAllVenues?: () => void
  onSelectRecommendation?: (serviceId: string) => void
  onStartNewEvent: () => void
  onToggleBookingProgress: () => void
  recommendations?: HomeServiceRecommendation[]
  showAllBookingProgress: boolean
}

const formatEventDate = (value: string) => {
  if (!value) return 'Date to be confirmed'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const daysRemainingLabel = (daysRemaining?: number) => {
  if (daysRemaining === undefined) return 'Date pending'
  if (daysRemaining < 0) return 'Past event'
  if (daysRemaining === 0) return 'Today'
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
}

export const ModernHomeScreen: React.FC<ModernHomeScreenProps> = ({
  bookingProgressEvents = [],
  hasAdditionalBookingProgress,
  hasUnreadBookingUpdates = false,
  isDraftPromptVisible,
  isRefreshing = false,
  isStartingNewEvent,
  onCreateEvent,
  onDismissDraftPrompt,
  onOpenBookingProgress,
  onOpenProfile,
  onRefresh,
  onOpenSupport,
  onQuickAccess,
  onResumeDraft,
  onScrollDirectionChange,
  onSeeAllVenues,
  onSelectRecommendation,
  onStartNewEvent,
  onToggleBookingProgress,
  recommendations = [],
  showAllBookingProgress,
}) => {
  const safeAreaInsets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const wordmarkSize = width < 375 ? 26 : 35
  const lastScrollY = React.useRef(0)
  const logoRotation = React.useRef(new Animated.Value(0)).current
  const logoSpinDirection = React.useRef<1 | -1>(1)
  const isLogoSpinning = React.useRef(false)
  const visibleBookingProgress = showAllBookingProgress
    ? bookingProgressEvents
    : bookingProgressEvents.slice(0, 3)

  const handleLogoPress = () => {
    if (isLogoSpinning.current) return
    isLogoSpinning.current = true
    const direction = logoSpinDirection.current
    logoSpinDirection.current = direction === 1 ? -1 : 1
    logoRotation.setValue(0)
    Animated.timing(logoRotation, {
      duration: 620,
      easing: Easing.inOut(Easing.cubic),
      toValue: direction,
      useNativeDriver: true,
    }).start(() => {
      isLogoSpinning.current = false
    })
  }

  const logoRotate = logoRotation.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  })

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current
          if (Math.abs(delta) < 4) return
          lastScrollY.current = scrollY
          onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl
            colors={['#8A2944']}
            onRefresh={() => void onRefresh()}
            refreshing={isRefreshing}
            tintColor="#8A2944"
          />
        ) : undefined}
      >
        <LinearGradient
          colors={['#4E061A', '#701B30', '#A34E5D', '#E9B8B3']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0.05, y: 0 }}
          style={[styles.hero, { paddingTop: safeAreaInsets.top + 72 }]}
        >
          <View pointerEvents="none" style={styles.heroGlow} />
          <View pointerEvents="none" style={styles.heroCurveOuter} />
          <View pointerEvents="none" style={styles.heroCurveInner} />

          <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
            <Text style={styles.heroTitle}>LET&apos;S PLAN{`\n`}YOUR BIG DAY!</Text>
            <Text style={styles.heroSubtitle}>
              Deploy planning tools, manage budget & vendors{`\n`}in one workspace.
            </Text>
            <Pressable
              accessibilityLabel="Begin setup"
              accessibilityRole="button"
              onPress={onCreateEvent}
              style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
            >
              <Text style={styles.createButtonText}>Create Event</Text>
              <MaterialIcons color="#701B30" name="add" size={20} />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={[styles.pageContent, isWide && styles.pageContentWide]}>
          <View style={styles.quickAccessPanel}>
            <CardInsetShadow />
            <Text style={styles.quickAccessTitle}>QUICK ACCESS</Text>
            <View style={styles.quickAccessGrid}>
              {QUICK_ACCESS_ITEMS.map((item, index) => (
                <AnimatedQuickAccessButton
                  key={item.id}
                  accessibilityLabel={`Open ${item.label}${item.id === 'bookings' && hasUnreadBookingUpdates ? ', with unread updates' : ''}`}
                  badgeStyle={styles.quickAccessUnreadDot}
                  entranceDelay={260 + index * 180}
                  iconContainerStyle={styles.quickAccessIconWrap}
                  iconScale={item.iconScale}
                  iconSource={item.image}
                  iconStyle={styles.quickAccessIcon}
                  itemStyle={styles.quickAccessCard}
                  label={item.label}
                  labelStyle={styles.quickAccessLabel}
                  onPress={() => onQuickAccess(item.id)}
                  pressedStyle={styles.quickAccessPressed}
                  showBadge={item.id === 'bookings' && hasUnreadBookingUpdates}
                />
              ))}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleCopy}>
              <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
              <Text style={styles.sectionSubtitle}>Active booking confirmation progress</Text>
            </View>
            {hasAdditionalBookingProgress ? (
              <Pressable
                accessibilityLabel={showAllBookingProgress ? 'Collapse event bookings' : 'Expand event bookings'}
                accessibilityRole="button"
                onPress={onToggleBookingProgress}
                style={({ pressed }) => [styles.showAllButton, pressed && styles.textPressed]}
              >
                <Text style={styles.showAllText}>
                  {showAllBookingProgress ? 'Show less' : `Show all (${bookingProgressEvents.length})`}
                </Text>
                <MaterialIcons
                  color="#8A2944"
                  name={showAllBookingProgress ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          {visibleBookingProgress.length ? (
            <View style={styles.bookingList}>
              {visibleBookingProgress.map((progress) => (
                <Pressable
                  key={progress.booking.id}
                  accessibilityLabel={`View booking details for ${progress.booking.name}`}
                  accessibilityRole="button"
                  onPress={() => onOpenBookingProgress?.(progress.booking)}
                  style={({ pressed }) => [styles.bookingCard, pressed && styles.bookingCardPressed]}
                >
                  <CardInsetShadow />
                  {progress.hasUnreadUpdate ? <View style={styles.bookingUnreadDot} /> : null}
                  <View style={styles.bookingAccent} />
                  <View style={styles.bookingCardBody}>
                    <View style={styles.bookingHeading}>
                      <View style={styles.bookingCopy}>
                        <Text numberOfLines={1} style={styles.bookingName}>{progress.booking.name}</Text>
                        <Text style={styles.bookingDate}>{formatEventDate(progress.booking.date)}</Text>
                      </View>
                      <View style={styles.countdownBadge}>
                        <Text style={styles.countdownText}>{daysRemainingLabel(progress.daysRemaining)}</Text>
                      </View>
                    </View>

                    <View style={styles.bookingStatusRow}>
                      <Text numberOfLines={1} style={styles.bookingStatus}>{progress.statusLabel}</Text>
                      <Text style={styles.bookingCount}>
                        {progress.confirmedBookingRecipientCount} of {progress.totalBookingRecipientCount} booking recipients confirmed
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(progress.progressPercent, 100))}%` }]} />
                    </View>
                    <View style={styles.bookingLinkRow}>
                      <Text style={styles.bookingLink}>View Booking Details</Text>
                      <MaterialIcons color="#8A2944" name="arrow-forward" size={19} />
                    </View>
                  </View>
                  <MaterialIcons color="#8A2944" name="chevron-right" size={26} style={styles.cardChevron} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons color="#8A2944" name="event-available" size={25} />
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>No active bookings yet</Text>
                <Text style={styles.emptyText}>Provider and coordinator confirmations for your active events will appear here.</Text>
              </View>
            </View>
          )}

          <View style={[styles.sectionHeader, styles.recommendationHeader]}>
            <View style={styles.sectionTitleCopy}>
              <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
              <Text style={styles.sectionSubtitle}>Based on confirmed bookings and reliable client reviews</Text>
            </View>
            <Pressable
              accessibilityLabel="See all venues"
              accessibilityRole="button"
              onPress={onSeeAllVenues}
              style={({ pressed }) => pressed && styles.textPressed}
            >
              <Text style={styles.showAllText}>Explore all</Text>
            </Pressable>
          </View>

          {recommendations.length ? (
            <ScrollView
              contentContainerStyle={styles.recommendationCarousel}
              decelerationRate="normal"
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {recommendations.map((recommendation) => (
                <Pressable
                  key={recommendation.service.id}
                  accessibilityLabel={`Open ${recommendation.service.name}`}
                  accessibilityRole="button"
                  onPress={() => onSelectRecommendation?.(recommendation.service.id)}
                  style={({ pressed }) => [
                    styles.recommendationCard,
                    { width: isWide ? 318 : Math.max(254, width - 72) },
                    pressed && styles.bookingCardPressed,
                  ]}
                >
                  <CardInsetShadow />
                  {recommendation.service.imageUrl ? (
                    <Image
                      accessibilityLabel={recommendation.service.imageLabel}
                      resizeMode="cover"
                      source={{ uri: recommendation.service.imageUrl }}
                      style={styles.recommendationImage}
                    />
                  ) : (
                    <View style={[styles.recommendationImage, styles.recommendationImageFallback]}>
                      <MaterialIcons color="#8A2944" name="image" size={31} />
                    </View>
                  )}
                  <View style={styles.recommendationBadge}>
                    <Text style={styles.recommendationBadgeText}>{recommendation.indicator}</Text>
                  </View>
                  <View style={styles.recommendationCopy}>
                    <Text numberOfLines={1} style={styles.recommendationName}>{recommendation.service.name}</Text>
                    <Text numberOfLines={1} style={styles.recommendationMeta}>
                      {recommendation.service.categoryName} · {recommendation.service.providerName}
                    </Text>
                    <View style={styles.recommendationFooter}>
                    </View>
                  </View>
                  <Text style={styles.recommendationRating}>
                    {recommendation.service.reviewCount > 0
                      ? `${recommendation.service.rating} ★ (${recommendation.service.reviewCount})`
                      : 'New'}
                  </Text>
                  <Text style={styles.recommendationPrice}>{formatServicePrice(recommendation.service)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyRecommendation}>
              <Text style={styles.emptyTitle}>Recommendations will appear here</Text>
              <Text style={styles.emptyText}>Published services become available as providers join MULTIVENT.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <LinearGradient
        colors={['#4E061A', '#701B30']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0.05, y: 0 }}
        style={[styles.stickyHeader, { paddingTop: safeAreaInsets.top }]}
      >
        <View style={[styles.header, isWide && styles.headerWide]}>
          <Pressable
            accessibilityLabel="Animate MULTIVENT logo"
            accessibilityRole="button"
            onPress={handleLogoPress}
            style={({ pressed }) => [styles.logoButton, pressed && styles.headerPressed]}
          >
            <Animated.View style={[styles.wordmarkWrap, { transform: [{ rotate: logoRotate }] }]}>
              <BrandIdentity markSize={wordmarkSize} showName={false} variant="metallicWordmark" />
            </Animated.View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Contact MULTIVENT Support"
              accessibilityRole="button"
              onPress={onOpenSupport}
              style={({ pressed }) => [styles.supportButton, pressed && styles.headerPressed]}
            >
              <MaterialIcons color="#FFFFFF" name="support-agent" size={25} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open settings"
              accessibilityRole="button"
              onPress={onOpenProfile}
              style={({ pressed }) => [styles.supportButton, pressed && styles.headerPressed]}
            >
              <MaterialIcons color="#FFFFFF" name="settings" size={23} />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <Modal
        animationType="fade"
        onRequestClose={onDismissDraftPrompt}
        transparent
        visible={isDraftPromptVisible}
      >
        <View style={styles.draftPromptBackdrop}>
          <View accessibilityViewIsModal style={styles.draftPromptCard}>
            <View style={styles.draftPromptIcon}>
              <MaterialIcons color="#701B30" name="event-note" size={25} />
            </View>
            <Text style={styles.draftPromptTitle}>You have saved event drafts</Text>
            <Text style={styles.draftPromptCopy}>
              Your saved drafts will stay available. You can resume the latest one or create another event.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onResumeDraft}
              style={({ pressed }) => [styles.draftPromptPrimary, pressed && styles.createButtonPressed]}
            >
              <Text style={styles.draftPromptPrimaryText}>Resume Latest Draft</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isStartingNewEvent}
              onPress={onStartNewEvent}
              style={({ pressed }) => [styles.draftPromptSecondary, pressed && styles.textPressed]}
            >
              <Text style={styles.draftPromptSecondaryText}>
                {isStartingNewEvent ? 'Starting…' : 'Start New Event'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDismissDraftPrompt} style={styles.draftPromptCancel}>
              <Text style={styles.draftPromptCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF7F2' },
  content: { paddingBottom: 116 },
  hero: { minHeight: 316, overflow: 'hidden', paddingBottom: 48 },
  heroGlow: { position: 'absolute', width: 380, height: 280, right: -178, top: 46, borderRadius: 190, backgroundColor: 'rgba(255, 219, 211, 0.24)', transform: [{ rotate: '-21deg' }] },
  heroCurveOuter: { position: 'absolute', width: 520, height: 235, right: -215, bottom: -135, borderWidth: 1.2, borderColor: 'rgba(255, 239, 225, 0.88)', borderRadius: 260, backgroundColor: 'rgba(255, 234, 224, 0.22)', transform: [{ rotate: '-12deg' }] },
  heroCurveInner: { position: 'absolute', width: 510, height: 188, right: -226, bottom: -157, borderRadius: 255, backgroundColor: '#FBF7F2', transform: [{ rotate: '-12deg' }] },
  stickyHeader: { position: 'absolute', top: 0, right: 0, left: 0, zIndex: 20, elevation: 20 },
  header: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 5, paddingBottom: 15 },
  headerWide: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 28 },
  logoButton: { minWidth: 0, flex: 1, alignItems: 'flex-start', justifyContent: 'center', minHeight: 42, borderRadius: 21 },
  wordmarkWrap: { alignItems: 'flex-start', marginTop: -3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 6 },
  supportButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  headerPressed: { backgroundColor: 'rgba(255,255,255,0.16)', opacity: 0.82 },
  heroCopy: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 30, paddingTop: 18 },
  heroCopyWide: { paddingHorizontal: 42 },
  heroTitle: { color: '#FFFDF9', fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -0.65 },
  heroSubtitle: { color: '#FFF1EB', fontSize: 15, lineHeight: 22, fontWeight: '500', marginTop: 13 },
  createButton: { minWidth: 172, minHeight: 54, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 27, backgroundColor: '#FFFFFF', marginTop: 20, paddingHorizontal: 21, shadowColor: '#370611', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4 },
  createButtonPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  createButtonText: { color: '#701B30', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  pageContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16 },
  pageContentWide: { paddingHorizontal: 28 },
  quickAccessPanel: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 28, backgroundColor: '#FFFDF9', marginTop: -28, padding: 16, shadowColor: '#4E061A', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  quickAccessTitle: { color: '#701B30', fontSize: 17, lineHeight: 23, fontWeight: '800', letterSpacing: 0.3 },
  quickAccessGrid: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 11 },
  quickAccessCard: { width: '22%', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 4 },
  quickAccessPressed: { opacity: 0.9 },
  quickAccessIcon: { width: 76, height: 64 },
  quickAccessIconWrap: { position: 'relative', width: 76, height: 64, alignItems: 'center', justifyContent: 'center' },
  quickAccessUnreadDot: { position: 'absolute', top: 3, right: 4, width: 9, height: 9, borderWidth: 1.5, borderColor: '#FFFDF9', borderRadius: 5, backgroundColor: '#C93643' },
  quickAccessLabel: { color: '#4A3B3C', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 32, marginHorizontal: 4 },
  sectionTitleCopy: { minWidth: 0, flex: 1 },
  sectionTitle: { color: '#701B30', fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: 0.2 },
  sectionSubtitle: { color: '#776C6A', fontSize: 13, lineHeight: 18, marginTop: 2 },
  showAllButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: -4 },
  showAllText: { color: '#8A2944', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  textPressed: { opacity: 0.62 },
  bookingList: { gap: 14, marginTop: 14 },
  bookingCard: { position: 'relative', minHeight: 184, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: '#EEE1DD', borderRadius: 32, backgroundColor: '#FFFFFF', shadowColor: '#4E061A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  bookingUnreadDot: { position: 'absolute', top: 11, left: 11, zIndex: 2, width: 10, height: 10, borderWidth: 1.5, borderColor: '#FFFFFF', borderRadius: 5, backgroundColor: '#C93643' },
  bookingCardPressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  bookingAccent: { width: 6, backgroundColor: '#8A2944' },
  bookingCardBody: { minWidth: 0, flex: 1, paddingHorizontal: 16, paddingVertical: 15 },
  bookingHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bookingCopy: { minWidth: 0, flex: 1 },
  bookingName: { color: '#1F1B1B', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  bookingDate: { color: '#776C6A', fontSize: 13, lineHeight: 18, marginTop: 3 },
  countdownBadge: { flexShrink: 0, borderRadius: 999, backgroundColor: '#F9E9EC', paddingHorizontal: 10, paddingVertical: 6 },
  countdownText: { color: '#8A2944', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  bookingStatusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 13 },
  bookingStatus: { minWidth: 0, flex: 1, color: '#776C6A', fontSize: 13, lineHeight: 18 },
  bookingCount: { flexShrink: 1, color: '#9D2347', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'right' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: '#F0E3E1', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#9D2347' },
  bookingLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  bookingLink: { color: '#8A2944', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  cardChevron: { alignSelf: 'flex-end', marginBottom: 15, marginRight: 9 },
  emptyState: { minHeight: 105, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EEE1DD', borderRadius: 28, backgroundColor: '#FFFFFF', marginTop: 14, padding: 18 },
  emptyCopy: { minWidth: 0, flex: 1 },
  emptyTitle: { color: '#3A2B2C', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  emptyText: { color: '#776C6A', fontSize: 13, lineHeight: 18, marginTop: 3 },
  recommendationHeader: { marginTop: 35 },
  recommendationCarousel: { gap: 12, paddingHorizontal: 4, paddingTop: 14, paddingRight: 14, paddingBottom: 20 },
  recommendationCard: { position: 'relative', overflow: 'hidden', borderRadius: 28, backgroundColor: '#FFFFFF', shadowColor: '#4E061A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  recommendationImage: { width: '100%', height: 124, backgroundColor: '#F7ECE9' },
  recommendationImageFallback: { alignItems: 'center', justifyContent: 'center' },
  recommendationBadge: { position: 'absolute', top: 10, right: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.93)', paddingHorizontal: 9, paddingVertical: 5 },
  recommendationBadgeText: { color: '#8A2944', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  recommendationCopy: { paddingTop: 13, paddingHorizontal: 13, paddingBottom: 42 },
  recommendationName: { color: '#2C2323', fontSize: 14, lineHeight: 19, fontWeight: '800', paddingRight: 70 },
  recommendationMeta: { color: '#776C6A', fontSize: 13, lineHeight: 18, marginTop: 3 },
  recommendationFooter: { minHeight: 1 },
  recommendationPrice: { position: 'absolute', bottom: 13, left: 13, zIndex: 2, color: '#701B30', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  recommendationRating: { position: 'absolute', top: 137, right: 14, zIndex: 2, color: '#776C6A', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  emptyRecommendation: { minHeight: 94, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEE1DD', borderRadius: 28, backgroundColor: '#FFFFFF', marginTop: 14, paddingHorizontal: 20 },
  draftPromptBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48, 7, 18, 0.48)', padding: 24 },
  draftPromptCard: { width: '100%', maxWidth: 380, alignItems: 'center', borderRadius: 28, backgroundColor: '#FFFFFF', padding: 24, shadowColor: '#360813', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 22, elevation: 10 },
  draftPromptIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: '#F9E9EC' },
  draftPromptTitle: { color: '#2C2323', fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 15, textAlign: 'center' },
  draftPromptCopy: { color: '#776C6A', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  draftPromptPrimary: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: '#701B30', marginTop: 20, paddingHorizontal: 16 },
  draftPromptPrimaryText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  draftPromptSecondary: { minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 7, paddingHorizontal: 16 },
  draftPromptSecondaryText: { color: '#701B30', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  draftPromptCancel: { minHeight: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2, paddingHorizontal: 16 },
  draftPromptCancelText: { color: '#776C6A', fontSize: 13, lineHeight: 18, fontWeight: '600' },
})
