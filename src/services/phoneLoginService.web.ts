import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential
} from "firebase/auth";
import { auth } from "./firebase";
import { postPhoneLoginPreflight } from "./trustedApi";

const recaptchaContainerId = "tasklink-login-recaptcha";
let verificationId: string | undefined;
let verifier: RecaptchaVerifier | undefined;

function requirePhoneAuth() {
  if (!auth) throw new Error("Firebase is not configured. Please reopen the app and try again.");
  return auth;
}

function getVerifier(firebaseAuth: NonNullable<typeof auth>) {
  if (verifier) return verifier;
  if (typeof document === "undefined" || !document.getElementById(recaptchaContainerId)) {
    throw new Error("Phone verification is not ready. Reopen this screen and try again.");
  }
  verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerId, { size: "invisible" });
  return verifier;
}

export async function startPhoneLogin(phoneNumber: string) {
  // Only existing accounts with this provider already linked may continue.
  // This prevents Firebase from provisioning a separate phone-only account.
  await postPhoneLoginPreflight<{ ok: true }>(phoneNumber);
  const firebaseAuth = requirePhoneAuth();
  const provider = new PhoneAuthProvider(firebaseAuth);
  verificationId = await provider.verifyPhoneNumber(phoneNumber, getVerifier(firebaseAuth));
}

export async function completePhoneLogin(code: string) {
  const firebaseAuth = requirePhoneAuth();
  if (!verificationId) throw new Error("Request a verification code before continuing.");
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const result = await signInWithCredential(firebaseAuth, credential);
  verificationId = undefined;
  return { localId: result.user.uid };
}

export function resetPhoneLogin() {
  verificationId = undefined;
  verifier?.clear();
  verifier = undefined;
}

export const phoneLoginRecaptchaContainerId = recaptchaContainerId;
