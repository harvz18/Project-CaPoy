const assert = require("node:assert/strict");
const test = require("node:test");

const {
  authorityFromClaims,
  buildAccountStatusChange,
  buildLockedNameCorrection,
  buildViolationReport,
  hasSuperadminAuthority,
  toModerationUser
} = require("./authority");

const activeWorker = {
  role: "worker",
  fullName: "Juan Dela Cruz",
  accountStatus: "active",
  identityStatus: "Approved"
};

test("custom claims resolve to the strongest trusted authority", () => {
  assert.equal(authorityFromClaims({}), "user");
  assert.equal(authorityFromClaims({ admin: true }), "admin");
  assert.equal(authorityFromClaims({ admin: true, superadmin: true }), "superadmin");
  assert.equal(authorityFromClaims({ superadmin: true }), "superadmin");
  assert.equal(authorityFromClaims({ admin: "true", superadmin: "true" }), "user");
  assert.equal(hasSuperadminAuthority({ admin: true }), false);
  assert.equal(hasSuperadminAuthority({ superadmin: true }), true);
});

test("restriction requires a reason and an evidence reference and records both values", () => {
  const result = buildAccountStatusChange({
    actorId: "super-1",
    targetId: "worker-1",
    target: activeWorker,
    accountStatus: "suspended",
    reason: "Repeated harassment confirmed during review.",
    evidenceReference: "report-2026-001",
    changedAt: "2026-09-30T10:00:00.000Z"
  });
  assert.equal(result.update.accountStatus, "suspended");
  assert.equal(result.update.restrictedBy, "super-1");
  assert.equal(result.audit.metadata.previousAccountStatus, "active");
  assert.equal(result.audit.metadata.evidenceReference, "report-2026-001");
  assert.throws(() => buildAccountStatusChange({
    actorId: "super-1", targetId: "worker-1", target: activeWorker,
    accountStatus: "suspended", reason: "A valid reason is provided.", changedAt: "now"
  }), /evidence reference/i);
});

test("reactivation and self-moderation guards preserve authority boundaries", () => {
  const target = { ...activeWorker, accountStatus: "suspended" };
  const result = buildAccountStatusChange({
    actorId: "super-1",
    targetId: "worker-1",
    target,
    accountStatus: "active",
    reason: "Appeal reviewed and access may be restored.",
    changedAt: "2026-09-30T11:00:00.000Z"
  });
  assert.equal(result.update.accountStatus, "active");
  assert.equal(result.update.restrictionReason, null);
  assert.throws(() => buildAccountStatusChange({
    actorId: "worker-1", targetId: "worker-1", target,
    accountStatus: "active", reason: "This should never be allowed.", changedAt: "now"
  }), /own account/i);
});

test("locked-name corrections normalize the name and keep the previous value in the audit", () => {
  const result = buildLockedNameCorrection({
    actorId: "super-1",
    targetId: "worker-1",
    target: activeWorker,
    fullName: "  Juan   Santos  ",
    reason: "Government ID correction was reviewed.",
    evidenceReference: "verification/worker-1/correction.pdf",
    changedAt: "2026-09-30T12:00:00.000Z"
  });
  assert.equal(result.update.fullName, "Juan Santos");
  assert.equal(result.audit.metadata.previousFullName, "Juan Dela Cruz");
  assert.throws(() => buildLockedNameCorrection({
    actorId: "super-1", targetId: "worker-2", target: { ...activeWorker, identityStatus: "Unverified" },
    fullName: "New Name", reason: "Requested name correction with evidence.", changedAt: "now"
  }), /not approved/i);
});

test("violation reports are normalized and moderation views exclude private profile data", () => {
  const report = buildViolationReport({
    reporterId: "client-1",
    targetId: "worker-1",
    category: "Safety",
    reason: " Unsafe behavior was observed at the worksite. ",
    taskId: "task-1",
    createdAt: "2026-09-30T13:00:00.000Z"
  });
  assert.equal(report.status, "Open");
  assert.equal(report.reason, "Unsafe behavior was observed at the worksite.");

  const view = toModerationUser("worker-1", {
    ...activeWorker,
    mobileNumber: "09170000000",
    address: "Private address"
  });
  assert.equal(view.fullName, "Juan Dela Cruz");
  assert.equal("mobileNumber" in view, false);
  assert.equal("address" in view, false);
});
