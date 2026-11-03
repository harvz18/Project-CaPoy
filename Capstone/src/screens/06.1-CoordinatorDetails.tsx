import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { Text } from '../components/AppText'
import { PublishedBusinessPolicies } from '../components/BusinessPolicies'
import { ReviewFeedbackSummary } from '../components/ReviewFeedbackSummary'
import { formatPeso, type CatalogService } from '../lib/catalog'
import { summarizeRatingFeedback } from '../lib/reviews'
import { typography } from '../theme/typography'

interface CoordinatorDetailsScreenProps {
  assigning?: boolean
  coordinatorBookingEnabled?: boolean
  isAssigned?: boolean
  mode?: 'explore' | 'planning'
  onBack?: () => void
  onSelectProvider?: () => void
  presentation?: 'overlay' | 'screen'
  showProfileImage?: boolean
  service?: CatalogService
}

const initialsFrom = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'

const ItemList = ({ isRaised = false, values }: { isRaised?: boolean; values: string[] }) => (
  <View style={styles.pillList}>
    {values.map((value) => <View key={value} style={[styles.pill, isRaised && styles.neoRaisedPill]}><Text style={styles.pillText}>{value}</Text></View>)}
  </View>
)

export const CoordinatorDetailsScreen: React.FC<CoordinatorDetailsScreenProps> = ({
  assigning = false,
  coordinatorBookingEnabled = false,
  isAssigned = false,
  mode = 'planning',
  onBack,
  onSelectProvider,
  presentation = 'screen',
  showProfileImage = true,
  service,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isOverlay = presentation === 'overlay'
  const name = service?.name ?? 'Event Coordinator'
  const canAssign = mode === 'planning'
    && coordinatorBookingEnabled
    && Boolean(service?.coordinatorUserId)
  const isAvailable = service?.coordinatorAvailable !== false
  const reviewInsights = React.useMemo(
    () => summarizeRatingFeedback(service?.coordinatorReviews ?? []),
    [service?.coordinatorReviews]
  )
  const specialties = service?.coordinatorSpecializations ?? []
  const skills = service?.coordinatorSkills ?? []
  const capabilities = service?.coordinatorCapabilities ?? []
  const certifications = service?.coordinatorCertifications ?? []
  const specialtyGroups = [
    { label: 'Specialties', values: specialties },
    { label: 'Skills', values: skills },
    { label: 'Capabilities', values: capabilities },
    { label: 'Certifications', values: certifications },
  ].filter((group) => group.values.length > 0)
  const eventTypes = service?.coordinatorEventTypesHandled ?? []
  const inclusions = service?.coordinatorServiceInclusions ?? []

  return (
    <View style={[styles.screen, isOverlay && styles.overlayScreen]}>
      {!isOverlay ? (
        <View style={styles.topBar}>
          <View style={[styles.topBarContent, isWide && styles.horizontalWide]}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons color={palette.primary} name="arrow-left" size={24} />
            </Pressable>
            <Text style={styles.headerTitle}>Coordinator Profile</Text>
            <View style={styles.iconButton} />
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isOverlay && styles.overlayContent,
          isWide ? styles.horizontalWide : styles.horizontalMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.profileCard,
          showProfileImage && isWide && styles.profileCardWide,
          !showProfileImage && styles.profileCardWithoutAvatar,
          isOverlay && styles.neoRaisedCard,
        ]}>
          {showProfileImage && service?.imageUrl ? (
            <Image accessibilityLabel={service.imageLabel} resizeMode="cover" source={{ uri: service.imageUrl }} style={styles.avatar} />
          ) : showProfileImage ? (
            <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initialsFrom(name)}</Text></View>
          ) : null}
          <View style={styles.profileCopy}>
            {!isOverlay ? (
              <View style={styles.rolePill}>
                <MaterialCommunityIcons color={palette.primaryContainer} name="account-tie-outline" size={16} />
                <Text style={styles.rolePillText}>EVENT COORDINATOR</Text>
              </View>
            ) : null}
            <Text style={[styles.name, isOverlay && styles.overlayName]}>{name}</Text>
            <Text style={styles.subtitle}>
              {service?.description || 'This coordinator has not added a professional introduction yet.'}
            </Text>
            {service?.coordinatorYearsExperience || service?.coordinatorPortfolioSummary ? (
              <>
                <View style={styles.profileExperienceDivider} />
                <View style={styles.profileExperienceSection}>
                  <Text style={styles.profileExperienceHeader}>Experience</Text>
                  {service?.coordinatorYearsExperience ? (
                    <Text style={styles.experience}>{service.coordinatorYearsExperience} years of coordination experience</Text>
                  ) : null}
                  {service?.coordinatorPortfolioSummary ? <Text style={styles.profileExperience}>{service.coordinatorPortfolioSummary}</Text> : null}
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={[styles.sectionCard, isOverlay && styles.neoRaisedCard]}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-check-outline" size={22} />
            <Text style={styles.sectionTitle}>Pricing &amp; Availability</Text>
          </View>
          <View style={[styles.pricingRow, isOverlay && styles.neoRaisedPriceRow]}>
            <Text style={styles.pricingLabel}>Price Range</Text>
            <Text style={styles.pricingValue}>{formatPeso(service?.minPrice ?? 0)}</Text>
          </View>
          <Text style={isAvailable ? styles.available : styles.unavailable}>
            {isAvailable ? 'Available for the selected event schedule' : service?.coordinatorUnavailableReason || 'Unavailable for the selected event schedule'}
          </Text>
          {service?.coordinatorAvailabilityNotes ? <Text style={styles.sectionCopy}>{service.coordinatorAvailabilityNotes}</Text> : null}
        </View>

        <View style={[styles.detailCard, isOverlay && styles.neoRaisedCard]}>
          <View style={styles.detailHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-star-outline" size={23} />
            <Text numberOfLines={1} style={styles.detailTitle}>Events Handled</Text>
          </View>
          {eventTypes.length ? <ItemList isRaised={isOverlay} values={eventTypes} /> : <Text style={styles.detailCopy}>Event types have not been specified.</Text>}
        </View>

        <View style={[styles.sectionCard, isOverlay && styles.neoRaisedCard]}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="star-shooting-outline" size={22} />
            <Text style={styles.sectionTitle}>Skills &amp; Specialties</Text>
          </View>
          {specialtyGroups.map((group, index) => (
            <View key={group.label} style={[styles.specialtyGroup, index > 0 && styles.specialtyGroupDivider]}>
              <Text style={styles.listLabel}>{group.label}</Text>
              <ItemList isRaised={isOverlay} values={group.values} />
            </View>
          ))}
          {!specialtyGroups.length ? (
            <Text style={styles.sectionCopy}>Skills and specialties have not been specified yet.</Text>
          ) : null}
        </View>

        <View style={[styles.sectionCard, isOverlay && styles.neoRaisedCard]}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="clipboard-list-outline" size={22} />
            <Text style={styles.sectionTitle}>Services &amp; Inclusions</Text>
          </View>
          {inclusions.length ? <ItemList isRaised={isOverlay} values={inclusions} /> : <Text style={styles.sectionCopy}>Service inclusions have not been specified yet.</Text>}
        </View>

        <PublishedBusinessPolicies neumorphic={isOverlay} ownerId={service?.coordinatorUserId} />

        <View style={[styles.privacyCard, isOverlay && styles.neoRaisedInfoCard]}>
          <MaterialCommunityIcons color={isOverlay ? palette.primaryContainer : palette.success} name="shield-check-outline" size={22} />
          <View style={styles.privacyCopy}>
            <Text style={[styles.privacyTitle, isOverlay && styles.neoInfoTitle]}>Access is limited to this event</Text>
            <Text style={[styles.privacyText, isOverlay && styles.neoInfoText]}>The coordinator receives a booking request first. Event, booking, and provider details are shared only after acceptance.</Text>
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeading}>
            <View><Text style={styles.reviewsTitle}>Reviews &amp; feedback</Text></View>
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingValue}>{reviewInsights.totalRatings ? reviewInsights.averageRating.toFixed(1) : 'New'}</Text>
            </View>
          </View>
          <ReviewFeedbackSummary insights={reviewInsights} isWide={isWide} neumorphic={isOverlay} showReviewComments />
        </View>
      </ScrollView>

      {canAssign ? <View style={styles.actionBar}>
        <Pressable
          accessibilityLabel={isAssigned ? `${name} is already selected` : `Select ${name} for this event`}
          accessibilityRole="button"
          accessibilityState={{ disabled: assigning || isAssigned || !isAvailable }}
          disabled={assigning || isAssigned || !isAvailable}
          onPress={onSelectProvider}
          style={({ pressed }) => [styles.assignButton, (assigning || isAssigned || !isAvailable) && styles.assignButtonDisabled, pressed && styles.assignButtonPressed]}
        >
          {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : <MaterialCommunityIcons color="#FFFFFF" name={isAssigned ? 'account-check-outline' : 'account-plus-outline'} size={20} />}
          <Text style={styles.assignButtonText}>{assigning ? 'Selecting Coordinator...' : isAssigned ? 'Coordinator Selected' : !isAvailable ? 'Unavailable for this schedule' : 'Select Coordinator'}</Text>
        </Pressable>
      </View> : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9', border: '#E4D8DA', muted: '#6F6769', primary: '#4E061A', primaryContainer: '#6B1E2E', success: '#2E6D4E', surface: '#FFFFFF', surfaceTint: '#F8EFF1', text: '#1A1C1C',
} as const

const neo = {
  edge: 'rgba(255, 255, 255, 0.66)',
  lightShadow: 'rgba(255, 255, 255, 0.94)',
  darkShadow: 'rgba(157, 169, 178, 0.48)',
  surface: '#E9EDF0',
  text: '#57636C',
  mutedText: '#73808A',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  overlayScreen: { backgroundColor: neo.surface },
  topBar: { height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topBarContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontalMobile: { paddingHorizontal: 20 },
  horizontalWide: { paddingHorizontal: 56 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  headerTitle: { color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '700', letterSpacing: 0.6 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 28, paddingBottom: 120, gap: 20 },
  overlayContent: { paddingTop: 20, paddingBottom: 32, gap: 18 },
  profileCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 22, gap: 20 },
  profileCardWide: { flexDirection: 'row', alignItems: 'center', padding: 30 },
  profileCardWithoutAvatar: { alignItems: 'stretch', gap: 12 },
  neoRaisedCard: { backgroundColor: neo.surface, borderColor: neo.edge, boxShadow: `7px 7px 15px ${neo.darkShadow}` },
  avatar: { width: 116, height: 116, borderRadius: 58, backgroundColor: palette.surfaceTint },
  avatarFallback: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryContainer },
  avatarInitials: { color: '#FFFFFF', fontSize: typography.h1, fontWeight: '700' },
  profileCopy: { flex: 1, gap: 9 },
  rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 11, paddingVertical: 6 },
  rolePillText: { color: palette.primaryContainer, fontSize: typography.caption, lineHeight: 16, fontWeight: '700', letterSpacing: 0.7 },
  name: { color: palette.text, fontSize: typography.h1, fontWeight: '700', lineHeight: 32 },
  overlayName: { textAlign: 'center' },
  subtitle: { maxWidth: 700, color: palette.muted, fontSize: typography.body, lineHeight: 21 },
  profileExperienceDivider: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(157, 169, 178, 0.42)' },
  profileExperienceSection: { gap: 4 },
  profileExperienceHeader: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  experience: { color: palette.muted, fontSize: typography.caption, lineHeight: 18, fontWeight: '600' },
  profileExperience: { color: palette.muted, fontSize: typography.body, lineHeight: 21 },
  unavailable: { color: '#A12A35', fontSize: typography.caption, lineHeight: 18, fontWeight: '700' },
  available: { color: palette.success, fontSize: typography.caption, lineHeight: 18, fontWeight: '700' },
  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20, gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionCopy: { color: palette.muted, fontSize: typography.body, lineHeight: 21 },
  listLabel: { color: palette.text, fontSize: 13, lineHeight: 19, letterSpacing: 0.6, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' },
  specialtyGroup: { gap: 8 },
  specialtyGroupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(157, 169, 178, 0.42)', marginTop: 2, paddingTop: 10 },
  pillList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 10, paddingVertical: 7 },
  neoRaisedPill: {
    backgroundColor: neo.surface,
    borderWidth: 1,
    borderColor: neo.edge,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.48,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: `3px 3px 6px ${neo.darkShadow}, -3px -3px 6px ${neo.lightShadow}`,
  },
  pillText: { color: palette.primaryContainer, fontSize: typography.caption, lineHeight: 16, fontWeight: '700' },
  detailCard: { flex: 1, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20 },
  detailHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailTitle: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  detailCopy: { color: palette.muted, fontSize: typography.body, lineHeight: 21 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 10, backgroundColor: palette.surfaceTint, padding: 12 },
  neoRaisedPriceRow: {
    backgroundColor: neo.surface,
    borderWidth: 1,
    borderColor: neo.edge,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.48,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: `3px 3px 6px ${neo.darkShadow}, -3px -3px 6px ${neo.lightShadow}`,
  },
  pricingLabel: { color: palette.muted, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  pricingValue: { color: palette.primaryContainer, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  privacyCard: { flexDirection: 'row', gap: 13, borderRadius: 17, backgroundColor: '#EEF6F1', padding: 18 },
  neoRaisedInfoCard: {
    backgroundColor: neo.surface,
    borderWidth: 1,
    borderColor: neo.edge,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 0.48,
    shadowRadius: 15,
    elevation: 5,
    boxShadow: `7px 7px 15px ${neo.darkShadow}, -7px -7px 15px ${neo.lightShadow}`,
  },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: { color: palette.success, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  neoInfoTitle: { color: palette.primaryContainer, fontSize: typography.caption, lineHeight: 17 },
  privacyText: { color: '#486052', fontSize: typography.body, lineHeight: 21 },
  neoInfoText: { color: neo.mutedText, fontSize: typography.caption, lineHeight: 18 },
  reviewsSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 22, gap: 15 },
  reviewsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  reviewsTitle: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  ratingSummary: { alignItems: 'flex-end' },
  ratingValue: { color: palette.primaryContainer, fontSize: typography.h2, lineHeight: 27, fontWeight: '700' },
  reviewList: { gap: 10 },
  reviewCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 15 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reviewerName: { color: palette.text, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  reviewEvent: { color: palette.muted, fontSize: typography.caption, lineHeight: 17, marginTop: 1, textTransform: 'capitalize' },
  reviewStars: { color: '#D19A20', fontSize: typography.h3, lineHeight: 22 },
  reviewComment: { color: palette.text, fontSize: typography.body, lineHeight: 21, marginTop: 12 },
  reviewCommentMuted: { color: palette.muted, fontSize: typography.caption, lineHeight: 18, fontStyle: 'italic', marginTop: 12 },
  reviewDate: { color: palette.muted, fontSize: typography.caption, lineHeight: 17, marginTop: 10 },
  emptyReviews: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 24 },
  emptyReviewsTitle: { color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  emptyReviewsCopy: { maxWidth: 420, color: palette.muted, fontSize: typography.caption, lineHeight: 18, textAlign: 'center', marginTop: 3 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 14 },
  assignButton: { width: '100%', maxWidth: 520, alignSelf: 'center', minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 20 },
  assignButtonDisabled: { backgroundColor: '#8F7A80' },
  assignButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  assignButtonText: { color: '#FFFFFF', fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
})
