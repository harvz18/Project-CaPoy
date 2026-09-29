const assert = require("node:assert/strict");
const test = require("node:test");

const { buildIdentityReview } = require("./identity");

test("verified identity decisions create an immutable lock marker", () => {
  const reviewedAt = "2026-09-30T00:00:00.000Z";
  assert.deepEqual(buildIdentityReview("Verified", reviewedAt, "admin-1"), {
    identityStatus: "Approved",
    identityApprovedAt: reviewedAt,
    identityApprovedBy: "admin-1",
    identityLockedAt: reviewedAt
  });
});

test("non-approved decisions do not create identity lock fields", () => {
  assert.deepEqual(buildIdentityReview("Rejected", "time", "admin-1"), {
    identityStatus: "Rejected"
  });
  assert.deepEqual(buildIdentityReview("Needs Resubmission", "time", "admin-1"), {
    identityStatus: "Needs Resubmission"
  });
  assert.throws(() => buildIdentityReview("Pending Verification", "time", "admin-1"));
});
