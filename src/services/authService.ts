import {
  AuthError,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
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

export type EmailVerificationState = {
  available: boolean;
  email?: string;
  verified: boolean;
  reason?: "signed-out" | "mobile-alias" | "no-email";
};

const mobileAliasDomain = "@tasklink.local";

export function isTasklinkMobileAlias(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith(mobileAliasDomain));
}

export function getEmailVerificationState(user: User | null | undefined = auth?.currentUser): EmailVerificationState {
  if (!user) return { available: false, verified: false, reason: "signed-out" };
  if (!user.email) return { available: false, verified: false, reason: "no-email" };
  if (isTasklinkMobileAlias(user.email)) return { available: false, verified: false, reason: "mobile-alias" };
  return { available: true, email: user.email, verified: user.emailVerified };
}

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

/** Sends Firebase's signed email-action link. This never creates or validates a client OTP. */
export async function sendCurrentEmailVerification() {
  const firebaseAuth = requireAuth();
  const state = getEmailVerificationState(firebaseAuth.currentUser);
  if (!state.available) {
    throw new Error(state.reason === "mobile-alias"
      ? "Email verification is unavailable for mobile-password accounts because they do not have a deliverable email address."
      : "Sign in to an email-based account before requesting verification.");
  }
  if (state.verified) return state;

  try {
    await sendEmailVerification(firebaseAuth.currentUser as User);
    return state;
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

/** Reloads the Firebase user record so emailVerified comes from Firebase, not local UI state. */
export async function refreshCurrentEmailVerification() {
  const firebaseAuth = requireAuth();
  if (!firebaseAuth.currentUser) return getEmailVerificationState(null);

  try {
    await reload(firebaseAuth.currentUser);
    await firebaseAuth.currentUser.getIdToken(true);
    return getEmailVerificationState(firebaseAuth.currentUser);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}

/**
 * Requests Firebase's password-reset email without revealing whether an email
 * account exists. Mobile-password aliases are deliberately rejected because
 * their generated @tasklink.local address cannot receive mail.
 */
export async function requestPasswordResetForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isDeliverableEmail(normalizedEmail)) {
    throw new Error("Enter the real email address used to sign in. Mobile-password accounts cannot receive an email reset link.");
  }

  try {
    await sendPasswordResetEmail(requireAuth(), normalizedEmail);
  } catch (error) {
    const code = (error as AuthError | undefined)?.code;
    if (code !== "auth/user-not-found" && code !== "auth/invalid-email") {
      throw new Error(getAuthErrorMessage(error));
    }
  }
}

export function isDeliverableEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) && !isTasklinkMobileAlias(normalizedEmail);
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

export function getAuthErrorMessage(error: unknown) {
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
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled for this Firebase project.";
    case "auth/configuration-not-found":
      return "Firebase Authentication is not fully configured for this app.";
    case "auth/invalid-api-key":
    case "auth/app-not-authorized":
      return "This Expo session has an invalid Firebase configuration. Restart the development server after checking its .env file.";
    case "auth/network-request-failed":
      return "Network unavailable. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait before trying again.";
    case "auth/requires-recent-login":
      return "Please sign in again before changing this security setting.";
    case "auth/user-token-expired":
      return "Your session expired. Please sign in again.";
    case "auth/unauthorized-continue-uri":
    case "auth/invalid-continue-uri":
      return "Firebase email links are not configured for this app yet. Contact support.";
    default:
      return "Unable to continue. Please try again.";
  }
}
