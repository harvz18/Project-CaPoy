import { Text } from '../components/AppText'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  CateringServiceType,
  CatalogService,
  formatPeso,
  formatServicePrice,
} from '../lib/catalog'
import type { ReviewSentiment, ServiceReviewInsights } from '../lib/reviews'

export type MealType = CateringServiceType

export interface ServiceSelectionValue {
  attendeeCount: number
  budgetPerHead: number
  estimatedTotal: number
  mealType?: MealType
  notes: string
  outsideFood: boolean
  service: CatalogService
}

interface ServiceDetailsScreenProps {
  hasBudget?: boolean
  mode?: 'explore' | 'planning'
  remainingBudget?: number
  service?: CatalogService
  onAddSelection?: (value: ServiceSelectionValue) => Promise<void> | void
  onBack?: () => void
  onReadAllReviews?: () => void
  reviewInsights?: ServiceReviewInsights
  reviewInsightsLoading?: boolean
}

const mealTypes = [
  { id: 'plated' as const, icon: 'silverware-fork-knife' as const, label: 'Plated' },
  { id: 'buffet' as const, icon: 'food-variant' as const, label: 'Buffet' },
  { id: 'packed' as const, icon: 'food-takeout-box-outline' as const, label: 'Packed' },
] as const

const ratingDistribution = [
  { rating: 5, percent: '85%' as const },
  { rating: 4, percent: '10%' as const },
  { rating: 3, percent: '3%' as const },
  { rating: 2, percent: '1%' as const },
  { rating: 1, percent: '1%' as const },
] as const

const reviewChips = ['Great value', 'On time', 'Delicious food', 'Professional staff']

const reviews = [
  {
    id: 'sarahMark',
    name: 'Sarah & Mark',
    event: 'Wedding - Oct 2023',
    rating: 5,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfGD4O0selRcI1cYgXRf-OaWhj2bkVLXP6FFfkfoSZbu88LW8ruXx4vTM_MpjWdcBsGK1XZrVFr8WS7xkcmyD89cGrkBjgFO0iYLOAoEv8gF-pR32_9SHM3h6iPSLot_NnDiXrhtLmjAJF-zo764m-C1G_L_Kze5GQUjH-uQWNTdOEPTcnfgFtXwcU6IpV7eVp5nNKk5l_TkJW8cipftuNm-93VKrqEbJ0mR979AhIyr6-6U3wlXPwaA',
    copy:
      'The food was incredible! We had the plated dinner option and our guests are still talking about the steak. The staff was incredibly attentive to our vegan guests as well. Highly recommend!',
  },
  {
    id: 'james',
    name: 'James T.',
    event: 'Corporate Event - Sep 2023',
    rating: 4,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCvaPwCzBQSQaA6SPVMpWzjtnKTyz37kGdT9MgiLbHdgbqEFdF3ToPSFP_rnIp-YVxTXCyo9zxOsFdIM6_kbCbRSk7D5923y_WbzjUGtwUN6-o9jw_A_o8B_Lgjd2t9N95-vw7Sw7nzXyvnP7FC88hUvICH0dw04xbfRjEXURL-pUXONQVTS69DulcIZqIW4a3eW8e9iF9hLpPozQJe3TpYoh9y_cFr63pij-lFlLNJyy1z0fm-dy8QMg',
    copy:
      'Great service and beautiful presentation. Setup was exactly on time and communication leading up to the event was flawless. Only minor note was that one side dish was slightly cold, but otherwise perfect.',
  },
] as const

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 8)

const pricingUnitLabel = (unit?: 'event' | 'person' | 'hour' | 'day') => {
  if (unit === 'person') return 'per person'
  if (unit === 'hour') return 'per hour'
  if (unit === 'day') return 'per day'
  if (unit === 'event') return 'per event'
  return ''
}

export const ServiceDetailsScreen: React.FC<ServiceDetailsScreenProps> = ({
  hasBudget,
  mode = 'planning',
  remainingBudget = 45000,
  service,
  onAddSelection,
  onBack,
  onReadAllReviews,
  reviewInsights,
  reviewInsightsLoading = false,
}) => {
  const { width, height } = useWindowDimensions()
  const isWide = width >= 768
  const isExploreMode = mode === 'explore'
  const hasSetBudget = hasBudget ?? remainingBudget > 0
  const heroWidth = Math.min(width, 1200)
  const heroHeight = Math.max(280, Math.min(460, height * 0.42))
  const [heroIndex, setHeroIndex] = React.useState(0)
  const [mealType, setMealType] = React.useState<MealType>()
  const [attendeeDigits, setAttendeeDigits] = React.useState('')
  const [budgetDigits, setBudgetDigits] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [outsideFood, setOutsideFood] = React.useState(false)
  const [isAddingSelection, setIsAddingSelection] = React.useState(false)
  const [expandedSentiment, setExpandedSentiment] = React.useState<ReviewSentiment>()
  const [selectedPackageId, setSelectedPackageId] = React.useState(
    service?.packageId ?? ''
  )
  const serviceImages = React.useMemo(
    () =>
      (service?.galleryUrls?.length
        ? service.galleryUrls
        : service?.imageUrl
          ? [service.imageUrl]
          : []
      )
        .filter((uri) => Boolean(uri))
        .map((uri, index) => ({
          uri,
          label:
            index === 0
              ? service?.imageLabel ?? 'Service photo'
              : `${service?.name} photo ${index + 1}`,
        })),
    [service?.galleryUrls, service?.imageLabel, service?.imageUrl, service?.name]
  )

  React.useEffect(() => {
    setSelectedPackageId(service?.packageId ?? '')
    setMealType(service?.cateringServiceTypes?.[0])
    setHeroIndex(0)
    setExpandedSentiment(undefined)
  }, [service?.cateringServiceTypes, service?.id, service?.packageId])

  if (!service) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>No service selected</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
        >
          <Text style={styles.emptyButtonText}>Back to services</Text>
        </Pressable>
      </View>
    )
  }

  const attendeeCount = attendeeDigits ? Number(attendeeDigits) : 0
  const budgetPerHead = budgetDigits ? Number(budgetDigits) : 0
  const isCatering = service.categoryId === 'catering'
  const availableMealTypes = service.cateringServiceTypes ?? []
  const cateringSelectionUnavailable = isCatering && !mealType
  const selectedPackage = service.packages?.find((item) => item.id === selectedPackageId)
  const selectedUnit = selectedPackage?.unit ?? service.pricingUnit ?? 'event'
  const selectedPrice = selectedPackage?.price ?? service.minPrice
  const requiresQuote = service.pricingModel === 'customQuote' || selectedPrice <= 0
  const estimatedTotal =
    requiresQuote
      ? 0
      : selectedUnit === 'person' && attendeeCount > 0
        ? selectedPrice * attendeeCount
        : selectedPrice
  const estimatedDisplay =
    requiresQuote
      ? 'Quote required'
      : `PHP ${formatCurrency(estimatedTotal)}`

  const handleAddSelection = async () => {
    if (!onAddSelection || isAddingSelection || cateringSelectionUnavailable) return

    setIsAddingSelection(true)

    try {
      await onAddSelection({
        attendeeCount,
        budgetPerHead,
        estimatedTotal,
        mealType,
        notes,
        outsideFood,
        service: selectedPackage
          ? { ...service, minPrice: selectedPackage.price, packageId: selectedPackage.id }
          : service,
      })
    } finally {
      setIsAddingSelection(false)
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          <ScrollView
            horizontal
            onMomentumScrollEnd={(event) => {
              setHeroIndex(Math.round(event.nativeEvent.contentOffset.x / heroWidth))
            }}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {serviceImages.length > 0 ? (
              serviceImages.map((image) => (
                <Image
                  key={image.uri}
                  accessibilityLabel={image.label}
                  resizeMode="cover"
                  source={{ uri: image.uri }}
                  style={{ width: heroWidth, height: heroHeight }}
                />
              ))
            ) : (
              <View style={[styles.heroPlaceholder, { width: heroWidth, height: heroHeight }]}>
                <Text style={styles.heroPlaceholderText}>{service.name}</Text>
              </View>
            )}
          </ScrollView>

          <LinearGradient
            colors={['rgba(18, 10, 12, 0)', 'rgba(18, 10, 12, 0.72)']}
            locations={[0, 1]}
            pointerEvents="none"
            style={styles.heroShade}
          />

          <View style={[styles.heroActions, isWide && styles.heroActionsWide]}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}
            >
              <MaterialCommunityIcons
                color={palette.white}
                name="arrow-left"
                size={30}
                style={styles.heroActionIcon}
              />
            </Pressable>

            <View accessibilityLabel="More service options" style={styles.heroButton}>
              <MaterialCommunityIcons
                color={palette.white}
                name="dots-vertical"
                size={31}
                style={styles.heroActionIcon}
              />
            </View>
          </View>

          <View style={[styles.pagination, isWide && styles.paginationWide]}>
            {serviceImages.map((image, index) => (
              <View
                key={image.uri}
                style={[styles.paginationDot, index === heroIndex && styles.paginationDotActive]}
              />
            ))}
          </View>

          <View pointerEvents="none" style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{service.categoryName.toUpperCase()}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <MaterialCommunityIcons color={palette.gold} name="star" size={17} />
                <Text style={styles.ratingBadgeText}>{service.rating}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.serviceTitle}>{service.name}</Text>
          </View>
        </View>

        {!isExploreMode ? (
          <View style={[styles.heroSummary, isWide && styles.contentPaddingWide]}>
            <View style={styles.heroBudgetBadge}>
              <MaterialCommunityIcons color={palette.primary} name="wallet-outline" size={19} />
              <Text style={styles.heroBudgetText}>
                {hasSetBudget
                  ? `Remaining Budget: ${formatPeso(remainingBudget)}`
                  : 'Pay actual service costs'}
                </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.content, isWide && styles.contentPaddingWide]}>
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>{service.description}</Text>
            <View style={styles.serviceFacts}>
              <View style={styles.serviceFactRow}>
                <Text style={styles.serviceFactLabel}>SERVICE PROVIDER</Text>
                <Text style={styles.serviceFactValue}>{service.providerName}</Text>
              </View>
              <View style={styles.serviceFactRow}>
                <Text style={styles.serviceFactLabel}>PRICE</Text>
                <Text style={styles.servicePriceValue}>{formatServicePrice(service)}</Text>
              </View>
              {service.location ? (
                <View style={styles.serviceFactRow}>
                  <Text style={styles.serviceFactLabel}>LOCATION</Text>
                  <Text style={styles.serviceFactValue}>{service.location}</Text>
                </View>
              ) : null}
              {service.pricingDetails ? (
                <View style={styles.pricingNotes}>
                  <Text style={styles.serviceFactLabel}>PRICING DETAILS</Text>
                  <Text style={styles.pricingNotesText}>{service.pricingDetails}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.packagesSection}>
            <Text style={styles.sectionHeading}>Packages</Text>
            {service.packages?.length ? (
              <View style={styles.packageList}>
                {service.packages.map((item) => {
                  const isSelected = item.id === selectedPackageId

                  return (
                    <Pressable
                      key={item.id}
                      accessibilityLabel={`${isSelected ? 'Unselect' : 'Select'} package ${item.name}`}
                      accessibilityRole={isExploreMode ? undefined : 'checkbox'}
                      accessibilityState={isExploreMode ? undefined : { checked: isSelected }}
                      disabled={isExploreMode}
                      onPress={() =>
                        setSelectedPackageId((current) => current === item.id ? '' : item.id)
                      }
                      style={({ pressed }) => [
                        styles.packageCard,
                        isSelected && !isExploreMode && styles.packageCardSelected,
                        pressed && styles.packageCardPressed,
                      ]}
                    >
                      <View style={styles.packageHeading}>
                        <View style={styles.packageTitleRow}>
                          {!isExploreMode ? (
                            <MaterialCommunityIcons
                              color={isSelected ? palette.primary : palette.secondaryFixedDim}
                              name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                              size={22}
                            />
                          ) : null}
                          <Text style={styles.packageName}>{item.name}</Text>
                        </View>
                        <Text style={styles.packagePrice}>
                          {formatPeso(item.price)}
                          {item.unit ? ` / ${pricingUnitLabel(item.unit)}` : ''}
                        </Text>
                      </View>
                      {item.description ? (
                        <Text style={styles.packageDescription}>{item.description}</Text>
                      ) : null}
                      {item.inclusions.length ? (
                        <View style={styles.inclusionList}>
                          {item.inclusions.map((inclusion) => (
                            <Text key={inclusion} style={styles.inclusionText}>
                              {'\u2713'} {inclusion}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <Text style={styles.noPackages}>
                This provider has not configured separate packages. The listed base price applies.
              </Text>
            )}
          </View>

          {!isExploreMode ? (
            <View style={styles.bookingSection}>
            <Text style={styles.sectionHeading}>
              {service.categoryId === 'catering' ? 'Booking Details' : 'Request This Service'}
            </Text>

            {service.categoryId === 'catering' ? <View style={styles.mealTypeGrid}>
              {mealTypes.map((meal) => {
                const isSelected = meal.id === mealType
                const isAvailable = availableMealTypes.includes(meal.id)

                return (
                  <Pressable
                    key={meal.id}
                    accessibilityLabel={`${meal.label} meal type${isAvailable ? '' : ', not offered by this provider'}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected, disabled: !isAvailable }}
                    disabled={!isAvailable}
                    onPress={() => setMealType(meal.id)}
                    style={({ pressed }) => [
                      styles.mealCard,
                      isSelected && styles.mealCardSelected,
                      !isAvailable && styles.mealCardDisabled,
                      pressed && styles.mealCardPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      color={
                        !isAvailable
                          ? palette.secondaryFixedDim
                          : isSelected
                            ? palette.primary
                            : palette.secondary
                      }
                      name={meal.icon}
                      size={30}
                    />
                    <Text style={[styles.mealLabel, isSelected && styles.mealSelectedContent]}>
                      {meal.label}
                    </Text>
                    {!isAvailable ? <Text style={styles.unavailableLabel}>Not offered</Text> : null}
                  </Pressable>
                )
              })}
            </View> : null}

            {isCatering && availableMealTypes.length === 0 ? (
              <View style={styles.unavailableNotice}>
                <MaterialCommunityIcons color={palette.secondary} name="information-outline" size={20} />
                <Text style={styles.unavailableNoticeText}>
                  This provider has not configured a catering style yet. The service cannot be selected until the listing is updated.
                </Text>
              </View>
            ) : null}

            <View style={[styles.inputGrid, isWide && styles.inputGridWide]}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ATTENDEE COUNT</Text>
                <View style={styles.inputShell}>
                  <TextInput
                    accessibilityLabel="Attendee count"
                    inputMode="numeric"
                    keyboardType="number-pad"
                    onChangeText={(value) => setAttendeeDigits(digitsOnly(value))}
                    placeholder="150"
                    placeholderTextColor={palette.secondaryFixedDim}
                    style={styles.fieldInput}
                    value={attendeeDigits}
                  />
                  <Text style={styles.inputSuffix}>pax</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>YOUR BUDGET PER HEAD</Text>
                <View style={styles.inputShell}>
                  <Text style={styles.inputPrefix}>PHP</Text>
                  <TextInput
                    accessibilityLabel="Budget per head in Philippine pesos"
                    inputMode="numeric"
                    keyboardType="number-pad"
                    onChangeText={(value) => setBudgetDigits(digitsOnly(value))}
                    placeholder="1500"
                    placeholderTextColor={palette.secondaryFixedDim}
                    style={[styles.fieldInput, styles.fieldInputWithPrefix]}
                    value={budgetDigits ? formatCurrency(Number(budgetDigits)) : ''}
                  />
                </View>
              </View>
            </View>

            <View style={styles.notesSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DIETARY REQUIREMENTS &amp; NOTES</Text>
                <TextInput
                  accessibilityLabel="Dietary requirements and notes"
                  multiline
                  numberOfLines={3}
                  onChangeText={setNotes}
                  placeholder="List any allergies, vegan preferences, or specific requests..."
                  placeholderTextColor={palette.secondaryFixedDim}
                  style={styles.notesInput}
                  textAlignVertical="top"
                  value={notes}
                />
              </View>

              <View style={styles.outsideFoodCard}>
                <View style={styles.outsideFoodCopy}>
                  <Text style={styles.outsideFoodTitle}>Bringing outside food or drinks?</Text>
                  <Text style={styles.outsideFoodSubtitle}>Corkage fees may apply</Text>
                </View>
                <Switch
                  accessibilityLabel="Bringing outside food or drinks"
                  onValueChange={setOutsideFood}
                  thumbColor={palette.white}
                  trackColor={{ false: palette.surfaceVariant, true: palette.primary }}
                  value={outsideFood}
                />
              </View>
            </View>
            </View>
          ) : null}

          <View style={styles.reviewsSection}>
            <Text style={styles.sectionHeading}>Guest Reviews</Text>

            {service.isMock && !service.bookingServiceId ? (
              <>
            <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
              <View style={styles.ratingCard}>
                <Text style={styles.bigRating}>4.8</Text>
                <Text style={styles.summaryStars}>****-</Text>
                <Text style={styles.reviewCount}>120 REVIEWS</Text>
              </View>

              <View style={styles.distributionList}>
                {ratingDistribution.map((item) => (
                  <View key={item.rating} style={styles.distributionRow}>
                    <Text style={styles.distributionLabel}>{item.rating}</Text>
                    <View style={styles.distributionTrack}>
                      <View style={[styles.distributionFill, { width: item.percent }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.insightCard}>
              <View style={styles.insightHeadingRow}>
                <Text style={styles.insightIcon}>*</Text>
                <Text style={styles.insightHeading}>EXPERT INSIGHT</Text>
              </View>
              <Text style={styles.insightCopy}>
                Couples consistently praise Grand Buffet for generous portions, stunning
                presentation, and professional staff. Many highlight the smooth tasting sessions
                and flexibility with dietary restrictions.
              </Text>
              <Text style={styles.insightCaption}>
                SUMMARY GENERATED FROM VERIFIED REVIEWS
              </Text>
            </View>

            <View style={styles.reviewChips}>
              {reviewChips.map((chip) => (
                <View key={chip} style={styles.reviewChip}>
                  <Text style={styles.reviewChipText}>{chip}</Text>
                </View>
              ))}
            </View>

            <View style={styles.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerIdentity}>
                      <Image
                        accessibilityLabel={`${review.name} profile photo`}
                        source={{ uri: review.image }}
                        style={styles.reviewerAvatar}
                      />
                      <View style={styles.reviewerCopy}>
                        <Text style={styles.reviewerName}>{review.name}</Text>
                        <Text style={styles.reviewerEvent}>{review.event}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewStars}>
                      {'*'.repeat(review.rating)}{'-'.repeat(5 - review.rating)}
                    </Text>
                  </View>
                  <Text style={styles.reviewCopy}>{review.copy}</Text>
                </View>
              ))}
            </View>

            <Pressable
              accessibilityLabel="Read all 120 reviews"
              accessibilityRole="button"
              onPress={onReadAllReviews}
              style={({ pressed }) => [styles.readReviewsButton, pressed && styles.outlinePressed]}
            >
              <Text style={styles.readReviewsText}>Read All 120 Reviews</Text>
            </Pressable>
              </>
            ) : (
              reviewInsightsLoading ? (
                <View style={styles.liveReviewCard}>
                  <Text style={styles.liveReviewTitle}>Loading verified feedback...</Text>
                </View>
              ) : reviewInsights && reviewInsights.totalRatings > 0 ? (
                <>
                  <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
                    <View style={styles.ratingCard}>
                      <Text style={styles.bigRating}>{reviewInsights.averageRating.toFixed(1)}</Text>
                      <Text style={styles.summaryStars}>
                        {'\u2605'.repeat(Math.round(reviewInsights.averageRating))}
                        {'\u2606'.repeat(5 - Math.round(reviewInsights.averageRating))}
                      </Text>
                      <Text style={styles.reviewCount}>
                        {reviewInsights.totalRatings}{' '}
                        {reviewInsights.totalRatings === 1 ? 'RATING' : 'RATINGS'}
                      </Text>
                    </View>

                    <View style={styles.distributionList}>
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = reviewInsights.distribution[rating as 1 | 2 | 3 | 4 | 5]
                        const width = `${Math.round((count / reviewInsights.totalRatings) * 100)}%` as const

                        return (
                          <View key={rating} style={styles.distributionRow}>
                            <Text style={styles.distributionLabel}>{rating}</Text>
                            <View style={styles.distributionTrack}>
                              <View style={[styles.distributionFill, { width }]} />
                            </View>
                            <Text style={styles.distributionCount}>{count}</Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>

                  <View style={styles.sentimentGrid}>
                    {(['positive', 'negative'] as const).map((sentiment) => {
                      const group = reviewInsights[sentiment]
                      const expanded = expandedSentiment === sentiment
                      const positive = sentiment === 'positive'

                      return (
                        <View key={sentiment}>
                          <Pressable
                            accessibilityLabel={`${expanded ? 'Hide' : 'Show'} all ${positive ? 'good' : 'critical'} comments`}
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}
                            onPress={() => setExpandedSentiment(expanded ? undefined : sentiment)}
                            style={({ pressed }) => [
                              styles.sentimentCard,
                              positive ? styles.positiveCard : styles.negativeCard,
                              pressed && styles.outlinePressed,
                            ]}
                          >
                            <View style={styles.sentimentHeadingRow}>
                              <Text style={styles.sentimentIcon}>{positive ? '\u2665' : '!'}</Text>
                              <Text style={styles.sentimentHeading}>
                                {positive ? 'WHAT CLIENTS LOVED' : 'WHAT COULD IMPROVE'}
                              </Text>
                              <Text style={styles.sentimentCount}>{group.count}</Text>
                            </View>
                            <Text style={styles.sentimentSummary}>{group.summary}</Text>
                            <Text style={styles.sentimentAction}>
                              {group.count > 0
                                ? expanded
                                  ? 'HIDE COMMENTS'
                                  : `READ ALL ${group.count} ${positive ? 'GOOD' : 'CRITICAL'} COMMENTS`
                                : 'NO COMMENTS TO DISPLAY'}
                            </Text>
                          </Pressable>

                          {expanded && group.reviews.length > 0 ? (
                            <View style={styles.sentimentReviewList}>
                              {group.reviews.map((review) => (
                                <View key={review.id} style={styles.sentimentReviewItem}>
                                  <View style={styles.sentimentReviewHeader}>
                                    <View>
                                      <Text style={styles.reviewerName}>Verified client</Text>
                                      <Text style={styles.reviewerEvent}>
                                        {review.createdAt
                                          ? new Date(review.createdAt).toLocaleDateString('en-PH', {
                                              day: 'numeric', month: 'short', year: 'numeric',
                                            })
                                          : 'Completed booking'}
                                      </Text>
                                    </View>
                                    <Text style={styles.reviewStars}>
                                      {'\u2605'.repeat(review.rating)}{'\u2606'.repeat(5 - review.rating)}
                                    </Text>
                                  </View>
                                  <Text style={styles.reviewCopy}>{review.comment}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                      )
                    })}
                  </View>

                  <Text style={styles.analysisCaption}>
                    SUMMARY OF VERIFIED CLIENT FEEDBACK
                  </Text>
                  {reviewInsights.pendingCommentCount > 0 ? (
                    <Text style={styles.pendingAnalysisCopy}>
                      {reviewInsights.pendingCommentCount}{' '}
                      {reviewInsights.pendingCommentCount === 1 ? 'comment is' : 'comments are'} still being analyzed.
                    </Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.liveReviewCard}>
                  <Text style={styles.liveReviewTitle}>No reviews yet</Text>
                  <Text style={styles.liveReviewCopy}>
                    Ratings and analyzed comments will appear after clients complete bookings.
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
      </ScrollView>

      {!isExploreMode ? (
        <View style={styles.bottomActionBar}>
          <View style={styles.bottomActionContent}>
            {isWide ? (
              <View>
                <Text style={styles.estimatedLabel}>ESTIMATED TOTAL</Text>
                <Text style={styles.estimatedValue}>{estimatedDisplay}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={
                requiresQuote
                  ? 'Add custom quote service to selection'
                  : `Add to selection for ${formatCurrency(estimatedTotal)} pesos`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isAddingSelection || cateringSelectionUnavailable }}
              disabled={isAddingSelection || cateringSelectionUnavailable}
              onPress={handleAddSelection}
              style={({ pressed }) => [
                styles.addButton,
                isWide && styles.addButtonWide,
                (isAddingSelection || cateringSelectionUnavailable) && styles.addButtonDisabled,
                pressed && styles.addPressed,
              ]}
            >
              <Text style={styles.addButtonText}>
                {isAddingSelection
                  ? 'Adding...'
                  : cateringSelectionUnavailable
                    ? 'Catering Options Unavailable'
                    : 'Add to Selection'}
              </Text>
              {!isWide ? <Text style={styles.addDivider}>|</Text> : null}
              {!isWide ? (
                <Text style={styles.addPrice}>{estimatedDisplay}</Text>
              ) : null}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  surfaceLow: '#F3F3F4',
  surfaceHigh: '#E8E8E8',
  surfaceVariant: '#E2E2E2',
  surfaceLowest: '#FFFFFF',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  primaryFixedDim: '#FFB2BB',
  secondary: '#5E5E5E',
  secondaryFixedDim: '#C7C6C6',
  text: '#1A1C1C',
  white: '#FFFFFF',
  gold: '#FFD700',
  goldDark: '#9A6A00',
} as const

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  scrollContent: { paddingBottom: 112 },
  hero: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: palette.surfaceLow,
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 28,
  },
  heroPlaceholderText: {
    color: palette.white,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    textAlign: 'center',
  },
  emptyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: palette.background,
    padding: 24,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  emptyCopy: {
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  heroActions: {
    position: 'absolute',
    top: 16,
    right: 20,
    left: 20,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroActionsWide: { right: 24, left: 24 },
  heroShade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: '62%',
  },
  heroButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  heroButtonPressed: { opacity: 0.65, transform: [{ translateX: -2 }] },
  heroActionIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pagination: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    zIndex: 4,
    flexDirection: 'row',
    gap: 8,
  },
  paginationWide: { right: 24 },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  paginationDotActive: { backgroundColor: palette.white },
  heroCopy: {
    position: 'absolute',
    right: 76,
    bottom: 18,
    left: 20,
    zIndex: 3,
  },
  heroCopyWide: {
    right: 88,
    left: 24,
  },
  heroSummary: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
    backgroundColor: palette.surfaceLowest,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  contentPaddingWide: { paddingHorizontal: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  categoryBadge: {
    borderRadius: 16,
    backgroundColor: 'rgba(112, 27, 48, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryBadgeText: {
    color: palette.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(25, 20, 20, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ratingBadgeText: { color: palette.white, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  serviceTitle: {
    color: palette.white,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '700',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  heroBudgetBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  heroBudgetText: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.2 },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  descriptionSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingBottom: 32 },
  description: { maxWidth: 680, color: palette.secondary, fontSize: 18, lineHeight: 30 },
  serviceFacts: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 14,
    backgroundColor: palette.surfaceLowest,
    marginTop: 24,
  },
  serviceFactRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.surfaceVariant,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  serviceFactLabel: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1 },
  serviceFactValue: { flex: 1, color: palette.text, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'right' },
  servicePriceValue: { flex: 1, color: palette.primary, fontSize: 17, lineHeight: 23, fontWeight: '700', textAlign: 'right' },
  pricingNotes: { gap: 6, padding: 18 },
  pricingNotesText: { color: palette.text, fontSize: 15, lineHeight: 23 },
  packagesSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 40 },
  packageList: { gap: 14 },
  packageCard: { borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 14, backgroundColor: palette.surfaceLowest, padding: 18 },
  packageCardSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: '#FCF5F6' },
  packageCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  packageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  packageTitleRow: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  packageName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  packagePrice: { color: palette.primary, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  packageDescription: { color: palette.secondary, fontSize: 14, lineHeight: 22, marginTop: 10 },
  inclusionList: { gap: 6, marginTop: 14 },
  inclusionText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  noPackages: { color: palette.secondary, fontSize: 15, lineHeight: 23 },
  bookingSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 40 },
  sectionHeading: { color: palette.text, fontSize: 24, lineHeight: 32, fontWeight: '700', marginBottom: 24 },
  mealTypeGrid: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  mealCard: {
    minWidth: 0,
    minHeight: 104,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: palette.surfaceVariant,
    borderRadius: 12,
    backgroundColor: palette.background,
    padding: 12,
  },
  mealCardSelected: { borderColor: palette.primary, backgroundColor: '#FCF5F6' },
  mealCardDisabled: { borderColor: palette.surfaceVariant, backgroundColor: palette.surfaceLow, opacity: 0.58 },
  mealCardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  mealLabel: { color: palette.secondary, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  mealSelectedContent: { color: palette.primary },
  unavailableLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  unavailableNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    backgroundColor: palette.surfaceLow,
    marginTop: -16,
    marginBottom: 28,
    padding: 14,
  },
  unavailableNoticeText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: 12, lineHeight: 18 },
  inputGrid: { gap: 24, marginBottom: 40 },
  inputGridWide: { flexDirection: 'row' },
  inputGroup: { flex: 1, gap: 12 },
  inputLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1.2 },
  inputShell: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: palette.surfaceVariant,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 16,
  },
  fieldInput: { flex: 1, color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '600', paddingVertical: 14 },
  fieldInputWithPrefix: { paddingLeft: 8 },
  inputPrefix: { color: palette.text, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  inputSuffix: { color: palette.secondary, fontSize: 15, lineHeight: 21 },
  menuSection: { marginBottom: 40 },
  menuHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  browseAll: { color: palette.primary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  menuCard: {
    minHeight: 190,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
  },
  menuThumbnails: { position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, flexDirection: 'row', gap: 8 },
  menuThumbnail: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: palette.surfaceLow,
    opacity: 0.7,
  },
  menuThumbnailText: {
    color: palette.primary,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  menuWash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.45)' },
  menuMessage: { zIndex: 2, alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  lockCircle: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
  },
  lockIcon: { color: palette.primary, fontSize: 32, lineHeight: 35, fontWeight: '700' },
  menuMessageText: {
    maxWidth: 400,
    color: palette.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  notesSection: { gap: 24 },
  notesInput: {
    minHeight: 104,
    color: palette.text,
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 12,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  outsideFoodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 12,
    backgroundColor: palette.surfaceLowest,
    padding: 18,
  },
  outsideFoodCopy: { flex: 1 },
  outsideFoodTitle: { color: palette.text, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  outsideFoodSubtitle: { color: palette.secondary, fontSize: 14, lineHeight: 20, marginTop: 2 },
  reviewsSection: { paddingTop: 40, paddingBottom: 64 },
  liveReviewCard: { alignItems: 'center', borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 16, backgroundColor: palette.surfaceLowest, padding: 28 },
  liveReviewRating: { color: palette.primary, fontSize: 44, lineHeight: 48, fontWeight: '700' },
  liveReviewTitle: { color: palette.text, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  liveReviewCopy: { maxWidth: 480, color: palette.secondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  reviewSummary: { gap: 24, marginBottom: 40 },
  reviewSummaryWide: { flexDirection: 'row', gap: 32 },
  ratingCard: {
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 16,
    backgroundColor: palette.surfaceLowest,
    padding: 24,
  },
  bigRating: { color: palette.primary, fontSize: 56, lineHeight: 58, fontWeight: '700', marginBottom: 8 },
  summaryStars: { color: palette.gold, fontSize: 22, lineHeight: 25, letterSpacing: 1, marginBottom: 8 },
  reviewCount: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1 },
  distributionList: { flex: 1, justifyContent: 'center', gap: 12 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  distributionLabel: { width: 14, color: palette.secondary, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  distributionTrack: { height: 12, flex: 1, overflow: 'hidden', borderRadius: 6, backgroundColor: palette.surfaceHigh },
  distributionFill: { height: '100%', borderRadius: 6, backgroundColor: palette.primary },
  distributionCount: { width: 24, color: palette.secondary, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  sentimentGrid: { gap: 14 },
  sentimentCard: { borderWidth: 1, borderRadius: 16, padding: 20 },
  positiveCard: { borderColor: '#B8D9C4', backgroundColor: '#F2FAF5' },
  negativeCard: { borderColor: '#E6C4C8', backgroundColor: '#FCF5F6' },
  sentimentHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sentimentIcon: { width: 22, color: palette.primary, fontSize: 18, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  sentimentHeading: { flex: 1, color: palette.primary, fontSize: 12, lineHeight: 17, fontWeight: '800', letterSpacing: 1 },
  sentimentCount: { minWidth: 28, color: palette.primary, fontSize: 13, lineHeight: 19, fontWeight: '800', textAlign: 'right' },
  sentimentSummary: { color: palette.text, fontSize: 15, lineHeight: 23, marginTop: 11 },
  sentimentAction: { color: palette.primary, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, marginTop: 13 },
  sentimentReviewList: { borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: palette.surfaceVariant, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, backgroundColor: palette.surfaceLowest, paddingHorizontal: 18 },
  sentimentReviewItem: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 18 },
  sentimentReviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  analysisCaption: { color: palette.secondary, fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8, textAlign: 'center', marginTop: 16 },
  pendingAnalysisCopy: { color: palette.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  insightCard: { borderWidth: 1, borderColor: '#F0DDE0', borderRadius: 16, backgroundColor: '#FCF5F6', padding: 24, marginBottom: 32 },
  insightHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  insightIcon: { color: palette.primary, fontSize: 21, lineHeight: 23 },
  insightHeading: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 1.2 },
  insightCopy: { color: '#303131', fontSize: 17, lineHeight: 27, marginBottom: 16 },
  insightCaption: { color: '#8A5D65', fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 1 },
  reviewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 40 },
  reviewChip: { borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 20, backgroundColor: palette.surfaceLowest, paddingHorizontal: 16, paddingVertical: 8 },
  reviewChipText: { color: palette.text, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  reviewList: { gap: 32 },
  reviewItem: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingBottom: 32 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  reviewerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewerAvatar: { width: 48, height: 48, borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 24 },
  reviewerCopy: { flex: 1 },
  reviewerName: { color: palette.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  reviewerEvent: { color: palette.secondary, fontSize: 13, lineHeight: 19, marginTop: 2 },
  reviewStars: { color: palette.gold, fontSize: 16, lineHeight: 19, letterSpacing: 0.5 },
  reviewCopy: { color: palette.text, fontSize: 16, lineHeight: 26 },
  readReviewsButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: 26, paddingHorizontal: 24, marginTop: 24 },
  readReviewsText: { color: palette.primary, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  bottomActionBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
    backgroundColor: 'rgba(249,249,249,0.97)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomActionContent: { width: '100%', maxWidth: 1200, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  estimatedLabel: { color: palette.secondary, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1 },
  estimatedValue: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '700', marginTop: 2 },
  addButton: { width: '100%', minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 25, backgroundColor: palette.primary, paddingHorizontal: 24, paddingVertical: 13 },
  addButtonWide: { width: 'auto', minWidth: 280 },
  addButtonText: { color: palette.white, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  addDivider: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  addPrice: { color: palette.white, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  addPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  addButtonDisabled: { opacity: 0.62 },
  outlinePressed: { backgroundColor: '#FCF5F6', transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.55 },
})
