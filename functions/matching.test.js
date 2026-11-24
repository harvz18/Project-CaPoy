const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildMatchSnapshot,
  MATCH_POLICY_VERSION,
  MATCH_POLICY_WEIGHTS,
  matchingNotificationId,
  matchingNotificationsEnabled,
  scoreWorkerForTask
} = require("./matching");

const now = "2026-09-29T04:00:00.000Z";
const task = (overrides = {}) => ({
  category: "Cleaning", requiredCapability: "Cleaning", latitude: 10.6765, longitude: 122.9509,
  status: "Finding Workers", createdAt: now, ...overrides
});
const worker = (overrides = {}) => ({
  role: "worker", accountStatus: "active", capabilities: ["Cleaning"], availabilityStatus: "Available",
  verificationStatus: "Verified", serviceAreaLatitude: 10.6766, serviceAreaLongitude: 122.9509,
  serviceAreaUpdatedAt: now, currentLatitude: 10.6766, currentLongitude: 122.9509,
  preferredRadiusKm: 5, locationSource: "device", locationUpdatedAt: now, locationAccuracyMeters: 12,
  rating: 5, completedTasks: 10, experienceDescription: "Five years", ...overrides
});

test("eligible nearby worker receives a perfect score", () => {
  const result = scoreWorkerForTask(
    task(), worker(), Date.parse(now)
  );
  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.breakdown, {
    skill: 50,
    proximity: 35,
    verification: 10,
    availability: 5
  });
});

test("nearer workers receive more proximity points within the same radius", () => {
  const nearby = scoreWorkerForTask(task(), worker(), Date.parse(now));
  const farther = scoreWorkerForTask(task({ latitude: 10.71 }), worker(), Date.parse(now));

  assert.equal(farther.eligible, true);
  assert.ok(nearby.score > farther.score);
  assert.ok(nearby.breakdown.proximity > farther.breakdown.proximity);
});

test("experience, ratings, and completed work do not change the match percentage", () => {
  const result = scoreWorkerForTask(task(), worker({
    rating: 0,
    ratingCount: 0,
    completedTasks: 0,
    experienceDescription: undefined,
    yearsOfExperience: undefined
  }), Date.parse(now));

  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.breakdown, {
    skill: 50,
    proximity: 35,
    verification: 10,
    availability: 5
  });
});

test("unverified accounts are excluded from marketplace recommendations", () => {
  const result = scoreWorkerForTask(
    task(), worker({ verificationStatus: "Pending Verification", identityStatus: "Pending Approval" }), Date.parse(now)
  );

  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
  assert.match(result.reasons.join(" "), /Unverified account/);
});

test("trusted match snapshots persist policy, score, reasons, distance, and breakdown", () => {
  const snapshot = buildMatchSnapshot(task(), worker(), Date.parse(now));

  assert.equal(snapshot.matchPolicyVersion, 7);
  assert.equal(snapshot.matchScore, 100);
  assert.equal(snapshot.eligible, true);
  assert.ok(snapshot.distanceKm >= 0);
  assert.ok(Array.isArray(snapshot.matchReasons));
  assert.deepEqual(snapshot.scoreBreakdown, {
    skill: 50,
    proximity: 35,
    verification: 10,
    availability: 5
  });
});

test("mismatched worker is never notified", () => {
  const result = scoreWorkerForTask(
    task(), worker({ capabilities: ["Repair"] }), Date.parse(now)
  );
  assert.equal(result.eligible, false);
});

test("all selected required capabilities must be present for a worker to match", () => {
  assert.equal(scoreWorkerForTask(
    task({ requiredCapabilities: ["Cleaning", "Errands"] }), worker({ capabilities: ["Cleaning"] }), Date.parse(now)
  ).eligible, false);
  assert.equal(scoreWorkerForTask(
    task({ requiredCapabilities: ["Cleaning", "Errands"] }), worker({ capabilities: ["Cleaning", "Errands"] }), Date.parse(now)
  ).eligible, true);
});

test("worker outside their preferred radius is never notified", () => {
  const result = scoreWorkerForTask(
    task({ latitude: 10.8 }), worker(), Date.parse(now)
  );
  assert.equal(result.eligible, false);
});

test("saved service areas stay eligible while live device readings are reserved for check-in", () => {
  const busy = scoreWorkerForTask(task(), worker({ availabilityStatus: "Busy", activeTaskId: "active" }), Date.parse(now));
  assert.equal(busy.eligible, true);
  assert.equal(busy.score, 95);
  assert.equal(scoreWorkerForTask(task(), worker({ locationUpdatedAt: "2026-09-29T03:00:00.000Z", locationAccuracyMeters: 20_000 }), Date.parse(now)).eligible, true);
  assert.equal(scoreWorkerForTask(task({ expiresAt: now }), worker(), Date.parse(now)).eligible, false);
});

test("a past scheduled date excludes a task even when its stored cutoff is later", () => {
  const result = scoreWorkerForTask(
    task({ scheduleDate: "2026-09-28", applicationDeadlineAt: "2026-10-10T00:00:00.000Z" }),
    worker(),
    Date.parse(now)
  );
  assert.equal(result.eligible, false);
  assert.match(result.reasons.join(" "), /Task has expired/);
});

test("legacy saved pins keep working until a worker saves a dedicated service area", () => {
  assert.equal(scoreWorkerForTask(task(), worker({ serviceAreaLatitude: undefined, serviceAreaLongitude: undefined, locationSource: "manual", locationAccuracyMeters: undefined }), Date.parse(now)).eligible, true);
});

test("matching notification policy is deterministic and independent from push opt-in", () => {
  assert.equal(MATCH_POLICY_VERSION, 7);
  assert.equal(
    MATCH_POLICY_WEIGHTS.skill + MATCH_POLICY_WEIGHTS.proximityMaximum +
      MATCH_POLICY_WEIGHTS.availability + MATCH_POLICY_WEIGHTS.verification,
    100
  );
  assert.equal(matchingNotificationId("task-1", "worker-1"), "task-1_nearby_worker-1");
  assert.equal(matchingNotificationsEnabled(undefined), true);
  assert.equal(matchingNotificationsEnabled({ matchingEnabled: true, pushEnabled: false }), true);
  assert.equal(matchingNotificationsEnabled({ matchingEnabled: false, pushEnabled: true }), false);
});
