import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { CatalogService, formatPeso, mockCatalogServices } from '../lib/catalog'

export type MealType = 'plated' | 'buffet' | 'packed'

export interface ServiceSelectionValue {
  attendeeCount: number
  budgetPerHead: number
  estimatedTotal: number
  mealType: MealType
  notes: string
  outsideFood: boolean
  service: CatalogService
}

interface ServiceDetailsScreenProps {
  remainingBudget?: number
  service?: CatalogService
  initialFavorite?: boolean
  onAddSelection?: (value: ServiceSelectionValue) => void
  onBack?: () => void
  onBrowseMenus?: () => void
  onFavoriteChange?: (favorite: boolean) => void
  onReadAllReviews?: () => void
}

const heroImages = [
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCneDbGxsehKvUdDm0r9og1c14LIG6PDkS9fRCHuealXvhVquYvLZC5yD732yON-mHvLN_LZ5aROOU3liTkTBcd9TfgQ2YACQLfNL6ol1Q7lfCbQk56iX4UVhVPo_ruAa41oFTW_ZuPOHnG2GIst0IHmQ89XE6Xj0-nKucjHd6ULx3Sq7ImJqWIeY12nAJVe5SBJpM0zRXTphm86Zg9s_gaOVipZ8ic-vK9-mlpDbQ22GkKcBCETY5stA',
    label: 'Grand Buffet Catering spread',
  },
  {
    uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB64UHC5EHMJ_lNu5Im7YUTV8YPcDylvNzyHd4VzjWZKC5uH88vB3BR1Kmb4w3ZZkxp1flImbm3YlRMqNKQU0PNZ3TqAfNejONC3Lt03n1F5VwbWxTakPgut8w_DSwqD1Hh-0LbYeBUl8SlT8r0xaoN8_k_RR92q0J4sdufGATrBjUoJNrnQkdPFOEYEdbZVhmabp0j6Y3SD9tm6QBGpNIgEYDFyhVKc8nm6ViK97LS0zP1ioHHdFFUdg',
    label: 'Detailed Grand Buffet table setup',
  },
] as const

const mealTypes = [
  { id: 'plated' as const, icon: '♨', label: 'Plated' },
  { id: 'buffet' as const, icon: '◈', label: 'Buffet' },
  { id: 'packed' as const, icon: '▣', label: 'Packed' },
] as const

const menuImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDDLdkU3m2UzKdAGckbHMyM_UoVwivs6nhyt5bqHvaN-q6OeuUdyZSAu21Y_Iz2HheCJJA6n2YoQi7oQflQ4Ibx0YjOiuN8osU8W-2iHB_m_2Z3FxzAzpurfkcUVvMRlJmz0jIihv2MS9Ifzv-FmUoNMuVKC2AiO6LxfHUMql11u9Cx41MxoomdLpcwQFfNVJFurPnr6Be0I9eKARcD4oeFk9Y0_OCpWpu6WL0qmSbSOXN0aaqDSng9Bw',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBSCthaNJ_qMPUlp0abXiDRNLC6pkK2uS4qbsLy0-H0aTQa8AXmIaT3qYIHn26cFQYrN_pf4DX-CN-BKvU3yrPTP6vXrQ5ri5V5QKk_-YtK-KbmJTFlvmznsG5npzMHQgMXlhNwdIiSOzJm0eiX8hIU6FoMc-8ikS1Mw8gApOvRpWxpWiomJooy_MOrkVoykQhnhZQNtSnujRMq4z-gezDzSN672cn468Aqq8-dJSQK7QdD-eIg6dgd2A',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA_gvvdlWDwWR6myQg8rZlgoQErmRtawOSyBzBXHi0KKSPPwiTgPeeE4BXUcAf5RZHKRaqNROM9pdCYSg7QyaE3DtVIo9wqSwdtTH-rkRZEQ1YmGGg_iSRx3A4MnGDtErPPYGwHqV0vkdRmc7hYPdi2-QQqrojbL7i2xtnSCE7Sh7EAPvyfM05FAfAQ_t0ESitmgiYtAPKtQPXm3-uTt6nmJmwcQVxGjIl9y-bsbkK62gvV8XoexJe3SA',
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
    event: 'Wedding • Oct 2023',
    rating: 5,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDfGD4O0selRcI1cYgXRf-OaWhj2bkVLXP6FFfkfoSZbu88LW8ruXx4vTM_MpjWdcBsGK1XZrVFr8WS7xkcmyD89cGrkBjgFO0iYLOAoEv8gF-pR32_9SHM3h6iPSLot_NnDiXrhtLmjAJF-zo764m-C1G_L_Kze5GQUjH-uQWNTdOEPTcnfgFtXwcU6IpV7eVp5nNKk5l_TkJW8cipftuNm-93VKrqEbJ0mR979AhIyr6-6U3wlXPwaA',
    copy:
      'The food was incredible! We had the plated dinner option and our guests are still talking about the steak. The staff was incredibly attentive to our vegan guests as well. Highly recommend!',
  },
  {
    id: 'james',
    name: 'James T.',
    event: 'Corporate Event • Sep 2023',
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

export const ServiceDetailsScreen: React.FC<ServiceDetailsScreenProps> = ({
  remainingBudget = 45000,
  service = mockCatalogServices[0],
  initialFavorite = true,
  onAddSelection,
  onBack,
  onBrowseMenus,
  onFavoriteChange,
  onReadAllReviews,
}) => {
  const { width, height } = useWindowDimensions()
  const isWide = width >= 768
  const heroWidth = Math.min(width, 1200)
  const heroHeight = Math.max(400, Math.min(560, height * 0.5))
  const [heroIndex, setHeroIndex] = React.useState(0)
  const [favorite, setFavorite] = React.useState(initialFavorite)
  const [mealType, setMealType] = React.useState<MealType>('plated')
  const [attendeeDigits, setAttendeeDigits] = React.useState('')
  const [budgetDigits, setBudgetDigits] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [outsideFood, setOutsideFood] = React.useState(false)
  const serviceImages = React.useMemo(
    () => [
      {
        uri: service.imageUrl,
        label: service.imageLabel,
      },
      ...heroImages,
    ],
    [service.imageLabel, service.imageUrl]
  )

  const attendeeCount = attendeeDigits ? Number(attendeeDigits) : 0
  const budgetPerHead = budgetDigits ? Number(budgetDigits) : 0
  const estimatedTotal = attendeeCount > 0 && budgetPerHead > 0
    ? attendeeCount * budgetPerHead
    : 25000
  const menusUnlocked = budgetPerHead > 0

  const toggleFavorite = () => {
    const nextFavorite = !favorite
    setFavorite(nextFavorite)
    onFavoriteChange?.(nextFavorite)
  }

  const handleAddSelection = () => {
    onAddSelection?.({
      attendeeCount,
      budgetPerHead,
      estimatedTotal,
      mealType,
      notes,
      outsideFood,
      service,
    })
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
            {serviceImages.map((image) => (
              <Image
                key={image.uri}
                accessibilityLabel={image.label}
                resizeMode="cover"
                source={{ uri: image.uri }}
                style={{ width: heroWidth, height: heroHeight }}
              />
            ))}
          </ScrollView>

          <View style={styles.heroShade} pointerEvents="none" />

          <View style={[styles.heroActions, isWide && styles.heroActionsWide]}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}
            >
              <Text style={styles.heroButtonIcon}>←</Text>
            </Pressable>

            <Pressable
              accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
              accessibilityRole="button"
              accessibilityState={{ selected: favorite }}
              onPress={toggleFavorite}
              style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}
            >
              <Text style={styles.favoriteIcon}>{favorite ? '♥' : '♡'}</Text>
            </Pressable>
          </View>

          <View style={[styles.pagination, isWide && styles.paginationWide]}>
            {serviceImages.map((image, index) => (
              <View
                key={image.uri}
                style={[styles.paginationDot, index === heroIndex && styles.paginationDotActive]}
              />
            ))}
          </View>

          <View style={[styles.heroCopy, isWide && styles.contentPaddingWide]}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{service.categoryName.toUpperCase()}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Text style={styles.badgeStar}>★</Text>
                <Text style={styles.ratingBadgeText}>{service.rating}</Text>
              </View>
            </View>
            <Text style={styles.serviceTitle}>{service.name}</Text>
            <View style={styles.heroBudgetBadge}>
              <Text style={styles.walletIcon}>₱</Text>
              <Text style={styles.heroBudgetText}>
                Remaining Budget: {formatPeso(remainingBudget)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.content, isWide && styles.contentPaddingWide]}>
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>
              {service.description}
            </Text>
          </View>

          <View style={styles.bookingSection}>
            <Text style={styles.sectionHeading}>Design Your Meal</Text>

            <View style={styles.mealTypeGrid}>
              {mealTypes.map((meal) => {
                const isSelected = meal.id === mealType

                return (
                  <Pressable
                    key={meal.id}
                    accessibilityLabel={`${meal.label} meal type`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => setMealType(meal.id)}
                    style={({ pressed }) => [
                      styles.mealCard,
                      isSelected && styles.mealCardSelected,
                      pressed && styles.mealCardPressed,
                    ]}
                  >
                    <Text style={[styles.mealIcon, isSelected && styles.mealSelectedContent]}>
                      {meal.icon}
                    </Text>
                    <Text style={[styles.mealLabel, isSelected && styles.mealSelectedContent]}>
                      {meal.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

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
                <Text style={styles.inputLabel}>BUDGET PER HEAD</Text>
                <View style={styles.inputShell}>
                  <Text style={styles.inputPrefix}>₱</Text>
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

            <View style={styles.menuSection}>
              <View style={styles.menuHeader}>
                <Text style={styles.inputLabel}>AVAILABLE MENUS</Text>
                <Pressable
                  accessibilityLabel="Browse all menus"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onBrowseMenus}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.browseAll}>BROWSE ALL</Text>
                </Pressable>
              </View>

              <View style={styles.menuCard}>
                <View style={styles.menuThumbnails}>
                  {menuImages.map((image) => (
                    <Image key={image} source={{ uri: image }} style={styles.menuThumbnail} />
                  ))}
                </View>
                <View style={styles.menuWash} />
                <View style={styles.menuMessage}>
                  <View style={styles.lockCircle}>
                    <Text style={styles.lockIcon}>{menusUnlocked ? '✓' : '▣'}</Text>
                  </View>
                  <Text style={styles.menuMessageText}>
                    {menusUnlocked
                      ? 'Curated menus are ready to browse'
                      : 'Set budget per head to unlock curated menus'}
                  </Text>
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

          <View style={styles.reviewsSection}>
            <Text style={styles.sectionHeading}>Guest Reviews</Text>

            <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
              <View style={styles.ratingCard}>
                <Text style={styles.bigRating}>4.8</Text>
                <Text style={styles.summaryStars}>★★★★☆</Text>
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
                <Text style={styles.insightIcon}>✦</Text>
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
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
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
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActionBar}>
        <View style={styles.bottomActionContent}>
          {isWide ? (
            <View>
              <Text style={styles.estimatedLabel}>ESTIMATED TOTAL</Text>
              <Text style={styles.estimatedValue}>₱{formatCurrency(estimatedTotal)}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel={`Add to selection for ${formatCurrency(estimatedTotal)} pesos`}
            accessibilityRole="button"
            onPress={handleAddSelection}
            style={({ pressed }) => [styles.addButton, isWide && styles.addButtonWide, pressed && styles.addPressed]}
          >
            <Text style={styles.addButtonText}>Add to Selection</Text>
            {!isWide ? <Text style={styles.addDivider}>|</Text> : null}
            {!isWide ? (
              <Text style={styles.addPrice}>₱{formatCurrency(estimatedTotal)}</Text>
            ) : null}
          </Pressable>
        </View>
      </View>
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
  heroShade: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: '68%',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
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
  heroButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  heroButtonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  heroButtonIcon: { color: palette.white, fontSize: 27, lineHeight: 29 },
  favoriteIcon: { color: palette.white, fontSize: 25, lineHeight: 27 },
  pagination: {
    position: 'absolute',
    right: 20,
    bottom: '22%',
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
    right: 20,
    bottom: 28,
    left: 20,
    zIndex: 3,
  },
  contentPaddingWide: { paddingHorizontal: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  categoryBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    backgroundColor: 'rgba(78, 6, 26, 0.9)',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeStar: { color: palette.gold, fontSize: 16, lineHeight: 17 },
  ratingBadgeText: { color: palette.white, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  serviceTitle: {
    color: palette.white,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroBudgetBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletIcon: { color: palette.primaryFixedDim, fontSize: 18, lineHeight: 20, fontWeight: '700' },
  heroBudgetText: { color: palette.white, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.4 },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  descriptionSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingBottom: 32 },
  description: { maxWidth: 680, color: palette.secondary, fontSize: 18, lineHeight: 30 },
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
  mealCardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  mealIcon: { color: palette.secondary, fontSize: 29, lineHeight: 32, fontWeight: '600' },
  mealLabel: { color: palette.secondary, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  mealSelectedContent: { color: palette.primary },
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
  menuThumbnail: { flex: 1, height: '100%', borderRadius: 8, opacity: 0.35 },
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
  outlinePressed: { backgroundColor: '#FCF5F6', transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.55 },
})
