import { supabase, supabaseConfig } from './supabase'

export interface FavoriteServiceIdsResult {
  ids: Set<string>
  message?: string
  ok: boolean
}

export interface ToggleFavoriteServiceResult {
  isFavorited: boolean
  message?: string
  ok: boolean
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_PATTERN.test(value)

const messageFrom = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback

const currentClientId = async (): Promise<string | undefined> => {
  if (!supabase || !supabaseConfig.isConfigured) return undefined

  // This is intentionally local. Favorite loading happens with the normal
  // workspace refresh, so it must not add a second network authentication
  // round-trip before the RLS-protected query itself.
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user.id) return undefined
  return data.session.user.id
}

export const fetchFavoriteServiceIds = async (): Promise<FavoriteServiceIdsResult> => {
  try {
    const clientId = await currentClientId()
    if (!supabase || !clientId) return { ids: new Set(), ok: true }

    const { data, error } = await supabase
      .from('client_favorite_services')
      .select('service_id')
      .eq('client_id', clientId)

    if (error) {
      return { ids: new Set(), message: messageFrom(error, 'Unable to load saved services.'), ok: false }
    }

    return {
      ids: new Set((data ?? []).flatMap((row) => (
        typeof row.service_id === 'string' && isUuid(row.service_id) ? [row.service_id] : []
      ))),
      ok: true,
    }
  } catch (error) {
    return { ids: new Set(), message: messageFrom(error, 'Unable to load saved services.'), ok: false }
  }
}

export const toggleFavoriteService = async (
  serviceId: string
): Promise<ToggleFavoriteServiceResult> => {
  try {
    if (!supabase || !supabaseConfig.isConfigured || !isUuid(serviceId)) {
      return { isFavorited: false, message: 'This service cannot be saved right now.', ok: false }
    }

    const clientId = await currentClientId()
    if (!clientId) {
      return { isFavorited: false, message: 'Please sign in to save services.', ok: false }
    }

    const { data, error } = await supabase.rpc('toggle_my_favorite_service', {
      target_service_id: serviceId,
    })

    if (error || typeof data !== 'boolean') {
      return {
        isFavorited: false,
        message: messageFrom(error, 'Unable to update this saved service.'),
        ok: false,
      }
    }

    return { isFavorited: data, ok: true }
  } catch (error) {
    return { isFavorited: false, message: messageFrom(error, 'Unable to update this saved service.'), ok: false }
  }
}
