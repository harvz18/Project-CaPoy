import AsyncStorage from '@react-native-async-storage/async-storage'

export type ClientHomeAppearance = 'classic' | 'modern'

const STORAGE_KEY_PREFIX = '@multivent/client-home-appearance/v1'

export const normalizeClientHomeAppearance = (value: unknown): ClientHomeAppearance =>
  value === 'modern' ? 'modern' : 'classic'

export const clientHomeAppearanceStorageKey = (userId: string) =>
  `${STORAGE_KEY_PREFIX}:${userId}`

export const loadClientHomeAppearance = async (userId: string): Promise<ClientHomeAppearance> => {
  if (!userId) return 'classic'

  try {
    return normalizeClientHomeAppearance(
      await AsyncStorage.getItem(clientHomeAppearanceStorageKey(userId))
    )
  } catch {
    return 'classic'
  }
}

export const saveClientHomeAppearance = async (
  userId: string,
  appearance: ClientHomeAppearance
): Promise<void> => {
  if (!userId) return

  try {
    await AsyncStorage.setItem(
      clientHomeAppearanceStorageKey(userId),
      normalizeClientHomeAppearance(appearance)
    )
  } catch {
    // The in-memory preference still takes effect immediately. A later change
    // can retry persistence without disrupting the client workspace.
  }
}
