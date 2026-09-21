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
  id: string
  categoryId: CatalogCategoryId
  categoryDbId?: string
  categoryName: string
  description: string
  detail: string
  galleryUrls?: string[]
  imageLabel: string
  imageUrl: string
  isMock?: boolean
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

const mockImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCrR-HGww7wZlPKqJYg84-Q4OmoBTnamXaWB4_X69QkVMLbfzF0hC8Df4DlHffg8X2G2_rVvyMbvVsJyNJUhX2qqVrP0pceiOrdgsKwkhToaw3SGbqBg2eWnHOL0Dw1wnoaVRl_s8knmcJOGDREikONMrRGNWPQZkFwATgr-IusvatHnK0grCwm8sV7GefP26X4JlIw_zQU-vuWnzbN2QL5BpsiP-I9m-B3kZb2IzaHPhFiTQDnotiivg'

export const mockCatalogServices: CatalogService[] = [
  {
    id: 'grandBuffet',
    categoryId: 'catering',
    categoryName: 'Catering',
    description:
      'Award-winning culinary experiences tailored for elegant celebrations with buffet, plated, and custom menu options.',
    detail: 'Buffet packages',
    imageLabel: 'Elegant wedding buffet setup',
    imageUrl: mockImage,
    isMock: true,
    maxPrice: 800,
    minPrice: 450,
    name: 'Grand Buffet Catering',
    providerName: 'Grand Buffet Catering',
    pricingModel: 'startingAt',
    pricingUnit: 'person',
    rating: '4.8',
    reviewCount: 120,
    tags: ['BUFFET', 'FILIPINO'],
  },
  {
    id: 'elitePlated',
    categoryId: 'catering',
    categoryName: 'Catering',
    description:
      'Premium plated service with international menus, formal table service, and custom tasting sessions.',
    detail: 'Plated dinner service',
    imageLabel: 'Fine dining plated steak',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDacsYIzBiVKm-sxb0LhAMveTcicHFQln13pVhHJinV6XDw5q_ywtMS609VmszF_uhXXGNZBjWNyaCccrIW-Whan2-6yrALhKymnyUBH6_Vp2ZLoVZW4tKgDUAEXL0DcYVdi5EMTXfnZ2Oe6n6d6ajLP2IF1rNTIon43H4FN8BqkzIlEp3gO-_N9dffA3O5sB_GvXtin6BwTaok-8R17gdbwNEDX_MPWGCJXkwbc5Lim2F2QAf_yCeIYw',
    isMock: true,
    maxPrice: 2500,
    minPrice: 1200,
    name: 'Elite Plated Service',
    providerName: 'Elite Plated Service',
    pricingModel: 'startingAt',
    pricingUnit: 'person',
    rating: '4.9',
    reviewCount: 85,
    tags: ['PLATED', 'INTERNATIONAL'],
  },
  {
    id: 'budgetBites',
    categoryId: 'catering',
    categoryName: 'Catering',
    description:
      'Practical buffet and finger-food packages for intimate celebrations and budget-conscious events.',
    detail: 'Finger food and buffet',
    imageLabel: 'Elegant cocktail appetizers',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC-7oTJe0reSXcvQJdYLb9JvhmQHJOewSkNxZiSrKixchByIe0ecPcpCGqWz-Js56Lb7L1PdE0RDj3dfYgVQuRtDEacJeaBCNH2NhQtXcbN-iY0fcF36BkecQ22sknkdJ1ELQTiPEFIr1Edqp62W6B3yTmZnYxplXVcaARDZf3iuJd3p65NKmItYT0WlWPLCbDRcwpabjIB34mcTulaDZkGrlboJhxhx2kMOqeMb7R9OiqbXpecRWNcnA',
    isMock: true,
    maxPrice: 400,
    minPrice: 250,
    name: 'Budget Bites',
    providerName: 'Budget Bites',
    pricingModel: 'startingAt',
    pricingUnit: 'person',
    rating: '4.5',
    reviewCount: 210,
    tags: ['BUFFET', 'FINGER FOOD'],
  },
]

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

export const fetchCatalogServices = async (): Promise<CatalogService[]> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return []
  }

  const baseSelection =
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, provider_profiles(id, business_name), service_categories(id, name), service_packages(id, name, description, price, inclusions), reviews(rating)'
  const detailedSelection =
    'id, provider_id, category_id, name, description, base_price, location, cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details, provider_profiles(id, business_name), service_categories(id, name), service_packages(id, name, description, price, inclusions, pricing_unit), reviews(rating)'

  const detailedResult = await supabase
    .from('services')
    .select(detailedSelection)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(50)

  const fallbackResult = detailedResult.error
    ? await supabase
      .from('services')
      .select(baseSelection)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(50)
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
    const coverImageUrl = usableImageUrl(record.cover_image_url) || mockImage
    const galleryUrls = Array.isArray(record.gallery_urls)
      ? record.gallery_urls
          .map(usableImageUrl)
          .filter((url): url is string => Boolean(url))
      : []
    const serviceImages = Array.from(new Set([coverImageUrl, ...galleryUrls]))
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
      description: textFrom(record.description, `${name} service package.`),
      detail: categoryName,
      galleryUrls: serviceImages,
      imageLabel: name,
      imageUrl: coverImageUrl,
      isMock: false,
      location: textFrom(record.location, ''),
      minPrice,
      name,
      packageId: packages[0]?.id,
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

  return services
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

  return data.flatMap((row) => {
    const id = textFrom(row.id, '')
    const name = textFrom(row.name, '')

    return id && name ? [{ id, name }] : []
  })
}

// Keep examples while the marketplace is being populated. Published provider services are
// always appended; change this to true when the client should show only live listings.
export const USE_LIVE_CLIENT_CATALOG = false

export const loadClientCatalogServices = async (): Promise<CatalogService[]> => {
  const liveServices = await fetchCatalogServices()

  if (USE_LIVE_CLIENT_CATALOG) {
    return liveServices.length > 0 ? liveServices : mockCatalogServices
  }

  if (liveServices.length === 0) {
    return mockCatalogServices
  }

  const backedExamples = mockCatalogServices.map((example, index) => {
    const matchingServices = liveServices.filter(
      (service) => service.categoryId === example.categoryId
    )
    const candidates = matchingServices.length > 0 ? matchingServices : liveServices
    const backingService = candidates[index % candidates.length]

    return {
      ...example,
      bookingPackageId: backingService.packageId,
      bookingProviderId: backingService.providerId,
      bookingServiceId: backingService.id,
      categoryDbId: backingService.categoryDbId,
    }
  })

  return [...backedExamples, ...liveServices]
}
