import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECK_IN_MAX_ACCURACY_METERS,
  LIVE_LOCATION_MIN_INTERVAL_MS,
  LIVE_LOCATION_STALE_AFTER_MS,
  LocationReading,
  getLiveLocationIssue,
  shouldAcceptLiveLocationUpdate,
  shouldTrackTaskLocation
} from "../src/utils/location";

const capturedAt = "2026-09-30T08:00:00.000Z";
const reading = (overrides: Partial<LocationReading> = {}): LocationReading => ({
  latitude: 10.6765,
  longitude: 122.9509,
  accuracyMeters: 20,
  capturedAt,
  ...overrides
});

test("foreground tracking runs only for the assigned tasker during active work", () => {
  assert.equal(shouldTrackTaskLocation("worker", "worker-1", "worker-1", "Accepted"), true);
  assert.equal(shouldTrackTaskLocation("worker", "worker-1", "worker-1", "In Progress"), true);
  assert.equal(shouldTrackTaskLocation("worker", "worker-1", "worker-1", "Pending Approval"), false);
  assert.equal(shouldTrackTaskLocation("worker", "worker-1", "worker-2", "In Progress"), false);
  assert.equal(shouldTrackTaskLocation("client", "client-1", "worker-1", "In Progress"), false);
});

test("live updates require a meaningful time or movement threshold", () => {
  const previous = reading();
  assert.equal(shouldAcceptLiveLocationUpdate(undefined, previous), true);
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({
    capturedAt: new Date(Date.parse(capturedAt) + 1_000).toISOString()
  })), false);
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({
    latitude: 10.67661,
    capturedAt: new Date(Date.parse(capturedAt) + 1_000).toISOString()
  })), true);
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({
    capturedAt: new Date(Date.parse(capturedAt) + LIVE_LOCATION_MIN_INTERVAL_MS).toISOString()
  })), true);
});

test("live updates reject invalid and out-of-order readings", () => {
  const previous = reading();
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({ latitude: 100 })), false);
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({ capturedAt: "invalid" })), false);
  assert.equal(shouldAcceptLiveLocationUpdate(previous, reading({ capturedAt })), false);
});

test("live location reports missing, stale, and inaccurate states", () => {
  const now = Date.parse(capturedAt) + 5_000;
  assert.match(getLiveLocationIssue(undefined, now) ?? "", /Waiting/);
  assert.equal(getLiveLocationIssue(reading(), now), undefined);
  assert.match(getLiveLocationIssue(reading({ accuracyMeters: CHECK_IN_MAX_ACCURACY_METERS + 1 }), now) ?? "", /Low location accuracy/);
  assert.match(getLiveLocationIssue(reading(), Date.parse(capturedAt) + LIVE_LOCATION_STALE_AFTER_MS + 1) ?? "", /stale/);
});
