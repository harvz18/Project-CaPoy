import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { AppNotification, NotificationPreferences } from "../types";
import { auth, db } from "./firebase";

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

type NotificationInput = Omit<AppNotification, "id" | "readStatus" | "createdAt" | "createdBy"> & {
  taskId: string;
};

export async function addNotification(notification: NotificationInput) {
  const firestore = requireDb();
  const currentAuthUser = auth?.currentUser;

  if (!currentAuthUser) {
    throw new Error("Please log in before sending notifications.");
  }

  await addDoc(collection(firestore, "notifications"), {
    ...notification,
    createdBy: currentAuthUser.uid,
    readStatus: false,
    createdAt: new Date().toISOString()
  });
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(requireDb(), "notifications", notificationId), { readStatus: true });
}

export async function markNotificationOpened(notificationId: string) {
  await updateDoc(doc(requireDb(), "notifications", notificationId), {
    readStatus: true,
    openedAt: new Date().toISOString()
  });
}

export async function recordMatchingApplication(taskId: string, userId: string) {
  const firestore = requireDb();
  const notificationRef = doc(firestore, "notifications", `${taskId}_nearby_${userId}`);
  const snapshot = await getDoc(notificationRef);
  if (!snapshot.exists() || snapshot.data().userId !== userId || snapshot.data().notificationType !== "Matching task") {
    return;
  }
  await updateDoc(notificationRef, { applicationConvertedAt: new Date().toISOString() });
}

export async function markAllNotificationsRead(notifications: AppNotification[]) {
  const unread = notifications.filter((notification) => !notification.readStatus);
  if (!unread.length) return;
  const firestore = requireDb();
  for (let offset = 0; offset < unread.length; offset += 450) {
    const batch = writeBatch(firestore);
    unread.slice(offset, offset + 450).forEach((notification) => {
      batch.update(doc(firestore, "notifications", notification.id), { readStatus: true });
    });
    await batch.commit();
  }
}

export const defaultNotificationPreferences: NotificationPreferences = {
  pushEnabled: false,
  messagesEnabled: true,
  taskUpdatesEnabled: true,
  matchingEnabled: true
};

export function subscribeToNotificationPreferences(
  userId: string,
  onChange: (preferences: NotificationPreferences) => void,
  onError: (error: Error) => void
) {
  if (!db || !userId) {
    onChange(defaultNotificationPreferences);
    return () => undefined;
  }

  return onSnapshot(doc(db, "notificationPreferences", userId), (snapshot) => {
    onChange(snapshot.exists()
      ? { ...defaultNotificationPreferences, ...snapshot.data() } as NotificationPreferences
      : defaultNotificationPreferences);
  }, onError);
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  await setDoc(doc(requireDb(), "notificationPreferences", userId), {
    ...preferences,
    userId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}
