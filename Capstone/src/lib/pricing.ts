export const DEFAULT_COMMISSION_RATE = 0.05
export const DEFAULT_INITIAL_PAYMENT_RATE = 0.4
export const DEFAULT_PROVIDER_INITIAL_RATE = 0.3

const toCents = (value: number) => Math.round(Math.max(0, value) * 100)
const fromCents = (value: number) => Math.round(value) / 100

export const normalizeCommissionRate = (
  value: unknown,
  fallback = DEFAULT_COMMISSION_RATE
) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

export const commissionFromProviderPrice = (providerPrice: number, rate: number) =>
  fromCents(toCents(providerPrice) * normalizeCommissionRate(rate))

export const customerPriceFromProviderPrice = (providerPrice: number, rate: number) => {
  const providerCents = toCents(providerPrice)
  const commissionCents = toCents(commissionFromProviderPrice(providerPrice, rate))
  return fromCents(providerCents + commissionCents)
}

export interface PaymentBreakdownItem {
  commissionAmount?: number
  price?: number
  providerPrice: number
}

export interface PaymentBreakdown {
  clientTotal: number
  heldUnallocatedAmount: number
  initialPayment: number
  platformFee: number
  providerBalance: number
  providerInitialAllocation: number
  remainingClientBalance: number
  serviceSubtotal: number
}

/**
 * Central Phase 5 payment calculation. Integer cents keep the 40/30/5 split
 * reconcilable even when an order contains several independently rounded
 * provider services.
 */
export const calculatePaymentBreakdown = (
  items: PaymentBreakdownItem[],
  initialPaymentRate = DEFAULT_INITIAL_PAYMENT_RATE,
  providerInitialRate = DEFAULT_PROVIDER_INITIAL_RATE
): PaymentBreakdown => {
  const serviceSubtotalCents = items.reduce(
    (total, item) => total + toCents(item.providerPrice),
    0
  )
  const platformFeeCents = items.reduce((total, item) => {
    if (Number.isFinite(item.commissionAmount)) {
      return total + toCents(item.commissionAmount ?? 0)
    }
    return total + Math.max(0, toCents(item.price ?? 0) - toCents(item.providerPrice))
  }, 0)
  const initialPaymentCents = Math.round(serviceSubtotalCents * initialPaymentRate)
  const providerInitialCents = Math.round(serviceSubtotalCents * providerInitialRate)
  const clientTotalCents = serviceSubtotalCents + platformFeeCents

  return {
    clientTotal: fromCents(clientTotalCents),
    heldUnallocatedAmount: fromCents(
      Math.max(0, initialPaymentCents - providerInitialCents - platformFeeCents)
    ),
    initialPayment: fromCents(initialPaymentCents),
    platformFee: fromCents(platformFeeCents),
    providerBalance: fromCents(Math.max(0, serviceSubtotalCents - providerInitialCents)),
    providerInitialAllocation: fromCents(providerInitialCents),
    remainingClientBalance: fromCents(Math.max(0, clientTotalCents - initialPaymentCents)),
    serviceSubtotal: fromCents(serviceSubtotalCents),
  }
}
