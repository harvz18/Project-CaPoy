import { supabase, supabaseConfig } from './supabase'
import type { CateringServiceType } from './catalog'
import type {
  AvailabilityCalendarValue,
  BookingItem,
  BookingServiceItem,
  BookingRequestDeclineValue,
  BookingRequestDecisionValue,
  ChangePasswordValue,
  MerchantNotification,
  MerchantNotificationPreferences,
  MerchantBookingRequest,
  OperatingHoursValue,
  PayoutTransaction,
  ServiceListingReviewValue,
  ServicePricingUnit,
} from '../screens'

type MerchantResult = {
  ok: boolean
  message?: string
  service?: MerchantServiceListing
}

export interface MerchantServiceListing {
  basePrice: number
  categoryName: string
  coverImageUrl: string
  description: string
  id: string
  isAvailable: boolean
  name: string
  packageCount: number
  status: string
  updatedAt: string
}

const notReady =
  'Supabase is not configured, no user is signed in, or this account is not a service-provider account.'
const merchantRepairAttempts = new Set<string>()

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

const randomUuid = () => {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

const isUuid = (value?: string) =>
  Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  )

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

  const { data: existingProvider, error: providerLookupError } = await client
    .from('provider_profiles')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (providerLookupError) {
    console.warn('Unable to load service-provider profile:', providerLookupError.message)
  }

  if (existingProvider?.id) {
    return { client, providerId: existingProvider.id as string, userId }
  }

  const { data: profile } = await client
    .from('profiles')
    .select('default_role, full_name, email, phone')
    .eq('id', userId)
    .maybeSingle()

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const accountRole = String(profile?.default_role ?? metadata.default_role ?? '')

  if (accountRole !== 'service_provider') {
    return null
  }

  if (merchantRepairAttempts.has(userId)) {
    return null
  }

  merchantRepairAttempts.add(userId)

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

const isRemoteUri = (uri: string) => /^https?:\/\//i.test(uri)

const extensionForPhoto = (uri: string, mimeType: string) => {
  const mimeExtension = mimeType.split('/')[1]?.toLowerCase().replace('jpeg', 'jpg')
  if (mimeExtension && /^[a-z0-9]+$/.test(mimeExtension)) return mimeExtension

  const uriExtension = uri.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1]?.toLowerCase()
  return uriExtension ?? 'jpg'
}

const isMissingListingDetailsColumn = (message?: string) => {
  const normalized = message?.toLowerCase() ?? ''
  return (
    normalized.includes('gallery_urls') ||
    normalized.includes('pricing_model') ||
    normalized.includes('pricing_unit') ||
    normalized.includes('pricing_details') ||
    normalized.includes('catering_service_types')
  )
}

const uploadListingPhoto = async (uri: string) => {
  if (isRemoteUri(uri)) {
    return uri
  }

  return uploadMerchantServicePhoto(uri)
}

const mapMerchantServiceRow = (row: unknown, fallbackCategoryName = 'Service') => {
  const record = row as Record<string, unknown>
  const category = nested(record.service_categories) as Record<string, unknown> | undefined
  const packages = Array.isArray(record.service_packages) ? record.service_packages : []

  return {
    basePrice: numberFrom(record.base_price),
    categoryName: textFrom(category?.name, fallbackCategoryName),
    coverImageUrl: textFrom(record.cover_image_url),
    description: textFrom(record.description),
    id: textFrom(record.id),
    isAvailable: record.is_available !== false,
    name: textFrom(record.name, 'Untitled service'),
    packageCount: packages.length,
    status: textFrom(record.status, 'draft'),
    updatedAt: textFrom(record.updated_at, new Date().toISOString()),
  } satisfies MerchantServiceListing
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
      return {
        ok: false,
        message:
          'Your session is active, but its service-provider profile could not be loaded. Sign out, sign back in with the service-provider account, and try again.',
      }
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
      return {
        ok: false,
        message:
          'Your account is signed in, but its service-provider profile could not be loaded. Sign out, sign back in with the service-provider account, and try again.',
      }
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
    const extension = extensionForPhoto(uri, blob.type)
    const path = `${context.providerId}/${Date.now()}.${extension}`
    const { error } = await context.client.storage
      .from('service-photos')
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })

    if (error) {
      console.warn('Unable to upload service photo:', error.message)
      return null
    }

    const { data } = context.client.storage.from('service-photos').getPublicUrl(path)
    return data.publicUrl
  } catch (error) {
    console.warn('Unable to upload service photo:', toMessage(error))
    return null
  }
}

export const saveMerchantServiceListing = async (
  value: ServiceListingReviewValue,
  status: 'draft' | 'active',
  existingServiceId?: string
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return {
        ok: false,
        message:
          'Your account is signed in, but its service-provider profile could not be loaded. Sign out, sign back in with the service-provider account, and try again.',
      }
    }

    const categoryId = isUuid(value.information.categoryId)
      ? value.information.categoryId
      : await findCategoryId(value.information.category)

    if (!categoryId) {
      return {
        ok: false,
        message: 'Choose an active service category before publishing this listing.',
      }
    }

    const isCatering = value.information.category.toLowerCase().includes('cater')
    const cateringServiceTypes = value.pricing.cateringServiceTypes ?? []
    if (status === 'active' && isCatering && cateringServiceTypes.length === 0) {
      return {
        ok: false,
        message: 'Select at least one available catering style before publishing this listing.',
      }
    }
    const uploadedPhotos = await Promise.all(
      value.information.photos.map((photo) => uploadListingPhoto(photo))
    )
    const coverImageUrl = uploadedPhotos.find((photo): photo is string => Boolean(photo)) ?? null
    const now = new Date().toISOString()
    const serviceId = existingServiceId || randomUuid()
    const submittedStatus = status === 'active' ? 'pending_review' : status
    const servicePayload = {
      id: serviceId,
      base_price: amountFromListing(value),
      category_id: categoryId,
      cover_image_url: coverImageUrl,
      description: value.information.description,
      provider_id: context.providerId,
      name: value.information.serviceName,
      status: submittedStatus,
      updated_at: now,
    }
    const detailedServicePayload = {
      ...servicePayload,
      gallery_urls: uploadedPhotos.filter((photo): photo is string => Boolean(photo)),
      catering_service_types: isCatering ? cateringServiceTypes : [],
      pricing_details: value.pricing.details,
      pricing_model: value.pricing.model,
      pricing_unit: value.pricing.unit ?? null,
    }

    const writeDetailedService = () =>
      existingServiceId
        ? context.client
            .from('services')
            .update(detailedServicePayload)
            .eq('id', existingServiceId)
            .eq('provider_id', context.providerId)
        : context.client.from('services').insert(detailedServicePayload)
    const writeBasicService = () =>
      existingServiceId
        ? context.client
            .from('services')
            .update(servicePayload)
            .eq('id', existingServiceId)
            .eq('provider_id', context.providerId)
        : context.client.from('services').insert(servicePayload)

    let serviceInsert = await writeDetailedService()

    if (serviceInsert.error && isMissingListingDetailsColumn(serviceInsert.error.message)) {
      serviceInsert = await writeBasicService()
    }

    const { error } = serviceInsert

    if (error) {
      console.warn('Unable to create merchant service:', error.message)
      return { ok: false, message: error.message }
    }

    if (existingServiceId) {
      const { error: removePackagesError } = await context.client
        .from('service_packages')
        .delete()
        .eq('service_id', existingServiceId)

      if (removePackagesError) {
        return { ok: false, message: removePackagesError.message }
      }
    }

    if (value.packages.length > 0) {
      const packageRows = value.packages.map((item) => ({
          description: item.description,
          inclusions: item.inclusions,
          is_active: false,
          name: item.name,
          price: item.price,
          service_id: serviceId,
        }))
      let packageInsert = await context.client.from('service_packages').insert(
        packageRows.map((item, index) => ({
          ...item,
          pricing_unit: value.packages[index]?.unit ?? 'event',
        }))
      )

      if (packageInsert.error && isMissingListingDetailsColumn(packageInsert.error.message)) {
        packageInsert = await context.client.from('service_packages').insert(packageRows)
      }

      const { error: packageError } = packageInsert

      if (packageError) {
        return { ok: false, message: packageError.message }
      }
    }

    await context.client
      .from('provider_service_listing_drafts')
      .delete()
      .eq('provider_id', context.providerId)

    return {
      ok: true,
      service: mapMerchantServiceRow(
        {
          ...servicePayload,
          service_packages: value.packages.map((item) => ({ id: item.id })),
        },
        value.information.category
      ),
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

const textFrom = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback

const numberFrom = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const nested = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const toIsoDate = (value: unknown) => textFrom(value, 'Date to be confirmed')

const mapServiceBookingStatus = (status: string): BookingServiceItem['status'] => {
  if (status === 'completed') return 'completed'
  if (status === 'confirmed' || status === 'approved') return 'confirmed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'rejected' || status === 'expired') return 'declined'
  return 'requested'
}

const parseBookingDate = (value: string) => {
  const trimmed = value.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (isoMatch) return trimmed

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!slashMatch) return null

  const [, month, day, year] = slashMatch
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const parseBookingTime = (value: string) => {
  const trimmed = value.trim().toUpperCase()
  const match = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?$/.exec(trimmed)
  if (!match) return null

  const [, hourText, minuteText = '00', secondText = '00', meridiem] = match
  let hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)

  if (minute > 59 || second > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) {
    return null
  }
  if (meridiem === 'PM' && hour < 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

export const cancelClientEventBookings = async (
  eventId: string,
  reason: string
): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(eventId)) {
      return { ok: false, message: 'This event booking could not be identified.' }
    }

    const { error } = await client.rpc('cancel_client_event_bookings', {
      cancellation_reason: reason.trim() || null,
      target_event_id: eventId,
    })

    if (error) {
      return {
        ok: false,
        message: error.message.toLowerCase().includes('cancel_client_event_bookings')
          ? 'Booking cancellation is not installed yet. Apply database/27_client_booking_changes.sql, then try again.'
          : error.message,
      }
    }

    return {
      ok: true,
      message: 'The event was cancelled. Its providers and coordinator were notified and released.',
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to cancel this booking.') }
  }
}

export const rescheduleClientEventBookings = async (
  eventId: string,
  value: { date: string; time: string }
): Promise<MerchantResult> => {
  try {
    const client = getClient()
    const date = parseBookingDate(value.date)
    const time = parseBookingTime(value.time)

    if (!client || !isUuid(eventId)) {
      return { ok: false, message: 'This event booking could not be identified.' }
    }
    if (!date) {
      return { ok: false, message: 'Enter the new date as YYYY-MM-DD or MM/DD/YYYY.' }
    }
    if (!time) {
      return { ok: false, message: 'Enter a valid time, such as 2:30 PM.' }
    }

    const { error } = await client.rpc('reschedule_client_event_bookings', {
      requested_event_date: date,
      requested_event_time: time,
      target_event_id: eventId,
    })

    if (error) {
      return {
        ok: false,
        message: error.message.toLowerCase().includes('reschedule_client_event_bookings')
          ? 'Booking rescheduling is not installed yet. Apply database/27_client_booking_changes.sql, then try again.'
          : error.message,
      }
    }

    return {
      ok: true,
      message: 'The new schedule was sent to every booked provider for confirmation.',
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to reschedule this booking.') }
  }
}

export const loadMerchantServiceForEditing = async (
  serviceId: string
): Promise<ServiceListingReviewValue | null> => {
  const context = await getMerchantContext()
  if (!context) return null

  const { data, error } = await context.client
    .from('services')
    .select(
      'id, name, description, base_price, cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details, catering_service_types, category_id, service_categories(name), service_packages(id, name, description, price, inclusions, pricing_unit)'
    )
    .eq('id', serviceId)
    .eq('provider_id', context.providerId)
    .maybeSingle()

  if (error || !data) return null

  const record = data as unknown as Record<string, unknown>
  const category = nested(record.service_categories) as Record<string, unknown> | undefined
  const gallery = Array.isArray(record.gallery_urls)
    ? record.gallery_urls.filter((item): item is string => typeof item === 'string')
    : []
  const coverImage = textFrom(record.cover_image_url)
  const pricingModel = textFrom(record.pricing_model, 'fixed')
  const pricingUnit = textFrom(record.pricing_unit, 'event')
  const packageRows = Array.isArray(record.service_packages)
    ? (record.service_packages as Array<Record<string, unknown>>)
    : []
  const cateringServiceTypes = Array.isArray(record.catering_service_types)
    ? record.catering_service_types.filter(
        (item): item is CateringServiceType =>
          item === 'plated' || item === 'buffet' || item === 'packed'
      )
    : []

  return {
    information: {
      category: textFrom(category?.name, 'Service'),
      categoryId: textFrom(record.category_id),
      description: textFrom(record.description),
      photos: Array.from(new Set([coverImage, ...gallery].filter(Boolean))),
      serviceName: textFrom(record.name),
    },
    packages: packageRows.map((item) => ({
      currency: 'PHP' as const,
      description: textFrom(item.description),
      id: textFrom(item.id, randomUuid()),
      inclusions: Array.isArray(item.inclusions)
        ? item.inclusions.filter((entry): entry is string => typeof entry === 'string')
        : [],
      name: textFrom(item.name, 'Package'),
      price: numberFrom(item.price),
      unit: (['event', 'person', 'hour', 'day'].includes(textFrom(item.pricing_unit))
        ? textFrom(item.pricing_unit)
        : 'event') as ServicePricingUnit,
    })),
    pricing: {
      amount: pricingModel === 'customQuote' ? undefined : numberFrom(record.base_price),
      cateringServiceTypes,
      currency: 'PHP',
      details: textFrom(record.pricing_details),
      model: (['fixed', 'startingAt', 'customQuote'].includes(pricingModel)
        ? pricingModel
        : 'fixed') as ServiceListingReviewValue['pricing']['model'],
      unit: (['event', 'person', 'hour', 'day'].includes(pricingUnit)
        ? pricingUnit
        : 'event') as ServiceListingReviewValue['pricing']['unit'],
    },
  }
}

export const deleteMerchantServiceListing = async (
  serviceId: string
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()
    if (!context) return { ok: false, message: notReady }

    const { error } = await context.client.rpc('provider_delete_service', {
      target_service_id: serviceId,
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const setMerchantServiceAvailability = async (
  serviceId: string,
  isAvailable: boolean
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()
    if (!context) return { ok: false, message: notReady }

    const { error } = await context.client.rpc('provider_set_service_availability', {
      available: isAvailable,
      target_service_id: serviceId,
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
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
      'id, event_id, provider_id, service_id, amount, status, requested_date, requested_time, created_at, updated_at, events(id, coordinator_id, name, event_type, event_date, event_time, guest_count, venue, location, status), services(name, cover_image_url, service_categories(name)), provider_profiles(business_name), payments!inner(status, amount, paid_at, metadata)'
    )
    .eq('client_id', userId)
    .neq('status', 'payment_required')
    .in('payments.status', ['paid', 'verified'])
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const bookingIds = data
    .map((row) => textFrom((row as Record<string, unknown>).id))
    .filter(Boolean)
  const eventIds = Array.from(new Set(data.map((row) => textFrom(row.event_id)).filter(Boolean)))
  const coordinatorIds = Array.from(new Set(data.flatMap((row) => {
    const event = nested((row as unknown as Record<string, unknown>).events) as Record<string, unknown> | undefined
    const coordinatorId = textFrom(event?.coordinator_id)
    return coordinatorId ? [coordinatorId] : []
  })))
  const [{ data: reviewRows }, { data: coordinatorProfiles }, { data: coordinatorReviewRows }] =
    await Promise.all([
      bookingIds.length
        ? client
            .from('reviews')
            .select('booking_id')
            .eq('reviewer_id', userId)
            .in('booking_id', bookingIds)
        : Promise.resolve({ data: [] }),
      coordinatorIds.length
        ? client.rpc('list_available_event_coordinators')
        : Promise.resolve({ data: [] }),
      eventIds.length
        ? client
            .from('coordinator_reviews')
            .select('event_id')
            .eq('reviewer_id', userId)
            .in('event_id', eventIds)
        : Promise.resolve({ data: [] }),
    ])
  const reviewedBookingIds = new Set((reviewRows ?? []).map((row) => textFrom(row.booking_id)))
  const reviewedCoordinatorEventIds = new Set(
    (coordinatorReviewRows ?? []).map((row) => textFrom(row.event_id))
  )
  const coordinatorProfileRows = Array.isArray(coordinatorProfiles)
    ? (coordinatorProfiles as Array<Record<string, unknown>>)
    : []
  const coordinatorProfilesById = new Map(
    coordinatorProfileRows
      .filter((profile) => coordinatorIds.includes(textFrom(profile.id)))
      .map((profile) => [textFrom(profile.id), profile])
  )
  const grouped = new Map<string, BookingItem>()

  data.forEach((row) => {
    const record = row as Record<string, unknown>
    const event = nested(record.events) as Record<string, unknown> | undefined
    const service = nested(record.services) as Record<string, unknown> | undefined
    const provider = nested(record.provider_profiles) as Record<string, unknown> | undefined
    const category = nested(service?.service_categories) as Record<string, unknown> | undefined
    const payments = Array.isArray(record.payments)
      ? (record.payments as Array<Record<string, unknown>>)
      : []
    const latestPayment = payments.at(-1)
    const serviceName = textFrom(service?.name, textFrom(provider?.business_name, 'Service'))
    const eventId = textFrom(record.event_id, textFrom(event?.id, textFrom(record.id)))
    const rawStatus = textFrom(record.status)
    const serviceItem: BookingServiceItem = {
      amount: numberFrom(record.amount),
      bookingId: textFrom(record.id),
      category: textFrom(category?.name, 'Service'),
      image: textFrom(service?.cover_image_url),
      paymentStatus: textFrom(latestPayment?.status, 'pending'),
      providerId: textFrom(record.provider_id),
      providerName: textFrom(provider?.business_name, 'Service provider'),
      rawStatus,
      serviceId: textFrom(record.service_id),
      serviceName,
      status: mapServiceBookingStatus(rawStatus),
      updatedAt: textFrom(record.updated_at),
    }

    const current = grouped.get(eventId)
    if (current) {
      current.amount = Number(current.amount ?? 0) + serviceItem.amount
      current.services = [...(current.services ?? []), serviceItem]
      if (!current.image && serviceItem.image) current.image = serviceItem.image
      if (textFrom(record.updated_at) > textFrom(current.updatedAt)) {
        current.updatedAt = textFrom(record.updated_at)
      }
      return
    }

    const eventName = textFrom(event?.name, 'Event booking')
    const coordinatorId = textFrom(event?.coordinator_id)
    const coordinator = coordinatorProfilesById.get(coordinatorId)
    const metadata =
      latestPayment?.metadata && typeof latestPayment.metadata === 'object'
        ? (latestPayment.metadata as Record<string, unknown>)
        : {}
    const paymentType = metadata.paymentType === 'full' ? 'Paid in full' : 'Deposit paid'

    grouped.set(eventId, {
      amount: serviceItem.amount,
      category: textFrom(event?.event_type, 'Event'),
      createdAt: textFrom(record.created_at),
      coordinatorAvatarUrl: textFrom(coordinator?.avatar_url) || undefined,
      coordinatorName: coordinatorId
        ? textFrom(coordinator?.full_name, 'Event Coordinator')
        : undefined,
      coordinatorUserId: coordinatorId || undefined,
      date: toIsoDate(event?.event_date ?? record.requested_date),
      eventId,
      hasFeedback: false,
      eventType: textFrom(event?.event_type, 'Event'),
      guestCount: numberFrom(event?.guest_count),
      id: eventId,
      image: serviceItem.image,
      imageLabel: eventName,
      location: textFrom(event?.location),
      name: eventName,
      paymentStatus: latestPayment ? paymentType : 'Pending',
      rawStatus: textFrom(event?.status),
      requestedTime: textFrom(event?.event_time, textFrom(record.requested_time)),
      services: [serviceItem],
      status: 'requested',
      updatedAt: textFrom(record.updated_at),
      venue: textFrom(event?.venue),
    })
  })

  return Array.from(grouped.values()).map((booking) => {
    const services = booking.services ?? []
    const statuses = services.map((service) => service.status)

    return {
      ...booking,
      hasFeedback:
        services.length > 0 &&
        services.every((service) => reviewedBookingIds.has(service.bookingId)) &&
        (!booking.coordinatorUserId || reviewedCoordinatorEventIds.has(booking.eventId ?? booking.id)),
      status:
        statuses.length > 0 && statuses.every((status) => status === 'completed')
          ? 'completed'
          : statuses.length > 0 &&
              statuses.every((status) => status === 'cancelled' || status === 'declined')
            ? 'cancelled'
          : statuses.length > 0 &&
              statuses.every((status) => status === 'confirmed' || status === 'completed')
            ? 'confirmed'
            : 'requested',
    }
  })
}

export const fetchMerchantBookingRequests = async (): Promise<MerchantBookingRequest[]> => {
  const context = await getMerchantContext()

  if (!context) return []

  const { data, error } = await context.client
    .from('bookings')
    .select(
      'id, event_id, service_id, amount, status, requested_date, requested_time, client_notes, created_at, profiles(full_name, email), events(name, event_type, event_date, event_time, guest_count, venue, location), services(name, description, service_categories(name)), service_packages(name, description, inclusions), payments!inner(status)'
    )
    .eq('provider_id', context.providerId)
    .neq('status', 'payment_required')
    .in('payments.status', ['paid', 'verified'])
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const eventIds = Array.from(
    new Set(data.map((row) => row.event_id as string | null).filter(Boolean))
  ) as string[]
  const [{ data: instructionRows }, { data: selectionRows }] = eventIds.length
    ? await Promise.all([
        context.client
          .from('event_provider_instructions')
          .select('id, event_id, provider_id, service_id, category_name, title, body, tags')
          .in('event_id', eventIds)
          .or(`provider_id.eq.${context.providerId},provider_id.is.null`)
          .eq('status', 'saved'),
        context.client
          .from('event_service_selections')
          .select('event_id, service_id, attendee_count, budget_per_head, meal_type, outside_food, dietary_notes')
          .in('event_id', eventIds)
          .eq('provider_id', context.providerId)
          .not('status', 'in', '(declined,cancelled)'),
      ])
    : [{ data: [] }, { data: [] }]

  const individualRequests = data.map((row) => {
    const record = row as Record<string, unknown>
    const profile = nested(record.profiles) as Record<string, unknown> | undefined
    const event = nested(record.events) as Record<string, unknown> | undefined
    const service = nested(record.services) as Record<string, unknown> | undefined
    const serviceCategory = nested(service?.service_categories) as Record<string, unknown> | undefined
    const servicePackage = nested(record.service_packages) as Record<string, unknown> | undefined
    const packageInclusions = Array.isArray(servicePackage?.inclusions)
      ? servicePackage.inclusions.filter((item): item is string => typeof item === 'string')
      : []
    const eventId = textFrom(record.event_id)
    const serviceId = textFrom(record.service_id)
    const bookingDetails = (selectionRows ?? []).find(
      (selection) => selection.event_id === eventId && selection.service_id === serviceId
    )
    const instructions = (instructionRows ?? [])
      .filter(
        (instruction) =>
          instruction.event_id === eventId &&
          (!instruction.service_id || instruction.service_id === serviceId)
      )
      .map((instruction) => ({
        body: textFrom(instruction.body),
        category: textFrom(instruction.category_name, 'Event'),
        id: textFrom(instruction.id),
        tags: Array.isArray(instruction.tags)
          ? instruction.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        title: textFrom(instruction.title, 'Client instruction'),
      }))
      .filter((instruction) => instruction.body.length > 0 || instruction.tags.length > 0)

    return {
      amount: numberFrom(record.amount),
      attendeeCount: bookingDetails?.attendee_count == null
        ? undefined
        : numberFrom(bookingDetails.attendee_count),
      budgetPerHead: bookingDetails?.budget_per_head == null
        ? undefined
        : numberFrom(bookingDetails.budget_per_head),
      clientEmail: textFrom(profile?.email),
      clientNotes: textFrom(record.client_notes),
      dietaryNotes: textFrom(bookingDetails?.dietary_notes) || undefined,
      clientName: textFrom(profile?.full_name, textFrom(profile?.email, 'Client')),
      currency: 'PHP' as const,
      eventDate: toIsoDate(record.requested_date ?? event?.event_date),
      eventId,
      eventName: textFrom(event?.name, 'Event'),
      eventType: textFrom(event?.event_type, 'Event'),
      guestCount: numberFrom(event?.guest_count),
      id: textFrom(record.id),
      instructions,
      location: textFrom(event?.location),
      packageDescription: textFrom(servicePackage?.description, textFrom(service?.description)),
      packageInclusions,
      packageName: textFrom(servicePackage?.name, textFrom(service?.name, 'Service request')),
      mealType: (['plated', 'buffet', 'packed'].includes(textFrom(bookingDetails?.meal_type))
        ? textFrom(bookingDetails?.meal_type)
        : undefined) as 'plated' | 'buffet' | 'packed' | undefined,
      outsideFood: bookingDetails?.outside_food === true,
      requestedTime: textFrom(record.requested_time, textFrom(event?.event_time)),
      serviceId,
      serviceCategory: textFrom(serviceCategory?.name),
      serviceName: textFrom(service?.name, 'Service request'),
      status: mapRequestStatus(textFrom(record.status)),
      submittedAt: textFrom(record.created_at),
      venue: textFrom(event?.venue),
    }
  })

  const grouped = new Map<string, MerchantBookingRequest>()

  individualRequests.forEach((request) => {
    const groupId = request.eventId || request.id
    const service = {
      amount: request.amount,
      attendeeCount: request.attendeeCount,
      budgetPerHead: request.budgetPerHead,
      clientNotes: request.clientNotes,
      dietaryNotes: request.dietaryNotes,
      id: request.id,
      instructions: request.instructions ?? [],
      packageDescription: request.packageDescription,
      packageInclusions: request.packageInclusions ?? [],
      packageName: request.packageName,
      mealType: request.mealType,
      outsideFood: request.outsideFood,
      requestedTime: request.requestedTime,
      serviceCategory: request.serviceCategory,
      serviceId: request.serviceId,
      serviceName: request.serviceName,
      status: request.status,
      submittedAt: request.submittedAt,
    }
    const existing = grouped.get(groupId)

    if (existing) {
      if (existing.services?.some((item) => item.id === service.id)) return
      existing.amount += request.amount
      existing.services = [...(existing.services ?? []), service]
      return
    }

    grouped.set(groupId, {
      ...request,
      id: groupId,
      services: [service],
    })
  })

  return Array.from(grouped.values()).map((request) => {
    const statuses = (request.services ?? []).map((service) => service.status)
    const status: MerchantBookingRequest['status'] = statuses.some((value) => value === 'new')
      ? 'new'
      : statuses.some((value) => value === 'confirmed')
        ? 'confirmed'
        : statuses.some((value) => value === 'completed')
          ? 'completed'
          : 'cancelled'

    return { ...request, status }
  })
}

export const fetchMerchantServices = async (): Promise<MerchantServiceListing[]> => {
  const context = await getMerchantContext()

  if (!context) return []

  const query = context.client
    .from('services')
    .select(
      'id, name, description, base_price, cover_image_url, status, is_available, updated_at, service_categories(name), service_packages(id)'
    )
    .eq('provider_id', context.providerId)
    .neq('status', 'deleted')
    .order('updated_at', { ascending: false })

  const { data, error } = await query

  if (error || !data) {
    if (error) {
      console.warn('Unable to fetch merchant services:', error.message)
    }

    const { data: fallbackData, error: fallbackError } = await context.client
      .from('services')
      .select('id, name, description, base_price, cover_image_url, status, is_available, updated_at')
      .eq('provider_id', context.providerId)
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false })

    if (fallbackError || !fallbackData) {
      if (fallbackError) {
        console.warn('Unable to fetch merchant services without joins:', fallbackError.message)
      }

      return []
    }

    return fallbackData.map((row) => mapMerchantServiceRow(row))
  }

  return data.map((row) => mapMerchantServiceRow(row))
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
    const nextStatus = isDecline || value.decision === 'declined' ? 'rejected' : 'confirmed'
    const { data: booking, error } = await context.client
      .from('bookings')
      .update({
        provider_notes: isDecline
          ? [value.reasonLabel, value.message].filter(Boolean).join(': ')
          : value.providerNote,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', value.request.id)
      .eq('provider_id', context.providerId)
      .select('client_id, services(name)')
      .single()

    if (error) {
      return { ok: false, message: error.message }
    }

    if (isDecline && value.blockRequestedDate) {
      await saveAvailabilityCalendar({
        entries: [{ date: value.request.eventDate, status: 'unavailable' }],
      })
    }

    if (booking?.client_id) {
      const service = nested(booking.services) as Record<string, unknown> | undefined
      const serviceName = textFrom(service?.name, value.request.packageName)

      await context.client.from('notifications').insert({
        body:
          nextStatus === 'confirmed'
            ? `${serviceName} accepted your booking request.`
            : `${serviceName} could not accept your booking request.`,
        resource_id: value.request.id,
        resource_type: 'booking',
        title: nextStatus === 'confirmed' ? 'Booking confirmed' : 'Booking declined',
        user_id: booking.client_id,
      })
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const completeMerchantBooking = async (bookingId: string): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.rpc('mark_provider_booking_completed', {
      target_booking_id: bookingId,
    })

    return { ok: !error, message: error?.message }
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
