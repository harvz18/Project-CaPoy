import { Text } from '../components/AppText'
import React from 'react'
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { PlanningScreenHeader } from '../components/PlanningScreenHeader'
import { ClientBottomNavigation, ClientMainTab } from '../components/ClientBottomNavigation'
import { CatalogService, formatServicePrice, ServiceCategoryOption } from '../lib/catalog'
import { customerPriceFromProviderPrice } from '../lib/pricing'
import { calculateCateringPrice, getCateringPricingOptions, getVenueBookingOptions } from '../lib/service-category-details'
import type { AssignedCoordinatorSummary, SelectedSummaryService } from './07-SelectedSummary'

export type CategoryBrowseFilter = string
export type CategoryBrowseVendor = string
export type CategoryBrowseTab = ClientMainTab | 'vendors' | 'budget'

interface CategoryBrowseScreenProps {
  categoryName?: string
  categories?: ServiceCategoryOption[]
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
  totalEstimatedCost?: number
  removingServiceId?: string
  remainingBudget?: number
  replacementContext?: {
    currentProviderName: string
    serviceName: string
  }
  showBottomNavigation?: boolean
  searchValue?: string
  sortLabel?: string
  onBack?: () => void
  onChangeSearch?: (value: string) => void
  onCategoryBudgetChange?: (amount: number) => Promise<boolean> | boolean
  onContinueSelectedServices?: () => void
  onAddService?: () => void
  onRemoveCoordinator?: () => void
  onRemoveService?: (service: SelectedSummaryService) => void
  onSelectService?: (serviceId: string) => void
  onOpenSort?: () => void
  onConfirmReplacement?: (vendorId: string) => boolean | Promise<boolean>
  onSelectFilter?: (filter: CategoryBrowseFilter) => void
  onSelectCategory?: (category: ServiceCategoryOption) => void
  onSelectTab?: (tab: CategoryBrowseTab) => void
  onSelectVendor?: (vendor: CategoryBrowseVendor) => void
}

const filters = [
  { id: 'plated' as const, label: 'Plated' },
  { id: 'buffet' as const, label: 'Buffet' },
  { id: 'packed' as const, label: 'Packed' },
  { id: 'under500' as const, label: 'Under ₱500/head' },
] as const

export const categoryBrowseNavigationTabs = [
  { id: 'explore' as const, icon: '◎', label: 'Explore' },
  { id: 'vendors' as const, icon: 'S', label: 'Service Providers' },
  { id: 'budget' as const, icon: '₱', label: 'Budget' },
  { id: 'profile' as const, icon: '○', label: 'Profile' },
] as const

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const CategoryBrowseScreen: React.FC<CategoryBrowseScreenProps> = ({
  categoryName = 'Services',
  categories = [],
  eventGuestCount = 0,
  hasBudget,
  mode = 'planning',
  services = [],
  selectedServiceCount = 0,
  selectedServices = [],
  assignedCoordinator,
  coordinatorAssignmentStatus,
  coordinatorPackage,
  budget = 0,
  categoryBudget = 0,
  categoryBudgetLocked = false,
  categoryBudgetMaximum = budget,
  totalEstimatedCost = 0,
  removingServiceId = '',
  remainingBudget = 45000,
  replacementContext,
  showBottomNavigation = true,
  searchValue,
  sortLabel = 'Top rated',
  onBack,
  onChangeSearch,
  onCategoryBudgetChange,
  onContinueSelectedServices,
  onAddService,
  onRemoveCoordinator,
  onRemoveService,
  onSelectService,
  onOpenSort,
  onConfirmReplacement,
  onSelectFilter,
  onSelectCategory,
  onSelectTab,
  onSelectVendor,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const isExploreMode = mode === 'explore'
  const hasSetBudget = hasBudget ?? remainingBudget > 0
  const hasPlanSelections = selectedServiceCount > 0
    || Boolean(assignedCoordinator)
    || coordinatorAssignmentStatus === 'awaiting_assignment'
  const useHorizontalCards = width >= 640
  const [internalSearch, setInternalSearch] = React.useState('')
  const [selectedFilter, setSelectedFilter] = React.useState<CategoryBrowseFilter>()
  const [budgetTrackWidth, setBudgetTrackWidth] = React.useState(1)
  const [draftCategoryBudget, setDraftCategoryBudget] = React.useState(categoryBudget)
  const [selectedExploreCategory, setSelectedExploreCategory] = React.useState('All')
  const [pendingReplacement, setPendingReplacement] = React.useState<CatalogService>()
  const [isReplacing, setIsReplacing] = React.useState(false)
  const [isSelectedServicesOpen, setIsSelectedServicesOpen] = React.useState(false)
  const selectedServicesSheetOffset = React.useRef(new Animated.Value(480)).current
  const query = searchValue ?? internalSearch
  const exploreCategories = React.useMemo(
    () => ['All', ...Array.from(new Set(services.map((service) => service.categoryName)))],
    [services]
  )
  React.useEffect(() => setDraftCategoryBudget(categoryBudget), [categoryBudget])
  React.useEffect(() => setSelectedFilter(undefined), [categoryName])

  const categoryFilters = React.useMemo(() => {
    const options: Array<{ id: string; label: string }> = [
      { id: 'withinBudget', label: 'Within Budget' },
      { id: 'available', label: 'Available' },
      { id: 'rating4', label: '4+ Rating' },
      { id: 'priceLow', label: 'Lower Price' },
    ]
    const records: Array<Record<string, unknown>> = services.map(
      (service) => service.categoryDetails ?? {}
    )
    if (categoryName.toLowerCase().includes('venue')) {
      options.push(
        { id: 'capacity', label: `Fits ${eventGuestCount} Guests` },
        { id: 'indoor', label: 'Indoor' },
        { id: 'outdoor', label: 'Outdoor' },
        { id: 'amenities', label: 'With Amenities' }
      )
    } else if (categoryName.toLowerCase().includes('cater')) {
      options.push(
        ...filters,
        { id: 'guestCapacity', label: 'Fits Guest Count' }
      )
      Array.from(new Set(records.flatMap((record) => Array.isArray(record.cuisines)
        ? record.cuisines.filter((item): item is string => typeof item === 'string') : [])))
        .slice(0, 4).forEach((value) => options.push({ id: `cuisine:${value}`, label: value }))
      Array.from(new Set(records.flatMap((record) => Array.isArray(record.cateringTypes)
        ? record.cateringTypes.filter((item): item is string => typeof item === 'string') : [])))
        .slice(0, 4).forEach((value) => options.push({ id: `cateringType:${value}`, label: value }))
    } else if (categoryName.toLowerCase().includes('photo')) {
      options.push(
        { id: 'photoVideo', label: 'Photo + Video' },
        { id: 'drone', label: 'Drone' },
        { id: 'coverage8', label: '8+ Hours' }
      )
    } else if (categoryName.toLowerCase().includes('host')) {
      Array.from(new Set(records.flatMap((record) => Array.isArray(record.languages)
        ? record.languages.filter((item): item is string => typeof item === 'string') : [])))
        .slice(0, 5).forEach((value) => options.push({ id: `language:${value}`, label: value }))
      Array.from(new Set(records.flatMap((record) => Array.isArray(record.hostingStyles)
        ? record.hostingStyles.filter((item): item is string => typeof item === 'string') : [])))
        .slice(0, 5).forEach((value) => options.push({ id: `style:${value}`, label: value }))
    }
    return options
  }, [categoryName, eventGuestCount, services])

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

  const recommendationRank = React.useCallback((vendor: CatalogService) => {
    const recommendation = vendor.budgetRecommendation
    if (!recommendation || recommendation.categoryBudget <= 0) return 1
    if (recommendation.isRecommended) return 4
    if (recommendation.isWithinBudget) return 3
    if (recommendation.calculatedAmount) return 0
    return 2
  }, [])

  const visibleVendors = services.filter((vendor) => {
    const normalizedQuery = query.trim().toLowerCase()

    if (
      isExploreMode &&
      selectedExploreCategory !== 'All' &&
      vendor.categoryName !== selectedExploreCategory
    ) {
      return false
    }

    if (!isExploreMode && selectedFilter) {
      const details: Record<string, unknown> = vendor.categoryDetails ?? {}
      const recommendation = vendor.budgetRecommendation
      const stringList = (key: string) => Array.isArray(details[key])
        ? (details[key] as unknown[]).filter((item): item is string => typeof item === 'string')
        : []
      if (selectedFilter === 'withinBudget' && !recommendation?.isWithinBudget) return false
      if (selectedFilter === 'available' && recommendation?.availabilityStatus === 'unavailable') return false
      if (selectedFilter === 'rating4' && (Number.parseFloat(vendor.rating) || 0) < 4) return false
      if (selectedFilter === 'priceLow' && vendor.minPrice > Math.max(categoryBudget, remainingBudget)) return false
      if (selectedFilter === 'under500') {
        const options = getCateringPricingOptions(vendor.categoryDetails, vendor.providerMinPrice)
        if (!options.some((option) => customerPriceFromProviderPrice(option.pricePerHead, vendor.commissionRate) < 500)) return false
      }
      if (['plated', 'buffet', 'packed'].includes(selectedFilter)
        && !vendor.cateringServiceTypes?.includes(selectedFilter as 'plated' | 'buffet' | 'packed')) return false
      if (selectedFilter === 'guestCapacity' && !cateringFit(vendor).fits) return false
      if (selectedFilter.startsWith('cuisine:') && !stringList('cuisines').includes(selectedFilter.slice(8))) return false
      if (selectedFilter.startsWith('cateringType:') && !stringList('cateringTypes').includes(selectedFilter.slice(14))) return false
      if (selectedFilter === 'capacity' && !getVenueBookingOptions(details).some((option) => option.capacity >= eventGuestCount)) return false
      if (selectedFilter === 'indoor' && !getVenueBookingOptions(details).some((option) => option.spaceType.toLowerCase().includes('indoor'))) return false
      if (selectedFilter === 'outdoor' && !getVenueBookingOptions(details).some((option) => option.spaceType.toLowerCase().includes('outdoor'))) return false
      if (selectedFilter === 'amenities' && !['airConditioning', 'chairs', 'tables', 'parking', 'restrooms', 'dressingRoom', 'kitchen', 'wifi', 'stage', 'pwdAccessibility'].some((key) => details[key] === true)) return false
      if (selectedFilter === 'photoVideo' && !(details.photoCoverage === true && details.videoCoverage === true)) return false
      if (selectedFilter === 'drone' && details.droneCoverage !== true) return false
      if (selectedFilter === 'coverage8' && Number(details.coverageDurationHours ?? 0) < 8) return false
      if (selectedFilter.startsWith('language:') && !stringList('languages').includes(selectedFilter.slice(9))) return false
      if (selectedFilter.startsWith('style:') && !stringList('hostingStyles').includes(selectedFilter.slice(6))) return false
    }

    if (!normalizedQuery) return true

    return (
      vendor.name.toLowerCase().includes(normalizedQuery) ||
      vendor.providerName.toLowerCase().includes(normalizedQuery) ||
      vendor.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    )
  }).sort((left, right) => {
    if (!isExploreMode) {
      const recommendationDifference = recommendationRank(right) - recommendationRank(left)
      if (recommendationDifference !== 0) return recommendationDifference

      const leftAvailability = left.budgetRecommendation?.availabilityStatus === 'unavailable' ? 0 : 1
      const rightAvailability = right.budgetRecommendation?.availabilityStatus === 'unavailable' ? 0 : 1
      if (leftAvailability !== rightAvailability) return rightAvailability - leftAvailability
    }

    const guestFitDifference = Number(cateringFit(right).fits) - Number(cateringFit(left).fits)
    if (guestFitDifference !== 0) return guestFitDifference
    const leftRating = Number.parseFloat(left.rating) || 0
    const rightRating = Number.parseFloat(right.rating) || 0
    return rightRating - leftRating || left.name.localeCompare(right.name)
  })
  const hasCategoryRecommendationBudget = !isExploreMode && visibleVendors.some(
    (vendor) => (vendor.budgetRecommendation?.categoryBudget ?? 0) > 0
  )
  const vendorSections = hasCategoryRecommendationBudget
    ? [
        {
          id: 'recommended',
          label: 'Recommended Within Budget',
          vendors: visibleVendors.filter((vendor) => vendor.budgetRecommendation?.isRecommended),
        },
        {
          id: 'review',
          label: 'Over Budget or Needs Review',
          vendors: visibleVendors.filter((vendor) => !vendor.budgetRecommendation?.isRecommended),
        },
      ].filter((section) => section.vendors.length > 0)
    : [{ id: 'all', label: '', vendors: visibleVendors }]

  const handleSearchChange = (value: string) => {
    setInternalSearch(value)
    onChangeSearch?.(value)
  }

  const handleFilterChange = (filter: CategoryBrowseFilter) => {
    setSelectedFilter((current) => current === filter ? undefined : filter)
    onSelectFilter?.(filter)
  }

  const commitCategoryBudget = async (amount: number) => {
    if (categoryBudgetLocked) return
    const normalized = Math.max(0, Math.min(Math.round(amount / 100) * 100, categoryBudgetMaximum))
    setDraftCategoryBudget(normalized)
    const saved = await onCategoryBudgetChange?.(normalized)
    if (saved === false) setDraftCategoryBudget(categoryBudget)
  }

  const handleBudgetTrackPress = (event: { nativeEvent: { locationX: number } }) => {
    if (categoryBudgetLocked || budgetTrackWidth <= 1 || categoryBudgetMaximum <= 0) return
    void commitCategoryBudget(
      (Math.max(0, Math.min(event.nativeEvent.locationX / budgetTrackWidth, 1)))
        * categoryBudgetMaximum
    )
  }

  const handleBudgetTrackLayout = (event: LayoutChangeEvent) => {
    setBudgetTrackWidth(Math.max(event.nativeEvent.layout.width, 1))
  }

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

  const closeSelectedServices = () => {
    Animated.timing(selectedServicesSheetOffset, {
      duration: 260,
      toValue: 480,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsSelectedServicesOpen(false)
    })
  }

  return (
    <View style={styles.screen}>
      {isExploreMode ? (
        <View style={styles.topAppBar}>
          <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
            <View style={styles.headerButton} />
            <Text style={styles.headerTitle}>EXPLORE SERVICES</Text>
            <View style={styles.headerButton} />
          </View>
        </View>
      ) : (
        <PlanningScreenHeader
          currentStep={replacementContext ? 4 : 3}
          label={replacementContext ? 'Replace Provider' : 'Choose Services'}
          nextAccessibilityLabel="Review selected services"
          nextEnabled={!replacementContext && selectedServiceCount > 0}
          onBack={onBack}
          onNext={
            replacementContext ? undefined : () => setIsSelectedServicesOpen(true)
          }
          title={replacementContext ? 'Change Provider' : 'Choose Services'}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          !isExploreMode &&
            !replacementContext &&
            hasPlanSelections &&
            styles.contentWithSelectedServicesAction,
          isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {replacementContext ? (
          <View style={styles.replacementBanner}>
            <Text style={styles.replacementEyebrow}>REPLACING PROVIDER</Text>
            <Text style={styles.replacementTitle}>{replacementContext.serviceName}</Text>
            <Text style={styles.replacementCopy}>
              Choose a replacement for {replacementContext.currentProviderName}. Your schedule
              will be checked again automatically.
            </Text>
          </View>
        ) : !isExploreMode ? (
          <View
            accessibilityLabel={
              hasSetBudget
                ? `Remaining budget: ${formatCurrency(remainingBudget)} pesos`
                : 'No budget set. Pay actual service costs'
            }
            style={styles.budgetPill}
          >
            <Text style={styles.budgetText}>
              {hasSetBudget
                ? `Remaining Budget: ₱${formatCurrency(remainingBudget)}`
                : 'Pay actual service costs'}
            </Text>
          </View>
        ) : null}

        <View style={styles.categoryHeader}>
          {!isExploreMode ? <Text style={styles.categoryIcon}>♨</Text> : null}
          <Text style={styles.categoryTitle}>
            {isExploreMode ? 'All Services' : categoryName}
          </Text>
        </View>

        {!isExploreMode && !replacementContext && hasSetBudget ? (
          <View style={styles.categoryBudgetCard}>
            <View style={styles.categoryBudgetHeading}>
              <View>
                <Text style={styles.categoryBudgetEyebrow}>{categoryName.toUpperCase()} BUDGET</Text>
                <Text style={styles.categoryBudgetAmount}>PHP {formatCurrency(draftCategoryBudget)}</Text>
              </View>
              <Text style={categoryBudgetLocked ? styles.categoryBudgetLocked : styles.categoryBudgetEditable}>
                {categoryBudgetLocked ? 'Locked to selection' : 'Adjustable'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`${categoryName} budget ${formatCurrency(draftCategoryBudget)} pesos`}
              accessibilityRole="adjustable"
              disabled={categoryBudgetLocked}
              onLayout={handleBudgetTrackLayout}
              onPress={handleBudgetTrackPress}
              style={styles.categoryBudgetTrackTouch}
            >
              <View style={styles.categoryBudgetTrack}>
                <View style={[styles.categoryBudgetFill, { width: `${categoryBudgetMaximum > 0 ? Math.min(draftCategoryBudget / categoryBudgetMaximum, 1) * 100 : 0}%` }]} />
                <View style={[styles.categoryBudgetThumb, { left: `${categoryBudgetMaximum > 0 ? Math.min(draftCategoryBudget / categoryBudgetMaximum, 1) * 100 : 0}%` }]} />
              </View>
            </Pressable>
            <View style={styles.categoryBudgetFooter}>
              <Text style={styles.categoryBudgetHint}>Remaining overall budget: PHP {formatCurrency(remainingBudget)}</Text>
              {!categoryBudgetLocked ? (
                <View style={styles.categoryBudgetButtons}>
                  <Pressable onPress={() => void commitCategoryBudget(draftCategoryBudget - 500)} style={styles.categoryBudgetStep}><Text style={styles.categoryBudgetStepText}>-500</Text></Pressable>
                  <Pressable onPress={() => void commitCategoryBudget(draftCategoryBudget + 500)} style={styles.categoryBudgetStep}><Text style={styles.categoryBudgetStepText}>+500</Text></Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {isExploreMode ? (
          <ScrollView
            contentContainerStyle={styles.exploreCategoryContent}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.exploreCategoryScroller}
          >
            {exploreCategories.map((option) => {
              const isSelected = selectedExploreCategory === option

              return (
                <Pressable
                  key={option}
                  accessibilityLabel={`Show ${option} services`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedExploreCategory(option)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                    {option}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : replacementContext ? null : (
          <ScrollView
            contentContainerStyle={styles.exploreCategoryContent}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.exploreCategoryScroller}
          >
            {categories.map((option) => {
              const isSelected = option.name === categoryName

              return (
                <Pressable
                  key={option.id}
                  accessibilityLabel={`Browse ${option.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelectCategory?.(option)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                    {option.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

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
          <>
            <ScrollView
              contentContainerStyle={styles.filterContent}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroller}
            >
              {categoryFilters.map((filter) => {
                const isSelected = filter.id === selectedFilter

                return (
                  <Pressable
                    key={filter.id}
                    accessibilityLabel={`Filter by ${filter.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleFilterChange(filter.id)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <Pressable
              accessibilityLabel={`Sort results. Current sort: ${sortLabel}`}
              accessibilityRole="button"
              onPress={onOpenSort}
              style={({ pressed }) => [styles.sortControl, pressed && styles.pressed]}
            >
              <Text style={styles.sortText}>Sort: {sortLabel}</Text>
              <Text style={styles.sortChevron}>⌄</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.resultsList}>
          {vendorSections.map((section) => (
            <View key={section.id} style={styles.recommendationSection}>
              {section.label ? (
                <View style={styles.recommendationSectionHeading}>
                  <Text style={styles.recommendationSectionTitle}>{section.label}</Text>
                  <Text style={styles.recommendationSectionCount}>{section.vendors.length}</Text>
                </View>
              ) : null}
              {section.vendors.map((vendor) => (
            <Pressable
              key={vendor.id}
              accessibilityLabel={`Open ${vendor.name}, rated ${vendor.rating}`}
              accessibilityRole="button"
              onPress={() => onSelectVendor?.(vendor.id)}
              style={({ pressed }) => [
                styles.vendorCard,
                useHorizontalCards && styles.vendorCardHorizontal,
                pressed && styles.cardPressed,
              ]}
            >
                <View
                style={[
                  styles.imagePanel,
                  useHorizontalCards && styles.imagePanelHorizontal,
                ]}
              >
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
              </View>

              <View
                style={[
                  styles.vendorCopy,
                  useHorizontalCards && styles.vendorCopyHorizontal,
                ]}
              >
                <View style={styles.vendorHeadingRow}>
                  <Text style={styles.vendorName}>{vendor.name}</Text>
                  <View style={styles.ratingGroup}>
                    <Text style={styles.star}>★</Text>
                    <Text style={styles.rating}>
                      {vendor.reviewCount > 0
                        ? `${vendor.rating} (${vendor.reviewCount})`
                        : vendor.rating}
                    </Text>
                  </View>
                </View>

                <Text style={styles.price}>{formatServicePrice(vendor)}</Text>

                {!isExploreMode
                  && vendor.budgetRecommendation
                  && vendor.budgetRecommendation.categoryBudget > 0 ? (
                  <View style={styles.recommendationBlock}>
                    <View style={styles.recommendationHeadingRow}>
                      <View
                        style={[
                          styles.recommendationBadge,
                          vendor.budgetRecommendation.isRecommended
                            ? styles.recommendationBadgeFit
                            : styles.recommendationBadgeReview,
                        ]}
                      >
                        <Text
                          style={[
                            styles.recommendationBadgeText,
                            vendor.budgetRecommendation.isRecommended
                              ? styles.recommendationBadgeTextFit
                              : styles.recommendationBadgeTextReview,
                          ]}
                        >
                          {vendor.budgetRecommendation.isWithinBudget
                            ? 'WITHIN BUDGET'
                            : vendor.budgetRecommendation.calculatedAmount
                              ? 'OVER BUDGET'
                              : 'PRICE CHECK NEEDED'}
                        </Text>
                      </View>
                      <Text style={styles.categoryBudgetText}>
                        Category: ₱{formatCurrency(vendor.budgetRecommendation.categoryBudget)}
                      </Text>
                    </View>
                    {vendor.budgetRecommendation.calculatedAmount ? (
                      <>
                        <Text style={styles.calculatedPrice}>
                          Event estimate: ₱{formatCurrency(vendor.budgetRecommendation.calculatedAmount)}
                        </Text>
                        {vendor.budgetRecommendation.pricingBasis ? (
                          <Text style={styles.pricingBasis}>
                            {vendor.budgetRecommendation.pricingBasis}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                    {vendor.budgetRecommendation.recommendedOptionName ? (
                      <Text style={styles.recommendedOption}>
                        Best fitting option: {vendor.budgetRecommendation.recommendedOptionName}
                      </Text>
                    ) : null}
                    <Text
                      style={
                        vendor.budgetRecommendation.isRecommended
                          ? styles.recommendationReasonFit
                          : styles.recommendationReasonReview
                      }
                    >
                      {vendor.budgetRecommendation.reason}
                    </Text>
                  </View>
                ) : vendor.categoryId === 'catering' && eventGuestCount > 0 ? (
                  <Text style={cateringFit(vendor).fits ? styles.guestFit : styles.guestMismatch}>
                    {cateringFit(vendor).fits ? 'Fits event guest count' : cateringFit(vendor).reason}
                  </Text>
                ) : null}

                <View style={styles.tagsRow}>
                  {vendor.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                {replacementContext ? (
                  <Pressable
                    accessibilityLabel={`Change to ${vendor.providerName}`}
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation()
                      setPendingReplacement(vendor)
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
            </View>
          ))}

          {visibleVendors.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {replacementContext ? 'No alternate providers available' : 'No services found'}
              </Text>
              <Text style={styles.emptyCopy}>
                {replacementContext
                  ? 'Another published provider in this category is required before this service can be changed.'
                  : 'Services will appear here after providers publish them.'}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isExploreMode && !replacementContext && hasPlanSelections ? (
        <View style={styles.selectedServicesBar}>
          <Pressable
            accessibilityLabel={`Open event plan. ${selectedServiceCount} services selected`}
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
              <Text style={styles.selectedServicesCountText}>{selectedServiceCount}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={closeSelectedServices}
        transparent
        visible={isSelectedServicesOpen}
      >
        <View style={styles.selectedServicesOverlay}>
          <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
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
                style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
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
                    PHP {formatCurrency(totalEstimatedCost)}
                  </Text>
                </View>
                {budget > 0 ? (
                  <View style={styles.reviewAllocationBlock}>
                    <View style={styles.reviewAllocationLabels}>
                      <Text style={styles.reviewBudgetLabel}>Budget: PHP {formatCurrency(budget)}</Text>
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
              </View>

              {assignedCoordinator ? (
                <View style={styles.reviewCoordinatorCard}>
                  {assignedCoordinator.avatarUrl ? (
                    <Image
                      accessibilityLabel={`${assignedCoordinator.name}, assigned event coordinator`}
                      source={{ uri: assignedCoordinator.avatarUrl }}
                      style={styles.reviewCoordinatorAvatar}
                    />
                  ) : (
                    <View style={styles.reviewCoordinatorFallback}>
                      <MaterialCommunityIcons color={palette.onPrimary} name="account-tie" size={22} />
                    </View>
                  )}
                  <View style={styles.reviewCoordinatorCopy}>
                    <Text style={styles.reviewCoordinatorEyebrow}>
                      {assignedCoordinator.status === 'pending'
                        ? 'COORDINATOR INVITATION PENDING'
                        : 'ASSIGNED EVENT COORDINATOR'}
                    </Text>
                    <Text style={styles.reviewCoordinatorName}>{assignedCoordinator.name}</Text>
                    {coordinatorPackage ? (
                      <Text style={styles.reviewCoordinatorPackage}>
                        {coordinatorPackage.name} · PHP {formatCurrency(coordinatorPackage.serviceSubtotal)}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityLabel="Remove coordinator booking"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={onRemoveCoordinator}
                    style={({ pressed }) => [styles.reviewRemoveButton, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons color={palette.primaryContainer} name="close" size={20} />
                  </Pressable>
                </View>
              ) : coordinatorAssignmentStatus === 'awaiting_assignment' ? (
                <View style={styles.reviewCoordinatorCard}>
                  <View style={styles.reviewCoordinatorFallback}>
                    <MaterialCommunityIcons color={palette.onPrimary} name="account-search" size={22} />
                  </View>
                  <View style={styles.reviewCoordinatorCopy}>
                    <Text style={styles.reviewCoordinatorEyebrow}>COORDINATOR ASSIGNMENT PENDING</Text>
                    <Text style={styles.reviewCoordinatorName}>MULTIVENT is finding your coordinator</Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.reviewServicesHeading}>Selected Services</Text>
              {selectedServices.map((service) => (
                <Pressable
                  key={service.id}
                  accessibilityLabel={`Open ${service.name}, ${service.status}`}
                  accessibilityRole="button"
                  onPress={() => {
                    closeSelectedServices()
                    onSelectService?.(service.id)
                  }}
                  style={({ pressed }) => [styles.selectedServiceRow, pressed && styles.pressed]}
                >
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
                  {service.status === 'Selected' ? (
                    <Pressable
                      accessibilityLabel={`Remove ${service.name} from selected services`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: removingServiceId === service.id }}
                      disabled={removingServiceId === service.id}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation()
                        onRemoveService?.(service)
                      }}
                      style={({ pressed }) => [
                        styles.reviewRemoveButton,
                        removingServiceId === service.id && styles.reviewRemoveButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        color={palette.primaryContainer}
                        name={removingServiceId === service.id ? 'progress-clock' : 'trash-can-outline'}
                        size={18}
                      />
                    </Pressable>
                  ) : null}
                  <Text style={styles.selectedServicePrice}>
                    PHP {formatCurrency(service.price)}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                accessibilityLabel="Add another service"
                accessibilityRole="button"
                onPress={() => {
                  closeSelectedServices()
                  onAddService?.()
                }}
                style={({ pressed }) => [styles.reviewAddServiceButton, pressed && styles.pressed]}
              >
                <Text style={styles.reviewAddServiceIcon}>+</Text>
                <Text style={styles.reviewAddServiceText}>Add Service</Text>
              </Pressable>
            </ScrollView>

            <Pressable
              accessibilityLabel="Continue with selected services"
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedServices.length === 0 }}
              disabled={selectedServices.length === 0}
              onPress={() => {
                closeSelectedServices()
                onContinueSelectedServices?.()
              }}
              style={({ pressed }) => [
                styles.sheetContinueButton,
                selectedServices.length === 0 && styles.sheetContinueButtonDisabled,
                pressed && styles.pressed,
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
        onRequestClose={() => {
          if (!isReplacing) setPendingReplacement(undefined)
        }}
        transparent
        visible={Boolean(pendingReplacement)}
      >
        <View style={styles.confirmationOverlay}>
          <View accessibilityViewIsModal style={styles.confirmationCard}>
            <View style={styles.confirmationIcon}>
              <Text style={styles.confirmationIconText}>?</Text>
            </View>
            <Text style={styles.confirmationTitle}>Confirm provider change</Text>
            <Text style={styles.confirmationCopy}>
              Replace {replacementContext?.currentProviderName} with{' '}
              {pendingReplacement?.providerName}? Your saved event details stay the same.
            </Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={isReplacing}
                onPress={() => setPendingReplacement(undefined)}
                style={({ pressed }) => [styles.confirmationCancel, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isReplacing}
                onPress={async () => {
                  if (!pendingReplacement || isReplacing) return
                  setIsReplacing(true)
                  const changed = await onConfirmReplacement?.(pendingReplacement.id)
                  setIsReplacing(false)
                  if (changed !== false) setPendingReplacement(undefined)
                }}
                style={({ pressed }) => [
                  styles.confirmationConfirm,
                  isReplacing && styles.confirmationDisabled,
                  pressed && styles.changeProviderButtonPressed,
                ]}
              >
                <Text style={styles.confirmationConfirmText}>
                  {isReplacing ? 'CHANGING...' : 'CONFIRM CHANGE'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showBottomNavigation && !isWide ? (
        <ClientBottomNavigation activeTab="explore" onSelectTab={onSelectTab} />
      ) : null}
    </View>
  )
}

const palette = {
  background: '#F9F9F9',
  surfaceContainerHigh: '#E8E8E8',
  surfaceHighest: '#E2E2E2',
  surfaceVariant: '#E2E2E2',
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
    paddingBottom: 112,
  },
  contentWithSelectedServicesAction: {
    paddingBottom: 32,
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
  selectedServicesOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  selectedServicesScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  selectedServicesSheet: {
    width: '100%',
    maxHeight: '82%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
  },
  selectedServicesSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  selectedServicesSheetEyebrow: {
    color: palette.primaryContainer,
    fontSize: 10,
    lineHeight: 14,
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
    borderRadius: 18,
    backgroundColor: palette.surfaceContainerHigh,
  },
  sheetCloseText: {
    color: palette.text,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '300',
  },
  selectedServicesSheetContent: {
    gap: 12,
    paddingBottom: 18,
  },
  reviewBudgetCard: {
    gap: 16,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  reviewTotalCopy: {
    gap: 4,
  },
  reviewTotalLabel: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
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
    fontSize: 11,
    lineHeight: 15,
  },
  reviewAllocatedLabel: {
    color: palette.primaryContainer,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  reviewProgressTrack: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: palette.surfaceContainerHigh,
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
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reviewActualCostText: {
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  reviewCoordinatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  reviewCoordinatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  reviewCoordinatorFallback: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: palette.primaryContainer,
  },
  reviewCoordinatorCopy: {
    flex: 1,
    gap: 2,
  },
  reviewCoordinatorEyebrow: {
    color: palette.primaryContainer,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  reviewCoordinatorName: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  reviewCoordinatorPackage: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  reviewServicesHeading: {
    color: palette.text,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 2,
  },
  selectedServiceRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  selectedServiceImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  selectedServiceCopy: {
    flex: 1,
    gap: 2,
  },
  selectedServiceCategory: {
    color: palette.primaryContainer,
    fontSize: 10,
    lineHeight: 14,
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
    fontSize: 11,
    lineHeight: 15,
  },
  selectedServicePrice: {
    maxWidth: 92,
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  reviewRemoveButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#F8EDEF',
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
    borderColor: palette.primaryContainer,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  reviewAddServiceIcon: {
    color: palette.primaryContainer,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '500',
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
  },
  sheetContinueButtonDisabled: { opacity: 0.48 },
  sheetContinueText: {
    color: palette.onPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
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
  replacementBanner: {
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 14,
    backgroundColor: '#FFF7F8',
    padding: 18,
    marginBottom: 20,
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
  categoryIcon: {
    color: palette.primaryContainer,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: '600',
  },
  categoryTitle: {
    color: palette.primaryContainer,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '700',
  },
  categoryBudgetCard: {
    gap: 12,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 18,
  },
  categoryBudgetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBudgetEyebrow: { color: palette.secondary, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 },
  categoryBudgetAmount: { color: palette.primaryContainer, fontSize: 22, lineHeight: 29, fontWeight: '800', marginTop: 2 },
  categoryBudgetLocked: { color: palette.primaryContainer, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  categoryBudgetEditable: { color: '#287A49', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  categoryBudgetTrackTouch: { paddingVertical: 10 },
  categoryBudgetTrack: { height: 6, borderRadius: 3, backgroundColor: palette.surfaceContainerHigh },
  categoryBudgetFill: { height: 6, borderRadius: 3, backgroundColor: palette.primaryContainer },
  categoryBudgetThumb: { position: 'absolute', top: -6, width: 18, height: 18, borderRadius: 9, marginLeft: -9, backgroundColor: palette.primaryContainer, borderWidth: 3, borderColor: '#FFFFFF' },
  categoryBudgetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryBudgetHint: { flex: 1, color: palette.secondary, fontSize: 11, lineHeight: 16 },
  categoryBudgetButtons: { flexDirection: 'row', gap: 6 },
  categoryBudgetStep: { borderRadius: 12, backgroundColor: palette.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 6 },
  categoryBudgetStepText: { color: palette.primaryContainer, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  searchField: {
    width: '100%',
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: palette.surfaceContainerHigh,
    paddingHorizontal: 16,
  },
  searchIcon: {
    color: palette.secondary,
    fontSize: 24,
    lineHeight: 26,
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
  filterScroller: {
    marginHorizontal: -20,
    marginTop: 12,
  },
  exploreCategoryScroller: { marginHorizontal: -20, marginBottom: 12 },
  exploreCategoryContent: { gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  filterContent: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.surfaceContainerHigh,
    borderRadius: 20,
    backgroundColor: palette.surfaceContainerHigh,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipSelected: {
    borderColor: palette.primaryContainer,
    backgroundColor: palette.primaryContainer,
    shadowColor: palette.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterLabel: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  filterLabelSelected: {
    color: palette.onPrimary,
  },
  sortControl: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  sortText: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 24,
  },
  sortChevron: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },
  resultsList: {
    gap: 16,
    marginBottom: 80,
  },
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.surfaceVariant,
    borderRadius: 8,
    backgroundColor: palette.surfaceHighest,
  },
  vendorCardHorizontal: {
    minHeight: 190,
    flexDirection: 'row',
  },
  imagePanel: {
    width: '100%',
    height: 192,
    backgroundColor: palette.surfaceVariant,
  },
  imagePanelHorizontal: {
    width: '33.333%',
    height: '100%',
    minHeight: 190,
  },
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
    padding: 16,
  },
  vendorCopyHorizontal: {
    flex: 1,
    justifyContent: 'center',
  },
  vendorHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  vendorName: {
    flex: 1,
    color: palette.primary,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    color: palette.primaryContainer,
    fontSize: 15,
    lineHeight: 17,
  },
  rating: {
    color: palette.secondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  price: {
    color: palette.primaryContainer,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
  },
  recommendationBlock: {
    gap: 4,
    marginTop: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  recommendationHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  recommendationBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendationBadgeFit: { backgroundColor: '#DDEFE5' },
  recommendationBadgeReview: { backgroundColor: '#F8E0E2' },
  recommendationBadgeText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  recommendationBadgeTextFit: { color: '#245E43' },
  recommendationBadgeTextReview: { color: '#8E2430' },
  categoryBudgetText: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  calculatedPrice: {
    color: palette.primaryContainer,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  pricingBasis: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 14,
  },
  recommendedOption: {
    color: palette.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  recommendationReasonFit: {
    color: '#2E6D4E',
    fontSize: 10,
    lineHeight: 15,
  },
  recommendationReasonReview: {
    color: '#8E2430',
    fontSize: 10,
    lineHeight: 15,
  },
  guestFit: { color: '#2E6D4E', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  guestMismatch: { color: '#A12A35', fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tag: {
    borderRadius: 3,
    backgroundColor: palette.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: palette.secondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  changeProviderButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: palette.primaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 18,
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
