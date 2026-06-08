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
  capabilities?: string[];
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
    skills: input.role === "worker" ? input.skills ?? input.capabilities ?? [] : undefined,
    capabilities: input.role === "worker" ? input.capabilities ?? input.skills ?? [] : undefined,
    availabilityStatus: input.role === "worker" ? "Available" : undefined,
    availability: input.role === "worker" ? "Available" : undefined,
    businessName: input.role === "client" ? input.businessName : undefined,
    verificationStatus: input.role === "worker" ? "Pending Verification" : undefined,
    phoneVerified: false,
    thirdPartyProvider: "none",
    currentLatitude: input.role === "worker" ? 10.6765 : undefined,
    currentLongitude: input.role === "worker" ? 122.9509 : undefined,
    preferredRadiusKm: input.role === "worker" ? 5 : undefined,
    completedTasks: 0,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(firestore, "users", input.id), withoutUndefined({ ...user }));

  if (input.role === "worker") {
    await setDoc(doc(firestore, "workerProfiles", input.id), {
      userId: input.id,
      skills: user.skills ?? [],
      capabilities: user.capabilities ?? [],
      availabilityStatus: "Available",
      availability: "Available",
      completedTasks: 0,
      verificationStatus: "Pending Verification",
      currentLatitude: user.currentLatitude,
      currentLongitude: user.currentLongitude,
      preferredRadiusKm: user.preferredRadiusKm,
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

  if (
    updates.role === "worker" ||
    updates.skills ||
    updates.capabilities ||
    updates.availabilityStatus ||
    updates.availability ||
    updates.profilePhotoUrl ||
    updates.experienceDescription ||
    updates.yearsOfExperience ||
    updates.validIdType ||
    updates.validIdUrl ||
    updates.medicalCertificateUrl ||
    updates.verificationStatus ||
    updates.currentLatitude !== undefined ||
    updates.currentLongitude !== undefined ||
    updates.preferredRadiusKm !== undefined
  ) {
    await setDoc(
      doc(firestore, "workerProfiles", userId),
      {
        userId,
        ...withoutUndefined({
          skills: updates.skills,
          capabilities: updates.capabilities,
          availabilityStatus: updates.availabilityStatus,
          availability: updates.availability,
          profilePhotoUrl: updates.profilePhotoUrl,
          experienceDescription: updates.experienceDescription,
          yearsOfExperience: updates.yearsOfExperience,
          validIdType: updates.validIdType,
          validIdUrl: updates.validIdUrl,
          medicalCertificateUrl: updates.medicalCertificateUrl,
          verificationStatus: updates.verificationStatus,
          currentLatitude: updates.currentLatitude,
          currentLongitude: updates.currentLongitude,
          preferredRadiusKm: updates.preferredRadiusKm
        }),
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
