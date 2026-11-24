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
  const listingExpiry = time(task.expiresAt);
  const scheduledStart = task.scheduleMode !== "anytime" ? time(task.scheduleStart) : undefined;
  // A date-only task remains open through its selected Manila date. Check the
  // date even on legacy records that were saved before scheduleMode existed.
  const scheduledDateEnd = /^\d{4}-\d{2}-\d{2}$/.test(task.scheduleDate ?? "")
    ? time(`${task.scheduleDate}T23:59:59.999${MANILA_OFFSET}`)
    : undefined;
  const scheduledDeadline = [scheduledStart, scheduledDateEnd]
    .filter((value): value is number => value !== undefined)
    .reduce<number | undefined>((earliest, value) => earliest === undefined ? value : Math.min(earliest, value), undefined);

  // A task's live schedule is authoritative. Older records can carry a stale
  // applicationDeadlineAt from before the schedule was edited, so it must not
  // keep a past-due scheduled task visible on the job board.
  const candidates = scheduledDeadline === undefined
    ? [explicit, listingExpiry]
    : [scheduledDeadline, listingExpiry];
  return candidates.filter((value): value is number => value !== undefined)
    .reduce<number | undefined>((earliest, value) => earliest === undefined ? value : Math.min(earliest, value), undefined);
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
