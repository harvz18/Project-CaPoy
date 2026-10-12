export type MapCoordinate = { latitude: number; longitude: number };
export type LocationMarker = MapCoordinate & {
  id: string;
  title?: string;
  description?: string;
  color?: string;
  accuracyMeters?: number;
};
export type LocationMapProps = {
  center?: MapCoordinate;
  markers?: LocationMarker[];
  radiusMeters?: number;
  height?: number;
  interactive?: boolean;
  fitToMarkers?: boolean;
  connectMarkers?: boolean;
  showUserLocation?: boolean;
  onSelectCoordinate?: (coordinate: MapCoordinate) => void;
};
