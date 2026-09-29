import { addDoc, collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { ChatMessage } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

export function subscribeToMessages(
  userId: string,
  onChange: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void
) {
  if (!db || !userId) {
    onChange([]);
    return () => undefined;
  }

  const messageQueries = [
    query(collection(db, "messages"), where("senderId", "==", userId)),
    query(collection(db, "messages"), where("receiverId", "==", userId))
  ];
  const buckets = messageQueries.map(() => [] as ChatMessage[]);

  const emit = () => {
    const uniqueMessages = new Map<string, ChatMessage>();
    buckets.flat().forEach((message) => uniqueMessages.set(message.id, message));
    onChange(
      [...uniqueMessages.values()].sort(
        (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
      )
    );
  };

  const unsubscribers = messageQueries.map((messageQuery, index) =>
    onSnapshot(
      messageQuery,
      (snapshot) => {
        buckets[index] = snapshot.docs.map(
          (messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }) as ChatMessage
        );
        emit();
      },
      onError
    )
  );

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function sendMessageToFirestore(message: Omit<ChatMessage, "id">) {
  const firestore = requireDb();
  const participantIds = [...new Set([message.senderId, message.receiverId])];

  await setDoc(
    doc(firestore, "chats", message.taskId),
    {
      id: message.taskId,
      taskId: message.taskId,
      participantIds,
      lastMessage: message.message,
      updatedAt: message.timestamp
    },
    { merge: true }
  );

  await addDoc(collection(firestore, "messages"), {
    ...message,
    participantIds
  });
}
