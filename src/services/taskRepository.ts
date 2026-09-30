import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  Transaction
} from "firebase/firestore";
import {
  assertCanApply,
  assertCanRejectApplicant,
  assertCanWithdraw,
  assertTaskTransition,
  TaskActor
} from "../domain/taskWorkflow";
import { PaymentMethod, PaymentStatus, Task, TaskMatch, TaskStatus, UserProfile } from "../types";
import { scoreWorkerForTask } from "../domain/matching";
import { auth, db } from "./firebase";

function requireDb() {
  if (!db) throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  return db;
}

function requireAuthActor(actor: TaskActor) {
  if (!auth?.currentUser || auth.currentUser.uid !== actor.id) {
    throw new Error("Your authentication session does not match this action.");
  }
}

function withoutUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export type TaskInput = {
  clientId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  locationAddress?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
  locationCapturedAt?: string;
  locationAccuracyMeters?: number;
  locationSource?: Task["locationSource"];
  requiredCapability?: string;
  wage: string;
  estimatedDuration: string;
  paymentMethod: PaymentMethod;
};

export function subscribeToTasksForUser(
  user: UserProfile,
  onChange: (tasks: Task[]) => void,
  onError: (error: Error) => void
) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }
  const taskQueries = user.role === "client"
    ? [query(collection(db, "tasks"), where("clientId", "==", user.id))]
    : [
        query(collection(db, "tasks"), where("status", "in", ["Finding Workers", "Applied"])),
        query(collection(db, "tasks"), where("applicantIds", "array-contains", user.id)),
        query(collection(db, "tasks"), where("workerId", "==", user.id))
      ];
  const buckets = taskQueries.map(() => [] as Task[]);
  const emit = () => {
    const uniqueTasks = new Map<string, Task>();
    buckets.flat().forEach((task) => uniqueTasks.set(task.id, task));
    onChange([...uniqueTasks.values()].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ));
  };
  const unsubscribers = taskQueries.map((taskQuery, index) => onSnapshot(
    taskQuery,
    (snapshot) => {
      buckets[index] = snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }) as Task);
      emit();
    },
    onError
  ));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function subscribeToTaskMatchesForUser(
  user: UserProfile,
  onChange: (matches: TaskMatch[]) => void,
  onError: (error: Error) => void
) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }
  const field = user.role === "client" ? "clientId" : "workerId";
  return onSnapshot(
    query(collection(db, "taskMatches"), where(field, "==", user.id)),
    (snapshot) => onChange(snapshot.docs.map(
      (matchDoc) => ({ id: matchDoc.id, ...matchDoc.data() }) as TaskMatch
    )),
    onError
  );
}

export async function createTaskInFirestore(input: TaskInput) {
  const firestore = requireDb();
  requireAuthActor({ id: input.clientId, role: "client" });
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.parse(now) + 7 * 24 * 60 * 60 * 1000).toISOString();
  const taskRef = doc(collection(firestore, "tasks"));
  const task = withoutUndefined({
    clientId: input.clientId,
    applicantIds: [],
    title: input.title,
    description: input.description,
    category: input.category,
    location: input.location,
    locationAddress: input.locationAddress ?? input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    geofenceRadius: input.geofenceRadius ?? 500,
    locationCapturedAt: input.locationCapturedAt,
    locationAccuracyMeters: input.locationAccuracyMeters,
    locationSource: input.locationSource,
    requiredCapability: input.requiredCapability ?? input.category,
    wage: input.wage,
    estimatedDuration: input.estimatedDuration,
    status: "Finding Workers" as const,
    paymentMethod: input.paymentMethod,
    paymentStatus: "Pending" as const,
    expiresAt,
    createdAt: now,
    updatedAt: now
  }) as Omit<Task, "id">;
  const batch = writeBatch(firestore);
  batch.set(taskRef, task);
  batch.set(doc(firestore, "payments", taskRef.id), {
    id: taskRef.id,
    taskId: taskRef.id,
    clientId: input.clientId,
    paymentMethod: input.paymentMethod,
    paymentStatus: "Pending",
    createdAt: now,
    updatedAt: now
  });
  await batch.commit();
  return { id: taskRef.id, ...task } as Task;
}

export async function applyToTask(taskId: string, worker: UserProfile) {
  const firestore = requireDb();
  const actor: TaskActor = { id: worker.id, role: worker.role };
  requireAuthActor(actor);
  const taskRef = doc(firestore, "tasks", taskId);
  const matchRef = doc(firestore, "taskMatches", `${taskId}_${worker.id}`);
  const workerRef = doc(firestore, "users", worker.id);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const [taskSnapshot, matchSnapshot, workerSnapshot] = await Promise.all([
      transaction.get(taskRef), transaction.get(matchRef), transaction.get(workerRef)
    ]);
    if (!taskSnapshot.exists() || !workerSnapshot.exists()) throw new Error("Task or worker profile not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    const workerData = workerSnapshot.data() as UserProfile;
    assertCanApply(task, actor, workerData.availabilityStatus ?? workerData.availability);
    if (matchSnapshot.exists()) throw new Error("An application already exists for this task.");
    const match = scoreWorkerForTask(task, { ...workerData, id: worker.id });
    if (!match.eligible) {
      throw new Error(match.reasons[0] ?? "Your profile is not eligible for this task.");
    }
    transaction.set(matchRef, {
      id: matchRef.id, taskId, workerId: worker.id, clientId: task.clientId,
      acceptanceStatus: "Applied", createdAt: now, updatedAt: now
    });
    transaction.update(taskRef, {
      status: "Applied",
      applicantIds: [...(task.applicantIds ?? []), worker.id],
      lastApplicationWorkerId: worker.id,
      lastApplicationMatchId: matchRef.id,
      lastApplicationAction: "Applied",
      updatedAt: now
    });
    setWorkflowNotification(transaction, {
      id: `${taskId}_application_${worker.id}`, userId: task.clientId, taskId, createdBy: worker.id,
      notificationType: "Worker application", message: `${worker.fullName} applied to ${task.title}.`, createdAt: now
    });
  });
}

export async function withdrawTaskApplication(taskId: string, worker: UserProfile) {
  const firestore = requireDb();
  const actor: TaskActor = { id: worker.id, role: worker.role };
  requireAuthActor(actor);
  const taskRef = doc(firestore, "tasks", taskId);
  const matchRef = doc(firestore, "taskMatches", `${taskId}_${worker.id}`);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const [taskSnapshot, matchSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(matchRef)]);
    if (!taskSnapshot.exists() || !matchSnapshot.exists()) throw new Error("Application not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    const match = matchSnapshot.data() as TaskMatch;
    assertCanWithdraw(task, actor, match.acceptanceStatus);
    const applicantIds = (task.applicantIds ?? []).filter((id) => id !== worker.id);
    transaction.update(matchRef, { acceptanceStatus: "Withdrawn", withdrawnAt: now, updatedAt: now });
    transaction.update(taskRef, {
      applicantIds,
      status: applicantIds.length ? "Applied" : "Finding Workers",
      lastApplicationWorkerId: worker.id,
      lastApplicationMatchId: matchRef.id,
      lastApplicationAction: "Withdrawn",
      updatedAt: now
    });
    setWorkflowNotification(transaction, {
      id: `${taskId}_withdrawn_${worker.id}`, userId: task.clientId, taskId, createdBy: worker.id,
      notificationType: "Application withdrawn",
      message: `${worker.fullName} withdrew their application for ${task.title}.`, createdAt: now
    });
  });
}

export async function rejectTaskApplication(taskId: string, workerId: string, client: UserProfile) {
  const firestore = requireDb();
  const actor: TaskActor = { id: client.id, role: client.role };
  requireAuthActor(actor);
  const taskRef = doc(firestore, "tasks", taskId);
  const matchRef = doc(firestore, "taskMatches", `${taskId}_${workerId}`);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const [taskSnapshot, matchSnapshot] = await Promise.all([transaction.get(taskRef), transaction.get(matchRef)]);
    if (!taskSnapshot.exists() || !matchSnapshot.exists()) throw new Error("Application not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    const match = matchSnapshot.data() as TaskMatch;
    assertCanRejectApplicant(task, actor, workerId, match.acceptanceStatus);
    const applicantIds = (task.applicantIds ?? []).filter((id) => id !== workerId);
    transaction.update(matchRef, { acceptanceStatus: "Rejected", rejectedAt: now, updatedAt: now });
    transaction.update(taskRef, {
      applicantIds,
      status: applicantIds.length ? "Applied" : "Finding Workers",
      lastApplicationWorkerId: workerId,
      lastApplicationMatchId: matchRef.id,
      lastApplicationAction: "Rejected",
      updatedAt: now
    });
    setWorkflowNotification(transaction, {
      id: `${taskId}_rejected_${workerId}`, userId: workerId, taskId, createdBy: client.id,
      notificationType: "Application update", message: `Your application for ${task.title} was not selected.`, createdAt: now
    });
  });
}

export async function updateTaskStatusInFirestore(
  taskId: string,
  status: TaskStatus,
  actor: UserProfile,
  workerId?: string
) {
  const firestore = requireDb();
  const taskActor: TaskActor = { id: actor.id, role: actor.role };
  requireAuthActor(taskActor);
  const taskRef = doc(firestore, "tasks", taskId);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Task not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    assertTaskTransition(task, status, taskActor, workerId);
    if (status === "Accepted") {
      await acceptApplicantInTransaction(transaction, task, workerId as string, actor, now);
      return;
    }
    if (status === "Cancelled") {
      await cancelTaskInTransaction(transaction, task, actor, now);
      return;
    }
    if (status === "Finished") {
      await finishTaskInTransaction(transaction, task, actor, now);
      return;
    }
    const updates: Record<string, unknown> = { status, updatedAt: now };
    if (status === "In Progress") updates.startedAt = now;
    if (status === "Pending Approval") updates.workerFinishedAt = now;
    if (status === "Archived") updates.archivedAt = now;
    if (status === "Disputed") updates.disputedAt = now;
    transaction.update(taskRef, updates);
    const recipientId = actor.id === task.clientId ? task.workerId : task.clientId;
    if (recipientId) {
      const notificationType = status === "Pending Approval"
        ? "Completion approval"
        : status === "Disputed" ? "Task disputed" : "Task status updated";
      const message = status === "Pending Approval"
        ? `${task.title} is waiting for completion approval.`
        : `${task.title} is now ${status}.`;
      setWorkflowNotification(transaction, {
        id: `${taskId}_${status.toLowerCase().replace(/\s+/g, "-")}_${recipientId}`,
        userId: recipientId, taskId, createdBy: actor.id, notificationType, message, createdAt: now
      });
    }
  });
}

async function acceptApplicantInTransaction(
  transaction: Transaction,
  task: Task,
  workerId: string,
  client: UserProfile,
  now: string
) {
  const firestore = requireDb();
  const taskRef = doc(firestore, "tasks", task.id);
  const paymentRef = doc(firestore, "payments", task.id);
  const selectedMatchRef = doc(firestore, "taskMatches", `${task.id}_${workerId}`);
  const workerUserRef = doc(firestore, "users", workerId);
  const workerProfileRef = doc(firestore, "workerProfiles", workerId);
  const publicProfileRef = doc(firestore, "publicProfiles", workerId);
  const matchRefs = (task.applicantIds ?? []).map((id) => doc(firestore, "taskMatches", `${task.id}_${id}`));
  const [selectedMatchSnapshot, workerUserSnapshot, workerProfileSnapshot, publicProfileSnapshot, ...matchSnapshots] =
    await Promise.all([
      transaction.get(selectedMatchRef), transaction.get(workerUserRef), transaction.get(workerProfileRef),
      transaction.get(publicProfileRef), ...matchRefs.map((matchRef) => transaction.get(matchRef))
    ]);
  if (!selectedMatchSnapshot.exists() || selectedMatchSnapshot.data().acceptanceStatus !== "Applied" ||
      !workerUserSnapshot.exists() || !workerProfileSnapshot.exists() || !publicProfileSnapshot.exists()) {
    throw new Error("The selected application or worker profile is unavailable.");
  }
  const workerData = workerUserSnapshot.data() as UserProfile;
  if (workerData.activeTaskId ||
      (workerData.availabilityStatus ?? workerData.availability ?? "Available") !== "Available") {
    throw new Error("The selected worker is no longer available.");
  }
  transaction.update(taskRef, {
    status: "Accepted",
    workerId,
    applicantIds: [workerId],
    selectedMatchId: selectedMatchRef.id,
    acceptedAt: now,
    updatedAt: now
  });
  transaction.update(paymentRef, { workerId, updatedAt: now });
  transaction.update(selectedMatchRef, { acceptanceStatus: "Accepted", hiredAt: now, updatedAt: now });
  transaction.update(workerUserRef, {
    availabilityStatus: "Busy", availability: "Busy", activeTaskId: task.id, updatedAt: now
  });
  transaction.update(workerProfileRef, { availabilityStatus: "Busy", availability: "Busy", updatedAt: now });
  transaction.update(publicProfileRef, { availabilityStatus: "Busy", availability: "Busy", updatedAt: now });
  setWorkflowNotification(transaction, {
    id: `${task.id}_accepted_${workerId}`, userId: workerId, taskId: task.id, createdBy: client.id,
    notificationType: "Application accepted", message: `Your application for ${task.title} was accepted.`, createdAt: now
  });
  matchSnapshots.forEach((matchSnapshot) => {
    if (!matchSnapshot.exists()) return;
    const match = matchSnapshot.data() as TaskMatch;
    if (match.workerId === workerId || match.acceptanceStatus !== "Applied") return;
    transaction.update(matchSnapshot.ref, { acceptanceStatus: "Rejected", rejectedAt: now, updatedAt: now });
    setWorkflowNotification(transaction, {
      id: `${task.id}_rejected_${match.workerId}`, userId: match.workerId, taskId: task.id, createdBy: client.id,
      notificationType: "Application update", message: `Another worker was selected for ${task.title}.`, createdAt: now
    });
  });
}

async function cancelTaskInTransaction(transaction: Transaction, task: Task, client: UserProfile, now: string) {
  const firestore = requireDb();
  const taskRef = doc(firestore, "tasks", task.id);
  const matchSnapshots = await Promise.all((task.applicantIds ?? []).map(
    (applicantId) => transaction.get(doc(firestore, "taskMatches", `${task.id}_${applicantId}`))
  ));
  transaction.update(taskRef, { status: "Cancelled", cancelledAt: now, updatedAt: now });
  matchSnapshots.forEach((matchSnapshot) => {
    if (!matchSnapshot.exists() || matchSnapshot.data().acceptanceStatus !== "Applied") return;
    const match = matchSnapshot.data() as TaskMatch;
    transaction.update(matchSnapshot.ref, { acceptanceStatus: "Cancelled", cancelledAt: now, updatedAt: now });
    setWorkflowNotification(transaction, {
      id: `${task.id}_cancelled_${match.workerId}`, userId: match.workerId, taskId: task.id, createdBy: client.id,
      notificationType: "Task cancelled", message: `${task.title} was cancelled by the client.`, createdAt: now
    });
  });
}

async function finishTaskInTransaction(transaction: Transaction, task: Task, client: UserProfile, now: string) {
  const firestore = requireDb();
  const workerId = task.workerId as string;
  const userRef = doc(firestore, "users", workerId);
  const workerProfileRef = doc(firestore, "workerProfiles", workerId);
  const publicProfileRef = doc(firestore, "publicProfiles", workerId);
  const [userSnapshot, workerProfileSnapshot, publicProfileSnapshot] = await Promise.all([
    transaction.get(userRef), transaction.get(workerProfileRef), transaction.get(publicProfileRef)
  ]);
  if (!userSnapshot.exists() || !workerProfileSnapshot.exists() || !publicProfileSnapshot.exists()) {
    throw new Error("The assigned worker profile is incomplete.");
  }
  const completedTasks = (userSnapshot.data().completedTasks ?? 0) + 1;
  transaction.update(doc(firestore, "tasks", task.id), { status: "Finished", finishedAt: now, updatedAt: now });
  transaction.update(userRef, {
    availabilityStatus: "Available", availability: "Available", activeTaskId: deleteField(), completedTasks, updatedAt: now
  });
  transaction.update(workerProfileRef, {
    availabilityStatus: "Available", availability: "Available", completedTasks, updatedAt: now
  });
  transaction.update(publicProfileRef, {
    availabilityStatus: "Available", availability: "Available", completedTasks, updatedAt: now
  });
  setWorkflowNotification(transaction, {
    id: `${task.id}_finished_${workerId}`, userId: workerId, taskId: task.id, createdBy: client.id,
    notificationType: "Task completed", message: `${task.title} was confirmed as finished.`, createdAt: now
  });
}

export async function updateTaskPaymentVerification(
  taskId: string,
  clientId: string,
  paymentStatus: PaymentStatus,
  proofOfPaymentText?: string,
  proofOfPaymentUrl?: string
) {
  const firestore = requireDb();
  requireAuthActor({ id: clientId, role: "client" });
  const taskRef = doc(firestore, "tasks", taskId);
  const paymentRef = doc(firestore, "payments", taskId);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Task not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    if (task.clientId !== clientId) throw new Error("Only the task client can submit payment confirmation.");
    if (!["Accepted", "In Progress", "Pending Approval"].includes(task.status)) {
      throw new Error("Payment confirmation is available after a worker is accepted and before completion.");
    }
    if (paymentStatus !== "Submitted" || !proofOfPaymentText?.trim()) {
      throw new Error("Enter a payment reference or COD confirmation.");
    }
    const updates = withoutUndefined({
      paymentStatus,
      proofOfPaymentText: proofOfPaymentText.trim(),
      proofOfPaymentUrl,
      clientConfirmedAt: task.paymentMethod === "COD" ? now : undefined,
      updatedAt: now
    });
    transaction.update(taskRef, updates);
    transaction.set(paymentRef, { id: taskId, taskId, clientId, ...updates }, { merge: true });
    if (task.workerId) {
      setWorkflowNotification(transaction, {
        id: `${taskId}_payment-submitted_${task.workerId}`, userId: task.workerId, taskId, createdBy: clientId,
        notificationType: "Payment confirmation submitted",
        message: `Payment confirmation was submitted for ${task.title}.`, createdAt: now
      });
    }
  });
}

type WorkflowNotification = {
  id: string;
  userId: string;
  taskId: string;
  createdBy: string;
  notificationType: string;
  message: string;
  createdAt: string;
};

function setWorkflowNotification(transaction: Transaction, notification: WorkflowNotification) {
  const firestore = requireDb();
  const { id, ...data } = notification;
  transaction.set(doc(firestore, "notifications", id), { ...data, readStatus: false });
}
