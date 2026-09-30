import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref } from "firebase/storage";
import {
  AuditLog,
  ModerationUser,
  Payment,
  Task,
  UserProfile,
  VerificationRequest,
  ViolationReport
} from "../types";
import { db, functions, storage } from "./firebase";

function requireAdminServices() {
  if (!db || !functions) throw new Error("Firebase administrator services are not configured.");
  return { db, functions };
}

export function subscribeToAdminData(
  onChange: (data: {
    verifications: VerificationRequest[];
    payments: Payment[];
    users: UserProfile[];
    tasks: Task[];
    auditLogs: AuditLog[];
  }) => void,
  onError: (error: Error) => void
) {
  const services = requireAdminServices();
  const state = {
    verifications: [] as VerificationRequest[], payments: [] as Payment[], users: [] as UserProfile[],
    tasks: [] as Task[], auditLogs: [] as AuditLog[]
  };
  const emit = () => onChange({ ...state });
  const unsubscribers = [
    onSnapshot(collection(services.db, "verificationRequests"), (snapshot) => {
      state.verifications = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as VerificationRequest);
      emit();
    }, onError),
    onSnapshot(collection(services.db, "payments"), (snapshot) => {
      state.payments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Payment);
      emit();
    }, onError),
    onSnapshot(collection(services.db, "publicProfiles"), (snapshot) => {
      state.users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as UserProfile);
      emit();
    }, onError),
    onSnapshot(collection(services.db, "tasks"), (snapshot) => {
      state.tasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Task);
      emit();
    }, onError),
    onSnapshot(collection(services.db, "auditLogs"), (snapshot) => {
      state.auditLogs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditLog);
      emit();
    }, onError)
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

async function callAdminFunction(name: string, data: Record<string, unknown>) {
  const callable = httpsCallable(requireAdminServices().functions, name);
  await callable(data);
}

export function reviewWorkerVerification(userId: string, decision: "Verified" | "Rejected" | "Needs Resubmission", reason: string) {
  return callAdminFunction("reviewWorkerVerification", { userId, decision, reason });
}

export function reviewPayment(taskId: string, decision: "Verified" | "Rejected", reason: string) {
  return callAdminFunction("reviewPaymentEvidence", { taskId, decision, reason });
}

export type SuperadminOverview = {
  users: ModerationUser[];
  reports: ViolationReport[];
  auditLogs: AuditLog[];
};

export async function loadSuperadminOverview() {
  const callable = httpsCallable<Record<string, never>, SuperadminOverview>(
    requireAdminServices().functions,
    "getSuperadminOverview"
  );
  const result = await callable({});
  return result.data;
}

export function moderateUserAccount(
  userId: string,
  accountStatus: "active" | "suspended",
  reason: string,
  evidenceReference = "",
  violationReportId = ""
) {
  return callAdminFunction("setUserAccountStatus", {
    userId,
    accountStatus,
    reason,
    evidenceReference,
    violationReportId
  });
}

export function correctLockedFullName(userId: string, fullName: string, reason: string, evidenceReference = "") {
  return callAdminFunction("correctLockedFullName", { userId, fullName, reason, evidenceReference });
}

export function submitViolationReport(input: {
  targetUserId: string;
  category: ViolationReport["category"];
  reason: string;
  evidenceReference?: string;
  taskId?: string;
}) {
  return callAdminFunction("submitViolationReport", input);
}

export function confirmCashPayment(taskId: string) {
  const callable = httpsCallable(requireAdminServices().functions, "confirmCashPaymentReceived");
  return callable({ taskId });
}

export function getPrivateFileUrl(path: string) {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return getDownloadURL(ref(storage, path));
}
