import assert from "node:assert/strict";
import test from "node:test";
import {
  createFirestoreVerificationDocumentPath,
  parseFirestoreVerificationDocumentPath,
  splitVerificationDocumentBase64
} from "../src/utils/verificationDocument";

test("Firestore verification document pointers are user- and document-specific", () => {
  const path = createFirestoreVerificationDocumentPath("user-123", "medical-certificate");
  assert.equal(path, "firestoreVerification/user-123/medical-certificate");
  assert.deepEqual(parseFirestoreVerificationDocumentPath(path), {
    userId: "user-123",
    kind: "medical-certificate"
  });
  assert.equal(parseFirestoreVerificationDocumentPath("firestoreVerification/user-123/unknown"), undefined);
  assert.equal(parseFirestoreVerificationDocumentPath(`${path}/unexpected`), undefined);
});

test("verification payload chunks reassemble without changing the file contents", () => {
  const value = "a".repeat(900_017);
  const chunks = splitVerificationDocumentBase64(value);
  assert.equal(chunks.join(""), value);
  assert.equal(chunks.every((chunk) => chunk.length <= 450_000), true);
});
