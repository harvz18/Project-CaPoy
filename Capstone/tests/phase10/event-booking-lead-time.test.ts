import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isEventDateBookable,
  minimumEventBookingDate,
} from '../../src/lib/event-booking-lead-time.ts'

test('event booking lead time uses seven Manila calendar days, not a 168-hour countdown', () => {
  // 00:30 on November 8 in Manila, despite still being November 7 in UTC.
  const manilaToday = new Date('2026-11-07T16:30:00.000Z')
  const minimum = minimumEventBookingDate(manilaToday)

  assert.equal(minimum.getFullYear(), 2026)
  assert.equal(minimum.getMonth(), 10)
  assert.equal(minimum.getDate(), 15)
  assert.equal(isEventDateBookable('2026-11-08', manilaToday), false)
  assert.equal(isEventDateBookable('2026-11-14', manilaToday), false)
  assert.equal(isEventDateBookable('2026-11-15', manilaToday), true)
  assert.equal(isEventDateBookable('2026-11-16', manilaToday), true)
})
