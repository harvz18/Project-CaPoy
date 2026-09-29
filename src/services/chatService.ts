import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  or,
  orderBy,
  query,
  startAfter,
  where,
  writeBatch
} from "firebase/firestore";
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

  const messageQuery = query(
    collection(db, "messages"),
    or(where("senderId", "==", userId), where("receiverId", "==", userId)),
    orderBy("timestamp", "desc"),
    limit(100)
  );

  return onSnapshot(messageQuery, (snapshot) => {
    onChange(snapshot.docs
      .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }) as ChatMessage)
      .reverse());
  }, onError);
}

export async function loadOlderMessages(userId: string, beforeTimestamp: string) {
  const firestore = requireDb();
  const snapshot = await getDocs(query(
    collection(firestore, "messages"),
    or(where("senderId", "==", userId), where("receiverId", "==", userId)),
    orderBy("timestamp", "desc"),
    startAfter(beforeTimestamp),
    limit(100)
  ));
  return snapshot.docs
    .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }) as ChatMessage)
    .reverse();
}

export function getConversationId(taskId: string, workerId: string) {
  return `${taskId}_${workerId}`;
}

export async function sendMessageToFirestore(message: Omit<ChatMessage, "id">, workerId: string) {
  const firestore = requireDb();
  const participantIds = [...new Set([message.senderId, message.receiverId])];
  const conversationId = message.conversationId ?? getConversationId(message.taskId, workerId);
  const messageRef = doc(collection(firestore, "messages"));
  const batch = writeBatch(firestore);

  batch.set(
    doc(firestore, "chats", conversationId),
    {
      id: conversationId,
      workerId,
      taskId: message.taskId,
      participantIds,
      lastMessage: message.message,
      lastMessageAt: message.timestamp,
      lastSenderId: message.senderId,
      updatedAt: message.timestamp
    },
    { merge: true }
  );

  batch.set(messageRef, {
    ...message,
    conversationId,
    participantIds
  });

  await batch.commit();
}

export async function markConversationMessagesRead(
  taskId: string,
  currentUserId: string,
  otherParticipantId: string,
  messages: ChatMessage[]
) {
  const firestore = requireDb();
  const unread = messages.filter(
    (message) =>
      message.taskId === taskId
      && message.senderId === otherParticipantId
      && message.receiverId === currentUserId
      && !message.readAt
  );

  if (!unread.length) return;

  const readAt = new Date().toISOString();
  for (let offset = 0; offset < unread.length; offset += 450) {
    const batch = writeBatch(firestore);
    unread.slice(offset, offset + 450).forEach((message) => {
      batch.update(doc(firestore, "messages", message.id), { readAt });
    });
    await batch.commit();
  }
}
