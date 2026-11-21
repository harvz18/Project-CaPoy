const LOCAL_PHILIPPINE_MOBILE = /^09\d{9}$/;
const E164_PHILIPPINE_MOBILE = /^\+639\d{9}$/;
const LEGACY_PHILIPPINE_MOBILE = /^9\d{9}$/;

function normalizePhilippineMobileNumber(value) {
  if (typeof value !== "string") return undefined;
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (LOCAL_PHILIPPINE_MOBILE.test(compact)) return `+63${compact.slice(1)}`;
  if (E164_PHILIPPINE_MOBILE.test(compact)) return compact;
  return undefined;
}

function normalizeStoredPhilippineMobileNumber(value) {
  const normalized = normalizePhilippineMobileNumber(value);
  if (normalized) return normalized;
  if (typeof value !== "string") return undefined;
  const compact = value.trim().replace(/[\s()-]/g, "");
  return LEGACY_PHILIPPINE_MOBILE.test(compact) ? `+63${compact}` : undefined;
}

function buildVerifiedPhoneUpdate(profileMobileNumber, authenticatedPhoneNumber, verifiedAt) {
  const profilePhone = normalizeStoredPhilippineMobileNumber(profileMobileNumber);
  const authenticatedPhone = normalizePhilippineMobileNumber(authenticatedPhoneNumber);
  if (!authenticatedPhone) throw new Error("Firebase has not verified a phone number for this account.");
  if (!profilePhone) throw new Error("The mobile number saved on this profile is not a supported Philippine mobile number.");
  if (profilePhone !== authenticatedPhone) throw new Error("Verify the same mobile number that is saved on this TaskLink profile.");
  return {
    phoneVerified: true,
    verifiedPhoneNumber: authenticatedPhone,
    phoneVerifiedAt: verifiedAt,
    updatedAt: verifiedAt
  };
}

function hasMatchingVerifiedPhone(profileMobileNumber, authenticatedPhoneNumber) {
  const profilePhone = normalizeStoredPhilippineMobileNumber(profileMobileNumber);
  const authenticatedPhone = normalizePhilippineMobileNumber(authenticatedPhoneNumber);
  return Boolean(profilePhone && authenticatedPhone && profilePhone === authenticatedPhone);
}

module.exports = { buildVerifiedPhoneUpdate, hasMatchingVerifiedPhone, normalizePhilippineMobileNumber, normalizeStoredPhilippineMobileNumber };
