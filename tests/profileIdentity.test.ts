import assert from "node:assert/strict";
import test from "node:test";

import {
  initialIdentityStatus,
  isIdentityLocked,
  normalizeAddress,
  normalizeFullName
} from "../src/domain/profileIdentity";

test("normalizes identity text without changing its meaning", () => {
  assert.equal(normalizeFullName("  Maria   Dela Cruz  "), "Maria Dela Cruz");
  assert.equal(normalizeAddress("  Barangay  12\nBacolod City  "), "Barangay 12 Bacolod City");
});

test("rejects empty, oversized, or control-character identity text", () => {
  assert.throws(() => normalizeFullName(" "), /between 2 and 100/);
  assert.throws(() => normalizeFullName(`A${"b".repeat(100)}`), /between 2 and 100/);
  assert.throws(() => normalizeAddress("x"), /between 3 and 200/);
  assert.throws(() => normalizeAddress("Valid\u0000Address"), /control characters/);
});

test("assigns backward-compatible initial identity states", () => {
  assert.equal(initialIdentityStatus("worker"), "Pending Approval");
  assert.equal(initialIdentityStatus("client"), "Unverified");
});

test("locks new approvals and legacy verified workers", () => {
  assert.equal(isIdentityLocked({ identityStatus: "Approved" }), true);
  assert.equal(isIdentityLocked({ identityLockedAt: "2026-09-30T00:00:00.000Z" }), true);
  assert.equal(isIdentityLocked({ verificationStatus: "Verified" }), true);
  assert.equal(isIdentityLocked({ identityStatus: "Pending Approval", verificationStatus: "Pending Verification" }), false);
  assert.equal(isIdentityLocked(undefined), false);
});
