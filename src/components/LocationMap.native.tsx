import { useEffect, useMemo, useRef } from "react";
import Constants from "expo-constants";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, MapPressEvent, Polyline } from "react-native-maps";
import { LocationMapProps, MapCoordinate } from "./LocationMap.types";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };
const googleMapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;

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
  const mapRef = useRef<MapView | null>(null);
  const focus = center ?? markers[0] ?? bacolodCenter;
  const coordinateKey = useMemo(
    () => markers.map((marker) => `${marker.latitude}:${marker.longitude}`).join("|"),
    [markers]
  );
  const select = (event: MapPressEvent) => onSelectCoordinate?.(event.nativeEvent.coordinate);
  const drag = (event: { nativeEvent: { coordinate: MapCoordinate } }) => onSelectCoordinate?.(event.nativeEvent.coordinate);

  useEffect(() => {
    if (!fitToMarkers || !mapRef.current) return;
    const coordinates: MapCoordinate[] = [...markers];
    if (center && !coordinates.some((coordinate) => coordinate.latitude === center.latitude && coordinate.longitude === center.longitude)) {
      coordinates.push(center);
    }
    if (!coordinates.length) return;
    mapRef.current.fitToCoordinates(coordinates, {
      animated: false,
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }
    });
  }, [center?.latitude, center?.longitude, coordinateKey, fitToMarkers]);

  // A standalone Android build without a Maps SDK key must never construct a
  // native MapView: Google Maps can terminate the process during startup.
  // Keep the surrounding task forms available so location can still be entered
  // by address or captured from the device.
  if (!googleMapsConfigured) {
    return (
      <View accessibilityRole="alert" style={[styles.unavailable, { height }]}>
        <Text style={styles.unavailableTitle}>Map preview is unavailable in this build</Text>
        <Text style={styles.unavailableText}>
          Use the device-location or address controls instead. Maps can be enabled in the next build after its Android Maps key is configured.
        </Text>
      </View>
    );
  }

  return (
    <MapView
      initialRegion={{ ...focus, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
      onPress={interactive ? select : undefined}
      ref={mapRef}
      showsUserLocation={showUserLocation}
      style={{ height, width: "100%" }}
    >
      {markers.map((marker) => (
        <Marker
          coordinate={marker}
          description={marker.description}
          draggable={interactive && marker.id === "selected"}
          key={marker.id}
          onDragEnd={interactive ? drag : undefined}
          pinColor={marker.color}
          title={marker.title}
        />
      ))}
      {connectMarkers && markers.length > 1 ? (
        <Polyline coordinates={markers} lineDashPattern={[7, 7]} strokeColor="#2563EB" strokeWidth={3} />
      ) : null}
      {center && radiusMeters ? <Circle center={center} fillColor="rgba(0,92,85,0.14)" radius={radiusMeters} strokeColor="#005C55" /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    width: "100%",
    minHeight: 112,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BDC9C6",
    backgroundColor: "#F1F4F3"
  },
  unavailableTitle: { color: "#181C1C", fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "center" },
  unavailableText: { color: "#3E4947", fontSize: 12, lineHeight: 18, textAlign: "center" }
});
