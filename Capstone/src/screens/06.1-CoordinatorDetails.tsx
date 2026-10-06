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
import { formatPeso, type CatalogService } from '../lib/catalog'
import { customerPriceFromProviderPrice } from '../lib/pricing'
import { calculateCateringPrice } from '../lib/service-category-details'

interface CoordinatorDetailsScreenProps {
  assigning?: boolean
  eventGuestCount?: number
  isAssigned?: boolean
  mode?: 'explore' | 'planning'
  onBack?: () => void
  onSelectProvider?: () => void
  onSelectPackage?: (packageId: string, cateringOptionChoices: Record<string, string>) => void
  selectingPackageId?: string
  service?: CatalogService
}

const initialsFrom = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EC'

export const CoordinatorDetailsScreen: React.FC<CoordinatorDetailsScreenProps> = ({
  assigning = false,
  eventGuestCount = 0,
  isAssigned = false,
  mode = 'planning',
  onBack,
  onSelectProvider,
  onSelectPackage,
  selectingPackageId = '',
  service,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const name = service?.name ?? 'Event Coordinator'
  const canAssign = mode === 'planning' && Boolean(service?.coordinatorUserId)
  const isAvailable = service?.coordinatorAvailable !== false
  const reviews = service?.coordinatorReviews ?? []
  const packages = service?.coordinatorPackages ?? []
  const [cateringChoices, setCateringChoices] = React.useState<Record<string, string>>({})
  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0

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
        contentContainerStyle={[
          styles.content,
          isWide ? styles.horizontalWide : styles.horizontalMobile,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, isWide && styles.profileCardWide]}>
          {service?.imageUrl ? (
            <Image
              accessibilityLabel={service.imageLabel}
              resizeMode="cover"
              source={{ uri: service.imageUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initialsFrom(name)}</Text>
            </View>
          )}

          <View style={styles.profileCopy}>
            <View style={styles.rolePill}>
              <MaterialCommunityIcons color={palette.primaryContainer} name="account-tie-outline" size={16} />
              <Text style={styles.rolePillText}>EVENT COORDINATOR</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.subtitle}>
              {service?.description || 'Coordinates your event details, booked providers, schedules, and action items in one workspace.'}
            </Text>
            <Text style={styles.fee}>{formatPeso(service?.minPrice ?? 0)} per event</Text>
            {service?.coordinatorSpecializations?.length ? (
              <Text style={styles.specializations}>{service.coordinatorSpecializations.join(' • ')}</Text>
            ) : null}
            {!isAvailable ? (
              <Text style={styles.unavailable}>{service?.coordinatorUnavailableReason || 'Unavailable for your event schedule.'}</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.detailsGrid, isWide && styles.detailsGridWide]}>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="calendar-check-outline" size={24} />
            <Text style={styles.detailTitle}>Event overview</Text>
            <Text style={styles.detailCopy}>
              Sees the event date, time, venue, guest count, budget, and current planning status.
            </Text>
          </View>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="briefcase-check-outline" size={24} />
            <Text style={styles.detailTitle}>Booked services</Text>
            <Text style={styles.detailCopy}>
              Sees the providers and services selected for this event, including each booking status.
            </Text>
          </View>
          <View style={styles.detailCard}>
            <MaterialCommunityIcons color={palette.primaryContainer} name="clipboard-check-outline" size={24} />
            <Text style={styles.detailTitle}>Coordination tasks</Text>
            <Text style={styles.detailCopy}>
              Can organize event-specific tasks and track them through completion.
            </Text>
          </View>
        </View>

        <View style={styles.packagesSection}>
          <View>
            <Text style={styles.reviewsEyebrow}>CURATED RECOMMENDATIONS</Text>
            <Text style={styles.reviewsTitle}>Coordinator packages</Text>
            <Text style={styles.packageIntro}>Choose a package to add its current provider services to your plan, or book the coordinator only below.</Text>
          </View>
          {packages.length ? <View style={styles.packageList}>{packages.map((item) => {
            const cateringItems = item.items.filter((packageItem) => packageItem.requiresCateringOption)
            const packageChoices = Object.fromEntries(cateringItems.flatMap((packageItem) => {
              const optionId = cateringChoices[`${item.id}:${packageItem.serviceId}`]
              return optionId ? [[packageItem.serviceId, optionId]] : []
            }))
            const choicesComplete = cateringItems.every((packageItem) => {
              const optionId = packageChoices[packageItem.serviceId]
              const option = packageItem.cateringOptions.find((candidate) => candidate.id === optionId)
              return option ? calculateCateringPrice(option, eventGuestCount).fitsGuestCount : false
            })
            const dynamicSubtotal = item.items.reduce((total, packageItem) => {
              if (!packageItem.requiresCateringOption) return total + packageItem.estimatedAmount
              const optionId = packageChoices[packageItem.serviceId]
              const option = packageItem.cateringOptions.find((candidate) => candidate.id === optionId)
              if (!option) return total
              const calculation = calculateCateringPrice(option, eventGuestCount)
              return total + customerPriceFromProviderPrice(calculation.providerSubtotal, packageItem.commissionRate)
            }, 0)
            const displayedSubtotal = cateringItems.length && choicesComplete
              ? dynamicSubtotal
              : item.serviceSubtotal
            const packageCanBeSelected = item.isAvailable && choicesComplete
            return <View key={item.id} style={styles.packageCard}>
              <View style={styles.packageHeading}>
                <View style={styles.profileCopy}>
                  <Text style={styles.packageEvent}>{item.eventType.replace(/([A-Z])/g, ' $1').toUpperCase()}</Text>
                  <Text style={styles.packageName}>{item.name}</Text>
                </View>
                <Text style={styles.packagePrice}>{formatPeso(displayedSubtotal)}</Text>
              </View>
              {item.description ? <Text style={styles.packageDescription}>{item.description}</Text> : null}
              <View style={styles.packageItems}>{item.items.map((packageItem) => <View key={packageItem.serviceId}>
                <View style={styles.packageItem}>
                  <Text style={styles.packageItemCategory}>{packageItem.categoryName}</Text>
                  <View style={styles.packageItemCopy}>
                    <Text style={styles.packageItemName}>{packageItem.serviceName}</Text>
                    <Text style={styles.packageItemProvider}>{packageItem.providerName}</Text>
                  </View>
                  <Text style={styles.packageItemPrice}>{formatPeso(packageItem.estimatedAmount)}</Text>
                </View>
                {packageItem.requiresCateringOption ? <View style={styles.cateringChoices}>
                  <Text style={styles.cateringChoiceLabel}>Choose a menu for {eventGuestCount} guests</Text>
                  {packageItem.cateringOptions.map((option) => {
                    const calculation = calculateCateringPrice(option, eventGuestCount)
                    const choiceKey = `${item.id}:${packageItem.serviceId}`
                    const selected = cateringChoices[choiceKey] === option.id
                    const amount = customerPriceFromProviderPrice(calculation.providerSubtotal, packageItem.commissionRate)
                    return <Pressable
                      key={option.id}
                      disabled={!calculation.fitsGuestCount}
                      onPress={() => setCateringChoices((current) => ({ ...current, [choiceKey]: option.id }))}
                      style={[styles.cateringChoice, selected && styles.cateringChoiceSelected, !calculation.fitsGuestCount && styles.cateringChoiceDisabled]}
                    >
                      <MaterialCommunityIcons color={selected ? palette.primaryContainer : palette.muted} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={18} />
                      <View style={styles.packageItemCopy}><Text style={styles.cateringChoiceName}>{option.name}</Text><Text style={styles.packageItemProvider}>{formatPeso(customerPriceFromProviderPrice(option.pricePerHead, packageItem.commissionRate))}/head · {option.minimumGuests}-{option.maximumGuests} guests</Text></View>
                      <Text style={styles.packageItemPrice}>{formatPeso(amount)}</Text>
                      {!calculation.fitsGuestCount ? <Text style={styles.cateringChoiceError}>{calculation.reason}</Text> : null}
                    </Pressable>
                  })}
                </View> : null}
              </View>)}</View>
              <View style={styles.packageTotal}><Text style={styles.packageTotalLabel}>Coordinator + services</Text><Text style={styles.packageTotalValue}>{formatPeso((service?.minPrice ?? 0) + displayedSubtotal)}</Text></View>
              {!item.isAvailable ? <Text style={styles.unavailable}>{item.unavailableReason}</Text> : null}
              {item.isAvailable && cateringItems.length > 0 && !choicesComplete ? <Text style={styles.unavailable}>Choose one compatible option for every catering service.</Text> : null}
              {mode === 'planning' ? <Pressable
                accessibilityRole="button"
                disabled={!isAvailable || !packageCanBeSelected || Boolean(selectingPackageId)}
                onPress={() => onSelectPackage?.(item.id, packageChoices)}
                style={[styles.packageButton, (!isAvailable || !packageCanBeSelected || Boolean(selectingPackageId)) && styles.assignButtonDisabled]}
              >
                {selectingPackageId === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <MaterialCommunityIcons color="#FFFFFF" name="package-variant-closed-plus" size={19} />}
                <Text style={styles.assignButtonText}>{selectingPackageId === item.id ? 'Selecting package...' : 'Choose coordinator package'}</Text>
              </Pressable> : null}
            </View>
          })}</View> : <View style={styles.emptyReviews}><MaterialCommunityIcons color={palette.muted} name="package-variant" size={27} /><Text style={styles.emptyReviewsTitle}>No active packages</Text><Text style={styles.emptyReviewsCopy}>You can still book this coordinator without a package.</Text></View>}
        </View>

        <View style={styles.privacyCard}>
          <MaterialCommunityIcons color={palette.success} name="shield-check-outline" size={22} />
          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>Access is limited to this event</Text>
            <Text style={styles.privacyText}>
              {name} receives a booking request first. Event, booking, and provider details are shared only after acceptance.
            </Text>
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <View style={styles.reviewsHeading}>
            <View>
              <Text style={styles.reviewsEyebrow}>VERIFIED CLIENT FEEDBACK</Text>
              <Text style={styles.reviewsTitle}>Reviews &amp; feedback</Text>
            </View>
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingValue}>{reviews.length ? averageRating.toFixed(1) : 'New'}</Text>
              <Text style={styles.ratingCount}>
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          </View>

          {reviews.length ? (
            <View style={styles.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View>
                      <Text style={styles.reviewerName}>Verified client</Text>
                      <Text style={styles.reviewEvent}>{review.eventType}</Text>
                    </View>
                    <Text accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.reviewStars}>
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </Text>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  ) : (
                    <Text style={styles.reviewCommentMuted}>Rating submitted without a comment.</Text>
                  )}
                  {review.createdAt ? (
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString('en-PH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyReviews}>
              <MaterialCommunityIcons color={palette.muted} name="star-outline" size={27} />
              <Text style={styles.emptyReviewsTitle}>No coordinator reviews yet</Text>
              <Text style={styles.emptyReviewsCopy}>
                Ratings from clients appear here after coordinated events are completed.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {canAssign ? (
        <View style={styles.actionBar}>
          <Pressable
            accessibilityLabel={isAssigned ? `${name} has a pending or accepted booking` : `Request ${name} for this event`}
            accessibilityRole="button"
            accessibilityState={{ disabled: assigning || isAssigned || !isAvailable }}
            disabled={assigning || isAssigned || !isAvailable}
            onPress={onSelectProvider}
            style={({ pressed }) => [
              styles.assignButton,
              (assigning || isAssigned || !isAvailable) && styles.assignButtonDisabled,
              pressed && styles.assignButtonPressed,
            ]}
          >
            {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <MaterialCommunityIcons
                color="#FFFFFF"
                name={isAssigned ? 'clock-check-outline' : 'account-plus-outline'}
                size={20}
              />
            )}
            <Text style={styles.assignButtonText}>
              {assigning ? 'Sending request...' : isAssigned ? 'Booking requested or accepted' : !isAvailable ? 'Unavailable for this schedule' : 'Book coordinator only'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  border: '#E4D8DA',
  muted: '#6F6769',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  success: '#2E6D4E',
  surface: '#FFFFFF',
  surfaceTint: '#F8EFF1',
  text: '#1A1C1C',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  topBar: { height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surface },
  topBarContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  horizontalMobile: { paddingHorizontal: 20 },
  horizontalWide: { paddingHorizontal: 56 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  headerTitle: { color: palette.primary, fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingTop: 28, paddingBottom: 120, gap: 20 },
  profileCard: { borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 22, gap: 20 },
  profileCardWide: { flexDirection: 'row', alignItems: 'center', padding: 30 },
  avatar: { width: 116, height: 116, borderRadius: 58, backgroundColor: palette.surfaceTint },
  avatarFallback: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryContainer },
  avatarInitials: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
  profileCopy: { flex: 1, gap: 9 },
  rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.surfaceTint, paddingHorizontal: 11, paddingVertical: 6 },
  rolePillText: { color: palette.primaryContainer, fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  name: { color: palette.text, fontSize: 29, fontWeight: '700', lineHeight: 36 },
  subtitle: { maxWidth: 700, color: palette.muted, fontSize: 15, lineHeight: 23 },
  fee: { color: palette.primaryContainer, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  specializations: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  unavailable: { color: '#A12A35', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  packagesSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 22, gap: 15 },
  packageIntro: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  packageList: { gap: 13 },
  packageCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, backgroundColor: palette.surface, padding: 17 },
  packageHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  packageEvent: { color: palette.primaryContainer, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  packageName: { color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  packagePrice: { color: palette.primaryContainer, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  packageDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  packageItems: { borderTopWidth: 1, borderTopColor: palette.border, gap: 8, marginTop: 13, paddingTop: 12 },
  packageItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packageItemCategory: { width: 82, color: palette.primaryContainer, fontSize: 9, fontWeight: '700' },
  packageItemCopy: { flex: 1, minWidth: 0 },
  packageItemName: { color: palette.text, fontSize: 12, fontWeight: '700' },
  packageItemProvider: { color: palette.muted, fontSize: 9, marginTop: 1 },
  packageItemPrice: { color: palette.text, fontSize: 11, fontWeight: '600' },
  cateringChoices: { gap: 7, marginLeft: 92, marginTop: 8 },
  cateringChoiceLabel: { color: palette.primaryContainer, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  cateringChoice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 10, padding: 10 },
  cateringChoiceSelected: { borderColor: palette.primaryContainer, backgroundColor: palette.surfaceTint },
  cateringChoiceDisabled: { opacity: 0.55 },
  cateringChoiceName: { color: palette.text, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  cateringChoiceError: { width: '100%', color: '#A12A35', fontSize: 9, lineHeight: 14, marginLeft: 26 },
  packageTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, backgroundColor: palette.surfaceTint, padding: 12, marginTop: 13 },
  packageTotalLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  packageTotalValue: { color: palette.primaryContainer, fontSize: 14, fontWeight: '700' },
  packageButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: palette.primaryContainer, marginTop: 12 },
  detailsGrid: { gap: 14 },
  detailsGridWide: { flexDirection: 'row' },
  detailCard: { flex: 1, minHeight: 170, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 20, gap: 10 },
  detailTitle: { color: palette.text, fontSize: 16, fontWeight: '700' },
  detailCopy: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  privacyCard: { flexDirection: 'row', gap: 13, borderRadius: 17, backgroundColor: '#EEF6F1', padding: 18 },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: { color: palette.success, fontSize: 14, fontWeight: '700' },
  privacyText: { color: '#486052', fontSize: 13, lineHeight: 19 },
  reviewsSection: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 22, gap: 15 },
  reviewsHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  reviewsEyebrow: { color: palette.primaryContainer, fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.9 },
  reviewsTitle: { color: palette.text, fontSize: 21, lineHeight: 28, fontWeight: '700', marginTop: 3 },
  ratingSummary: { alignItems: 'flex-end' },
  ratingValue: { color: palette.primaryContainer, fontSize: 24, lineHeight: 29, fontWeight: '700' },
  ratingCount: { color: palette.muted, fontSize: 10, lineHeight: 14 },
  reviewList: { gap: 10 },
  reviewCard: { borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 15 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reviewerName: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reviewEvent: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 1, textTransform: 'capitalize' },
  reviewStars: { color: '#D19A20', fontSize: 16, lineHeight: 20 },
  reviewComment: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 12 },
  reviewCommentMuted: { color: palette.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: 12 },
  reviewDate: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 10 },
  emptyReviews: { alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface, padding: 24 },
  emptyReviewsTitle: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 8 },
  emptyReviewsCopy: { maxWidth: 420, color: palette.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 3 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: 20, paddingVertical: 14 },
  assignButton: { width: '100%', maxWidth: 520, alignSelf: 'center', minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: palette.primaryContainer, paddingHorizontal: 20 },
  assignButtonDisabled: { backgroundColor: '#8F7A80' },
  assignButtonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  assignButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
})
