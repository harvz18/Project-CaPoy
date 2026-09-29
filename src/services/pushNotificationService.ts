import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const storedTokenDocumentKey = (userId: string) => `tasklink.pushTokenDocumentId.${userId}`;

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

function tokenDocumentId(userId: string, token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${userId}_${(hash >>> 0).toString(16)}`;
}

export async function configureNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("tasklink-updates", {
    name: "TASKLINK updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: "#005C55"
  });
}

export async function registerPushToken(userId: string) {
  if (Platform.OS === "web") {
    throw new Error("Push notifications are available in the Android app.");
  }

  await configureNotificationChannel();
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Notification permission was not granted. You can enable it in Android settings.");
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("The EAS project ID is missing from the app configuration.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const documentId = tokenDocumentId(userId, token);
  await setDoc(doc(requireDb(), "pushTokens", documentId), {
    userId,
    token,
    platform: Platform.OS,
    enabled: true,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  await AsyncStorage.setItem(storedTokenDocumentKey(userId), documentId);
  return token;
}

export async function disableCurrentPushToken(userId: string) {
  const storageKey = storedTokenDocumentKey(userId);
  const documentId = await AsyncStorage.getItem(storageKey);
  if (!documentId || !documentId.startsWith(`${userId}_`) || !db) return;
  try {
    await updateDoc(doc(db, "pushTokens", documentId), {
      enabled: false,
      updatedAt: new Date().toISOString()
    });
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // Keep the local document ID so a later logout can retry disabling this device token.
  }
}
