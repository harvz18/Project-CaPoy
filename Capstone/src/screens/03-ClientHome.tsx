import { Text } from '../components/AppText'
import React from 'react'
import { MaterialIcons } from '@expo/vector-icons'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  
  useWindowDimensions,
  View,
} from 'react-native'
import { ClientMainTab } from '../components/ClientBottomNavigation'
import { formatPeso, formatServicePrice } from '../lib/catalog'
import type { HomeServiceRecommendation } from '../lib/home-recommendations'
import type { ClientEventDraftSummary, ClientSavedPlanSummary } from '../lib/planning'
import type { BookingItem } from './11-BookingScreen'

export type ClientHomeAction = 'newEvent' | 'vendors' | 'tasks'
export type ClientHomeTab = ClientMainTab
export type ClientHomeRecommendation = HomeServiceRecommendation

export interface ClientBookingProgress {
  booking: BookingItem
  confirmedServiceCount: number
  daysRemaining?: number
  progressPercent: number
  statusLabel: string
  totalActiveServiceCount: number
}

interface ClientHomeScreenProps {
  draftEvents?: ClientEventDraftSummary[]
  savedPlans?: ClientSavedPlanSummary[]
  bookingProgressEvents?: ClientBookingProgress[]
  recommendations?: HomeServiceRecommendation[]
  selectedServiceCount?: number
  userAvatarUrl?: string
  userName?: string
  searchValue?: string
  onChangeSearch?: (value: string) => void
  onDeleteDraft?: (draftId: string) => Promise<boolean | void> | boolean | void
  onOpenDraft?: (draftId: string) => void
  onOpenSavedPlan?: (savedPlanId: string) => void
  onOpenBookingProgress?: (booking: BookingItem) => void
  onStartNewEvent?: () => Promise<boolean | void> | boolean | void
  onOpenNotifications?: () => void
  onOpenProfile?: () => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onSeeAllVenues?: () => void
  onSelectRecommendation?: (serviceId: string) => void
  onSelectTab?: (tab: ClientHomeTab) => void
}

const formatDraftDate = (value: string) => {
  if (!value) return 'Date not set'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getDaysLeft = (value: string, now = new Date()) => {
  if (!value) return null

  const eventDate = new Date(`${value}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(eventDate.getTime())) return null
  return Math.ceil((eventDate.getTime() - today.getTime()) / 86_400_000)
}

const formatSavedAt = (value: string) => {
  const savedAt = new Date(value)
  if (Number.isNaN(savedAt.getTime())) return 'Recently saved'
  return savedAt.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const getClientBookingProgress = (
  bookings: BookingItem[],
  now = new Date()
): ClientBookingProgress[] => bookings.flatMap((booking) => {
  if (['cancelled', 'completed'].includes(booking.rawStatus ?? '')) return []
  const activeServices = (booking.services ?? []).filter(
    (service) => !['cancelled', 'declined'].includes(service.status)
  )
  if (!activeServices.length) return []

  const confirmedServiceCount = activeServices.filter(
    (service) => ['confirmed', 'completed'].includes(service.status)
  ).length
  const totalActiveServiceCount = activeServices.length
  const progressPercent = Math.round((confirmedServiceCount / totalActiveServiceCount) * 100)
  const daysRemaining = getDaysLeft(booking.date, now)
  const statusLabel = daysRemaining === 0
    ? 'Event is today'
    : daysRemaining !== null && daysRemaining < 0
      ? booking.status === 'completed' ? 'Completed' : 'Event date has passed'
      : confirmedServiceCount === totalActiveServiceCount
        ? 'All active providers confirmed'
        : `${totalActiveServiceCount - confirmedServiceCount} provider${totalActiveServiceCount - confirmedServiceCount === 1 ? '' : 's'} awaiting confirmation`

  return [{
    booking,
    confirmedServiceCount,
    daysRemaining: daysRemaining === null ? undefined : daysRemaining,
    progressPercent,
    statusLabel,
    totalActiveServiceCount,
  }]
}).sort((left, right) => {
  const nowStart = new Date(now)
  nowStart.setHours(0, 0, 0, 0)
  const dateTime = (booking: BookingItem) => {
    const date = new Date(`${booking.date}T00:00:00`).getTime()
    return Number.isFinite(date) ? date : Number.POSITIVE_INFINITY
  }
  const leftTime = dateTime(left.booking)
  const rightTime = dateTime(right.booking)
  const leftUpcoming = leftTime >= nowStart.getTime()
  const rightUpcoming = rightTime >= nowStart.getTime()

  // Put the next event first. Any unresolved past or date-less event remains
  // visible after upcoming events instead of displacing the imminent booking.
  if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1
  if (leftUpcoming) return leftTime - rightTime
  return rightTime - leftTime
})

export const ClientHomeScreen: React.FC<ClientHomeScreenProps> = ({
  draftEvents = [],
  savedPlans = [],
  bookingProgressEvents = [],
  recommendations = [],
  onDeleteDraft,
  onOpenDraft,
  onOpenSavedPlan,
  onOpenBookingProgress,
  onOpenNotifications,
  onOpenProfile,
  onScrollDirectionChange,
  onSeeAllVenues,
  onSelectRecommendation,
  onStartNewEvent,
  userAvatarUrl,
  userName,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const lastScrollY = React.useRef(0)
  const [isDraftPromptVisible, setIsDraftPromptVisible] = React.useState(false)
  const [isStartingNewEvent, setIsStartingNewEvent] = React.useState(false)
  const [showAllDrafts, setShowAllDrafts] = React.useState(false)
  const [showAllSavedPlans, setShowAllSavedPlans] = React.useState(false)
  const [showAllBookingProgress, setShowAllBookingProgress] = React.useState(false)
  const [draftPendingDeletion, setDraftPendingDeletion] = React.useState<ClientEventDraftSummary>()
  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false)
  const visibleDrafts = showAllDrafts ? draftEvents : draftEvents.slice(0, 1)
  const visibleSavedPlans = showAllSavedPlans ? savedPlans : savedPlans.slice(0, 1)
  const hasAdditionalDrafts = draftEvents.length > 1
  const hasAdditionalSavedPlans = savedPlans.length > 1
  const visibleBookingProgress = showAllBookingProgress
    ? bookingProgressEvents
    : bookingProgressEvents.slice(0, 3)
  const hasAdditionalBookingProgress = bookingProgressEvents.length > 3
  const draftEvent = visibleDrafts[0]
  const onOpenActiveEvent = () => {
    if (draftEvent) onOpenDraft?.(draftEvent.id)
  }
  const daysLeft = draftEvent ? getDaysLeft(draftEvent.eventDate) : null

  const handleCreateEventPress = () => {
    if (draftEvents.length > 0) {
      setIsDraftPromptVisible(true)
      return
    }

    void onStartNewEvent?.()
  }

  const handleStartNewEvent = async () => {
    if (isStartingNewEvent) return
    setIsStartingNewEvent(true)
    const started = await onStartNewEvent?.()
    setIsStartingNewEvent(false)
    if (started !== false) setIsDraftPromptVisible(false)
  }

  const handleDeleteDraft = async () => {
    if (!draftPendingDeletion || isDeletingDraft) return
    setIsDeletingDraft(true)
    const deleted = await onDeleteDraft?.(draftPendingDeletion.id)
    setIsDeletingDraft(false)
    if (deleted !== false) setDraftPendingDeletion(undefined)
  }

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
              {userAvatarUrl ? (
                <Image
                  accessibilityLabel={`${userName || 'User'} profile photo`}
                  resizeMode="cover"
                  source={{ uri: userAvatarUrl }}
                  style={styles.referenceAvatarImage}
                />
              ) : (
                <MaterialIcons name="account-circle" size={34} color="#8A2944" />
              )}
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
              onPress={handleCreateEventPress}
              style={({ pressed }) => [styles.heroButton, pressed && styles.referencePressed]}
            >
              <Text style={styles.heroButtonText}>Create Event</Text>
              <Text style={styles.heroButtonArrow}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.referenceSection}>
          <View style={styles.referenceSectionHeader}>
            <View>
              <Text style={styles.referenceSectionTitle}>CONTINUE PLANNING</Text>
              <Text style={styles.referenceSectionSubtitle}>Your most recently updated event drafts</Text>
            </View>
            {hasAdditionalDrafts ? (
              <Pressable
                accessibilityLabel={showAllDrafts ? 'Collapse event drafts' : 'Expand event drafts'}
                accessibilityRole="button"
                onPress={() => setShowAllDrafts((current) => !current)}
              >
                <Text style={styles.exploreAll}>{showAllDrafts ? 'Collapse Drafts' : 'Expand Drafts'}</Text>
              </Pressable>
            ) : null}
          </View>
          {draftEvent ? (
            <View style={styles.draftCardGroup}>
              <Pressable
                accessibilityLabel={`Continue planning ${draftEvent.name}`}
                accessibilityRole="button"
                onPress={onOpenActiveEvent}
                style={({ pressed }) => [
                  styles.activeEventCard,
                  styles.draftEventCard,
                  pressed && styles.referencePressed,
                ]}
              >
              <View style={styles.activeEventHeader}>
                <View style={styles.activeEventHeading}>
                  <Text style={styles.activeEventEyebrow}>• DRAFT IN PROGRESS</Text>
                  <Text numberOfLines={1} style={styles.activeEventTitle}>{draftEvent.name}</Text>
                  <View style={styles.activeEventMetaRow}>
                    <MaterialIcons name="location-on" size={14} color="#7C7271" />
                    <Text numberOfLines={1} style={styles.activeEventMeta}>
                      {draftEvent.location || 'Venue not set'} · {formatDraftDate(draftEvent.eventDate)}
                    </Text>
                  </View>
                </View>
                <View style={styles.daysBadge}>
                  <Text style={styles.daysValue}>{daysLeft ?? '—'}</Text>
                  <Text style={styles.daysLabel}>{daysLeft === 1 ? 'DAY LEFT' : 'DAYS LEFT'}</Text>
                </View>
              </View>
              <View style={styles.milestoneRow}>
                <Text style={styles.milestoneLabel}>Planning progress</Text>
                <Text style={styles.milestoneValue}>
                  {draftEvent.progressPercent}%{' '}
                  <Text style={styles.milestoneMuted}>
                    ({draftEvent.completedSteps} of {draftEvent.totalSteps} steps)
                  </Text>
                </Text>
              </View>
              <View style={styles.milestoneTrack}>
                <View style={[styles.milestoneFill, { width: `${draftEvent.progressPercent}%` }]} />
              </View>
              <View style={styles.nextTaskRow}>
                <Text numberOfLines={1} style={styles.nextTask}>Next: {draftEvent.nextStep}</Text>
                <Text style={styles.nextTaskLink}>Continue <Text style={styles.nextTaskArrow}>→</Text></Text>
              </View>
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete draft ${draftEvent.name}`}
                accessibilityRole="button"
                onPress={() => setDraftPendingDeletion(draftEvent)}
                style={({ pressed }) => [styles.deleteDraftButton, pressed && styles.referencePressed]}
              >
                <MaterialIcons color="#8A2944" name="delete-outline" size={17} />
                <Text style={styles.deleteDraftButtonText}>Delete Draft</Text>
              </Pressable>
            </View>
          ) : null}
          {visibleDrafts.slice(1).map((draft) => (
            <View key={draft.id} style={styles.compactDraftGroup}>
              <Pressable
              key={draft.id}
              accessibilityLabel={`Resume planning ${draft.name}`}
              accessibilityRole="button"
              onPress={() => onOpenDraft?.(draft.id)}
              style={({ pressed }) => [styles.compactDraftCard, pressed && styles.referencePressed]}
            >
              <View style={styles.compactDraftCopy}>
                <Text numberOfLines={1} style={styles.compactDraftName}>{draft.name}</Text>
                <Text numberOfLines={1} style={styles.compactDraftMeta}>
                  {formatDraftDate(draft.eventDate)} · Next: {draft.nextStep}
                </Text>
              </View>
              <Text style={styles.compactDraftAction}>Resume →</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete draft ${draft.name}`}
                accessibilityRole="button"
                onPress={() => setDraftPendingDeletion(draft)}
                style={({ pressed }) => [styles.compactDraftDeleteButton, pressed && styles.referencePressed]}
              >
                <MaterialIcons color="#8A2944" name="delete-outline" size={18} />
              </Pressable>
            </View>
          ))}
          {!draftEvent ? (
            <View style={styles.emptyDraftState}>
              <MaterialIcons name="event-note" size={24} color="#8A2944" />
              <View style={styles.emptyDraftCopy}>
                <Text style={styles.emptyDraftTitle}>No saved drafts yet</Text>
                <Text style={styles.emptyDraftText}>Create an event to begin planning your celebration.</Text>
              </View>
            </View>
          ) : null}
        </View>

        {savedPlans.length > 0 && (
          <View style={styles.referenceSection}>
            <View style={styles.referenceSectionHeader}>
              <View>
                <Text style={styles.referenceSectionTitle}>SAVED PLANS</Text>
                <Text style={styles.referenceSectionSubtitle}>Ready to review and book when you are</Text>
              </View>
              {hasAdditionalSavedPlans ? (
                <Pressable
                  accessibilityLabel={showAllSavedPlans ? 'Collapse saved plans' : 'Expand saved plans'}
                  accessibilityRole="button"
                  onPress={() => setShowAllSavedPlans((current) => !current)}
                >
                  <Text style={styles.exploreAll}>
                    {showAllSavedPlans ? 'Show less' : `Show all (${savedPlans.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {visibleSavedPlans.map((savedPlan) => (
              <Pressable
                key={savedPlan.id}
                accessibilityLabel={`Resume booking for saved plan ${savedPlan.name}`}
                accessibilityRole="button"
                onPress={() => onOpenSavedPlan?.(savedPlan.id)}
                style={({ pressed }) => [styles.savedPlanCard, pressed && styles.referencePressed]}
              >
                <View style={styles.savedPlanHeading}>
                  <View style={styles.savedPlanCopy}>
                    <Text style={styles.savedPlanEyebrow}>SAVED FOR LATER</Text>
                    <Text numberOfLines={1} style={styles.savedPlanName}>{savedPlan.name}</Text>
                    <Text numberOfLines={1} style={styles.savedPlanDate}>
                      {formatDraftDate(savedPlan.eventDate)} · Last saved {formatSavedAt(savedPlan.savedAt)}
                    </Text>
                  </View>
                  <View style={styles.savedPlanEstimate}>
                    <Text style={styles.savedPlanEstimateLabel}>ESTIMATE</Text>
                    <Text style={styles.savedPlanEstimateValue}>{formatPeso(savedPlan.estimatedTotal)}</Text>
                  </View>
                </View>
                <View style={styles.savedPlanFooter}>
                  <Text style={styles.savedPlanServiceCount}>
                    {savedPlan.selectedServiceCount} selected service{savedPlan.selectedServiceCount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.savedPlanResume}>Resume Booking →</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.referenceSection}>
          <View style={styles.referenceSectionHeader}>
            <View>
              <Text style={styles.referenceSectionTitle}>YOUR EVENT BOOKINGS</Text>
              <Text style={styles.referenceSectionSubtitle}>Active provider confirmation progress</Text>
            </View>
            {hasAdditionalBookingProgress ? (
              <Pressable
                accessibilityLabel={showAllBookingProgress ? 'Collapse event bookings' : 'Expand event bookings'}
                accessibilityRole="button"
                onPress={() => setShowAllBookingProgress((current) => !current)}
                style={styles.bookingDropdown}
              >
                <Text style={styles.exploreAll}>
                  {showAllBookingProgress ? 'Show less' : `Show all (${bookingProgressEvents.length})`}
                </Text>
                <MaterialIcons
                  color="#8A2944"
                  name={showAllBookingProgress ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={19}
                />
              </Pressable>
            ) : null}
          </View>
          {visibleBookingProgress.length ? visibleBookingProgress.map((progress) => (
            <Pressable
              key={progress.booking.id}
              accessibilityLabel={`View booking details for ${progress.booking.name}`}
              accessibilityRole="button"
              onPress={() => onOpenBookingProgress?.(progress.booking)}
              style={({ pressed }) => [styles.bookingProgressCard, pressed && styles.referencePressed]}
            >
              <View style={styles.bookingProgressHeading}>
                <View style={styles.bookingProgressCopy}>
                  <Text numberOfLines={1} style={styles.bookingProgressName}>{progress.booking.name}</Text>
                  <Text style={styles.bookingProgressDate}>{formatDraftDate(progress.booking.date)}</Text>
                </View>
                <View style={styles.bookingProgressBadge}>
                  <Text style={styles.bookingProgressBadgeText}>
                    {progress.daysRemaining === undefined
                      ? 'Date pending'
                      : progress.daysRemaining < 0
                        ? 'Past event'
                        : progress.daysRemaining === 0
                          ? 'Today'
                          : `${progress.daysRemaining} day${progress.daysRemaining === 1 ? '' : 's'} left`}
                  </Text>
                </View>
              </View>
              <View style={styles.bookingProgressMetrics}>
                <Text style={styles.bookingProgressStatus}>{progress.statusLabel}</Text>
                <Text style={styles.bookingProgressCount}>
                  {progress.confirmedServiceCount} of {progress.totalActiveServiceCount} providers confirmed
                </Text>
              </View>
              <View style={styles.bookingProgressTrack}>
                <View style={[styles.bookingProgressFill, { width: `${progress.progressPercent}%` }]} />
              </View>
              <Text style={styles.bookingProgressLink}>View Booking Details →</Text>
            </Pressable>
          )) : (
            <View style={styles.emptyDraftState}>
              <MaterialIcons name="event-available" size={24} color="#8A2944" />
              <View style={styles.emptyDraftCopy}>
                <Text style={styles.emptyDraftTitle}>No active bookings yet</Text>
                <Text style={styles.emptyDraftText}>Provider confirmations for your active events will appear here.</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.referenceSection}>
          <View style={styles.referenceSectionHeader}>
            <View><Text style={styles.referenceSectionTitle}>RECOMMENDED FOR YOU<Text style={styles.sectionDot}></Text></Text><Text style={styles.referenceSectionSubtitle}>Based on confirmed bookings and reliable client reviews</Text></View>
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
                key={recommendation.service.id}
                accessibilityLabel={`Open ${recommendation.service.name}`}
                accessibilityRole="button"
                onPress={() => onSelectRecommendation?.(recommendation.service.id)}
                style={({ pressed }) => [styles.referenceVenueCard, { width: isWide ? 324 : Math.max(252, width - 56) }, pressed && styles.referencePressed]}
              >
                <View style={styles.referenceVenueImageWrap}>
                  {recommendation.service.imageUrl ? (
                    <Image accessibilityLabel={recommendation.service.imageLabel} resizeMode="cover" source={{ uri: recommendation.service.imageUrl }} style={styles.referenceVenueImage} />
                  ) : (
                    <View style={styles.recommendationImageFallback}><MaterialIcons name="image" size={30} color="#8A2944" /></View>
                  )}
                  <View style={styles.venueBadge}><Text style={styles.venueBadgeText}>{recommendation.indicator}</Text></View>
                </View>
                <Text numberOfLines={1} style={styles.referenceVenueTitle}>{recommendation.service.name}</Text>
                <Text numberOfLines={1} style={styles.referenceVenueMeta}>{recommendation.service.categoryName} · {recommendation.service.providerName}</Text>
                <Text numberOfLines={2} style={styles.homeRecommendationDescription}>{recommendation.service.description}</Text>
                <View style={styles.referenceVenueFooter}><Text style={styles.referenceVenuePrice}>{formatServicePrice(recommendation.service)}</Text><Text style={styles.referenceVenueAction}>{recommendation.service.reviewCount > 0 ? `${recommendation.service.rating} ★ (${recommendation.service.reviewCount})` : 'New'}</Text></View>
              </Pressable>
            ))}
            {recommendations.length === 0 ? (
              <View style={styles.emptyRecommendationState}>
                <Text style={styles.emptyDraftTitle}>Recommendations will appear here</Text>
                <Text style={styles.emptyDraftText}>Published services become available as providers join MULTIVENT.</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>

      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsDraftPromptVisible(false)}
        transparent
        visible={isDraftPromptVisible}
      >
        <View style={styles.draftPromptBackdrop}>
          <View accessibilityViewIsModal style={styles.draftPromptCard}>
            <View style={styles.draftPromptIcon}>
              <MaterialIcons name="event-note" size={25} color={palette.primary} />
            </View>
            <Text style={styles.draftPromptTitle}>You have saved event drafts</Text>
            <Text style={styles.draftPromptCopy}>
              Your saved drafts will stay available. You can resume the latest one or create another event.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsDraftPromptVisible(false)
                onOpenActiveEvent()
              }}
              style={({ pressed }) => [styles.draftPromptPrimary, pressed && styles.referencePressed]}
            >
              <Text style={styles.draftPromptPrimaryText}>Resume Latest Draft</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isStartingNewEvent}
              onPress={() => void handleStartNewEvent()}
              style={({ pressed }) => [styles.draftPromptSecondary, pressed && styles.referencePressed]}
            >
              <Text style={styles.draftPromptSecondaryText}>
                {isStartingNewEvent ? 'Starting…' : 'Start New Event'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsDraftPromptVisible(false)}
              style={styles.draftPromptCancel}
            >
              <Text style={styles.draftPromptCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => !isDeletingDraft && setDraftPendingDeletion(undefined)}
        transparent
        visible={Boolean(draftPendingDeletion)}
      >
        <View style={styles.draftPromptBackdrop}>
          <View accessibilityViewIsModal style={styles.draftPromptCard}>
            <View style={styles.draftPromptIcon}>
              <MaterialIcons name="delete-outline" size={25} color={palette.primary} />
            </View>
            <Text style={styles.draftPromptTitle}>Delete this draft?</Text>
            <Text style={styles.draftPromptCopy}>
              {draftPendingDeletion?.name || 'This event'} will be removed from your drafts. Bookings are never deleted from this action.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isDeletingDraft}
              onPress={() => void handleDeleteDraft()}
              style={({ pressed }) => [styles.draftPromptPrimary, pressed && styles.referencePressed]}
            >
              <Text style={styles.draftPromptPrimaryText}>
                {isDeletingDraft ? 'Deleting…' : 'Delete Draft'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeletingDraft}
              onPress={() => setDraftPendingDeletion(undefined)}
              style={styles.draftPromptCancel}
            >
              <Text style={styles.draftPromptCancelText}>Keep Draft</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  referenceAvatarImage: { width: '100%', height: '100%', borderRadius: 19 },
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
  draftEventCard: {
    marginBottom: 10,
  },
  draftCardGroup: { marginBottom: 10 },
  savedPlanCard: {
    borderWidth: 1,
    borderColor: '#DCC4C9',
    borderRadius: 9,
    backgroundColor: '#FFFDFD',
    padding: 12,
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  savedPlanHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  savedPlanCopy: { flex: 1, minWidth: 0 },
  savedPlanEyebrow: { color: '#8A2944', fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.7 },
  savedPlanName: { color: '#241E1E', fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 2 },
  savedPlanDate: { color: '#7C7271', fontSize: 11, lineHeight: 16, marginTop: 2 },
  savedPlanEstimate: { alignItems: 'flex-end' },
  savedPlanEstimateLabel: { color: '#7C7271', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 },
  savedPlanEstimateValue: { color: '#8A2944', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 1 },
  savedPlanFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  savedPlanServiceCount: { flex: 1, color: '#7C7271', fontSize: 11, lineHeight: 16 },
  savedPlanResume: { color: '#8A2944', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  deleteDraftButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  deleteDraftButtonText: { color: '#8A2944', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  compactDraftGroup: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  compactDraftCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4D9D5',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  compactDraftCopy: { flex: 1, minWidth: 0 },
  compactDraftName: { color: '#241E1E', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  compactDraftMeta: { color: '#7C7271', fontSize: 11, lineHeight: 15, marginTop: 2 },
  compactDraftAction: { color: '#8A2944', fontSize: 12, fontWeight: '700' },
  compactDraftDeleteButton: { padding: 8 },
  bookingDropdown: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  bookingProgressCard: { borderWidth: 1, borderColor: '#E4D9D5', borderRadius: 9, backgroundColor: '#FFFFFF', marginBottom: 9, padding: 12, shadowColor: '#5B1B2C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  bookingProgressHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  bookingProgressCopy: { flex: 1, minWidth: 0 },
  bookingProgressName: { color: '#241E1E', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  bookingProgressDate: { color: '#7C7271', fontSize: 11, lineHeight: 16, marginTop: 2 },
  bookingProgressBadge: { borderRadius: 11, backgroundColor: '#F8EDEF', paddingHorizontal: 8, paddingVertical: 4 },
  bookingProgressBadgeText: { color: '#8A2944', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  bookingProgressMetrics: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 11 },
  bookingProgressStatus: { flex: 1, color: '#7C7271', fontSize: 11, lineHeight: 16 },
  bookingProgressCount: { color: '#8A2944', fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'right' },
  bookingProgressTrack: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: '#E8DDE0', marginTop: 8 },
  bookingProgressFill: { height: '100%', backgroundColor: '#8A2944' },
  bookingProgressLink: { color: '#8A2944', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 9 },
  emptyDraftState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4D9D5',
    borderRadius: 9,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  emptyDraftCopy: { flex: 1 },
  emptyDraftTitle: { color: '#2B2323', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  emptyDraftText: { color: '#7C7271', fontSize: 11, lineHeight: 16, marginTop: 2 },
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
    minWidth: 0,
    flex: 1,
    color: '#7C7271',
    fontSize: 12,
    lineHeight: 16,
  },
  activeEventMetaRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
  draftPromptBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 18, 21, 0.52)',
    padding: 24,
  },
  draftPromptCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    shadowColor: '#2B1018',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  draftPromptIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#F8EDEF',
    marginBottom: 12,
  },
  draftPromptTitle: {
    color: '#241E1E',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  draftPromptCopy: {
    color: '#6F6463',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 18,
  },
  draftPromptPrimary: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#701B30',
  },
  draftPromptPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  draftPromptSecondary: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#8A2944',
    borderRadius: 10,
    marginTop: 10,
  },
  draftPromptSecondaryText: {
    color: '#701B30',
    fontSize: 14,
    fontWeight: '700',
  },
  draftPromptCancel: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  draftPromptCancelText: {
    color: '#7C7271',
    fontSize: 13,
    fontWeight: '600',
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
  recommendationImageFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
  homeRecommendationDescription: {
    color: '#6F6463',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 5,
    paddingHorizontal: 9,
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
  emptyRecommendationState: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4D9D5',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 128,
    padding: 16,
    width: 260,
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
