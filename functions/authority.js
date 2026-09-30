const PUBLIC_ROLES = new Set(["client", "worker"]);
const REPORT_CATEGORIES = new Set(["Safety", "Fraud", "Harassment", "Payment", "Other"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function normalizeText(value, fieldName, minimum, maximum) {
  if (typeof value !== "string") throw new Error(`${fieldName} is required.`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${fieldName} must be between ${minimum} and ${maximum} characters.`);
  }
  if (CONTROL_CHARACTERS.test(normalized)) {
    throw new Error(`${fieldName} contains unsupported control characters.`);
  }
  return normalized;
}

function optionalReference(value, fieldName = "Evidence reference") {
  if (value === undefined || value === null || value === "") return "";
  return normalizeText(value, fieldName, 2, 500);
}

function authorityFromClaims(token = {}) {
  if (token.superadmin === true) return "superadmin";
  if (token.admin === true) return "admin";
  return "user";
}

function hasSuperadminAuthority(token = {}) {
  return authorityFromClaims(token) === "superadmin";
}

function assertPublicTarget(target, actorId, targetId) {
  if (!target || !PUBLIC_ROLES.has(target.role)) {
    throw new Error("Only employer and tasker accounts can be moderated.");
  }
  if (actorId === targetId) throw new Error("You cannot moderate your own account.");
}

function buildAccountStatusChange({
  actorId,
  targetId,
  target,
  accountStatus,
  reason,
  evidenceReference,
  violationReportId,
  changedAt
}) {
  assertPublicTarget(target, actorId, targetId);
  if (!new Set(["active", "suspended"]).has(accountStatus)) {
    throw new Error("Unsupported account status.");
  }
  const normalizedReason = normalizeText(reason, "Reason", 10, 500);
  const normalizedEvidence = optionalReference(evidenceReference);
  const normalizedReportId = optionalReference(violationReportId, "Violation report ID");
  if (accountStatus === "suspended" && !normalizedEvidence && !normalizedReportId) {
    throw new Error("An evidence reference or violation report ID is required to restrict an account.");
  }
  const previousAccountStatus = target.accountStatus ?? "active";
  if (previousAccountStatus === accountStatus) {
    throw new Error(`This account is already ${accountStatus}.`);
  }

  const update = accountStatus === "suspended"
    ? {
        accountStatus,
        restrictionReason: normalizedReason,
        restrictionEvidenceReference: normalizedEvidence || normalizedReportId,
        restrictedAt: changedAt,
        restrictedBy: actorId,
        updatedAt: changedAt
      }
    : {
        accountStatus,
        restrictionReason: null,
        restrictionEvidenceReference: null,
        reactivatedAt: changedAt,
        reactivatedBy: actorId,
        updatedAt: changedAt
      };

  return {
    update,
    audit: {
      actorId,
      action: accountStatus === "suspended" ? "restrict_user_account" : "reactivate_user_account",
      targetType: "user",
      targetId,
      reason: normalizedReason,
      metadata: {
        previousAccountStatus,
        accountStatus,
        evidenceReference: normalizedEvidence || null,
        violationReportId: normalizedReportId || null
      }
    }
  };
}

function isIdentityLocked(target) {
  return Boolean(
    target &&
    (target.identityStatus === "Approved" || target.identityLockedAt || target.verificationStatus === "Verified")
  );
}

function buildLockedNameCorrection({ actorId, targetId, target, fullName, reason, evidenceReference, changedAt }) {
  assertPublicTarget(target, actorId, targetId);
  if (!isIdentityLocked(target)) throw new Error("This identity is not approved and does not require a locked-name correction.");
  const normalizedFullName = normalizeText(fullName, "Full name", 2, 100);
  const normalizedReason = normalizeText(reason, "Reason", 10, 500);
  const normalizedEvidence = optionalReference(evidenceReference);
  if (normalizedFullName === target.fullName) throw new Error("The corrected full name must be different.");

  return {
    update: { fullName: normalizedFullName, updatedAt: changedAt },
    audit: {
      actorId,
      action: "correct_locked_full_name",
      targetType: "user",
      targetId,
      reason: normalizedReason,
      metadata: {
        previousFullName: target.fullName,
        fullName: normalizedFullName,
        evidenceReference: normalizedEvidence || null
      }
    }
  };
}

function buildViolationReport({ reporterId, targetId, category, reason, evidenceReference, taskId, createdAt }) {
  if (reporterId === targetId) throw new Error("You cannot submit a report about your own account.");
  if (!REPORT_CATEGORIES.has(category)) throw new Error("Unsupported report category.");
  const normalizedReason = normalizeText(reason, "Report details", 10, 1000);
  const normalizedEvidence = optionalReference(evidenceReference);
  const normalizedTaskId = optionalReference(taskId, "Task ID");
  return {
    reporterId,
    targetUserId: targetId,
    category,
    reason: normalizedReason,
    evidenceReference: normalizedEvidence || null,
    taskId: normalizedTaskId || null,
    status: "Open",
    createdAt,
    updatedAt: createdAt
  };
}

function toModerationUser(id, profile) {
  return {
    id,
    role: profile.role,
    fullName: profile.fullName ?? "Unnamed account",
    accountStatus: profile.accountStatus ?? "active",
    identityStatus: profile.identityStatus ?? null,
    restrictionReason: profile.restrictionReason ?? null,
    restrictionEvidenceReference: profile.restrictionEvidenceReference ?? null,
    restrictedAt: profile.restrictedAt ?? null
  };
}

module.exports = {
  authorityFromClaims,
  buildAccountStatusChange,
  buildLockedNameCorrection,
  buildViolationReport,
  hasSuperadminAuthority,
  isIdentityLocked,
  toModerationUser
};
