import { auth } from "./firebase";

const configuredBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL?.trim().replace(/\/$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!configuredBaseUrl) throw new Error("The administrator API is not configured.");
  if (!auth?.currentUser) throw new Error("Sign in to continue.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${configuredBaseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The administrator action could not be completed.");
  return body as T;
}

export function getAdminApi<T>(path: string) {
  return request<T>(path);
}

export function postAdminApi<T>(path: string, body: Record<string, unknown>) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}
