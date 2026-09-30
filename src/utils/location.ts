import { Task, UserProfile } from "../types";
import {
  DISCOVERY_LOCATION_MAX_AGE_MS as CORE_DISCOVERY_LOCATION_MAX_AGE_MS,
  DISCOVERY_MAX_DEVICE_ACCURACY_METERS as CORE_DISCOVERY_MAX_DEVICE_ACCURACY_METERS
} from "../../functions/matching";

export type Coordinates = {
  latitude?: number;
  longitude?: number;
};

export type LocationReading = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt: string;
};

const earthRadiusKm = 6371;
export const CHECK_IN_LOCATION_MAX_AGE_MS = 10 * 60 * 1000;
export const CHECK_IN_MAX_ACCURACY_METERS = 150;
export const DISCOVERY_LOCATION_MAX_AGE_MS = CORE_DISCOVERY_LOCATION_MAX_AGE_MS;
export const DISCOVERY_MAX_DEVICE_ACCURACY_METERS = CORE_DISCOVERY_MAX_DEVICE_ACCURACY_METERS;
export const LIVE_LOCATION_MIN_INTERVAL_MS = 5 * 1000;
export const LIVE_LOCATION_MIN_DISTANCE_METERS = 10;
export const LIVE_LOCATION_STALE_AFTER_MS = 20 * 1000;

export function parseCoordinate(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates) {
  if (!hasValidCoordinates(from) || !hasValidCoordinates(to)) {
    return undefined;
  }

  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getTaskDistanceKm(worker: UserProfile | null | undefined, task: Task) {
  return calculateDistanceKm(
    {
      latitude: worker?.currentLatitude,
      longitude: worker?.currentLongitude
    },
    {
      latitude: task.latitude,
      longitude: task.longitude
    }
  );
}

export function getTaskCheckDistanceKm(worker: UserProfile | null | undefined, task: Task) {
  return calculateDistanceKm({
    latitude: worker?.currentLatitude,
    longitude: worker?.currentLongitude
  }, {
    latitude: task.latitude,
    longitude: task.longitude
  });
}

export function isWorkerInsideTaskGeofence(worker: UserProfile | null | undefined, task: Task) {
  const distanceKm = getTaskCheckDistanceKm(worker, task);
  const radiusKm = (task.geofenceRadius ?? 0) / 1000;

  if (distanceKm === undefined || radiusKm <= 0) {
    return false;
  }

  return distanceKm <= radiusKm;
}

export function isTaskWithinPreferredRadius(worker: UserProfile | null | undefined, task: Task) {
  const distanceKm = getTaskDistanceKm(worker, task);
  const preferredRadiusKm = worker?.preferredRadiusKm;

  if (distanceKm === undefined || preferredRadiusKm === undefined || preferredRadiusKm <= 0) {
    return false;
  }

  return distanceKm <= preferredRadiusKm;
}

export function formatDistance(distanceKm: number | undefined) {
  if (distanceKm === undefined) {
    return "Distance unavailable";
  }

  return `${distanceKm.toFixed(1)} km away`;
}

export function shouldTrackTaskLocation(
  role: string | undefined,
  userId: string | undefined,
  workerId: string | undefined,
  status: Task["status"] | undefined
) {
  return role === "worker" && Boolean(userId) && userId === workerId &&
    (status === "Accepted" || status === "In Progress");
}

export function shouldAcceptLiveLocationUpdate(
  previous: LocationReading | undefined,
  next: LocationReading
) {
  if (!hasValidCoordinates(next)) return false;
  const nextTimestamp = new Date(next.capturedAt).getTime();
  if (!Number.isFinite(nextTimestamp)) return false;
  if (!previous) return true;

  const previousTimestamp = new Date(previous.capturedAt).getTime();
  if (!Number.isFinite(previousTimestamp) || nextTimestamp <= previousTimestamp) return false;
  const elapsed = nextTimestamp - previousTimestamp;
  const distanceMeters = (calculateDistanceKm(previous, next) ?? 0) * 1000;
  return elapsed >= LIVE_LOCATION_MIN_INTERVAL_MS || distanceMeters >= LIVE_LOCATION_MIN_DISTANCE_METERS;
}

export function getLiveLocationIssue(reading: LocationReading | undefined, now = Date.now()) {
  if (!reading || !hasValidCoordinates(reading)) {
    return "Waiting for a valid device location.";
  }
  const capturedAt = new Date(reading.capturedAt).getTime();
  const age = now - capturedAt;
  if (!Number.isFinite(capturedAt) || age < 0 || age > LIVE_LOCATION_STALE_AFTER_MS) {
    return "Live location is stale. Check GPS and retry.";
  }
  if (!Number.isFinite(reading.accuracyMeters)) {
    return "Location accuracy is unavailable. Start and finish checks still require an accurate reading.";
  }
  if ((reading.accuracyMeters as number) > CHECK_IN_MAX_ACCURACY_METERS) {
    return `Low location accuracy (about ${Math.round(reading.accuracyMeters as number)} meters). Move outdoors or retry.`;
  }
  return undefined;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function hasValidCoordinates(value: Coordinates): value is { latitude: number; longitude: number } {
  return Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    (value.latitude as number) >= -90 &&
    (value.latitude as number) <= 90 &&
    (value.longitude as number) >= -180 &&
    (value.longitude as number) <= 180;
}

export function isLocationFresh(updatedAt: string | undefined, now = Date.now()) {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= CHECK_IN_LOCATION_MAX_AGE_MS;
}

export function getDiscoveryLocationIssue(worker: UserProfile | null | undefined, now = Date.now()) {
  if (!hasValidCoordinates({ latitude: worker?.currentLatitude, longitude: worker?.currentLongitude })) {
    return "Set a valid discovery location to receive nearby job matches.";
  }
  const timestamp = worker?.locationUpdatedAt ? new Date(worker.locationUpdatedAt).getTime() : Number.NaN;
  const age = now - timestamp;
  if (!Number.isFinite(timestamp) || age < 0 || age > DISCOVERY_LOCATION_MAX_AGE_MS) {
    return "Your discovery location is stale. Refresh it to receive nearby job matches.";
  }
  if (worker?.locationSource !== "manual" && (
    worker?.locationSource !== "device" ||
    !Number.isFinite(worker.locationAccuracyMeters) ||
    (worker.locationAccuracyMeters as number) < 0 ||
    (worker.locationAccuracyMeters as number) > DISCOVERY_MAX_DEVICE_ACCURACY_METERS
  )) {
    return `Refresh with device accuracy within ${DISCOVERY_MAX_DEVICE_ACCURACY_METERS} meters.`;
  }
  if (!Number.isFinite(worker?.preferredRadiusKm) || (worker?.preferredRadiusKm as number) <= 0) {
    return "Choose a preferred discovery radius.";
  }
  return undefined;
}

export type GeofenceCheck = {
  allowed: boolean;
  distanceKm?: number;
  reason: string;
};

export function getGeofenceCheck(
  worker: UserProfile | null | undefined,
  task: Task,
  now = Date.now()
): GeofenceCheck {
  if (!hasValidCoordinates({ latitude: task.latitude, longitude: task.longitude }) || !task.geofenceRadius || task.geofenceRadius <= 0) {
    return { allowed: false, reason: "This task does not have a valid service-area pin." };
  }
  if (!hasValidCoordinates({ latitude: worker?.currentLatitude, longitude: worker?.currentLongitude })) {
    return { allowed: false, reason: "Capture your current device location before continuing." };
  }
  if (worker?.locationSource !== "device") {
    return { allowed: false, reason: "A device location is required for task check-in. Manual locations are for discovery only." };
  }
  if (!isLocationFresh(worker.locationUpdatedAt, now)) {
    return { allowed: false, reason: "Your device location is stale. Refresh it before continuing." };
  }
  if (!Number.isFinite(worker.locationAccuracyMeters) || (worker.locationAccuracyMeters as number) > CHECK_IN_MAX_ACCURACY_METERS) {
    return { allowed: false, reason: `Location accuracy must be within ${CHECK_IN_MAX_ACCURACY_METERS} meters.` };
  }

  const distanceKm = getTaskCheckDistanceKm(worker, task);
  const radiusKm = task.geofenceRadius / 1000;
  if (distanceKm === undefined || distanceKm > radiusKm) {
    return {
      allowed: false,
      distanceKm,
      reason: distanceKm === undefined
        ? "Unable to calculate your distance from the task."
        : `You are ${formatDistance(distanceKm)}. Move within ${task.geofenceRadius} meters of the task pin.`
    };
  }
  return { allowed: true, distanceKm, reason: `Device location is within the ${task.geofenceRadius}-meter task area.` };
}
