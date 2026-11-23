import { Task } from "../types";

const MANILA_OFFSET = "+08:00";

function time(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const result = value ? new Date(value as string | number | Date).getTime() : Number.NaN;
  return Number.isFinite(result) ? result : undefined;
}

/** The last instant a task can receive a new application. */
export function getApplicationDeadline(task: Pick<Task, "applicationDeadlineAt" | "expiresAt" | "scheduleMode" | "scheduleStart" | "scheduleDate">) {
  const explicit = time(task.applicationDeadlineAt);
  if (explicit !== undefined) return explicit;
  const listingExpiry = time(task.expiresAt);
  const scheduledStart = task.scheduleMode !== "anytime" ? time(task.scheduleStart) : undefined;
  // An anytime task has no time of day. It remains open through its selected
  // Manila date, then closes immediately after that date ends.
  const anytimeDateEnd = task.scheduleMode === "anytime" && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduleDate ?? "")
    ? time(`${task.scheduleDate}T23:59:59.999${MANILA_OFFSET}`)
    : undefined;
  return [listingExpiry, scheduledStart, anytimeDateEnd].filter((value): value is number => value !== undefined).reduce<number | undefined>((earliest, value) => earliest === undefined ? value : Math.min(earliest, value), undefined);
}

export function isTaskPastApplicationDeadline(task: Pick<Task, "applicationDeadlineAt" | "expiresAt" | "scheduleMode" | "scheduleStart" | "scheduleDate">, now = Date.now()) {
  const deadline = getApplicationDeadline(task);
  return deadline !== undefined && deadline <= now;
}

export function isTaskOpenForApplications(task: Pick<Task, "status" | "workerId" | "applicationDeadlineAt" | "expiresAt" | "scheduleMode" | "scheduleStart" | "scheduleDate">, now = Date.now()) {
  return (task.status === "Finding Workers" || task.status === "Applied")
    && !task.workerId
    && !isTaskPastApplicationDeadline(task, now);
}

export function taskExpiryMessage(task: Pick<Task, "applicationDeadlineAt" | "expiresAt" | "scheduleMode" | "scheduleStart" | "scheduleDate">) {
  return isTaskPastApplicationDeadline(task)
    ? "This task is no longer accepting applications because its scheduled date has passed."
    : "This task is no longer accepting applications.";
}
