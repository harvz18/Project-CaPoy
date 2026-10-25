import { supabase, supabaseConfig } from './supabase'
import type { CateringServiceType } from './catalog'
import {
  categoryDetailsForStorage,
  cateringCustomMenuStartingPrice,
  getCateringCustomMenu,
  getCateringPricingOptions,
  getCateringTastingSettings,
  isLegacyCategoryDetails,
  normalizeCategoryDetails,
  type ServiceCategoryDetails,
} from './service-category-details'
import { venueBookingConfigurationFrom } from './venue-booking'
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
  PayoutAccount,
  PayoutAccountInput,
  PayoutEarningsPeriod,
  PayoutEarningsSummary,
  PayoutTransaction,
  ProviderPaymentConfirmation,
  ProviderReceivable,
  ServicePackageValue,
  ServiceListingReviewValue,
  ServicePricingUnit,
} from '../screens'

type MerchantResult = {
  completionPayment?: {
    bookingCompleted: boolean
    confirmedExternalPaymentAmount?: number
    remainingServiceBalance?: number
  }
  ok: boolean
  message?: string
  foodTastingAttendanceConfirmed?: boolean
  foodTastingFallbackServiceId?: string
  foodTastingRescheduled?: boolean
  foodTastingScheduled?: boolean
  service?: MerchantServiceListing
}

export type CateringFoodTastingStatus =
  | 'requested'
  | 'confirmed'
  | 'reschedule_proposed'
  | 'rejected'
  | 'cancelled'
  | 'completed'

export interface CateringFoodTasting {
  bookingId: string
  clientNote?: string
  confirmedAt?: string
  endTime: string
  id: string
  location: string
  providerNote?: string
  respondedAt?: string
  scheduledDate: string
  startTime: string
  status: CateringFoodTastingStatus
  timezone: string
  updatedAt: string
}

export type CateringFoodTastingWorkflowStatus =
  | 'awaiting_provider_acceptance'
  | 'scheduling_required'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'final_menu_pending'
  | 'final_menu_submitted'
  | 'client_confirmation_required'
  | 'finalized'

export type CateringFoodTastingAttendanceStatus =
  | 'not_required'
  | 'confirmation_required'
  | 'confirmed'
  | 'no_response'

export interface CateringFoodTastingWorkflowCourse {
  finalSelectionLimit: number
  name: string
  tastingSelectionLimit: number
  selectedItemNames: string[]
}

export interface CateringFoodTastingWorkflow {
  attendanceConfirmedAt?: string
  attendanceReminderSentAt?: string
  attendanceStatus: CateringFoodTastingAttendanceStatus
  bookingId: string
  expiredAt?: string
  fallbackActivatedAt?: string
  fallbackEnabledAt?: string
  guestCount: number
  preliminaryMenu: CateringFoodTastingWorkflowCourse[]
  providerAcceptedAt?: string
  providerNoResponseNotifiedAt?: string
  rescheduleAttemptCount: number
  rescheduleExtensionEndDate?: string
  scheduledTastingId?: string
  schedulingWindowEndDate?: string
  schedulingWindowStartDate?: string
  status: CateringFoodTastingWorkflowStatus
  updatedAt: string
}

export interface CateringFoodTastingSlot {
  endTime: string
  location: string
  scheduledDate: string
  startTime: string
  timezone: string
}

export interface CateringFoodTastingSlotsResult {
  data?: CateringFoodTastingSlot[]
  message?: string
  ok: boolean
}

export type ProviderCompletionPaymentInput = {
  amount?: number
  bookingId: string
  note?: string
  requestKey?: string
  type: 'confirmPayment' | 'notYet'
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
  packages: MerchantPackageListing[]
  pricingUnit: ServicePricingUnit
  status: string
  updatedAt: string
}

export interface MerchantPackageListing {
  deletedAt: string
  description: string
  discountAmount: number
  discountType: 'none' | 'percentage' | 'fixed'
  discountValue: number
  id: string
  inclusions: string[]
  isActive: boolean
  isDeleted: boolean
  name: string
  price: number
  primaryServiceId: string
  pricingMode: 'composed' | 'legacy'
  pricingUnit: ServicePricingUnit
  serviceIds: string[]
  serviceNames: string[]
  subtotal: number
}

export interface MerchantPayoutDashboard {
  earningsTrend: Array<{ amount: number; label: string }>
  paymentConfirmations: ProviderPaymentConfirmation[]
  payoutAccount: PayoutAccount | null
  receivables: ProviderReceivable[]
  summary: PayoutEarningsSummary
  transactions: PayoutTransaction[]
}

export interface MerchantPayoutDashboardResult {
  data?: MerchantPayoutDashboard
  message?: string
  ok: boolean
}

export interface MerchantEarningsOverview {
  currency: string
  periodEarnings: number
  trend: Array<{ amount: number; label: string }>
}

export interface MerchantEarningsOverviewResult {
  data?: MerchantEarningsOverview
  message?: string
  ok: boolean
}

export const emptyMerchantPayoutDashboard = (): MerchantPayoutDashboard => ({
  earningsTrend: [],
  paymentConfirmations: [],
  payoutAccount: null,
  receivables: [],
  summary: {
    availableBalance: 0,
    currency: 'PHP',
    heldBalance: 0,
    lifetimeEarnings: 0,
    pendingBalance: 0,
    pendingPayouts: 0,
    periodEarnings: 0,
    remainingReceivable: 0,
    totalPaidOut: 0,
  },
  transactions: [],
})

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
  const customMenuStartingPrice = cateringCustomMenuStartingPrice(
    getCateringCustomMenu(value.information.categoryDetails)
  )
  if (customMenuStartingPrice) return customMenuStartingPrice
  const cateringOptions = getCateringPricingOptions(value.information.categoryDetails)
  if (cateringOptions.length > 0) {
    return Math.min(...cateringOptions.map((option) => option.pricePerHead))
  }
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
  const packageRows = Array.isArray(record.service_packages)
    ? record.service_packages as Array<Record<string, unknown>>
    : []
  const packages = packageRows.map((item) => {
    const packageItems = Array.isArray(item.service_package_items)
      ? (item.service_package_items as Array<Record<string, unknown>>)
          .sort((left, right) => numberFrom(left.position) - numberFrom(right.position))
      : []
    const packageUnit = textFrom(item.pricing_unit, 'event')
    const discountType = textFrom(item.discount_type, 'none')

    return {
      description: textFrom(item.description),
      deletedAt: textFrom(item.deleted_at),
      discountAmount: numberFrom(item.discount_amount),
      discountType: (['none', 'percentage', 'fixed'].includes(discountType)
        ? discountType
        : 'none') as MerchantPackageListing['discountType'],
      discountValue: numberFrom(item.discount_value),
      id: textFrom(item.id),
      inclusions: Array.isArray(item.inclusions)
        ? item.inclusions.filter((entry): entry is string => typeof entry === 'string')
        : [],
      isActive: item.is_active === true,
      isDeleted: item.is_deleted === true,
      name: textFrom(item.name, 'Untitled package'),
      price: numberFrom(item.price),
      primaryServiceId: textFrom(record.id),
      pricingMode: textFrom(item.pricing_mode) === 'composed' ? 'composed' : 'legacy',
      pricingUnit: (['event', 'person', 'hour', 'day'].includes(packageUnit)
        ? packageUnit
        : 'event') as ServicePricingUnit,
      serviceIds: packageItems
        .map((packageItem) => textFrom(packageItem.service_id))
        .filter(Boolean),
      serviceNames: packageItems.flatMap((packageItem) => {
        const includedService = nested(packageItem.services) as Record<string, unknown> | undefined
        const serviceName = textFrom(includedService?.name)
        return serviceName ? [serviceName] : []
      }),
      subtotal: numberFrom(item.subtotal, numberFrom(item.price)),
    } satisfies MerchantPackageListing
  }).filter((item) => item.id)

  return {
    basePrice: numberFrom(record.base_price),
    categoryName: textFrom(category?.name, fallbackCategoryName),
    coverImageUrl: textFrom(record.cover_image_url),
    description: textFrom(record.description),
    id: textFrom(record.id),
    isAvailable: record.is_available !== false,
    name: textFrom(record.name, 'Untitled service'),
    packageCount: packages.filter((item) => !item.isDeleted).length,
    packages,
    pricingUnit: (['event', 'person', 'hour', 'day'].includes(textFrom(record.pricing_unit))
      ? textFrom(record.pricing_unit)
      : 'event') as ServicePricingUnit,
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

const saveComposedPackageWithContext = async (
  context: NonNullable<Awaited<ReturnType<typeof getMerchantContext>>>,
  value: ServicePackageValue,
  serviceIds: string[]
): Promise<{ id?: string; message?: string; ok: boolean }> => {
  const targetPackageId = isUuid(value.id) ? value.id : null
  const { data, error } = await context.client.rpc('provider_save_composed_package', {
    package_description: value.description || null,
    package_discount_type: value.discountType ?? 'none',
    package_discount_value: value.discountValue ?? 0,
    package_inclusions: value.inclusions,
    package_name: value.name,
    target_package_id: targetPackageId,
    target_service_ids: serviceIds,
  })

  if (error) {
    const unavailable = error.message.toLowerCase().includes('provider_save_composed_package')
    return {
      ok: false,
      message: unavailable
        ? 'Composed packages are not installed yet. Apply database/47_composed_service_packages.sql, then try again.'
        : error.message,
    }
  }

  return { id: typeof data === 'string' ? data : undefined, ok: true }
}

export const saveMerchantComposedPackage = async (
  value: ServicePackageValue
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()
    if (!context) return { ok: false, message: notReady }

    const result = await saveComposedPackageWithContext(context, value, value.serviceIds ?? [])
    return {
      ok: result.ok,
      message: result.ok
        ? 'Package submitted for review.'
        : result.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to save this package.') }
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
      category_details: categoryDetailsForStorage(
        value.information.category,
        value.information.categoryDetails
      ),
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
      return {
        ok: false,
        message: error.message.toLowerCase().includes('category_details')
          ? 'Category-specific service details are not installed yet. Apply database/51_category_specific_service_details.sql, then try again.'
          : error.message,
      }
    }

    if (value.packages.length > 0) {
      for (const item of value.packages) {
        if (item.pricingMode !== 'composed') {
          // Preserve unpublished drafts created before composed packages were
          // introduced. Existing legacy rows remain untouched.
          if (isUuid(item.id)) continue
          let legacyInsert = await context.client.from('service_packages').insert({
            description: item.description,
            inclusions: item.inclusions,
            is_active: false,
            name: item.name,
            price: item.price,
            pricing_unit: item.unit,
            service_id: serviceId,
          })
          if (legacyInsert.error && isMissingListingDetailsColumn(legacyInsert.error.message)) {
            legacyInsert = await context.client.from('service_packages').insert({
              description: item.description,
              inclusions: item.inclusions,
              is_active: false,
              name: item.name,
              price: item.price,
              service_id: serviceId,
            })
          }
          if (legacyInsert.error) {
            return { ok: false, message: legacyInsert.error.message }
          }
          continue
        }

        const resolvedServiceIds = (item.serviceIds ?? []).map((id) =>
          id === '__current_service__' ? serviceId : id
        )
        const packageResult = await saveComposedPackageWithContext(
          context,
          item,
          Array.from(new Set(resolvedServiceIds))
        )

        if (!packageResult.ok) {
          return { ok: false, message: packageResult.message }
        }
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

const optionalNumber = (value: unknown) => {
  if (value == null || value === '') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

const nested = (value: unknown) => (Array.isArray(value) ? value[0] : value)

const toIsoDate = (value: unknown) => textFrom(value, 'Date to be confirmed')

type ExternalPaymentSummary = {
  completionPaymentStatus?: 'awaiting_external_payment' | 'partially_confirmed' | 'fully_confirmed'
  confirmedExternalPaymentAmount: number
}

const completionPaymentStatusFrom = (value: unknown): ExternalPaymentSummary['completionPaymentStatus'] =>
  value === 'awaiting_external_payment' || value === 'partially_confirmed' || value === 'fully_confirmed'
    ? value
    : undefined

const completionPaymentResultFrom = (value: unknown): NonNullable<MerchantResult['completionPayment']> => {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const toOptionalAmount = (amount: unknown) => {
    const parsed = typeof amount === 'number' ? amount : Number(amount)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    bookingCompleted: data.booking_completed === true,
    confirmedExternalPaymentAmount: toOptionalAmount(data.recorded_external_amount),
    remainingServiceBalance: toOptionalAmount(data.remaining_balance),
  }
}

const fetchExternalPaymentSummaries = async (
  client: NonNullable<typeof supabase>,
  bookingIds: string[]
) => {
  const summaries = new Map<string, ExternalPaymentSummary>()
  if (!bookingIds.length) return summaries

  const { data, error } = await client.rpc('get_my_booking_external_payment_summaries', {
    target_booking_ids: bookingIds,
  })
  // The core booking screens continue to work if the additive Phase 5
  // migration has not yet been applied to a local Supabase project.
  if (error || !Array.isArray(data)) return summaries

  data.forEach((row) => {
    const value = row as Record<string, unknown>
    const bookingId = textFrom(value.booking_id)
    if (!bookingId) return
    summaries.set(bookingId, {
      completionPaymentStatus: completionPaymentStatusFrom(value.completion_payment_status),
      confirmedExternalPaymentAmount: numberFrom(value.confirmed_external_amount),
    })
  })
  return summaries
}

const mapServiceBookingStatus = (status: string): BookingServiceItem['status'] => {
  if (status === 'completed') return 'completed'
  if (status === 'confirmed' || status === 'approved') return 'confirmed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'rejected' || status === 'expired') return 'declined'
  return 'requested'
}

const foodTastingStatusFrom = (value: unknown): CateringFoodTastingStatus => {
  switch (textFrom(value)) {
    case 'confirmed':
    case 'reschedule_proposed':
    case 'rejected':
    case 'cancelled':
    case 'completed':
      return textFrom(value) as CateringFoodTastingStatus
    default:
      return 'requested'
  }
}

const mapFoodTastingsByBooking = (rows: unknown): Map<string, CateringFoodTasting> => {
  const result = new Map<string, CateringFoodTasting>()
  if (!Array.isArray(rows)) return result

  rows.forEach((row) => {
    const record = row as Record<string, unknown>
    const bookingId = textFrom(record.booking_id)
    const id = textFrom(record.id)
    if (!bookingId || !id || result.has(bookingId)) return
    result.set(bookingId, {
      bookingId,
      clientNote: textFrom(record.client_note) || undefined,
      confirmedAt: textFrom(record.confirmed_at) || undefined,
      endTime: textFrom(record.end_time),
      id,
      location: textFrom(record.location),
      providerNote: textFrom(record.provider_note) || undefined,
      respondedAt: textFrom(record.responded_at) || undefined,
      scheduledDate: toIsoDate(record.scheduled_date),
      startTime: textFrom(record.start_time),
      status: foodTastingStatusFrom(record.status),
      timezone: textFrom(record.timezone, 'Asia/Manila'),
      updatedAt: textFrom(record.updated_at),
    })
  })

  return result
}

const foodTastingWorkflowStatusFrom = (value: unknown): CateringFoodTastingWorkflowStatus => {
  switch (textFrom(value)) {
    case 'scheduling_required':
    case 'scheduled':
    case 'completed':
    case 'cancelled':
    case 'final_menu_pending':
    case 'final_menu_submitted':
    case 'client_confirmation_required':
    case 'finalized':
      return textFrom(value) as CateringFoodTastingWorkflowStatus
    default:
      return 'awaiting_provider_acceptance'
  }
}

const foodTastingAttendanceStatusFrom = (value: unknown): CateringFoodTastingAttendanceStatus => {
  switch (textFrom(value)) {
    case 'confirmation_required':
    case 'confirmed':
    case 'no_response':
      return textFrom(value) as CateringFoodTastingAttendanceStatus
    default:
      return 'not_required'
  }
}

const mapFoodTastingWorkflowsByBooking = (rows: unknown): Map<string, CateringFoodTastingWorkflow> => {
  const result = new Map<string, CateringFoodTastingWorkflow>()
  if (!Array.isArray(rows)) return result

  rows.forEach((row) => {
    const record = row as Record<string, unknown>
    const bookingId = textFrom(record.booking_id)
    if (!bookingId || result.has(bookingId)) return
    const preliminaryMenu = record.preliminary_menu && typeof record.preliminary_menu === 'object'
      ? record.preliminary_menu as Record<string, unknown>
      : {}
    const courses = Array.isArray(preliminaryMenu.courses)
      ? preliminaryMenu.courses.flatMap((course) => {
        if (!course || typeof course !== 'object') return []
        const courseRecord = course as Record<string, unknown>
        const name = textFrom(courseRecord.courseName)
        if (!name) return []
        const selectedItemNames = Array.isArray(courseRecord.selectedItems)
          ? courseRecord.selectedItems.flatMap((item) => item && typeof item === 'object'
            ? [textFrom((item as Record<string, unknown>).name)].filter(Boolean)
            : [])
          : []
        return [{
          finalSelectionLimit: numberFrom(courseRecord.finalSelectionLimit),
          name,
          tastingSelectionLimit: numberFrom(courseRecord.tastingSelectionLimit),
          selectedItemNames,
        }]
      })
      : []
    result.set(bookingId, {
      attendanceConfirmedAt: textFrom(record.attendance_confirmed_at) || undefined,
      attendanceReminderSentAt: textFrom(record.attendance_reminder_sent_at) || undefined,
      attendanceStatus: foodTastingAttendanceStatusFrom(record.attendance_status),
      bookingId,
      expiredAt: textFrom(record.expired_at) || undefined,
      fallbackActivatedAt: textFrom(record.fallback_activated_at) || undefined,
      fallbackEnabledAt: textFrom(record.fallback_enabled_at) || undefined,
      guestCount: numberFrom(record.guest_count),
      preliminaryMenu: courses,
      providerAcceptedAt: textFrom(record.provider_accepted_at) || undefined,
      providerNoResponseNotifiedAt: textFrom(record.provider_no_response_notified_at) || undefined,
      rescheduleAttemptCount: numberFrom(record.reschedule_attempt_count),
      rescheduleExtensionEndDate: toIsoDate(record.reschedule_extension_end_date) || undefined,
      scheduledTastingId: textFrom(record.scheduled_tasting_id) || undefined,
      schedulingWindowEndDate: toIsoDate(record.scheduling_window_end_date) || undefined,
      schedulingWindowStartDate: toIsoDate(record.scheduling_window_start_date) || undefined,
      status: foodTastingWorkflowStatusFrom(record.workflow_status),
      updatedAt: textFrom(record.updated_at),
    })
  })

  return result
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
      message: 'The event was cancelled. Eligible initial-payment refunds are recorded automatically for external bank or e-wallet disbursement; cancellations at 14 days or sooner remain non-refundable.',
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to cancel this booking.') }
  }
}

export const respondToChurchWeddingProposal = async (
  eventId: string,
  approved: boolean,
  declineReason?: string
): Promise<MerchantResult> => {
  try {
    const client = getClient()
    const normalizedReason = declineReason?.trim() ?? ''
    if (!client || !isUuid(eventId)) {
      return { ok: false, message: 'This church proposal could not be identified.' }
    }
    if (!approved && !normalizedReason) {
      return { ok: false, message: 'Enter a reason for declining this church proposal.' }
    }

    const { error } = await client.rpc('respond_my_church_wedding_proposal', {
      approve_proposal: approved,
      decline_reason: approved ? null : normalizedReason,
      target_event_id: eventId,
    })

    if (error) return { ok: false, message: error.message }
    return {
      ok: true,
      message: approved
        ? 'Church proposal approved. This accepts the coordinator\'s arrangement and does not verify an external reservation.'
        : 'Church proposal declined. Your coordinator received your reason and can submit a revised proposal.',
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to update this church proposal.') }
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

export const loadCateringFoodTastingSlots = async (
  bookingId: string,
  useV15 = false
): Promise<CateringFoodTastingSlotsResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }

    const slotRequest = { target_booking_id: bookingId }
    const { data, error } = useV15
      ? await client.rpc('list_my_v15_catering_food_tasting_slots', slotRequest)
      : await client.rpc('list_my_catering_food_tasting_slots', slotRequest)
    if (error) return { ok: false, message: error.message }

    const slots = Array.isArray(data)
      ? data.flatMap((row) => {
          const record = row as Record<string, unknown>
          const scheduledDate = toIsoDate(record.scheduled_date)
          const startTime = textFrom(record.start_time)
          const endTime = textFrom(record.end_time)
          const location = textFrom(record.location)
          if (!scheduledDate || !startTime || !endTime || !location) return []
          return [{
            endTime,
            location,
            scheduledDate,
            startTime,
            timezone: textFrom(record.timezone, 'Asia/Manila'),
          } satisfies CateringFoodTastingSlot]
        })
      : []

    return { ok: true, data: slots }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to load food tasting availability.') }
  }
}

const foodTastingSlotsFrom = (data: unknown): CateringFoodTastingSlot[] => (
  Array.isArray(data)
    ? data.flatMap((row) => {
        const record = row as Record<string, unknown>
        const scheduledDate = toIsoDate(record.scheduled_date)
        const startTime = textFrom(record.start_time)
        const endTime = textFrom(record.end_time)
        const location = textFrom(record.location)
        if (!scheduledDate || !startTime || !endTime || !location) return []
        return [{
          endTime,
          location,
          scheduledDate,
          startTime,
          timezone: textFrom(record.timezone, 'Asia/Manila'),
        } satisfies CateringFoodTastingSlot]
      })
    : []
)

export const loadV15CateringFoodTastingRescheduleSlots = async (
  bookingId: string
): Promise<CateringFoodTastingSlotsResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }
    const { data, error } = await client.rpc('list_my_v15_catering_food_tasting_reschedule_slots', {
      target_booking_id: bookingId,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true, data: foodTastingSlotsFrom(data) }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to load food tasting reschedule availability.') }
  }
}

export const confirmV15FoodTastingAttendance = async (bookingId: string): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }
    const { data, error } = await client.rpc('confirm_my_v15_food_tasting_attendance', {
      target_booking_id: bookingId,
    })
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      foodTastingAttendanceConfirmed: !error && (result.confirmed === true || result.alreadyConfirmed === true),
      ok: !error,
      message: error?.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to confirm food tasting attendance.') }
  }
}

export const rescheduleV15FoodTasting = async (value: {
  bookingId: string
  note?: string
  scheduledDate: string
  startTime: string
}): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(value.bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }
    const { data, error } = await client.rpc('reschedule_my_v15_catering_food_tasting', {
      requested_date: value.scheduledDate,
      requested_note: value.note?.trim() || null,
      requested_start_time: value.startTime,
      target_booking_id: value.bookingId,
    })
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      foodTastingRescheduled: !error && result.status === 'confirmed',
      ok: !error,
      message: error?.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to reschedule the food tasting.') }
  }
}

export const activateV15FoodTastingDirectMenuFallback = async (
  bookingId: string
): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }
    const { data, error } = await client.rpc('activate_my_v15_food_tasting_direct_menu_fallback', {
      target_booking_id: bookingId,
    })
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      foodTastingFallbackServiceId: textFrom(result.serviceId),
      ok: !error,
      message: error?.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to open final menu selection.') }
  }
}

export const requestCateringFoodTasting = async (value: {
  bookingId: string
  note?: string
  scheduledDate: string
  startTime: string
  useV15?: boolean
}): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(value.bookingId)) {
      return { ok: false, message: 'This catering booking could not be identified.' }
    }

    const tastingRequest = {
      requested_date: value.scheduledDate,
      requested_note: value.note?.trim() || null,
      requested_start_time: value.startTime,
      target_booking_id: value.bookingId,
    }
    const { data, error } = value.useV15
      ? await client.rpc('schedule_my_v15_catering_food_tasting', tastingRequest)
      : await client.rpc('request_my_catering_food_tasting', tastingRequest)
    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      foodTastingScheduled: value.useV15 && result.status === 'confirmed',
      ok: !error,
      message: error?.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to request the food tasting.') }
  }
}

export const respondToCateringFoodTasting = async (value: {
  action: 'confirm' | 'reject' | 'propose'
  note?: string
  proposedDate?: string
  proposedStartTime?: string
  tastingId: string
}): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(value.tastingId)) {
      return { ok: false, message: 'This food tasting request could not be identified.' }
    }

    const { error } = await client.rpc('respond_to_catering_food_tasting', {
      proposed_date: value.proposedDate ?? null,
      proposed_start_time: value.proposedStartTime ?? null,
      response_action: value.action,
      response_note: value.note?.trim() || null,
      target_tasting_id: value.tastingId,
    })
    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to update the food tasting request.') }
  }
}

export const respondToCateringFoodTastingProposal = async (
  tastingId: string,
  acceptProposal: boolean
): Promise<MerchantResult> => {
  try {
    const client = getClient()
    if (!client || !isUuid(tastingId)) {
      return { ok: false, message: 'This food tasting proposal could not be identified.' }
    }

    const { error } = await client.rpc('respond_to_my_catering_food_tasting_proposal', {
      accept_proposal: acceptProposal,
      target_tasting_id: tastingId,
    })
    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to respond to the food tasting proposal.') }
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
      'id, name, description, base_price, cover_image_url, gallery_urls, pricing_model, pricing_unit, pricing_details, catering_service_types, category_details, category_id, service_categories(name), service_packages(id, name, description, price, inclusions, pricing_unit, pricing_mode, subtotal, discount_type, discount_value, discount_amount, service_package_items(service_id, position, services(id, name, base_price, pricing_unit)))'
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
      categoryDetails: isLegacyCategoryDetails(record.category_details)
        ? {} as ServiceCategoryDetails
        : normalizeCategoryDetails(
            textFrom(category?.name, 'Service'),
            record.category_details
          ),
      categoryId: textFrom(record.category_id),
      description: textFrom(record.description),
      photos: Array.from(new Set([coverImage, ...gallery].filter(Boolean))),
      serviceName: textFrom(record.name),
    },
    packages: packageRows.map((item) => {
      const packageItems = Array.isArray(item.service_package_items)
        ? (item.service_package_items as Array<Record<string, unknown>>)
            .sort((left, right) => numberFrom(left.position) - numberFrom(right.position))
        : []
      const services = packageItems.map((packageItem) => {
        const service = nested(packageItem.services) as Record<string, unknown> | undefined
        const itemUnit = textFrom(service?.pricing_unit, textFrom(item.pricing_unit, 'event'))
        return {
          id: textFrom(packageItem.service_id),
          name: textFrom(service?.name, 'Service'),
          price: numberFrom(service?.base_price),
          unit: (['event', 'person', 'hour', 'day'].includes(itemUnit)
            ? itemUnit
            : 'event') as ServicePricingUnit,
        }
      }).filter((service) => service.id)
      const itemUnit = textFrom(item.pricing_unit, 'event')

      return {
        currency: 'PHP' as const,
        description: textFrom(item.description),
        discountAmount: numberFrom(item.discount_amount),
        discountType: (['none', 'percentage', 'fixed'].includes(textFrom(item.discount_type))
          ? textFrom(item.discount_type)
          : 'none') as ServicePackageValue['discountType'],
        discountValue: numberFrom(item.discount_value),
        id: textFrom(item.id, randomUuid()),
        inclusions: Array.isArray(item.inclusions)
          ? item.inclusions.filter((entry): entry is string => typeof entry === 'string')
          : [],
        name: textFrom(item.name, 'Package'),
        price: numberFrom(item.price),
        pricingMode: textFrom(item.pricing_mode) === 'composed' ? 'composed' as const : 'legacy' as const,
        serviceIds: services.map((service) => service.id),
        services,
        subtotal: numberFrom(item.subtotal, numberFrom(item.price)),
        unit: (['event', 'person', 'hour', 'day'].includes(itemUnit)
          ? itemUnit
          : 'event') as ServicePricingUnit,
      }
    }),
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

    const normalizedMessage = error?.message.toLowerCase() ?? ''
    const oldHardDeleteFunction =
      normalizedMessage.includes('bookings_service_id_fkey') ||
      normalizedMessage.includes('foreign key constraint')

    return {
      ok: !error,
      message: oldHardDeleteFunction
        ? 'Safe service removal is not installed yet. Apply database/52_service_deletion_booking_history.sql, then try again. Your booking history was not deleted.'
        : error?.message,
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const deleteMerchantPackageListing = async (
  packageId: string
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()
    if (!context) return { ok: false, message: notReady }

    const { error } = await context.client.rpc('provider_delete_package', {
      target_package_id: packageId,
    })

    return {
      ok: !error,
      message: error?.message.toLowerCase().includes('provider_delete_package')
        ? 'Package removal is not installed yet. Apply database/49_deleted_provider_listings.sql, then try again.'
        : error?.message,
    }
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
      'id, event_id, provider_id, service_id, amount, provider_amount, status, requested_date, requested_time, client_notes, venue_option_snapshot, venue_options_snapshot, venue_booking_snapshot, created_at, updated_at, events(id, coordinator_id, pending_coordinator_id, coordinator_assignment_status, coordinator_fee_amount, wants_coordinator, name, event_type, is_church_wedding, event_date, event_time, guest_count, venue, location, status), services(name, cover_image_url, category_details, service_categories(name)), provider_profiles(business_name), payments(status, amount, service_subtotal, provider_initial_allocation, paid_at, created_at, metadata)'
    )
    .eq('client_id', userId)
    .neq('status', 'payment_required')
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const bookingIds = data
    .map((row) => textFrom((row as Record<string, unknown>).id))
    .filter(Boolean)
  const eventIds = Array.from(new Set(data.map((row) => textFrom(row.event_id)).filter(Boolean)))
  const coordinatorIds = Array.from(new Set(data.flatMap((row) => {
    const event = nested((row as unknown as Record<string, unknown>).events) as Record<string, unknown> | undefined
    return [
      textFrom(event?.coordinator_id),
      textFrom(event?.pending_coordinator_id),
    ].filter(Boolean)
  })))
  const [reviewResult, coordinatorResult, coordinatorReviewResult, externalPaymentSummaries, foodTastingResult, foodTastingWorkflowResult, replacementResult, churchArrangementResult] =
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
      fetchExternalPaymentSummaries(client, bookingIds),
      bookingIds.length
        ? client.rpc('list_my_catering_food_tastings', { target_booking_ids: bookingIds })
        : Promise.resolve({ data: [] }),
      bookingIds.length
        ? client.rpc('list_my_catering_food_tasting_workflows_v15', { target_booking_ids: bookingIds })
        : Promise.resolve({ data: [] }),
      bookingIds.length
        ? client
            .from('booking_replacements')
            .select('rejected_booking_id, status')
            .in('rejected_booking_id', bookingIds)
            .neq('status', 'closed')
        : Promise.resolve({ data: [] }),
      client.rpc('get_my_church_wedding_arrangements_v7'),
    ])
  const reviewRows = reviewResult.data
  const coordinatorProfiles = coordinatorResult.data
  const coordinatorReviewRows = coordinatorReviewResult.data
  const foodTastingsByBooking = mapFoodTastingsByBooking(foodTastingResult.data)
  const foodTastingWorkflowsByBooking = mapFoodTastingWorkflowsByBooking(foodTastingWorkflowResult.data)
  const replacementBookingIds = new Set(
    (replacementResult.data ?? []).map((row) => textFrom(row.rejected_booking_id)).filter(Boolean)
  )
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
  const churchArrangementsByEvent = new Map(
    (Array.isArray(churchArrangementResult.data) ? churchArrangementResult.data : []).map((entry) => {
      const arrangement = entry as Record<string, unknown>
      return [textFrom(arrangement.event_id), {
        activeProposalId: textFrom(arrangement.active_proposal_id) || undefined,
        arrangementStatus: textFrom(arrangement.arrangement_status, 'not_started'),
        ceremonyDate: textFrom(arrangement.ceremony_date) || undefined,
        ceremonyTime: textFrom(arrangement.ceremony_time) || undefined,
        churchAddress: textFrom(arrangement.church_address) || undefined,
        churchContact: textFrom(arrangement.church_contact) || undefined,
        churchLatitude: optionalNumber(arrangement.church_latitude),
        churchLongitude: optionalNumber(arrangement.church_longitude),
        churchName: textFrom(arrangement.church_name) || undefined,
        clientRespondedAt: textFrom(arrangement.client_responded_at) || undefined,
        clientResponseReason: textFrom(arrangement.client_response_reason) || undefined,
        clientResponseStatus: textFrom(arrangement.client_response_status, 'not_requested') as 'not_requested' | 'pending' | 'approved' | 'declined',
        confirmationMethod: (textFrom(arrangement.confirmation_method) || undefined) as 'external_discussion' | 'multivent' | 'other' | undefined,
        confirmationNotes: textFrom(arrangement.confirmation_notes) || undefined,
        coordinatorConfirmedAt: textFrom(arrangement.coordinator_confirmed_at) || undefined,
        coordinatorConfirmedBy: textFrom(arrangement.coordinator_confirmed_by) || undefined,
        notes: textFrom(arrangement.notes) || undefined,
        preferredChurch: textFrom(arrangement.preferred_church) || undefined,
        proposalVersion: numberFrom(arrangement.proposal_version),
        updatedAt: textFrom(arrangement.updated_at) || undefined,
      }] as const
    }).filter(([eventId]) => Boolean(eventId))
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
    const latestPayment = [...payments].sort(
      (first, second) => textFrom(first.created_at).localeCompare(textFrom(second.created_at))
    ).at(-1)
    const paymentStatusValue = textFrom(latestPayment?.status)
    const paymentStatusLabel = paymentStatusValue === 'verified'
      ? 'Payment verified'
      : paymentStatusValue === 'paid'
        ? 'Payment recorded'
        : paymentStatusValue === 'processing'
          ? 'Payment processing'
          : paymentStatusValue === 'pending'
            ? 'Payment initiated — awaiting verification'
            : paymentStatusValue === 'failed'
              ? 'Payment failed — try again'
              : paymentStatusValue === 'cancelled'
                ? 'Payment cancelled'
                : 'Awaiting provider confirmations'
    const paymentState = paymentStatusValue === 'verified' || paymentStatusValue === 'paid'
      ? 'paid_or_verified' as const
      : paymentStatusValue === 'processing' || paymentStatusValue === 'pending'
        ? 'payment_initiated' as const
        : paymentStatusValue === 'failed' || paymentStatusValue === 'cancelled'
          ? 'payment_failed_or_cancelled' as const
          : 'not_initiated' as const
    const hasRecordedPayment = paymentStatusValue === 'verified' || paymentStatusValue === 'paid'
    const serviceName = textFrom(service?.name, textFrom(provider?.business_name, 'Service'))
    const eventId = textFrom(record.event_id, textFrom(event?.id, textFrom(record.id)))
    const rawStatus = textFrom(record.status)
    const bookingId = textFrom(record.id)
    const serviceAmount = hasRecordedPayment
      ? numberFrom(
          latestPayment?.service_subtotal,
          numberFrom(record.provider_amount, numberFrom(record.amount))
        )
      : numberFrom(record.provider_amount, numberFrom(record.amount))
    const initialProviderShare = hasRecordedPayment
      ? numberFrom(latestPayment?.provider_initial_allocation)
      : 0
    const externalPayment = externalPaymentSummaries.get(bookingId)
    const confirmedExternalPaymentAmount = externalPayment?.confirmedExternalPaymentAmount ?? 0
    const remainingServiceBalance = Math.max(
      0,
      serviceAmount - initialProviderShare - confirmedExternalPaymentAmount
    )
    const completionPaymentStatus = externalPayment?.completionPaymentStatus
      ?? (remainingServiceBalance <= 0
        ? 'fully_confirmed'
        : confirmedExternalPaymentAmount > 0
          ? 'partially_confirmed'
          : 'awaiting_external_payment')
    const venueBooking = venueBookingConfigurationFrom(
      record.venue_options_snapshot,
      record.venue_booking_snapshot,
      record.venue_option_snapshot
    )
    const serviceItem: BookingServiceItem = {
      amount: numberFrom(record.amount),
      bookingId,
      category: textFrom(category?.name, 'Service'),
      clientNotes: textFrom(record.client_notes) || undefined,
      completionPaymentStatus,
      confirmedExternalPaymentAmount,
      foodTasting: foodTastingsByBooking.get(bookingId),
      foodTastingEnabled: Boolean(getCateringTastingSettings(service?.category_details)),
      foodTastingWorkflow: foodTastingWorkflowsByBooking.get(bookingId),
      image: textFrom(service?.cover_image_url),
      initialProviderShare,
      initialPaymentRecordedAt: hasRecordedPayment
        ? textFrom(latestPayment?.paid_at) || undefined
        : undefined,
      paymentStatus: paymentStatusLabel,
      providerId: textFrom(record.provider_id),
      providerName: textFrom(provider?.business_name, 'Service provider'),
      rawStatus,
      replacementAvailable: rawStatus === 'rejected' && replacementBookingIds.has(bookingId),
      remainingServiceBalance,
      serviceId: textFrom(record.service_id),
      serviceAmount,
      serviceName,
      status: mapServiceBookingStatus(rawStatus),
      updatedAt: textFrom(record.updated_at),
      venueBooking,
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
    const acceptedCoordinatorId = textFrom(event?.coordinator_id)
    const pendingCoordinatorId = textFrom(event?.pending_coordinator_id)
    const assignedCoordinatorId = acceptedCoordinatorId || pendingCoordinatorId
    const coordinator = coordinatorProfilesById.get(assignedCoordinatorId)
    grouped.set(eventId, {
      amount: serviceItem.amount,
      category: textFrom(event?.event_type, 'Event'),
      createdAt: textFrom(record.created_at),
      coordinatorAvatarUrl: textFrom(coordinator?.avatar_url) || undefined,
      coordinatorAssignmentStatus: textFrom(event?.coordinator_assignment_status) || undefined,
      coordinatorFeeAmount: numberFrom(event?.coordinator_fee_amount),
      coordinatorRequired: event?.wants_coordinator === true
        || Boolean(textFrom(event?.coordinator_id) || textFrom(event?.pending_coordinator_id)),
      coordinatorName: assignedCoordinatorId
        ? textFrom(coordinator?.full_name, 'Event Coordinator')
        : undefined,
      coordinatorUserId: acceptedCoordinatorId || undefined,
      date: toIsoDate(event?.event_date ?? record.requested_date),
      eventId,
      hasFeedback: false,
      eventType: textFrom(event?.event_type, 'Event'),
      guestCount: numberFrom(event?.guest_count),
      id: eventId,
      image: serviceItem.image,
      imageLabel: eventName,
      isChurchWedding: event?.is_church_wedding === true,
      churchArrangement: churchArrangementsByEvent.get(eventId),
      location: textFrom(event?.location),
      name: eventName,
      paymentState,
      paymentStatus: latestPayment
        ? paymentStatusLabel
        : 'Awaiting provider confirmations',
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
              && (!booking.coordinatorRequired || booking.coordinatorAssignmentStatus === 'accepted')
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
      'id, event_id, service_id, amount, provider_amount, status, requested_date, requested_time, client_notes, catering_option_name, catering_option_snapshot, venue_option_name, venue_option_snapshot, venue_options_snapshot, venue_booking_snapshot, venue_booked_hours, venue_setup_start_at, venue_start_at, venue_end_at, created_at, profiles(full_name, email), events(name, event_type, event_date, event_time, guest_count, venue, location), services(name, description, category_details, service_categories(name)), service_packages(name, description, inclusions), payments(status, amount, service_subtotal, platform_fee_amount, provider_initial_allocation, paid_at, verified_at, created_at, metadata)'
    )
    .eq('provider_id', context.providerId)
    .neq('status', 'payment_required')
    .order('updated_at', { ascending: false })

  if (error || !data) return []

  const eventIds = Array.from(
    new Set(data.map((row) => row.event_id as string | null).filter(Boolean))
  ) as string[]
  const bookingIds = data.map((row) => textFrom(row.id)).filter(Boolean)
  const [instructionResult, selectionResult, externalPaymentSummaries, foodTastingResult, foodTastingWorkflowResult] = eventIds.length
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
        fetchExternalPaymentSummaries(context.client, bookingIds),
        bookingIds.length
          ? context.client.rpc('list_my_catering_food_tastings', { target_booking_ids: bookingIds })
          : Promise.resolve({ data: [] }),
        bookingIds.length
          ? context.client.rpc('list_my_catering_food_tasting_workflows_v15', { target_booking_ids: bookingIds })
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, new Map<string, ExternalPaymentSummary>(), { data: [] }, { data: [] }]
  const instructionRows = instructionResult.data
  const selectionRows = selectionResult.data
  const foodTastingsByBooking = mapFoodTastingsByBooking(foodTastingResult.data)
  const foodTastingWorkflowsByBooking = mapFoodTastingWorkflowsByBooking(foodTastingWorkflowResult.data)

  const individualRequests = data.map((row) => {
    const record = row as Record<string, unknown>
    const profile = nested(record.profiles) as Record<string, unknown> | undefined
    const event = nested(record.events) as Record<string, unknown> | undefined
    const service = nested(record.services) as Record<string, unknown> | undefined
    const serviceCategory = nested(service?.service_categories) as Record<string, unknown> | undefined
    const servicePackage = nested(record.service_packages) as Record<string, unknown> | undefined
    const payment = nested(record.payments) as Record<string, unknown> | undefined
    const paymentMetadata = payment?.metadata && typeof payment.metadata === 'object'
      ? payment.metadata as Record<string, unknown>
      : {}
    const packageInclusions = Array.isArray(servicePackage?.inclusions)
      ? servicePackage.inclusions.filter((item): item is string => typeof item === 'string')
      : []
    const eventId = textFrom(record.event_id)
    const serviceId = textFrom(record.service_id)
    const serviceAmount = numberFrom(
      payment?.service_subtotal,
      numberFrom(record.provider_amount, numberFrom(record.amount))
    )
    const initialProviderShare = numberFrom(payment?.provider_initial_allocation)
    const externalPayment = externalPaymentSummaries.get(textFrom(record.id))
    const confirmedExternalPaymentAmount = externalPayment?.confirmedExternalPaymentAmount ?? 0
    const remainingServiceBalance = Math.max(
      0,
      serviceAmount - initialProviderShare - confirmedExternalPaymentAmount
    )
    const completionPaymentStatus = externalPayment?.completionPaymentStatus
      ?? (remainingServiceBalance <= 0
        ? 'fully_confirmed'
        : confirmedExternalPaymentAmount > 0
          ? 'partially_confirmed'
          : 'awaiting_external_payment')
    const venueBooking = venueBookingConfigurationFrom(
      record.venue_options_snapshot,
      record.venue_booking_snapshot,
      record.venue_option_snapshot
    )
    const bookingDetails = (selectionRows ?? []).find(
      (selection) => selection.event_id === eventId && selection.service_id === serviceId
    )
    const cateringSnapshot = record.catering_option_snapshot
      && typeof record.catering_option_snapshot === 'object'
      ? record.catering_option_snapshot as Record<string, unknown>
      : {}
    const cateringMenuItems = Array.isArray(cateringSnapshot.selectedItems)
      ? cateringSnapshot.selectedItems.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const menuItem = item as Record<string, unknown>
          const name = textFrom(menuItem.name)
          const price = numberFrom(menuItem.pricePerHead)
          return name ? [`${name}${price > 0 ? ` — PHP ${price.toLocaleString('en-PH')}/head` : ''}`] : []
        })
      : []
    const foodTastingWorkflow = foodTastingWorkflowsByBooking.get(textFrom(record.id))
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
      amount: serviceAmount,
      attendeeCount: bookingDetails?.attendee_count == null
        ? undefined
        : numberFrom(bookingDetails.attendee_count),
      budgetPerHead: bookingDetails?.budget_per_head == null
        ? undefined
        : numberFrom(bookingDetails.budget_per_head),
      cateringMenuItems: cateringMenuItems.length ? cateringMenuItems : undefined,
      cateringOptionName: textFrom(record.catering_option_name) || undefined,
      foodTasting: foodTastingsByBooking.get(textFrom(record.id)),
      foodTastingEnabled: Boolean(getCateringTastingSettings(service?.category_details)),
      foodTastingWorkflow,
      clientEmail: textFrom(profile?.email),
      clientNotes: textFrom(record.client_notes),
      dietaryNotes: textFrom(bookingDetails?.dietary_notes) || undefined,
      downpaymentAmount: numberFrom(payment?.amount),
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
      completionPaymentStatus,
      confirmedExternalPaymentAmount,
      paymentStatus: foodTastingWorkflow
        ? 'Final menu and price must be confirmed before payment.'
        : !payment
        ? 'No client payment yet — accept this request to help unlock payment.'
        : remainingServiceBalance <= 0
          ? 'Fully paid / ready to complete'
          : confirmedExternalPaymentAmount > 0
            ? 'Remaining payment partially confirmed'
            : metadataText(paymentMetadata, 'paymentType', 'full') === 'deposit'
              ? 'Awaiting remaining payment'
              : 'Full payment confirmed',
      platformFeePaid: numberFrom(payment?.platform_fee_amount),
      initialProviderShare,
      remainingServiceBalance,
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
      venueBookedHours: record.venue_booked_hours == null
        ? undefined
        : numberFrom(record.venue_booked_hours),
      venueEndAt: textFrom(record.venue_end_at) || undefined,
      venueOptionName: textFrom(record.venue_option_name) || undefined,
      venueBooking,
    }
  })

  const grouped = new Map<string, MerchantBookingRequest>()

  individualRequests.forEach((request) => {
    const groupId = request.eventId || request.id
    const service = {
      amount: request.amount,
      attendeeCount: request.attendeeCount,
      budgetPerHead: request.budgetPerHead,
      cateringMenuItems: request.cateringMenuItems,
      cateringOptionName: request.cateringOptionName,
      foodTasting: request.foodTasting,
      foodTastingEnabled: request.foodTastingEnabled,
      foodTastingWorkflow: request.foodTastingWorkflow,
      clientNotes: request.clientNotes,
      completionPaymentStatus: request.completionPaymentStatus,
      confirmedExternalPaymentAmount: request.confirmedExternalPaymentAmount,
      dietaryNotes: request.dietaryNotes,
      downpaymentAmount: request.downpaymentAmount,
      id: request.id,
      instructions: request.instructions ?? [],
      packageDescription: request.packageDescription,
      packageInclusions: request.packageInclusions ?? [],
      packageName: request.packageName,
      paymentStatus: request.paymentStatus,
      platformFeePaid: request.platformFeePaid,
      initialProviderShare: request.initialProviderShare,
      remainingServiceBalance: request.remainingServiceBalance,
      mealType: request.mealType,
      outsideFood: request.outsideFood,
      requestedTime: request.requestedTime,
      serviceCategory: request.serviceCategory,
      serviceId: request.serviceId,
      serviceName: request.serviceName,
      status: request.status,
      submittedAt: request.submittedAt,
      venueBookedHours: request.venueBookedHours,
      venueEndAt: request.venueEndAt,
      venueOptionName: request.venueOptionName,
      venueBooking: request.venueBooking,
    }
    const existing = grouped.get(groupId)

    if (existing) {
      if (existing.services?.some((item) => item.id === service.id)) return
      existing.amount += request.amount
      existing.downpaymentAmount = (existing.downpaymentAmount ?? 0) + (request.downpaymentAmount ?? 0)
      existing.platformFeePaid = (existing.platformFeePaid ?? 0) + (request.platformFeePaid ?? 0)
      existing.initialProviderShare = (existing.initialProviderShare ?? 0) + (request.initialProviderShare ?? 0)
      existing.remainingServiceBalance = (existing.remainingServiceBalance ?? 0) + (request.remainingServiceBalance ?? 0)
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
      'id, name, description, base_price, pricing_unit, cover_image_url, status, is_available, updated_at, service_categories(name), service_packages(id, name, description, price, inclusions, pricing_unit, pricing_mode, subtotal, discount_type, discount_value, discount_amount, is_active, is_deleted, deleted_at, service_package_items(service_id, position, services(name)))'
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
      .select('id, name, description, base_price, pricing_unit, cover_image_url, status, is_available, updated_at')
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
    const accepted = !isDecline && value.decision !== 'declined'
    const responseNote = isDecline
      ? [value.reasonLabel, value.message].filter(Boolean).join(': ')
      : value.providerNote
    const { error } = await context.client.rpc('respond_to_provider_booking', {
      accept_booking: accepted,
      response_note: responseNote || null,
      target_booking_id: value.request.id,
    })

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

export const saveMerchantCompletionPayment = async ({
  amount,
  bookingId,
  note,
  requestKey,
  type,
}: ProviderCompletionPaymentInput): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()
    if (!context || !isUuid(bookingId)) return { ok: false, message: notReady }

    if (type === 'notYet') {
      const { data, error } = await context.client.rpc('mark_provider_booking_awaiting_external_payment', {
        target_booking_id: bookingId,
      })
      return {
        completionPayment: completionPaymentResultFrom(data),
        ok: !error,
        message: error?.message ?? 'The booking remains open while the remaining payment is outstanding.',
      }
    }

    if (!amount || amount <= 0 || !requestKey?.trim()) {
      return { ok: false, message: 'Enter the external payment amount received before confirming.' }
    }

    const { data, error } = await context.client.rpc('confirm_provider_external_payment', {
      provider_note: note?.trim() || null,
      received_amount: amount,
      request_key: requestKey.trim(),
      target_booking_id: bookingId,
    })
    return {
      completionPayment: completionPaymentResultFrom(data),
      ok: !error,
      message: error?.message ?? 'External payment confirmation saved.',
    }
  } catch (error) {
    return { ok: false, message: toMessage(error) }
  }
}

export const fetchMerchantPayoutDashboard = async (
  period: PayoutEarningsPeriod = '30d'
): Promise<MerchantPayoutDashboardResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const [earningsResult, confirmationsResult, receivableWalletResult] = await Promise.all([
      context.client.rpc('get_my_provider_earnings', { target_period: period }),
      context.client.rpc('get_my_provider_payment_confirmations'),
      context.client.rpc('get_my_provider_receivable_wallet'),
    ])

    if (earningsResult.error || confirmationsResult.error) {
      return {
        ok: false,
        message: earningsResult.error?.message ?? confirmationsResult.error?.message,
      }
    }

    const payload = (earningsResult.data ?? {}) as Record<string, unknown>
    const confirmationsPayload = (confirmationsResult.data ?? {}) as Record<string, unknown>
    const confirmationSummary = (confirmationsPayload.summary ?? {}) as Record<string, unknown>
    const confirmationRows = Array.isArray(confirmationsPayload.items)
      ? confirmationsPayload.items
      : []
    if (receivableWalletResult.error) {
      console.warn('Unable to load provider receivable wallet:', receivableWalletResult.error.message)
    }
    const receivableWalletPayload = receivableWalletResult.error
      ? {}
      : (receivableWalletResult.data ?? {}) as Record<string, unknown>
    const receivableWalletSummary = (receivableWalletPayload.summary ?? {}) as Record<string, unknown>
    const receivableRows = Array.isArray(receivableWalletPayload.receivables)
      ? receivableWalletPayload.receivables
      : []
    const summaryRow = (payload.summary ?? {}) as Record<string, unknown>
    const accountRow = payload.payoutAccount as Record<string, unknown> | null | undefined
    const trendRows = Array.isArray(payload.earningsTrend) ? payload.earningsTrend : []
    const transactionRows = Array.isArray(payload.transactions) ? payload.transactions : []

    const payoutAccount = accountRow
      ? {
          accountName: textFrom(accountRow.accountName),
          accountNumberLast4: textFrom(accountRow.accountNumberLast4),
          accountType:
            accountRow.accountType === 'e_wallet' ? ('e_wallet' as const) : ('bank_transfer' as const),
          bankName: textFrom(accountRow.bankName),
          isVerified: accountRow.isVerified === true,
        }
      : null

    const transactions = transactionRows.map((row) => {
      const record = row as Record<string, unknown>
      const type = ['booking', 'payout', 'refund', 'adjustment'].includes(String(record.type))
        ? (String(record.type) as PayoutTransaction['type'])
        : 'adjustment'
      const status = ['completed', 'pending', 'failed'].includes(String(record.status))
        ? (String(record.status) as PayoutTransaction['status'])
        : 'pending'
      const breakdown = Array.isArray(record.breakdown)
        ? record.breakdown.map((item) => {
            const detail = item as Record<string, unknown>
            return { amount: numberFrom(detail.amount), label: textFrom(detail.label, 'Amount') }
          })
        : []
      const details = Array.isArray(record.details)
        ? record.details.map((item) => {
            const detail = item as Record<string, unknown>
            return { label: textFrom(detail.label, 'Detail'), value: textFrom(detail.value, 'Not available') }
          })
        : []

      return {
        amount: numberFrom(record.amount),
        breakdown,
        createdAt: textFrom(record.createdAt, new Date(0).toISOString()),
        currency: textFrom(record.currency, 'PHP'),
        details,
        id: textFrom(record.id),
        label: textFrom(record.label, 'Recorded transaction'),
        processedAt: textFrom(record.processedAt) || undefined,
        reference: textFrom(record.reference, 'Recorded transaction'),
        relatedRecordId: textFrom(record.relatedRecordId) || undefined,
        status,
        type,
      } satisfies PayoutTransaction
    })

    const paymentConfirmations = confirmationRows.map((row) => {
      const record = row as Record<string, unknown>
      return {
        amountEarned: numberFrom(record.amountEarned),
        amountHeld: numberFrom(record.amountHeld),
        amountPaidOut: numberFrom(record.amountPaidOut),
        amountWithdrawable: numberFrom(record.amountWithdrawable),
        balanceStatus: textFrom(record.balanceStatus, 'Not Yet Eligible'),
        bookingId: textFrom(record.bookingId),
        creditedAt: textFrom(record.creditedAt) || undefined,
        eventId: textFrom(record.eventId),
        eventName: textFrom(record.eventName, 'Event'),
        eventStatus: textFrom(record.eventStatus, 'planning'),
        fundsStatus: textFrom(record.fundsStatus, 'Payment Held'),
        initialProviderShare: numberFrom(record.initialProviderShare),
        paidAt: textFrom(record.paidAt) || undefined,
        paymentStatus: textFrom(record.paymentStatus, 'Awaiting Client Payment'),
        payoutStatus: textFrom(record.payoutStatus, 'Not Yet Eligible'),
        remainingServiceBalance: numberFrom(record.remainingServiceBalance),
        serviceAmount: numberFrom(record.serviceAmount),
        serviceName: textFrom(record.serviceName, 'Service'),
      } satisfies ProviderPaymentConfirmation
    })
    const receivables = receivableRows.flatMap((row) => {
      const record = row as Record<string, unknown>
      const id = textFrom(record.id)
      if (!id) return []

      return [{
        allocationAmount: numberFrom(record.allocationAmount),
        bookingReference: textFrom(record.bookingReference) || undefined,
        eventDate: textFrom(record.eventDate) || undefined,
        eventId: textFrom(record.eventId),
        eventName: textFrom(record.eventName, 'Event'),
        fundsStatus: textFrom(record.fundsStatus, 'Held by MULTIVENT'),
        id,
        isReconciliationRequired: record.isReconciliationRequired === true,
        payoutEligibleOn: textFrom(record.payoutEligibleOn) || undefined,
        serviceName: textFrom(record.serviceName, 'Service'),
      } satisfies ProviderReceivable]
    })

    return {
      ok: true,
      data: {
        earningsTrend: trendRows.map((row) => {
          const record = row as Record<string, unknown>
          return { amount: numberFrom(record.amount), label: textFrom(record.label) }
        }),
        paymentConfirmations,
        payoutAccount,
        receivables,
        summary: {
          availableBalance: receivableWalletResult.error
            ? numberFrom(summaryRow.availableBalance)
            : numberFrom(receivableWalletSummary.availableBalance),
          currency: receivableWalletResult.error
            ? textFrom(summaryRow.currency, 'PHP')
            : textFrom(receivableWalletSummary.currency, textFrom(summaryRow.currency, 'PHP')),
          heldBalance: receivableWalletResult.error
            ? numberFrom(confirmationSummary.heldBalance)
            : numberFrom(receivableWalletSummary.receivables),
          lifetimeEarnings: numberFrom(summaryRow.lifetimeEarnings),
          pendingBalance: numberFrom(summaryRow.pendingBalance),
          pendingPayouts: receivableWalletResult.error
            ? 0
            : numberFrom(receivableWalletSummary.pendingPayouts),
          periodEarnings: numberFrom(summaryRow.periodEarnings),
          remainingReceivable: numberFrom(confirmationSummary.remainingReceivable),
          totalPaidOut: receivableWalletResult.error
            ? 0
            : numberFrom(receivableWalletSummary.totalPaidOut),
        },
        transactions,
      },
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to load provider earnings.') }
  }
}

/**
 * Compact provider-home projection. It deliberately uses the protected earnings
 * RPC once, instead of loading the full payout wallet, confirmations, and
 * transaction history that the detailed Earnings screen needs.
 */
export const fetchMerchantEarningsOverview = async (): Promise<MerchantEarningsOverviewResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { data, error } = await context.client.rpc('get_my_provider_earnings', {
      target_period: '30d',
    })

    if (error) {
      return { ok: false, message: error.message }
    }

    const payload = (data ?? {}) as Record<string, unknown>
    const summary = (payload.summary ?? {}) as Record<string, unknown>
    const trendRows = Array.isArray(payload.earningsTrend) ? payload.earningsTrend : []

    return {
      ok: true,
      data: {
        currency: textFrom(summary.currency, 'PHP'),
        periodEarnings: numberFrom(summary.periodEarnings),
        trend: trendRows.map((row) => {
          const point = row as Record<string, unknown>
          return { amount: numberFrom(point.amount), label: textFrom(point.label) }
        }),
      },
    }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to load provider earnings.') }
  }
}

export const saveMerchantPayoutAccount = async (
  value: PayoutAccountInput
): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.rpc('save_my_provider_payout_account', {
      confirm_ownership: value.confirmOwnership,
      new_account_name: value.accountName,
      new_account_number: value.accountNumber,
      new_account_type: value.accountType,
      new_institution_name: value.institutionName,
    })

    return { ok: !error, message: error?.message }
  } catch (error) {
    return { ok: false, message: toMessage(error, 'Unable to save the payout account.') }
  }
}

export const requestMerchantPayout = async (amount: number): Promise<MerchantResult> => {
  try {
    const context = await getMerchantContext()

    if (!context) {
      return { ok: false, message: notReady }
    }

    const { error } = await context.client.rpc('request_my_provider_payout', {
      requested_amount: amount,
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
