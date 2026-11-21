function validSchedule(task) {
  if (task.scheduleMode === "anytime") {
    const date = typeof task.scheduleDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.scheduleDate)
      ? Date.parse(`${task.scheduleDate}T00:00:00.000Z`)
      : Number.NaN;
    // An anytime task reserves its selected calendar day. There is no reliable
    // hour to compare, so same-day acceptance is deliberately conservative.
    return Number.isFinite(date) ? { start: date, end: date + 24 * 60 * 60 * 1000 } : null;
  }
  const start = Date.parse(task.scheduleStart ?? "");
  const end = Date.parse(task.scheduleEnd ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function overlapsSchedule(left, right) {
  const a = validSchedule(left);
  const b = validSchedule(right);
  // Legacy tasks without a structured schedule are treated conservatively.
  if (!a || !b) return true;
  return a.start < b.end && b.start < a.end;
}

function findConflictingAssignment(assignments, candidate, taskId) {
  return assignments.find((assigned) =>
    assigned.id !== taskId
    && ["Accepted", "In Progress", "Pending Approval"].includes(assigned.status)
    && overlapsSchedule(assigned, candidate)
  );
}

module.exports = { findConflictingAssignment, overlapsSchedule, validSchedule };
