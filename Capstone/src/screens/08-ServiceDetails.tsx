import { Text } from '../components/AppText'
import { PublishedBusinessPolicies } from '../components/BusinessPolicies'
import { FloristBookingConfigurator } from '../components/FloristBookingConfigurator'
import { PhotoVideoBookingConfigurator } from '../components/PhotoVideoBookingConfigurator'
import { ReviewFeedbackSummary } from '../components/ReviewFeedbackSummary'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { customerPriceFromProviderPrice } from '../lib/pricing'
import { neutralSelection } from '../theme/neumorphism'
import { warningNotice } from '../theme/notices'
import { animateOptionLayout, optionSelectionMotionDuration } from '../theme/option-motion'
import {
  calculateCateringCustomMenuPrice,
  calculateCateringPrice,
  defaultCateringCustomMenuItemIds,
  getCateringCustomMenu,
  getCateringPricingOptions,
  getCateringTastingMenu,
  getCateringTastingSettings,
  getVenueBookingOptions,
  getVenueBookingRules,
  summarizeCategoryDetails,
  type CateringPricingOption,
  type VenueBookingOption,
  type VenueOptionSelection,
} from '../lib/service-category-details'
import type { FloristSelectionSnapshot } from '../lib/florist'
import {
  calculatePhotoVideoSelectionPrice,
  defaultPhotoVideoSelection,
  normalizePhotoVideoSelection,
  validatePhotoVideoSelection,
  type PhotoVideoSelectionSnapshot,
} from '../lib/photo-video-booking'
import { summarizeRatingFeedback, type ReviewSentiment, type ServiceReviewInsights } from '../lib/reviews'
import { typography } from '../theme/typography'

export type MealType = CateringServiceType
type CateringOffering = 'custom' | 'preset'

export interface ServiceSelectionValue {
  attendeeCount: number
  budgetPerHead: number
  cateringMenuItemIds?: string[]
  cateringOption?: CateringPricingOption
  estimatedTotal: number
  foodTastingMenuItemIds?: string[]
  foodTastingPreference?: boolean
  floristSelection?: FloristSelectionSnapshot
  photoVideoSelection?: PhotoVideoSelectionSnapshot
  combinedCateringServiceId?: string
  mealType?: MealType
  notes: string
  service: CatalogService
  venueCateringPackageId?: string
  venueBookedHours?: number
  venueOption?: VenueBookingOption
  venueSelections?: VenueOptionSelection[]
}

export type ServiceQuotePreview = {
  calculatedAmount?: number
  message?: string
  ok: boolean
  providerAmount?: number
}

type ServiceDetailItem = {
  id: string
  label: string
  value: string
}

export interface ServiceDetailsScreenProps {
  categoryBudget?: number
  eventGuestCount?: number
  eventDate?: string
  eventTime?: string
  hasBudget?: boolean
  isChangingSelection?: boolean
  isReplacementSelection?: boolean
  initialFoodTastingPreference?: boolean
  initialPhotoVideoSelection?: PhotoVideoSelectionSnapshot
  mode?: 'explore' | 'planning'
  presentation?: 'overlay' | 'screen'
  service?: CatalogService
  onAddSelection?: (value: ServiceSelectionValue) => boolean | Promise<boolean | void> | void
  onCalculateQuote?: (value: {
    attendeeCount?: number
    menuItemIds?: string[]
    optionId?: string
    packageId?: string
    quantity?: number
    floristSelection?: FloristSelectionSnapshot
    photoVideoSelection?: PhotoVideoSelectionSnapshot
    service: CatalogService
    venueSelections?: VenueOptionSelection[]
  }) => Promise<ServiceQuotePreview>
  onBack?: () => void
  onEditEventDetails?: () => void
  onLoadFoodTastingDraft?: (service: CatalogService) => Promise<{
    draft?: {
      attendeeCount: number
      isComplete: boolean
      menuItemIds: string[]
      revision: number
      updatedAt?: string
    }
    message?: string
    ok: boolean
  }>
  onReadAllReviews?: () => void
  onPhotoVideoSelectionChange?: (value: PhotoVideoSelectionSnapshot) => void
  reviewInsights?: ServiceReviewInsights
  reviewInsightsLoading?: boolean
  onSaveFoodTastingDraft?: (value: {
    attendeeCount: number
    menuItemIds: string[]
    revision: number
    service: CatalogService
  }) => Promise<{
    isComplete?: boolean
    message?: string
    ok: boolean
    stale?: boolean
  }>
}

const mockServiceReviewInsights: ServiceReviewInsights = {
  ...summarizeRatingFeedback([
    {
      comment: 'The food was incredible, the presentation was beautiful, and the staff was attentive and professional.',
      createdAt: '2023-10-01T00:00:00.000Z',
      id: 'sarah-mark',
      rating: 5,
    },
    {
      comment: 'Setup was on time and communication before the event was flawless.',
      createdAt: '2023-09-01T00:00:00.000Z',
      id: 'james',
      rating: 4,
    },
  ]),
  averageRating: 4.8,
  distribution: { 1: 1, 2: 1, 3: 4, 4: 12, 5: 102 },
  totalRatings: 120,
}

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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfGD4O0selRcI1cYgXRf-OaWhj2bkVLXP6FFfkfoSZbu88LW8ruXx4vTM_MpjWdcBsGK1XZrVFr8WS7xkcmyD89cGrkBjgFO0iYLOAoEv8gF-pR32_9SHM3h6iPSLot_NnDiXrhtLmjAJF-zo764m-C1G_L_Kze5GQUjH-uQWNTdOEPTcnfgFtXwcU6IpV7eVp5nNKk5l_TkJW8cipftuNm-93VKrqEbJ0mR979AhIyr6-6U3wlXPwaA',
    copy: 'The food was incredible! We had the plated dinner option and our guests are still talking about the steak. The staff was incredibly attentive to our vegan guests as well. Highly recommend!',
  },
  {
    id: 'james',
    name: 'James T.',
    event: 'Corporate Event - Sep 2023',
    rating: 4,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvaPwCzBQSQaA6SPVMpWzjtnKTyz37kGdT9MgiLbHdgbqEFdF3ToPSFP_rnIp-YVxTXCyo9zxOsFdIM6_kbCbRSk7D5923y_WbzjUGtwUN6-o9jw_A_o8B_Lgjd2t9N95-vw7Sw7nzXyvnP7FC88hUvICH0dw04xbfRjEXURL-pUXONQVTS69DulcIZqIW4a3eW8e9iF9hLpPozQJe3TpYoh9y_cFr63pij-lFlLNJyy1z0fm-dy8QMg',
    copy: 'Great service and beautiful presentation. Setup was exactly on time and communication leading up to the event was flawless. Only minor note was that one side dish was slightly cold, but otherwise perfect.',
  },
] as const

const pricingUnitLabel = (unit?: 'event' | 'person' | 'hour' | 'day') => {
  if (unit === 'person') return 'per person'
  if (unit === 'hour') return 'per hour'
  if (unit === 'day') return 'per day'
  if (unit === 'event') return 'per event'
  return ''
}

const firstValidVenueDuration = (minimumHours: number, incrementHours: number) => {
  const minimum = Math.max(0, minimumHours)
  const increment = incrementHours > 0 ? incrementHours : 1
  const alignedDuration = Math.ceil((minimum - Number.EPSILON) / increment) * increment
  return Number(alignedDuration.toFixed(4))
}

const formatEventDateLabel = (value: string) => {
  if (!value) return 'Date not set'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatEventTimeLabel = (value: string) => {
  if (!value) return 'Time not set'
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  const hours = Number(match[1])
  const minutes = match[2]
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${minutes} ${suffix}`
}

const splitServiceDetailValues = (value: string) => {
  const values = value
    .split(/\s*(?:,|;|\n|\u2022|\u00B7)\s*/)
    .map((item) => item.trim())
    .filter(Boolean)

  return values.length ? values : [value]
}

export const ServiceDetailsScreen: React.FC<ServiceDetailsScreenProps> = ({
  eventGuestCount = 0,
  eventDate = '',
  eventTime = '',
  isChangingSelection = false,
  isReplacementSelection = false,
  initialFoodTastingPreference,
  initialPhotoVideoSelection,
  mode = 'planning',
  presentation = 'screen',
  service,
  onAddSelection,
  onCalculateQuote,
  onBack,
  onEditEventDetails,
  onLoadFoodTastingDraft,
  onReadAllReviews,
  onPhotoVideoSelectionChange,
  reviewInsights,
  reviewInsightsLoading = false,
  onSaveFoodTastingDraft,
}) => {
  const { width, height } = useWindowDimensions()
  const isWide = width >= 768
  const isExploreMode = mode === 'explore'
  const isOverlay = presentation === 'overlay'
  const isVenueOverlay = isOverlay && service?.categoryId === 'venues'
  const isCateringOverlay = isOverlay && service?.categoryId === 'catering'
  const isFloristOverlay = isOverlay && service?.categoryId === 'florists'
  const isPhotoVideoOverlay = isOverlay && service?.categoryId === 'photography'
  const isAttireOverlay = isOverlay && service?.categoryId === 'attire'
  const isSoundLightsOverlay = isOverlay && service?.categoryId === 'soundLights'
  const heroWidth = Math.min(width, 1200)
  const heroHeight = Math.max(280, Math.min(460, height * 0.42))
  const displayedHeroHeight = isVenueOverlay
    ? Math.max(220, Math.min(300, height * 0.3))
    : isFloristOverlay || isAttireOverlay || isSoundLightsOverlay
      ? Math.max(220, Math.min(340, height * 0.34))
    : heroHeight
  const [heroIndex, setHeroIndex] = React.useState(0)
  const [foodTastingPreference, setFoodTastingPreference] = React.useState<boolean>()
  const [selectedTastingMenuItemIds, setSelectedTastingMenuItemIds] = React.useState<string[]>([])
  const [expandedTastingMenuSections, setExpandedTastingMenuSections] = React.useState<Set<string>>(
    () => new Set()
  )
  const [foodTastingDraftMessage, setFoodTastingDraftMessage] = React.useState('')
  const [foodTastingDraftError, setFoodTastingDraftError] = React.useState('')
  const [selectedCateringMenuItemIds, setSelectedCateringMenuItemIds] = React.useState<string[]>([])
  const [selectedCateringOptionId, setSelectedCateringOptionId] = React.useState('')
  const [selectedCateringOffering, setSelectedCateringOffering] = React.useState<CateringOffering>('preset')
  const [cateringGuestCount, setCateringGuestCount] = React.useState(
    Math.max(1, Math.floor(eventGuestCount || 1))
  )
  const [cateringGuestCountText, setCateringGuestCountText] = React.useState(
    String(Math.max(1, Math.floor(eventGuestCount || 1)))
  )
  const [cateringGuestCountMessage, setCateringGuestCountMessage] = React.useState('')
  const [expandedCateringMenuSections, setExpandedCateringMenuSections] = React.useState<Set<string>>(new Set())
  const [selectedVenueHours, setSelectedVenueHours] = React.useState<Record<string, string>>({})
  const [expandedVenueOptions, setExpandedVenueOptions] = React.useState<Set<string>>(new Set())
  const [isAddingSelection, setIsAddingSelection] = React.useState(false)
  const [authoritativeQuote, setAuthoritativeQuote] = React.useState<{
    customerAmount: number
    providerAmount: number
  }>()
  const [quoteError, setQuoteError] = React.useState('')
  const [quoteLoading, setQuoteLoading] = React.useState(false)
  const [expandedSentiment, setExpandedSentiment] = React.useState<ReviewSentiment>()
  const [expandedServiceDetails, setExpandedServiceDetails] = React.useState<Set<string>>(new Set())
  const [selectedPackageId, setSelectedPackageId] = React.useState(
    service?.packageId ?? ''
  )
  const [floristSelection, setFloristSelection] = React.useState<FloristSelectionSnapshot>({
    schemaVersion: 1,
    selectedArrangements: [],
  })
  const [photoVideoSelection, setPhotoVideoSelection] = React.useState<PhotoVideoSelectionSnapshot>(
    () => normalizePhotoVideoSelection(initialPhotoVideoSelection ?? defaultPhotoVideoSelection())
  )
  const eventGuestCountRef = React.useRef(eventGuestCount)
  const detailsScrollRef = React.useRef<React.ElementRef<typeof ScrollView>>(null)
  const detailsScrollOffsetRef = React.useRef(0)
  const optionFocusRefs = React.useRef<Record<string, React.ElementRef<typeof Pressable> | null>>({})
  const venueScrollTimerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const foodTastingDraftRevisionRef = React.useRef(0)
  const foodTastingDraftTouchedRef = React.useRef(false)
  const loadedFoodTastingDraftKeyRef = React.useRef('')
  const savedFoodTastingDraftFingerprintRef = React.useRef('')
  eventGuestCountRef.current = eventGuestCount

  React.useEffect(() => () => {
    if (venueScrollTimerRef.current) clearTimeout(venueScrollTimerRef.current)
  }, [])
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
    const initialGuestCount = Math.max(1, Math.floor(eventGuestCountRef.current || 1))
    setSelectedPackageId(service?.packageId ?? '')
    setFloristSelection({ schemaVersion: 1, selectedArrangements: [] })
    setPhotoVideoSelection(defaultPhotoVideoSelection())
    setFoodTastingPreference(initialFoodTastingPreference)
    setSelectedTastingMenuItemIds([])
    setExpandedTastingMenuSections(new Set())
    setFoodTastingDraftMessage('')
    setFoodTastingDraftError('')
    foodTastingDraftRevisionRef.current = 0
    foodTastingDraftTouchedRef.current = false
    loadedFoodTastingDraftKeyRef.current = ''
    savedFoodTastingDraftFingerprintRef.current = ''
    setSelectedCateringMenuItemIds(defaultCateringCustomMenuItemIds(
      getCateringCustomMenu(service?.categoryDetails)
    ))
    const options = getCateringPricingOptions(service?.categoryDetails, service?.providerMinPrice)
    setSelectedCateringOptionId(options.length === 1 ? options[0].id : '')
    const customMenu = getCateringCustomMenu(service?.categoryDetails)
    setSelectedCateringOffering(customMenu && options.length === 0 ? 'custom' : 'preset')
    // Catering quantities are service-specific. Start with the event value,
    // rather than silently changing the event-wide guest count.
    setCateringGuestCount(initialGuestCount)
    setCateringGuestCountText(String(initialGuestCount))
    setCateringGuestCountMessage('')
    setExpandedCateringMenuSections(new Set())
    const venueOptions = getVenueBookingOptions(service?.categoryDetails)
    const venueRules = getVenueBookingRules(service?.categoryDetails)
    const soleVenueOption = venueOptions.length === 1 ? venueOptions[0] : undefined
    setSelectedVenueHours(soleVenueOption
      ? {
          [soleVenueOption.id]: soleVenueOption.pricingUnit === 'event'
            ? ''
            : String(firstValidVenueDuration(
                soleVenueOption.minimumBookingHours ?? venueRules.minimumBookingHours,
                venueRules.durationIncrementHours
              )),
        }
      : {})
    setExpandedVenueOptions(new Set())
    setHeroIndex(0)
    setExpandedServiceDetails(new Set())
    setAuthoritativeQuote(undefined)
    setQuoteError('')
    setQuoteLoading(false)
    setExpandedSentiment(undefined)
  }, [
    service?.cateringServiceTypes,
    service?.categoryDetails,
    service?.id,
    initialFoodTastingPreference,
    service?.packageId,
    service?.providerMinPrice,
  ])

  React.useEffect(() => {
    if (!service?.id || !initialPhotoVideoSelection) return
    setPhotoVideoSelection(normalizePhotoVideoSelection(initialPhotoVideoSelection))
  }, [initialPhotoVideoSelection, service?.id])

  React.useEffect(() => {
    const isCombinedPackage = service?.categoryId === 'venues'
      && service.packages?.some((item) => item.id === selectedPackageId && item.isVenueCatering)
    if (isExploreMode || isCombinedPackage || initialFoodTastingPreference === false || !service || !onLoadFoodTastingDraft) return
    const serviceId = service.bookingServiceId ?? service.id
    const key = `${serviceId}:${service.packageId ?? ''}`
    if (!serviceId || loadedFoodTastingDraftKeyRef.current === key) return

    loadedFoodTastingDraftKeyRef.current = key
    let cancelled = false
    void onLoadFoodTastingDraft(service).then((result) => {
      if (cancelled || !result.ok || !result.draft) return
      setFoodTastingPreference(true)
      setSelectedTastingMenuItemIds(result.draft.menuItemIds)
      setCateringGuestCount(result.draft.attendeeCount)
      setCateringGuestCountText(String(result.draft.attendeeCount))
      foodTastingDraftRevisionRef.current = result.draft.revision
      savedFoodTastingDraftFingerprintRef.current = `${serviceId}:${result.draft.attendeeCount}:${result.draft.menuItemIds.slice().sort().join('|')}`
      setFoodTastingDraftMessage(result.draft.isComplete
        ? 'Your preliminary tasting menu is saved.'
        : 'Your preliminary tasting menu draft is restored.')
    }).catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [initialFoodTastingPreference, isExploreMode, onLoadFoodTastingDraft, selectedPackageId, service])

  React.useEffect(() => {
    const isCombinedPackage = service?.categoryId === 'venues'
      && service.packages?.some((item) => item.id === selectedPackageId && item.isVenueCatering)
    if (
      isExploreMode
      || isCombinedPackage
      || foodTastingPreference !== true
      || !foodTastingDraftTouchedRef.current
      || !onSaveFoodTastingDraft
      || !service
    ) return

    const serviceId = service.bookingServiceId ?? service.id
    const fingerprint = `${serviceId}:${cateringGuestCount}:${selectedTastingMenuItemIds.slice().sort().join('|')}`
    if (savedFoodTastingDraftFingerprintRef.current === fingerprint) return
    savedFoodTastingDraftFingerprintRef.current = fingerprint

    const revision = foodTastingDraftRevisionRef.current + 1
    foodTastingDraftRevisionRef.current = revision
    setFoodTastingDraftError('')
    void onSaveFoodTastingDraft({
      attendeeCount: cateringGuestCount,
      menuItemIds: selectedTastingMenuItemIds,
      revision,
      service,
    }).then((result) => {
      if (!result.ok) {
        savedFoodTastingDraftFingerprintRef.current = ''
        setFoodTastingDraftError(result.message ?? 'Your food tasting draft could not be saved.')
        return
      }
      if (!result.stale) {
        setFoodTastingDraftMessage(result.isComplete
          ? 'Your preliminary tasting menu is saved.'
          : 'Draft saved. Complete every course before submitting the tasting request.')
      }
    }).catch(() => {
      savedFoodTastingDraftFingerprintRef.current = ''
      setFoodTastingDraftError('Your food tasting draft could not be saved.')
    })
  }, [
    cateringGuestCount,
    foodTastingPreference,
    isExploreMode,
    onSaveFoodTastingDraft,
    selectedPackageId,
    selectedTastingMenuItemIds,
    service,
  ])

  React.useEffect(() => {
    setAuthoritativeQuote(undefined)
    setQuoteError('')
    setQuoteLoading(false)

    if (
      !service
      || !onCalculateQuote
      || isExploreMode
      || (service.isMock && !service.bookingServiceId)
    ) return

    const isCateringService = service.categoryId === 'catering'
    const isVenueService = service.categoryId === 'venues'
    const isFloristService = service.categoryId === 'florists'
    const isConfiguredPhotoVideo = service.categoryId === 'photography' && Boolean(service.photoVideoConfiguration)
    if (isConfiguredPhotoVideo && validatePhotoVideoSelection(
      service.photoVideoConfiguration!, photoVideoSelection
    )) return
    if (isFloristService && (!service.floristConfiguration
      || (!floristSelection.packageId && floristSelection.selectedArrangements.length === 0))) return
    if (isCateringService && foodTastingPreference === true) return
    const quoteGuestCount = isCateringService ? cateringGuestCount : eventGuestCount
    const selectedProviderPackage = service.packages?.find((item) => item.id === selectedPackageId)
    const venueOptions = getVenueBookingOptions(service.categoryDetails)
    const selectedVenueSelections = venueOptions.flatMap((option) => {
      if (!Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)) return []
      const bookedHours = Number(selectedVenueHours[option.id])
      const isHourly = option.pricingUnit === 'hour'
        || (!option.pricingUnit && service.pricingUnit === 'hour')
      return [{
        optionId: option.id,
        ...(isHourly ? { bookedHours } : {}),
      }]
    })
    const customMenu = getCateringCustomMenu(service.categoryDetails)
    const useSelectedProviderPackage = Boolean(selectedProviderPackage)
    const useCustomCateringMenu = isCateringService && !useSelectedProviderPackage && Boolean(customMenu)
      && (getCateringPricingOptions(service.categoryDetails, service.providerMinPrice).length === 0
        || selectedCateringOffering === 'custom')
    if (useCustomCateringMenu && customMenu) {
      const calculation = calculateCateringCustomMenuPrice(
        customMenu,
        selectedCateringMenuItemIds,
        quoteGuestCount
      )
      if (!calculation.fitsGuestCount) return
    } else if (isCateringService && !useSelectedProviderPackage && !selectedCateringOptionId) return
    if (!useSelectedProviderPackage && isVenueService && (
      selectedVenueSelections.length === 0
      || selectedVenueSelections.some((selection) =>
        selection.bookedHours !== undefined
        && (!Number.isFinite(selection.bookedHours) || selection.bookedHours <= 0)
      )
    )) return

    let cancelled = false
    setQuoteLoading(true)
    const timer = setTimeout(() => {
      void onCalculateQuote({
        attendeeCount: isCateringService ? quoteGuestCount : undefined,
        menuItemIds: useCustomCateringMenu ? selectedCateringMenuItemIds : undefined,
        optionId: isVenueService ? undefined
          : isCateringService && !useSelectedProviderPackage ? selectedCateringOptionId : undefined,
        packageId: selectedPackageId || service.packageId,
        floristSelection: isFloristService ? floristSelection : undefined,
        photoVideoSelection: isConfiguredPhotoVideo ? photoVideoSelection : undefined,
        quantity: undefined,
        service: selectedProviderPackage?.serviceId
          ? { ...service, bookingServiceId: selectedProviderPackage.serviceId }
          : service,
        venueSelections: !useSelectedProviderPackage && isVenueService
          ? selectedVenueSelections
          : undefined,
      }).then((result) => {
        if (cancelled) return
        const customerAmount = Number(result.calculatedAmount)
        const providerAmount = Number(result.providerAmount)
        if (
          result.ok
          && Number.isFinite(customerAmount)
          && customerAmount > 0
          && Number.isFinite(providerAmount)
          && providerAmount > 0
        ) {
          setAuthoritativeQuote({ customerAmount, providerAmount })
          setQuoteError('')
        } else {
          setAuthoritativeQuote(undefined)
          setQuoteError(result.message ?? 'The current event price could not be calculated.')
        }
        setQuoteLoading(false)
      }).catch((error: unknown) => {
        if (cancelled) return
        setAuthoritativeQuote(undefined)
        setQuoteError(error instanceof Error
          ? error.message
          : 'The current event price could not be calculated.')
        setQuoteLoading(false)
      })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    isExploreMode,
    onCalculateQuote,
    cateringGuestCount,
    eventGuestCount,
    selectedCateringMenuItemIds,
    selectedCateringOffering,
    selectedCateringOptionId,
    selectedPackageId,
    selectedVenueHours,
    service,
    foodTastingPreference,
    floristSelection,
    photoVideoSelection,
  ])

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

  const usesMockReviewInsights = service.isMock && !service.bookingServiceId && !['attire', 'soundLights'].includes(service.categoryId)
  const displayedReviewInsights = usesMockReviewInsights
    ? mockServiceReviewInsights
    : reviewInsights
  const displayedReviewRating = reviewInsightsLoading && !usesMockReviewInsights
    ? '...'
    : displayedReviewInsights?.totalRatings
      ? displayedReviewInsights.averageRating.toFixed(1)
      : 'New'

  const categoryFacts = summarizeCategoryDetails(service.categoryName, service.categoryDetails)
  const serviceDetailItems: ServiceDetailItem[] = [
    {
      id: 'service-provider',
      label: 'Service provider',
      value: service.providerName,
    },
    ...(service.location
      ? [{ id: 'location', label: 'Location', value: service.location }]
      : []),
    ...(service.pricingDetails
      ? [{ id: 'pricing-details', label: 'Pricing details', value: service.pricingDetails }]
      : []),
    ...categoryFacts.map((fact, index) => ({
      id: `category-${index}-${fact.label}`,
      label: fact.label,
      value: fact.value,
    })),
  ]
  const isVenue = service.categoryId === 'venues'
  const venueDetailGroups = [
    {
      id: 'venue-provider-details',
      label: 'Venue & Provider Details',
      labels: ['Service provider', 'Location', 'Venue type', 'Address'],
    },
    {
      id: 'venue-facilities',
      label: 'Amenities & Facilities',
      labels: ['Amenities', 'Other inclusions', 'Spaces / halls', 'Expandable spaces'],
    },
    {
      id: 'venue-booking-rules',
      label: 'Hours & Booking Rules',
      labels: [
        'Pricing details',
        'Operating hours',
        'Setup / ingress allowance',
        'Minimum booking',
        'Maximum booking',
        'Duration increment',
        'Setup / ingress billed',
      ],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0)
  const cateringDetailGroups = [
    {
      id: 'catering-provider-location',
      label: 'Provider & Location',
      labels: ['Service provider', 'Location'],
    },
    {
      id: 'catering-details',
      label: 'Catering Details',
      labels: ['Catering types', 'Cuisine', 'Menu options', 'Pricing basis', 'Guest range', 'Menu'],
    },
    {
      id: 'catering-dietary-options',
      label: 'Dietary Options',
      labels: ['Dietary options'],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0)
  const photoVideoDetailGroups = [
    {
      id: 'photo-video-provider-location',
      label: 'Provider & Location',
      labels: ['Service provider', 'Location', 'Coverage areas'],
    },
    {
      id: 'photo-video-coverage-team',
      label: 'Coverage & Team',
      labels: ['Service type', 'Event types', 'Coverage duration', 'Photographers', 'Videographers', 'Team capacity', 'Bookable coverage'],
    },
    {
      id: 'photo-video-booking-deliverables',
      label: 'Booking & Deliverables',
      labels: ['Minimum notice', 'Deliverables', 'Additional services', 'Editing deadline starts', 'Delivery methods', 'Included revisions'],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0)
  const floristDetailGroups = [
    {
      id: 'florist-provider-location',
      label: 'Provider & Location',
      labels: ['Service provider', 'Location', 'Service area', 'Coverage'],
    },
    {
      id: 'florist-pricing-details',
      label: 'Pricing Details',
      labels: ['Pricing details'],
    },
    {
      id: 'florist-service-details',
      label: 'Florist Details',
      labels: ['Services offered', 'Flower options', 'Colors / themes', 'Service inclusions', 'Customization', 'Setup included', 'Delivery included', 'Lead time'],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0)
  const attireDetailGroups = [
    {
      id: 'attire-provider-location',
      label: 'Provider & Location',
      labels: ['Service provider', 'Location'],
    },
    {
      id: 'attire-details',
      label: 'Attire Details',
      labels: ['Attire type', 'Service options', 'Intended for', 'Available sizes', 'Available colors', 'Quantity available'],
    },
    {
      id: 'attire-rental-fitting',
      label: 'Rental & Fitting Information',
      labels: ['Rental duration', 'Fitting required', 'Lead time', 'Inclusions', 'Pricing details'],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0)
  const attireOverviewItems = serviceDetailItems.filter((item) => [
    'Attire type',
    'Service options',
    'Intended for',
    'Available sizes',
    'Available colors',
    'Quantity available',
    'Rental duration',
    'Fitting required',
    'Lead time',
    'Inclusions',
  ].includes(item.label))
  const soundLightsDetailGroups = [
    {
      id: 'sound-lights-provider-location',
      label: 'Provider & Location',
      labels: ['Service provider', 'Location', 'Service area'],
    },
    {
      id: 'sound-lights-equipment-service',
      label: 'Equipment & Service Details',
      labels: ['Service types', 'Speakers', 'Microphones', 'Lighting types', 'Technician included'],
    },
    {
      id: 'sound-lights-coverage-capacity',
      label: 'Coverage & Capacity',
      labels: ['Recommended capacity', 'Venue coverage'],
    },
    {
      id: 'sound-lights-pricing-details',
      label: 'Pricing Details & Policies',
      labels: ['Pricing details'],
    },
  ].map((group) => ({
    ...group,
    items: serviceDetailItems.filter((item) => group.labels.includes(item.label)),
  })).filter((group) => group.items.length > 0 || group.id === 'sound-lights-pricing-details')
  const soundLightsOverviewItems = serviceDetailItems.filter((item) => [
    'Service types',
    'Speakers',
    'Microphones',
    'Lighting types',
    'Technician included',
  ].includes(item.label))
  const isFlorist = service.categoryId === 'florists'
  const isAttire = service.categoryId === 'attire'
  const isSoundLights = service.categoryId === 'soundLights'
  const isPhotographyService = service.categoryId === 'photography'
  const isPhotoVideo = service.categoryId === 'photography' && Boolean(service.photoVideoConfiguration)
  const photoVideoConfiguration = service.photoVideoConfiguration
  const photoVideoSelectionIssue = photoVideoConfiguration
    ? validatePhotoVideoSelection(photoVideoConfiguration, photoVideoSelection)
    : ''
  const photoVideoCalculation = photoVideoConfiguration
    ? calculatePhotoVideoSelectionPrice(photoVideoConfiguration, photoVideoSelection, service.commissionRate)
    : undefined
  const floristConfiguration = service.floristConfiguration
  const floristSelectionIssue = isFlorist && (!floristConfiguration
    || (!floristSelection.packageId && floristSelection.selectedArrangements.length === 0))
    ? 'Choose a florist package or at least one arrangement.'
    : ''
  const selectedPackage = service.packages?.find((item) => item.id === selectedPackageId)
  const isVenueCateringPackage = Boolean(
    isVenue && selectedPackage?.isVenueCatering && selectedPackage.cateringDetails && selectedPackage.cateringServiceId
  )
  const isCatering = service.categoryId === 'catering' || isVenueCateringPackage
  const cateringConfigurationDetails = isVenueCateringPackage
    ? selectedPackage?.cateringDetails
    : service.categoryDetails
  const cateringStartingPrice = isVenueCateringPackage
    ? selectedPackage?.price ?? service.minPrice
    : service.minPrice
  const cateringStartingUnit = isVenueCateringPackage
    ? selectedPackage?.unit ?? service.pricingUnit
    : service.pricingUnit
  const serviceStartingPrice = isCatering
    ? cateringStartingPrice
    : service.categoryId === 'venues'
      ? service.budgetRecommendation?.calculatedAmount ?? service.minPrice
      : service.minPrice
  const serviceStartingUnit = isCatering ? cateringStartingUnit : service.pricingUnit
  const serviceStartingUnitLabel = isCatering
    ? 'head'
    : pricingUnitLabel(serviceStartingUnit)
  const serviceStartingPriceValue = serviceStartingPrice > 0
    ? isPhotographyService
      ? formatPeso(serviceStartingPrice)
      : `${formatPeso(serviceStartingPrice)}${serviceStartingUnitLabel ? ` / ${serviceStartingUnitLabel}` : ''}`
    : 'Available by request'
  const attendeeCount = isCatering
    ? cateringGuestCount
    : Math.max(0, Math.floor(eventGuestCount || 0))
  const customCateringMenu = getCateringCustomMenu(cateringConfigurationDetails)
  const cateringOptions = getCateringPricingOptions(cateringConfigurationDetails, service.providerMinPrice)
  const usesSelectedProviderPackage = Boolean(selectedPackage)
  const hasCustomCateringMenu = isCatering && Boolean(customCateringMenu)
  const hasPresetCateringMenus = isCatering && cateringOptions.length > 0
  const usesCustomCateringMenu = (!usesSelectedProviderPackage || isVenueCateringPackage) && hasCustomCateringMenu
    && (!hasPresetCateringMenus || selectedCateringOffering === 'custom')
  const selectedCateringOption = cateringOptions.find((option) => option.id === selectedCateringOptionId)
  const customCateringCalculation = customCateringMenu
    ? calculateCateringCustomMenuPrice(customCateringMenu, selectedCateringMenuItemIds, attendeeCount)
    : undefined
  const cateringCalculation = selectedCateringOption
    ? calculateCateringPrice(selectedCateringOption, attendeeCount)
    : undefined
  const selectedCustomCateringOption: CateringPricingOption | undefined = customCateringMenu && customCateringCalculation
    ? {
        id: 'custom-menu',
        maximumGuests: customCateringMenu.maximumGuests,
        menuSections: customCateringMenu.sections.map((section) => ({
          id: section.id,
          items: customCateringCalculation.selectedItems
            .filter((item) => section.items.some((candidate) => candidate.id === item.id))
            .map((item) => item.name),
          name: section.name,
        })),
        minimumGuests: customCateringMenu.minimumGuests,
        name: 'Custom menu',
        pricePerHead: customCateringCalculation.unitPrice,
      }
    : undefined
  const activeCateringOption = usesCustomCateringMenu ? selectedCustomCateringOption : selectedCateringOption
  const activeCateringCalculation = usesCustomCateringMenu ? customCateringCalculation : cateringCalculation
  const cateringGuestMinimum = usesCustomCateringMenu && customCateringMenu
    ? customCateringMenu.minimumGuests
    : selectedCateringOption?.minimumGuests
      ?? (cateringOptions.length
        ? Math.min(...cateringOptions.map((option) => option.minimumGuests))
        : customCateringMenu?.minimumGuests ?? 1)
  const cateringGuestMaximum = usesCustomCateringMenu && customCateringMenu
    ? customCateringMenu.maximumGuests
    : selectedCateringOption?.maximumGuests
      ?? (cateringOptions.length
        ? Math.max(...cateringOptions.map((option) => option.maximumGuests))
        : customCateringMenu?.maximumGuests)
  const parsedCateringGuestCount = Number(cateringGuestCountText)
  const cateringGuestCountIssue = !isCatering
    ? ''
    : !/^\d+$/.test(cateringGuestCountText) || !Number.isSafeInteger(parsedCateringGuestCount)
      ? 'Enter a whole-number guest count.'
      : parsedCateringGuestCount < cateringGuestMinimum
        ? `This service needs at least ${cateringGuestMinimum} guests.`
        : cateringGuestMaximum !== undefined && parsedCateringGuestCount > cateringGuestMaximum
          ? `This service supports up to ${cateringGuestMaximum} guests.`
          : cateringGuestCountMessage
  const budgetPerHead = activeCateringOption?.pricePerHead ?? 0
  const cateringTastingSettings = getCateringTastingSettings(cateringConfigurationDetails)
  const cateringTastingMenu = getCateringTastingMenu(cateringConfigurationDetails)
  const foodTastingAvailable = Boolean(cateringTastingSettings && cateringTastingMenu)
  const foodTastingUnavailableReason = !cateringTastingSettings
    ? 'This caterer has not enabled food tasting appointments. You can still choose your menu directly.'
    : !cateringTastingMenu
      ? 'This caterer needs to configure course-level tasting limits before food tasting can be requested. You can still choose your menu directly.'
      : ''
  const foodTastingPreferenceRequired = isCatering && foodTastingPreference === undefined
  const selectedTastingMenuItemIdSet = new Set(selectedTastingMenuItemIds)
  const foodTastingSelectionIssue = (() => {
    if (!isCatering || foodTastingPreference !== true) return ''
    if (!cateringTastingMenu) return 'This food tasting menu is not available yet.'
    for (const section of cateringTastingMenu.sections) {
      const selectedCount = section.items.filter((item) =>
        item.isActive && selectedTastingMenuItemIdSet.has(item.id)
      ).length
      if (selectedCount !== section.tastingSelectionLimit) {
        return `${section.name}: select exactly ${section.tastingSelectionLimit} dish${section.tastingSelectionLimit === 1 ? '' : 'es'} to taste.`
      }
    }
    return ''
  })()
  const foodTastingMenuSelectionPending = isCatering
    && foodTastingPreference === true
    && Boolean(foodTastingSelectionIssue)
  const isFoodTastingFlow = isCatering && foodTastingPreference === true
  const cateringSelectionUnavailable = isCatering && (!usesSelectedProviderPackage || isVenueCateringPackage) && (
    !activeCateringOption || !activeCateringCalculation?.fitsGuestCount
  )
  const cateringSelectionActionLabel = !activeCateringOption
    ? 'Choose a Catering Option'
    : !activeCateringCalculation?.fitsGuestCount
      ? 'Choose an Option for Your Guest Count'
      : 'Review Catering Selection'
  const venueOptions = getVenueBookingOptions(service.categoryDetails)
  const venueRules = getVenueBookingRules(service.categoryDetails)
  const isHourlyVenueOption = (option: VenueBookingOption) => option.pricingUnit === 'hour'
    || (!option.pricingUnit && service.pricingUnit === 'hour')
  const selectedVenueOptions = venueOptions.filter((option) =>
    Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)
  )
  const selectedVenueSelections: VenueOptionSelection[] = selectedVenueOptions.map((option) => {
    const bookedHours = Number(selectedVenueHours[option.id])
    return {
      optionId: option.id,
      ...(isHourlyVenueOption(option) ? { bookedHours } : {}),
    }
  })
  const primaryVenueOption = selectedVenueOptions[0]
  const primaryVenueHours = primaryVenueOption && isHourlyVenueOption(primaryVenueOption)
    ? Number(selectedVenueHours[primaryVenueOption.id])
    : undefined
  const optionMinimumHours = (option: VenueBookingOption) =>
    option.minimumBookingHours ?? venueRules.minimumBookingHours
  const optionMaximumHours = (option: VenueBookingOption) =>
    option.maximumBookingHours ?? venueRules.maximumBookingHours
  const venueSelectionIssue = (() => {
    if (!isVenue) return ''
    if (usesSelectedProviderPackage) {
      return !eventDate || !eventTime
        ? "Set your event date and start time to check this venue package's availability."
        : ''
    }
    if (selectedVenueOptions.length === 0) return 'Choose at least one available venue option.'
    if (!eventDate || !eventTime) return "Set your event date and start time to check this venue's availability."
    if (selectedVenueOptions.length > 1 && selectedVenueOptions.some((option) => !option.allowsCombination)) {
      return 'Every selected option must allow combination with other venue options.'
    }
    const selectedIds = new Set(selectedVenueOptions.map((option) => option.id))
    for (const option of selectedVenueOptions) {
      if (option.requiredOptionIds.some((id) => !selectedIds.has(id))) {
        return `${option.name} requires another venue option that has not been selected.`
      }
      if (option.mutuallyExclusiveOptionIds.some((id) => selectedIds.has(id))) {
        return `${option.name} cannot be selected together with one of the chosen options.`
      }
      if (isHourlyVenueOption(option)) {
        const hours = Number(selectedVenueHours[option.id])
        const minimum = optionMinimumHours(option)
        const maximum = optionMaximumHours(option)
        const alignsWithIncrement = Number.isFinite(hours)
          && Math.abs(hours / venueRules.durationIncrementHours
            - Math.round(hours / venueRules.durationIncrementHours)) < 0.000001
        if (!Number.isFinite(hours) || hours <= 0 || !alignsWithIncrement
          || hours < minimum || (maximum !== undefined && hours > maximum)) {
          return `${option.name} needs a valid ${minimum}-hour minimum duration${maximum ? ` (up to ${maximum} hours)` : ''}.`
        }
      }
    }
    const resources = selectedVenueOptions.flatMap((option) => option.resourceIds)
    if (new Set(resources).size !== resources.length) {
      return 'Selected venue options cannot use the same space twice.'
    }
    const combinedCapacity = selectedVenueOptions.reduce((total, option) => total + option.capacity, 0)
    if (combinedCapacity < Math.max(attendeeCount, 1)) {
      return 'The selected venue options do not have enough combined capacity for this event.'
    }
    return ''
  })()
  const venueSelectionUnavailable = isVenue && Boolean(venueSelectionIssue)
  const venueScheduleRequired = isVenue && (!eventDate || !eventTime)
  const canEditMissingVenueSchedule = Boolean(
    venueScheduleRequired
    && onEditEventDetails
    && (usesSelectedProviderPackage || selectedVenueOptions.length > 0)
  )
  const venueSelectionActionLabel = selectedVenueOptions.length === 0 && !usesSelectedProviderPackage
    ? 'Choose a Venue Option'
    : !eventDate || !eventTime
      ? 'Set Event Date and Start Time'
      : venueSelectionIssue.toLowerCase().includes('duration')
        ? 'Set a Valid Rental Duration'
        : 'Review Venue Selection'
  const selectedUnit = selectedPackage?.unit ?? service.pricingUnit ?? 'event'
  const selectedPrice = selectedPackage?.price ?? service.minPrice
  const selectedProviderPrice = selectedPackage?.providerPrice ?? service.providerMinPrice
  const hasOptionLevelVenuePricing = selectedVenueOptions.length > 0
    && selectedVenueOptions.every((option) => Boolean(option.pricingUnit && option.baseRate && option.baseRate > 0))
  const requiresQuote = !isPhotoVideo && !usesSelectedProviderPackage
    && (service.pricingModel === 'customQuote' || selectedPrice <= 0)
    && !(isVenue && hasOptionLevelVenuePricing)
  const locallyEstimatedVenueProviderTotal = selectedVenueOptions.reduce((total, option) => {
    if (option.pricingUnit && option.baseRate && option.baseRate > 0) {
      return total + (option.pricingUnit === 'hour'
        ? option.baseRate * Number(selectedVenueHours[option.id] ?? 0)
        : option.baseRate)
    }
    // Legacy venue listings retain their established single-price calculation.
    const hours = Number(selectedVenueHours[option.id] ?? 0)
    return total + (service.pricingUnit === 'hour'
      ? selectedProviderPrice * hours
        + (venueRules.setupAllowanceBillable ? selectedProviderPrice * venueRules.setupAllowanceHours : 0)
      : selectedProviderPrice)
  }, 0)
  const locallyEstimatedProviderTotal = photoVideoCalculation?.providerTotal ?? (usesSelectedProviderPackage
    ? selectedProviderPrice * (selectedUnit === 'person' ? Math.max(attendeeCount, 1) : 1)
    : isCatering
    ? cateringCalculation?.providerSubtotal ?? 0
    : isVenue
      ? locallyEstimatedVenueProviderTotal
    : selectedUnit === 'person' && attendeeCount > 0
      ? selectedProviderPrice * attendeeCount
      : selectedProviderPrice)
  const providerEstimatedTotal = authoritativeQuote?.providerAmount
    ?? locallyEstimatedProviderTotal
  const estimatedTotal =
    authoritativeQuote?.customerAmount
      ?? (requiresQuote
        ? 0
        : customerPriceFromProviderPrice(providerEstimatedTotal, service.commissionRate))
  const requiresAuthoritativeQuote = Boolean(
    onCalculateQuote
    && !isExploreMode
    && !(service.isMock && !service.bookingServiceId)
    && !isPhotoVideo
  )
  const authoritativeQuoteUnavailable = requiresAuthoritativeQuote
    && (quoteLoading || Boolean(quoteError) || !authoritativeQuote)
  const estimatedDisplay =
    quoteLoading
      ? 'Calculating...'
      : quoteError
        ? 'Price unavailable'
      : requiresQuote && !authoritativeQuote
        ? 'Quote required'
      : formatPeso(estimatedTotal)
  const scheduleUnavailable = !isExploreMode
    && service.budgetRecommendation?.availabilityStatus === 'unavailable'
  const standardSelectionDisabled = isAddingSelection
    || cateringSelectionUnavailable
    || (venueSelectionUnavailable && !canEditMissingVenueSchedule)
    || Boolean(cateringGuestCountIssue)
    || Boolean(floristSelectionIssue)
    || Boolean(photoVideoSelectionIssue)
    || foodTastingPreferenceRequired
    || foodTastingMenuSelectionPending
    || (authoritativeQuoteUnavailable && !canEditMissingVenueSchedule)
    || scheduleUnavailable
  const foodTastingRequestDisabled = isAddingSelection
    || Boolean(cateringGuestCountIssue)
    || Boolean(foodTastingSelectionIssue)
    || !onAddSelection
  const currentActionDisabled = isFoodTastingFlow
    ? foodTastingRequestDisabled
    : standardSelectionDisabled

  const setCateringGuests = (nextValue: number) => {
    const next = Math.max(1, Math.floor(nextValue))
    if (foodTastingPreference === true) foodTastingDraftTouchedRef.current = true
    setCateringGuestCount(next)
    setCateringGuestCountText(String(next))
    setCateringGuestCountMessage('')
  }

  const commitCateringGuestCount = () => {
    if (!/^\d+$/.test(cateringGuestCountText)) {
      setCateringGuestCountMessage('Enter a whole-number guest count.')
      return
    }
    const next = Number(cateringGuestCountText)
    if (!Number.isSafeInteger(next) || next < cateringGuestMinimum) {
      setCateringGuestCountMessage(`This service needs at least ${cateringGuestMinimum} guests.`)
      return
    }
    if (cateringGuestMaximum !== undefined && next > cateringGuestMaximum) {
      setCateringGuestCountMessage(`This service supports up to ${cateringGuestMaximum} guests.`)
      return
    }
    setCateringGuests(next)
  }

  const adjustCateringGuestCount = (direction: -1 | 1) => {
    const next = cateringGuestCount + direction
    if (next < cateringGuestMinimum) {
      setCateringGuestCountMessage(`This service needs at least ${cateringGuestMinimum} guests.`)
      return
    }
    if (cateringGuestMaximum !== undefined && next > cateringGuestMaximum) {
      setCateringGuestCountMessage(`This service supports up to ${cateringGuestMaximum} guests.`)
      return
    }
    setCateringGuests(next)
  }

  const handleAddSelection = async () => {
    if (isFoodTastingFlow) {
      if (
        !onAddSelection
        || isAddingSelection
        || Boolean(foodTastingSelectionIssue)
        || Boolean(cateringGuestCountIssue)
      ) return

      setIsAddingSelection(true)
      setFoodTastingDraftError('')
      try {
        await onAddSelection({
          attendeeCount: cateringGuestCount,
          budgetPerHead: 0,
          estimatedTotal: 0,
          foodTastingMenuItemIds: selectedTastingMenuItemIds,
          foodTastingPreference: true,
          combinedCateringServiceId: isVenueCateringPackage ? selectedPackage?.cateringServiceId : undefined,
          notes: '',
          service,
          venueCateringPackageId: isVenueCateringPackage ? selectedPackage?.id : undefined,
        })
      } finally {
        setIsAddingSelection(false)
      }
      return
    }

    if (canEditMissingVenueSchedule) {
      onEditEventDetails?.()
      return
    }

    if (
      !onAddSelection
      || isAddingSelection
      || cateringSelectionUnavailable
      || venueSelectionUnavailable
      || Boolean(cateringGuestCountIssue)
      || Boolean(floristSelectionIssue)
      || Boolean(photoVideoSelectionIssue)
      || foodTastingPreferenceRequired
      || foodTastingMenuSelectionPending
      || authoritativeQuoteUnavailable
      || scheduleUnavailable
    ) return

    setIsAddingSelection(true)

    try {
      await onAddSelection({
        attendeeCount,
        budgetPerHead: usesSelectedProviderPackage && selectedUnit === 'person'
          ? selectedPrice
          : budgetPerHead,
        cateringMenuItemIds: usesCustomCateringMenu ? selectedCateringMenuItemIds : undefined,
        cateringOption: usesSelectedProviderPackage && !isVenueCateringPackage ? undefined : activeCateringOption,
        combinedCateringServiceId: isVenueCateringPackage ? selectedPackage?.cateringServiceId : undefined,
        estimatedTotal,
        foodTastingPreference: isCatering ? foodTastingPreference : undefined,
        floristSelection: isFlorist ? floristSelection : undefined,
        photoVideoSelection: isPhotoVideo ? photoVideoSelection : undefined,
        // Catering formats are provider capabilities, not client booking choices.
        mealType: undefined,
        // Client dietary and special requests belong in the dedicated
        // Instruction Module, reached after service selection.
        notes: '',
        venueCateringPackageId: isVenueCateringPackage ? selectedPackage?.id : undefined,
        venueBookedHours: !usesSelectedProviderPackage && isVenue ? primaryVenueHours : undefined,
        venueOption: !usesSelectedProviderPackage && isVenue ? primaryVenueOption : undefined,
        venueSelections: !usesSelectedProviderPackage && isVenue ? selectedVenueSelections : undefined,
        service: selectedPackage
          ? {
              ...service,
              bookingServiceId: selectedPackage.serviceId || service.bookingServiceId,
              minPrice: selectedPackage.price,
              packageId: selectedPackage.id,
              pricingUnit: selectedPackage.unit ?? service.pricingUnit ?? 'event',
              providerMinPrice: selectedPackage.providerPrice,
            }
          : isCatering && activeCateringOption
          ? {
              ...service,
              minPrice: customerPriceFromProviderPrice(activeCateringOption.pricePerHead, service.commissionRate),
              pricingUnit: 'person',
              providerMinPrice: activeCateringOption.pricePerHead,
            }
          : service,
      })
    } finally {
      setIsAddingSelection(false)
    }
  }

  const chooseFoodTastingPreference = (next: boolean) => {
    animateOptionLayout()
    setFoodTastingPreference(next)
    setFoodTastingDraftError('')
    if (next) {
      foodTastingDraftTouchedRef.current = true
      setFoodTastingDraftMessage('Saving your preliminary tasting menu as you choose dishes.')
    } else {
      setFoodTastingDraftMessage('')
    }
    scrollOptionToCenter(`food-tasting:${next ? 'yes' : 'no'}`)
  }

  const toggleTastingMenuItem = (sectionId: string, itemId: string) => {
    const section = cateringTastingMenu?.sections.find((item) => item.id === sectionId)
    if (!section) return
    const selected = selectedTastingMenuItemIdSet.has(itemId)
    const selectedCount = section.items.filter((item) =>
      item.isActive && selectedTastingMenuItemIdSet.has(item.id)
    ).length
    if (!selected && selectedCount >= section.tastingSelectionLimit) return

    foodTastingDraftTouchedRef.current = true
    setSelectedTastingMenuItemIds((current) => selected
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]
    )
  }

  const canAddVenueOption = (candidate: VenueBookingOption) => {
    if (selectedVenueHours[candidate.id] !== undefined) return true
    // A provider publishes each room, hall, and provider-defined combination
    // as one complete bookable option.  Clients must choose exactly one of
    // those options; assembling rooms ad hoc can create unavailable or
    // incorrectly priced combinations.
    return selectedVenueOptions.length === 0
  }

  function scrollOptionNodeToCenter(resolveNode: () => React.ElementRef<typeof Pressable> | null) {
    if (venueScrollTimerRef.current) clearTimeout(venueScrollTimerRef.current)
    venueScrollTimerRef.current = setTimeout(() => {
      const scrollView = detailsScrollRef.current
      const optionNode = resolveNode()
      if (!scrollView || !optionNode) return

      scrollView.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
        optionNode.measureInWindow((_optionX, optionY, _optionWidth, optionHeight) => {
          const actionBarHeight = isOverlay && !isExploreMode ? 78 : 0
          const visibleViewportHeight = Math.max(0, scrollHeight - actionBarHeight)
          const optionCenterY = optionY + optionHeight / 2
          const viewportCenterY = scrollY + visibleViewportHeight / 2
          const nextOffset = detailsScrollOffsetRef.current + optionCenterY - viewportCenterY
          scrollView.scrollTo({ animated: true, y: Math.max(0, nextOffset) })
        })
      })
    }, optionSelectionMotionDuration)
  }

  function scrollOptionToCenter(optionKey: string) {
    scrollOptionNodeToCenter(() => optionFocusRefs.current[optionKey])
  }

  const toggleVenueOption = (option: VenueBookingOption) => {
    const wasSelected = Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)
    animateOptionLayout()
    setSelectedVenueHours((current) => {
      if (Object.prototype.hasOwnProperty.call(current, option.id)) {
        const remaining = { ...current }
        delete remaining[option.id]
        return remaining
      }
      if (!canAddVenueOption(option)) return current
      return {
        [option.id]: isHourlyVenueOption(option)
          ? String(firstValidVenueDuration(
              optionMinimumHours(option),
              venueRules.durationIncrementHours
            ))
          : '',
      }
    })
    if (!wasSelected) scrollOptionToCenter(`venue:${option.id}`)
  }

  const updateVenueHours = (option: VenueBookingOption, value: string) => {
    setSelectedVenueHours((current) => ({
      ...current,
      [option.id]: value.replace(/[^\d.]/g, ''),
    }))
  }

  const adjustVenueHours = (option: VenueBookingOption, direction: -1 | 1) => {
    setSelectedVenueHours((current) => {
      const minimum = optionMinimumHours(option)
      const maximum = optionMaximumHours(option)
      const currentValue = Number(current[option.id])
      const firstValidDuration = firstValidVenueDuration(
        minimum,
        venueRules.durationIncrementHours
      )
      const baseValue = Number.isFinite(currentValue) && currentValue > 0
        ? currentValue
        : firstValidDuration
      const nextValue = direction > 0
        ? baseValue + venueRules.durationIncrementHours
        : baseValue - venueRules.durationIncrementHours
      const bounded = Math.max(
        firstValidDuration,
        maximum === undefined ? nextValue : Math.min(nextValue, maximum)
      )
      return { ...current, [option.id]: String(bounded) }
    })
  }

  const toggleExpandedVenueOption = (optionId: string) => {
    animateOptionLayout()
    setExpandedVenueOptions((current) => {
      const next = new Set(current)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const toggleExpandedServiceDetail = (detailId: string) => {
    animateOptionLayout()
    setExpandedServiceDetails((current) => {
      const next = new Set(current)
      if (next.has(detailId)) next.delete(detailId)
      else next.add(detailId)
      return next
    })
  }

  const cateringServiceInformationSection = (
    <View style={[styles.descriptionSection, styles.overlayDetailCard]}>
      <Text style={styles.overlayInformationTitle}>Service Information</Text>
      <View style={styles.cateringInformationGroups}>
        {cateringDetailGroups.map((group) => {
          const isExpanded = expandedServiceDetails.has(group.id)

          return (
            <View key={group.id} style={styles.cateringInformationGroup}>
              <Pressable
                accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggleExpandedServiceDetail(group.id)}
                style={({ pressed }) => [
                  styles.cateringInformationHeader,
                  pressed && styles.overlayServiceFactHeaderPressed,
                ]}
              >
                <Text style={styles.cateringInformationTitle}>{group.label}</Text>
                <MaterialCommunityIcons
                  color={palette.primary}
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>
              {isExpanded ? (
                <View style={styles.cateringInformationContent}>
                  {group.items.map((detail) => {
                    const normalizedLabel = detail.label.toLowerCase()
                    const values = splitServiceDetailValues(detail.value)
                    const usesTags = ['catering types', 'cuisine', 'dietary options'].includes(normalizedLabel)
                    const usesBullets = normalizedLabel === 'menu options'

                    return (
                      <View key={detail.id} style={styles.cateringInformationRow}>
                        <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                        {usesTags ? (
                          <View style={styles.cateringInformationTagList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                <Text style={styles.cateringInformationTagText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : usesBullets ? (
                          <View style={styles.cateringInformationBulletList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationBulletRow}>
                                <Text style={styles.cateringInformationBullet}>•</Text>
                                <Text style={styles.cateringInformationBulletText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
      <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} />
    </View>
  )

  const photoVideoServiceInformationSection = (
    <View style={[styles.descriptionSection, styles.overlayDetailCard]}>
      <Text style={styles.overlayInformationTitle}>Service Information</Text>
      <View style={styles.cateringInformationGroups}>
        {photoVideoDetailGroups.map((group) => {
          const isExpanded = expandedServiceDetails.has(group.id)

          return (
            <View key={group.id} style={styles.cateringInformationGroup}>
              <Pressable
                accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggleExpandedServiceDetail(group.id)}
                style={({ pressed }) => [
                  styles.cateringInformationHeader,
                  pressed && styles.overlayServiceFactHeaderPressed,
                ]}
              >
                <Text style={styles.cateringInformationTitle}>{group.label}</Text>
                <MaterialCommunityIcons
                  color={palette.primary}
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>
              {isExpanded ? (
                <View style={styles.cateringInformationContent}>
                  {group.items.map((detail) => {
                    const normalizedLabel = detail.label.toLowerCase()
                    const values = splitServiceDetailValues(detail.value)
                    const usesTags = normalizedLabel === 'event types'
                    const usesBullets = ['bookable coverage', 'deliverables'].includes(normalizedLabel)

                    return (
                      <View key={detail.id} style={styles.cateringInformationRow}>
                        <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                        {usesTags ? (
                          <View style={styles.cateringInformationTagList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                <Text style={styles.cateringInformationTagText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : usesBullets ? (
                          <View style={styles.cateringInformationBulletList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationBulletRow}>
                                <Text style={styles.cateringInformationBullet}>{'\u2022'}</Text>
                                <Text style={styles.cateringInformationBulletText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
      <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} />
    </View>
  )

  const floristServiceInformationSection = (
    <View style={[styles.descriptionSection, styles.overlayDetailCard]}>
      <Text style={styles.overlayInformationTitle}>Service Information</Text>
      <View style={styles.cateringInformationGroups}>
        {floristDetailGroups.map((group) => {
          const isExpanded = expandedServiceDetails.has(group.id)

          return (
            <View key={group.id} style={styles.cateringInformationGroup}>
              <Pressable
                accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggleExpandedServiceDetail(group.id)}
                style={({ pressed }) => [
                  styles.cateringInformationHeader,
                  pressed && styles.overlayServiceFactHeaderPressed,
                ]}
              >
                <Text style={styles.cateringInformationTitle}>{group.label}</Text>
                <MaterialCommunityIcons
                  color={palette.primary}
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={22}
                />
              </Pressable>
              {isExpanded ? (
                <View style={styles.cateringInformationContent}>
                  {group.items.map((detail) => (
                    <View key={detail.id} style={styles.cateringInformationRow}>
                      <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                      <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
      <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} />
    </View>
  )

  const attireServiceInformationSection = (
    <View style={[styles.descriptionSection, styles.overlayDetailCard]}>
      <Text style={styles.overlayInformationTitle}>Service Information</Text>
      <View style={styles.cateringInformationGroups}>
        {attireDetailGroups.map((group) => {
          const isExpanded = expandedServiceDetails.has(group.id)

          return (
            <View key={group.id} style={styles.cateringInformationGroup}>
              <Pressable
                accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggleExpandedServiceDetail(group.id)}
                style={({ pressed }) => [styles.cateringInformationHeader, pressed && styles.overlayServiceFactHeaderPressed]}
              >
                <Text style={styles.cateringInformationTitle}>{group.label}</Text>
                <MaterialCommunityIcons color={palette.primary} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} />
              </Pressable>
              {isExpanded ? (
                <View style={styles.cateringInformationContent}>
                  {group.items.map((detail) => {
                    const values = splitServiceDetailValues(detail.value)
                    const usesTags = ['service options', 'intended for', 'available sizes', 'available colors', 'inclusions'].includes(detail.label.toLowerCase())

                    return (
                      <View key={detail.id} style={styles.cateringInformationRow}>
                        <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                        {usesTags ? (
                          <View style={styles.cateringInformationTagList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                <Text style={styles.cateringInformationTagText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              ) : null}
            </View>
          )
        })}
        <View style={styles.cateringInformationGroup}>
          <Pressable
            accessibilityLabel={`${expandedServiceDetails.has('attire-service-policies') ? 'Collapse' : 'Expand'} Service Policies`}
            accessibilityRole="button"
            accessibilityState={{ expanded: expandedServiceDetails.has('attire-service-policies') }}
            onPress={() => toggleExpandedServiceDetail('attire-service-policies')}
            style={({ pressed }) => [styles.cateringInformationHeader, pressed && styles.overlayServiceFactHeaderPressed]}
          >
            <Text style={styles.cateringInformationTitle}>Service Policies</Text>
            <MaterialCommunityIcons color={palette.primary} name={expandedServiceDetails.has('attire-service-policies') ? 'chevron-up' : 'chevron-down'} size={22} />
          </Pressable>
          {expandedServiceDetails.has('attire-service-policies') ? (
            <View style={styles.attirePoliciesContent}>
              <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )

  const soundLightsServiceInformationSection = (
    <View style={[styles.descriptionSection, styles.overlayDetailCard]}>
      <Text style={styles.overlayInformationTitle}>Service Information</Text>
      <View style={styles.cateringInformationGroups}>
        {soundLightsDetailGroups.map((group) => {
          const isExpanded = expandedServiceDetails.has(group.id)
          const isPricingAndPolicies = group.id === 'sound-lights-pricing-details'

          return (
            <View key={group.id} style={styles.cateringInformationGroup}>
              <Pressable
                accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                onPress={() => toggleExpandedServiceDetail(group.id)}
                style={({ pressed }) => [styles.cateringInformationHeader, pressed && styles.overlayServiceFactHeaderPressed]}
              >
                <Text style={styles.cateringInformationTitle}>{group.label}</Text>
                <MaterialCommunityIcons color={palette.primary} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} />
              </Pressable>
              {isExpanded ? (
                <View style={styles.cateringInformationContent}>
                  {group.items.map((detail) => {
                    const values = splitServiceDetailValues(detail.value)
                    const usesTags = ['service types', 'lighting types'].includes(detail.label.toLowerCase())

                    return (
                      <View key={detail.id} style={styles.cateringInformationRow}>
                        <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                        {usesTags ? (
                          <View style={styles.cateringInformationTagList}>
                            {values.map((value, index) => (
                              <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                <Text style={styles.cateringInformationTagText}>{value}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                        )}
                      </View>
                    )
                  })}
                  {isPricingAndPolicies ? <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} /> : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )

  const packageSection = (
    <View style={[
      styles.packagesSection,
      isOverlay && styles.overlayDetailCard,
      isCatering && styles.cateringPackagesSection,
    ]}>
      <Text style={styles.sectionHeading}>Included in These Packages</Text>
      <Text style={styles.packageSectionIntro}>
        Choose a bundle that includes this service together with other services from the provider.
      </Text>
      {service.packages?.length ? (
        <View style={styles.packageList}>
          {service.packages.map((item) => {
            const isSelected = item.id === selectedPackageId
            const packageUnit = item.unit ?? service.pricingUnit ?? 'event'

            return (
              <Pressable
                ref={(node) => {
                  optionFocusRefs.current[`package:${item.id}`] = node
                }}
                key={item.id}
                accessibilityLabel={`${isSelected ? 'Unselect' : 'Select'} package ${item.name}`}
                accessibilityRole={isExploreMode ? undefined : 'checkbox'}
                accessibilityState={isExploreMode ? undefined : { checked: isSelected }}
                disabled={isExploreMode}
                onPress={() => {
                  animateOptionLayout()
                  setSelectedPackageId((current) => current === item.id ? '' : item.id)
                  if (!isSelected) scrollOptionToCenter(`package:${item.id}`)
                }}
                style={({ pressed }) => [
                  styles.packageCard,
                  isOverlay && styles.overlayInsetCard,
                  isSelected && !isExploreMode && styles.packageCardSelected,
                  pressed && styles.packageCardPressed,
                ]}
              >
                <View style={styles.packageHeading}>
                  <View style={styles.packageTitleRow}>
                    {!isExploreMode ? (
                      <MaterialCommunityIcons
                        color={isSelected ? neutralSelection.selectedText : palette.secondaryFixedDim}
                        name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={22}
                      />
                    ) : null}
                    <Text style={[styles.packageName, isSelected && styles.selectedOptionText]}>{item.name}</Text>
                  </View>
                  <View style={styles.packagePriceGroup}>
                    {item.originalPrice ? (
                      <Text style={[styles.packageOriginalPrice, isSelected && styles.selectedOptionMutedText]}>{formatPeso(item.originalPrice)}</Text>
                    ) : null}
                    <Text style={[styles.packagePrice, isSelected && styles.selectedOptionText]}>
                      {formatPeso(item.price)}
                      {packageUnit ? ` / ${pricingUnitLabel(packageUnit)}` : ''}
                    </Text>
                  </View>
                </View>
                {item.discountAmount > 0 ? (
                  <Text style={styles.packageDiscountBadge}>
                    {item.discountType === 'percentage'
                      ? `${item.discountValue}% package promo`
                      : `${formatPeso(item.discountAmount)} package promo`}
                  </Text>
                ) : null}
                {item.description ? (
                  <Text style={[styles.packageDescription, isSelected && styles.selectedOptionMutedText]}>{item.description}</Text>
                ) : null}
                {item.isVenueCatering ? (
                  <View style={styles.venueCateringPackageBadge}>
                    <MaterialCommunityIcons color={isSelected ? neutralSelection.selectedText : palette.primary} name="silverware-fork-knife" size={16} />
                    <Text style={[styles.venueCateringPackageBadgeText, isSelected && styles.selectedOptionText]}>
                      Venue + Catering included · configure your menu below
                    </Text>
                  </View>
                ) : null}
                {item.serviceNames.length ? (
                  <View style={styles.packageServices}>
                    <Text style={[styles.packageServicesLabel, isSelected && styles.selectedOptionMutedText]}>SERVICES IN THIS PACKAGE</Text>
                    {item.serviceNames.map((serviceName) => (
                      <Text key={serviceName} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>
                        {'\u2022'} {serviceName}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {item.inclusions.length ? (
                  <View style={styles.inclusionList}>
                    {item.inclusions.map((inclusion) => (
                      <Text key={inclusion} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>
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
          {isCatering
            ? 'This service is not included in any bundle.'
            : 'This service is not currently included in a package. Its listed price still applies.'}
        </Text>
      )}
    </View>
  )

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={detailsScrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          isOverlay && styles.overlayScrollContent,
          isOverlay && !isExploreMode && styles.overlayScrollContentWithAction,
          isVenueOverlay && !isExploreMode && styles.venueOverlayScrollContentWithAction,
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          detailsScrollOffsetRef.current = event.nativeEvent.contentOffset.y
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={styles.detailsScroll}
      >
        <View style={[styles.hero, { height: displayedHeroHeight }]}>
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
                  style={{ width: heroWidth, height: displayedHeroHeight }}
                />
              ))
            ) : (
              <View style={[styles.heroPlaceholder, { width: heroWidth, height: displayedHeroHeight }]}>
                <Text style={styles.heroPlaceholderText}>{service.name}</Text>
              </View>
            )}
          </ScrollView>

          <LinearGradient
            colors={isOverlay
              ? ['rgba(12, 8, 10, 0)', 'rgba(12, 8, 10, 0.38)', 'rgba(12, 8, 10, 0.88)']
              : ['rgba(18, 10, 12, 0)', 'rgba(18, 10, 12, 0.72)']}
            locations={isOverlay ? [0, 0.36, 1] : [0, 1]}
            pointerEvents="none"
            style={styles.heroShade}
          />

          {!isOverlay ? (
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

            </View>
          ) : null}

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
              <View style={[styles.heroBadge, styles.categoryBadge, isOverlay && styles.overlayHeroBadge]}>
                <Text numberOfLines={1} style={styles.categoryBadgeText}>{service.categoryId === 'venues' ? 'VENUE' : service.categoryName.toUpperCase()}</Text>
              </View>
              <View style={[styles.heroBadge, styles.ratingBadge, isOverlay && styles.overlayHeroBadge]}>
                <MaterialCommunityIcons color={palette.gold} name="star" size={16} />
                <Text numberOfLines={1} style={styles.ratingBadgeText}>
                  {service.rating}
                  {isVenueOverlay && displayedReviewInsights?.totalRatings
                    ? ` (${displayedReviewInsights.totalRatings})`
                    : ''}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.serviceTitle}>{service.name}</Text>
            {isOverlay && service.location ? (
              <View style={styles.venueHeroLocation}>
                <MaterialCommunityIcons color={palette.white} name="map-marker-outline" size={16} />
                <Text numberOfLines={1} style={styles.venueHeroLocationText}>{service.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.content, isWide && styles.contentPaddingWide, isOverlay && styles.overlayContent]}>
          {isVenueOverlay ? (
            <>
              <View style={[styles.venueOverlaySection, styles.venueOverlayPriceCard]}>
                <Text style={styles.venueOverlayEyebrow}>PRICING</Text>
                <Text style={styles.venueOverlayPriceIntro}>{serviceStartingPrice > 0 ? 'Price starts at' : 'Price'}</Text>
                <Text style={styles.venueOverlayPrice}>{serviceStartingPriceValue}</Text>
                {service.pricingDetails ? (
                  <Text style={styles.venueOverlaySupportingCopy}>{service.pricingDetails}</Text>
                ) : null}
              </View>

              <View style={styles.venueOverlaySection}>
                <Text style={styles.venueOverlaySectionTitle}>Event Requirements</Text>
                <View style={styles.venueRequirementChips}>
                  <View style={styles.venueRequirementChip}>
                    <MaterialCommunityIcons color={palette.primary} name="account-group-outline" size={18} />
                    <Text style={styles.venueRequirementChipText}>
                      {attendeeCount.toLocaleString('en-PH')} guests
                    </Text>
                  </View>
                  <View style={styles.venueRequirementChip}>
                    <MaterialCommunityIcons color={palette.primary} name="calendar-blank-outline" size={18} />
                    <Text style={styles.venueRequirementChipText}>{formatEventDateLabel(eventDate)}</Text>
                  </View>
                  <View style={styles.venueRequirementChip}>
                    <MaterialCommunityIcons color={palette.primary} name="clock-outline" size={18} />
                    <Text style={styles.venueRequirementChipText}>{formatEventTimeLabel(eventTime)}</Text>
                  </View>
                </View>
              </View>

              {!isExploreMode ? (
                <View style={styles.venueOverlaySection}>
                  <Text style={styles.venueOverlaySectionTitle}>Venue Options</Text>
                  {usesSelectedProviderPackage ? (
                    <View style={[styles.cateringSummaryCard, styles.overlayInsetCard]}>
                      <Text style={styles.cateringOptionName}>{selectedPackage?.name}</Text>
                      <Text style={styles.cateringOptionRange}>Provider package · fixed total for the event</Text>
                      <Text style={styles.cateringOptionUnit}>{formatPeso(selectedPackage?.price ?? 0)} total</Text>
                      {selectedPackage?.inclusions.length ? (
                        <View style={styles.inclusionList}>
                          {selectedPackage.inclusions.map((inclusion) => (
                            <Text key={inclusion} style={styles.inclusionText}>{'\u2713'} {inclusion}</Text>
                          ))}
                        </View>
                      ) : null}
                      <Text style={styles.cateringOptionRange}>
                        Package terms replace individual venue options and duration. Event schedule and capacity are still validated before it is saved.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.venueOverlaySupportingCopy}>
                        Select one or more compatible spaces. Every selected option remains subject to its existing capacity, combination, and availability rules.
                      </Text>
                      {venueOptions.length > 0 ? (
                        <View style={styles.venueOptionsContainer}>
                          {venueOptions.map((option) => {
                            const selected = Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)
                            const canSelect = selected || canAddVenueOption(option)
                            const optionUnit = option.pricingUnit ?? service.pricingUnit ?? 'event'
                            const providerRate = option.baseRate || selectedProviderPrice
                            const customerRate = customerPriceFromProviderPrice(providerRate, service.commissionRate)
                            const optionPriceLabel = `${formatPeso(customerRate)}/${pricingUnitLabel(optionUnit).replace('per ', '')}`

                            return (
                              <Pressable
                                ref={(node) => {
                                  optionFocusRefs.current[`venue:${option.id}`] = node
                                }}
                                key={option.id}
                                accessibilityLabel={`${option.name}. ${option.kind === 'combination' ? 'Expandable combination' : 'Individual space'}. Capacity ${option.capacity} guests.`}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected, disabled: !canSelect }}
                                disabled={!canSelect}
                                onPress={() => toggleVenueOption(option)}
                                style={({ pressed }) => [
                                  styles.venueOverlayOptionCard,
                                  selected && styles.venueOptionChoiceSelected,
                                  !canSelect && styles.cateringOptionCardDisabled,
                                  pressed && styles.venueOptionChoicePressed,
                                ]}
                              >
                                <View style={styles.venueOverlayOptionHeader}>
                                  <View style={[styles.venueOptionStack, styles.venueOverlayOptionStack]}>
                                    <View style={[styles.venueOptionCopy, styles.venueOverlayOptionCopy]}>
                                      <Text style={[styles.venueOverlayOptionName, selected && styles.selectedOptionText]}>
                                        {option.name}
                                      </Text>
                                      {providerRate > 0 ? (
                                        <Text style={[styles.venueOverlayOptionPrice, selected && styles.selectedOptionText]}>
                                          {optionPriceLabel}
                                        </Text>
                                      ) : null}
                                      <View style={styles.venueOverlayOptionChips}>
                                        <View style={[styles.venueOverlayOptionChip, selected && styles.venueOverlayOptionChipSelected]}>
                                          <Text style={[styles.venueOverlayOptionChipText, selected && styles.selectedOptionText]}>{option.spaceType}</Text>
                                        </View>
                                        <View style={[styles.venueOverlayOptionChip, selected && styles.venueOverlayOptionChipSelected]}>
                                          <Text style={[styles.venueOverlayOptionChipText, selected && styles.selectedOptionText]}>
                                            {option.kind === 'combination' ? 'Expandable Combination' : 'Individual Space'}
                                          </Text>
                                        </View>
                                      </View>
                                      <Text style={[styles.cateringOptionRange, styles.venueOverlayLegacyMeta, selected && styles.selectedOptionMutedText]}>
                                        {option.kind === 'combination' ? 'Expandable combination' : 'Individual space'} · {option.spaceType}
                                      </Text>
                                    </View>
                                  </View>
                                  {providerRate > 0 ? (
                                    <Text numberOfLines={1} style={[styles.venueOverlayOptionPrice, styles.venueOverlayLegacyMeta, selected && styles.selectedOptionText]}>
                                      {optionPriceLabel}
                                    </Text>
                                  ) : null}
                                </View>
                                <View style={[styles.venueOverlayOptionStats, selected && styles.venueOverlayOptionStatsSelected]}>
                                  <View style={styles.venueOverlayOptionStat}>
                                    <Text style={[styles.venueOverlayOptionStatLabel, selected && styles.selectedOptionMutedText]}>CAPACITY</Text>
                                    <Text style={[styles.venueOverlayOptionStatValue, selected && styles.selectedOptionText]}>{option.capacity} guests</Text>
                                  </View>
                                  <View style={[styles.venueOverlayOptionStat, styles.venueOverlayOptionStatLast]}>
                                    <Text style={[styles.venueOverlayOptionStatLabel, selected && styles.selectedOptionMutedText]}>AREA</Text>
                                    <Text style={[styles.venueOverlayOptionStatValue, selected && styles.selectedOptionText]}>
                                      {option.areaSqm ? `${option.areaSqm} sqm` : 'Not specified'}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.cateringMenuItems, styles.venueOverlayLegacyMeta, selected && styles.selectedOptionMutedText]}>
                                  Capacity: {option.capacity} guests · Area: {option.areaSqm || 'Not specified'} sqm
                                </Text>
                                {!canSelect ? (
                                  <Text style={styles.cateringMismatch}>
                                    This option conflicts with another selected space or cannot be combined.
                                  </Text>
                                ) : null}
                              </Pressable>
                            )
                          })}
                        </View>
                      ) : null}

                      {selectedVenueOptions.map((option) => {
                        const expanded = expandedVenueOptions.has(option.id)
                        const isHourly = isHourlyVenueOption(option)
                        const minimumHours = optionMinimumHours(option)
                        const maximumHours = optionMaximumHours(option)
                        const enteredHours = Number(selectedVenueHours[option.id])
                        const providerSubtotal = option.pricingUnit && option.baseRate
                          ? option.pricingUnit === 'hour'
                            ? option.baseRate * (Number.isFinite(enteredHours) ? enteredHours : 0)
                            : option.baseRate
                          : service.pricingUnit === 'hour'
                            ? selectedProviderPrice * (Number.isFinite(enteredHours) ? enteredHours : 0)
                            : selectedProviderPrice
                        const unitRate = option.pricingUnit && option.baseRate
                          ? option.baseRate
                          : selectedProviderPrice

                        return (
                          <View key={`${option.id}-venue-overlay-details`} style={styles.venueSelectionCard}>
                            <View style={styles.cateringOptionHeading}>
                              <View style={styles.venueSelectionHeadingCopy}>
                                <Text numberOfLines={2} style={styles.cateringOptionName}>{option.name}</Text>
                              </View>
                              <Text numberOfLines={1} style={styles.venueSelectionSubtotal}>
                                {formatPeso(customerPriceFromProviderPrice(providerSubtotal, service.commissionRate))}
                              </Text>
                            </View>
                            <Text numberOfLines={1} style={styles.venueRentalRate}>
                              {isHourly ? 'Hourly rental' : 'Per-event rental'} {'\u00B7'} {formatPeso(customerPriceFromProviderPrice(unitRate, service.commissionRate))} per {isHourly ? 'hour' : 'event'}
                            </Text>
                            {isHourly ? (
                              <>
                                <Text style={styles.inputLabel}>RENTAL DURATION</Text>
                                <View style={styles.venueDurationRow}>
                                  <Pressable accessibilityLabel={`Decrease ${option.name} duration`} onPress={() => adjustVenueHours(option, -1)} style={({ pressed }) => [styles.venueDurationButton, pressed && styles.venueDurationButtonPressed]}>
                                    <Text style={styles.venueDurationButtonText}>−</Text>
                                  </Pressable>
                                  <TextInput
                                    accessibilityLabel={`${option.name} rental duration in hours`}
                                    keyboardType="decimal-pad"
                                    onChangeText={(value) => updateVenueHours(option, value)}
                                    placeholder={String(minimumHours)}
                                    placeholderTextColor={palette.secondaryFixedDim}
                                    style={styles.venueDurationInput}
                                    value={selectedVenueHours[option.id]}
                                  />
                                  <Text numberOfLines={1} style={styles.venueDurationUnit}>hours</Text>
                                  <Pressable accessibilityLabel={`Increase ${option.name} duration`} onPress={() => adjustVenueHours(option, 1)} style={({ pressed }) => [styles.venueDurationButton, pressed && styles.venueDurationButtonPressed]}>
                                    <Text style={styles.venueDurationButtonText}>+</Text>
                                  </Pressable>
                                </View>
                                <Text style={styles.venueDurationHelper}>
                                  Minimum rental: {minimumHours} hours · Adjust in {venueRules.durationIncrementHours}-hour increments{maximumHours ? ` · Maximum: ${maximumHours} hours` : ''}
                                </Text>
                              </>
                            ) : (
                              <View style={styles.venueTermsCard}>
                                <Text style={styles.cateringOptionUnit}>Fixed per-event rate</Text>
                                <Text style={styles.cateringOptionRange}>
                                  {option.includedDurationHours
                                    ? `Included use: up to ${option.includedDurationHours} hours`
                                    : option.minimumBookingHours
                                      ? `Minimum rental term: ${option.minimumBookingHours} hours`
                                      : 'View the provider rental conditions below.'}
                                </Text>
                              </View>
                            )}
                            <Pressable accessibilityRole="button" onPress={() => toggleExpandedVenueOption(option.id)} style={styles.venueDetailsToggle}>
                              <Text style={styles.venueDetailsToggleText}>{expanded ? 'HIDE RENTAL DETAILS' : 'VIEW RENTAL DETAILS'}</Text>
                            </Pressable>
                            {expanded ? (
                              <View style={styles.venueExpandedDetails}>
                                {option.description ? <Text style={styles.venueDetailCopy}>{option.description}</Text> : null}
                                {option.photoUrls.length ? (
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.venuePhotoRow}>
                                      {option.photoUrls.map((photoUrl) => <Image key={photoUrl} source={{ uri: photoUrl }} style={styles.venueOptionPhoto} />)}
                                    </View>
                                  </ScrollView>
                                ) : null}
                                <Text style={styles.venueDetailCopy}>Capacity: {option.capacity} guests · Area: {option.areaSqm || 'Not specified'} sqm</Text>
                                {option.amenities.length ? <Text style={styles.venueDetailCopy}>Amenities: {option.amenities.join(', ')}</Text> : null}
                                {option.inclusions.length ? <Text style={styles.venueDetailCopy}>Inclusions: {option.inclusions.join(', ')}</Text> : null}
                                {option.restrictions?.length ? <Text style={styles.venueDetailCopy}>Restrictions: {option.restrictions.join(', ')}</Text> : null}
                                {option.availabilityNotes ? <Text style={styles.venueDetailCopy}>Availability: {option.availabilityNotes}</Text> : null}
                                <Text style={styles.venueDetailCopy}>
                                  Access: {option.accessStartTime || venueRules.openingTime || 'Not specified'}-{option.accessEndTime || venueRules.closingTime || 'Not specified'} · Setup allowance: {option.setupAllowanceHours ?? venueRules.setupAllowanceHours} hours
                                </Text>
                                {option.overtimePolicy ? <Text style={styles.venueDetailCopy}>Overtime: {option.overtimePolicy}</Text> : null}
                              </View>
                            ) : null}
                          </View>
                        )
                      })}
                      {venueSelectionIssue ? <Text style={styles.cateringMismatch}>{venueSelectionIssue}</Text> : null}
                      {venueOptions.length === 0 ? (
                        <View style={styles.unavailableNotice}>
                          <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={20} />
                          <Text style={styles.unavailableNoticeText}>This provider must configure a venue space before the service can be selected.</Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}

              <View style={styles.venueOverlaySection}>
                <Text style={styles.venueOverlaySectionTitle}>Service Information</Text>
                <View style={styles.venueInformationGroups}>
                  {venueDetailGroups.map((group, index) => {
                    const isExpanded = expandedServiceDetails.has(group.id)
                    return (
                      <View key={group.id} style={[styles.venueInformationGroup, index === venueDetailGroups.length - 1 && styles.venueInformationGroupLast]}>
                        <Pressable
                          accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.label}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isExpanded }}
                          onPress={() => toggleExpandedServiceDetail(group.id)}
                          style={({ pressed }) => [styles.venueInformationHeader, pressed && styles.overlayServiceFactHeaderPressed]}
                        >
                          <Text style={styles.venueInformationTitle}>{group.label}</Text>
                          <MaterialCommunityIcons color={palette.primary} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={22} />
                        </Pressable>
                        {isExpanded ? (
                          <View style={styles.venueInformationContent}>
                            {group.items.map((detail) => (
                              <View key={detail.id} style={styles.venueInformationRow}>
                                <Text style={styles.venueInformationLabel}>{detail.label.toUpperCase()}</Text>
                                {detail.label === 'Spaces / halls' ? (
                                  <View style={styles.venueInformationBulletList}>
                                    {detail.value.split(' · ').filter(Boolean).map((space) => (
                                      <View key={`${detail.id}-${space}`} style={styles.venueInformationBulletItem}>
                                        <Text style={styles.venueInformationBullet}>{'\u2022'}</Text>
                                        <Text style={styles.venueInformationBulletText}>{space}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : detail.label === 'Amenities' ? (
                                  <View style={styles.venueInformationTags}>
                                    {detail.value.split(', ').filter(Boolean).map((amenity) => (
                                      <View key={`${detail.id}-${amenity}`} style={styles.venueInformationTag}>
                                        <Text style={styles.venueInformationTagText}>{amenity}</Text>
                                      </View>
                                    ))}
                                  </View>
                                ) : (
                                  <Text style={styles.venueInformationValue}>{detail.value}</Text>
                                )}
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </View>
                <PublishedBusinessPolicies neumorphic ownerId={service.providerUserId} />
              </View>

              <View style={styles.venueOverlaySection}>
                <Text style={styles.venueOverlaySectionTitle}>Available Packages</Text>
                {service.packages?.length ? (
                  <View style={styles.packageList}>
                    {service.packages.map((item) => {
                      const isSelected = item.id === selectedPackageId
                      const packageUnit = item.unit ?? service.pricingUnit ?? 'event'
                      return (
                        <Pressable
                          ref={(node) => {
                            optionFocusRefs.current[`package:${item.id}`] = node
                          }}
                          key={item.id}
                          accessibilityLabel={`${isSelected ? 'Unselect' : 'Select'} package ${item.name}`}
                          accessibilityRole={isExploreMode ? undefined : 'checkbox'}
                          accessibilityState={isExploreMode ? undefined : { checked: isSelected }}
                          disabled={isExploreMode}
                          onPress={() => {
                            animateOptionLayout()
                            setSelectedPackageId((current) => current === item.id ? '' : item.id)
                            if (!isSelected) scrollOptionToCenter(`package:${item.id}`)
                          }}
                          style={({ pressed }) => [
                            styles.packageCard,
                            styles.overlayInsetCard,
                            isSelected && !isExploreMode && styles.packageCardSelected,
                            pressed && styles.packageCardPressed,
                          ]}
                        >
                          <View style={styles.packageHeading}>
                            <View style={styles.packageTitleRow}>
                              {!isExploreMode ? (
                                <MaterialCommunityIcons color={isSelected ? neutralSelection.selectedText : palette.secondaryFixedDim} name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} />
                              ) : null}
                              <Text style={[styles.packageName, isSelected && styles.selectedOptionText]}>{item.name}</Text>
                            </View>
                            <View style={styles.packagePriceGroup}>
                              {item.originalPrice ? <Text style={[styles.packageOriginalPrice, isSelected && styles.selectedOptionMutedText]}>{formatPeso(item.originalPrice)}</Text> : null}
                              <Text style={[styles.packagePrice, isSelected && styles.selectedOptionText]}>{formatPeso(item.price)} / {pricingUnitLabel(packageUnit).replace('per ', '')}</Text>
                            </View>
                          </View>
                          {item.discountAmount > 0 ? (
                            <Text style={styles.packageDiscountBadge}>
                              {item.discountType === 'percentage'
                                ? `${item.discountValue}% package promo`
                                : `${formatPeso(item.discountAmount)} package promo`}
                            </Text>
                          ) : null}
                          {item.description ? <Text style={[styles.packageDescription, isSelected && styles.selectedOptionMutedText]}>{item.description}</Text> : null}
                          {item.isVenueCatering ? (
                            <View style={styles.venueCateringPackageBadge}>
                              <MaterialCommunityIcons color={isSelected ? neutralSelection.selectedText : palette.primary} name="silverware-fork-knife" size={16} />
                              <Text style={[styles.venueCateringPackageBadgeText, isSelected && styles.selectedOptionText]}>
                                Venue + Catering included · configure your menu below
                              </Text>
                            </View>
                          ) : null}
                          {item.serviceNames.length ? (
                            <View style={styles.packageServices}>
                              <Text style={[styles.packageServicesLabel, isSelected && styles.selectedOptionMutedText]}>SERVICES IN THIS PACKAGE</Text>
                              {item.serviceNames.map((serviceName) => (
                                <Text key={serviceName} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>{'\u2022'} {serviceName}</Text>
                              ))}
                            </View>
                          ) : null}
                          {item.inclusions.length ? (
                            <View style={styles.inclusionList}>
                              {item.inclusions.map((inclusion) => <Text key={inclusion} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>{'\u2713'} {inclusion}</Text>)}
                            </View>
                          ) : null}
                        </Pressable>
                      )
                    })}
                  </View>
                ) : (
                  <Text style={styles.noPackages}>No packages are currently available for this venue.</Text>
                )}
              </View>
            </>
          ) : null}

          {isOverlay && !isVenueOverlay ? (
            <View style={[styles.venueOverlaySection, styles.venueOverlayPriceCard]}>
              <Text style={styles.venueOverlayEyebrow}>PRICING</Text>
              <Text style={styles.venueOverlayPriceIntro}>{serviceStartingPrice > 0 ? 'Price starts at' : 'Price'}</Text>
              <View style={styles.priceValueLine}>
                <Text style={styles.venueOverlayPrice}>{serviceStartingPriceValue}</Text>
                {isPhotographyService && serviceStartingPrice > 0 ? (
                  <Text style={styles.photoPricingVariation}>Prices may vary</Text>
                ) : null}
              </View>
              {service.pricingDetails ? (
                <Text style={styles.venueOverlaySupportingCopy}>{service.pricingDetails}</Text>
              ) : null}
            </View>
          ) : null}

          {!isVenueOverlay && (!isOverlay || (!isCateringOverlay && !isFloristOverlay && !isPhotoVideoOverlay && !isAttireOverlay && !isSoundLightsOverlay)) ? <View style={[styles.descriptionSection, isOverlay && styles.overlayDetailCard]}>
            {!isOverlay ? <Text style={styles.description}>{service.description}</Text> : null}
            {!isOverlay ? (
              <View style={styles.priceSummarySection}>
                <Text style={styles.priceSummaryLabel}>PRICE</Text>
                <Text style={styles.priceSummaryIntro}>
                  {serviceStartingPrice > 0 ? 'Price starts at' : 'Price'}
                </Text>
                <View style={styles.priceValueLine}>
                  <Text style={styles.priceSummaryValue}>{serviceStartingPriceValue}</Text>
                  {isPhotographyService && serviceStartingPrice > 0 ? (
                    <Text style={styles.photoPricingVariation}>Prices may vary</Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {isOverlay && !isCateringOverlay && !isFloristOverlay && !isPhotoVideoOverlay && !isAttireOverlay && !isSoundLightsOverlay ? <Text style={styles.overlayInformationTitle}>Service Information</Text> : null}
            {!isCateringOverlay && !isFloristOverlay && !isPhotoVideoOverlay && !isAttireOverlay && !isSoundLightsOverlay ? (
              <>
                <View style={[
                  styles.serviceFacts,
                  isOverlay && styles.overlayServiceFacts,
                ]}>
                  {isOverlay ? serviceDetailItems.map((detail) => {
                    const isExpanded = expandedServiceDetails.has(detail.id)

                    return (
                      <View
                        key={detail.id}
                        style={styles.overlayServiceFactItem}
                      >
                        <Pressable
                          accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${detail.label}`}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isExpanded }}
                          onPress={() => toggleExpandedServiceDetail(detail.id)}
                          style={({ pressed }) => [
                            styles.overlayServiceFactHeader,
                            pressed && styles.overlayServiceFactHeaderPressed,
                          ]}
                        >
                          <Text style={[styles.serviceFactLabel, styles.overlayServiceFactLabel]}>
                            {detail.label.toUpperCase()}
                          </Text>
                          <MaterialCommunityIcons
                            color={palette.primary}
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={22}
                          />
                        </Pressable>
                        {isExpanded ? (
                          <View style={styles.overlayServiceFactContent}>
                            <Text style={styles.overlayServiceFactValue}>{detail.value}</Text>
                          </View>
                        ) : null}
                      </View>
                    )
                  }) : (
                    <>
                      <View style={styles.serviceFactRow}>
                        <Text style={styles.serviceFactLabel}>SERVICE PROVIDER</Text>
                        <Text style={styles.serviceFactValue}>{service.providerName}</Text>
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
                      {categoryFacts.map((fact) => (
                        <View key={`${fact.label}-${fact.value}`} style={styles.serviceFactRow}>
                          <Text style={styles.serviceFactLabel}>{fact.label.toUpperCase()}</Text>
                          <Text style={styles.serviceFactValue}>{fact.value}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
                <PublishedBusinessPolicies neumorphic={isOverlay} ownerId={service.providerUserId} />
              </>
            ) : null}
          </View> : null}

          {!isVenueOverlay && !isCateringOverlay && !isFloristOverlay && !isPhotoVideoOverlay && !isAttireOverlay && !isSoundLightsOverlay ? <View style={[
            styles.packagesSection,
            isOverlay && styles.overlayDetailCard,
            isCatering && styles.cateringPackagesSection,
          ]}>
            <Text style={styles.sectionHeading}>Included in These Packages</Text>
            <Text style={styles.packageSectionIntro}>
              Choose a bundle that includes this service together with other services from the provider.
            </Text>
            {service.packages?.length ? (
              <View style={styles.packageList}>
                {service.packages.map((item) => {
                  const isSelected = item.id === selectedPackageId
                  const packageUnit = item.unit ?? service.pricingUnit ?? 'event'

                  return (
                    <Pressable
                      ref={(node) => {
                        optionFocusRefs.current[`package:${item.id}`] = node
                      }}
                      key={item.id}
                      accessibilityLabel={`${isSelected ? 'Unselect' : 'Select'} package ${item.name}`}
                      accessibilityRole={isExploreMode ? undefined : 'checkbox'}
                      accessibilityState={isExploreMode ? undefined : { checked: isSelected }}
                      disabled={isExploreMode}
                      onPress={() => {
                        animateOptionLayout()
                        setSelectedPackageId((current) => current === item.id ? '' : item.id)
                        if (!isSelected) scrollOptionToCenter(`package:${item.id}`)
                      }}
                      style={({ pressed }) => [
                        styles.packageCard,
                        isOverlay && styles.overlayInsetCard,
                        isSelected && !isExploreMode && styles.packageCardSelected,
                        pressed && styles.packageCardPressed,
                      ]}
                    >
                      <View style={styles.packageHeading}>
                        <View style={styles.packageTitleRow}>
                          {!isExploreMode ? (
                            <MaterialCommunityIcons
                              color={isSelected ? neutralSelection.selectedText : palette.secondaryFixedDim}
                              name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                              size={22}
                            />
                          ) : null}
                          <Text style={[styles.packageName, isSelected && styles.selectedOptionText]}>{item.name}</Text>
                        </View>
                        <View style={styles.packagePriceGroup}>
                          {item.originalPrice ? (
                            <Text style={[styles.packageOriginalPrice, isSelected && styles.selectedOptionMutedText]}>{formatPeso(item.originalPrice)}</Text>
                          ) : null}
                          <Text style={[styles.packagePrice, isSelected && styles.selectedOptionText]}>
                            {formatPeso(item.price)}
                            {packageUnit ? ` / ${pricingUnitLabel(packageUnit)}` : ''}
                          </Text>
                        </View>
                      </View>
                      {item.discountAmount > 0 ? (
                        <Text style={styles.packageDiscountBadge}>
                          {item.discountType === 'percentage'
                            ? `${item.discountValue}% package promo`
                            : `${formatPeso(item.discountAmount)} package promo`}
                        </Text>
                      ) : null}
                      {item.description ? (
                        <Text style={[styles.packageDescription, isSelected && styles.selectedOptionMutedText]}>{item.description}</Text>
                      ) : null}
                      {item.isVenueCatering ? (
                        <View style={styles.venueCateringPackageBadge}>
                          <MaterialCommunityIcons color={isSelected ? neutralSelection.selectedText : palette.primary} name="silverware-fork-knife" size={16} />
                          <Text style={[styles.venueCateringPackageBadgeText, isSelected && styles.selectedOptionText]}>
                            Venue + Catering included · configure your menu below
                          </Text>
                        </View>
                      ) : null}
                      {item.serviceNames.length ? (
                        <View style={styles.packageServices}>
                          <Text style={[styles.packageServicesLabel, isSelected && styles.selectedOptionMutedText]}>SERVICES IN THIS PACKAGE</Text>
                          {item.serviceNames.map((serviceName) => (
                            <Text key={serviceName} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>
                              {'\u2022'} {serviceName}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                      {item.inclusions.length ? (
                        <View style={styles.inclusionList}>
                          {item.inclusions.map((inclusion) => (
                            <Text key={inclusion} style={[styles.inclusionText, isSelected && styles.selectedOptionText]}>
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
                {isCatering
                  ? 'This service is not included in any bundle.'
                  : 'This service is not currently included in a package. Its listed price still applies.'}
              </Text>
            )}
          </View> : null}

          {!isExploreMode && !isVenueOverlay ? (
            <View style={[styles.bookingSection, isOverlay && styles.overlayDetailCard, isFloristOverlay && styles.floristOverlayBookingSection]}>
            {service.categoryId !== 'photography' && service.categoryId !== 'florists' ? (
              <Text style={styles.sectionHeading}>
                {service.categoryId === 'catering'
                  ? 'Booking Details'
                  : service.categoryId === 'attire'
                    ? 'Attire Rental Overview'
                    : service.categoryId === 'soundLights'
                      ? "What's Included"
                      : 'Request This Service'}
              </Text>
            ) : null}

            {scheduleUnavailable ? (
              <View style={[styles.scheduleUnavailableNotice, isOverlay && styles.overlayInsetCard]}>
                <MaterialCommunityIcons color={warningNotice.icon} name="calendar-remove-outline" size={21} />
                <View style={styles.scheduleUnavailableCopy}>
                  <Text style={styles.scheduleUnavailableTitle}>Not available on your event schedule</Text>
                  <Text style={styles.unavailableNoticeText}>
                    This provider is unavailable at the selected date and time. Choose another provider or update your event schedule.
                  </Text>
                </View>
              </View>
            ) : null}

            {isCatering ? (
              <View style={styles.cateringOptionsSection}>
                <View style={styles.guestCountCard}>
                  <View style={styles.guestCountCopy}>
                    <Text style={styles.inputLabel}>NUMBER OF GUESTS</Text>
                    <Text style={styles.guestCountHint}>
                      Service-specific count. Your event-wide guest count will not be changed.
                    </Text>
                    <View style={styles.guestCountControl}>
                      <Pressable
                        accessibilityLabel="Decrease catering guest count"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: attendeeCount <= cateringGuestMinimum }}
                        disabled={attendeeCount <= cateringGuestMinimum}
                        onPress={() => adjustCateringGuestCount(-1)}
                        style={({ pressed }) => [
                          styles.guestCountButton,
                          attendeeCount <= cateringGuestMinimum && styles.guestCountButtonDisabled,
                          pressed && styles.guestCountButtonPressed,
                        ]}
                      >
                        <MaterialCommunityIcons color={palette.primary} name="minus" size={20} />
                      </Pressable>
                      <TextInput
                        accessibilityLabel="Catering guest count"
                        keyboardType="number-pad"
                        maxLength={5}
                        onBlur={commitCateringGuestCount}
                        onChangeText={(value) => {
                          const normalized = value.replace(/\D/g, '')
                          setCateringGuestCountText(normalized)
                          setCateringGuestCountMessage('')
                          if (/^\d+$/.test(normalized)) {
                            if (foodTastingPreference === true) foodTastingDraftTouchedRef.current = true
                            setCateringGuestCount(Number(normalized))
                          }
                        }}
                        onSubmitEditing={commitCateringGuestCount}
                        selectTextOnFocus
                        style={styles.guestCountInput}
                        value={cateringGuestCountText}
                      />
                      <Pressable
                        accessibilityLabel="Increase catering guest count"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: cateringGuestMaximum !== undefined && attendeeCount >= cateringGuestMaximum }}
                        disabled={cateringGuestMaximum !== undefined && attendeeCount >= cateringGuestMaximum}
                        onPress={() => adjustCateringGuestCount(1)}
                        style={({ pressed }) => [
                          styles.guestCountButton,
                          cateringGuestMaximum !== undefined && attendeeCount >= cateringGuestMaximum && styles.guestCountButtonDisabled,
                          pressed && styles.guestCountButtonPressed,
                        ]}
                      >
                        <MaterialCommunityIcons color={palette.primary} name="plus" size={20} />
                      </Pressable>
                    </View>
                    <Text style={styles.guestCountRange}>
                      Provider limit: {cateringGuestMinimum.toLocaleString('en-PH')}
                      {cateringGuestMaximum !== undefined ? `-${cateringGuestMaximum.toLocaleString('en-PH')}` : '+'} guests
                    </Text>
                    {cateringGuestCountIssue ? <Text style={styles.cateringMismatch}>{cateringGuestCountIssue}</Text> : null}
                  </View>
                </View>
                <View style={styles.foodTastingPreferenceCard}>
                  <View style={styles.foodTastingPreferenceHeading}>
                    <MaterialCommunityIcons color={palette.primary} name="silverware-fork-knife" size={22} />
                    <View style={styles.foodTastingPreferenceCopy}>
                      <Text style={styles.cateringOptionName}>Would you like a food tasting?</Text>
                      <Text style={styles.cateringInstruction}>
                        Choose whether to schedule a tasting before finalizing your menu.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.foodTastingPreferenceOptions}>
                    <Pressable
                      ref={(node) => {
                        optionFocusRefs.current['food-tasting:yes'] = node
                      }}
                      accessibilityLabel="Yes, I would like a food tasting"
                      accessibilityRole="radio"
                      accessibilityState={{ checked: foodTastingPreference === true, disabled: !foodTastingAvailable }}
                      disabled={!foodTastingAvailable}
                      onPress={() => chooseFoodTastingPreference(true)}
                      style={({ pressed }) => [
                        styles.foodTastingPreferenceOption,
                        foodTastingPreference === true && styles.foodTastingPreferenceOptionSelected,
                        !foodTastingAvailable && styles.foodTastingPreferenceOptionDisabled,
                        pressed && styles.mealCardPressed,
                      ]}
                    >
                      <View style={styles.foodTastingPreferenceOptionCopy}>
                        <Text style={[styles.foodTastingPreferenceOptionTitle, foodTastingPreference === true && styles.selectedOptionText]}>Yes, I&apos;d like a food tasting.</Text>
                        <Text style={[styles.foodTastingPreferenceOptionText, foodTastingPreference === true && styles.selectedOptionMutedText]}>Choose preliminary dishes, then finalize your menu after tasting.</Text>
                      </View>
                      {foodTastingPreference === true ? (
                        <MaterialCommunityIcons color={neutralSelection.selectedText} name="check-circle" size={20} />
                      ) : null}
                    </Pressable>
                    <Pressable
                      ref={(node) => {
                        optionFocusRefs.current['food-tasting:no'] = node
                      }}
                      accessibilityLabel="No, I will choose my menu directly"
                      accessibilityRole="radio"
                      accessibilityState={{ checked: foodTastingPreference === false }}
                      onPress={() => chooseFoodTastingPreference(false)}
                      style={({ pressed }) => [
                        styles.foodTastingPreferenceOption,
                        foodTastingPreference === false && styles.foodTastingPreferenceOptionSelected,
                        pressed && styles.mealCardPressed,
                      ]}
                    >
                      <View style={styles.foodTastingPreferenceOptionCopy}>
                        <Text style={[styles.foodTastingPreferenceOptionTitle, foodTastingPreference === false && styles.selectedOptionText]}>No, I&apos;ll choose my menu directly.</Text>
                        <Text style={[styles.foodTastingPreferenceOptionText, foodTastingPreference === false && styles.selectedOptionMutedText]}>Select a preset package or customize your menu now.</Text>
                      </View>
                      {foodTastingPreference === false ? (
                        <MaterialCommunityIcons color={neutralSelection.selectedText} name="check-circle" size={20} />
                      ) : null}
                    </Pressable>
                  </View>
                  {!foodTastingAvailable ? (
                    <Text style={styles.foodTastingUnavailableCopy}>
                      {foodTastingUnavailableReason}
                    </Text>
                  ) : null}
                </View>
                {foodTastingPreference === true ? (
                  <>
                    <View style={[styles.foodTastingPhaseNotice, isOverlay && styles.overlayRaisedInnerCard]}>
                      <MaterialCommunityIcons color={palette.primary} name="silverware-fork-knife" size={20} />
                      <View style={styles.foodTastingPreferenceCopy}>
                        <Text style={styles.foodTastingPhaseNoticeTitle}>Proposed Food Tasting Menu</Text>
                        <Text style={styles.foodTastingPhaseNoticeText}>
                          Choose the dishes you would like to taste. These are preliminary choices; your final event menu and price will be confirmed after tasting.
                        </Text>
                      </View>
                    </View>
                    {cateringTastingMenu?.sections.map((section) => {
                      const expanded = expandedTastingMenuSections.has(section.id)
                      const selectedCount = section.items.filter((item) =>
                        item.isActive && selectedTastingMenuItemIdSet.has(item.id)
                      ).length
                      return (
                        <View key={section.id} style={[styles.foodTastingCourseCard, isOverlay && styles.overlayInsetCard]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}
                            onPress={() => {
                              animateOptionLayout()
                              setExpandedTastingMenuSections((current) => {
                                const next = new Set(current)
                                if (next.has(section.id)) next.delete(section.id)
                                else next.add(section.id)
                                return next
                              })
                            }}
                            style={styles.cateringOptionHeading}
                          >
                            <View style={styles.foodTastingCourseCopy}>
                              <Text style={styles.cateringOptionName}>{section.name}</Text>
                              <Text style={styles.cateringOptionRange}>
                                Select {section.tastingSelectionLimit} dish{section.tastingSelectionLimit === 1 ? '' : 'es'} to taste
                              </Text>
                              <Text style={styles.foodTastingFinalLimit}>
                                Final menu: {section.finalSelectionLimit} dish{section.finalSelectionLimit === 1 ? '' : 'es'} after tasting
                              </Text>
                            </View>
                            <View style={styles.foodTastingCourseCount}>
                              <Text style={[styles.foodTastingCourseCountText, selectedCount === section.tastingSelectionLimit && styles.foodTastingCourseCountComplete]}>
                                {selectedCount} / {section.tastingSelectionLimit}
                              </Text>
                              <MaterialCommunityIcons color={palette.primary} name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
                            </View>
                          </Pressable>
                          {expanded ? section.items.map((item) => {
                            const selected = selectedTastingMenuItemIdSet.has(item.id)
                            const disabled = !item.isActive || (!selected && selectedCount >= section.tastingSelectionLimit)
                            return (
                              <Pressable
                                key={item.id}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: selected, disabled }}
                                disabled={disabled}
                                onPress={() => toggleTastingMenuItem(section.id, item.id)}
                                style={[
                                  styles.cateringMenuItemChoice,
                                  selected && styles.cateringMenuItemChoiceSelected,
                                  disabled && !selected && styles.cateringOptionCardDisabled,
                                ]}
                              >
                                <View style={styles.cateringMenuItemHeader}>
                                  <Text style={[styles.cateringMenuItemName, selected && styles.selectedOptionText]}>{item.name}</Text>
                                  {selected ? <MaterialCommunityIcons color={neutralSelection.selectedText} name="check-circle" size={20} /> : null}
                                </View>
                                {item.description ? <Text style={[styles.cateringMenuItems, selected && styles.selectedOptionMutedText]}>{item.description}</Text> : null}
                                {!item.isActive ? <Text style={styles.cateringMismatch}>Unavailable</Text> : null}
                                <Text style={[styles.cateringMenuItemPrice, selected && styles.selectedOptionText]}>
                                  {formatPeso(customerPriceFromProviderPrice(item.pricePerHead, service.commissionRate))} / guest
                                </Text>
                              </Pressable>
                            )
                          }) : null}
                        </View>
                      )
                    })}
                    <View style={[styles.foodTastingPricingNotice, isOverlay && styles.overlayInsetCard]}>
                      <MaterialCommunityIcons color={palette.secondary} name="information-outline" size={20} />
                      <View style={styles.foodTastingPreferenceCopy}>
                        <Text style={styles.foodTastingPricingTitle}>Final catering price pending</Text>
                        <Text style={styles.foodTastingPricingText}>
                          Final catering price will be confirmed after food tasting and menu finalization.
                        </Text>
                        {service.minPrice > 0 ? (
                          <Text style={styles.foodTastingReferencePrice}>
                            Current listing reference: {formatServicePrice(service)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    {foodTastingSelectionIssue ? <Text style={styles.cateringMismatch}>{foodTastingSelectionIssue}</Text> : null}
                    {foodTastingDraftError ? <Text style={styles.cateringMismatch}>{foodTastingDraftError}</Text> : null}
                    {foodTastingDraftMessage ? <Text style={styles.foodTastingDraftMessage}>{foodTastingDraftMessage}</Text> : null}
                  </>
                ) : foodTastingPreference === false ? <>
                {usesSelectedProviderPackage && !isVenueCateringPackage ? (
                  <View style={[styles.cateringSummaryCard, isOverlay && styles.overlayInsetCard]}>
                    <Text style={styles.cateringOptionName}>{selectedPackage?.name}</Text>
                    <Text style={styles.cateringOptionRange}>
                      Provider package · {selectedUnit === 'person'
                        ? 'priced per guest'
                        : 'fixed total for the event'}
                    </Text>
                    <Text style={styles.cateringOptionUnit}>
                      {formatPeso(selectedPackage?.price ?? 0)}
                      {selectedUnit === 'person' ? ' / guest' : ' total'}
                    </Text>
                    {selectedUnit === 'person' ? (
                      <Text style={styles.cateringOptionSubtotal}>
                        {attendeeCount.toLocaleString('en-PH')} guests · {quoteLoading
                          ? 'Calculating total...'
                          : formatPeso(estimatedTotal)} total
                      </Text>
                    ) : null}
                    {selectedPackage?.inclusions.length ? (
                      <View style={styles.inclusionList}>
                        {selectedPackage.inclusions.map((inclusion) => (
                          <Text key={inclusion} style={styles.inclusionText}>
                            {'\u2713'} {inclusion}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : hasCustomCateringMenu && hasPresetCateringMenus ? (
                  <View style={styles.mealTypeGrid}>
                    <Pressable ref={(node) => { optionFocusRefs.current['catering-offering:preset'] = node }} accessibilityRole="radio" accessibilityState={{ checked: selectedCateringOffering === 'preset' }} onPress={() => {
                      animateOptionLayout()
                      setSelectedCateringOffering('preset')
                      scrollOptionToCenter('catering-offering:preset')
                    }} style={[styles.mealCard, selectedCateringOffering === 'preset' && styles.mealCardSelected]}>
                      <MaterialCommunityIcons color={selectedCateringOffering === 'preset' ? neutralSelection.selectedText : palette.secondary} name="food-variant" size={27} />
                      <Text style={[styles.mealLabel, selectedCateringOffering === 'preset' && styles.mealSelectedContent]}>Choose Preset Package</Text>
                    </Pressable>
                    <Pressable ref={(node) => { optionFocusRefs.current['catering-offering:custom'] = node }} accessibilityRole="radio" accessibilityState={{ checked: selectedCateringOffering === 'custom' }} onPress={() => {
                      animateOptionLayout()
                      setSelectedCateringOffering('custom')
                      scrollOptionToCenter('catering-offering:custom')
                    }} style={[styles.mealCard, selectedCateringOffering === 'custom' && styles.mealCardSelected]}>
                      <MaterialCommunityIcons color={selectedCateringOffering === 'custom' ? neutralSelection.selectedText : palette.secondary} name="format-list-checks" size={27} />
                      <Text style={[styles.mealLabel, selectedCateringOffering === 'custom' && styles.mealSelectedContent]}>Customize Your Menu</Text>
                    </Pressable>
                  </View>
                ) : null}
                {usesCustomCateringMenu && customCateringMenu && customCateringCalculation ? <>
                  <Text style={styles.cateringInstruction}>Choose food items for your service-specific guest count. Prices update immediately.</Text>
                  {customCateringMenu.sections.map((section) => {
                    const expanded = expandedCateringMenuSections.has(section.id)
                    const selectedCount = section.items.filter((item) => selectedCateringMenuItemIds.includes(item.id)).length
                    return (
                    <View key={section.id} style={styles.cateringCustomMenuSectionCard}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        onPress={() => {
                          animateOptionLayout()
                          setExpandedCateringMenuSections((current) => {
                            const next = new Set(current)
                            if (next.has(section.id)) next.delete(section.id)
                            else next.add(section.id)
                            return next
                          })
                        }}
                        style={styles.cateringOptionHeading}
                      >
                        <View style={styles.cateringCourseHeaderCopy}>
                          <Text style={styles.cateringCourseLabel}>{section.name}</Text>
                          <Text style={styles.cateringOptionRange}>
                            {section.minimumSelections > 0 ? `Choose at least ${section.minimumSelections}` : 'Optional'}
                            {section.maximumSelections ? ` · up to ${section.maximumSelections}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.cateringOptionRange}>{selectedCount} selected</Text>
                        <MaterialCommunityIcons color={palette.primary} name={expanded ? 'chevron-up' : 'chevron-down'} size={24} />
                      </Pressable>
                      {expanded ? section.items.map((item) => {
                        const selected = selectedCateringMenuItemIds.includes(item.id)
                        const selectionLimitReached = !selected
                          && section.maximumSelections !== undefined
                          && selectedCount >= section.maximumSelections
                        const disabled = !item.isActive || item.isRequired || selectionLimitReached
                        return (
                          <Pressable
                            key={item.id}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected, disabled }}
                            disabled={disabled}
                            onPress={() => setSelectedCateringMenuItemIds((current) => selected
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                            )}
                            style={[styles.cateringMenuItemChoice, selected && styles.cateringMenuItemChoiceSelected, disabled && !item.isRequired && styles.cateringOptionCardDisabled]}
                          >
                            {selected ? (
                              <MaterialCommunityIcons color={neutralSelection.selectedText} name="check-circle" size={20} style={styles.cateringMenuItemSelectionMark} />
                            ) : null}
                            <View style={styles.menuItemChoiceCopy}>
                              <Text style={[styles.cateringMenuName, selected && styles.selectedOptionText]}>{item.name}{item.isRequired ? ' · Required' : ''}</Text>
                              {item.description ? <Text style={[styles.cateringMenuItems, selected && styles.selectedOptionMutedText]}>{item.description}</Text> : null}
                              {!item.isActive ? <Text style={styles.cateringMismatch}>Unavailable</Text> : null}
                            </View>
                            <Text style={[styles.cateringMenuItemPrice, selected && styles.selectedOptionText]}>
                              {formatPeso(customerPriceFromProviderPrice(item.pricePerHead, service.commissionRate))} / head
                            </Text>
                          </Pressable>
                        )
                      }) : null}
                    </View>
                    )
                  })}
                  <View style={[styles.cateringSummaryCard, styles.cateringCustomMenuSummaryCard]}>
                    <Text style={styles.cateringOptionName}>Selected menu total</Text>
                    <Text style={styles.cateringOptionUnit}>{formatPeso(customerPriceFromProviderPrice(customCateringCalculation.unitPrice, service.commissionRate))} / head</Text>
                    <Text style={styles.cateringOptionSubtotal}>{formatPeso(customerPriceFromProviderPrice(customCateringCalculation.providerSubtotal, service.commissionRate))} for {attendeeCount.toLocaleString('en-PH')} guests</Text>
                    {!customCateringCalculation.fitsGuestCount ? <Text style={styles.cateringMismatch}>{customCateringCalculation.reason}</Text> : null}
                  </View>
                </> : <>
                <Text style={styles.cateringInstruction}>Choose a preset package for your guest count.</Text>
                {cateringOptions.map((option) => {
                  const calculation = calculateCateringPrice(option, attendeeCount)
                  const selected = option.id === selectedCateringOptionId
                  const customerUnitPrice = customerPriceFromProviderPrice(option.pricePerHead, service.commissionRate)
                  const customerSubtotal = customerPriceFromProviderPrice(calculation.providerSubtotal, service.commissionRate)
                  return (
                    <Pressable
                      ref={(node) => {
                        optionFocusRefs.current[`catering-option:${option.id}`] = node
                      }}
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: !calculation.fitsGuestCount }}
                      disabled={!calculation.fitsGuestCount}
                      onPress={() => {
                        animateOptionLayout()
                        setSelectedCateringOptionId(option.id)
                        scrollOptionToCenter(`catering-option:${option.id}`)
                      }}
                      style={[styles.cateringPresetPackageCard, selected && styles.cateringOptionCardSelected, !calculation.fitsGuestCount && styles.cateringOptionCardDisabled]}
                    >
                      <View style={styles.cateringPresetHeader}>
                        <Text style={[styles.cateringPresetName, selected && styles.selectedOptionText]}>{option.name}</Text>
                        {selected ? <MaterialCommunityIcons color={neutralSelection.selectedText} name="check-circle" size={20} /> : null}
                      </View>
                      <Text style={[styles.cateringPresetTotal, selected && styles.selectedOptionText]}>{formatPeso(customerSubtotal)} total</Text>
                      <Text style={[styles.cateringPresetPrice, selected && styles.selectedOptionMutedText]}>{formatPeso(customerUnitPrice)} / head</Text>
                      <Text style={[styles.cateringPresetRange, selected && styles.selectedOptionMutedText]}>
                        Supports {option.minimumGuests.toLocaleString('en-PH')}-{option.maximumGuests.toLocaleString('en-PH')} guests
                      </Text>
                      <View style={[styles.cateringPresetMenuContent, selected && styles.cateringPresetMenuContentSelected]}>
                        {option.menuSections.map((section) => (
                          <View key={section.id} style={[styles.cateringMenuSection, selected && styles.cateringMenuSectionSelected]}>
                            <Text style={[styles.cateringCourseLabel, selected && styles.selectedOptionText]}>{section.name}</Text>
                            <Text style={[styles.cateringMenuItems, selected && styles.selectedOptionMutedText]}>{section.items.join(', ')}</Text>
                          </View>
                        ))}
                      </View>
                      {!calculation.fitsGuestCount ? <Text style={styles.cateringMismatch}>{calculation.reason} This option does not fit your event.</Text> : null}
                    </Pressable>
                  )
                })}
                {cateringOptions.length === 0 ? (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This provider must add a per-head catering option before this service can be selected.</Text>
                  </View>
                ) : null}
                {cateringSelectionUnavailable && cateringOptions.length > 0 ? (
                  <Text style={styles.cateringSelectionHint}>
                    {!activeCateringOption
                      ? 'Choose a preset package to continue.'
                      : 'Choose an option that supports your guest count to continue.'}
                  </Text>
                ) : null}
                </>}
                </> : null}
              </View>
            ) : null}

            {isVenue ? (
              <View style={[
                styles.cateringOptionsSection,
                isOverlay && styles.overlayVenueRequestSection,
              ]}>
                <View style={styles.guestCountCard}>
                  <View style={styles.guestCountCopy}>
                    <Text style={styles.inputLabel}>EVENT REQUIREMENT</Text>
                    <View
                      accessibilityLabel={`Event requirement: ${attendeeCount.toLocaleString('en-PH')} guests`}
                      style={styles.guestCountCounter}
                    >
                      <Text style={styles.guestCountValue}>{attendeeCount.toLocaleString('en-PH')}</Text>
                      <Text style={styles.guestCountUnit}>guests</Text>
                    </View>
                    {eventDate && eventTime ? (
                      <Text style={styles.cateringOptionRange}>{eventDate} at {eventTime}</Text>
                    ) : null}
                  </View>
                </View>
                {usesSelectedProviderPackage ? (
                  <View style={[styles.cateringSummaryCard, isOverlay && styles.overlayInsetCard]}>
                    <Text style={styles.cateringOptionName}>{selectedPackage?.name}</Text>
                    <Text style={styles.cateringOptionRange}>Provider package · fixed total for the event</Text>
                    <Text style={styles.cateringOptionUnit}>{formatPeso(selectedPackage?.price ?? 0)} total</Text>
                    {selectedPackage?.inclusions.length ? (
                      <View style={styles.inclusionList}>
                        {selectedPackage.inclusions.map((inclusion) => (
                          <Text key={inclusion} style={styles.inclusionText}>
                            {'\u2713'} {inclusion}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.cateringOptionRange}>
                      Package terms replace individual venue options and duration. Event schedule and capacity are still validated before it is saved.
                    </Text>
                  </View>
                ) : <>
                <Text style={styles.cateringInstruction}>Choose available venue options. Select more than one only when every option allows combination.</Text>
                {venueOptions.length > 0 ? (
                  <View style={styles.venueOptionsContainer}>
                {venueOptions.map((option) => {
                  const selected = Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)
                  const canSelect = selected || canAddVenueOption(option)
                  return (
                    <Pressable
                      ref={(node) => {
                        optionFocusRefs.current[`venue:${option.id}`] = node
                      }}
                      key={option.id}
                      accessibilityLabel={`${option.name}. ${option.kind === 'combination' ? 'Expandable combination' : 'Individual space'}. Capacity ${option.capacity} guests.`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: !canSelect }}
                      disabled={!canSelect}
                      onPress={() => toggleVenueOption(option)}
                      style={({ pressed }) => [
                        styles.venueOptionChoice,
                        selected && styles.venueOptionChoiceSelected,
                        !canSelect && styles.cateringOptionCardDisabled,
                        pressed && styles.venueOptionChoicePressed,
                      ]}
                    >
                      <View style={styles.cateringOptionHeading}>
                        <View style={styles.venueOptionStack}>
                          <MaterialCommunityIcons color={selected ? neutralSelection.selectedText : palette.secondary} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} />
                          <View style={styles.venueOptionCopy}>
                            <Text style={[styles.cateringOptionName, selected && styles.selectedOptionText]}>{option.name}</Text>
                            <Text style={[styles.cateringOptionRange, selected && styles.selectedOptionMutedText]}>{option.kind === 'combination' ? 'Expandable combination' : 'Individual space'} · {option.spaceType}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.cateringMenuItems, selected && styles.selectedOptionMutedText]}>Capacity: {option.capacity} guests · Area: {option.areaSqm || 'Not specified'} sqm</Text>
                      {!canSelect ? <Text style={styles.cateringMismatch}>This option conflicts with another selected space or cannot be combined.</Text> : null}
                    </Pressable>
                  )
                })}
                  </View>
                ) : null}
                {selectedVenueOptions.map((option) => {
                  const expanded = expandedVenueOptions.has(option.id)
                  const isHourly = isHourlyVenueOption(option)
                  const minimumHours = optionMinimumHours(option)
                  const maximumHours = optionMaximumHours(option)
                  const enteredHours = Number(selectedVenueHours[option.id])
                  const providerSubtotal = option.pricingUnit && option.baseRate
                    ? option.pricingUnit === 'hour'
                      ? option.baseRate * (Number.isFinite(enteredHours) ? enteredHours : 0)
                      : option.baseRate
                    : service.pricingUnit === 'hour'
                      ? selectedProviderPrice * (Number.isFinite(enteredHours) ? enteredHours : 0)
                      : selectedProviderPrice
                  const unitRate = option.pricingUnit && option.baseRate
                    ? option.baseRate
                    : selectedProviderPrice
                  return (
                    <View key={`${option.id}-details`} style={styles.venueSelectionCard}>
                      <View style={styles.cateringOptionHeading}>
                        <View style={styles.venueSelectionHeadingCopy}>
                          <Text numberOfLines={2} style={styles.cateringOptionName}>{option.name}</Text>
                        </View>
                        <Text numberOfLines={1} style={styles.venueSelectionSubtotal}>{formatPeso(customerPriceFromProviderPrice(providerSubtotal, service.commissionRate))}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.venueRentalRate}>
                        {isHourly ? 'Hourly rental' : 'Per-event rental'} {'\u00B7'} {formatPeso(customerPriceFromProviderPrice(unitRate, service.commissionRate))} per {isHourly ? 'hour' : 'event'}
                      </Text>
                      {isHourly ? <>
                        <Text style={styles.inputLabel}>RENTAL DURATION</Text>
                        <View style={styles.venueDurationRow}>
                          <Pressable accessibilityLabel={`Decrease ${option.name} duration`} onPress={() => adjustVenueHours(option, -1)} style={({ pressed }) => [styles.venueDurationButton, pressed && styles.venueDurationButtonPressed]}><Text style={styles.venueDurationButtonText}>−</Text></Pressable>
                          <TextInput
                            accessibilityLabel={`${option.name} rental duration in hours`}
                            keyboardType="decimal-pad"
                            onChangeText={(value) => updateVenueHours(option, value)}
                            placeholder={String(minimumHours)}
                            placeholderTextColor={palette.secondaryFixedDim}
                            style={styles.venueDurationInput}
                            value={selectedVenueHours[option.id]}
                          />
                          <Text numberOfLines={1} style={styles.venueDurationUnit}>hours</Text>
                          <Pressable accessibilityLabel={`Increase ${option.name} duration`} onPress={() => adjustVenueHours(option, 1)} style={({ pressed }) => [styles.venueDurationButton, pressed && styles.venueDurationButtonPressed]}><Text style={styles.venueDurationButtonText}>+</Text></Pressable>
                        </View>
                        <Text style={styles.venueDurationHelper}>Minimum rental: {minimumHours} hours · Adjust in {venueRules.durationIncrementHours}-hour increments{maximumHours ? ` · Maximum: ${maximumHours} hours` : ''}</Text>
                      </> : <View style={styles.venueTermsCard}>
                        <Text style={styles.cateringOptionUnit}>Fixed per-event rate</Text>
                        <Text style={styles.cateringOptionRange}>{option.includedDurationHours
                          ? `Included use: up to ${option.includedDurationHours} hours`
                          : option.minimumBookingHours
                            ? `Minimum rental term: ${option.minimumBookingHours} hours`
                            : 'View the provider rental conditions below.'}</Text>
                      </View>}
                      <Pressable accessibilityRole="button" onPress={() => toggleExpandedVenueOption(option.id)} style={styles.venueDetailsToggle}>
                        <Text style={styles.venueDetailsToggleText}>{expanded ? 'HIDE RENTAL DETAILS' : 'VIEW RENTAL DETAILS'}</Text>
                      </Pressable>
                      {expanded ? <View style={styles.venueExpandedDetails}>
                        {option.description ? <Text style={styles.venueDetailCopy}>{option.description}</Text> : null}
                        {option.photoUrls.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.venuePhotoRow}>{option.photoUrls.map((photoUrl) => <Image key={photoUrl} source={{ uri: photoUrl }} style={styles.venueOptionPhoto} />)}</View></ScrollView> : null}
                        <Text style={styles.venueDetailCopy}>Capacity: {option.capacity} guests · Area: {option.areaSqm || 'Not specified'} sqm</Text>
                        {option.amenities.length ? <Text style={styles.venueDetailCopy}>Amenities: {option.amenities.join(', ')}</Text> : null}
                        {option.inclusions.length ? <Text style={styles.venueDetailCopy}>Inclusions: {option.inclusions.join(', ')}</Text> : null}
                        {option.restrictions?.length ? <Text style={styles.venueDetailCopy}>Restrictions: {option.restrictions.join(', ')}</Text> : null}
                        {option.availabilityNotes ? <Text style={styles.venueDetailCopy}>Availability: {option.availabilityNotes}</Text> : null}
                        <Text style={styles.venueDetailCopy}>Access: {option.accessStartTime || venueRules.openingTime || 'Not specified'}-{option.accessEndTime || venueRules.closingTime || 'Not specified'} · Setup allowance: {option.setupAllowanceHours ?? venueRules.setupAllowanceHours} hours</Text>
                        {option.overtimePolicy ? <Text style={styles.venueDetailCopy}>Overtime: {option.overtimePolicy}</Text> : null}
                      </View> : null}
                    </View>
                  )
                })}
                {venueSelectionIssue ? <Text style={styles.cateringMismatch}>{venueSelectionIssue}</Text> : null}
                {venueOptions.length === 0 ? (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This provider must configure a venue space before the service can be selected.</Text>
                  </View>
                ) : null}
                </>}
              </View>
            ) : null}

            {isFlorist ? (
              <View style={[styles.floristConfigurationSection, isOverlay && styles.floristOverlayConfigurationSection]}>
                {floristConfiguration ? (
                  <FloristBookingConfigurator
                    configuration={floristConfiguration}
                    neumorphic={isOverlay}
                    onChange={setFloristSelection}
                    onOptionSelected={(node) => scrollOptionNodeToCenter(() => node)}
                    value={floristSelection}
                  />
                ) : (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This florist has no active client-bookable configuration yet.</Text>
                  </View>
                )}
                {floristSelectionIssue ? <Text style={styles.cateringMismatch}>{floristSelectionIssue}</Text> : null}
              </View>
            ) : null}

            {isAttire ? (
              <View style={styles.attireRentalOverview}>
                {attireOverviewItems.length ? (
                  <View style={styles.attireRentalOverviewRows}>
                    {attireOverviewItems.map((detail) => {
                      const usesTags = ['service options', 'intended for', 'available sizes', 'available colors', 'inclusions'].includes(detail.label.toLowerCase())
                      const values = splitServiceDetailValues(detail.value)

                      return (
                        <View key={detail.id} style={styles.cateringInformationRow}>
                          <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                          {usesTags ? (
                            <View style={styles.cateringInformationTagList}>
                              {values.map((value, index) => (
                                <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                  <Text style={styles.cateringInformationTagText}>{value}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <Text style={styles.cateringInformationValue}>Rental details are not available for this service.</Text>
                )}
              </View>
            ) : null}

            {isSoundLights ? (
              <View style={styles.soundLightsInclusions}>
                {service.description ? <Text style={styles.soundLightsInclusionsDescription}>{service.description}</Text> : null}
                {soundLightsOverviewItems.length ? (
                  <View style={styles.attireRentalOverviewRows}>
                    {soundLightsOverviewItems.map((detail) => {
                      const usesTags = ['service types', 'lighting types'].includes(detail.label.toLowerCase())
                      const values = splitServiceDetailValues(detail.value)

                      return (
                        <View key={detail.id} style={styles.cateringInformationRow}>
                          <Text style={styles.cateringInformationLabel}>{detail.label.toUpperCase()}</Text>
                          {usesTags ? (
                            <View style={styles.cateringInformationTagList}>
                              {values.map((value, index) => (
                                <View key={`${detail.id}-${index}`} style={styles.cateringInformationTag}>
                                  <Text style={styles.cateringInformationTagText}>{value}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.cateringInformationValue}>{detail.value}</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {isPhotoVideo ? (
              <View style={[styles.floristConfigurationSection, styles.photoVideoConfigurationSection]}>
                {photoVideoConfiguration ? (
                  <PhotoVideoBookingConfigurator
                    commissionRate={service.commissionRate}
                    configuration={photoVideoConfiguration}
                    neumorphic={isOverlay}
                    onOptionSelected={(node) => scrollOptionNodeToCenter(() => node)}
                    onChange={(next) => {
                      const normalized = normalizePhotoVideoSelection(next)
                      setPhotoVideoSelection(normalized)
                      onPhotoVideoSelectionChange?.(normalized)
                    }}
                    value={photoVideoSelection}
                  />
                ) : (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={warningNotice.icon} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This Photo/Video provider has no active client-bookable configuration yet.</Text>
                  </View>
                )}
                {photoVideoSelectionIssue ? <Text style={styles.cateringMismatch}>{photoVideoSelectionIssue}</Text> : null}
              </View>
            ) : null}

            </View>
          ) : null}

          {isCateringOverlay ? (
            <>
              {packageSection}
              {cateringServiceInformationSection}
            </>
          ) : null}

          {isFloristOverlay ? floristServiceInformationSection : null}

          {isPhotoVideoOverlay ? photoVideoServiceInformationSection : null}

          {isAttireOverlay ? attireServiceInformationSection : null}

          {isSoundLightsOverlay ? soundLightsServiceInformationSection : null}

          {isVenue ? <View style={styles.venueReviewsDivider} /> : null}

          <View style={[styles.reviewsSection, isOverlay && styles.overlayReviewsSection]}>
            {isOverlay ? (
              <>
                <View style={styles.reviewsHeading}>
                  <Text style={styles.reviewsTitle}>Reviews & Sentiment</Text>
                  <View style={styles.ratingSummary}>
                    <Text style={styles.ratingValue}>{displayedReviewRating}</Text>
                  </View>
                </View>
                <ReviewFeedbackSummary
                  insights={displayedReviewInsights}
                  isLoading={reviewInsightsLoading && !usesMockReviewInsights}
                  isWide={isWide}
                  neumorphic
                  showReviewComments
                  serviceOverlay
                />
              </>
            ) : (
              <>
                <Text style={styles.sectionHeading}>Guest Reviews</Text>

                {service.isMock && !service.bookingServiceId ? (
              <>
            <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
              <View style={[styles.ratingCard, isOverlay && styles.overlayInsetCard]}>
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

            <View style={[styles.insightCard, isOverlay && styles.overlayRaisedInnerCard]}>
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
                <View key={chip} style={[styles.reviewChip, isOverlay && styles.overlayRaisedInnerCard]}>
                  <Text style={styles.reviewChipText}>{chip}</Text>
                </View>
              ))}
            </View>

            <View style={styles.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={[styles.reviewItem, isOverlay && styles.overlayReviewItem]}>
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
              style={({ pressed }) => [styles.readReviewsButton, isOverlay && styles.overlayRaisedInnerCard, pressed && styles.outlinePressed]}
            >
              <Text style={styles.readReviewsText}>Read All 120 Reviews</Text>
            </Pressable>
              </>
            ) : (
              reviewInsightsLoading ? (
                <View style={[styles.liveReviewCard, isOverlay && styles.overlaySunkenReviewCard]}>
                  <Text style={styles.liveReviewTitle}>Loading verified feedback...</Text>
                </View>
              ) : reviewInsights && reviewInsights.totalRatings > 0 ? (
                <>
                  <View style={[styles.reviewSummary, isWide && styles.reviewSummaryWide]}>
                    <View style={[styles.ratingCard, isOverlay && styles.overlayInsetCard]}>
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
                              isOverlay && styles.overlayRaisedInnerCard,
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
                            <View style={[styles.sentimentReviewList, isOverlay && styles.overlayInsetCard]}>
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
                <View style={[styles.liveReviewCard, isOverlay && styles.overlaySunkenReviewCard]}>
                  <Text style={styles.liveReviewTitle}>No reviews yet</Text>
                  <Text style={styles.liveReviewCopy}>
                    Ratings and analyzed comments will appear after clients complete bookings.
                  </Text>
                </View>
              )
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {!isExploreMode ? (
        <View style={styles.bottomActionBar}>
          <View style={styles.bottomActionContent}>
            {isWide ? (
              <View>
                <Text style={styles.estimatedLabel}>{isFoodTastingFlow ? 'PRELIMINARY MENU' : 'ESTIMATED TOTAL'}</Text>
                <Text style={styles.estimatedValue}>{isFoodTastingFlow ? 'Final price pending' : estimatedDisplay}</Text>
                {!isFoodTastingFlow && quoteError ? <Text style={styles.quoteError}>{quoteError}</Text> : null}
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={
                canEditMissingVenueSchedule
                  ? 'Set event date and start time'
                  : isFoodTastingFlow
                  ? 'Submit food tasting request'
                  : isReplacementSelection
                  ? `Confirm change to ${service.name} for ${formatPeso(estimatedTotal)} Philippine pesos`
                  : isPhotoVideo
                  ? 'Photo and video coverage draft saved'
                  : requiresQuote
                  ? 'Add custom quote service to selection'
                  : isChangingSelection
                    ? `Review service change for ${formatPeso(estimatedTotal)} Philippine pesos`
                    : `Add to selection for ${formatPeso(estimatedTotal)} Philippine pesos`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: currentActionDisabled }}
              disabled={currentActionDisabled}
              onPress={handleAddSelection}
              style={({ pressed }) => [
                styles.addButton,
                isWide && styles.addButtonWide,
                currentActionDisabled && styles.addButtonDisabled,
                pressed && styles.addPressed,
              ]}
            >
              <Text numberOfLines={2} style={styles.addButtonText}>
                {isFoodTastingFlow
                  ? isAddingSelection
                    ? 'Submitting Tasting Request...'
                    : foodTastingSelectionIssue
                      ? 'Complete Every Tasting Course'
                      : 'Submit Food Tasting Request'
                  : isAddingSelection
                  ? 'Adding...'
                  : isReplacementSelection
                    ? 'Confirm Change'
                  : isPhotoVideo
                    ? photoVideoSelectionIssue
                      ? 'Complete Photo / Video Selection'
                      : 'Add to Selection'
                  : cateringSelectionUnavailable
                    ? cateringSelectionActionLabel
                    : venueSelectionUnavailable
                      ? venueSelectionActionLabel
                      : cateringGuestCountIssue
                        ? 'Set a Valid Guest Count'
                    : foodTastingPreferenceRequired
                      ? 'Choose Food Tasting Preference'
                      : foodTastingMenuSelectionPending
                        ? 'Food Tasting Menu Required'
                    : quoteLoading
                      ? 'Calculating Event Price...'
                      : quoteError
                        ? 'Event Price Unavailable'
                      : scheduleUnavailable
                      ? 'Unavailable on Your Schedule'
                    : isChangingSelection
                      ? 'Review Service Change'
                      : 'Add to Selection'}
              </Text>
              {!isWide && !currentActionDisabled && !canEditMissingVenueSchedule ? <Text style={styles.addDivider}>|</Text> : null}
              {!isWide && !currentActionDisabled && !canEditMissingVenueSchedule ? (
                <Text style={styles.addPrice}>{isFoodTastingFlow ? 'Final price pending' : estimatedDisplay}</Text>
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
  floristConfigurationSection: { borderTopColor: '#E2E2E2', borderTopWidth: 1, marginTop: 24, paddingTop: 24 },
  floristOverlayBookingSection: { borderBottomWidth: 0, paddingVertical: 0 },
  floristOverlayConfigurationSection: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
  photoVideoConfigurationSection: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
  attireRentalOverview: {
    gap: 14,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 14,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  attireRentalOverviewRows: { gap: 12 },
  soundLightsInclusions: {
    gap: 14,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 14,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  soundLightsInclusionsDescription: { color: palette.secondary, fontSize: typography.caption, lineHeight: 19, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: palette.background },
  detailsScroll: { flex: 1 },
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
  contentPaddingWide: { paddingHorizontal: 24 },
  overlayScrollContent: { paddingBottom: 40 },
  overlayScrollContentWithAction: { paddingBottom: 184 },
  venueOverlayScrollContentWithAction: { paddingBottom: 184 },
  overlayContent: { paddingTop: 20 },
  venueOverlaySection: {
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    borderRadius: 18,
    backgroundColor: '#E9EDF0',
    marginBottom: 18,
    padding: 18,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 11,
    elevation: 4,
    boxShadow: '5px 5px 11px rgba(157, 169, 178, 0.42), -5px -5px 11px rgba(255, 255, 255, 0.92)',
  },
  venueOverlayPriceCard: {
    boxShadow: 'inset 3px 3px 7px rgba(157, 169, 178, 0.36), inset -3px -3px 7px rgba(255, 255, 255, 0.9)',
  },
  venueOverlayEyebrow: {
    color: palette.secondary,
    fontSize: typography.caption,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  venueOverlayPriceIntro: { color: palette.secondary, fontSize: typography.body, lineHeight: 21, fontWeight: '600' },
  venueOverlayPrice: { color: palette.primary, fontSize: typography.h2, lineHeight: 29, fontWeight: '800' },
  venueOverlaySectionTitle: { color: palette.text, fontSize: typography.h2, lineHeight: 29, fontWeight: '700' },
  venueOverlaySupportingCopy: { color: palette.secondary, fontSize: typography.body, lineHeight: 21 },
  venueRequirementChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  venueRequirementChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 999,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    boxShadow: '3px 3px 7px rgba(157, 169, 178, 0.36), -3px -3px 7px rgba(255, 255, 255, 0.9)',
  },
  venueRequirementChipText: { color: palette.text, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  venueOverlayOptionCard: {
    gap: 12,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 14,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  venueOverlayOptionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  venueOverlayOptionStack: { width: 'auto', minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  venueOverlayOptionCopy: { width: 'auto', minWidth: 0, flex: 1, gap: 8 },
  venueOverlayOptionName: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700' },
  venueOverlayOptionPrice: {
    alignSelf: 'flex-start',
    color: palette.primary,
    fontSize: typography.body,
    lineHeight: 20,
    fontWeight: '800',
  },
  venueOverlayOptionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  venueOverlayOptionChip: {
    borderWidth: 1,
    borderColor: 'rgba(107, 30, 46, 0.22)',
    borderRadius: 999,
    backgroundColor: 'rgba(107, 30, 46, 0.10)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  venueOverlayOptionChipSelected: { borderColor: 'rgba(255, 255, 255, 0.34)', backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  venueOverlayOptionChipText: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  venueOverlayOptionStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: palette.surfaceVariant,
    paddingTop: 12,
  },
  venueOverlayOptionStatsSelected: { borderTopColor: 'rgba(255, 255, 255, 0.26)' },
  venueOverlayOptionStat: { minWidth: 0, flex: 1, gap: 3 },
  venueOverlayOptionStatLast: { borderLeftWidth: 1, borderLeftColor: palette.surfaceVariant, paddingLeft: 14 },
  venueOverlayOptionStatLabel: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800', letterSpacing: 0.7 },
  venueOverlayOptionStatValue: { color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  venueOverlayLegacyMeta: {
    display: 'none',
  },
  venueInformationGroups: {
    gap: 14,
  },
  venueInformationGroup: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
  },
  venueInformationGroupLast: {},
  venueInformationHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  venueInformationTitle: { minWidth: 0, flex: 1, color: palette.text, fontSize: typography.body, lineHeight: 21, fontWeight: '700' },
  venueInformationContent: {
    gap: 14,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 12,
    backgroundColor: neutralSelection.surface,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  venueInformationRow: { gap: 5 },
  venueInformationLabel: { color: palette.primary, fontSize: typography.body, lineHeight: 21, fontWeight: '800', letterSpacing: 0.5 },
  venueInformationValue: { color: palette.secondary, fontSize: typography.caption, lineHeight: 19, fontWeight: '600' },
  venueInformationBulletList: { gap: 8 },
  venueInformationBulletItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  venueInformationBullet: { color: palette.primary, fontSize: typography.body, lineHeight: 19, fontWeight: '800' },
  venueInformationBulletText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: typography.caption, lineHeight: 19, fontWeight: '600' },
  venueInformationTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  venueInformationTag: {
    borderWidth: 1,
    borderColor: 'rgba(78, 6, 26, 0.20)',
    borderRadius: 999,
    backgroundColor: 'rgba(78, 6, 26, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  venueInformationTagText: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryBadge: {
    backgroundColor: 'rgba(112, 27, 48, 0.94)',
  },
  categoryBadgeText: {
    color: palette.white,
    fontSize: typography.caption,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  ratingBadge: {
    gap: 6,
    backgroundColor: 'rgba(25, 20, 20, 0.72)',
  },
  ratingBadgeText: { color: palette.white, fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  overlayHeroBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    backgroundColor: 'rgba(35, 21, 25, 0.52)',
  },
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
  venueHeroLocation: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  venueHeroLocationText: {
    flex: 1,
    color: palette.white,
    fontSize: typography.caption,
    lineHeight: 17,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.56)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  descriptionSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingBottom: 32 },
  overlayDetailCard: {
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    marginBottom: 18,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.46,
    shadowRadius: 12,
    elevation: 4,
    boxShadow: '6px 6px 12px rgba(157, 169, 178, 0.46), -6px -6px 12px rgba(255, 255, 255, 0.94)',
  },
  overlayRaisedInnerCard: {
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
    elevation: 2,
  },
  overlayInsetCard: {
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.sunkenShadow,
  },
  overlayReviewItem: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 14,
    backgroundColor: '#E9EDF0',
    padding: 16,
    boxShadow: '4px 4px 9px rgba(157, 169, 178, 0.40), -4px -4px 9px rgba(255, 255, 255, 0.90)',
    elevation: 2,
  },
  description: { maxWidth: 680, color: palette.secondary, fontSize: 18, lineHeight: 30 },
  priceSummarySection: { gap: 8, marginTop: 20 },
  overlayPriceSummaryContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 15,
    backgroundColor: '#E9EDF0',
    padding: 14,
    boxShadow: 'inset 3px 3px 7px rgba(157, 169, 178, 0.40), inset -3px -3px 7px rgba(255, 255, 255, 0.92)',
  },
  priceSummaryLabel: { color: palette.secondary, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  priceSummaryIntro: { color: palette.secondary, fontSize: typography.body, lineHeight: 21, fontWeight: '600' },
  priceSummaryValue: { color: palette.primary, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  priceValueLine: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  photoPricingVariation: { color: palette.secondary, fontSize: typography.caption, lineHeight: 18, fontWeight: '600' },
  serviceFacts: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 14,
    backgroundColor: palette.surfaceLowest,
    marginTop: 24,
  },
  overlayServiceFacts: {
    overflow: 'visible',
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginTop: 18,
    gap: 14,
  },
  overlayFirstDetailContent: { marginTop: 0 },
  overlayInformationTitle: {
    color: palette.text,
    fontSize: typography.h3,
    lineHeight: 29,
    fontWeight: '800',
    marginTop: 22,
  },
  overlayServiceFactItem: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
    elevation: 2,
  },
  overlayServiceFactHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  overlayServiceFactHeaderPressed: { opacity: 0.62 },
  overlayServiceFactLabel: {
    color: palette.primary,
    fontSize: typography.body,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  overlayServiceFactContent: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.74)',
    borderRadius: 12,
    backgroundColor: '#E9EDF0',
    marginHorizontal: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    boxShadow: 'inset 2px 2px 5px rgba(157, 169, 178, 0.32), inset -2px -2px 5px rgba(255, 255, 255, 0.90)',
  },
  overlayServiceFactValue: {
    color: palette.secondary,
    fontSize: typography.caption,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'left',
  },
  cateringInformationGroups: { gap: 14, marginTop: 18 },
  cateringInformationGroup: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
    elevation: 2,
  },
  cateringInformationHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  cateringInformationTitle: { minWidth: 0, flex: 1, color: palette.text, fontSize: typography.body, lineHeight: 21, fontWeight: '700' },
  cateringInformationContent: {
    gap: 14,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 12,
    backgroundColor: neutralSelection.surface,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  attirePoliciesContent: { marginHorizontal: 12, marginBottom: 12 },
  cateringInformationRow: { gap: 5 },
  cateringInformationLabel: { color: palette.primary, fontSize: typography.body, lineHeight: 21, fontWeight: '800', letterSpacing: 0.5 },
  cateringInformationValue: { color: palette.secondary, fontSize: typography.caption, lineHeight: 19, fontWeight: '600' },
  cateringInformationTagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cateringInformationTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(107, 30, 46, 0.22)',
    borderRadius: 999,
    backgroundColor: 'rgba(107, 30, 46, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cateringInformationTagText: { color: palette.primary, fontSize: typography.caption, lineHeight: 18, fontWeight: '700' },
  cateringInformationBulletList: { gap: 6 },
  cateringInformationBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cateringInformationBullet: { color: palette.primary, fontSize: typography.body, lineHeight: 19, fontWeight: '800' },
  cateringInformationBulletText: { minWidth: 0, flex: 1, color: palette.secondary, fontSize: typography.caption, lineHeight: 19, fontWeight: '600' },
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
  pricingNotes: { gap: 6, padding: 18 },
  pricingNotesText: { color: palette.text, fontSize: 15, lineHeight: 23 },
  packagesSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 40 },
  cateringPackagesSection: { paddingVertical: 24 },
  packageSectionIntro: { color: palette.secondary, fontSize: 14, lineHeight: 21, marginBottom: 18, marginTop: -12 },
  packageList: { gap: 14 },
  packageCard: { borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 14, backgroundColor: neutralSelection.surface, padding: 18, boxShadow: neutralSelection.sunkenShadow },
  packageCardSelected: { borderWidth: 1, borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  packageCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  packageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  packageTitleRow: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  packageName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  packagePrice: { color: palette.primary, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  packageDescription: { color: palette.secondary, fontSize: 14, lineHeight: 22, marginTop: 10 },
  venueCateringPackageBadge: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 8 },
  venueCateringPackageBadgeText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  packagePriceGroup: { alignItems: 'flex-end' },
  packageOriginalPrice: {
    color: palette.secondaryFixedDim,
    fontSize: 12,
    lineHeight: 16,
    textDecorationLine: 'line-through',
  },
  packageDiscountBadge: {
    alignSelf: 'flex-start',
    color: '#2E7D4F',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  packageServices: { gap: 4, marginTop: 12 },
  packageServicesLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  inclusionList: { gap: 6, marginTop: 14 },
  inclusionText: { color: palette.text, fontSize: 14, lineHeight: 21 },
  noPackages: { color: palette.secondary, fontSize: 15, lineHeight: 23 },
  bookingSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 40 },
  scheduleUnavailableNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: warningNotice.border,
    borderRadius: 12,
    backgroundColor: warningNotice.background,
    padding: 13,
    marginBottom: 22,
  },
  scheduleUnavailableCopy: { flex: 1, gap: 2 },
  scheduleUnavailableTitle: {
    color: warningNotice.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  sectionHeading: { color: palette.text, fontSize: typography.h2, lineHeight: 29, fontWeight: '700', marginBottom: 24 },
  mealTypeGrid: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  mealCard: {
    minWidth: 0,
    minHeight: 104,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: neutralSelection.edge,
    borderRadius: 12,
    backgroundColor: neutralSelection.surface,
    padding: 12,
    boxShadow: neutralSelection.sunkenShadow,
  },
  mealCardSelected: { borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  mealCardDisabled: { borderColor: palette.surfaceVariant, backgroundColor: palette.surfaceLow, opacity: 0.58 },
  mealCardPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  mealLabel: { color: palette.secondary, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  mealSelectedContent: { color: neutralSelection.selectedText },
  unavailableLabel: { color: palette.secondary, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  unavailableNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: warningNotice.border,
    borderRadius: 10,
    backgroundColor: warningNotice.background,
    marginTop: -16,
    marginBottom: 28,
    padding: 14,
  },
  unavailableNoticeText: { minWidth: 0, flex: 1, color: warningNotice.text, fontSize: 12, lineHeight: 18 },
  cateringOptionsSection: { gap: 14, marginBottom: 32 },
  overlayVenueRequestSection: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    padding: 16,
    boxShadow: '6px 6px 13px rgba(157, 169, 178, 0.44), -6px -6px 13px rgba(255, 255, 255, 0.92)',
  },
  venueReviewsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(125, 135, 143, 0.42)',
    marginBottom: 18,
  },
  foodTastingPreferenceCard: {
    gap: 14,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 14,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.raisedShadow,
  },
  foodTastingPreferenceHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  foodTastingPreferenceCopy: { minWidth: 0, flex: 1, gap: 4 },
  foodTastingPreferenceOptions: { gap: 10 },
  foodTastingPreferenceOption: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 10, backgroundColor: neutralSelection.surface, padding: 12, boxShadow: neutralSelection.sunkenShadow },
  foodTastingPreferenceOptionSelected: { borderWidth: 1, borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  foodTastingPreferenceOptionDisabled: { backgroundColor: palette.surfaceLow, opacity: 0.64 },
  foodTastingPreferenceOptionCopy: { minWidth: 0, flex: 1, gap: 2 },
  foodTastingPreferenceOptionTitle: { color: palette.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  foodTastingPreferenceOptionText: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  foodTastingUnavailableCopy: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  foodTastingPhaseNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: '#E6C4C8', borderRadius: 12, backgroundColor: '#F8EFF1', padding: 14 },
  foodTastingPhaseNoticeTitle: { color: palette.primary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  foodTastingPhaseNoticeText: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  foodTastingCourseCard: { gap: 10, borderWidth: 1, borderColor: '#E6C4C8', borderRadius: 14, backgroundColor: palette.surfaceLowest, padding: 15 },
  foodTastingCourseCopy: { minWidth: 0, flex: 1 },
  foodTastingCourseCount: { alignItems: 'flex-end', gap: 3 },
  foodTastingCourseCountText: { color: palette.secondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  foodTastingCourseCountComplete: { color: palette.primary },
  foodTastingFinalLimit: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  foodTastingPricingNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: palette.surfaceLow, padding: 14 },
  foodTastingPricingTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  foodTastingPricingText: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  foodTastingReferencePrice: { color: palette.primary, fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 2 },
  foodTastingDraftMessage: { color: palette.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  guestCountCard: {
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.74)',
    borderRadius: 15,
    backgroundColor: '#E9EDF0',
    padding: 16,
    boxShadow: 'inset 3px 3px 7px rgba(157, 169, 178, 0.42), inset -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  guestCountCopy: { minWidth: 0, flex: 1, gap: 6 },
  guestCountHint: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  guestCountControl: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  guestCountButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 19, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  guestCountButtonDisabled: { opacity: 0.4 },
  guestCountButtonPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  guestCountInput: { width: 76, minHeight: 42, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 9, backgroundColor: neutralSelection.surface, color: palette.primary, fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8, boxShadow: neutralSelection.sunkenShadow },
  guestCountRange: { color: palette.secondary, fontSize: 11, lineHeight: 16 },
  guestCountCounter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.76)',
    borderRadius: 18,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 13,
    paddingVertical: 6,
    boxShadow: '3px 3px 7px rgba(157, 169, 178, 0.40), -3px -3px 7px rgba(255, 255, 255, 0.92)',
  },
  guestCountValue: { color: palette.primary, fontSize: typography.h2, lineHeight: 28, fontWeight: '700' },
  guestCountUnit: { color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '600' },
  cateringInstruction: { color: palette.secondary, fontSize: typography.body, lineHeight: 21 },
  venueOptionsContainer: {
    gap: 12,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  venueOptionChoice: {
    gap: 12,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    padding: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  venueOptionChoiceSelected: { borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  venueOptionChoicePressed: { transform: [{ scale: 0.99 }] },
  venueOptionStack: { width: '100%', alignItems: 'flex-start', gap: 10 },
  venueOptionCopy: { width: '100%', gap: 3 },
  venueOptionName: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700' },
  cateringOptionCard: { gap: 10, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 14, backgroundColor: neutralSelection.surface, padding: 16, boxShadow: neutralSelection.sunkenShadow },
  cateringPresetPackageCard: { gap: 10, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 14, backgroundColor: neutralSelection.surface, padding: 16 },
  cateringCustomMenuSectionCard: { gap: 10, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 14, backgroundColor: neutralSelection.surface, padding: 16, boxShadow: neutralSelection.raisedShadow },
  cateringOptionCardSelected: { borderWidth: 1, borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  cateringOptionCardDisabled: { opacity: 0.62, backgroundColor: palette.surfaceLow },
  cateringOptionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cateringCourseHeaderCopy: { minWidth: 0, flex: 1 },
  cateringOptionName: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700' },
  cateringOptionRange: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17, marginTop: 2 },
  cateringOptionPriceGroup: { alignItems: 'flex-end' },
  cateringOptionUnit: { color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  cateringOptionSubtotal: { color: palette.text, fontSize: typography.caption, lineHeight: 17, marginTop: 2 },
  cateringPresetMenuContent: {
    gap: 10,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 12,
    backgroundColor: neutralSelection.surface,
    paddingHorizontal: 12,
    paddingVertical: 2,
    boxShadow: neutralSelection.sunkenShadow,
  },
  cateringPresetMenuContentSelected: {
    borderColor: 'rgba(255, 255, 255, 0.30)',
    backgroundColor: neutralSelection.selectedSurface,
    boxShadow: 'inset 4px 4px 9px rgba(55, 4, 18, 0.40), inset -4px -4px 9px rgba(181, 98, 121, 0.24)',
  },
  cateringMenuSection: { borderTopWidth: 1, borderTopColor: palette.surfaceVariant, paddingTop: 8 },
  cateringMenuSectionSelected: { borderTopColor: 'rgba(255, 255, 255, 0.30)' },
  cateringCourseLabel: { color: palette.primary, fontSize: typography.h3, lineHeight: 24, fontWeight: '700' },
  cateringPresetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cateringPresetName: { minWidth: 0, flex: 1, color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700' },
  cateringPresetPrice: { color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '800' },
  cateringPresetTotal: { color: palette.primary, fontSize: typography.h3, lineHeight: 24, fontWeight: '800' },
  cateringPresetRange: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17 },
  venueSelectionCard: { gap: 10, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 12, backgroundColor: neutralSelection.surface, padding: 14, boxShadow: neutralSelection.raisedShadow },
  venueSelectionHeadingCopy: { minWidth: 0, flex: 1, gap: 2 },
  venueSelectionSubtotal: { flexShrink: 0, color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  venueRentalRate: { color: palette.secondary, fontSize: typography.body, lineHeight: 20, fontWeight: '600' },
  venueDurationRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8 },
  venueDurationButton: {
    width: 40,
    height: 40,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 20,
    backgroundColor: neutralSelection.surface,
    boxShadow: neutralSelection.raisedShadow,
  },
  venueDurationButtonPressed: { transform: [{ translateY: 1 }], boxShadow: neutralSelection.sunkenShadow },
  venueDurationButtonText: { color: palette.primary, fontSize: 21, lineHeight: 24, fontWeight: '700' },
  venueDurationInput: {
    width: 72,
    minHeight: 42,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 8,
    backgroundColor: neutralSelection.surface,
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 8,
    boxShadow: neutralSelection.sunkenShadow,
  },
  venueDurationUnit: { minWidth: 42, flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start', color: palette.secondary, fontSize: typography.body, lineHeight: 20, marginTop: 5, textAlign: 'left' },
  venueDurationHelper: { color: palette.secondary, fontSize: typography.caption, lineHeight: 18 },
  venueTermsCard: { gap: 3, borderRadius: 8, backgroundColor: palette.surfaceLow, padding: 11 },
  venueDetailsToggle: { alignSelf: 'flex-start', paddingVertical: 4 },
  venueDetailsToggleText: { color: palette.primary, fontSize: typography.caption, lineHeight: 17, fontWeight: '800', letterSpacing: 0.7 },
  venueExpandedDetails: { gap: 7, borderTopWidth: 1, borderTopColor: '#E6C4C8', paddingTop: 12 },
  venueDetailCopy: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  venuePhotoRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  venueOptionPhoto: { width: 112, height: 76, borderRadius: 8, backgroundColor: palette.surfaceLow },
  cateringMenuItemChoice: { position: 'relative', gap: 8, borderWidth: 1, borderColor: neutralSelection.edge, borderRadius: 12, backgroundColor: neutralSelection.surface, marginVertical: 4, padding: 12, boxShadow: neutralSelection.sunkenShadow },
  cateringMenuItemChoiceSelected: { borderColor: neutralSelection.selectedEdge, backgroundColor: neutralSelection.selectedSurface, boxShadow: neutralSelection.selectedRaisedShadow },
  selectedOptionText: { color: neutralSelection.selectedText },
  selectedOptionMutedText: { color: neutralSelection.selectedMutedText },
  menuItemChoiceCopy: { minWidth: 0, paddingRight: 28 },
  cateringMenuItemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cateringMenuItemName: { minWidth: 0, flex: 1, color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  cateringMenuItemSelectionMark: { position: 'absolute', top: 12, right: 12 },
  cateringMenuItemPrice: { color: palette.primary, fontSize: typography.body, lineHeight: 20, fontWeight: '800', marginTop: 2 },
  cateringSummaryCard: { gap: 4, borderRadius: 12, backgroundColor: '#F8EFF1', padding: 14 },
  cateringCustomMenuSummaryCard: { borderWidth: 1, borderColor: neutralSelection.edge, backgroundColor: neutralSelection.surface, boxShadow: neutralSelection.raisedShadow },
  cateringMenuName: { color: palette.text, fontSize: typography.body, lineHeight: 20, fontWeight: '700' },
  cateringMenuItems: { color: palette.secondary, fontSize: typography.body, lineHeight: 21, marginTop: 2 },
  cateringSelectionHint: { color: warningNotice.text, fontSize: typography.caption, lineHeight: 18, fontWeight: '600', marginTop: -2 },
  cateringMismatch: { color: '#A12A35', fontSize: typography.caption, lineHeight: 17, fontWeight: '700' },
  inputGrid: { gap: 24, marginBottom: 40 },
  inputGridWide: { flexDirection: 'row' },
  inputLabel: { color: palette.secondary, fontSize: typography.caption, lineHeight: 17, fontWeight: '700', letterSpacing: 1.2 },
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
  reviewsSection: { borderTopWidth: 1, borderTopColor: palette.surfaceVariant, paddingTop: 22, paddingBottom: 64, gap: 15 },
  overlayReviewsSection: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.66)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    padding: 18,
    shadowColor: '#9DA9B2',
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 0.48,
    shadowRadius: 15,
    elevation: 5,
    boxShadow: '7px 7px 15px rgba(157, 169, 178, 0.48)',
  },
  reviewsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  reviewsTitle: { color: palette.text, fontSize: typography.h3, lineHeight: 24, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  ratingSummary: { alignItems: 'flex-end' },
  ratingValue: { color: palette.primary, fontSize: typography.h2, lineHeight: 27, fontWeight: '700' },
  liveReviewCard: { alignItems: 'center', borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 16, backgroundColor: palette.surfaceLowest, padding: 28 },
  overlaySunkenReviewCard: {
    borderWidth: 0,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 4px 4px 9px rgba(157, 169, 178, 0.48), inset -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
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
  quoteError: { color: palette.primary, fontSize: 11, lineHeight: 15, marginTop: 2, maxWidth: 420 },
  addButton: { width: '100%', minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 8, borderRadius: 25, backgroundColor: palette.primary, paddingHorizontal: 16, paddingVertical: 13 },
  addButtonWide: { width: 'auto', minWidth: 280 },
  addButtonText: { minWidth: 0, flex: 1, color: palette.white, fontSize: typography.button, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  addDivider: { flexShrink: 0, color: 'rgba(255,255,255,0.5)', fontSize: typography.button },
  addPrice: { flexShrink: 0, color: palette.white, fontSize: typography.button, lineHeight: 22, fontWeight: '700' },
  addPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  addButtonDisabled: { opacity: 0.62 },
  outlinePressed: { backgroundColor: '#FCF5F6', transform: [{ scale: 0.99 }] },
  pressed: { opacity: 0.55 },
})
