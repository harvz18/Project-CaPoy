import AsyncStorage from "@react-native-async-storage/async-storage";
// Firebase exposes this helper from its React Native entry point at bundle time,
// but v10's platform-neutral TypeScript declaration omits the named export.
// @ts-expect-error React Native conditional export provided by @firebase/auth.
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { firebaseApp } from "./firebaseCore";

export { hasFirebaseConfig } from "./firebaseCore";

function createAuth() {
  if (!firebaseApp) {
    return undefined;
  }

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch {
    // Fast Refresh can evaluate this module after Auth has already been initialized.
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = firebaseApp ? getFirestore(firebaseApp) : undefined;
export const storage = firebaseApp ? getStorage(firebaseApp) : undefined;
export const functions = firebaseApp ? getFunctions(firebaseApp, "asia-southeast1") : undefined;
