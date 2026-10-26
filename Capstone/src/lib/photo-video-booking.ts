import { customerPriceFromProviderPrice } from './pricing'
import {
  getPhotoVideoAdditionalCrewOptions,
  getPhotoVideoAdditionalServices,
  getPhotoVideoCoverageConfigurations,
  getPhotoVideoDeliverableConfigurations,
  getPhotoVideoPostProductionSettings,
  type PhotoVideoAdditionalService,
  type PhotoVideoCoverageConfiguration,
  type PhotoVideoDeliverableConfiguration,
  type PhotoVideoPostProductionSettings,
} from './service-category-details'
import type { PhotoVideoPackageDraft } from './photo-video'

export type PhotoVideoSelectionSnapshot = {
  additionalCrew: Array<{ optionId: string; quantity: number }>
  additionalHours: number
  additionalServices: Array<{ serviceId: string; quantity: number }>
  coverageConfigurationId?: string
  coverageLocations: string[]
  coverageSchedule: {
    ceremony?: string
    coverageEnd?: string
    coverageStart?: string
    preparation?: string
    reception?: string
  }
  deliverables: Array<{ deliverableId: string; quantity: number }>
  packageId?: string
  requestedMediaType?: 'photo' | 'video' | 'combined'
  rushEditingOptionIds: string[]
  schemaVersion: 1
  selectionMethod: 'custom' | 'package'
}

export type PhotoVideoBookingConfiguration = {
  additionalCrewOptions: ReturnType<typeof getPhotoVideoAdditionalCrewOptions>
  additionalServices: PhotoVideoAdditionalService[]
  coverageConfigurations: PhotoVideoCoverageConfiguration[]
  deliverables: PhotoVideoDeliverableConfiguration[]
  packages: PhotoVideoPackageDraft[]
  postProduction?: PhotoVideoPostProductionSettings
  serviceType: 'photography' | 'videography' | 'combined'
  supportsAdditionalHours: boolean
  maximumAdditionalHours: number
  additionalHourRate: number
  allowsMultipleLocations: boolean
  additionalLocationFee: number
  allowsClientCoverageSchedule: boolean
}

export type PhotoVideoPriceCalculation = {
  clientTotal: number
  providerTotal: number
  lineItems: Array<{ label: string; providerAmount: number }>
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {}
const list = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  : []
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const positiveInteger = (value: unknown) => Math.max(0, Math.floor(number(value)))

export const defaultPhotoVideoSelection = (): PhotoVideoSelectionSnapshot => ({
  additionalCrew: [],
  additionalHours: 0,
  additionalServices: [],
  coverageLocations: [],
  coverageSchedule: {},
  deliverables: [],
  rushEditingOptionIds: [],
  schemaVersion: 1,
  selectionMethod: 'custom',
})

export const normalizePhotoVideoSelection = (value: unknown): PhotoVideoSelectionSnapshot => {
  const source = record(value)
  const selectionMethod = source.selectionMethod === 'package' ? 'package' as const : 'custom' as const
  const selectionRows = (key: string, idKey: string) => Array.isArray(source[key])
    ? source[key].map(record).flatMap((item) => {
      const id = text(item[idKey])
      const quantity = positiveInteger(item.quantity)
      return id && quantity > 0 ? [{ [idKey]: id, quantity }] : []
    })
    : []
  const schedule = record(source.coverageSchedule)
  const requestedMediaType = ['photo', 'video', 'combined'].includes(text(source.requestedMediaType))
    ? text(source.requestedMediaType) as PhotoVideoSelectionSnapshot['requestedMediaType']
    : undefined
  return {
    additionalCrew: selectionRows('additionalCrew', 'optionId') as PhotoVideoSelectionSnapshot['additionalCrew'],
    additionalHours: positiveInteger(source.additionalHours),
    additionalServices: selectionRows('additionalServices', 'serviceId') as PhotoVideoSelectionSnapshot['additionalServices'],
    coverageConfigurationId: text(source.coverageConfigurationId) || undefined,
    coverageLocations: list(source.coverageLocations),
    coverageSchedule: {
      ceremony: text(schedule.ceremony) || undefined,
      coverageEnd: text(schedule.coverageEnd) || undefined,
      coverageStart: text(schedule.coverageStart) || undefined,
      preparation: text(schedule.preparation) || undefined,
      reception: text(schedule.reception) || undefined,
    },
    deliverables: selectionRows('deliverables', 'deliverableId') as PhotoVideoSelectionSnapshot['deliverables'],
    packageId: text(source.packageId) || undefined,
    requestedMediaType,
    rushEditingOptionIds: list(source.rushEditingOptionIds),
    schemaVersion: 1,
    selectionMethod,
  }
}

export const photoVideoBookingConfigurationFrom = (
  details: unknown,
  packages: PhotoVideoPackageDraft[]
): PhotoVideoBookingConfiguration | undefined => {
  const source = record(details)
  const serviceType = text(source.photoVideoServiceType)
  if (!['photography', 'videography', 'combined'].includes(serviceType)) return undefined
  return {
    additionalCrewOptions: getPhotoVideoAdditionalCrewOptions(source),
    additionalHourRate: Math.max(0, number(source.additionalHourRate)),
    additionalLocationFee: Math.max(0, number(source.additionalLocationFee)),
    additionalServices: getPhotoVideoAdditionalServices(source),
    allowsClientCoverageSchedule: source.allowsClientCoverageSchedule !== false,
    allowsMultipleLocations: source.allowsMultipleLocations === true,
    coverageConfigurations: getPhotoVideoCoverageConfigurations(source),
    deliverables: getPhotoVideoDeliverableConfigurations(source),
    maximumAdditionalHours: positiveInteger(source.maximumAdditionalHours),
    packages: packages.filter((pkg) => pkg.isActive),
    postProduction: getPhotoVideoPostProductionSettings(source),
    serviceType: serviceType as PhotoVideoBookingConfiguration['serviceType'],
    supportsAdditionalHours: source.additionalHoursAllowed === true,
  }
}

const priceForDeliverable = (
  deliverable: PhotoVideoDeliverableConfiguration,
  quantity: number,
  coverageHours: number
) => {
  if (deliverable.pricingMode === 'included') return 0
  if (deliverable.pricingMode === 'per_hour') return deliverable.price * coverageHours * quantity
  return deliverable.price * quantity
}

export const calculatePhotoVideoSelectionPrice = (
  configuration: PhotoVideoBookingConfiguration,
  selectionValue: unknown,
  commissionRate: number
): PhotoVideoPriceCalculation => {
  const selection = normalizePhotoVideoSelection(selectionValue)
  const selectedPackage = configuration.packages.find((pkg) => pkg.id === selection.packageId)
  const coverage = configuration.coverageConfigurations.find((item) => item.id === selection.coverageConfigurationId)
  const isPackage = selection.selectionMethod === 'package' && Boolean(selectedPackage)
  const coverageHours = (isPackage
    ? configuration.coverageConfigurations.find((item) => item.id === selectedPackage?.coverageConfigurationId)?.durationHours
    : coverage?.durationHours) ?? 0
  const packageDeliverableIds = new Set(isPackage ? selectedPackage?.deliverableIds ?? [] : [])
  const lineItems: PhotoVideoPriceCalculation['lineItems'] = []
  const add = (label: string, providerAmount: number) => {
    if (providerAmount > 0) lineItems.push({ label, providerAmount })
  }

  if (isPackage && selectedPackage) add(selectedPackage.name, selectedPackage.price)
  else if (coverage) add(coverage.name, coverage.price)

  selection.additionalCrew.forEach((entry) => {
    const option = configuration.additionalCrewOptions.find((item) => item.id === entry.optionId)
    if (!option || (isPackage && !selectedPackage?.allowedAdditionalCrewOptionIds.includes(option.id))) return
    add(`${option.role} × ${entry.quantity}`, option.price * entry.quantity * (option.pricingUnit === 'hour' ? coverageHours : 1))
  })
  selection.deliverables.forEach((entry) => {
    const deliverable = configuration.deliverables.find((item) => item.id === entry.deliverableId)
    if (!deliverable || packageDeliverableIds.has(deliverable.id)) return
    add(`${deliverable.name} × ${entry.quantity}`, priceForDeliverable(deliverable, entry.quantity, coverageHours))
  })
  selection.additionalServices.forEach((entry) => {
    const service = configuration.additionalServices.find((item) => item.id === entry.serviceId)
    if (!service || (isPackage && !selectedPackage?.allowedAdditionalServiceIds.includes(service.id))) return
    const multiplier = service.pricingUnit === 'hour' ? coverageHours : entry.quantity
    add(`${service.name}${entry.quantity > 1 ? ` × ${entry.quantity}` : ''}`, service.price * multiplier)
  })
  if (configuration.supportsAdditionalHours && selection.additionalHours > 0) {
    add(`Additional coverage hours × ${selection.additionalHours}`, configuration.additionalHourRate * selection.additionalHours)
  }
  if (configuration.allowsMultipleLocations && selection.coverageLocations.length > 1) {
    add(`Additional coverage locations × ${selection.coverageLocations.length - 1}`, configuration.additionalLocationFee * (selection.coverageLocations.length - 1))
  }
  selection.rushEditingOptionIds.forEach((id) => {
    const option = configuration.postProduction?.rushEditingOptions.find((item) => item.id === id && item.isAvailable)
    if (option) add('Rush editing', option.additionalCharge)
  })
  const providerTotal = lineItems.reduce((total, item) => total + item.providerAmount, 0)
  return { clientTotal: customerPriceFromProviderPrice(providerTotal, commissionRate), lineItems, providerTotal }
}

export const validatePhotoVideoSelection = (
  configuration: PhotoVideoBookingConfiguration,
  selectionValue: unknown
) => {
  const selection = normalizePhotoVideoSelection(selectionValue)
  if (selection.selectionMethod === 'package') {
    const selectedPackage = configuration.packages.find((pkg) => pkg.id === selection.packageId)
    if (!selectedPackage) return 'Choose a provider package.'
    if (selection.additionalCrew.reduce((total, item) => total + item.quantity, 0) > selectedPackage.maximumAdditionalCrew) {
      return 'This package allows fewer additional crew members.'
    }
    if (selection.deliverables.filter((item) => !selectedPackage.deliverableIds.includes(item.deliverableId)).length
      > selectedPackage.maximumAdditionalDeliverables) {
      return 'This package allows fewer additional deliverables.'
    }
    if (selection.additionalHours > selectedPackage.maximumCoverageExtensionHours) {
      return 'This package does not allow that many additional coverage hours.'
    }
    if (selection.coverageLocations.length > selectedPackage.includedLocationCount && !configuration.allowsMultipleLocations) {
      return 'This package does not support additional coverage locations.'
    }
  } else if (!configuration.coverageConfigurations.some((item) => item.id === selection.coverageConfigurationId)) {
    return 'Choose a provider coverage option.'
  }
  if (!configuration.allowsMultipleLocations && selection.coverageLocations.length > 1) {
    return 'This provider does not support multiple coverage locations.'
  }
  if (selection.additionalHours > 0 && (!configuration.supportsAdditionalHours
    || selection.additionalHours > configuration.maximumAdditionalHours)) {
    return 'Requested additional coverage hours are not supported by this provider.'
  }
  return ''
}
