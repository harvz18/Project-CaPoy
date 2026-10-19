export type VenuePricingType = 'event' | 'hour'

export interface VenueBookedOption {
  capacity?: number
  endAt?: string
  id: string
  name: string
  pricingSubtotal?: number
  pricingType?: VenuePricingType
  rentalConditions?: {
    accessEndTime?: string
    accessStartTime?: string
    overtimePolicy?: string
  }
  selectedDurationHours?: number
  setupStartAt?: string
  startAt?: string
  unitRate?: number
}

export interface VenueBookingConfiguration {
  clientFacingTotal?: number
  commissionAmount?: number
  commissionRate?: number
  eventDate?: string
  eventTime?: string
  options: VenueBookedOption[]
  platformFee?: number
  providerBaseTotal?: number
}

type JsonRecord = Record<string, unknown>

const recordFrom = (value: unknown): JsonRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
)

const numberFrom = (value: unknown): number | undefined => {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : undefined
}

const textFrom = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value.trim() : undefined
)

const pricingTypeFrom = (value: unknown): VenuePricingType | undefined => (
  value === 'event' || value === 'hour' ? value : undefined
)

const optionFrom = (value: unknown): VenueBookedOption | undefined => {
  const source = recordFrom(value)
  const id = textFrom(source.id)
  const name = textFrom(source.name)
  if (!id || !name) return undefined

  const conditions = recordFrom(source.rentalConditions)
  return {
    capacity: numberFrom(source.capacity),
    endAt: textFrom(source.endAt),
    id,
    name,
    pricingSubtotal: numberFrom(source.pricingSubtotal),
    pricingType: pricingTypeFrom(source.pricingType),
    rentalConditions: Object.keys(conditions).length
      ? {
          accessEndTime: textFrom(conditions.accessEndTime),
          accessStartTime: textFrom(conditions.accessStartTime),
          overtimePolicy: textFrom(conditions.overtimePolicy),
        }
      : undefined,
    selectedDurationHours: numberFrom(source.selectedDurationHours),
    setupStartAt: textFrom(source.setupStartAt),
    startAt: textFrom(source.startAt),
    unitRate: numberFrom(source.unitRate),
  }
}

// Only consume values stored with the booking. This deliberately never reads a
// provider's current listing, so a later rate edit cannot change its history.
export const venueBookingConfigurationFrom = (
  optionsValue: unknown,
  bookingValue: unknown,
  legacyOptionValue?: unknown
): VenueBookingConfiguration | undefined => {
  const booking = recordFrom(bookingValue)
  const primaryOptions = Array.isArray(optionsValue)
    ? optionsValue
    : Array.isArray(booking.selectedOptions) ? booking.selectedOptions : []
  const options = primaryOptions
    .map(optionFrom)
    .filter((option): option is VenueBookedOption => Boolean(option))
  const legacyOption = optionFrom(legacyOptionValue)
  const resolvedOptions = options.length ? options : legacyOption ? [legacyOption] : []

  if (!resolvedOptions.length) return undefined

  return {
    clientFacingTotal: numberFrom(booking.clientFacingTotal),
    commissionAmount: numberFrom(booking.commissionAmount),
    commissionRate: numberFrom(booking.commissionRate),
    eventDate: textFrom(booking.eventDate),
    eventTime: textFrom(booking.eventTime),
    options: resolvedOptions,
    platformFee: numberFrom(booking.platformFee),
    providerBaseTotal: numberFrom(booking.providerBaseTotal),
  }
}
