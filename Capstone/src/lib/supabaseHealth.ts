import { supabase, supabaseConfig } from './supabase'

export type SupabaseHealthResult = {
  ok: boolean
  message: string
  categoryCount: number
}

export const checkSupabaseConnection = async (): Promise<SupabaseHealthResult> => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return {
      ok: false,
      message: 'Add Supabase URL and anon key to the app .env file.',
      categoryCount: 0,
    }
  }

  const { count, error } = await supabase
    .from('service_categories')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return {
      ok: false,
      message: error.message,
      categoryCount: 0,
    }
  }

  return {
    ok: true,
    message: 'Supabase connected.',
    categoryCount: count ?? 0,
  }
}
