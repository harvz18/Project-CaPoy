import assert from "node:assert/strict";
import test from "node:test";
import {
  createFirestoreProfilePhotoPath,
  createFirestoreVerificationFilePath,
  firestoreFileChunkCharacters,
  parseFirestoreFilePath,
  splitFirestoreFileBase64
} from "../src/utils/firestoreFiles";

test("Firestore file pointers identify profile and private verification uploads", () => {
  const profilePath = createFirestoreProfilePhotoPath("user-123");
  const verificationPath = createFirestoreVerificationFilePath("user-123", "valid-id");

  assert.equal(profilePath, "firestoreProfilePhotos/user-123");
  assert.deepEqual(parseFirestoreFilePath(profilePath), { type: "profile-photo", userId: "user-123" });
  assert.equal(verificationPath, "firestoreVerificationFiles/user-123/valid-id");
  assert.deepEqual(parseFirestoreFilePath(verificationPath), { type: "verification", userId: "user-123", kind: "valid-id" });
  assert.equal(parseFirestoreFilePath("firestoreVerificationFiles/user-123/unknown"), null);
});

test("Firestore file chunks remain below the document-safe payload size", () => {
  const value = "a".repeat(firestoreFileChunkCharacters * 2 + 17);
  const chunks = splitFirestoreFileBase64(value);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [firestoreFileChunkCharacters, firestoreFileChunkCharacters, 17]);
  assert.equal(chunks.join(""), value);
});
