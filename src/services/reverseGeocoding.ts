import type { MapCoordinate } from "../components/LocationMap.types";
import { AddressDetails, normalizeAddressDetails } from "../utils/address";

export type ReverseGeocodeResult = {
  formattedAddress: string;
  details: AddressDetails;
  provider: "OpenStreetMap Nominatim";
};

export type AddressSearchResult = ReverseGeocodeResult & {
  coordinate: MapCoordinate;
};

type NominatimResponse = {
  display_name?: unknown;
  address?: Record<string, unknown>;
};

type NominatimSearchResponse = NominatimResponse & {
  lat?: unknown;
  lon?: unknown;
};

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const MIN_REQUEST_INTERVAL_MS = 1100;
const cache = new Map<string, ReverseGeocodeResult>();
let requestTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/**
 * A deliberately narrow, user-triggered lookup for a single selected pin.
 * There is no autocomplete, background querying, or persistent provider-data
 * cache. See the Nominatim policy before expanding this feature.
 */
export function reverseGeocodeSelectedPin(coordinate: MapCoordinate) {
  if (!isValidCoordinate(coordinate)) {
    return Promise.reject(new Error("Choose a valid map location first."));
  }
  const cacheKey = `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
  const cached = cache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const run = queueNominatimRequest(async () => {
    const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(String(coordinate.latitude))}&lon=${encodeURIComponent(String(coordinate.longitude))}`;
    const response = await fetch(url, { headers: nominatimHeaders() });
    if (!response.ok) throw new Error("Address lookup is unavailable. Enter the address manually.");
    const result = parseNominatimReverseResponse(await response.json());
    if (!result) throw new Error("No address was found for that pin. Enter the address manually.");
    cache.set(cacheKey, result);
    return result;
  });

  requestTail = run.catch(() => undefined);
  return run;
}

/** A deliberate, user-submitted search; no type-ahead or background querying. */
export function searchAddressOnMap(query: string) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 3) {
    return Promise.reject(new Error("Enter at least 3 characters to search the map."));
  }
  if (normalizedQuery.length > 200) {
    return Promise.reject(new Error("Keep the map search under 200 characters."));
  }

  return queueNominatimRequest(async () => {
    const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(normalizedQuery)}`;
    const response = await fetch(url, { headers: nominatimHeaders() });
    if (!response.ok) throw new Error("Map search is unavailable. Try again or place a pin manually.");
    const value = await response.json();
    if (!Array.isArray(value)) return [];
    return value
      .map(parseNominatimSearchResponse)
      .filter((result): result is AddressSearchResult => Boolean(result));
  });
}

export function parseNominatimReverseResponse(value: unknown): ReverseGeocodeResult | undefined {
  const response = value as NominatimResponse;
  const address = response?.address;
  const formattedAddress = typeof response?.display_name === "string" ? response.display_name.trim() : "";
  if (!address || !formattedAddress) return undefined;

  const field = (...keys: string[]) => {
    for (const key of keys) {
      const value = address[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return undefined;
  };
  const namedBarangay = Object.values(address).find((value): value is string => typeof value === "string" && /\bbarangay\b/i.test(value));
  const barangay = field("barangay")
    ?? namedBarangay
    ?? field("village", "suburb", "neighbourhood", "quarter");
  return {
    formattedAddress,
    details: normalizeAddressDetails({
      houseNumber: field("house_number"),
      street: field("road", "pedestrian", "footway"),
      barangay,
      city: field("city", "town", "municipality", "county"),
      province: field("state", "region"),
      postalCode: field("postcode")
    }),
    provider: "OpenStreetMap Nominatim"
  };
}

export function parseNominatimSearchResponse(value: unknown): AddressSearchResult | undefined {
  const response = value as NominatimSearchResponse;
  const parsed = parseNominatimReverseResponse(response);
  const latitude = typeof response?.lat === "string" || typeof response?.lat === "number" ? Number(response.lat) : Number.NaN;
  const longitude = typeof response?.lon === "string" || typeof response?.lon === "number" ? Number(response.lon) : Number.NaN;
  if (!parsed || !isValidCoordinate({ latitude, longitude })) return undefined;
  return { ...parsed, coordinate: { latitude, longitude } };
}

function queueNominatimRequest<T>(operation: () => Promise<T>) {
  const run = requestTail.then(async () => {
    const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await delay(wait);
    lastRequestAt = Date.now();
    return operation();
  });
  requestTail = run.catch(() => undefined);
  return run;
}

function nominatimHeaders() {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Browsers provide their normal Referer. Native requests need an app name.
  if (!isWebRuntime()) headers["User-Agent"] = "TaskLink-Capstone/1.0";
  return headers;
}

function isValidCoordinate({ latitude, longitude }: MapCoordinate) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isWebRuntime() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
