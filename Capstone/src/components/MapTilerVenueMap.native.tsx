import React from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export interface MapCoordinates {
  latitude: number
  longitude: number
}

interface MapTilerVenueMapProps {
  coordinates: MapCoordinates
  fullscreen?: boolean
  onPin: (coordinates: MapCoordinates) => void
  onUnavailable?: () => void
}

const mapTilerKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim() ?? ''
const hostedMapPageUrl = process.env.EXPO_PUBLIC_VENUE_MAP_PAGE_URL?.trim()
  || 'https://mobile.multivent.org/multivent-venue-map.html'

type MapMessage = {
  source: 'multivent-maptiler'
  latitude: number
  longitude: number
}

const parseMapMessage = (value: string): MapMessage | undefined => {
  try {
    const message = JSON.parse(value) as Record<string, unknown>
    if (message.source !== 'multivent-maptiler'
      || typeof message.latitude !== 'number'
      || !Number.isFinite(message.latitude)
      || typeof message.longitude !== 'number'
      || !Number.isFinite(message.longitude)) return undefined
    return { source: 'multivent-maptiler', latitude: message.latitude, longitude: message.longitude }
  } catch {
    return undefined
  }
}

const isMapFailureMessage = (value: string) => {
  try {
    const message = JSON.parse(value) as Record<string, unknown>
    return message.source === 'multivent-maptiler' && message.type === 'map-error'
  } catch {
    return false
  }
}

const sameCoordinates = (left: MapCoordinates, right: MapCoordinates) => (
  Math.abs(left.latitude - right.latitude) < 0.000001
  && Math.abs(left.longitude - right.longitude) < 0.000001
)

const mapUrl = (coordinates: MapCoordinates) => {
  const divider = hostedMapPageUrl.includes('?') ? '&' : '?'
  return `${hostedMapPageUrl}${divider}key=${encodeURIComponent(mapTilerKey)}&lat=${coordinates.latitude.toFixed(6)}&lng=${coordinates.longitude.toFixed(6)}`
}

// The hosted page is served from the same approved MULTIVENT web origin as
// the browser map. That lets the existing origin-restricted MapTiler key work
// in this map-only native WebView without exposing a second mobile key.
export const hasMapTilerVenueMap = Boolean(mapTilerKey && /^https:\/\//i.test(hostedMapPageUrl))

export const MapTilerVenueMap: React.FC<MapTilerVenueMapProps> = ({
  coordinates,
  fullscreen = false,
  onPin,
  onUnavailable,
}) => {
  const webViewRef = React.useRef<WebView<object>>(null)
  const initialMapUrlRef = React.useRef<string | null>(null)
  const lastPinnedCoordinatesRef = React.useRef<MapCoordinates | null>(null)
  const hasReportedUnavailableRef = React.useRef(false)

  if (!initialMapUrlRef.current) initialMapUrlRef.current = mapUrl(coordinates)

  const sendPinCommand = React.useCallback((recenter: boolean) => {
    const command = {
      action: 'set-pin',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      recenter,
      source: 'multivent-maptiler-command',
    }
    webViewRef.current?.injectJavaScript(
      `window.multiventSetPin && window.multiventSetPin(${JSON.stringify(command)}); true;`
    )
  }, [coordinates.latitude, coordinates.longitude])

  React.useEffect(() => {
    const wasPinnedInMap = lastPinnedCoordinatesRef.current
    if (wasPinnedInMap && sameCoordinates(wasPinnedInMap, coordinates)) {
      lastPinnedCoordinatesRef.current = null
      return
    }
    sendPinCommand(true)
  }, [coordinates, sendPinCommand])

  const onMessage = React.useCallback((event: WebViewMessageEvent) => {
    if (isMapFailureMessage(event.nativeEvent.data)) {
      if (!hasReportedUnavailableRef.current) {
        hasReportedUnavailableRef.current = true
        onUnavailable?.()
      }
      return
    }
    const message = parseMapMessage(event.nativeEvent.data)
    if (!message) return
    const nextCoordinates = { latitude: message.latitude, longitude: message.longitude }
    lastPinnedCoordinatesRef.current = nextCoordinates
    onPin(nextCoordinates)
  }, [onPin, onUnavailable])

  const handleLoadFailure = React.useCallback(() => {
    if (hasReportedUnavailableRef.current) return
    hasReportedUnavailableRef.current = true
    onUnavailable?.()
  }, [onUnavailable])

  if (!hasMapTilerVenueMap) return <View />

  return (
    <View style={[styles.container, fullscreen && styles.containerFullscreen]}>
      <WebView<object>
        accessibilityLabel="Interactive venue map"
        domStorageEnabled
        javaScriptEnabled
        onError={handleLoadFailure}
        onHttpError={handleLoadFailure}
        onLoad={() => sendPinCommand(false)}
        onMessage={onMessage}
        originWhitelist={['https://*']}
        ref={webViewRef}
        setSupportMultipleWindows={false}
        source={{ uri: initialMapUrlRef.current }}
        style={styles.webView}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, height: 250, overflow: 'hidden' },
  containerFullscreen: { height: undefined },
  webView: { backgroundColor: '#F7F3F2', flex: 1 },
})
