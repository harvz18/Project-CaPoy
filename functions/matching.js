const EARTH_RADIUS_KM = 6371;

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

function scoreWorkerForTask(task, worker) {
  const reasons = [];
  const normalize = (value) => String(value || "").trim().toLowerCase();
  const required = normalize(task.requiredCapability || task.category);
  const capabilities = [...(worker.capabilities || []), ...(worker.skills || [])].map(normalize);
  const capabilityMatch = !required || capabilities.includes(required);
  const unavailable = (worker.availabilityStatus || worker.availability || "Unavailable") !== "Available";
  const rejected = ["Rejected", "Needs Resubmission"].includes(worker.verificationStatus);
  const distance = distanceKm(worker.currentLatitude, worker.currentLongitude, task.latitude, task.longitude);
  const radius = worker.preferredRadiusKm || 0;
  if (!capabilityMatch) reasons.push(`Missing required capability: ${task.requiredCapability || task.category}.`);
  if (unavailable) reasons.push("Worker is not currently available.");
  if (rejected) reasons.push("Verification must be resolved before applying.");
  if (distance === undefined || radius <= 0) reasons.push("A valid worker location and preferred radius are required.");
  if (distance !== undefined && radius > 0 && distance > radius) reasons.push(`Task is outside the worker's ${radius} km preferred radius.`);
  const eligible = worker.role === "worker" && !["suspended", "deleted"].includes(worker.accountStatus) &&
    capabilityMatch && !unavailable && !rejected && distance !== undefined && radius > 0 && distance <= radius;
  if (!eligible) return { eligible: false, score: 0, distanceKm: distance, reasons };
  let score = 50;
  reasons.push(`Matches ${task.requiredCapability || task.category}.`, "Available for work.");
  score += 30;
  reasons.push(`Within the worker's ${radius} km preferred radius.`);
  if (worker.verificationStatus === "Verified") { score += 10; reasons.push("Identity verified."); }
  else if (worker.verificationStatus === "Pending Verification") { score += 4; reasons.push("Verification is pending."); }
  if ((worker.experienceDescription || "").trim() || (worker.yearsOfExperience || "").trim()) score += 5;
  score += Math.round((Math.max(0, Math.min(5, worker.rating || 0)) / 5) * 3);
  score += Math.min(2, Math.floor((worker.completedTasks || 0) / 5));
  return { eligible: true, score: Math.min(100, score), distanceKm: distance, reasons };
}

module.exports = { scoreWorkerForTask };
