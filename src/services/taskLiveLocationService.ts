import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { CapturedLocation } from "./locationService";
import { db } from "./firebase";
import { TaskLiveLocation } from "../types";
import { hasValidCoordinates } from "../utils/location";

const LIVE_LOCATION_DOCUMENT_ID = "current";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

function liveLocationRef(taskId: string) {
  return doc(requireDb(), "tasks", taskId, "liveLocation", LIVE_LOCATION_DOCUMENT_ID);
}

/** Shares only the assigned worker's foreground location with this task's participants. */
export async function publishTaskLiveLocation(taskId: string, workerId: string, location: CapturedLocation) {
  if (!taskId || !workerId || !hasValidCoordinates(location) || !Number.isFinite(location.accuracyMeters) || (location.accuracyMeters ?? 0) < 0) {
    throw new Error("A valid device location is required to share task progress.");
  }

  const payload: TaskLiveLocation = {
    workerId,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracyMeters as number,
    capturedAt: location.capturedAt,
    updatedAt: location.capturedAt
  };
  await setDoc(liveLocationRef(taskId), payload);
}

export async function clearTaskLiveLocation(taskId: string) {
  if (!taskId || !db) return;
  await deleteDoc(liveLocationRef(taskId));
}

export function subscribeToTaskLiveLocation(
  taskId: string,
  onChange: (location: TaskLiveLocation | undefined) => void,
  onError: (error: Error) => void
) {
  if (!taskId || !db) {
    onChange(undefined);
    return () => undefined;
  }

  return onSnapshot(
    liveLocationRef(taskId),
    (snapshot) => onChange(snapshot.exists() ? snapshot.data() as TaskLiveLocation : undefined),
    onError
  );
}
