import assert from "node:assert/strict";
import test from "node:test";
import {
  createFirestorePaymentProofPath,
  isPaymentProofPathForTask,
  parseFirestorePaymentProofPath,
  paymentProofChunkCharacters,
  splitPaymentProofBase64
} from "../src/utils/paymentProof";

test("Firestore receipt pointers are task- and party-specific", () => {
  const path = createFirestorePaymentProofPath("task-123", "worker");
  assert.equal(path, "firestorePaymentProofs/task-123/worker");
  assert.deepEqual(parseFirestorePaymentProofPath(path), { taskId: "task-123", party: "worker" });
  assert.equal(isPaymentProofPathForTask("task-123", path, "worker"), true);
  assert.equal(isPaymentProofPathForTask("task-123", path, "client"), false);
  assert.equal(isPaymentProofPathForTask("another-task", path), false);
  assert.equal(parseFirestorePaymentProofPath(`${path}/unexpected`), undefined);
});

test("legacy Storage receipt paths remain valid", () => {
  assert.equal(isPaymentProofPathForTask("task-123", "paymentProofs/task-123/receipt.jpg"), true);
  assert.equal(isPaymentProofPathForTask("task-123", "paymentProofs/another-task/receipt.jpg"), false);
});

test("receipt payloads split below the Firestore document limit and reassemble exactly", () => {
  const value = "a".repeat(paymentProofChunkCharacters * 2 + 17);
  const chunks = splitPaymentProofBase64(value);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [paymentProofChunkCharacters, paymentProofChunkCharacters, 17]);
  assert.equal(chunks.join(""), value);
});
