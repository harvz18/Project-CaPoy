import { DurationUnit, Task } from "../types";

const ACTIVE_ASSIGNMENT_STATUSES = new Set<Task["status"]>([
  "Accepted",
  "In Progress",
  "Pending Approval"
]);

export function formatTaskDuration(task: Pick<Task, "durationValue" | "durationUnit" | "estimatedDuration">) {
  if (!task.durationValue || !task.durationUnit) return task.estimatedDuration;
  const unit = task.durationValue === 1 ? task.durationUnit : `${task.durationUnit}s`;
  return `${task.durationValue} ${unit[0].toUpperCase()}${unit.slice(1)}`;
}

export function durationToMilliseconds(value: number, unit: DurationUnit) {
  const hour = 60 * 60 * 1000;
  if (unit === "hour") return value * hour;
  if (unit === "day") return value * 24 * hour;
  if (unit === "week") return value * 7 * 24 * hour;
  return value * 30 * 24 * hour;
}

export function getTaskSchedule(task: Pick<Task, "scheduleStart" | "scheduleEnd">) {
  const start = task.scheduleStart ? Date.parse(task.scheduleStart) : Number.NaN;
  const end = task.scheduleEnd ? Date.parse(task.scheduleEnd) : Number.NaN;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

export function schedulesOverlap(
  left: Pick<Task, "scheduleStart" | "scheduleEnd">,
  right: Pick<Task, "scheduleStart" | "scheduleEnd">
) {
  const leftSchedule = getTaskSchedule(left);
  const rightSchedule = getTaskSchedule(right);
  if (!leftSchedule || !rightSchedule) return false;
  return leftSchedule.start < rightSchedule.end && rightSchedule.start < leftSchedule.end;
}

export function findScheduleConflict(tasks: Task[], candidate: Task, workerId: string) {
  return tasks.find((task) =>
    task.id !== candidate.id
    && task.workerId === workerId
    && ACTIVE_ASSIGNMENT_STATUSES.has(task.status)
    && schedulesOverlap(task, candidate)
  );
}

export function getScheduleBasedAvailability(tasks: Task[], workerId: string, at = Date.now()) {
  const busy = tasks.some((task) => {
    if (task.workerId !== workerId || !ACTIVE_ASSIGNMENT_STATUSES.has(task.status)) return false;
    const schedule = getTaskSchedule(task);
    return schedule ? at >= schedule.start && at < schedule.end : task.status === "In Progress";
  });
  return busy ? "Busy" as const : "Available" as const;
}

export function formatTaskSchedule(task: Pick<Task, "scheduleStart" | "scheduleEnd">) {
  const schedule = getTaskSchedule(task);
  if (!schedule) return "Schedule to be arranged";
  const formatter = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  return `${formatter.format(schedule.start)} – ${formatter.format(schedule.end)}`;
}

export function formatTaskPrice(task: Pick<Task, "pricingMode" | "wage" | "agreedAmount">) {
  if (task.agreedAmount) return `₱${task.agreedAmount} agreed`;
  if (task.pricingMode === "bidding") return "Open for Bidding";
  return `₱${task.wage}`;
}

export function getUserTaskHistory(tasks: Task[], userId: string, role: "worker" | "client") {
  const related = role === "client"
    ? tasks.filter((task) => task.clientId === userId)
    : tasks.filter((task) => task.workerId === userId || task.applicantIds?.includes(userId));
  const completed = related.filter((task) => ["Finished", "Archived"].includes(task.status)).length;
  const cancelled = related.filter((task) => ["Cancelled", "Expired"].includes(task.status)).length;
  if (role === "client") {
    return {
      totalLabel: "Tasks Posted",
      total: related.length,
      acceptedLabel: "Taskers Hired",
      accepted: new Set(related.map((task) => task.workerId).filter(Boolean)).size,
      completed,
      cancelled
    };
  }
  return {
    totalLabel: "Applications",
    total: related.filter((task) => task.applicantIds?.includes(userId) || task.workerId === userId).length,
    acceptedLabel: "Accepted",
    accepted: related.filter((task) => task.workerId === userId).length,
    completed,
    cancelled
  };
}
