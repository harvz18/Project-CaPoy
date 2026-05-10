import { addDoc, collection, onSnapshot, orderBy, query, runTransaction, doc } from "firebase/firestore";
import { Rating } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

export function subscribeToRatings(onChange: (ratings: Rating[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    query(collection(db, "ratings"), orderBy("createdAt", "desc")),
    (snapshot) => {
      onChange(snapshot.docs.map((ratingDoc) => ({ id: ratingDoc.id, ...ratingDoc.data() }) as Rating));
    },
    onError
  );
}

export async function addRatingToFirestore(rating: Omit<Rating, "id">) {
  const firestore = requireDb();
  const now = new Date().toISOString();
  const ratingRef = await addDoc(collection(firestore, "ratings"), {
    ...rating,
    createdAt: now
  });
  const targetUserRef = doc(firestore, "users", rating.targetUserId);

  await runTransaction(firestore, async (transaction) => {
    const userSnapshot = await transaction.get(targetUserRef);

    if (!userSnapshot.exists()) {
      return;
    }

    const user = userSnapshot.data();
    const ratingCount = Number(user.ratingCount ?? 0);
    const ratingTotal = Number(user.ratingTotal ?? 0);
    const nextCount = ratingCount + 1;
    const nextTotal = ratingTotal + rating.score;

    transaction.update(targetUserRef, {
      ratingCount: nextCount,
      ratingTotal: nextTotal,
      rating: Number((nextTotal / nextCount).toFixed(1)),
      updatedAt: now
    });
  });

  return {
    id: ratingRef.id,
    ...rating
  };
}
