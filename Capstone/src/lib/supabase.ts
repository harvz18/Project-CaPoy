import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

const hasSupabaseUrl =
  supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co')

export const supabaseConfig = {
  url: supabaseUrl,
  hasAnonKey: supabaseAnonKey.length > 0,
  isConfigured: hasSupabaseUrl && supabaseAnonKey.length > 0,
}

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null

// React Native has no browser visibility API. Keep refresh work active only
// while the app is foregrounded; the persisted refresh token restores the
// same session on the next launch.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}
