export type MapLayer = "street" | "satellite";

export const MAPTILER_SATELLITE_MAX_NATIVE_ZOOM = 22;

export function getMapTilerSatelliteTileUrl(apiKey: string) {
  return `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(apiKey)}`;
}

export function isSatelliteLayerAvailable(apiKey: string | undefined) {
  return Boolean(apiKey?.trim());
}

// Layer selection is intentionally presentation-only. Coordinates and radius
// remain owned by the caller and are never accepted or transformed here.
export function getMapLayerPresentation(layer: MapLayer, apiKey: string | undefined) {
  if (layer === "satellite" && isSatelliteLayerAvailable(apiKey)) {
    return {
      attribution: "MapTiler and OpenStreetMap contributors",
      maxNativeZoom: MAPTILER_SATELLITE_MAX_NATIVE_ZOOM,
      tileUrl: getMapTilerSatelliteTileUrl(apiKey as string)
    };
  }

  return {
    attribution: "OpenStreetMap contributors",
    maxNativeZoom: 19,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  };
}
