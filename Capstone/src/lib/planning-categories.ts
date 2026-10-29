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

/**
 * A budget is considered configured only when the client has actually assigned
 * a positive amount to at least one category. An empty allocation list (or
 * legacy zero-value rows) means the client chose the no-budget marketplace,
 * not a zero-peso cap for every service.
 */
export const hasConfiguredCategoryBudgets = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => allocations.some((allocation) => Number.isFinite(allocation.amount) && allocation.amount > 0)

export const getActivePlanningCategories = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => PLANNING_CATEGORY_PRIORITY.filter((category) =>
  hasPositiveCategoryAllocation(allocations, category.categoryKey)
)

/**
 * Categories explicitly added from Choose Services remain part of the plan
 * even before the client assigns them money.  A zero-value row is therefore
 * meaningful here (unlike the positive-only list used for initial planning
 * progression).
 */
export const getConfiguredPlanningCategories = (
  allocations: ReadonlyArray<CategoryBudgetAllocation>
) => PLANNING_CATEGORY_PRIORITY.filter((category) =>
  allocations.some((allocation) => allocation.categoryKey === category.categoryKey)
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
  (category) => !allocations.some((allocation) => allocation.categoryKey === category.categoryKey)
).length
