import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { PlatformFee, PlatformFeeStatus } from "../types";
import { getTrustedApi, postTrustedApi } from "./trustedApi";

export type PlatformRevenueConfig = { enabled?: boolean; gcashAccountName?: string; gcashNumber?: string; gcashQrImageUrl?: string; rateBasisPoints?: number; instructions?: string; updatedAt?: string };
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
export type TaskPostingFeeEligibility = {
  allowed: boolean;
  message: string;
  outstandingFee: { taskId: string; taskTitle: string; status: PlatformFeeStatus; feeAmount: string } | null;
};
export type TaskFeeProgressionEligibility = { allowed: boolean; message: string; status?: PlatformFeeStatus };

export async function loadPlatformRevenueConfig() {
  const response = await getTrustedApi<{ config: PlatformRevenueConfig | null }>("/api/revenue/config");
  return response.config ?? undefined;
}

export async function savePlatformRevenueConfig(input: Required<Pick<PlatformRevenueConfig, "gcashAccountName" | "gcashNumber">> & Pick<PlatformRevenueConfig, "gcashQrImageUrl" | "rateBasisPoints" | "instructions">) {
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

export function checkTaskPostingFeeEligibility() {
  return postTrustedApi<TaskPostingFeeEligibility>("/api/revenue/fees/posting-eligibility", {});
}

export function checkTaskFeeProgressionEligibility(taskId: string) {
  return postTrustedApi<TaskFeeProgressionEligibility>("/api/revenue/fees/progression-eligibility", { taskId });
}
