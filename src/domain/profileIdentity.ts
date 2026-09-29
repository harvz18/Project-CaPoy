import type { IdentityStatus, UserProfile } from "../types";

const MIN_FULL_NAME_LENGTH = 2;
const MAX_FULL_NAME_LENGTH = 100;
const MIN_ADDRESS_LENGTH = 3;
const MAX_ADDRESS_LENGTH = 200;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function normalizeSingleLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function assertSafeSingleLine(value: string, label: string, minimum: number, maximum: number) {
  if (value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum} characters.`);
  }
  if (CONTROL_CHARACTERS.test(value)) {
    throw new Error(`${label} contains unsupported control characters.`);
  }
}

export function normalizeFullName(value: string) {
  const normalized = normalizeSingleLine(value);
  assertSafeSingleLine(normalized, "Full name", MIN_FULL_NAME_LENGTH, MAX_FULL_NAME_LENGTH);
  return normalized;
}

export function normalizeAddress(value: string) {
  const normalized = normalizeSingleLine(value);
  assertSafeSingleLine(normalized, "Address", MIN_ADDRESS_LENGTH, MAX_ADDRESS_LENGTH);
  return normalized;
}

export function initialIdentityStatus(role: "worker" | "client"): IdentityStatus {
  return role === "worker" ? "Pending Approval" : "Unverified";
}

export function isIdentityLocked(
  profile: Pick<UserProfile, "identityStatus" | "identityLockedAt" | "verificationStatus"> | null | undefined
) {
  return Boolean(
    profile &&
    (profile.identityStatus === "Approved" || profile.identityLockedAt || profile.verificationStatus === "Verified")
  );
}
