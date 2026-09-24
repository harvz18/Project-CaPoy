import { supabase, supabaseConfig } from './supabase'

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
  bookingPackageId?: string
  bookingProviderId?: string
  bookingServiceId?: string
  coordinatorUserId?: string
  id: string
  categoryId: CatalogCategoryId
  categoryDbId?: string
  categoryName: string
  cateringServiceTypes?: CateringServiceType[]
  description: string
  detail: string
  galleryUrls?: string[]
  imageLabel: string
  imageUrl: string
  isMock?: boolean
  kind?: 'coordinator' | 'service'
  location?: string
  maxPrice?: number
  minPrice: number
  name: string
  packageId?: string
  packages?: Array<{
    description: string
    id: string
    inclusions: string[]
    name: string
    price: number
    unit?: 'event' | 'person' | 'hour' | 'day'
  }>
  pricingDetails?: string
  pricingModel?: 'fixed' | 'startingAt' | 'customQuote'
  pricingUnit?: 'event' | 'person' | 'hour' | 'day'
  providerId?: string
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

const getPackages = (value: unknown) => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const record = item as Record<string, unknown>
    const id = textFrom(record.id, '')
    const name = textFrom(record.name, '')
    const price = numberFrom(record.price, 0)

    if (!id || !name) return []

    return [
      {
        description: textFrom(record.description, ''),
        id,
        inclusions: Array.isArray(record.inclusions)
          ? record.inclusions.filter(
              (inclusion): inclusion is string => typeof inclusion === 'string'
            )
          : [],
        name,
        price,
        unit: ['event', 'person', 'hour', 'day'].includes(String(record.pricing_unit))
          ? (record.pricing_unit as 'event' | 'person' | 'hour' | 'day')
          : undefined,
      },
    ]
  })
}

export const formatPeso = (value: number) =>
  `PHP ${Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

export const formatServicePrice = (service: CatalogService) => {
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
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, provider_profiles(id, business_name), service_categories(id, name), service_packages(id, name, description, price, inclusions), reviews(rating)'
  const detailedSelection =
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details, catering_service_types, provider_profiles(id, business_name), service_categories(id, name), service_packages(id, name, description, price, inclusions, pricing_unit), reviews(rating)'

  const detailedResult = await supabase
    .from('services')
    .select(detailedSelection)
    .eq('status', 'active')
    .eq('is_available', true)
    .limit(1000)

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
    const packages = getPackages(record.service_packages)
    const minPrice = numberFrom(record.base_price, packages[0]?.price ?? 0)
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
      id: textFrom(record.id, `service-${index}`),
      categoryId: categoryNameToId(categoryName),
      categoryDbId: getNestedId(record.service_categories, textFrom(record.category_id, '')),
      categoryName,
      cateringServiceTypes: getCateringServiceTypes(record.catering_service_types),
      description: textFrom(record.description, `${name} service package.`),
      detail: categoryName,
      galleryUrls: serviceImages,
      imageLabel: name,
      imageUrl: coverImageUrl,
      isMock: false,
      kind: 'service',
      location: textFrom(record.location, ''),
      minPrice,
      name,
      packages,
      pricingDetails: textFrom(record.pricing_details, ''),
      pricingModel,
      pricingUnit,
      providerId: textFrom(record.provider_id, getNestedId(record.provider_profiles, '')),
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

  const { data, error } = await supabase.rpc('list_available_event_coordinators')
  if (error || !Array.isArray(data)) return []

  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []

    const row = entry as Record<string, unknown>
    const coordinatorUserId = textFrom(row.id, '')
    const name = textFrom(row.full_name, 'Event Coordinator')
    if (!coordinatorUserId) return []

    return [{
      categoryId: 'eventOrganizers' as const,
      categoryName: 'Event Organizer',
      coordinatorUserId,
      description: `${name} can coordinate your event plan and keep your booked services organized.`,
      detail: 'Event Coordinator',
      id: `coordinator:${coordinatorUserId}`,
      imageLabel: `${name}, Event Coordinator`,
      imageUrl: usableImageUrl(row.avatar_url),
      isMock: false,
      kind: 'coordinator' as const,
      minPrice: 0,
      name,
      pricingModel: 'customQuote' as const,
      providerName: name,
      rating: 'New',
      reviewCount: 0,
      tags: ['EVENT ORGANIZER', 'COORDINATOR'],
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

export const loadClientCatalogServices = async (): Promise<CatalogService[]> => {
  const [services, coordinators] = await Promise.all([
    fetchCatalogServices(),
    fetchAvailableCoordinators(),
  ])

  return [...services, ...coordinators].sort((left, right) => {
    const leftRating = Number.parseFloat(left.rating) || 0
    const rightRating = Number.parseFloat(right.rating) || 0
    return rightRating - leftRating || right.reviewCount - left.reviewCount || left.name.localeCompare(right.name)
  })
}
