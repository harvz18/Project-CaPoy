import { supabase, supabaseConfig } from './supabase'
import {
  customerPriceFromProviderPrice,
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
} from './pricing'
import {
  getVenueBookingOptions,
  normalizeCategoryDetails,
  type CateringPricingOption,
  type CateringCustomMenu,
  type ServiceCategoryDetails,
  type VenueBookingOption,
  type VenueBookingRules,
} from './service-category-details'
import type { FloristServiceConfiguration } from './florist'
import {
  photoVideoBookingConfigurationFrom,
  type PhotoVideoBookingConfiguration,
} from './photo-video-booking'
import {
  isPhotoVideoPackageConfiguration,
  photoVideoPackageDraftsFrom,
} from './photo-video'

export type CatalogCategoryId =
  | 'venues'
  | 'photography'
  | 'catering'
  | 'florists'
  | 'attire'
  | 'eventOrganizers'
  | 'hosts'
  | 'soundLights'

export type CateringServiceType = 'plated' | 'buffet' | 'packed'

export interface ServiceCategoryOption {
  id: string
  name: string
}

export interface CoordinatorReview {
  comment: string
  createdAt: string
  eventType: string
  id: string
  rating: number
}

export interface CoordinatorPackageItem {
  customCateringMenu?: CateringCustomMenu
  cateringOptions: CateringPricingOption[]
  categoryName: string
  commissionRate: number
  customerUnitPrice: number
  estimatedAmount: number
  pricingUnit: 'event' | 'person' | 'hour' | 'day'
  requiresCateringOption: boolean
  requiresCateringMenu: boolean
  providerId: string
  providerName: string
  providerPrice: number
  serviceId: string
  serviceName: string
  venueOptions: VenueBookingOption[]
  venueRules?: VenueBookingRules
}

export interface CoordinatorPackage {
  description: string
  eventType: 'wedding' | 'preWedding' | 'postWedding'
  id: string
  isAvailable: boolean
  items: CoordinatorPackageItem[]
  name: string
  serviceSubtotal: number
  unavailableReason?: string
}

export interface BudgetRecommendation {
  availabilityStatus: 'available' | 'schedule_required' | 'unavailable'
  calculatedAmount?: number
  categoryBudget: number
  categoryKey: string
  guestRequirementMet: boolean
  isRecommended: boolean
  isWithinBudget: boolean
  pricingBasis: string
  reason: string
  recommendedOptionId?: string
  recommendedOptionName?: string
}

export interface ServiceDecisionSignal {
  averageRating: number
  bookingCount: number
  isMostBooked: boolean
  popularityRank: number
  reviewCount: number
}

export const fallbackServiceCategories: ServiceCategoryOption[] = [
  { id: 'attire', name: 'Attire' },
  { id: 'catering', name: 'Catering' },
  { id: 'eventOrganizers', name: 'Event Organizer' },
  { id: 'florists', name: 'Florists' },
  { id: 'hosts', name: 'Host/Emcee' },
  { id: 'photography', name: 'Photography' },
  { id: 'soundLights', name: 'Sound & Lights' },
  { id: 'venues', name: 'Venues & Estates' },
]

export interface CatalogService {
  bookingCount?: number
  bookingPackageId?: string
  bookingProviderId?: string
  bookingServiceId?: string
  budgetRecommendation?: BudgetRecommendation
  coordinatorUserId?: string
  coordinatorReviews?: CoordinatorReview[]
  coordinatorPackages?: CoordinatorPackage[]
  coordinatorAvailable?: boolean
  coordinatorAvailabilityNotes?: string
  coordinatorCapabilities?: string[]
  coordinatorCertifications?: string[]
  coordinatorEventTypesHandled?: string[]
  coordinatorPortfolioSummary?: string
  coordinatorServiceInclusions?: string[]
  coordinatorSkills?: string[]
  coordinatorUnavailableReason?: string
  coordinatorYearsExperience?: number
  coordinatorSpecializations?: string[]
  id: string
  categoryId: CatalogCategoryId
  categoryDbId?: string
  categoryName: string
  categoryDetails?: ServiceCategoryDetails
  cateringServiceTypes?: CateringServiceType[]
  commissionRate: number
  description: string
  detail: string
  galleryUrls?: string[]
  floristConfiguration?: FloristServiceConfiguration
  photoVideoConfiguration?: PhotoVideoBookingConfiguration
  imageLabel: string
  imageUrl: string
  isMostBooked?: boolean
  isMock?: boolean
  kind?: 'coordinator' | 'service'
  location?: string
  maxPrice?: number
  minPrice: number
  providerMinPrice: number
  name: string
  negativeSentimentCount?: number
  packageId?: string
  packages?: Array<{
    description: string
    discountAmount: number
    discountType: 'none' | 'percentage' | 'fixed'
    discountValue: number
    id: string
    inclusions: string[]
    name: string
    originalPrice?: number
    price: number
    providerPrice: number
    pricingMode: 'composed' | 'legacy'
    cateringDetails?: ServiceCategoryDetails
    cateringServiceId?: string
    isVenueCatering?: boolean
    serviceId: string
    serviceNames: string[]
    unit?: 'event' | 'person' | 'hour' | 'day'
  }>
  pricingDetails?: string
  pricingModel?: 'fixed' | 'startingAt' | 'customQuote'
  pricingUnit?: 'event' | 'person' | 'hour' | 'day'
  popularityRank?: number
  positiveSentimentCount?: number
  providerId?: string
  providerUserId?: string
  providerName: string
  rating: string
  reviewCount: number
  tags: string[]
}

export const categoryNameToId = (name: string): CatalogCategoryId => {
  const normalized = name.toLowerCase()

  if (normalized.includes('photo')) return 'photography'
  if (normalized.includes('venue') || normalized.includes('estate')) return 'venues'
  if (normalized.includes('flor')) return 'florists'
  if (normalized.includes('attire') || normalized.includes('gown')) return 'attire'
  if (normalized.includes('organizer') || normalized.includes('coordinator')) {
    return 'eventOrganizers'
  }
  if (normalized.includes('host') || normalized.includes('emcee')) return 'hosts'
  if (normalized.includes('sound') || normalized.includes('light')) return 'soundLights'

  return 'catering'
}

export const catalogCategoryName = (id: CatalogCategoryId) =>
  fallbackServiceCategories.find((category) => category.id === id)?.name ?? 'Services'

const textFrom = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const numberFrom = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const textListFrom = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []

const usableImageUrl = (value: unknown) => {
  const url = textFrom(value, '')
  return /^https?:\/\//i.test(url) ? url : ''
}

const getNestedText = (value: unknown, key: string, fallback: string) => {
  const source = Array.isArray(value) ? value[0] : value

  if (!source || typeof source !== 'object' || !(key in source)) {
    return fallback
  }

  return textFrom((source as Record<string, unknown>)[key], fallback)
}

const getNestedId = (value: unknown, fallback = '') => {
  const source = Array.isArray(value) ? value[0] : value

  if (!source || typeof source !== 'object' || !('id' in source)) {
    return fallback
  }

  return textFrom((source as Record<string, unknown>).id, fallback ?? '')
}

const nestedRecord = (value: unknown): Record<string, unknown> | undefined => {
  const source = Array.isArray(value) ? value[0] : value
  return source && typeof source === 'object' ? source as Record<string, unknown> : undefined
}

const getPackages = (value: unknown, commissionRate: number) => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const record = item as Record<string, unknown>
    if (record.is_deleted === true || record.is_active === false) return []
    const id = textFrom(record.id, '')
    const name = textFrom(record.name, '')
    const providerPrice = numberFrom(record.price, 0)
    const providerSubtotal = numberFrom(record.subtotal, providerPrice)
    const packageItems = Array.isArray(record.service_package_items)
      ? (record.service_package_items as Array<Record<string, unknown>>)
          .sort((left, right) => numberFrom(left.position, 0) - numberFrom(right.position, 0))
      : []
    const serviceNames = packageItems.flatMap((packageItem) => {
      const serviceName = getNestedText(packageItem.services, 'name', '')
      return serviceName ? [serviceName] : []
    })
    const cateringComponent = packageItems.find((packageItem) => {
      const packageService = nestedRecord(packageItem.services)
      return /cater/i.test(getNestedText(packageService?.service_categories, 'name', ''))
    })
    const cateringService = cateringComponent ? nestedRecord(cateringComponent.services) : undefined
    const combinedDetails = Array.isArray(record.venue_catering_package_details)
      ? record.venue_catering_package_details[0]
      : record.venue_catering_package_details
    const isVenueCatering = Boolean(combinedDetails && typeof combinedDetails === 'object')
    const discountType = ['none', 'percentage', 'fixed'].includes(String(record.discount_type))
      ? record.discount_type as 'none' | 'percentage' | 'fixed'
      : 'none'

    if (!id || !name) return []

    return [
      {
        description: textFrom(record.description, ''),
        discountAmount: numberFrom(record.discount_amount, 0),
        discountType,
        discountValue: numberFrom(record.discount_value, 0),
        id,
        inclusions: Array.isArray(record.inclusions)
          ? record.inclusions.filter(
              (inclusion): inclusion is string => typeof inclusion === 'string'
            )
          : [],
        name,
        originalPrice: providerSubtotal > providerPrice
          ? customerPriceFromProviderPrice(providerSubtotal, commissionRate)
          : undefined,
        price: customerPriceFromProviderPrice(providerPrice, commissionRate),
        providerPrice,
        pricingMode: record.pricing_mode === 'composed'
          ? 'composed' as const
          : 'legacy' as const,
        cateringDetails: cateringService
          ? normalizeCategoryDetails('Catering', cateringService.category_details)
          : undefined,
        cateringServiceId: cateringService ? textFrom(cateringService.id, '') || undefined : undefined,
        isVenueCatering,
        serviceId: textFrom(record.service_id, ''),
        serviceNames,
        unit: ['event', 'person', 'hour', 'day'].includes(String(record.pricing_unit))
          ? (record.pricing_unit as 'event' | 'person' | 'hour' | 'day')
          : undefined,
      },
    ]
  })
}

/**
 * Display-only Philippine peso formatting. Monetary values remain numeric in
 * planning, booking, and payment payloads; this helper is intentionally never
 * used to prepare a value for persistence.
 */
export const formatPeso = (value: number) => {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0

  return `₱${normalized.toLocaleString('en-PH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`
}

export const formatServicePrice = (service: CatalogService) => {
  const venueStartingPrice = service.categoryId === 'venues'
    ? service.budgetRecommendation?.calculatedAmount
    : undefined
  if (venueStartingPrice && venueStartingPrice > 0) {
    return `From ${formatPeso(venueStartingPrice)}`
  }
  const hasOptionLevelVenuePricing = service.categoryId === 'venues'
    && getVenueBookingOptions(service.categoryDetails).some((option) => (
      Boolean(option.pricingUnit && option.baseRate && option.baseRate > 0)
    ))
  if (hasOptionLevelVenuePricing && service.budgetRecommendation) {
    return 'No eligible venue option'
  }
  if (service.pricingModel === 'customQuote' || service.minPrice <= 0) return 'Request a quote'

  const unit = service.pricingUnit
    ? ` / ${service.pricingUnit === 'person' ? 'person' : service.pricingUnit}`
    : ''

  if (service.maxPrice && service.maxPrice > service.minPrice) {
    return `${formatPeso(service.minPrice)} - ${formatPeso(service.maxPrice)}${unit || ' / person'}`
  }

  const prefix = service.pricingModel === 'startingAt' ? 'From ' : ''
  return `${prefix}${formatPeso(service.minPrice)}${unit}`
}

// Venue option prices are event-specific. Keep the persisted service price
// untouched for booking calculations and use this read-only value solely for
// marketplace filtering and price sorting.
export const marketplaceStartingPrice = (service: CatalogService) => (
  service.categoryId === 'venues'
    && service.budgetRecommendation?.calculatedAmount
    && service.budgetRecommendation.calculatedAmount > 0
    ? service.budgetRecommendation.calculatedAmount
    : service.minPrice
)

const getCateringServiceTypes = (value: unknown): CateringServiceType[] => {
  if (!Array.isArray(value)) return []

  return value.filter(
    (item): item is CateringServiceType =>
      item === 'plated' || item === 'buffet' || item === 'packed'
  )
}

export const fetchCatalogServices = async (): Promise<CatalogService[]> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return []
  }

  const baseSelection =
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, provider_profiles(id, user_id, business_name), service_categories(id, name), service_packages(id, service_id, name, description, price, inclusions, pricing_unit, pricing_mode, is_active, is_deleted), reviews(rating)'
  const detailedSelection =
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details, catering_service_types, category_details, provider_profiles(id, user_id, business_name), service_categories(id, name), service_packages(id, service_id, name, description, price, inclusions, pricing_unit, pricing_mode, subtotal, discount_type, discount_value, discount_amount, is_active, is_deleted, configuration, image_urls, venue_catering_package_details(venue_service_id, catering_service_id, venue_option_id), service_package_items(position, services(id, name, category_details, service_categories(name))), florist_package_arrangements(arrangement_id, included_quantity, customization_allowed), florist_package_add_ons(id, name, price, pricing_unit, is_active)), florist_arrangements(id, name, category, description, base_price, pricing_unit, minimum_quantity, maximum_quantity, is_active, display_order, florist_arrangement_option_groups(id, name, selection_type, is_required, minimum_selections, maximum_selections, is_active, display_order, florist_arrangement_options(id, name, price_modifier, price_modifier_type, is_active, display_order))), florist_service_fulfillment_options(id, fulfillment_kind, name, price, is_active, display_order), reviews(rating, analysis_status, sentiment_label)'

  const [detailedResult, commissionResult, includedPackageResult] = await Promise.all([
    supabase
      .from('services')
      .select(detailedSelection)
      .eq('status', 'active')
      .eq('is_available', true)
      .limit(1000),
    supabase.rpc('get_public_commission_rate'),
    supabase
      .from('service_package_items')
      .select(
        'service_id, service_packages(id, service_id, name, description, price, inclusions, pricing_unit, pricing_mode, subtotal, discount_type, discount_value, discount_amount, is_active, is_deleted, venue_catering_package_details(venue_service_id, catering_service_id, venue_option_id), service_package_items(position, services(id, name, category_details, service_categories(name))))'
      )
      .limit(5000),
  ])
  const commissionRate = normalizeCommissionRate(
    commissionResult.data,
    DEFAULT_COMMISSION_RATE
  )
  const includedPackagesByService = new Map<string, Array<Record<string, unknown>>>()

  if (!includedPackageResult.error && Array.isArray(includedPackageResult.data)) {
    includedPackageResult.data.forEach((entry) => {
      const row = entry as unknown as Record<string, unknown>
      const serviceId = textFrom(row.service_id, '')
      const packageValue = Array.isArray(row.service_packages)
        ? row.service_packages[0]
        : row.service_packages

      if (!serviceId || !packageValue || typeof packageValue !== 'object') return
      const current = includedPackagesByService.get(serviceId) ?? []
      current.push(packageValue as Record<string, unknown>)
      includedPackagesByService.set(serviceId, current)
    })
  }

  const fallbackResult = detailedResult.error
    ? await supabase
      .from('services')
      .select(baseSelection)
      .eq('status', 'active')
      .eq('is_available', true)
      .limit(1000)
    : null

  const data = (fallbackResult?.data ?? detailedResult.data) as unknown[] | null
  const error = fallbackResult?.error ?? detailedResult.error

  if (error || !data || data.length === 0) {
    return []
  }

  const services = data.map((row, index) => {
    const record = row as Record<string, unknown>
    const categoryName = getNestedText(record.service_categories, 'name', 'Catering')
    const providerName = getNestedText(record.provider_profiles, 'business_name', 'Provider')
    const name = textFrom(record.name, providerName)
    const serviceId = textFrom(record.id, `service-${index}`)
    const directlyOwnedPackages = Array.isArray(record.service_packages)
      ? record.service_packages as Array<Record<string, unknown>>
      : []
    const packageRows = [
      ...directlyOwnedPackages,
      ...(includedPackagesByService.get(serviceId) ?? []),
    ].filter((item, itemIndex, items) => {
      const packageId = textFrom(item.id, '')
      return packageId.length > 0
        && items.findIndex((candidate) => textFrom(candidate.id, '') === packageId) === itemIndex
    })
    const packages = getPackages(packageRows, commissionRate)
    const photoVideoPackages = packageRows.flatMap((item) => {
      if (!isPhotoVideoPackageConfiguration(item.configuration)) return []
      return photoVideoPackageDraftsFrom({
        photoVideoPackages: [{
          ...(item.configuration as Record<string, unknown>),
          id: textFrom(item.id, '') || undefined,
          imageUrls: Array.isArray(item.image_urls) ? item.image_urls : [],
          isActive: item.is_active !== false && item.is_deleted !== true,
        }],
      })
    }).filter((item) => Boolean(item.id) && item.isActive)
    const floristArrangements = Array.isArray(record.florist_arrangements)
      ? (record.florist_arrangements as Array<Record<string, unknown>>)
        .filter((item) => item.is_active !== false)
        .map((arrangement) => ({
          id: textFrom(arrangement.id, ''),
          name: textFrom(arrangement.name, ''),
          category: textFrom(arrangement.category, ''),
          description: textFrom(arrangement.description, '') || undefined,
          basePrice: numberFrom(arrangement.base_price, 0),
          pricingUnit: (['piece', 'pair', 'set', 'table', 'installation', 'fixed'].includes(textFrom(arrangement.pricing_unit, '')) ? textFrom(arrangement.pricing_unit, '') : 'piece') as FloristServiceConfiguration['arrangements'][number]['pricingUnit'],
          minimumQuantity: Math.max(1, numberFrom(arrangement.minimum_quantity, 1)),
          maximumQuantity: Number.isFinite(numberFrom(arrangement.maximum_quantity, Number.NaN)) ? numberFrom(arrangement.maximum_quantity, 0) : undefined,
          customizationGroups: Array.isArray(arrangement.florist_arrangement_option_groups)
            ? (arrangement.florist_arrangement_option_groups as Array<Record<string, unknown>>).filter((group) => group.is_active !== false).map((group) => ({
              id: textFrom(group.id, ''), name: textFrom(group.name, ''), isRequired: group.is_required === true,
              minimumSelections: Math.max(0, numberFrom(group.minimum_selections, 0)),
              maximumSelections: Number.isFinite(numberFrom(group.maximum_selections, Number.NaN)) ? numberFrom(group.maximum_selections, 0) : undefined,
              selectionType: (['single', 'multiple', 'quantity', 'text', 'image'].includes(textFrom(group.selection_type, '')) ? textFrom(group.selection_type, '') : 'single') as FloristServiceConfiguration['arrangements'][number]['customizationGroups'][number]['selectionType'],
              options: Array.isArray(group.florist_arrangement_options) ? (group.florist_arrangement_options as Array<Record<string, unknown>>).filter((option) => option.is_active !== false).map((option) => ({
                id: textFrom(option.id, ''), name: textFrom(option.name, ''), priceModifier: numberFrom(option.price_modifier, 0),
                priceModifierType: (['fixed', 'per_unit', 'per_selection', 'included'].includes(textFrom(option.price_modifier_type, '')) ? textFrom(option.price_modifier_type, '') : 'included') as FloristServiceConfiguration['arrangements'][number]['customizationGroups'][number]['options'][number]['priceModifierType'],
              })) : [],
            })) : [],
        })).filter((item) => item.id && item.name)
      : []
    const floristPackages = packageRows
      .filter((item) => item.is_active !== false && item.is_deleted !== true)
      .map((item) => ({
        id: textFrom(item.id, ''), name: textFrom(item.name, ''), price: numberFrom(item.price, 0),
        inclusions: Array.isArray(item.florist_package_arrangements) ? (item.florist_package_arrangements as Array<Record<string, unknown>>).map((entry) => ({
          arrangementId: textFrom(entry.arrangement_id, ''), customizationAllowed: entry.customization_allowed === true, quantity: Math.max(1, numberFrom(entry.included_quantity, 1)),
        })).filter((entry) => entry.arrangementId) : [],
        addOns: Array.isArray(item.florist_package_add_ons) ? (item.florist_package_add_ons as Array<Record<string, unknown>>).filter((entry) => entry.is_active !== false).map((entry) => ({
          id: textFrom(entry.id, ''), name: textFrom(entry.name, ''), price: numberFrom(entry.price, 0),
          pricingUnit: (['piece', 'pair', 'set', 'table', 'installation', 'fixed'].includes(textFrom(entry.pricing_unit, '')) ? textFrom(entry.pricing_unit, '') : 'piece') as FloristServiceConfiguration['packages'][number]['addOns'][number]['pricingUnit'],
        })).filter((entry) => entry.id && entry.name) : [],
      })).filter((item) => item.id && item.name && item.price > 0 && item.inclusions.length > 0)
    const floristFulfillmentOptions = Array.isArray(record.florist_service_fulfillment_options)
      ? (record.florist_service_fulfillment_options as Array<Record<string, unknown>>).filter((item) => item.is_active !== false).map((item) => ({
        id: textFrom(item.id, ''), name: textFrom(item.name, ''), price: numberFrom(item.price, 0),
        kind: (['pickup', 'delivery', 'delivery_with_setup', 'installation', 'post_event_removal'].includes(textFrom(item.fulfillment_kind, '')) ? textFrom(item.fulfillment_kind, '') : 'pickup') as FloristServiceConfiguration['fulfillmentOptions'][number]['kind'],
      })).filter((item) => item.id && item.name)
      : []
    const providerMinPrice = numberFrom(
      record.base_price,
      packages[0]?.providerPrice ?? 0
    )
    const minPrice = customerPriceFromProviderPrice(providerMinPrice, commissionRate)
    const coverImageUrl = usableImageUrl(record.cover_image_url)
    const galleryUrls = Array.isArray(record.gallery_urls)
      ? record.gallery_urls
          .map(usableImageUrl)
          .filter((url): url is string => Boolean(url))
      : []
    const serviceImages = Array.from(new Set([coverImageUrl, ...galleryUrls].filter(Boolean)))
    const reviewRows = Array.isArray(record.reviews)
      ? (record.reviews as Array<Record<string, unknown>>)
      : []
    const reviewRatings = reviewRows
      .map((review) => numberFrom(review.rating, 0))
      .filter((rating) => rating > 0)
    const averageRating = reviewRatings.length
      ? reviewRatings.reduce((total, rating) => total + rating, 0) / reviewRatings.length
      : 0
    const positiveSentimentCount = reviewRows.filter(
      (review) => review.analysis_status === 'processed' && review.sentiment_label === 'positive'
    ).length
    const negativeSentimentCount = reviewRows.filter(
      (review) => review.analysis_status === 'processed' && review.sentiment_label === 'negative'
    ).length
    const pricingModel = ['fixed', 'startingAt', 'customQuote'].includes(
      String(record.pricing_model)
    )
      ? (record.pricing_model as 'fixed' | 'startingAt' | 'customQuote')
      : undefined
    const pricingUnit = ['event', 'person', 'hour', 'day'].includes(
      String(record.pricing_unit)
    )
      ? (record.pricing_unit as 'event' | 'person' | 'hour' | 'day')
      : undefined

    return {
      id: serviceId,
      categoryId: categoryNameToId(categoryName),
      categoryDbId: getNestedId(record.service_categories, textFrom(record.category_id, '')),
      categoryDetails: normalizeCategoryDetails(categoryName, record.category_details),
      categoryName,
      cateringServiceTypes: getCateringServiceTypes(record.catering_service_types),
      commissionRate,
      description: textFrom(record.description, `${name} service package.`),
      detail: categoryName,
      galleryUrls: serviceImages,
      floristConfiguration: categoryNameToId(categoryName) === 'florists'
        ? { arrangements: floristArrangements, packages: floristPackages, fulfillmentOptions: floristFulfillmentOptions }
        : undefined,
      photoVideoConfiguration: categoryNameToId(categoryName) === 'photography'
        ? photoVideoBookingConfigurationFrom(record.category_details, photoVideoPackages)
        : undefined,
      imageLabel: name,
      imageUrl: coverImageUrl,
      isMock: false,
      kind: 'service',
      location: textFrom(record.location, ''),
      minPrice,
      name,
      negativeSentimentCount,
      packages,
      pricingDetails: textFrom(record.pricing_details, ''),
      pricingModel,
      pricingUnit,
      positiveSentimentCount,
      providerMinPrice,
      providerId: textFrom(record.provider_id, getNestedId(record.provider_profiles, '')),
      providerUserId: getNestedText(record.provider_profiles, 'user_id', ''),
      providerName,
      rating: averageRating > 0 ? averageRating.toFixed(1) : 'New',
      reviewCount: reviewRatings.length,
      tags: [categoryName.toUpperCase()],
    } satisfies CatalogService
  })

  return services.sort((left, right) => {
    const leftRating = Number.parseFloat(left.rating) || 0
    const rightRating = Number.parseFloat(right.rating) || 0

    return (
      rightRating - leftRating ||
      right.reviewCount - left.reviewCount ||
      left.name.localeCompare(right.name)
    )
  })
}

export const fetchAvailableCoordinators = async (): Promise<CatalogService[]> => {
  if (!supabase || !supabaseConfig.isConfigured) return []

  const [
    { data, error },
    { data: reviewData },
    { data: configuredCommissionRate },
  ] = await Promise.all([
    supabase.rpc('list_bookable_event_coordinators_v9'),
    supabase.rpc('list_event_coordinator_review_data'),
    supabase.rpc('get_public_commission_rate'),
  ])
  if (error || !Array.isArray(data)) return []
  const commissionRate = normalizeCommissionRate(configuredCommissionRate)

  const reviewRows = new Map(
    (Array.isArray(reviewData) ? reviewData : []).map((entry) => {
      const row = entry as Record<string, unknown>
      return [textFrom(row.coordinator_id, ''), row]
    })
  )
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []

    const row = entry as Record<string, unknown>
    const coordinatorUserId = textFrom(row.id, '')
    const name = textFrom(row.full_name, 'Event Coordinator')
    if (!coordinatorUserId) return []
    const reviewRow = reviewRows.get(coordinatorUserId)
    const averageRating = Number(reviewRow?.average_rating ?? 0)
    const reviewCount = Number(reviewRow?.review_count ?? 0)
    const coordinationFee = numberFrom(row.coordination_fee, 0)
    const reviews = Array.isArray(reviewRow?.reviews)
      ? reviewRow.reviews.flatMap((reviewEntry) => {
          const review = reviewEntry as Record<string, unknown>
          const reviewId = textFrom(review.id, '')
          const rating = Number(review.rating)
          if (!reviewId || !Number.isInteger(rating) || rating < 1 || rating > 5) return []
          return [{
            comment: textFrom(review.comment, ''),
            createdAt: textFrom(review.created_at, ''),
            eventType: textFrom(review.event_type, 'Completed event'),
            id: reviewId,
            rating,
          }]
        })
      : []

    return [{
      categoryId: 'eventOrganizers' as const,
      categoryName: 'Event Organizer',
      commissionRate,
      coordinatorAvailable: row.is_available !== false,
      coordinatorAvailabilityNotes: textFrom(row.availability_notes, ''),
      coordinatorCapabilities: textListFrom(row.capabilities),
      coordinatorCertifications: textListFrom(row.certifications),
      coordinatorEventTypesHandled: textListFrom(row.event_types_handled),
      coordinatorPortfolioSummary: textFrom(row.portfolio_summary, ''),
      coordinatorServiceInclusions: textListFrom(row.service_inclusions),
      coordinatorSkills: textListFrom(row.skills),
      coordinatorUnavailableReason: textFrom(row.unavailable_reason, ''),
      coordinatorYearsExperience: numberFrom(row.years_experience, 0) || undefined,
      coordinatorSpecializations: textListFrom(row.specializations),
      coordinatorUserId,
      coordinatorReviews: reviews,
      description: textFrom(
        row.description,
        `${name} can coordinate your event plan and keep your booked services organized.`
      ),
      detail: 'Event Coordinator',
      id: `coordinator:${coordinatorUserId}`,
      imageLabel: `${name}, Event Coordinator`,
      imageUrl: usableImageUrl(row.avatar_url),
      isMock: false,
      kind: 'coordinator' as const,
      minPrice: customerPriceFromProviderPrice(coordinationFee, commissionRate),
      name,
      pricingModel: 'fixed' as const,
      pricingUnit: 'event' as const,
      providerMinPrice: coordinationFee,
      providerName: name,
      rating: reviewCount > 0 && Number.isFinite(averageRating)
        ? averageRating.toFixed(1)
        : 'New',
      reviewCount,
      tags: ['EVENT ORGANIZER', 'COORDINATOR', ...textListFrom(row.specializations), ...textListFrom(row.skills)],
    }]
  })
}

export const fetchServiceCategories = async (): Promise<ServiceCategoryOption[]> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return fallbackServiceCategories
  }

  const { data, error } = await supabase
    .from('service_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  if (error || !data?.length) {
    return fallbackServiceCategories
  }

  const categories = data.flatMap((row) => {
    const id = textFrom(row.id, '')
    const name = textFrom(row.name, '')

    return id && name ? [{ id, name }] : []
  })

  if (!categories.some((category) => categoryNameToId(category.name) === 'eventOrganizers')) {
    categories.push({ id: 'eventOrganizers', name: 'Event Organizer' })
  }

  return categories.sort((left, right) => left.name.localeCompare(right.name))
}

export const fetchBudgetAwareRecommendations = async (): Promise<
  Map<string, BudgetRecommendation>
> => {
  const recommendations = new Map<string, BudgetRecommendation>()
  if (!supabase || !supabaseConfig.isConfigured) return recommendations

  const { data, error } = await supabase.rpc(
    'list_my_budget_aware_service_recommendations_phase9'
  )
  if (error || !Array.isArray(data)) return recommendations

  data.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return
    const row = entry as Record<string, unknown>
    const itemId = textFrom(row.item_id, '')
    if (!itemId) return
    const availabilityStatus = ['available', 'schedule_required', 'unavailable'].includes(
      String(row.availability_status)
    )
      ? row.availability_status as BudgetRecommendation['availabilityStatus']
      : 'schedule_required'
    const calculatedAmount = Number(row.calculated_amount)

    recommendations.set(itemId, {
      availabilityStatus,
      calculatedAmount: Number.isFinite(calculatedAmount) && calculatedAmount > 0
        ? calculatedAmount
        : undefined,
      categoryBudget: numberFrom(row.category_budget, 0),
      categoryKey: textFrom(row.category_key, ''),
      guestRequirementMet: row.guest_requirement_met === true,
      isRecommended: row.is_recommended === true,
      isWithinBudget: row.is_within_budget === true,
      pricingBasis: textFrom(row.pricing_basis, ''),
      reason: textFrom(row.recommendation_reason, ''),
      recommendedOptionId: textFrom(row.recommended_option_id, '') || undefined,
      recommendedOptionName: textFrom(row.recommended_option_name, '') || undefined,
    })
  })

  return recommendations
}

export const fetchServiceDecisionSignals = async (): Promise<
  Map<string, ServiceDecisionSignal>
> => {
  const signals = new Map<string, ServiceDecisionSignal>()
  if (!supabase || !supabaseConfig.isConfigured) return signals

  const { data, error } = await supabase.rpc('list_public_service_decision_signals')
  if (error || !Array.isArray(data)) return signals

  data.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return
    const row = entry as Record<string, unknown>
    const serviceId = textFrom(row.service_id, '')
    if (!serviceId) return
    const averageRating = Number(row.average_rating)
    const bookingCount = Number(row.booking_count)
    const popularityRank = Number(row.category_rank)
    const reviewCount = Number(row.review_count)

    signals.set(serviceId, {
      averageRating: Number.isFinite(averageRating) ? averageRating : 0,
      bookingCount: Number.isFinite(bookingCount) ? bookingCount : 0,
      isMostBooked: row.is_most_booked === true,
      popularityRank: Number.isFinite(popularityRank) ? popularityRank : 0,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    })
  })

  return signals
}

export const loadClientCatalogServices = async (): Promise<CatalogService[]> => {
  const [services, coordinators, recommendations, decisionSignals] = await Promise.all([
    fetchCatalogServices(),
    fetchAvailableCoordinators(),
    fetchBudgetAwareRecommendations(),
    fetchServiceDecisionSignals(),
  ])

  const coordinatorUserIds = new Set(
    coordinators.flatMap((coordinator) =>
      coordinator.coordinatorUserId ? [coordinator.coordinatorUserId] : []
    )
  )
  const marketplaceServices = services.filter((service) => !(
    service.categoryId === 'eventOrganizers'
    && service.providerUserId
    && coordinatorUserIds.has(service.providerUserId)
  ))

  return [...marketplaceServices, ...coordinators].map((service) => {
    const decisionSignal = decisionSignals.get(service.bookingServiceId ?? service.id)

    return {
      ...service,
      bookingCount: decisionSignal?.bookingCount ?? 0,
      budgetRecommendation: recommendations.get(service.bookingServiceId ?? service.id),
      isMostBooked: decisionSignal?.isMostBooked ?? false,
      popularityRank: decisionSignal?.popularityRank,
      rating: decisionSignal && decisionSignal.reviewCount > 0
        ? decisionSignal.averageRating.toFixed(1)
        : service.rating,
      reviewCount: decisionSignal?.reviewCount ?? service.reviewCount,
    }
  })
}
