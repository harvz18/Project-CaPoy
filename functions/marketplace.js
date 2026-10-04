function validSchedule(task) {
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
