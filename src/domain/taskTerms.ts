import { Task, TaskChangeRequest, TaskTerms } from "../types";

const termKeys: Array<keyof TaskTerms> = [
  "title", "description", "category", "location", "locationAddress", "latitude", "longitude",
  "geofenceRadius", "locationCapturedAt", "locationAccuracyMeters", "locationSource",
  "requiredCapability", "requiredCapabilities", "wage", "estimatedDuration", "durationValue",
  "durationUnit", "scheduleMode", "scheduleDate", "scheduleStart", "scheduleEnd", "pricingMode", "perks"
];

const labels: Partial<Record<keyof TaskTerms, string>> = {
  title: "title", description: "description", category: "category", location: "landmark",
  locationAddress: "address", latitude: "task pin", longitude: "task pin", geofenceRadius: "worker radius",
  durationValue: "duration", durationUnit: "duration", scheduleMode: "schedule", scheduleDate: "schedule",
  scheduleStart: "schedule", scheduleEnd: "schedule", wage: "budget", pricingMode: "pricing",
  requiredCapability: "required capabilities", requiredCapabilities: "required capabilities", perks: "special offers"
};

export function getTaskTerms(task: Task): TaskTerms {
  const terms = {} as TaskTerms;
  termKeys.forEach((key) => {
    const value = task[key as keyof Task];
    if (value !== undefined) (terms as Record<string, unknown>)[key] = value;
  });
  return terms;
}

export function getChangedTaskTermKeys(before: TaskTerms, after: TaskTerms) {
  return termKeys.filter((key) => !sameValue(before[key], after[key]));
}

export function summarizeTaskTermChanges(keys: string[]) {
  const summary = [...new Set(keys.map((key) => labels[key as keyof TaskTerms] ?? key))];
  if (!summary.length) return "task details";
  if (summary.length <= 3) return summary.join(", ");
  return `${summary.slice(0, 3).join(", ")}, and ${summary.length - 3} more`;
}

export function hasPendingTaskChange(task: Task) {
  return task.changeRequest?.status === "Pending";
}

export function canEditTaskTerms(task: Task, clientId: string) {
  // A task becomes immutable the moment it is posted. Employers can correct
  // details in the mandatory overview before creation, never afterwards.
  return false;
}

export function makeTaskChangeRequest(task: Task, proposedTerms: TaskTerms, requestedBy: string, now: string): TaskChangeRequest {
  const previousTerms = getTaskTerms(task);
  const changedFields = getChangedTaskTermKeys(previousTerms, proposedTerms);
  if (!changedFields.length) throw new Error("No task details were changed.");
  return {
    version: (task.changeRequest?.version ?? 0) + 1,
    status: "Pending",
    requestedBy,
    requestedAt: now,
    previousTerms,
    proposedTerms,
    changedFields
  };
}

function sameValue(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  return left === right;
}
