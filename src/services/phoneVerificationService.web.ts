import { checkSmsProfilePhoneVerification, startSmsProfilePhoneVerification } from "./trustedApi";

export type PhoneVerificationStartResult = {
  automaticallyVerifiedCode?: string;
};

let requestId: string | undefined;

export async function startPhoneVerification(phoneNumber: string, _forceResend = false): Promise<PhoneVerificationStartResult> {
  const result = await startSmsProfilePhoneVerification<{ requestId: string }>(phoneNumber);
  if (!result.requestId) throw new Error("Unable to request a verification code. Please try again.");
  requestId = result.requestId;
  return {};
}

export async function completePhoneVerification(code: string) {
  if (!requestId) throw new Error("Request a verification code before continuing.");
  const result = await checkSmsProfilePhoneVerification<{ phoneNumber: string }>(requestId, code);
  requestId = undefined;
  return result;
}

export function resetPhoneVerification() {
  requestId = undefined;
}

export const phoneVerificationRecaptchaContainerId = undefined;
