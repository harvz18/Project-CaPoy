import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { ChatMessage } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

export function subscribeToMessages(onChange: (messages: ChatMessage[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "messages"), orderBy("timestamp", "asc")),
    (snapshot) => {
      onChange(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }) as ChatMessage));
    },
    onError
  );
}

export function subscribeToTaskMessages(
  taskId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void
) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "messages"), where("taskId", "==", taskId), orderBy("timestamp", "asc")),
    (snapshot) => {
      onChange(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }) as ChatMessage));
    },
    onError
  );
}

export async function sendMessageToFirestore(message: Omit<ChatMessage, "id">) {
  const firestore = requireDb();

  await setDoc(
    doc(firestore, "chats", message.taskId),
    {
      id: message.taskId,
      taskId: message.taskId,
      participantIds: [message.senderId, message.receiverId],
      lastMessage: message.message,
      updatedAt: message.timestamp
    },
    { merge: true }
  );

  await addDoc(collection(firestore, "messages"), message);
}
