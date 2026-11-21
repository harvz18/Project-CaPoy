const LOCAL_PHILIPPINE_MOBILE = /^09\d{9}$/;
const E164_PHILIPPINE_MOBILE = /^\+639\d{9}$/;

/**
 * Converts only supported Philippine mobile-number formats to E.164.
 * Separators are accepted for entry convenience, but letters and other
 * formats are never silently converted to a different number.
 */
export function normalizePhilippineMobileNumber(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (LOCAL_PHILIPPINE_MOBILE.test(compact)) return `+63${compact.slice(1)}`;
  if (E164_PHILIPPINE_MOBILE.test(compact)) return compact;
  return undefined;
}

export function isPhilippineMobileNumber(value: string) {
  return Boolean(normalizePhilippineMobileNumber(value));
}

export function phoneVerificationErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";

  switch (code) {
    case "auth/invalid-verification-code":
    case "auth/invalid-verification-id":
      return "That verification code is invalid. Check the six digits and try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "This verification code has expired. Request a new code and try again.";
    case "auth/credential-already-in-use":
      return "This mobile number is already verified on another account. It cannot be linked here.";
    case "auth/provider-already-linked":
      return "This account already has a verified mobile number.";
    case "auth/too-many-requests":
      return "Too many verification attempts. Please wait before requesting another code.";
    case "auth/network-request-failed":
      return "Network unavailable. Check your connection and try again.";
    case "auth/invalid-phone-number":
      return "Enter a Philippine mobile number as 09XXXXXXXXX or +639XXXXXXXXX.";
    case "auth/operation-not-allowed":
      return "Phone verification is not enabled for this Firebase project.";
    case "auth/app-not-authorized":
      return "This app is not authorized for phone verification. Check the Android Firebase configuration.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Unable to verify this mobile number. Please try again.";
  }
}
