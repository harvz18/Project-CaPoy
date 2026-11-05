export const OTP_CODE_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Input-only helpers. They never verify a phone number or authenticate a user. */
export function sanitizeOtpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
}

export function isValidOtpCode(value: string) {
  return new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`).test(value);
}

export function getOtpResendRemainingSeconds(requestedAt: number | undefined, now = Date.now()) {
  if (!requestedAt || !Number.isFinite(requestedAt)) return 0;
  const elapsedSeconds = Math.max(0, Math.floor((now - requestedAt) / 1000));
  return Math.max(0, OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

export function canResendOtp(requestedAt: number | undefined, now = Date.now()) {
  return getOtpResendRemainingSeconds(requestedAt, now) === 0;
}
