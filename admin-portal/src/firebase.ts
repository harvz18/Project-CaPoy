import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(config).every(Boolean);
const app = firebaseConfigured ? getApps()[0] ?? initializeApp(config) : undefined;

export const auth = app ? getAuth(app) : undefined;
export const db = app ? getFirestore(app) : undefined;
export const functions = app ? getFunctions(app, "asia-southeast1") : undefined;
export const storage = app ? getStorage(app) : undefined;
