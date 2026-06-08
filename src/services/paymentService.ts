import { doc, setDoc } from "firebase/firestore";
import { PaymentMethod, PaymentStatus } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

function withoutUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export async function savePaymentMethod(taskId: string, clientId: string, paymentMethod: PaymentMethod, workerId?: string) {
  const firestore = requireDb();

  await setDoc(
    doc(firestore, "payments", taskId),
    {
      id: taskId,
      taskId,
      clientId,
      ...withoutUndefined({ workerId }),
      paymentMethod,
      paymentStatus: "Pending",
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

export async function savePaymentVerification(
  taskId: string,
  paymentStatus: PaymentStatus,
  proofOfPaymentText?: string,
  proofOfPaymentUrl?: string
) {
  const firestore = requireDb();

  await setDoc(
    doc(firestore, "payments", taskId),
    {
      id: taskId,
      taskId,
      paymentStatus,
      ...withoutUndefined({ proofOfPaymentText, proofOfPaymentUrl }),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}
