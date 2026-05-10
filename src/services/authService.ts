import { firebaseApiKey, hasFirebaseConfig } from "./firebase";

type FirebaseAuthResponse = {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
};

export type AuthSession = FirebaseAuthResponse;

const authBaseUrl = "https://identitytoolkit.googleapis.com/v1/accounts:";
const fallbackPassword = "tasklink123";

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

export function getAuthPassword(password?: string) {
  return password && password.length >= 6 ? password : fallbackPassword;
}

async function requestAuth(endpoint: "signUp" | "signInWithPassword", payload: Record<string, unknown>) {
  if (!hasFirebaseConfig || !firebaseApiKey) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  const response = await fetch(`${authBaseUrl}${endpoint}?key=${firebaseApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(getAuthErrorMessage(data?.error?.message));
  }

  return data as FirebaseAuthResponse;
}

export async function registerWithMobileNumber(mobileNumber: string, password?: string) {
  return requestAuth("signUp", {
    email: mobileNumberToEmail(mobileNumber),
    password: getAuthPassword(password),
    returnSecureToken: true
  });
}

export async function loginWithMobileNumber(mobileNumber: string, password?: string) {
  return requestAuth("signInWithPassword", {
    email: mobileNumberToEmail(mobileNumber),
    password: getAuthPassword(password),
    returnSecureToken: true
  });
}

function getAuthErrorMessage(code?: string) {
  switch (code) {
    case "EMAIL_EXISTS":
      return "This mobile number is already registered. Please log in instead.";
    case "EMAIL_NOT_FOUND":
    case "INVALID_LOGIN_CREDENTIALS":
    case "INVALID_PASSWORD":
      return "Mobile number or password is incorrect.";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
      return "Password should be at least 6 characters.";
    default:
      return "Unable to continue. Please try again.";
  }
}
