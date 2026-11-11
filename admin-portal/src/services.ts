import { collection, doc, documentId, DocumentData, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, QueryConstraint, QueryDocumentSnapshot, startAfter, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "./firebase";
import { Analytics, AuditLog, BasicDashboardCounts, Payment, Profile, Rating, SuperadminOverview, Task, TaskMatch, VerificationRequest } from "./types";
import { getAdminApi, postAdminApi } from "./adminApi";

function requireServices() { if (!db) throw new Error("Firebase is not configured."); return { db }; }
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
  const response = await postAdminApi<{ profiles: Record<string, Profile> }>("/api/admin/profiles/lookup", { ids });
  return response.profiles;
}
export async function loadModerationProfilesById(ids: string[]) {
  const response = await postAdminApi<{ profiles: Record<string, Profile> }>("/api/admin/profiles/moderation-lookup", { ids });
  return response.profiles;
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
export async function getRatingCount(score?: number) {
  const { db: store } = requireServices();
  const ratings = score === undefined
    ? collection(store, "ratings")
    : query(collection(store, "ratings"), where("score", "==", score));
  const snapshot = await getCountFromServer(ratings);
  return snapshot.data().count;
}
export async function loadRatingsPage(score: string, size = 20, cursor: QueryDocumentSnapshot<DocumentData> | null = null): Promise<Page<Rating>> {
  const { db: store } = requireServices();
  const clauses: QueryConstraint[] = [];
  if (score !== "all") clauses.push(where("score", "==", Number(score)));
  clauses.push(orderBy("createdAt"), limit(size + 1));
  if (cursor) clauses.splice(clauses.length - 1, 0, startAfter(cursor));
  const snapshot = await getDocs(query(collection(store, "ratings"), ...clauses));
  const docs = snapshot.docs.slice(0, size);
  return { items: records<Rating>({ docs }), cursor: docs.at(-1) ?? null, hasMore: snapshot.docs.length > size };
}
export function subscribePendingVerifications(setData: (items: VerificationRequest[]) => void, setError: (error: Error) => void) {
  const { db: store } = requireServices();
  return onSnapshot(query(collection(store, "verificationRequests"), where("status", "==", "Pending Verification"), limit(100)), (snapshot) => setData(records<VerificationRequest>(snapshot)), setError);
}
export async function getAnalytics(preset: "today" | "7d" | "30d") {
  return postAdminApi<Analytics>("/api/admin/analytics", { preset });
}
export async function getSuperadminOverview() {
  return getAdminApi<SuperadminOverview>("/api/admin/superadmin/overview");
}
export async function reviewVerification(userId: string, decision: "Verified" | "Rejected" | "Needs Resubmission", reason: string) {
  await postAdminApi("/api/admin/verifications/review", { userId, decision, reason });
}
export async function reviewPayment(taskId: string, decision: "Verified" | "Rejected", reason: string) {
  await postAdminApi("/api/admin/payments/review", { taskId, decision, reason });
}
export async function changeAccountStatus(userId: string, accountStatus: "active" | "suspended", reason: string, violationReportId = "") {
  await postAdminApi("/api/admin/accounts/status", { userId, accountStatus, reason, violationReportId });
}
export async function correctName(userId: string, fullName: string, reason: string) {
  await postAdminApi("/api/admin/accounts/name", { userId, fullName, reason });
}
export async function getVerificationDocumentUrl(path: string) {
  const pointer = parseFirestoreVerificationPath(path);
  if (pointer) {
    const { db: store } = requireServices();
    const record = doc(store, "verificationFiles", pointer.userId, "uploads", pointer.kind);
    const snapshot = await getDoc(record);
    if (!snapshot.exists()) throw new Error("The uploaded document is no longer available.");
    const file = snapshot.data();
    if (!isValidFirestoreVerificationFile(file, pointer)) throw new Error("The uploaded document record is invalid.");
    const chunks = (await getDocs(collection(record, "chunks"))).docs
      .map((item) => item.data())
      .filter((item) => item.version === file.version && Number.isInteger(item.index) && typeof item.data === "string")
      .sort((left, right) => left.index - right.index);
    if (chunks.length !== file.chunkCount || chunks.some((item, index) => item.index !== index)) {
      throw new Error("The uploaded document is incomplete. Ask the user to upload it again.");
    }
    const base64 = chunks.map((item) => item.data).join("");
    if (base64.length !== file.encodedSize) throw new Error("The uploaded document is incomplete. Ask the user to upload it again.");
    return { url: materializeBase64(base64, file.mimeType), mimeType: file.mimeType };
  }

  if (!storage) throw new Error("Firebase Storage is not configured.");
  return {
    url: await getDownloadURL(ref(storage, path)),
    mimeType: path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*"
  };
}

type FirestoreVerificationPointer = { userId: string; kind: "valid-id" | "medical-certificate" | "police-clearance" };

function parseFirestoreVerificationPath(path: string): FirestoreVerificationPointer | null {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== "firestoreVerificationFiles" || !parts[1]) return null;
  if (parts[2] !== "valid-id" && parts[2] !== "medical-certificate" && parts[2] !== "police-clearance") return null;
  return { userId: parts[1], kind: parts[2] };
}

function isValidFirestoreVerificationFile(file: DocumentData, pointer: FirestoreVerificationPointer) {
  return file.userId === pointer.userId
    && file.kind === pointer.kind
    && typeof file.fileName === "string"
    && typeof file.mimeType === "string"
    && (file.mimeType.startsWith("image/") || file.mimeType === "application/pdf")
    && typeof file.byteSize === "number"
    && Number.isInteger(file.byteSize)
    && file.byteSize > 0
    && file.byteSize <= 5 * 1024 * 1024
    && typeof file.encodedSize === "number"
    && Number.isInteger(file.encodedSize)
    && file.encodedSize > 0
    && typeof file.chunkCount === "number"
    && Number.isInteger(file.chunkCount)
    && file.chunkCount > 0
    && typeof file.version === "string"
    && file.status === "ready";
}

function materializeBase64(base64: string, mimeType: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export type PortalData = { profiles: Profile[]; tasks: Task[]; matches: TaskMatch[]; ratings: Rating[]; audit: AuditLog[] };
