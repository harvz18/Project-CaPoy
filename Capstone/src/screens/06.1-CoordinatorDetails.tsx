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
import { ReviewFeedbackSummary } from '../components/ReviewFeedbackSummary'
import { formatPeso, type CatalogService } from '../lib/catalog'
import { summarizeRatingFeedback } from '../lib/reviews'

interface CoordinatorDetailsScreenProps {
  assigning?: boolean
  coordinatorBookingEnabled?: boolean
  isAssigned?: boolean
  mode?: 'explore' | 'planning'
  onBack?: () => void
  onSelectProvider?: () => void
  service?: CatalogService
}

const initialsFrom = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'

const ItemList = ({ values }: { values: string[] }) => (
  <View style={styles.pillList}>
    {values.map((value) => <View key={value} style={styles.pill}><Text style={styles.pillText}>{value}</Text></View>)}
  </View>
)

export const CoordinatorDetailsScreen: React.FC<CoordinatorDetailsScreenProps> = ({
  assigning = false,
  coordinatorBookingEnabled = false,
  isAssigned = false,
  mode = 'planning',
  onBack,
  onSelectProvider,
  service,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
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
  const eventTypes = service?.coordinatorEventTypesHandled ?? []
  const inclusions = service?.coordinatorServiceInclusions ?? []

  return (
    <View style={styles.screen}>
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

      <ScrollView
        contentContainerStyle={[styles.content, isWide ? styles.horizontalWide : styles.horizontalMobile]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, isWide && styles.profileCardWide]}>
          {service?.imageUrl ? (
            <Image accessibilityLabel={service.imageLabel} resizeMode="cover" source={{ uri: service.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}><Text style={styles.avatarInitials}>{initialsFrom(name)}</Text></View>
          )}
          <View style={styles.profileCopy}>
            <View style={styles.rolePill}>
              <MaterialCommunityIcons color={palette.primaryContainer} name="account-tie-outline" size={16} />
              <Text style={styles.rolePillText}>EVENT COORDINATOR</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subtitle}>
              {service?.description || 'This coordinator has not added a professional introduction yet.'}
            </Text>
            <Text style={styles.fee}>{formatPeso(service?.minPrice ?? 0)} per event</Text>
            {service?.coordinatorYearsExperience ? (
              <Text style={styles.experience}>{service.coordinatorYearsExperience} years of coordination experience</Text>
            ) : null}
            {!isAvailable ? <Text style={styles.unavailable}>{service?.coordinatorUnavailableReason || 'Unavailable for your event schedule.'}</Text> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="account-heart-outline" size={22} />
            <Text style={styles.sectionTitle}>About the Coordinator</Text>
          </View>
          <Text style={styles.sectionCopy}>{service?.description || 'No professional introduction has been added yet.'}</Text>
        </View>

        <View style={[styles.detailsGrid, isWide && styles.detailsGridWide]}>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="briefcase-clock-outline" size={23} />
            <Text style={styles.detailTitle}>Experience</Text>
            <Text style={styles.detailCopy}>{service?.coordinatorYearsExperience
              ? `${service.coordinatorYearsExperience} years of event coordination experience.`
              : 'Years of experience have not been specified.'}</Text>
            {service?.coordinatorPortfolioSummary ? <Text style={styles.detailCopy}>{service.coordinatorPortfolioSummary}</Text> : null}
          </View>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-star-outline" size={23} />
            <Text style={styles.detailTitle}>Events Handled</Text>
            {eventTypes.length ? <ItemList values={eventTypes} /> : <Text style={styles.detailCopy}>Event types have not been specified.</Text>}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="star-shooting-outline" size={22} />
            <Text style={styles.sectionTitle}>Skills and Specialties</Text>
          </View>
          {specialties.length ? <><Text style={styles.listLabel}>Specialties</Text><ItemList values={specialties} /></> : null}
          {skills.length ? <><Text style={styles.listLabel}>Skills</Text><ItemList values={skills} /></> : null}
          {capabilities.length ? <><Text style={styles.listLabel}>Capabilities</Text><ItemList values={capabilities} /></> : null}
          {certifications.length ? <><Text style={styles.listLabel}>Certifications</Text><ItemList values={certifications} /></> : null}
          {!specialties.length && !skills.length && !capabilities.length && !certifications.length ? (
            <Text style={styles.sectionCopy}>Skills and specialties have not been specified yet.</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="clipboard-list-outline" size={22} />
            <Text style={styles.sectionTitle}>Services and Inclusions</Text>
          </View>
          {inclusions.length ? <ItemList values={inclusions} /> : <Text style={styles.sectionCopy}>Service inclusions have not been specified yet.</Text>}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-check-outline" size={22} />
            <Text style={styles.sectionTitle}>Pricing and Availability</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Coordination fee</Text>
            <Text style={styles.pricingValue}>{formatPeso(service?.minPrice ?? 0)} per event</Text>
          </View>
          <Text style={isAvailable ? styles.available : styles.unavailable}>
            {isAvailable ? 'Available for the selected event schedule' : service?.coordinatorUnavailableReason || 'Unavailable for the selected event schedule'}
          </Text>
          {service?.coordinatorAvailabilityNotes ? <Text style={styles.sectionCopy}>{service.coordinatorAvailabilityNotes}</Text> : null}
        </View>

        <View style={styles.privacyCard}>
          <MaterialCommunityIcons color={palette.success} name="shield-check-outline" size={22} />
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Access is limited to this event</Text>
            <Text style={styles.privacyText}>The coordinator receives a booking request first. Event, booking, and provider details are shared only after acceptance.</Text>
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeading}>
            <View><Text style={styles.reviewsEyebrow}>VERIFIED CLIENT FEEDBACK</Text><Text style={styles.reviewsTitle}>Reviews &amp; feedback</Text></View>
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingValue}>{reviewInsights.totalRatings ? reviewInsights.averageRating.toFixed(1) : 'New'}</Text>
              <Text style={styles.ratingCount}>{reviewInsights.totalRatings} {reviewInsights.totalRatings === 1 ? 'review' : 'reviews'}</Text>
            </View>
          </View>
          <ReviewFeedbackSummary insights={reviewInsights} isWide={isWide} showReviewComments />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topBar: { height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topBarContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontalMobile: { paddingHorizontal: 20 }, horizontalWide: { paddingHorizontal: 56 }, iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.55 },
  headerTitle: { color: palette.primary, fontSize: 15, fontWeight: '700', letterSpacing: 0.6 }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 28, paddingBottom: 120, gap: 20 },
  profileCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 22, gap: 20 }, profileCardWide: { flexDirection: 'row', alignItems: 'center', padding: 30 },
  avatar: { width: 116, height: 116, borderRadius: 58, backgroundColor: palette.surfaceTint }, avatarFallback: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryContainer }, avatarInitials: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  profileCopy: { flex: 1, gap: 9 }, rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 11, paddingVertical: 6 }, rolePillText: { color: palette.primaryContainer, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  name: { color: palette.text, fontSize: 29, fontWeight: '700', lineHeight: 36 }, subtitle: { maxWidth: 700, color: palette.muted, fontSize: 15, lineHeight: 23 }, fee: { color: palette.primaryContainer, fontSize: 18, lineHeight: 25, fontWeight: '700' }, experience: { color: palette.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' }, unavailable: { color: '#A12A35', fontSize: 12, lineHeight: 18, fontWeight: '700' }, available: { color: palette.success, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  sectionCard: { borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20, gap: 10 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, sectionTitle: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700' }, sectionCopy: { color: palette.muted, fontSize: 13, lineHeight: 20 }, listLabel: { color: palette.primaryContainer, fontSize: 10, lineHeight: 15, letterSpacing: 0.7, fontWeight: '700', marginTop: 3 },
  pillList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 10, paddingVertical: 7 }, pillText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  detailsGrid: { gap: 14 }, detailsGridWide: { flexDirection: 'row' }, detailCard: { flex: 1, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20 }, detailTitle: { color: palette.text, fontSize: 16, fontWeight: '700' }, detailCopy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  pricingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderRadius: 10, backgroundColor: palette.surfaceTint, padding: 12 }, pricingLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' }, pricingValue: { color: palette.primaryContainer, fontSize: 14, fontWeight: '700' },
  privacyCard: { flexDirection: 'row', gap: 13, borderRadius: 17, backgroundColor: '#EEF6F1', padding: 18 }, privacyCopy: { flex: 1, gap: 4 }, privacyTitle: { color: palette.success, fontSize: 14, fontWeight: '700' }, privacyText: { color: '#486052', fontSize: 13, lineHeight: 19 },
  reviewsSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 22, gap: 15 }, reviewsHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }, reviewsEyebrow: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.9 }, reviewsTitle: { color: palette.text, fontSize: 21, lineHeight: 28, fontWeight: '700', marginTop: 3 }, ratingSummary: { alignItems: 'flex-end' }, ratingValue: { color: palette.primaryContainer, fontSize: 24, lineHeight: 29, fontWeight: '700' }, ratingCount: { color: palette.muted, fontSize: 10, lineHeight: 14 }, reviewList: { gap: 10 }, reviewCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 15 }, reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, reviewerName: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' }, reviewEvent: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 1, textTransform: 'capitalize' }, reviewStars: { color: '#D19A20', fontSize: 16, lineHeight: 20 }, reviewComment: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 12 }, reviewCommentMuted: { color: palette.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: 12 }, reviewDate: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 10 }, emptyReviews: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 24 }, emptyReviewsTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 }, emptyReviewsCopy: { maxWidth: 420, color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 3 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 14 }, assignButton: { width: '100%', maxWidth: 520, alignSelf: 'center', minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 20 }, assignButtonDisabled: { backgroundColor: '#8F7A80' }, assignButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] }, assignButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
})
