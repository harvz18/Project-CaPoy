import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActivePlanningCategories,
  getConfiguredPlanningCategories,
  getFirstPlanningCategory,
  getFirstServicePlanningCategory,
  getNextUnselectedServicePlanningCategory,
  getUnallocatedPlanningCategoryCount,
  hasConfiguredCategoryBudgets,
  PLANNING_CATEGORY_PRIORITY,
} from '../../src/lib/planning-categories.ts'
import {
  calculateCategoryBudgetMaximum,
  calculateUnallocatedPlanningBudget,
} from '../../src/lib/planning-budget.ts'

const allocations = [
  { amount: 10_000, categoryKey: 'catering' as const, label: 'Catering' },
  { amount: 20_000, categoryKey: 'venue' as const, label: 'Venue' },
  { amount: 0, categoryKey: 'photoVideo' as const, label: 'Photography' },
  { amount: 5_000, categoryKey: 'floral' as const, label: 'Florists' },
  { amount: 8_000, categoryKey: 'eventOrganizer' as const, label: 'Coordinator' },
]

test('planning categories are limited to positive allocations in the shared priority order', () => {
  assert.deepEqual(
    getActivePlanningCategories(allocations).map((category) => category.categoryId),
    ['venues', 'catering', 'florists', 'eventOrganizers']
  )
  assert.equal(getFirstPlanningCategory(allocations), 'venues')
  assert.equal(getFirstServicePlanningCategory(allocations), 'venues')
})

test('automatic progression skips completed categories and the dedicated coordinator flow', () => {
  assert.equal(
    getNextUnselectedServicePlanningCategory(allocations, new Set(['venues'])),
    'catering'
  )
  assert.equal(
    getNextUnselectedServicePlanningCategory(
      allocations,
      new Set(['venues', 'catering', 'florists'])
    ), undefined)
})

test('the reusable priority contains each supported planning category once', () => {
  assert.equal(new Set(PLANNING_CATEGORY_PRIORITY.map((category) => category.categoryId)).size, 8)
  assert.equal(getUnallocatedPlanningCategoryCount(allocations), 3)
})

test('explicitly added zero-budget categories remain browsable without enabling a zero-peso cap', () => {
  assert.deepEqual(
    getConfiguredPlanningCategories(allocations).map((category) => category.categoryId),
    ['venues', 'catering', 'photography', 'florists', 'eventOrganizers']
  )
  assert.equal(hasConfiguredCategoryBudgets([{ amount: 0, categoryKey: 'catering', label: 'Catering' }]), false)
})

test('unallocated budget replaces a category allocation with the marketplace selection exactly once', () => {
  const priorAllocations = [
    { amount: 60_000, categoryKey: 'venue' as const, label: 'Venue' },
    { amount: 138_500, categoryKey: 'catering' as const, label: 'Catering' },
  ]

  const unallocated = calculateUnallocatedPlanningBudget(
    200_000,
    priorAllocations,
    [{ categoryId: 'venues', price: 19_000 }]
  )

  assert.equal(unallocated, 42_500)
  assert.equal(calculateCategoryBudgetMaximum(19_000, unallocated), 61_500)
})

test('unallocated budget retains decimal marketplace prices and does not double count after refresh', () => {
  const selections = [{ categoryId: 'catering' as const, price: 12_345.67 }]
  const initiallyAllocated = [{ amount: 20_000, categoryKey: 'catering' as const, label: 'Catering' }]
  const refreshedAllocation = [{ amount: 12_345.67, categoryKey: 'catering' as const, label: 'Catering' }]

  assert.equal(calculateUnallocatedPlanningBudget(30_000, initiallyAllocated, selections), 17_654.33)
  assert.equal(calculateUnallocatedPlanningBudget(30_000, refreshedAllocation, selections), 17_654.33)
})

test('removing a selected service returns its released category amount to the unallocated budget', () => {
  assert.equal(
    calculateUnallocatedPlanningBudget(
      75_000,
      [{ amount: 0, categoryKey: 'floral', label: 'Florist & Styling' }],
      []
    ),
    75_000
  )
})

test('an empty or zero-value allocation set is no-budget planning, not a zero-peso category cap', () => {
  assert.equal(hasConfiguredCategoryBudgets([]), false)
  assert.equal(hasConfiguredCategoryBudgets([
    { amount: 0, categoryKey: 'catering', label: 'Catering' },
  ]), false)
  assert.equal(hasConfiguredCategoryBudgets(allocations), true)
})
