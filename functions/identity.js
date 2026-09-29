function buildIdentityReview(decision, reviewedAt, reviewerId) {
  if (decision === "Verified") {
    return {
      identityStatus: "Approved",
      identityApprovedAt: reviewedAt,
      identityApprovedBy: reviewerId,
      identityLockedAt: reviewedAt
    };
  }
  if (decision === "Rejected") return { identityStatus: "Rejected" };
  if (decision === "Needs Resubmission") return { identityStatus: "Needs Resubmission" };
  throw new Error("Unsupported verification decision.");
}

module.exports = { buildIdentityReview };
