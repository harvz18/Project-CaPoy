import type { CategoryBudgetAllocation } from '../screens/05-BudgetAllocation'
import type { CatalogCategoryId } from './catalog'

export interface PlanningSelectionAmount {
  categoryId: CatalogCategoryId
  price: number
}

const toCurrency = (value: number) => Math.round(Math.max(0, value) * 100) / 100

const categoryKeyById = new Map(
  [
    ['venues', 'venue'],
    ['catering', 'catering'],
    ['eventOrganizers', 'eventOrganizer'],
    ['photography', 'photoVideo'],
    ['attire', 'gownRental'],
    ['hosts', 'hostEmcee'],
    ['soundLights', 'soundLights'],
    ['florists', 'floral'],
  ] as const
)

/**
 * Calculates the amount not yet committed to a category.  A selected service
 * supersedes its previous category allocation, mirroring the server-side lock
 * that stores its marketplace (client-facing) price.  This makes a released
 * allocation appear once only, including during the refresh immediately after
 * a selection is saved.
 */
export const calculateUnallocatedPlanningBudget = (
  totalBudget: number,
  allocations: ReadonlyArray<CategoryBudgetAllocation>,
  selections: ReadonlyArray<PlanningSelectionAmount>
) => {
  const selectedAmountsByKey = new Map<string, number>()
  selections.forEach((selection) => {
    const categoryKey = categoryKeyById.get(selection.categoryId)
    if (categoryKey) selectedAmountsByKey.set(categoryKey, toCurrency(selection.price))
  })

  const knownKeys = new Set<string>()
  let committedTotal = 0

  allocations.forEach((allocation) => {
    knownKeys.add(allocation.categoryKey)
    committedTotal += selectedAmountsByKey.get(allocation.categoryKey)
      ?? toCurrency(allocation.amount)
  })

  selectedAmountsByKey.forEach((amount, categoryKey) => {
    if (!knownKeys.has(categoryKey)) committedTotal += amount
  })

  return toCurrency(Math.max(0, toCurrency(totalBudget) - toCurrency(committedTotal)))
}

export const calculateCategoryBudgetMaximum = (
  currentCategoryAllocation: number,
  unallocatedBudget: number
) => toCurrency(Math.max(0, currentCategoryAllocation) + Math.max(0, unallocatedBudget))
