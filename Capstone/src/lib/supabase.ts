import { createClient } from '@supabase/supabase-js'

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
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
