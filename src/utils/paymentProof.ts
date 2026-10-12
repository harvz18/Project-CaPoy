export const firestorePaymentProofPrefix = "firestorePaymentProofs";
export const maxFirestorePaymentProofBytes = 5 * 1024 * 1024;
export const paymentProofChunkCharacters = 450_000;

export type PaymentProofParty = "client" | "worker";

export function createFirestorePaymentProofPath(taskId: string, party: PaymentProofParty) {
  return `${firestorePaymentProofPrefix}/${taskId}/${party}`;
}

export function parseFirestorePaymentProofPath(path: string) {
  const [prefix, taskId, party, ...extra] = path.split("/");
  if (
    prefix !== firestorePaymentProofPrefix ||
    !taskId ||
    (party !== "client" && party !== "worker") ||
    extra.length > 0
  ) {
    return undefined;
  }
  return { taskId, party } as const;
}

export function isPaymentProofPathForTask(taskId: string, path: string, party?: PaymentProofParty) {
  if (path.startsWith(`paymentProofs/${taskId}/`)) return true;
  const parsed = parseFirestorePaymentProofPath(path);
  return Boolean(parsed && parsed.taskId === taskId && (!party || parsed.party === party));
}

export function splitPaymentProofBase64(base64: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += paymentProofChunkCharacters) {
    chunks.push(base64.slice(offset, offset + paymentProofChunkCharacters));
  }
  return chunks;
}
