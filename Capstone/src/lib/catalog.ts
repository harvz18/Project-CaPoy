import { supabase, supabaseConfig } from './supabase'

export type CatalogCategoryId = 'venues' | 'photography' | 'catering' | 'florists' | 'attire'

export interface CatalogService {
  id: string
  categoryId: CatalogCategoryId
  categoryDbId?: string
  categoryName: string
  description: string
  detail: string
  imageLabel: string
  imageUrl: string
  maxPrice?: number
  minPrice: number
  name: string
  packageId?: string
  packages?: Array<{
    id: string
    inclusions: string[]
    name: string
    price: number
  }>
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
    maxPrice: 800,
    minPrice: 450,
    name: 'Grand Buffet Catering',
    providerName: 'Grand Buffet Catering',
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
    maxPrice: 2500,
    minPrice: 1200,
    name: 'Elite Plated Service',
    providerName: 'Elite Plated Service',
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
    maxPrice: 400,
    minPrice: 250,
    name: 'Budget Bites',
    providerName: 'Budget Bites',
    rating: '4.5',
    reviewCount: 210,
    tags: ['BUFFET', 'FINGER FOOD'],
  },
]

const categoryNameToId = (name: string): CatalogCategoryId => {
  const normalized = name.toLowerCase()

  if (normalized.includes('photo')) return 'photography'
  if (normalized.includes('venue') || normalized.includes('estate')) return 'venues'
  if (normalized.includes('flor')) return 'florists'
  if (normalized.includes('attire') || normalized.includes('gown')) return 'attire'

  return 'catering'
}

const textFrom = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const numberFrom = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

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
        id,
        inclusions: Array.isArray(record.inclusions)
          ? record.inclusions.filter(
              (inclusion): inclusion is string => typeof inclusion === 'string'
            )
          : [],
        name,
        price,
      },
    ]
  })
}

export const formatPeso = (value: number) =>
  `PHP ${Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`

export const formatServicePrice = (service: CatalogService) => {
  if (service.maxPrice && service.maxPrice > service.minPrice) {
    return `${formatPeso(service.minPrice)} - ${formatPeso(service.maxPrice)} / head`
  }

  return `From ${formatPeso(service.minPrice)}`
}

export const fetchCatalogServices = async (): Promise<CatalogService[]> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return []
  }

  const { data, error } = await supabase
    .from('services')
    .select(
      'id, provider_id, category_id, name, description, base_price, cover_image_url, provider_profiles(id, business_name), service_categories(id, name), service_packages(id, name, price, inclusions)'
    )
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(50)

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
    const coverImageUrl = textFrom(record.cover_image_url, '')

    return {
      id: textFrom(record.id, `service-${index}`),
      categoryId: categoryNameToId(categoryName),
      categoryDbId: getNestedId(record.service_categories, textFrom(record.category_id, '')),
      categoryName,
      description: textFrom(record.description, `${name} service package.`),
      detail: categoryName,
      imageLabel: name,
      imageUrl: coverImageUrl,
      minPrice,
      name,
      packageId: packages[0]?.id,
      packages,
      providerId: textFrom(record.provider_id, getNestedId(record.provider_profiles, '')),
      providerName,
      rating: 'New',
      reviewCount: 0,
      tags: [categoryName.toUpperCase()],
    } satisfies CatalogService
  })

  return services
}
