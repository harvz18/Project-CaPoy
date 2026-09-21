import { Text } from '../components/AppText'
import React from 'react'
import {
  Image,
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

export type CategoryBrowseFilter = 'plated' | 'buffet' | 'packed' | 'under500'
export type CategoryBrowseVendor = string
export type CategoryBrowseTab = ClientMainTab | 'vendors' | 'budget'

interface CategoryBrowseScreenProps {
  categoryName?: string
  categories?: ServiceCategoryOption[]
  hasBudget?: boolean
  mode?: 'explore' | 'planning'
  services?: CatalogService[]
  selectedServiceCount?: number
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
  onOpenBudget?: () => void
  onOpenSelectedServices?: () => void
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
  hasBudget,
  mode = 'planning',
  services = [],
  selectedServiceCount = 0,
  remainingBudget = 45000,
  replacementContext,
  showBottomNavigation = true,
  searchValue,
  sortLabel = 'Relevance',
  onBack,
  onChangeSearch,
  onOpenBudget,
  onOpenSelectedServices,
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
  const useHorizontalCards = width >= 640
  const [internalSearch, setInternalSearch] = React.useState('')
  const [selectedFilter, setSelectedFilter] = React.useState<CategoryBrowseFilter>('buffet')
  const [selectedExploreCategory, setSelectedExploreCategory] = React.useState('All')
  const [pendingReplacement, setPendingReplacement] = React.useState<CatalogService>()
  const [isReplacing, setIsReplacing] = React.useState(false)
  const query = searchValue ?? internalSearch
  const exploreCategories = React.useMemo(
    () => ['All', ...Array.from(new Set(services.map((service) => service.categoryName)))],
    [services]
  )

  const visibleVendors = services.filter((vendor) => {
    const normalizedQuery = query.trim().toLowerCase()

    if (
      isExploreMode &&
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
  })

  const handleSearchChange = (value: string) => {
    setInternalSearch(value)
    onChangeSearch?.(value)
  }

  const handleFilterChange = (filter: CategoryBrowseFilter) => {
    setSelectedFilter(filter)
    onSelectFilter?.(filter)
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
          onNext={replacementContext ? undefined : onOpenSelectedServices}
          title={replacementContext ? 'Change Provider' : 'Choose Services'}
        />
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          !isExploreMode &&
            !replacementContext &&
            selectedServiceCount > 0 &&
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
          <Pressable
            accessibilityLabel={
              hasSetBudget
                ? `Remaining budget: ${formatCurrency(remainingBudget)} pesos`
                : 'No budget set. Pay actual service costs'
            }
            accessibilityRole="button"
            onPress={onOpenBudget}
            style={({ pressed }) => [styles.budgetPill, pressed && styles.budgetPressed]}
          >
            <Text style={styles.budgetText}>
              {hasSetBudget
                ? `Remaining Budget: ₱${formatCurrency(remainingBudget)}`
                : 'Pay actual service costs'}
            </Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        ) : null}

        <View style={styles.categoryHeader}>
          {!isExploreMode ? <Text style={styles.categoryIcon}>♨</Text> : null}
          <Text style={styles.categoryTitle}>
            {isExploreMode ? 'All Services' : categoryName}
          </Text>
        </View>

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

        {!isExploreMode && categoryName.toLowerCase().includes('catering') ? (
          <>
            <ScrollView
              contentContainerStyle={styles.filterContent}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroller}
            >
              {filters.map((filter) => {
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
          {visibleVendors.map((vendor) => (
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
                <Image
                  accessibilityLabel={vendor.imageLabel}
                  resizeMode="cover"
                  source={{ uri: vendor.imageUrl }}
                  style={styles.vendorImage}
                />
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

      {!isExploreMode && !replacementContext && selectedServiceCount > 0 ? (
        <View style={styles.selectedServicesBar}>
          <Pressable
            accessibilityLabel={`Open selected services. ${selectedServiceCount} selected`}
            accessibilityRole="button"
            onPress={onOpenSelectedServices}
            style={({ pressed }) => [
              styles.selectedServicesButton,
              pressed && styles.selectedServicesButtonPressed,
            ]}
          >
            <View>
              <Text style={styles.selectedServicesButtonText}>Selected Services</Text>
              <Text style={styles.selectedServicesButtonHint}>
                Review your current event selections
              </Text>
            </View>
            <View style={styles.selectedServicesCount}>
              <Text style={styles.selectedServicesCountText}>{selectedServiceCount}</Text>
            </View>
            <Text style={styles.selectedServicesArrow}>{'\u2192'}</Text>
          </Pressable>
        </View>
      ) : null}

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
