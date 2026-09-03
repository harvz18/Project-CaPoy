import { supabase, supabaseConfig } from './supabase'
import type {
  AvailabilityCalendarValue,
  BookingItem,
  BookingRequestDeclineValue,
  BookingRequestDecisionValue,
  ChangePasswordValue,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantBookingRequest,
  OperatingHoursValue,
  PayoutTransaction,
  ServiceListingReviewValue,
} from '../screens'

type MerchantResult = {
  ok: boolean
  message?: string
}

export interface MerchantServiceListing {
  basePrice: number
  categoryName: string
  coverImageUrl: string
  description: string
  id: string
  name: string
  packageCount: number
  status: string
  updatedAt: string
}

const notReady =
  'Supabase is not configured, no user is signed in, or this account is not a merchant account.'

const metadataText = (metadata: Record<string, unknown>, key: string, fallback = '') => {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

const getClient = () => {
  if (!supabase || !supabaseConfig.isConfigured) {
    return null
  }

  return supabase
}

const toMessage = (error: unknown, fallback = 'Unable to save merchant data.') =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback

const getMerchantContext = async (): Promise<
  | {
      client: NonNullable<typeof supabase>
      providerId: string
      userId: string
    }
  | null
> => {
  const client = getClient()

  if (!client) {
    return null
  }

  const { data: userData } = await client.auth.getUser()
  const user = userData.user
  const userId = user?.id

  if (!userId) {
    return null
  }

  const { data: existingProvider } = await client
    .from('provider_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingProvider?.id) {
    return { client, providerId: existingProvider.id as string, userId }
  }

  const { data: profile } = await client
    .from('profiles')
    .select('default_role, full_name, email, phone')
    .eq('id', userId)
    .maybeSingle()

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const email = user?.email ?? metadataText(metadata, 'email', String(profile?.email ?? ''))
  const phone = metadataText(metadata, 'phone', String(profile?.phone ?? ''))
  const fullName = metadataText(
    metadata,
    'full_name',
    String(profile?.full_name ?? email.split('@')[0] ?? 'Merchant')
  )
  const businessName = metadataText(metadata, 'business_name', fullName || 'Business profile')
  const serviceCategory = metadataText(metadata, 'service_category')

  const { error: profileError } = await client.from('profiles').upsert({
    id: userId,
    account_status: 'pending',
    default_role: 'service_provider',
    email,
    full_name: fullName,
    phone,
    updated_at: new Date().toISOString(),
  })

  if (profileError) {
    console.warn('Unable to repair merchant profile row:', profileError.message)
  }

  const providerPayload = {
    business_name: businessName,
    contact_email: email,
    contact_phone: phone,
    description: serviceCategory,
    updated_at: new Date().toISOString(),
    user_id: userId,
    verification_status: 'pending',
  }

  const { data: provider, error } = await client
    .from('provider_profiles')
    .upsert(providerPayload, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (
    error?.message.toLowerCase().includes('no unique or exclusion constraint matching')
  ) {
    const { data: insertedProvider, error: insertError } = await client
      .from('provider_profiles')
      .insert(providerPayload)
      .select('id')
      .single()

    if (!insertError && insertedProvider?.id) {
      return { client, providerId: insertedProvider.id as string, userId }
    }

    console.warn('Unable to create provider profile row:', insertError?.message)
    return null
  }

  if (error) {
    console.warn('Unable to repair provider profile row:', error.message)
    return null
  }

  if (!provider?.id) return null

  return { client, providerId: provider.id as string, userId }
}

const findCategoryId = async (categoryName: string) => {
  const client = getClient()

  if (!client) return null

  const { data } = await client
    .from('service_categories')
    .select('id')
    .ilike('name', `%${categoryName.trim()}%`)
    .limit(1)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
}

const amountFromListing = (value: ServiceListingReviewValue) => {
  if (value.pricing.model === 'customQuote') return null
  return value.pricing.amount ?? 0
}

export const loadMerchantServiceDraft = async (): Promise<ServiceListingReviewValue | null> => {
  const context = await getMerchantContext()

  if (!context) {
    return null
  }

  const { data } = await context.client
    .from('provider_service_listing_drafts')
    .select('payload')
    .eq('provider_id', context.providerId)
    .maybeSingle()

  return (data?.payload as ServiceListingReviewValue | undefined) ?? null
}

export const saveMerchantServiceDraft = async (
  value: Partial<ServiceListingReviewValue>
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.from('provider_service_listing_drafts').upsert(
      {
        payload: value,
        provider_id: context.providerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider_id' }
    )

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const clearMerchantServiceDraft = async (): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client
      .from('provider_service_listing_drafts')
      .delete()
      .eq('provider_id', context.providerId)

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const uploadMerchantServicePhoto = async (uri: string): Promise<string | null> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return uri
    }

    const response = await fetch(uri)
    const blob = await response.blob()
    const extension = uri.split('.').pop()?.split('?')[0] || 'jpg'
    const path = `${context.providerId}/${Date.now()}.${extension}`
    const { error } = await context.client.storage
      .from('service-photos')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })

    if (error) {
      return uri
    }

    const { data } = context.client.storage.from('service-photos').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return uri
  }
}

export const saveMerchantServiceListing = async (
  value: ServiceListingReviewValue,
  status: 'draft' | 'active'
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const categoryId = await findCategoryId(value.information.category)
    const coverImageUrl = value.information.photos[0] ?? null

    const { data: service, error } = await context.client
      .from('services')
      .insert({
        base_price: amountFromListing(value),
        category_id: categoryId,
        cover_image_url: coverImageUrl,
        description: value.information.description,
        provider_id: context.providerId,
        name: value.information.serviceName,
        status,
      })
      .select('id')
      .single()

    if (error || !service?.id) {
      return { ok: false, message: error?.message }
    }

    if (value.packages.length > 0) {
      const { error: packageError } = await context.client.from('service_packages').insert(
        value.packages.map((item) => ({
          description: item.description,
          inclusions: item.inclusions,
          is_active: status === 'active',
          name: item.name,
          price: item.price,
          service_id: service.id,
        }))
      )

      if (packageError) {
        return { ok: false, message: packageError.message }
      }
    }

    await context.client
      .from('provider_service_listing_drafts')
      .delete()
      .eq('provider_id', context.providerId)

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const numberFrom = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const nested = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const toIsoDate = (value: unknown) => textFrom(value, new Date().toISOString().slice(0, 10))

const mapBookingStatus = (status: string): BookingItem['status'] => {
  if (status === 'completed') return 'past'
  if (status === 'confirmed' || status === 'paid' || status === 'approved') return 'confirmed'
  return 'pending'
}

const mapRequestStatus = (status: string): MerchantBookingRequest['status'] => {
  if (status === 'completed') return 'completed'
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') return 'cancelled'
  if (status === 'approved' || status === 'paid' || status === 'confirmed') return 'confirmed'
  return 'new'
}

export const fetchClientBookings = async (): Promise<BookingItem[]> => {
  const client = getClient()

  if (!client) return []

  const { data: userData } = await client.auth.getUser()
  const userId = userData.user?.id

  if (!userId) return []

  const { data, error } = await client
    .from('bookings')
    .select(
      'id, status, requested_date, services(name, cover_image_url, service_categories(name)), provider_profiles(business_name)'
    )
    .eq('client_id', userId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const record = row as Record<string, unknown>
    const service = nested(record.services) as Record<string, unknown> | undefined
    const provider = nested(record.provider_profiles) as Record<string, unknown> | undefined
    const category = nested(service?.service_categories) as Record<string, unknown> | undefined
    const serviceName = textFrom(service?.name, textFrom(provider?.business_name, 'Service'))

    return {
      category: textFrom(category?.name, 'Service'),
      date: toIsoDate(record.requested_date),
      id: textFrom(record.id),
      image: textFrom(service?.cover_image_url),
      imageLabel: serviceName,
      name: serviceName,
      status: mapBookingStatus(textFrom(record.status)),
    }
  })
}

export const fetchMerchantBookingRequests = async (): Promise<MerchantBookingRequest[]> => {
  const context = await getMerchantContext()

  if (!context) return []

  const { data, error } = await context.client
    .from('bookings')
    .select(
      'id, amount, status, requested_date, client_notes, profiles(full_name, email), events(name, event_date), services(name), service_packages(name)'
    )
    .eq('provider_id', context.providerId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const record = row as Record<string, unknown>
    const profile = nested(record.profiles) as Record<string, unknown> | undefined
    const event = nested(record.events) as Record<string, unknown> | undefined
    const service = nested(record.services) as Record<string, unknown> | undefined
    const servicePackage = nested(record.service_packages) as Record<string, unknown> | undefined

    return {
      amount: numberFrom(record.amount),
      clientName: textFrom(profile?.full_name, textFrom(profile?.email, 'Client')),
      currency: 'PHP',
      eventDate: toIsoDate(record.requested_date ?? event?.event_date),
      id: textFrom(record.id),
      packageName: textFrom(servicePackage?.name, textFrom(service?.name, 'Service request')),
      status: mapRequestStatus(textFrom(record.status)),
    }
  })
}

export const fetchMerchantServices = async (): Promise<MerchantServiceListing[]> => {
  const context = await getMerchantContext()

  if (!context) return []

  const { data, error } = await context.client
    .from('services')
    .select(
      'id, name, description, base_price, cover_image_url, status, updated_at, service_categories(name), service_packages(id)'
    )
    .eq('provider_id', context.providerId)
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => {
    const record = row as Record<string, unknown>
    const category = nested(record.service_categories) as Record<string, unknown> | undefined
    const packages = Array.isArray(record.service_packages) ? record.service_packages : []

    return {
      basePrice: numberFrom(record.base_price),
      categoryName: textFrom(category?.name, 'Service'),
      coverImageUrl: textFrom(record.cover_image_url),
      description: textFrom(record.description),
      id: textFrom(record.id),
      name: textFrom(record.name, 'Untitled service'),
      packageCount: packages.length,
      status: textFrom(record.status, 'draft'),
      updatedAt: textFrom(record.updated_at),
    }
  })
}

export const saveAvailabilityCalendar = async ({
  entries,
}: AvailabilityCalendarValue): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    if (entries.length === 0) {
      return { ok: true }
    }

    const dates = entries.map((entry) => entry.date)
    await context.client
      .from('provider_availability')
      .delete()
      .eq('provider_id', context.providerId)
      .in('available_date', dates)

    const { error } = await context.client.from('provider_availability').insert(
      entries
        .filter((entry) => entry.status !== 'booked')
        .map((entry) => ({
          available_date: entry.date,
          is_available: entry.status === 'available',
          notes: entry.bookingLabel ?? null,
          provider_id: context.providerId,
        }))
    )

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveOperatingHours = async ({
  hours,
  timezone,
}: OperatingHoursValue): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    await context.client
      .from('provider_operating_hours')
      .delete()
      .eq('provider_id', context.providerId)

    const { error } = await context.client.from('provider_operating_hours').insert(
      hours.map((entry) => ({
        close_time: entry.closeTime ?? null,
        day_of_week: entry.day,
        is_open: entry.isOpen,
        open_time: entry.openTime ?? null,
        provider_id: context.providerId,
        timezone,
      }))
    )

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveBookingDecision = async (
  value: BookingRequestDecisionValue | BookingRequestDeclineValue
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const isDecline = 'reason' in value
    const { error } = await context.client
      .from('bookings')
      .update({
        provider_notes: isDecline
          ? [value.reasonLabel, value.message].filter(Boolean).join(': ')
          : value.providerNote,
        status: isDecline || value.decision === 'declined' ? 'rejected' : 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', value.request.id)
      .eq('provider_id', context.providerId)

    if (error) {
      return { ok: false, message: error.message }
    }

    if (isDecline && value.blockRequestedDate) {
      await saveAvailabilityCalendar({
        entries: [{ date: value.request.eventDate, status: 'unavailable' }],
      })
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const requestMerchantPayout = async (amount: number): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.from('provider_payout_requests').insert({
      amount,
      currency: 'PHP',
      provider_id: context.providerId,
      status: 'requested',
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const saveNotificationPreferences = async (
  preferences: MerchantNotificationPreferences
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.from('provider_notification_preferences').upsert(
      {
        preferences,
        provider_id: context.providerId,
        updated_at: new Date().toISOString(),
        user_id: context.userId,
      },
      { onConflict: 'provider_id' }
    )

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const markMerchantNotificationRead = async (
  notification: MerchantNotification
): Promise<MerchantResult> => {
  const client = getClient()

  if (!client) {
    return { ok: false, message: notReady }
  }

  const { error } = await client
    .from('notifications')
    .update({ status: 'read' })
    .eq('id', notification.id)

  return { ok: !error, message: error?.message }
}

export const markMerchantNotificationsRead = async (
  notificationIds: string[]
): Promise<MerchantResult> => {
  const client = getClient()

  if (!client || notificationIds.length === 0) {
    return { ok: Boolean(client), message: client ? undefined : notReady }
  }

  const { error } = await client
    .from('notifications')
    .update({ status: 'read' })
    .in('id', notificationIds)

  return { ok: !error, message: error?.message }
}

export const changeMerchantPassword = async ({
  newPassword,
}: ChangePasswordValue): Promise<MerchantResult> => {
  const client = getClient()

  if (!client) {
    return { ok: false, message: notReady }
  }

  const { error } = await client.auth.updateUser({ password: newPassword })

  return { ok: !error, message: error?.message }
}

export const saveMerchantTransactionNote = async (
  transaction: PayoutTransaction,
  action: string
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.from('audit_logs').insert({
      action,
      actor_id: context.userId,
      actor_role: 'service_provider',
      metadata: { transaction },
      resource_id: null,
      resource_type: 'merchant_transaction',
      result: 'recorded',
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}
