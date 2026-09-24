import { supabase } from './supabase'

export type EditableAccountProfile = {
  avatarUrl: string
  businessDescription: string
  businessLocation: string
  businessName: string
  contactEmail: string
  contactPhone: string
  email: string
  fullName: string
  phone: string
  role: 'client' | 'service_provider' | 'event_coordinator'
}

export type ProfileResult = {
  message?: string
  ok: boolean
  profile?: EditableAccountProfile
}

const emptyProfile: EditableAccountProfile = {
  avatarUrl: '',
  businessDescription: '',
  businessLocation: '',
  businessName: '',
  contactEmail: '',
  contactPhone: '',
  email: '',
  fullName: '',
  phone: '',
  role: 'client',
}

export async function loadEditableAccountProfile(): Promise<ProfileResult> {
  if (!supabase) {
    return { message: 'Connect Supabase to load your profile.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to view your profile.', ok: false }
  }

  const { data: account, error: accountError } = await supabase
    .from('profiles')
    .select('full_name, email, phone, avatar_url, default_role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (accountError) return { message: accountError.message, ok: false }

  const role = normalizeEditableRole(account?.default_role)
  let provider: Record<string, string | null> | null = null

  if (role === 'service_provider') {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select('business_name, description, contact_email, contact_phone, location')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (error) return { message: error.message, ok: false }
    provider = data
  }

  return {
    ok: true,
    profile: {
      ...emptyProfile,
      avatarUrl: account?.avatar_url ?? '',
      businessDescription: provider?.description ?? '',
      businessLocation: provider?.location ?? '',
      businessName: provider?.business_name ?? '',
      contactEmail: provider?.contact_email ?? authData.user.email ?? '',
      contactPhone: provider?.contact_phone ?? account?.phone ?? '',
      email: account?.email ?? authData.user.email ?? '',
      fullName: account?.full_name ?? '',
      phone: account?.phone ?? '',
      role,
    },
  }
}

export async function saveEditableAccountProfile(
  value: EditableAccountProfile
): Promise<ProfileResult> {
  if (!supabase) {
    return { message: 'Connect Supabase to save your profile.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to update your profile.', ok: false }
  }

  const cleaned: EditableAccountProfile = {
    ...value,
    businessDescription: value.businessDescription.trim(),
    businessLocation: value.businessLocation.trim(),
    businessName: value.businessName.trim(),
    contactEmail: value.contactEmail.trim(),
    contactPhone: value.contactPhone.trim(),
    email: value.email.trim(),
    fullName: value.fullName.trim(),
    phone: value.phone.trim(),
  }

  if (!cleaned.fullName) return { message: 'Enter your full name.', ok: false }
  if (cleaned.role === 'service_provider' && !cleaned.businessName) {
    return { message: 'Enter your business name.', ok: false }
  }

  const { error: accountError } = await supabase
    .from('profiles')
    .update({
      full_name: cleaned.fullName,
      phone: cleaned.phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authData.user.id)

  if (accountError) return { message: accountError.message, ok: false }

  if (cleaned.role === 'service_provider') {
    const { error: providerError } = await supabase
      .from('provider_profiles')
      .update({
        business_name: cleaned.businessName,
        contact_email: cleaned.contactEmail || null,
        contact_phone: cleaned.contactPhone || null,
        description: cleaned.businessDescription || null,
        location: cleaned.businessLocation || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', authData.user.id)

    if (providerError) return { message: providerError.message, ok: false }
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      business_name: cleaned.role === 'service_provider' ? cleaned.businessName : undefined,
      full_name: cleaned.fullName,
    },
  })

  if (metadataError) {
    return {
      message: 'Your profile was saved, but the sign-in display name will refresh next time.',
      ok: true,
      profile: cleaned,
    }
  }

  return { ok: true, profile: cleaned }
}

function normalizeEditableRole(value: unknown): EditableAccountProfile['role'] {
  if (value === 'service_provider' || value === 'event_coordinator') return value
  return 'client'
}
