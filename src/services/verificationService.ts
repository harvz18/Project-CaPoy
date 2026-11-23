import { doc, onSnapshot } from "firebase/firestore";
import type { VerificationRequest } from "../types";
import { db } from "./firebase";
import { postTrustedApi } from "./trustedApi";

export function subscribeToVerificationRequest(
  userId: string,
  onChange: (request: VerificationRequest | undefined) => void,
  onError?: (error: Error) => void
) {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, "verificationRequests", userId), (snapshot) => {
    onChange(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as VerificationRequest : undefined);
  }, (error) => onError?.(error));
}

/** Refreshes trusted public progress after a profile-picture upload. */
export async function refreshVerificationProgress() {
  await postTrustedApi("/api/verification/progress/refresh", {});
}

export async function submitVerificationRequest(input: {
  userId: string;
  role?: "worker" | "client";
  validIdType: string;
  validIdPath: string;
  selfieWithIdPath: string;
  medicalCertificatePath?: string;
  policeClearancePath?: string;
}) {
  if (!input.validIdType.trim()) throw new Error("Choose or enter the valid ID type.");
  if (!input.validIdPath || !input.selfieWithIdPath) {
    throw new Error("Upload a valid ID and a selfie holding that same ID before submitting.");
  }

  await postTrustedApi("/api/verification/submit", {
    validIdType: input.validIdType.trim(),
    validIdPath: input.validIdPath,
    selfieWithIdPath: input.selfieWithIdPath,
    ...(input.medicalCertificatePath ? { medicalCertificatePath: input.medicalCertificatePath } : {}),
    ...(input.policeClearancePath ? { policeClearancePath: input.policeClearancePath } : {})
  });
}

/** Completes an approved legacy verification without allowing evidence replacement. */
export async function submitMissingVerificationDocuments(input: {
  validIdType: string;
  validIdPath: string;
  selfieWithIdPath: string;
  medicalCertificatePath: string;
  policeClearancePath: string;
}) {
  await postTrustedApi("/api/verification/complete-missing", input);
}
