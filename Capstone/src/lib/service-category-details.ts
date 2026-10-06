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

export type CateringPriceCalculation = {
  fitsGuestCount: boolean
  guestCount: number
  providerSubtotal: number
  reason?: string
  unitPrice: number
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
    if (rawOptions.length === 0) errors.push('Add at least one catering menu and pricing option.')
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
  }

  if (details.kind === 'venues') {
    const spaces = Array.isArray(details.spaces) ? details.spaces.map(asObject) : []
    if (spaces.length === 0) errors.push('Add at least one venue space or hall.')
    spaces.forEach((space, index) => {
      if (!text(space.name)) errors.push(`Space ${index + 1} needs a name.`)
      requirePositive(errors, space.areaSqm, `Space ${index + 1} area must be greater than zero.`)
      requirePositive(errors, space.capacity, `Space ${index + 1} capacity must be greater than zero.`)
    })
    const ids = new Set(spaces.map((space) => text(space.id)).filter(Boolean))
    const combinations = Array.isArray(details.combinations)
      ? details.combinations.map(asObject)
      : []
    combinations.forEach((combination, index) => {
      const selectedIds = list(combination.spaceIds)
      if (selectedIds.length < 2) errors.push(`Combination ${index + 1} must contain at least two spaces.`)
      if (new Set(selectedIds).size !== selectedIds.length) errors.push(`Combination ${index + 1} contains a duplicate space.`)
      if (selectedIds.some((id) => !ids.has(id))) errors.push(`Combination ${index + 1} contains an unavailable space.`)
    })
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
  } else if (detail.kind === 'venues') {
    add('Venue type', text(detail.venueTypeOther) || text(detail.venueType))
    add('Address', detail.address)
    const spaces = Array.isArray(detail.spaces) ? detail.spaces.map(asObject) : []
    add('Spaces / halls', spaces.map((space) => `${text(space.name)} (${number(space.capacity)} guests, ${number(space.areaSqm)} sqm)`).join(' · '))
    const combinations = Array.isArray(detail.combinations) ? detail.combinations.map(asObject) : []
    add('Expandable spaces', combinations.map((item) => text(item.name)).filter(Boolean).join(', '))
    add('Other inclusions', joined(detail.otherInclusions))
    add('Operating hours', text(detail.openingTime) && text(detail.closingTime) ? `${text(detail.openingTime)}–${text(detail.closingTime)}` : '')
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
