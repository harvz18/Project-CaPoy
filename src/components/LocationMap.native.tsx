import MapView, { Circle, Marker, MapPressEvent } from "react-native-maps";
import { LocationMapProps, MapCoordinate } from "./LocationMap.types";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };

export default function LocationMap({
  center,
  markers = [],
  radiusMeters,
  height = 220,
  interactive = false,
  showUserLocation = false,
  onSelectCoordinate
}: LocationMapProps) {
  const focus = center ?? markers[0] ?? bacolodCenter;
  const select = (event: MapPressEvent) => onSelectCoordinate?.(event.nativeEvent.coordinate);
  const drag = (event: { nativeEvent: { coordinate: MapCoordinate } }) => onSelectCoordinate?.(event.nativeEvent.coordinate);
  return (
    <MapView
      initialRegion={{ ...focus, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
      onPress={interactive ? select : undefined}
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
