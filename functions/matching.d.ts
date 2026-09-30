export type CoreMatchScoreBreakdown = {
  skill: number;
  proximity: number;
  availability: number;
  verification: number;
  experience: number;
  rating: number;
  completedTasks: number;
};

export type CoreMatchResult = {
  eligible: boolean;
  score: number;
  distanceKm?: number;
  reasons: string[];
  breakdown?: CoreMatchScoreBreakdown;
};

export const DISCOVERY_LOCATION_MAX_AGE_MS: number;
export const DISCOVERY_MAX_DEVICE_ACCURACY_METERS: number;
export const MATCH_POLICY_VERSION: number;
export const MATCH_POLICY_WEIGHTS: Readonly<{
  skill: number;
  proximityMinimum: number;
  proximityMaximum: number;
  availability: number;
  verification: number;
  experience: number;
  rating: number;
  completedTasks: number;
}>;

export function scoreWorkerForTask(task: unknown, worker: unknown, now?: number): CoreMatchResult;
export function buildMatchSnapshot(task: unknown, worker: unknown, now?: number): Record<string, unknown>;
export function matchingNotificationId(taskId: string, workerId: string): string;
export function matchingNotificationsEnabled(preferences: { matchingEnabled?: boolean } | undefined): boolean;
