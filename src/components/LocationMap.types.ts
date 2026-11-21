export type MapCoordinate = { latitude: number; longitude: number };
export type { MapLayer } from "./mapLayers";
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
  showLayerSwitcher?: boolean;
  expandedControls?: boolean;
  onSelectCoordinate?: (coordinate: MapCoordinate) => void;
  /** Called when a non-editing map pin is selected (for example, a nearby task). */
  onMarkerPress?: (marker: LocationMarker) => void;
};
