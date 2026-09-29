import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

export async function submitVerificationRequest(input: {
  userId: string;
  validIdType: string;
  validIdPath: string;
  medicalCertificatePath: string;
}) {
  if (!input.validIdType.trim()) throw new Error("Choose or enter the valid ID type.");
  if (!input.validIdPath || !input.medicalCertificatePath) {
    throw new Error("Upload both a valid ID and medical certificate.");
  }

  const firestore = requireDb();
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);
  const profileUpdates = {
    validIdType: input.validIdType.trim(),
    validIdUrl: input.validIdPath,
    medicalCertificateUrl: input.medicalCertificatePath,
    verificationStatus: "Pending Verification" as const,
    updatedAt: now
  };
  batch.update(doc(firestore, "users", input.userId), profileUpdates);
  batch.set(doc(firestore, "workerProfiles", input.userId), { userId: input.userId, ...profileUpdates }, { merge: true });
  batch.update(doc(firestore, "publicProfiles", input.userId), {
    verificationStatus: "Pending Verification",
    updatedAt: now
  });
  batch.set(doc(firestore, "verificationRequests", input.userId), {
    userId: input.userId,
    validIdType: input.validIdType.trim(),
    validIdPath: input.validIdPath,
    medicalCertificatePath: input.medicalCertificatePath,
    status: "Pending Verification",
    submittedAt: now,
    updatedAt: now
  });
  await batch.commit();
}
