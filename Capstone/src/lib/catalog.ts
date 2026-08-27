import { supabase, supabaseConfig } from './supabase'

export type CatalogCategoryId = 'venues' | 'photography' | 'catering' | 'florists' | 'attire'

export interface CatalogService {
  id: string
  categoryId: CatalogCategoryId
  categoryName: string
  description: string
  detail: string
  imageLabel: string
  imageUrl: string
  maxPrice?: number
  minPrice: number
  name: string
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
  if (!value || typeof value !== 'object' || !(key in value)) {
    return fallback
  }

  return textFrom((value as Record<string, unknown>)[key], fallback)
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
    return mockCatalogServices
  }

  const { data, error } = await supabase
    .from('services')
    .select(
      'id, name, description, base_price, cover_image_url, provider_profiles(business_name), service_categories(name)'
    )
    .eq('status', 'active')
    .limit(50)

  if (error || !data || data.length === 0) {
    return mockCatalogServices
  }

  const services = data.map((row, index) => {
    const record = row as Record<string, unknown>
    const categoryName = getNestedText(record.service_categories, 'name', 'Catering')
    const providerName = getNestedText(record.provider_profiles, 'business_name', 'Provider')
    const name = textFrom(record.name, providerName)
    const minPrice = numberFrom(record.base_price, mockCatalogServices[index % mockCatalogServices.length].minPrice)

    return {
      id: textFrom(record.id, `service-${index}`),
      categoryId: categoryNameToId(categoryName),
      categoryName,
      description: textFrom(record.description, `${name} service package.`),
      detail: categoryName,
      imageLabel: name,
      imageUrl: textFrom(record.cover_image_url, mockCatalogServices[index % mockCatalogServices.length].imageUrl),
      minPrice,
      name,
      providerName,
      rating: 'New',
      reviewCount: 0,
      tags: [categoryName.toUpperCase()],
    } satisfies CatalogService
  })

  return services.length > 0 ? services : mockCatalogServices
}
