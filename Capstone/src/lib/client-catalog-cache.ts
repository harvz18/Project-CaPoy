import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CatalogService, ServiceCategoryOption } from './catalog'

const CLIENT_CATALOG_CACHE_KEY = 'multivent:client-marketplace-cache:v2'
const CLIENT_CATALOG_CACHE_VERSION = 2
export const CLIENT_CATALOG_CACHE_STALE_AFTER_MS = 15 * 60 * 1000

export type ClientCatalogCacheSnapshot = {
  categories: ServiceCategoryOption[]
  isStale: boolean
  savedAt: number
  serviceCount: number
  services: CatalogService[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isCachedService = (value: unknown): value is CatalogService => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.categoryId === 'string'
  && typeof value.categoryName === 'string'
  && typeof value.imageUrl === 'string'
)

const isCachedCategory = (value: unknown): value is ServiceCategoryOption => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
)

export const loadClientCatalogCache = async (): Promise<ClientCatalogCacheSnapshot | undefined> => {
  try {
    const serialized = await AsyncStorage.getItem(CLIENT_CATALOG_CACHE_KEY)
    if (!serialized) return undefined

    const parsed: unknown = JSON.parse(serialized)
    if (!isRecord(parsed) || parsed.version !== CLIENT_CATALOG_CACHE_VERSION) return undefined
    if (typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)
      || !Array.isArray(parsed.services) || !Array.isArray(parsed.categories)) {
      return undefined
    }
    if (!parsed.services.length || !parsed.services.every(isCachedService) || !parsed.categories.every(isCachedCategory)) {
      return undefined
    }

    return {
      categories: parsed.categories,
      isStale: Date.now() - parsed.savedAt > CLIENT_CATALOG_CACHE_STALE_AFTER_MS,
      savedAt: parsed.savedAt,
      serviceCount: parsed.services.length,
      services: parsed.services,
    }
  } catch {
    return undefined
  }
}

export const saveClientCatalogCache = async (
  services: CatalogService[],
  categories: ServiceCategoryOption[],
): Promise<void> => {
  // Never replace a valid offline catalog with an empty fallback caused by a
  // transient network failure.
  if (!services.length || !categories.length) return

  try {
    await AsyncStorage.setItem(CLIENT_CATALOG_CACHE_KEY, JSON.stringify({
      categories,
      savedAt: Date.now(),
      serviceCount: services.length,
      services,
      version: CLIENT_CATALOG_CACHE_VERSION,
    }))
  } catch {
    // Device storage is an optimization only. A storage failure must never
    // block browsing or a live marketplace refresh.
  }
}
