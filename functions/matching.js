const EARTH_RADIUS_KM = 6371;
const MATCH_POLICY_VERSION = 4;
const DISCOVERY_LOCATION_MAX_AGE_MS = 30 * 60 * 1000;
const DISCOVERY_MAX_DEVICE_ACCURACY_METERS = 200;
const MATCH_POLICY_WEIGHTS = Object.freeze({
  skill: 35,
  proximityMinimum: 15,
  proximityMaximum: 30,
  availability: 15,
  verification: 10,
  experience: 5,
  rating: 3,
  completedTasks: 2
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
  const activeAccount = !["suspended", "deleted"].includes(worker.accountStatus);
  if (worker.role !== "worker") reasons.push("Only tasker profiles can be matched.");
  if (!activeAccount) reasons.push("Account must be active before matching.");
  if (!capabilityMatch) reasons.push(`Missing required capability: ${task.requiredCapability || task.category}.`);
  if (unavailable) reasons.push("Worker is not currently available.");
  if (hasActiveTask) reasons.push("Worker already has an active task.");
  if (!approvedIdentity) reasons.push("Identity verification is optional during beta testing.");
  if (!openTask) reasons.push("Task is not open for applications.");
  if (!unexpiredTask) reasons.push("Task has expired.");
  if (distance === undefined || radius <= 0) reasons.push("A valid worker location and preferred radius are required.");
  if (!freshLocation) reasons.push("Worker location is stale. Refresh it before matching.");
  if (!accurateLocation) reasons.push(`Device location accuracy must be within ${DISCOVERY_MAX_DEVICE_ACCURACY_METERS} meters.`);
  if (distance !== undefined && radius > 0 && distance > radius) reasons.push(`Task is outside the worker's ${radius} km preferred radius.`);
  const eligible = worker.role === "worker" && activeAccount &&
    capabilityMatch && !unavailable && !hasActiveTask && openTask && unexpiredTask &&
    freshLocation && accurateLocation && distance !== undefined && radius > 0 && distance <= radius;
  if (!eligible) return { eligible: false, score: 0, distanceKm: distance, reasons };
  const proximityRatio = Math.max(0, Math.min(1, 1 - (distance / radius)));
  const proximity = MATCH_POLICY_WEIGHTS.proximityMinimum + Math.round(
    proximityRatio * (MATCH_POLICY_WEIGHTS.proximityMaximum - MATCH_POLICY_WEIGHTS.proximityMinimum)
  );
  const hasExperience = Boolean((worker.experienceDescription || "").trim() || (worker.yearsOfExperience || "").trim());
  const rating = Math.max(0, Math.min(5, Number(worker.rating) || 0));
  const ratingCount = Math.max(0, Number(worker.ratingCount) || 0);
  const hasRatingHistory = ratingCount > 0 || rating > 0;
  const ratingPoints = hasRatingHistory ? Math.round((rating / 5) * MATCH_POLICY_WEIGHTS.rating) : 0;
  const completedTaskPoints = Math.min(
    MATCH_POLICY_WEIGHTS.completedTasks,
    Math.floor(Math.max(0, Number(worker.completedTasks) || 0) / 5)
  );
  const breakdown = {
    skill: MATCH_POLICY_WEIGHTS.skill,
    proximity,
    availability: MATCH_POLICY_WEIGHTS.availability,
    verification: approvedIdentity ? MATCH_POLICY_WEIGHTS.verification : 0,
    experience: hasExperience ? MATCH_POLICY_WEIGHTS.experience : 0,
    rating: ratingPoints,
    completedTasks: completedTaskPoints
  };
  const score = Object.values(breakdown).reduce((total, points) => total + points, 0);

  reasons.push(`Matches ${task.requiredCapability || task.category}.`);
  reasons.push(`${distance.toFixed(1)} km away within the ${radius} km preferred radius.`);
  reasons.push("Available for work.");
  reasons.push(approvedIdentity ? "Identity approved." : "Identity is not yet verified; beta access remains enabled.");
  if (hasExperience) reasons.push("Experience details provided.");
  if (hasRatingHistory) reasons.push(`Rating history: ${rating.toFixed(1)} out of 5.`);
  else reasons.push("New tasker with no rating history yet.");
  if ((worker.completedTasks || 0) > 0) reasons.push(`${worker.completedTasks} completed task${worker.completedTasks === 1 ? "" : "s"}.`);
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
  DISCOVERY_LOCATION_MAX_AGE_MS,
  DISCOVERY_MAX_DEVICE_ACCURACY_METERS,
  MATCH_POLICY_VERSION,
  MATCH_POLICY_WEIGHTS,
  buildMatchSnapshot,
  matchingNotificationId,
  matchingNotificationsEnabled,
  scoreWorkerForTask
};
