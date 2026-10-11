import assert from "node:assert/strict";
import test from "node:test";
import { getPublicProfileBackfill } from "../src/services/userService";
import { UserProfile } from "../src/types";

const ratedWorker: UserProfile = {
  id: "worker-1",
  role: "worker",
  fullName: "Rated Worker",
  mobileNumber: "09170000000",
  address: "Bacolod City",
  accountStatus: "active",
  rating: 5,
  ratingCount: 1,
  ratingTotal: 5,
  availabilityStatus: "Available",
  availability: "Available",
  verificationStatus: "Pending Verification",
  completedTasks: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

test("login does not overwrite an existing public profile", () => {
  assert.equal(getPublicProfileBackfill(ratedWorker, true), undefined);
});

test("login can backfill a missing public profile without exposing private fields", () => {
  const backfill = getPublicProfileBackfill(ratedWorker, false);
  assert.equal(backfill?.id, ratedWorker.id);
  assert.equal(backfill?.ratingTotal, 5);
  assert.equal("mobileNumber" in (backfill ?? {}), false);
  assert.equal("address" in (backfill ?? {}), false);
});
