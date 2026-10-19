import { Text } from '../components/AppText'
import { MaterialCommunityIcons } from '@expo/vector-icons'
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
import {
  calculateCateringCustomMenuPrice,
  calculateCateringPrice,
  defaultCateringCustomMenuItemIds,
  getCateringCustomMenu,
  getCateringPricingOptions,
  getVenueBookingOptions,
  getVenueBookingRules,
  summarizeCategoryDetails,
  type CateringPricingOption,
  type VenueBookingOption,
  type VenueOptionSelection,
} from '../lib/service-category-details'
import type { ReviewSentiment, ServiceReviewInsights } from '../lib/reviews'

export type MealType = CateringServiceType
type CateringOffering = 'custom' | 'preset'

export interface ServiceSelectionValue {
  attendeeCount: number
  budgetPerHead: number
  cateringMenuItemIds?: string[]
  cateringOption?: CateringPricingOption
  estimatedTotal: number
  mealType?: MealType
  notes: string
  service: CatalogService
  venueBookedHours?: number
  venueOption?: VenueBookingOption
  venueSelections?: VenueOptionSelection[]
}

type ServiceQuotePreview = {
  calculatedAmount?: number
  message?: string
  ok: boolean
  providerAmount?: number
}

interface ServiceDetailsScreenProps {
  availableCategoryBudget?: number
  eventGuestCount?: number
  eventDate?: string
  eventTime?: string
  hasBudget?: boolean
  mode?: 'explore' | 'planning'
  service?: CatalogService
  onAddSelection?: (value: ServiceSelectionValue) => Promise<void> | void
  onCalculateQuote?: (value: {
    menuItemIds?: string[]
    optionId?: string
    packageId?: string
    quantity?: number
    service: CatalogService
    venueSelections?: VenueOptionSelection[]
  }) => Promise<ServiceQuotePreview>
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

const pricingUnitLabel = (unit?: 'event' | 'person' | 'hour' | 'day') => {
  if (unit === 'person') return 'per person'
  if (unit === 'hour') return 'per hour'
  if (unit === 'day') return 'per day'
  if (unit === 'event') return 'per event'
  return ''
}

export const ServiceDetailsScreen: React.FC<ServiceDetailsScreenProps> = ({
  availableCategoryBudget = 0,
  eventGuestCount = 0,
  eventDate = '',
  eventTime = '',
  hasBudget,
  mode = 'planning',
  service,
  onAddSelection,
  onCalculateQuote,
  onBack,
  onReadAllReviews,
  reviewInsights,
  reviewInsightsLoading = false,
}) => {
  const { width, height } = useWindowDimensions()
  const isWide = width >= 768
  const isExploreMode = mode === 'explore'
  const hasSetBudget = hasBudget ?? availableCategoryBudget > 0
  const heroWidth = Math.min(width, 1200)
  const heroHeight = Math.max(280, Math.min(460, height * 0.42))
  const [heroIndex, setHeroIndex] = React.useState(0)
  const [mealType, setMealType] = React.useState<MealType>()
  const [selectedCateringMenuItemIds, setSelectedCateringMenuItemIds] = React.useState<string[]>([])
  const [selectedCateringOptionId, setSelectedCateringOptionId] = React.useState('')
  const [selectedCateringOffering, setSelectedCateringOffering] = React.useState<CateringOffering>('preset')
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
    setSelectedCateringMenuItemIds(defaultCateringCustomMenuItemIds(
      getCateringCustomMenu(service?.categoryDetails)
    ))
    const options = getCateringPricingOptions(service?.categoryDetails, service?.providerMinPrice)
    setSelectedCateringOptionId(options.length === 1 ? options[0].id : '')
    const customMenu = getCateringCustomMenu(service?.categoryDetails)
    setSelectedCateringOffering(customMenu && options.length === 0 ? 'custom' : 'preset')
    setExpandedCateringMenuSections(new Set())
    const venueOptions = getVenueBookingOptions(service?.categoryDetails)
    const venueRules = getVenueBookingRules(service?.categoryDetails)
    const soleVenueOption = venueOptions.length === 1 ? venueOptions[0] : undefined
    setSelectedVenueHours(soleVenueOption
      ? {
          [soleVenueOption.id]: soleVenueOption.pricingUnit === 'event'
            ? ''
            : String(soleVenueOption.minimumBookingHours ?? venueRules.minimumBookingHours),
        }
      : {})
    setExpandedVenueOptions(new Set())
    setHeroIndex(0)
    setExpandedSentiment(undefined)
    setAuthoritativeQuote(undefined)
    setQuoteError('')
    setQuoteLoading(false)
  }, [
    service?.cateringServiceTypes,
    service?.categoryDetails,
    service?.id,
    service?.packageId,
    service?.providerMinPrice,
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
    const useSelectedProviderPackage = Boolean(selectedPackageId)
    const useCustomCateringMenu = isCateringService && !useSelectedProviderPackage && Boolean(customMenu)
      && (getCateringPricingOptions(service.categoryDetails, service.providerMinPrice).length === 0
        || selectedCateringOffering === 'custom')
    if (useCustomCateringMenu && customMenu) {
      const calculation = calculateCateringCustomMenuPrice(
        customMenu,
        selectedCateringMenuItemIds,
        eventGuestCount
      )
      if (!calculation.fitsGuestCount) return
    } else if (isCateringService && !useSelectedProviderPackage && !selectedCateringOptionId) return
    if (isVenueService && (
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
        menuItemIds: useCustomCateringMenu ? selectedCateringMenuItemIds : undefined,
        optionId: isVenueService ? undefined
          : isCateringService && !useSelectedProviderPackage ? selectedCateringOptionId : undefined,
        packageId: selectedPackageId || service.packageId,
        quantity: undefined,
        service,
        venueSelections: isVenueService ? selectedVenueSelections : undefined,
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
    eventGuestCount,
    selectedCateringMenuItemIds,
    selectedCateringOffering,
    selectedCateringOptionId,
    selectedPackageId,
    selectedVenueHours,
    service,
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

  const attendeeCount = Math.max(0, Math.floor(eventGuestCount || 0))
  const categoryFacts = summarizeCategoryDetails(service.categoryName, service.categoryDetails)
  const isCatering = service.categoryId === 'catering'
  const isVenue = service.categoryId === 'venues'
  const customCateringMenu = getCateringCustomMenu(service.categoryDetails)
  const cateringOptions = getCateringPricingOptions(service.categoryDetails, service.providerMinPrice)
  const selectedPackage = service.packages?.find((item) => item.id === selectedPackageId)
  const usesSelectedProviderPackage = Boolean(selectedPackage)
  const hasCustomCateringMenu = isCatering && Boolean(customCateringMenu)
  const hasPresetCateringMenus = isCatering && cateringOptions.length > 0
  const usesCustomCateringMenu = !usesSelectedProviderPackage && hasCustomCateringMenu
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
  const budgetPerHead = activeCateringOption?.pricePerHead ?? 0
  const availableMealTypes = service.cateringServiceTypes ?? []
  const cateringSelectionUnavailable = isCatering && !usesSelectedProviderPackage && (
    !activeCateringOption || !activeCateringCalculation?.fitsGuestCount
  )
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
    if (selectedVenueOptions.length === 0) return 'Choose at least one available venue option.'
    if (!eventDate || !eventTime) return 'Set the event date and start time before choosing a venue.'
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
  const selectedUnit = selectedPackage?.unit ?? service.pricingUnit ?? 'event'
  const selectedPrice = selectedPackage?.price ?? service.minPrice
  const selectedProviderPrice = selectedPackage?.providerPrice ?? service.providerMinPrice
  const hasOptionLevelVenuePricing = selectedVenueOptions.length > 0
    && selectedVenueOptions.every((option) => Boolean(option.pricingUnit && option.baseRate && option.baseRate > 0))
  const requiresQuote = (service.pricingModel === 'customQuote' || selectedPrice <= 0)
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
  const locallyEstimatedProviderTotal = usesSelectedProviderPackage
    ? selectedProviderPrice
    : isCatering
    ? cateringCalculation?.providerSubtotal ?? 0
    : isVenue
      ? locallyEstimatedVenueProviderTotal
    : selectedUnit === 'person' && attendeeCount > 0
      ? selectedProviderPrice * attendeeCount
      : selectedProviderPrice
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
  )
  const authoritativeQuoteUnavailable = requiresAuthoritativeQuote
    && (quoteLoading || Boolean(quoteError) || !authoritativeQuote)
  const exceedsAvailableCategoryBudget = hasSetBudget
    && estimatedTotal > availableCategoryBudget
  const categoryBudgetOverage = exceedsAvailableCategoryBudget
    ? Math.max(0, estimatedTotal - availableCategoryBudget)
    : 0
  const estimatedDisplay =
    quoteLoading
      ? 'Calculating...'
      : quoteError
        ? 'Price unavailable'
      : requiresQuote && !authoritativeQuote
        ? 'Quote required'
      : `PHP ${formatCurrency(estimatedTotal)}`
  const scheduleUnavailable = !isExploreMode
    && service.budgetRecommendation?.availabilityStatus === 'unavailable'

  const handleAddSelection = async () => {
    if (
      !onAddSelection
      || isAddingSelection
      || cateringSelectionUnavailable
      || venueSelectionUnavailable
      || authoritativeQuoteUnavailable
      || exceedsAvailableCategoryBudget
      || scheduleUnavailable
    ) return

    setIsAddingSelection(true)

    try {
      await onAddSelection({
        attendeeCount,
        budgetPerHead: usesSelectedProviderPackage && attendeeCount > 0
          ? selectedPrice / attendeeCount
          : budgetPerHead,
        cateringMenuItemIds: usesCustomCateringMenu ? selectedCateringMenuItemIds : undefined,
        cateringOption: usesSelectedProviderPackage ? undefined : activeCateringOption,
        estimatedTotal,
        mealType,
        // Client dietary and special requests belong in the dedicated
        // Instruction Module, reached after service selection.
        notes: '',
        venueBookedHours: isVenue ? primaryVenueHours : undefined,
        venueOption: primaryVenueOption,
        venueSelections: isVenue ? selectedVenueSelections : undefined,
        service: selectedPackage
          ? {
              ...service,
              minPrice: selectedPackage.price,
              packageId: selectedPackage.id,
              pricingUnit: 'event',
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

  const canAddVenueOption = (candidate: VenueBookingOption) => {
    if (selectedVenueHours[candidate.id] !== undefined) return true
    if (selectedVenueOptions.length === 0) return true
    if (!candidate.allowsCombination || selectedVenueOptions.some((option) => !option.allowsCombination)) {
      return false
    }
    if (candidate.resourceIds.some((resourceId) => selectedVenueOptions.some((option) =>
      option.resourceIds.includes(resourceId)
    ))) return false
    if (candidate.mutuallyExclusiveOptionIds.some((id) =>
      selectedVenueOptions.some((option) => option.id === id)
    )) return false
    return !selectedVenueOptions.some((option) => option.mutuallyExclusiveOptionIds.includes(candidate.id))
  }

  const toggleVenueOption = (option: VenueBookingOption) => {
    setSelectedVenueHours((current) => {
      if (Object.prototype.hasOwnProperty.call(current, option.id)) {
        const remaining = { ...current }
        delete remaining[option.id]
        return remaining
      }
      if (!canAddVenueOption(option)) return current
      return {
        ...current,
        [option.id]: isHourlyVenueOption(option)
          ? String(optionMinimumHours(option))
          : '',
      }
    })
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
      const baseValue = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : minimum
      const nextValue = direction > 0
        ? baseValue + venueRules.durationIncrementHours
        : baseValue - venueRules.durationIncrementHours
      const bounded = Math.max(minimum, maximum === undefined ? nextValue : Math.min(nextValue, maximum))
      return { ...current, [option.id]: String(bounded) }
    })
  }

  const toggleExpandedVenueOption = (optionId: string) => setExpandedVenueOptions((current) => {
    const next = new Set(current)
    if (next.has(optionId)) next.delete(optionId)
    else next.add(optionId)
    return next
  })

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
                  ? `Available for ${service.categoryName}: ${formatPeso(availableCategoryBudget)}`
                  : 'Pay actual service costs'}
                </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.content, isWide && styles.contentPaddingWide]}>
          {exceedsAvailableCategoryBudget ? (
            <View style={styles.budgetOverageNotice}>
              <MaterialCommunityIcons color={palette.primary} name="alert-circle-outline" size={20} />
              <Text style={styles.budgetOverageNoticeText}>
                This configuration is {formatPeso(categoryBudgetOverage)} over the available {service.categoryName} budget. {isVenue
                  ? 'Adjust the venue options or rental duration, or return to update the category budget.'
                  : 'Adjust the service selection or return to update the category budget.'}
              </Text>
            </View>
          ) : null}
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
              {categoryFacts.map((fact) => (
                <View key={`${fact.label}-${fact.value}`} style={styles.serviceFactRow}>
                  <Text style={styles.serviceFactLabel}>{fact.label.toUpperCase()}</Text>
                  <Text style={styles.serviceFactValue}>{fact.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.packagesSection}>
            <Text style={styles.sectionHeading}>Included in These Packages</Text>
            <Text style={styles.packageSectionIntro}>
              Choose a bundle that includes this service together with other services from the provider.
            </Text>
            {service.packages?.length ? (
              <View style={styles.packageList}>
                {service.packages.map((item) => {
                  const isSelected = item.id === selectedPackageId
                  const packageUnit = isCatering ? 'event' : item.unit

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
                        <View style={styles.packagePriceGroup}>
                          {item.originalPrice ? (
                            <Text style={styles.packageOriginalPrice}>{formatPeso(item.originalPrice)}</Text>
                          ) : null}
                          <Text style={styles.packagePrice}>
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
                        <Text style={styles.packageDescription}>{item.description}</Text>
                      ) : null}
                      {item.serviceNames.length ? (
                        <View style={styles.packageServices}>
                          <Text style={styles.packageServicesLabel}>SERVICES IN THIS PACKAGE</Text>
                          {item.serviceNames.map((serviceName) => (
                            <Text key={serviceName} style={styles.inclusionText}>
                              {'\u2022'} {serviceName}
                            </Text>
                          ))}
                        </View>
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
                This service is not currently included in a package. Its listed price still applies.
              </Text>
            )}
          </View>

          {!isExploreMode ? (
            <View style={styles.bookingSection}>
            <Text style={styles.sectionHeading}>
              {service.categoryId === 'catering' ? 'Booking Details' : 'Request This Service'}
            </Text>

            {scheduleUnavailable ? (
              <View style={styles.scheduleUnavailableNotice}>
                <MaterialCommunityIcons color={palette.secondary} name="calendar-remove-outline" size={21} />
                <View style={styles.scheduleUnavailableCopy}>
                  <Text style={styles.scheduleUnavailableTitle}>Not available on your event schedule</Text>
                  <Text style={styles.unavailableNoticeText}>
                    This provider is unavailable at the selected date and time. Choose another provider or update your event schedule.
                  </Text>
                </View>
              </View>
            ) : null}

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

            {isCatering ? (
              <View style={styles.cateringOptionsSection}>
                <View style={styles.guestCountCard}>
                  <View>
                    <Text style={styles.inputLabel}>EXPECTED / ANTICIPATED GUESTS</Text>
                    <Text style={styles.guestCountValue}>{attendeeCount.toLocaleString('en-PH')} guests</Text>
                  </View>
                  <MaterialCommunityIcons color={palette.primary} name="account-group-outline" size={28} />
                </View>
                {usesSelectedProviderPackage ? (
                  <View style={styles.cateringSummaryCard}>
                    <Text style={styles.cateringOptionName}>{selectedPackage?.name}</Text>
                    <Text style={styles.cateringOptionRange}>Provider package · fixed total for the event</Text>
                    <Text style={styles.cateringOptionUnit}>{formatPeso(selectedPackage?.price ?? 0)} total</Text>
                  </View>
                ) : hasCustomCateringMenu && hasPresetCateringMenus ? (
                  <View style={styles.mealTypeGrid}>
                    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedCateringOffering === 'preset' }} onPress={() => setSelectedCateringOffering('preset')} style={[styles.mealCard, selectedCateringOffering === 'preset' && styles.mealCardSelected]}>
                      <MaterialCommunityIcons color={selectedCateringOffering === 'preset' ? palette.primary : palette.secondary} name="food-variant" size={27} />
                      <Text style={[styles.mealLabel, selectedCateringOffering === 'preset' && styles.mealSelectedContent]}>Choose Preset Package</Text>
                    </Pressable>
                    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedCateringOffering === 'custom' }} onPress={() => setSelectedCateringOffering('custom')} style={[styles.mealCard, selectedCateringOffering === 'custom' && styles.mealCardSelected]}>
                      <MaterialCommunityIcons color={selectedCateringOffering === 'custom' ? palette.primary : palette.secondary} name="format-list-checks" size={27} />
                      <Text style={[styles.mealLabel, selectedCateringOffering === 'custom' && styles.mealSelectedContent]}>Customize Your Menu</Text>
                    </Pressable>
                  </View>
                ) : null}
                {usesCustomCateringMenu && customCateringMenu && customCateringCalculation ? <>
                  <Text style={styles.cateringInstruction}>Choose the food items you would like. Prices update for the event guest count immediately.</Text>
                  {customCateringMenu.sections.map((section) => {
                    const expanded = expandedCateringMenuSections.has(section.id)
                    const selectedCount = section.items.filter((item) => selectedCateringMenuItemIds.includes(item.id)).length
                    return (
                    <View key={section.id} style={styles.cateringOptionCard}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        onPress={() => setExpandedCateringMenuSections((current) => {
                          const next = new Set(current)
                          if (next.has(section.id)) next.delete(section.id)
                          else next.add(section.id)
                          return next
                        })}
                        style={styles.cateringOptionHeading}
                      >
                        <View>
                          <Text style={styles.cateringOptionName}>{section.name}</Text>
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
                        const disabled = !item.isActive || item.isRequired
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
                            <MaterialCommunityIcons color={selected ? palette.primary : palette.secondary} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} />
                            <View style={styles.menuItemChoiceCopy}>
                              <Text style={styles.cateringMenuName}>{item.name}{item.isRequired ? ' · Required' : ''}</Text>
                              {item.description ? <Text style={styles.cateringMenuItems}>{item.description}</Text> : null}
                              {!item.isActive ? <Text style={styles.cateringMismatch}>Unavailable</Text> : null}
                            </View>
                            <Text style={styles.cateringOptionUnit}>{formatPeso(customerPriceFromProviderPrice(item.pricePerHead, service.commissionRate))}/head</Text>
                          </Pressable>
                        )
                      }) : null}
                    </View>
                    )
                  })}
                  <View style={styles.cateringSummaryCard}>
                    <Text style={styles.cateringOptionName}>Selected menu total</Text>
                    <Text style={styles.cateringOptionUnit}>{formatPeso(customerPriceFromProviderPrice(customCateringCalculation.unitPrice, service.commissionRate))} / head</Text>
                    <Text style={styles.cateringOptionSubtotal}>{formatPeso(customerPriceFromProviderPrice(customCateringCalculation.providerSubtotal, service.commissionRate))} for {attendeeCount.toLocaleString('en-PH')} guests</Text>
                    {!customCateringCalculation.fitsGuestCount ? <Text style={styles.cateringMismatch}>{customCateringCalculation.reason}</Text> : null}
                  </View>
                </> : <>
                <Text style={styles.cateringInstruction}>Choose one provider menu and pricing option.</Text>
                {cateringOptions.map((option) => {
                  const calculation = calculateCateringPrice(option, attendeeCount)
                  const selected = option.id === selectedCateringOptionId
                  const customerUnitPrice = customerPriceFromProviderPrice(option.pricePerHead, service.commissionRate)
                  const customerSubtotal = customerPriceFromProviderPrice(calculation.providerSubtotal, service.commissionRate)
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: !calculation.fitsGuestCount }}
                      disabled={!calculation.fitsGuestCount}
                      onPress={() => setSelectedCateringOptionId(option.id)}
                      style={[styles.cateringOptionCard, selected && styles.cateringOptionCardSelected, !calculation.fitsGuestCount && styles.cateringOptionCardDisabled]}
                    >
                      <View style={styles.cateringOptionHeading}>
                        <View style={styles.packageTitleRow}>
                          <MaterialCommunityIcons color={selected ? palette.primary : palette.secondary} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} />
                          <View>
                            <Text style={styles.cateringOptionName}>{option.name}</Text>
                            <Text style={styles.cateringOptionRange}>{option.minimumGuests}-{option.maximumGuests} guests</Text>
                          </View>
                        </View>
                        <View style={styles.cateringOptionPriceGroup}>
                          <Text style={styles.cateringOptionUnit}>{formatPeso(customerUnitPrice)} / head</Text>
                          <Text style={styles.cateringOptionSubtotal}>{formatPeso(customerSubtotal)} total</Text>
                        </View>
                      </View>
                      {option.menuSections.map((section) => (
                        <View key={section.id} style={styles.cateringMenuSection}>
                          <Text style={styles.cateringMenuName}>{section.name}</Text>
                          <Text style={styles.cateringMenuItems}>{section.items.join(', ')}</Text>
                        </View>
                      ))}
                      {!calculation.fitsGuestCount ? <Text style={styles.cateringMismatch}>{calculation.reason} This option does not fit your event.</Text> : null}
                    </Pressable>
                  )
                })}
                {cateringOptions.length === 0 ? (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={palette.secondary} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This provider must add a per-head catering option before this service can be selected.</Text>
                  </View>
                ) : null}
                </>}
              </View>
            ) : null}

            {isVenue ? (
              <View style={styles.cateringOptionsSection}>
                <View style={styles.guestCountCard}>
                  <View>
                    <Text style={styles.inputLabel}>EVENT REQUIREMENT</Text>
                    <Text style={styles.guestCountValue}>{attendeeCount.toLocaleString('en-PH')} guests</Text>
                    {eventDate && eventTime ? (
                      <Text style={styles.cateringOptionRange}>{eventDate} at {eventTime}</Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons color={palette.primary} name="office-building-marker-outline" size={28} />
                </View>
                <Text style={styles.cateringInstruction}>Choose available venue options. Select more than one only when every option allows combination.</Text>
                {venueOptions.map((option) => {
                  const selected = Object.prototype.hasOwnProperty.call(selectedVenueHours, option.id)
                  const canSelect = selected || canAddVenueOption(option)
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: !canSelect }}
                      disabled={!canSelect}
                      onPress={() => toggleVenueOption(option)}
                      style={[styles.cateringOptionCard, selected && styles.cateringOptionCardSelected, !canSelect && styles.cateringOptionCardDisabled]}
                    >
                      <View style={styles.cateringOptionHeading}>
                        <View style={styles.packageTitleRow}>
                          <MaterialCommunityIcons color={selected ? palette.primary : palette.secondary} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} />
                          <View>
                            <Text style={styles.cateringOptionName}>{option.name}</Text>
                            <Text style={styles.cateringOptionRange}>{option.kind === 'combination' ? 'Expandable combination' : 'Individual space'} · {option.spaceType}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.cateringMenuItems}>Capacity: {option.capacity} guests · Area: {option.areaSqm || 'Not specified'} sqm</Text>
                      {!canSelect ? <Text style={styles.cateringMismatch}>This option conflicts with another selected space or cannot be combined.</Text> : null}
                    </Pressable>
                  )
                })}
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
                        <View>
                          <Text style={styles.cateringOptionName}>{option.name}</Text>
                          <Text style={styles.cateringOptionRange}>{isHourly ? 'Hourly rental' : 'Per-event rental'} · {formatPeso(customerPriceFromProviderPrice(unitRate, service.commissionRate))} / {isHourly ? 'hour' : 'event'}</Text>
                        </View>
                        <Text style={styles.cateringOptionSubtotal}>{formatPeso(customerPriceFromProviderPrice(providerSubtotal, service.commissionRate))}</Text>
                      </View>
                      {isHourly ? <>
                        <Text style={styles.inputLabel}>RENTAL DURATION</Text>
                        <View style={styles.venueDurationRow}>
                          <Pressable accessibilityLabel={`Decrease ${option.name} duration`} onPress={() => adjustVenueHours(option, -1)} style={styles.venueDurationButton}><Text style={styles.venueDurationButtonText}>−</Text></Pressable>
                          <TextInput
                            accessibilityLabel={`${option.name} rental duration in hours`}
                            keyboardType="decimal-pad"
                            onChangeText={(value) => updateVenueHours(option, value)}
                            placeholder={String(minimumHours)}
                            placeholderTextColor={palette.secondaryFixedDim}
                            style={styles.venueDurationInput}
                            value={selectedVenueHours[option.id]}
                          />
                          <Text style={styles.venueDurationUnit}>hours</Text>
                          <Pressable accessibilityLabel={`Increase ${option.name} duration`} onPress={() => adjustVenueHours(option, 1)} style={styles.venueDurationButton}><Text style={styles.venueDurationButtonText}>+</Text></Pressable>
                        </View>
                        <Text style={styles.cateringOptionRange}>{minimumHours} hour minimum · {venueRules.durationIncrementHours} hour increments{maximumHours ? ` · ${maximumHours} hour maximum` : ''}</Text>
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
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EVENT SCHEDULE</Text>
                  <TextInput
                    accessibilityLabel="Venue duration is set on each selected hourly option"
                    editable={false}
                    placeholder="Set each selected hourly option above"
                    placeholderTextColor={palette.secondaryFixedDim}
                    style={styles.notesInput}
                    value=""
                  />
                  <Text style={styles.cateringOptionRange}>
                    {venueRules.minimumBookingHours} hour minimum · {venueRules.durationIncrementHours} hour increments
                    {venueRules.maximumBookingHours ? ` · ${venueRules.maximumBookingHours} hour maximum` : ''}
                  </Text>
                  <Text style={styles.cateringOptionRange}>
                    Operating hours: {venueRules.openingTime || 'Not specified'}-{venueRules.closingTime || 'Not specified'} · Setup/ingress: {venueRules.setupAllowanceHours} hours{venueRules.setupAllowanceBillable ? ' (billable)' : ' (not billed)'}
                  </Text>
                </View>
                {venueOptions.length === 0 ? (
                  <View style={styles.unavailableNotice}>
                    <MaterialCommunityIcons color={palette.secondary} name="alert-circle-outline" size={20} />
                    <Text style={styles.unavailableNoticeText}>This provider must configure a venue space before the service can be selected.</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

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
                {quoteError ? <Text style={styles.quoteError}>{quoteError}</Text> : null}
                {exceedsAvailableCategoryBudget ? (
                  <Text style={styles.quoteError}>
                    {formatPeso(categoryBudgetOverage)} over the available category budget. Adjust the selection or budget before continuing.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={
                requiresQuote
                  ? 'Add custom quote service to selection'
                  : `Add to selection for ${formatCurrency(estimatedTotal)} pesos`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isAddingSelection || cateringSelectionUnavailable || venueSelectionUnavailable || authoritativeQuoteUnavailable || exceedsAvailableCategoryBudget || scheduleUnavailable }}
              disabled={isAddingSelection || cateringSelectionUnavailable || venueSelectionUnavailable || authoritativeQuoteUnavailable || exceedsAvailableCategoryBudget || scheduleUnavailable}
              onPress={handleAddSelection}
              style={({ pressed }) => [
                styles.addButton,
                isWide && styles.addButtonWide,
                (isAddingSelection || cateringSelectionUnavailable || venueSelectionUnavailable || authoritativeQuoteUnavailable || exceedsAvailableCategoryBudget || scheduleUnavailable) && styles.addButtonDisabled,
                pressed && styles.addPressed,
              ]}
            >
              <Text style={styles.addButtonText}>
                {isAddingSelection
                  ? 'Adding...'
                  : cateringSelectionUnavailable
                    ? 'Catering Options Unavailable'
                    : venueSelectionUnavailable
                      ? 'Venue Option or Duration Required'
                    : quoteLoading
                      ? 'Calculating Event Price...'
                      : quoteError
                        ? 'Event Price Unavailable'
                      : exceedsAvailableCategoryBudget
                        ? 'Over Available Category Budget'
                    : scheduleUnavailable
                      ? 'Unavailable on Your Schedule'
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
  servicePriceValue: { color: palette.primary, fontSize: 17, lineHeight: 23, fontWeight: '700', textAlign: 'right' },
  pricingNotes: { gap: 6, padding: 18 },
  pricingNotesText: { color: palette.text, fontSize: 15, lineHeight: 23 },
  packagesSection: { borderBottomWidth: 1, borderBottomColor: palette.surfaceVariant, paddingVertical: 40 },
  packageSectionIntro: { color: palette.secondary, fontSize: 14, lineHeight: 21, marginBottom: 18, marginTop: -12 },
  packageList: { gap: 14 },
  packageCard: { borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 14, backgroundColor: palette.surfaceLowest, padding: 18 },
  packageCardSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: '#FCF5F6' },
  packageCardPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  packageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  packageTitleRow: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  packageName: { minWidth: 0, flex: 1, color: palette.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  packagePrice: { color: palette.primary, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  packageDescription: { color: palette.secondary, fontSize: 14, lineHeight: 22, marginTop: 10 },
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
    borderColor: '#BDBDBD',
    borderRadius: 12,
    backgroundColor: '#F1F1F1',
    padding: 13,
    marginBottom: 22,
  },
  scheduleUnavailableCopy: { flex: 1, gap: 2 },
  scheduleUnavailableTitle: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
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
  cateringOptionsSection: { gap: 12, marginBottom: 32 },
  guestCountCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: '#F8EFF1', padding: 16 },
  guestCountValue: { color: palette.primary, fontSize: 22, lineHeight: 29, fontWeight: '700', marginTop: 5 },
  cateringInstruction: { color: palette.secondary, fontSize: 13, lineHeight: 19 },
  cateringOptionCard: { gap: 10, borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 14, backgroundColor: palette.surfaceLowest, padding: 16 },
  cateringOptionCardSelected: { borderWidth: 2, borderColor: palette.primary, backgroundColor: '#FCF5F6' },
  cateringOptionCardDisabled: { opacity: 0.62, backgroundColor: palette.surfaceLow },
  cateringOptionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cateringOptionName: { color: palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  cateringOptionRange: { color: palette.secondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  cateringOptionPriceGroup: { alignItems: 'flex-end' },
  cateringOptionUnit: { color: palette.primary, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  cateringOptionSubtotal: { color: palette.text, fontSize: 11, lineHeight: 16, marginTop: 2 },
  cateringMenuSection: { borderTopWidth: 1, borderTopColor: palette.surfaceVariant, paddingTop: 8 },
  venueSelectionCard: { gap: 10, borderWidth: 1, borderColor: '#E6C4C8', borderRadius: 12, backgroundColor: '#FCF5F6', padding: 14 },
  venueDurationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  venueDurationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: palette.primary },
  venueDurationButtonText: { color: palette.white, fontSize: 21, lineHeight: 24, fontWeight: '700' },
  venueDurationInput: { width: 72, minHeight: 42, borderWidth: 1, borderColor: palette.surfaceVariant, borderRadius: 8, backgroundColor: palette.surfaceLowest, color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  venueDurationUnit: { flex: 1, color: palette.secondary, fontSize: 13, lineHeight: 18 },
  venueTermsCard: { gap: 3, borderRadius: 8, backgroundColor: palette.surfaceLow, padding: 11 },
  venueDetailsToggle: { alignSelf: 'flex-start', paddingVertical: 4 },
  venueDetailsToggleText: { color: palette.primary, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  venueExpandedDetails: { gap: 7, borderTopWidth: 1, borderTopColor: '#E6C4C8', paddingTop: 12 },
  venueDetailCopy: { color: palette.secondary, fontSize: 12, lineHeight: 18 },
  venuePhotoRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  venueOptionPhoto: { width: 112, height: 76, borderRadius: 8, backgroundColor: palette.surfaceLow },
  cateringMenuItemChoice: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: palette.surfaceVariant, paddingVertical: 10 },
  cateringMenuItemChoiceSelected: { backgroundColor: '#FCF5F6', marginHorizontal: -6, paddingHorizontal: 6 },
  menuItemChoiceCopy: { minWidth: 0, flex: 1 },
  cateringSummaryCard: { gap: 4, borderRadius: 12, backgroundColor: '#F8EFF1', padding: 14 },
  cateringMenuName: { color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  cateringMenuItems: { color: palette.secondary, fontSize: 11, lineHeight: 17, marginTop: 2 },
  cateringMismatch: { color: '#A12A35', fontSize: 11, lineHeight: 17, fontWeight: '700' },
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
  quoteError: { color: palette.primary, fontSize: 11, lineHeight: 15, marginTop: 2, maxWidth: 420 },
  budgetOverageNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderColor: '#E6C4C8', borderRadius: 12, backgroundColor: '#FCF5F6', padding: 13, marginBottom: 18 },
  budgetOverageNoticeText: { flex: 1, color: palette.primary, fontSize: 13, lineHeight: 19, fontWeight: '600' },
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
