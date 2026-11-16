export const defaultServiceFeeBasisPoints = 500;

export function moneyToCentavos(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return undefined;
  const [whole, decimal = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number((decimal + "00").slice(0, 2));
}

export function formatCentavos(value: number) { return `₱${(value / 100).toFixed(2)}`; }

export function estimateServiceFee(wage: string, rateBasisPoints = defaultServiceFeeBasisPoints) {
  const workerWageCentavos = moneyToCentavos(wage);
  if (!workerWageCentavos || workerWageCentavos <= 0) return undefined;
  const feeCentavos = Math.floor((workerWageCentavos * rateBasisPoints + 5_000) / 10_000);
  return { workerWageCentavos, feeCentavos, totalCentavos: workerWageCentavos + feeCentavos, rateBasisPoints };
}
