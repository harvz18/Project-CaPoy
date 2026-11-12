import Constants from "expo-constants";
import type { Feature, LineString, Polygon } from "geojson";
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react";
import { NativeModules, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppText";
import { WebView } from "react-native-webview";
import type { CameraRef, MapRef, StyleSpecification } from "@maplibre/maplibre-react-native";
import { LocationMapProps, LocationMarker, MapCoordinate } from "./LocationMap.types";
import { getMapTilerSatelliteTileUrl, isSatelliteLayerAvailable, MAPTILER_SATELLITE_MAX_NATIVE_ZOOM, MapLayer } from "./mapLayers";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };
const osmAttribution = "© OpenStreetMap contributors";
const mapTilerAttribution = "© MapTiler © OpenStreetMap contributors";

// This controlled fallback lets the defense build render a map before a
// MapTiler key is supplied. It is not intended as unlimited OSM tile hosting.
const openStreetMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: osmAttribution
    }
  },
  layers: [{ id: "openstreetmap", type: "raster", source: "openstreetmap" }]
};

function coordinateToLngLat({ latitude, longitude }: MapCoordinate): [number, number] {
  return [longitude, latitude];
}

function circleFeature(center: MapCoordinate, radiusMeters: number): Feature<Polygon> {
  const earthRadiusMeters = 6_371_008.8;
  const angularDistance = radiusMeters / earthRadiusMeters;
  const latitudeRadians = center.latitude * Math.PI / 180;
  const longitudeRadians = center.longitude * Math.PI / 180;
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= 48; step += 1) {
    const bearing = (step / 48) * Math.PI * 2;
    const latitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance)
      + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const longitude = longitudeRadians + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(latitude)
    );
    coordinates.push([longitude * 180 / Math.PI, latitude * 180 / Math.PI]);
  }

  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coordinates] } };
}

function markerPin(
  ViewAnnotation: typeof import("@maplibre/maplibre-react-native").ViewAnnotation,
  marker: LocationMarker,
  interactive: boolean,
  onSelectCoordinate?: (coordinate: MapCoordinate) => void
) {
  return (
    <ViewAnnotation
      anchor="bottom"
      draggable={interactive && marker.id === "selected"}
      id={marker.id}
      key={marker.id}
      lngLat={coordinateToLngLat(marker)}
      onDragEnd={interactive ? (event) => onSelectCoordinate?.({
        latitude: event.nativeEvent.lngLat[1],
        longitude: event.nativeEvent.lngLat[0]
      }) : undefined}
      title={marker.title ?? "Map pin"}
    >
      <View
        accessibilityLabel={marker.title ?? "Map pin"}
        accessibilityRole="image"
        style={[styles.pin, { backgroundColor: marker.color ?? "#005C55" }]}
      />
    </ViewAnnotation>
  );
}

function getMapLibre() {
  // Expo Go does not bundle MapLibre's native view and camera modules. Avoid
  // evaluating the package there: doing so throws before the app can render.
  if (!NativeModules.MLRNCameraModule) {
    return undefined;
  }

  return require("@maplibre/maplibre-react-native") as typeof import("@maplibre/maplibre-react-native");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function leafletHtml({ center, markers, radiusMeters, interactive, fitToMarkers, connectMarkers, mapLayer, mapTilerApiKey }: LocationMapProps & { mapLayer: MapLayer; mapTilerApiKey?: string }) {
  const mapData = safeJson({
    center,
    connectMarkers,
    fitToMarkers,
    interactive,
    markers,
    radiusMeters,
    mapLayer,
    mapTilerApiKey
  });

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>html, body, #map { height: 100%; margin: 0; width: 100%; } .leaflet-control-attribution { font-size: 9px; }</style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const data = ${mapData};
      const fallback = { latitude: 10.6765, longitude: 122.9509 };
      const focus = data.center || data.markers[0] || fallback;
      const map = L.map('map', { zoomControl: true }).setView([focus.latitude, focus.longitude], data.center || data.markers.length ? 15 : 13);
      let baseLayer;
      function baseLayerOptions(layer) {
        const satellite = layer === 'satellite' && data.mapTilerApiKey;
        return satellite ? {
          url: 'https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=' + encodeURIComponent(data.mapTilerApiKey),
          maxNativeZoom: 22, maxZoom: 22, attribution: '&copy; MapTiler &copy; OpenStreetMap contributors'
        } : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxNativeZoom: 19, maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' };
      }
      function setBaseLayer(layer) {
        const options = baseLayerOptions(layer);
        const nextLayer = L.tileLayer(options.url, options);
        nextLayer.on('tileerror', () => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tile-error', layer })));
        nextLayer.addTo(map);
        if (baseLayer) baseLayer.remove();
        baseLayer = nextLayer;
      }
      setBaseLayer(data.mapLayer);

      const markerPoints = [];
      data.markers.forEach((marker) => {
        const pin = L.circleMarker([marker.latitude, marker.longitude], {
          color: '#FFFFFF', fillColor: marker.color || '#005C55', fillOpacity: 1, radius: 10, weight: 3
        }).addTo(map);
        if (marker.title) pin.bindTooltip(String(marker.title), { direction: 'top' });
        markerPoints.push([marker.latitude, marker.longitude]);
        if (Number.isFinite(marker.accuracyMeters) && marker.accuracyMeters > 0) {
          L.circle([marker.latitude, marker.longitude], { color: marker.color || '#2563EB', fillOpacity: 0.08, radius: marker.accuracyMeters, weight: 1 }).addTo(map);
        }
        if (data.interactive && marker.id === 'selected') {
          const dragPin = L.marker([marker.latitude, marker.longitude], { draggable: true }).addTo(map);
          dragPin.on('dragend', () => sendCoordinate(dragPin.getLatLng()));
        }
      });
      if (data.center && data.radiusMeters > 0) {
        L.circle([data.center.latitude, data.center.longitude], { color: '#005C55', fillColor: '#005C55', fillOpacity: 0.12, radius: data.radiusMeters, weight: 2 }).addTo(map);
      }
      if (data.connectMarkers && markerPoints.length > 1) L.polyline(markerPoints, { color: '#2563EB', dashArray: '6 6', weight: 3 }).addTo(map);
      if (data.fitToMarkers && markerPoints.length > 1) map.fitBounds(markerPoints, { padding: [32, 32] });
      if (data.interactive) map.on('click', event => sendCoordinate(event.latlng));
      function receiveMessage(event) {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'set-map-layer') setBaseLayer(message.layer);
        } catch (_) {}
      }
      document.addEventListener('message', receiveMessage);
      window.addEventListener('message', receiveMessage);
      function sendCoordinate(point) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'coordinate', latitude: point.lat, longitude: point.lng }));
      }
    </script>
  </body>
</html>`;
}

function LeafletMapFallback({ center, markers = [], height, interactive = false, onSelectCoordinate, mapLayer, mapTilerApiKey, mapError, onMapError, onSelectMapLayer, ...mapProps }: LocationMapProps & { mapLayer: MapLayer; mapTilerApiKey?: string; mapError: string; onMapError: (message: string) => void; onSelectMapLayer: (layer: MapLayer) => void }) {
  const webViewRef = useRef<ComponentRef<typeof WebView>>(null);
  const html = useMemo(
    () => leafletHtml({ center, interactive, markers, mapLayer: "street", mapTilerApiKey, ...mapProps }),
    [center?.latitude, center?.longitude, interactive, JSON.stringify(markers), mapProps.connectMarkers, mapProps.fitToMarkers, mapProps.radiusMeters, mapTilerApiKey]
  );

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: "set-map-layer", layer: mapLayer }));
  }, [mapLayer]);

  return (
    <View accessibilityLabel={interactive ? "Interactive task location map" : "Task location map"} style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        domStorageEnabled
        javaScriptEnabled
        onLoadEnd={() => webViewRef.current?.postMessage(JSON.stringify({ type: "set-map-layer", layer: mapLayer }))}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data) as { type?: string; layer?: string; latitude?: unknown; longitude?: unknown };
            if (message.type === "coordinate" && typeof message.latitude === "number" && typeof message.longitude === "number") {
              onSelectCoordinate?.({ latitude: message.latitude, longitude: message.longitude });
            }
            if (message.type === "tile-error" && message.layer === "satellite") {
              onMapError("Satellite imagery could not load. You can return to Street view.");
            }
          } catch {
            // Ignore malformed messages from the embedded map.
          }
        }}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.map}
      />
      {interactive ? <MapLayerSwitcher mapLayer={mapLayer} error={mapError} onSelect={onSelectMapLayer} /> : null}
      <Text accessibilityElementsHidden pointerEvents="none" style={styles.attribution}>{mapLayer === "satellite" && mapTilerApiKey ? mapTilerAttribution : osmAttribution}</Text>
    </View>
  );
}

export default function LocationMap({
  center,
  markers = [],
  radiusMeters,
  height = 220,
  interactive = false,
  fitToMarkers = false,
  connectMarkers = false,
  showUserLocation = false,
  onSelectCoordinate
}: LocationMapProps) {
  const [mapLayer, setMapLayer] = useState<MapLayer>("street");
  const [mapError, setMapError] = useState("");
  const mapTilerApiKey = Constants.expoConfig?.extra?.mapTilerApiKey?.trim();
  const selectMapLayer = (layer: MapLayer) => {
    if (layer === "satellite" && !isSatelliteLayerAvailable(mapTilerApiKey)) {
      setMapError("Satellite view needs the configured MapTiler key.");
      return;
    }
    setMapError("");
    setMapLayer(layer);
  };
  const mapLibre = getMapLibre();
  if (!mapLibre) {
    return <LeafletMapFallback
      center={center}
      connectMarkers={connectMarkers}
      fitToMarkers={fitToMarkers}
      height={height}
      interactive={interactive}
      markers={markers}
      mapLayer={mapLayer}
      mapTilerApiKey={mapTilerApiKey}
      mapError={mapError}
      onMapError={setMapError}
      onSelectMapLayer={selectMapLayer}
      onSelectCoordinate={onSelectCoordinate}
      radiusMeters={radiusMeters}
    />;
  }

  const { Camera, GeoJSONSource, Layer, Map, UserLocation, ViewAnnotation } = mapLibre;
  const cameraRef = useRef<CameraRef | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const focus = center ?? markers[0] ?? bacolodCenter;
  const mapStyle = mapLayer === "satellite" && mapTilerApiKey
    ? satelliteMapStyle(mapTilerApiKey)
    : mapTilerApiKey
      ? `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(mapTilerApiKey)}`
      : openStreetMapStyle;
  const coordinateKey = useMemo(
    () => markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}`).join("|"),
    [markers]
  );
  const routeFeature = useMemo<Feature<LineString> | null>(() => (
    connectMarkers && markers.length > 1
      ? {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: markers.map(coordinateToLngLat) }
        }
      : null
  ), [connectMarkers, coordinateKey]);
  const geofenceFeature = useMemo(
    () => center && radiusMeters && radiusMeters > 0 ? circleFeature(center, radiusMeters) : null,
    [center?.latitude, center?.longitude, radiusMeters]
  );
  const accuracyFeatures = useMemo(() => markers
    .filter((marker) => Number.isFinite(marker.accuracyMeters) && (marker.accuracyMeters ?? 0) > 0)
    .map((marker) => ({ marker, feature: circleFeature(marker, marker.accuracyMeters as number) })), [coordinateKey]);

  useEffect(() => {
    if (!fitToMarkers || !cameraRef.current) return;
    const coordinates: MapCoordinate[] = [...markers];
    if (center && !coordinates.some((coordinate) => coordinate.latitude === center.latitude && coordinate.longitude === center.longitude)) {
      coordinates.push(center);
    }
    if (coordinates.length === 1) {
      cameraRef.current.easeTo({ center: coordinateToLngLat(coordinates[0]), duration: 0, zoom: 15 });
      return;
    }
    if (coordinates.length > 1) {
      const longitudes = coordinates.map(({ longitude }) => longitude);
      const latitudes = coordinates.map(({ latitude }) => latitude);
      cameraRef.current.fitBounds([Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)], {
        padding: {
          bottom: 40,
          left: 40,
          right: 40,
          top: 40
        },
        duration: 0
      });
    }
  }, [center?.latitude, center?.longitude, coordinateKey, fitToMarkers]);

  useEffect(() => {
    if (fitToMarkers || !cameraRef.current) return;
    cameraRef.current.easeTo({ center: coordinateToLngLat(focus), duration: 0, zoom: center || markers.length ? 15 : 13 });
  }, [focus.latitude, focus.longitude, fitToMarkers]);

  async function adjustZoom(amount: number) {
    const currentZoom = await mapRef.current?.getZoom();
    if (!Number.isFinite(currentZoom)) return;
    const maximum = mapLayer === "satellite" ? MAPTILER_SATELLITE_MAX_NATIVE_ZOOM : 19;
    cameraRef.current?.zoomTo(Math.max(0, Math.min(maximum, (currentZoom as number) + amount)), { duration: 160 });
  }

  return (
    <View style={[styles.container, { height }]}>
      <Map
        ref={mapRef}
        accessibilityLabel={interactive ? "Interactive task location map" : "Task location map"}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        compass
        compassPosition={{ top: 8, right: 8 }}
        logo={false}
        mapStyle={mapStyle}
        onDidFailLoadingMap={() => {
          if (mapLayer === "satellite") setMapError("Satellite imagery could not load. You can return to Street view.");
        }}
        onPress={interactive ? (event) => onSelectCoordinate?.({
          latitude: event.nativeEvent.lngLat[1],
          longitude: event.nativeEvent.lngLat[0]
        }) : undefined}
        scaleBar
        scaleBarPosition={{ top: 8, left: 8 }}
        style={styles.map}
      >
        <Camera ref={cameraRef} initialViewState={{ center: coordinateToLngLat(focus), zoom: center || markers.length ? 15 : 13 }} />
        {showUserLocation ? <UserLocation accuracy animated /> : null}
        {accuracyFeatures.map(({ marker, feature }, index) => (
          <GeoJSONSource data={feature} id={`accuracy-${index}`} key={`accuracy-${marker.id}`}>
            <Layer paint={{ "fill-color": marker.color ?? "#2563EB", "fill-opacity": 0.08 }} type="fill" />
            <Layer paint={{ "line-color": marker.color ?? "#2563EB", "line-dasharray": [2, 2], "line-width": 1 }} type="line" />
          </GeoJSONSource>
        ))}
        {geofenceFeature ? (
          <GeoJSONSource data={geofenceFeature} id="geofence">
            <Layer paint={{ "fill-color": "#005C55", "fill-opacity": 0.12 }} type="fill" />
            <Layer paint={{ "line-color": "#005C55", "line-width": 2 }} type="line" />
          </GeoJSONSource>
        ) : null}
        {routeFeature ? (
          <GeoJSONSource data={routeFeature} id="route">
            <Layer paint={{ "line-color": "#2563EB", "line-dasharray": [2, 2], "line-width": 3 }} type="line" />
          </GeoJSONSource>
        ) : null}
        {markers.map((marker) => markerPin(ViewAnnotation, marker, interactive, onSelectCoordinate))}
      </Map>
      <Text accessibilityElementsHidden pointerEvents="none" style={styles.attribution}>
        {mapTilerApiKey ? mapTilerAttribution : osmAttribution}
      </Text>
      {interactive ? <MapLayerSwitcher mapLayer={mapLayer} error={mapError} onSelect={selectMapLayer} /> : null}
      {interactive ? <MapZoomControls onAdjust={adjustZoom} /> : null}
      {interactive && !center ? <View pointerEvents="none" style={styles.selectionHint}><Text style={styles.selectionHintText}>Tap the map to place the task pin</Text></View> : null}
    </View>
  );
}

function satelliteMapStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [getMapTilerSatelliteTileUrl(apiKey)],
        tileSize: 256,
        maxzoom: MAPTILER_SATELLITE_MAX_NATIVE_ZOOM,
        attribution: mapTilerAttribution
      }
    },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }]
  };
}

function MapLayerSwitcher({ mapLayer, error, onSelect }: { mapLayer: MapLayer; error: string; onSelect: (layer: MapLayer) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.layerControl}>
      <View style={styles.layerButtons}>
        {(["street", "satellite"] as const).map((layer) => {
          const selected = mapLayer === layer;
          return <Pressable accessibilityLabel={`${layer === "street" ? "Street" : "Satellite"} map view`} accessibilityRole="radio" accessibilityState={{ selected }} key={layer} onPress={() => onSelect(layer)} style={[styles.layerButton, selected && styles.layerButtonSelected]}><Text style={[styles.layerButtonText, selected && styles.layerButtonTextSelected]}>{layer === "street" ? "Street" : "Satellite"}</Text></Pressable>;
        })}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.layerError}>{error}</Text> : null}
    </View>
  );
}

function MapZoomControls({ onAdjust }: { onAdjust: (amount: number) => void }) {
  return (
    <View accessibilityLabel="Map zoom controls" style={styles.zoomControl}>
      <Pressable accessibilityLabel="Zoom in" accessibilityRole="button" onPress={() => void onAdjust(1)} style={styles.zoomButton}><Text style={styles.zoomButtonText}>+</Text></Pressable>
      <Pressable accessibilityLabel="Zoom out" accessibilityRole="button" onPress={() => void onAdjust(-1)} style={styles.zoomButton}><Text style={styles.zoomButtonText}>−</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderColor: "#BDC9C6", borderRadius: 12, borderWidth: 1, overflow: "hidden", position: "relative", width: "100%" },
  map: { flex: 1 },
  pin: { borderColor: "#FFFFFF", borderRadius: 14, borderWidth: 3, elevation: 4, height: 28, shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, width: 28 },
  attribution: { backgroundColor: "rgba(255,255,255,0.84)", bottom: 0, color: "#33403D", fontSize: 9, lineHeight: 13, paddingHorizontal: 4, position: "absolute", right: 0 },
  selectionHint: { backgroundColor: "rgba(255,255,255,0.94)", borderColor: "#BDC9C6", borderRadius: 999, borderWidth: 1, left: 16, paddingHorizontal: 12, paddingVertical: 8, position: "absolute", right: 16, top: 106 },
  selectionHintText: { color: "#005C55", fontSize: 13, fontWeight: "700", textAlign: "center" },
  layerControl: { alignItems: "flex-end", gap: 6, position: "absolute", right: 8, top: 8 },
  layerButtons: { backgroundColor: "rgba(0,92,85,0.94)", borderColor: "rgba(255,255,255,0.78)", borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 2, padding: 3 },
  layerButton: { alignItems: "center", borderRadius: 6, justifyContent: "center", minHeight: 36, paddingHorizontal: 10 },
  layerButtonSelected: { backgroundColor: "#20D5C5" },
  layerButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  layerButtonTextSelected: { color: "#003C37" },
  layerError: { backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#B42318", borderRadius: 8, borderWidth: 1, color: "#8A1C16", fontSize: 12, fontWeight: "700", maxWidth: 230, paddingHorizontal: 9, paddingVertical: 6, textAlign: "right" },
  zoomControl: { backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#BDC9C6", borderRadius: 8, borderWidth: 1, overflow: "hidden", position: "absolute", right: 8, top: 56 },
  zoomButton: { alignItems: "center", borderBottomColor: "#BDC9C6", borderBottomWidth: 1, height: 34, justifyContent: "center", width: 34 },
  zoomButtonText: { color: "#005C55", fontSize: 21, fontWeight: "800", lineHeight: 24 }
});
