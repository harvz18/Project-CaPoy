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
  verificationStatus: "Verified", currentLatitude: 10.6766, currentLongitude: 122.9509,
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
    skill: 35,
    proximity: 30,
    availability: 15,
    verification: 10,
    experience: 5,
    rating: 3,
    completedTasks: 2
  });
});

test("nearer workers receive more proximity points within the same radius", () => {
  const nearby = scoreWorkerForTask(task(), worker(), Date.parse(now));
  const farther = scoreWorkerForTask(task({ latitude: 10.71 }), worker(), Date.parse(now));

  assert.equal(farther.eligible, true);
  assert.ok(nearby.score > farther.score);
  assert.ok(nearby.breakdown.proximity > farther.breakdown.proximity);
});

test("new unrated workers remain eligible and only miss optional history points", () => {
  const result = scoreWorkerForTask(task(), worker({
    rating: 0,
    ratingCount: 0,
    completedTasks: 0,
    experienceDescription: undefined,
    yearsOfExperience: undefined
  }), Date.parse(now));

  assert.equal(result.eligible, true);
  assert.equal(result.score, 90);
  assert.equal(result.breakdown.rating, 0);
  assert.match(result.reasons.join(" "), /no rating history/);
});

test("trusted match snapshots persist policy, score, reasons, distance, and breakdown", () => {
  const snapshot = buildMatchSnapshot(task(), worker(), Date.parse(now));

  assert.equal(snapshot.matchPolicyVersion, 3);
  assert.equal(snapshot.matchScore, 100);
  assert.equal(snapshot.eligible, true);
  assert.ok(snapshot.distanceKm >= 0);
  assert.ok(Array.isArray(snapshot.matchReasons));
  assert.deepEqual(snapshot.scoreBreakdown, {
    skill: 35,
    proximity: 30,
    availability: 15,
    verification: 10,
    experience: 5,
    rating: 3,
    completedTasks: 2
  });
});

test("mismatched worker is never notified", () => {
  const result = scoreWorkerForTask(
    task(), worker({ capabilities: ["Repair"] }), Date.parse(now)
  );
  assert.equal(result.eligible, false);
});

test("worker outside their preferred radius is never notified", () => {
  const result = scoreWorkerForTask(
    task({ latitude: 10.8 }), worker(), Date.parse(now)
  );
  assert.equal(result.eligible, false);
});

test("stale, inaccurate, busy, assigned, unapproved, and expired workers are never notified", () => {
  const results = [
    scoreWorkerForTask(task(), worker({ locationUpdatedAt: "2026-09-29T03:29:59.999Z" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ locationAccuracyMeters: 201 }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ availabilityStatus: "Busy" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ activeTaskId: "active" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ verificationStatus: "Pending Verification" }), Date.parse(now)),
    scoreWorkerForTask(task({ expiresAt: now }), worker(), Date.parse(now))
  ];
  assert.ok(results.every((result) => !result.eligible));
});

test("manual pins can match for discovery but device accuracy is enforced", () => {
  assert.equal(scoreWorkerForTask(task(), worker({ locationSource: "manual", locationAccuracyMeters: undefined }), Date.parse(now)).eligible, true);
});

test("matching notification policy is deterministic and independent from push opt-in", () => {
  assert.equal(MATCH_POLICY_VERSION, 3);
  assert.equal(
    MATCH_POLICY_WEIGHTS.skill + MATCH_POLICY_WEIGHTS.proximityMaximum +
      MATCH_POLICY_WEIGHTS.availability + MATCH_POLICY_WEIGHTS.verification +
      MATCH_POLICY_WEIGHTS.experience + MATCH_POLICY_WEIGHTS.rating +
      MATCH_POLICY_WEIGHTS.completedTasks,
    100
  );
  assert.equal(matchingNotificationId("task-1", "worker-1"), "task-1_nearby_worker-1");
  assert.equal(matchingNotificationsEnabled(undefined), true);
  assert.equal(matchingNotificationsEnabled({ matchingEnabled: true, pushEnabled: false }), true);
  assert.equal(matchingNotificationsEnabled({ matchingEnabled: false, pushEnabled: true }), false);
});
