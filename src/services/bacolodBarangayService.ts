const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

type OverpassElement = { tags?: { name?: unknown; "name:en"?: unknown } };

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

/** Fetches the currently mapped Bacolod barangay boundaries; no hardcoded list is bundled. */
export async function fetchBacolodBarangays(fetcher: typeof fetch = fetch) {
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(bacolodBarangayQuery)}`
      });
      if (!response.ok) continue;
      const barangays = parseBacolodBarangays(await response.json());
      if (barangays.length) return barangays;
    } catch {
      // Try the next independent OpenStreetMap Overpass service.
    }
  }
  throw new Error("Bacolod barangays could not be loaded. Check your connection and try again.");
}
