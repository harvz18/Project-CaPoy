const MONEY_DECIMAL_PLACES = 2;

/**
 * Keeps a money input safe to persist as a decimal string. Cents are supported,
 * but exponent notation, signs, letters, and extra decimal separators are not.
 */
export function sanitizeMoneyInput(value: string) {
  const numericCharacters = value.replace(/[^\d.]/g, "");
  const [wholePart = "", ...decimalParts] = numericCharacters.split(".");

  if (decimalParts.length === 0) {
    return wholePart;
  }

  return `${wholePart || "0"}.${decimalParts.join("").slice(0, MONEY_DECIMAL_PLACES)}`;
}

export function isValidMoneyAmount(value: string) {
  const normalized = value.trim();
  return /^\d+(?:\.\d{1,2})?$/.test(normalized)
    && Number.isFinite(Number(normalized))
    && Number(normalized) > 0;
}

export function sanitizeWholeNumberInput(value: string) {
  return value.replace(/\D/g, "");
}

export function sanitizeDurationInput(value: string, minimum = 1, maximum = 365) {
  const wholeNumber = sanitizeWholeNumberInput(value);
  if (!wholeNumber) return "";

  const parsed = Number(wholeNumber);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.min(maximum, Math.max(minimum, parsed)));
}

/**
 * Allows a phone number to retain its optional international prefix while
 * rejecting letters and other non-phone characters. Authentication remains
 * responsible for country-specific normalization.
 */
export function sanitizePhoneNumberInput(value: string) {
  const allowedCharacters = value.replace(/[^\d+\s()-]/g, "");
  const withoutExtraPrefixes = allowedCharacters.replace(/(?!^)\+/g, "");
  return withoutExtraPrefixes.slice(0, 24);
}
