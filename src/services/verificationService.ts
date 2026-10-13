import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured.");
  return db;
}

export async function submitVerificationRequest(input: {
  userId: string;
  role?: "worker" | "client";
  validIdType: string;
  validIdPath: string;
  medicalCertificatePath: string;
  policeClearancePath: string;
}) {
  if (!input.validIdType.trim()) throw new Error("Choose or enter the valid ID type.");
  if (!input.validIdPath || !input.medicalCertificatePath || !input.policeClearancePath) {
    throw new Error("Upload a valid ID, medical certificate, and police clearance before submitting.");
  }

  const firestore = requireDb();
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);
  const verificationUpdates = {
    validIdType: input.validIdType.trim(),
    validIdUrl: input.validIdPath,
    medicalCertificateUrl: input.medicalCertificatePath,
    policeClearanceUrl: input.policeClearancePath,
    verificationStatus: "Pending Verification" as const,
    updatedAt: now
  };
  batch.update(doc(firestore, "users", input.userId), {
    ...verificationUpdates,
    identityStatus: "Pending Approval"
  });
  batch.set(doc(firestore, input.role === "client" ? "clientProfiles" : "workerProfiles", input.userId), { userId: input.userId, ...verificationUpdates }, { merge: true });
  batch.update(doc(firestore, "publicProfiles", input.userId), {
    verificationStatus: "Pending Verification",
    updatedAt: now
  });
  batch.set(doc(firestore, "verificationRequests", input.userId), {
    userId: input.userId,
    validIdType: input.validIdType.trim(),
    validIdPath: input.validIdPath,
    medicalCertificatePath: input.medicalCertificatePath,
    policeClearancePath: input.policeClearancePath,
    status: "Pending Verification",
    submittedAt: now,
    updatedAt: now
  });
  await batch.commit();
}
