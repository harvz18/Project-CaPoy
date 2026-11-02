import { Linking } from 'react-native'

export type EventLocation = {
  address?: string
  latitude?: number
  longitude?: number
}

const validCoordinate = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum

export const canOpenEventLocation = (location: EventLocation) =>
  (validCoordinate(location.latitude, -90, 90) && validCoordinate(location.longitude, -180, 180))
  || Boolean(location.address?.trim())

export const openEventLocation = async (location: EventLocation) => {
  const url = validCoordinate(location.latitude, -90, 90) && validCoordinate(location.longitude, -180, 180)
    ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`
    : location.address?.trim()
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address.trim())}`
      : undefined
  if (!url) return false
  return Linking.openURL(url)
    .then(() => true)
    .catch(() => false)
}
