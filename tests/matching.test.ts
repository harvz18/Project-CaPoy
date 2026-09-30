import assert from "node:assert/strict";
import test from "node:test";
import { rankTasksForWorker, rankTaskMatches, scoreWorkerForTask } from "../src/domain/matching";
import { Task, TaskMatch, UserProfile } from "../src/types";
import { calculateDistanceKm, getGeofenceCheck } from "../src/utils/location";

const now = "2026-09-29T04:00:00.000Z";
const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1", clientId: "client-1", title: "Clean a room", description: "Clean",
  category: "Cleaning", requiredCapability: "Cleaning", location: "Bacolod",
  latitude: 10.6765, longitude: 122.9509, geofenceRadius: 500, wage: "500",
  estimatedDuration: "2 Hours", status: "Finding Workers", paymentMethod: "COD", createdAt: now,
  ...overrides
});
const worker = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "worker-1", role: "worker", fullName: "Worker", mobileNumber: "09999999999", address: "Bacolod",
  rating: 5, accountStatus: "active", capabilities: ["Cleaning"], availabilityStatus: "Available",
  verificationStatus: "Verified", currentLatitude: 10.6766, currentLongitude: 122.9509,
  preferredRadiusKm: 5, locationSource: "device", locationUpdatedAt: now, locationAccuracyMeters: 12,
  completedTasks: 10, experienceDescription: "Five years", ...overrides
});

test("a qualified nearby worker receives a predictable perfect score", () => {
  const result = scoreWorkerForTask(task(), worker(), Date.parse(now));
  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
  assert.ok((result.distanceKm ?? 1) < 0.1);
  assert.ok(result.reasons.some((reason) => reason.includes("preferred radius")));
});

test("missing capability and coordinates fail closed", () => {
  const result = scoreWorkerForTask(task(), worker({ capabilities: ["Basic repair"], skills: [], currentLatitude: undefined }), Date.parse(now));
  assert.equal(result.eligible, false);
  assert.equal(result.score, 0);
  assert.ok(result.reasons.some((reason) => reason.includes("Missing required capability")));
  assert.ok(result.reasons.some((reason) => reason.includes("valid worker location")));
});

test("a task outside the preferred radius is not eligible", () => {
  const result = scoreWorkerForTask(task({ latitude: 10.8 }), worker(), Date.parse(now));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((reason) => reason.includes("outside the worker's")));
});

test("task recommendations sort by eligibility, score, and distance", () => {
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

test("check-in requires a fresh accurate device location", () => {
  assert.equal(getGeofenceCheck(worker({ locationSource: "manual" }), task(), Date.parse(now)).allowed, false);
  assert.equal(getGeofenceCheck(worker({ locationUpdatedAt: "2026-09-29T03:30:00.000Z" }), task(), Date.parse(now)).allowed, false);
  assert.equal(getGeofenceCheck(worker(), task(), Date.parse(now)).allowed, true);
});

test("discovery accepts the radius boundary and rejects stale or inaccurate device locations", () => {
  const boundaryTask = task({ latitude: 10.721466 });
  const boundary = scoreWorkerForTask(boundaryTask, worker(), Date.parse(now));
  assert.equal(boundary.eligible, true);
  assert.ok((boundary.distanceKm ?? 0) <= 5);
  assert.equal(scoreWorkerForTask(task({ latitude: 10.7216 }), worker(), Date.parse(now)).eligible, false);

  const stale = scoreWorkerForTask(task(), worker({ locationUpdatedAt: "2026-09-29T03:29:59.999Z" }), Date.parse(now));
  assert.equal(stale.eligible, false);
  assert.ok(stale.reasons.some((reason) => reason.includes("stale")));

  const inaccurate = scoreWorkerForTask(task(), worker({ locationAccuracyMeters: 201 }), Date.parse(now));
  assert.equal(inaccurate.eligible, false);
  assert.ok(inaccurate.reasons.some((reason) => reason.includes("accuracy")));
});

test("manual discovery pins are accepted but still require freshness", () => {
  const manual = worker({ locationSource: "manual", locationAccuracyMeters: undefined });
  assert.equal(scoreWorkerForTask(task(), manual, Date.parse(now)).eligible, true);
  assert.equal(scoreWorkerForTask(task(), { ...manual, locationUpdatedAt: "2026-09-29T03:00:00.000Z" }, Date.parse(now)).eligible, false);
});

test("busy, assigned, restricted, unapproved, closed, and expired matches fail closed", () => {
  const cases = [
    scoreWorkerForTask(task(), worker({ availabilityStatus: "Busy" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ activeTaskId: "active-task" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ accountStatus: "suspended" }), Date.parse(now)),
    scoreWorkerForTask(task(), worker({ verificationStatus: "Pending Verification" }), Date.parse(now)),
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
