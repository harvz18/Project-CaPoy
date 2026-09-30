import {
  MATCH_POLICY_VERSION,
  MATCH_POLICY_WEIGHTS,
  scoreWorkerForTask as scoreUsingCanonicalPolicy
} from "../../functions/matching";
import { MatchScoreBreakdown, Task, TaskMatch, UserProfile } from "../types";

export type MatchResult = {
  eligible: boolean;
  score: number;
  distanceKm?: number;
  reasons: string[];
  breakdown?: MatchScoreBreakdown;
};

export { MATCH_POLICY_VERSION, MATCH_POLICY_WEIGHTS };

export function scoreWorkerForTask(task: Task, worker: UserProfile, now = Date.now()): MatchResult {
  return scoreUsingCanonicalPolicy(task, worker, now) as MatchResult;
}

function safeTimestamp(value: string | undefined) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function rankTasksForWorker(tasks: Task[], worker: UserProfile, now = Date.now()) {
  return tasks
    .map((task) => ({ task, match: scoreWorkerForTask(task, worker, now) }))
    .sort((left, right) =>
      Number(right.match.eligible) - Number(left.match.eligible) ||
      right.match.score - left.match.score ||
      (left.match.distanceKm ?? Number.POSITIVE_INFINITY) - (right.match.distanceKm ?? Number.POSITIVE_INFINITY) ||
      safeTimestamp(right.task.createdAt) - safeTimestamp(left.task.createdAt) ||
      left.task.id.localeCompare(right.task.id)
    );
}

function eligibilityRank(match: TaskMatch) {
  if (match.eligible === true) return 2;
  if (match.eligible === false) return 0;
  return 1;
}

export function rankTaskMatches(matches: TaskMatch[]) {
  return [...matches].sort((left, right) =>
    eligibilityRank(right) - eligibilityRank(left) ||
    (right.matchScore ?? -1) - (left.matchScore ?? -1) ||
    (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY) ||
    safeTimestamp(left.createdAt) - safeTimestamp(right.createdAt) ||
    left.workerId.localeCompare(right.workerId)
  );
}

export function summarizeScoreBreakdown(breakdown: MatchScoreBreakdown | undefined) {
  if (!breakdown) return undefined;
  return [
    `Skill ${breakdown.skill}`,
    `Distance ${breakdown.proximity}`,
    `Availability ${breakdown.availability}`,
    `Verification ${breakdown.verification}`,
    `Experience ${breakdown.experience}`,
    `Rating ${breakdown.rating}`,
    `Completed work ${breakdown.completedTasks}`
  ].join(" · ");
}
