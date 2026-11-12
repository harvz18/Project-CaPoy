import assert from "node:assert/strict";
import test from "node:test";
import { getMapLayerPresentation, MAPTILER_SATELLITE_MAX_NATIVE_ZOOM } from "../src/components/mapLayers";
import { getGeofenceCheck } from "../src/utils/location";

test("switching map presentation leaves the selected pin and geofence inputs unchanged", () => {
  const selectedTaskLocation = { latitude: 10.6765, longitude: 122.9509, geofenceRadius: 500 };
  const worker = {
    currentLatitude: 10.6766,
    currentLongitude: 122.951,
    locationSource: "device" as const,
    locationUpdatedAt: new Date().toISOString(),
    locationAccuracyMeters: 10
  };
  const task = { ...selectedTaskLocation, id: "task-1" } as Parameters<typeof getGeofenceCheck>[1];
  const before = getGeofenceCheck(worker, task);

  const street = getMapLayerPresentation("street", "test-key");
  const satellite = getMapLayerPresentation("satellite", "test-key");
  const after = getGeofenceCheck(worker, task);

  assert.equal(street.maxNativeZoom, 19);
  assert.equal(satellite.maxNativeZoom, MAPTILER_SATELLITE_MAX_NATIVE_ZOOM);
  assert.match(satellite.tileUrl, /satellite-v2/);
  assert.deepEqual(selectedTaskLocation, { latitude: 10.6765, longitude: 122.9509, geofenceRadius: 500 });
  assert.deepEqual(after, before);
});

test("satellite presentation safely falls back to the existing street tiles without a MapTiler key", () => {
  const presentation = getMapLayerPresentation("satellite", undefined);
  assert.equal(presentation.maxNativeZoom, 19);
  assert.match(presentation.tileUrl, /openstreetmap/);
});
