import type { MapCoordinate } from "../components/LocationMap.types";
import { AddressDetails, normalizeAddressDetails } from "../utils/address";

export type ReverseGeocodeResult = {
  formattedAddress: string;
  details: AddressDetails;
  provider: "OpenStreetMap Nominatim";
};

type NominatimResponse = {
  display_name?: unknown;
  address?: Record<string, unknown>;
};

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
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

  const run = requestTail.then(async () => {
    const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await delay(wait);
    lastRequestAt = Date.now();

    const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&addressdetails=1&zoom=18&lat=${encodeURIComponent(String(coordinate.latitude))}&lon=${encodeURIComponent(String(coordinate.longitude))}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    // Browsers provide their normal Referer. Native requests need an app name.
    if (!isWebRuntime()) headers["User-Agent"] = "TaskLink-Capstone/1.0";
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Address lookup is unavailable. Enter the address manually.");
    const result = parseNominatimReverseResponse(await response.json());
    if (!result) throw new Error("No address was found for that pin. Enter the address manually.");
    cache.set(cacheKey, result);
    return result;
  });

  requestTail = run.catch(() => undefined);
  return run;
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
  return {
    formattedAddress,
    details: normalizeAddressDetails({
      houseNumber: field("house_number"),
      street: field("road", "pedestrian", "footway"),
      barangay: field("village", "suburb", "neighbourhood", "quarter"),
      city: field("city", "town", "municipality", "county"),
      province: field("state", "region"),
      postalCode: field("postcode")
    }),
    provider: "OpenStreetMap Nominatim"
  };
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
