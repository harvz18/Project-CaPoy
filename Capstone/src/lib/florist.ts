// Shared, serializable contract for the florist configuration introduced in
// V17. Provider and client screens will use this in later phases; keeping the
// values explicit now prevents category-details JSON from becoming a second,
// unvalidated source of booking data.

export type FloristArrangementPricingUnit =
  | 'piece'
  | 'pair'
  | 'set'
  | 'table'
  | 'installation'
  | 'fixed'

export type FloristCustomizationSelectionType =
  | 'single'
  | 'multiple'
  | 'quantity'
  | 'text'
  | 'image'

export type FloristPriceModifierType =
  | 'fixed'
  | 'per_unit'
  | 'per_selection'
  | 'included'

export type FloristFulfillmentKind = 'pickup' | 'delivery' | 'delivery_with_setup' | 'installation' | 'post_event_removal'

export type FloristFulfillmentDraft = {
  coverageDetails?: string
  description?: string
  fulfillmentKind: FloristFulfillmentKind
  id?: string
  isActive: boolean
  name: string
  price: number
}

export type FloristArrangementDraft = {
  basePrice: number
  category: string
  description: string
  id?: string
  imageUrls: string[]
  isActive: boolean
  maximumQuantity?: number
  minimumQuantity: number
  name: string
  pricingUnit: FloristArrangementPricingUnit
  customizationGroups: FloristCustomizationGroupDraft[]
}

export type FloristCustomizationOptionDraft = {
  id?: string
  isActive: boolean
  name: string
  priceModifier: number
  priceModifierType: FloristPriceModifierType
}

export type FloristCustomizationGroupDraft = {
  id?: string
  isActive: boolean
  isRequired: boolean
  maximumSelections?: number
  minimumSelections: number
  name: string
  options: FloristCustomizationOptionDraft[]
  selectionType: FloristCustomizationSelectionType
}

export type FloristPackageDraft = {
  addOns: Array<{ arrangementId?: string; id?: string; isActive: boolean; name: string; price: number; pricingUnit: FloristArrangementPricingUnit }>
  description: string
  id?: string
  inclusions: string[]
  isActive: boolean
  items: Array<{ arrangementId: string; customizationAllowed: boolean; quantity: number }>
  name: string
  price: number
}

export type FloristOptionSelectionSnapshot = {
  optionId: string
  quantity?: number
  value?: string
}

export type FloristArrangementSelectionSnapshot = {
  arrangementId: string
  quantity: number
  selectedOptions: FloristOptionSelectionSnapshot[]
}

// This snapshot is deliberately independent of live provider configuration.
// Once copied to a selection or booking it can describe what the client chose
// even if the provider later changes, archives, or reprices an arrangement.
export type FloristSelectionSnapshot = {
  schemaVersion: 1
  fulfillmentOptionId?: string
  packageId?: string
  selectedArrangements: FloristArrangementSelectionSnapshot[]
}

export const isFloristSelectionSnapshot = (value: unknown): value is FloristSelectionSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const snapshot = value as Record<string, unknown>
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.selectedArrangements)) return false

  return snapshot.selectedArrangements.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const arrangement = item as Record<string, unknown>
    return typeof arrangement.arrangementId === 'string'
      && arrangement.arrangementId.trim().length > 0
      && typeof arrangement.quantity === 'number'
      && Number.isFinite(arrangement.quantity)
      && arrangement.quantity > 0
      && Array.isArray(arrangement.selectedOptions)
  })
}
