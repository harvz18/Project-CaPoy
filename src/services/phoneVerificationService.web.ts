import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  linkWithCredential
} from "firebase/auth";
import { auth } from "./firebase";
import { postTrustedApi } from "./trustedApi";

export type PhoneVerificationStartResult = {
  automaticallyVerifiedCode?: string;
};

const recaptchaContainerId = "tasklink-phone-recaptcha";
let verificationId: string | undefined;
let verifier: RecaptchaVerifier | undefined;

function requirePhoneAuth() {
  if (!auth || !auth.currentUser) {
    throw new Error("Sign in before verifying your mobile number.");
  }
  return { auth };
}

function getVerifier(firebaseAuth: NonNullable<typeof auth>) {
  if (verifier) return verifier;
  if (typeof document === "undefined" || !document.getElementById(recaptchaContainerId)) {
    throw new Error("Phone verification is not ready. Reopen this screen and try again.");
  }
  verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerId, { size: "invisible" });
  return verifier;
}

export async function startPhoneVerification(phoneNumber: string, _forceResend = false): Promise<PhoneVerificationStartResult> {
  const { auth: firebaseAuth } = requirePhoneAuth();
  const provider = new PhoneAuthProvider(firebaseAuth);
  verificationId = await provider.verifyPhoneNumber(phoneNumber, getVerifier(firebaseAuth));
  return {};
}

export async function completePhoneVerification(code: string) {
  const { auth: firebaseAuth } = requirePhoneAuth();
  if (!verificationId) throw new Error("Request a verification code before continuing.");

  const credential = PhoneAuthProvider.credential(verificationId, code);
  try {
    await linkWithCredential(firebaseAuth.currentUser!, credential);
  } catch (error) {
    // A prior successful Firebase link can outlive a failed network call to the
    // trusted profile-sync Function. In that case, retry the safe server sync.
    if (!(typeof error === "object" && error && "code" in error && error.code === "auth/provider-already-linked")) {
      throw error;
    }
  }
  const result = await postTrustedApi<{ phoneNumber: string }>("/api/phone-verification/sync", {});
  verificationId = undefined;
  return result;
}

export function resetPhoneVerification() {
  verificationId = undefined;
  verifier?.clear();
  verifier = undefined;
}

export const phoneVerificationRecaptchaContainerId = recaptchaContainerId;
