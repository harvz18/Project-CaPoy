const assert = require("node:assert/strict");
const test = require("node:test");
const { scoreWorkerForTask } = require("./matching");

test("eligible nearby worker receives a perfect score", () => {
  const result = scoreWorkerForTask(
    { category: "Cleaning", requiredCapability: "Cleaning", latitude: 10.6765, longitude: 122.9509 },
    { role: "worker", accountStatus: "active", capabilities: ["Cleaning"], availabilityStatus: "Available",
      verificationStatus: "Verified", currentLatitude: 10.6766, currentLongitude: 122.9509,
      preferredRadiusKm: 5, rating: 5, completedTasks: 10, experienceDescription: "Five years" }
  );
  assert.equal(result.eligible, true);
  assert.equal(result.score, 100);
});

test("mismatched worker is never notified", () => {
  const result = scoreWorkerForTask(
    { category: "Cleaning", latitude: 10.6765, longitude: 122.9509 },
    { role: "worker", capabilities: ["Repair"], availabilityStatus: "Available", currentLatitude: 10.6766,
      currentLongitude: 122.9509, preferredRadiusKm: 5 }
  );
  assert.equal(result.eligible, false);
});

test("worker outside their preferred radius is never notified", () => {
  const result = scoreWorkerForTask(
    { category: "Cleaning", latitude: 10.8, longitude: 122.9509 },
    { role: "worker", capabilities: ["Cleaning"], availabilityStatus: "Available", currentLatitude: 10.6766,
      currentLongitude: 122.9509, preferredRadiusKm: 5 }
  );
  assert.equal(result.eligible, false);
});
