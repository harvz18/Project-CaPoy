export const firestoreProfilePhotoPrefix = "firestoreProfilePhotos";
export const firestoreVerificationFilePrefix = "firestoreVerificationFiles";
export const maxFirestoreProfilePhotoBytes = 1024 * 1024;
export const maxFirestoreVerificationFileBytes = 5 * 1024 * 1024;
export const firestoreFileChunkCharacters = 450_000;

export type VerificationFileKind = "valid-id" | "medical-certificate" | "police-clearance";

export type FirestoreFilePointer =
  | { type: "profile-photo"; userId: string }
  | { type: "verification"; userId: string; kind: VerificationFileKind };

export function createFirestoreProfilePhotoPath(userId: string) {
  return `${firestoreProfilePhotoPrefix}/${userId}`;
}

export function createFirestoreVerificationFilePath(userId: string, kind: VerificationFileKind) {
  return `${firestoreVerificationFilePrefix}/${userId}/${kind}`;
}

export function parseFirestoreFilePath(path: string): FirestoreFilePointer | null {
  const profileParts = path.split("/");
  if (profileParts.length === 2 && profileParts[0] === firestoreProfilePhotoPrefix && profileParts[1]) {
    return { type: "profile-photo", userId: profileParts[1] };
  }

  if (
    profileParts.length === 3
    && profileParts[0] === firestoreVerificationFilePrefix
    && profileParts[1]
    && isVerificationFileKind(profileParts[2])
  ) {
    return { type: "verification", userId: profileParts[1], kind: profileParts[2] };
  }

  return null;
}

export function isFirestoreProfilePhotoPath(path?: string) {
  return typeof path === "string" && parseFirestoreFilePath(path)?.type === "profile-photo";
}

export function isVerificationFileKind(value: string): value is VerificationFileKind {
  return value === "valid-id" || value === "medical-certificate" || value === "police-clearance";
}

export function splitFirestoreFileBase64(base64: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += firestoreFileChunkCharacters) {
    chunks.push(base64.slice(offset, offset + firestoreFileChunkCharacters));
  }
  return chunks;
}
