const assert = require("node:assert/strict");
const test = require("node:test");
const {
  analyticsSnapshotId,
  buildAnalyticsReport,
  manilaDateKey,
  resolveAnalyticsRange
} = require("./analytics");

const generatedAt = "2026-10-01T04:00:00.000Z";

function fixtures() {
  return {
    users: [
      { id: "client-1", role: "client", accountStatus: "active" },
      { id: "worker-1", role: "worker", accountStatus: "active" },
      { id: "worker-2", role: "worker", accountStatus: "suspended" },
      { id: "worker-2", role: "worker", accountStatus: "suspended" }
    ],
    verificationRequests: [
      { id: "verification-1", status: "Pending Verification" },
      { id: "verification-2", status: "Verified" },
      { id: "verification-3", status: "Rejected" },
      { id: "verification-4", status: "Needs Resubmission" }
    ],
    tasks: [
      {
        id: "task-1", status: "Finished", category: "Cleaning",
        createdAt: "2026-09-30T00:00:00.000Z",
        acceptedAt: "2026-09-30T02:00:00.000Z",
        finishedAt: "2026-09-30T05:00:00.000Z",
        latitude: 10.6765, longitude: 122.9509
      },
      {
        id: "task-2", status: "Cancelled", category: "Plumbing",
        createdAt: "2026-09-25T00:00:00.000Z",
        cancelledAt: "2026-09-26T00:00:00.000Z"
      },
      {
        id: "task-3", status: "Disputed", category: "Delivery",
        createdAt: "2026-09-24T00:00:00.000Z",
        disputedAt: "2026-09-30T03:00:00.000Z"
      }
    ],
    payments: [
      { id: "payment-1", paymentMethod: "GCash link", paymentStatus: "Submitted", createdAt: "2026-09-30T00:00:00.000Z" },
      { id: "payment-2", paymentMethod: "COD", paymentStatus: "Verified", createdAt: "2026-09-25T00:00:00.000Z" }
    ],
    taskMatches: [
      { id: "match-1", taskId: "task-1", createdAt: "2026-09-30T01:00:00.000Z" },
      { id: "match-1", taskId: "task-1", createdAt: "2026-09-30T01:00:00.000Z" },
      { id: "match-2", taskId: "task-3", createdAt: "2026-09-30T04:00:00.000Z" }
    ],
    notifications: [
      {
        id: "notification-1", taskId: "task-1", notificationType: "Matching task", matchPolicyVersion: 3,
        createdAt: "2026-09-30T00:05:00.000Z", openedAt: "2026-09-30T00:10:00.000Z",
        applicationConvertedAt: "2026-09-30T01:00:00.000Z", currentLatitude: 10.6765
      },
      {
        id: "notification-1", taskId: "task-1", notificationType: "Matching task", matchPolicyVersion: 3,
        createdAt: "2026-09-30T00:05:00.000Z"
      },
      {
        id: "notification-2", taskId: "task-1", notificationType: "Matching task", matchPolicyVersion: 3,
        createdAt: "2026-09-30T00:15:00.000Z"
      },
      { id: "notification-3", notificationType: "New message", createdAt: "2026-09-30T00:00:00.000Z" }
    ]
  };
}

test("analytics ranges use Asia/Manila inclusive calendar dates", () => {
  const range = resolveAnalyticsRange({ preset: "today" }, Date.parse("2026-10-01T00:30:00.000Z"));
  assert.equal(range.startDate, "2026-10-01");
  assert.equal(range.startAt, "2026-09-30T16:00:00.000Z");
  assert.equal(range.endAtExclusive, "2026-10-01T16:00:00.000Z");
  assert.equal(manilaDateKey("2026-09-30T16:00:00.000Z"), "2026-10-01");
});

test("custom ranges reject invalid order, invalid dates, and excessive spans", () => {
  assert.throws(() => resolveAnalyticsRange({ preset: "custom", startDate: "2026-10-02", endDate: "2026-10-01" }), /before/);
  assert.throws(() => resolveAnalyticsRange({ preset: "custom", startDate: "2026-02-30", endDate: "2026-03-01" }), /YYYY-MM-DD/);
  assert.throws(() => resolveAnalyticsRange({ preset: "custom", startDate: "2025-01-01", endDate: "2026-10-01" }), /366/);
});

test("known beta fixtures produce reproducible account, funnel, payment, and matching metrics", () => {
  const report = buildAnalyticsReport(fixtures(), { preset: "7d" }, generatedAt);
  assert.deepEqual(report.accounts, { employers: 1, taskers: 2, active: 2, restricted: 1 });
  assert.deepEqual(report.verification, { pending: 1, approved: 1, rejected: 1, resubmission: 1 });
  assert.equal(report.taskInventory.total, 3);
  assert.equal(report.taskInventory.byStatus.Finished, 1);
  assert.equal(report.activity.posted, 2);
  assert.equal(report.activity.matched, 2);
  assert.equal(report.activity.applications, 2);
  assert.equal(report.activity.accepted, 1);
  assert.equal(report.activity.completed, 1);
  assert.equal(report.activity.cancelled, 1);
  assert.equal(report.activity.disputed, 1);
  assert.deepEqual(report.activity.byCategory, [
    { category: "Cleaning", count: 1 },
    { category: "Plumbing", count: 1 }
  ]);
  assert.equal(report.payments.Submitted, 1);
  assert.equal(report.payments.Verified, 1);
  assert.equal(report.payments.unresolvedReviews, 1);
  assert.equal(report.matching.notificationsSent, 2);
  assert.equal(report.matching.opened, 1);
  assert.equal(report.matching.converted, 1);
  assert.equal(report.matching.openRatePercent, 50);
  assert.equal(report.matching.conversionRatePercent, 50);
  assert.equal(report.matching.averageEligibleTaskersPerPostedTask, 1);
  assert.equal(report.matching.averageMinutesToFirstApplication, 60);
  assert.equal(report.matching.averageMinutesToAcceptance, 120);
});

test("analytics snapshots are deterministic, retry-safe, and exclude sensitive source fields", () => {
  const first = buildAnalyticsReport(fixtures(), { preset: "7d" }, generatedAt);
  const second = buildAnalyticsReport(fixtures(), { preset: "7d" }, generatedAt);
  assert.equal(first.snapshotId, analyticsSnapshotId(resolveAnalyticsRange({ preset: "7d" }, Date.parse(generatedAt))));
  assert.deepEqual(first, second);
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /client-1|worker-1|task-1|currentLatitude|longitude|validId|proofOfPayment/);
});

test("missing matching telemetry is labeled unavailable rather than reported as a proven zero", () => {
  const input = fixtures();
  input.notifications = [];
  const report = buildAnalyticsReport(input, { preset: "7d" }, generatedAt);
  assert.equal(report.matching.telemetryAvailable, false);
  assert.equal(report.matching.openRatePercent, null);
  assert.equal(report.matching.conversionRatePercent, null);
  assert.equal(report.matching.averageEligibleTaskersPerPostedTask, null);
});

test("eligible-tasker average is unavailable when the selected period has no posted-task denominator", () => {
  const input = fixtures();
  input.tasks = input.tasks.map((task) => ({ ...task, createdAt: "2026-08-01T00:00:00.000Z" }));
  const report = buildAnalyticsReport(input, { preset: "7d" }, generatedAt);
  assert.equal(report.activity.posted, 0);
  assert.equal(report.matching.telemetryAvailable, true);
  assert.equal(report.matching.averageEligibleTaskersPerPostedTask, null);
});
