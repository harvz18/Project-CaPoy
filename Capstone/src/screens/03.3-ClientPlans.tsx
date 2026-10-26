import { MaterialIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'

import { Text } from '../components/AppText'
import { BrandIdentity } from '../components/BrandIdentity'
import { formatPeso } from '../lib/catalog'
import type { ClientEventDraftSummary, ClientSavedPlanSummary } from '../lib/planning'

type ClientPlansScreenProps = {
  draftEvents?: ClientEventDraftSummary[]
  savedPlans?: ClientSavedPlanSummary[]
  onBack: () => void
  onDeleteDraft?: (draftId: string) => Promise<boolean | void> | boolean | void
  onOpenDraft?: (draftId: string) => void
  onOpenSavedPlan?: (savedPlanId: string) => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onStartNewEvent?: () => Promise<boolean | void> | boolean | void
}

const formatDate = (value: string) => {
  if (!value) return 'Date not set'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

export const ClientPlansScreen: React.FC<ClientPlansScreenProps> = ({
  draftEvents = [],
  savedPlans = [],
  onBack,
  onDeleteDraft,
  onOpenDraft,
  onOpenSavedPlan,
  onScrollDirectionChange,
  onStartNewEvent,
}) => {
  const [draftPendingDeletion, setDraftPendingDeletion] = React.useState<ClientEventDraftSummary>()
  const [isDeletingDraft, setIsDeletingDraft] = React.useState(false)
  const [isStartingNewEvent, setIsStartingNewEvent] = React.useState(false)
  const lastScrollY = React.useRef(0)
  const latestDraft = draftEvents[0]

  const handleDeleteDraft = async () => {
    if (!draftPendingDeletion || isDeletingDraft) return

    setIsDeletingDraft(true)
    const deleted = await onDeleteDraft?.(draftPendingDeletion.id)
    setIsDeletingDraft(false)
    if (deleted !== false) setDraftPendingDeletion(undefined)
  }

  const handleStartNewEvent = async () => {
    if (isStartingNewEvent) return

    setIsStartingNewEvent(true)
    await onStartNewEvent?.()
    setIsStartingNewEvent(false)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to home"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialIcons color="#FFFFFF" name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.headerBrand}>
          <BrandIdentity markSize={28} showName={false} variant="metallicWordmark" />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current

          if (Math.abs(delta) >= 4) {
            onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
            lastScrollY.current = scrollY
          }
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Plans & Drafts</Text>
          <Text style={styles.pageSubtitle}>
            Pick up where you left off or review plans saved for later.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>DRAFTS</Text>
              <Text style={styles.sectionSubtitle}>Events that are still being planned</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{latestDraft ? 1 : 0}</Text>
            </View>
          </View>

          {latestDraft ? (
            <View style={styles.draftCard}>
              <Pressable
                accessibilityLabel={`Continue planning ${latestDraft.name}`}
                accessibilityRole="button"
                onPress={() => onOpenDraft?.(latestDraft.id)}
                style={({ pressed }) => [styles.cardPressTarget, pressed && styles.pressed]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.draftEyebrow}>DRAFT IN PROGRESS</Text>
                    <Text numberOfLines={1} style={styles.cardTitle}>{latestDraft.name}</Text>
                    <View style={styles.metaRow}>
                      <MaterialIcons color="#7C7271" name="location-on" size={14} />
                      <Text numberOfLines={1} style={styles.metaText}>
                        {latestDraft.location || 'Venue not set'} · {formatDate(latestDraft.eventDate)}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons color="#8A2944" name="chevron-right" size={23} />
                </View>

                <View style={styles.progressLabels}>
                  <Text style={styles.progressLabel}>Planning progress</Text>
                  <Text style={styles.progressValue}>
                    {latestDraft.progressPercent}% ({latestDraft.completedSteps}/{latestDraft.totalSteps})
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${latestDraft.progressPercent}%` }]} />
                </View>
                <Text numberOfLines={1} style={styles.nextStep}>Next: {latestDraft.nextStep}</Text>
              </Pressable>

              <Pressable
                accessibilityLabel={`Delete draft ${latestDraft.name}`}
                accessibilityRole="button"
                onPress={() => setDraftPendingDeletion(latestDraft)}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              >
                <MaterialIcons color="#8A2944" name="delete-outline" size={17} />
                <Text style={styles.deleteButtonText}>Delete draft</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons color="#8A2944" name="event-note" size={23} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>No drafts yet</Text>
                <Text style={styles.emptyText}>Start an event and your progress will be saved automatically.</Text>
              </View>
              <Pressable
                accessibilityLabel="Create event"
                accessibilityRole="button"
                disabled={isStartingNewEvent}
                onPress={() => void handleStartNewEvent()}
                style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
              >
                {isStartingNewEvent ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Create event</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>SAVED PLANS</Text>
              <Text style={styles.sectionSubtitle}>Ready to review and book when you are</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{savedPlans.length}</Text>
            </View>
          </View>

          {savedPlans.length ? savedPlans.map((savedPlan) => (
            <Pressable
              key={savedPlan.id}
              accessibilityLabel={`Resume booking for saved plan ${savedPlan.name}`}
              accessibilityRole="button"
              onPress={() => onOpenSavedPlan?.(savedPlan.id)}
              style={({ pressed }) => [styles.savedPlanCard, pressed && styles.pressed]}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardCopy}>
                  <Text style={styles.savedEyebrow}>SAVED FOR LATER</Text>
                  <Text numberOfLines={1} style={styles.cardTitle}>{savedPlan.name}</Text>
                  <Text numberOfLines={1} style={styles.metaText}>
                    {formatDate(savedPlan.eventDate)} · Last saved {formatSavedAt(savedPlan.savedAt)}
                  </Text>
                </View>
                <View style={styles.estimateBlock}>
                  <Text style={styles.estimateLabel}>ESTIMATE</Text>
                  <Text style={styles.estimateValue}>{formatPeso(savedPlan.estimatedTotal)}</Text>
                </View>
              </View>
              <View style={styles.savedPlanFooter}>
                <Text style={styles.serviceCount}>
                  {savedPlan.selectedServiceCount} selected service{savedPlan.selectedServiceCount === 1 ? '' : 's'}
                </Text>
                <Text style={styles.resumeLabel}>Resume booking</Text>
              </View>
            </Pressable>
          )) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons color="#8A2944" name="bookmark-border" size={23} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>No saved plans yet</Text>
                <Text style={styles.emptyText}>Plans you save for later will appear here for a safe recheck before booking.</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!isDeletingDraft) setDraftPendingDeletion(undefined)
        }}
        transparent
        visible={Boolean(draftPendingDeletion)}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialIcons color="#8A2944" name="delete-outline" size={25} />
            </View>
            <Text style={styles.modalTitle}>Delete this draft?</Text>
            <Text style={styles.modalCopy}>
              {draftPendingDeletion?.name || 'This event'} will be removed from your drafts. Bookings are never deleted from this action.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isDeletingDraft}
              onPress={() => void handleDeleteDraft()}
              style={({ pressed }) => [styles.modalPrimaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.modalPrimaryText}>{isDeletingDraft ? 'Deleting...' : 'Delete draft'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeletingDraft}
              onPress={() => setDraftPendingDeletion(undefined)}
              style={styles.modalSecondaryButton}
            >
              <Text style={styles.modalSecondaryText}>Keep draft</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F3',
  },
  header: {
    minHeight: 64,
    alignItems: 'center',
    borderBottomColor: '#4E061A',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#6B1E2E',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerBrand: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 112,
  },
  pageHeading: { marginBottom: 22 },
  pageTitle: {
    color: '#2B2323',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  pageSubtitle: {
    color: '#7C7271',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  section: { marginBottom: 22 },
  sectionHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  sectionTitle: {
    color: '#2B2323',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.35,
    lineHeight: 17,
  },
  sectionSubtitle: {
    color: '#847977',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 24,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F2E6E8',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  countText: {
    color: '#8A2944',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  draftCard: {
    overflow: 'hidden',
    borderColor: '#E4D9D5',
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
  },
  cardPressTarget: { padding: 13 },
  cardTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardCopy: { flex: 1, minWidth: 0 },
  draftEyebrow: {
    color: '#8A2944',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    lineHeight: 14,
  },
  savedEyebrow: {
    color: '#8A2944',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    lineHeight: 14,
  },
  cardTitle: {
    color: '#241E1E',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  metaRow: {
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  metaText: {
    flex: 1,
    color: '#7C7271',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  progressLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  progressLabel: { color: '#847977', fontSize: 11, lineHeight: 15 },
  progressValue: { color: '#8A2944', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#E8DDE0',
    marginTop: 6,
  },
  progressFill: { height: '100%', backgroundColor: '#8A2944' },
  nextStep: { color: '#7C7271', fontSize: 11, lineHeight: 16, marginTop: 9 },
  deleteButton: {
    alignItems: 'center',
    borderTopColor: '#F0E8E6',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'flex-end',
    minHeight: 38,
    paddingHorizontal: 13,
  },
  deleteButtonText: { color: '#8A2944', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  savedPlanCard: {
    borderColor: '#DCC4C9',
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFDFD',
    marginBottom: 10,
    padding: 13,
    shadowColor: '#5B1B2C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1,
  },
  estimateBlock: { alignItems: 'flex-end', flexShrink: 0 },
  estimateLabel: { color: '#7C7271', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, lineHeight: 12 },
  estimateValue: { color: '#8A2944', fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 1 },
  savedPlanFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 13,
  },
  serviceCount: { color: '#7C7271', flex: 1, fontSize: 11, lineHeight: 16 },
  resumeLabel: { color: '#8A2944', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  emptyState: {
    alignItems: 'center',
    borderColor: '#E4D9D5',
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F8EDEF',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1, minWidth: 0 },
  emptyTitle: { color: '#2B2323', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  emptyText: { color: '#7C7271', fontSize: 11, lineHeight: 16, marginTop: 2 },
  createButton: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#701B30',
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 18, 21, 0.52)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
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
  modalIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#F8EDEF',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: { color: '#241E1E', fontSize: 19, fontWeight: '700', lineHeight: 25, textAlign: 'center' },
  modalCopy: { color: '#6F6463', fontSize: 14, lineHeight: 21, marginBottom: 18, marginTop: 7, textAlign: 'center' },
  modalPrimaryButton: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#701B30',
    justifyContent: 'center',
  },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  modalSecondaryButton: { paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  modalSecondaryText: { color: '#7C7271', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
})
