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
type PsgcRecord = {
  code: string;
  name: string;
  regionCode?: string;
  geographicProvinceCode?: string | null;
};

// The 2024 Negros Island Region restoration changed the live PSGC codes for
// Negros Occidental and Bacolod. Keep saved pre-change profiles selectable.
const currentCodeByLegacyCode: Record<string, string> = {
  "0645000000": "1804500000",
  "0645010000": "1830200000"
};

function currentCode(code: string) {
  return currentCodeByLegacyCode[code] ?? code;
}

async function getRecords(path: string): Promise<PsgcRecord[]> {
  const response = await fetch(`${api}${path}`);
  if (!response.ok) throw new Error("Philippine address data is temporarily unavailable. Try again later.");
  const body = await response.json() as Response;
  if (!Array.isArray(body.data)) throw new Error("Philippine address data was unavailable.");
  return body.data
    .map((item): PsgcRecord | undefined => {
      const value = item as { code?: unknown; name?: unknown; regionCode?: unknown; geographicProvinceCode?: unknown };
      return typeof value.code === "string" && typeof value.name === "string"
        ? {
          code: value.code,
          name: value.name,
          regionCode: typeof value.regionCode === "string" ? value.regionCode : undefined,
          geographicProvinceCode: typeof value.geographicProvinceCode === "string" ? value.geographicProvinceCode : null
        } : undefined;
    })
    .filter((item): item is PsgcRecord => Boolean(item));
}

function toOptions(records: PsgcRecord[]): PhilippineAddressOption[] {
  return [...new Map(records.map((item) => [item.code, { code: item.code, name: item.name }])).values()]
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
}

async function getOptions(path: string) { return toOptions(await getRecords(path)); }

export function loadPhilippineRegions() { return getOptions("/regions?limit=100"); }
export function loadProvinces(regionCode: string) { return getOptions(`/regions/${encodeURIComponent(regionCode)}/provinces?limit=100`); }
export function loadIndependentCities(regionCode: string) {
  return getOptions(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities?province=none&limit=2000`);
}
export async function loadCitiesMunicipalities(provinceCode: string, regionCode?: string) {
  const normalizedProvinceCode = currentCode(provinceCode);
  const cities = await getRecords(`/provinces/${encodeURIComponent(normalizedProvinceCode)}/cities-municipalities?limit=500`);
  // Highly urbanized cities are administratively independent, even when they
  // are geographically within the selected province. Include only those that
  // explicitly belong to this province, so unrelated independent cities stay
  // out of the list.
  const currentRegionCode = cities[0]?.regionCode
    ?? (normalizedProvinceCode === "1804500000" ? "1800000000" : regionCode);
  if (!currentRegionCode) return toOptions(cities);
  try {
    const independent = await getRecords(`/regions/${encodeURIComponent(currentRegionCode)}/cities-municipalities?province=none&limit=2000`);
    return toOptions([...cities, ...independent.filter((item) => item.geographicProvinceCode === normalizedProvinceCode)]);
  } catch {
    return toOptions(cities);
  }
}
export function loadBarangays(cityMunicipalityCode: string) {
  return getOptions(`/cities-municipalities/${encodeURIComponent(currentCode(cityMunicipalityCode))}/barangays?limit=1000`);
}
