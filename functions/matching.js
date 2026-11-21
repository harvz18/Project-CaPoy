const EARTH_RADIUS_KM = 6371;
const MATCH_POLICY_VERSION = 7;
const MATCH_POLICY_WEIGHTS = Object.freeze({
  skill: 50,
  proximityMinimum: 15,
  proximityMaximum: 35,
  verification: 10,
  availability: 5
});

function validCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function distanceKm(fromLatitude, fromLongitude, toLatitude, toLongitude) {
  if (!validCoordinates(fromLatitude, fromLongitude) || !validCoordinates(toLatitude, toLongitude)) return undefined;
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreWorkerForTask(task, worker, now = Date.now()) {
  const reasons = [];
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const required = [...new Set((Array.isArray(task.requiredCapabilities) && task.requiredCapabilities.length
    ? task.requiredCapabilities
    : [task.requiredCapability || task.category]).map(normalize).filter(Boolean))];
  const capabilities = [...(worker.capabilities || []), ...(worker.skills || [])].map(normalize);
  const missingCapabilities = required.filter((capability) => !capabilities.includes(capability));
  const capabilityMatch = missingCapabilities.length === 0;
  const approvedIdentity = worker.verificationStatus === "Verified" || worker.identityStatus === "Approved";
  const openTask = ["Finding Workers", "Applied"].includes(task.status);
  const expiry = task.expiresAt ? new Date(task.expiresAt).getTime() : undefined;
  const unexpiredTask = expiry === undefined || (Number.isFinite(expiry) && expiry > now);
  // Smart Match deliberately uses a stable saved service area, never a live
  // check-in/device reading. Existing profiles retain a read-only fallback to
  // their former saved location until they save their service area once.
  const hasSavedServiceArea = validCoordinates(worker.serviceAreaLatitude, worker.serviceAreaLongitude);
  const serviceLatitude = hasSavedServiceArea ? worker.serviceAreaLatitude : worker.currentLatitude;
  const serviceLongitude = hasSavedServiceArea ? worker.serviceAreaLongitude : worker.currentLongitude;
  const distance = distanceKm(serviceLatitude, serviceLongitude, task.latitude, task.longitude);
  const radius = worker.preferredRadiusKm || 0;
  const activeAccount = !["suspended", "deleted"].includes(worker.accountStatus);
  reasons.push(approvedIdentity ? "Verified account." : "Unverified account.");
  if (worker.role !== "worker") reasons.push("Only tasker profiles can be matched.");
  if (!activeAccount) reasons.push("Account must be active before matching.");
  if (!capabilityMatch) reasons.push(`Missing required capability: ${missingCapabilities.join(", ")}.`);
  if (!openTask) reasons.push("Task is not open for applications.");
  if (!unexpiredTask) reasons.push("Task has expired.");
  if (distance === undefined || radius <= 0) reasons.push("A saved service-area pin and preferred radius are required.");
  if (distance !== undefined && radius > 0 && distance > radius) reasons.push(`Task is outside the worker's ${radius} km preferred radius.`);
  const eligible = worker.role === "worker" && activeAccount &&
    approvedIdentity && capabilityMatch && openTask && unexpiredTask &&
    distance !== undefined && radius > 0 && distance <= radius;
  if (!eligible) return { eligible: false, score: 0, distanceKm: distance, reasons };
  const proximityRatio = Math.max(0, Math.min(1, 1 - (distance / radius)));
  const proximity = MATCH_POLICY_WEIGHTS.proximityMinimum + Math.round(
    proximityRatio * (MATCH_POLICY_WEIGHTS.proximityMaximum - MATCH_POLICY_WEIGHTS.proximityMinimum)
  );
  // Availability is only a small ordering signal. A tasker's exact schedule
  // is checked securely when an employer accepts their application.
  const currentlyAvailable = (worker.availabilityStatus || worker.availability || "Available").toLowerCase() === "available";
  const breakdown = {
    skill: MATCH_POLICY_WEIGHTS.skill,
    proximity,
    verification: MATCH_POLICY_WEIGHTS.verification,
    availability: currentlyAvailable ? MATCH_POLICY_WEIGHTS.availability : 0
  };
  const score = Object.values(breakdown).reduce((total, points) => total + points, 0);

  reasons.push(`Matches ${required.join(", ") || task.category}.`);
  reasons.push(`${distance.toFixed(1)} km away within the ${radius} km preferred radius.`);
  reasons.push(currentlyAvailable
    ? "Currently available for new work."
    : "Availability is limited; schedule conflicts are checked before acceptance.");
  return { eligible: true, score: Math.min(100, score), distanceKm: distance, reasons, breakdown };
}

function buildMatchSnapshot(task, worker, now = Date.now()) {
  const match = scoreWorkerForTask(task, worker, now);
  return {
    matchScore: match.score,
    matchReasons: match.reasons,
    ...(match.distanceKm === undefined ? {} : { distanceKm: Number(match.distanceKm.toFixed(3)) }),
    eligible: match.eligible,
    matchPolicyVersion: MATCH_POLICY_VERSION,
    ...(match.breakdown ? { scoreBreakdown: match.breakdown } : {})
  };
}

function matchingNotificationId(taskId, workerId) {
  return `${taskId}_nearby_${workerId}`;
}

function matchingNotificationsEnabled(preferences) {
  return !preferences || preferences.matchingEnabled !== false;
}

module.exports = {
  MATCH_POLICY_VERSION,
  MATCH_POLICY_WEIGHTS,
  buildMatchSnapshot,
  matchingNotificationId,
  matchingNotificationsEnabled,
  scoreWorkerForTask
};
