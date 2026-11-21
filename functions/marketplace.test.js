const assert = require("node:assert/strict");
const test = require("node:test");
const { findConflictingAssignment, overlapsSchedule } = require("./marketplace");

const scheduled = (id, start, end, status = "Accepted") => ({
  id, scheduleStart: start, scheduleEnd: end, status
});

test("server conflict policy rejects overlap and permits adjacent schedules", () => {
  const confirmed = scheduled("one", "2026-10-10T00:00:00.000Z", "2026-10-10T09:00:00.000Z");
  const overlap = scheduled("two", "2026-10-10T05:00:00.000Z", "2026-10-10T10:00:00.000Z", "Applied");
  const adjacent = scheduled("three", "2026-10-10T09:00:00.000Z", "2026-10-10T12:00:00.000Z", "Applied");
  assert.equal(overlapsSchedule(confirmed, overlap), true);
  assert.equal(overlapsSchedule(confirmed, adjacent), false);
  assert.equal(findConflictingAssignment([confirmed], overlap, overlap.id)?.id, "one");
  assert.equal(findConflictingAssignment([confirmed], adjacent, adjacent.id), undefined);
});

test("completed and cancelled assignments do not reserve a schedule", () => {
  const candidate = scheduled("candidate", "2026-10-10T05:00:00.000Z", "2026-10-10T10:00:00.000Z", "Applied");
  for (const status of ["Finished", "Archived", "Cancelled", "Expired"]) {
    const oldTask = scheduled("old", "2026-10-10T00:00:00.000Z", "2026-10-10T09:00:00.000Z", status);
    assert.equal(findConflictingAssignment([oldTask], candidate, candidate.id), undefined);
  }
});

test("server conflict policy permits different dates and protects an anytime date", () => {
  const confirmed = scheduled("one", "2026-10-10T00:00:00.000Z", "2026-10-10T09:00:00.000Z");
  const nextDay = scheduled("two", "2026-10-11T00:00:00.000Z", "2026-10-11T09:00:00.000Z", "Applied");
  const anytimeSameDay = { id: "three", scheduleMode: "anytime", scheduleDate: "2026-10-10", status: "Applied" };
  const anytimeNextDay = { id: "four", scheduleMode: "anytime", scheduleDate: "2026-10-11", status: "Applied" };

  assert.equal(overlapsSchedule(confirmed, nextDay), false);
  assert.equal(overlapsSchedule(confirmed, anytimeSameDay), true);
  assert.equal(overlapsSchedule(confirmed, anytimeNextDay), false);
});
