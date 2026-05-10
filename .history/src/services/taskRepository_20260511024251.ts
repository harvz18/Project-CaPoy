import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { PaymentMethod, Task, TaskStatus } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

export type TaskInput = {
  clientId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  wage: string;
  estimatedDuration: string;
  paymentMethod: PaymentMethod;
};

export function subscribeToTasks(onChange: (tasks: Task[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "tasks"), orderBy("createdAt", "desc")),
    (snapshot) => {
      onChange(snapshot.docs.map((taskDoc) => ({ id: taskDoc.id, ...taskDoc.data() }) as Task));
    },
    onError
  );
}

export async function createTaskInFirestore(input: TaskInput) {
  const firestore = requireDb();
  const now = new Date().toISOString();
  const task: Omit<Task, "id"> = {
    clientId: input.clientId,
    applicantIds: [],
    title: input.title,
    description: input.description,
    category: input.category,
    location: input.location.includes("Bacolod") ? input.location : `${input.location}, Bacolod City`,
    wage: input.wage,
    estimatedDuration: input.estimatedDuration,
    status: "Finding Workers",
    paymentMethod: input.paymentMethod,
    createdAt: now
  };
  const taskRef = await addDoc(collection(firestore, "tasks"), task);

  await setDoc(doc(firestore, "payments", taskRef.id), {
    id: taskRef.id,
    taskId: taskRef.id,
    clientId: input.clientId,
    paymentMethod: input.paymentMethod,
    paymentStatus: "Selected",
    createdAt: now
  });

  return {
    id: taskRef.id,
    ...task
  };
}

export async function applyToTask(taskId: string, workerId: string) {
  const firestore = requireDb();
  const taskRef = doc(firestore, "tasks", taskId);
  const matchRef = doc(firestore, "taskMatches", `${taskId}_${workerId}`);
  const now = new Date().toISOString();

  await runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);

    if (!taskSnapshot.exists()) {
      throw new Error("Task not found.");
    }

    const task = taskSnapshot.data() as Task;
    const applicantIds = task.applicantIds ?? [];

    if (task.workerId) {
      throw new Error("This task has already been assigned.");
    }

    if (applicantIds.includes(workerId)) {
      throw new Error("You have already applied to this task.");
    }

    if (task.status !== "Finding Workers" && task.status !== "Applied") {
      throw new Error("This task is no longer open for applications.");
    }

    transaction.set(matchRef, {
      id: matchRef.id,
      taskId,
      workerId,
      clientId: task.clientId,
      acceptanceStatus: "Applied",
      createdAt: now
    });
    transaction.update(taskRef, {
      status: "Applied",
      applicantIds: [...applicantIds, workerId]
    });
  });
}

export async function updateTaskStatusInFirestore(taskId: string, status: TaskStatus, workerId?: string) {
  const firestore = requireDb();
  const taskRef = doc(firestore, "tasks", taskId);
  const now = new Date().toISOString();

  await runTransaction(firestore, async (transaction) => {
    const taskSnapshot = await transaction.get(taskRef);

    if (!taskSnapshot.exists()) {
      throw new Error("Task not found.");
    }

    const task = taskSnapshot.data() as Task;
    const nextWorkerId = workerId ?? task.workerId;
    const updates: Partial<Task> = {
      status,
      ...(nextWorkerId ? { workerId: nextWorkerId } : {})
    };

    if (status === "Accepted") {
      updates.acceptedAt = now;

      if (nextWorkerId) {
        transaction.update(doc(firestore, "payments", taskId), {
          workerId: nextWorkerId
        });
        transaction.set(
          doc(firestore, "taskMatches", `${taskId}_${nextWorkerId}`),
          {
            id: `${taskId}_${nextWorkerId}`,
            taskId,
            workerId: nextWorkerId,
            clientId: task.clientId,
            acceptanceStatus: "Accepted",
            hiredAt: now,
            createdAt: now
          },
          { merge: true }
        );
      }
    }

    if (status === "In Progress") {
      updates.startedAt = now;
    }

    if (status === "Pending Approval") {
      updates.workerFinishedAt = now;
    }

    if (status === "Finished") {
      updates.finishedAt = now;

      if (nextWorkerId) {
        transaction.set(
          doc(firestore, "workerProfiles", nextWorkerId),
          {
            userId: nextWorkerId,
            availabilityStatus: "Available",
            updatedAt: now
          },
          { merge: true }
        );
        transaction.update(doc(firestore, "users", nextWorkerId), {
          availabilityStatus: "Available",
          updatedAt: now
        });
      }
    }

    if (status === "Archived") {
      updates.archivedAt = now;
    }

    transaction.update(taskRef, updates);
  });
}

export async function updateTaskPaymentWorker(taskId: string, workerId: string) {
  const firestore = requireDb();

  await updateDoc(doc(firestore, "payments", taskId), {
    workerId
  });
}
