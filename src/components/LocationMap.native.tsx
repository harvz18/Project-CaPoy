import Constants from "expo-constants";
import type { Feature, LineString, Polygon } from "geojson";
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, type StyleSpecification, UserLocation, ViewAnnotation } from "@maplibre/maplibre-react-native";
import { LocationMapProps, LocationMarker, MapCoordinate } from "./LocationMap.types";

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

function markerPin(marker: LocationMarker, interactive: boolean, onSelectCoordinate?: (coordinate: MapCoordinate) => void) {
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
  const cameraRef = useRef<CameraRef | null>(null);
  const focus = center ?? markers[0] ?? bacolodCenter;
  const mapTilerApiKey = Constants.expoConfig?.extra?.mapTilerApiKey?.trim();
  const mapStyle = mapTilerApiKey
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

  return (
    <View style={[styles.container, { height }]}>
      <Map
        accessibilityLabel={interactive ? "Interactive task location map" : "Task location map"}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        compass
        compassPosition={{ top: 8, right: 8 }}
        logo={false}
        mapStyle={mapStyle}
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
        {markers.map((marker) => markerPin(marker, interactive, onSelectCoordinate))}
      </Map>
      <Text accessibilityElementsHidden pointerEvents="none" style={styles.attribution}>
        {mapTilerApiKey ? mapTilerAttribution : osmAttribution}
      </Text>
      {interactive && !center ? <View pointerEvents="none" style={styles.selectionHint}><Text style={styles.selectionHintText}>Tap the map to place the task pin</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderColor: "#BDC9C6", borderRadius: 12, borderWidth: 1, overflow: "hidden", position: "relative", width: "100%" },
  map: { flex: 1 },
  pin: { borderColor: "#FFFFFF", borderRadius: 14, borderWidth: 3, elevation: 4, height: 28, shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, width: 28 },
  attribution: { backgroundColor: "rgba(255,255,255,0.84)", bottom: 0, color: "#33403D", fontSize: 9, lineHeight: 13, paddingHorizontal: 4, position: "absolute", right: 0 },
  selectionHint: { backgroundColor: "rgba(255,255,255,0.94)", borderColor: "#BDC9C6", borderRadius: 999, borderWidth: 1, left: 16, paddingHorizontal: 12, paddingVertical: 8, position: "absolute", right: 16, top: 12 },
  selectionHintText: { color: "#005C55", fontSize: 13, fontWeight: "700", textAlign: "center" }
});
