import { signInWithCustomToken } from "firebase/auth";
import { auth } from "./firebase";
import { checkSmsPhoneLogin, startSmsPhoneLogin } from "./trustedApi";

let requestId: string | undefined;

export async function startPhoneLogin(phoneNumber: string) {
  const result = await startSmsPhoneLogin<{ requestId: string }>(phoneNumber);
  if (!result.requestId) throw new Error("Unable to request a verification code. Please try again.");
  requestId = result.requestId;
}

export async function completePhoneLogin(code: string) {
  if (!requestId) throw new Error("Request a verification code before continuing.");
  if (!auth) throw new Error("Firebase is not configured. Please reopen the app and try again.");
  const result = await checkSmsPhoneLogin<{ customToken: string }>(requestId, code);
  if (!result.customToken) throw new Error("Unable to restore your TaskLink session.");
  const session = await signInWithCustomToken(auth, result.customToken);
  requestId = undefined;
  return { localId: session.user.uid };
}

export function resetPhoneLogin() {
  requestId = undefined;
}

export const phoneLoginRecaptchaContainerId = undefined;
