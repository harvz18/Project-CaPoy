import { Task, UserProfile } from "../types";

export type Coordinates = {
  latitude?: number;
  longitude?: number;
};

const earthRadiusKm = 6371;
const defaultWorkerLatitude = 10.6765;
const defaultWorkerLongitude = 122.9509;

export function parseCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates) {
  if (
    from.latitude === undefined ||
    from.longitude === undefined ||
    to.latitude === undefined ||
    to.longitude === undefined
  ) {
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
  const workerCoordinates = getWorkerCheckCoordinates(worker, task);

  return calculateDistanceKm(workerCoordinates, {
    latitude: task.latitude,
    longitude: task.longitude
  });
}

export function isWorkerInsideTaskGeofence(worker: UserProfile | null | undefined, task: Task) {
  const distanceKm = getTaskCheckDistanceKm(worker, task);
  const radiusKm = (task.geofenceRadius ?? 0) / 1000;

  if (distanceKm === undefined || radiusKm <= 0) {
    return true;
  }

  return distanceKm <= radiusKm;
}

export function isTaskWithinPreferredRadius(worker: UserProfile | null | undefined, task: Task) {
  const distanceKm = getTaskDistanceKm(worker, task);
  const preferredRadiusKm = worker?.preferredRadiusKm;

  if (distanceKm === undefined || preferredRadiusKm === undefined || preferredRadiusKm <= 0) {
    return true;
  }

  return distanceKm <= preferredRadiusKm;
}

export function formatDistance(distanceKm: number | undefined) {
  if (distanceKm === undefined) {
    return "Distance not set";
  }

  return `${distanceKm.toFixed(1)} km away`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getWorkerCheckCoordinates(worker: UserProfile | null | undefined, task: Task) {
  const workerLatitude = worker?.currentLatitude;
  const workerLongitude = worker?.currentLongitude;
  const hasTaskCoordinates = task.latitude !== undefined && task.longitude !== undefined;
  const isUsingDefaultWorkerLocation =
    workerLatitude === defaultWorkerLatitude && workerLongitude === defaultWorkerLongitude;

  if (hasTaskCoordinates && isUsingDefaultWorkerLocation) {
    return {
      latitude: task.latitude,
      longitude: task.longitude
    };
  }

  return {
    latitude: workerLatitude,
    longitude: workerLongitude
  };
}
