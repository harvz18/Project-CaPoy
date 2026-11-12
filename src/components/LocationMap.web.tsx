import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMapTilerSatelliteTileUrl, isSatelliteLayerAvailable, MAPTILER_SATELLITE_MAX_NATIVE_ZOOM, MapLayer } from "./mapLayers";
import { LocationMapProps, MapCoordinate } from "./LocationMap.types";

export type { LocationMapProps, LocationMarker, MapCoordinate } from "./LocationMap.types";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };
const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const mapTilerAttribution = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function markerIcon(color?: string) {
  const safeColor = color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#005C55";
  return L.divIcon({
    className: "tasklink-map-pin",
    html: `<span style="display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;background:${safeColor};border:3px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.32);transform:rotate(-45deg)"></span>`,
    iconAnchor: [12, 24],
    iconSize: [24, 24]
  });
}

export default function LocationMap({
  center,
  markers = [],
  radiusMeters,
  height = 220,
  interactive = false,
  fitToMarkers = false,
  connectMarkers = false,
  onSelectCoordinate
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.Circle | null>(null);
  const onSelectRef = useRef(onSelectCoordinate);
  const [mapLayer, setMapLayer] = useState<MapLayer>("street");
  const [mapError, setMapError] = useState("");
  const mapTilerApiKey = Constants.expoConfig?.extra?.mapTilerApiKey?.trim();
  const initialFocusRef = useRef(center ?? markers[0] ?? bacolodCenter);
  const firstMarker = markers[0];
  const focus = center ?? firstMarker;
  const focusKey = focus ? `${focus.latitude}:${focus.longitude}` : "";
  const markerKey = useMemo(
    () => markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}:${marker.color ?? ""}:${marker.title ?? ""}:${marker.accuracyMeters ?? ""}`).join("|"),
    [markers]
  );

  useEffect(() => {
    onSelectRef.current = onSelectCoordinate;
  }, [onSelectCoordinate]);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialFocus = initialFocusRef.current;
    const map = L.map(containerRef.current, {
      attributionControl: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      zoomControl: true
    }).setView([initialFocus.latitude, initialFocus.longitude], center || markers.length ? 15 : 13);

    const baseLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19
    });
    baseLayer.addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    baseLayerRef.current = baseLayer;
    markerLayerRef.current = markerLayer;

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.invalidateSize({ pan: false }))
      : undefined;
    resizeObserver?.observe(containerRef.current);
    const resizeTimer = window.setTimeout(() => map.invalidateSize({ pan: false }), 0);

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      markerLayer.clearLayers();
      map.remove();
      baseLayerRef.current = null;
      markerLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isSatellite = mapLayer === "satellite" && isSatelliteLayerAvailable(mapTilerApiKey);
    const nextLayer = L.tileLayer(isSatellite ? getMapTilerSatelliteTileUrl(mapTilerApiKey as string) : tileUrl, {
      attribution: isSatellite ? mapTilerAttribution : attribution,
      maxNativeZoom: isSatellite ? MAPTILER_SATELLITE_MAX_NATIVE_ZOOM : 19,
      maxZoom: isSatellite ? MAPTILER_SATELLITE_MAX_NATIVE_ZOOM : 19
    });
    const handleTileError = () => {
      if (isSatellite) setMapError("Satellite imagery could not load. You can return to Street view.");
    };

    nextLayer.on("tileerror", handleTileError);
    nextLayer.addTo(map);
    baseLayerRef.current?.remove();
    baseLayerRef.current = nextLayer;
    if (!isSatellite) setMapError("");

    return () => {
      nextLayer.off("tileerror", handleTileError);
      if (baseLayerRef.current === nextLayer) {
        nextLayer.remove();
        baseLayerRef.current = null;
      }
    };
  }, [mapLayer, mapTilerApiKey]);

  function selectMapLayer(nextLayer: MapLayer) {
    if (nextLayer === "satellite" && !isSatelliteLayerAvailable(mapTilerApiKey)) {
      setMapError("Satellite view needs the configured MapTiler key.");
      return;
    }
    setMapError("");
    setMapLayer(nextLayer);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !interactive) return;

    const select = (event: L.LeafletMouseEvent) => {
      onSelectRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    };
    map.on("click", select);
    return () => {
      map.off("click", select);
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.panTo([focus.latitude, focus.longitude], { animate: false });
  }, [focusKey]);

  useEffect(() => {
    const layer = markerLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const marker of markers) {
      const canDrag = interactive && marker.id === "selected";
      const pin = L.marker([marker.latitude, marker.longitude], {
        autoPan: canDrag,
        draggable: canDrag,
        icon: markerIcon(marker.color),
        keyboard: true,
        title: marker.title ?? "Map pin"
      });
      if (canDrag) {
        pin.on("dragend", () => {
          const coordinate = pin.getLatLng();
          onSelectRef.current?.({ latitude: coordinate.lat, longitude: coordinate.lng });
        });
      }
      pin.addTo(layer);
      if (Number.isFinite(marker.accuracyMeters) && (marker.accuracyMeters as number) > 0) {
        L.circle([marker.latitude, marker.longitude], {
          color: marker.color ?? "#2563EB",
          dashArray: "4 5",
          fillColor: marker.color ?? "#2563EB",
          fillOpacity: 0.08,
          radius: marker.accuracyMeters as number,
          weight: 1
        }).addTo(layer);
      }
    }
    if (connectMarkers && markers.length > 1) {
      L.polyline(markers.map((marker) => [marker.latitude, marker.longitude]), {
        color: "#2563EB",
        dashArray: "7 7",
        opacity: 0.78,
        weight: 3
      }).addTo(layer);
    }
  }, [connectMarkers, interactive, markerKey]);

  useEffect(() => {
    radiusLayerRef.current?.remove();
    radiusLayerRef.current = null;
    if (!mapRef.current || !center || !radiusMeters) return;

    radiusLayerRef.current = L.circle([center.latitude, center.longitude], {
      color: "#005C55",
      fillColor: "#005C55",
      fillOpacity: 0.12,
      radius: radiusMeters,
      weight: 2
    }).addTo(mapRef.current);
  }, [center?.latitude, center?.longitude, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer || !fitToMarkers) return;

    const bounds = L.latLngBounds([]);
    markerLayer.eachLayer((layer) => {
      if (layer instanceof L.Marker) bounds.extend(layer.getLatLng());
    });
    if (radiusLayerRef.current) bounds.extend(radiusLayerRef.current.getBounds());
    if (!bounds.isValid()) return;
    map.fitBounds(bounds.pad(0.12), { animate: false, maxZoom: 17, padding: [24, 24] });
  }, [center?.latitude, center?.longitude, fitToMarkers, markerKey, radiusMeters]);

  useEffect(() => {
    mapRef.current?.invalidateSize({ pan: false });
  }, [height]);

  return (
    <div
      aria-label={interactive ? "Interactive task location map" : "Task location map"}
      role="region"
      style={{
        border: "1px solid #BDC9C6",
        borderRadius: 12,
        height,
        overflow: "hidden",
        position: "relative",
        width: "100%"
      }}
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {interactive ? (
        <div aria-label="Map layer" role="group" style={{ background: "rgba(0,92,85,.94)", border: "1px solid rgba(255,255,255,.75)", borderRadius: 9, display: "flex", gap: 2, padding: 3, position: "absolute", right: 12, top: 52, zIndex: 700 }}>
          {(["street", "satellite"] as const).map((layer) => {
            const selected = mapLayer === layer;
            return <button aria-pressed={selected} key={layer} onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectMapLayer(layer); }} style={{ background: selected ? "#20D5C5" : "transparent", border: 0, borderRadius: 6, color: selected ? "#003C37" : "#FFFFFF", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 800, minHeight: 36, padding: "0 10px" }} type="button">{layer === "street" ? "Street" : "Satellite"}</button>;
          })}
        </div>
      ) : null}
      {mapError ? <div role="status" style={{ background: "rgba(255,255,255,.96)", border: "1px solid #B42318", borderRadius: 8, bottom: 26, color: "#8A1C16", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 700, left: 12, padding: "7px 10px", position: "absolute", right: 12, zIndex: 700 }}>{mapError}</div> : null}
      {interactive && !center ? (
        <div
          style={{
            background: "rgba(255,255,255,.94)",
            border: "1px solid #BDC9C6",
            borderRadius: 999,
            color: "#005C55",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            left: "50%",
            padding: "8px 12px",
            pointerEvents: "none",
            position: "absolute",
            top: 12,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            zIndex: 500
          }}
        >
          Click the map to place the task pin
        </div>
      ) : null}
    </div>
  );
}
