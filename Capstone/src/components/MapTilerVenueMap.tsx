import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'

export interface MapCoordinates {
  latitude: number
  longitude: number
}

interface MapTilerVenueMapProps {
  coordinates: MapCoordinates
  fullscreen?: boolean
  onPin: (coordinates: MapCoordinates) => void
}

const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? ''

const isMapMessage = (value: unknown): value is {
  source: 'multivent-maptiler'
  latitude: number
  longitude: number
} => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.source === 'multivent-maptiler'
    && typeof record.latitude === 'number'
    && Number.isFinite(record.latitude)
    && typeof record.longitude === 'number'
    && Number.isFinite(record.longitude)
}

const mapDocument = (coordinates: MapCoordinates) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIINfQZ6X7fBz7J3+e1H1mT4D2kLI4R8Z3s=" crossorigin="" />
    <style>
      /*
       * Keep the positioning rules local to the document as well as loading
       * Leaflet's stylesheet.  Some mobile browsers defer a cross-origin
       * stylesheet in srcdoc iframes; without these rules, Leaflet tiles are
       * laid out as normal page content and make the iframe scrollable.
       */
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #f7f3f2;
      }
      #map, .leaflet-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        touch-action: none;
        outline: 0;
        font-family: Arial, sans-serif;
      }
      .leaflet-pane,
      .leaflet-tile,
      .leaflet-marker-icon,
      .leaflet-marker-shadow,
      .leaflet-tile-container,
      .leaflet-zoom-box,
      .leaflet-image-layer,
      .leaflet-layer {
        position: absolute;
        top: 0;
        left: 0;
      }
      .leaflet-pane { z-index: 400; }
      .leaflet-tile-pane { z-index: 200; }
      .leaflet-overlay-pane { z-index: 400; }
      .leaflet-shadow-pane { z-index: 500; }
      .leaflet-marker-pane { z-index: 600; }
      .leaflet-tooltip-pane { z-index: 650; }
      .leaflet-popup-pane { z-index: 700; }
      .leaflet-map-pane canvas,
      .leaflet-map-pane svg { position: absolute; }
      .leaflet-tile { visibility: hidden; }
      .leaflet-tile-loaded { visibility: inherit; }
      .leaflet-zoom-box { box-sizing: border-box; z-index: 800; }
      .leaflet-control { position: relative; z-index: 800; pointer-events: auto; }
      .leaflet-top, .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
      .leaflet-top { top: 0; }
      .leaflet-bottom { bottom: 0; }
      .leaflet-left { left: 0; }
      .leaflet-right { right: 0; }
      .leaflet-top .leaflet-control { margin-top: 10px; }
      .leaflet-bottom .leaflet-control { margin-bottom: 10px; }
      .leaflet-left .leaflet-control { margin-left: 10px; }
      .leaflet-right .leaflet-control { margin-right: 10px; }
      .leaflet-control-zoom a {
        display: block;
        width: 26px;
        height: 26px;
        line-height: 26px;
        text-align: center;
        text-decoration: none;
        color: #252525;
        background: #fff;
        border-bottom: 1px solid #ccc;
      }
      .leaflet-control-zoom a:first-child { border-radius: 4px 4px 0 0; }
      .leaflet-control-zoom a:last-child { border-bottom: 0; border-radius: 0 0 4px 4px; }
      .leaflet-control-attribution {
        padding: 0 5px;
        color: #333;
        background: rgba(255, 255, 255, 0.75);
        font-size: 10px;
      }
      .leaflet-control-attribution a { color: inherit; }
    </style>
  </head>
  <body>
    <div id="map" aria-label="Venue map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const coordinates = [${coordinates.latitude}, ${coordinates.longitude}]
      const map = L.map('map', { zoomControl: true, attributionControl: true }).setView(coordinates, 15)
      L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>',
      }).addTo(map)
      let marker = L.marker(coordinates, { draggable: true }).addTo(map)
      const reportPin = (latlng) => window.parent.postMessage({
        source: 'multivent-maptiler',
        latitude: Number(latlng.lat.toFixed(6)),
        longitude: Number(latlng.lng.toFixed(6)),
      }, '*')
      marker.on('dragend', () => reportPin(marker.getLatLng()))
      map.on('click', (event) => {
        marker.setLatLng(event.latlng)
        reportPin(event.latlng)
      })
    </script>
  </body>
</html>`

// The configured MapTiler key is restricted to Multivent web origins. Native
// applications intentionally retain the existing local picker until a second
// key, restricted to the released mobile app's User-Agent, is provisioned.
export const hasMapTilerVenueMap = Platform.OS === 'web' && Boolean(mapTilerKey)

export const MapTilerVenueMap: React.FC<MapTilerVenueMapProps> = ({ coordinates, fullscreen = false, onPin }) => {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !mapTilerKey) return undefined
    const onMessage = (event: MessageEvent) => {
      if (!isMapMessage(event.data)) return
      onPin({ latitude: event.data.latitude, longitude: event.data.longitude })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onPin])

  if (!hasMapTilerVenueMap) return <View />

  return (
    <View style={[styles.container, fullscreen && styles.containerFullscreen]}>
      {React.createElement('iframe' as React.ElementType, {
        key: `${coordinates.latitude}-${coordinates.longitude}`,
        'aria-label': 'Interactive venue map',
        sandbox: 'allow-scripts allow-same-origin',
        srcDoc: mapDocument(coordinates),
        style: styles.frame,
        title: 'Interactive venue map',
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 250,
    overflow: 'hidden',
  },
  containerFullscreen: {
    height: undefined,
  },
  frame: {
    borderWidth: 0,
    display: 'flex',
    flex: 1,
    height: '100%',
    width: '100%',
  },
})
