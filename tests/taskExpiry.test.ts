import test from "node:test";
import assert from "node:assert/strict";
import { isTaskOpenForApplications, isTaskPastApplicationDeadline } from "../src/domain/taskExpiry";

const open = { id: "task", status: "Finding Workers" as const, clientId: "client", title: "Task", scheduleMode: "fixed" as const, createdAt: "2026-11-20T00:00:00.000Z" };

test("scheduled tasks close at their scheduled start time", () => {
  const task = { ...open, scheduleStart: "2026-11-23T09:00:00.000+08:00", expiresAt: "2026-11-30T00:00:00.000Z" };
  assert.equal(isTaskOpenForApplications(task, Date.parse("2026-11-23T00:59:59.000Z")), true);
  assert.equal(isTaskPastApplicationDeadline(task, Date.parse("2026-11-23T01:00:00.000Z")), true);
});

test("anytime tasks close only after their selected Manila date", () => {
  const task = { ...open, scheduleMode: "anytime" as const, scheduleDate: "2026-11-23", expiresAt: "2026-11-30T00:00:00.000Z" };
  assert.equal(isTaskOpenForApplications(task, Date.parse("2026-11-23T15:59:59.000Z")), true);
  assert.equal(isTaskPastApplicationDeadline(task, Date.parse("2026-11-23T16:00:00.000Z")), true);
});

test("a past scheduled date closes legacy tasks even with a later stored cutoff", () => {
  const task = {
    ...open,
    scheduleDate: "2026-11-22",
    applicationDeadlineAt: "2026-11-30T00:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z"
  };
  assert.equal(isTaskOpenForApplications(task, Date.parse("2026-11-25T00:00:00.000Z")), false);
  assert.equal(isTaskPastApplicationDeadline(task, Date.parse("2026-11-25T00:00:00.000Z")), true);
});

test("listing expiry remains the fallback for tasks without a schedule date", () => {
  const task = { ...open, scheduleMode: "anytime" as const, expiresAt: "2026-11-23T00:00:00.000Z" };
  assert.equal(isTaskOpenForApplications(task, Date.parse("2026-11-22T23:59:59.000Z")), true);
  assert.equal(isTaskOpenForApplications(task, Date.parse("2026-11-23T00:00:00.000Z")), false);
});
