import {
  AuthError,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import type { Authority } from "../types";
import { authorityFromClaims } from "../domain/authority";
import { auth } from "./firebase";

export type AuthSession = {
  localId: string;
  email: string;
};

export function normalizeMobileNumber(mobileNumber: string) {
  const digits = mobileNumber.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `63${digits.slice(1)}`;
  }

  return `63${digits}`;
}

export function mobileNumberToEmail(mobileNumber: string) {
  return `${normalizeMobileNumber(mobileNumber)}@tasklink.local`;
}

function requireAuth() {
  if (!auth) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return auth;
}

export async function registerWithMobileNumber(mobileNumber: string, password?: string) {
  validatePassword(password);

  try {
    const credential = await createUserWithEmailAndPassword(
      requireAuth(),
      mobileNumberToEmail(mobileNumber),
      password as string
    );
    return toAuthSession(credential.user);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export async function loginWithMobileNumber(mobileNumber: string, password?: string) {
  validatePassword(password);

  try {
    const credential = await signInWithEmailAndPassword(
      requireAuth(),
      mobileNumberToEmail(mobileNumber),
      password as string
    );
    return toAuthSession(credential.user);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

export function subscribeToAuthState(
  onChange: (user: User | null) => void,
  onError: (error: Error) => void
) {
  if (!auth) {
    onChange(null);
    return () => undefined;
  }

  return onAuthStateChanged(auth, onChange, (error) => onError(new Error(getAuthErrorMessage(error))));
}

export async function logoutFromFirebase() {
  await signOut(requireAuth());
}

export async function getCurrentAuthority(user: User | null = auth?.currentUser ?? null, forceRefresh = false): Promise<Authority> {
  if (!user) return "user";
  const token = await user.getIdTokenResult(forceRefresh);
  return authorityFromClaims(token.claims);
}

export async function deleteCurrentAuthUser() {
  if (auth?.currentUser) {
    await deleteUser(auth.currentUser);
  }
}

function toAuthSession(user: User): AuthSession {
  return {
    localId: user.uid,
    email: user.email ?? ""
  };
}

function validatePassword(password?: string) {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

function getAuthErrorMessage(error: unknown) {
  const code = (error as AuthError | undefined)?.code;

  switch (code) {
    case "auth/email-already-in-use":
      return "This mobile number is already registered. Please log in instead.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Mobile number or password is incorrect.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/network-request-failed":
      return "Network unavailable. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait before trying again.";
    default:
      return "Unable to continue. Please try again.";
  }
}
