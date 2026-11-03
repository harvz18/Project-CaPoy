import { supabase } from './supabase'
import { composeProfileFullName, resolveProfileDisplayName } from './profile-name'

export type EditableAccountProfile = {
  avatarUrl: string
  businessCoverUrl: string
  businessDescription: string
  businessLocation: string
  businessLogoUrl: string
  businessName: string
  contactEmail: string
  contactPhone: string
  email: string
  firstName: string
  fullName: string
  hasStructuredName: boolean
  lastName: string
  phone: string
  role: 'client' | 'service_provider' | 'event_coordinator'
}

export type ProfileResult = {
  message?: string
  ok: boolean
  profile?: EditableAccountProfile
}

export type ProfilePhotoResult = {
  avatarUrl?: string
  message?: string
  ok: boolean
}

export type ProviderBusinessImageTarget = 'cover' | 'logo'

export type ProviderBusinessImageResult = {
  imageUrl?: string
  message?: string
  ok: boolean
}

export type ProfilePhotoUpload = {
  fileName?: string | null
  mimeType?: string | null
  uri: string
}

const emptyProfile: EditableAccountProfile = {
  avatarUrl: '',
  businessCoverUrl: '',
  businessDescription: '',
  businessLocation: '',
  businessLogoUrl: '',
  businessName: '',
  contactEmail: '',
  contactPhone: '',
  email: '',
  firstName: '',
  fullName: '',
  hasStructuredName: false,
  lastName: '',
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
    .select('first_name, last_name, full_name, email, phone, avatar_url, default_role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (accountError) return { message: accountError.message, ok: false }

  const role = normalizeEditableRole(account?.default_role)
  const firstName = account?.first_name?.trim() ?? ''
  const lastName = account?.last_name?.trim() ?? ''
  const hasStructuredName = Boolean(firstName && lastName)
  let provider: Record<string, string | null> | null = null

  if (role === 'service_provider') {
    const { data, error } = await supabase
      .from('provider_profiles')
      .select('business_name, description, contact_email, contact_phone, location, business_logo_url, business_cover_url')
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
      businessCoverUrl: provider?.business_cover_url ?? '',
      businessDescription: provider?.description ?? '',
      businessLocation: provider?.location ?? '',
      businessLogoUrl: provider?.business_logo_url ?? '',
      businessName: provider?.business_name ?? '',
      contactEmail: provider?.contact_email ?? authData.user.email ?? '',
      contactPhone: provider?.contact_phone ?? account?.phone ?? '',
      email: account?.email ?? authData.user.email ?? '',
      firstName,
      fullName: resolveProfileDisplayName({ firstName, lastName, fullName: account?.full_name }),
      hasStructuredName,
      lastName,
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
    firstName: value.firstName.trim(),
    fullName: value.fullName.trim(),
    hasStructuredName: value.hasStructuredName,
    lastName: value.lastName.trim(),
    phone: value.phone.trim(),
  }

  if (cleaned.hasStructuredName && (!cleaned.firstName || !cleaned.lastName)) {
    return { message: 'Enter your first and last name.', ok: false }
  }
  if (!cleaned.hasStructuredName && !cleaned.fullName) return { message: 'Enter your full name.', ok: false }
  if (cleaned.role === 'service_provider' && !cleaned.businessName) {
    return { message: 'Enter your business name.', ok: false }
  }

  const resolvedFullName = cleaned.hasStructuredName
    ? composeProfileFullName(cleaned.firstName, cleaned.lastName)
    : cleaned.fullName
  const profileUpdate = {
    avatar_url: cleaned.avatarUrl || null,
    full_name: resolvedFullName,
    phone: cleaned.phone || null,
    updated_at: new Date().toISOString(),
    ...(cleaned.hasStructuredName
      ? { first_name: cleaned.firstName, last_name: cleaned.lastName }
      : {}),
  }
  const { error: accountError } = await supabase
    .from('profiles')
    .update(profileUpdate)
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
      ...(cleaned.hasStructuredName
        ? { first_name: cleaned.firstName, last_name: cleaned.lastName }
        : {}),
      full_name: resolvedFullName,
    },
  })

  if (metadataError) {
    return {
      message: 'Your profile was saved, but the sign-in display name will refresh next time.',
      ok: true,
      profile: { ...cleaned, fullName: resolvedFullName },
    }
  }

  return { ok: true, profile: { ...cleaned, fullName: resolvedFullName } }
}

export async function uploadEditableAccountPhoto(
  upload: ProfilePhotoUpload
): Promise<ProfilePhotoResult> {
  if (!supabase) {
    return { message: 'Connect Supabase to upload your profile photo.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to update your profile photo.', ok: false }
  }

  let imageBody: ArrayBuffer
  try {
    const response = await fetch(upload.uri)
    if (!response.ok) throw new Error('The selected image could not be opened.')
    imageBody = await response.arrayBuffer()
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'The selected image could not be opened.',
      ok: false,
    }
  }

  const contentType = normalizedImageType(upload.mimeType)
    ?? imageTypeFromName(upload.fileName || upload.uri)
  if (!contentType) {
    return { message: 'Choose a JPEG, PNG, or WebP image.', ok: false }
  }
  if (imageBody.byteLength > 5 * 1024 * 1024) {
    return { message: 'Profile photos must be 5 MB or smaller.', ok: false }
  }

  const extension = contentType === 'image/jpeg'
    ? 'jpg'
    : contentType === 'image/png'
      ? 'png'
      : 'webp'
  const objectPath = `${authData.user.id}/avatar-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(objectPath, imageBody, { contentType, upsert: false })

  if (uploadError) return { message: uploadError.message, ok: false }

  const { data: publicUrlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(objectPath)
  const avatarUrl = publicUrlData.publicUrl
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', authData.user.id)
    .maybeSingle()
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', authData.user.id)

  if (profileError) {
    await supabase.storage.from('profile-photos').remove([objectPath])
    return { message: profileError.message, ok: false }
  }

  const previousPath = profilePhotoPath(currentProfile?.avatar_url, authData.user.id)
  if (previousPath && previousPath !== objectPath) {
    await supabase.storage.from('profile-photos').remove([previousPath])
  }

  return { avatarUrl, ok: true }
}

export async function uploadProviderBusinessImage(
  target: ProviderBusinessImageTarget,
  upload: ProfilePhotoUpload
): Promise<ProviderBusinessImageResult> {
  if (!supabase) {
    return { message: 'Connect Supabase to upload your business image.', ok: false }
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Sign in to update your business image.', ok: false }
  }

  let imageBody: ArrayBuffer
  try {
    const response = await fetch(upload.uri)
    if (!response.ok) throw new Error('The selected image could not be opened.')
    imageBody = await response.arrayBuffer()
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'The selected image could not be opened.',
      ok: false,
    }
  }

  const contentType = normalizedImageType(upload.mimeType)
    ?? imageTypeFromName(upload.fileName || upload.uri)
  if (!contentType) {
    return { message: 'Choose a JPEG, PNG, or WebP image.', ok: false }
  }
  if (imageBody.byteLength > 5 * 1024 * 1024) {
    return { message: 'Business images must be 5 MB or smaller.', ok: false }
  }

  const column = target === 'logo' ? 'business_logo_url' : 'business_cover_url'
  const extension = contentType === 'image/jpeg'
    ? 'jpg'
    : contentType === 'image/png'
      ? 'png'
      : 'webp'
  const objectPath = `${authData.user.id}/business-${target}-${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(objectPath, imageBody, { contentType, upsert: false })

  if (uploadError) return { message: uploadError.message, ok: false }

  const { data: publicUrlData } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(objectPath)
  const imageUrl = publicUrlData.publicUrl
  const { data: provider, error: providerLookupError } = await supabase
    .from('provider_profiles')
    .select(`id, ${column}`)
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (providerLookupError || !provider?.id) {
    await supabase.storage.from('profile-photos').remove([objectPath])
    return {
      message: providerLookupError?.message ?? 'Your provider business profile could not be found.',
      ok: false,
    }
  }

  const previousImageUrl = (provider as Record<string, unknown>)[column]
  const { error: providerError } = await supabase
    .from('provider_profiles')
    .update({ [column]: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', provider.id)
    .eq('user_id', authData.user.id)

  if (providerError) {
    await supabase.storage.from('profile-photos').remove([objectPath])
    return { message: providerError.message, ok: false }
  }

  const previousPath = providerBusinessImagePath(previousImageUrl, authData.user.id, target)
  if (previousPath && previousPath !== objectPath) {
    await supabase.storage.from('profile-photos').remove([previousPath])
  }

  return { imageUrl, ok: true }
}

function normalizedImageType(value?: string | null) {
  const normalized = value?.toLowerCase()
  if (normalized === 'image/jpg' || normalized === 'image/jpeg') return 'image/jpeg'
  if (normalized === 'image/png') return 'image/png'
  if (normalized === 'image/webp') return 'image/webp'
  return undefined
}

function imageTypeFromName(value?: string | null) {
  const normalized = value?.split('?')[0].toLowerCase()
  if (normalized?.endsWith('.jpg') || normalized?.endsWith('.jpeg')) return 'image/jpeg'
  if (normalized?.endsWith('.png')) return 'image/png'
  if (normalized?.endsWith('.webp')) return 'image/webp'
  return undefined
}

function profilePhotoPath(value: unknown, userId: string) {
  if (typeof value !== 'string' || !value) return undefined
  const marker = '/storage/v1/object/public/profile-photos/'
  const markerIndex = value.indexOf(marker)
  if (markerIndex < 0) return undefined

  const path = decodeURIComponent(value.slice(markerIndex + marker.length))
  return path.startsWith(`${userId}/`) ? path : undefined
}

function providerBusinessImagePath(
  value: unknown,
  userId: string,
  target: ProviderBusinessImageTarget
) {
  const path = profilePhotoPath(value, userId)
  return path?.startsWith(`${userId}/business-${target}-`) ? path : undefined
}

function normalizeEditableRole(value: unknown): EditableAccountProfile['role'] {
  if (value === 'service_provider' || value === 'event_coordinator') return value
  return 'client'
}
