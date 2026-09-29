import { addDoc, collection, onSnapshot, query, where } from "firebase/firestore";
import { AppNotification } from "../types";
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
