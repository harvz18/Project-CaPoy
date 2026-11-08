import assert from "node:assert/strict";
import test from "node:test";
import { canEditTaskTerms, getChangedTaskTermKeys, getTaskTerms, makeTaskChangeRequest, summarizeTaskTermChanges } from "../src/domain/taskTerms";
import { Task } from "../src/types";

const task: Task = {
  id: "task-1", clientId: "client-1", title: "Move boxes", description: "To the next street", category: "Moving assistance",
  location: "Barangay Hall", locationAddress: "Main Street", latitude: 14.6, longitude: 121, geofenceRadius: 500,
  locationSource: "map", requiredCapability: "Moving assistance", requiredCapabilities: ["Moving assistance"], wage: "500",
  estimatedDuration: "1 day", durationValue: 1, durationUnit: "day", scheduleMode: "fixed", scheduleStart: "2026-12-01T08:00:00.000Z",
  scheduleEnd: "2026-12-01T16:00:00.000Z", pricingMode: "fixed", perks: ["Lunch"], status: "Finding Workers", paymentMethod: "COD", createdAt: "2026-11-05T00:00:00.000Z"
};

test("task terms identify material edits and create a reviewable request", () => {
  const before = getTaskTerms(task);
  const after = { ...before, wage: "650", perks: ["Lunch", "Transport"] };
  assert.deepEqual(getChangedTaskTermKeys(before, after), ["wage", "perks"]);
  const request = makeTaskChangeRequest(task, after, "client-1", "2026-11-05T01:00:00.000Z");
  assert.equal(request.status, "Pending");
  assert.equal(request.version, 1);
  assert.match(summarizeTaskTermChanges(request.changedFields), /budget/);
});

test("posted tasks are immutable for all employers", () => {
  assert.equal(canEditTaskTerms(task, "client-1"), false);
  assert.equal(canEditTaskTerms(task, "other-client"), false);
  assert.equal(canEditTaskTerms({ ...task, status: "Finished" }, "client-1"), false);
});
