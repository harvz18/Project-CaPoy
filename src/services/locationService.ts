import * as Location from "expo-location";

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
  source: "device";
};

export async function captureForegroundLocation(): Promise<CapturedLocation> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error("Location services are off. Turn them on, then try again.");
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new Error(
      permission.canAskAgain
        ? "Location permission was not granted. You can enter a manual location for discovery."
        : "Location permission is blocked. Enable it in device settings to use task check-in."
    );
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? undefined,
    capturedAt: new Date(position.timestamp).toISOString(),
    source: "device"
  };
}
