const EARTH_RADIUS_KM = 6371;
const MATCH_POLICY_VERSION = 2;
const DISCOVERY_LOCATION_MAX_AGE_MS = 30 * 60 * 1000;
const DISCOVERY_MAX_DEVICE_ACCURACY_METERS = 200;

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
  const required = normalize(task.requiredCapability || task.category);
  const capabilities = [...(worker.capabilities || []), ...(worker.skills || [])].map(normalize);
  const capabilityMatch = !required || capabilities.includes(required);
  const unavailable = (worker.availabilityStatus || worker.availability || "Unavailable") !== "Available";
  const hasActiveTask = Boolean(worker.activeTaskId);
  const approvedIdentity = worker.verificationStatus === "Verified" || worker.identityStatus === "Approved";
  const openTask = ["Finding Workers", "Applied"].includes(task.status);
  const expiry = task.expiresAt ? new Date(task.expiresAt).getTime() : undefined;
  const unexpiredTask = expiry === undefined || (Number.isFinite(expiry) && expiry > now);
  const locationTimestamp = worker.locationUpdatedAt ? new Date(worker.locationUpdatedAt).getTime() : Number.NaN;
  const locationAge = now - locationTimestamp;
  const freshLocation = Number.isFinite(locationTimestamp) && locationAge >= 0 &&
    locationAge <= DISCOVERY_LOCATION_MAX_AGE_MS;
  const accurateLocation = worker.locationSource === "manual" || (
    worker.locationSource === "device" && Number.isFinite(worker.locationAccuracyMeters) &&
    worker.locationAccuracyMeters >= 0 && worker.locationAccuracyMeters <= DISCOVERY_MAX_DEVICE_ACCURACY_METERS
  );
  const distance = distanceKm(worker.currentLatitude, worker.currentLongitude, task.latitude, task.longitude);
  const radius = worker.preferredRadiusKm || 0;
  if (!capabilityMatch) reasons.push(`Missing required capability: ${task.requiredCapability || task.category}.`);
  if (unavailable) reasons.push("Worker is not currently available.");
  if (hasActiveTask) reasons.push("Worker already has an active task.");
  if (!approvedIdentity) reasons.push("Identity must be approved before matching.");
  if (!openTask) reasons.push("Task is not open for applications.");
  if (!unexpiredTask) reasons.push("Task has expired.");
  if (distance === undefined || radius <= 0) reasons.push("A valid worker location and preferred radius are required.");
  if (!freshLocation) reasons.push("Worker location is stale. Refresh it before matching.");
  if (!accurateLocation) reasons.push(`Device location accuracy must be within ${DISCOVERY_MAX_DEVICE_ACCURACY_METERS} meters.`);
  if (distance !== undefined && radius > 0 && distance > radius) reasons.push(`Task is outside the worker's ${radius} km preferred radius.`);
  const eligible = worker.role === "worker" && !["suspended", "deleted"].includes(worker.accountStatus) &&
    capabilityMatch && !unavailable && !hasActiveTask && approvedIdentity && openTask && unexpiredTask &&
    freshLocation && accurateLocation && distance !== undefined && radius > 0 && distance <= radius;
  if (!eligible) return { eligible: false, score: 0, distanceKm: distance, reasons };
  let score = 35;
  reasons.push(`Matches ${task.requiredCapability || task.category}.`);
  score += 30;
  reasons.push(`Within the worker's ${radius} km preferred radius.`);
  score += 15;
  reasons.push("Available for work.");
  if (worker.verificationStatus === "Verified") { score += 10; reasons.push("Identity verified."); }
  else if (worker.verificationStatus === "Pending Verification") { score += 4; reasons.push("Verification is pending."); }
  if ((worker.experienceDescription || "").trim() || (worker.yearsOfExperience || "").trim()) score += 5;
  score += Math.round((Math.max(0, Math.min(5, worker.rating || 0)) / 5) * 3);
  score += Math.min(2, Math.floor((worker.completedTasks || 0) / 5));
  return { eligible: true, score: Math.min(100, score), distanceKm: distance, reasons };
}

function matchingNotificationId(taskId, workerId) {
  return `${taskId}_nearby_${workerId}`;
}

function matchingNotificationsEnabled(preferences) {
  return !preferences || preferences.matchingEnabled !== false;
}

module.exports = {
  DISCOVERY_LOCATION_MAX_AGE_MS,
  DISCOVERY_MAX_DEVICE_ACCURACY_METERS,
  MATCH_POLICY_VERSION,
  matchingNotificationId,
  matchingNotificationsEnabled,
  scoreWorkerForTask
};
