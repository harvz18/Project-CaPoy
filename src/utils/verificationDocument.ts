import { paymentProofChunkCharacters } from "./paymentProof";

export const firestoreVerificationDocumentPrefix = "firestoreVerification";
export const maxFirestoreVerificationDocumentBytes = 5 * 1024 * 1024;
export type VerificationDocumentKind = "valid-id" | "medical-certificate" | "police-clearance";

export function createFirestoreVerificationDocumentPath(userId: string, kind: VerificationDocumentKind) {
  return `${firestoreVerificationDocumentPrefix}/${userId}/${kind}`;
}

export function parseFirestoreVerificationDocumentPath(path: string) {
  const [prefix, userId, kind, ...extra] = path.split("/");
  if (
    prefix !== firestoreVerificationDocumentPrefix ||
    !userId ||
    !isVerificationDocumentKind(kind) ||
    extra.length > 0
  ) return undefined;
  return { userId, kind } as const;
}

export function isVerificationDocumentKind(value: unknown): value is VerificationDocumentKind {
  return value === "valid-id" || value === "medical-certificate" || value === "police-clearance";
}

export function splitVerificationDocumentBase64(base64: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += paymentProofChunkCharacters) {
    chunks.push(base64.slice(offset, offset + paymentProofChunkCharacters));
  }
  return chunks;
}
