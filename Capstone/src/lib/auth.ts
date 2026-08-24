import { supabase, supabaseConfig } from './supabase'

type UserRole = 'client' | 'service_provider'

type AuthResult = {
  ok: boolean
  message?: string
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

  await client.from('provider_profiles').insert({
    user_id: userId,
    business_name: businessName,
    description: serviceCategory,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    verification_status: 'pending',
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

    return { ok: true }
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

    return { ok: true }
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

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
}

export const resendSignupCode = async (email: string): Promise<AuthResult> => {
  const client = requireSupabase()

  if (!client) {
    return { ok: false, message: notConfiguredMessage }
  }

  const { error } = await client.auth.resend({
    email: email.trim().toLowerCase(),
    type: 'signup',
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true }
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
