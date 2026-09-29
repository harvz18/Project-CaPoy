import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { firebaseApp } from "./firebaseCore";

export { hasFirebaseConfig } from "./firebaseCore";

export const auth = firebaseApp ? getAuth(firebaseApp) : undefined;
export const db = firebaseApp ? getFirestore(firebaseApp) : undefined;
export const storage = firebaseApp ? getStorage(firebaseApp) : undefined;
export const functions = firebaseApp ? getFunctions(firebaseApp, "asia-southeast1") : undefined;
