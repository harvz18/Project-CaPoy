import { useEffect, useMemo, useRef } from "react";
import MapView, { Circle, Marker, MapPressEvent } from "react-native-maps";
import { LocationMapProps, MapCoordinate } from "./LocationMap.types";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };

export default function LocationMap({
  center,
  markers = [],
  radiusMeters,
  height = 220,
  interactive = false,
  fitToMarkers = false,
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
      {center && radiusMeters ? <Circle center={center} fillColor="rgba(0,92,85,0.14)" radius={radiusMeters} strokeColor="#005C55" /> : null}
    </MapView>
  );
}
