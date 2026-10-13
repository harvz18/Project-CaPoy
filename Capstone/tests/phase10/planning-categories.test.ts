import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getActivePlanningCategories,
  getFirstPlanningCategory,
  getFirstServicePlanningCategory,
  getNextUnselectedServicePlanningCategory,
  getUnallocatedPlanningCategoryCount,
  PLANNING_CATEGORY_PRIORITY,
} from '../../src/lib/planning-categories.ts'

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
  assert.equal(getUnallocatedPlanningCategoryCount(allocations), 4)
})
