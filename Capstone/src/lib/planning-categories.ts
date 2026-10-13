import type { BudgetPriority, CategoryBudgetAllocation } from '../screens/05-BudgetAllocation'
import type { CatalogCategoryId } from './catalog'

/**
 * The single client-planning order. Keep this separate from the display order
 * used by the budget screen so every planning entry point follows the same
 * event-service progression.
 */
export const PLANNING_CATEGORY_PRIORITY: ReadonlyArray<{
  categoryId: CatalogCategoryId
  categoryKey: BudgetPriority
}> = [
  { categoryId: 'venues', categoryKey: 'venue' },
  { categoryId: 'catering', categoryKey: 'catering' },
  { categoryId: 'photography', categoryKey: 'photoVideo' },
  { categoryId: 'soundLights', categoryKey: 'soundLights' },
  { categoryId: 'florists', categoryKey: 'floral' },
  { categoryId: 'attire', categoryKey: 'gownRental' },
  { categoryId: 'hosts', categoryKey: 'hostEmcee' },
  // Coordinators retain their dedicated Phase 2 flow and are never selected
  // automatically as a normal service-selection step.
  { categoryId: 'eventOrganizers', categoryKey: 'eventOrganizer' },
]

export const hasPositiveCategoryAllocation = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>,
  categoryKey: BudgetPriority
) => allocations.some((allocation) => allocation.categoryKey === categoryKey && allocation.amount > 0)

export const getActivePlanningCategories = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => PLANNING_CATEGORY_PRIORITY.filter((category) =>
  hasPositiveCategoryAllocation(allocations, category.categoryKey)
)

export const getFirstPlanningCategory = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => getActivePlanningCategories(allocations)[0]?.categoryId

export const getFirstServicePlanningCategory = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => getActivePlanningCategories(allocations).find(
  (category) => category.categoryId !== 'eventOrganizers'
)?.categoryId

export const getNextUnselectedServicePlanningCategory = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>,
  selectedCategoryIds: ReadonlySet<CatalogCategoryId>
) => getActivePlanningCategories(allocations).find(
  (category) => category.categoryId !== 'eventOrganizers'
    && !selectedCategoryIds.has(category.categoryId)
)?.categoryId

export const getUnallocatedPlanningCategoryCount = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => PLANNING_CATEGORY_PRIORITY.filter(
  (category) => !hasPositiveCategoryAllocation(allocations, category.categoryKey)
).length
