import assert from "node:assert/strict";
import test from "node:test";
import { getTaskPostingErrors } from "../src/domain/taskPosting";

const validTask = {
  title: "Move furniture", description: "Help carry a sofa upstairs.", category: "Moving assistance",
  location: "Near the barangay hall", locationAddress: "Rizal Street, Barangay Villamonte, Bacolod City",
  latitude: 10.6765, longitude: 122.9509, geofenceRadius: 500, locationSource: "map" as const,
  requiredCapabilities: ["Moving assistance"], wage: "500", durationValue: 1,
  scheduleMode: "fixed" as const, scheduleStart: "2027-01-01T08:00:00.000Z", scheduleEnd: "2027-01-01T09:00:00.000Z",
  pricingMode: "fixed" as const, paymentMethod: "COD"
};

test("a complete Bacolod fixed-price task passes posting validation", () => {
  assert.deepEqual(getTaskPostingErrors(validTask), {});
});

test("posting validation requires explicit category, capability, address, and a Bacolod pin", () => {
  const errors = getTaskPostingErrors({ ...validTask, category: "", requiredCapabilities: [], locationAddress: "", latitude: undefined });
  assert.equal(errors.category, "Please select a task category.");
  assert.equal(errors.capabilities, "Select at least one required capability.");
  assert.equal(errors.address, "Please enter or select the task address.");
  assert.match(errors.pin ?? "", /valid task pin/);
});

test("fixed-price budget must be at least ₱150 and an out-of-area address is rejected", () => {
  assert.equal(getTaskPostingErrors({ ...validTask, wage: "149.99" }).budget, "Minimum budget is ₱150.");
  assert.equal(getTaskPostingErrors({ ...validTask, wage: "" }).budget, "Budget is required.");
  assert.equal(getTaskPostingErrors({ ...validTask, locationAddress: "Makati City" }).address, "Choose an address within Bacolod City.");
  assert.equal(getTaskPostingErrors({ ...validTask, latitude: 14.5995, longitude: 120.9842 }).pin, "Choose a task pin within Bacolod City.");
});
