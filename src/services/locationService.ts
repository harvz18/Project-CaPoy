import * as Location from "expo-location";
import {
  LIVE_LOCATION_MIN_DISTANCE_METERS,
  LIVE_LOCATION_MIN_INTERVAL_MS,
  LocationReading,
  shouldAcceptLiveLocationUpdate
} from "../utils/location";

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
  source: "device";
};

export type ForegroundLocationIssueCode = "services-disabled" | "permission-denied" | "permission-blocked" | "unavailable";

export class ForegroundLocationWatchError extends Error {
  constructor(public readonly code: ForegroundLocationIssueCode, message: string) {
    super(message);
    this.name = "ForegroundLocationWatchError";
  }
}

export type ForegroundLocationSubscription = {
  remove: () => void;
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

function locationReading(position: Location.LocationObject): CapturedLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? undefined,
    capturedAt: new Date(position.timestamp).toISOString(),
    source: "device"
  };
}

function unavailableIssue(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error || "Location is unavailable.");
  return new ForegroundLocationWatchError(
    "unavailable",
    `Unable to update live location. Check GPS and try again. ${detail}`.trim()
  );
}

export async function startForegroundLocationWatch(
  onLocation: (location: CapturedLocation) => void,
  onError: (error: ForegroundLocationWatchError) => void
): Promise<ForegroundLocationSubscription> {
  if (!await Location.hasServicesEnabledAsync()) {
    throw new ForegroundLocationWatchError("services-disabled", "Location services are off. Turn on GPS, then retry.");
  }

  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw new ForegroundLocationWatchError(
      permission.canAskAgain ? "permission-denied" : "permission-blocked",
      permission.canAskAgain
        ? "Foreground location permission was not granted. Allow it, then retry."
        : "Location permission is blocked. Enable it in device settings, then retry."
    );
  }

  let lastAccepted: LocationReading | undefined;
  const emit = (position: Location.LocationObject) => {
    const next = locationReading(position);
    if (!shouldAcceptLiveLocationUpdate(lastAccepted, next)) return;
    lastAccepted = next;
    onLocation(next);
  };

  try {
    emit(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LIVE_LOCATION_MIN_INTERVAL_MS,
        distanceInterval: LIVE_LOCATION_MIN_DISTANCE_METERS,
        mayShowUserSettingsDialog: true
      },
      emit,
      (message) => onError(unavailableIssue(message))
    );
  } catch (error) {
    if (error instanceof ForegroundLocationWatchError) throw error;
    throw unavailableIssue(error);
  }
}
