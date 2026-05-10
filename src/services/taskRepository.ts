import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import { ChatMessage, Rating, Task, TaskStatus } from "../types";

export async function fetchTasksFromFirestore(): Promise<Task[]> {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "tasks"), orderBy("createdAt", "desc"))
  );
  return snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...(taskDoc.data() as Omit<Task, "id">)
  }));
}

export async function fetchMessagesFromFirestore(taskId: string): Promise<ChatMessage[]> {
  if (!db) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, "chatMessages"),
      where("taskId", "==", taskId),
      orderBy("timestamp", "asc")
    )
  );
  return snapshot.docs.map((messageDoc) => ({
    id: messageDoc.id,
    ...(messageDoc.data() as Omit<ChatMessage, "id">)
  }));
}

export async function createTaskInFirestore(task: Omit<Task, "id">): Promise<string | undefined> {
  if (!db) {
    return undefined;
  }

  const ref = await addDoc(collection(db, "tasks"), task);
  return ref.id;
}

export async function updateTaskStatusInFirestore(
  taskId: string,
  status: TaskStatus,
  workerId?: string
) {
  if (!db) {
    return;
  }

  await updateDoc(doc(db, "tasks", taskId), {
    status,
    ...(workerId ? { workerId } : {})
  });
}

export async function addMessageToFirestore(message: Omit<ChatMessage, "id">) {
  if (!db) {
    return;
  }

  await addDoc(collection(db, "chatMessages"), message);
}

export async function addRatingToFirestore(rating: Omit<Rating, "id">) {
  if (!db) {
    return;
  }

  await addDoc(collection(db, "ratings"), rating);
}
