import { photoVideoPackageDraftsFrom } from './photo-video'

export type ServiceCategoryKind =
  | 'attire'
  | 'florists'
  | 'catering'
  | 'venues'
  | 'event_organizer'
  | 'sound_lights'
  | 'photography'
  | 'host_emcee'

export type ServiceCategoryDetails = {
  kind: ServiceCategoryKind
  schemaVersion: 1
  [key: string]: unknown
}

export type CategoryDetailFact = { label: string; value: string }

export type CateringMenuSection = {
  id: string
  items: string[]
  name: string
}

export type CateringPricingOption = {
  id: string
  maximumGuests: number
  menuSections: CateringMenuSection[]
  minimumGuests: number
  name: string
  pricePerHead: number
}

// Item-priced menus are deliberately stored beside the established fixed-menu
// option format. That keeps published listings and historic selections
// readable while letting providers opt into a configurable menu.
export type CateringCustomMenuItem = {
  description?: string
  id: string
  isActive: boolean
  isDefault: boolean
  isRequired: boolean
  name: string
  pricePerHead: number
}

export type CateringCustomMenuSection = {
  // These are intentionally separate from direct-menu limits. A tasting can
  // sample more dishes than will be served at the event.
  finalSelectionLimit?: number
  id: string
  items: CateringCustomMenuItem[]
  maximumSelections?: number
  minimumSelections: number
  name: string
  tastingSelectionLimit?: number
}

export type CateringCustomMenu = {
  maximumGuests: number
  minimumGuests: number
  sections: CateringCustomMenuSection[]
}

export type CateringTastingMenuSection = CateringCustomMenuSection & {
  finalSelectionLimit: number
  tastingSelectionLimit: number
}

export type CateringTastingMenu = Omit<CateringCustomMenu, 'sections'> & {
  sections: CateringTastingMenuSection[]
}

// Food tastings are opt-in per catering listing. Slots are provider-entered
// local times; server-side availability remains the source of truth.
export type CateringTastingSettings = {
  durationMinutes: number
  enabled: boolean
  latestDaysBeforeEvent: number
  location?: string
  minimumLeadDays: number
  slots: string[]
}

export type CateringCustomMenuPriceCalculation = CateringPriceCalculation & {
  selectedItems: CateringCustomMenuItem[]
}

export type CateringPriceCalculation = {
  fitsGuestCount: boolean
  guestCount: number
  providerSubtotal: number
  reason?: string
  unitPrice: number
}

// Photo/Video coverage is stored with the existing category details so it is
// provider-owned, draft-friendly, and does not create a competing service or
// pricing system. Later booking phases will snapshot these exact records.
export type PhotoVideoCrewAllocation = {
  quantity: number
  role: string
}

export type PhotoVideoCoverageConfiguration = {
  durationHours: number
  id: string
  includedCrew: PhotoVideoCrewAllocation[]
  name: string
  price: number
}

export type PhotoVideoAdditionalCrewOption = {
  id: string
  maximumQuantity: number
  price: number
  pricingUnit: 'event' | 'hour'
  role: string
}

export type PhotoVideoDeliverablePricingMode = 'included' | 'fixed' | 'per_unit' | 'per_hour'

export type PhotoVideoDeliverableConfiguration = {
  deliveryFormat?: string
  id: string
  includedQuantity?: number
  maximumQuantity?: number
  mediaType: 'photo' | 'video' | 'both'
  name: string
  price: number
  pricingMode: PhotoVideoDeliverablePricingMode
  requiredCrewRoles: string[]
  turnaroundDays?: number
}

export type PhotoVideoAdditionalService = {
  id: string
  maximumQuantity?: number
  name: string
  price: number
  pricingUnit: 'event' | 'hour' | 'unit'
  requiredCrewRoles: string[]
}

export type PhotoVideoDeadlineStartingPoint = 'event_completion' | 'agreed_custom_start'

export type PhotoVideoDeliveryMethodKind =
  | 'secure_download_link'
  | 'online_gallery'
  | 'cloud_delivery'
  | 'usb'
  | 'physical_album_delivery'
  | 'courier_delivery'
  | 'client_pickup'

export type PhotoVideoDeliveryMethod = {
  details?: string
  id: string
  kind: PhotoVideoDeliveryMethodKind
}

export type PhotoVideoRushEditingOption = {
  additionalCharge: number
  capacityLimit?: number
  deliverableIds: string[]
  id: string
  isAvailable: boolean
  turnaroundDays: number
}

export type PhotoVideoRevisionPolicy = {
  additionalRevisionCharge?: number
  eligibleDeliverableIds: string[]
  includedRevisionRounds: number
  revisionRequestPeriodDays?: number
  revisionTurnaroundDays?: number
  scopeNote?: string
}

export type PhotoVideoPostProductionSettings = {
  deadlineStartingPoint: PhotoVideoDeadlineStartingPoint
  deliveryMethods: PhotoVideoDeliveryMethod[]
  revisionPolicy: PhotoVideoRevisionPolicy
  rushEditingOptions: PhotoVideoRushEditingOption[]
  startingPointDisclosure?: string
}

export type VenueBookingOption = {
  accessEndTime?: string
  accessStartTime?: string
  areaSqm: number
  allowsCombination: boolean
  availabilityNotes?: string
  baseRate?: number
  capacity: number
  cleanupAllowanceHours?: number
  description?: string
  includedDurationHours?: number
  inclusions: string[]
  id: string
  isBookableIndividually: boolean
  isActive: boolean
  kind: 'space' | 'combination'
  maximumBookingHours?: number
  minimumBookingHours?: number
  mutuallyExclusiveOptionIds: string[]
  name: string
  amenities: string[]
  overtimePolicy?: string
  photoUrls: string[]
  pricingUnit?: 'event' | 'hour'
  requiredOptionIds: string[]
  restrictions: string[]
  resourceIds: string[]
  setupAllowanceHours?: number
  spaceType: string
}

export type VenueOptionSelection = {
  bookedHours?: number
  optionId: string
}

export type VenueBookingRules = {
  closingTime: string
  durationIncrementHours: number
  maximumBookingHours?: number
  minimumBookingHours: number
  openingTime: string
  setupAllowanceHours: number
  setupAllowanceBillable: boolean
}

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const list = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  : []
const optionalPositiveNumber = (value: unknown) => {
  const parsed = number(value)
  return parsed > 0 ? parsed : undefined
}
const optionalNonNegativeNumber = (value: unknown) => {
  const parsed = number(value)
  return parsed >= 0 && (typeof value === 'number' || text(value)) ? parsed : undefined
}
const venuePricingUnit = (value: unknown): VenueBookingOption['pricingUnit'] =>
  value === 'event' || value === 'hour' ? value : undefined
const activeVenueOption = (value: Record<string, unknown>) => value.isActive !== false
const individuallyBookableVenueOption = (value: Record<string, unknown>) =>
  value.isBookableIndividually !== false
const combinableVenueSpace = (value: Record<string, unknown>) =>
  value.allowsCombination !== false

const photoVideoCrewAllocations = (value: unknown): PhotoVideoCrewAllocation[] => (
  Array.isArray(value) ? value.map(asObject).flatMap((item) => {
    const role = text(item.role)
    const quantity = number(item.quantity)
    return role && quantity > 0 ? [{ role, quantity }] : []
  }) : []
)

export const getPhotoVideoCoverageConfigurations = (
  value: unknown
): PhotoVideoCoverageConfiguration[] => {
  const details = asObject(value)
  const configurations = Array.isArray(details.coverageConfigurations)
    ? details.coverageConfigurations.map(asObject)
    : []
  return configurations.flatMap((configuration) => {
    const id = text(configuration.id)
    const name = text(configuration.name)
    const durationHours = number(configuration.durationHours)
    const price = number(configuration.price)
    return id && name && durationHours > 0 && price > 0
      ? [{ durationHours, id, includedCrew: photoVideoCrewAllocations(configuration.includedCrew), name, price }]
      : []
  })
}

export const getPhotoVideoAdditionalCrewOptions = (
  value: unknown
): PhotoVideoAdditionalCrewOption[] => {
  const details = asObject(value)
  const options = Array.isArray(details.additionalCrewOptions)
    ? details.additionalCrewOptions.map(asObject)
    : []
  return options.flatMap((option) => {
    const id = text(option.id)
    const role = text(option.role)
    const maximumQuantity = number(option.maximumQuantity)
    const price = number(option.price)
    const pricingUnit = option.pricingUnit === 'hour' ? 'hour' : 'event'
    return id && role && maximumQuantity > 0 && price > 0
      ? [{ id, maximumQuantity, price, pricingUnit, role }]
      : []
  })
}

const photoVideoRequiredCrewRoles = (value: unknown) => list(value)

export const getPhotoVideoDeliverableConfigurations = (
  value: unknown
): PhotoVideoDeliverableConfiguration[] => {
  const details = asObject(value)
  const configurations = Array.isArray(details.deliverableConfigurations)
    ? details.deliverableConfigurations.map(asObject)
    : []
  return configurations.flatMap((configuration) => {
    const id = text(configuration.id)
    const name = text(configuration.name)
    const mediaType = ['photo', 'video', 'both'].includes(text(configuration.mediaType))
      ? text(configuration.mediaType) as PhotoVideoDeliverableConfiguration['mediaType']
      : null
    const pricingMode = ['included', 'fixed', 'per_unit', 'per_hour'].includes(text(configuration.pricingMode))
      ? text(configuration.pricingMode) as PhotoVideoDeliverablePricingMode
      : null
    const price = number(configuration.price)
    const includedQuantity = optionalPositiveNumber(configuration.includedQuantity)
    const maximumQuantity = optionalPositiveNumber(configuration.maximumQuantity)
    return id && name && mediaType && pricingMode && (pricingMode === 'included' || price > 0)
      ? [{
          deliveryFormat: text(configuration.deliveryFormat) || undefined,
          id,
          includedQuantity,
          maximumQuantity,
          mediaType,
          name,
          price: pricingMode === 'included' ? 0 : price,
          pricingMode,
          requiredCrewRoles: photoVideoRequiredCrewRoles(configuration.requiredCrewRoles),
          turnaroundDays: optionalPositiveNumber(configuration.turnaroundDays),
        }]
      : []
  })
}

export const getPhotoVideoAdditionalServices = (value: unknown): PhotoVideoAdditionalService[] => {
  const details = asObject(value)
  const services = Array.isArray(details.additionalServices) ? details.additionalServices.map(asObject) : []
  return services.flatMap((service) => {
    const id = text(service.id)
    const name = text(service.name)
    const price = number(service.price)
    const pricingUnit = ['event', 'hour', 'unit'].includes(text(service.pricingUnit))
      ? text(service.pricingUnit) as PhotoVideoAdditionalService['pricingUnit']
      : null
    return id && name && pricingUnit && price > 0
      ? [{
          id,
          maximumQuantity: optionalPositiveNumber(service.maximumQuantity),
          name,
          price,
          pricingUnit,
          requiredCrewRoles: photoVideoRequiredCrewRoles(service.requiredCrewRoles),
        }]
      : []
  })
}

const photoVideoDeliveryMethodKinds: PhotoVideoDeliveryMethodKind[] = [
  'secure_download_link',
  'online_gallery',
  'cloud_delivery',
  'usb',
  'physical_album_delivery',
  'courier_delivery',
  'client_pickup',
]

export const getPhotoVideoPostProductionSettings = (
  value: unknown
): PhotoVideoPostProductionSettings | undefined => {
  const details = asObject(value)
  if (!Object.prototype.hasOwnProperty.call(details, 'postProductionSettings')) return undefined
  const settings = asObject(details.postProductionSettings)
  const deadlineStartingPoint = settings.deadlineStartingPoint === 'agreed_custom_start'
    ? 'agreed_custom_start' as const
    : 'event_completion' as const
  const deliveryMethods = Array.isArray(settings.deliveryMethods) ? settings.deliveryMethods.map(asObject).flatMap((method) => {
    const id = text(method.id)
    const kind = text(method.kind) as PhotoVideoDeliveryMethodKind
    return id && photoVideoDeliveryMethodKinds.includes(kind)
      ? [{ details: text(method.details) || undefined, id, kind }]
      : []
  }) : []
  const rushEditingOptions = Array.isArray(settings.rushEditingOptions)
    ? settings.rushEditingOptions.map(asObject).flatMap((option) => {
      const id = text(option.id)
      const turnaroundDays = optionalPositiveNumber(option.turnaroundDays)
      const additionalCharge = optionalPositiveNumber(option.additionalCharge)
      return id && turnaroundDays && additionalCharge
        ? [{
            additionalCharge,
            capacityLimit: optionalPositiveNumber(option.capacityLimit),
            deliverableIds: list(option.deliverableIds),
            id,
            isAvailable: option.isAvailable !== false,
            turnaroundDays,
          }]
        : []
    }) : []
  const rawPolicy = asObject(settings.revisionPolicy)
  const includedRevisionRounds = Math.max(0, Math.floor(number(rawPolicy.includedRevisionRounds)))
  return {
    deadlineStartingPoint,
    deliveryMethods,
    revisionPolicy: {
      additionalRevisionCharge: optionalNonNegativeNumber(rawPolicy.additionalRevisionCharge),
      eligibleDeliverableIds: list(rawPolicy.eligibleDeliverableIds),
      includedRevisionRounds,
      revisionRequestPeriodDays: optionalPositiveNumber(rawPolicy.revisionRequestPeriodDays),
      revisionTurnaroundDays: optionalPositiveNumber(rawPolicy.revisionTurnaroundDays),
      scopeNote: text(rawPolicy.scopeNote) || undefined,
    },
    rushEditingOptions,
    startingPointDisclosure: text(settings.startingPointDisclosure) || undefined,
  }
}

// A calendar deadline is intentionally only produced when the agreed start is
// known. Custom starts are disclosed and retained, then resolved once both
// parties agree on that date in the booking workflow.
export const calculatePhotoVideoExpectedDeadline = (
  eventCompletionDate: string | undefined,
  turnaroundDays: number | undefined,
  settings: Pick<PhotoVideoPostProductionSettings, 'deadlineStartingPoint'>,
  agreedCustomStartDate?: string
) => {
  const startingDate = settings.deadlineStartingPoint === 'event_completion'
    ? eventCompletionDate
    : agreedCustomStartDate
  const days = Math.floor(Number(turnaroundDays))
  if (!startingDate || !Number.isFinite(days) || days <= 0) return undefined
  const parsed = new Date(`${startingDate}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}
const venueOptionDetails = (value: Record<string, unknown>) => ({
  accessEndTime: text(value.accessEndTime) || undefined,
  accessStartTime: text(value.accessStartTime) || undefined,
  availabilityNotes: text(value.availabilityNotes) || undefined,
  // This explicit provider control is used for client multi-selection. Older
  // venue listings have no such flag and therefore retain their one-option
  // selection behavior, while their preconfigured combinations stay usable.
  allowsCombination: value.allowsCombination === true,
  baseRate: optionalPositiveNumber(value.baseRate),
  cleanupAllowanceHours: optionalNonNegativeNumber(value.cleanupAllowanceHours),
  description: text(value.description) || undefined,
  includedDurationHours: optionalNonNegativeNumber(value.includedDurationHours),
  inclusions: list(value.inclusions),
  isBookableIndividually: individuallyBookableVenueOption(value),
  isActive: activeVenueOption(value),
  maximumBookingHours: optionalPositiveNumber(value.maximumBookingHours),
  minimumBookingHours: optionalPositiveNumber(value.minimumBookingHours),
  mutuallyExclusiveOptionIds: list(value.mutuallyExclusiveOptionIds),
  amenities: list(value.amenities),
  overtimePolicy: text(value.overtimePolicy) || undefined,
  photoUrls: list(value.photoUrls),
  pricingUnit: venuePricingUnit(value.pricingUnit),
  requiredOptionIds: list(value.requiredOptionIds),
  restrictions: list(value.restrictions),
  setupAllowanceHours: optionalNonNegativeNumber(value.setupAllowanceHours),
})

export const getVenueBookingOptions = (value: unknown): VenueBookingOption[] => {
  const details = asObject(value)
  const spaces = Array.isArray(details.spaces) ? details.spaces.map(asObject) : []
  // Keep all active resources available for combination validation, while only
  // exposing individually-bookable spaces as client-facing options. Listings
  // created before per-option venue controls remain active and bookable.
  const activeSpaces = spaces.filter((space) =>
    text(space.id) && text(space.name) && activeVenueOption(space)
  )
  const byId = new Map(activeSpaces.map((space) => [text(space.id), space]))
  const options: VenueBookingOption[] = activeSpaces
    .filter(individuallyBookableVenueOption)
    .map((space) => ({
    areaSqm: number(space.areaSqm),
    capacity: number(space.capacity),
    id: text(space.id),
    kind: 'space',
    name: text(space.name),
    resourceIds: [text(space.id)],
    spaceType: text(space.spaceType) || 'Indoor',
    ...venueOptionDetails(space),
  }))

  const combinations = Array.isArray(details.combinations)
    ? details.combinations.map(asObject)
    : []
  combinations.forEach((combination) => {
    const resourceIds = list(combination.spaceIds).filter((id) => byId.has(id))
    if (!text(combination.id) || !text(combination.name)
      || !activeVenueOption(combination)
      || !individuallyBookableVenueOption(combination)
      || resourceIds.length < 2
      || resourceIds.some((id) => !combinableVenueSpace(byId.get(id) ?? {}))) return
    const includedSpaces = resourceIds.map((id) => byId.get(id) ?? {})
    options.push({
      areaSqm: number(combination.combinedAreaSqm) || includedSpaces.reduce(
        (sum, space) => sum + number(space.areaSqm), 0
      ),
      capacity: number(combination.combinedCapacity) || number(combination.capacity),
      id: text(combination.id),
      kind: 'combination',
      name: text(combination.name),
      resourceIds,
      spaceType: Array.from(new Set(includedSpaces.map((space) => text(space.spaceType))))
        .filter(Boolean)
        .join(' + ') || 'Mixed',
      ...venueOptionDetails(combination),
    })
  })

  return options
}

export const getVenueBookingRules = (value: unknown): VenueBookingRules => {
  const details = asObject(value)
  const setupValue = Math.max(0, number(details.setupAllowance))
  const maximum = number(details.maximumBookingHours)
  const durationIncrement = number(details.bookingDurationIncrementHours)

  return {
    closingTime: text(details.closingTime),
    durationIncrementHours: durationIncrement > 0 ? Math.max(durationIncrement, 0.25) : 1,
    maximumBookingHours: maximum > 0 ? maximum : undefined,
    minimumBookingHours: Math.max(number(details.minimumBookingHours), 1),
    openingTime: text(details.openingTime),
    setupAllowanceBillable: details.setupAllowanceBillable === true,
    setupAllowanceHours: details.setupAllowanceUnit === 'days' ? setupValue * 24 : setupValue,
  }
}

export const getCateringPricingOptions = (
  value: unknown,
  legacyPricePerHead = 0
): CateringPricingOption[] => {
  const details = asObject(value)
  const optionRows = Array.isArray(details.pricingOptions)
    ? details.pricingOptions.map(asObject)
    : []
  const parsed = optionRows.flatMap((option, index) => {
    const id = text(option.id)
    const name = text(option.name)
    const pricePerHead = number(option.pricePerHead)
    const minimumGuests = number(option.minimumGuests)
    const maximumGuests = number(option.maximumGuests)
    const menuSections = Array.isArray(option.menuSections)
      ? option.menuSections.map(asObject).map((section, sectionIndex) => ({
          id: text(section.id) || `section-${index + 1}-${sectionIndex + 1}`,
          items: list(section.items),
          name: text(section.name),
        }))
      : []

    if (!id || !name || pricePerHead <= 0 || minimumGuests <= 0 || maximumGuests < minimumGuests) {
      return []
    }
    return [{ id, maximumGuests, menuSections, minimumGuests, name, pricePerHead }]
  })

  if (parsed.length > 0) return parsed

  // Legacy listings stored one shared per-person price and menu. Convert only
  // that unambiguous shape; old package-priced listings remain untouched.
  if (details.kind !== 'catering' || details.pricingBasis !== 'per_person' || legacyPricePerHead <= 0) {
    return []
  }

  const minimumGuests = number(details.minimumGuests)
  const maximumGuests = number(details.maximumGuests)
  if (minimumGuests <= 0 || maximumGuests < minimumGuests) return []

  const menuSections = Array.isArray(details.menuSections)
    ? details.menuSections.map(asObject).map((section, index) => ({
        id: text(section.id) || `legacy-section-${index + 1}`,
        items: list(section.items),
        name: text(section.name),
      }))
    : []

  return [{
    id: 'legacy-default',
    maximumGuests,
    menuSections,
    minimumGuests,
    name: text(details.optionName) || 'Catering menu',
    pricePerHead: legacyPricePerHead,
  }]
}

export const getCateringCustomMenu = (value: unknown): CateringCustomMenu | undefined => {
  const details = asObject(value)
  const rows = Array.isArray(details.customMenuSections)
    ? details.customMenuSections.map(asObject)
    : []
  const sections = rows.map((section, sectionIndex) => ({
    id: text(section.id) || `custom-section-${sectionIndex + 1}`,
    items: (Array.isArray(section.items) ? section.items : []).map(asObject).flatMap((item) => {
      const id = text(item.id)
      const name = text(item.name)
      const pricePerHead = number(item.pricePerHead)
      if (!id || !name || pricePerHead <= 0) return []
      return [{
        description: text(item.description) || undefined,
        id,
        isActive: item.isActive !== false,
        isDefault: item.isDefault === true,
        isRequired: item.isRequired === true,
        name,
        pricePerHead,
      }]
    }),
    maximumSelections: number(section.maximumSelections) > 0
      ? Math.floor(number(section.maximumSelections))
      : undefined,
    finalSelectionLimit: number(section.finalSelectionLimit) > 0
      ? Math.floor(number(section.finalSelectionLimit))
      : undefined,
    minimumSelections: Math.max(0, Math.floor(number(section.minimumSelections))),
    name: text(section.name),
    tastingSelectionLimit: number(section.tastingSelectionLimit) > 0
      ? Math.floor(number(section.tastingSelectionLimit))
      : undefined,
  })).filter((section) => section.name && section.items.length > 0)

  if (sections.length === 0) return undefined
  const minimumGuests = Math.max(1, Math.floor(number(details.minimumGuests)))
  const maximumGuests = Math.floor(number(details.maximumGuests))
  return {
    maximumGuests: Math.max(maximumGuests, minimumGuests),
    minimumGuests,
    sections,
  }
}

// A tasting menu is available only when every course has explicit rules. This
// deliberately avoids treating a direct-menu price as the final event price.
export const getCateringTastingMenu = (value: unknown): CateringTastingMenu | undefined => {
  const menu = getCateringCustomMenu(value)
  if (!menu) return undefined

  const sections = menu.sections.flatMap((section) => {
    const tastingSelectionLimit = section.tastingSelectionLimit
    const finalSelectionLimit = section.finalSelectionLimit
    const activeItemCount = section.items.filter((item) => item.isActive).length
    if (!tastingSelectionLimit || !finalSelectionLimit
      || finalSelectionLimit > tastingSelectionLimit
      || tastingSelectionLimit > activeItemCount) return []
    return [{ ...section, finalSelectionLimit, tastingSelectionLimit }]
  })

  return sections.length === menu.sections.length
    ? { ...menu, sections }
    : undefined
}

export const getCateringTastingSettings = (
  value: unknown
): CateringTastingSettings | undefined => {
  const details = asObject(value)
  const settings = asObject(details.tastingSettings)
  if (settings.enabled !== true) return undefined

  const slots = list(settings.tastingTimeSlots)
    .map((slot) => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot) ? slot : '')
    .filter(Boolean)

  if (slots.length === 0) return undefined

  return {
    durationMinutes: Math.min(480, Math.max(15, Math.floor(number(settings.durationMinutes) || 60))),
    enabled: true,
    latestDaysBeforeEvent: Math.max(0, Math.floor(number(settings.latestDaysBeforeEvent))),
    location: text(settings.location) || undefined,
    minimumLeadDays: Math.max(0, Math.floor(number(settings.minimumLeadDays))),
    slots: Array.from(new Set(slots)).sort(),
  }
}

export const defaultCateringCustomMenuItemIds = (menu?: CateringCustomMenu) =>
  menu?.sections.flatMap((section) => section.items
    .filter((item) => item.isDefault || item.isRequired)
    .map((item) => item.id)) ?? []

export const cateringCustomMenuStartingPrice = (menu?: CateringCustomMenu) => {
  if (!menu) return undefined
  const selected = new Set(defaultCateringCustomMenuItemIds(menu))
  for (const section of menu.sections) {
    const selectedInSection = section.items.filter((item) => selected.has(item.id))
    const needed = Math.max(0, section.minimumSelections - selectedInSection.length)
    section.items
      .filter((item) => item.isActive && !selected.has(item.id))
      .sort((left, right) => left.pricePerHead - right.pricePerHead)
      .slice(0, needed)
      .forEach((item) => selected.add(item.id))
  }
  const items = menu.sections.flatMap((section) => section.items)
  const price = Array.from(selected).reduce((total, id) => total + (items.find((item) => item.id === id)?.pricePerHead ?? 0), 0)
  return price > 0 ? Math.round(price * 100) / 100 : undefined
}

export const calculateCateringCustomMenuPrice = (
  menu: CateringCustomMenu,
  selectedItemIds: string[],
  guestCount: number
): CateringCustomMenuPriceCalculation => {
  const guests = Math.max(0, Math.floor(Number(guestCount) || 0))
  const selectedIds = selectedItemIds.filter(Boolean)
  const uniqueIds = new Set(selectedIds)
  const itemsById = new Map(menu.sections.flatMap((section) => section.items.map((item) => [item.id, item])))
  const selectedItems = Array.from(uniqueIds).flatMap((id) => {
    const item = itemsById.get(id)
    return item && item.isActive ? [item] : []
  })
  let reason: string | undefined

  if (guests <= 0) reason = 'Set the event guest count before choosing catering.'
  else if (guests < menu.minimumGuests) reason = `Requires at least ${menu.minimumGuests} guests.`
  else if (guests > menu.maximumGuests) reason = `Supports up to ${menu.maximumGuests} guests.`
  else if (uniqueIds.size !== selectedIds.length || selectedItems.length !== uniqueIds.size) {
    reason = 'One or more selected food items are no longer available.'
  } else if (selectedItems.length === 0) {
    reason = 'Select at least one food item.'
  } else {
    for (const section of menu.sections) {
      const selectedInSection = selectedItems.filter((item) => section.items.some((candidate) => candidate.id === item.id))
      const requiredMissing = section.items.some((item) => item.isRequired && !uniqueIds.has(item.id))
      if (requiredMissing) {
        reason = `${section.name} includes a required item.`
        break
      }
      if (selectedInSection.length < section.minimumSelections) {
        reason = `Choose at least ${section.minimumSelections} item${section.minimumSelections === 1 ? '' : 's'} from ${section.name}.`
        break
      }
      if (section.maximumSelections && selectedInSection.length > section.maximumSelections) {
        reason = `Choose up to ${section.maximumSelections} item${section.maximumSelections === 1 ? '' : 's'} from ${section.name}.`
        break
      }
    }
  }

  const unitPrice = Math.round(selectedItems.reduce((sum, item) => sum + item.pricePerHead, 0) * 100) / 100
  return {
    fitsGuestCount: !reason,
    guestCount: guests,
    providerSubtotal: Math.round(unitPrice * guests * 100) / 100,
    reason,
    selectedItems,
    unitPrice,
  }
}

export const calculateCateringPrice = (
  option: CateringPricingOption,
  guestCount: number
): CateringPriceCalculation => {
  const guests = Math.max(0, Math.floor(Number(guestCount) || 0))
  const providerSubtotal = Math.round(option.pricePerHead * guests * 100) / 100
  let reason: string | undefined
  if (guests <= 0) reason = 'Set the event guest count before choosing catering.'
  else if (guests < option.minimumGuests) reason = `Requires at least ${option.minimumGuests} guests.`
  else if (guests > option.maximumGuests) reason = `Supports up to ${option.maximumGuests} guests.`

  return {
    fitsGuestCount: !reason,
    guestCount: guests,
    providerSubtotal,
    reason,
    unitPrice: option.pricePerHead,
  }
}

export const serviceCategoryKind = (categoryName: string): ServiceCategoryKind => {
  const name = categoryName.trim().toLowerCase()
  if (name.includes('attire') || name.includes('gown')) return 'attire'
  if (name.includes('flor')) return 'florists'
  if (name.includes('venue') || name.includes('estate')) return 'venues'
  if (name.includes('organizer') || name.includes('coordinator')) return 'event_organizer'
  if (name.includes('sound') || name.includes('light')) return 'sound_lights'
  if (name.includes('photo')) return 'photography'
  if (name.includes('host') || name.includes('emcee')) return 'host_emcee'
  return 'catering'
}

export const emptyCategoryDetails = (categoryName: string): ServiceCategoryDetails => ({
  kind: serviceCategoryKind(categoryName),
  schemaVersion: 1,
  ...(serviceCategoryKind(categoryName) === 'catering'
    ? { pricingBasis: 'per_person', pricingOptions: [] }
    : serviceCategoryKind(categoryName) === 'photography'
      ? {
          additionalCrewOptions: [],
          additionalServices: [],
          coverageConfigurations: [],
          deliverableConfigurations: [],
          overtimeRequiresAuthorization: true,
          photoVideoServiceType: '',
          photoVideoPackages: [],
          teamCapacity: 1,
        }
      : {}),
})

export const normalizeCategoryDetails = (
  categoryName: string,
  value: unknown
): ServiceCategoryDetails => {
  const expectedKind = serviceCategoryKind(categoryName)
  const source = asObject(value)
  if (source.kind && source.kind !== expectedKind) return emptyCategoryDetails(categoryName)
  return { ...emptyCategoryDetails(categoryName), ...source, kind: expectedKind, schemaVersion: 1 }
}

export const hasEnteredCategoryDetails = (value: unknown) => {
  const source = asObject(value)
  return Object.entries(source).some(([key, item]) => {
    if (key === 'kind' || key === 'schemaVersion') return false
    if (key === 'pricingBasis' && item === 'per_person') return false
    if (Array.isArray(item)) return item.length > 0
    if (typeof item === 'boolean') return item
    if (typeof item === 'number') return item !== 0
    return text(item).length > 0
  })
}

export const isLegacyCategoryDetails = (value: unknown) =>
  Object.keys(asObject(value)).length === 0

export const categoryDetailsForStorage = (
  categoryName: string,
  value: unknown
): Record<string, unknown> => {
  if (isLegacyCategoryDetails(value)) return {}
  const normalized = normalizeCategoryDetails(categoryName, value)
  if (normalized.kind === 'photography') {
    // Package records are persisted in the established service_packages table.
    // Keep temporary provider-form package state out of category_details.
    const persisted = { ...normalized }
    delete persisted.photoVideoPackages
    return persisted
  }
  if (normalized.kind === 'venues') {
    // Option-level venue configuration intentionally lives on the established
    // spaces/combinations resources. This avoids a parallel source of truth
    // and leaves historic, flat-price listings untouched.
    return normalized
  }
  if (normalized.kind !== 'catering') return normalized
  const options = getCateringPricingOptions(normalized)
  if (options.length === 0) return normalized
  return {
    ...normalized,
    // Keep the legacy aggregate fields during the transition so older clients
    // and the Phase 1 category validator can still read the listing safely.
    maximumGuests: Math.max(...options.map((option) => option.maximumGuests)),
    menuSections: options[0].menuSections,
    minimumGuests: Math.min(...options.map((option) => option.minimumGuests)),
    pricingBasis: 'per_person',
  }
}

const requirePositive = (errors: string[], value: unknown, message: string, minimum = 0) => {
  if (number(value) <= minimum) errors.push(message)
}

export const validateCategoryDetails = (
  categoryName: string,
  value: unknown
): string[] => {
  const details = normalizeCategoryDetails(categoryName, value)
  const errors: string[] = []

  if (details.kind === 'attire') {
    if (list(details.serviceOptions).length === 0) errors.push('Select at least one service option.')
    if (details.quantityAvailable === undefined || number(details.quantityAvailable) < 0) {
      errors.push('Quantity available cannot be negative.')
    }
  }

  if (details.kind === 'catering') {
    const rawOptions = Array.isArray(details.pricingOptions) ? details.pricingOptions.map(asObject) : []
    const rawCustomSections = Array.isArray(details.customMenuSections)
      ? details.customMenuSections.map(asObject)
      : []
    const hasCustomMenu = rawCustomSections.length > 0
    if (!hasCustomMenu && rawOptions.length === 0) errors.push('Add an item-priced menu or at least one catering pricing option.')
    if (hasCustomMenu) {
      const itemIds: string[] = []
      const minimumGuests = number(details.minimumGuests)
      const maximumGuests = number(details.maximumGuests)
      if (minimumGuests <= 0) errors.push('Custom catering menu minimum guests must be greater than zero.')
      if (maximumGuests < minimumGuests) errors.push('Custom catering menu maximum guests must be at least the minimum guests.')
      rawCustomSections.forEach((section, sectionIndex) => {
        const label = `Custom menu section ${sectionIndex + 1}`
        if (!text(section.name)) errors.push(`${label} needs a name.`)
        const minimum = number(section.minimumSelections)
        const maximum = number(section.maximumSelections)
        if (minimum < 0) errors.push(`${label} minimum selections cannot be negative.`)
        if (maximum > 0 && maximum < minimum) errors.push(`${label} maximum selections must be at least the minimum.`)
        const items = Array.isArray(section.items) ? section.items.map(asObject) : []
        if (items.length === 0) errors.push(`${label} needs at least one food item.`)
        items.forEach((item, itemIndex) => {
          const itemLabel = `${label} item ${itemIndex + 1}`
          if (!text(item.id)) errors.push(`${itemLabel} needs an ID.`)
          if (!text(item.name)) errors.push(`${itemLabel} needs a name.`)
          if (number(item.pricePerHead) <= 0) errors.push(`${itemLabel} price per head must be greater than zero.`)
          if (text(item.id)) itemIds.push(text(item.id))
        })
      })
      if (new Set(itemIds).size !== itemIds.length) errors.push('Every custom menu food item needs a unique ID.')
    }
    const optionIds = rawOptions.map((option) => text(option.id)).filter(Boolean)
    if (new Set(optionIds).size !== rawOptions.length) errors.push('Every catering option needs a unique ID.')
    rawOptions.forEach((option, index) => {
      const label = `Catering option ${index + 1}`
      if (!text(option.name)) errors.push(`${label} needs a name.`)
      if (number(option.pricePerHead) <= 0) errors.push(`${label} price per head must be greater than zero.`)
      const minimum = number(option.minimumGuests)
      const maximum = number(option.maximumGuests)
      if (minimum <= 0) errors.push(`${label} minimum guests must be greater than zero.`)
      if (maximum < minimum) errors.push(`${label} maximum guests must be at least the minimum guests.`)
      const menus = Array.isArray(option.menuSections) ? option.menuSections.map(asObject) : []
      if (!menus.some((menu) => text(menu.name) && list(menu.items).length > 0)) {
        errors.push(`${label} needs at least one named menu section with an item.`)
      }
    })
    const tasting = asObject(details.tastingSettings)
    if (tasting.enabled === true) {
      if (!hasCustomMenu) {
        errors.push('Food tasting requires an item-priced menu with course-level dish selections.')
      }
      let totalTastingSelections = 0
      rawCustomSections.forEach((section, sectionIndex) => {
        const label = `Food tasting course ${sectionIndex + 1}`
        const tastingSelectionLimit = number(section.tastingSelectionLimit)
        const finalSelectionLimit = number(section.finalSelectionLimit)
        const activeItemCount = (Array.isArray(section.items) ? section.items : [])
          .map(asObject)
          .filter((item) => item.isActive !== false)
          .length
        if (tastingSelectionLimit <= 0) {
          errors.push(`${label} needs a tasting selection limit.`)
        } else if (tastingSelectionLimit > activeItemCount) {
          errors.push(`${label} tasting selections cannot exceed available food items.`)
        } else if (tastingSelectionLimit > 5) {
          errors.push(`${label} may offer at most 5 food tasting selections.`)
        }
        totalTastingSelections += Math.max(0, tastingSelectionLimit)
        if (finalSelectionLimit <= 0) {
          errors.push(`${label} needs a final menu selection limit.`)
        } else if (tastingSelectionLimit > 0 && finalSelectionLimit > tastingSelectionLimit) {
          errors.push(`${label} final menu selections cannot exceed tasting selections.`)
        }
      })
      if (totalTastingSelections > 10) {
        errors.push('Food tastings may include at most 10 selections across all courses.')
      }
      const tastingSlots = list(tasting.tastingTimeSlots)
      if (tastingSlots.length === 0) errors.push('Add at least one food tasting start time.')
      if (tastingSlots.some((slot) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))) {
        errors.push('Food tasting start times must use 24-hour HH:MM format.')
      }
      if (new Set(tastingSlots).size !== tastingSlots.length) {
        errors.push('Food tasting start times cannot be duplicated.')
      }
      const durationMinutes = number(tasting.durationMinutes)
      if (durationMinutes < 15 || durationMinutes > 480) {
        errors.push('Food tasting duration must be between 15 and 480 minutes.')
      }
      if (number(tasting.minimumLeadDays) < 0 || number(tasting.latestDaysBeforeEvent) < 0) {
        errors.push('Food tasting scheduling windows cannot be negative.')
      }
      if (!text(tasting.location)) errors.push('Add the food tasting location.')
    }
  }

  if (details.kind === 'venues') {
    const spaces = Array.isArray(details.spaces) ? details.spaces.map(asObject) : []
    if (spaces.length === 0) errors.push('Add at least one venue space or hall.')
    const spaceIds = spaces.map((space) => text(space.id)).filter(Boolean)
    if (new Set(spaceIds).size !== spaces.length) {
      errors.push('Every venue space needs a unique ID.')
    }
    const combinations = Array.isArray(details.combinations)
      ? details.combinations.map(asObject)
      : []
    const venueOptions = [...spaces, ...combinations]
    const optionIds = venueOptions.map((option) => text(option.id)).filter(Boolean)
    const optionPricingConfigured = venueOptions.some((option) =>
      Object.prototype.hasOwnProperty.call(option, 'pricingUnit')
      || Object.prototype.hasOwnProperty.call(option, 'baseRate')
    )
    spaces.forEach((space, index) => {
      if (!text(space.name)) errors.push(`Space ${index + 1} needs a name.`)
      requirePositive(errors, space.areaSqm, `Space ${index + 1} area must be greater than zero.`)
      requirePositive(errors, space.capacity, `Space ${index + 1} capacity must be greater than zero.`)
    })
    const ids = new Set(spaceIds)
    if (new Set(optionIds).size !== spaces.length + combinations.length) {
      errors.push('Every venue space and combination needs a unique ID.')
    }
    combinations.forEach((combination, index) => {
      const selectedIds = list(combination.spaceIds)
      if (!text(combination.name)) errors.push(`Combination ${index + 1} needs a name.`)
      requirePositive(errors, combination.combinedAreaSqm,
        `Combination ${index + 1} area must be greater than zero.`)
      requirePositive(errors, combination.combinedCapacity,
        `Combination ${index + 1} capacity must be greater than zero.`)
      if (selectedIds.length < 2) errors.push(`Combination ${index + 1} must contain at least two spaces.`)
      if (new Set(selectedIds).size !== selectedIds.length) errors.push(`Combination ${index + 1} contains a duplicate space.`)
      if (selectedIds.some((id) => !ids.has(id))) errors.push(`Combination ${index + 1} contains an unavailable space.`)
      if (selectedIds.some((id) => {
        const source = spaces.find((space) => text(space.id) === id)
        return source?.allowsCombination === false
      })) errors.push(`Combination ${index + 1} contains a space that cannot be combined.`)
    })
    if (optionPricingConfigured) {
      venueOptions.forEach((option, index) => {
        const label = text(option.name) || `Venue option ${index + 1}`
        const isAvailable = option.isActive !== false && option.isBookableIndividually !== false
        const pricingUnit = venuePricingUnit(option.pricingUnit)
        const rate = number(option.baseRate)
        if (isAvailable && !pricingUnit) {
          errors.push(`${label} needs an hourly or per-event price type.`)
        }
        if (isAvailable && rate <= 0) {
          errors.push(`${label} needs a positive base rate.`)
        }
        const minimum = number(option.minimumBookingHours)
        const maximum = number(option.maximumBookingHours)
        const included = number(option.includedDurationHours)
        if (minimum < 0 || maximum < 0 || included < 0) {
          errors.push(`${label} duration values cannot be negative.`)
        }
        if (maximum > 0 && maximum < Math.max(minimum, 1)) {
          errors.push(`${label} maximum duration must be at least its minimum duration.`)
        }
        const relationshipKeys = ['requiredOptionIds', 'mutuallyExclusiveOptionIds'] as const
        relationshipKeys.forEach((key) => {
          const references = list(option[key])
          if (new Set(references).size !== references.length) {
            errors.push(`${label} has duplicate ${key === 'requiredOptionIds' ? 'required' : 'mutually exclusive'} options.`)
          }
          if (references.some((id) => id === text(option.id) || !optionIds.includes(id))) {
            errors.push(`${label} references a venue option that is unavailable.`)
          }
        })
      })
    }
    if (number(details.minimumBookingHours) < 0) errors.push('Minimum booking hours cannot be negative.')
    if (number(details.maximumBookingHours) > 0
      && number(details.maximumBookingHours) < Math.max(number(details.minimumBookingHours), 1)) {
      errors.push('Maximum booking hours must be at least the minimum booking hours.')
    }
    if (number(details.bookingDurationIncrementHours) > 0
      && number(details.bookingDurationIncrementHours) < 0.25) {
      errors.push('Booking duration increment must be at least 0.25 hours.')
    }
  }

  if (details.kind === 'photography') {
    const serviceType = text(details.photoVideoServiceType)
    const usesV18Configuration = Object.prototype.hasOwnProperty.call(details, 'photoVideoServiceType')
    const includesPhoto = serviceType === 'photography' || serviceType === 'combined'
    const includesVideo = serviceType === 'videography' || serviceType === 'combined'
    if (usesV18Configuration && !['photography', 'videography', 'combined'].includes(serviceType)) {
      errors.push('Choose photography, videography, or combined coverage.')
    }
    requirePositive(errors, details.coverageDurationHours, 'Coverage duration must be greater than zero.')
    if ((!usesV18Configuration || includesPhoto) && number(details.photographerCount) < 1) {
      errors.push('At least one photographer is required.')
    }
    if ((usesV18Configuration ? includesVideo : details.videoCoverage === true)
      && number(details.videographerCount) < 1) {
      errors.push('At least one videographer is required when video coverage is included.')
    }
    if (usesV18Configuration) {
      if (list(details.eventTypes).length === 0) errors.push('Select at least one supported event type.')
      if (!text(details.operatingLocation)) errors.push('Enter the operating location.')
      if (list(details.coverageAreas).length === 0) errors.push('Add at least one coverage area.')
      if (number(details.minimumBookingNoticeDays) < 0) errors.push('Minimum booking notice cannot be negative.')

      const rawCoverageConfigurations = Array.isArray(details.coverageConfigurations)
        ? details.coverageConfigurations.map(asObject)
        : []
      if (rawCoverageConfigurations.length === 0) {
        errors.push('Add at least one bookable coverage configuration.')
      }
      const coverageIds: string[] = []
      rawCoverageConfigurations.forEach((configuration, index) => {
        const label = `Coverage configuration ${index + 1}`
        const id = text(configuration.id)
        if (!id) errors.push(`${label} needs an ID.`)
        else coverageIds.push(id)
        if (!text(configuration.name)) errors.push(`${label} needs a name.`)
        if (number(configuration.durationHours) <= 0) errors.push(`${label} needs a positive duration.`)
        if (number(configuration.price) <= 0) errors.push(`${label} needs a positive provider price.`)
        const includedCrew = Array.isArray(configuration.includedCrew)
          ? configuration.includedCrew.map(asObject)
          : []
        if (includedCrew.length === 0) errors.push(`${label} needs at least one included crew role.`)
        includedCrew.forEach((crew, crewIndex) => {
          if (!text(crew.role) || number(crew.quantity) < 1) {
            errors.push(`${label} crew member ${crewIndex + 1} needs a role and positive quantity.`)
          }
        })
      })
      if (new Set(coverageIds).size !== coverageIds.length) {
        errors.push('Every coverage configuration needs a unique ID.')
      }

      const rawAdditionalCrew = Array.isArray(details.additionalCrewOptions)
        ? details.additionalCrewOptions.map(asObject)
        : []
      const additionalCrewIds: string[] = []
      rawAdditionalCrew.forEach((option, index) => {
        const label = `Additional crew option ${index + 1}`
        const id = text(option.id)
        if (!id) errors.push(`${label} needs an ID.`)
        else additionalCrewIds.push(id)
        if (!text(option.role)) errors.push(`${label} needs a role.`)
        if (number(option.maximumQuantity) < 1) errors.push(`${label} needs a positive maximum quantity.`)
        if (number(option.price) <= 0) errors.push(`${label} needs a positive price.`)
        if (option.pricingUnit !== 'event' && option.pricingUnit !== 'hour') {
          errors.push(`${label} needs a per-event or per-hour price type.`)
        }
      })
      if (new Set(additionalCrewIds).size !== additionalCrewIds.length) {
        errors.push('Every additional crew option needs a unique ID.')
      }
      if (number(details.teamCapacity) < 1) errors.push('Set the number of teams available for the same time period.')
      if (number(details.scheduleFlexibilityMinutes) < 0) errors.push('Schedule flexibility cannot be negative.')
      if (number(details.additionalLocationFee) < 0) errors.push('Additional-location fee cannot be negative.')
      if (details.additionalHoursAllowed === true) {
        if (number(details.additionalHourRate) <= 0) errors.push('Set a positive prebooked additional-hour rate.')
        if (number(details.maximumAdditionalHours) < 1) errors.push('Set a maximum number of prebooked additional hours.')
      }
      if (details.overtimeAllowed === true) {
        if (number(details.overtimeRate) <= 0) errors.push('Set a positive overtime rate.')
        if (number(details.overtimeMinimumIncrementHours) <= 0) errors.push('Set a positive overtime minimum increment.')
        if (details.overtimeRequiresAuthorization !== true) {
          errors.push('Event-day overtime must require client authorization.')
        }
      }

      const supportedMediaTypes = serviceType === 'photography'
        ? ['photo']
        : serviceType === 'videography'
          ? ['video']
          : ['photo', 'video', 'both']
      const rawDeliverables = Array.isArray(details.deliverableConfigurations)
        ? details.deliverableConfigurations.map(asObject)
        : []
      if (rawDeliverables.length === 0) errors.push('Add at least one promised deliverable.')
      const deliverableIds: string[] = []
      rawDeliverables.forEach((deliverable, index) => {
        const label = `Deliverable ${index + 1}`
        const id = text(deliverable.id)
        if (!id) errors.push(`${label} needs an ID.`)
        else deliverableIds.push(id)
        if (!text(deliverable.name)) errors.push(`${label} needs a name.`)
        const mediaType = text(deliverable.mediaType)
        if (!supportedMediaTypes.includes(mediaType)) errors.push(`${label} is not supported by this service type.`)
        const pricingMode = text(deliverable.pricingMode)
        if (!['included', 'fixed', 'per_unit', 'per_hour'].includes(pricingMode)) {
          errors.push(`${label} needs a valid pricing mode.`)
        } else if (pricingMode !== 'included' && number(deliverable.price) <= 0) {
          errors.push(`${label} needs a positive price when it is not included.`)
        }
        if (number(deliverable.includedQuantity) < 0 || number(deliverable.maximumQuantity) < 0) {
          errors.push(`${label} quantities cannot be negative.`)
        }
        if (pricingMode === 'included' && number(deliverable.includedQuantity) < 1) {
          errors.push(`${label} needs an included quantity.`)
        }
        if (number(deliverable.maximumQuantity) > 0
          && number(deliverable.includedQuantity) > number(deliverable.maximumQuantity)) {
          errors.push(`${label} maximum quantity must cover its included quantity.`)
        }
        if (number(deliverable.turnaroundDays) < 0) errors.push(`${label} turnaround cannot be negative.`)
      })
      if (new Set(deliverableIds).size !== deliverableIds.length) errors.push('Every deliverable needs a unique ID.')

      const rawAdditionalServices = Array.isArray(details.additionalServices)
        ? details.additionalServices.map(asObject)
        : []
      const configuredCrewRoles = new Set([
        ...rawCoverageConfigurations.flatMap((configuration) => (
          Array.isArray(configuration.includedCrew) ? configuration.includedCrew.map(asObject) : []
        )).map((crew) => text(crew.role).toLowerCase()).filter(Boolean),
        ...rawAdditionalCrew.map((crew) => text(crew.role).toLowerCase()).filter(Boolean),
      ])
      const validateCrewDependencies = (value: Record<string, unknown>, label: string) => {
        if (!Array.isArray(value.requiredCrewRoles)) {
          errors.push(`${label} crew requirements must be a list.`)
          return
        }
        list(value.requiredCrewRoles).forEach((role) => {
          if (!configuredCrewRoles.has(role.toLowerCase())) {
            errors.push(`${label} requires an unavailable crew role: ${role}.`)
          }
        })
      }
      rawDeliverables.forEach((deliverable, index) => validateCrewDependencies(deliverable, `Deliverable ${index + 1}`))
      const additionalServiceIds: string[] = []
      rawAdditionalServices.forEach((service, index) => {
        const label = `Additional service ${index + 1}`
        const id = text(service.id)
        if (!id) errors.push(`${label} needs an ID.`)
        else additionalServiceIds.push(id)
        if (!text(service.name)) errors.push(`${label} needs a name.`)
        if (number(service.price) <= 0) errors.push(`${label} needs a positive price.`)
        if (!['event', 'hour', 'unit'].includes(text(service.pricingUnit))) {
          errors.push(`${label} needs an event, hour, or unit price type.`)
        }
        if (number(service.maximumQuantity) < 0) errors.push(`${label} maximum quantity cannot be negative.`)
        validateCrewDependencies(service, label)
      })
      if (new Set(additionalServiceIds).size !== additionalServiceIds.length) {
        errors.push('Every additional service needs a unique ID.')
      }

      // Post-production is opt-in so historic Photo/Video listings remain
      // publishable. Once a provider saves these commitments, require a
      // complete, client-safe configuration rather than inventing deadlines.
      if (Object.prototype.hasOwnProperty.call(details, 'postProductionSettings')) {
        const settings = asObject(details.postProductionSettings)
        const deadlineStartingPoint = text(settings.deadlineStartingPoint)
        if (!['event_completion', 'agreed_custom_start'].includes(deadlineStartingPoint)) {
          errors.push('Choose when post-production turnaround begins.')
        }
        if (deadlineStartingPoint === 'agreed_custom_start' && !text(settings.startingPointDisclosure)) {
          errors.push('Explain and agree the alternate post-production starting point.')
        }
        rawDeliverables.forEach((deliverable, index) => {
          if (number(deliverable.turnaroundDays) <= 0 || !Number.isInteger(number(deliverable.turnaroundDays))) {
            errors.push(`Deliverable ${index + 1} needs a positive whole-day editing turnaround.`)
          }
        })

        const rawDeliveryMethods = Array.isArray(settings.deliveryMethods)
          ? settings.deliveryMethods.map(asObject)
          : []
        if (rawDeliveryMethods.length === 0) errors.push('Add at least one delivery method.')
        const deliveryMethodIds: string[] = []
        rawDeliveryMethods.forEach((method, index) => {
          const label = `Delivery method ${index + 1}`
          const id = text(method.id)
          if (!id) errors.push(`${label} needs an ID.`)
          else deliveryMethodIds.push(id)
          if (!photoVideoDeliveryMethodKinds.includes(text(method.kind) as PhotoVideoDeliveryMethodKind)) {
            errors.push(`${label} is not supported.`)
          }
        })
        if (new Set(deliveryMethodIds).size !== deliveryMethodIds.length) {
          errors.push('Every delivery method needs a unique ID.')
        }

        const rawRushOptions = Array.isArray(settings.rushEditingOptions)
          ? settings.rushEditingOptions.map(asObject)
          : []
        const rushIds: string[] = []
        rawRushOptions.forEach((option, index) => {
          const label = `Rush editing option ${index + 1}`
          const id = text(option.id)
          if (!id) errors.push(`${label} needs an ID.`)
          else rushIds.push(id)
          if (!Array.isArray(option.deliverableIds) || list(option.deliverableIds).length === 0
            || list(option.deliverableIds).some((id) => !deliverableIds.includes(id))) {
            errors.push(`${label} needs eligible configured deliverables.`)
          }
          if (number(option.turnaroundDays) <= 0 || !Number.isInteger(number(option.turnaroundDays))) {
            errors.push(`${label} needs a positive whole-day rush turnaround.`)
          }
          if (number(option.additionalCharge) <= 0) errors.push(`${label} needs a positive additional charge.`)
          if (number(option.capacityLimit) < 0) errors.push(`${label} capacity cannot be negative.`)
        })
        if (new Set(rushIds).size !== rushIds.length) errors.push('Every rush editing option needs a unique ID.')

        const policy = asObject(settings.revisionPolicy)
        if (!Object.prototype.hasOwnProperty.call(policy, 'includedRevisionRounds')
          || number(policy.includedRevisionRounds) < 0
          || !Number.isInteger(number(policy.includedRevisionRounds))) {
          errors.push('Set the number of included revision rounds, including zero when none are included.')
        }
        const includedRevisionRounds = number(policy.includedRevisionRounds)
        const eligibleRevisionDeliverables = list(policy.eligibleDeliverableIds)
        if (includedRevisionRounds > 0) {
          if (eligibleRevisionDeliverables.length === 0
            || eligibleRevisionDeliverables.some((id) => !deliverableIds.includes(id))) {
            errors.push('Revision-eligible deliverables must be configured deliverables.')
          }
          if (number(policy.revisionRequestPeriodDays) <= 0) {
            errors.push('Set a positive revision request period.')
          }
          if (number(policy.revisionRequestPeriodDays) > 0
            && !Number.isInteger(number(policy.revisionRequestPeriodDays))) {
            errors.push('Revision request period must be a whole number of days.')
          }
          if (number(policy.revisionTurnaroundDays) <= 0) {
            errors.push('Set a positive revision turnaround.')
          }
          if (number(policy.revisionTurnaroundDays) > 0
            && !Number.isInteger(number(policy.revisionTurnaroundDays))) {
            errors.push('Revision turnaround must be a whole number of days.')
          }
        } else if (eligibleRevisionDeliverables.length > 0
          && eligibleRevisionDeliverables.some((id) => !deliverableIds.includes(id))) {
          errors.push('Revision-eligible deliverables must be configured deliverables.')
        }
        if (number(policy.additionalRevisionCharge) < 0) {
          errors.push('Additional revision charges cannot be negative.')
        }
      }

      const packages = photoVideoPackageDraftsFrom(details)
      const packageCoverageIds = new Set(rawCoverageConfigurations.map((configuration) => text(configuration.id)).filter(Boolean))
      const packageDeliverableIds = new Set(rawDeliverables.map((deliverable) => text(deliverable.id)).filter(Boolean))
      const packageAdditionalCrewIds = new Set(rawAdditionalCrew.map((crew) => text(crew.id)).filter(Boolean))
      const additionalServiceIdsSet = new Set(rawAdditionalServices.map((service) => text(service.id)).filter(Boolean))
      packages.filter((pkg) => pkg.isActive).forEach((pkg, index) => {
        const label = `Photo/Video package ${index + 1}`
        if (!pkg.name) errors.push(`${label} needs a name.`)
        if (pkg.price <= 0) errors.push(`${label} needs a positive provider price.`)
        if (!packageCoverageIds.has(pkg.coverageConfigurationId)) errors.push(`${label} needs a configured coverage option.`)
        if (pkg.eventTypes.length === 0 || pkg.eventTypes.some((eventType) => !list(details.eventTypes).includes(eventType))) {
          errors.push(`${label} includes an unsupported event type.`)
        }
        if (pkg.deliverableIds.length === 0 || pkg.deliverableIds.some((id) => !packageDeliverableIds.has(id))) {
          errors.push(`${label} needs valid included deliverables.`)
        }
        if (pkg.allowedAdditionalCrewOptionIds.some((id) => !packageAdditionalCrewIds.has(id))) {
          errors.push(`${label} includes an unavailable additional crew option.`)
        }
        if (pkg.allowedAdditionalServiceIds.some((id) => !additionalServiceIdsSet.has(id))) {
          errors.push(`${label} includes an unavailable additional service.`)
        }
      })
    }
  }

  if (details.kind === 'sound_lights') {
    requirePositive(errors, details.recommendedGuestCapacity, 'Recommended guest capacity must be greater than zero.')
    if (number(details.speakerCount) < 0 || number(details.microphoneCount) < 0) {
      errors.push('Equipment quantities cannot be negative.')
    }
  }

  return errors
}

const joined = (value: unknown) => list(value).join(', ')
const yesNo = (value: unknown) => value === true ? 'Yes' : value === false ? 'No' : ''
const duration = (amount: unknown, unit: unknown) => number(amount) > 0
  ? `${number(amount)} ${text(unit) || 'hours'}`
  : ''

export const summarizeCategoryDetails = (
  categoryName: string,
  value: unknown
): CategoryDetailFact[] => {
  if (!hasEnteredCategoryDetails(value)) return []
  const detail = normalizeCategoryDetails(categoryName, value)
  const facts: CategoryDetailFact[] = []
  const add = (label: string, factValue: unknown) => {
    const display = typeof factValue === 'string' ? factValue.trim() : String(factValue ?? '')
    if (display && display !== '0') facts.push({ label, value: display })
  }

  if (detail.kind === 'attire') {
    add('Attire type', text(detail.attireTypeOther) || text(detail.attireType))
    add('Service options', joined(detail.serviceOptions))
    add('Intended for', joined(detail.intendedFor))
    add('Available sizes', joined(detail.availableSizes))
    add('Available colors', joined(detail.availableColors))
    add('Quantity available', detail.quantityAvailable)
    if (list(detail.serviceOptions).includes('Rental')) add('Rental duration', duration(detail.rentalDuration, detail.rentalDurationUnit))
    add('Fitting required', yesNo(detail.fittingRequired))
    add('Lead time', duration(detail.leadTime, detail.leadTimeUnit))
    add('Inclusions', joined(detail.inclusions))
  } else if (detail.kind === 'florists') {
    add('Services offered', joined(detail.serviceTypes))
    add('Flower options', joined(detail.flowerOptions))
    add('Colors / themes', joined(detail.themeOptions))
    add('Coverage', joined(detail.coverage))
    add('Service area', detail.serviceArea)
    add('Service inclusions', joined(detail.inclusions))
    add('Customization', yesNo(detail.customizationAvailable))
    add('Setup included', yesNo(detail.setupIncluded))
    add('Delivery included', yesNo(detail.deliveryIncluded))
    add('Lead time', duration(detail.leadTime, detail.leadTimeUnit))
  } else if (detail.kind === 'catering') {
    add('Catering types', joined(detail.cateringTypes))
    add('Cuisine', joined(detail.cuisines))
    const options = getCateringPricingOptions(detail)
    add('Menu options', options.map((option) =>
      `${option.name} - PHP ${option.pricePerHead.toLocaleString('en-PH')}/head (${option.minimumGuests}-${option.maximumGuests} guests)`
    ).join(' | '))
    if (options.length === 0) add('Pricing basis', text(detail.pricingBasis) === 'per_person' ? 'Per person' : 'Package')
    if (options.length === 0 && (number(detail.minimumGuests) > 0 || number(detail.maximumGuests) > 0)) {
      add('Guest range', `${number(detail.minimumGuests)}–${number(detail.maximumGuests)} guests`)
    }
    const menus = options.length === 0 && Array.isArray(detail.menuSections) ? detail.menuSections.map(asObject) : []
    add('Menu', menus.map((menu) => `${text(menu.name)}: ${joined(menu.items)}`).filter(Boolean).join(' · '))
    add('Dietary options', joined(detail.dietaryOptions))
    const tasting = getCateringTastingSettings(detail)
    if (tasting) {
      add('Food tasting', `Optional - ${tasting.slots.join(', ')} - ${tasting.durationMinutes} minutes`)
      add('Tasting location', tasting.location)
    }
  } else if (detail.kind === 'venues') {
    add('Venue type', text(detail.venueTypeOther) || text(detail.venueType))
    add('Address', detail.address)
    const spaces = Array.isArray(detail.spaces) ? detail.spaces.map(asObject) : []
    add('Spaces / halls', spaces.map((space) => `${text(space.name)} (${number(space.capacity)} guests, ${number(space.areaSqm)} sqm)`).join(' · '))
    const combinations = Array.isArray(detail.combinations) ? detail.combinations.map(asObject) : []
    add('Expandable spaces', combinations.map((item) => text(item.name)).filter(Boolean).join(', '))
    const amenityLabels: Record<string, string> = {
      airConditioning: 'Air conditioning', chairs: 'Chairs', tables: 'Tables',
      parking: 'Parking', restrooms: 'Restrooms', dressingRoom: 'Dressing room',
      kitchen: 'Kitchen', wifi: 'Wi-Fi', stage: 'Stage', pwdAccessibility: 'PWD accessibility',
    }
    add('Amenities', Object.entries(amenityLabels).flatMap(([key, label]) => {
      if (detail[key] !== true) return []
      const quantity = number(detail[`${key}Quantity`])
      return [quantity > 0 ? `${label} (${quantity})` : label]
    }).join(', '))
    add('Other inclusions', joined(detail.otherInclusions))
    add('Operating hours', text(detail.openingTime) && text(detail.closingTime) ? `${text(detail.openingTime)}–${text(detail.closingTime)}` : '')
    add('Setup / ingress allowance', duration(detail.setupAllowance, detail.setupAllowanceUnit))
    add('Minimum booking', duration(detail.minimumBookingHours, 'hours'))
    add('Maximum booking', duration(detail.maximumBookingHours, 'hours'))
    add('Duration increment', duration(detail.bookingDurationIncrementHours, 'hours'))
    add('Setup / ingress billed', yesNo(detail.setupAllowanceBillable))
  } else if (detail.kind === 'event_organizer') {
    add('Specializations', joined(detail.specializations))
    add('Coordination services', joined(detail.coordinationTypes))
    add('Maximum event size', detail.maximumEventSize)
    add('Assignment capacity', detail.assignmentCapacity)
  } else if (detail.kind === 'sound_lights') {
    add('Service types', joined(detail.serviceTypes))
    add('Recommended capacity', `${number(detail.recommendedGuestCapacity)} guests`)
    add('Venue coverage', detail.venueCoverage)
    add('Speakers', detail.speakerCount)
    add('Microphones', detail.microphoneCount)
    add('Lighting types', joined(detail.lightingTypes))
    add('Technician included', yesNo(detail.technicianIncluded))
  } else if (detail.kind === 'photography') {
    const serviceTypeLabels: Record<string, string> = {
      photography: 'Photography only', videography: 'Videography only', combined: 'Photography + Videography',
    }
    add('Service type', serviceTypeLabels[text(detail.photoVideoServiceType)] || '')
    add('Coverage types', joined(detail.coverageTypes))
    add('Event types', joined(detail.eventTypes))
    add('Coverage duration', duration(detail.coverageDurationHours, 'hours'))
    if (text(detail.photoVideoServiceType) !== 'videography') add('Photographers', detail.photographerCount)
    if (text(detail.photoVideoServiceType) !== 'photography') add('Videographers', detail.videographerCount)
    add('Operating location', detail.operatingLocation)
    add('Coverage areas', joined(detail.coverageAreas))
    add('Minimum notice', duration(detail.minimumBookingNoticeDays, 'days'))
    const coverageConfigurations = getPhotoVideoCoverageConfigurations(detail)
    add('Bookable coverage', coverageConfigurations.map((configuration) =>
      `${configuration.name} (${configuration.durationHours} hours)`
    ).join(', '))
    add('Team capacity', detail.teamCapacity)
    const deliverables = getPhotoVideoDeliverableConfigurations(detail)
    add('Deliverables', deliverables.map((deliverable) => deliverable.name).join(', '))
    const additionalServices = getPhotoVideoAdditionalServices(detail)
    add('Additional services', additionalServices.map((service) => service.name).join(', '))
    const postProduction = getPhotoVideoPostProductionSettings(detail)
    if (postProduction) {
      add('Editing deadline starts', postProduction.deadlineStartingPoint === 'event_completion'
        ? 'Event completion date'
        : postProduction.startingPointDisclosure || 'Agreed alternate starting point')
      add('Delivery methods', postProduction.deliveryMethods.map((method) => ({
        secure_download_link: 'Secure download link', online_gallery: 'Online gallery', cloud_delivery: 'Cloud delivery',
        usb: 'USB', physical_album_delivery: 'Physical album delivery', courier_delivery: 'Courier delivery', client_pickup: 'Client pickup',
      } as Record<PhotoVideoDeliveryMethodKind, string>)[method.kind]).join(', '))
      add('Included revisions', `${postProduction.revisionPolicy.includedRevisionRounds} round${postProduction.revisionPolicy.includedRevisionRounds === 1 ? '' : 's'}`)
      add('Revision request period', duration(postProduction.revisionPolicy.revisionRequestPeriodDays, 'days'))
      add('Rush editing', postProduction.rushEditingOptions.some((option) => option.isAvailable) ? 'Available for selected deliverables' : '')
    } else {
      add('Turnaround time', duration(detail.turnaroundTime, detail.turnaroundUnit))
    }
  } else if (detail.kind === 'host_emcee') {
    add('Event types', joined(detail.eventTypes))
    add('Hosting styles', joined(detail.hostingStyles))
    add('Languages', joined(detail.languages))
    add('Coverage duration', duration(detail.coverageDurationHours, 'hours'))
    add('Rehearsal included', yesNo(detail.rehearsalIncluded))
    add('Equipment provided', joined(detail.equipmentProvided))
  }

  return facts
}
