import * as Location from "expo-location";
import { Platform } from "react-native";
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

const webLocationOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000
};
const WEB_LOCATION_POLL_INTERVAL_MS = 10_000;

function browserGeolocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new ForegroundLocationWatchError(
      "unavailable",
      "Location is not available in this browser. Open TaskLink over HTTPS in a browser that supports location, or continue on a phone with GPS."
    );
  }
  return navigator.geolocation;
}

function browserLocationIssue(error: GeolocationPositionError | unknown) {
  const positionError = error && typeof error === "object" && "code" in error
    ? error as GeolocationPositionError
    : undefined;
  if (positionError) {
    if (positionError.code === 1) {
      return new ForegroundLocationWatchError(
        "permission-blocked",
        "Location access is blocked for this site. Allow precise location in your browser's site settings, then retry."
      );
    }
    if (positionError.code === 3) {
      return new ForegroundLocationWatchError(
        "unavailable",
        "The browser timed out while finding this computer. Check Windows Location Services and browser location access, then retry or continue on a phone with GPS."
      );
    }
  }

  const detail = error instanceof Error ? error.message : "The browser could not determine this computer's location.";
  return new ForegroundLocationWatchError(
    "unavailable",
    `${detail} Check device and browser location settings, then retry or continue on a phone with GPS.`
  );
}

function browserLocationReading(position: GeolocationPosition): CapturedLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    // Browsers can return a cached sensor timestamp even after a fresh request.
    // The retrieval time is what matters to the foreground freshness indicator.
    capturedAt: new Date().toISOString(),
    source: "device"
  };
}

function requestBrowserLocation() {
  return new Promise<CapturedLocation>((resolve, reject) => {
    browserGeolocation().getCurrentPosition(
      (position) => resolve(browserLocationReading(position)),
      (error) => reject(browserLocationIssue(error)),
      webLocationOptions
    );
  });
}

export async function captureForegroundLocation(): Promise<CapturedLocation> {
  if (Platform.OS === "web") {
    return requestBrowserLocation();
  }

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
        ? "Location permission was not granted. Allow it to start or finish a task."
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
  if (Platform.OS === "web") {
    let lastAccepted: LocationReading | undefined;
    let removed = false;
    let polling = false;
    const emit = (next: CapturedLocation) => {
      if (removed || !shouldAcceptLiveLocationUpdate(lastAccepted, next)) return;
      lastAccepted = next;
      onLocation(next);
    };
    const geolocation = browserGeolocation();

    try {
      emit(await requestBrowserLocation());
    } catch (error) {
      throw error instanceof ForegroundLocationWatchError ? error : browserLocationIssue(error);
    }

    const watchId = geolocation.watchPosition(
      (position) => emit(browserLocationReading(position)),
      (error) => {
        const issue = browserLocationIssue(error);
        if (issue.code === "permission-blocked") onError(issue);
      },
      webLocationOptions
    );
    const pollTimer = window.setInterval(() => {
      if (removed || polling) return;
      polling = true;
      requestBrowserLocation()
        .then(emit)
        .catch((error: unknown) => {
          const issue = error instanceof ForegroundLocationWatchError ? error : browserLocationIssue(error);
          if (issue.code === "permission-blocked") onError(issue);
        })
        .finally(() => {
          polling = false;
        });
    }, WEB_LOCATION_POLL_INTERVAL_MS);

    return {
      remove: () => {
        if (removed) return;
        removed = true;
        window.clearInterval(pollTimer);
        geolocation.clearWatch(watchId);
      }
    };
  }

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
    emit(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
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
