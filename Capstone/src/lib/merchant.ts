import { supabase, supabaseConfig } from './supabase'
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
    normalized.includes('pricing_details')
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
  status: 'draft' | 'active'
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
    const uploadedPhotos = await Promise.all(
      value.information.photos.map((photo) => uploadListingPhoto(photo))
    )
    const coverImageUrl = uploadedPhotos.find((photo): photo is string => Boolean(photo)) ?? null
    const now = new Date().toISOString()
    const serviceId = randomUuid()
    const servicePayload = {
      id: serviceId,
      base_price: amountFromListing(value),
      category_id: categoryId,
      cover_image_url: coverImageUrl,
      description: value.information.description,
      provider_id: context.providerId,
      name: value.information.serviceName,
      status,
      updated_at: now,
    }
    const detailedServicePayload = {
      ...servicePayload,
      gallery_urls: uploadedPhotos.filter((photo): photo is string => Boolean(photo)),
      pricing_details: value.pricing.details,
      pricing_model: value.pricing.model,
      pricing_unit: value.pricing.unit ?? null,
    }

    let serviceInsert = await context.client.from('services').insert(detailedServicePayload)

    if (serviceInsert.error && isMissingListingDetailsColumn(serviceInsert.error.message)) {
      serviceInsert = await context.client.from('services').insert(servicePayload)
    }

    const { error } = serviceInsert

    if (error) {
      console.warn('Unable to create merchant service:', error.message)
      return { ok: false, message: error.message }
    }

    if (value.packages.length > 0) {
      const packageRows = value.packages.map((item) => ({
          description: item.description,
          inclusions: item.inclusions,
          is_active: status === 'active',
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
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') return 'declined'
  return 'requested'
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
      'id, event_id, amount, status, requested_date, requested_time, created_at, updated_at, events(id, name, event_type, event_date, event_time, guest_count, venue, location, status), services(name, cover_image_url, service_categories(name)), provider_profiles(business_name), payments!inner(status, amount, paid_at, metadata)'
    )
    .eq('client_id', userId)
    .neq('status', 'payment_required')
    .in('payments.status', ['paid', 'verified'])
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const eventIds = Array.from(
    new Set(
      data
        .map((row) => textFrom((row as Record<string, unknown>).event_id))
        .filter(Boolean)
    )
  )
  const { data: feedbackRows } = eventIds.length
    ? await client
        .from('event_feedback')
        .select('event_id')
        .eq('client_id', userId)
        .in('event_id', eventIds)
    : { data: [] }
  const reviewedEventIds = new Set((feedbackRows ?? []).map((row) => textFrom(row.event_id)))
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
      providerName: textFrom(provider?.business_name, 'Service provider'),
      rawStatus,
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
    const metadata =
      latestPayment?.metadata && typeof latestPayment.metadata === 'object'
        ? (latestPayment.metadata as Record<string, unknown>)
        : {}
    const paymentType = metadata.paymentType === 'full' ? 'Paid in full' : 'Deposit paid'

    grouped.set(eventId, {
      amount: serviceItem.amount,
      category: textFrom(event?.event_type, 'Event'),
      createdAt: textFrom(record.created_at),
      date: toIsoDate(event?.event_date ?? record.requested_date),
      eventId,
      hasFeedback: reviewedEventIds.has(eventId),
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
      status:
        statuses.length > 0 && statuses.every((status) => status === 'completed')
          ? 'completed'
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
      'id, event_id, service_id, amount, status, requested_date, requested_time, client_notes, created_at, profiles(full_name, email), events(name, event_type, event_date, event_time, guest_count, venue, location), services(name, description), service_packages(name, description, inclusions), payments!inner(status)'
    )
    .eq('provider_id', context.providerId)
    .neq('status', 'payment_required')
    .in('payments.status', ['paid', 'verified'])
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const eventIds = Array.from(
    new Set(data.map((row) => row.event_id as string | null).filter(Boolean))
  ) as string[]
  const { data: instructionRows } = eventIds.length
    ? await context.client
        .from('event_provider_instructions')
        .select('id, event_id, provider_id, service_id, category_name, title, body, tags')
        .in('event_id', eventIds)
        .or(`provider_id.eq.${context.providerId},provider_id.is.null`)
        .eq('status', 'saved')
    : { data: [] }

  return data.map((row) => {
    const record = row as Record<string, unknown>
    const profile = nested(record.profiles) as Record<string, unknown> | undefined
    const event = nested(record.events) as Record<string, unknown> | undefined
    const service = nested(record.services) as Record<string, unknown> | undefined
    const servicePackage = nested(record.service_packages) as Record<string, unknown> | undefined
    const packageInclusions = Array.isArray(servicePackage?.inclusions)
      ? servicePackage.inclusions.filter((item): item is string => typeof item === 'string')
      : []
    const eventId = textFrom(record.event_id)
    const serviceId = textFrom(record.service_id)
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
      clientEmail: textFrom(profile?.email),
      clientNotes: textFrom(record.client_notes),
      clientName: textFrom(profile?.full_name, textFrom(profile?.email, 'Client')),
      currency: 'PHP',
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
      requestedTime: textFrom(record.requested_time, textFrom(event?.event_time)),
      serviceId,
      status: mapRequestStatus(textFrom(record.status)),
      submittedAt: textFrom(record.created_at),
      venue: textFrom(event?.venue),
    }
  })
}

export const fetchMerchantServices = async (): Promise<MerchantServiceListing[]> => {
  const context = await getMerchantContext()

  if (!context) return []

  const query = context.client
    .from('services')
    .select(
      'id, name, description, base_price, cover_image_url, status, updated_at, service_categories(name), service_packages(id)'
    )
    .eq('provider_id', context.providerId)
    .order('updated_at', { ascending: false })

  const { data, error } = await query

  if (error || !data) {
    if (error) {
      console.warn('Unable to fetch merchant services:', error.message)
    }

    const { data: fallbackData, error: fallbackError } = await context.client
      .from('services')
      .select('id, name, description, base_price, cover_image_url, status, updated_at')
      .eq('provider_id', context.providerId)
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
