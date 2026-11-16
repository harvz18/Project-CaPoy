import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { PlatformFee } from "../types";

export type PlatformRevenueConfig = { enabled?: boolean; gcashAccountName?: string; gcashNumber?: string; rateBasisPoints?: number; instructions?: string; updatedAt?: string };
export type PlatformRevenueOverview = {
  revenueGeneratingCompletedTasks: number;
  totalCollectedCentavos: number;
  pendingPaymentCentavos: number;
  submittedForReviewCentavos: number;
  overdueCentavos: number;
  rejectedCentavos: number;
  byCategory: Array<{ category: string; feeCentavos: number }>;
  monthlyCollected: Array<{ month: string; feeCentavos: number }>;
  generatedAt: string;
};

export async function loadPlatformRevenueConfig() {
  if (!db) throw new Error("Firebase is not configured.");
  const snapshot = await getDoc(doc(db, "platformRevenue", "config"));
  return snapshot.exists() ? snapshot.data() as PlatformRevenueConfig : undefined;
}

export async function savePlatformRevenueConfig(input: Required<Pick<PlatformRevenueConfig, "gcashAccountName" | "gcashNumber">> & Pick<PlatformRevenueConfig, "rateBasisPoints" | "instructions">) {
  if (!functions) throw new Error("Firebase Functions are not configured.");
  await httpsCallable(functions, "updatePlatformRevenueConfig")({ ...input, rateBasisPoints: input.rateBasisPoints ?? 500 });
}

export async function loadPlatformRevenueOverview() {
  if (!functions) throw new Error("Firebase Functions are not configured.");
  const result = await httpsCallable<Record<string, never>, PlatformRevenueOverview>(functions, "getPlatformRevenueOverview")({});
  return result.data;
}

export function subscribeToPlatformFee(taskId: string, onChange: (fee: PlatformFee | undefined) => void, onError: (error: Error) => void) {
  if (!db) { onChange(undefined); return () => undefined; }
  return onSnapshot(doc(db, "platformFees", taskId), (snapshot) => onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PlatformFee) : undefined), onError);
}

export async function submitPlatformFeePayment(taskId: string, receiptPath: string, transactionReference: string) {
  if (!functions) throw new Error("Firebase Functions are not configured.");
  await httpsCallable(functions, "submitPlatformFeePayment")({ taskId, receiptPath, transactionReference: transactionReference.trim() });
}
