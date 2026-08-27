import { supabase, supabaseConfig } from './supabase'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'

type UserRole = 'client' | 'service_provider'

type AuthResult = {
  ok: boolean
  message?: string
  needsVerification?: boolean
}

type ClientSignupInput = {
  fullName: string
  email: string
  password: string
}

type MerchantSignupInput = {
  businessName: string
  contactName: string
  serviceCategory: string
  email: string
  phoneNumber: string
  password: string
}

type OAuthProvider = 'google'

const oauthRedirectTo = AuthSession.makeRedirectUri({
  scheme: 'multivent',
  path: 'auth/callback',
})

const emailRedirectTo = AuthSession.makeRedirectUri({
  scheme: 'multivent',
  path: 'auth/email',
})

const getUrlParam = (url: string, key: string) => {
  const queryString = url.split('?')[1]?.split('#')[0] ?? ''
  const hashString = url.split('#')[1] ?? ''
  const queryParams = new URLSearchParams(queryString)
  const hashParams = new URLSearchParams(hashString)

  return queryParams.get(key) ?? hashParams.get(key)
}

const notConfiguredMessage =
  'Supabase is not configured. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

const requireSupabase = () => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return null
  }

  return supabase
}

const requestEmailOtp = async (email: string) => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo,
      shouldCreateUser: false,
    },
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

const requestVerificationOtp = async (email: string) => {
  const result = await requestEmailOtp(email)

  if (result.ok) {
    return result
  }

  const message = result.message?.toLowerCase() ?? ''
  const isRateLimited =
    message.includes('rate') ||
    message.includes('security') ||
    message.includes('seconds') ||
    message.includes('minute')

  if (isRateLimited) {
    return { ok: true, message: result.message }
  }

  return result
}

const syncProfile = async ({
  userId,
  fullName,
  email,
  phone,
  role,
}: {
  userId: string
  fullName: string
  email: string
  phone?: string
  role: UserRole
}) => {
  const client = requireSupabase()

  if (!client) {
    return
  }

  await client.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    email,
    phone,
    default_role: role,
    account_status: role === 'service_provider' ? 'pending' : 'active',
    updated_at: new Date().toISOString(),
  })
}

const syncProviderProfile = async ({
  userId,
  businessName,
  contactEmail,
  contactPhone,
  serviceCategory,
}: {
  userId: string
  businessName: string
  contactEmail: string
  contactPhone: string
  serviceCategory: string
}) => {
  const client = requireSupabase()

  if (!client) {
    return
  }

  await client.from('provider_profiles').upsert(
    {
      user_id: userId,
      business_name: businessName,
      description: serviceCategory,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      verification_status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

const syncOAuthProfile = async () => {
  const client = requireSupabase()

  if (!client) {
    return
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    return
  }

  const metadata = user.user_metadata
  const fullName =
    typeof metadata.full_name === 'string' && metadata.full_name.trim().length > 0
      ? metadata.full_name.trim()
      : typeof metadata.name === 'string' && metadata.name.trim().length > 0
        ? metadata.name.trim()
        : user.email?.split('@')[0] ?? 'Planner'

  const role =
    metadata.default_role === 'service_provider' ? 'service_provider' : 'client'

  await syncProfile({
    userId: user.id,
    fullName,
    email: user.email ?? '',
    role,
  })
}

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

export const signUpClient = async ({
  fullName,
  email,
  password,
}: ClientSignupInput): Promise<AuthResult> => {
  const client = requireSupabase()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = fullName.trim()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: normalizedName,
          default_role: 'client',
        },
      },
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    if (data.session && data.user) {
      await syncProfile({
        userId: data.user.id,
        fullName: normalizedName,
        email: normalizedEmail,
        role: 'client',
      })
    }

    if (!data.session) {
      await requestVerificationOtp(normalizedEmail)
    }

    return { ok: true, needsVerification: !data.session }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export const signUpMerchant = async ({
  businessName,
  contactName,
  serviceCategory,
  email,
  phoneNumber,
  password,
}: MerchantSignupInput): Promise<AuthResult> => {
  const client = requireSupabase()
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedBusinessName = businessName.trim()
  const normalizedContactName = contactName.trim()
  const normalizedPhone = phoneNumber.trim()
  const normalizedCategory = serviceCategory.trim()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: normalizedContactName,
          default_role: 'service_provider',
          business_name: normalizedBusinessName,
          service_category: normalizedCategory,
          phone: normalizedPhone,
        },
      },
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    if (data.session && data.user) {
      await syncProfile({
        userId: data.user.id,
        fullName: normalizedContactName,
        email: normalizedEmail,
        phone: normalizedPhone,
        role: 'service_provider',
      })

      await syncProviderProfile({
        userId: data.user.id,
        businessName: normalizedBusinessName,
        contactEmail: normalizedEmail,
        contactPhone: normalizedPhone,
        serviceCategory: normalizedCategory,
      })
    }

    if (!data.session) {
      await requestVerificationOtp(normalizedEmail)
    }

    return { ok: true, needsVerification: !data.session }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export const verifySignupCode = async (
  email: string,
  token: string
): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'signup',
  })

  if (!error) {
    return { ok: true }
  }

  const { error: emailTypeError } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'email',
  })

  if (emailTypeError) {
    return { ok: false, message: emailTypeError.message }
  }

  return { ok: true }
}

export const resendSignupCode = async (email: string): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const normalizedEmail = email.trim().toLowerCase()
  const { error } = await client.auth.resend({
    email: normalizedEmail,
    type: 'signup',
    options: {
      emailRedirectTo,
    },
  })

  if (!error) {
    return { ok: true }
  }

  return requestEmailOtp(normalizedEmail)
}

export const requestPasswordReset = async (email: string): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase())

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

export const resetPasswordWithCode = async ({
  email,
  token,
  password,
}: {
  email: string
  token: string
  password: string
}): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error: verifyError } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'recovery',
  })

  if (verifyError) {
    return { ok: false, message: verifyError.message }
  }

  const { error: updateError } = await client.auth.updateUser({ password })

  if (updateError) {
    return { ok: false, message: updateError.message }
  }

  await client.auth.signOut()

  return { ok: true }
}

export const signInWithOAuth = async (
  provider: OAuthProvider
): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: oauthRedirectTo,
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    if (!data.url) {
      return { ok: false, message: 'Unable to start OAuth sign in.' }
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo)

    if (result.type !== 'success') {
      return { ok: false, message: 'OAuth sign in was cancelled.' }
    }

    const code = getUrlParam(result.url, 'code')

    if (code) {
      const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        return { ok: false, message: exchangeError.message }
      }

      await syncOAuthProfile()

      return { ok: true }
    }

    const accessToken = getUrlParam(result.url, 'access_token')
    const refreshToken = getUrlParam(result.url, 'refresh_token')

    if (!accessToken || !refreshToken) {
      return { ok: false, message: 'OAuth sign in did not return a session.' }
    }

    const { error: sessionError } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (sessionError) {
      return { ok: false, message: sessionError.message }
    }

    await syncOAuthProfile()

    return { ok: true }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}
