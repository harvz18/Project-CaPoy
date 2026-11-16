/**
 * Read-only PSGC lookups for the residential-address picker. The service is
 * backed by a public API that publishes PSA PSGC releases; it needs no key or
 * paid geocoding. We retain names with their stable codes so future PSGC name
 * corrections do not invalidate stored profile data.
 */
export type PhilippineAddressOption = { code: string; name: string };

const baseUrl = (process.env.EXPO_PUBLIC_PSGC_API_BASE_URL || "https://psgc.billyjamesramos.com").replace(/\/$/, "");
const api = `${baseUrl}/api/v1`;

type Response = { data?: unknown };

async function getOptions(path: string): Promise<PhilippineAddressOption[]> {
  const response = await fetch(`${api}${path}`);
  if (!response.ok) throw new Error("Philippine address data is temporarily unavailable. Try again later.");
  const body = await response.json() as Response;
  if (!Array.isArray(body.data)) throw new Error("Philippine address data was unavailable.");
  return body.data
    .map((item): PhilippineAddressOption | undefined => {
      const value = item as { code?: unknown; name?: unknown };
      return typeof value.code === "string" && typeof value.name === "string"
        ? { code: value.code, name: value.name } : undefined;
    })
    .filter((item): item is PhilippineAddressOption => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

export function loadPhilippineRegions() { return getOptions("/regions?limit=100"); }
export function loadProvinces(regionCode: string) { return getOptions(`/regions/${encodeURIComponent(regionCode)}/provinces?limit=100`); }
export function loadIndependentCities(regionCode: string) {
  return getOptions(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities?province=none&limit=2000`);
}
export function loadCitiesMunicipalities(provinceCode: string) {
  return getOptions(`/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities?limit=500`);
}
export function loadBarangays(cityMunicipalityCode: string) {
  return getOptions(`/cities-municipalities/${encodeURIComponent(cityMunicipalityCode)}/barangays?limit=1000`);
}
