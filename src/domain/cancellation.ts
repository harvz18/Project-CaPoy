import { Role, Task, UserProfile } from "../types";

type CancellationActor = Pick<UserProfile, "id" | "role">;

export type CancellationEligibility =
  | { allowed: true; stage: "open" | "pre-check-in" }
  | { allowed: false; reason: string };

export function getCancellationEligibility(task: Task, actor: CancellationActor): CancellationEligibility {
  if (!["Finding Workers", "Applied", "Accepted"].includes(task.status)) {
    return { allowed: false, reason: "Cancellation is unavailable after task check-in or completion. Contact the project coordinator if there is a problem." };
  }

  if (actor.role === "client" && actor.id === task.clientId) {
    if (!task.workerId) return { allowed: true, stage: "open" };
    if (task.status === "Accepted") return { allowed: true, stage: "pre-check-in" };
  }

  if (actor.role === "worker" && actor.id === task.workerId && task.status === "Accepted") {
    return { allowed: true, stage: "pre-check-in" };
  }

  return { allowed: false, reason: "Only the employer may cancel an open task, and either assigned party may cancel before the recorded task start." };
}

export function assertCanCancelTask(task: Task, actor: CancellationActor) {
  const eligibility = getCancellationEligibility(task, actor);
  if (!eligibility.allowed) throw new Error(eligibility.reason);
  return eligibility;
}

export function normalizeCancellationReason(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().replace(/\s+/g, " ");
}

export function assertValidCancellationReason(value: string) {
  const reason = normalizeCancellationReason(value);
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("Enter a cancellation reason from 5 to 500 characters.");
  }
  return reason;
}

export function isCancellationActorRole(role: Role): role is "client" | "worker" {
  return role === "client" || role === "worker";
}
