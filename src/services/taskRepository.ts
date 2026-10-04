import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  Transaction
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  assertCanApply,
  assertCanRejectApplicant,
  assertCanWithdraw,
  assertTaskTransition,
  TaskActor
} from "../domain/taskWorkflow";
import { DurationUnit, PaymentMethod, PaymentStatus, PricingMode, Task, TaskMatch, TaskStatus, UserProfile } from "../types";
import { auth, db, functions } from "./firebase";

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
  durationValue: number;
  durationUnit: DurationUnit;
  scheduleStart: string;
  scheduleEnd: string;
  pricingMode: PricingMode;
  perks: string[];
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
    durationValue: input.durationValue,
    durationUnit: input.durationUnit,
    scheduleStart: input.scheduleStart,
    scheduleEnd: input.scheduleEnd,
    pricingMode: input.pricingMode,
    perks: input.perks,
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

export async function applyToTask(taskId: string, worker: UserProfile, proposedAmount?: string) {
  const firestore = requireDb();
  const actor: TaskActor = { id: worker.id, role: worker.role, capabilities: worker.capabilities, skills: worker.skills };
  requireAuthActor(actor);
  const taskRef = doc(firestore, "tasks", taskId);
  const matchRef = doc(firestore, "taskMatches", `${taskId}_${worker.id}`);
  const now = new Date().toISOString();
  let applicationNotification: WorkflowNotification | undefined;
  await runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);
    if (!taskSnapshot.exists()) throw new Error("Task not found.");
    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    const normalizedBid = proposedAmount?.trim();
    assertCanApply(task, actor, normalizedBid);
    transaction.set(matchRef, {
      id: matchRef.id, taskId, workerId: worker.id, clientId: task.clientId,
      acceptanceStatus: "Applied", ...(normalizedBid ? { proposedAmount: normalizedBid } : {}),
      createdAt: now, updatedAt: now
    });
    transaction.update(taskRef, {
      status: "Applied",
      applicantIds: [...(task.applicantIds ?? []), worker.id],
      lastApplicationWorkerId: worker.id,
      lastApplicationMatchId: matchRef.id,
      lastApplicationAction: "Applied",
      updatedAt: now
    });
    applicationNotification = {
      id: `${taskId}_application_${worker.id}`,
      userId: task.clientId,
      taskId,
      createdBy: worker.id,
      notificationType: "Worker application",
      message: task.pricingMode === "bidding"
        ? `${worker.fullName} bid ₱${normalizedBid} for ${task.title}.`
        : `${worker.fullName} applied to ${task.title}.`,
      createdAt: now
    };
  });

  // A notification is useful but must never roll back a valid application.
  if (applicationNotification) {
    const { id, ...notification } = applicationNotification;
    await setDoc(doc(firestore, "notifications", id), { ...notification, readStatus: false }).catch(() => undefined);
  }
  await setDoc(doc(firestore, "notifications", `${taskId}_application_confirmation_${worker.id}`), {
    userId: worker.id,
    taskId,
    createdBy: worker.id,
    notificationType: "Application submitted",
    message: proposedAmount ? `Your bid of ₱${proposedAmount.trim()} was submitted.` : "Your application was submitted successfully.",
    readStatus: false,
    createdAt: now
  }).catch(() => undefined);
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
  if (status === "Accepted") {
    if (!functions) throw new Error("Firebase Functions is not configured.");
    requireAuthActor({ id: actor.id, role: actor.role });
    const acceptApplication = httpsCallable(functions, "acceptTaskApplication");
    await acceptApplication({ taskId, workerId });
    return;
  }
  if (status === "Cancelled") {
    if (!functions) throw new Error("Firebase Functions is not configured.");
    requireAuthActor({ id: actor.id, role: actor.role });
    const cancelTask = httpsCallable(functions, "cancelTask");
    await cancelTask({ taskId });
    return;
  }
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

export async function confirmCashPaymentReceipt(taskId: string, worker: UserProfile) {
  const firestore = requireDb();
  const actor: TaskActor = { id: worker.id, role: worker.role };
  requireAuthActor(actor);
  if (actor.role !== "worker") throw new Error("Only the assigned tasker can confirm cash receipt.");

  const taskRef = doc(firestore, "tasks", taskId);
  const paymentRef = doc(firestore, "payments", taskId);
  const now = new Date().toISOString();
  await runTransaction(firestore, async (transaction) => {
    const [taskSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(taskRef),
      transaction.get(paymentRef)
    ]);
    if (!taskSnapshot.exists() || !paymentSnapshot.exists()) throw new Error("Task payment record not found.");

    const task = { id: taskSnapshot.id, ...taskSnapshot.data() } as Task;
    const payment = paymentSnapshot.data();
    if (task.workerId !== worker.id) throw new Error("Only the assigned tasker can confirm cash receipt.");
    if (task.status !== "Pending Approval") throw new Error("Submit the completed work before confirming cash receipt.");
    if (task.paymentMethod !== "COD" || payment.paymentMethod !== "COD") {
      throw new Error("This confirmation is available only for cash payments.");
    }
    if (task.paymentStatus !== "Submitted" || payment.paymentStatus !== "Submitted") {
      throw new Error("Wait for the employer to submit the cash payment confirmation.");
    }

    const updates = { paymentStatus: "Verified" as const, workerConfirmedAt: now, updatedAt: now };
    transaction.update(taskRef, updates);
    transaction.update(paymentRef, updates);
    setWorkflowNotification(transaction, {
      id: `${taskId}_cash-confirmed_${worker.id}`,
      userId: task.clientId,
      taskId,
      createdBy: worker.id,
      notificationType: "Cash payment confirmed",
      message: `Cash receipt was confirmed for ${task.title}.`,
      createdAt: now
    });
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
