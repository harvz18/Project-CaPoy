import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculatePaymentBreakdown,
  commissionFromProviderPrice,
  customerPriceFromProviderPrice,
  DEFAULT_COMMISSION_RATE,
  DEFAULT_INITIAL_PAYMENT_RATE,
  DEFAULT_PROVIDER_INITIAL_RATE,
  normalizeCommissionRate,
} from '../../src/lib/pricing.ts'

test('current default rates remain 5%, 35%, and 30%', () => {
  assert.equal(DEFAULT_COMMISSION_RATE, 0.05)
  assert.equal(DEFAULT_INITIAL_PAYMENT_RATE, 0.35)
  assert.equal(DEFAULT_PROVIDER_INITIAL_RATE, 0.3)
})

test('canonical PHP 100,000 example reconciles every financial bucket', () => {
  const breakdown = calculatePaymentBreakdown([
    { commissionAmount: 5_000, providerPrice: 100_000 },
  ])

  assert.deepEqual(breakdown, {
    clientTotal: 105_000,
    heldUnallocatedAmount: 0,
    initialPayment: 35_000,
    platformFee: 5_000,
    providerBalance: 70_000,
    providerInitialAllocation: 30_000,
    remainingClientBalance: 70_000,
    serviceSubtotal: 100_000,
  })
})

test('multi-provider totals use independently rounded service fees without double charging', () => {
  const providerPrices = [30_000, 40_000, 20_000, 10_000]
  const items = providerPrices.map((providerPrice) => ({
    commissionAmount: commissionFromProviderPrice(providerPrice, 0.05),
    price: customerPriceFromProviderPrice(providerPrice, 0.05),
    providerPrice,
  }))
  const breakdown = calculatePaymentBreakdown(items)

  assert.equal(breakdown.serviceSubtotal, 100_000)
  assert.equal(breakdown.platformFee, 5_000)
  assert.equal(breakdown.clientTotal, 105_000)
  assert.equal(breakdown.initialPayment, 35_000)
  assert.equal(breakdown.providerInitialAllocation, 30_000)
  assert.equal(breakdown.heldUnallocatedAmount, 0)
  assert.equal(breakdown.providerBalance, 70_000)
})

test('currency rounding stays cent-safe for fractional provider prices', () => {
  assert.equal(customerPriceFromProviderPrice(20_000, 0.05), 21_000)
  assert.equal(commissionFromProviderPrice(333.33, 0.05), 16.67)
  assert.equal(customerPriceFromProviderPrice(333.33, 0.05), 350)

  const breakdown = calculatePaymentBreakdown([
    { providerPrice: 333.33, price: 350 },
    { providerPrice: 666.67, price: 700 },
  ])

  assert.equal(breakdown.serviceSubtotal, 1_000)
  assert.equal(breakdown.platformFee, 50)
  assert.equal(breakdown.clientTotal, 1_050)
  assert.equal(breakdown.initialPayment, 350)
  assert.equal(breakdown.providerInitialAllocation, 300)
  assert.equal(breakdown.heldUnallocatedAmount, 0)
})

test('downpayment covers independently rounded 30% provider and 5% platform shares', () => {
  const breakdown = calculatePaymentBreakdown([
    { commissionAmount: 5.01, providerPrice: 100.15 },
  ])

  assert.equal(breakdown.providerInitialAllocation, 30.05)
  assert.equal(breakdown.platformFee, 5.01)
  assert.equal(breakdown.initialPayment, 35.06)
  assert.equal(breakdown.heldUnallocatedAmount, 0)
  assert.equal(breakdown.providerBalance, 70.1)
  assert.equal(breakdown.remainingClientBalance, 70.1)
})

test('invalid commission settings fall back to the current 5% rule', () => {
  assert.equal(normalizeCommissionRate(-1), 0.05)
  assert.equal(normalizeCommissionRate(1.01), 0.05)
  assert.equal(normalizeCommissionRate('not-a-number'), 0.05)
  assert.equal(normalizeCommissionRate('0.075'), 0.075)
})

test('negative input cannot create negative balances or revenue', () => {
  const breakdown = calculatePaymentBreakdown([
    { commissionAmount: -50, providerPrice: -1_000 },
  ])

  assert.deepEqual(breakdown, {
    clientTotal: 0,
    heldUnallocatedAmount: 0,
    initialPayment: 0,
    platformFee: 0,
    providerBalance: 0,
    providerInitialAllocation: 0,
    remainingClientBalance: 0,
    serviceSubtotal: 0,
  })
})
