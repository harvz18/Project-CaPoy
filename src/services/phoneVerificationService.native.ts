import { PhoneAuthProvider, getAuth, linkWithCredential, signInWithCustomToken, signOut, verifyPhoneNumber } from "@react-native-firebase/auth";
import { postTrustedApi } from "./trustedApi";

export type PhoneVerificationStartResult = {
  automaticallyVerifiedCode?: string;
};

let verificationId: string | undefined;

async function signInNativeSessionForCurrentUser() {
  const result = await postTrustedApi<{ customToken: string }>("/api/phone-verification/native-session", {});
  if (!result.customToken) throw new Error("Unable to prepare phone verification.");
  const nativeAuth = getAuth();
  await signInWithCustomToken(nativeAuth, result.customToken);
  return nativeAuth;
}

export async function startPhoneVerification(phoneNumber: string, forceResend = false): Promise<PhoneVerificationStartResult> {
  const nativeAuth = await signInNativeSessionForCurrentUser();

  return new Promise((resolve, reject) => {
    const listener = verifyPhoneNumber(nativeAuth, phoneNumber, forceResend);
    listener.on("state_changed", (snapshot) => {
      if (snapshot.error) {
        reject(snapshot.error);
        return;
      }
      if (snapshot.state === "sent" || snapshot.state === "verified") {
        verificationId = snapshot.verificationId;
        resolve({ automaticallyVerifiedCode: snapshot.code ?? undefined });
      }
    }, reject);
  });
}

export async function completePhoneVerification(code: string) {
  if (!verificationId) throw new Error("Request a verification code before continuing.");
  const nativeAuth = getAuth();
  if (!nativeAuth.currentUser) throw new Error("Your verification session expired. Request a new code.");

  const credential = PhoneAuthProvider.credential(verificationId, code);
  try {
    await linkWithCredential(nativeAuth.currentUser, credential);
  } catch (error) {
    // A prior successful Firebase link can outlive a failed network call to the
    // trusted profile-sync Function. In that case, retry the safe server sync.
    if (!(typeof error === "object" && error && "code" in error && error.code === "auth/provider-already-linked")) {
      throw error;
    }
  }
  const result = await postTrustedApi<{ phoneNumber: string }>("/api/phone-verification/sync", {});
  verificationId = undefined;
  await signOut(nativeAuth).catch(() => undefined);
  return result;
}

export function resetPhoneVerification() {
  verificationId = undefined;
}

export const phoneVerificationRecaptchaContainerId = undefined;
