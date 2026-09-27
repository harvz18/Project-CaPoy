export const DEFAULT_COMMISSION_RATE = 0.1

export const normalizeCommissionRate = (
  value: unknown,
  fallback = DEFAULT_COMMISSION_RATE
) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

export const commissionFromProviderPrice = (providerPrice: number, rate: number) =>
  Math.round(Math.max(0, providerPrice) * normalizeCommissionRate(rate) * 100) / 100

export const customerPriceFromProviderPrice = (providerPrice: number, rate: number) => {
  const safeProviderPrice = Math.max(0, providerPrice)
  return Math.round(
    (safeProviderPrice + commissionFromProviderPrice(safeProviderPrice, rate)) * 100
  ) / 100
}
