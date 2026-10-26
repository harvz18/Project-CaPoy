export type PhotoVideoPackageDraft = {
  allowedAdditionalCrewOptionIds: string[]
  allowedAdditionalServiceIds: string[]
  coverageConfigurationId: string
  deliverableIds: string[]
  description: string
  eventTypes: string[]
  id?: string
  imageUrls: string[]
  includedLocationCount: number
  isActive: boolean
  maximumAdditionalCrew: number
  maximumAdditionalDeliverables: number
  maximumCoverageExtensionHours: number
  name: string
  price: number
}

export type PhotoVideoPackageConfiguration = Omit<PhotoVideoPackageDraft, 'id' | 'imageUrls'> & {
  kind: 'photo_video'
}

const record = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
)
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const list = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  : []
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const photoVideoPackageDraftsFrom = (value: unknown): PhotoVideoPackageDraft[] => {
  const details = record(value)
  const packages = Array.isArray(details.photoVideoPackages) ? details.photoVideoPackages.map(record) : []
  return packages.map((item) => ({
    allowedAdditionalCrewOptionIds: list(item.allowedAdditionalCrewOptionIds),
    allowedAdditionalServiceIds: list(item.allowedAdditionalServiceIds),
    coverageConfigurationId: text(item.coverageConfigurationId),
    deliverableIds: list(item.deliverableIds),
    description: text(item.description),
    eventTypes: list(item.eventTypes),
    id: text(item.id) || undefined,
    imageUrls: list(item.imageUrls),
    includedLocationCount: Math.max(1, Math.floor(number(item.includedLocationCount) || 1)),
    isActive: item.isActive !== false,
    maximumAdditionalCrew: Math.max(0, Math.floor(number(item.maximumAdditionalCrew))),
    maximumAdditionalDeliverables: Math.max(0, Math.floor(number(item.maximumAdditionalDeliverables))),
    maximumCoverageExtensionHours: Math.max(0, number(item.maximumCoverageExtensionHours)),
    name: text(item.name),
    price: Math.max(0, number(item.price)),
  }))
}

export const photoVideoPackageConfigurationFrom = (
  value: PhotoVideoPackageDraft
): PhotoVideoPackageConfiguration => ({
  allowedAdditionalCrewOptionIds: value.allowedAdditionalCrewOptionIds,
  allowedAdditionalServiceIds: value.allowedAdditionalServiceIds,
  coverageConfigurationId: value.coverageConfigurationId,
  deliverableIds: value.deliverableIds,
  description: value.description,
  eventTypes: value.eventTypes,
  includedLocationCount: value.includedLocationCount,
  isActive: value.isActive,
  kind: 'photo_video',
  maximumAdditionalCrew: value.maximumAdditionalCrew,
  maximumAdditionalDeliverables: value.maximumAdditionalDeliverables,
  maximumCoverageExtensionHours: value.maximumCoverageExtensionHours,
  name: value.name,
  price: value.price,
})

export const isPhotoVideoPackageConfiguration = (value: unknown) =>
  record(value).kind === 'photo_video'
