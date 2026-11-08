import assert from "node:assert/strict";
import test from "node:test";
import { formatRelativeTime } from "../src/utils/relativeTime";

const now = Date.parse("2026-11-09T12:00:00.000Z");

test("job post times are rendered in concise relative form", () => {
  assert.equal(formatRelativeTime("2026-11-09T11:59:20.000Z", now), "Posted just now");
  assert.equal(formatRelativeTime("2026-11-09T11:58:00.000Z", now), "Posted 2 min ago");
  assert.equal(formatRelativeTime("2026-11-09T10:00:00.000Z", now), "Posted 2 hrs ago");
  assert.equal(formatRelativeTime("2026-11-08T12:00:00.000Z", now), "Posted 1 day ago");
  assert.equal(formatRelativeTime(undefined, now), "Posted recently");
});
