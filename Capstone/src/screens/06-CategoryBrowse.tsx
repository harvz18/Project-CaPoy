import React from 'react'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { PlanningStepIndicator } from '../components/PlanningStepIndicator'
import { CatalogService, formatServicePrice, mockCatalogServices } from '../lib/catalog'

export type CategoryBrowseFilter = 'plated' | 'buffet' | 'packed' | 'under500'
export type CategoryBrowseVendor = string
export type CategoryBrowseTab = 'explore' | 'vendors' | 'budget' | 'profile'

interface CategoryBrowseScreenProps {
  services?: CatalogService[]
  remainingBudget?: number
  searchValue?: string
  sortLabel?: string
  onBack?: () => void
  onChangeSearch?: (value: string) => void
  onMore?: () => void
  onOpenBudget?: () => void
  onOpenSort?: () => void
  onSelectFilter?: (filter: CategoryBrowseFilter) => void
  onSelectTab?: (tab: CategoryBrowseTab) => void
  onSelectVendor?: (vendor: CategoryBrowseVendor) => void
}

const filters = [
  { id: 'plated' as const, label: 'Plated' },
  { id: 'buffet' as const, label: 'Buffet' },
  { id: 'packed' as const, label: 'Packed' },
  { id: 'under500' as const, label: 'Under ₱500/head' },
] as const

const navigationTabs = [
  { id: 'explore' as const, icon: '◎', label: 'Explore' },
  { id: 'vendors' as const, icon: '◈', label: 'Vendors' },
  { id: 'budget' as const, icon: '₱', label: 'Budget' },
  { id: 'profile' as const, icon: '○', label: 'Profile' },
] as const

const formatCurrency = (value: number) =>
  Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const CategoryBrowseScreen: React.FC<CategoryBrowseScreenProps> = ({
  services = mockCatalogServices,
  remainingBudget = 45000,
  searchValue,
  sortLabel = 'Relevance',
  onBack,
  onChangeSearch,
  onMore,
  onOpenBudget,
  onOpenSort,
  onSelectFilter,
  onSelectTab,
  onSelectVendor,
}) => {
  const { width } = useWindowDimensions()
  const isWide = width >= 768
  const useHorizontalCards = width >= 640
  const [internalSearch, setInternalSearch] = React.useState('')
  const [selectedFilter, setSelectedFilter] = React.useState<CategoryBrowseFilter>('buffet')
  const query = searchValue ?? internalSearch

  const visibleVendors = services.filter((vendor) => {
    const normalizedQuery = query.trim().toLowerCase()

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
      <View style={styles.topAppBar}>
        <View style={[styles.topAppBarContent, isWide && styles.horizontalPaddingWide]}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Browse Categories</Text>

          <Pressable
            accessibilityLabel="More options"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onMore}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Text style={styles.moreIcon}>⋮</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.stepWrapper, isWide && styles.horizontalPaddingWide]}>
        <PlanningStepIndicator currentStep={3} label="Choose Services" />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide ? styles.horizontalPaddingWide : styles.horizontalPaddingMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityLabel={`Remaining budget: ${formatCurrency(remainingBudget)} pesos`}
          accessibilityRole="button"
          onPress={onOpenBudget}
          style={({ pressed }) => [styles.budgetPill, pressed && styles.budgetPressed]}
        >
          <Text style={styles.budgetText}>
            Remaining Budget: ₱{formatCurrency(remainingBudget)}
          </Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>

        <View style={styles.categoryHeader}>
          <Text style={styles.categoryIcon}>♨</Text>
          <Text style={styles.categoryTitle}>Catering</Text>
        </View>

        <View style={styles.searchField}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search caterers"
            onChangeText={handleSearchChange}
            placeholder="Search caterers"
            placeholderTextColor={palette.secondary}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>

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
              </View>
            </Pressable>
          ))}

          {visibleVendors.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No caterers found</Text>
              <Text style={styles.emptyCopy}>Try a different name or service type.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isWide ? (
        <View style={styles.bottomNavigation}>
          {navigationTabs.map((tab) => {
            const isActive = tab.id === 'vendors'

            return (
              <Pressable
                key={tab.id}
                accessibilityLabel={`Open ${tab.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => onSelectTab?.(tab.id)}
                style={({ pressed }) => [
                  styles.navItem,
                  isActive && styles.navItemActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.navIcon, isActive && styles.navContentActive]}>
                  {tab.icon}
                </Text>
                <Text style={[styles.navLabel, isActive && styles.navContentActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
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
    borderBottomColor: palette.outlineVariant,
    backgroundColor: palette.background,
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
    color: palette.primary,
    fontSize: 28,
    lineHeight: 30,
  },
  moreIcon: {
    color: palette.primary,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  headerTitle: {
    color: palette.primary,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 112,
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
