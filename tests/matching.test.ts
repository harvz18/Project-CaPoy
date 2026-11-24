import assert from "node:assert/strict";
import test from "node:test";
import {
  MATCH_POLICY_VERSION,
  rankTasksForWorker,
  rankTaskMatches,
  scoreWorkerForTask,
  summarizeScoreBreakdown
} from "../src/domain/matching";
import { Task, TaskMatch, UserProfile } from "../src/types";
import { calculateDistanceKm, getGeofenceCheck } from "../src/utils/location";

const now = "2026-09-29T04:00:00.000Z";
const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1", clientId: "client-1", title: "Clean a room", description: "Clean",
  category: "Cleaning", requiredCapability: "Cleaning", location: "Bacolod",
  latitude: 10.6765, longitude: 122.9509, geofenceRadius: 500, wage: "500",
  estimatedDuration: "2 Hours", status: "Finding Workers", paymentMethod: "Cash", createdAt: now,
  ...overrides
});
const worker = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "worker-1", role: "worker", fullName: "Worker", mobileNumber: "09999999999", address: "Bacolod",
  rating: 5, accountStatus: "active", capabilities: ["Cleaning"], availabilityStatus: "Available",
  verificationStatus: "Verified", serviceAreaLatitude: 10.6766, serviceAreaLongitude: 122.9509,
  serviceAreaUpdatedAt: now, currentLatitude: 10.6766, currentLongitude: 122.9509,
  preferredRadiusKm: 5, locationSource: "device", locationUpdatedAt: now, locationAccuracyMeters: 12,
  completedTasks: 10, experienceDescription: "Five years", ...overrides
});

test("a qualified nearby worker receives a predictable perfect score", () => {
  const result = scoreWorkerForTask(task(), worker(), Date.parse(now));
  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
  assert.ok((result.distanceKm ?? 1) < 0.1);
  assert.ok(result.reasons.some((reason) => reason.includes("preferred radius")));
  assert.equal(MATCH_POLICY_VERSION, 7);
  assert.deepEqual(result.breakdown, {
    skill: 50,
    proximity: 35,
    verification: 10,
    availability: 5
  });
});

test("distance contributes to the score within the same preferred radius", () => {
  const nearby = scoreWorkerForTask(task(), worker(), Date.parse(now));
  const farther = scoreWorkerForTask(task({ latitude: 10.71 }), worker(), Date.parse(now));

  assert.equal(farther.eligible, true);
  assert.ok(nearby.score > farther.score);
  assert.ok((nearby.breakdown?.proximity ?? 0) > (farther.breakdown?.proximity ?? 0));
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

test("an unverified account is excluded from marketplace recommendations", () => {
  const result = scoreWorkerForTask(
    task(),
    worker({ verificationStatus: "Pending Verification", identityStatus: "Pending Approval" }),
    Date.parse(now)
  );

  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("Unverified account")));
});

test("missing capability and coordinates fail closed", () => {
  const result = scoreWorkerForTask(task(), worker({ capabilities: ["Basic repair"], skills: [], serviceAreaLatitude: undefined, serviceAreaLongitude: undefined, currentLatitude: undefined }), Date.parse(now));
  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("Missing required capability")));
  assert.ok(result.reasons.some((reason) => reason.includes("saved service-area pin")));
});

test("all selected required capabilities must be present for a worker to match", () => {
  const multiCapabilityTask = task({ requiredCapabilities: ["Cleaning", "Errands"] });
  assert.equal(scoreWorkerForTask(multiCapabilityTask, worker({ capabilities: ["Cleaning"] }), Date.parse(now)).skillMatched, false);
  assert.equal(scoreWorkerForTask(multiCapabilityTask, worker({ capabilities: ["Cleaning", "Errands"] }), Date.parse(now)).skillMatched, true);
});

test("a task outside the preferred radius is not eligible", () => {
  const result = scoreWorkerForTask(task({ latitude: 10.8 }), worker(), Date.parse(now));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((reason) => reason.includes("outside the worker's")));
});

test("task recommendations put the strongest eligible match first", () => {
  const ranked = rankTasksForWorker([
    task({ id: "far", latitude: 10.71, createdAt: "2026-09-29T03:00:00.000Z" }),
    task({ id: "near", createdAt: "2026-09-29T02:00:00.000Z" }),
    task({ id: "wrong", requiredCapability: "Delivery assistance", createdAt: "2026-09-29T04:00:00.000Z" })
  ], worker(), Date.parse(now));
  assert.deepEqual(ranked.map(({ task: rankedTask }) => rankedTask.id), ["near", "far", "wrong"]);
});

test("client applicant ranking uses the stored application snapshot", () => {
  const match = (id: string, score: number, distanceKm: number): TaskMatch => ({
    id, taskId: "task-1", workerId: id, clientId: "client-1", acceptanceStatus: "Applied", createdAt: now,
    eligible: true, matchScore: score, distanceKm
  });
  assert.deepEqual(rankTaskMatches([match("lower", 75, 1), match("far", 90, 3), match("near", 90, 1)]).map((item) => item.id), ["near", "far", "lower"]);
});

test("applicant ranking is deterministic and keeps pending evaluations above ineligible snapshots", () => {
  const base = {
    taskId: "task-1",
    clientId: "client-1",
    acceptanceStatus: "Applied" as const,
    createdAt: now
  };
  const ranked = rankTaskMatches([
    { ...base, id: "ineligible", workerId: "worker-c", eligible: false, matchScore: 0 },
    { ...base, id: "pending-b", workerId: "worker-b" },
    { ...base, id: "pending-a", workerId: "worker-a" }
  ]);

  assert.deepEqual(ranked.map((item) => item.workerId), ["worker-a", "worker-b", "worker-c"]);
});

test("score explanations expose points without exposing coordinates", () => {
  const result = scoreWorkerForTask(task(), worker(), Date.parse(now));
  const summary = summarizeScoreBreakdown(result.breakdown);

  assert.match(summary ?? "", /Skill 50/);
  assert.doesNotMatch(summary ?? "", /10\.676/);
  assert.doesNotMatch(summary ?? "", /122\.950/);
});

test("check-in requires a fresh accurate device location", () => {
  assert.equal(getGeofenceCheck(worker({ locationSource: "manual" }), task(), Date.parse(now)).allowed, false);
  assert.equal(getGeofenceCheck(worker({ locationUpdatedAt: "2026-09-29T03:30:00.000Z" }), task(), Date.parse(now)).allowed, false);
  assert.equal(getGeofenceCheck(worker(), task(), Date.parse(now)).allowed, true);
});

test("saved service areas accept the radius boundary without live-device freshness", () => {
  const boundaryTask = task({ latitude: 10.721466 });
  const boundary = scoreWorkerForTask(boundaryTask, worker(), Date.parse(now));
  assert.equal(boundary.eligible, true);
  assert.ok((boundary.distanceKm ?? 0) <= 5);
  assert.equal(scoreWorkerForTask(task({ latitude: 10.7216 }), worker(), Date.parse(now)).eligible, false);

  const staleDevice = scoreWorkerForTask(task(), worker({ locationUpdatedAt: "2026-09-29T03:00:00.000Z", locationAccuracyMeters: 20_000 }), Date.parse(now));
  assert.equal(staleDevice.eligible, true);
});

test("legacy saved pins are accepted until a dedicated service area is saved", () => {
  const manual = worker({ serviceAreaLatitude: undefined, serviceAreaLongitude: undefined, locationSource: "manual", locationAccuracyMeters: undefined });
  assert.equal(scoreWorkerForTask(task(), manual, Date.parse(now)).eligible, true);
  assert.equal(scoreWorkerForTask(task(), { ...manual, locationUpdatedAt: "2026-09-29T03:00:00.000Z" }, Date.parse(now)).eligible, true);
});

test("global busy state stays discoverable while restricted, closed, and expired matches fail closed", () => {
  assert.equal(scoreWorkerForTask(task(), worker({ availabilityStatus: "Busy", activeTaskId: "active-task" }), Date.parse(now)).eligible, true);
  const cases = [
    scoreWorkerForTask(task(), worker({ accountStatus: "suspended" }), Date.parse(now)),
    scoreWorkerForTask(task({ status: "Accepted" }), worker(), Date.parse(now)),
    scoreWorkerForTask(task({ expiresAt: now }), worker(), Date.parse(now))
  ];
  assert.ok(cases.every((result) => !result.eligible));
});

test("worksite check-in permits the radius boundary and rejects a point just outside", () => {
  const boundaryWorker = worker({ currentLatitude: 10.681, currentLongitude: 122.9509 });
  const boundaryMeters = (calculateDistanceKm(
    { latitude: boundaryWorker.currentLatitude, longitude: boundaryWorker.currentLongitude },
    { latitude: 10.6765, longitude: 122.9509 }
  ) as number) * 1000;
  assert.equal(getGeofenceCheck(boundaryWorker, task({ geofenceRadius: boundaryMeters }), Date.parse(now)).allowed, true);
  assert.equal(getGeofenceCheck(boundaryWorker, task({ geofenceRadius: boundaryMeters - 0.01 }), Date.parse(now)).allowed, false);
});
