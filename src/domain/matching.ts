import { Task, TaskMatch, UserProfile } from "../types";
import { getTaskDistanceKm, hasValidCoordinates } from "../utils/location";

export type MatchResult = {
  eligible: boolean;
  score: number;
  distanceKm?: number;
  reasons: string[];
};

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function scoreWorkerForTask(task: Task, worker: UserProfile): MatchResult {
  const reasons: string[] = [];
  const unavailable = (worker.availabilityStatus ?? worker.availability ?? "Unavailable") !== "Available";
  const required = normalized(task.requiredCapability ?? task.category);
  const capabilities = [...(worker.capabilities ?? []), ...(worker.skills ?? [])].map(normalized);
  const capabilityMatch = !required || capabilities.includes(required);
  const rejectedVerification = worker.verificationStatus === "Rejected" || worker.verificationStatus === "Needs Resubmission";
  const hasLocations = hasValidCoordinates({ latitude: task.latitude, longitude: task.longitude }) &&
    hasValidCoordinates({ latitude: worker.currentLatitude, longitude: worker.currentLongitude });
  const distanceKm = hasLocations ? getTaskDistanceKm(worker, task) : undefined;
  const radius = worker.preferredRadiusKm ?? 0;

  if (!capabilityMatch) reasons.push(`Missing required capability: ${task.requiredCapability ?? task.category}.`);
  if (unavailable) reasons.push("Worker is not currently available.");
  if (rejectedVerification) reasons.push("Verification must be resolved before applying.");
  if (!hasLocations || radius <= 0) reasons.push("A valid worker location and preferred radius are required.");
  if (distanceKm !== undefined && radius > 0 && distanceKm > radius) {
    reasons.push(`Task is outside the worker's ${radius} km preferred radius.`);
  }

  const eligible = worker.role === "worker" &&
    worker.accountStatus !== "suspended" && worker.accountStatus !== "deleted" &&
    capabilityMatch && !unavailable && !rejectedVerification && hasLocations && radius > 0 &&
    (distanceKm as number) <= radius;
  if (!eligible) return { eligible: false, score: 0, distanceKm, reasons };

  let score = 35;
  reasons.push(`Matches ${task.requiredCapability ?? task.category}.`);

  score += 30;
  reasons.push(`Within the worker's ${radius} km preferred radius.`);

  score += 15;
  reasons.push("Available for work.");
  if (worker.verificationStatus === "Verified") {
    score += 10;
    reasons.push("Identity verified.");
  } else if (worker.verificationStatus === "Pending Verification") {
    score += 4;
    reasons.push("Verification is pending.");
  }
  if (worker.experienceDescription?.trim() || worker.yearsOfExperience?.trim()) {
    score += 5;
    reasons.push("Experience details provided.");
  }
  const rating = Math.max(0, Math.min(5, worker.rating ?? 0));
  score += Math.round((rating / 5) * 3);
  score += Math.min(2, Math.floor((worker.completedTasks ?? 0) / 5));

  return { eligible: true, score: Math.min(100, score), distanceKm, reasons };
}

export function rankTasksForWorker(tasks: Task[], worker: UserProfile) {
  return tasks
    .map((task) => ({ task, match: scoreWorkerForTask(task, worker) }))
    .sort((left, right) =>
      Number(right.match.eligible) - Number(left.match.eligible) ||
      right.match.score - left.match.score ||
      (left.match.distanceKm ?? Number.POSITIVE_INFINITY) - (right.match.distanceKm ?? Number.POSITIVE_INFINITY) ||
      new Date(right.task.createdAt).getTime() - new Date(left.task.createdAt).getTime()
    );
}

export function rankTaskMatches(matches: TaskMatch[]) {
  return [...matches].sort((left, right) =>
    Number(right.eligible) - Number(left.eligible) ||
    (right.matchScore ?? -1) - (left.matchScore ?? -1) ||
    (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY) ||
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );
}
