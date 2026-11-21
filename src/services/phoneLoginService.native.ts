import { PhoneAuthProvider, getAuth, signInWithCredential, verifyPhoneNumber } from "@react-native-firebase/auth";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "./firebase";
import { postPhoneLoginPreflight, postPhoneLoginSession } from "./trustedApi";

let verificationId: string | undefined;

export async function startPhoneLogin(phoneNumber: string) {
  // Do this before native Firebase starts a sign-in so unlinked numbers never
  // create a second Firebase account.
  await postPhoneLoginPreflight<{ ok: true }>(phoneNumber);
  const nativeAuth = getAuth();
  return new Promise<void>((resolve, reject) => {
    const listener = verifyPhoneNumber(nativeAuth, phoneNumber);
    listener.on("state_changed", (snapshot) => {
      if (snapshot.error) {
        reject(snapshot.error);
        return;
      }
      if (snapshot.state === "sent" || snapshot.state === "verified") {
        verificationId = snapshot.verificationId;
        resolve();
      }
    }, reject);
  });
}

export async function completePhoneLogin(code: string) {
  if (!verificationId) throw new Error("Request a verification code before continuing.");
  const credential = PhoneAuthProvider.credential(verificationId, code);
  const result = await signInWithCredential(getAuth(), credential);
  const idToken = await result.user.getIdToken();
  const session = await postPhoneLoginSession<{ customToken: string }>(idToken);
  if (!auth || !session.customToken) throw new Error("Unable to restore your TaskLink session.");
  const webSession = await signInWithCustomToken(auth, session.customToken);
  verificationId = undefined;
  return { localId: webSession.user.uid };
}

export function resetPhoneLogin() {
  verificationId = undefined;
}

export const phoneLoginRecaptchaContainerId = undefined;
