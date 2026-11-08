/**
 * GCash direct-payment helpers. These validate receiving details only; TaskLink
 * never connects to, opens, or verifies a GCash payment provider.
 */
export function normalizePhilippineMobileNumber(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (/^09\d{9}$/.test(compact)) return compact;
  // Older TaskLink profiles may have been saved as a 10-digit local number
  // without the leading zero. Present and persist it in GCash's local form.
  if (/^9\d{9}$/.test(compact)) return `0${compact}`;
  if (/^\+639\d{9}$/.test(compact)) return `0${compact.slice(3)}`;
  if (/^639\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return undefined;
}

export function formatPhilippineMobileNumber(value?: string) {
  const normalized = value ? normalizePhilippineMobileNumber(value) : undefined;
  if (!normalized) return value ?? "";
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
}
