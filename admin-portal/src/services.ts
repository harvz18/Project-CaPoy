import { collection, doc, documentId, DocumentData, getCountFromServer, getDoc, getDocs, limit, orderBy, query, QueryConstraint, QueryDocumentSnapshot, startAfter, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref } from "firebase/storage";
import { db, functions, storage } from "./firebase";
import { getAdminApi, postAdminApi } from "./adminApi";
import { Analytics, AuditLog, BasicDashboardCounts, ModerationUser, Payment, Profile, Rating, SuperadminOverview, Task, TaskMatch, VerificationRequest } from "./types";

function requireServices() { if (!db || !functions) throw new Error("Firebase is not configured."); return { db, functions }; }
function records<T>(snapshot: { docs: QueryDocumentSnapshot<DocumentData>[] }) { return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T); }

export type Page<T> = { items: T[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean };
export async function loadPage<T>(name: string, orderField: string, size = 10, cursor: QueryDocumentSnapshot<DocumentData> | null = null, filters: QueryConstraint[] = [], sortDirection: "asc" | "desc" = "asc"): Promise<Page<T>> {
  const { db: store } = requireServices();
  const clauses: QueryConstraint[] = [...filters, orderBy(orderField, sortDirection), limit(size + 1)];
  if (cursor) clauses.splice(filters.length + 1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(collection(store, name), ...clauses));
  const docs = snapshot.docs.slice(0, size);
  return { items: records<T>({ docs }), cursor: docs.at(-1) ?? null, hasMore: snapshot.docs.length > size };
}
export async function getFeedbackCount(score?: number) {
  const { db: store } = requireServices();
  const source = score === undefined
    ? collection(store, "ratings")
    : query(collection(store, "ratings"), where("score", "==", score));
  return (await getCountFromServer(source)).data().count;
}

async function loadRecordsById<T>(name: string, ids: string[]) {
  const { db: store } = requireServices();
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks = Array.from({ length: Math.ceil(unique.length / 30) }, (_, index) => unique.slice(index * 30, index * 30 + 30));
  const snapshots = await Promise.all(chunks.map((idsInChunk) => getDocs(query(collection(store, name), where(documentId(), "in", idsInChunk)))));
  return snapshots.flatMap((snapshot) => records<T>(snapshot));
}

export async function loadProfilesById(ids: string[]) {
  if (!ids.filter(Boolean).length) return {};
  const response = await postAdminApi<{ profiles: Record<string, Profile> }>("/api/admin/profiles/lookup", { ids });
  return response.profiles;
}

export async function loadTasksById(ids: string[]) {
  const tasks = await loadRecordsById<Task>("tasks", ids);
  return Object.fromEntries(tasks.map((task) => [task.id, task]));
}

export async function loadSubmittedPayments() {
  const response = await getAdminApi<{ payments: Payment[] }>("/api/admin/payments/submitted");
  return response.payments;
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
export async function loadPendingVerifications() {
  const response = await getAdminApi<{ requests: VerificationRequest[] }>("/api/admin/verifications/pending");
  return response.requests;
}
export async function getAnalytics(preset: "today" | "7d" | "30d") {
  const response = await httpsCallable<{ preset: string }, Analytics>(requireServices().functions, "getAdminAnalytics")({ preset });
  return response.data;
}
export async function getSuperadminOverview() {
  return getAdminApi<SuperadminOverview>("/api/admin/superadmin/overview");
}
export async function getAdminModerationUsers() {
  const response = await getAdminApi<{ users: ModerationUser[] }>("/api/admin/moderation/users");
  return response.users;
}
export async function reviewVerification(userId: string, decision: "Verified" | "Rejected" | "Needs Resubmission", reason: string) {
  await postAdminApi("/api/admin/verifications/review", { userId, decision, reason });
}
export async function reviewPayment(taskId: string, decision: "Verified" | "Rejected", reason: string) {
  await httpsCallable(requireServices().functions, "reviewPaymentEvidence")({ taskId, decision, reason });
}
export async function changeAccountStatus(userId: string, accountStatus: "active" | "suspended", reason: string, violationReportId = "") {
  await postAdminApi("/api/admin/moderation/account-status", { userId, accountStatus, reason, violationReportId });
}
export async function correctName(userId: string, fullName: string, reason: string) {
  await httpsCallable(requireServices().functions, "correctLockedFullName")({ userId, fullName, reason });
}
export type VerificationDocumentPreview = { url: string; mimeType: string; fileName: string };
export async function getVerificationDocumentUrl(path: string): Promise<VerificationDocumentPreview> {
  const firestoreDocument = parseFirestoreVerificationDocumentPath(path);
  if (firestoreDocument) {
    const { db: store } = requireServices();
    const fileRef = doc(store, "verificationFiles", firestoreDocument.userId, "uploads", firestoreDocument.kind);
    const snapshot = await getDoc(fileRef);
    const file = snapshot.data();
    if (!file || file.userId !== firestoreDocument.userId || file.kind !== firestoreDocument.kind || file.status !== "ready" || typeof file.mimeType !== "string" || typeof file.fileName !== "string" || typeof file.version !== "string" || !Number.isInteger(file.chunkCount) || !Number.isInteger(file.encodedSize)) {
      throw new Error("The verification document is unavailable or incomplete.");
    }
    const chunkSnapshot = await getDocs(collection(fileRef, "chunks"));
    const chunks = chunkSnapshot.docs
      .map((item) => item.data())
      .filter((item) => item.version === file.version && Number.isInteger(item.index) && typeof item.data === "string")
      .sort((left, right) => left.index - right.index);
    if (chunks.length !== file.chunkCount || chunks.some((item, index) => item.index !== index)) {
      throw new Error("The verification document is incomplete. Ask the user to upload it again.");
    }
    const base64 = chunks.map((item) => item.data).join("");
    if (base64.length !== file.encodedSize) throw new Error("The verification document is incomplete. Ask the user to upload it again.");
    return { url: materializeDocument(base64, file.mimeType), mimeType: file.mimeType, fileName: file.fileName };
  }
  if (!storage) throw new Error("Firebase Storage is not configured.");
  return {
    url: await getDownloadURL(ref(storage, path)),
    mimeType: path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*",
    fileName: path.split("/").at(-1) || "verification document"
  };
}

function parseFirestoreVerificationDocumentPath(path: string) {
  const [prefix, userId, kind, ...extra] = path.split("/");
  if (prefix !== "firestoreVerification" || !userId || !["valid-id", "medical-certificate", "police-clearance"].includes(kind) || extra.length) return undefined;
  return { userId, kind } as const;
}

function materializeDocument(base64: string, mimeType: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export type PortalData = { profiles: Profile[]; tasks: Task[]; matches: TaskMatch[]; ratings: Rating[]; audit: AuditLog[] };
