import { collection, onSnapshot, orderBy, query, runTransaction, doc } from "firebase/firestore";
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
  const ratingId = `${rating.taskId}_${rating.reviewerId}`;
  const ratingRef = doc(firestore, "ratings", ratingId);

  await runTransaction(firestore, async (transaction) => {
    const existingRating = await transaction.get(ratingRef);

    if (existingRating.exists()) {
      throw new Error("You have already rated this user for this task.");
    }

    transaction.set(ratingRef, {
      id: ratingId,
      ...rating,
      createdAt: now
    });
  });

  return {
    id: ratingId,
    ...rating
  };
}
