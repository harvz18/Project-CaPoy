const ANALYTICS_VERSION = 1;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TASK_STATUSES = [
  "Finding Workers", "Applied", "Accepted", "In Progress", "Pending Approval",
  "Finished", "Archived", "Cancelled", "Disputed", "Expired"
];
const VERIFICATION_STATUSES = ["Pending Verification", "Verified", "Rejected", "Needs Resubmission"];
const PAYMENT_STATUSES = ["Pending", "Submitted", "Verified", "Rejected"];

function manilaDateKey(value) {
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

function dateStartUtc(date) {
  return Date.parse(`${date}T00:00:00+08:00`);
}

function nextDate(date) {
  return manilaDateKey(dateStartUtc(date) + DAY_MS);
}

function validDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && manilaDateKey(dateStartUtc(value)) === value;
}

function resolveAnalyticsRange(input = {}, now = Date.now()) {
  const preset = input.preset || "7d";
  const today = manilaDateKey(now);
  let startDate;
  let endDate;
  let label;

  if (preset === "today") {
    startDate = today;
    endDate = today;
    label = "Today";
  } else if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    startDate = manilaDateKey(dateStartUtc(today) - ((days - 1) * DAY_MS));
    endDate = today;
    label = `Last ${days} days`;
  } else if (preset === "custom") {
    if (!validDateKey(input.startDate) || !validDateKey(input.endDate)) {
      throw new Error("Custom analytics dates must use YYYY-MM-DD.");
    }
    startDate = input.startDate;
    endDate = input.endDate;
    label = `${startDate} to ${endDate}`;
  } else {
    throw new Error("Unsupported analytics range.");
  }

  const startAtMs = dateStartUtc(startDate);
  const endAtMs = dateStartUtc(nextDate(endDate));
  const days = Math.round((endAtMs - startAtMs) / DAY_MS);
  if (endAtMs <= startAtMs) throw new Error("Analytics end date must not be before the start date.");
  if (days > 366) throw new Error("Analytics ranges are limited to 366 days.");

  return {
    preset,
    label,
    timeZone: "Asia/Manila",
    startDate,
    endDate,
    startAt: new Date(startAtMs).toISOString(),
    endAtExclusive: new Date(endAtMs).toISOString(),
    startAtMs,
    endAtMs,
    days
  };
}

function analyticsSnapshotId(range) {
  return `v${ANALYTICS_VERSION}_${range.startDate}_${range.endDate}`;
}

function uniqueById(documents = []) {
  const seen = new Set();
  return documents.filter((document, index) => {
    if (!document) return false;
    const key = document.id === undefined ? `index:${index}` : String(document.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timestamp(value) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inRange(value, range) {
  const parsed = timestamp(value);
  return parsed !== undefined && parsed >= range.startAtMs && parsed < range.endAtMs;
}

function countValues(values, allowed) {
  return Object.fromEntries(allowed.map((value) => [value, values.filter((item) => item === value).length]));
}

function countCategories(tasks) {
  const counts = new Map();
  tasks.forEach((task) => {
    const category = String(task.category || "Uncategorized").trim() || "Uncategorized";
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

function average(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function percentage(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function buildDailySeries(range, collections) {
  const rows = new Map();
  for (let day = range.startAtMs; day < range.endAtMs; day += DAY_MS) {
    const date = manilaDateKey(day);
    rows.set(date, { date, posted: 0, applications: 0, accepted: 0, completed: 0, notifications: 0, converted: 0 });
  }
  const increment = (value, field) => {
    if (!inRange(value, range)) return;
    const row = rows.get(manilaDateKey(value));
    if (row) row[field] += 1;
  };
  collections.tasks.forEach((task) => {
    increment(task.createdAt, "posted");
    increment(task.acceptedAt, "accepted");
    increment(task.finishedAt, "completed");
  });
  collections.taskMatches.forEach((match) => increment(match.createdAt, "applications"));
  collections.notifications.forEach((notification) => {
    increment(notification.createdAt, "notifications");
    increment(notification.applicationConvertedAt, "converted");
  });
  return [...rows.values()];
}

function buildAnalyticsReport(input, rangeInput = {}, generatedAt = new Date().toISOString()) {
  const range = resolveAnalyticsRange(rangeInput, timestamp(generatedAt) ?? Date.now());
  const users = uniqueById(input.users);
  const verificationRequests = uniqueById(input.verificationRequests);
  const tasks = uniqueById(input.tasks);
  const payments = uniqueById(input.payments);
  const taskMatches = uniqueById(input.taskMatches);
  const matchingNotifications = uniqueById(input.notifications)
    .filter((notification) => notification.notificationType === "Matching task");
  const publicUsers = users.filter((user) => user.role === "client" || user.role === "worker");
  const postedTasks = tasks.filter((task) => inRange(task.createdAt, range));
  const applications = taskMatches.filter((match) => inRange(match.createdAt, range));
  const acceptedTasks = tasks.filter((task) => inRange(task.acceptedAt, range));
  const completedTasks = tasks.filter((task) => inRange(task.finishedAt, range));
  const cancelledTasks = tasks.filter((task) => inRange(task.cancelledAt, range));
  const disputedTasks = tasks.filter((task) => inRange(task.disputedAt, range));
  const periodNotifications = matchingNotifications.filter((notification) => inRange(notification.createdAt, range));
  const telemetryAvailable = matchingNotifications.some((notification) =>
    Number.isFinite(Number(notification.matchPolicyVersion))
  );
  const postedTaskIds = new Set(postedTasks.map((task) => task.id));
  const matchedTaskIds = new Set(applications
    .map((match) => match.taskId)
    .filter((taskId) => typeof taskId === "string" && taskId.length > 0));
  const eligibleNotificationsForPostedTasks = matchingNotifications.filter((notification) =>
    postedTaskIds.has(notification.taskId)
  );
  const firstApplicationMinutes = postedTasks.flatMap((task) => {
    const createdAt = timestamp(task.createdAt);
    const first = taskMatches
      .filter((match) => match.taskId === task.id)
      .map((match) => timestamp(match.createdAt))
      .filter((value) => value !== undefined && value >= createdAt)
      .sort((left, right) => left - right)[0];
    return createdAt !== undefined && first !== undefined ? [(first - createdAt) / 60_000] : [];
  });
  const acceptanceMinutes = acceptedTasks.flatMap((task) => {
    const createdAt = timestamp(task.createdAt);
    const acceptedAt = timestamp(task.acceptedAt);
    return createdAt !== undefined && acceptedAt !== undefined && acceptedAt >= createdAt
      ? [(acceptedAt - createdAt) / 60_000]
      : [];
  });
  const opened = periodNotifications.filter((notification) => Boolean(notification.openedAt)).length;
  const converted = periodNotifications.filter((notification) => Boolean(notification.applicationConvertedAt)).length;
  const periodPayments = payments.filter((payment) => inRange(payment.createdAt, range));
  const accountStatuses = publicUsers.map((user) => user.accountStatus || "active");
  const verificationStatuses = verificationRequests.map((request) => request.status);
  const paymentStatuses = periodPayments.map((payment) => payment.paymentStatus);

  const report = {
    version: ANALYTICS_VERSION,
    source: "trusted-function",
    snapshotId: analyticsSnapshotId(range),
    generatedAt,
    range: {
      preset: range.preset,
      label: range.label,
      timeZone: range.timeZone,
      startDate: range.startDate,
      endDate: range.endDate,
      startAt: range.startAt,
      endAtExclusive: range.endAtExclusive
    },
    accounts: {
      employers: publicUsers.filter((user) => user.role === "client").length,
      taskers: publicUsers.filter((user) => user.role === "worker").length,
      active: accountStatuses.filter((status) => status === "active" || status === "pending_verification").length,
      restricted: accountStatuses.filter((status) => status === "suspended" || status === "deleted").length
    },
    verification: {
      pending: verificationStatuses.filter((status) => status === "Pending Verification").length,
      approved: verificationStatuses.filter((status) => status === "Verified").length,
      rejected: verificationStatuses.filter((status) => status === "Rejected").length,
      resubmission: verificationStatuses.filter((status) => status === "Needs Resubmission").length
    },
    taskInventory: {
      total: tasks.length,
      byStatus: countValues(tasks.map((task) => task.status), TASK_STATUSES)
    },
    activity: {
      posted: postedTasks.length,
      matched: matchedTaskIds.size,
      applications: applications.length,
      accepted: acceptedTasks.length,
      completed: completedTasks.length,
      cancelled: cancelledTasks.length,
      disputed: disputedTasks.length,
      byCategory: countCategories(postedTasks)
    },
    payments: {
      ...countValues(paymentStatuses, PAYMENT_STATUSES),
      unresolvedReviews: periodPayments.filter((payment) =>
        payment.paymentMethod === "GCash link" && payment.paymentStatus === "Submitted"
      ).length
    },
    matching: {
      telemetryAvailable,
      notificationsSent: periodNotifications.length,
      opened,
      converted,
      openRatePercent: telemetryAvailable ? percentage(opened, periodNotifications.length) : null,
      conversionRatePercent: telemetryAvailable ? percentage(converted, periodNotifications.length) : null,
      averageEligibleTaskersPerPostedTask: telemetryAvailable && postedTasks.length > 0
        ? average([eligibleNotificationsForPostedTasks.length / postedTasks.length])
        : null,
      averageMinutesToFirstApplication: average(firstApplicationMinutes),
      averageMinutesToAcceptance: average(acceptanceMinutes)
    },
    daily: buildDailySeries(range, { tasks, taskMatches, notifications: matchingNotifications })
  };

  return report;
}

module.exports = {
  ANALYTICS_VERSION,
  analyticsSnapshotId,
  buildAnalyticsReport,
  manilaDateKey,
  resolveAnalyticsRange
};
