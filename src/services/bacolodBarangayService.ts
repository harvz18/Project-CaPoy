import AsyncStorage from "@react-native-async-storage/async-storage";

const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const cacheKey = "tasklink:bacolod-barangays:v1";
const cacheMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
const endpointTimeoutMs = 3_500;
let refreshInFlight: Promise<string[]> | undefined;
let memoryCache: BarangayCache | undefined;

type OverpassElement = { tags?: { name?: unknown; "name:en"?: unknown } };
type BarangayCache = { barangays: string[]; fetchedAt: number };

const bacolodBarangayQuery = `
[out:json][timeout:25];
relation(11349321)->.bacolod;
map_to_area.bacolod->.bacolodArea;
relation["boundary"="administrative"]["admin_level"="10"](area.bacolodArea);
out tags;
`;

export function normalizeBacolodBarangayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return "";
  return /^barangay\b/i.test(name) ? name : `Barangay ${name}`;
}

export function parseBacolodBarangays(payload: unknown) {
  const elements = Array.isArray((payload as { elements?: unknown })?.elements)
    ? (payload as { elements: OverpassElement[] }).elements
    : [];
  return [...new Set(elements
    .map((element) => typeof element.tags?.name === "string" ? element.tags.name : element.tags?.["name:en"])
    .filter((name): name is string => typeof name === "string")
    .map(normalizeBacolodBarangayName)
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

function isBarangayCache(value: unknown): value is BarangayCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<BarangayCache>;
  return Number.isFinite(cache.fetchedAt) && Array.isArray(cache.barangays) && cache.barangays.every((item) => typeof item === "string");
}

export async function getCachedBacolodBarangays() {
  if (memoryCache) return memoryCache;
  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (!stored) return undefined;
    const parsed: unknown = JSON.parse(stored);
    if (!isBarangayCache(parsed) || !parsed.barangays.length) return undefined;
    memoryCache = parsed;
    return parsed;
  } catch {
    return undefined;
  }
}

function isFresh(cache: BarangayCache) {
  return Date.now() - cache.fetchedAt < cacheMaxAgeMs;
}

async function saveCachedBacolodBarangays(barangays: string[]) {
  const cache = { barangays, fetchedAt: Date.now() };
  memoryCache = cache;
  await AsyncStorage.setItem(cacheKey, JSON.stringify(cache)).catch(() => undefined);
  return barangays;
}

/** Fetches the currently mapped Bacolod barangay boundaries; no hardcoded list is bundled. */
export async function fetchBacolodBarangays(fetcher: typeof fetch = fetch) {
  for (const endpoint of overpassEndpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpointTimeoutMs);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(bacolodBarangayQuery)}`,
        signal: controller.signal
      });
      if (!response.ok) continue;
      const barangays = parseBacolodBarangays(await response.json());
      if (barangays.length) return barangays;
    } catch {
      // Try the next independent OpenStreetMap Overpass service.
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Bacolod barangays could not be loaded. Check your connection and try again.");
}

export async function refreshBacolodBarangays() {
  if (!refreshInFlight) {
    refreshInFlight = fetchBacolodBarangays()
      .then(saveCachedBacolodBarangays)
      .finally(() => { refreshInFlight = undefined; });
  }
  return refreshInFlight;
}

/** Returns the cached live list immediately and refreshes it in the background when stale. */
export async function loadBacolodBarangays() {
  const cached = await getCachedBacolodBarangays();
  if (cached) {
    if (!isFresh(cached)) void refreshBacolodBarangays().catch(() => undefined);
    return cached.barangays;
  }
  return refreshBacolodBarangays();
}
