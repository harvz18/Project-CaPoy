import { Text } from '../components/AppText'
import React from 'react'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { BlurTargetView, BlurView } from 'expo-blur'
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { ReviewedServicesTab } from '../components/ReviewedServicesTab'
import { ClientBottomNavigation, ClientMainTab } from '../components/ClientBottomNavigation'
import { colors } from '../theme/tokens'
import { neutralSelection } from '../theme/neumorphism'
import { warningNotice } from '../theme/notices'
import {
  categoryNameToId,
  CatalogLoadStatus,
  CatalogService,
  formatPeso,
  formatServicePrice,
  marketplaceStartingPrice,
  ServiceCategoryOption,
  type CatalogCategoryId,
} from '../lib/catalog'
import { customerPriceFromProviderPrice } from '../lib/pricing'
import { calculateCateringPrice, getCateringPricingOptions } from '../lib/service-category-details'
import type { ReviewedService } from '../lib/reviewed-services'
import type { AssignedCoordinatorSummary, SelectedSummaryService } from './07-SelectedSummary'

export type CategoryBrowseVendor = string
export type CategoryBrowseTab = ClientMainTab | 'vendors' | 'budget'
type CategoryBrowseSort = 'recommended' | 'rating' | 'bookings' | 'priceLow' | 'priceHigh'

interface CategoryBrowseScreenProps {
  catalogLoadStatus?: CatalogLoadStatus
  blurTarget?: React.RefObject<React.ComponentRef<typeof View> | null>
  categoryCountServices?: CatalogService[]
  categoryBudgets?: Partial<Record<CatalogCategoryId, number>>
  categoryName?: string
  categories?: ServiceCategoryOption[]
  favoritePendingServiceIds?: ReadonlySet<string>
  favoriteServiceIds?: ReadonlySet<string>
  showFavoritesOnly?: boolean
  addableCategories?: ServiceCategoryOption[]
  eventGuestCount?: number
  hasBudget?: boolean
  mode?: 'explore' | 'planning'
  services?: CatalogService[]
  selectedServiceCount?: number
  selectedServices?: SelectedSummaryService[]
  assignedCoordinator?: AssignedCoordinatorSummary
  coordinatorAssignmentStatus?: 'accepted' | 'pending' | 'awaiting_assignment'
  coordinatorPackage?: { id: string; name: string; serviceSubtotal: number }
  budget?: number
  categoryBudget?: number
  categoryBudgetLocked?: boolean
  categoryBudgetMaximum?: number
  cateringIncludedInVenuePackage?: boolean
  venueCateringPackage?: {
    allocatedBudget: number
    name: string
    price: number
  }
  totalEstimatedCost?: number
  removingServiceId?: string
  remainingBudget?: number
  unallocatedCategoryCount?: number
  planningSelectionsComplete?: boolean
  showSelectionCompletionModal?: boolean
  changeServiceContext?: {
    category: string
    currentAmount: number
    serviceId: string
    serviceName: string
  }
  replacementContext?: {
    baselineAmount: number
    currentProviderName: string
    serviceName: string
  }
  showBottomNavigation?: boolean
  reviewedServices?: ReviewedService[]
  reviewedServicesLoading?: boolean
  searchValue?: string
  sortLabel?: string
  onBack?: () => void
  onBrandPress?: () => void
  onChangeSearch?: (value: string) => void
  onCategoryBudgetChange?: (amount: number) => Promise<boolean> | boolean
  onChangeService?: (service: SelectedSummaryService) => void
  onContinueSelectedServices?: () => void
  onAddCategory?: (
    category: ServiceCategoryOption
  ) => Promise<boolean> | boolean
  onRemoveCategory?: (
    category: ServiceCategoryOption
  ) => Promise<boolean> | boolean
  onAddService?: () => void
  onRemoveCoordinator?: () => void
  onRemoveService?: (service: SelectedSummaryService) => void
  onSelectionCompletionDismissed?: () => void
  onSelectService?: (serviceId: string) => void
  onOpenSort?: () => void
  onConfirmReplacement?: (vendorId: string) => boolean | Promise<boolean>
  onSelectCategory?: (category: ServiceCategoryOption) => void
  onReviewVenuePackage?: () => void
  onSelectTab?: (tab: CategoryBrowseTab) => void
  onSelectVendor?: (vendor: CategoryBrowseVendor) => void
  onScrollDirectionChange?: (direction: 'down' | 'up') => void
  onClearFavoritesFilter?: () => void
  onRefreshReviewedServices?: () => void
  onRetryCatalog?: () => void
  onToggleFavorite?: (serviceId: string) => void
  onSelectReviewedService?: (serviceId: string) => void
}

const sortOptions: ReadonlyArray<{ id: CategoryBrowseSort; label: string }> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'bookings', label: 'Most Booked' },
  { id: 'priceLow', label: 'Price: Low to High' },
  { id: 'priceHigh', label: 'Price: High to Low' },
]

const HIGH_RATING_THRESHOLD = 4
const completionConfettiPieces = [
  { color: '#6B1E2E', drift: -54, left: 8, rotate: -110 },
  { color: '#D99A44', drift: 42, left: 18, rotate: 96 },
  { color: '#287A49', drift: -30, left: 29, rotate: -84 },
  { color: '#EE8594', drift: 56, left: 39, rotate: 126 },
  { color: '#6B1E2E', drift: -46, left: 49, rotate: -132 },
  { color: '#D99A44', drift: 32, left: 58, rotate: 78 },
  { color: '#287A49', drift: -56, left: 67, rotate: -118 },
  { color: '#EE8594', drift: 44, left: 78, rotate: 102 },
  { color: '#6B1E2E', drift: -28, left: 88, rotate: -90 },
] as const

export const categoryBrowseNavigationTabs = [
  { id: 'explore' as const, icon: '◎', label: 'Explore' },
  { id: 'vendors' as const, icon: 'S', label: 'Service Providers' },
  { id: 'budget' as const, icon: '₱', label: 'Budget' },
  { id: 'profile' as const, icon: '○', label: 'Profile' },
] as const

const formatCurrency = formatPeso

// Database category options retain their UUID for provider-management work,
// while marketplace services use the canonical client category IDs. Always
// derive the latter from the option name when comparing tags to services.
const marketplaceCategoryId = (option: ServiceCategoryOption) =>
  option.id === 'all' ? 'all' : categoryNameToId(option.name)

const SelectionCompletionConfetti: React.FC<{ visible: boolean }> = ({ visible }) => {
  const progress = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (!visible) {
      progress.stopAnimation()
      progress.setValue(0)
      return undefined
    }

    progress.setValue(0)
    const animation = Animated.timing(progress, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [progress, visible])

  if (!visible) return null

  return (
    <View pointerEvents="none" style={styles.completionConfetti}>
      {completionConfettiPieces.map((piece, index) => {
        const delay = index / completionConfettiPieces.length
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-32 - (index % 3) * 12, 118 + (index % 2) * 22],
        })
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, piece.drift],
        })
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${piece.rotate}deg`],
        })
        const opacity = progress.interpolate({
          inputRange: [0, Math.min(0.2 + delay, 0.8), 1],
          outputRange: [0, 1, 0],
        })

        return (
          <Animated.View
            key={`${piece.left}-${piece.color}`}
            style={[
              styles.completionConfettiPiece,
              {
                backgroundColor: piece.color,
                left: `${piece.left}%`,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

const ServiceSectionList: React.FC<React.PropsWithChildren<{ horizontal: boolean }>> = ({
  children,
  horizontal,
}) => horizontal ? (
  <ScrollView
    contentContainerStyle={styles.horizontalServiceContent}
    horizontal
    nestedScrollEnabled
    showsHorizontalScrollIndicator={false}
    style={styles.horizontalServiceScroller}
  >
    {children}
  </ScrollView>
) : (
  <View style={styles.verticalServiceList}>{children}</View>
)

export const CategoryBrowseScreen: React.FC<CategoryBrowseScreenProps> = ({
  catalogLoadStatus,
  blurTarget,
  categoryCountServices,
  categoryBudgets = {},
  categoryName = 'Services',
  categories = [],
  favoritePendingServiceIds = new Set(),
  favoriteServiceIds = new Set(),
  showFavoritesOnly = false,
  addableCategories = [],
  eventGuestCount = 0,
  mode = 'planning',
  services = [],
  selectedServiceCount = 0,
  selectedServices = [],
  assignedCoordinator,
  coordinatorAssignmentStatus,
  coordinatorPackage,
  budget = 0,
  categoryBudget = 0,
  cateringIncludedInVenuePackage = false,
  venueCateringPackage,
  totalEstimatedCost = 0,
  removingServiceId = '',
  planningSelectionsComplete = false,
  showSelectionCompletionModal = false,
  changeServiceContext,
  replacementContext,
  showBottomNavigation = true,
  reviewedServices = [],
  reviewedServicesLoading = false,
  searchValue,
  sortLabel = 'Recommended',
  onBack,
  onBrandPress,
  onChangeSearch,
  onChangeService,
  onContinueSelectedServices,
  onAddCategory,
  onRemoveCategory,
  onAddService,
  onRemoveCoordinator,
  onRemoveService,
  onSelectionCompletionDismissed,
  onSelectService,
  onOpenSort,
  onConfirmReplacement,
  onSelectCategory,
  onReviewVenuePackage,
  onSelectTab,
  onSelectVendor,
  onScrollDirectionChange,
  onClearFavoritesFilter,
  onRefreshReviewedServices,
  onRetryCatalog,
  onSelectReviewedService,
  onToggleFavorite,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isExploreMode = mode === 'explore'
  const isChangingService = Boolean(changeServiceContext)
  const isPlanningCategoryBrowse = !isExploreMode && !isChangingService && !replacementContext
  const usesCompactPlanningCards = !isExploreMode && !isChangingService && !replacementContext
  // Provider replacements compare against the current booking, not the old
  // planning allocation. Keep the normal allocation behavior everywhere else.
  const hasPlanSelections = selectedServiceCount > 0
    || Boolean(assignedCoordinator)
    || coordinatorAssignmentStatus === 'awaiting_assignment'
  const hasReviewableSelections = selectedServiceCount > 0 || Boolean(assignedCoordinator)
  const selectedPlanItemCount = selectedServiceCount + (assignedCoordinator ? 1 : 0)
  const [internalSearch, setInternalSearch] = React.useState('')
  const [sortMode, setSortMode] = React.useState<CategoryBrowseSort>('recommended')
  const [isSortOpen, setIsSortOpen] = React.useState(false)
  const [selectedExploreCategory, setSelectedExploreCategory] = React.useState('All')
  const [activeExploreTab, setActiveExploreTab] = React.useState<'explore' | 'reviewed'>('explore')
  const [cateringWarningAction, setCateringWarningAction] = React.useState<(() => void)>()
  const cateringWarningShownForCategoryRef = React.useRef(false)
  const lastScrollY = React.useRef(0)
  const categoryTagScrollerRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null)
  const categoryTagOffsetsRef = React.useRef(new Map<string, number>())
  const [isSelectedServicesOpen, setIsSelectedServicesOpen] = React.useState(false)
  const [isCategorySelectionOpen, setIsCategorySelectionOpen] = React.useState(false)
  const [isCategorySelectionClosing, setIsCategorySelectionClosing] = React.useState(false)
  const [isUpdatingCategory, setIsUpdatingCategory] = React.useState(false)
  const isUpdatingCategoryRef = React.useRef(false)
  const [optimisticCategoryMembership, setOptimisticCategoryMembership] = React.useState<Record<string, boolean>>({})
  const [categoryDisplayOrder, setCategoryDisplayOrder] = React.useState<string[]>([])
  const [movingCategoryId, setMovingCategoryId] = React.useState('')
  const categorySelectionScale = React.useRef(new Animated.Value(0.82)).current
  const categorySelectionBlurTargetRef = React.useRef<React.ComponentRef<typeof BlurTargetView>>(null)
  const categoryCardPositionsRef = React.useRef(new Map<string, number>())
  const categoryCardTranslationsRef = React.useRef(new Map<string, Animated.Value>())
  const categoryTransferDirectionsRef = React.useRef(new Map<string, 'add' | 'remove'>())
  const categoryCardAnimationTokensRef = React.useRef(new Map<string, number>())
  const categoryCardAnimationSequenceRef = React.useRef(0)
  const selectedServicesSheetOffset = React.useRef(new Animated.Value(480)).current
  const query = searchValue ?? internalSearch
  const catalogUnavailable = catalogLoadStatus?.source === 'empty'
    && catalogLoadStatus.serviceCount === 0
    && Boolean(catalogLoadStatus.errorMessage)
  const catalogShowingFallback = catalogLoadStatus?.source === 'cache'
    && Boolean(catalogLoadStatus.errorMessage)
  const servicesForCategoryCounts = categoryCountServices ?? services
  const exploreCategories = React.useMemo(
    () => [
      { id: 'all', name: 'All' },
      ...Array.from(new Map(servicesForCategoryCounts.map((service) => [
        service.categoryId,
        { id: service.categoryId, name: service.categoryName },
      ])).values()),
    ],
    [servicesForCategoryCounts]
  )
  const activeSelectedCategoryIds = React.useMemo(() => {
    const categoryIds = new Set<CatalogCategoryId>()
    selectedServices.forEach((service) => {
      const status = service.status.trim().toLowerCase()
      if (!['cancelled', 'deleted', 'rejected', 'removed'].includes(status)) {
        categoryIds.add(categoryNameToId(service.category))
      }
    })
    if (assignedCoordinator) categoryIds.add('eventOrganizers')
    return categoryIds
  }, [assignedCoordinator, selectedServices])
  const activeSelectedServiceIds = React.useMemo(() => {
    const serviceIds = new Set<string>()

    selectedServices.forEach((service) => {
      const status = service.status.trim().toLowerCase()
      if (!['cancelled', 'deleted', 'rejected', 'removed'].includes(status)) {
        serviceIds.add(service.id)
      }
    })

    return serviceIds
  }, [selectedServices])
  const isServiceAlreadySelected = React.useCallback((service: CatalogService) => (
    isPlanningCategoryBrowse
    && (
      activeSelectedServiceIds.has(service.id)
      || Boolean(
        service.bookingServiceId
        && activeSelectedServiceIds.has(service.bookingServiceId)
      )
    )
  ), [activeSelectedServiceIds, isPlanningCategoryBrowse])
  const currentCategoryCompleted = activeSelectedCategoryIds.has(
    categoryNameToId(categoryName) as CatalogCategoryId
  )
  const categorySelectionOptions = React.useMemo(() => {
    const plannedCategoryIds = new Set(
      categories.map((category) => marketplaceCategoryId(category))
    )
    const allCategories = Array.from(new Map(
      [...categories, ...addableCategories]
        .filter((category) => category.id !== 'all')
        .map((category) => [marketplaceCategoryId(category), category])
    ).values())
    const displayOrder = new Map(categoryDisplayOrder.map((categoryId, index) => [categoryId, index]))
    const orderedCategories = categoryDisplayOrder.length > 0
      ? [...allCategories].sort((left, right) => {
        const leftOrder = displayOrder.get(marketplaceCategoryId(left)) ?? Number.MAX_SAFE_INTEGER
        const rightOrder = displayOrder.get(marketplaceCategoryId(right)) ?? Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder
      })
      : allCategories
    const isInPlan = (category: ServiceCategoryOption) => {
      const categoryId = marketplaceCategoryId(category)
      return optimisticCategoryMembership[categoryId] ?? plannedCategoryIds.has(categoryId)
    }
    const completed = orderedCategories
      .filter((category) => isInPlan(category) && activeSelectedCategoryIds.has(
        marketplaceCategoryId(category) as CatalogCategoryId
      ))
      .map((category) => ({ category, isInPlan: true, section: 'completed' as const }))
    const added = orderedCategories
      .filter((category) => isInPlan(category) && !activeSelectedCategoryIds.has(
        marketplaceCategoryId(category) as CatalogCategoryId
      ))
      .map((category) => ({ category, isInPlan: true, section: 'added' as const }))
    const unadded = orderedCategories
      .filter((category) => !isInPlan(category))
      .map((category) => ({ category, isInPlan: false, section: 'unadded' as const }))

    return [...completed, ...added, ...unadded]
  }, [
    activeSelectedCategoryIds,
    addableCategories,
    categories,
    categoryDisplayOrder,
    optimisticCategoryMembership,
  ])
  const getCategoryCardTranslation = React.useCallback((categoryId: string) => {
    const existing = categoryCardTranslationsRef.current.get(categoryId)
    if (existing) return existing

    const value = new Animated.Value(0)
    categoryCardTranslationsRef.current.set(categoryId, value)
    return value
  }, [])
  const startCategoryCardAnimation = React.useCallback((
    categoryId: string,
    transferDirection?: 'add' | 'remove'
  ) => {
    const translation = getCategoryCardTranslation(categoryId)
    translation.stopAnimation()
    const animationToken = categoryCardAnimationSequenceRef.current + 1
    categoryCardAnimationSequenceRef.current = animationToken
    categoryCardAnimationTokensRef.current.set(categoryId, animationToken)

    requestAnimationFrame(() => {
      if (categoryCardAnimationTokensRef.current.get(categoryId) !== animationToken) return

      Animated.timing(translation, {
        duration: 560,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (categoryCardAnimationTokensRef.current.get(categoryId) !== animationToken) return

        categoryCardAnimationTokensRef.current.delete(categoryId)
        if (!finished || !transferDirection) return

        categoryTransferDirectionsRef.current.delete(categoryId)
        setMovingCategoryId((current) => current === categoryId ? '' : current)
      })
    })
  }, [getCategoryCardTranslation])
  const handleCategoryCardLayout = React.useCallback((
    categoryId: string,
    event: LayoutChangeEvent
  ) => {
    const nextY = event.nativeEvent.layout.y
    const previousY = categoryCardPositionsRef.current.get(categoryId)
    categoryCardPositionsRef.current.set(categoryId, nextY)
    const transferDirection = categoryTransferDirectionsRef.current.get(categoryId)
    if (!transferDirection || categoryCardAnimationTokensRef.current.has(categoryId)) return

    if (previousY === undefined || Math.abs(previousY - nextY) < 1) {
      if (transferDirection === 'add') {
        startCategoryCardAnimation(categoryId, transferDirection)
      }
      return
    }

    const translation = getCategoryCardTranslation(categoryId)
    translation.stopAnimation()
    translation.setValue(previousY - nextY)
    startCategoryCardAnimation(categoryId, transferDirection)
  }, [getCategoryCardTranslation, startCategoryCardAnimation])
  React.useEffect(() => () => {
    categoryCardTranslationsRef.current.forEach((translation) => {
      translation.stopAnimation()
    })
    categoryTransferDirectionsRef.current.clear()
    categoryCardAnimationTokensRef.current.clear()
  }, [])
  const clearOptimisticCategoryMembership = React.useCallback((categoryId: string) => {
    setOptimisticCategoryMembership((current) => {
      const next = { ...current }
      delete next[categoryId]
      return next
    })
  }, [])
  const updateCategoryPlan = React.useCallback(async (
    category: ServiceCategoryOption,
    action: 'add' | 'remove'
  ) => {
    if (isUpdatingCategoryRef.current) return

    const update = action === 'add' ? onAddCategory : onRemoveCategory
    if (!update) return

    isUpdatingCategoryRef.current = true

    const categoryId = marketplaceCategoryId(category)
    const sourceY = categoryCardPositionsRef.current.get(categoryId)
    const destinationAnchor = action === 'add'
      ? categorySelectionOptions.find((option) => !option.isInPlan)
      : undefined
    const destinationY = destinationAnchor
      ? categoryCardPositionsRef.current.get(marketplaceCategoryId(destinationAnchor.category))
      : undefined

    // Seed the active card at its current visual position before membership
    // changes. Its next layout can then glide from source to destination
    // without briefly painting at the destination first.
    if (sourceY !== undefined && destinationY !== undefined) {
      const translation = getCategoryCardTranslation(categoryId)
      translation.stopAnimation()
      const initialOffset = sourceY - destinationY
      translation.setValue(action === 'add' && Math.abs(initialOffset) < 1 ? 18 : initialOffset)
    }

    categoryTransferDirectionsRef.current.set(categoryId, action)
    setMovingCategoryId(categoryId)
    setCategoryDisplayOrder((current) => {
      const order = current.length > 0
        ? current
        : categorySelectionOptions.map((option) => marketplaceCategoryId(option.category))
      return [...order.filter((id) => id !== categoryId), categoryId]
    })
    setOptimisticCategoryMembership((current) => ({
      ...current,
      [categoryId]: action === 'add',
    }))
    setIsUpdatingCategory(true)
    try {
      const updated = await update(category)
      if (updated === false) {
        getCategoryCardTranslation(categoryId).stopAnimation()
        categoryCardAnimationTokensRef.current.delete(categoryId)
        categoryTransferDirectionsRef.current.set(categoryId, action === 'add' ? 'remove' : 'add')
        setMovingCategoryId(categoryId)
        clearOptimisticCategoryMembership(categoryId)
      }
    } catch {
      getCategoryCardTranslation(categoryId).stopAnimation()
      categoryCardAnimationTokensRef.current.delete(categoryId)
      categoryTransferDirectionsRef.current.set(categoryId, action === 'add' ? 'remove' : 'add')
      setMovingCategoryId(categoryId)
      clearOptimisticCategoryMembership(categoryId)
    } finally {
      isUpdatingCategoryRef.current = false
      setIsUpdatingCategory(false)
    }
  }, [
    categorySelectionOptions,
    clearOptimisticCategoryMembership,
    getCategoryCardTranslation,
    onAddCategory,
    onRemoveCategory,
  ])
  React.useEffect(() => {
    if (!isCategorySelectionOpen) return undefined

    setIsCategorySelectionClosing(false)
    categorySelectionScale.setValue(0.82)
    const animation = Animated.sequence([
      Animated.timing(categorySelectionScale, {
        toValue: 1.045,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(categorySelectionScale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }),
    ])

    animation.start()
    return () => animation.stop()
  }, [categorySelectionScale, isCategorySelectionOpen])
  const dismissCategorySelection = React.useCallback((afterClose?: () => void) => {
    if (isCategorySelectionClosing || isUpdatingCategory) return

    setIsCategorySelectionClosing(true)
    categorySelectionScale.stopAnimation()
    Animated.sequence([
      Animated.timing(categorySelectionScale, {
        toValue: 1.035,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(categorySelectionScale, {
        toValue: 0.82,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return
      setIsCategorySelectionOpen(false)
      setIsCategorySelectionClosing(false)
      afterClose?.()
    })
  }, [categorySelectionScale, isCategorySelectionClosing, isUpdatingCategory])
  const requestCateringBrowse = React.useCallback((isCatering: boolean, action: () => void) => {
    if (!isCatering || !cateringIncludedInVenuePackage) {
      action()
      return
    }
    cateringWarningShownForCategoryRef.current = true
    setCateringWarningAction(() => action)
  }, [cateringIncludedInVenuePackage])
  const scrollCategoryTagToStart = React.useCallback((categoryId: string) => {
    const offset = categoryTagOffsetsRef.current.get(categoryId)
    if (offset === undefined) return

    requestAnimationFrame(() => {
      categoryTagScrollerRef.current?.scrollTo({ animated: true, x: Math.max(0, offset) })
    })
  }, [])
  React.useEffect(() => {
    if (!isExploreMode) setActiveExploreTab('explore')
  }, [isExploreMode])
  React.useEffect(() => {
    const isCateringCategory = categoryNameToId(categoryName) === 'catering'
    // Explore opens on "All Services" while App retains the last planning
    // category. Only a direct entry into the planning Catering category should
    // open the notice automatically; Explore still warns on an actual catering
    // category or provider tap through requestCateringBrowse.
    if (isExploreMode || !cateringIncludedInVenuePackage || !isCateringCategory) {
      cateringWarningShownForCategoryRef.current = false
      return
    }
    if (cateringWarningShownForCategoryRef.current) return

    cateringWarningShownForCategoryRef.current = true
    setCateringWarningAction(() => () => undefined)
  }, [cateringIncludedInVenuePackage, categoryName, isExploreMode])

  const cateringFit = React.useCallback((vendor: CatalogService) => {
    if (vendor.categoryId !== 'catering') return { fits: true, reason: '' }
    const options = getCateringPricingOptions(vendor.categoryDetails, vendor.providerMinPrice)
    if (options.length === 0) return { fits: false, reason: 'Provider pricing options required' }
    const calculations = options.map((option) => calculateCateringPrice(option, eventGuestCount))
    const match = calculations.find((calculation) => calculation.fitsGuestCount)
    return match
      ? { fits: true, reason: `${eventGuestCount} guests supported` }
      : { fits: false, reason: calculations[0]?.reason ?? 'Guest count not supported' }
  }, [eventGuestCount])

  const categoryBudgetForVendor = React.useCallback((vendor: CatalogService) => {
    if (Object.prototype.hasOwnProperty.call(categoryBudgets, vendor.categoryId)) {
      return Math.max(0, Number(categoryBudgets[vendor.categoryId]) || 0)
    }

    return vendor.categoryId === categoryNameToId(categoryName)
      ? Math.max(0, Number(categoryBudget) || 0)
      : 0
  }, [categoryBudget, categoryBudgets, categoryName])

  const fallbackBudgetEstimate = React.useCallback((vendor: CatalogService) => {
    if (vendor.categoryId === 'catering' && eventGuestCount > 0) {
      const options = getCateringPricingOptions(vendor.categoryDetails, vendor.providerMinPrice)
      const calculations = options.map((option) => calculateCateringPrice(option, eventGuestCount))
      const calculation = calculations.find((candidate) => candidate.fitsGuestCount)
        ?? calculations.find((candidate) => candidate.providerSubtotal > 0)

      if (calculation?.providerSubtotal) {
        return customerPriceFromProviderPrice(calculation.providerSubtotal, vendor.commissionRate)
      }
    }

    const startingPrice = marketplaceStartingPrice(vendor)
    if (vendor.pricingUnit === 'person' && eventGuestCount > 0) {
      return Math.round(startingPrice * eventGuestCount * 100) / 100
    }
    return startingPrice
  }, [eventGuestCount])

  const budgetEstimateForVendor = React.useCallback((vendor: CatalogService) => {
    const authoritativeEstimate = Number(vendor.budgetRecommendation?.calculatedAmount)
    return Number.isFinite(authoritativeEstimate) && authoritativeEstimate > 0
      ? authoritativeEstimate
      : fallbackBudgetEstimate(vendor)
  }, [fallbackBudgetEstimate])

  const isVendorWithinBudget = React.useCallback((vendor: CatalogService) => {
    const allocatedBudget = categoryBudgetForVendor(vendor)
    if (allocatedBudget <= 0) return false

    const estimatedPrice = budgetEstimateForVendor(vendor)
    if (estimatedPrice > 0) return estimatedPrice <= allocatedBudget

    const recommendation = vendor.budgetRecommendation
    return Boolean(
      recommendation
      && recommendation.categoryBudget === allocatedBudget
      && recommendation.isWithinBudget
    )
  }, [budgetEstimateForVendor, categoryBudgetForVendor])

  const recommendationRank = React.useCallback((vendor: CatalogService) => {
    const recommendation = vendor.budgetRecommendation
    if (!recommendation || recommendation.categoryBudget <= 0) return 1
    if (recommendation.isRecommended) return 4
    if (recommendation.isWithinBudget) return 3
    if (recommendation.calculatedAmount) return 0
    return 2
  }, [])

  const isPersonalizedRecommendation = React.useCallback((vendor: CatalogService) => {
    const rating = Number.parseFloat(vendor.rating) || 0
    return Boolean(
      vendor.budgetRecommendation?.isRecommended
      && vendor.reviewCount > 0
      && rating >= HIGH_RATING_THRESHOLD
    )
  }, [])

  const isScheduleUnavailable = React.useCallback((vendor: CatalogService) => (
    vendor.budgetRecommendation?.availabilityStatus === 'unavailable'
  ), [])

  const matchesMarketplaceFilters = (vendor: CatalogService, ignoreExploreCategory = false) => {
    const normalizedQuery = query.trim().toLowerCase()

    if (
      isExploreMode
      && showFavoritesOnly
      && (vendor.kind === 'coordinator' || !favoriteServiceIds.has(vendor.id))
    ) {
      return false
    }

    if (
      isExploreMode
      && !ignoreExploreCategory
      &&
      selectedExploreCategory !== 'All' &&
      vendor.categoryName !== selectedExploreCategory
    ) {
      return false
    }

    if (!normalizedQuery) return true

    return (
      vendor.name.toLowerCase().includes(normalizedQuery) ||
      vendor.providerName.toLowerCase().includes(normalizedQuery) ||
      vendor.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    )
  }

  const categoryOptionsForCounts = isExploreMode ? exploreCategories : categories
  const marketplaceCategoryCounts = new Map(categoryOptionsForCounts.map((option) => {
    const categoryId = marketplaceCategoryId(option)
    return [
      categoryId,
      servicesForCategoryCounts.filter((vendor) => (
        (categoryId === 'all' || vendor.categoryId === categoryId)
        && matchesMarketplaceFilters(vendor, true)
        && !isServiceAlreadySelected(vendor)
      )).length,
    ]
  }))

  const visibleVendors = services.filter((vendor) => (
    matchesMarketplaceFilters(vendor)
    && !isServiceAlreadySelected(vendor)
  )).sort((left, right) => {
    const leftRating = Number.parseFloat(left.rating) || 0
    const rightRating = Number.parseFloat(right.rating) || 0
    const leftBookings = left.bookingCount ?? 0
    const rightBookings = right.bookingCount ?? 0

    // A declined-provider replacement must not inherit the original event
    // budget ranking. The client needs every viable alternative to compare,
    // ordered by the marketplace price, with unavailable dates kept last.
    if (replacementContext) {
      const availabilityDifference = Number(isScheduleUnavailable(left))
        - Number(isScheduleUnavailable(right))
      if (availabilityDifference !== 0) return availabilityDifference
      return marketplaceStartingPrice(left) - marketplaceStartingPrice(right)
        || rightRating - leftRating
        || right.reviewCount - left.reviewCount
        || left.name.localeCompare(right.name)
    }

    if (!isExploreMode && sortMode === 'recommended') {
      const recommendationDifference = recommendationRank(right) - recommendationRank(left)
      if (recommendationDifference !== 0) return recommendationDifference

      const personalizedDifference = Number(isPersonalizedRecommendation(right))
        - Number(isPersonalizedRecommendation(left))
      if (personalizedDifference !== 0) return personalizedDifference

      const leftAvailability = left.budgetRecommendation?.availabilityStatus === 'unavailable' ? 0 : 1
      const rightAvailability = right.budgetRecommendation?.availabilityStatus === 'unavailable' ? 0 : 1
      if (leftAvailability !== rightAvailability) return rightAvailability - leftAvailability

      const guestFitDifference = Number(cateringFit(right).fits) - Number(cateringFit(left).fits)
      if (guestFitDifference !== 0) return guestFitDifference
    }

    if (isExploreMode) {
      const guestFitDifference = Number(cateringFit(right).fits) - Number(cateringFit(left).fits)
      if (guestFitDifference !== 0) return guestFitDifference
    }
    if (!isExploreMode && sortMode === 'bookings') {
      return rightBookings - leftBookings
        || rightRating - leftRating
        || right.reviewCount - left.reviewCount
        || left.name.localeCompare(right.name)
    }
    if (!isExploreMode && sortMode === 'priceLow') {
      return marketplaceStartingPrice(left) - marketplaceStartingPrice(right) || rightRating - leftRating
    }
    if (!isExploreMode && sortMode === 'priceHigh') {
      return marketplaceStartingPrice(right) - marketplaceStartingPrice(left) || rightRating - leftRating
    }
    return rightRating - leftRating
      || right.reviewCount - left.reviewCount
      || rightBookings - leftBookings
      || left.name.localeCompare(right.name)
  })
  const hasStepTwoCategoryBudget = isPlanningCategoryBrowse
    && visibleVendors.some((vendor) => categoryBudgetForVendor(vendor) > 0)
  const vendorSections = isPlanningCategoryBrowse
    ? hasStepTwoCategoryBudget
      ? [
        {
          horizontal: true,
          id: 'within-budget',
          label: 'Services That Fits Your Budget',
          vendors: visibleVendors.filter(isVendorWithinBudget),
        },
        {
          horizontal: true,
          id: 'outside-budget',
          label: 'You Might Also Like',
          vendors: visibleVendors.filter((vendor) => !isVendorWithinBudget(vendor)),
        },
      ].filter((section) => section.vendors.length > 0)
      : [{ horizontal: true, id: 'perfect-for-wedding', label: 'Perfect For Your Wedding', vendors: visibleVendors }]
    : [{ horizontal: false, id: 'all', label: '', vendors: visibleVendors }]

  const handleSearchChange = (value: string) => {
    setInternalSearch(value)
    onChangeSearch?.(value)
  }

  const activeSortLabel = sortOptions.find((option) => option.id === sortMode)?.label ?? sortLabel

  React.useEffect(() => {
    if (!isSelectedServicesOpen) return

    selectedServicesSheetOffset.setValue(480)
    Animated.timing(selectedServicesSheetOffset, {
      duration: 320,
      toValue: 0,
      useNativeDriver: true,
    }).start()
  }, [isSelectedServicesOpen, selectedServicesSheetOffset])

  React.useEffect(() => {
    if (!isExploreMode) return

    selectedServicesSheetOffset.setValue(480)
    setIsSelectedServicesOpen(false)
  }, [isExploreMode, selectedServicesSheetOffset])

  React.useEffect(() => {
    if (
      selectedServices.length === 0
      && !assignedCoordinator
      && coordinatorAssignmentStatus !== 'awaiting_assignment'
    ) {
      setIsSelectedServicesOpen(false)
    }
  }, [assignedCoordinator, coordinatorAssignmentStatus, selectedServices.length])

  const wasChangingServiceRef = React.useRef(isChangingService)
  React.useEffect(() => {
    if (wasChangingServiceRef.current && !isChangingService) {
      setIsSelectedServicesOpen(true)
    }
    wasChangingServiceRef.current = isChangingService
  }, [isChangingService])

  const closeSelectedServices = () => {
    Animated.timing(selectedServicesSheetOffset, {
      duration: 260,
      toValue: 480,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsSelectedServicesOpen(false)
    })
  }

  const revealSelectedServicesAfterCompletion = () => {
    onSelectionCompletionDismissed?.()
    setIsSelectedServicesOpen(true)
  }
  const selectionCompletionVisible = !isExploreMode
    && !replacementContext
    && !isChangingService
    && showSelectionCompletionModal

  return (
    <BlurTargetView
      ref={blurTarget ?? categorySelectionBlurTargetRef}
      style={[styles.screen, !isExploreMode && styles.planningScreen]}
    >
      {isExploreMode ? (
        <View style={styles.topAppBar}>
          <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
            <Pressable
              accessibilityLabel="Back to home"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            >
              <Text style={styles.backIcon}>{'\u2039'}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>EXPLORE SERVICES</Text>
            <View style={styles.headerButton} />
          </View>
        </View>
      ) : isChangingService ? (
        <View style={styles.topAppBar}>
          <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
            <Pressable
              accessibilityLabel="Cancel changing this service"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [
                styles.headerButton,
                styles.headerButtonNeumorphic,
                pressed && styles.headerButtonNeumorphicPressed,
              ]}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="chevron-left" size={28} />
            </Pressable>
            <Text style={styles.headerTitle}>CHANGE SERVICE</Text>
            <View style={styles.headerButton} />
          </View>
        </View>
      ) : replacementContext ? (
        <View style={styles.topAppBar}>
          <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
            <Pressable
              accessibilityLabel="Back to booking details"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            >
              <Text style={styles.backIcon}>{'‹'}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>CHANGE PROVIDER</Text>
            <View style={styles.headerButton} />
          </View>
        </View>
      ) : (
        <PlanningScreenHeader
          brandTitle
          currentStep={3}
          label="Choose Services"
          neumorphicNavigation
          nextAccessibilityLabel="Review selected services"
          nextEnabled={hasReviewableSelections}
          onBack={onBack}
          onBrandPress={onBrandPress}
          onNext={() => setIsSelectedServicesOpen(true)}
          title="Choose Services"
        />
      )}

      {isExploreMode ? (
        <View style={[styles.exploreTabs, isWide && styles.exploreTabsWide]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeExploreTab === 'explore' }}
            onPress={() => setActiveExploreTab('explore')}
            style={[styles.exploreTab, activeExploreTab === 'explore' && styles.exploreTabActive]}
          >
            <Text style={[styles.exploreTabText, activeExploreTab === 'explore' && styles.exploreTabTextActive]}>Explore</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeExploreTab === 'reviewed' }}
            onPress={() => {
              setActiveExploreTab('reviewed')
              onRefreshReviewedServices?.()
            }}
            style={[styles.exploreTab, activeExploreTab === 'reviewed' && styles.exploreTabActive]}
          >
            <Text style={[styles.exploreTabText, activeExploreTab === 'reviewed' && styles.exploreTabTextActive]}>Reviewed</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          showBottomNavigation && !isWide && styles.contentWithBottomNavigation,
          !isExploreMode &&
          !replacementContext &&
            !isChangingService &&
            hasPlanSelections &&
            styles.contentWithSelectedServicesAction,
          isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const scrollY = Math.max(0, event.nativeEvent.contentOffset.y)
          const delta = scrollY - lastScrollY.current
          if (Math.abs(delta) < 8) return
          lastScrollY.current = scrollY
          onScrollDirectionChange?.(delta > 0 ? 'down' : 'up')
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {replacementContext ? (
          <View style={styles.replacementBanner}>
            <Text style={styles.replacementEyebrow}>REPLACING PROVIDER</Text>
            <Text style={styles.replacementTitle}>{replacementContext.serviceName}</Text>
            <Text style={styles.replacementCopy}>
              Current provider: {replacementContext.currentProviderName} ({formatCurrency(replacementContext.baselineAmount)}).
              {' '}Every published alternative is shown without budget filtering; services available on your date appear first and are ordered by price.
            </Text>
          </View>
        ) : changeServiceContext ? (
          <View style={[styles.replacementBanner, styles.changeServiceBanner]}>
            <Text style={styles.replacementEyebrow}>CHANGING SELECTED SERVICE</Text>
            <Text style={styles.replacementTitle}>{changeServiceContext.serviceName}</Text>
            <Text style={styles.replacementCopy}>
              Your current selection of {formatCurrency(changeServiceContext.currentAmount)} stays in place while you compare alternatives.
            </Text>
          </View>
        ) : null}

        {!isExploreMode && !replacementContext && !isChangingService ? (
          <View style={styles.categorySelectionSection}>
            <View style={styles.categorySelectionHeading}>
              <Text style={styles.categorySelectionEyebrow}>SERVICE CATEGORY</Text>
              <Text style={styles.categorySelectionCount}>
                {categories.length} {categories.length === 1 ? 'category' : 'categories'} in your plan
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Change service category. Currently ${categoryName}`}
              accessibilityRole="button"
              onPress={() => {
                setCategoryDisplayOrder(categorySelectionOptions.map(
                  (option) => marketplaceCategoryId(option.category)
                ))
                categoryCardPositionsRef.current.clear()
                categoryTransferDirectionsRef.current.clear()
                setMovingCategoryId('')
                setOptimisticCategoryMembership({})
                setIsCategorySelectionOpen(true)
              }}
              style={({ pressed }) => [
                styles.categorySelectionCard,
                currentCategoryCompleted && styles.categorySelectionCardCompleted,
                pressed && styles.neumorphicPressed,
              ]}
            >
              <View style={[
                styles.categorySelectionIcon,
                currentCategoryCompleted && styles.categorySelectionIconCompleted,
              ]}>
                <MaterialIcons
                  color={currentCategoryCompleted ? '#1F6B42' : palette.primaryContainer}
                  name={currentCategoryCompleted ? 'check' : 'category'}
                  size={21}
                />
              </View>
              <View style={styles.categorySelectionCopy}>
                <Text style={[
                  styles.categorySelectionTitle,
                  currentCategoryCompleted && styles.categorySelectionTitleCompleted,
                ]}>{categoryName}</Text>
                <Text style={[
                  styles.categorySelectionHint,
                  currentCategoryCompleted && styles.categorySelectionHintCompleted,
                ]}>Tap to browse or add another category</Text>
              </View>
              <View style={[
                styles.categorySelectionAction,
                currentCategoryCompleted && styles.categorySelectionActionCompleted,
              ]}>
                <Text style={[
                  styles.categorySelectionActionText,
                  currentCategoryCompleted && styles.categorySelectionActionTextCompleted,
                ]}>CHANGE</Text>
                <MaterialIcons color={currentCategoryCompleted ? '#1F6B42' : palette.primaryContainer} name="chevron-right" size={19} />
              </View>
            </Pressable>
          </View>
        ) : null}

        {!isExploreMode && !replacementContext && !isChangingService && planningSelectionsComplete ? (
          <View style={styles.planningCompleteCard}>
            <Text style={styles.planningCompleteTitle}>Allocated categories complete</Text>
            <Text style={styles.planningCompleteText}>
              You can revisit any category, adjust an unlocked budget, or review your selected services.
            </Text>
          </View>
        ) : null}

        {isExploreMode ? <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>
            {activeExploreTab === 'reviewed'
              ? 'Reviewed Services'
              : showFavoritesOnly ? 'Saved Services' : 'All Services'}
          </Text>
          {activeExploreTab === 'explore' && showFavoritesOnly ? (
            <Pressable
              accessibilityLabel="Show all services"
              accessibilityRole="button"
              onPress={onClearFavoritesFilter}
              style={({ pressed }) => [styles.clearFavoritesFilter, pressed && styles.chipPressed]}
            >
              <Text style={styles.clearFavoritesFilterText}>Show all</Text>
            </Pressable>
          ) : null}
        </View> : null}

        {isExploreMode && activeExploreTab === 'explore' ? (
          <ScrollView
            contentContainerStyle={styles.exploreCategoryContent}
            horizontal
            ref={categoryTagScrollerRef}
            showsHorizontalScrollIndicator={false}
            style={styles.exploreCategoryScroller}
          >
            {exploreCategories.map((option) => {
              const isSelected = selectedExploreCategory === option.name
              const categoryId = marketplaceCategoryId(option)
              const isCompleted = categoryId !== 'all'
                && activeSelectedCategoryIds.has(categoryId as CatalogCategoryId)
              const isIncludedInVenuePackage = categoryId === 'catering' && cateringIncludedInVenuePackage
              const serviceCount = marketplaceCategoryCounts.get(categoryId) ?? 0

              return (
                <Pressable
                  key={option.id}
                  accessibilityLabel={isCompleted
                    ? `Show ${option.name} services. A service is selected for this category.`
                    : isIncludedInVenuePackage
                      ? `Show ${option.name} services. Included in Venue Package; no standalone caterer is selected.`
                    : `Show ${option.name} services. ${serviceCount} eligible services.`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onLayout={(event) => categoryTagOffsetsRef.current.set(option.id, event.nativeEvent.layout.x)}
                  onPress={() => requestCateringBrowse(categoryId === 'catering', () => {
                    setSelectedExploreCategory(option.name)
                    scrollCategoryTagToStart(option.id)
                  })}
                  style={({ pressed }) => [
                    styles.categoryTag,
                    isSelected && styles.categoryTagSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <View style={[styles.categoryTagIndicator, isSelected && styles.categoryTagIndicatorSelected]}>
                    {isCompleted ? (
                      <MaterialCommunityIcons
                        color={isSelected ? palette.onPrimary : palette.primaryContainer}
                        name="check"
                        size={15}
                      />
                    ) : isIncludedInVenuePackage ? (
                      <MaterialCommunityIcons
                        color={isSelected ? palette.onPrimary : palette.primaryContainer}
                        name="package-variant-closed"
                        size={14}
                      />
                    ) : (
                      <Text style={[styles.categoryTagCount, isSelected && styles.categoryTagCountSelected]}>
                        {serviceCount}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text numberOfLines={1} style={[styles.categoryTagLabel, isSelected && styles.categoryTagLabelSelected]}>{option.name}</Text>
                    {isIncludedInVenuePackage ? <Text style={[styles.categoryTagIncluded, isSelected && styles.categoryTagIncludedSelected]}>Included in Venue Package</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : null}

        {!isExploreMode && !replacementContext && !isChangingService ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.categorySearchDivider} />
        ) : null}

        {!isExploreMode || activeExploreTab === 'explore' ? (
          <View style={styles.searchToolbar}>
            <View style={styles.searchField}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                accessibilityLabel={
                  isExploreMode ? 'Search services' : `Search ${categoryName} services`
                }
                onChangeText={handleSearchChange}
                placeholder={isExploreMode ? 'Search services' : `Search ${categoryName}`}
                placeholderTextColor={palette.secondary}
                returnKeyType="search"
                style={styles.searchInput}
                value={query}
              />
            </View>

            {!isExploreMode ? (
              <Pressable
                accessibilityLabel={`Sort results. Current sort: ${activeSortLabel}`}
                accessibilityRole="button"
                onPress={() => {
                  setIsSortOpen(true)
                  onOpenSort?.()
                }}
                style={({ pressed }) => [styles.sortControl, pressed && styles.sortControlPressed]}
              >
                <MaterialCommunityIcons color="#2F80ED" name="filter-outline" size={21} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isExploreMode && activeExploreTab === 'reviewed' ? (
          <View style={styles.resultsList}>
            <ReviewedServicesTab
              isLoading={reviewedServicesLoading}
              items={reviewedServices}
              onOpenAvailableService={onSelectReviewedService}
            />
          </View>
        ) : <View style={styles.resultsList}>
          {vendorSections.map((section) => (
            <View key={section.id} style={styles.recommendationSection}>
              {section.label ? (
                <View style={styles.recommendationSectionHeading}>
                  <Text style={styles.recommendationSectionTitle}>{section.label}</Text>
                  <Text style={styles.recommendationSectionCount}>{section.vendors.length}</Text>
                </View>
              ) : null}
              <ServiceSectionList horizontal={section.horizontal}>
                {section.vendors.map((vendor) => (
            <Pressable
              key={vendor.id}
              accessibilityLabel={isScheduleUnavailable(vendor)
                ? `${vendor.name}, not available for the selected event schedule`
                : `Open ${vendor.name}, rated ${vendor.rating}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isScheduleUnavailable(vendor) }}
              disabled={isScheduleUnavailable(vendor)}
              onPress={() => requestCateringBrowse(vendor.categoryId === 'catering', () => onSelectVendor?.(vendor.id))}
              style={({ pressed }) => [
                styles.vendorCard,
                section.horizontal
                  ? [styles.vendorCardCarousel, { width: isWide ? 324 : Math.max(252, width - 56) }]
                  : null,
                (usesCompactPlanningCards || vendor.kind === 'coordinator') && [
                  styles.compactVendorCard,
                  { width: Math.min(220, width - 72) },
                ],
                isScheduleUnavailable(vendor) && styles.vendorCardUnavailable,
                pressed && styles.cardPressed,
              ]}
            >
              {vendor.kind !== 'coordinator' && !vendor.isMock ? (() => {
                const isFavorited = favoriteServiceIds.has(vendor.id)
                const isPending = favoritePendingServiceIds.has(vendor.id)
                return (
                  <Pressable
                    accessibilityLabel={`${isFavorited ? 'Remove' : 'Save'} ${vendor.name} ${isFavorited ? 'from' : 'to'} favorites`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: isPending, selected: isFavorited }}
                    disabled={isPending}
                    onPress={(event) => {
                      event.stopPropagation()
                      onToggleFavorite?.(vendor.id)
                    }}
                    style={({ pressed }) => [
                      styles.favoriteButton,
                      isFavorited && styles.favoriteButtonSelected,
                      isPending && styles.favoriteButtonPending,
                      pressed && styles.favoriteButtonPressed,
                    ]}
                  >
                    <BlurView intensity={22} pointerEvents="none" tint="light" style={styles.favoriteButtonGlass} />
                    <MaterialIcons
                      color="#701B30"
                      name={isFavorited ? 'favorite' : 'favorite-border'}
                      size={19}
                      style={styles.favoriteButtonIcon}
                    />
                  </Pressable>
                )
              })() : null}
              <View style={[styles.imagePanel, (usesCompactPlanningCards || vendor.kind === 'coordinator') && styles.compactImagePanel]}>
                {vendor.imageUrl ? (
                  <Image
                    accessibilityLabel={vendor.imageLabel}
                    resizeMode="cover"
                    source={{ uri: vendor.imageUrl }}
                    style={styles.vendorImage}
                  />
                ) : (
                  <View
                    accessibilityLabel={`${vendor.name} has no uploaded photo`}
                    style={styles.vendorImagePlaceholder}
                  >
                    <Text style={styles.vendorImagePlaceholderText}>{vendor.name}</Text>
                  </View>
                )}
                {isScheduleUnavailable(vendor) || vendor.kind !== 'coordinator' ? <View style={styles.serviceImageBadges}>
                  {isScheduleUnavailable(vendor) ? (
                    <View style={styles.scheduleUnavailableBadge}>
                      <MaterialCommunityIcons color="#FFFFFF" name="calendar-remove-outline" size={13} />
                      <Text style={styles.scheduleUnavailableBadgeText}>NOT AVAILABLE ON YOUR SCHEDULE</Text>
                    </View>
                  ) : null}
                  {vendor.kind !== 'coordinator'
                    && !usesCompactPlanningCards
                    && (isPersonalizedRecommendation(vendor) || vendor.isMostBooked) ? (
                    <View style={styles.decisionBadges}>
                      {isPersonalizedRecommendation(vendor) ? (
                        <View style={[styles.decisionBadge, styles.recommendedDecisionBadge]}>
                          <MaterialCommunityIcons color="#245E43" name="star-circle" size={13} />
                          <Text style={[styles.decisionBadgeText, styles.recommendedDecisionBadgeText]}>
                            RECOMMENDED FOR YOU
                          </Text>
                        </View>
                      ) : null}
                      {vendor.isMostBooked ? (
                        <View style={[styles.decisionBadge, styles.mostBookedDecisionBadge]}>
                          <MaterialCommunityIcons color="#6B1E2E" name="fire" size={13} />
                          <Text style={[styles.decisionBadgeText, styles.mostBookedDecisionBadgeText]}>
                            MOST BOOKED
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View> : null}
                {!isExploreMode
                  && !isChangingService
                  && !isScheduleUnavailable(vendor)
                  && categoryBudgetForVendor(vendor) > 0 ? (
                  <View
                    style={[
                      styles.serviceBudgetBadge,
                      isVendorWithinBudget(vendor)
                        ? styles.serviceBudgetBadgeFit
                        : styles.serviceBudgetBadgeOver,
                    ]}
                  >
                    <Text
                      style={[
                        styles.serviceBudgetBadgeText,
                        isVendorWithinBudget(vendor)
                          ? styles.serviceBudgetBadgeTextFit
                          : styles.serviceBudgetBadgeTextOver,
                      ]}
                    >
                      {isVendorWithinBudget(vendor) ? 'WITHIN BUDGET' : 'OVER BUDGET'}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.vendorCopy, (usesCompactPlanningCards || vendor.kind === 'coordinator') && styles.compactVendorCopy]}>
                {usesCompactPlanningCards || vendor.kind === 'coordinator' ? (
                  <View style={styles.vendorIdentityRow}>
                    <Text numberOfLines={1} style={[styles.vendorName, styles.compactVendorName]}>
                      {vendor.name}
                    </Text>
                    <Text numberOfLines={1} style={[styles.rating, styles.compactRating]}>
                      {vendor.reviewCount > 0 ? `${vendor.rating} ★ (${vendor.reviewCount})` : 'New'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text numberOfLines={1} style={styles.vendorName}>{vendor.name}</Text>
                    <Text numberOfLines={1} style={styles.vendorMeta}>
                      {vendor.categoryName} · {vendor.providerName}
                    </Text>
                    <Text numberOfLines={2} style={styles.vendorDescription}>{vendor.description}</Text>
                    <Text style={styles.rating}>
                      {vendor.reviewCount > 0 ? `${vendor.rating} ★ (${vendor.reviewCount})` : 'New'}
                    </Text>
                  </>
                )}
                {vendor.kind !== 'coordinator' && replacementContext ? (() => {
                  const alternativeAmount = vendor.budgetRecommendation?.calculatedAmount
                  if (vendor.categoryId === 'catering' && !alternativeAmount) {
                    return (
                      <View style={styles.recommendationBadge}>
                        <Text style={styles.recommendationBadgeText}>PRICE CONFIRMED AT QUOTE</Text>
                      </View>
                    )
                  }
                  const quotedAmount = alternativeAmount ?? vendor.minPrice
                  const difference = Math.round(quotedAmount - replacementContext.baselineAmount)
                  const label = difference === 0
                    ? 'SAME PRICE'
                    : difference > 0
                      ? `${formatCurrency(difference)} HIGHER`
                      : `${formatCurrency(Math.abs(difference))} LOWER`
                  return (
                    <View style={styles.recommendationBadge}>
                      <Text style={styles.recommendationBadgeText}>{label}</Text>
                    </View>
                  )
                })() : null}

                {!usesCompactPlanningCards
                  && vendor.kind !== 'coordinator'
                  && !isExploreMode
                  && !isChangingService
                  && vendor.budgetRecommendation
                  && vendor.budgetRecommendation.calculatedAmount ? (
                  <Text numberOfLines={1} style={styles.serviceEstimate}>
                    {vendor.categoryId === 'venues' ? 'Starting estimate' : 'Event estimate'}: {formatCurrency(vendor.budgetRecommendation.calculatedAmount)}
                  </Text>
                ) : !usesCompactPlanningCards && vendor.categoryId === 'catering' && eventGuestCount > 0 ? (
                  <Text style={cateringFit(vendor).fits ? styles.guestFit : styles.guestMismatch}>
                    {cateringFit(vendor).fits ? 'Fits event guest count' : cateringFit(vendor).reason}
                  </Text>
                ) : null}

                {!usesCompactPlanningCards && vendor.kind !== 'coordinator' ? <View style={styles.vendorFooter} /> : null}
                <Text
                  numberOfLines={1}
                  style={[styles.price, (usesCompactPlanningCards || vendor.kind === 'coordinator') && styles.compactPrice]}
                >
                  {formatServicePrice(vendor)}
                </Text>

                {vendor.kind !== 'coordinator' && replacementContext && !isScheduleUnavailable(vendor) ? (
                  <Pressable
                    accessibilityLabel={`Change to ${vendor.providerName}`}
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation()
                      void onConfirmReplacement?.(vendor.id)
                    }}
                    style={({ pressed }) => [
                      styles.changeProviderButton,
                      pressed && styles.changeProviderButtonPressed,
                    ]}
                  >
                    <Text style={styles.changeProviderButtonText}>CHANGE</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
                ))}
              </ServiceSectionList>
            </View>
          ))}

          {visibleVendors.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {catalogUnavailable
                  ? 'We could not load marketplace services'
                  : replacementContext
                  ? 'No alternate providers available'
                  : services.length > 0
                    ? 'No services match your current plan'
                    : 'No services found'}
              </Text>
              <Text style={styles.emptyCopy}>
                {catalogUnavailable
                  ? 'Check your connection and try again. Your booking details were not changed.'
                  : replacementContext
                  ? 'Another published provider in this category is required before this service can be changed.'
                  : services.length > 0
                    ? 'Try another search or select a different category.'
                  : categoryName.toLowerCase().includes('venue') && categoryBudget > 0
                    ? 'No available venue configuration matches the current event requirements. Try another category.'
                    : 'Services will appear here after providers publish them.'}
              </Text>
              {catalogUnavailable && onRetryCatalog ? (
                <Pressable
                  accessibilityLabel="Retry loading marketplace services"
                  accessibilityRole="button"
                  onPress={onRetryCatalog}
                  style={({ pressed }) => [styles.emptyAction, pressed && styles.emptyActionPressed]}
                >
                  <Text style={styles.emptyActionText}>RETRY</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {catalogShowingFallback ? (
            <View accessibilityLiveRegion="polite" style={styles.catalogFallbackNotice}>
              <MaterialIcons color={warningNotice.icon} name="sync-problem" size={18} />
              <Text style={styles.catalogFallbackNoticeText}>
                Showing last available services. Retry when your connection is ready.
              </Text>
              {onRetryCatalog ? (
                <Pressable accessibilityLabel="Retry marketplace refresh" onPress={onRetryCatalog}>
                  <Text style={styles.catalogFallbackRetry}>RETRY</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>}
      </ScrollView>

      <Modal
        animationType="none"
        onRequestClose={() => dismissCategorySelection()}
        transparent
        visible={isCategorySelectionOpen}
      >
        <View
          pointerEvents={isCategorySelectionClosing ? 'none' : 'auto'}
          style={styles.categorySelectionOverlay}
        >
          <BlurView
            blurReductionFactor={1}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget ?? categorySelectionBlurTargetRef}
            intensity={42}
            tint="dark"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              accessibilityLabel="Close category selection"
              accessibilityRole="button"
              onPress={() => dismissCategorySelection()}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.categorySelectionDialog,
              {
                opacity: categorySelectionScale.interpolate({
                  inputRange: [0.82, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [{ scale: categorySelectionScale }],
              },
            ]}
          >
            <View style={styles.categorySelectionDialogHeader}>
              <View style={styles.categorySelectionDialogCopy}>
                <Text style={styles.categorySelectionDialogEyebrow}>STEP 3 SERVICE CATEGORIES</Text>
                <Text style={styles.categorySelectionDialogTitle}>Choose a Category</Text>
              </View>
              <Pressable
                accessibilityLabel="Close category selection"
                accessibilityRole="button"
                disabled={isUpdatingCategory}
                onPress={() => dismissCategorySelection()}
                style={({ pressed }) => [
                  styles.categorySelectionClose,
                  pressed && styles.neumorphicPressed,
                ]}
              >
                <MaterialIcons color={colors.closeIcon} name="close" size={21} />
              </Pressable>
            </View>
            <Text style={styles.categorySelectionDialogDescription}>
              Browse a category already in your plan or add another service category.
            </Text>
            <ScrollView
              contentContainerStyle={styles.categorySelectionOptions}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={false}
            >
              {categorySelectionOptions.map(({ category, isInPlan, section }, index) => {
                const categoryId = marketplaceCategoryId(category)
                const isCurrent = categoryId === categoryNameToId(categoryName)
                const isCompleted = activeSelectedCategoryIds.has(categoryId as CatalogCategoryId)
                const serviceCount = marketplaceCategoryCounts.get(categoryId) ?? 0
                const previousSection = categorySelectionOptions[index - 1]?.section
                const showCompletedHeader = section === 'completed' && previousSection !== 'completed'
                const showSectionDivider = index > 0 && section !== previousSection
                const cardTranslation = getCategoryCardTranslation(categoryId)

                return (
                  <Animated.View
                    key={`category-${categoryId}`}
                    onLayout={(event) => handleCategoryCardLayout(categoryId, event)}
                    style={[
                      styles.categorySelectionOptionGroup,
                      movingCategoryId === categoryId && styles.categorySelectionOptionGroupMoving,
                      { transform: [{ translateY: cardTranslation }] },
                    ]}
                  >
                    {showSectionDivider ? <View style={styles.categorySelectionDivider} /> : null}
                    {showCompletedHeader ? (
                      <Text style={styles.categorySelectionSectionHeader}>Completed</Text>
                    ) : null}
                    <Pressable
                      accessibilityLabel={isInPlan
                        ? `Browse ${category.name}`
                        : `Add ${category.name} to this event`}
                      accessibilityRole="button"
                      accessibilityState={{ busy: isUpdatingCategory, disabled: isUpdatingCategory, selected: isCurrent }}
                      disabled={isUpdatingCategory}
                      onPress={() => {
                        if (!isInPlan) {
                          void updateCategoryPlan(category, 'add')
                          return
                        }
                        dismissCategorySelection(() => {
                          requestCateringBrowse(categoryId === 'catering', () => {
                            onSelectCategory?.(category)
                          })
                        })
                      }}
                      style={({ pressed }) => [
                        styles.categorySelectionOption,
                        !isInPlan && styles.categorySelectionOptionSunken,
                        isCurrent && styles.categorySelectionOptionCurrent,
                        isCompleted && styles.categorySelectionOptionCompleted,
                        pressed && styles.neumorphicPressed,
                      ]}
                    >
                      <View style={[
                        styles.categorySelectionOptionIcon,
                        isCompleted && styles.categorySelectionOptionIconCompleted,
                      ]}>
                        <MaterialIcons
                          color={isCompleted ? '#1F6B42' : palette.primaryContainer}
                          name={isCompleted ? 'check' : 'category'}
                          size={19}
                        />
                      </View>
                      <View style={styles.categorySelectionOptionCopy}>
                        <Text style={[
                          styles.categorySelectionOptionTitle,
                          isCompleted && styles.categorySelectionOptionTitleCompleted,
                        ]}>{category.name}</Text>
                        <Text style={[
                          styles.categorySelectionOptionMeta,
                          isCompleted && styles.categorySelectionOptionMetaCompleted,
                        ]}>
                          {serviceCount} eligible {serviceCount === 1 ? 'service' : 'services'}
                        </Text>
                      </View>
                      {!isCompleted ? (
                        <Pressable
                          accessibilityLabel={isInPlan
                            ? `Remove ${category.name} from this event`
                            : `Add ${category.name} to this event`}
                          accessibilityRole="button"
                          disabled={isUpdatingCategory}
                          onPress={(event) => {
                            event.stopPropagation()
                            void updateCategoryPlan(category, isInPlan ? 'remove' : 'add')
                          }}
                          style={({ pressed }) => [
                            styles.categorySelectionOptionAction,
                            isInPlan && styles.categorySelectionOptionRemoveAction,
                            pressed && styles.neumorphicPressed,
                          ]}
                        >
                          <Text style={[
                            styles.categorySelectionOptionActionText,
                            isInPlan && styles.categorySelectionOptionRemoveText,
                          ]}>
                            {isInPlan ? 'REMOVE' : 'ADD'}
                          </Text>
                          <MaterialIcons
                            color={isInPlan ? palette.error : palette.primaryContainer}
                            name={isInPlan ? 'remove' : 'add'}
                            size={19}
                          />
                        </Pressable>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                )
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsSortOpen(false)}
        transparent
        visible={isSortOpen}
      >
        <View style={styles.sortOverlay}>
          <BlurView
            blurReductionFactor={1}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget ?? categorySelectionBlurTargetRef}
            intensity={42}
            tint="dark"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              accessibilityLabel="Close sort options"
              accessibilityRole="button"
              onPress={() => setIsSortOpen(false)}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
          <View accessibilityViewIsModal style={styles.sortSheet}>
            <View style={styles.sortSheetHeader}>
              <View>
                <Text style={styles.sortSheetEyebrow}>SERVICE ORDER</Text>
                <Text style={styles.sortSheetTitle}>Sort services</Text>
              </View>
              <Pressable
                accessibilityLabel="Close sort options"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsSortOpen(false)}
                style={({ pressed }) => [styles.sortCloseButton, pressed && styles.neumorphicPressed]}
              >
                <MaterialIcons color={colors.closeIcon} name="close" size={22} />
              </Pressable>
            </View>
            <Text style={styles.sortSheetDescription}>
              Recommended combines category budget fit, availability, guest requirements,
              ratings, and booking popularity.
            </Text>
            <ScrollView
              contentContainerStyle={styles.sortOptionsContent}
              showsVerticalScrollIndicator={false}
              style={styles.sortOptionsScroll}
            >
              {sortOptions.map((option) => {
                const selected = sortMode === option.id
                return (
                  <Pressable
                    key={option.id}
                    accessibilityLabel={`Sort by ${option.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setSortMode(option.id)
                      setIsSortOpen(false)
                    }}
                    style={({ pressed }) => [
                      styles.sortOption,
                      selected && styles.sortOptionSelected,
                      pressed && styles.neumorphicPressed,
                    ]}
                  >
                    <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>
                      {option.label}
                    </Text>
                    <MaterialIcons
                      color={selected ? neutralSelection.selectedText : palette.secondary}
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={21}
                    />
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {!isExploreMode && !replacementContext && !isChangingService && hasPlanSelections ? (
        <View style={styles.selectedServicesBar}>
          <Pressable
            accessibilityLabel={`Open event plan. ${selectedPlanItemCount} selections`}
            accessibilityRole="button"
            onPress={() => setIsSelectedServicesOpen(true)}
            style={({ pressed }) => [
              styles.selectedServicesButton,
              pressed && styles.selectedServicesButtonPressed,
            ]}
          >
            <View>
              <Text style={styles.selectedServicesButtonText}>Event Plan</Text>
              <Text style={styles.selectedServicesButtonHint}>
                Review your current event selections
              </Text>
            </View>
            <View style={styles.selectedServicesCount}>
              <Text style={styles.selectedServicesCountText}>{selectedPlanItemCount}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={revealSelectedServicesAfterCompletion}
        transparent
        visible={selectionCompletionVisible}
      >
        <View style={styles.completionOverlay}>
          <View accessibilityViewIsModal style={styles.completionModalCard}>
            <SelectionCompletionConfetti visible={selectionCompletionVisible} />
            <View style={styles.completionIcon}>
              <MaterialCommunityIcons color={palette.onPrimary} name="check" size={27} />
            </View>
            <Text style={styles.completionModalTitle}>You're All Set!</Text>
            <Text style={styles.completionModalCopy}>
              You've selected services for every allocated category. Review your selections before continuing.
            </Text>
            <View style={styles.completionModalActions}>
              <Pressable
                accessibilityLabel="Review selected services"
                accessibilityRole="button"
                onPress={revealSelectedServicesAfterCompletion}
                style={({ pressed }) => [styles.completionReviewButton, pressed && styles.pressed]}
              >
                <Text style={styles.completionReviewButtonText}>Review Selected Services</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Continue to selected services"
                accessibilityRole="button"
                onPress={revealSelectedServicesAfterCompletion}
                style={({ pressed }) => [styles.completionContinueButton, pressed && styles.pressed]}
              >
                <Text style={styles.completionContinueButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeSelectedServices}
        transparent
        visible={isSelectedServicesOpen}
      >
        <View style={styles.selectedServicesOverlay}>
          <BlurView
            blurReductionFactor={1}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget ?? categorySelectionBlurTargetRef}
            intensity={42}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.selectedServicesScrim} />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.selectedServicesSheet,
              { transform: [{ translateY: selectedServicesSheetOffset }] },
            ]}
          >
            <View style={styles.selectedServicesSheetHeader}>
              <View>
                <Text style={styles.selectedServicesSheetEyebrow}>YOUR EVENT PLAN</Text>
                <Text style={styles.selectedServicesSheetTitle}>Review Services</Text>
              </View>
              <Pressable
                accessibilityLabel="Close selected services"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeSelectedServices}
                style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.neumorphicPressed]}
              >
                <Text style={styles.sheetCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.selectedServicesSheetContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.reviewBudgetCard}>
                <View style={styles.reviewTotalCopy}>
                  <Text style={styles.reviewTotalLabel}>TOTAL ESTIMATED COST</Text>
                  <Text style={styles.reviewTotalValue}>
                    {formatCurrency(totalEstimatedCost)}
                  </Text>
                </View>
                {budget > 0 ? (
                  <View style={styles.reviewAllocationBlock}>
                    <View style={styles.reviewAllocationLabels}>
                      <Text style={styles.reviewBudgetLabel}>Budget: {formatCurrency(budget)}</Text>
                      <Text style={styles.reviewAllocatedLabel}>
                        {Math.min(100, Math.round((totalEstimatedCost / budget) * 100))}% Allocated
                      </Text>
                    </View>
                    <View
                      accessibilityLabel={`${Math.min(100, Math.round((totalEstimatedCost / budget) * 100))} percent of budget allocated`}
                      accessibilityRole="progressbar"
                      style={styles.reviewProgressTrack}
                    >
                      <View
                        style={[
                          styles.reviewProgressFill,
                          {
                            width: `${Math.min(100, Math.round((totalEstimatedCost / budget) * 100))}%` as `${number}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.reviewActualCostBlock}>
                    <Text style={styles.reviewActualCostEyebrow}>NO BUDGET SET</Text>
                    <Text style={styles.reviewActualCostText}>Pay actual service costs</Text>
                  </View>
                )}
                {venueCateringPackage ? (() => {
                  const overage = Math.max(0, venueCateringPackage.price - venueCateringPackage.allocatedBudget)
                  return (
                    <View style={styles.combinedPackageBudgetNotice}>
                      <Text style={styles.combinedPackageBudgetTitle}>VENUE + CATERING PACKAGE</Text>
                      <Text style={styles.combinedPackageBudgetText}>
                        {venueCateringPackage.name} is counted once: {formatCurrency(venueCateringPackage.price)}.
                      </Text>
                      {venueCateringPackage.allocatedBudget > 0 ? (
                        <Text style={overage > 0 ? styles.combinedPackageBudgetOverage : styles.combinedPackageBudgetText}>
                          Venue + Catering allocations: {formatCurrency(venueCateringPackage.allocatedBudget)}{overage > 0 ? ` · Over by ${formatCurrency(overage)}` : ' · Within those allocations'}
                        </Text>
                      ) : (
                        <Text style={styles.combinedPackageBudgetText}>Your Venue and Catering allocations remain separate and unchanged.</Text>
                      )}
                    </View>
                  )
                })() : null}
              </View>

              <Text style={styles.reviewServicesHeading}>Selected Services</Text>
              {assignedCoordinator ? (
                <View style={styles.selectedServiceRow}>
                  <View style={styles.selectedServiceTopSection}>
                    {assignedCoordinator.avatarUrl ? (
                      <Image
                        accessibilityLabel={`${assignedCoordinator.name}, selected event coordinator`}
                        source={{ uri: assignedCoordinator.avatarUrl }}
                        style={styles.selectedServiceImage}
                      />
                    ) : (
                      <View style={styles.reviewCoordinatorFallback}>
                        <MaterialCommunityIcons color={palette.onPrimary} name="account-tie" size={26} />
                      </View>
                    )}
                    <View style={styles.selectedServiceCopy}>
                      <Text style={styles.selectedServiceCategory}>EVENT COORDINATOR</Text>
                      <Text style={styles.selectedServiceName}>{assignedCoordinator.name}</Text>
                      {coordinatorPackage ? (
                        <Text style={styles.selectedServiceDetail}>{coordinatorPackage.name}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.selectedServiceBottomSection}>
                    <Text style={styles.selectedServicePrice}>{formatCurrency(assignedCoordinator.price)}</Text>
                    <View style={styles.reviewCoordinatorSwitchGroup}>
                      <Text style={styles.reviewCoordinatorSwitchLabel}>Included</Text>
                      <Switch
                        accessibilityLabel={`Include ${assignedCoordinator.name} in selected services`}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: true }}
                        onValueChange={(isIncluded) => {
                          if (!isIncluded) onRemoveCoordinator?.()
                        }}
                        thumbColor="#FFFFFF"
                        trackColor={{ false: '#B7C0C7', true: palette.primaryContainer }}
                        value
                      />
                    </View>
                  </View>
                </View>
              ) : coordinatorAssignmentStatus === 'awaiting_assignment' ? (
                <View style={styles.selectedServiceRow}>
                  <View style={styles.selectedServiceTopSection}>
                    <View style={styles.reviewCoordinatorFallback}>
                      <MaterialCommunityIcons color={palette.onPrimary} name="account-search" size={26} />
                    </View>
                    <View style={styles.selectedServiceCopy}>
                      <Text style={styles.selectedServiceCategory}>EVENT COORDINATOR</Text>
                      <Text style={styles.selectedServiceName}>MULTIVENT coordinator matching</Text>
                      <Text style={styles.selectedServiceDetail}>Finding the best coordinator for your event</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {selectedServices.map((service) => (
                <Pressable
                  key={service.id}
                  accessibilityLabel={`Open ${service.name}, ${service.status}`}
                  accessibilityRole="button"
                  onPress={() => {
                    closeSelectedServices()
                    onSelectService?.(service.id)
                  }}
                  style={({ pressed }) => [styles.selectedServiceRow, pressed && styles.neumorphicPressed]}
                >
                  <View style={styles.selectedServiceTopSection}>
                    <Image
                      accessibilityLabel={service.imageLabel}
                      source={{ uri: service.imageUrl }}
                      style={styles.selectedServiceImage}
                    />
                    <View style={styles.selectedServiceCopy}>
                      <Text style={styles.selectedServiceCategory}>{service.category}</Text>
                      <Text style={styles.selectedServiceName}>{service.name}</Text>
                      <Text style={styles.selectedServiceDetail}>{service.detail}</Text>
                    </View>
                  </View>

                  <View style={styles.selectedServiceBottomSection}>
                    <Text style={styles.selectedServicePrice}>
                      {service.pricePending ? 'Final price pending' : formatCurrency(service.price)}
                    </Text>
                    {service.status === 'Selected' ? (
                      <View style={styles.reviewServiceActions}>
                        <Pressable
                          accessibilityLabel={`Change ${service.name}`}
                          accessibilityRole="button"
                          hitSlop={4}
                          onPress={(event) => {
                            event.stopPropagation()
                            closeSelectedServices()
                            onChangeService?.(service)
                          }}
                          style={({ pressed }) => [styles.reviewChangeButton, pressed && styles.neumorphicPressed]}
                        >
                          <MaterialCommunityIcons color={palette.primaryContainer} name="swap-horizontal" size={18} />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Remove ${service.name} from selected services`}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: removingServiceId === service.id }}
                          disabled={removingServiceId === service.id}
                          hitSlop={4}
                          onPress={(event) => {
                            event.stopPropagation()
                            onRemoveService?.(service)
                          }}
                          style={({ pressed }) => [
                            styles.reviewServiceRemoveButton,
                            removingServiceId === service.id && styles.reviewRemoveButtonDisabled,
                            pressed && styles.neumorphicPressed,
                          ]}
                        >
                          <MaterialCommunityIcons
                            color={palette.primaryContainer}
                            name={removingServiceId === service.id ? 'progress-clock' : 'trash-can-outline'}
                            size={18}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}

              <Pressable
                accessibilityLabel="Add another service"
                accessibilityRole="button"
                onPress={() => {
                  closeSelectedServices()
                  onAddService?.()
                }}
                style={({ pressed }) => [styles.reviewAddServiceButton, pressed && styles.neumorphicPressed]}
              >
                <MaterialCommunityIcons color={palette.primaryContainer} name="plus" size={20} />
                <Text style={styles.reviewAddServiceText}>Add Service</Text>
              </Pressable>
            </ScrollView>

            <Pressable
              accessibilityLabel="Continue with selected services"
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasReviewableSelections }}
              disabled={!hasReviewableSelections}
              onPress={() => {
                closeSelectedServices()
                onContinueSelectedServices?.()
              }}
              style={({ pressed }) => [
                styles.sheetContinueButton,
                !hasReviewableSelections && styles.sheetContinueButtonDisabled,
                pressed && styles.neumorphicBurgundyPressed,
              ]}
            >
              <Text style={styles.sheetContinueText}>CONTINUE</Text>
              <MaterialIcons color={palette.onPrimary} name="arrow-forward" size={18} />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setCateringWarningAction(undefined)}
        transparent
        visible={Boolean(cateringWarningAction)}
      >
        <View style={styles.confirmationOverlay}>
          <View accessibilityViewIsModal style={styles.confirmationCard}>
            <View style={styles.confirmationIcon}>
              <MaterialCommunityIcons color={palette.primaryContainer} name="silverware-fork-knife" size={25} />
            </View>
            <Text style={styles.confirmationTitle}>Catering Already Included</Text>
            <Text style={styles.confirmationCopy}>
              Your selected venue package already includes catering. You can still book another catering service, but this will be an additional booking and may increase your total event cost.
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityLabel="Review Venue Package"
                accessibilityRole="button"
                onPress={() => {
                  setCateringWarningAction(undefined)
                  onReviewVenuePackage?.()
                }}
                style={({ pressed }) => [styles.confirmationCancel, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationCancelText}>REVIEW VENUE PACKAGE</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Continue Browsing catering services"
                accessibilityRole="button"
                onPress={() => {
                  const action = cateringWarningAction
                  setCateringWarningAction(undefined)
                  action?.()
                }}
                style={({ pressed }) => [styles.confirmationConfirm, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationConfirmText}>CONTINUE BROWSING</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showBottomNavigation && !isWide ? (
        <ClientBottomNavigation activeTab="explore" onSelectTab={onSelectTab} />
      ) : null}
    </BlurTargetView>
  )
}

const palette = {
  background: '#E9EDF0',
  error: '#B3261E',
  surfaceContainerHigh: '#E9EDF0',
  surfaceHighest: '#E9EDF0',
  surfaceVariant: '#DCE2E6',
  primary: '#4E061A',
  primaryContainer: '#6B1E2E',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#EE8594',
  secondary: '#5E5E5E',
  text: '#1A1C1C',
  outlineVariant: '#DAC0C2',
} as const

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  planningScreen: { backgroundColor: palette.background },
  neumorphicPressed: {
    boxShadow: 'inset 3px 3px 6px rgba(160, 171, 180, 0.52), inset -3px -3px 6px rgba(255, 255, 255, 0.94)',
    transform: [{ scale: 0.99 }],
  },
  neumorphicBurgundyPressed: {
    boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(146, 48, 72, 0.56)',
    transform: [{ scale: 0.99 }],
  },
  topAppBar: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#4E061A',
    backgroundColor: '#6B1E2E',
  },
  topAppBarContent: {
    width: '100%',
    maxWidth: 1200,
    minHeight: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  horizontalPaddingMobile: {
    paddingHorizontal: 20,
  },
  horizontalPaddingWide: {
    paddingHorizontal: 64,
  },
  stepWrapper: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    opacity: 0.82,
  },
  headerButtonNeumorphic: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: '#6B1E2E',
    boxShadow: '3px 3px 7px rgba(44, 3, 15, 0.58), -3px -3px 7px rgba(143, 48, 72, 0.46)',
  },
  headerButtonNeumorphicPressed: {
    boxShadow: 'inset 3px 3px 7px rgba(44, 3, 15, 0.66), inset -3px -3px 7px rgba(143, 48, 72, 0.46)',
    transform: [{ scale: 0.96 }],
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
  },
  moreIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  contentWithBottomNavigation: {
    paddingBottom: 112,
  },
  contentWithSelectedServicesAction: {
    paddingBottom: 8,
  },
  selectedServicesBar: {
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  selectedServicesButton: {
    width: '100%',
    maxWidth: 1160,
    minHeight: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 22,
    paddingVertical: 10,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedServicesButtonText: {
    color: palette.onPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  selectedServicesButtonHint: {
    color: '#F3CED4',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  selectedServicesCount: {
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginLeft: 'auto',
  },
  selectedServicesCountText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  selectedServicesArrow: {
    color: palette.onPrimary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '700',
    marginLeft: 10,
  },
  selectedServicesButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  categorySelectionOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
    padding: 20,
  },
  categorySelectionDialog: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    borderRadius: 22,
    backgroundColor: palette.background,
    padding: 20,
    boxShadow: '0px 6px 14px rgba(62, 75, 84, 0.22)',
  },
  categorySelectionDialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  categorySelectionDialogCopy: { minWidth: 0, flex: 1 },
  categorySelectionDialogEyebrow: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  categorySelectionDialogTitle: {
    color: '#57636C',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  categorySelectionClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    borderRadius: 21,
    backgroundColor: palette.background,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.42), -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionDialogDescription: {
    color: '#73808A',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 16,
  },
  categorySelectionOptions: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  categorySelectionOptionGroup: { gap: 12 },
  categorySelectionOptionGroupMoving: {
    zIndex: 30,
    elevation: 2,
  },
  categorySelectionDivider: {
    alignSelf: 'center',
    width: '76%',
    height: 1,
    backgroundColor: 'rgba(115, 128, 138, 0.42)',
    marginVertical: 2,
  },
  categorySelectionSectionHeader: {
    color: '#1F6B42',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginHorizontal: 4,
  },
  categorySelectionOption: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 16,
    backgroundColor: palette.background,
    padding: 12,
    boxShadow: '5px 5px 11px rgba(156, 169, 180, 0.42), -5px -5px 11px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionOptionCurrent: {
    borderColor: 'rgba(107, 30, 46, 0.42)',
    backgroundColor: '#F0E8EA',
  },
  categorySelectionOptionSunken: {
    borderColor: 'rgba(255,255,255,0.70)',
    backgroundColor: palette.background,
    boxShadow: 'inset 4px 4px 9px rgba(160, 171, 180, 0.52), inset -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionOptionCompleted: {
    borderColor: 'rgba(62, 139, 91, 0.48)',
    backgroundColor: '#DCEFE3',
    boxShadow: '5px 5px 11px rgba(102, 143, 117, 0.34), -5px -5px 11px rgba(255, 255, 255, 0.82)',
  },
  categorySelectionOptionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: palette.background,
    boxShadow: 'inset 3px 3px 7px rgba(170, 181, 190, 0.48), inset -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionOptionIconCompleted: {
    backgroundColor: '#DCEFE3',
    boxShadow: 'inset 3px 3px 7px rgba(104, 153, 121, 0.36), inset -3px -3px 7px rgba(255, 255, 255, 0.76)',
  },
  categorySelectionOptionCopy: { minWidth: 0, flex: 1 },
  categorySelectionOptionTitle: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  categorySelectionOptionTitleCompleted: { color: '#195C38' },
  categorySelectionOptionMeta: {
    color: '#73808A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  categorySelectionOptionMetaCompleted: { color: '#387552' },
  categorySelectionOptionAction: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    borderRadius: 17,
    backgroundColor: palette.background,
    paddingHorizontal: 9,
    boxShadow: '3px 3px 7px rgba(156, 169, 180, 0.40), -3px -3px 7px rgba(255, 255, 255, 0.92)',
  },
  categorySelectionOptionRemoveAction: {
    borderColor: 'rgba(179, 38, 30, 0.22)',
  },
  categorySelectionOptionActionText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  categorySelectionOptionRemoveText: { color: palette.error },
  selectedServicesOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  selectedServicesScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
  },
  selectedServicesSheet: {
    width: '100%',
    maxHeight: '82%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    boxShadow: '0px -4px 12px rgba(62, 75, 84, 0.20)',
  },
  selectedServicesSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  selectedServicesSheetEyebrow: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  selectedServicesSheetTitle: {
    color: palette.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    backgroundColor: '#E9EDF0',
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.44), -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  sheetCloseText: {
    color: colors.closeIcon,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '300',
  },
  selectedServicesSheetContent: {
    gap: 12,
    paddingBottom: 30,
  },
  reviewBudgetCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 16,
    backgroundColor: '#E9EDF0',
    padding: 16,
    boxShadow: '6px 6px 13px rgba(156, 169, 180, 0.44), -6px -6px 13px rgba(255, 255, 255, 0.94)',
  },
  reviewTotalCopy: {
    gap: 4,
  },
  reviewTotalLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewTotalValue: {
    color: palette.primaryContainer,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  reviewAllocationBlock: {
    gap: 8,
  },
  reviewAllocationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewBudgetLabel: {
    flex: 1,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewAllocatedLabel: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  reviewProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#E9EDF0',
    boxShadow: 'inset 2px 2px 5px rgba(160, 171, 180, 0.52), inset -2px -2px 5px rgba(255, 255, 255, 0.94)',
  },
  reviewProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primaryContainer,
  },
  reviewActualCostBlock: {
    gap: 4,
  },
  reviewActualCostEyebrow: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewActualCostText: {
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  combinedPackageBudgetNotice: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    marginTop: 12,
    paddingTop: 12,
  },
  combinedPackageBudgetTitle: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1 },
  combinedPackageBudgetText: { color: palette.secondary, fontSize: 12, lineHeight: 17 },
  combinedPackageBudgetOverage: { color: palette.error, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  reviewCoordinatorFallback: {
    width: 56,
    height: 56,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: palette.primaryContainer,
  },
  reviewCoordinatorSwitchGroup: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewCoordinatorSwitchLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  reviewServicesHeading: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 2,
  },
  selectedServiceRow: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 14,
    backgroundColor: '#E9EDF0',
    padding: 12,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.36), -4px -4px 9px rgba(255, 255, 255, 0.88)',
  },
  selectedServiceTopSection: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  selectedServiceImage: {
    width: 56,
    height: 56,
    flexShrink: 0,
    borderRadius: 10,
  },
  selectedServiceCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  selectedServiceCategory: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  selectedServiceName: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  selectedServiceDetail: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  selectedServiceBottomSection: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(156, 169, 180, 0.34)',
    paddingTop: 10,
  },
  selectedServicePrice: {
    minWidth: 0,
    flex: 1,
    color: palette.primaryContainer,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  reviewRemoveButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 16,
    backgroundColor: '#E9EDF0',
    boxShadow: '3px 3px 7px rgba(156, 169, 180, 0.42), -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  reviewServiceActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewChangeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    boxShadow: '2px 2px 5px rgba(156, 169, 180, 0.34), -2px -2px 5px rgba(255, 255, 255, 0.86)',
  },
  reviewServiceRemoveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 20,
    backgroundColor: '#E9EDF0',
    boxShadow: '2px 2px 5px rgba(156, 169, 180, 0.34), -2px -2px 5px rgba(255, 255, 255, 0.86)',
  },
  reviewRemoveButtonDisabled: {
    opacity: 0.55,
  },
  reviewAddServiceButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 24,
    backgroundColor: '#E9EDF0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    boxShadow: '5px 5px 11px rgba(156, 169, 180, 0.44), -5px -5px 11px rgba(255, 255, 255, 0.94)',
  },
  reviewAddServiceText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sheetContinueButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 27,
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    boxShadow: '5px 5px 11px rgba(62, 12, 28, 0.56), -5px -5px 11px rgba(181, 98, 121, 0.50)',
  },
  sheetContinueButtonDisabled: { opacity: 0.48 },
  sheetContinueText: {
    color: palette.onPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  completionOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 28, 28, 0.46)',
    padding: 24,
  },
  completionModalCard: {
    overflow: 'hidden',
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  completionConfetti: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  completionConfettiPiece: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 13,
    borderRadius: 2,
  },
  completionIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: palette.primaryContainer,
  },
  completionModalTitle: { color: palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', marginTop: 15 },
  completionModalCopy: { color: palette.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  completionModalActions: { width: '100%', gap: 9, marginTop: 22 },
  completionReviewButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.primaryContainer,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  completionReviewButtonText: { color: palette.primaryContainer, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  completionContinueButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 16,
  },
  completionContinueButtonText: { color: palette.onPrimary, fontSize: 12, lineHeight: 16, fontWeight: '800' },
  budgetPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    backgroundColor: palette.surfaceContainerHigh,
    paddingHorizontal: 24,
    paddingVertical: 9,
    marginBottom: 24,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetText: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  categorySelectionSection: { marginBottom: 6 },
  categorySelectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  categorySelectionEyebrow: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  categorySelectionCount: {
    color: '#73808A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  categorySelectionCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 18,
    backgroundColor: palette.background,
    padding: 14,
    boxShadow: '7px 7px 15px rgba(156, 169, 180, 0.44), -7px -7px 15px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionCardCompleted: {
    borderColor: 'rgba(62, 139, 91, 0.48)',
    backgroundColor: '#DCEFE3',
    boxShadow: '7px 7px 15px rgba(102, 143, 117, 0.34), -7px -7px 15px rgba(255, 255, 255, 0.82)',
  },
  categorySelectionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.background,
    boxShadow: 'inset 3px 3px 7px rgba(170, 181, 190, 0.48), inset -3px -3px 7px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionIconCompleted: {
    backgroundColor: '#DCEFE3',
    boxShadow: 'inset 3px 3px 7px rgba(104, 153, 121, 0.36), inset -3px -3px 7px rgba(255, 255, 255, 0.76)',
  },
  categorySelectionCopy: { minWidth: 0, flex: 1 },
  categorySelectionTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  categorySelectionTitleCompleted: { color: '#195C38' },
  categorySelectionHint: {
    color: '#73808A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  categorySelectionHintCompleted: { color: '#387552' },
  categorySelectionAction: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 18,
    backgroundColor: palette.background,
    paddingHorizontal: 11,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.42), -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  categorySelectionActionCompleted: {
    borderColor: 'rgba(62, 139, 91, 0.40)',
    backgroundColor: '#DCEFE3',
    boxShadow: '4px 4px 9px rgba(102, 143, 117, 0.30), -4px -4px 9px rgba(255, 255, 255, 0.76)',
  },
  categorySelectionActionText: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categorySelectionActionTextCompleted: { color: '#1F6B42' },
  planningCompleteCard: {
    backgroundColor: '#F7FAFF',
    borderColor: '#C6D6EC',
    borderRadius: 16,
    borderWidth: 1,
    gap: 3,
    marginTop: 14,
    padding: 14,
  },
  planningCompleteTitle: {
    color: palette.primaryContainer,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  planningCompleteText: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  replacementBanner: {
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 14,
    backgroundColor: '#FFF7F8',
    padding: 18,
    marginBottom: 20,
  },
  changeServiceBanner: {
    borderColor: 'rgba(255, 255, 255, 0.78)',
    backgroundColor: palette.background,
    boxShadow: '5px 5px 11px rgba(156, 169, 180, 0.42), -5px -5px 11px rgba(255, 255, 255, 0.94)',
  },
  replacementEyebrow: {
    color: palette.primaryContainer,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  replacementTitle: {
    color: palette.primary,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 4,
  },
  replacementCopy: { color: palette.secondary, fontSize: 13, lineHeight: 20, marginTop: 5 },
  chevron: {
    color: palette.primaryContainer,
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '700',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  exploreTabs: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderBottomColor: palette.surfaceContainerHigh,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    width: '100%',
  },
  exploreTabsWide: { paddingHorizontal: 64 },
  exploreTab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  exploreTabActive: { borderBottomColor: palette.primaryContainer },
  exploreTabText: { color: palette.secondary, fontSize: 14, fontWeight: '600' },
  exploreTabTextActive: { color: palette.primaryContainer, fontWeight: '800' },
  categoryTitle: {
    color: palette.primaryContainer,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
  },
  searchToolbar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginVertical: 10,
  },
  categorySearchDivider: {
    width: '94%',
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    backgroundColor: 'rgba(118, 118, 118, 0.42)',
    marginTop: 18,
    marginBottom: 8,
  },
  searchField: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: palette.background,
    paddingHorizontal: 13,
    boxShadow: 'inset 4px 4px 9px rgba(170, 181, 190, 0.50), inset -4px -4px 9px rgba(255, 255, 255, 0.94)',
  },
  searchIcon: {
    color: palette.secondary,
    fontSize: 20,
    lineHeight: 22,
    marginRight: 6,
  },
  searchInput: {
    height: '100%',
    flex: 1,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 0,
  },
  exploreCategoryScroller: { marginBottom: 12 },
  exploreCategoryContent: { gap: 8, paddingRight: 20, paddingBottom: 4 },
  categoryTag: {
    maxWidth: 220,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    borderRadius: 20,
    backgroundColor: palette.background,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 6,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.38), -4px -4px 9px rgba(255, 255, 255, 0.92)',
  },
  categoryTagSelected: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryContainer,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryTagIndicator: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#F7E7E9',
  },
  categoryTagIndicatorSelected: { backgroundColor: '#8F3A4A' },
  categoryTagCount: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  categoryTagCountSelected: { color: palette.onPrimary },
  categoryTagLabel: {
    maxWidth: 160,
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  categoryTagLabelSelected: { color: palette.onPrimary },
  categoryTagIncluded: { color: palette.primaryContainer, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  categoryTagIncludedSelected: { color: palette.onPrimary },
  sortControl: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.86)',
    borderRadius: 21,
    backgroundColor: palette.background,
    boxShadow: '5px 5px 11px rgba(166, 177, 186, 0.48), -5px -5px 11px rgba(255, 255, 255, 0.96)',
  },
  sortControlPressed: { transform: [{ scale: 0.94 }], opacity: 0.86 },
  sortOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(35, 43, 48, 0.14)',
  },
  sortSheet: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '82%',
    alignSelf: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.84)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: palette.background,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 30,
    boxShadow: '0px -4px 12px rgba(62, 75, 84, 0.22)',
  },
  sortSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortSheetEyebrow: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sortSheetTitle: {
    color: palette.primary,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
  },
  sortCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
    borderRadius: 20,
    backgroundColor: palette.background,
    boxShadow: '4px 4px 9px rgba(156, 169, 180, 0.40), -4px -4px 9px rgba(255, 255, 255, 0.92)',
  },
  sortSheetDescription: {
    color: '#57636C',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  sortOptionsScroll: { maxHeight: 330 },
  sortOptionsContent: { gap: 12, paddingHorizontal: 2, paddingVertical: 2 },
  sortOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: neutralSelection.edge,
    borderRadius: 16,
    backgroundColor: neutralSelection.surface,
    paddingHorizontal: 16,
    boxShadow: neutralSelection.sunkenShadow,
  },
  sortOptionSelected: {
    borderColor: neutralSelection.selectedEdge,
    backgroundColor: neutralSelection.selectedSurface,
    boxShadow: neutralSelection.selectedRaisedShadow,
  },
  sortOptionText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sortOptionTextSelected: { color: neutralSelection.selectedText, fontWeight: '800' },
  resultsList: {
    gap: 16,
    marginBottom: 80,
  },
  horizontalServiceScroller: { marginHorizontal: -20 },
  horizontalServiceContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 18,
  },
  verticalServiceList: { gap: 16 },
  recommendationSection: {
    gap: 14,
  },
  recommendationSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  recommendationSectionTitle: {
    color: palette.primaryContainer,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recommendationSectionCount: {
    minWidth: 26,
    height: 26,
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    borderRadius: 13,
    backgroundColor: '#F2E7E9',
  },
  vendorCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#4E061A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 4,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.46)',
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  favoriteButtonGlass: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  favoriteButtonIcon: { transform: [{ translateY: 1 }] },
  favoriteButtonPending: { opacity: 0.58 },
  favoriteButtonPressed: { transform: [{ scale: 0.92 }] },
  favoriteButtonSelected: { borderColor: 'rgba(112, 27, 48, 0.35)', backgroundColor: 'rgba(255, 245, 247, 0.84)' },
  clearFavoritesFilter: {
    marginLeft: 'auto',
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 15,
    backgroundColor: palette.surfaceHighest,
    paddingHorizontal: 11,
  },
  clearFavoritesFilterText: { color: palette.primaryContainer, fontSize: 12, fontWeight: '800' },
  vendorCardUnavailable: {
    opacity: 0.52,
  },
  vendorCardCarousel: {
    flexShrink: 0,
  },
  compactVendorCard: {
    minHeight: 282,
    alignSelf: 'center',
  },
  imagePanel: {
    width: '100%',
    height: 104,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#EDE4DF',
  },
  compactImagePanel: { height: 210 },
  vendorImage: {
    width: '100%',
    height: '100%',
  },
  vendorImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: palette.surfaceVariant,
  },
  vendorImagePlaceholderText: {
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  vendorCopy: {
    position: 'relative',
    minHeight: 150,
    paddingTop: 7,
    paddingHorizontal: 9,
    paddingBottom: 12,
  },
  compactVendorCopy: { minHeight: 72, paddingTop: 9, paddingHorizontal: 11, paddingBottom: 9 },
  vendorIdentityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  serviceImageBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 44,
    zIndex: 3,
    alignItems: 'flex-start',
    gap: 5,
  },
  scheduleUnavailableBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: 999,
    backgroundColor: 'rgba(190, 35, 52, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  scheduleUnavailableBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  decisionBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  decisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  recommendedDecisionBadge: { borderColor: '#9CCEB1', backgroundColor: 'rgba(229, 244, 235, 0.94)' },
  mostBookedDecisionBadge: { borderColor: '#D9B6BD', backgroundColor: 'rgba(247, 233, 236, 0.94)' },
  decisionBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  recommendedDecisionBadgeText: { color: '#245E43' },
  mostBookedDecisionBadgeText: { color: '#6B1E2E' },
  serviceBudgetBadge: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    zIndex: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  serviceBudgetBadgeFit: { backgroundColor: 'rgba(61, 155, 98, 0.78)' },
  serviceBudgetBadgeOver: { backgroundColor: 'rgba(190, 35, 52, 0.78)' },
  serviceBudgetBadgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontWeight: '900', letterSpacing: 0.25 },
  serviceBudgetBadgeTextFit: { color: '#FFFFFF' },
  serviceBudgetBadgeTextOver: { color: '#FFFFFF' },
  vendorName: {
    color: '#2B2323',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    paddingRight: 78,
  },
  compactVendorName: { flex: 1, fontSize: 15, lineHeight: 21, paddingRight: 0 },
  vendorMeta: {
    color: '#847977',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  vendorDescription: {
    color: '#6F6463',
    fontSize: 13,
    lineHeight: 15,
    marginTop: 5,
  },
  rating: {
    position: 'absolute',
    top: 9,
    right: 12,
    zIndex: 2,
    color: '#8A2944',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  compactRating: {
    position: 'relative',
    top: 0,
    right: 0,
    flexShrink: 0,
    lineHeight: 21,
  },
  price: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 2,
    maxWidth: '58%',
    color: '#847977',
    fontSize: 13,
    lineHeight: 18,
  },
  compactPrice: { bottom: 9, left: 11, maxWidth: '82%' },
  serviceEstimate: {
    color: '#8A2944',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  vendorFooter: { minHeight: 34, marginTop: 4 },
  recommendationBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  recommendationBadgeText: {
    color: '#8E2430',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  guestFit: { color: '#2E6D4E', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  guestMismatch: { color: '#A12A35', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  changeProviderButton: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    zIndex: 3,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  changeProviderButtonText: {
    color: palette.onPrimary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  changeProviderButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  confirmationOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 10, 15, 0.58)',
    padding: 24,
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmationIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#F8EDEF',
    marginBottom: 14,
  },
  confirmationIconText: {
    color: palette.primaryContainer,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '800',
  },
  confirmationTitle: {
    color: palette.primary,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmationCopy: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  confirmationActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 24 },
  confirmationCancel: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  confirmationCancelText: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  confirmationConfirm: {
    minHeight: 48,
    flex: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 14,
  },
  confirmationConfirmText: {
    color: palette.onPrimary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  confirmationDisabled: { opacity: 0.58 },
  emptyState: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    padding: 32,
  },
  emptyTitle: {
    color: palette.primary,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '700',
  },
  emptyCopy: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyAction: {
    alignItems: 'center',
    backgroundColor: palette.primaryContainer,
    borderRadius: 18,
    marginTop: 16,
    minWidth: 132,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyActionPressed: { opacity: 0.82 },
  emptyActionText: {
    color: palette.onPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  catalogFallbackNotice: {
    alignItems: 'center',
    backgroundColor: warningNotice.background,
    borderColor: warningNotice.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catalogFallbackNoticeText: {
    color: warningNotice.text,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  catalogFallbackRetry: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bottomNavigation: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: palette.background,
    paddingHorizontal: 16,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  navItem: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  navItemActive: {
    backgroundColor: palette.primaryContainer,
  },
  navIcon: {
    color: palette.secondary,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  navLabel: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  navContentActive: {
    color: palette.onPrimaryContainer,
  },
  budgetPressed: {
    backgroundColor: palette.surfaceVariant,
    transform: [{ scale: 0.99 }],
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  cardPressed: {
    borderColor: palette.primaryContainer,
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  pressed: {
    opacity: 0.55,
    transform: [{ scale: 0.95 }],
  },
})
