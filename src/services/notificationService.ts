import { addDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { AppNotification } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

export function subscribeToNotifications(
  userId: string | undefined,
  onChange: (notifications: AppNotification[]) => void,
  onError: (error: Error) => void
) {
  if (!db || !userId) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "notifications"), where("userId", "==", userId)),
    (snapshot) => {
      onChange(
        snapshot.docs
          .map((notificationDoc) => ({ id: notificationDoc.id, ...notificationDoc.data() }) as AppNotification)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    },
    onError
  );
}

export async function addNotification(notification: Omit<AppNotification, "id" | "readStatus" | "createdAt">) {
  const firestore = requireDb();

  await addDoc(collection(firestore, "notifications"), {
    ...notification,
    readStatus: false,
    createdAt: new Date().toISOString()
  });
}
