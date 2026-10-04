import assert from "node:assert/strict";
import test from "node:test";
import {
  findScheduleConflict,
  formatTaskDuration,
  getScheduleBasedAvailability,
  schedulesOverlap
} from "../src/domain/taskMarketplace";
import type { Task } from "../src/types";

function task(id: string, start: string, end: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    clientId: "client-1",
    title: id,
    description: "Test",
    category: "Cleaning",
    location: "Bacolod",
    wage: "500",
    estimatedDuration: "1 day",
    scheduleStart: start,
    scheduleEnd: end,
    status: "Accepted",
    paymentMethod: "COD",
    createdAt: "2026-10-01T00:00:00.000Z",
    workerId: "worker-1",
    ...overrides
  };
}

test("structured durations render singular and plural units", () => {
  assert.equal(formatTaskDuration({ durationValue: 1, durationUnit: "week", estimatedDuration: "legacy" }), "1 Week");
  assert.equal(formatTaskDuration({ durationValue: 3, durationUnit: "day", estimatedDuration: "legacy" }), "3 Days");
  assert.equal(formatTaskDuration({ estimatedDuration: "Whole Day" }), "Whole Day");
});

test("schedule overlap rejects intersecting assignments and permits adjacent or later tasks", () => {
  const monday = task("monday", "2026-10-05T08:00:00.000Z", "2026-10-05T17:00:00.000Z");
  const overlapping = task("overlap", "2026-10-05T13:00:00.000Z", "2026-10-05T18:00:00.000Z");
  const adjacent = task("adjacent", "2026-10-05T17:00:00.000Z", "2026-10-05T19:00:00.000Z");
  const tuesday = task("tuesday", "2026-10-06T08:00:00.000Z", "2026-10-06T17:00:00.000Z");
  assert.equal(schedulesOverlap(monday, overlapping), true);
  assert.equal(schedulesOverlap(monday, adjacent), false);
  assert.equal(findScheduleConflict([monday], overlapping, "worker-1")?.id, "monday");
  assert.equal(findScheduleConflict([monday], tuesday, "worker-1"), undefined);
});

test("availability is busy only during a confirmed active schedule", () => {
  const assignment = task("active", "2026-10-05T08:00:00.000Z", "2026-10-05T17:00:00.000Z");
  assert.equal(getScheduleBasedAvailability([assignment], "worker-1", Date.parse("2026-10-05T12:00:00.000Z")), "Busy");
  assert.equal(getScheduleBasedAvailability([assignment], "worker-1", Date.parse("2026-10-06T12:00:00.000Z")), "Available");
  assert.equal(getScheduleBasedAvailability([{ ...assignment, status: "Finished" }], "worker-1", Date.parse("2026-10-05T12:00:00.000Z")), "Available");
});
