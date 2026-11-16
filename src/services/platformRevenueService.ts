import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { PlatformFee } from "../types";
import { getTrustedApi, postTrustedApi } from "./trustedApi";

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
  const response = await getTrustedApi<{ config: PlatformRevenueConfig | null }>("/api/revenue/config");
  return response.config ?? undefined;
}

export async function savePlatformRevenueConfig(input: Required<Pick<PlatformRevenueConfig, "gcashAccountName" | "gcashNumber">> & Pick<PlatformRevenueConfig, "rateBasisPoints" | "instructions">) {
  await postTrustedApi("/api/revenue/config", { ...input, rateBasisPoints: input.rateBasisPoints ?? 500 });
}

export async function loadPlatformRevenueOverview() {
  return getTrustedApi<PlatformRevenueOverview>("/api/revenue/overview");
}

export function subscribeToPlatformFee(taskId: string, onChange: (fee: PlatformFee | undefined) => void, onError: (error: Error) => void) {
  if (!db) { onChange(undefined); return () => undefined; }
  return onSnapshot(doc(db, "platformFees", taskId), (snapshot) => onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as PlatformFee) : undefined), onError);
}

export async function submitPlatformFeePayment(taskId: string, receiptPath: string, transactionReference: string) {
  await postTrustedApi("/api/revenue/fees/submit", { taskId, receiptPath, transactionReference: transactionReference.trim() });
}

export async function ensurePlatformFee(taskId: string) {
  await postTrustedApi("/api/revenue/fees/ensure", { taskId });
}
