import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { LocationMapProps, MapCoordinate } from "./LocationMap.types";

export type { LocationMapProps, LocationMarker, MapCoordinate } from "./LocationMap.types";

const bacolodCenter: MapCoordinate = { latitude: 10.6765, longitude: 122.9509 };
const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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
  onSelectCoordinate
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusLayerRef = useRef<L.Circle | null>(null);
  const onSelectRef = useRef(onSelectCoordinate);
  const initialFocusRef = useRef(center ?? markers[0] ?? bacolodCenter);
  const firstMarker = markers[0];
  const focus = center ?? firstMarker;
  const focusKey = focus ? `${focus.latitude}:${focus.longitude}` : "";
  const markerKey = useMemo(
    () => markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}:${marker.color ?? ""}:${marker.title ?? ""}`).join("|"),
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

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
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
      markerLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

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
    }
  }, [interactive, markerKey]);

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
      {interactive && !center ? (
        <div
          style={{
            background: "rgba(255,255,255,.94)",
            border: "1px solid #BDC9C6",
            borderRadius: 999,
            color: "#005C55",
            fontFamily: "system-ui, sans-serif",
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
