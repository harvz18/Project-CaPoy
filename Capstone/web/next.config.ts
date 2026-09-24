import type { NextConfig } from 'next'
import { loadEnvConfig } from '@next/env'
import path from 'node:path'

// Reuse the mobile app's existing public Supabase configuration when the web
// app does not have its own .env.local yet.
loadEnvConfig(path.resolve(process.cwd(), '..'))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
}

export default nextConfig
