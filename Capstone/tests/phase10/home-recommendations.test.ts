import assert from 'node:assert/strict'
import test from 'node:test'

import { rankHomeRecommendations } from '../../src/lib/home-recommendations.ts'
import type { CatalogService } from '../../src/lib/catalog.ts'

const service = (overrides: Partial<CatalogService>): CatalogService => ({
  categoryId: 'catering',
  categoryName: 'Catering',
  commissionRate: 0.05,
  description: '',
  detail: 'Catering',
  id: overrides.id ?? 'service',
  imageLabel: 'Service image',
  imageUrl: '',
  minPrice: 1_000,
  name: overrides.name ?? 'Service',
  providerMinPrice: 950,
  providerName: 'Provider',
  rating: 'New',
  reviewCount: 0,
  tags: [],
  ...overrides,
})

test('established positive reviews outrank a one-review five-star service when popularity is equal', () => {
  const ranked = rankHomeRecommendations([
    service({ id: 'single', name: 'Single review', rating: '5.0', reviewCount: 1 }),
    service({ id: 'established', name: 'Established', rating: '4.6', reviewCount: 18 }),
  ])

  assert.deepEqual(ranked.map((item) => item.service.id), ['established', 'single'])
})

test('valid booking history is the primary recommendation signal and mock/coordinator records are excluded', () => {
  const ranked = rankHomeRecommendations([
    service({ id: 'popular', bookingCount: 12, rating: '4.2', reviewCount: 4 }),
    service({ id: 'rated', bookingCount: 1, rating: '4.9', reviewCount: 30 }),
    service({ id: 'mock', bookingCount: 100, isMock: true }),
    service({ id: 'coordinator', bookingCount: 100, kind: 'coordinator' }),
  ])

  assert.deepEqual(ranked.map((item) => item.service.id), ['popular', 'rated'])
  assert.equal(ranked[0]?.indicator, 'Popular choice')
})

test('eligible live services remain visible when booking and review data is insufficient', () => {
  const ranked = rankHomeRecommendations([
    service({ id: 'new-a', name: 'A new service' }),
    service({ id: 'new-b', name: 'B new service' }),
  ])

  assert.equal(ranked.length, 2)
  assert.ok(ranked.every((item) => item.indicator === 'New service'))
})

test('processed review sentiment is a bounded tie-breaker for otherwise equal services', () => {
  const ranked = rankHomeRecommendations([
    service({
      id: 'negative',
      name: 'Negative feedback',
      rating: '4.5',
      reviewCount: 8,
      negativeSentimentCount: 5,
    }),
    service({
      id: 'positive',
      name: 'Positive feedback',
      rating: '4.5',
      reviewCount: 8,
      positiveSentimentCount: 5,
    }),
  ])

  assert.deepEqual(ranked.map((item) => item.service.id), ['positive', 'negative'])
  assert.equal(ranked[0]?.indicator, 'Positive feedback')
})
