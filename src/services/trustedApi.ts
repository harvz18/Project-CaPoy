import { auth } from "./firebase";

const configuredBaseUrl = process.env.EXPO_PUBLIC_ADMIN_API_BASE_URL?.trim().replace(/\/$/, "");
const baseUrl = configuredBaseUrl || "https://tasklink-admin-api.onrender.com";

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
