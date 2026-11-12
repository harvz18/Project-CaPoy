import { collection, documentId, DocumentData, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, QueryConstraint, QueryDocumentSnapshot, startAfter, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref } from "firebase/storage";
import { db, functions, storage } from "./firebase";
import { Analytics, AuditLog, BasicDashboardCounts, Payment, Profile, Rating, SuperadminOverview, Task, TaskMatch, VerificationRequest } from "./types";

function requireServices() { if (!db || !functions) throw new Error("Firebase is not configured."); return { db, functions }; }
function records<T>(snapshot: { docs: QueryDocumentSnapshot<DocumentData>[] }) { return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T); }

export type Page<T> = { items: T[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean };
export async function loadPage<T>(name: string, orderField: string, size = 20, cursor: QueryDocumentSnapshot<DocumentData> | null = null): Promise<Page<T>> {
  const { db: store } = requireServices();
  const clauses: QueryConstraint[] = [orderBy(orderField), limit(size + 1)];
  if (cursor) clauses.splice(1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(collection(store, name), ...clauses));
  const docs = snapshot.docs.slice(0, size);
  return { items: records<T>({ docs }), cursor: docs.at(-1) ?? null, hasMore: snapshot.docs.length > size };
}

async function loadRecordsById<T>(name: string, ids: string[]) {
  const { db: store } = requireServices();
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = Array.from({ length: Math.ceil(unique.length / 30) }, (_, index) => unique.slice(index * 30, index * 30 + 30));
  const snapshots = await Promise.all(chunks.map((idsInChunk) => getDocs(query(collection(store, name), where(documentId(), "in", idsInChunk)))));
  return snapshots.flatMap((snapshot) => records<T>(snapshot));
}

export async function loadProfilesById(ids: string[]) {
  const profiles = await loadRecordsById<Profile>("publicProfiles", ids);
  return Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
}

export async function loadTasksById(ids: string[]) {
  const tasks = await loadRecordsById<Task>("tasks", ids);
  return Object.fromEntries(tasks.map((task) => [task.id, task]));
}

export async function loadSubmittedPayments() {
  const { db: store } = requireServices();
  const snapshot = await getDocs(query(collection(store, "payments"), where("paymentStatus", "==", "Submitted"), limit(100)));
  return records<Payment>(snapshot);
}
export async function getBasicDashboardCounts(): Promise<BasicDashboardCounts> {
  const { db: store } = requireServices();
  const activeStatuses = ["Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval"];
  const [users, employers, taskers, tasks, activeTasks, completedTasks, paymentRecords, submittedPayments, pendingVerifications] = await Promise.all([
    getCountFromServer(collection(store, "publicProfiles")),
    getCountFromServer(query(collection(store, "publicProfiles"), where("role", "==", "client"))),
    getCountFromServer(query(collection(store, "publicProfiles"), where("role", "==", "worker"))),
    getCountFromServer(collection(store, "tasks")),
    getCountFromServer(query(collection(store, "tasks"), where("status", "in", activeStatuses))),
    getCountFromServer(query(collection(store, "tasks"), where("status", "==", "Finished"))),
    getCountFromServer(collection(store, "payments")),
    getCountFromServer(query(collection(store, "payments"), where("paymentStatus", "==", "Submitted"))),
    getCountFromServer(query(collection(store, "verificationRequests"), where("status", "==", "Pending Verification")))
  ]);
  return { users: users.data().count, employers: employers.data().count, taskers: taskers.data().count, tasks: tasks.data().count, activeTasks: activeTasks.data().count, completedTasks: completedTasks.data().count, paymentRecords: paymentRecords.data().count, submittedPayments: submittedPayments.data().count, pendingVerifications: pendingVerifications.data().count };
}
export function subscribePendingVerifications(setData: (items: VerificationRequest[]) => void, setError: (error: Error) => void) {
  const { db: store } = requireServices();
  return onSnapshot(query(collection(store, "verificationRequests"), where("status", "==", "Pending Verification"), limit(100)), (snapshot) => setData(records<VerificationRequest>(snapshot)), setError);
}
export async function getAnalytics(preset: "today" | "7d" | "30d") {
  const response = await httpsCallable<{ preset: string }, Analytics>(requireServices().functions, "getAdminAnalytics")({ preset });
  return response.data;
}
export async function getSuperadminOverview() {
  const response = await httpsCallable<Record<string, never>, SuperadminOverview>(requireServices().functions, "getSuperadminOverview")({});
  return response.data;
}
export async function reviewVerification(userId: string, decision: "Verified" | "Rejected" | "Needs Resubmission", reason: string) {
  await httpsCallable(requireServices().functions, "reviewWorkerVerification")({ userId, decision, reason });
}
export async function reviewPayment(taskId: string, decision: "Verified" | "Rejected", reason: string) {
  await httpsCallable(requireServices().functions, "reviewPaymentEvidence")({ taskId, decision, reason });
}
export async function changeAccountStatus(userId: string, accountStatus: "active" | "suspended", reason: string, violationReportId = "") {
  await httpsCallable(requireServices().functions, "setUserAccountStatus")({ userId, accountStatus, reason, violationReportId });
}
export async function correctName(userId: string, fullName: string, reason: string) {
  await httpsCallable(requireServices().functions, "correctLockedFullName")({ userId, fullName, reason });
}
export async function getVerificationDocumentUrl(path: string) {
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return getDownloadURL(ref(storage, path));
}

export type PortalData = { profiles: Profile[]; tasks: Task[]; matches: TaskMatch[]; ratings: Rating[]; audit: AuditLog[] };
