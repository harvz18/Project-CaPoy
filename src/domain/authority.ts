import type { Authority, Role } from "../types";

export function authorityFromClaims(claims: Record<string, unknown> | undefined): Authority {
  if (claims?.superadmin === true) return "superadmin";
  if (claims?.admin === true) return "admin";
  return "user";
}

export function resolveProfileAuthority(role: Role, claims: Record<string, unknown> | undefined): Authority {
  if (role !== "admin") return "user";
  return authorityFromClaims(claims);
}

export function isStaffAuthority(authority: Authority) {
  return authority === "admin" || authority === "superadmin";
}
