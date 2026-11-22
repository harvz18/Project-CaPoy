import { postTrustedApi } from "./trustedApi";

export type CashPinIssueResult = {
  ok: true;
  pin: string;
  expiresAt: string;
  reused: boolean;
};

export function markCashPaymentPaid(taskId: string) {
  return postTrustedApi<{ ok: true; status: "Awaiting Worker Confirmation"; alreadyMarked: boolean }>(
    "/api/payments/cash/mark-paid",
    { taskId }
  );
}

/** Only the assigned worker receives the PIN from this authenticated endpoint. */
export function acknowledgeCashPaymentReceived(taskId: string) {
  return postTrustedApi<CashPinIssueResult>("/api/payments/cash/acknowledge-receipt", { taskId });
}

export function verifyCashPaymentPin(taskId: string, pin: string) {
  return postTrustedApi<{ ok: true; status: "Verified" }>("/api/payments/cash/verify-pin", { taskId, pin });
}
