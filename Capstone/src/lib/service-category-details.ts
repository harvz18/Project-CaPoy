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
  id: string
  items: CateringCustomMenuItem[]
  maximumSelections?: number
  minimumSelections: number
  name: string
}

export type CateringCustomMenu = {
  maximumGuests: number
  minimumGuests: number
  sections: CateringCustomMenuSection[]
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
    minimumSelections: Math.max(0, Math.floor(number(section.minimumSelections))),
    name: text(section.name),
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
    requirePositive(errors, details.coverageDurationHours, 'Coverage duration must be greater than zero.')
    if (number(details.photographerCount) < 1) errors.push('At least one photographer is required.')
    if (details.videoCoverage === true && number(details.videographerCount) < 1) {
      errors.push('At least one videographer is required when video coverage is included.')
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
    add('Floral services', joined(detail.serviceTypes))
    add('Flower options', joined(detail.flowerOptions))
    add('Colors / themes', joined(detail.themeOptions))
    add('Coverage', joined(detail.coverage))
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
    add('Coverage types', joined(detail.coverageTypes))
    add('Event types', joined(detail.eventTypes))
    add('Coverage duration', duration(detail.coverageDurationHours, 'hours'))
    add('Photographers', detail.photographerCount)
    add('Video coverage', yesNo(detail.videoCoverage))
    if (detail.videoCoverage === true) add('Videographers', detail.videographerCount)
    add('Turnaround time', duration(detail.turnaroundTime, detail.turnaroundUnit))
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
