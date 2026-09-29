import { collection, deleteField, doc, getDoc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { PublicRole, UserProfile } from "../types";
import { initialIdentityStatus, normalizeAddress, normalizeFullName } from "../domain/profileIdentity";
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

function toPublicProfile(user: Partial<UserProfile> & Pick<UserProfile, "id" | "role" | "fullName">) {
  return withoutUndefined({
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    rating: user.rating,
    ratingCount: user.ratingCount,
    skills: user.skills,
    capabilities: user.capabilities,
    availabilityStatus: user.availabilityStatus,
    availability: user.availability,
    businessName: user.businessName,
    profilePhotoUrl: user.profilePhotoUrl,
    experienceDescription: user.experienceDescription,
    yearsOfExperience: user.yearsOfExperience,
    verificationStatus: user.verificationStatus,
    completedTasks: user.completedTasks,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  });
}

export type SaveUserInput = {
  id: string;
  role: PublicRole;
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
  const fullName = normalizeFullName(input.fullName);
  const address = normalizeAddress(input.address || "Bacolod City");
  const user: UserProfile = {
    id: input.id,
    role: input.role,
    fullName,
    mobileNumber: input.mobileNumber,
    address,
    rating: 0,
    accountStatus: "active",
    skills: input.role === "worker" ? input.skills ?? input.capabilities ?? [] : undefined,
    capabilities: input.role === "worker" ? input.capabilities ?? input.skills ?? [] : undefined,
    availabilityStatus: input.role === "worker" ? "Available" : undefined,
    availability: input.role === "worker" ? "Available" : undefined,
    businessName: input.role === "client" ? input.businessName : undefined,
    verificationStatus: input.role === "worker" ? "Pending Verification" : undefined,
    identityStatus: initialIdentityStatus(input.role),
    phoneVerified: false,
    thirdPartyProvider: "none",
    preferredRadiusKm: input.role === "worker" ? 5 : undefined,
    completedTasks: 0,
    createdAt: now,
    updatedAt: now
  };

  const batch = writeBatch(firestore);

  batch.set(doc(firestore, "users", input.id), withoutUndefined({ ...user }));
  batch.set(doc(firestore, "publicProfiles", input.id), toPublicProfile(user));

  if (input.role === "worker") {
    batch.set(doc(firestore, "workerProfiles", input.id), withoutUndefined({
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
    }));
  } else {
    batch.set(doc(firestore, "clientProfiles", input.id), {
      userId: input.id,
      businessName: input.businessName ?? "",
      createdAt: now,
      updatedAt: now
    });
  }

  await batch.commit();

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

export async function ensurePublicProfile(user: UserProfile) {
  const firestore = requireDb();
  const publicProfileRef = doc(firestore, "publicProfiles", user.id);
  await setDoc(publicProfileRef, toPublicProfile(user));
}

export function subscribeToUserProfile(
  userId: string,
  onChange: (user: UserProfile | null) => void,
  onError: (error: Error) => void
) {
  if (!db || !userId) {
    onChange(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(db, "users", userId),
    (snapshot) => {
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as UserProfile) : null);
    },
    onError
  );
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const firestore = requireDb();
  const sanitizedUpdates = withoutUndefined({
    ...updates,
    fullName: updates.fullName === undefined ? undefined : normalizeFullName(updates.fullName),
    address: updates.address === undefined ? undefined : normalizeAddress(updates.address)
  });
  const nextUpdates = {
    ...sanitizedUpdates,
    updatedAt: new Date().toISOString()
  };

  const batch = writeBatch(firestore);
  const userRef = doc(firestore, "users", userId);
  const currentSnapshot = await getDoc(userRef);

  if (!currentSnapshot.exists()) {
    throw new Error("User profile not found.");
  }

  const currentUser = { id: currentSnapshot.id, ...currentSnapshot.data() } as UserProfile;
  const mergedUser = { ...currentUser, ...withoutUndefined(nextUpdates) } as UserProfile;
  const userUpdates: Record<string, unknown> = withoutUndefined(nextUpdates);
  if (sanitizedUpdates.locationSource === "manual" && sanitizedUpdates.locationAccuracyMeters === undefined) {
    userUpdates.locationAccuracyMeters = deleteField();
    delete mergedUser.locationAccuracyMeters;
  }

  batch.update(userRef, userUpdates);
  batch.set(doc(firestore, "publicProfiles", userId), toPublicProfile(mergedUser));

  if (
    sanitizedUpdates.role === "worker" ||
    sanitizedUpdates.skills ||
    sanitizedUpdates.capabilities ||
    sanitizedUpdates.availabilityStatus ||
    sanitizedUpdates.availability ||
    sanitizedUpdates.profilePhotoUrl ||
    sanitizedUpdates.experienceDescription ||
    sanitizedUpdates.yearsOfExperience ||
    sanitizedUpdates.validIdType ||
    sanitizedUpdates.validIdUrl ||
    sanitizedUpdates.medicalCertificateUrl ||
    sanitizedUpdates.verificationStatus ||
    sanitizedUpdates.currentLatitude !== undefined ||
    sanitizedUpdates.currentLongitude !== undefined ||
    sanitizedUpdates.locationUpdatedAt !== undefined ||
    sanitizedUpdates.locationAccuracyMeters !== undefined ||
    sanitizedUpdates.locationSource !== undefined ||
    sanitizedUpdates.preferredRadiusKm !== undefined
  ) {
    batch.set(
      doc(firestore, "workerProfiles", userId),
      {
        userId,
        ...withoutUndefined({
          skills: sanitizedUpdates.skills,
          capabilities: sanitizedUpdates.capabilities,
          availabilityStatus: sanitizedUpdates.availabilityStatus,
          availability: sanitizedUpdates.availability,
          profilePhotoUrl: sanitizedUpdates.profilePhotoUrl,
          experienceDescription: sanitizedUpdates.experienceDescription,
          yearsOfExperience: sanitizedUpdates.yearsOfExperience,
          validIdType: sanitizedUpdates.validIdType,
          validIdUrl: sanitizedUpdates.validIdUrl,
          medicalCertificateUrl: sanitizedUpdates.medicalCertificateUrl,
          verificationStatus: sanitizedUpdates.verificationStatus,
          currentLatitude: sanitizedUpdates.currentLatitude,
          currentLongitude: sanitizedUpdates.currentLongitude,
          locationUpdatedAt: sanitizedUpdates.locationUpdatedAt,
          locationAccuracyMeters: sanitizedUpdates.locationAccuracyMeters,
          locationSource: sanitizedUpdates.locationSource,
          preferredRadiusKm: sanitizedUpdates.preferredRadiusKm
        }),
        ...(sanitizedUpdates.locationSource === "manual" && sanitizedUpdates.locationAccuracyMeters === undefined
          ? { locationAccuracyMeters: deleteField() }
          : {}),
        updatedAt: nextUpdates.updatedAt
      },
      { merge: true }
    );
  }

  if (sanitizedUpdates.role === "client" || sanitizedUpdates.businessName) {
    batch.set(
      doc(firestore, "clientProfiles", userId),
      {
        userId,
        businessName: sanitizedUpdates.businessName ?? "",
        updatedAt: nextUpdates.updatedAt
      },
      { merge: true }
    );
  }

  await batch.commit();
  return nextUpdates;
}

export function subscribeToPublicProfiles(onChange: (users: UserProfile[]) => void, onError: (error: Error) => void) {
  if (!db) {
    onChange([]);
    return () => undefined;
  }

  return onSnapshot(
    collection(db, "publicProfiles"),
    (snapshot) => {
      onChange(
        snapshot.docs.map(
          (userDoc) =>
            ({
              mobileNumber: "",
              address: "Bacolod City",
              rating: 0,
              id: userDoc.id,
              ...userDoc.data()
            }) as UserProfile
        )
      );
    },
    onError
  );
}
