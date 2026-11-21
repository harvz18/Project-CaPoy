import { auth } from "./firebase";

const configuredBaseUrl = process.env.EXPO_PUBLIC_ADMIN_API_BASE_URL?.trim().replace(/\/$/, "");
const baseUrl = configuredBaseUrl || "https://tasklink-admin-api.onrender.com";

async function publicRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof responseBody.error === "string" ? responseBody.error : "The request could not be completed.");
  return responseBody as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!auth?.currentUser) throw new Error("Sign in to continue.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request could not be completed.");
  return body as T;
}

export function getTrustedApi<T>(path: string) {
  return request<T>(path);
}

export function postTrustedApi<T>(path: string, body: Record<string, unknown>) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/**
 * This is deliberately limited to the anonymous phone-login preflight. It
 * receives no profile data and the server returns the same response for an
 * unknown and an unlinked number, preventing it from becoming an account
 * lookup API.
 */
export function postPhoneLoginPreflight<T>(phoneNumber: string) {
  return publicRequest<T>("/api/phone-login/eligible", { phoneNumber });
}

export function postPhoneLoginSession<T>(idToken: string) {
  return publicRequest<T>("/api/phone-login/session", { idToken });
}
