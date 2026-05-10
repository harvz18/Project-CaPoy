import { doc, getDoc, onSnapshot, query, collection, setDoc, updateDoc, where, getDocs } from "firebase/firestore";
import { Role, UserProfile } from "../types";
import { db } from "./firebase";

function requireDb() {
  if (!db) {
    throw new Error("Firebase is not configured. Please check the EXPO_PUBLIC_FIREBASE_* values.");
  }

  return db;
}

function withoutUndefined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export type SaveUserInput = {
  id: string;
  role: Role;
  fullName: string;
  mobileNumber: string;
  address: string;
  skills?: string[];
  businessName?: string;
};

export async function saveUserProfile(input: SaveUserInput) {
  const firestore = requireDb();
  const now = new Date().toISOString();
  const user: UserProfile = {
    id: input.id,
    role: input.role,
    fullName: input.fullName,
    mobileNumber: input.mobileNumber,
    address: input.address || "Bacolod City",
    rating: 0,
    skills: input.role === "worker" ? input.skills ?? [] : undefined,
    availabilityStatus: input.role === "worker" ? "Available" : undefined,
    businessName: input.role === "client" ? input.businessName : undefined,
    completedTasks: 0,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(firestore, "users", input.id), withoutUndefined({ ...user }));

  if (input.role === "worker") {
    await setDoc(doc(firestore, "workerProfiles", input.id), {
      userId: input.id,
      skills: user.skills ?? [],
      availabilityStatus: "Available",
      completedTasks: 0,
      createdAt: now,
      updatedAt: now
    });
  } else {
    await setDoc(doc(firestore, "clientProfiles", input.id), {
      userId: input.id,
      businessName: input.businessName ?? "",
      createdAt: now,
      updatedAt: now
    });
  }

  return user;
}

export async function getUserProfile(userId: string) {
  const firestore = requireDb();
  const snapshot = await getDoc(doc(firestore, "users", userId));

  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() } as UserProfile;
}

export async function findUserByMobileNumber(mobileNumber: string) {
  const firestore = requireDb();
  const snapshot = await getDocs(query(collection(firestore, "users"), where("mobileNumber", "==", mobileNumber)));
  const userDoc = snapshot.docs[0];

  return userDoc ? ({ id: userDoc.id, ...userDoc.data() } as UserProfile) : null;
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const firestore = requireDb();
  const nextUpdates = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(doc(firestore, "users", userId), withoutUndefined(nextUpdates));

  if (updates.role === "worker" || updates.skills || updates.availabilityStatus) {
    await setDoc(
      doc(firestore, "workerProfiles", userId),
      {
        userId,
        skills: updates.skills ?? [],
        availabilityStatus: updates.availabilityStatus ?? "Available",
        updatedAt: nextUpdates.updatedAt
      },
      { merge: true }
    );
  }

  if (updates.role === "client" || updates.businessName) {
    await setDoc(
      doc(firestore, "clientProfiles", userId),
      {
        userId,
        businessName: updates.businessName ?? "",
        updatedAt: nextUpdates.updatedAt
      },
      { merge: true }
    );
  }
}

export function subscribeToUsers(onChange: (users: UserProfile[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      onChange(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }) as UserProfile));
    },
    onError
  );
}
